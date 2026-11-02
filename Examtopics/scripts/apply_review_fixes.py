"""Apply fingerprinted review corrections to the master, batches and App bundle.

The correction manifests contain manual decisions. This does not infer answers or
rewrite questions from audit keywords, and never touches saved practice records.
"""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MASTER = ROOT / 'Examtopics/output/complete_q1_q1396.json'
BUNDLE = ROOT / 'CCNA-App/app/src/main/assets/data/ccna_cards_data.js'


def fingerprint(question):
    raw = json.dumps(question, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def apply(manifest_path):
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    bundle_text = BUNDLE.read_text(encoding='utf-8')
    prefix = bundle_text[:bundle_text.index('[')]
    bundled = json.loads(bundle_text[len(prefix):].strip().rstrip(';'))
    questions = json.loads(MASTER.read_text(encoding='utf-8')) if MASTER.exists() else bundled
    assert questions == bundled, 'Master/App mismatch: resolve before applying corrections'
    by_id = {q['id']: q for q in questions}
    assert len(by_id) == len(questions) == 1396
    changed = []
    for correction in manifest['corrections']:
        question = by_id[correction['id']]
        updates = correction['updates']
        assert set(updates) <= {'prompt', 'options', 'answer', 'explanation', 'image', 'answer_image', 'type'}
        if all(question.get(key) == value for key, value in updates.items()):
            continue
        accepted = [correction['before_sha256']] + correction.get('accepted_intermediate_sha256', [])
        assert fingerprint(question) in accepted, f"Q{question['id']} changed since review"
        question.update(updates)
        labels = [option['label'] for option in question['options']]
        assert len(labels) == len(set(labels))
        assert set(question['answer']) <= set(labels)
        assert question['explanation'].strip()
        changed.append(question['id'])
    MASTER.parent.mkdir(exist_ok=True)
    MASTER.write_text(json.dumps(questions, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    BUNDLE.write_text(prefix + json.dumps(questions, ensure_ascii=False) + ';\n', encoding='utf-8')
    fixed_ids = {item['id'] for item in manifest['corrections']}
    for batch in sorted((ROOT / 'Examtopics/batch').glob('batch*_q*.json')):
        data = json.loads(batch.read_text(encoding='utf-8'))
        updated = [by_id[q['id']] if q['id'] in fixed_ids else q for q in data]
        if updated != data:
            batch.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    result = {
        'manifest': manifest_path.name,
        'applied_ids': changed,
        'corrected_question_sha256': {str(n): fingerprint(by_id[n]) for n in sorted(fixed_ids)},
        'source_sha256': hashlib.sha256(MASTER.read_bytes()).hexdigest(),
        'app_bundle_sha256': hashlib.sha256(BUNDLE.read_bytes()).hexdigest(),
    }
    receipt = manifest_path.with_name(manifest_path.stem + '-receipt.json')
    receipt.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Applied {len(changed)} corrections; IDs and question count preserved.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('manifest', type=Path)
    args = parser.parse_args()
    apply(args.manifest)
