import json
import os
import re
import glob
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_merge_and_validate():
    enrich_dir = 'Examtopics/enrichment'
    output_files = sorted(glob.glob(os.path.join(enrich_dir, 'chunk_*_output.json')))
    print(f"Found {len(output_files)} chunk output files.")

    merged_explanations = {}
    validation_failures = []

    banned_phrases = [
        'matches the required operational state',
        'Distractor Evaluation: The remaining options',
        'Exhibit Analysis: Based on the exhibit topology and configuration parameters'
    ]

    for fpath in output_files:
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            exps = data.get('explanations', {})
            chunk_id = data.get('chunk_id', os.path.basename(fpath))
            print(f"Processing {chunk_id}: {len(exps)} explanations...")
            for qid_str, exp in exps.items():
                qid = int(qid_str)
                # Validation checks
                if len(exp) < 100:
                    validation_failures.append((qid, f"Explanation too short ({len(exp)} chars)"))
                    continue
                has_banned = False
                for bp in banned_phrases:
                    if bp in exp:
                        validation_failures.append((qid, f"Contains banned boilerplate: '{bp}'"))
                        has_banned = True
                        break
                if has_banned:
                    continue

                merged_explanations[qid] = exp
        except Exception as e:
            print(f"Error reading {fpath}: {e}")

    print(f"Total valid enriched explanations collected: {len(merged_explanations)}")
    if validation_failures:
        print(f"Validation failures ({len(validation_failures)}):")
        for qid, reason in validation_failures[:10]:
            print(f"  Q#{qid}: {reason}")

    if not merged_explanations:
        print("No new explanations to merge yet.")
        return 0

    # 1. Update batch files
    batch_files = glob.glob('Examtopics/batch/batch*.json')
    updated_in_batches = 0
    for bf in batch_files:
        with open(bf, 'r', encoding='utf-8') as f:
            bdata = json.load(f)
        b_changed = False
        for q in bdata:
            if q['id'] in merged_explanations:
                q['explanation'] = merged_explanations[q['id']]
                b_changed = True
                updated_in_batches += 1
        if b_changed:
            with open(bf, 'w', encoding='utf-8') as f:
                json.dump(bdata, f, ensure_ascii=False, indent=2)

    print(f"Updated {updated_in_batches} entries across batch files.")

    # 2. Update complete_q1_q1396.json
    comp_path = 'Examtopics/output/complete_q1_q1396.json'
    if os.path.exists(comp_path):
        with open(comp_path, 'r', encoding='utf-8') as f:
            comp_data = json.load(f)
        for q in comp_data:
            if q['id'] in merged_explanations:
                q['explanation'] = merged_explanations[q['id']]
        with open(comp_path, 'w', encoding='utf-8') as f:
            json.dump(comp_data, f, ensure_ascii=False, indent=2)
        print("Updated complete_q1_q1396.json.")

    # 3. Update ccna_cards_data.js
    js_path = 'CCNA-App/app/src/main/assets/data/ccna_cards_data.js'
    if os.path.exists(js_path):
        with open(js_path, 'r', encoding='utf-8') as f:
            raw_js = f.read()
        json_str = re.sub(r'^\s*window\.CCNA_QUESTIONS_DATA\s*=\s*', '', raw_js.strip())
        if json_str.endswith(';'):
            json_str = json_str[:-1]
        cards = json.loads(json_str)
        for q in cards:
            if q.get('id') in merged_explanations:
                q['explanation'] = merged_explanations[q['id']]
        with open(js_path, 'w', encoding='utf-8') as f:
            f.write('window.CCNA_QUESTIONS_DATA = ' + json.dumps(cards, ensure_ascii=False) + ';')
        print("Updated ccna_cards_data.js.")

    # 4. Update progress stats
    progress_file = 'Examtopics/explanation_progress.json'
    with open(js_path, 'r', encoding='utf-8') as f:
        raw_js = f.read()
    json_str = re.sub(r'^\s*window\.CCNA_QUESTIONS_DATA\s*=\s*', '', raw_js.strip())
    if json_str.endswith(';'):
        json_str = json_str[:-1]
    cards = json.loads(json_str)
    
    generic_count = 0
    detailed_count = 0
    for q in cards:
        exp = q.get('explanation', '')
        if any(bp in exp for bp in banned_phrases):
            generic_count += 1
        else:
            detailed_count += 1

    progress = {
        'total_questions': len(cards),
        'detailed_count': detailed_count,
        'generic_count': generic_count,
        'percent_complete': round(detailed_count / len(cards) * 100, 2),
        'enriched_keys': list(merged_explanations.keys())
    }
    with open(progress_file, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)

    print(f"\n==================================================")
    print(f"📊 Progress: {detailed_count}/{len(cards)} ({progress['percent_complete']}%) detailed explanations!")
    print(f"   Remaining generic: {generic_count}")
    print(f"==================================================")
    return len(merged_explanations)

if __name__ == '__main__':
    run_merge_and_validate()
