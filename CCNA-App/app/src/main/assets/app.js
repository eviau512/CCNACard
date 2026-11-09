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
  cardStats: {},            // qid -> { box: 0..3, streak, lapses, attempts, everWrong, lastSeenStep, nextDueStep, lastReviewedAt }
  totalSteps: 0,            // monotonic global question step counter
  history: [],              // array of { qid, domain, topic, misconception, correct, isIdk, time }
  retryInterval: 25,        // default ~25 questions cooldown (with ±35% random fuzz) to prevent déjà vu
  retryDefaultMigratedV2: true,
  antiDejaVuMigratedV3: true,
  shuffleOptions: true,     // default true: randomize option order (需要乱序选项)
  hideMastered: false,      // optional: completely exclude mastered cards
  deckMode: 'smart',        // 'smart' | 'weak' | 'bookmarks' | 'domain' | 'topic' | 'type'
  domainFilter: '',         // active CCNA domain filter if any
  drillTopic: null          // active topic/mode drill label if any
};

let currentWindow = 50; // 50 / 200 / 500
let questionById = {};  // fast O(1) lookup map: qid -> question object

// =========================================================================
// 1. SRS & Leitner Memory Engine (SrsEngine)
// =========================================================================
const SrsEngine = {
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

  migrateFromLegacyState() {
    if (!appState.cardStats) appState.cardStats = {};
    if (typeof appState.totalSteps !== 'number') {
      appState.totalSteps = (appState.history && appState.history.length) || 0;
    }
    // Replay history if cardStats was empty
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
    // Sync masteredIds keys
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
  },

  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  applyFuzz(baseInterval, ratio = 0.35) {
    const spread = Math.max(3, Math.round(baseInterval * ratio));
    return Math.max(6, baseInterval + this.randomInt(-spread, spread));
  },

  getCooldownSteps() {
    const base = parseInt(appState.retryInterval, 10) || 25;
    return Math.max(12, Math.floor(base * 0.75));
  },

  isRecentlySeen(qid, customMinSteps = null, minMinutes = 8) {
    const st = appState.cardStats && appState.cardStats[qid];
    if (!st || !st.lastSeenStep) return false;
    const stepNow = appState.totalSteps || 0;
    const minSteps = customMinSteps !== null ? customMinSteps : this.getCooldownSteps();
    const stepsAgo = stepNow - st.lastSeenStep;
    const minsAgo = st.lastReviewedAt ? ((Date.now() - st.lastReviewedAt) / 60000) : 999;
    return (stepsAgo >= 0 && stepsAgo < minSteps) || (minsAgo >= 0 && minsAgo < minMinutes);
  },

  pickHistoricalMistakeForReview(excludeQid) {
    if (!Array.isArray(allQuestions) || allQuestions.length === 0) return null;
    const upcomingIds = new Set(
      (activeQueue || []).slice(currentIndex, currentIndex + 22).map(item => item && item.id)
    );
    upcomingIds.add(excludeQid);

    const candidates = [];
    for (let i = 0; i < allQuestions.length; i++) {
      const q = allQuestions[i];
      if (!q || upcomingIds.has(q.id)) continue;
      if (appState.domainFilter && q.domain !== appState.domainFilter) continue;
      const st = appState.cardStats && appState.cardStats[q.id];
      const isMistake = (appState.masteredIds[q.id] === false) || (st && (st.box === 0 || st.box === 1));
      if (!isMistake) continue;
      if (!this.isRecentlySeen(q.id)) {
        candidates.push(q);
      }
    }
    if (candidates.length === 0) return null;
    const shuffled = shuffle(candidates);
    return shuffled[0];
  },

  recordOutcome(question, isCorrect, isIdk) {
    const qid = question.id;
    appState.totalSteps = (appState.totalSteps || 0) + 1;
    const st = this.ensureStat(qid);
    st.attempts++;
    st.lastSeenStep = appState.totalSteps;
    st.lastReviewedAt = Date.now();

    const baseInterval = Math.max(12, parseInt(appState.retryInterval, 10) || 25);

    if (!isCorrect || isIdk) {
      st.everWrong = true;
      st.lapses++;
      st.streak = 0;
      st.box = 0;
      appState.masteredIds[qid] = false;

      // Push the just-missed card far enough ahead (with ±35% random fuzz) to prevent short-term déjà vu
      const rawCooldown = st.lapses >= 3 ? Math.max(14, Math.floor(baseInterval * 0.8)) : baseInterval;
      const stepInterval = this.applyFuzz(rawCooldown, 0.35);
      st.nextDueStep = appState.totalSteps + stepInterval;
      this.scheduleInActiveQueue(question, stepInterval, 1);

      // Also pull a random OLDER mistake (not seen recently) into a medium randomized slot if available
      const olderMistake = this.pickHistoricalMistakeForReview(qid);
      if (olderMistake) {
        const olderSt = this.ensureStat(olderMistake.id);
        const olderStage = olderSt.box === 1 ? 2 : 1;
        const olderGap = this.randomInt(7, 15);
        this.scheduleInActiveQueue(olderMistake, olderGap, olderStage, true);
      }

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
      // First-sight correct -> Box 3 (Mastered immediately)
      st.box = 3;
      appState.masteredIds[qid] = true;
      st.nextDueStep = appState.totalSteps + this.applyFuzz(240, 0.25);
      return { status: 'mastered_first', box: 3, interval: 240 };
    }

    if (st.streak === 1) {
      // Missed previously, passed Stage 1 -> Box 1 (Consolidating 1/2) with stretched fuzzed spacing
      st.box = 1;
      appState.masteredIds[qid] = false;
      const consolidationInterval = this.applyFuzz(Math.round(baseInterval * 2.4) + 10, 0.35);
      st.nextDueStep = appState.totalSteps + consolidationInterval;
      this.scheduleInActiveQueue(question, consolidationInterval, 2);
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
    const longInterval = this.applyFuzz(st.streak >= 3 ? 320 : 140, 0.25);
    st.nextDueStep = appState.totalSteps + longInterval;
    return {
      status: 'graduated',
      box: st.box,
      interval: longInterval,
      streak: st.streak
    };
  },

  scheduleInActiveQueue(question, interval, stage, isOlderRotation = false) {
    // Remove any existing future retry copy of the same question beyond currentIndex to avoid duplicates
    for (let i = activeQueue.length - 1; i > currentIndex; i--) {
      if (activeQueue[i].id === question.id && activeQueue[i].isRetry) {
        activeQueue.splice(i, 1);
      }
    }
    const insertIndex = Math.min(activeQueue.length, currentIndex + interval);
    const retryCard = { ...question, isRetry: true, retryStage: stage };
    activeQueue.splice(insertIndex, 0, retryCard);

    if (!isOlderRotation) {
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
// 2. Smart Weighted Deck Scheduler & Session Persistence (DeckScheduler)
// =========================================================================
const DeckScheduler = {
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
    const weakTopics = this.getWeakTopicsSet();
    const stepNow = appState.totalSteps || 0;

    const olderDue = [];
    const recentDue = [];
    const weakUnseen = [];
    const normalUnseen = [];
    const masteredPool = [];

    pool.forEach(q => {
      const st = appState.cardStats && appState.cardStats[q.id];
      const isMastered = appState.masteredIds[q.id] === true;
      const isFailedOrConsolidating = (appState.masteredIds[q.id] === false) || (st && (st.box === 0 || st.box === 1));

      if (isFailedOrConsolidating) {
        const retryCard = {
          ...q,
          isRetry: true,
          retryStage: (st && st.box === 1) ? 2 : 1,
          _lastSeenStep: (st && st.lastSeenStep) ? st.lastSeenStep : 0,
          _lastReviewedAt: (st && st.lastReviewedAt) ? st.lastReviewedAt : 0
        };
        if (SrsEngine.isRecentlySeen(q.id)) {
          recentDue.push(retryCard);
        } else {
          olderDue.push(retryCard);
        }
      } else if (isMastered) {
        if (!appState.hideMastered) {
          masteredPool.push(q);
        }
      } else {
        // Unseen card
        if (weakTopics.has(q.topic)) {
          weakUnseen.push(q);
        } else {
          normalUnseen.push(q);
        }
      }
    });

    // 1. Randomly shuffle older historical mistakes so review order is never rigid or predictable
    const shufOlderDue = shuffle(olderDue);
    // 2. Sort recently seen mistakes from least-recently-seen to most-recently-seen
    //    so a card missed 1 minute ago is always pushed to the very end
    recentDue.sort((a, b) => (a._lastSeenStep - b._lastSeenStep) || (a._lastReviewedAt - b._lastReviewedAt));

    const shufWeakUnseen = shuffle(weakUnseen).map(q => ({ ...q, isRetry: false }));
    const shufNormalUnseen = shuffle(normalUnseen).map(q => ({ ...q, isRetry: false }));
    const shufMastered = shuffle(masteredPool).map(q => ({ ...q, isRetry: false }));

    // Combine unseen with randomized weak-topic boost (1 weak-topic card every 2~4 normal unseen cards)
    const unseenCombined = [];
    let wi = 0, ni = 0;
    while (wi < shufWeakUnseen.length || ni < shufNormalUnseen.length) {
      if (wi < shufWeakUnseen.length) unseenCombined.push(shufWeakUnseen[wi++]);
      const normalBurst = SrsEngine.randomInt(2, 4);
      for (let k = 0; k < normalBurst && ni < shufNormalUnseen.length; k++) {
        unseenCombined.push(shufNormalUnseen[ni++]);
      }
    }

    // Pure Mistake Review Mode (e.g. Wrong & Weak Pool where unseenCombined is empty):
    // Return randomized older mistakes first, and keep recently missed cards at the very back!
    if (unseenCombined.length === 0 && (shufOlderDue.length > 0 || recentDue.length > 0)) {
      return shufOlderDue.concat(recentDue);
    }

    // Smart Adaptive Mode: Dynamic randomized spacing between mistake reviews (no fixed frequency!)
    const result = [];
    let di = 0, ri = 0, ui = 0, mi = 0;
    const maxSprinkledMastered = Math.max(5, Math.floor(unseenCombined.length * 0.05));

    // Warm-up with 3~7 unseen cards at the start of the queue before the first historical mistake
    const initialWarmup = SrsEngine.randomInt(3, 7);
    for (let k = 0; k < initialWarmup && ui < unseenCombined.length; k++) {
      result.push(unseenCombined[ui++]);
    }

    let nextMasteredAt = result.length + SrsEngine.randomInt(16, 28);

    while (di < shufOlderDue.length || ui < unseenCombined.length) {
      if (di < shufOlderDue.length) {
        result.push(shufOlderDue[di++]);
      }
      // Dynamic stretched gap: 5 to 12 unseen cards between historical mistake reviews
      const unseenGap = SrsEngine.randomInt(5, 12);
      for (let k = 0; k < unseenGap && ui < unseenCombined.length; k++) {
        result.push(unseenCombined[ui++]);
        if (result.length >= nextMasteredAt && mi < Math.min(shufMastered.length, maxSprinkledMastered)) {
          result.push(shufMastered[mi++]);
          nextMasteredAt = result.length + SrsEngine.randomInt(16, 28);
        }
      }
      if (ui >= unseenCombined.length && di < shufOlderDue.length) {
        // Unseen cards exhausted; append remaining older due cards
        while (di < shufOlderDue.length) {
          result.push(shufOlderDue[di++]);
        }
      }
    }

    // Place recently-missed cooldown cards far down the queue (at the tail)
    while (ri < recentDue.length) {
      result.push(recentDue[ri++]);
    }

    // Append remaining mastered cards at the end if unseen/due are exhausted
    while (mi < shufMastered.length) {
      result.push(shufMastered[mi++]);
    }

    // Fallback if hideMastered hid everything and no unseen/due left
    if (result.length === 0 && pool.length > 0) {
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
          restored.push({
            ...baseQ,
            isRetry: Boolean(e.r),
            retryStage: e.s || (e.r ? 1 : 0)
          });
        }
      });
      if (restored.length === 0) return false;
      // Append remaining smart cards after the snapshot window so the queue never runs dry prematurely
      const inSnap = new Set(restored.map(q => q.id));
      const tailPool = allQuestions.filter(q => !inSnap.has(q.id));
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

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  loadStoredState();
  initTheme();
  initLightboxGestures();
  await loadQuestionData();
  SrsEngine.migrateFromLegacyState();
  if (!DeckScheduler.restoreSessionSnapshot()) {
    setupPracticeQueue(appState.drillTopic);
  }
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
      if (!parsed.antiDejaVuMigratedV3) {
        if (!parsed.retryInterval || parsed.retryInterval < 15) {
          parsed.retryInterval = 25;
        }
        parsed.antiDejaVuMigratedV3 = true;
      }
      appState = Object.assign(appState, parsed);
    }
  } catch (e) {
    console.error('Failed to load state from localStorage', e);
  }
}

function saveState() {
  try {
    // Keep max 1000 history items to bound storage while supporting 500-window diagnostics
    if (appState.history.length > 1000) {
      appState.history = appState.history.slice(-1000);
    }
    localStorage.setItem('ccna_app_state_v1', JSON.stringify(appState));
    DeckScheduler.saveSessionSnapshot();
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
  if (filterTopic) {
    const matched = allQuestions.filter(q => q.topic === filterTopic || q.domain === filterTopic);
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
    const bIds = Object.keys(appState.bookmarkedIds || {}).filter(k => appState.bookmarkedIds[k]);
    const pool = allQuestions.filter(q => appState.bookmarkedIds[q.id]);
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
    const pool = allQuestions.filter(q => {
      const st = appState.cardStats && appState.cardStats[q.id];
      return appState.masteredIds[q.id] === false || (st && (st.box === 0 || st.box === 1 || (st.everWrong && !appState.masteredIds[q.id])));
    });
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
  const pool = allQuestions.filter(q => q.domain === domainName);
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

  // 4. LaTeX & Math parsing
  function renderLatex(tex) {
    let t = tex.trim();
    // Symbol replacements
    t = t.replace(/\\rightarrow/g, '→').replace(/\\to/g, '→')
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
  
  const srsBadge = document.getElementById('cardSrsBadge');
  const cardStat = (appState.cardStats && appState.cardStats[currentQuestion.id]) || null;

  if (currentQuestion.isRetry) {
    retryBadge.style.display = 'inline-block';
    retryBadge.textContent = currentQuestion.retryStage === 2 ? '🌱 Consolidate (2/2)' : '🔁 Reinforce (1/2)';
  } else {
    retryBadge.style.display = 'none';
  }

  if (srsBadge) {
    srsBadge.className = 'badge badge-srs';
    if (cardStat && cardStat.lapses >= 3 && !appState.masteredIds[currentQuestion.id]) {
      srsBadge.style.display = 'inline-block';
      srsBadge.classList.add('srs-leech');
      srsBadge.textContent = `🔥 Leech (${cardStat.lapses}x missed)`;
    } else if (cardStat && cardStat.box === 1) {
      srsBadge.style.display = 'inline-block';
      srsBadge.classList.add('srs-learning');
      srsBadge.textContent = '🌱 Step 1/2 Passed';
    } else if (appState.masteredIds[currentQuestion.id] === true) {
      srsBadge.style.display = 'inline-block';
      srsBadge.classList.add('srs-mastered');
      srsBadge.textContent = '✓ Mastered';
    } else {
      srsBadge.style.display = 'none';
    }
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

  // Show explanation
  showExplanation(isCorrect, misconceptionMsg);

  // Switch button to Next
  const actionBtn = document.getElementById('actionBtn');
  actionBtn.textContent = 'Next Question →';
  actionBtn.className = 'btn btn-next';

  updateHeaderStats();
  saveState();
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
  updateHeaderStats();
  saveState();
  advanceToNextCard();
}
window.submitLabSelfEval = submitLabSelfEval;

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

  // Log as IDK attempt & schedule via SrsEngine
  const idkMsg = currentQuestion.idk_tag || `${currentQuestion.topic} (Unmastered Knowledge Point)`;
  logAttempt(false, true, idkMsg);
  const srsRes = SrsEngine.recordOutcome(currentQuestion, false, true);
  showToast(`Recorded as weak point. Will reappear in ${srsRes.interval} Qs.`);

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
  const shufToggle = document.getElementById('shuffleOptionsToggle');
  if (shufToggle) {
    shufToggle.checked = (appState.shuffleOptions !== false);
  }
  const hideMastToggle = document.getElementById('hideMasteredToggle');
  if (hideMastToggle) {
    hideMastToggle.checked = Boolean(appState.hideMastered);
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
  setupPracticeQueue(null);
  renderCurrentCard();
  updateHeaderStats();
  showToast(appState.hideMastered ? '🎯 Hiding mastered cards (仅抽取未掌握题)' : '🧠 Including 5% mastered review (智能抗遗忘抽检)');
}
window.updateHideMastered = updateHideMastered;

function updateRetryInterval(val) {
  appState.retryInterval = parseInt(val, 10) || 25;
  syncRetryPillsUI();
  saveState();
  showToast(`🔁 Mistake cooldown set to ~${appState.retryInterval} questions (±35% random fuzz)`);
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
  appState.cardStats = {};
  appState.totalSteps = 0;
  appState.history = [];
  appState.weakDiagnosed = {};
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
  return false;
};
