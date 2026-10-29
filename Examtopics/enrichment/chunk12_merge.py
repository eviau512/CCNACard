import json
import os
import sys

sys.path.append('Examtopics/enrichment')
from chunk12_p1 import part1
from chunk12_p2 import part2
from chunk12_p3 import part3

merged = {}
merged.update(part1)
merged.update(part2)
merged.update(part3)

# Load input
with open('Examtopics/enrichment/chunk_12_input.json', 'r', encoding='utf-8') as f:
    input_data = json.load(f)

input_ids = [str(item['id']) for item in input_data]
print(f"Total input questions: {len(input_ids)}")
print(f"Total merged explanations: {len(merged)}")

missing = [qid for qid in input_ids if qid not in merged]
extra = [qid for qid in merged if qid not in input_ids]

if missing:
    print(f"ERROR: Missing explanations for IDs: {missing}")
    sys.exit(1)
if extra:
    print(f"WARNING: Extra explanations for IDs: {extra}")

# Check 4-part structure
required_sections = [
    "• 核心考点与原理分析：",
    "• 正确选项剖析：",
    "• 干扰项排除与错误陷阱：",
    "• 考试要点与速记技巧："
]

for qid, exp in merged.items():
    for sec in required_sections:
        if sec not in exp:
            print(f"ERROR: Question {qid} missing section: {sec}")
            sys.exit(1)

output_data = {
    "chunk_id": "chunk_12",
    "explanations": merged
}

output_path = 'Examtopics/enrichment/chunk_12_output.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(output_data, f, ensure_ascii=False, indent=2)

print(f"Successfully generated {output_path} with {len(merged)} questions.")
