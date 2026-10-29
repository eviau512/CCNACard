import json, glob, os, re, sys
sys.stdout.reconfigure(encoding='utf-8')

# 1. Load all dnd_parsed_*.json files
dnd_master = {}
for p in sorted(glob.glob('Examtopics/scratch/dnd_parsed_*.json')):
    data = json.load(open(p, encoding='utf-8'))
    print(f"Loaded {p}: {len(data)} items")
    for k, v in data.items():
        qid = int(str(k).replace('Q', '').replace('#', '').strip())
        # Validate sources and targets
        sources = [str(s).strip() for s in v.get('sources', []) if str(s).strip()]
        targets = []
        for idx, t in enumerate(v.get('targets', [])):
            tid = t.get('id') or f"t{idx+1}"
            lbl = str(t.get('label', f"Target {idx+1}")).strip()
            exp = str(t.get('expected', '')).strip()
            ug = t.get('unordered_group')
            # Ensure expected is in sources (if slight typo, match closest or append)
            if exp and exp not in sources:
                # Try case-insensitive match
                m = next((s for s in sources if s.lower() == exp.lower()), None)
                if m:
                    exp = m
                else:
                    sources.append(exp)
            t_obj = {'id': tid, 'label': lbl, 'expected': exp}
            if ug:
                t_obj['unordered_group'] = str(ug).strip()
            targets.append(t_obj)
        dnd_master[qid] = {'sources': sources, 'targets': targets}

print(f"Total merged D&D items: {len(dnd_master)}")
json.dump(dnd_master, open('Examtopics/scratch/dnd_master_154.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

# 2. Inject into ccna_cards_data.js
js_path = 'CCNA-App/app/src/main/assets/data/ccna_cards_data.js'
raw = open(js_path, encoding='utf-8').read()
body = re.sub(r'^\s*window\.CCNA_QUESTIONS_DATA\s*=\s*', '', raw.strip()).rstrip(';')
cards = json.loads(body)

injected = 0
missing = []
for c in cards:
    if c.get('type') == 'Drag and Drop':
        if c['id'] in dnd_master:
            c['drag_drop_data'] = dnd_master[c['id']]
            injected += 1
        else:
            missing.append(c['id'])

print(f"Injected drag_drop_data into {injected} / 154 Drag and Drop cards! Missing: {missing}")

open(js_path, 'w', encoding='utf-8').write('window.CCNA_QUESTIONS_DATA = ' + json.dumps(cards, ensure_ascii=False) + ';')

# 3. Also sync drag_drop_data into batch JSONs and complete_q1_q1396.json
for p in glob.glob('Examtopics/batch/batch*.json') + ['Examtopics/output/complete_q1_q1396.json']:
    if not os.path.exists(p): continue
    data = json.load(open(p, encoding='utf-8'))
    for q in data:
        if q['id'] in dnd_master:
            q['drag_drop_data'] = dnd_master[q['id']]
    json.dump(data, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
