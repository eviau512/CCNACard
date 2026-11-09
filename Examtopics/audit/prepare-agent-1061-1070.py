import base64,copy,hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[2]; audit=root/'Examtopics/audit'
s=(root/'CCNA-App/app/src/main/assets/data/ccna_cards_data.js').read_text(encoding='utf-8');qs=json.loads(s[s.index('['):].strip().rstrip(';'));by={q['id']:q for q in qs}
fp=lambda q:hashlib.sha256(json.dumps(q,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
corrections=[]
explanations={
1061:'命令匹配：`show snmp host` 显示配置的通知接收者；`show snmp engineID` 显示本地以及已配置远端 SNMP 引擎标识，部分平台同时显示远端 IP；`show snmp group` 显示组及安全模型；`show snmp community` 显示 community；`show snmp chassis` 显示已配置的 chassis ID（题图称序列号）。具体输出与平台、配置有关，engineID 不是自动发现所有远端设备的地址；chassis ID 不保证总是硬件序列号。',
1062:'分类依据描述符字段划分类；CBWFQ 是 **class-based weighted fair queueing**，在配置且平台支持时为指定类在拥塞时提供带宽保障；整形通过缓冲平滑输出，不能保证杜绝下游拥塞；监管依限速规则丢弃、重新标记或传送超额流量；资源竞争可能引起拥塞。原图误写 cloud-based，答案图中 policing 与 CBWFQ 的目标也对调；请以修正后的交互标签及配对为准。',
1063:'检测（fault detection）发现性能下降或中断；关联聚合把相关告警归组；诊断隔离定位可能的原因；解决（problem resolution）可由管理员消除故障源；恢复服务可以执行预置脚本恢复功能。自动关联不保证找到根因，恢复也未必代表根因已被永久消除。原题是通用故障管理流程，系统可利用 SNMP，但不是所有步骤均由 SNMP 本身实现。',
1064:'四个正确项是维护地址池、基于客户端/服务器的网段控制、减少终端上线的手工配置、按可配置租约分配地址。DHCP 也可以通过 option 6 向客户端提供 DNS 服务器地址，因此原图中的 “offers domain name server configuration” 也是有效功能；为使四空唯一，交互项改为运行权威 DNS 名称解析。域名与地址的记录解析及权威 DNS 区域服务属于 DNS；DHCP 能分发 DNS 配置但不等于自身提供权威解析。租约和 relay 的行为取决于服务配置。',
1065:'认证验证身份：标识用户并校验凭据；授权决定允许执行的操作及可用服务；记账记录会话及操作以供管理员分析。每组内两个空可互换；实际是否记录命令或其他字段取决于配置，不能假定所有活动都会自动留痕。',
1066:'按 Cisco WLC 的配置分类，WPA/WPA2 和 802.1X 属于 Layer 2 配置；web policy 与 passthrough 在该题的 Layer 3 Web 策略类别中。同组答案可交换。802.1X 是端口访问控制框架，WPA/WPA2 为无线安全机制；Web passthrough 可能只要求接受条款，不能等同于验证用户身份，也不能保证空口加密。具体组合取决于控制器软件。',
1067:'双标签攻击：避免将用户接入口放进 trunk 所用 native VLAN，并采用专用未用 native VLAN；仅更改默认 VLAN 编号不自动防御。MAC flooding：802.1X 限制未授权设备接入，仍需结合端口安全和限制，不能保证已认证设备不会发送大量伪源 MAC。DHCP snooping 可阻挡非信任端口伪 DHCP 响应，从而缓解该类中间人；不能单独阻止所有 ARP 欺骗，可结合 DAI。禁用 DTP、将接入口显式配置为 access 可降低交换机伪装协商 trunk 风险。原答案图将中间两项对调，以交互配对为准。',
1068:'从 User EXEC 依次 `enable` → `configure terminal` → `enable secret $hf!@4fs` → `exit`。题目假定已具备进入特权模式的权限；`enable secret` 配置的是特权口令散列而非可逆加密，具体类型由平台和配置决定，旧类型可能不安全。`service password-encryption` 是可逆的 Type 7 混淆，不能替代 secret；`line vty 0 4` 是线路配置。',
1069:'假定接口已经处于 access 模式：启用 port-security、启用 sticky 学习、设置最多两个安全源 MAC、将违规动作设置为 shutdown。Sticky 将动态学习到的地址加入运行配置；持久化需保存配置，变化的设备可能触发违规。shutdown 在违反安全源 MAC 规则时使端口进入 err-disabled；它限制不同源 MAC 数量，不是对广播、多播或未知单播的流量速率限制。阻止高流量风暴还需依平台配置 storm control。',
1070:'记账可记录远程会话时长并经 TACACS+ 记录管理命令；授权可对所支持的 RADIUS 用户网络服务授权，也可限制 CLI 命令。每组两项顺序可交换。原题干扰项 “user- or group-based access” 也可描述授权，导致授权项不止两个；交互选项改为验证凭据，使题目唯一。实际协议支持及命令授权能力依设备而异，验证凭据属于认证。'
}
prompts={1061:'DRAG DROP - Match each SNMP command to the described output. Assume the relevant remote engine and chassis identifier are configured on a platform that supports these commands.',1062:'DRAG DROP - Match the corrected QoS terms to their descriptions. The original exhibit misspells class-based as cloud-based and its answer diagram has two mappings swapped; use the interactive labels.',1064:'DRAG DROP - Select four DHCP functions. The interactive choices correct a DNS-related ambiguity in the original image.',1067:'DRAG DROP - Match the listed techniques to the specific attack scenarios they can help mitigate. Assume native VLAN isolation, authenticated access and the relevant DHCP trust boundaries are configured; the original answer diagram swaps the two middle answers.',1068:'DRAG DROP - Starting in user EXEC, assuming permission to enter privileged EXEC and an existing local user database, put the commands in order to configure an enable secret. Not all commands are used.',1069:'DRAG DROP - An interface is already configured as a static access port. Arrange the shown commands to enable port security, learn up to two secure MAC addresses with sticky learning, and shut the port down on a security violation. This controls source MAC addresses, not traffic rate. Not all commands are used.',1070:'DRAG DROP - Match the displayed features to accounting and authorization. The interactive choices correct an ambiguous distractor in the original image; not all choices are used.'}
for n in range(1061,1071):
 q=by[n]; update={'explanation':explanations[n]}
 if n in prompts:update['prompt']=prompts[n]
 if n in (1062,1064,1070):
  d=copy.deepcopy(q['drag_drop_data'])
  a,b={1062:('cloud-based weighted fair queueing','class-based weighted fair queueing'),1064:('offers domain name server configuration','operates an authoritative DNS server for name resolution'),1070:('It enables the device to allow user- or group-based access.','It verifies user or group identity using credentials.')}[n]
  d['sources']=[b if x==a else x for x in d['sources']]
  for t in d['targets']:
   if t['expected']==a:t['expected']=b
  update['drag_drop_data']=d
 imgs=[]
 for field in ('image','answer_image'):
  raw=base64.b64decode(q[field].split(',',1)[1]);p=audit/f'exhibits/q{n}_{field}_agent.png';assert p.read_bytes()==raw;imgs.append({'field':field,'path':str(p.relative_to(audit)).replace('\\','/'),'sha256':hashlib.sha256(raw).hexdigest()})
 corrections.append(dict(id=n,original_qid=q['qid'],before_sha256=fp(q),reason=explanations[n],updates=update,review=dict(prompt='checked and corrected' if n in prompts else 'checked',options='drag-and-drop choices and targets checked',answer='interactive mappings checked against both images and technical facts',explanation='checked and corrected',image='viewed',code_cli='checked',finding=explanations[n],images=imgs)))
m={'scope':'Q1061–Q1070','corrections':corrections,'sources':['https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/snmp/command/nm-snmp-cr-book.pdf','https://www.cisco.com/en/US/docs/ios/12_0t/12_0t5/feature/guide/cbwfq.html','https://www.rfc-editor.org/rfc/rfc2132#section-3.8','https://www.cisco.com/c/en/us/td/docs/switches/lan/c9000/lyr2-fwd/cdp-lldp-mac-udld/cdp-lldp-mac-udld-configuration-guide/configure-mac.html'],'limitations':'人工核对原题图和答案图及公开资料，未作设备实测。'}
(audit/'agent-1061-1070.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(audit/'agent-1061-1070.md').write_text('# Q1061–Q1070 逐题审查\n\n'+ '\n\n'.join(f"- Q{c['id']}：{c['reason']}" for c in corrections)+'\n\n逐题核对原题图和答案图，详细路径、哈希及修订见机器清单；未做设备实验。\n',encoding='utf-8')
print('Wrote 10 corrections.')
