import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
audit=root/'Examtopics/audit'
qs=json.loads((root/'Examtopics/output/complete_q1_q1396.json').read_text(encoding='utf-8'))
by={q['id']:q for q in qs}
fp=lambda q:hashlib.sha256(json.dumps(q,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def options(n,changes):
 return [dict(o,text=changes.get(o['label'],o['text'])) for o in by[n]['options']]
updates={
821:dict(prompt='What is a characteristic of RFC 1918 private IPv4 addressing in independently administered, disconnected networks?',explanation='B。RFC 1918 私有地址可以在彼此独立的网络中重复使用，不必申请全球唯一的地址。例如两家未互联的企业均可使用 192.168.1.0/24。若网络后来通过 VPN 或合并互联而地址重叠，则需重新编址、转换或其他消歧方案。\n\nA 私网前缀不应在公共互联网全局路由中发布；C 防火墙外接口也可能连接私有上游，因此不是私网地址的定义；D 私网地址不能作为普通公网全局可路由地址，NAT 或隧道等可提供间接通信。'),
822:dict(answer=['D'],explanation='D。SSID 是用于标识无线服务集的字符串，区分大小写，例如 `Office` 与 `office` 不同。SSID 本身不执行身份验证或加密。\n\nA 单个基本服务集通常用 BSSID 标识；B 密码是某些安全模式的凭据而非 SSID 的定义；C 认证、授权和加密策略可关联 WLAN，但并非 SSID 本身必然阻止未授权用户。原答案 C 忽略了 D 正确且把可选策略误当成 SSID 自带能力。'),
823:dict(prompt='Which use of RFC 1918 private IPv4 addresses is appropriate?',explanation='B。仅需与内部主机通信的设备可以使用 RFC 1918 私有地址；常见网段是 10.0.0.0/8、172.16.0.0/12 和 192.168.0.0/16。私有地址也可在 NAT、代理或隧道等方案下支持外部通信，并非只限于内部通信，也不自动提供安全保护。\n\nA、C、D 所说复杂度、编址便利性与维护成本取决于整体设计，并非使用私有地址必然带来的性质。'),
824:dict(options=options(824,{'C':'uses a cipher to protect the confidentiality of wireless data'}),answer=['C'],explanation='C。无线加密使用密码算法保护无线链路上传输数据的机密性，使无密钥的监听者难以读取明文。认证负责验证身份；某些模式如 CCMP 还提供完整性保护，但加密与身份认证概念不同。\n\nA 是网络标识而非加密；B 密码仅是部分安全模式使用的凭据；D 身份认证是相关但独立的功能。原 D 将认证当成加密的本质，且原 C 描述的是完整性，故修订 C 明确考查机密性并调整答案。'),
825:dict(prompt='Which use of RFC 1918 private IPv4 addresses is appropriate?',explanation='D。仅需内部通信的主机可以使用私有 IPv4 地址；使用 NAT、代理或隧道也可支持外部通信。私网前缀为 10/8、172.16/12、192.168/16；使用私网地址本身既不保证安全，也不意味着自动合规。\n\nA 网络规划是否更简便取决于场景；B 合规需要满足完整控制要求，不能仅凭地址判断；C 路由表规模取决于地址规划与汇总等因素，并非必然缩减。'),
826:dict(options=options(826,{'C':'an access point commonly includes it in beacon frames by default'}),explanation='C。SSID 用来标识无线服务集；常见 AP 默认在周期发送的 Beacon 管理帧中包含 SSID，以便客户端发现网络。发射 Beacon 的是 AP，不是 SSID；具体默认值依产品配置而异，隐藏 SSID 可使 Beacon 不包含明文网络名称，但并非认证或加密。\n\nA SSID 不会阻止蹭网；B 登录提示由认证机制决定；D 不要求同时包含字母和数字。'),
827:dict(options=options(827,{'D':'helps prevent unauthorized reading of data transmitted over the wireless link'}),explanation='D。无线链路加密提供数据机密性，使没有适当密钥的监听者难以读取受保护的数据。无线信号及密文帧仍可能被接收或捕获；链路加密也不自动保证无线链路以外的端到端保密。\n\nA 间谍软件需终端和其他安全措施防护；B 登录提示属于认证过程；C 密码算法不会自动检测或阻止所有零日攻击。'),
828:dict(options=options(828,{'C':'an access point commonly includes it in beacon frames by default'}),explanation='C。SSID 是无线服务集的名称，AP 通常在 Beacon 帧中通告该名称以便客户端发现；隐藏 SSID 时可不在 Beacon 中明文通告。发 Beacon 的是 AP，SSID 本身不广播。\n\nA 威胁拦截属于安全控制；B 编码或加密属于其他机制；D 单个基本服务集由 BSSID 标识，多个 AP 可以使用同一 SSID。'),
829:dict(prompt='Refer to the exhibit. SW2 was replaced and its Fa0/1 configuration copied from SW1, so both ends use dynamic auto. Assume DTP is enabled on both ends, matching trunk encapsulation is supported, VLANs 5 and 10 exist and are allowed, and the PC access ports, addresses and physical links are correctly configured. Which listed command on SW2 Fa0/1 enables PC1 and PC2 to communicate across VLAN 5?',options=options(829,{'D':'switchport trunk allowed vlan remove 10'}),explanation='A。图中 SW2 Fa0/1 为 dynamic auto，允许 VLAN 5、10；题设说明 SW1 复制源端口同为 dynamic auto。两端 auto 不主动发起 trunk 协商，无法形成 trunk；在 SW2 配置 `switchport mode trunk` 后，该端固定为 trunk 并通过 DTP 与 SW1 的 auto 协商形成 trunk。VLAN 5 通过链路后，同 VLAN 的 PC1/PC2 可在其他题设条件满足时通信。\n\nB 只修改 native VLAN，不能使 auto/auto 建立 trunk；C 将 SW2 设为 access，不满足题设；D 仅从 trunk 允许列表移除 VLAN 10，不建立 trunk。若使用 `switchport nonegotiate`，动态 auto 对端不能依赖 DTP 协商，需分别配置两端模式。'),
830:dict(prompt='What is a characteristic of using RFC 1918 private IPv4 addresses within an organization?',options=options(830,{'C':'they can be used internally without registering each address with an Internet registry'}),explanation='C。组织可以在内部使用 RFC 1918 私有地址，无需向互联网注册机构逐个申请或登记；仍应按本组织需要维护 IP 地址分配记录，以避免内部冲突。不同组织可复用相同私网地址，互联时需处理重叠。\n\nA 三个私有地址块合计远多于 65,536 个地址；B 无需与自治系统号一同分配；D ACL 不会使私有地址变为全球可路由地址。')}
findings={821:'限定独立网络地址复用，澄清互联重叠、NAT 和防火墙上游。',822:'SSID 区分大小写；将错误答案 C 改 D，移除把安全策略当作 SSID 固有功能的断言。',823:'内网主机可使用私网但并非唯一用途；删除绝对化成本、安全及强制论述。',824:'原选项将认证误认为加密；改 C 表达无线数据机密性，答案 D 改 C。',825:'私网可用于内部主机，但并不限于内部通信或自动满足安全标准。',826:'AP 发送 Beacon；调整选项表述并说明隐藏 SSID 与默认值的边界。',827:'加密保护机密性但不会阻止截获信号；调整 D 措辞。',828:'修正 Beacon 发送主体并区分 SSID、BSSID。',829:'亲看拓扑及 CLI；补 SW1 DTP、端口、地址条件，修正 D 命令缺少 vlan，纠正 auto 模式和 nonegotiate 错误解释。',830:'无需向外部机构登记不等于组织无需自行跟踪；重写 C 并限定范围。'}
sources=['https://www.rfc-editor.org/info/rfc1918/','https://www.cisco.com/c/en/us/support/docs/wireless-mobility/wlan-security/68583-FAQ-Wireless-Security.html','https://www.cisco.com/c/en/us/td/docs/switches/lan/c9000/lyr2-fwd/vlan/vlan-configuration-guide/configure-vlan-trunks.html']
corrections=[]
for n in range(821,831):
 q=by[n]; changes=updates[n]; image=bool(q.get('image') or q.get('answer_image'))
 c=dict(id=n,original_qid=q['qid'],before_sha256=fp(q),reason=findings[n],updates=changes,original_fields={k:q[k] for k in changes},review=dict(prompt='checked',options='checked',answer='checked and corrected' if 'answer' in changes else 'checked and retained',explanation='checked and corrected',image='viewed' if image else 'none',code_cli='checked',finding=findings[n],references=sources))
 if image:
  c['exhibit_path']='exhibits/q829_agent.jpg';c['image_sha256']=hashlib.sha256((audit/c['exhibit_path']).read_bytes()).hexdigest()
 corrections.append(c)
result=dict(scope='Q821–Q830',preserve_question_ids=True,corrections=corrections,sources=sources,limitations='人工审查，无无线或交换机实机实验。')
(audit/'agent-0821-0830.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
lines=['# Q821–Q830 逐题审查','','逐题检查题干、所有选项、答案、解析、图片和 CLI；修订以相应清单为准。无设备实测。','']
for n in range(821,831):lines.append(f'- Q{n}: {findings[n]}'+(' 原图已直接查看，见 exhibits/q829_agent.jpg。' if n==829 else ' 无配图。'))
lines.extend(['','参考：']+[f'- {s}' for s in sources]);(audit/'agent-0821-0830.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('prepared 10 records')
