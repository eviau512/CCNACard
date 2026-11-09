# CCNA Question Bank & Grading Engine Quality Standards (AGENTS.md)

This document establishes immutable engineering rules and quality standards for all coding agents and subagents working in this repository (`d:\Download\CCNA`).
These rules were formulated following a comprehensive audit of all 154 Drag-and-Drop (DND) questions (Q1043 – Q1234) and are strictly enforced to prevent regressions.

---

## 1. Drag-and-Drop (DND) Taxonomy & Unordered Group Logic

The web interactive app (`app.js`, `evaluateDndBoard`) evaluates user submissions using `unordered_group` matching:
- If a target slot defines `unordered_group: "group_name"`, the user's placed item matches ANY remaining expected item belonging to that group, regardless of slot index.
- If a target slot has `unordered_group: null`, the slot requires a strict 1-to-1 match against `target.expected`.

### The 4 Technical Question Types:

| Type | Classification | Rule for `unordered_group` | Cisco Technical Principle & Examples |
| :--- | :--- | :--- | :--- |
| **Type A** | **Strictly Sequential / Ranked** | **MUST be `null`** | Enforces chronological steps or mathematical ranking: <br>• **Q1054**: Administrative Distance from lowest to highest (0→1→20→90→110→120).<br>• **Q1107**: Standard DNS lookup resolution steps (Step 1 to Step 5).<br>• **Q1068**: Cisco IOS CLI mode transitions (`enable` → `configure terminal` → `enable secret ...` → `exit`). |
| **Type B** | **Strict 1-to-1 Concept Matching** | **MUST be `null`** | Distinct semantic concepts where swapping is technically incorrect: <br>• Unique definitions (e.g. Q1043 broadcast IP vs default gateway; Q1082 REST HTTP verbs).<br>• Interface-specific commands (e.g. Q1228 IP address configured on `DC-1 - Gi1/0` vs `Gi1/1`). |
| **Type C** | **Multi-Slot Category Buckets** | **ALL slots in category MUST have identical `unordered_group`** | When multiple items belong to the same category/bucket, the student MUST NOT be penalized for placing valid items into arbitrary slots of that category: <br>• Examples: Cable media (Copper vs SMF), IPv6 address scopes (Global Unicast vs Link-Local), AAA features (Accounting vs Authorization).<br>• **CRITICAL DEFECT PREVENTION**: Never assign `unordered_group` to only a subset of slots in a category! Every slot belonging to category $X$ MUST have `unordered_group: X`. |
| **Type D** | **Commutative CLI Configuration Blocks** | **ALL commands in the block MUST share `unordered_group`** | In Cisco IOS interface or global configuration mode, entering configuration statements of the same feature or block has identical running-config results regardless of execution order: <br>• **Q1069**: Interface port security commands (`switchport port-security`, `maximum 2`, `violation shutdown`, `mac-address sticky`). All 4 commands are configuration statements entered on the interface; entering `maximum 2` before `switchport port-security` or vice versa is 100% valid in Cisco IOS CLI. All 4 slots MUST share `unordered_group: 'port_security'`.<br>• **Q1060**: Static NAT statements (`ethernet0`, `serial0`, `global`). Commutative commands within each mode. |

---

## 2. Root Cause Analysis: Why Previous Audits Failed

1. **Naive Regex Dependency (`inspect_unordered_dnd.py`)**:
   - Previous scripts only looked for literal strings matching `r'^(.*?)\s*\(Slot\s*\d+\)$'`.
   - If target labels were numbers (`1`, `2`, `3`, `4` like Q1069) or interface positions (`position A`, `position B` like Q1060), the script assumed they were "strict 1-to-1" and skipped them.
2. **Partial Tagging Defects**:
   - In Q1069, someone set `unordered_group: 'port_security_settings'` on slots 2, 3, 4, but left slot 1 as `null`. When a user dropped `switchport port-security` into slot 4 and `maximum 2` into slot 1, the engine falsely marked BOTH slots as incorrect.
3. **Loss of High-Fidelity Content**:
   - Superficial scrapers replaced Exhibit-faithful prompts with generic text (`Refer to the exhibit. Drag and drop the network elements...`) and truncated Markdown tables.

---

## 3. Permanent Prevention Guidelines & Verification Protocol

Whenever updating, auditing, or adding questions to the question bank, every agent MUST follow this protocol:

1. **Multi-File Synchronization Invariant**:
   Any change to questions MUST simultaneously update:
   - `Examtopics/output/complete_q1_q1396.json` (Master source)
   - `CCNA-App/app/src/main/assets/data/ccna_cards_data.js` (Mobile app bundle)
   - `Examtopics/batch/batch6_q1001_q1200.json` or `batch7_q1201_q1396.json` (Batch storage)
   - `Examtopics/output/CCNA_Interactive_App.html` (Via `python Examtopics/scripts/build_browser_app.py`)
2. **Automated Permutation Verification**:
   Before committing, run:
   ```powershell
   python Examtopics/scratch/test_all_154_dnd_permutations.py
   python Examtopics/scratch/test_v130_adaptive_and_sync.py
   ```
   Both canonical order and arbitrary intra-group permutations MUST achieve 100% pass rate.
3. **Zero Tolerance for Partial Category Groups**:
   If a category has $N \ge 2$ target slots, either all $N$ slots have the exact same `unordered_group`, or the question is an explicit numbered sequence (Type A). Never allow $N-1$ slots to be grouped while 1 slot is left `null`.
4. **Android Build & Installation**:
   Always build with `python CCNA-App/build_apk.py` and install using `--user 0`:
   ```powershell
   adb -s <device_id> install -r --user 0 "Examtopics/output/CCNA.apk"
   ```
