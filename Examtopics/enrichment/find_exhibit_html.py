import re

html_path = 'Examtopics/output/Examtopics_CCNA_200-301_Complete.html'
with open(html_path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

for qid in ['532', '557']:
    pattern = rf'(Question\s*#?:?\s*{qid}\b.*?)(?=Question\s*#?:?\s*\d|\Z)'
    match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
    if match:
        print(f"=== Question {qid} ===")
        print(match.group(1)[:2000])
    else:
        print(f"Question {qid} not found directly with regex")
