import base64, hashlib, json
from pathlib import Path

root=Path(__file__).resolve().parents[2]; audit=root/'Examtopics/audit'
qs=json.loads((root/'Examtopics/output/complete_q1_q1396.json').read_text(encoding='utf-8')); by={q['id']:q for q in qs}
fp=lambda q:hashlib.sha256(json.dumps(q,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
updates={
861:dict(prompt='Refer to the exhibit. Which specific JSON structural type describes the brace-delimited element on line 2?',explanation='A。第 2 行花括号括住两个名称/值成员，结构类型为对象（object）；外层 `[...]` 是数组，键如 `port`，字符串如 `e0/27` 是其成员值。对象本身也属于 JSON value，题目询问更具体的结构类型。原图最后一个数组元素后多了逗号，移除它才能构成严格合法的 JSON。'),
862:dict(explanation='C。交换机通常依据收到帧的源 MAC 地址、入端口和所属 VLAN 动态学习或刷新表项，随后按目的 MAC 查表转发。未知单播一般在同 VLAN 的允许转发端口泛洪，但端口安全、STP 等可限制学习或泛洪。A：一般 MAC 学习本身不能防止 DoS；B：未知单播并非发往指定组播组；D：学习不会请求重传。老化时间随平台和配置而异，MAC 泛洪的影响也取决于设备和保护配置。'),
863:dict(prompt='Refer to the exhibit. What is represented by the string "ge3/36" in the displayed JSON-like data?',explanation='A。在图中的 `"interface": "ge3/36"` 中，`interface` 是键，`ge3/36` 是字符串值；B 数组由方括号包围，C 对象由花括号包围，D 指属性名。图中最后一个元素后有多余逗号，删除该逗号后才符合严格 JSON 语法；这不改变该字符串的角色。'),
864:dict(prompt='Which SNMP notification type asks the receiver for an acknowledgment and may be retransmitted when none arrives?',explanation='B。InformRequest 要求接收方发送 Response；发送方可以按配置在超时后重试，因而比未确认的 Trap 更可靠，但有限次重试不能保证最终送达。C Trap 通常不请求通知确认；A Get 与 D Set 是管理操作请求，不是此题中的主动通知。'),
865:dict(explanation='D。RFC 1918 的 10/8、172.16/12 和 192.168/16 可在彼此独立的网络内复用，常与 NAT/PAT 配合以减少公网 IPv4 地址需求，但不会产生新的公网地址。A 私网范围有限；B 多接收者属于组播而非私网定义；C 网络复杂度取决于设计，地址重叠和 NAT 也可能增加复杂度。私有前缀不应在公共互联网中全局路由，但不能据此保证每台路由器都正确过滤。'),
866:dict(prompt='Refer to the exhibit. What does the value 3553 in the interface output count?',options=[{'label':'A','text':'collisions'},{'label':'B','text':'CRC errors'},{'label':'C','text':'output packets'},{'label':'D','text':'received broadcast packets'}],explanation='D。`Received 3553 broadcasts` 是接口统计中的累计接收广播数；图中 collisions 和 CRC 均为 0，output packets 为 3927。计数器注明从未清除，而 30 秒输入速率为 0；单次累计比例不能证明当前广播风暴，也不能单凭零错误排除其他故障。需连续采样广播速率、流量基线及其他端口状态再判断。'),
867:dict(prompt='For normal Ethernet switching, how is an unknown unicast frame handled?',options=[{'label':'A','text':'flooded to eligible forwarding ports in the same VLAN except the receiving port'},{'label':'B','text':'buffered and forwarded when it has fewer than 5 CRCs'},{'label':'C','text':'forwarded to a neighbor port using CDP'},{'label':'D','text':'sent to a multicast group'}],explanation='A。交换机对未知目的单播通常在同一 VLAN 内向除入端口外的合格转发端口泛洪；STP 状态、VLAN 成员关系、端口隔离或未知单播抑制等策略可限制范围。B CRC 是校验而非允许少于五个错误；存储转发交换机会校验 FCS。C CDP 用于邻居发现，不负责普通帧选路；D 不会因此将目的地址改为组播组。'),
868:dict(prompt='Refer to the exhibit as a list of candidate routes (not an installed routing table). Assume all four entries mean the same destination prefix 10.232.106.0/27, the next hops are reachable, and only one best path is installed. Which interface is selected?',explanation='A。图中写作 `10.232.106.30.27`，并非标准的 CIDR 写法；题设将四项统一理解为覆盖 .30 的 10.232.106.0/27。EIGRP 路径均为 AD 90，优先于 OSPF 的 110；在两条 EIGRP 候选中，F0/9 的度量 6580 小于 F0/16 的 46095，因此单路径下选 F0/9。F0/7 和 F0/24 为 OSPF；不同协议的 metric 不直接比较。实际设备路由安装取决于可达性、协议配置和平台支持，不能把这张示意表当作已安装的路由表。'),
869:dict(explanation='D。无线加密使用密钥将明文转换为密文，并由持有适当密钥的接收方解密，从而保护数据机密性；现代方案还通常提供完整性保护。加密不能阻止无线信号被接收，也不能保证密钥泄露或协议被攻破时内容安全。A 描述威胁检测/防护，B 描述身份认证与访问控制；C 是可能存在的口令策略，而非所有加密机制都要求的字符组合。WPA3-SAE 是认证和密钥建立方式，不能简单当作加密算法。'),
870:dict(prompt='Refer to the exhibit. What is represented by the word "firewall" in the displayed JSON-like data?',explanation='B。图中 `"firewall": "FW37"` 的 `firewall` 是对象成员的键，`FW37` 是字符串值；整个花括号结构是对象，外层方括号结构是数组。图中最后一个元素后有多余逗号，移除才能形成严格合法的 JSON；不影响对该键的识别。')}
reasons={861:'对象也是 JSON 值，限定具体结构并指出末尾逗号。',862:'限定动态学习、VLAN、过滤和老化条件。',863:'核对原图并指出尾随逗号无效。',864:'Inform 是有确认通知但有限重试不保证到达。',865:'私网复用与 NAT 的作用及路由过滤并非绝对。',866:'累计广播数和零当前速率不能证明风暴，改为直接判读计数。',867:'限定未知单播和同 VLAN 合格转发端口。',868:'图中前缀格式非法且候选不等于已安装项；补全条件。',869:'纠正 WPA3-SAE 类型与加密保证的过度断言。',870:'核对原图并指出尾随逗号无效。'}
sources=['https://www.rfc-editor.org/rfc/rfc8259.html','https://www.cisco.com/c/en/us/support/docs/ip/enhanced-interior-gateway-routing-protocol-eigrp/8651-21.html','https://www.rfc-editor.org/rfc/rfc1918.html','https://www.rfc-editor.org/rfc/rfc3416.html']
corrections=[]
for n in range(861,871):
 q=by[n]; c={'id':n,'original_qid':q['qid'],'before_sha256':fp(q),'reason':reasons[n],'updates':updates[n],'original_fields':{k:q[k] for k in updates[n]},'review':{'prompt':'checked','options':'checked','answer':'checked and retained','explanation':'checked and corrected','image':'viewed' if q.get('image') else 'none','code_cli':'checked','finding':reasons[n]}}
 if q.get('image'):
  raw=base64.b64decode(q['image'].split(',',1)[1]); p=audit/'exhibits'/f'q{n}_agent.jpg';assert p.read_bytes()==raw;c.update(has_exhibit=True,exhibit_path=f'exhibits/{p.name}',image_sha256=hashlib.sha256(raw).hexdigest())
 corrections.append(c)
m={'scope':'Q861–Q870','preserve_question_ids':True,'corrections':corrections,'sources':sources,'limitations':'已直接查看所有5张原图；未进行实际网络设备实验。'}
(audit/'agent-0861-0870.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
lines=['# Q861–Q870 逐题审查','', '题干、所有选项、答案、解析、图片和代码均逐项检查；现有ID 861–870 连续，原有 qid 保持不变。','']+[f"- Q{n} ({by[n]['qid']}): {reasons[n]}" for n in range(861,871)]+['','已直接查看原图 Q861、Q863、Q866、Q868、Q870。无实机测试。','', '依据：']+[f'- {s}' for s in sources]
(audit/'agent-0861-0870.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('Prepared IDs',list(range(861,871)))
