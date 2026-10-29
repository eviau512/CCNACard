import pymupdf, sys, io, re, json, base64, os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.path.append('Examtopics/scripts')

from extract_ccna_fast import questions, doc, pages_data

# Base64 image cache
image_cache = {}

def get_image_b64(xref):
    if not xref:
        return None
    if xref in image_cache:
        return image_cache[xref]
    try:
        base_img = doc.extract_image(xref)
        image_bytes = base_img["image"]
        ext = base_img["ext"]
        b64 = base64.b64encode(image_bytes).decode('ascii')
        data_uri = f"data:image/{ext};base64,{b64}"
        image_cache[xref] = data_uri
        return data_uri
    except Exception as e:
        print(f"Error extracting image xref {xref}: {e}")
        return None

# Topic classification rules
topics = [
    ('Subnetting & IP Addressing', r'\b(ipv4|ipv6|subnet|subnets|prefix|mask|address|addresses|cidr|private|public|unicast|multicast|anycast|broadcast|eui-64)\b'),
    ('Routing & Protocols', r'\b(route|routes|routing|router|routers|ospf|bgp|eigrp|administrative distance|metric|floating|next-hop|lpm|longest prefix|default gateway)\b'),
    ('Layer 2 Campus Switching', r'\b(switch|switches|switching|vlan|vlans|trunk|trunks|802.1q|stp|spanning-tree|mac|cam|collision|duplex|portfast|bpdu|etherchannel|lacp|pagp)\b'),
    ('Cisco Enterprise Wireless', r'\b(wireless|wlan|wlans|ssid|wlc|access point|access points|capwap|802.11|802.11a|802.11b|802.11g|802.11n|802.11ac|802.11ax|rf|2.4|5ghz|band select)\b'),
    ('Transport & IP Services', r'\b(tcp|udp|three-way handshake|windowing|dhcp|dns|snmp|ntp|syslog|nat|pat|tftp|ftp|ssh|telnet)\b'),
    ('Security Fundamentals', r'\b(security|acl|acls|access-list|access-lists|port-security|radius|tacacs|aaa|vpn|ipsec|firewall|firewalls|dai|arp inspection|snooping)\b'),
    ('Automation & Programmability', r'\b(automation|programmability|rest|api|apis|json|xml|yaml|controller|controllers|dna center|sd-wan|sdn|chef|puppet|ansible|post|get|put)\b'),
    ('Network Fundamentals & Physical Layer', r'\b(sfp|cable|fiber|copper|ethernet|half-duplex|full-duplex|bandwidth|throughput|latency|jitter|csu/dsu|t1|t3)\b')
]

def classify_prompt(prompt):
    p = prompt.lower()
    for name, pattern in topics:
        if re.search(pattern, p):
            return name
    return 'Cisco CCNA Core Concept'

# Load existing Batch 1 custom explanations if available
custom_exps_50 = {}
if os.path.exists('Examtopics/batch/batch1_q1_q200.json'):
    try:
        with open('Examtopics/batch/batch1_q1_q200.json', 'r', encoding='utf-8') as f:
            b1_old = json.load(f)
            for item in b1_old:
                if item['id'] <= 50 and item.get('explanation'):
                    custom_exps_50[item['id']] = item['explanation']
    except Exception as e:
        print(f"Notice: {e}")

def synthesize_explanation(q):
    q_id = q['id']
    if q_id in custom_exps_50:
        return custom_exps_50[q_id]

    orig = q['original_exp'].strip()
    orig = re.sub(r'Community vote distribution.*', '', orig, flags=re.I).strip()
    orig = orig.replace('ג€', '"').replace('ג', '')

    if len(orig) > 35:
        return orig

    # Drag and Drop questions
    if 'DRAG DROP' in q['prompt'] or 'Drag and drop' in q['prompt']:
        return "• Drag and Drop Task Analysis: Review the problem diagram to identify the network parameters, attributes, or protocols on the left, and match them with their respective technical definitions or target destinations on the right as shown in the verified solution diagram above."

    # Simulation / Lab questions
    if 'SIMULATION' in q['prompt']:
        return "• Practical Lab Simulation: This item tests hands-on CLI configuration and verification across virtual devices. Refer to the topology and task requirements above to execute the required Cisco IOS command sets."

    ans_labels = q['answer']
    ans_texts = []
    other_texts = []
    for opt in q['options']:
        if opt['label'] in ans_labels:
            ans_texts.append(f"{opt['label']}. {opt['text']}")
        else:
            other_texts.append(f"{opt['label']}. {opt['text']}")

    ans_summary = " and ".join(ans_texts) if ans_texts else ", ".join(ans_labels)
    topic_name = classify_prompt(q['prompt'])
    
    details = []
    if ans_summary:
        details.append(f"• Correct Answer: {ans_summary}")
    
    if "exhibit" in q['prompt'].lower():
        details.append(f"• Exhibit Analysis: Based on the exhibit topology and configuration parameters, {ans_summary} matches the required operational state and routing/switching logic.")
    else:
        details.append(f"• Technical Analysis ({topic_name}): Under standard Cisco CCNA 200-301 certification criteria, {ans_summary} is the correct technical specification fulfilling the requirements in the prompt.")
        
    if other_texts:
        distractor_labels = ', '.join([o.split('.')[0] for o in other_texts])
        details.append(f"• Distractor Evaluation: The remaining options ({distractor_labels}) represent non-matching values, invalid syntax, or incorrect operational states for this scenario.")

    if orig and len(orig) > 10:
        details.append(f"\nAdditional Community Reference:\n{orig}")

    return "\n\n".join(details)

print(f"Processing all {len(questions)} questions from PDF...")
processed_all = []

for q in questions:
    q_id = q['id']
    prompt_text = q['prompt']
    
    # Clean Drag and Drop clutter
    is_drag = 'DRAG DROP' in prompt_text or 'Drag and drop' in prompt_text
    is_sim = 'SIMULATION' in prompt_text
    
    if is_drag:
        prompt_text = re.sub(r'Select and\s*Place:\s*Q.*', '', prompt_text, flags=re.I).strip()
        q_type = 'Drag and Drop'
    elif is_sim:
        q_type = 'Simulation / Lab'
    elif len(q['answer']) > 1 or 'Choose two' in prompt_text or 'Choose three' in prompt_text:
        q_type = 'Multiple Choice'
    else:
        q_type = 'Single Choice'

    # Get primary exhibit image
    img_uri = get_image_b64(q['image_xref'])
    
    # Check if page has secondary image (answer diagram for drag drop)
    ans_img_uri = None
    pno = q['page']
    if pno <= len(pages_data):
        p_imgs = pages_data[pno - 1]['imgs']
        if len(p_imgs) >= 2 and (is_drag or is_sim or not q['options']):
            # 2nd image on page is solution diagram
            ans_img_xref = p_imgs[-1]['xref']
            if ans_img_xref != q['image_xref']:
                ans_img_uri = get_image_b64(ans_img_xref)

    # Explanation
    exp_text = synthesize_explanation(q)
    
    # Answer list
    ans_list = q['answer']
    if not ans_list:
        if is_drag:
            ans_list = ['Refer to Solution Diagram']
        elif is_sim:
            ans_list = ['See Lab Solution Steps']
        else:
            ans_list = ['N/A']

    processed_all.append({
        'id': q_id,
        'qid': q['qid'],
        'page_num': q['page'],
        'type': q_type,
        'prompt': prompt_text,
        'image': img_uri,
        'answer_image': ans_img_uri,
        'options': q['options'],
        'answer': ans_list,
        'explanation': exp_text
    })

print(f"Total processed questions: {len(processed_all)}")
print(f"Total unique images cached: {len(image_cache)}")

# Split into 7 batches
b1 = [q for q in processed_all if 1 <= q['id'] <= 200]
b2 = [q for q in processed_all if 201 <= q['id'] <= 400]
b3 = [q for q in processed_all if 401 <= q['id'] <= 600]
b4 = [q for q in processed_all if 601 <= q['id'] <= 800]
b5 = [q for q in processed_all if 801 <= q['id'] <= 1000]
b6 = [q for q in processed_all if 1001 <= q['id'] <= 1200]
b7 = [q for q in processed_all if 1201 <= q['id'] <= 1397]

print(f"Batch 1: {len(b1)} questions")
print(f"Batch 2: {len(b2)} questions")
print(f"Batch 3: {len(b3)} questions")
print(f"Batch 4: {len(b4)} questions")
print(f"Batch 5: {len(b5)} questions")
print(f"Batch 6: {len(b6)} questions")
print(f"Batch 7: {len(b7)} questions")

# Save datasets
batches_data = [
    (b1, 'Examtopics/batch/batch1_q1_q200.json'),
    (b2, 'Examtopics/batch/batch2_q201_q400.json'),
    (b3, 'Examtopics/batch/batch3_q401_q600.json'),
    (b4, 'Examtopics/batch/batch4_q601_q800.json'),
    (b5, 'Examtopics/batch/batch5_q801_q1000.json'),
    (b6, 'Examtopics/batch/batch6_q1001_q1200.json'),
    (b7, 'Examtopics/batch/batch7_q1201_q1396.json'),
]

for batch_items, path in batches_data:
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(batch_items, f, ensure_ascii=False, indent=2)
    print(f"Saved {path} ({len(batch_items)} questions)")

# Master consolidated dataset
with open('Examtopics/output/complete_q1_q1396.json', 'w', encoding='utf-8') as f:
    json.dump(processed_all, f, ensure_ascii=False, indent=2)
print("Saved complete_q1_q1396.json (All 1396 questions)")
