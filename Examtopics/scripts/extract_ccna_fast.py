import pymupdf, sys, io, re, json, bisect

doc = pymupdf.open('mock-test/Examtopics 200-301 CCNA - 20261028.pdf')

pages_data = []
page_offsets = []
full_text = ""

for pno in range(len(doc)):
    page = doc[pno]
    imgs = []
    for im in page.get_images():
        xref = im[0]
        rects = page.get_image_rects(xref)
        if rects:
            imgs.append({
                'xref': xref,
                'y0': rects[0].y0,
                'y1': rects[0].y1
            })
    imgs.sort(key=lambda x: x['y0'])
    
    text = page.get_text()
    page_offsets.append(len(full_text))
    full_text += text + "\n"
    pages_data.append({
        'pno': pno + 1,
        'imgs': imgs
    })

def get_page_num(pos):
    # bisect_right returns index in page_offsets
    idx = bisect.bisect_right(page_offsets, pos) - 1
    return idx + 1 # 1-based

q_header_re = re.compile(r'(?:^|\n)\s*(\d{1,4})\.(?:(Q\d+)|(?=\s*[A-Z]))')

matches = []
for m in q_header_re.finditer(full_text):
    num = int(m.group(1))
    qid = m.group(2) if m.group(2) else f"Q{num}"
    matches.append({
        'start': m.start(),
        'start_digit': m.start(1),
        'num': num,
        'qid': qid,
        'page': get_page_num(m.start(1))
    })

valid_questions = []
expected_num = 1
for m in matches:
    if m['num'] == expected_num:
        valid_questions.append(m)
        expected_num += 1
    elif m['num'] > expected_num and m['num'] <= expected_num + 5:
        valid_questions.append(m)
        expected_num = m['num'] + 1

print(f"Total valid questions: {len(valid_questions)}")

# Track exhibits per page
exhibits_per_page = {}
for q in valid_questions:
    p = q['page']
    exhibits_per_page.setdefault(p, []).append(q)

questions = []
for i in range(len(valid_questions)):
    q = valid_questions[i]
    start = q['start']
    end = valid_questions[i+1]['start'] if i + 1 < len(valid_questions) else len(full_text)
    chunk = full_text[start:end].strip()
    
    # Header
    m_head = re.match(r'^\s*(\d+)\.(Q\d+|)?\s*', chunk)
    body = chunk[m_head.end():] if m_head else chunk
    
    # Answer and Explanation
    ans_m = re.search(r'答案[：:]\s*([A-Ga-g,\s]+)', body)
    answer_raw = ans_m.group(1).strip() if ans_m else ""
    answer_letters = re.findall(r'[A-G]', answer_raw.upper())
    
    exp_m = re.search(r'解析[：:]\s*(.*)', body, re.DOTALL)
    raw_exp = exp_m.group(1).strip() if exp_m else ""
    raw_exp = re.sub(r'Community vote distribution.*', '', raw_exp, flags=re.I).strip()
    raw_exp = raw_exp.replace('ג€', '"').replace('ג', '')
    
    pre_ans = body[:ans_m.start()] if ans_m else body
    
    # Options
    opt_splits = list(re.finditer(r'(?:^|\n)\s*([A-G])\.\s*', pre_ans))
    if opt_splits:
        prompt_text = pre_ans[:opt_splits[0].start()].strip()
        options = []
        for oi in range(len(opt_splits)):
            opt_label = opt_splits[oi].group(1).upper()
            opt_start = opt_splits[oi].end()
            opt_end = opt_splits[oi+1].start() if oi + 1 < len(opt_splits) else len(pre_ans)
            opt_val = pre_ans[opt_start:opt_end].strip()
            opt_val = re.sub(r'\s+', ' ', opt_val)
            options.append({
                'label': opt_label,
                'text': opt_val
            })
    else:
        prompt_text = pre_ans.strip()
        options = []
    prompt_text = re.sub(r'\s+', ' ', prompt_text)
    
    # Question type
    if len(answer_letters) > 1 or 'Choose two' in prompt_text or 'Choose three' in prompt_text:
        qtype = "Multiple Choice"
    elif 'DRAG DROP' in prompt_text or 'Drag and drop' in prompt_text:
        qtype = "Drag and Drop"
    else:
        qtype = "Single Choice"
        
    # Associate images
    has_exhibit = bool(re.search(r'refer to the exhibit', prompt_text, re.I))
    assigned_img_xref = None
    if has_exhibit:
        pno = q['page']
        p_imgs = pages_data[pno - 1]['imgs']
        if p_imgs:
            # find order of this question among exhibit questions on this page
            page_ex_qs = [x for x in exhibits_per_page.get(pno, []) if bool(re.search(r'refer to the exhibit', full_text[x['start']:x['start']+200], re.I))]
            if q in page_ex_qs:
                idx = page_ex_qs.index(q)
                assigned_img_xref = p_imgs[min(idx, len(p_imgs)-1)]['xref']
            else:
                assigned_img_xref = p_imgs[0]['xref']
        else:
            # Check previous page if near top
            if pno > 1 and pages_data[pno - 2]['imgs']:
                assigned_img_xref = pages_data[pno - 2]['imgs'][-1]['xref']
            elif pno < len(pages_data) and pages_data[pno]['imgs']:
                assigned_img_xref = pages_data[pno]['imgs'][0]['xref']

    questions.append({
        'id': q['num'],
        'qid': q['qid'],
        'page': q['page'],
        'type': qtype,
        'prompt': prompt_text,
        'options': options,
        'answer': answer_letters,
        'image_xref': assigned_img_xref,
        'original_exp': raw_exp
    })

print(f"Successfully processed {len(questions)} questions in <1 second!")
print("Exhibit check for first 20 questions:")
for q in questions[:20]:
    img_tag = f"XREF {q['image_xref']}" if q['image_xref'] else "None"
    print(f"Q#{q['id']} ({q['qid']}) [P.{q['page']}] -> Img: {img_tag} | Ans: {q['answer']} | Opts: {len(q['options'])}")
