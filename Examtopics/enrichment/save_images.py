import re
import json
import base64
import os

with open('Examtopics/batch/Examtopics_Batch2_Q201-400.html', 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

start = html.find('[{"id": 201')
if start == -1:
    start = html.find('[{"id":201')
end = html.rfind('}]') + 2

raw_json = html[start:end]
questions = json.loads(raw_json)
qmap = {q['id']: q for q in questions}

chunk_ids = [232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255, 256, 257]

os.makedirs('Examtopics/enrichment/images', exist_ok=True)

for qid in chunk_ids:
    q = qmap.get(qid, {})
    img_data = q.get('image')
    if img_data and img_data.startswith('data:image'):
        header, b64_str = img_data.split(',', 1)
        ext = 'jpg' if 'jpeg' in header or 'jpg' in header else 'png'
        file_path = f'Examtopics/enrichment/images/q{qid}.{ext}'
        with open(file_path, 'wb') as img_f:
            img_f.write(base64.b64decode(b64_str))
        print(f"Saved {file_path}")
