"""Check the Q601–800 milestone data, HTML and actual formatters."""
import hashlib,json,re,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]
read=lambda p:p.read_text(encoding='utf-8')
parse=lambda s:json.loads(s[s.index('['):].strip().rstrip(';'))
master=root/'Examtopics/output/complete_q1_q1396.json';bundle=root/'CCNA-App/app/src/main/assets/data/ccna_cards_data.js'
qs=json.loads(read(master));assert qs==parse(read(bundle)) and len(qs)==1396
old=parse(subprocess.check_output(['git','show','HEAD:CCNA-App/app/src/main/assets/data/ccna_cards_data.js'],cwd=root).decode('utf-8'))
assert [(q['id'],q['qid']) for q in qs]==[(q['id'],q['qid']) for q in old]
changed=[q['id'] for q,p in zip(qs,old) if q!=p];assert set(changed)==set(range(661,801))
batch=json.loads(read(root/'Examtopics/batch/batch4_q601_q800.json'));assert batch==qs[600:800]
targets=[root/'CCNA-App/app/src/main/assets/app.js',root/'Examtopics/batch/Examtopics_Batch4_Q601-800.html',root/'Examtopics/output/Examtopics_CCNA_200-301_Complete.html']
for p,expected in [(targets[1],batch),(targets[2],qs)]:
 m=re.search(r'<script id="exam-data" type="application/json">\s*([\s\S]*?)\s*</script>',read(p));assert m and json.loads(m.group(1))==expected
items=[{'id':q['id'],'kind':k,'input':q[k]} for q in qs[600:800] for k in ('prompt','explanation')]
inp=root/'Examtopics/output/formatter-milestone-0800.local.json';inp.write_text(json.dumps(items,ensure_ascii=False),encoding='utf-8');outputs=[]
for p in targets:
 s=read(p);a=s.index('function formatMarkdown(');b=s.index('function renderCurrentCard(',a) if p.suffix=='.js' else s.index('function initTheme(',a)
 script=root/'Examtopics/output/formatter-milestone-0800.local.js';script.write_text("const fs=require('fs');\n"+s[a:b]+"\nprocess.stdout.write(JSON.stringify(JSON.parse(fs.readFileSync(process.argv[2],'utf8')).map(x=>formatMarkdown(x.input))));",encoding='utf-8')
 outputs.append(json.loads(subprocess.check_output(['node',str(script),str(inp)])))
assert outputs[0]==outputs[1]==outputs[2] and len(outputs[0])==400
index=json.loads(read(root/'Examtopics/audit/review-index.json'));assert index['reviewed_count']==800 and index['next_question_id']==801
assert subprocess.check_output(['git','diff','--name-only','--','CCNA-App'],cwd=root).decode().splitlines()==['CCNA-App/app/src/main/assets/data/ccna_cards_data.js']
print(json.dumps(dict(scope=[601,800],reviewed=200,ids_qids_preserved=True,changes_since_main=changed,master_app_batch_html_equal=True,formatter_prompt_explanation_checked=400,formatter_outputs_equal=True,app_logic_unchanged=True,source_sha256=hashlib.sha256(master.read_bytes()).hexdigest(),app_sha256=hashlib.sha256(bundle.read_bytes()).hexdigest())))
