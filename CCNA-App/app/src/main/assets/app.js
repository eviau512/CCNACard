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
  masteredIds: {},          // qid -> boolean (true once Box >= 2)
  bookmarkedIds: {},        // qid -> boolean
  bookmarkUpdatedAt: {},    // qid -> epoch ms tombstone (prevents zombie bookmark resurrection)
  cardStats: {},            // qid -> { box: 0..3, streak, lapses, attempts, everWrong, lastSeenStep, nextDueStep, lastReviewedAt }
  totalSteps: 0,            // monotonic global question step counter
  resetEpoch: 0,            // epoch ms of last full reset (prevents zombie progress resurrection)
  updatedAt: 0,             // epoch ms of last local state modification
  history: [],              // array of { qid, domain, topic, misconception, correct, isIdk, time }
  retryInterval: 25,        // default ~25 questions cooldown scale tau to prevent déjà vu
  retryDefaultMigratedV2: true,
  antiDejaVuMigratedV3: true,
  shuffleOptions: true,     // default true: randomize option order (需要乱序选项)
  hideMastered: false,      // optional: completely exclude mastered cards
  excludeSimLabs: false,    // optional: skip Simulation / Lab questions
  deckMode: 'smart',        // 'smart' | 'weak' | 'bookmarks' | 'domain' | 'topic' | 'type'
  domainFilter: '',         // active CCNA domain filter if any
  drillTopic: null,         // active topic/mode drill label if any
  hapticDuration: 80        // custom haptic intensity 0-100% (0 = disabled, 80 = crisp standard active-braked)
};

let currentWindow = 50; // 50 / 200 / 500
let questionById = {};  // fast O(1) lookup map: qid -> question object

// =========================================================================
// 1. SRS & Rational Algebraic Stochastic Engine (SrsEngine)
//    Zero transcendental functions (no exp/tanh/log/pow) — pure + - * /
//    with O(M) activeMistakeIds Set indexing (< 5 microseconds per step)
// =========================================================================
const SrsEngine = {
  activeMistakeIds: new Set(),
  consecutiveUnseenStreak: 0,

  ensureStat(qid) {
    if (!appState.cardStats) appState.cardStats = {};
    if (!appState.cardStats[qid]) {
      const wasMastered = appState.masteredIds[qid] === true;
      const wasFailed = appState.masteredIds[qid] === false;
      appState.cardStats[qid] = {
        box: wasMastered ? 2 : 0,
        streak: wasMastered ? 2 : 0,
        lapses: wasFailed ? 1 : 0,
        attempts: (wasMastered || wasFailed) ? 1 : 0,
        everWrong: wasFailed,
        lastSeenStep: 0,
        nextDueStep: 0,
        lastReviewedAt: 0
      };
    }
    return appState.cardStats[qid];
  },

  syncActiveMistakeSet() {
    this.activeMistakeIds.clear();
    if (!appState.cardStats) appState.cardStats = {};
    const allIds = new Set([
      ...Object.keys(appState.masteredIds || {}),
      ...Object.keys(appState.cardStats || {})
    ]);
    allIds.forEach(rawId => {
      const qid = parseInt(rawId, 10);
      if (!qid) return;
      const st = appState.cardStats[qid];
      const isMistake = (appState.masteredIds[qid] === false) ||
        (st && (st.box === 0 || st.box === 1) && (st.everWrong || st.lapses > 0));
      if (isMistake && appState.masteredIds[qid] !== true) {
        this.activeMistakeIds.add(qid);
      }
    });
  },

  migrateFromLegacyState() {
    if (!appState.cardStats) appState.cardStats = {};
    if (!appState.bookmarkUpdatedAt) appState.bookmarkUpdatedAt = {};
    if (typeof appState.totalSteps !== 'number') {
      appState.totalSteps = (appState.history && appState.history.length) || 0;
    }
    if (Object.keys(appState.cardStats).length === 0 && Array.isArray(appState.history) && appState.history.length > 0) {
      appState.history.forEach((h, idx) => {
        if (!h || !h.qid) return;
        const st = this.ensureStat(h.qid);
        st.attempts++;
        st.lastSeenStep = idx + 1;
        st.lastReviewedAt = h.time || Date.now();
        if (!h.correct || h.isIdk) {
          st.everWrong = true;
          st.lapses++;
          st.streak = 0;
          st.box = 0;
        } else {
          st.streak++;
          st.box = st.everWrong ? (st.streak >= 2 ? 2 : 1) : 3;
        }
      });
    }
    Object.keys(appState.masteredIds || {}).forEach(qid => {
      const st = this.ensureStat(qid);
      if (appState.masteredIds[qid] === true && st.box < 2) {
        st.box = 2;
        st.streak = Math.max(st.streak, 2);
      } else if (appState.masteredIds[qid] === false && st.box >= 2) {
        st.box = 0;
        st.streak = 0;
        st.everWrong = true;
        st.lapses = Math.max(st.lapses, 1);
      }
    });
    this.syncActiveMistakeSet();
  },

  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  applyFuzz(baseInterval, ratio = 0.35) {
    const spread = Math.max(3, Math.round(baseInterval * ratio));
    return Math.max(6, baseInterval + this.randomInt(-spread, spread));
  },

  getTau() {
    return Math.max(12, parseInt(appState.retryInterval, 10) || 25);
  },

  // Pure rational quadratic Hill readiness c_q = ds^2 / (ds^2 + tau^2) in [0, 1)
  computeStepReadiness(qid, stepNow = null, tau = null) {
    const st = appState.cardStats && appState.cardStats[qid];
    if (!st || !st.lastSeenStep) return 1.0; // Never seen in current step epoch -> fully ready
    const sNow = stepNow !== null ? stepNow : (appState.totalSteps || 0);
    const tScale = tau !== null ? tau : this.getTau();
    const ds = Math.max(0, sNow - st.lastSeenStep);
    const ds2 = ds * ds;
    return ds2 / (ds2 + tScale * tScale);
  },

  // Pure rational anti-deja-vu roulette weight W(q) using only + - * /
  computeMistakeWeight(qid, stepNow = null, nowMs = null, tau = null) {
    const st = appState.cardStats && appState.cardStats[qid];
    const sNow = stepNow !== null ? stepNow : (appState.totalSteps || 0);
    const nMs = nowMs !== null ? nowMs : Date.now();
    const tScale = tau !== null ? tau : this.getTau();

    const ds = (st && st.lastSeenStep) ? Math.max(0, sNow - st.lastSeenStep) : (tScale * 2);
    const ds2 = ds * ds;
    const cq = ds2 / (ds2 + tScale * tScale); // Step cooldown factor in [0, 1)

    const dtMin = (st && st.lastReviewedAt) ? Math.max(0, (nMs - st.lastReviewedAt) / 60000) : 30;
    const tq = (1.2 + dtMin) / (8.0 + dtMin);  // Time cooldown factor in [0.15, 1)

    const ageBoost = 1.0 + (3.0 * ds) / (ds + 2.0 * tScale); // Bounded in [1, 4)
    const lapses = (st && st.lapses) ? st.lapses : 1;
    const box = (st && typeof st.box === 'number') ? st.box : 0;
    const urgencyBoost = (1.0 + 0.35 * lapses) * (1.3 - 0.3 * box);

    return cq * tq * ageBoost * urgencyBoost;
  },

  isRecentlySeen(qid, customMinSteps = null, minMinutes = 8) {
    return this.computeStepReadiness(qid) < 0.36; // Equivalent to ds < 0.75 * tau
  },

  // Continuous rational hazard P_review(s) = s^2 / (s^2 + mu^2) in O(M) time
  computeReviewProbability(s = null, candidateIds = null, seenCountOverride = null, unseenCountOverride = null) {
    const streak = s !== null ? s : this.consecutiveUnseenStreak;
    if (streak <= 0) return 0.0;

    const stepNow = appState.totalSteps || 0;
    const tau = this.getTau();
    const iterSet = candidateIds || this.activeMistakeIds;

    let mEff = 0.0;
    iterSet.forEach(qid => {
      if (appState.domainFilter && questionById[qid] && questionById[qid].domain !== appState.domainFilter) return;
      mEff += this.computeStepReadiness(qid, stepNow, tau);
    });

    if (mEff <= 0.01) return 0.0;

    const totalQ = (allQuestions && allQuestions.length) ? allQuestions.length : 1395;
    const nSeen = seenCountOverride !== null
      ? seenCountOverride
      : Math.max(1, Object.keys(appState.masteredIds || {}).length);
    const nUnseen = unseenCountOverride !== null
      ? unseenCountOverride
      : Math.max(0, totalQ - nSeen);

    const rSeen = mEff / Math.max(25, nSeen);
    const rRem = mEff / (mEff + Math.max(1, nUnseen));
    const x = 3.0 * rSeen + 2.2 * rRem + 0.03 * mEff;

    // Rational saturation S(x) = x / (1 + x) and Pool factor M_eff^2 / (M_eff^2 + 36)
    const sx = x / (1.0 + x);
    const mEff2 = mEff * mEff;
    const poolFactor = mEff2 / (mEff2 + 36.0);

    const pBase = (0.06 + 0.42 * sx) * poolFactor;
    if (pBase <= 0.001) return 0.0;

    const mu = (1.0 - pBase) / pBase;
    const s2 = streak * streak;
    return s2 / (s2 + mu * mu);
  },

  // O(M) Weighted Roulette Selection
  weightedDrawMistake(excludeIdsSet = null, candidateList = null, stepNow = null, nowMs = null, tau = null) {
    const sNow = stepNow !== null ? stepNow : (appState.totalSteps || 0);
    const nMs = nowMs !== null ? nowMs : Date.now();
    const tScale = tau !== null ? tau : this.getTau();

    const pool = [];
    let totalWeight = 0.0;

    if (Array.isArray(candidateList)) {
      for (let i = 0; i < candidateList.length; i++) {
        const q = candidateList[i];
        if (!q || (excludeIdsSet && excludeIdsSet.has(q.id))) continue;
        const w = this.computeMistakeWeight(q.id, sNow, nMs, tScale);
        if (w > 0) {
          pool.push({ q, w });
          totalWeight += w;
        }
      }
    } else {
      this.activeMistakeIds.forEach(qid => {
        if (excludeIdsSet && excludeIdsSet.has(qid)) return;
        const q = questionById[qid];
        if (!q) return;
        if (appState.domainFilter && q.domain !== appState.domainFilter) return;
        const w = this.computeMistakeWeight(qid, sNow, nMs, tScale);
        if (w > 0) {
          pool.push({ q, w });
          totalWeight += w;
        }
      });
    }

    if (pool.length === 0) return null;
    let r = Math.random() * totalWeight;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].w;
      if (r <= 0) return pool[i].q;
    }
    return pool[pool.length - 1].q;
  },

  recordOutcome(question, isCorrect, isIdk) {
    const qid = question.id;
    appState.totalSteps = (appState.totalSteps || 0) + 1;
    const st = this.ensureStat(qid);
    st.attempts++;
    st.lastSeenStep = appState.totalSteps;
    st.lastReviewedAt = Date.now();

    if (question.isRetry) {
      this.consecutiveUnseenStreak = 0;
    } else {
      this.consecutiveUnseenStreak++;
    }

    const baseInterval = this.getTau();

    if (!isCorrect || isIdk) {
      st.everWrong = true;
      st.lapses++;
      st.streak = 0;
      st.box = 0;
      appState.masteredIds[qid] = false;
      this.activeMistakeIds.add(qid);

      const rawCooldown = st.lapses >= 3 ? Math.max(14, Math.floor(baseInterval * 0.8)) : baseInterval;
      const stepInterval = this.applyFuzz(rawCooldown, 0.35);
      st.nextDueStep = appState.totalSteps + stepInterval;
      this.scheduleInActiveQueue(question, stepInterval, 1);

      this.maybeInjectProbabilisticReview(qid);

      return {
        status: 'reinforce',
        box: 0,
        interval: stepInterval,
        lapses: st.lapses
      };
    }

    // Correct answer!
    st.streak++;
    if (!st.everWrong) {
      st.box = 3;
      appState.masteredIds[qid] = true;
      this.activeMistakeIds.delete(qid);
      st.nextDueStep = appState.totalSteps + this.applyFuzz(240, 0.25);
      this.maybeInjectProbabilisticReview(qid);
      return { status: 'mastered_first', box: 3, interval: 240 };
    }

    if (st.streak === 1) {
      st.box = 1;
      appState.masteredIds[qid] = false;
      this.activeMistakeIds.add(qid);
      const consolidationInterval = this.applyFuzz(Math.round(baseInterval * 2.4) + 10, 0.35);
      st.nextDueStep = appState.totalSteps + consolidationInterval;
      this.scheduleInActiveQueue(question, consolidationInterval, 2);
      this.maybeInjectProbabilisticReview(qid);
      return {
        status: 'consolidating',
        box: 1,
        interval: consolidationInterval,
        streak: 1
      };
    }

    // Passed Stage 2+ consecutive review -> Graduated to Mastered (Box 2 / 3)!
    st.box = st.streak >= 3 ? 3 : 2;
    appState.masteredIds[qid] = true;
    this.activeMistakeIds.delete(qid);
    const longInterval = this.applyFuzz(st.streak >= 3 ? 320 : 140, 0.25);
    st.nextDueStep = appState.totalSteps + longInterval;
    this.maybeInjectProbabilisticReview(qid);
    return {
      status: 'graduated',
      box: st.box,
      interval: longInterval,
      streak: st.streak
    };
  },

  maybeInjectProbabilisticReview(justAnsweredQid) {
    if (!activeQueue || activeQueue.length === 0) return;
    const nextCard = activeQueue[currentIndex + 1];
    if (nextCard && nextCard.isRetry) return; // Next card is already a review card

    const pRev = this.computeReviewProbability(this.consecutiveUnseenStreak);
    if (pRev <= 0 || Math.random() >= pRev) return;

    const excludeSet = new Set([justAnsweredQid]);
    for (let i = Math.max(0, currentIndex - 3); i <= Math.min(activeQueue.length - 1, currentIndex + 5); i++) {
      if (activeQueue[i]) excludeSet.add(activeQueue[i].id);
    }

    const picked = this.weightedDrawMistake(excludeSet);
    if (!picked) return;

    const st = this.ensureStat(picked.id);
    const stage = st.box === 1 ? 2 : 1;
    // Remove any duplicate retry copy further ahead before inserting at currentIndex + 1
    for (let i = activeQueue.length - 1; i > currentIndex + 1; i--) {
      if (activeQueue[i].id === picked.id && activeQueue[i].isRetry) {
        activeQueue.splice(i, 1);
      }
    }
    activeQueue.splice(currentIndex + 1, 0, { ...picked, isRetry: true, retryStage: stage });
    this.consecutiveUnseenStreak = 0;
  },

  scheduleInActiveQueue(question, interval, stage, isSilent = false) {
    for (let i = activeQueue.length - 1; i > currentIndex; i--) {
      if (activeQueue[i].id === question.id && activeQueue[i].isRetry) {
        activeQueue.splice(i, 1);
      }
    }
    const insertIndex = Math.min(activeQueue.length, currentIndex + interval);
    const retryCard = { ...question, isRetry: true, retryStage: stage };
    activeQueue.splice(insertIndex, 0, retryCard);

    if (!isSilent) {
      const banner = document.getElementById('queueBanner');
      if (banner) {
        banner.classList.add('active');
        const stageLabel = stage === 2 ? 'Stage 2/2 Consolidation' : 'Cooldown Review';
        document.getElementById('queueBannerText').textContent =
          `🔁 #${question.id} (${stageLabel}) cooled down for ~${interval} questions.`;
      }
    }
  }
};

// =========================================================================
// 2. Continuous Probabilistic Deck Scheduler (DeckScheduler)
// =========================================================================
const DeckScheduler = {
  drawLog: [],
  logDrawEvent(ev) {
    if (!Array.isArray(this.drawLog)) this.drawLog = [];
    if (this.drawLog.length > 0) {
      const last = this.drawLog[this.drawLog.length - 1];
      if (last.qid === ev.qid && last.cardIndex === ev.cardIndex && last.mode === ev.mode) {
        return;
      }
    }
    this.drawLog.push(ev);
    if (this.drawLog.length > 100) {
      this.drawLog = this.drawLog.slice(-100);
    }
    console.log(`[DeckScheduler] Card #${ev.qid} drawn (${ev.reason}) - Mode: ${ev.mode}, Pos: ${ev.cardIndex}/${ev.queueLen}`);
  },

  getWeakTopicsSet() {
    const recent = (appState.history || []).slice(-100);
    const topics = new Set();
    recent.forEach(h => {
      if (h && (!h.correct || h.isIdk) && h.topic) {
        topics.add(h.topic);
      }
    });
    return topics;
  },

  buildSmartQueue(pool) {
    if (appState.excludeSimLabs && Array.isArray(pool)) {
      pool = pool.filter(q => q.type !== 'Simulation / Lab');
    }
    SrsEngine.syncActiveMistakeSet();
    const weakTopics = this.getWeakTopicsSet();
    const stepNow = appState.totalSteps || 0;
    const nowMs = Date.now();
    const tau = SrsEngine.getTau();

    const mistakePool = [];
    const weakUnseen = [];
    const normalUnseen = [];
    const masteredPool = [];

    pool.forEach(q => {
      const st = appState.cardStats && appState.cardStats[q.id];
      const isMastered = appState.masteredIds[q.id] === true;
      const isFailedOrConsolidating = (appState.masteredIds[q.id] === false) || (st && (st.box === 0 || st.box === 1));

      if (isFailedOrConsolidating) {
        mistakePool.push({
          ...q,
          isRetry: true,
          retryStage: (st && st.box === 1) ? 2 : 1,
          _weight: SrsEngine.computeMistakeWeight(q.id, stepNow, nowMs, tau)
        });
      } else if (isMastered) {
        if (!appState.hideMastered) {
          masteredPool.push(q);
        }
      } else {
        if (weakTopics.has(q.topic)) {
          weakUnseen.push(q);
        } else {
          normalUnseen.push(q);
        }
      }
    });

    // Order mistakePool by weighted roulette without replacement (highest anti-deja-vu weight favored stochastically)
    const orderedMistakes = [];
    const remainingMistakes = mistakePool.slice();
    while (remainingMistakes.length > 0) {
      let totalW = 0.0;
      for (let i = 0; i < remainingMistakes.length; i++) {
        totalW += remainingMistakes[i]._weight;
      }
      let pickedIdx = 0;
      if (totalW > 0) {
        let r = Math.random() * totalW;
        for (let i = 0; i < remainingMistakes.length; i++) {
          r -= remainingMistakes[i]._weight;
          if (r <= 0) {
            pickedIdx = i;
            break;
          }
        }
      } else {
        pickedIdx = Math.floor(Math.random() * remainingMistakes.length);
      }
      orderedMistakes.push(remainingMistakes[pickedIdx]);
      remainingMistakes.splice(pickedIdx, 1);
    }

    const shufWeakUnseen = shuffle(weakUnseen).map(q => ({ ...q, isRetry: false }));
    const shufNormalUnseen = shuffle(normalUnseen).map(q => ({ ...q, isRetry: false }));
    const shufMastered = shuffle(masteredPool).map(q => ({ ...q, isRetry: false }));

    const unseenCombined = [];
    let wi = 0, ni = 0;
    while (wi < shufWeakUnseen.length || ni < shufNormalUnseen.length) {
      if (wi < shufWeakUnseen.length) unseenCombined.push(shufWeakUnseen[wi++]);
      const normalBurst = SrsEngine.randomInt(2, 4);
      for (let k = 0; k < normalBurst && ni < shufNormalUnseen.length; k++) {
        unseenCombined.push(shufNormalUnseen[ni++]);
      }
    }

    // Pure Mistake Review Mode (e.g. Wrong & Weak Pool): return roulette-ordered mistakes directly
    if (unseenCombined.length === 0 && orderedMistakes.length > 0) {
      return orderedMistakes;
    }

    // Continuous Probabilistic Interleaving using P_review(s) = s^2 / (s^2 + mu^2)
    const result = [];
    let di = 0, ui = 0, mi = 0;
    let s = 0; // consecutive unseen streak
    const totalSeenCount = Math.max(1, masteredPool.length + mistakePool.length);
    const maxSprinkledMastered = Math.max(5, Math.floor(unseenCombined.length * 0.05));
    let nextMasteredAt = SrsEngine.randomInt(16, 28);

    // Precompute initial effective cooled-down mistake mass M_eff
    let mEff = 0.0;
    for (let i = 0; i < orderedMistakes.length; i++) {
      mEff += SrsEngine.computeStepReadiness(orderedMistakes[i].id, stepNow, tau);
    }

    while (ui < unseenCombined.length || di < orderedMistakes.length) {
      const remainingUnseen = unseenCombined.length - ui;
      const remainingDue = orderedMistakes.length - di;

      if (remainingUnseen === 0) {
        while (di < orderedMistakes.length) {
          result.push(orderedMistakes[di++]);
        }
        break;
      }

      let drawReview = false;
      if (remainingDue > 0 && s > 0) {
        const effMass = Math.max(0.2, mEff * (remainingDue / Math.max(1, orderedMistakes.length)));
        const rSeen = effMass / Math.max(25, totalSeenCount + ui);
        const rRem = effMass / (effMass + remainingUnseen);
        const x = 3.0 * rSeen + 2.2 * rRem + 0.03 * effMass;
        const sx = x / (1.0 + x);
        const eff2 = effMass * effMass;
        const poolFactor = eff2 / (eff2 + 36.0);
        const pBase = Math.max(0.03, (0.06 + 0.42 * sx) * poolFactor);
        const mu = (1.0 - pBase) / pBase;
        const s2 = s * s;
        const pRev = s2 / (s2 + mu * mu);
        drawReview = (Math.random() < pRev);
      }

      if (drawReview) {
        result.push(orderedMistakes[di++]);
        s = 0;
      } else {
        result.push(unseenCombined[ui++]);
        s++;
        if (!appState.hideMastered && result.length >= nextMasteredAt && mi < Math.min(shufMastered.length, maxSprinkledMastered)) {
          const probeQ = { ...shufMastered[mi++], _drawSource: 'mastered_probe' };
          result.push(probeQ);
          nextMasteredAt = result.length + SrsEngine.randomInt(16, 28);
        }
      }
    }

    if (!appState.hideMastered) {
      while (mi < shufMastered.length) {
        result.push(shufMastered[mi++]);
      }
    }

    if (result.length === 0 && pool.length > 0) {
      if (appState.hideMastered) {
        const unmasteredPool = pool.filter(q => appState.masteredIds[q.id] !== true);
        if (unmasteredPool.length > 0) {
          return shuffle(unmasteredPool).map(q => ({ ...q, isRetry: false }));
        }
        return [];
      }
      return shuffle(pool).map(q => ({ ...q, isRetry: false }));
    }
    return result;
  },

  saveSessionSnapshot() {
    try {
      if (!activeQueue || activeQueue.length === 0) return;
      const windowSlice = activeQueue.slice(Math.max(0, currentIndex - 20), currentIndex + 120);
      const baseOffset = Math.max(0, currentIndex - 20);
      const snap = {
        deckMode: appState.deckMode || 'smart',
        drillTopic: appState.drillTopic || null,
        domainFilter: appState.domainFilter || '',
        savedIndex: currentIndex - baseOffset,
        entries: windowSlice.map(q => ({
          id: q.id,
          r: q.isRetry ? 1 : 0,
          s: q.retryStage || 0
        }))
      };
      localStorage.setItem('ccna_session_snapshot_v1', JSON.stringify(snap));
    } catch (e) {
      console.error('Failed to save session snapshot', e);
    }
  },

  restoreSessionSnapshot() {
    try {
      const raw = localStorage.getItem('ccna_session_snapshot_v1');
      if (!raw) return false;
      const snap = JSON.parse(raw);
      if (!snap || !Array.isArray(snap.entries) || snap.entries.length === 0) return false;
      const restored = [];
      snap.entries.forEach(e => {
        const baseQ = questionById[e.id];
        if (baseQ) {
          if (appState.excludeSimLabs && baseQ.type === 'Simulation / Lab') return;
          if (appState.hideMastered && appState.masteredIds[baseQ.id] === true) return;
          restored.push({
            ...baseQ,
            isRetry: Boolean(e.r),
            retryStage: e.s || (e.r ? 1 : 0)
          });
        }
      });
      if (restored.length === 0) return false;
      const inSnap = new Set(restored.map(q => q.id));
      let tailPool = allQuestions.filter(q => !inSnap.has(q.id));
      if (appState.excludeSimLabs) {
        tailPool = tailPool.filter(q => q.type !== 'Simulation / Lab');
      }
      if (appState.hideMastered) {
        tailPool = tailPool.filter(q => appState.masteredIds[q.id] !== true);
      }
      const tailQueue = this.buildSmartQueue(tailPool);
      activeQueue = restored.concat(tailQueue);
      currentIndex = Math.min(Math.max(0, snap.savedIndex || 0), restored.length - 1);
      appState.deckMode = snap.deckMode || 'smart';
      appState.drillTopic = snap.drillTopic || null;
      appState.domainFilter = snap.domainFilter || '';
      syncDrillBannerUI();
      return true;
    } catch (e) {
      return false;
    }
  }
};

// =========================================================================
// 3. FBReader-Style Google Account & Google Drive Cloud Sync (CloudSyncEngine)
//    Supports Direct Google Drive REST API v3 (OAuth 2.0 Loopback PKCE) with
//    ZERO dependency on the local Google Drive Android App.
// =========================================================================
const CloudSyncEngine = {
  autoPushTimer: null,
  webFileHandle: null,
  isSyncInFlight: false,
  pendingPushAfterFlight: false,
  defaultClientId: '202264815644.apps.googleusercontent.com',
  defaultClientSecret: 'X4Z3ca8xfWDb1Voo-F9a7ZxJ',
  syncFileName: 'ccna_study_progress.json',

  getSyncState() {
    if (window.AndroidBridge && typeof window.AndroidBridge.getGoogleSyncState === 'function') {
      try {
        return JSON.parse(window.AndroidBridge.getGoogleSyncState());
      } catch (e) {
        return { signedIn: false };
      }
    }
    try {
      const raw = localStorage.getItem('ccna_web_cloud_sync_meta');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { signedIn: false };
  },

  formatSyncTime(epochMs) {
    if (!epochMs) return 'Never';
    const diffSec = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
    if (diffSec < 15) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return new Date(epochMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  syncSettingsCardUI(statusOverride = null) {
    const state = this.getSyncState();
    const badge = document.getElementById('cloudSyncBadge');
    const signedOutBox = document.getElementById('cloudSignedOutActions');
    const signedInBox = document.getElementById('cloudSignedInActions');
    const manualBox = document.getElementById('cloudManualCodeBox');
    const emailEl = document.getElementById('cloudAccountEmail');
    const timeEl = document.getElementById('cloudLastSyncTime');

    if (!badge || !signedOutBox || !signedInBox) return;

    if (state && state.signedIn) {
      signedOutBox.style.display = 'none';
      signedInBox.style.display = 'flex';
      if (manualBox) manualBox.style.display = 'none';
      const provider = state.providerType || 'Google Drive';
      badge.textContent = statusOverride || `✓ ${provider}`;
      badge.style.background = 'rgba(16, 185, 129, 0.15)';
      badge.style.color = 'var(--success)';
      if (emailEl) emailEl.textContent = `👤 ${state.email || 'Google Drive Account'}`;
      if (timeEl) timeEl.textContent = `Synced: ${this.formatSyncTime(state.lastSyncTime)}`;
    } else {
      signedOutBox.style.display = 'flex';
      signedInBox.style.display = 'none';
      badge.textContent = statusOverride || 'Optional • Offline';
      badge.style.background = 'rgba(148, 163, 184, 0.15)';
      badge.style.color = 'var(--text-muted)';
    }
  },

  // CRDT Monotonic Two-Way Merge (prevents stale overwrites and zombie bookmarks/resets)
  mergeProgressStates(local, remote) {
    if (!remote || typeof remote !== 'object') return local;
    const localReset = local.resetEpoch || 0;
    const remoteReset = remote.resetEpoch || 0;
    const effectiveResetEpoch = Math.max(localReset, remoteReset);

    const filterByReset = (stateObj, stateReset) => {
      if (stateReset >= effectiveResetEpoch) return stateObj;
      // This side was superseded by a newer full reset on the other device
      const cleanedStats = {};
      Object.keys(stateObj.cardStats || {}).forEach(qid => {
        const st = stateObj.cardStats[qid];
        if (st && (st.lastReviewedAt || 0) > effectiveResetEpoch) {
          cleanedStats[qid] = st;
        }
      });
      const cleanedBm = {};
      const cleanedBmTs = {};
      Object.keys(stateObj.bookmarkUpdatedAt || {}).forEach(qid => {
        const ts = stateObj.bookmarkUpdatedAt[qid] || 0;
        if (ts > effectiveResetEpoch) {
          cleanedBmTs[qid] = ts;
          if (stateObj.bookmarkedIds && stateObj.bookmarkedIds[qid]) {
            cleanedBm[qid] = true;
          }
        }
      });
      const cleanedHist = (stateObj.history || []).filter(h => h && (h.time || 0) > effectiveResetEpoch);
      return {
        ...stateObj,
        cardStats: cleanedStats,
        masteredIds: {},
        bookmarkedIds: cleanedBm,
        bookmarkUpdatedAt: cleanedBmTs,
        history: cleanedHist,
        totalSteps: cleanedHist.length
      };
    };

    const L = filterByReset(local, localReset);
    const R = filterByReset(remote, remoteReset);

    const mergedStats = {};
    const mergedMastered = {};
    const allStatIds = new Set([
      ...Object.keys(L.cardStats || {}),
      ...Object.keys(R.cardStats || {}),
      ...Object.keys(L.masteredIds || {}),
      ...Object.keys(R.masteredIds || {})
    ]);

    const resolveStat = (side, qid) => {
      if (side.cardStats && side.cardStats[qid]) return side.cardStats[qid];
      if (side.masteredIds && side.masteredIds[qid] !== undefined) {
        const wasMastered = side.masteredIds[qid] === true;
        const wasFailed = side.masteredIds[qid] === false;
        return {
          box: wasMastered ? 2 : 0,
          streak: wasMastered ? 2 : 0,
          lapses: wasFailed ? 1 : 0,
          attempts: 1,
          everWrong: wasFailed,
          lastSeenStep: 0,
          nextDueStep: 0,
          lastReviewedAt: 0
        };
      }
      return null;
    };

    allStatIds.forEach(qid => {
      const ls = resolveStat(L, qid);
      const rs = resolveStat(R, qid);
      if (ls && !rs) {
        mergedStats[qid] = { ...ls };
      } else if (!ls && rs) {
        mergedStats[qid] = { ...rs };
      } else if (ls && rs) {
        const lTime = ls.lastReviewedAt || 0;
        const rTime = rs.lastReviewedAt || 0;
        let winner;
        if (lTime !== rTime) {
          winner = lTime > rTime ? ls : rs;
        } else {
          // Tie-breaker protection (e.g. both lastReviewedAt === 0 from legacy records):
          // Conservatively favor the lower box / unmastered / mistake state so no weak card is skipped.
          const lBox = typeof ls.box === 'number' ? ls.box : 0;
          const rBox = typeof rs.box === 'number' ? rs.box : 0;
          if (lBox !== rBox) {
            winner = lBox < rBox ? ls : rs;
          } else {
            winner = (ls.streak || 0) <= (rs.streak || 0) ? ls : rs;
          }
        }
        mergedStats[qid] = {
          ...winner,
          attempts: Math.max(ls.attempts || 0, rs.attempts || 0),
          lapses: Math.max(ls.lapses || 0, rs.lapses || 0),
          everWrong: Boolean(ls.everWrong || rs.everWrong),
          lastReviewedAt: Math.max(lTime, rTime)
        };
      }
      const ms = mergedStats[qid];
      if (ms) {
        if (ms.box >= 2) {
          mergedMastered[qid] = true;
        } else if (ms.attempts > 0 || ms.everWrong || L.masteredIds?.[qid] === false || R.masteredIds?.[qid] === false) {
          mergedMastered[qid] = false;
        }
      } else if (L.masteredIds?.[qid] !== undefined) {
        mergedMastered[qid] = L.masteredIds[qid];
      } else if (R.masteredIds?.[qid] !== undefined) {
        mergedMastered[qid] = R.masteredIds[qid];
      }
    });

    // Merge bookmarks using tombstone timestamps (bookmarkUpdatedAt)
    const mergedBookmarks = {};
    const mergedBookmarkTs = {};
    const allBmIds = new Set([
      ...Object.keys(L.bookmarkedIds || {}),
      ...Object.keys(R.bookmarkedIds || {}),
      ...Object.keys(L.bookmarkUpdatedAt || {}),
      ...Object.keys(R.bookmarkUpdatedAt || {})
    ]);
    allBmIds.forEach(qid => {
      const lTs = (L.bookmarkUpdatedAt && L.bookmarkUpdatedAt[qid]) || (L.bookmarkedIds && L.bookmarkedIds[qid] ? 1 : 0);
      const rTs = (R.bookmarkUpdatedAt && R.bookmarkUpdatedAt[qid]) || (R.bookmarkedIds && R.bookmarkedIds[qid] ? 1 : 0);
      if (lTs > rTs) {
        mergedBookmarkTs[qid] = lTs;
        if (L.bookmarkedIds && L.bookmarkedIds[qid]) mergedBookmarks[qid] = true;
      } else if (rTs > lTs) {
        mergedBookmarkTs[qid] = rTs;
        if (R.bookmarkedIds && R.bookmarkedIds[qid]) mergedBookmarks[qid] = true;
      } else {
        mergedBookmarkTs[qid] = lTs;
        if ((L.bookmarkedIds && L.bookmarkedIds[qid]) || (R.bookmarkedIds && R.bookmarkedIds[qid])) {
          mergedBookmarks[qid] = true;
        }
      }
    });

    // Merge history chronologically without duplicates
    const histMap = new Map();
    (L.history || []).concat(R.history || []).forEach(h => {
      if (!h || !h.qid) return;
      const key = `${h.qid}_${h.time || 0}`;
      if (!histMap.has(key)) histMap.set(key, h);
    });
    const mergedHistory = Array.from(histMap.values())
      .sort((a, b) => (a.time || 0) - (b.time || 0))
      .slice(-1000);

    return {
      ...local,
      masteredIds: mergedMastered,
      bookmarkedIds: mergedBookmarks,
      bookmarkUpdatedAt: mergedBookmarkTs,
      cardStats: mergedStats,
      history: mergedHistory,
      totalSteps: Math.max(L.totalSteps || 0, R.totalSteps || 0, mergedHistory.length),
      resetEpoch: effectiveResetEpoch,
      updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0, Date.now())
    };
  },

  // Primary FBReader-style one-tap Google Account OAuth 2.0 Sign-In (Zero Google Drive App dependency)
  async signIn(unused = false) {
    const manualBox = document.getElementById('cloudManualCodeBox');
    if (manualBox) manualBox.style.display = 'flex';

    if (window.AndroidBridge && typeof window.AndroidBridge.signInWithGoogle === 'function') {
      window.AndroidBridge.signInWithGoogle(false);
      return;
    }

    // Desktop / Standalone Browser OAuth 2.0 Loopback Flow
    const redirectUri = 'http://127.0.0.1:53682/';
    localStorage.setItem('ccna_web_oauth_redirect', redirectUri);
    const params = new URLSearchParams({
      client_id: this.defaultClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.file openid email',
      access_type: 'offline',
      prompt: 'select_account consent'
    });
    window.open(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, '_blank');
    showToast('☁️ 请在新标签页完成 Google 授权，并复制跳转后的 127.0.0.1 链接粘贴到下方确认框');
  },

  async submitManualCode() {
    const inputEl = document.getElementById('cloudManualCodeInput');
    const raw = inputEl ? inputEl.value.trim() : '';
    if (!raw) {
      showToast('⚠️ 请先粘贴授权跳转后的链接或 code');
      return;
    }

    if (window.AndroidBridge && typeof window.AndroidBridge.submitManualOAuthCode === 'function') {
      this.syncSettingsCardUI('⟳ Verifying...');
      window.AndroidBridge.submitManualOAuthCode(raw);
      if (inputEl) inputEl.value = '';
      return;
    }

    // Web Browser OAuth Code Exchange
    try {
      this.syncSettingsCardUI('⟳ Verifying...');
      let code = raw;
      if (raw.includes('code=')) {
        const u = new URL(raw.startsWith('http') ? raw : `http://127.0.0.1/?${raw}`);
        code = u.searchParams.get('code') || raw;
      } else {
        code = decodeURIComponent(raw);
      }
      const redirectUri = localStorage.getItem('ccna_web_oauth_redirect') || 'http://127.0.0.1:53682/';
      const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.defaultClientId,
          client_secret: this.defaultClientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });
      const tokenData = await resp.json();
      if (!resp.ok || !tokenData.access_token) {
        throw new Error(tokenData.error_description || tokenData.error || 'Token exchange failed');
      }

      let email = 'Google Drive Account';
      if (tokenData.id_token) {
        try {
          const payload = JSON.parse(atob(tokenData.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          if (payload.email) email = payload.email;
        } catch (e) {}
      }

      const meta = {
        signedIn: true,
        syncMode: 'web_drive_rest',
        email,
        providerType: 'Google Drive',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || '',
        expiresAt: Date.now() + ((tokenData.expires_in || 3500) * 1000),
        fileId: '',
        lastSyncTime: 0
      };
      localStorage.setItem('ccna_web_cloud_sync_meta', JSON.stringify(meta));
      if (inputEl) inputEl.value = '';
      this.syncSettingsCardUI();
      await this.syncNow();
    } catch (e) {
      this.syncSettingsCardUI();
      showToast('⚠️ 授权验证失败: ' + e.message);
    }
  },

  async ensureWebAccessToken(meta) {
    if (meta.accessToken && Date.now() < (meta.expiresAt || 0) - 60000) {
      return meta.accessToken;
    }
    if (!meta.refreshToken) throw new Error('登录已过期，请重新登录 Google 账号');
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.defaultClientId,
        client_secret: this.defaultClientSecret,
        refresh_token: meta.refreshToken,
        grant_type: 'refresh_token'
      })
    });
    const data = await resp.json();
    if (!resp.ok || !data.access_token) throw new Error('刷新 Token 失败');
    meta.accessToken = data.access_token;
    meta.expiresAt = Date.now() + ((data.expires_in || 3500) * 1000);
    localStorage.setItem('ccna_web_cloud_sync_meta', JSON.stringify(meta));
    return meta.accessToken;
  },

  async rebindFile() {
    if (window.AndroidBridge && typeof window.AndroidBridge.rebindDriveSyncFile === 'function') {
      window.AndroidBridge.rebindDriveSyncFile(true);
      return;
    }
    try {
      if (window.showOpenFilePicker) {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'CCNA Sync JSON', accept: { 'application/json': ['.json'] } }]
        });
        this.webFileHandle = handle;
      } else if (window.showSaveFilePicker) {
        this.webFileHandle = await window.showSaveFilePicker({
          suggestedName: this.syncFileName,
          types: [{ description: 'CCNA Sync JSON', accept: { 'application/json': ['.json'] } }]
        });
      } else {
        showToast('💡 请直接点击左侧【登录 Google 账号开启云同步】');
        return;
      }
      const meta = {
        signedIn: true,
        syncMode: 'web_file',
        email: this.webFileHandle.name || this.syncFileName,
        providerType: 'Local Sync File',
        lastSyncTime: Date.now()
      };
      localStorage.setItem('ccna_web_cloud_sync_meta', JSON.stringify(meta));
      this.syncSettingsCardUI();
      await this.syncNow();
    } catch (e) {
      if (e && e.name !== 'AbortError') {
        showToast('取消或无法绑定文件: ' + e.message);
      }
    }
  },

  signOut() {
    if (window.AndroidBridge && typeof window.AndroidBridge.signOutGoogle === 'function') {
      window.AndroidBridge.signOutGoogle();
    }
    this.webFileHandle = null;
    localStorage.removeItem('ccna_web_cloud_sync_meta');
    this.syncSettingsCardUI();
  },

  scheduleAutoPush() {
    const state = this.getSyncState();
    if (!state || !state.signedIn) return;
    if (this.autoPushTimer) clearTimeout(this.autoPushTimer);
    this.autoPushTimer = setTimeout(() => {
      this.pushToCloud();
    }, 2200);
  },

  pushToCloud() {
    const state = this.getSyncState();
    if (!state || !state.signedIn) return;
    const payload = JSON.stringify(appState);
    if (window.AndroidBridge && typeof window.AndroidBridge.cloudPushProgress === 'function') {
      this.syncSettingsCardUI('⟳ Syncing...');
      window.AndroidBridge.cloudPushProgress(payload);
      return;
    }
    if (state.syncMode === 'web_drive_rest') {
      this.webDriveRestPush(payload);
      return;
    }
    if (this.webFileHandle) {
      this.webPush(payload);
    }
  },

  async webDriveRestPush(payload) {
    try {
      this.syncSettingsCardUI('⟳ Syncing...');
      const meta = this.getSyncState();
      const token = await this.ensureWebAccessToken(meta);
      let fileId = meta.fileId || '';

      if (!fileId) {
        const q = encodeURIComponent(`name='${this.syncFileName}' and trashed=false`);
        const listResp = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)&orderBy=modifiedTime%20desc`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (listResp.ok) {
          const listJson = await listResp.json();
          if (listJson.files && listJson.files.length > 0) {
            fileId = listJson.files[0].id;
          }
        }
      }

      if (fileId) {
        const upResp = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=UTF-8'
          },
          body: payload
        });
        if (upResp.status === 404) {
          fileId = '';
        } else if (!upResp.ok) {
          throw new Error(`Drive update HTTP ${upResp.status}`);
        }
      }

      if (!fileId) {
        const boundary = 'ccna_web_sync_' + Date.now();
        const metadata = JSON.stringify({ name: this.syncFileName, mimeType: 'application/json' });
        const multipartBody = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${payload}\r\n--${boundary}--`;
        const createResp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartBody
        });
        if (!createResp.ok) throw new Error(`Drive create HTTP ${createResp.status}`);
        const created = await createResp.json();
        fileId = created.id || '';
      }

      meta.fileId = fileId;
      meta.lastSyncTime = Date.now();
      localStorage.setItem('ccna_web_cloud_sync_meta', JSON.stringify(meta));
      this.syncSettingsCardUI();
    } catch (e) {
      console.warn('webDriveRestPush failed', e);
      this.syncSettingsCardUI('⚠️ Offline');
    }
  },

  async webPush(payload) {
    try {
      const writable = await this.webFileHandle.createWritable();
      await writable.write(payload);
      await writable.close();
      const meta = this.getSyncState();
      meta.lastSyncTime = Date.now();
      localStorage.setItem('ccna_web_cloud_sync_meta', JSON.stringify(meta));
      this.syncSettingsCardUI();
    } catch (e) {
      console.warn('Web cloud push failed', e);
    }
  },

  async syncNow() {
    const state = this.getSyncState();
    if (!state || !state.signedIn) return;
    this.syncSettingsCardUI('⟳ Syncing...');
    if (window.AndroidBridge && typeof window.AndroidBridge.cloudPullProgress === 'function') {
      window.AndroidBridge.cloudPullProgress();
      return;
    }
    if (state.syncMode === 'web_drive_rest') {
      try {
        const meta = this.getSyncState();
        const token = await this.ensureWebAccessToken(meta);
        const q = encodeURIComponent(`name='${this.syncFileName}' and trashed=false`);
        const listResp = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)&orderBy=modifiedTime%20desc`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (listResp.ok) {
          const listJson = await listResp.json();
          if (listJson.files && listJson.files.length > 0) {
            meta.fileId = listJson.files[0].id;
            localStorage.setItem('ccna_web_cloud_sync_meta', JSON.stringify(meta));
            const dlResp = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(meta.fileId)}?alt=media`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (dlResp.ok) {
              const text = await dlResp.text();
              if (text && text.trim().startsWith('{')) {
                const remote = JSON.parse(text);
                appState = this.mergeProgressStates(appState, remote);
                SrsEngine.syncActiveMistakeSet();
                localStorage.setItem('ccna_app_state_v1', JSON.stringify(appState));
                updateHeaderStats();
              }
            }
          }
        }
        await this.webDriveRestPush(JSON.stringify(appState));
        showToast('☁️ 已与 Google Drive 完成直连双向同步');
      } catch (e) {
        this.syncSettingsCardUI('⚠️ Offline');
        showToast('⚠️ Google Drive 同步失败: ' + e.message);
      }
      return;
    }
    if (this.webFileHandle) {
      try {
        const file = await this.webFileHandle.getFile();
        const text = await file.text();
        if (text && text.trim().startsWith('{')) {
          const remote = JSON.parse(text);
          appState = this.mergeProgressStates(appState, remote);
          SrsEngine.syncActiveMistakeSet();
          localStorage.setItem('ccna_app_state_v1', JSON.stringify(appState));
          updateHeaderStats();
        }
        await this.webPush(JSON.stringify(appState));
        showToast('☁️ 已完成双向增量同步');
      } catch (e) {
        showToast('⚠️ 同步失败: ' + e.message);
      }
    }
  },

  onAppResume() {
    const state = this.getSyncState();
    if (state && state.signedIn && window.AndroidBridge && typeof window.AndroidBridge.cloudPullProgress === 'function') {
      window.AndroidBridge.cloudPullProgress();
    }
  }
};
window.CloudSyncEngine = CloudSyncEngine;

window.onGoogleDriveBound = function (jsonStr) {
  try {
    const info = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    CloudSyncEngine.syncSettingsCardUI('⟳ Syncing...');
    if (info && info.isNewlyCreated) {
      CloudSyncEngine.pushToCloud();
      showToast(`☁️ 已绑定 ${info.email || 'Google Drive'} 并上传初始刷题进度`);
    } else {
      CloudSyncEngine.syncNow();
    }
  } catch (e) {
    console.error('onGoogleDriveBound error', e);
  }
};

window.onCloudPullCallback = function (jsonStr) {
  try {
    const res = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    if (res && res.ok) {
      let mergedAny = false;
      if (res.data && res.data.trim().startsWith('{')) {
        const remote = JSON.parse(res.data);
        appState = CloudSyncEngine.mergeProgressStates(appState, remote);
        mergedAny = true;
      }
      if (Array.isArray(res.extraDataList)) {
        res.extraDataList.forEach(extraRaw => {
          try {
            if (extraRaw && extraRaw.trim().startsWith('{')) {
              appState = CloudSyncEngine.mergeProgressStates(appState, JSON.parse(extraRaw));
              mergedAny = true;
            }
          } catch (e) {}
        });
      }
      if (mergedAny) {
        SrsEngine.syncActiveMistakeSet();
        localStorage.setItem('ccna_app_state_v1', JSON.stringify(appState));
        updateHeaderStats();
      }
      // Push merged state back so cloud file also reflects any newer local progress (or creates initial file)
      CloudSyncEngine.pushToCloud();
    } else {
      CloudSyncEngine.syncSettingsCardUI('⚠️ Offline');
    }
  } catch (e) {
    console.error('onCloudPullCallback error', e);
    CloudSyncEngine.syncSettingsCardUI('⚠️ Sync Error');
  }
};

window.onCloudPushCallback = function (jsonStr) {
  try {
    const res = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    if (res && res.ok) {
      CloudSyncEngine.syncSettingsCardUI();
    } else {
      CloudSyncEngine.syncSettingsCardUI('⚠️ Offline');
    }
  } catch (e) {
    CloudSyncEngine.syncSettingsCardUI();
  }
};

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  loadStoredState();
  initTheme();
  initLightboxGestures();
  IdkHoldManager.init();
  await loadQuestionData();
  SrsEngine.migrateFromLegacyState();
  if (!DeckScheduler.restoreSessionSnapshot()) {
    setupPracticeQueue(appState.drillTopic);
  }
  renderCurrentCard();
  updateHeaderStats();
  CloudSyncEngine.syncSettingsCardUI();
  CloudSyncEngine.onAppResume();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && CloudSyncEngine.autoPushTimer) {
    clearTimeout(CloudSyncEngine.autoPushTimer);
    CloudSyncEngine.autoPushTimer = null;
    CloudSyncEngine.pushToCloud();
  }
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
      if (!parsed.antiDejaVuMigratedV3) {
        if (!parsed.retryInterval || parsed.retryInterval < 15) {
          parsed.retryInterval = 25;
        }
        parsed.antiDejaVuMigratedV3 = true;
      }
      if (!parsed.hapticMigratedNative) {
        parsed.hapticDuration = 80;
        parsed.hapticMigratedNative = true;
      }
      if (parsed.excludeSimLabs !== undefined) {
        parsed.excludeSimLabs = Boolean(parsed.excludeSimLabs);
      }
      appState = Object.assign(appState, parsed);
    }
  } catch (e) {
    console.error('Failed to load state from localStorage', e);
  }
}

function saveState() {
  try {
    appState.updatedAt = Date.now();
    // Keep max 1000 history items to bound storage while supporting 500-window diagnostics
    if (appState.history.length > 1000) {
      appState.history = appState.history.slice(-1000);
    }
    localStorage.setItem('ccna_app_state_v1', JSON.stringify(appState));
    DeckScheduler.saveSessionSnapshot();
    CloudSyncEngine.scheduleAutoPush();
  } catch (e) {
    console.error('Failed to save state to localStorage', e);
  }
}

async function loadQuestionData() {
  const bundle = window.CCNA_CARDS_DATA || window.CCNA_QUESTIONS_DATA || window.ccnaCardsData || (typeof ccnaCardsData !== 'undefined' ? ccnaCardsData : null);
  if (bundle && Array.isArray(bundle) && bundle.length > 0) {
    allQuestions = bundle;
    questionById = {};
    allQuestions.forEach(q => {
      enrichQuestionTaxonomy(q);
      questionById[q.id] = q;
    });
    console.log(`Loaded ${allQuestions.length} CCNA questions from script bundle.`);
    return true;
  }
  try {
    const res = await fetch('data/ccna_cards_tagged.json');
    allQuestions = await res.json();
    questionById = {};
    allQuestions.forEach(q => {
      enrichQuestionTaxonomy(q);
      questionById[q.id] = q;
    });
    console.log(`Loaded ${allQuestions.length} CCNA questions from fetch.`);
    return true;
  } catch (err) {
    console.error('Error fetching questions:', err);
    document.getElementById('cardPrompt').textContent = 'Error loading question bank. Please reinstall or restart app.';
    return false;
  }
}

function enrichQuestionTaxonomy(q) {
  if (q.domain && q.topic && q.topic !== 'General') return;
  const optText = Array.isArray(q.options) ? q.options.map(o => o.text || '').join(' ') : '';
  const hay = `${q.prompt || ''} ${optText} ${(q.explanation || '').slice(0, 400)}`.toLowerCase();

  const rules = [
    // 6. Automation and Programmability
    { re: /\b(ansible|puppet|chef|restconf|netconf|json|yaml|xml|rest api|crud|dna center|sd-access|controller-based|southbound|northbound|postman|python)\b/, domain: 'Automation and Programmability', topic: 'Automation, SDN & REST APIs' },
    // 5. Security Fundamentals
    { re: /\b(dhcp snooping|dynamic arp inspection|\bdai\b|port-security|port security|bpdu guard|root guard|802\.1x)\b/, domain: 'Security Fundamentals', topic: 'Layer 2 Security (Port Security / DAI / Snooping)' },
    { re: /\b(access-list|ip access-group|standard acl|extended acl|wildcard mask)\b/, domain: 'Security Fundamentals', topic: 'Access Control Lists (ACLs)' },
    { re: /\b(wpa2|wpa3|\baaa\b|tacacs\+|radius|ipsec|vpn|cryptography|phishing|malware|ddos|firewall|ngfw|ips|ids)\b/, domain: 'Security Fundamentals', topic: 'Security, VPNs, AAA & Wireless Security' },
    // 4. IP Services
    { re: /\b(ip nat|nat inside|nat outside|overload|\bpat\b|inside global|inside local)\b/, domain: 'IP Services', topic: 'NAT & PAT' },
    { re: /\b(hsrp|standby ip|standby \d|vrrp|glbp|first hop redundancy|fhrp)\b/, domain: 'IP Services', topic: 'First Hop Redundancy (HSRP / FHRP)' },
    { re: /\b(ip dhcp|dhcp pool|ip helper-address|dora|\bdns\b|fqdn)\b/, domain: 'IP Services', topic: 'DHCP & DNS Services' },
    { re: /\b(\bntp\b|syslog|snmp|mib|logging trap|stratum|\btftp\b|\bftp\b)\b/, domain: 'IP Services', topic: 'NTP, Syslog & SNMP' },
    { re: /\b(\bqos\b|dscp|cos|queuing|llq|cbwfq|policing|shaping|per-hop behavior|phb)\b/, domain: 'IP Services', topic: 'QoS & Traffic Management' },
    // 3. IP Connectivity
    { re: /\b(ospf|router-id|dr\/bdr|designated router|area 0|wildcard|lsa|spf|passive-interface)\b/, domain: 'IP Connectivity', topic: 'OSPFv2 Dynamic Routing' },
    { re: /\b(ip route|ipv6 route|floating static|default-information originate|gateway of last resort|administrative distance|longest match|longest prefix|routing table|show ip route)\b/, domain: 'IP Connectivity', topic: 'IP Routing & Static Routes' },
    // 2. Network Access
    { re: /\b(spanning-tree|stp|rstp|pvst|root bridge|root port|designated port|portfast)\b/, domain: 'Network Access', topic: 'Spanning Tree Protocol (STP / RSTP)' },
    { re: /\b(etherchannel|lacp|pagp|channel-group|port-channel)\b/, domain: 'Network Access', topic: 'EtherChannel (LACP / PAgP)' },
    { re: /\b(vlan|802\.1q|dot1q|trunk|native vlan|switchport|router-on-a-stick|svi|voice vlan|vtp)\b/, domain: 'Network Access', topic: 'VLANs & 802.1Q Trunking' },
    { re: /\b(\bcdp\b|\blldp\b)\b/, domain: 'Network Access', topic: 'Layer 2 Discovery (CDP & LLDP)' },
    { re: /\b(wlc|capwap|lwapp|ssid|802\.11|wireless|ap mode|flexconnect|autonomous ap)\b/, domain: 'Network Access', topic: 'Wireless LANs (WLC & 802.11)' },
    // 1. Network Fundamentals
    { re: /\b(ipv6|fe80|2001:|slaac|eui-64|solicited-node|link-local|unique local|global unicast)\b/, domain: 'Network Fundamentals', topic: 'IPv6 Addressing & Neighbor Discovery' },
    { re: /\b(\/\d{2}\b|subnet|255\.255\.|vlsm|cidr|broadcast address|private ip|rfc 1918)\b/, domain: 'Network Fundamentals', topic: 'IPv4 Addressing & Subnetting' },
    { re: /\b(tcp|udp|three-way handshake|syn|ack|port \d+|osi|encapsulation|pdu|mac address-table|csma\/cd|duplex|poe|fiber|utp|sfp|spine-leaf|three-tier|two-tier)\b/, domain: 'Network Fundamentals', topic: 'TCP/IP, Ethernet & Network Architecture' }
  ];

  for (const r of rules) {
    if (r.re.test(hay)) {
      if (!q.domain) q.domain = r.domain;
      if (!q.topic || q.topic === 'General') q.topic = r.topic;
      return;
    }
  }
  if (!q.domain) q.domain = 'Network Fundamentals';
  if (!q.topic) q.topic = 'TCP/IP, Ethernet & Network Architecture';
}

function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function syncDrillBannerUI() {
  const banner = document.getElementById('drillBanner');
  const txt = document.getElementById('drillBannerText');
  if (!banner || !txt) return;
  if (appState.drillTopic) {
    banner.classList.add('active');
    txt.textContent = appState.drillTopic;
  } else {
    banner.classList.remove('active');
  }
}

function setupPracticeQueue(filterTopic = null) {
  let pool = allQuestions;
  if (appState.excludeSimLabs) {
    pool = pool.filter(q => q.type !== 'Simulation / Lab');
  }
  if (filterTopic) {
    const matched = pool.filter(q => q.topic === filterTopic || q.domain === filterTopic);
    if (matched.length > 0) {
      pool = matched;
      appState.deckMode = 'topic';
      appState.drillTopic = `🎯 Focused Drill: ${filterTopic} (${pool.length} Qs)`;
    } else {
      appState.drillTopic = null;
      appState.deckMode = 'smart';
    }
  } else {
    appState.drillTopic = null;
    appState.deckMode = 'smart';
    appState.domainFilter = '';
  }

  syncDrillBannerUI();
  activeQueue = DeckScheduler.buildSmartQueue(pool);
  currentIndex = 0;
  DeckScheduler.saveSessionSnapshot();
}

function switchDeckMode(mode) {
  if (mode === 'bookmarks') {
    let pool = allQuestions.filter(q => appState.bookmarkedIds[q.id]);
    if (appState.excludeSimLabs) {
      pool = pool.filter(q => q.type !== 'Simulation / Lab');
    }
    if (pool.length === 0) {
      showToast('⭐ No bookmarked questions yet! Tap ★ on any card to bookmark it.');
      return;
    }
    appState.deckMode = 'bookmarks';
    appState.drillTopic = `⭐ Bookmarked Pool (${pool.length} Qs)`;
    syncDrillBannerUI();
    activeQueue = DeckScheduler.buildSmartQueue(pool);
    currentIndex = 0;
    closeModals();
    renderCurrentCard();
    updateHeaderStats();
    saveState();
    showToast(`⭐ Loaded ${pool.length} bookmarked questions`);
    return;
  }

  if (mode === 'weak') {
    let pool = allQuestions.filter(q => {
      const st = appState.cardStats && appState.cardStats[q.id];
      return appState.masteredIds[q.id] === false || (st && (st.box === 0 || st.box === 1 || (st.everWrong && !appState.masteredIds[q.id])));
    });
    if (appState.excludeSimLabs) {
      pool = pool.filter(q => q.type !== 'Simulation / Lab');
    }
    if (pool.length === 0) {
      showToast('🎉 Zero unresolved weak/wrong questions! Keep practicing in Smart Mode.');
      return;
    }
    appState.deckMode = 'weak';
    appState.drillTopic = `📕 Wrong & Weak Pool (${pool.length} Qs)`;
    syncDrillBannerUI();
    activeQueue = DeckScheduler.buildSmartQueue(pool);
    currentIndex = 0;
    closeModals();
    renderCurrentCard();
    updateHeaderStats();
    saveState();
    showToast(`📕 Loaded ${pool.length} wrong/weak questions for targeted review`);
    return;
  }

  if (mode === 'random') {
    let pool = [...allQuestions];
    if (appState.excludeSimLabs) {
      pool = pool.filter(q => q.type !== 'Simulation / Lab');
    }
    if (appState.hideMastered) {
      pool = pool.filter(q => appState.masteredIds[q.id] !== true);
    }
    pool = shuffle(pool).map(q => ({ ...q, isRetry: false }));
    appState.deckMode = 'random';
    const label = appState.hideMastered ? '仅未掌握' : '全题库';
    appState.drillTopic = `🎲 Pure Random (${label} ${pool.length.toLocaleString()} Qs)`;
    syncDrillBannerUI();
    activeQueue = pool;
    currentIndex = 0;
    closeModals();
    renderCurrentCard();
    updateHeaderStats();
    saveState();
    showToast(`🎲 真随机模式已就绪 (${label})！共 ${pool.length.toLocaleString()} 题`);
    return;
  }

  // Default: 'smart'
  setupPracticeQueue(null);
  closeModals();
  renderCurrentCard();
  updateHeaderStats();
  saveState();
  showToast('🧠 Switched to Smart Adaptive Mode (Due + Unseen prioritized)');
}
window.switchDeckMode = switchDeckMode;

function filterByDomain(domainName) {
  appState.domainFilter = domainName || '';
  if (!domainName) {
    setupPracticeQueue(null);
    closeModals();
    renderCurrentCard();
    updateHeaderStats();
    saveState();
    showToast('📚 Showing all 6 CCNA Domains');
    return;
  }
  let pool = allQuestions.filter(q => q.domain === domainName);
  if (appState.excludeSimLabs) {
    pool = pool.filter(q => q.type !== 'Simulation / Lab');
  }
  if (pool.length === 0) {
    showToast(`No questions found for domain ${domainName}`);
    return;
  }
  appState.deckMode = 'domain';
  appState.drillTopic = `📚 Domain: ${domainName} (${pool.length} Qs)`;
  syncDrillBannerUI();
  activeQueue = DeckScheduler.buildSmartQueue(pool);
  currentIndex = 0;
  closeModals();
  renderCurrentCard();
  updateHeaderStats();
  saveState();
  showToast(`📚 Filtered to ${domainName} (${pool.length} Qs)`);
}
window.filterByDomain = filterByDomain;

function exitDrillMode() {
  setupPracticeQueue(null);
  renderCurrentCard();
  updateHeaderStats();
  showToast('Exited drill mode. Resumed Smart Adaptive Queue.');
}

function formatMarkdown(text) {
  if (!text) return '';

  function escapeCode(value) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // 1. Protect code blocks
  const codeBlocks = [];
  let out = text.replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, (match, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre class="cli-block"><code>${escapeCode(code.trim())}</code></pre>`);
    return `%%CODE_BLOCK_${idx}%%`;
  });

  // 2. Protect inline code
  const inlineCodes = [];
  out = out.replace(/`([^`]+)`/g, (match, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code class="inline-code">${escapeCode(code)}</code>`);
    return `%%INLINE_CODE_${idx}%%`;
  });

  // 3. Escape HTML
  out = out.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Allow safe formatting tags in markdown and tables: <br>, <br/>, <br />
  out = out.replace(/&lt;br\s*\/?&gt;/gi, '<br>');

  // Normalize common LaTeX arrow sequences and fix corrupted \r+ightarrow
  out = out.replace(/\\rightarrow/g, '→')
           .replace(/\\to/g, '→')
           .replace(/\r?ightarrow/g, '→');

  // 4. LaTeX & Math parsing
  function renderLatex(tex) {
    let t = tex.trim();
    // Symbol replacements (including \rightarrow and malformed \r+ightarrow)
    t = t.replace(/\\rightarrow/g, '→').replace(/\\to/g, '→')
         .replace(/\r?ightarrow/g, '→')
         .replace(/\\leftarrow/g, '←')
         .replace(/\\Rightarrow/g, '⇒').replace(/\\Leftarrow/g, '⇐')
         .replace(/\\leftrightarrow/g, '↔').replace(/\\Leftrightarrow/g, '⇔')
         .replace(/\\geq/g, '≥').replace(/\\ge/g, '≥')
         .replace(/\\leq/g, '≤').replace(/\\le/g, '≤')
         .replace(/\\neq/g, '≠')
         .replace(/\\approx/g, '≈')
         .replace(/\\times/g, '×')
         .replace(/\\div/g, '÷')
         .replace(/\\pm/g, '±')
         .replace(/\\oplus/g, '⊕')
         .replace(/\\sum/g, '∑')
         .replace(/\\cdot/g, '·')
         .replace(/\\dots/g, '…').replace(/\\ldots/g, '…')
         .replace(/\\min/g, 'min').replace(/\\max/g, 'max')
         .replace(/\\left\(/g, '(').replace(/\\right\)/g, ')')
         .replace(/\\left\[/g, '[').replace(/\\right\]/g, ']');
    // \text{...}
    t = t.replace(/\\text\{([^}]+)\}/g, '$1');
    // \frac{A}{B}
    t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '<span class="md-frac"><span class="md-num">$1</span><span class="md-denom">$2</span></span>');
    // superscripts & subscripts: X^{Y} -> X<sup>Y</sup>
    t = t.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
    t = t.replace(/\^([0-9a-zA-Z+=-]+)/g, '<sup>$1</sup>');
    t = t.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
    t = t.replace(/_([0-9a-zA-Z+=-]+)/g, '<sub>$1</sub>');
    if (t === '→' || t === '←' || t === '⇒' || t === '⇐' || t === '↔' || t === '⇔') {
      return t;
    }
    return `<span class="math-tex">${t}</span>`;
  }

  // Render $...$ math
  out = out.replace(/\$([^$\n]+)\$/g, (m, content) => renderLatex(content));

  // 5. Markdown Tables
  const lines = out.split('\n');
  const newLines = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|') && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      if (nextLine.startsWith('|') && nextLine.endsWith('|') && /^\|(\s*:?-+:?\s*\|)+$/.test(nextLine)) {
        // Table detected!
        const headerCols = line.slice(1, -1).split('|').map(c => c.trim());
        const alignCols = nextLine.slice(1, -1).split('|').map(c => c.trim());
        const alignments = alignCols.map(ac => {
          if (ac.startsWith(':') && ac.endsWith(':')) return 'center';
          if (ac.endsWith(':')) return 'right';
          return 'left';
        });

        const tableParts = ['<div class="table-wrap"><table class="md-table"><thead><tr>'];
        headerCols.forEach((col, idx) => {
          const align = alignments[idx] || 'left';
          tableParts.push(`<th style="text-align:${align};">${col}</th>`);
        });
        tableParts.push('</tr></thead><tbody>');

        let rIdx = i + 2;
        while (rIdx < lines.length) {
          const rowLine = lines[rIdx].trim();
          if (rowLine.startsWith('|') && rowLine.endsWith('|')) {
            const rowCols = rowLine.slice(1, -1).split('|').map(c => c.trim());
            tableParts.push('<tr>');
            rowCols.forEach((col, idx) => {
              const align = alignments[idx] || 'left';
              tableParts.push(`<td style="text-align:${align};">${col}</td>`);
            });
            tableParts.push('</tr>');
            rIdx++;
          } else {
            break;
          }
        }
        tableParts.push('</tbody></table></div>');
        newLines.push(tableParts.join(''));
        i = rIdx;
        continue;
      }
    }
    newLines.push(lines[i]);
    i++;
  }
  out = newLines.join('\n');

  // 5.5 Blockquotes & Callouts (> [!NOTE], > [!TIP], > ...)
  const qLines = out.split('\n');
  const quoteProcessed = [];
  let qi = 0;
  while (qi < qLines.length) {
    const qLine = qLines[qi].trim();
    if (qLine.startsWith('&gt;')) {
      const bqGroup = [];
      while (qi < qLines.length && qLines[qi].trim().startsWith('&gt;')) {
        bqGroup.push(qLines[qi].trim().replace(/^&gt;\s?/, ''));
        qi++;
      }
      const firstLine = bqGroup[0] || '';
      const calloutMatch = firstLine.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
      if (calloutMatch) {
        const type = calloutMatch[1].toLowerCase();
        const iconMap = {
          'note': 'ℹ️',
          'tip': '💡',
          'important': '❗',
          'warning': '⚠️',
          'caution': '🛑'
        };
        const icon = iconMap[type] || 'ℹ️';
        const innerLines = bqGroup.slice(1);
        quoteProcessed.push(`<div class="md-callout md-callout-${type}"><div class="callout-icon">${icon}</div><div class="callout-content">${innerLines.join('\n')}</div></div>`);
      } else {
        quoteProcessed.push(`<blockquote class="md-blockquote">${bqGroup.join('\n')}</blockquote>`);
      }
      continue;
    }
    quoteProcessed.push(qLines[qi]);
    qi++;
  }
  out = quoteProcessed.join('\n');

  // 6. Markdown Headings (#, ##, ###, ####)
  out = out.replace(/^####\s+(.+)$/gm, '<h5 class="md-h4">$1</h5>');
  out = out.replace(/^###\s+(.+)$/gm, '<h4 class="md-h3">$1</h4>');
  out = out.replace(/^##\s+(.+)$/gm, '<h3 class="md-h2">$1</h3>');
  out = out.replace(/^#\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>');

  // 7. Section Bullets (• **...**: or • ...)
  out = out.replace(/^[•●■]\s*(.+)$/gm, '<div class="exp-bullet-heading"><span class="bullet-dot">•</span> $1</div>');

  // 8. Bold & Italic (applied after bullet headings so heading bold works!)
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // 9. List Items
  // Sub-items (indented with 2+ spaces followed by - or * or _)
  out = out.replace(/^\s{2,}[-*_]\s+(.+)$/gm, '<div class="md-sub-item"><span class="sub-bullet">▸</span> $1</div>');
  // Numbered list: 1. Item
  out = out.replace(/^(\d+)\.\s+(.+)$/gm, '<div class="md-list-item"><strong class="md-num-label">$1.</strong> $2</div>');
  // Top-level item: - Item
  out = out.replace(/^[-*]\s+(.+)$/gm, '<div class="md-list-item"><span class="list-bullet">•</span> $1</div>');

  // Clean prose while code is still protected, preserving CLI indentation.
  const filtered = out.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  out = filtered.join('\n');
  out = out.replace(/(?<!>)\n(?!<)/g, '<br>');

  // 10. Restore escaped Inline code & Code blocks
  for (let idx = 0; idx < inlineCodes.length; idx++) {
    out = out.replace(new RegExp(`%%INLINE_CODE_${idx}%%`, 'g'), inlineCodes[idx]);
  }
  for (let idx = 0; idx < codeBlocks.length; idx++) {
    out = out.replace(new RegExp(`%%CODE_BLOCK_${idx}%%`, 'g'), codeBlocks[idx]);
  }

  return out;
}

function updateActiveCardStatusBadges() {
  if (!currentQuestion) return;
  const srsBadge = document.getElementById('cardSrsBadge');
  const retryBadge = document.getElementById('cardRetryBadge');
  const cardStat = (appState.cardStats && appState.cardStats[currentQuestion.id]) || null;

  if (retryBadge) {
    if (currentQuestion.isRetry) {
      retryBadge.style.display = 'inline-block';
      retryBadge.textContent = currentQuestion.retryStage === 2 ? '🌱 Consolidate (2/2)' : '🔁 Reinforce (1/2)';
    } else {
      retryBadge.style.display = 'none';
    }
  }

  if (srsBadge) {
    srsBadge.className = 'badge badge-srs';
    if (cardStat && cardStat.lapses >= 3 && !appState.masteredIds[currentQuestion.id]) {
      srsBadge.style.display = 'inline-block';
      srsBadge.classList.add('srs-leech');
      srsBadge.textContent = `🔥 Leech (${cardStat.lapses}x missed)`;
    } else if (appState.masteredIds[currentQuestion.id] === true) {
      srsBadge.style.display = 'inline-block';
      srsBadge.classList.add('srs-mastered');
      if (appState.hideMastered) {
        srsBadge.textContent = '✓ Mastered';
        srsBadge.title = '此题已掌握 (当前已开启【仅刷未掌握】)';
      } else if (appState.deckMode === 'random') {
        srsBadge.textContent = '✓ Mastered (全随机)';
        srsBadge.title = '全题库随机模式：直接从全库抽取，包含已掌握题目';
      } else if (currentQuestion && currentQuestion._drawSource === 'mastered_probe') {
        srsBadge.textContent = '🔍 5% 抗遗忘抽检';
        srsBadge.title = '系统每隔 ~20 题随机抽查一道已掌握题以防遗忘。可在调度Log或设置中开启【仅刷未掌握】';
      } else {
        srsBadge.textContent = '✓ Mastered';
      }
    } else if (cardStat && cardStat.box === 1) {
      srsBadge.style.display = 'inline-block';
      srsBadge.classList.add('srs-learning');
      srsBadge.textContent = '🌱 Step 1/2 Passed';
    } else if (cardStat && (cardStat.everWrong || cardStat.lapses > 0 || appState.masteredIds[currentQuestion.id] === false)) {
      srsBadge.style.display = 'inline-block';
      srsBadge.classList.add('srs-weak');
      srsBadge.textContent = '⚠️ Weak Point';
    } else {
      srsBadge.style.display = 'none';
    }
  }
}
window.updateActiveCardStatusBadges = updateActiveCardStatusBadges;

function renderCurrentCard() {
  if (appState.hideMastered && Array.isArray(activeQueue)) {
    while (currentIndex < activeQueue.length && appState.masteredIds[activeQueue[currentIndex].id] === true) {
      currentIndex++;
    }
  }

  if (currentIndex >= activeQueue.length) {
    if (appState.deckMode === 'random') {
      switchDeckMode('random');
      return;
    } else {
      setupPracticeQueue(appState.drillTopic);
      if (appState.hideMastered && Array.isArray(activeQueue)) {
        while (currentIndex < activeQueue.length && appState.masteredIds[activeQueue[currentIndex].id] === true) {
          currentIndex++;
        }
      }
    }
  }

  if (currentIndex >= activeQueue.length) {
    return;
  }

  currentQuestion = activeQueue[currentIndex];
  isAnswerSubmitted = false;
  currentSelectedOptions.clear();

  // Log draw event for transparent scheduling visibility
  if (currentQuestion) {
    const isMastered = appState.masteredIds[currentQuestion.id] === true;
    const weakTopics = DeckScheduler.getWeakTopicsSet();
    let reason = '📚 Unseen Normal (常规新题探索)';
    if (appState.deckMode === 'random') {
      reason = isMastered ? '🎲 Pure Random (全随机池 - 已掌握题)' : '🎲 Pure Random (全随机池 - 未掌握题)';
    } else if (currentQuestion.isRetry) {
      reason = currentQuestion.retryStage === 2 ? '🌱 Retry Stage 2 (错题巩固 2/2)' : '🔁 Retry Stage 1 (错题强化 1/2)';
    } else if (isMastered) {
      if (currentQuestion._drawSource === 'mastered_probe' && !appState.hideMastered) {
        reason = '🔍 Mastered 5% Probe (5% 智能抗遗忘抽检)';
      } else {
        reason = '✓ Mastered Review (已掌握题回顾)';
      }
    } else if (weakTopics && weakTopics.has(currentQuestion.topic)) {
      reason = '🎯 Unseen Priority (薄弱考点新题优先)';
    }

    DeckScheduler.logDrawEvent({
      qid: currentQuestion.id,
      topic: currentQuestion.topic || 'General',
      mode: appState.deckMode || 'smart',
      isMastered: isMastered,
      cardIndex: currentIndex + 1,
      queueLen: activeQueue.length,
      reason: reason,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false })
    });
  }

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
  const card = document.getElementById('activeCard');
  const cardContainer = document.getElementById('cardContainer') || document.querySelector('main');

  // Toggle responsive lab split-view layout
  const isLab = currentQuestion.type === 'Simulation / Lab';
  if (isLab) {
    if (card) card.classList.add('is-lab-card');
    if (cardContainer) cardContainer.classList.add('is-lab-main');
  } else {
    if (card) card.classList.remove('is-lab-card');
    if (cardContainer) cardContainer.classList.remove('is-lab-main');
  }

  // Set top tags
  qidEl.textContent = `#${currentQuestion.id}`;
  domainEl.textContent = currentQuestion.domain || 'Network Fundamentals';
  topicEl.textContent = currentQuestion.topic || 'General';
  
  updateActiveCardStatusBadges();

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
    setDiagramImage(exhibitImg, currentQuestion.image);
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
  if (window.IdkHoldManager) IdkHoldManager.resetUI();
  actionBtn.style.display = 'flex';
  actionBtn.textContent = 'Check Answer';
  actionBtn.className = 'btn btn-primary';
  const prevBtn = document.getElementById('prevBtn');
  if (prevBtn) {
    prevBtn.style.display = currentIndex > 0 ? 'flex' : 'none';
  }
  const labEvalGroup = document.getElementById('labEvalGroup');
  if (labEvalGroup) {
    labEvalGroup.style.display = 'none';
  }

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
        const sim = new IosSimulator(simWrap, { questionId: currentQuestion.id, devices: devs, promptText: currentQuestion.prompt });
        if (typeof sim.render === 'function' && (!simWrap.children || simWrap.children.length === 0)) {
          sim.render();
        }
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

function shouldShuffleDndTargets(targets) {
  if (!Array.isArray(targets) || targets.length <= 1) return false;
  const labels = targets.map(t => (t.label || '').trim());
  const isPureNum = labels.every(l => /^\d+$/.test(l));
  const isStep = labels.every(l => /^step\s*\d+$/i.test(l));
  const isOrdinal = labels.every(l => /^(first|second|third|fourth|fifth|sixth)$/i.test(l));
  const isPos = labels.every(l => /^position\s+[a-z]$/i.test(l));
  return !(isPureNum || isStep || isOrdinal || isPos);
}

function getDndTargetClusterKey(tgt) {
  if (tgt.unordered_group) return tgt.unordered_group;
  const match = (tgt.label || '').match(/^(.*?)\s*\(Slot\s*\d+\)$/i);
  if (match) return match[1].trim();
  return (tgt.id || '') + '_' + (tgt.label || '');
}

function getShuffledDndTargets(targets) {
  if (!Array.isArray(targets)) return [];
  // Ensure every target has a persistent id first
  targets.forEach((tgt, idx) => {
    if (!tgt.id) tgt.id = `t${idx + 1}`;
  });

  if (appState.shuffleOptions === false || !shouldShuffleDndTargets(targets)) {
    return targets;
  }

  // Cluster targets by category/group to keep same-category slots cleanly grouped
  const clusters = [];
  const clusterMap = {};
  targets.forEach(t => {
    const key = getDndTargetClusterKey(t);
    if (!clusterMap[key]) {
      clusterMap[key] = [];
      clusters.push(clusterMap[key]);
    }
    clusterMap[key].push(t);
  });

  // Shuffle the clusters (randomizes category blocks and all distinct concept rows)
  const shuffledClusters = shuffle(clusters);
  const result = [];
  shuffledClusters.forEach(cluster => {
    cluster.forEach(item => result.push(item));
  });
  return result;
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

  const targetsToRender = getShuffledDndTargets(dndData.targets);

  targetsToRender.forEach((tgt, idx) => {
    const tid = tgt.id;

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
  triggerHaptic('click');
  if (dndSelectedSourceIdx === sourceIdx) {
    dndSelectedSourceIdx = null;
  } else {
    dndSelectedSourceIdx = sourceIdx;
  }
  updateDndBoardUI();
}

function handleDndSlotTap(targetId) {
  if (isAnswerSubmitted) return;
  triggerHaptic('click');

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
  triggerHaptic('click');

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
    triggerHaptic('click');
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

  // Special handling for Simulation / Lab: reveal reference config first and let user self-evaluate
  if (currentQuestion.type === 'Simulation / Lab') {
    showExplanation(true, null);
    const actionBtn = document.getElementById('actionBtn');
    const labEvalGroup = document.getElementById('labEvalGroup');
    if (labEvalGroup) {
      actionBtn.style.display = 'none';
      labEvalGroup.style.display = 'flex';
    } else {
      actionBtn.textContent = 'Next Question →';
      actionBtn.className = 'btn btn-next';
    }
    showToast('🛠️ Compare your CLI config with the reference solution below.');
    return;
  }

  // Handle outcome via SrsEngine (2-stage consolidation for missed questions)
  if (isCorrect) {
    triggerHaptic(true);
    logAttempt(true, false, null);
    const srsRes = SrsEngine.recordOutcome(currentQuestion, true, false);
    if (srsRes.status === 'consolidating') {
      showToast(`🌱 Step 1/2 Correct! Will consolidate in ${srsRes.interval} Qs.`);
    } else if (srsRes.status === 'graduated') {
      showToast('✨ Mastered! (2/2 consecutive reviews passed)');
    } else {
      showToast('✨ Correct! Well done.');
    }
  } else {
    triggerHaptic(false);
    logAttempt(false, false, misconceptionMsg);
    const srsRes = SrsEngine.recordOutcome(currentQuestion, false, false);
    showToast(`⚠️ Incorrect. Queued for reinforcement in ${srsRes.interval} Qs.`);
  }

  // Update card status badges, stats, and snapshot immediately on answer submission
  updateActiveCardStatusBadges();
  updateHeaderStats();
  saveState();
  if (document.getElementById('weaknessModal').classList.contains('active')) {
    renderWeaknessAssessment(currentWindow);
  }

  // Show explanation
  showExplanation(isCorrect, misconceptionMsg);

  // Switch button to Next
  const actionBtn = document.getElementById('actionBtn');
  actionBtn.textContent = 'Next Question →';
  actionBtn.className = 'btn btn-next';
}

function submitLabSelfEval(isMastered) {
  if (!currentQuestion) return;
  triggerHaptic(Boolean(isMastered));
  if (isMastered) {
    logAttempt(true, false, null);
    SrsEngine.recordOutcome(currentQuestion, true, false);
    showToast('✨ Lab marked as Mastered!');
  } else {
    const msg = `${currentQuestion.topic || 'Simulation / Lab'} (Needs CLI Practice)`;
    logAttempt(false, false, msg);
    const srsRes = SrsEngine.recordOutcome(currentQuestion, false, false);
    showToast(`🔁 Lab queued for retry in ${srsRes.interval} Qs.`);
  }
  updateActiveCardStatusBadges();
  updateHeaderStats();
  saveState();
  advanceToNextCard();
}
window.submitLabSelfEval = submitLabSelfEval;

// ==========================================
// IDK LONG-PRESS (750ms) WITH GLOWING CIRCULAR PROGRESS
// ==========================================
const IdkHoldManager = {
  duration: 750,
  circumference: 2 * Math.PI * 23, // ~144.513
  holdStartTime: 0,
  holdRafId: null,
  isHolding: false,
  holdTriggered: false,
  activePointerId: null,

  init() {
    const idkBtn = document.getElementById('idkBtn');
    const idkWrap = document.getElementById('idkWrap');
    if (!idkBtn || !idkWrap) return;

    const ringBar = document.getElementById('idkRingBar');
    const ringGlow = document.getElementById('idkRingGlow');
    if (ringBar) {
      ringBar.style.strokeDasharray = `${this.circumference} ${this.circumference}`;
      ringBar.style.strokeDashoffset = this.circumference;
    }
    if (ringGlow) {
      ringGlow.style.strokeDasharray = `${this.circumference} ${this.circumference}`;
      ringGlow.style.strokeDashoffset = this.circumference;
    }

    // Pointer events for mobile touch + desktop mouse
    idkBtn.addEventListener('pointerdown', (e) => this.onPointerDown(e), { passive: false });
    idkBtn.addEventListener('pointerup', (e) => this.onPointerUp(e));
    idkBtn.addEventListener('pointercancel', (e) => this.onPointerCancel(e));
    idkBtn.addEventListener('pointerleave', (e) => this.onPointerLeave(e));

    // Prevent context menu (long press default on mobile)
    idkBtn.addEventListener('contextmenu', (e) => e.preventDefault());

    // Neutralize standard click
    idkBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    // Keyboard support: Hold Space or Enter
    idkBtn.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !this.isHolding && !e.repeat) {
        e.preventDefault();
        this.startHold();
      }
    });
    idkBtn.addEventListener('keyup', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && this.isHolding) {
        e.preventDefault();
        this.cancelHold(true);
      }
    });
  },

  onPointerDown(e) {
    if (isAnswerSubmitted) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    e.preventDefault();
    this.activePointerId = e.pointerId;
    const idkBtn = document.getElementById('idkBtn');
    if (idkBtn && idkBtn.setPointerCapture) {
      try {
        idkBtn.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
    this.startHold();
  },

  onPointerUp(e) {
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
    const wasHolding = this.isHolding;
    this.activePointerId = null;
    if (wasHolding) {
      this.cancelHold(true);
    }
  },

  onPointerCancel(e) {
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
    this.activePointerId = null;
    if (this.isHolding) {
      this.cancelHold(false);
    }
  },

  onPointerLeave(e) {
    // Only cancel if mouse leaves without capture
    if (e.pointerType === 'mouse' && this.isHolding) {
      this.cancelHold(false);
    }
  },

  startHold() {
    if (isAnswerSubmitted || this.isHolding) return;

    this.isHolding = true;
    this.holdTriggered = false;
    this.holdStartTime = performance.now();

    const idkWrap = document.getElementById('idkWrap');
    const circleWrap = document.getElementById('idkCircleWrap');
    const ringBar = document.getElementById('idkRingBar');
    const ringGlow = document.getElementById('idkRingGlow');

    if (idkWrap) idkWrap.classList.add('is-holding');
    if (circleWrap) circleWrap.classList.remove('burst');
    if (ringBar) ringBar.style.strokeDashoffset = this.circumference;
    if (ringGlow) ringGlow.style.strokeDashoffset = this.circumference;

    // Mechanical switch "Ka" (Heavy impact on press down)
    triggerHaptic('heavy');

    const animate = (now) => {
      if (!this.isHolding || this.holdTriggered) return;
      const elapsed = now - this.holdStartTime;
      const progress = Math.min(1, elapsed / this.duration);
      const offset = this.circumference * (1 - progress);

      if (ringBar) ringBar.style.strokeDashoffset = offset;
      if (ringGlow) ringGlow.style.strokeDashoffset = offset;

      if (progress >= 1) {
        this.completeHold();
        return;
      }
      this.holdRafId = requestAnimationFrame(animate);
    };

    this.holdRafId = requestAnimationFrame(animate);
  },

  completeHold() {
    this.holdTriggered = true;
    this.isHolding = false;
    if (this.holdRafId) {
      cancelAnimationFrame(this.holdRafId);
      this.holdRafId = null;
    }

    const circleWrap = document.getElementById('idkCircleWrap');
    if (circleWrap) circleWrap.classList.add('burst');

    setTimeout(() => {
      this.resetUI();
      handleIdk();
    }, 120);
  },

  cancelHold(isRelease = false) {
    if (this.holdTriggered) return;
    const elapsed = performance.now() - this.holdStartTime;
    const wasHolding = this.isHolding;

    this.isHolding = false;
    if (this.holdRafId) {
      cancelAnimationFrame(this.holdRafId);
      this.holdRafId = null;
    }

    this.resetUI();

    // Mechanical switch "Da" (50% intensity release click when lifting finger)
    if (wasHolding && isRelease && !isAnswerSubmitted) {
      triggerHaptic('click');
    }

    // Subtle shake feedback if tapped briefly (< 350ms) without triggering
    if (wasHolding && isRelease && elapsed < 350 && !isAnswerSubmitted) {
      const idkBtn = document.getElementById('idkBtn');
      if (idkBtn) {
        idkBtn.classList.remove('btn-tap-shake');
        void idkBtn.offsetWidth; // trigger reflow
        idkBtn.classList.add('btn-tap-shake');
        setTimeout(() => idkBtn.classList.remove('btn-tap-shake'), 350);
      }
    }
  },

  resetUI() {
    this.isHolding = false;
    this.activePointerId = null;
    const idkWrap = document.getElementById('idkWrap');
    const ringBar = document.getElementById('idkRingBar');
    const ringGlow = document.getElementById('idkRingGlow');
    const circleWrap = document.getElementById('idkCircleWrap');

    if (idkWrap) idkWrap.classList.remove('is-holding');
    if (circleWrap) circleWrap.classList.remove('burst');
    if (ringBar) ringBar.style.strokeDashoffset = this.circumference;
    if (ringGlow) ringGlow.style.strokeDashoffset = this.circumference;
  }
};
window.IdkHoldManager = IdkHoldManager;

function handleIdk() {
  if (isAnswerSubmitted) return;

  isAnswerSubmitted = true;
  if (window.IdkHoldManager) IdkHoldManager.resetUI();
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

  // Log as IDK attempt & schedule via SrsEngine
  const idkMsg = currentQuestion.idk_tag || `${currentQuestion.topic} (Unmastered Knowledge Point)`;
  logAttempt(false, true, idkMsg);
  const srsRes = SrsEngine.recordOutcome(currentQuestion, false, true);
  showToast(`Recorded as weak point. Will reappear in ${srsRes.interval} Qs.`);

  // Update card status badges, stats, and snapshot immediately on answer submission
  updateActiveCardStatusBadges();
  updateHeaderStats();
  saveState();
  if (document.getElementById('weaknessModal').classList.contains('active')) {
    renderWeaknessAssessment(currentWindow);
  }

  // Show explanation
  showExplanation(false, `Marked as unknown: ${idkMsg}`);

  // Switch button to Next
  const actionBtn = document.getElementById('actionBtn');
  actionBtn.textContent = 'Next Question →';
  actionBtn.className = 'btn btn-next';
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
      setDiagramImage(solImg, currentQuestion.answer_image);
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
  DeckScheduler.saveSessionSnapshot();
  renderCurrentCard();
  updateHeaderStats();
}

function goToPreviousCard() {
  if (currentIndex > 0) {
    triggerHaptic('click');
    currentIndex--;
    DeckScheduler.saveSessionSnapshot();
    renderCurrentCard();
    updateHeaderStats();
  }
}
window.goToPreviousCard = goToPreviousCard;

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
  const totalCount = appState.excludeSimLabs
    ? allQuestions.filter(q => q.type !== 'Simulation / Lab').length
    : allQuestions.length;
  document.getElementById('sessionStats').textContent = 
    `Mastered: ${masteredCount} / ${totalCount.toLocaleString()} (Card ${currentIndex + 1})`;

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

// ==========================================
// TOP-LEFT PRACTICE HISTORY & WEAKNESS ASSESSMENT MODAL
// ==========================================
let currentWeakView = 'history'; // default to history stream so user immediately sees their recent question flow

function switchWeakView(view) {
  currentWeakView = view;
  const btnHist = document.getElementById('viewBtnHistory');
  const btnTop = document.getElementById('viewBtnTopics');
  const btnDeck = document.getElementById('viewBtnDeckLog');
  const secHist = document.getElementById('historySection');
  const secTop = document.getElementById('topicsSection');
  const secDeck = document.getElementById('deckLogSection');

  if (btnHist) btnHist.classList.toggle('active', view === 'history');
  if (btnTop) btnTop.classList.toggle('active', view === 'topics');
  if (btnDeck) btnDeck.classList.toggle('active', view === 'decklog');

  if (secHist) secHist.style.display = (view === 'history') ? 'block' : 'none';
  if (secTop) secTop.style.display = (view === 'topics') ? 'block' : 'none';
  if (secDeck) secDeck.style.display = (view === 'decklog') ? 'block' : 'none';

  if (view === 'decklog') {
    renderDeckLog();
  }
}
window.switchWeakView = switchWeakView;

function renderDeckLog() {
  const toggle = document.getElementById('deckLogHideMasteredToggle');
  if (toggle) {
    toggle.checked = Boolean(appState.hideMastered);
  }

  const logList = document.getElementById('deckLogList');
  if (!logList) return;

  const logs = DeckScheduler.drawLog || [];
  if (logs.length === 0) {
    logList.innerHTML = `
      <div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 25px;">
        暂无抽题调度日志，开始刷题后将实时记录抽题原因。
      </div>`;
    return;
  }

  const revLogs = [...logs].reverse();
  const html = revLogs.map(item => {
    let tagColor = 'var(--accent, #6366f1)';
    if (item.isMastered) {
      tagColor = '#10b981';
    } else if (item.reason.includes('Retry') || item.reason.includes('错题')) {
      tagColor = '#f59e0b';
    } else if (item.reason.includes('Priority')) {
      tagColor = '#8b5cf6';
    }

    const modeLabel = item.mode === 'smart' ? '🧠 智能推荐' : (item.mode === 'random' ? '🎲 全随机' : item.mode);
    const masteredBadge = item.isMastered 
      ? '<span style="font-size:0.68rem; background:rgba(16,185,129,0.15); color:#10b981; padding:2px 6px; border-radius:4px; border:1px solid rgba(16,185,129,0.3); margin-left:6px; font-weight:700;">✓ Mastered</span>'
      : '<span style="font-size:0.68rem; background:rgba(100,116,139,0.15); color:var(--text-muted); padding:2px 6px; border-radius:4px; border:1px solid rgba(100,116,139,0.3); margin-left:6px;">未掌握</span>';

    return `
      <div class="history-item" onclick="closeModals(); jumpToQuestion(${item.qid});" style="cursor:pointer; display:flex; flex-direction:column; gap:4px; padding:10px 12px; border-bottom:1px solid var(--border-color);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center;">
            <strong style="color:var(--text-primary); font-size:0.92rem;">#${item.qid}</strong>
            ${masteredBadge}
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
            <span>[${modeLabel}]</span>
            <span>${item.timestamp || ''}</span>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
          <div style="font-size:0.78rem; font-weight:600; color:${tagColor};">
            ${item.reason}
          </div>
          <div style="font-size:0.72rem; color:var(--text-muted);">
            队列位置: ${item.cardIndex}/${item.queueLen}
          </div>
        </div>
        <div style="font-size:0.72rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          考点: ${item.topic}
        </div>
      </div>
    `;
  }).join('');

  logList.innerHTML = html;
}
window.renderDeckLog = renderDeckLog;

function formatRelativeTime(ts) {
  if (!ts) return '';
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return '刚刚';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`;
  const diffHours = Math.floor(diffSec / 3600);
  if (diffHours < 24) return `${diffHours}小时前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function openWeaknessModal() {
  switchWeakView(currentWeakView);
  renderWeaknessAssessment(currentWindow);
  if (currentWeakView === 'decklog') {
    renderDeckLog();
  }
  document.getElementById('weaknessModal').classList.add('active');
}

function switchWindow(w) {
  currentWindow = w;
  document.getElementById('tab50').classList.toggle('active', w === 50);
  document.getElementById('tab200').classList.toggle('active', w === 200);
  document.getElementById('tab500').classList.toggle('active', w === 500);
  const tabAll = document.getElementById('tabAll');
  if (tabAll) tabAll.classList.toggle('active', w === 'all');
  renderWeaknessAssessment(w);
}

function renderWeaknessAssessment(windowSize) {
  const allHist = appState.history || [];
  const subset = (windowSize === 'all') ? allHist.slice() : allHist.slice(-windowSize);
  const total = subset.length;

  const statAttempts = document.getElementById('statAttempts');
  const statAccuracy = document.getElementById('statAccuracy');
  const statIdk = document.getElementById('statIdk');
  const weakList = document.getElementById('weakList');
  const historyList = document.getElementById('historyList');

  if (total === 0) {
    if (statAttempts) statAttempts.textContent = '0';
    if (statAccuracy) statAccuracy.textContent = '0%';
    if (statIdk) statIdk.textContent = '0';
    if (weakList) {
      weakList.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 20px;">
          暂无答题记录，做几道题后将生成薄弱考点分析。
        </div>`;
    }
    if (historyList) {
      historyList.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 25px;">
          暂无答题流水记录，开始做题后将实时显示。
        </div>`;
    }
    return;
  }

  const correctCount = subset.filter(h => h.correct).length;
  const idkCount = subset.filter(h => h.isIdk).length;
  const accuracy = Math.round((correctCount / total) * 100);

  if (statAttempts) statAttempts.textContent = total;
  if (statAccuracy) statAccuracy.textContent = `${accuracy}%`;
  if (statIdk) statIdk.textContent = idkCount;

  // 1. Render History Stream (Reverse Chronological: newest first)
  if (historyList) {
    historyList.innerHTML = '';
    const reversed = subset.slice().reverse();
    reversed.forEach(h => {
      const row = document.createElement('div');
      row.className = 'history-item';
      row.onclick = () => {
        closeModals();
        jumpToQuestion(h.qid);
      };

      let badgeClass = 'hist-correct';
      let badgeText = '✓ 正确';
      if (h.isIdk) {
        badgeClass = 'hist-idk';
        badgeText = '? 不会';
      } else if (!h.correct) {
        badgeClass = 'hist-wrong';
        badgeText = '✗ 错误';
      }

      const timeStr = formatRelativeTime(h.time);
      let detailHtml = '';
      if (h.misconception) {
        const cleanMsg = h.misconception.replace(/^`+|`+$/g, '');
        detailHtml = `<div class="hist-detail">${formatMarkdown(cleanMsg)}</div>`;
      }

      row.innerHTML = `
        <div class="hist-badge ${badgeClass}">${badgeText}</div>
        <div class="hist-body">
          <div class="hist-header">
            <span class="hist-qid">#${h.qid}</span>
            <span class="hist-topic">${h.topic || 'General'}</span>
            <span class="hist-time">${timeStr}</span>
          </div>
          ${detailHtml}
        </div>
        <div class="hist-arrow">›</div>
      `;
      historyList.appendChild(row);
    });
  }

  // 2. Render Weak Topics (Top Vulnerable Knowledge Points)
  if (weakList) {
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

    const sortedTopics = Object.values(topicStats)
      .filter(t => t.failed > 0)
      .map(t => ({
        ...t,
        errorRate: Math.round((t.failed / t.tested) * 100)
      }))
      .sort((a, b) => b.errorRate - a.errorRate || b.failed - a.failed)
      .slice(0, 5);

    if (sortedTopics.length === 0) {
      weakList.innerHTML = `
        <div style="color: var(--success); font-size: 0.9rem; text-align: center; padding: 20px;">
          🌟 表现极其优异！在最近的 ${total} 次做题中未检测到薄弱考点。
        </div>`;
    } else {
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
  }
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
  triggerHaptic('click');
  const qid = currentQuestion.id;
  if (!appState.bookmarkUpdatedAt) appState.bookmarkUpdatedAt = {};
  appState.bookmarkUpdatedAt[qid] = Date.now();
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
  const cur = parseInt(appState.retryInterval, 10) || 25;
  const lbl = document.getElementById('retryIntervalLabel');
  if (lbl) {
    lbl.textContent = cur === 25 ? '~25 Qs (Default ±35%)' : `~${cur} Qs (±35%)`;
  }
  document.querySelectorAll('.retry-pill').forEach(btn => {
    const v = parseInt(btn.dataset.val, 10);
    btn.classList.toggle('active', v === cur);
  });
}

function openSettingsModal() {
  syncRetryPillsUI();
  CloudSyncEngine.syncSettingsCardUI();
  const shufToggle = document.getElementById('shuffleOptionsToggle');
  if (shufToggle) {
    shufToggle.checked = (appState.shuffleOptions !== false);
  }
  const hideMastToggle = document.getElementById('hideMasteredToggle');
  if (hideMastToggle) {
    hideMastToggle.checked = Boolean(appState.hideMastered);
  }
  const excludeSimToggle = document.getElementById('excludeSimLabsToggle');
  if (excludeSimToggle) {
    excludeSimToggle.checked = Boolean(appState.excludeSimLabs);
  }
  const domSelect = document.getElementById('domainFilterSelect');
  if (domSelect) {
    domSelect.value = appState.domainFilter || '';
  }
  const bmBtn = document.getElementById('modeBtnBookmarks');
  if (bmBtn) {
    const bmCount = Object.values(appState.bookmarkedIds || {}).filter(Boolean).length;
    bmBtn.textContent = `⭐ Bookmarked (${bmCount})`;
  }
  const wkBtn = document.getElementById('modeBtnWeak');
  if (wkBtn) {
    const wkCount = allQuestions.filter(q => {
      const st = appState.cardStats && appState.cardStats[q.id];
      return appState.masteredIds[q.id] === false || (st && (st.box === 0 || st.box === 1));
    }).length;
    wkBtn.textContent = `📕 Wrong & Weak (${wkCount})`;
  }
  const hapticSlider = document.getElementById('hapticDurationSlider');
  const hapticLabel = document.getElementById('hapticDurationLabel');
  const curHaptic = (typeof appState.hapticDuration === 'number') ? appState.hapticDuration : 80;
  if (hapticSlider) {
    hapticSlider.value = curHaptic;
  }
  if (hapticLabel) {
    if (curHaptic === 0) hapticLabel.textContent = 'Off (关闭)';
    else if (curHaptic <= 35) hapticLabel.textContent = `${curHaptic}% (轻柔)`;
    else if (curHaptic <= 70) hapticLabel.textContent = `${curHaptic}% (微动)`;
    else if (curHaptic <= 85) hapticLabel.textContent = `${curHaptic}% (标准)`;
    else hapticLabel.textContent = `${curHaptic}% (强劲)`;
  }
  const modeBtns = {
    smart: document.getElementById('modeBtnSmart'),
    random: document.getElementById('modeBtnRandom'),
    weak: document.getElementById('modeBtnWeak'),
    bookmarks: document.getElementById('modeBtnBookmarks')
  };
  Object.keys(modeBtns).forEach(m => {
    const btn = modeBtns[m];
    if (!btn) return;
    if (appState.deckMode === m) {
      btn.style.borderColor = 'var(--primary)';
      btn.style.boxShadow = '0 0 0 2px var(--primary)';
    } else {
      btn.style.borderColor = (m === 'weak') ? 'var(--warning)' : 'var(--border-color)';
      btn.style.boxShadow = 'none';
    }
  });
  document.getElementById('settingsModal').classList.add('active');
}

function updateShuffleOptions(enabled) {
  appState.shuffleOptions = Boolean(enabled);
  saveState();
  renderCurrentCard();
  showToast(appState.shuffleOptions ? 'Option shuffling enabled (已开启乱序选项)' : 'Option shuffling disabled (已恢复固定顺序)');
}
window.updateShuffleOptions = updateShuffleOptions;

function updateHideMastered(enabled) {
  appState.hideMastered = Boolean(enabled);
  saveState();
  if (appState.deckMode === 'random') {
    switchDeckMode('random');
  } else if (appState.deckMode === 'weak') {
    switchDeckMode('weak');
  } else if (appState.deckMode === 'bookmarks') {
    switchDeckMode('bookmarks');
  } else if (appState.deckMode === 'domain') {
    filterByDomain(appState.domainFilter);
  } else {
    setupPracticeQueue(appState.drillTopic || null);
  }

  if (appState.hideMastered && Array.isArray(activeQueue)) {
    while (currentIndex < activeQueue.length && appState.masteredIds[activeQueue[currentIndex].id] === true) {
      currentIndex++;
    }
    if (currentIndex >= activeQueue.length) {
      setupPracticeQueue(appState.drillTopic || null);
    }
  }

  renderCurrentCard();
  updateHeaderStats();
  const t1 = document.getElementById('hideMasteredToggle');
  if (t1) t1.checked = appState.hideMastered;
  const t2 = document.getElementById('deckLogHideMasteredToggle');
  if (t2) t2.checked = appState.hideMastered;
  if (currentWeakView === 'decklog') {
    renderDeckLog();
  }
  showToast(appState.hideMastered ? '🎯 仅抽取未掌握题 (已完全排除Mastered)' : '🧠 智能抗遗忘模式 (含 5% Mastered抽检)');
}
window.updateHideMastered = updateHideMastered;

function updateExcludeSimLabs(enabled) {
  appState.excludeSimLabs = Boolean(enabled);
  saveState();
  if (appState.deckMode === 'smart' || !appState.drillTopic) {
    setupPracticeQueue(null);
  } else if (appState.deckMode === 'weak') {
    switchDeckMode('weak');
  } else if (appState.deckMode === 'bookmarks') {
    switchDeckMode('bookmarks');
  } else if (appState.deckMode === 'domain') {
    filterByDomain(appState.domainFilter);
  } else {
    setupPracticeQueue(null);
  }
  renderCurrentCard();
  updateHeaderStats();
  const count = appState.excludeSimLabs ? (allQuestions.length - 37) : allQuestions.length;
  showToast(appState.excludeSimLabs ? `🛠️ Skipped Lab Sims (已跳过实验题，题库共 ${count.toLocaleString()} 题)` : `🛠️ Included Lab Sims (已包含实验题，题库共 ${count.toLocaleString()} 题)`);
}
window.updateExcludeSimLabs = updateExcludeSimLabs;

function updateRetryInterval(val) {
  appState.retryInterval = parseInt(val, 10) || 25;
  syncRetryPillsUI();
  saveState();
  showToast(`🔁 Mistake cooldown set to ~${appState.retryInterval} questions (±35% random fuzz)`);
}
window.updateRetryInterval = updateRetryInterval;

function updateHapticDuration(val) {
  const num = parseInt(val, 10);
  appState.hapticDuration = isNaN(num) ? 80 : Math.max(0, Math.min(100, num));
  const hapticLabel = document.getElementById('hapticDurationLabel');
  if (hapticLabel) {
    if (appState.hapticDuration === 0) {
      hapticLabel.textContent = 'Off (关闭)';
    } else if (appState.hapticDuration <= 35) {
      hapticLabel.textContent = `${appState.hapticDuration}% (轻柔)`;
    } else if (appState.hapticDuration <= 70) {
      hapticLabel.textContent = `${appState.hapticDuration}% (微动)`;
    } else if (appState.hapticDuration <= 85) {
      hapticLabel.textContent = `${appState.hapticDuration}% (标准)`;
    } else {
      hapticLabel.textContent = `${appState.hapticDuration}% (强劲)`;
    }
  }
  // Real-time preview vibration as user drags (pure active-braked system haptic)
  if (appState.hapticDuration > 0) {
    triggerHaptic('click');
  }
  saveState();
}
window.updateHapticDuration = updateHapticDuration;

function testHapticFeedback() {
  const cur = (typeof appState.hapticDuration === 'number') ? appState.hapticDuration : 80;
  if (cur === 0) {
    showToast('触感震动已关闭 (0%)');
    return;
  }
  // Mechanical switch demo: Heavy press "Ka", followed by 50% release "Da"
  triggerHaptic('heavy');
  setTimeout(() => {
    triggerHaptic('click');
  }, 130);
}
window.testHapticFeedback = testHapticFeedback;

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
    if (val === 1210) {
      showToast('第 1210 题与第 1057 题完全重复，已自动跳转至 #1057');
      jumpToQuestion(1057);
      return;
    }
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
  appState.bookmarkUpdatedAt = {};
  appState.cardStats = {};
  appState.totalSteps = 0;
  appState.resetEpoch = Date.now();
  appState.history = [];
  appState.weakDiagnosed = {};
  SrsEngine.activeMistakeIds.clear();
  SrsEngine.consecutiveUnseenStreak = 0;
  localStorage.removeItem('ccna_session_snapshot_v1');
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

// Only invert near-neutral diagrams with a predominantly light background.
// Color is significant in many exhibits, so colored images remain unchanged.
function setDiagramImage(img, src) {
  img.classList.remove('monochrome-exhibit');
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      const width = img.naturalWidth, height = img.naturalHeight;
      // Preserve very large images when a full-resolution check would be costly.
      if (!width || !height || width * height > 4000000) return;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, width, height).data;
      let light = 0, visible = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 250) return;
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        if (Math.max(r, g, b) - Math.min(r, g, b) > 8) return;
        visible++;
        if (Math.min(r, g, b) >= 220) light++;
      }
      img.classList.toggle('monochrome-exhibit', visible > 0 && light / visible > 0.55);
    } catch (_) {
      // Keep the original image if pixel inspection is unavailable.
    }
  };
  img.src = src;
}

function openLightbox(src) {
  const img = document.getElementById('lightboxImg');
  setDiagramImage(img, src);
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

function triggerHaptic(type = 'click') {
  if (type === true) type = 'success';
  if (type === false) type = 'error';

  const intensity = (appState && typeof appState.hapticDuration === 'number')
    ? appState.hapticDuration
    : 80;

  if (intensity <= 0) return; // 0% = Disabled

  // Compute scale from 0.05 to 1.0
  const scale = Math.max(0.05, Math.min(1.0, intensity / 100.0));

  if (window.AndroidBridge) {
    try {
      if (type === 'tick' && typeof window.AndroidBridge.vibrateNativeTick === 'function') {
        window.AndroidBridge.vibrateNativeTick(scale);
        return;
      }
      if (type === 'heavy' && typeof window.AndroidBridge.vibrateNativeHeavy === 'function') {
        window.AndroidBridge.vibrateNativeHeavy(scale);
        return;
      }
      if (type === 'success' && typeof window.AndroidBridge.vibrateNativeSuccess === 'function') {
        window.AndroidBridge.vibrateNativeSuccess(scale);
        return;
      }
      if (type === 'error' && typeof window.AndroidBridge.vibrateNativeError === 'function') {
        window.AndroidBridge.vibrateNativeError(scale);
        return;
      }
      if (typeof window.AndroidBridge.vibrateNativeClick === 'function') {
        window.AndroidBridge.vibrateNativeClick(scale);
        return;
      }
      // Fallback for older AndroidBridge bindings
      if (typeof window.AndroidBridge.vibrateClick === 'function') {
        window.AndroidBridge.vibrateClick();
        return;
      }
    } catch (_) {}
  }

  if (navigator.vibrate) {
    try {
      const browserMs = Math.max(8, Math.round(intensity * 0.18));
      if (type === 'success') {
        navigator.vibrate([browserMs, 40, Math.round(browserMs * 1.2)]);
      } else if (type === 'error') {
        navigator.vibrate([Math.round(browserMs * 1.2), 40, browserMs]);
      } else if (type === 'heavy') {
        navigator.vibrate([browserMs, 30, browserMs]);
      } else if (type === 'tick') {
        navigator.vibrate(Math.max(5, Math.round(browserMs * 0.6)));
      } else {
        navigator.vibrate(browserMs);
      }
    } catch (_) {}
  }
}
window.triggerHaptic = triggerHaptic;

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
  return false;
};
