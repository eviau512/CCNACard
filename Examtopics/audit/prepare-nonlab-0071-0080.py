import hashlib,json
from pathlib import Path

root=Path(__file__).resolve().parents[2]
s=(root/'CCNA-App/app/src/main/assets/data/ccna_cards_data.js').read_text(encoding='utf-8')
qs=json.loads(s[s.index('['):].strip().rstrip(';')); by={q['id']:q for q in qs}
changes={
72:dict(prompt='Refer to the exhibit. On a DNS cache miss, the Windows PC uses the displayed DNS server configuration for a conventional DNS query for www.cisco.com. To which IP address is the DNS request addressed?', explanation='A。图中 DNS Servers 为 192.168.1.253；在题设缓存未命中且使用该配置的传统 DNS 查询时，DNS 报文的目标 IP 是 .253。常见查询使用 UDP 53，某些情况使用 TCP；浏览器另行配置的加密 DNS 或缓存命中会改变实际行为。B 的 .100 是默认网关，若目的地址不在本地网段可作为二层下一跳，但不会替代 DNS 服务器的目的 IP；此处 .253 和 .226 在同一 /24。C 是本机地址，D 是 DHCP 服务器；同一设备可以提供多种服务，但图中 DNS 项决定本题答案。'),
73:dict(explanation='D。交换机依据同一 VLAN 中的目的 MAC 表项将已知单播帧从相应转发端口送出，称为帧交换或转发。动态源 MAC 学习与老化由平台和配置决定。A 泛洪用于未知单播等情况；B 的过滤是在需要时抑制转发，例如目标与入端口相同；C 不是此处标准交换功能。广播通常向同 VLAN 的其他转发端口泛洪，组播可能受 IGMP snooping 等约束，STP、ACL 和端口状态也会限制可用出口，不能一概说组播从全部端口送出。'),
74:dict(prompt='Which type of IPv6 address uses unicast address syntax but is assigned to multiple interfaces, with packets normally delivered to one of them?',explanation='C。IPv6 任播使用单播地址格式，将同一地址分配给多个接口；发送到该地址的报文通常交付给路由系统认为最近的一个接口。最近依据路由策略与度量，并不保证物理距离最短；ECMP、故障及路由变化也会影响路径。A 和 B 是单播作用域类型，并不是题目描述的地址用途；D 多播以 FF00::/8 标识接口组，报文由多播路由和成员关系决定其分发，而不是任播的一选一交付。任播节点不要求属于同一条本地链路。'),
78:dict(options=[dict(label=o['label'],text=o['text'].replace('R7#','R7 (global configuration):').replace('R8#','R8 (global configuration):').replace('R9#','R9 (global configuration):')) for o in by[78]['options']],explanation='D。图示 R7 的 10.88.31.64/26 最后可用地址为 .126（广播 .127）；R8 的 10.19.63.80/28 为 .94（广播 .95）；R9 的 10.23.98.128/27 为 .158（广播 .159）。D 的三个地址及掩码均匹配。A 采用对应广播地址；B 的三个掩码不符合图示；C 同时存在广播地址和掩码错误。设备标题用于区分配置归属，进入各设备全局配置模式后再逐行输入 interface 和 ip address。'),
79:dict(prompt='In a conventional query/response exchange without TCP Fast Open, how do TCP and UDP differ before application data is transferred?',options=[dict(label=o['label'],text=('TCP establishes a connection before normal application data transfer; UDP requires no transport-layer connection setup.' if o['label']=='B' else o['text'])) for o in by[79]['options']],explanation='B。通常 TCP 先建立连接，再交付应用数据；UDP 不需要传输层连接建立即可发送数据报。UDP 不保证报文立即到达、按序到达或一定送达，应用仍可自行重试。TCP 使用序列号、确认和重传实现可靠有序字节流，A/C 错误；TCP 和 UDP 均有差错检测机制，UDP 本身不提供 TCP 式重传恢复，D 错误。例外：TCP Fast Open（RFC 7413）允许在连接握手期间携带和交付数据，因此题干明确排除该机制。'),
80:dict(prompt='In a controller-based enterprise WLAN using lightweight access points, which component centrally coordinates client authentication and roaming?',explanation='B。WLC 对轻量 AP 提供集中管理，并可与 AAA/RADIUS 协同处理认证策略、协调客户端跨 AP 的移动性；具体转发与认证位置依架构和配置不同。快速漫游是否生效取决于客户端、AP、控制器和协议兼容性，不能保证毫秒级无缝切换，也不保证总能跳过完整认证。A 负责无线接入但不是本题集中协调组件；C 防火墙和 D 有线交换机有各自职责，但不是题设 WLAN 控制器。')}
out=[]
for n,u in changes.items():
 q=by[n];fp=hashlib.sha256(json.dumps(q,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest();out.append(dict(id=n,before_sha256=fp,reason='逐题核验技术前提、选项与解析，消除绝对化和配置格式歧义。',updates=u))
(root/'Examtopics/audit/nonlab-0071-0080.json').write_text(json.dumps(dict(scope='Q71–Q80 non-lab',corrections=out),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
