import base64, hashlib, json
from pathlib import Path

root=Path(__file__).resolve().parents[2]; audit=root/'Examtopics/audit'
s=(root/'CCNA-App/app/src/main/assets/data/ccna_cards_data.js').read_text(encoding='utf-8')
data=json.loads(s[s.index('['):].strip().rstrip(';')); by={q['id']:q for q in data}
fp=lambda q:hashlib.sha256(json.dumps(q,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
updates={
811:dict(prompt='Refer to the exhibit. What is represented by "VPN11" in this JSON data?',explanation='D。第 2 行的 `"VPN concentrator": "VPN11"` 中，冒号左侧是键名，右侧 `"VPN11"` 是字符串值。它不是键、数组或对象；完整的一对花括号表示对象，外层方括号表示数组。'),
812:dict(prompt='On the cited Cisco IOS implementation, which port type uses the interface command `spanning-tree portfast` for a host-facing edge port without the `trunk` keyword?',explanation='D。该 Cisco IOS 命令用在面向终端的二层 access 端口；支持的主机侧 trunk 可使用 `spanning-tree portfast trunk`，不同平台/版本语法可能不同。三层路由主接口和子接口不属于题设二层交换端口。PortFast 不使端口天然无环，误接交换机可能产生环路；应按设计使用 BPDU Guard 等保护。'),
813:dict(prompt='Refer to the exhibit. What is represented by "R29" in this JSON data?',explanation='D。图中第 4 行 `"router": "R29"` 里，`"router"` 是键，`"R29"` 是字符串值。A 数组和 C 对象是容器；B 是属性名而非属性值。'),
814:dict(prompt='Refer to the exhibit. What is the most specific JSON container type represented by the brace-delimited item on line 2?',options=[{'label':'A','text':'object'},{'label':'B','text':'string'},{'label':'C','text':'key'},{'label':'D','text':'array'}],explanation='A。第 2 行花括号包含 `"switch": "SW16"` 和 `"interface": "fe3/43"`，整体为对象；最外层方括号是数组。键及其字符串值只是对象成员。注意对象本身也是合法 JSON value，因此用“value”作为排他干扰项会造成歧义，本题改为询问具体容器类型。'),
815:dict(explanation='A。RFC 1918 地址空间包括 10.0.0.0/8、172.16.0.0/12 与 192.168.0.0/16；组织可在内部自行使用而无须从 RIR 单独获配。B，站点间 VPN 并不要求必须使用私网地址；C，内部路由表规模取决于设计与汇总；D，地址空间有限。私网地址通常不在公共互联网全局路由；对外通信可依设计使用 NAT、代理或隧道，不是所有通信都必须 NAT。'),
816:dict(prompt='Refer to the interface output. Which feature is explicitly shown as configured, irrespective of whether packets are waiting at this instant?',explanation='C。输出包含 `Queueing strategy: fifo`，表明接口显示了 FIFO 队列策略；`Input queue: 0/300/0/0` 和 `Output queue: 0/300` 则表示采样时队列深度为 0，不能据此说当前有报文排队或存在拥塞。30 秒输入/输出速率为 0 不支持 B 高吞吐；计数器和速率也不足以证明 A 网卡故障或 D 广播风暴，零错误不保证硬件绝无故障。'),
817:dict(explanation='D。RFC 1918 私有地址可由不同组织重复使用，从而减少对全球唯一 IPv4 地址的需求；连接公共互联网时，NAT/PAT 等设计可进一步复用公网地址，但私网地址本身不会扩大 IPv4 总地址空间。A，私有前缀不作为全球可达前缀使用；B，范围有限；C，多接收端并非使用私网地址的必要条件。'),
818:dict(prompt='Which is a suitable use of private IPv4 addresses in an organization?',explanation='C。仅与内部主机通信的终端适合使用 RFC 1918 私网地址，但这不是私网地址的唯一用途；通过 NAT、代理或隧道，私网主机也可以与外部服务通信。A，站点间 VPN 不要求一定使用私网地址；B，私网地址不单独提供跨公共互联网的全球可达性；D，复杂度取决于实际路由、地址和转换设计。私网地址本身也不提供认证或加密。'),
819:dict(explanation='B。不同私有网络可以复用 RFC 1918 地址，结合适当的 NAT/PAT 等连接方案，减少所需的全球唯一 IPv4 地址数量；这缓解地址短缺而非增加 IPv4 地址总数。A，ACL 过滤数据包，本身不提供地址转换或全球路由；C，RFC 1918 前缀不用于全球公开宣告；D，私有地址自身不提供加密或认证。'),
820:dict(prompt='Refer to the exhibit. Based on the displayed 30-second rates and interface load, which condition is reported?',answer=['C'],explanation='C。截图显示 30 秒输入速率 `200234873 bits/sec`、输出速率 `233830309 bits/sec`，txload 和 rxload 均为 `255/255`，因此所报告的状态是高吞吐/高负载。图中同时标有 100 Mb/s，所列速率超过该标称接口速率；这些数值相互矛盾，不能据此认定真实硬件上的实际吞吐量。FIFO 是配置的队列策略，而输入/输出队列当前深度均为 0，不能证明当前排队或拥塞。广播累计值无法单独证明风暴，单端双工与零错误也无法单独确认或排除双工不匹配。原答案 D 及声称官方判分依据的解释没有证据，现依图中所报告的速率改为 C。')}
notes={811:'图中 VPN11 是字符串值；JSON 数据并非 JSON Schema。',812:'限定所引用 IOS 命令语法，删除 access 天然无环等绝对说法。',813:'图中 R29 是值；改正 JSON Schema 用词。',814:'对象也是 JSON value，排除同义歧义，明确询问容器类型。',815:'纠正必须 NAT、私有地址天然安全等绝对化结论。',816:'图示队列深度为零，FIFO 是策略而非正在排队或拥塞。',817:'明确私网复用与 NAT 的作用，不绝对化公开网络过滤。',818:'内部专用主机是适用场景，私网也可经适当方案访问外网。',819:'私网缓解全球唯一地址需求但不增加 IPv4 空间，也不提供安全保障。',820:'图中速率与负载支持高吞吐 C，超过 100 Mb/s 的不一致单独注明；移除无证据官方答案主张。'}
refs=['https://www.rfc-editor.org/rfc/rfc8259.html','https://www.rfc-editor.org/rfc/rfc1918.html','https://www.cisco.com/c/en/us/td/docs/ios/lanswitch/command/reference/lsw_book/lsw_s2.pdf','https://www.cisco.com/E-Learning/bulk/public/tac/cim/cib/using_cisco_ios_software/cmdrefs/show_interfaces.htm']
corrections=[]; report=['# Q811–Q820 逐题审查','', '对题干、所有选项、答案、解析、原图及代码逐一检查；以下为发现与修复。未进行真实设备测试。','']
for n in range(811,821):
 q=by[n];u=updates[n];image=bool(q.get('image')); c=dict(id=n,original_qid=q['qid'],before_sha256=fp(q),reason=notes[n],updates=u,original_fields={k:q.get(k) for k in u})
 if image:
  path=audit/'exhibits'/f'q{n}_agent.jpg'; assert path.read_bytes()==base64.b64decode(q['image'].split(',',1)[1]);c.update(has_exhibit=True,exhibit_path='exhibits/'+path.name,image_sha256=hashlib.sha256(path.read_bytes()).hexdigest())
 corrections.append(c);report.append(f'- Q{n}（{q["qid"]}）：{notes[n]} 原答案 {q["answer"]}，修订后 {u.get("answer",q["answer"])}；'+('原图已直接查看并核对。' if image else '无原图；检查文本与代码。'))
report.extend(['','参考依据：']+[f'- {url}' for url in refs]+['','限制：基于题库原图、RFC 与厂商文档人工审查，未在网络设备实测。'])
out=dict(scope='Q811–Q820',preserve_question_ids=True,corrections=corrections,sources=refs,limitations='人工检查，未进行真实设备测试。')
(audit/'agent-0811-0820.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(audit/'agent-0811-0820.md').write_text('\n'.join(report)+'\n',encoding='utf-8')
print('Prepared',len(corrections),'corrections')
