import hashlib,json
from pathlib import Path
r=Path(__file__).resolve().parents[2]; p=r/'CCNA-App/app/src/main/assets/data/ccna_cards_data.js';s=p.read_text(encoding='utf-8');qs=json.loads(s[s.index('['):].strip().rstrip(';'));by={q['id']:q for q in qs}
fp=lambda q:hashlib.sha256(json.dumps(q,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
updates={
921:dict(prompt='An engineer must perform initial management of an AP that has an available console port but no configured IP address or dial-up service. Which connection provides direct local CLI access?',options=[dict(label=o['label'],text='VTY' if o['label']=='C' else o['text']) for o in by[921]['options']],explanation='D。可用的 console 串口支持本地终端连接，不依赖 AP 已有 IP 地址或拨号服务。A 的 AUX 可用于某些设备的远程拨号，但这里没有拨号服务；C 的 VTY 通常通过网络上的 SSH/Telnet 访问；B 的以太网可承载网络管理，本题要求没有配置 IP 时的直接本地 CLI。线缆、串口参数和接口支持依型号而异；不能保证 console 在所有故障下都可用。'),
922:dict(prompt='Which general access-control function can an enterprise firewall provide?',options=[dict(label=o['label'],text='It always inspects traffic without maintaining connection state.' if o['label']=='C' else o['text']) for o in by[922]['options']],explanation='A。防火墙可根据策略允许或拒绝穿过它的入站和出站流量。C 的 always 错误：有状态防火墙可利用连接状态，而其他产品也可能提供无状态规则。B 并非防火墙的通用功能；D 可能描述某种部署位置，但并不定义访问控制。允许或拒绝的实际结果取决于规则、连接状态和流量是否经过设备，不能保证阻止所有攻击。'),
923:dict(prompt='Which protocol uses agents on managed devices to exchange management information with monitoring tools for performance monitoring and troubleshooting?',explanation='D。SNMP 管理站可查询被管设备上的 agent 暴露的管理对象，也可接收 agent 发送的通知；常见 UDP 端口为请求 161、通知 162。NFS 用于文件共享，FIP 常指 FCoE 初始化协议；NIP 不是此处的 SNMP 组件。采集和通知的可用性依设备、版本及配置而定；使用 SNMPv3 时可配置认证和加密。'),
924:dict(explanation='B。IPv6 组播地址标识一组接口，报文可交付给符合范围和组成员条件的多个接收者；任播地址标识多个接口，路由通常选择其中按路由度量最近的一个，最近不必是地理距离最近，也不保证接收。组播使用 ff00::/8；任播从单播地址空间分配，没有单独前缀。A 的前缀和转发方向有误；C 将过渡技术与地址类型混淆；D 的 all-routers 地址属于组播。'),
925:dict(prompt='On Cisco IOS, which severity name corresponds to the 5 in a typical %LINEPROTO-5-UPDOWN message?',explanation='D。示例 `%LINEPROTO-5-UPDOWN` 中的 5 表示 notifications（severity 5）。informational 为 6，alerts 为 1，debugging 为 7。日志接收端的阈值通常包括所设级别及数值更小、更严重的消息，因此级别 6 或 7 的阈值也可以显示 severity 5；此题询问消息自身的级别名称，而非唯一能接收它的阈值。具体消息和配置依平台而异。'),
926:dict(prompt='Which device is designed primarily to enforce security policy on traffic between an internal network and the Internet?',explanation='B。防火墙可按策略控制跨边界的入站和出站流量，并可能支持有状态检查。路由器以选路为主要功能，也可具备 ACL 或防火墙功能；接入点提供无线接入，二层交换机主要转发帧，但也可提供某些安全控制。NAT 不等于防火墙；具体策略和位置决定实际保护范围，单一设备不能保证阻止所有威胁。'),
927:dict(prompt='In an ESP-protected IP packet, which IPsec mode leaves the original IP header, including its source and destination addresses, outside the encrypted ESP payload?',explanation='C。ESP transport mode 将原始 IP 首部留在 ESP 保护载荷之外；在启用保密性算法时，上层报文通常被加密。ESP tunnel mode 将原始 IP 包封装在 ESP 中，并使用新的外层 IP 首部；外层地址仍需明文供转发。站点到站点 VPN 常使用 tunnel mode，若只说“看到源和目的地址明文”而不区分内外层，不能唯一判断模式。PPTP、SSH、PPPoE 均不是所问的 IPsec 封装模式。具体加密和完整性取决于安全关联。'),
928:dict(explanation='C。使用经过审查的模板、参数和验证流程批量管理设备，可减少重复手工输入造成的配置不一致。自动化仍可能将模板错误批量传播，设备差异和变更也可能造成漂移，所以需要测试、审查及持续核对。A 的逐台操作仍可由脚本执行，但不是此处相对于人工管理的主要目标；B 不属于常规网络配置自动化目标；D 增加经常成本不是题目所求收益，实际成本视方案而定。'),
929:dict(prompt='Refer to the exhibit. Choose the single option containing both static-route commands for R1 to reach the shown PCs behind R2 and R3. Assume the shown host gateways and return routes are correctly configured for this lab.',explanation='A。图中 R2 的下一跳为 192.168.2.3，R3 为 192.168.2.2。R1 将 10.10.10.0/24 指向 R2，并将 PC5 的 10.10.10.10/32 指向 R3；匹配 PC5 时 /32 比 /24 更长，因此使用 R3。B 的网段路由方向错误；C 的 g0/0 面向 PC1；D 的目的及下一跳安排不满足所示目标。图示的两个目的侧链路都标为同一 /24，属于重叠地址的特殊实验，不能据此假设这些目的主机之间可直接互通；题设另行保证网关和回程可达。'),
930:dict(explanation='D。图中已安装的直连路由 172.18.32.36/30 覆盖 .36–.39，目的 .38 匹配；该 /30 比同时匹配的 /26、/24 和 /19 更具体。Loopback0 的 .32/32 和本地接口的 .37/32 均不匹配 .38，因此从 GigabitEthernet0/0 转发。这里依据已安装的路由表执行最长前缀匹配；管理距离与协议度量用于候选路由选择，不能简单地将不同协议的度量直接比较。数据包源地址不影响题设中的常规目的路由查找。')}
refs={923:'https://www.rfc-editor.org/rfc/rfc3411',924:'https://www.rfc-editor.org/rfc/rfc4291',925:'https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/network-mgmt/configuration/xe-16-10/nm-xe-16-10-book/nm-syslog.html',927:'https://www.rfc-editor.org/rfc/rfc4303',929:'https://www.cisco.com/c/en/us/support/docs/ip/ip-routed-protocols/13537-12.html',930:'https://www.cisco.com/c/en/us/support/docs/ip/ip-routed-protocols/13537-12.html'}
cor=[]
for n in range(921,931):
 q=by[n]; u=updates[n]; img=bool(q.get('image') or q.get('answer_image')); info=dict(prompt='checked and clarified' if 'prompt' in u else 'checked',options='checked and corrected' if 'options' in u else 'checked',answer='checked and retained',explanation='checked and corrected',image='viewed' if img else 'none required',code_cli='checked; option command line breaks retained' if n==929 else 'checked',finding=u['explanation'].split('。')[0]+'。',reference=refs.get(n))
 c=dict(id=n,before_sha256=fp(q),original_qid=q['qid'],updates=u,review=info)
 if img:
  f=r/f'Examtopics/audit/exhibits/q{n}_agent.jpg';c.update(exhibit_path=f'exhibits/q{n}_agent.jpg',image_sha256=hashlib.sha256(f.read_bytes()).hexdigest())
 cor.append(c)
m=dict(scope='Q921–Q930',preserve_question_ids=True,corrections=cor,limitations='人工阅读题目及两幅原图；未进行设备实验。')
out=r/'Examtopics/audit/agent-0921-0930.json';out.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
lines=['# Q921–Q930 逐题审查','', '逐项核对题干、所有选项、答案、解析、图片和代码；Q929、Q930 已直接查看原图，答案均保留。未执行设备实验。','']
for c in cor:
 lines.append(f"- Q{c['id']}：{c['review']['finding']} 图片：{c['review']['image']}；CLI：{c['review']['code_cli']}。"+(f" 参考：{c['review']['reference']}" if c['review']['reference'] else ''))
(r/'Examtopics/audit/agent-0921-0930.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('prepared',len(cor),'corrections')
