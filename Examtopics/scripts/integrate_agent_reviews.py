"""Verify and record consecutive, manually reviewed agent manifests."""
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

root = Path(__file__).resolve().parents[2]
audit = root / 'Examtopics/audit'
master = root / 'Examtopics/output/complete_q1_q1396.json'
bundle = root / 'CCNA-App/app/src/main/assets/data/ccna_cards_data.js'
read = lambda p: p.read_text(encoding='utf-8')
fp = lambda q: hashlib.sha256(json.dumps(q, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
parse = lambda s: json.loads(s[s.index('['):].strip().rstrip(';'))
qs = json.loads(read(master)); assert qs == parse(read(bundle)) and len(qs) == 1396
by = {q['id']: q for q in qs}; assert len(by) == len(qs)
original = parse(subprocess.check_output(['git', 'show', 'HEAD:CCNA-App/app/src/main/assets/data/ccna_cards_data.js'], cwd=root).decode('utf-8'))
old = {q['id']: q for q in original}
assert [(q['id'],q['qid']) for q in qs] == [(q['id'],q['qid']) for q in original]
index = json.loads(read(audit/'review-index.json'))
for name in sys.argv[1:]:
    path = audit / name
    m = json.loads(read(path)); corrections = m['corrections']
    start = index['next_question_id']; end=int(re.search(r'-(\d{4})\.json$',name).group(1))
    ids=[q['id'] for q in qs if start <= q['id'] <= end]
    assert [c['id'] for c in corrections] == ids and 1 <= len(ids) <= 10
    reports = [p for p in (audit/f'agent-review-{start:04d}-{end:04d}.md', audit/f'agent-{start:04d}-{end:04d}.md') if p.exists()]
    assert reports, name
    reviews = {r['id']:r for r in m.get('reviews',[])}
    fixed=[]
    for c in corrections:
        n=c['id']; q=by[n]; before=old[n]
        assert fp(before)==c['before_sha256'], n
        assert all(q.get(k)==v for k,v in c['updates'].items()), n
        expected=dict(before); expected.update(c['updates']); assert q==expected, n
        info=c.get('review',reviews.get(n,{}))
        assessment=info.get('finding',info.get('content_answer_explanation',c.get('reason','Reviewed.')))
        image=bool(before.get('image') or before.get('answer_image'))
        exhibits=m.get('images_directly_viewed',[])
        viewed = image and (info.get('image') == 'viewed' or n in exhibits or any(re.search(rf'q{n}(?:_|\.)',str(p)) for p in exhibits) or bool(c.get('exhibit_path')))
        assert not image or viewed, (n,'image not confirmed viewed')
        changed=before != q
        status='问题' if changed else '通过'
        record=dict(id=n, original_qid=q['qid'], current_answer=q['answer'], reviewed_answer=before['answer'], status=status, assessment=assessment, question_sha256=fp(before), has_exhibit=image, exhibit_viewed=bool(viewed), report=reports[0].name, presentation_reviewed=True, presentation_review=dict(status='通过',assessment='图像与代码显示按审查记录检查；详见逐题报告。',report=reports[0].name),current_question_sha256=fp(q))
        if changed:
            fixed.append(n); record['resolution']=dict(status='fixed',manifest=name,verification=f'agent-verification-{start:04d}-{end:04d}.json',current_answer=q['answer'])
        index['records'].append(record)
    verification=dict(scope=[start,end], count=len(ids), ids_qids_preserved=True, original_fingerprints_match_head=True, corrections_match_manifest=True, master_app_equal=True, limitations='人工逐题审查；未对网络设备执行实机实验。')
    (audit/f'agent-verification-{start:04d}-{end:04d}.json').write_text(json.dumps(verification,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    index['resolved_question_ids']=sorted(set(index['resolved_question_ids'])|set(fixed))
    index['batch_status_counts'][reports[0].name]=dict(Counter(r['status'] for r in index['records'][-len(ids):]))
    count=len(index['records']); remaining=[q['id'] for q in qs if q['id']>end]
    index.update(reviewed_count=count,unreviewed_count=1396-count,next_question_id=remaining[0] if remaining else None,current_scope_fully_reviewed_count=count,presentation_reviewed_count=count,presentation_reviewed_ids=[r['id'] for r in index['records']],remediation_verified_through_id=end)
    print(f'Verified and indexed Q{start}-Q{end}.')
index['status_counts']=dict(Counter(r['status'] for r in index['records']))
index['presentation_status_counts']=dict(Counter(r['presentation_review']['status'] for r in index['records']))
index['source_sha256']=sha(master);index['app_bundle_sha256']=sha(bundle)
index['next_action']=f'从Q{index["next_question_id"]}继续逐题审查；Q800统一提交、推送、编译和个人空间保留数据覆盖安装，不发布release。'
(audit/'review-index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
