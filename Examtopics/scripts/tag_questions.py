import json, re, os, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

RULES = [
    # 1. Automation and Programmability
    ('Automation and Programmability', 'REST APIs & HTTP Operations', [
        r'\brest\b', r'\bapi\b', r'\bcrud\b', r'\bhttp (?:get|post|put|delete|patch)\b', r'\bpostman\b', r'\buri\b', r'\bpayload\b', r'\bendpoint\b'
    ]),
    ('Automation and Programmability', 'Data Formats (JSON, XML, YAML)', [
        r'\bjson\b', r'\bxml\b', r'\byaml\b', r'key-value', r'array of objects', r'json formatting', r'curly brace'
    ]),
    ('Automation and Programmability', 'Configuration Management (Ansible, Puppet, Chef)', [
        r'\bansible\b', r'\bpuppet\b', r'\bchef\b', r'\bplaybook\b', r'\bcookbook\b', r'\bmanifest\b', r'\bagentless\b', r'\bpush vs pull\b'
    ]),
    ('Automation and Programmability', 'Cisco DNA Center & Controllers', [
        r'\bdna center\b', r'\bcatalyst center\b', r'\bcontroller-based\b', r'\bunderlay\b', r'\boverlay\b', r'\bfabric\b', r'\bsdn\b', r'\bnetconf\b', r'\brestconf\b', r'\byang\b', r'\bcisco dna\b'
    ]),

    # 2. Security Fundamentals
    ('Security Fundamentals', 'Layer 2 Security (DHCP Snooping, DAI, Port Security)', [
        r'dhcp snooping', r'dynamic arp inspection', r'\bdai\b', r'port security', r'err-disable', r'sticky mac', r'bpdu guard', r'root guard', r'violation (?:protect|restrict|shutdown)'
    ]),
    ('Security Fundamentals', 'Standard & Extended ACLs', [
        r'\bacl\b', r'access-list', r'access list', r'standard acl', r'extended acl', r'named acl', r'implicit deny', r'established', r'permit ip', r'deny ip'
    ]),
    ('Security Fundamentals', 'AAA & Device Access Control', [
        r'\baaa\b', r'\btacacs\+?\b', r'\bradius\b', r'authentication, authorization', r'privilege level', r'local user', r'secret password', r'enable secret', r'enable password', r'multifactor', r'mfa\b', r'biometric'
    ]),
    ('Security Fundamentals', 'Security Concepts & Attack Mitigation', [
        r'phishing', r'brute[- ]force', r'mitm', r'man-in-the-middle', r'spoofing', r'ddos', r'\bdos\b', r'malware', r'ransomware', r'zero-day', r'firewall', r'ngfw', r'ips\b', r'ids\b'
    ]),
    ('Security Fundamentals', 'VPN Technologies (IPsec, SSL)', [
        r'\bvpn\b', r'\bipsec\b', r'ikev[12]', r'esp', r'ah header', r'transform-set', r'site-to-site', r'remote access vpn'
    ]),

    # 3. IP Services
    ('IP Services', 'NAT & PAT Configuration', [
        r'\bnat\b', r'\bpat\b', r'network address translation', r'port address translation', r'inside local', r'inside global', r'outside local', r'outside global', r'overload', r'ip nat'
    ]),
    ('IP Services', 'First Hop Redundancy (HSRP, VRRP, GLBP)', [
        r'\bhsrp\b', r'\bvrrp\b', r'\bglbp\b', r'virtual router', r'virtual ip', r'standby ip', r'preempt', r'fhrp', r'standby \d+'
    ]),
    ('IP Services', 'DHCP & DNS Services', [
        r'\bdhcp\b', r'\bdns\b', r'ip helper-address', r'relay agent', r'dhcp pool', r'lease time', r'fqdn', r'name resolution', r'dora process'
    ]),
    ('IP Services', 'Quality of Service (QoS)', [
        r'\bqos\b', r'\bdscp\b', r'\bcos\b', r'\bwred\b', r'policing', r'shaping', r'queuing', r'classification', r'marking', r'trust boundary', r'jitter', r'expedited forwarding'
    ]),
    ('IP Services', 'Network Monitoring (SNMP, Syslog, NTP)', [
        r'\bsnmp\b', r'\bsyslog\b', r'\bntp\b', r'trap', r'inform', r'stratum', r'logging level', r'facility', r'mib', r'oid', r'clock set'
    ]),
    ('IP Services', 'Management Protocols (SSH, Telnet, TFTP/FTP)', [
        r'\bssh\b', r'\btelnet\b', r'\btftp\b', r'\bftp\b', r'line vty', r'transport input', r'crypto key generate'
    ]),

    # 4. IP Connectivity
    ('IP Connectivity', 'OSPFv2 Routing & States', [
        r'\bospf\b', r'router ospf', r'dr/bdr', r'link-state', r'lsa', r'lsr', r'lsu', r'ospf area', r'backbone area', r'neighbor relationship', r'full state', r'2-way state'
    ]),
    ('IP Connectivity', 'Static & Floating Static Routing', [
        r'ip route\b', r'static route', r'floating static', r'default route', r'0\.0\.0\.0/0', r'next-hop', r'exit interface'
    ]),
    ('IP Connectivity', 'Routing Concepts & Administrative Distance', [
        r'administrative distance', r'routing table', r'longest match', r'metric', r'prefix length', r'connected route', r'local route', r'gateway of last resort'
    ]),
    ('IP Connectivity', 'Dynamic Routing (EIGRP, BGP, RIP)', [
        r'\beigrp\b', r'\bbgp\b', r'\brip\b', r'autonomous system', r'feasible successor', r'successor', r'dual algorithm'
    ]),

    # 5. Network Access
    ('Network Access', 'VLANs & 802.1Q Trunking', [
        r'\bvlan\b', r'switchport mode (?:trunk|access)', r'802\.1q', r'native vlan', r'trunking', r'access vlan', r'voice vlan', r'inter-vlan', r'router-on-a-stick', r'\bsvi\b', r'interface vlan'
    ]),
    ('Network Access', 'Spanning Tree Protocol (STP & RSTP)', [
        r'\bstp\b', r'\brstp\b', r'spanning-tree', r'rapid spanning', r'bridge priority', r'root bridge', r'root port', r'designated port', r'alternate port', r'forwarding delay'
    ]),
    ('Network Access', 'EtherChannel (LACP & PAgP)', [
        r'etherchannel', r'\blacp\b', r'\bpagp\b', r'channel-group', r'port-channel', r'channel protocol'
    ]),
    ('Network Access', 'Wireless Architectures & WLAN', [
        r'\bwlan\b', r'\bwlc\b', r'wireless', r'\bssid\b', r'access point', r'autonomous ap', r'lightweight ap', r'capwap', r'flexconnect', r'bssid'
    ]),
    ('Network Access', 'Switch Discovery & Trunk Protocols (CDP, LLDP, DTP, VTP)', [
        r'\bcdp\b', r'\blldp\b', r'\bdtp\b', r'\bvtp\b', r'dynamic desirable', r'dynamic auto'
    ]),

    # 6. Network Fundamentals
    ('Network Fundamentals', 'IPv4 Addressing & Subnetting', [
        r'subnet mask', r'slash notation', r'cidr', r'usable hosts', r'network address', r'broadcast address', r'vlsm', r'private ip', r'rfc 1918', r'users\b.*subnet', r'prefix'
    ]),
    ('Network Fundamentals', 'IPv6 Addressing & Concepts', [
        r'ipv6', r'link-local', r'global unicast', r'unique local', r'solicited-node', r'eui-64', r'dual stack', r'slaac', r'neighbor discovery', r'ndp'
    ]),
    ('Network Fundamentals', 'Physical Layer, Cabling & Interfaces', [
        r'single-mode', r'multimode', r'fiber', r'copper', r'cat[56]', r'crossover', r'straight-through', r'sfp', r'poe', r'full-duplex', r'half-duplex', r'collision domain', r'broadcast domain', r'late collision', r'crc error', r'duplex mismatch'
    ]),
    ('Network Fundamentals', 'Virtualization & Cloud Models', [
        r'cloud service', r'saas\b', r'iaas\b', r'paas\b', r'virtual machine', r'hypervisor', r'type [12] hypervisor', r'virtualization'
    ]),
    ('Network Fundamentals', 'OSI Model & TCP/UDP Protocols', [
        r'osi model', r'layer [1-7]', r'\btcp\b', r'\budp\b', r'three-way handshake', r'syn', r'ack', r'window size', r'connection-oriented', r'connectionless'
    ]),
    ('Network Fundamentals', 'Network Architectures & Topology Models', [
        r'three-tier', r'two-tier', r'collapsed core', r'spine-and-leaf', r'core layer', r'distribution layer', r'access layer', r'wan', r'sase', r'sd-wan'
    ])
]

def classify_question(q):
    text = (q.get('prompt', '') + ' ' + ' '.join(o.get('text', '') for o in q.get('options', [])) + ' ' + q.get('explanation', '')).lower()
    for domain, topic, patterns in RULES:
        if any(re.search(p, text) for p in patterns):
            return domain, topic

    # Fallbacks based on question type or content
    if q.get('type') == 'Drag and Drop':
        return 'Network Fundamentals', 'Comprehensive Topology & Architecture Lab'
    return 'Network Fundamentals', 'General Networking Principles & Device Roles'

def assign_option_weaknesses(q, domain, topic):
    ans_set = set(q.get('answer', []))
    opt_tags = {}
    for opt in q.get('options', []):
        lbl = opt['label']
        txt = opt['text']
        if lbl in ans_set:
            opt_tags[lbl] = {
                'is_correct': True,
                'concept': f"{topic} (Correct Principle)",
                'weakness_tag': None
            }
        else:
            # Check if this distractor matches a specific subtopic
            opt_lower = txt.lower()
            matched_distractor_topic = None
            for d, t, patterns in RULES:
                if any(re.search(p, opt_lower) for p in patterns):
                    matched_distractor_topic = t
                    break
            
            if matched_distractor_topic and matched_distractor_topic != topic:
                concept_tag = f"Confusion with {matched_distractor_topic}"
            else:
                concept_tag = f"{topic}: Misconception regarding {txt[:35]}..." if len(txt) > 35 else f"{topic}: {txt}"

            opt_tags[lbl] = {
                'is_correct': False,
                'concept': concept_tag,
                'weakness_tag': f"{topic} ({lbl} misconception)"
            }

    idk_tag = f"{topic} (Unmastered Core Concept)"
    return opt_tags, idk_tag

def main():
    src_path = 'Examtopics/output/complete_q1_q1396.json'
    dst_dir = 'CCNA-App/app/src/main/assets/data'
    os.makedirs(dst_dir, exist_ok=True)
    dst_path = os.path.join(dst_dir, 'ccna_cards_tagged.json')

    print(f"Reading source question bank: {src_path}...")
    with open(src_path, 'r', encoding='utf-8') as f:
        questions = json.load(f)

    tagged_questions = []
    domain_counts = {}
    topic_counts = {}

    for q in questions:
        domain, topic = classify_question(q)
        opt_tags, idk_tag = assign_option_weaknesses(q, domain, topic)

        q_tagged = dict(q)
        q_tagged['domain'] = domain
        q_tagged['topic'] = topic
        q_tagged['option_tags'] = opt_tags
        q_tagged['idk_tag'] = idk_tag
        tagged_questions.append(q_tagged)

        domain_counts[domain] = domain_counts.get(domain, 0) + 1
        topic_counts[topic] = topic_counts.get(topic, 0) + 1

    print(f"\nSuccessfully classified {len(tagged_questions)} questions!")
    print("\nDomain Distribution:")
    for d, c in sorted(domain_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  - {d}: {c} questions ({c/len(tagged_questions)*100:.1f}%)")

    print(f"\nTop 10 Subtopics:")
    for t, c in sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"  - {t}: {c} questions")

    with open(dst_path, 'w', encoding='utf-8') as out_f:
        json.dump(tagged_questions, out_f, ensure_ascii=False)

    print(f"\nTagged dataset saved to: {dst_path} ({os.path.getsize(dst_path):,} bytes)")

if __name__ == '__main__':
    main()
