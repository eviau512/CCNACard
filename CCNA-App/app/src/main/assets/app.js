// CCNA Flashcards Practice Engine (moe.ccna.cards)
let allQuestions = [];
let activeQueue = [];
let currentIndex = 0;
let currentQuestion = null;
let currentSelectedOptions = new Set();
let isAnswerSubmitted = false;

// Drag & Drop State
let dndPlacements = {}; // targetId -> sourceIdx
let dndSelectedSourceIdx = null;
let dndShuffledSources = []; // array of { idx, text }

// Persistence State
let appState = {
  masteredIds: {},          // qid -> boolean
  bookmarkedIds: {},        // qid -> boolean
  history: [],              // array of { qid, domain, topic, misconception, correct, isIdk, time }
  retryInterval: 7,         // default 7 questions later
  retryDefaultMigratedV2: true,
  shuffleOptions: true,     // default true: randomize option order (需要乱序选项)
  drillTopic: null          // active topic drill if any
};

let currentWindow = 50; // 50 / 200 / 500

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  loadStoredState();
  initTheme();
  initLightboxGestures();
  await loadQuestionData();
  setupPracticeQueue();
  renderCurrentCard();
  updateHeaderStats();
});

function loadStoredState() {
  try {
    const raw = localStorage.getItem('ccna_app_state_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.retryDefaultMigratedV2) {
        if (!parsed.retryInterval || parsed.retryInterval === 4) {
          parsed.retryInterval = 7;
        }
        parsed.retryDefaultMigratedV2 = true;
      }
      appState = Object.assign(appState, parsed);
    }
  } catch (e) {
    console.error('Failed to load state from localStorage', e);
  }
}

function saveState() {
  try {
    // Keep max 500 history items to bound storage
    if (appState.history.length > 500) {
      appState.history = appState.history.slice(-500);
    }
    localStorage.setItem('ccna_app_state_v1', JSON.stringify(appState));
  } catch (e) {
    console.error('Failed to save state to localStorage', e);
  }
}

async function loadQuestionData() {
  const bundle = window.CCNA_QUESTIONS_DATA || window.ccnaCardsData || (typeof ccnaCardsData !== 'undefined' ? ccnaCardsData : null);
  if (bundle && Array.isArray(bundle) && bundle.length > 0) {
    allQuestions = bundle;
    console.log(`Loaded ${allQuestions.length} CCNA questions from script bundle.`);
    return true;
  }
  try {
    const res = await fetch('data/ccna_cards_tagged.json');
    allQuestions = await res.json();
    console.log(`Loaded ${allQuestions.length} CCNA questions from fetch.`);
    return true;
  } catch (err) {
    console.error('Error fetching questions:', err);
    document.getElementById('cardPrompt').textContent = 'Error loading question bank. Please reinstall or restart app.';
    return false;
  }
}

function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function setupPracticeQueue(filterTopic = null) {
  let pool = allQuestions;
  if (filterTopic) {
    pool = allQuestions.filter(q => q.topic === filterTopic || q.domain === filterTopic);
    if (pool.length === 0) pool = allQuestions;
    appState.drillTopic = filterTopic;
    document.getElementById('drillBanner').classList.add('active');
    document.getElementById('drillBannerText').textContent = `🎯 Focused Drill: ${filterTopic} (${pool.length} Qs)`;
  } else {
    appState.drillTopic = null;
    document.getElementById('drillBanner').classList.remove('active');
  }

  // Shuffle pool pseudo-randomly
  activeQueue = shuffle(pool).map(q => ({ ...q, isRetry: false }));
  currentIndex = 0;
}

function exitDrillMode() {
  setupPracticeQueue(null);
  renderCurrentCard();
  updateHeaderStats();
  showToast('Exited drill mode. Resumed full random bank.');
}

function formatMarkdown(text) {
  if (!text) return '';
  // 1. Escape HTML
  let out = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Code blocks ```cisco ... ``` or ```text ... ```
  out = out.replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, (match, code) => {
    return `<pre class="cli-block"><code>${code.trim()}</code></pre>`;
  });

  // 3. Inline code `...`
  out = out.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // 4. Section headings starting with • or bullet points
  out = out.replace(/^[•●■]\s*(.+)$/gm, '<div class="exp-bullet-heading"><span class="bullet-dot">•</span> $1</div>');

  // 5. Convert line breaks (outside of <pre> tags)
  const parts = out.split(/(<pre[\s\S]*?<\/pre>)/);
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i].startsWith('<pre')) {
      parts[i] = parts[i].replace(/\n/g, '<br>');
    }
  }
  return parts.join('');
}

function renderCurrentCard() {
  if (currentIndex >= activeQueue.length) {
    // Reshuffle unmastered or repeat
    setupPracticeQueue(appState.drillTopic);
  }

  currentQuestion = activeQueue[currentIndex];
  isAnswerSubmitted = false;
  currentSelectedOptions.clear();

  // Elements
  const qidEl = document.getElementById('cardQid');
  const domainEl = document.getElementById('cardDomain');
  const topicEl = document.getElementById('cardTopic');
  const retryBadge = document.getElementById('cardRetryBadge');
  const bookmarkBtn = document.getElementById('bookmarkBtn');
  const promptEl = document.getElementById('cardPrompt');
  const exhibitWrap = document.getElementById('cardExhibitWrap');
  const exhibitImg = document.getElementById('cardExhibitImg');
  const optionsList = document.getElementById('cardOptionsList');
  const idkWrap = document.getElementById('idkWrap');
  const expCard = document.getElementById('explanationCard');
  const actionBtn = document.getElementById('actionBtn');

  // Set top tags
  qidEl.textContent = `#${currentQuestion.id}`;
  domainEl.textContent = currentQuestion.domain || 'Network Fundamentals';
  topicEl.textContent = currentQuestion.topic || 'General';
  
  if (currentQuestion.isRetry) {
    retryBadge.style.display = 'inline-block';
    retryBadge.textContent = '🔁 Reinforce';
  } else {
    retryBadge.style.display = 'none';
  }

  // Bookmark state
  if (appState.bookmarkedIds[currentQuestion.id]) {
    bookmarkBtn.classList.add('active');
  } else {
    bookmarkBtn.classList.remove('active');
  }

  // Set prompt with markdown and code support
  promptEl.innerHTML = formatMarkdown(currentQuestion.prompt || '');

  // Handle image exhibit
  if (currentQuestion.image) {
    exhibitImg.src = currentQuestion.image;
    exhibitWrap.style.display = 'block';
  } else {
    exhibitWrap.style.display = 'none';
  }

  // Reset Explanation and Buttons
  expCard.classList.remove('active');
  const oldSolImg = expCard.querySelector('.solution-img');
  if (oldSolImg) oldSolImg.remove();
  document.getElementById('expMisconception').style.display = 'none';
  idkWrap.style.display = 'block';
  actionBtn.textContent = 'Check Answer';
  actionBtn.className = 'btn btn-primary';

  // Render options or Interactive Drag & Drop
  optionsList.innerHTML = '';
  dndPlacements = {};
  dndSelectedSourceIdx = null;
  dndShuffledSources = [];

  const isMulti = (currentQuestion.answer && currentQuestion.answer.length > 1) || (currentQuestion.type === 'Multiple Choice');

  if (currentQuestion.type === 'Drag and Drop' && currentQuestion.drag_drop_data &&
      Array.isArray(currentQuestion.drag_drop_data.sources) &&
      Array.isArray(currentQuestion.drag_drop_data.targets) &&
      currentQuestion.drag_drop_data.targets.length > 0) {
    renderDragDropBoard(optionsList, currentQuestion.drag_drop_data);
    actionBtn.textContent = 'Check Answer';
  } else if (currentQuestion.options && currentQuestion.options.length > 0) {
    // Check if option texts reference fixed exhibit letters (e.g., "See Exhibit Image A")
    const hasExhibitLetterRef = currentQuestion.options.some(o => /Exhibit Image [A-G]/i.test(o.text));
    const shouldShuffle = (appState.shuffleOptions !== false) && !hasExhibitLetterRef;
    const displayOptions = shouldShuffle ? shuffle(currentQuestion.options) : currentQuestion.options.slice();
    const displayLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    displayOptions.forEach((opt, idx) => {
      const dispLbl = displayLetters[idx] || opt.label;
      const optDiv = document.createElement('div');
      optDiv.className = 'option-item';
      optDiv.dataset.label = opt.label;        // original key label for grading
      optDiv.dataset.displayLabel = dispLbl;   // visual letter shown to user

      const ind = document.createElement('div');
      ind.className = 'opt-indicator';
      ind.textContent = dispLbl;

      const txt = document.createElement('div');
      txt.className = 'opt-text';
      txt.textContent = opt.text;

      optDiv.appendChild(ind);
      optDiv.appendChild(txt);

      optDiv.onclick = () => selectOption(opt.label, isMulti);
      optionsList.appendChild(optDiv);
    });
  } else {
    // For lab simulations or fallback items
    if (currentQuestion.type === 'Simulation / Lab') {
      const simWrap = document.createElement('div');
      simWrap.id = 'inlineSimWrapper';
      optionsList.appendChild(simWrap);

      if (window.IosSimulator) {
        const devs = IosSimulator.extractDevices(currentQuestion.prompt);
        new IosSimulator(simWrap, { devices: devs });
      } else {
        const notice = document.createElement('div');
        notice.style.fontSize = '0.92rem';
        notice.style.background = 'var(--bg-secondary)';
        notice.style.border = '1px solid var(--border-color)';
        notice.style.borderRadius = 'var(--radius-md)';
        notice.style.color = 'var(--text-secondary)';
        notice.style.padding = '14px 16px';
        notice.innerHTML = '🛠️ <strong>Hands-on CLI Simulation Item</strong><br>Review the topology & tasks, formulate your CLI commands, then tap below to inspect the verified reference configuration.';
        optionsList.appendChild(notice);
      }
      actionBtn.textContent = 'Reveal Reference CLI Config';
    } else {
      const notice = document.createElement('div');
      notice.style.fontSize = '0.92rem';
      notice.style.background = 'var(--bg-secondary)';
      notice.style.border = '1px solid var(--border-color)';
      notice.style.borderRadius = 'var(--radius-md)';
      notice.style.color = 'var(--text-secondary)';
      notice.style.padding = '14px 16px';
      notice.style.lineHeight = '1.6';
      notice.style.margin = '10px 0';
      notice.innerHTML = '💡 <strong>Interactive Placement / Matching Item</strong><br>Review the exhibit above and formulate your matching, then tap below to reveal the official solution diagram.';
      optionsList.appendChild(notice);
      actionBtn.textContent = 'Reveal Solution Diagram';
    }
  }

  // Scroll to top of card
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderDragDropBoard(container, dndData) {
  const rawSources = dndData.sources.map((text, idx) => ({ idx, text }));
  dndShuffledSources = (appState.shuffleOptions !== false) ? shuffle(rawSources) : rawSources;

  const board = document.createElement('div');
  board.className = 'dnd-board';
  board.id = 'dndBoard';

  // Header bar with instructions + reset button
  const headerBar = document.createElement('div');
  headerBar.className = 'dnd-header-bar';
  headerBar.innerHTML = `
    <span>🧩 <strong>Drag</strong> or <strong>Tap</strong> an item below, then tap a target slot</span>
    <button type="button" class="dnd-reset-btn" onclick="resetDndPlacements()">↺ Reset</button>
  `;
  board.appendChild(headerBar);

  // Source Pool Section
  const srcSection = document.createElement('div');
  srcSection.innerHTML = `<div class="dnd-section-title"><span>Available Items (${dndShuffledSources.length})</span><span>Source Pool</span></div>`;
  const poolEl = document.createElement('div');
  poolEl.className = 'dnd-source-pool';
  poolEl.id = 'dndSourcePool';

  dndShuffledSources.forEach(item => {
    const token = document.createElement('div');
    token.className = 'dnd-token';
    token.dataset.sourceIdx = String(item.idx);
    token.textContent = item.text;
    token.onclick = (e) => {
      e.stopPropagation();
      handleDndSourceTap(item.idx);
    };
    initTokenTouchDrag(token, item.idx, item.text);
    poolEl.appendChild(token);
  });
  srcSection.appendChild(poolEl);
  board.appendChild(srcSection);

  // Target Slots Section
  const tgtSection = document.createElement('div');
  tgtSection.innerHTML = `<div class="dnd-section-title"><span>Target Destinations (${dndData.targets.length})</span><span>Drop Zone</span></div>`;
  const tgtList = document.createElement('div');
  tgtList.className = 'dnd-targets-list';
  tgtList.id = 'dndTargetsList';

  dndData.targets.forEach((tgt, idx) => {
    const tid = tgt.id || `t${idx + 1}`;
    tgt.id = tid;

    const row = document.createElement('div');
    row.className = 'dnd-target-row';
    row.dataset.targetId = tid;

    const lbl = document.createElement('div');
    lbl.className = 'dnd-target-label';
    lbl.textContent = tgt.label || `Target ${idx + 1}`;

    const slot = document.createElement('div');
    slot.className = 'dnd-slot';
    slot.dataset.targetId = tid;
    slot.innerHTML = `<span class="dnd-slot-placeholder">Tap or drop item here...</span>`;
    slot.onclick = (e) => {
      e.stopPropagation();
      handleDndSlotTap(tid);
    };

    row.appendChild(lbl);
    row.appendChild(slot);
    tgtList.appendChild(row);
  });

  tgtSection.appendChild(tgtList);
  board.appendChild(tgtSection);
  container.appendChild(board);
}

function updateDndBoardUI() {
  if (!currentQuestion || !currentQuestion.drag_drop_data) return;
  const dndData = currentQuestion.drag_drop_data;
  const usedSourceIndices = new Set(Object.values(dndPlacements));

  // Update Source Pool tokens
  document.querySelectorAll('#dndSourcePool .dnd-token').forEach(token => {
    const sIdx = parseInt(token.dataset.sourceIdx, 10);
    token.classList.toggle('placed-in-pool', usedSourceIndices.has(sIdx));
    token.classList.toggle('selected', dndSelectedSourceIdx === sIdx);
  });

  // Update Target Slots
  dndData.targets.forEach((tgt, idx) => {
    const tid = tgt.id || `t${idx + 1}`;
    const slot = document.querySelector(`.dnd-slot[data-target-id="${tid}"]`);
    if (!slot) return;

    const placedIdx = dndPlacements[tid];
    slot.classList.toggle('ready-to-drop', dndSelectedSourceIdx !== null);

    if (placedIdx !== undefined && placedIdx !== null) {
      const text = dndData.sources[placedIdx] || '';
      slot.classList.add('filled');
      slot.innerHTML = `
        <span class="dnd-slot-value"></span>
        <span class="dnd-slot-remove" title="Remove">✕</span>
      `;
      slot.querySelector('.dnd-slot-value').textContent = text;
    } else {
      slot.classList.remove('filled');
      slot.innerHTML = `<span class="dnd-slot-placeholder">${dndSelectedSourceIdx !== null ? 'Tap here to place selected item' : 'Tap or drop item here...'}</span>`;
    }
  });
}

function handleDndSourceTap(sourceIdx) {
  if (isAnswerSubmitted) return;
  if (dndSelectedSourceIdx === sourceIdx) {
    dndSelectedSourceIdx = null;
  } else {
    dndSelectedSourceIdx = sourceIdx;
  }
  updateDndBoardUI();
}

function handleDndSlotTap(targetId) {
  if (isAnswerSubmitted) return;

  if (dndSelectedSourceIdx !== null) {
    // Remove this source from any previous slot if already placed
    Object.keys(dndPlacements).forEach(k => {
      if (dndPlacements[k] === dndSelectedSourceIdx) {
        delete dndPlacements[k];
      }
    });
    dndPlacements[targetId] = dndSelectedSourceIdx;
    dndSelectedSourceIdx = null;
    updateDndBoardUI();
    return;
  }

  // If no source is currently selected and slot is filled, undock it back to pool
  if (dndPlacements[targetId] !== undefined) {
    delete dndPlacements[targetId];
    updateDndBoardUI();
  }
}

function resetDndPlacements() {
  if (isAnswerSubmitted) return;
  dndPlacements = {};
  dndSelectedSourceIdx = null;
  updateDndBoardUI();
}
window.resetDndPlacements = resetDndPlacements;

function initTokenTouchDrag(tokenEl, sourceIdx, text) {
  let avatar = null;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let currentHoverSlot = null;

  tokenEl.addEventListener('touchstart', (e) => {
    if (isAnswerSubmitted) return;
    if (tokenEl.classList.contains('placed-in-pool')) return;
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = false;
  }, { passive: true });

  tokenEl.addEventListener('touchmove', (e) => {
    if (isAnswerSubmitted || e.touches.length !== 1) return;
    const cx = e.touches[0].clientX;
    const cy = e.touches[0].clientY;
    const dist = Math.hypot(cx - startX, cy - startY);

    if (!isDragging && dist > 10) {
      isDragging = true;
      dndSelectedSourceIdx = sourceIdx;
      updateDndBoardUI();
      avatar = document.createElement('div');
      avatar.className = 'dnd-floating-avatar';
      avatar.textContent = text;
      document.body.appendChild(avatar);
    }

    if (isDragging && avatar) {
      e.preventDefault();
      avatar.style.left = `${cx}px`;
      avatar.style.top = `${cy}px`;

      // Auto-scroll page when dragging near top or bottom viewport edge
      const vh = window.innerHeight;
      if (cy > vh - 75) {
        window.scrollBy(0, 10);
      } else if (cy < 95) {
        window.scrollBy(0, -10);
      }

      const elUnder = document.elementFromPoint(cx, cy);
      const slot = elUnder ? elUnder.closest('.dnd-slot') : null;
      if (currentHoverSlot && currentHoverSlot !== slot) {
        currentHoverSlot.classList.remove('drag-over');
      }
      if (slot) {
        slot.classList.add('drag-over');
      }
      currentHoverSlot = slot;
    }
  }, { passive: false });

  const finishDrag = (e) => {
    if (!isDragging) return;
    isDragging = false;
    if (avatar) {
      avatar.remove();
      avatar = null;
    }
    if (currentHoverSlot) {
      currentHoverSlot.classList.remove('drag-over');
      const tid = currentHoverSlot.dataset.targetId;
      currentHoverSlot = null;
      if (tid) {
        Object.keys(dndPlacements).forEach(k => {
          if (dndPlacements[k] === sourceIdx) delete dndPlacements[k];
        });
        dndPlacements[tid] = sourceIdx;
        dndSelectedSourceIdx = null;
        updateDndBoardUI();
      }
    }
  };

  tokenEl.addEventListener('touchend', finishDrag);
  tokenEl.addEventListener('touchcancel', finishDrag);
}

function selectOption(label, isMulti) {
  if (isAnswerSubmitted) return;

  if (isMulti) {
    if (currentSelectedOptions.has(label)) {
      currentSelectedOptions.delete(label);
    } else {
      currentSelectedOptions.add(label);
    }
  } else {
    currentSelectedOptions.clear();
    currentSelectedOptions.add(label);
  }

  // Update DOM styles
  document.querySelectorAll('.option-item').forEach(item => {
    if (currentSelectedOptions.has(item.dataset.label)) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

function evaluateDndBoard(revealCorrectOnIdk = false) {
  const dndData = currentQuestion.drag_drop_data;
  const targets = dndData.targets || [];
  let allCorrect = true;

  // Group targets by unordered_group if specified (preserving original expected strings)
  const groupRemaining = {};
  targets.forEach(t => {
    if (t.unordered_group) {
      if (!groupRemaining[t.unordered_group]) {
        groupRemaining[t.unordered_group] = [];
      }
      groupRemaining[t.unordered_group].push({
        raw: t.expected || '',
        norm: (t.expected || '').trim().toLowerCase()
      });
    }
  });

  // First pass: check exact/unordered matches and consume matched group items
  const rowResults = {};
  targets.forEach((tgt, idx) => {
    const tid = tgt.id || `t${idx + 1}`;
    const placedIdx = dndPlacements[tid];
    const placedText = (placedIdx !== undefined && placedIdx !== null) ? (dndData.sources[placedIdx] || '') : '';
    const normPlaced = placedText.trim().toLowerCase();
    const normExpected = (tgt.expected || '').trim().toLowerCase();

    let isSlotCorrect = false;
    if (!revealCorrectOnIdk && placedText) {
      if (tgt.unordered_group && groupRemaining[tgt.unordered_group]) {
        const rem = groupRemaining[tgt.unordered_group];
        const matchPos = rem.findIndex(item => item.norm === normPlaced);
        if (matchPos !== -1) {
          isSlotCorrect = true;
          rem.splice(matchPos, 1);
        }
      } else {
        isSlotCorrect = (normPlaced === normExpected);
      }
    }

    if (!isSlotCorrect) {
      allCorrect = false;
    }
    rowResults[tid] = { isSlotCorrect, placedText, expected: tgt.expected };
  });

  // Second pass: assign remaining unmatched group expectations to incorrect slots in that group
  targets.forEach((tgt, idx) => {
    const tid = tgt.id || `t${idx + 1}`;
    const res = rowResults[tid];
    if (!res.isSlotCorrect && tgt.unordered_group && groupRemaining[tgt.unordered_group]) {
      const rem = groupRemaining[tgt.unordered_group];
      if (rem.length > 0) {
        res.expected = rem.shift().raw;
      }
    }
  });

  // Render visual feedback on each target row
  targets.forEach((tgt, idx) => {
    const tid = tgt.id || `t${idx + 1}`;
    const res = rowResults[tid];
    const row = document.querySelector(`.dnd-target-row[data-target-id="${tid}"]`);
    const slot = document.querySelector(`.dnd-slot[data-target-id="${tid}"]`);
    if (!row || !slot) return;

    slot.classList.remove('ready-to-drop', 'drag-over');
    if (res.isSlotCorrect) {
      row.classList.add('correct');
      slot.innerHTML = `<span class="dnd-slot-value">✓ ${res.placedText}</span>`;
    } else {
      row.classList.add('incorrect');
      const userDisp = res.placedText ? `✕ ${res.placedText}` : '✕ (Empty)';
      slot.innerHTML = `<span class="dnd-slot-value">${userDisp}</span>`;
      let hint = row.querySelector('.dnd-expected-hint');
      if (!hint) {
        hint = document.createElement('div');
        hint.className = 'dnd-expected-hint';
        row.appendChild(hint);
      }
      if (tgt.unordered_group) {
        hint.textContent = `✓ Expected (${tgt.unordered_group}): ${res.expected}`;
      } else {
        hint.textContent = `✓ Correct: ${res.expected}`;
      }
    }
  });

  return allCorrect;
}

function submitAnswer() {
  if (isAnswerSubmitted) {
    // Move to next card
    advanceToNextCard();
    return;
  }

  const isInteractiveDnd = (currentQuestion.type === 'Drag and Drop' &&
    currentQuestion.drag_drop_data &&
    Array.isArray(currentQuestion.drag_drop_data.targets) &&
    currentQuestion.drag_drop_data.targets.length > 0);

  if (isInteractiveDnd) {
    const placedCount = Object.keys(dndPlacements).length;
    const requiredCount = currentQuestion.drag_drop_data.targets.length;
    if (placedCount < requiredCount) {
      showToast(`Please place all ${requiredCount} items (${placedCount}/${requiredCount} placed) or tap "I Don't Know"`);
      return;
    }
  } else if (currentQuestion.options && currentQuestion.options.length > 0 && currentSelectedOptions.size === 0) {
    showToast('Please select an option or tap "I Don\'t Know"');
    return;
  }

  isAnswerSubmitted = true;
  document.getElementById('idkWrap').style.display = 'none';

  const correctAnswers = new Set(currentQuestion.answer || []);
  let isCorrect = true;
  let misconceptionMsg = null;

  if (isInteractiveDnd) {
    isCorrect = evaluateDndBoard(false);
    if (!isCorrect) {
      misconceptionMsg = `${currentQuestion.topic || 'Drag and Drop'}: One or more items were placed in the wrong target slot.`;
    }
  } else if (currentQuestion.options && currentQuestion.options.length > 0) {
    if (currentSelectedOptions.size !== correctAnswers.size) {
      isCorrect = false;
    } else {
      for (let ans of correctAnswers) {
        if (!currentSelectedOptions.has(ans)) {
          isCorrect = false;
          break;
        }
      }
    }

    // Evaluate options & highlight
    document.querySelectorAll('.option-item').forEach(item => {
      const lbl = item.dataset.label;
      const isAns = correctAnswers.has(lbl);
      const isUserChoice = currentSelectedOptions.has(lbl);

      if (isAns) {
        item.classList.add('correct');
      } else if (isUserChoice) {
        item.classList.add('incorrect');
        // Look up option misconception tag
        if (currentQuestion.option_tags && currentQuestion.option_tags[lbl]) {
          misconceptionMsg = currentQuestion.option_tags[lbl].concept;
        }
      }
    });
  }

  // Handle outcome
  if (isCorrect) {
    triggerHaptic(true);
    appState.masteredIds[currentQuestion.id] = true;
    logAttempt(true, false, null);
    showToast('✨ Correct! Well done.');
  } else {
    triggerHaptic(false);
    appState.masteredIds[currentQuestion.id] = false;
    logAttempt(false, false, misconceptionMsg);
    scheduleErrorReappearance();
    showToast('⚠️ Incorrect. Question queued for review.');
  }

  // Show explanation
  showExplanation(isCorrect, misconceptionMsg);

  // Switch button to Next
  const actionBtn = document.getElementById('actionBtn');
  actionBtn.textContent = 'Next Question →';
  actionBtn.className = 'btn btn-next';

  updateHeaderStats();
  saveState();
}

function handleIdk() {
  if (isAnswerSubmitted) return;

  isAnswerSubmitted = true;
  document.getElementById('idkWrap').style.display = 'none';
  triggerHaptic(false);

  const isInteractiveDnd = (currentQuestion.type === 'Drag and Drop' &&
    currentQuestion.drag_drop_data &&
    Array.isArray(currentQuestion.drag_drop_data.targets) &&
    currentQuestion.drag_drop_data.targets.length > 0);

  if (isInteractiveDnd) {
    evaluateDndBoard(true);
  } else {
    // Highlight all correct options
    const correctAnswers = new Set(currentQuestion.answer || []);
    document.querySelectorAll('.option-item').forEach(item => {
      if (correctAnswers.has(item.dataset.label)) {
        item.classList.add('correct');
      }
    });
  }

  // Log as IDK attempt
  const idkMsg = currentQuestion.idk_tag || `${currentQuestion.topic} (Unmastered Knowledge Point)`;
  appState.masteredIds[currentQuestion.id] = false;
  logAttempt(false, true, idkMsg);

  // Schedule reappearance
  scheduleErrorReappearance();
  showToast('Recorded as weak point. Explanation revealed.');

  // Show explanation
  showExplanation(false, `Marked as unknown: ${idkMsg}`);

  // Switch button to Next
  const actionBtn = document.getElementById('actionBtn');
  actionBtn.textContent = 'Next Question →';
  actionBtn.className = 'btn btn-next';

  updateHeaderStats();
  saveState();
}

function scheduleErrorReappearance() {
  const interval = parseInt(appState.retryInterval) || 7;
  const insertIndex = Math.min(activeQueue.length, currentIndex + interval);
  
  // Clone current question with isRetry = true
  const retryCard = { ...currentQuestion, isRetry: true };
  activeQueue.splice(insertIndex, 0, retryCard);

  // Show banner
  const banner = document.getElementById('queueBanner');
  banner.classList.add('active');
  document.getElementById('queueBannerText').textContent = 
    `🔁 Question #${currentQuestion.id} will reappear in ${interval} questions.`;
}

function showExplanation(isCorrect, misconceptionMsg) {
  const expCard = document.getElementById('explanationCard');
  const expAnswer = document.getElementById('expAnswer');
  const expText = document.getElementById('expText');
  const expMisconception = document.getElementById('expMisconception');
  const expMisconceptionText = document.getElementById('expMisconceptionText');

  // Map original answer letters to current visual display letters if shuffled
  const origAns = currentQuestion.answer || [];
  const dispLabels = [];
  const origSet = new Set(origAns);
  document.querySelectorAll('.option-item').forEach(item => {
    if (origSet.has(item.dataset.label)) {
      const d = item.dataset.displayLabel || item.dataset.label;
      if (d !== item.dataset.label) {
        dispLabels.push(`${d} (原${item.dataset.label})`);
      } else {
        dispLabels.push(d);
      }
    }
  });

  if (dispLabels.length > 0) {
    expAnswer.textContent = `Correct: ${dispLabels.join(', ')}`;
  } else {
    expAnswer.textContent = `Correct: ${origAns.join(', ')}`;
  }
  expText.innerHTML = formatMarkdown(currentQuestion.explanation || 'Refer to Cisco official documentation for this topic.');

  // If answer has visual solution diagram (drag and drop)
  if (currentQuestion.answer_image) {
    const existingImg = expCard.querySelector('.solution-img');
    if (!existingImg) {
      const solImg = document.createElement('img');
      solImg.className = 'solution-img';
      solImg.src = currentQuestion.answer_image;
      solImg.style.width = '100%';
      solImg.style.borderRadius = '8px';
      solImg.style.marginTop = '12px';
      solImg.style.cursor = 'zoom-in';
      solImg.onclick = () => openLightbox(currentQuestion.answer_image);
      expCard.appendChild(solImg);
    }
  }

  if (misconceptionMsg) {
    expMisconceptionText.textContent = misconceptionMsg;
    expMisconception.style.display = 'flex';
  } else {
    expMisconception.style.display = 'none';
  }

  expCard.classList.add('active');
}

function advanceToNextCard() {
  currentIndex++;
  renderCurrentCard();
  updateHeaderStats();
}

function logAttempt(correct, isIdk, misconception) {
  appState.history.push({
    qid: currentQuestion.id,
    domain: currentQuestion.domain,
    topic: currentQuestion.topic,
    misconception: misconception,
    correct: correct,
    isIdk: isIdk,
    time: Date.now()
  });
}

function updateHeaderStats() {
  const masteredCount = Object.values(appState.masteredIds).filter(Boolean).length;
  document.getElementById('sessionStats').textContent = 
    `Mastered: ${masteredCount} / 1,396 (Card ${currentIndex + 1})`;

  // Calculate weak points count in recent 50
  const recent = appState.history.slice(-50);
  const weakTopics = new Set();
  recent.forEach(h => {
    if (!h.correct || h.isIdk) {
      weakTopics.add(h.topic);
    }
  });

  const badge = document.getElementById('weaknessBadge');
  if (weakTopics.size > 0) {
    badge.textContent = `${weakTopics.size} weak`;
    badge.className = 'weakness-count has-issues';
  } else {
    badge.textContent = '0 weak';
    badge.className = 'weakness-count';
  }
}

// TOP-LEFT WEAKNESS ASSESSMENT MODAL
function openWeaknessModal() {
  renderWeaknessAssessment(currentWindow);
  document.getElementById('weaknessModal').classList.add('active');
}

function switchWindow(w) {
  currentWindow = w;
  document.getElementById('tab50').classList.toggle('active', w === 50);
  document.getElementById('tab200').classList.toggle('active', w === 200);
  document.getElementById('tab500').classList.toggle('active', w === 500);
  renderWeaknessAssessment(w);
}

function renderWeaknessAssessment(windowSize) {
  const subset = appState.history.slice(-windowSize);
  const total = subset.length;

  const statAttempts = document.getElementById('statAttempts');
  const statAccuracy = document.getElementById('statAccuracy');
  const statIdk = document.getElementById('statIdk');
  const weakList = document.getElementById('weakList');

  if (total === 0) {
    statAttempts.textContent = '0';
    statAccuracy.textContent = '0%';
    statIdk.textContent = '0';
    weakList.innerHTML = `
      <div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 20px;">
        No attempts in the last ${windowSize} questions yet. Start answering cards!
      </div>`;
    return;
  }

  const correctCount = subset.filter(h => h.correct).length;
  const idkCount = subset.filter(h => h.isIdk).length;
  const accuracy = Math.round((correctCount / total) * 100);

  statAttempts.textContent = total;
  statAccuracy.textContent = `${accuracy}%`;
  statIdk.textContent = idkCount;

  // Aggregate by topic
  const topicStats = {};
  subset.forEach(h => {
    const t = h.topic || 'General';
    if (!topicStats[t]) {
      topicStats[t] = { topic: t, domain: h.domain, tested: 0, failed: 0 };
    }
    topicStats[t].tested++;
    if (!h.correct || h.isIdk) {
      topicStats[t].failed++;
    }
  });

  // Calculate error rate and filter topics with at least 1 failure
  const sortedTopics = Object.values(topicStats)
    .filter(t => t.failed > 0)
    .map(t => ({
      ...t,
      errorRate: Math.round((t.failed / t.tested) * 100)
    }))
    .sort((a, b) => b.errorRate - a.errorRate || b.failed - a.failed)
    .slice(0, 5); // Top 5

  if (sortedTopics.length === 0) {
    weakList.innerHTML = `
      <div style="color: var(--success); font-size: 0.9rem; text-align: center; padding: 20px;">
        🌟 Exceptional performance! Zero weak topics detected in the last ${windowSize} attempts.
      </div>`;
    return;
  }

  weakList.innerHTML = '';
  sortedTopics.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'weak-item';

    const color = item.errorRate >= 50 ? 'var(--danger)' : item.errorRate >= 30 ? 'var(--warning)' : 'var(--primary)';

    card.innerHTML = `
      <div class="weak-item-top">
        <span class="weak-name">${idx + 1}. ${item.topic}</span>
        <span class="weak-rate" style="color: ${color}">${item.errorRate}% Error</span>
      </div>
      <div style="font-size: 0.78rem; color: var(--text-muted);">
        Domain: ${item.domain} • ${item.failed} missed / ${item.tested} tested
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${item.errorRate}%; background: ${color};"></div>
      </div>
      <div class="weak-actions">
        <button class="drill-btn" onclick="startTargetedDrill('${item.topic.replace(/'/g, "\\'")}')">
          🎯 Drill This Topic
        </button>
      </div>
    `;
    weakList.appendChild(card);
  });
}

function startTargetedDrill(topic) {
  closeModals();
  setupPracticeQueue(topic);
  renderCurrentCard();
  updateHeaderStats();
  showToast(`Started focused drill on ${topic}`);
}

// BOOKMARKS
function toggleBookmark() {
  if (!currentQuestion) return;
  const qid = currentQuestion.id;
  if (appState.bookmarkedIds[qid]) {
    delete appState.bookmarkedIds[qid];
    document.getElementById('bookmarkBtn').classList.remove('active');
    showToast('Removed from bookmarks');
  } else {
    appState.bookmarkedIds[qid] = true;
    document.getElementById('bookmarkBtn').classList.add('active');
    showToast('Bookmarked for review');
  }
  saveState();
}

// SETTINGS & MODALS
function syncRetryPillsUI() {
  const cur = parseInt(appState.retryInterval) || 7;
  const lbl = document.getElementById('retryIntervalLabel');
  if (lbl) {
    lbl.textContent = cur === 7 ? '7 Qs (Default)' : `${cur} Qs`;
  }
  document.querySelectorAll('.retry-pill').forEach(btn => {
    const v = parseInt(btn.dataset.val, 10);
    btn.classList.toggle('active', v === cur);
  });
}

function openSettingsModal() {
  syncRetryPillsUI();
  const shufToggle = document.getElementById('shuffleOptionsToggle');
  if (shufToggle) {
    shufToggle.checked = (appState.shuffleOptions !== false);
  }
  document.getElementById('settingsModal').classList.add('active');
}

function updateShuffleOptions(enabled) {
  appState.shuffleOptions = Boolean(enabled);
  saveState();
  renderCurrentCard();
  showToast(appState.shuffleOptions ? 'Option shuffling enabled (已开启乱序选项)' : 'Option shuffling disabled (已恢复固定顺序)');
}
window.updateShuffleOptions = updateShuffleOptions;

function updateRetryInterval(val) {
  appState.retryInterval = parseInt(val) || 7;
  syncRetryPillsUI();
  saveState();
  showToast(`🔁 Retry interval set to ${appState.retryInterval} questions`);
}

function jumpToQuestion(targetId = null) {
  let val = targetId;
  if (val === null || val === undefined) {
    const input = document.getElementById('jumpQidInput');
    if (input) {
      val = parseInt(input.value.trim().replace(/^#/, '').replace(/^Q/i, ''), 10);
    }
  } else if (typeof val === 'string') {
    val = parseInt(val.replace(/^#/, '').replace(/^Q/i, ''), 10);
  }
  if (!val || isNaN(val)) {
    showToast('Please enter a valid Question ID (e.g. 1056)');
    return;
  }
  const targetIdx = allQuestions.findIndex(q => q.id === val);
  if (targetIdx === -1) {
    showToast(`Question #${val} not found`);
    return;
  }
  const restShuffled = shuffle(allQuestions.filter(q => q.id !== val)).map(q => ({ ...q, isRetry: false }));
  activeQueue = [{ ...allQuestions[targetIdx], isRetry: false }, ...restShuffled];
  currentIndex = 0;
  closeModals();
  renderCurrentCard();
  showToast(`Jumped to Question #${val}`);
}
window.jumpToQuestion = jumpToQuestion;

function jumpToType(typeStr) {
  if (!typeStr) return;
  const t = typeStr.toLowerCase();
  let matches = [];
  if (t.includes('drag') || t.includes('dnd')) {
    matches = allQuestions.filter(q => q.type === 'Drag and Drop' || (q.prompt && q.prompt.includes('DRAG DROP')));
  } else if (t.includes('sim') || t.includes('lab')) {
    matches = allQuestions.filter(q => q.type === 'Simulation / Lab' || (q.prompt && q.prompt.includes('SIMULATION')));
  } else if (t.includes('multi')) {
    matches = allQuestions.filter(q => q.type === 'Multiple Choice' || (q.answer && q.answer.length > 1));
  } else {
    matches = allQuestions.filter(q => q.type && q.type.toLowerCase().includes(t));
  }

  if (matches.length === 0) {
    showToast(`No questions found matching type '${typeStr}'`);
    return;
  }
  appState.drillTopic = `Type: ${matches[0].type}`;
  document.getElementById('drillBanner').classList.add('active');
  document.getElementById('drillBannerText').textContent = `🎯 Filter: ${matches[0].type} (${matches.length} Qs)`;
  activeQueue = shuffle(matches).map(q => ({ ...q, isRetry: false }));
  currentIndex = 0;
  closeModals();
  renderCurrentCard();
  showToast(`Loaded ${matches.length} ${matches[0].type} questions`);
}
window.jumpToType = jumpToType;

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

function exportProgress() {
  const jsonStr = JSON.stringify(appState, null, 2);
  const fileName = `CCNA_Cards_Progress_${new Date().toISOString().slice(0, 10)}.json`;

  if (window.AndroidBridge && typeof window.AndroidBridge.exportToDownloads === 'function') {
    const success = window.AndroidBridge.exportToDownloads(jsonStr, fileName);
    if (success) {
      showToast('📁 已保存至系统【下载 (Download)】文件夹');
      return;
    }
  }

  // Web fallback
  try {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('📁 记录已导出');
  } catch (e) {
    showToast('导出失败: ' + e.message);
  }
}

function triggerImportProgress() {
  if (window.AndroidBridge && typeof window.AndroidBridge.pickFileForImport === 'function') {
    window.AndroidBridge.pickFileForImport();
    return;
  }
  const fileInput = document.getElementById('importFile');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

window.handleImportedJsonText = function (jsonText) {
  try {
    const imported = JSON.parse(jsonText);
    applyImportedData(imported);
  } catch (err) {
    showToast('❌ 导入文件格式错误: ' + err.message);
  }
};

function importProgress(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      applyImportedData(imported);
    } catch (err) {
      showToast('❌ 导入文件解析失败: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function applyImportedData(imported) {
  if (imported && (imported.masteredIds || imported.history || imported.bookmarkedIds)) {
    appState = Object.assign(appState, imported);
    saveState();
    updateHeaderStats();
    setupPracticeQueue(null);
    renderCurrentCard();
    closeModals();
    showToast('✨ 刷题进度已成功恢复！');
  } else {
    showToast('❌ 无效的 CCNA 学习记录文件');
  }
}

// BEAUTIFIED RESET CONFIRMATION MODAL
function openResetModal() {
  const m = document.getElementById('resetConfirmModal');
  if (m) m.classList.add('active');
}

function closeResetModal(e) {
  if (e && e.target && e.target.classList.contains('reset-modal-content')) return;
  const m = document.getElementById('resetConfirmModal');
  if (m) m.classList.remove('active');
}

function confirmResetAllProgress() {
  appState.masteredIds = {};
  appState.bookmarkedIds = {};
  appState.history = [];
  appState.weakDiagnosed = {};
  saveState();
  setupPracticeQueue(null);
  renderCurrentCard();
  updateHeaderStats();
  closeResetModal();
  closeModals();
  showToast('⚠️ 所有刷题进度与统计数据已清空');
}

function resetAllProgress() {
  openResetModal();
}

// LIGHTBOX & GESTURE ZOOM ENGINE
let lbScale = 1.0;
let lbTranslateX = 0;
let lbTranslateY = 0;
let lbStartDist = 0;
let lbStartScale = 1.0;
let lbStartX = 0;
let lbStartY = 0;
let lbInitialTranslateX = 0;
let lbInitialTranslateY = 0;
let lbLastTapTime = 0;

function updateLightboxTransform(animate = false) {
  const img = document.getElementById('lightboxImg');
  if (!img) return;
  if (animate) {
    img.style.transition = 'transform 0.25s ease-out';
  } else {
    img.style.transition = 'none';
  }
  img.style.transform = `translate3d(${lbTranslateX}px, ${lbTranslateY}px, 0) scale(${lbScale})`;
}

function resetLightboxState() {
  lbScale = 1.0;
  lbTranslateX = 0;
  lbTranslateY = 0;
  updateLightboxTransform(true);
}

function zoomExhibit() {
  if (currentQuestion && currentQuestion.image) {
    openLightbox(currentQuestion.image);
  }
}

function openLightbox(src) {
  const img = document.getElementById('lightboxImg');
  img.src = src;
  resetLightboxState();
  document.getElementById('lightbox').classList.add('active');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
  resetLightboxState();
}

function initLightboxGestures() {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  if (!lb || !img) return;

  function getDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  lb.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      lbStartDist = getDistance(e.touches[0], e.touches[1]);
      lbStartScale = lbScale;
    } else if (e.touches.length === 1) {
      lbStartX = e.touches[0].clientX;
      lbStartY = e.touches[0].clientY;
      lbInitialTranslateX = lbTranslateX;
      lbInitialTranslateY = lbTranslateY;

      // Detect double tap
      const now = Date.now();
      if (now - lbLastTapTime < 300) {
        if (lbScale > 1.2) {
          lbScale = 1.0;
          lbTranslateX = 0;
          lbTranslateY = 0;
        } else {
          lbScale = 2.5;
        }
        updateLightboxTransform(true);
        lbLastTapTime = 0;
        return;
      }
      lbLastTapTime = now;
    }
  }, { passive: false });

  lb.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Stop native page scrolls/zooms

    if (e.touches.length === 2) {
      const dist = getDistance(e.touches[0], e.touches[1]);
      if (lbStartDist > 0) {
        const factor = dist / lbStartDist;
        lbScale = Math.min(Math.max(lbStartScale * factor, 0.8), 5.0);
        updateLightboxTransform(false);
      }
    } else if (e.touches.length === 1 && lbScale > 1.0) {
      const dx = e.touches[0].clientX - lbStartX;
      const dy = e.touches[0].clientY - lbStartY;
      lbTranslateX = lbInitialTranslateX + dx;
      lbTranslateY = lbInitialTranslateY + dy;
      updateLightboxTransform(false);
    }
  }, { passive: false });

  lb.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      lbStartDist = 0;
    }
    // Snap back if scale was pinched below 1.0
    if (lbScale < 1.0) {
      lbScale = 1.0;
      lbTranslateX = 0;
      lbTranslateY = 0;
      updateLightboxTransform(true);
    }
  });
}

// THEME
function initTheme() {
  const saved = localStorage.getItem('ccna_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('themeBtn').textContent = saved === 'dark' ? '🌙' : '☀️';
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ccna_theme', next);
  document.getElementById('themeBtn').textContent = next === 'dark' ? '🌙' : '☀️';
}

// TOAST & HAPTICS (Rendered near top of screen to prevent bottom visual obstruction)
let toastTimeout;
function showToast(msg) {
  let t = document.getElementById('webToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'webToast';
    t.className = 'top-toast';
    document.body.appendChild(t);
  }

  t.classList.remove('toast-success', 'toast-error');
  if (msg.includes('Correct!') || msg.includes('Well done')) {
    t.classList.add('toast-success');
  } else if (msg.includes('Incorrect') || msg.includes('Recorded as weak') || msg.includes('Please ')) {
    t.classList.add('toast-error');
  }

  t.textContent = msg;
  // Trigger reflow for smooth animation
  void t.offsetWidth;
  t.classList.add('visible');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    t.classList.remove('visible');
  }, 2100);
}

function triggerHaptic(success) {
  if (window.AndroidBridge) {
    if (success && window.AndroidBridge.vibrateSuccess) {
      window.AndroidBridge.vibrateSuccess();
    } else if (!success && window.AndroidBridge.vibrateError) {
      window.AndroidBridge.vibrateError();
    }
  } else if (navigator.vibrate) {
    navigator.vibrate(success ? 25 : [0, 40, 60, 40]);
  }
}

// Android Back handler
window.handleAndroidBack = function() {
  const resetModal = document.getElementById('resetConfirmModal');
  if (resetModal && resetModal.classList.contains('active')) {
    closeResetModal();
    return true;
  }
  const lightbox = document.getElementById('lightbox');
  if (lightbox.classList.contains('active')) {
    closeLightbox();
    return true;
  }
  const activeModal = document.querySelector('.modal-overlay.active');
  if (activeModal) {
    closeModals();
    return true;
  }
  if (appState.drillTopic) {
    exitDrillMode();
    return true;
  }
  return false;
};
