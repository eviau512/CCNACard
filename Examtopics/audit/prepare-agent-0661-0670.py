import json, hashlib
from pathlib import Path

root = Path(__file__).resolve().parents[2]
out = root / 'Examtopics/audit'
questions = {x['id']: x for x in json.loads((root / 'Examtopics/output/complete_q1_q1396.json').read_text(encoding='utf-8'))}
def fp(x):
    return hashlib.sha256(json.dumps(x, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
def options(n, texts):
    return [dict(o, text=t) for o,t in zip(questions[n]['options'], texts)]

changes = {}
def fix(n, reason, **fields):
    changes[n] = {'id':n, 'original_qid':questions[n]['qid'], 'before_sha256':fp(questions[n]), 'reason':reason, 'updates':fields}

fix(661,'修正SSID字符集、长度和安全性过度概括。',explanation='C。SSID区分大小写；例如 `Company` 与 `company` 是不同的SSID值。SSID元素最多包含32个八位字节，长度以字节而非显示字符计算；可用字符及编码受设备实现限制。SSID是网络名称，本身不提供认证或加密。\n\nA没有必须同时包含数字和字母的通用要求；B不是Cisco专有安全特性；D无线网络可映射到VLAN，但SSID本身不定义交换机VLAN。')
fix(662,'取消SSID必须一一对应独立VLAN及服务端口适用所有型号的绝对描述。',explanation='B。交换机与WLC分配系统端口之间的802.1Q trunk可在同一链路的数据路径上承载多个允许的VLAN；具体SSID、接口和VLAN映射取决于无线架构与配置，不要求每个SSID都映射到不同VLAN。\n\nA链路冗余需要其他设计而非trunk本身；C带外管理不是配置数据trunk的目的；D配置trunk不提供或消除物理冗余。')
fix(663,'图中SSID广播已选；隐藏SSID并非认证或加密，54 Mbps是物理速率而非保证吞吐量。',prompt='Refer to the exhibit. An administrator wants to disable the SSID name in beacon broadcasts and select a 2.4 GHz 802.11g radio policy with a maximum nominal PHY rate of 54 Mbps. Assume the WLC supports the listed policies. Which tasks meet these settings?',explanation='C。图中Broadcast SSID已启用、Radio Policy为All；取消该勾选并选择802.11g only满足题设。802.11g工作于2.4 GHz，最高标称物理速率54 Mbps，并非应用吞吐量的保证。\n\nA包含5 GHz的802.11a；B仍广播SSID；D选择802.11a且仍广播SSID。隐藏SSID不构成有效认证或加密，不能代替WPA2/WPA3等安全机制；图中显示的WPA2/802.1X配置才与接入保护有关。')
fix(664,'修正老化不能保证抗MAC flooding或保证永远有表项空间，默认值依平台而异。',explanation='A。交换机对动态学习的源MAC地址表项设置老化机制，长期没有被刷新时可删除相应条目，为其他动态条目腾出空间。老化时间依平台和配置而异，静态表项通常不按动态表项老化。老化本身不能保证表永不满，也不能阻止持续生成活跃源地址的MAC flooding攻击。\n\nB MAC move是地址所学习端口改变；C不是这里所问的机制；D dynamic learning负责学习源MAC，而非删除超时记录。')

sw1a='SW1(config)# interface Gi0/1\n switchport mode trunk\n switchport trunk allowed vlan 5,7,9,108\n switchport trunk native vlan 5\nSW1(config)# interface Gi0/2\n switchport mode trunk\n switchport trunk allowed vlan 5,7,9,108'
sw2a='SW2(config)# interface Gi0/1\n switchport mode access\n switchport access vlan 7\nSW2(config)# interface Gi0/7\n switchport mode trunk\n switchport trunk allowed vlan 7,9,108'
sw1b='SW1(config)# interface Gi0/1\n switchport mode trunk\n switchport trunk allowed vlan 5,7,9,108\n switchport trunk native vlan 5\nSW1(config)# interface Gi0/2\n switchport mode access\n switchport trunk allowed vlan 7,9,108'
sw2b='SW2(config)# interface Gi0/1\n switchport mode access\n no switchport access vlan 1\n switchport access vlan 7\nSW2(config)# interface Gi0/7\n switchport mode trunk\n switchport trunk allowed vlan 7,9,108\n switchport trunk native vlan 5'
sw1c=sw1a+'\n switchport trunk native vlan 5'
sw2c='SW2(config)# interface Gi0/1\n switchport mode access\n switchport access vlan 7\nSW2(config)# interface Gi0/7\n switchport mode trunk\n switchport trunk allowed vlan 5,7,9,108\n switchport trunk native vlan 5'
sw1d='SW1(config)# interface Gi0/1\n switchport mode trunk\n switchport trunk allowed vian 5,7,9,108\nSW1(config)# interface Gi0/2\n switchport mode trunk\n switchport trunk allowed vlan 7,9,108'
sw2d='SW2(config)# interface Gi0/1\n switchport mode trunk\n switchport trunk allowed vlan 7\nSW2(config)# interface Gi0/7\n switchport mode trunk\n switchport trunk allowed vlan 5,7,9,108'
fix(665,'恢复选项CLI逐行格式，C补路由器侧trunk native VLAN 5，明确路由和主机前提，缩窄VLAN 1要求。',prompt='Refer to the exhibit. SW1 and SW2 Gi0/0 access ports, the VLANs, host addressing and gateways, and R1 subinterfaces for VLANs 7, 9, 108 and native VLAN 5 are already configured correctly. Choose the switch configuration that permits inter-VLAN routing, uses VLAN 5 for untagged traffic on the shown trunk links, and excludes VLAN 1 from user data on those trunks.',options=options(665,[sw1a+'\n'+sw2a,sw1b+'\n'+sw2b,sw1c+'\n'+sw2c,sw1d+'\n'+sw2d]),explanation='C。图中SW1 Gi0/1与SW2 Gi0/7互联，SW1 Gi0/2连接R1；这三个端口均为trunk，允许VLAN 5、7、9、108，native VLAN设为5。SW2 Gi0/1为VLAN 7的access口。已假定路由器子接口、主机与其余接入口配置正确。\n\nA未在SW2互联口配置native VLAN 5或允许VLAN 5；B把路由器链路设为access且SW2 trunk未允许VLAN 5；D把PC口设为trunk并漏配必要VLAN，且含`vian`拼写错误。原C漏了SW1 Gi0/2的native VLAN设置，已补齐。将VLAN 1排除出用户数据的trunk允许列表不意味着所有控制协议帧都被禁用。')
fix(666,'还原CLI换行，补充到C接口已启用和其他接口不发送的前提。',prompt='Refer to the exhibit. Router A has CDP enabled on Gi0/0/0 and Gi0/0/1, and no other CDP-enabled interfaces. How should Router A be configured so that it sends CDP information only toward Router C?',options=options(666,['Router A# configure terminal\nRouter A(config)# no cdp run\nRouter A(config)# interface gi0/0/1\nRouter A(config-if)# cdp enable','Router A# configure terminal\nRouter A(config)# cdp run\nRouter A(config)# interface gi0/0/0\nRouter A(config-if)# no cdp enable','Router A# configure terminal\nRouter A(config)# cdp run\nRouter A(config)# interface gi0/0/1\nRouter A(config-if)# cdp enable','Router A# configure terminal\nRouter A(config)# cdp run\nRouter A(config)# interface gi0/0/0\nRouter A(config-if)# cdp enable']),explanation='B。图中Router A的Gi0/0/0通向B，Gi0/0/1通向C。全局启用CDP并在Gi0/0/0接口执行 `no cdp enable`，题设已经启用的Gi0/0/1仍可向C发送。\n\nA关闭全局CDP，接口启用无法代替全局启用；C未关闭通往B的接口；D使通往B的接口保持启用。CDP为直连发现协议，配置禁用该接口上的收发。')
fix(667,'展图为10.0.0.252/30而非10.0.0.0/30；恢复代码格式并指出目标在ISP而非R1。',prompt='Refer to the exhibit. On the device shown, an administrator must turn off Cisco Discovery Protocol on the interface configured with the last usable address in the 10.0.0.252/30 subnet. Which command set meets the requirement?',options=options(667,['interface gi0/1\n no cdp enable','interface gi0/0\n no cdp run','interface gi0/0\n no cdp advertise-v2','interface gi0/1\n clear cdp table']),explanation='A。图中10.0.0.252/30的网络地址为.252，可用主机为.253和.254，广播地址为.255；最后可用地址.254位于ISP设备Gi0/1，因此在该设备的接口配置模式输入 `no cdp enable`。图中R1 Gi0/0为.253。\n\nB和C指向另一接口，且全局CDP命令不能替代接口禁用；D清除邻居表并不持续关闭CDP。原题写10.0.0.0/30，与图不符，已更正。')
fix(668,'避免对所有WLC机型及本地交换流量作绝对化断言。',explanation='D。在题设传统WLC端口分类中，distribution system端口连接有线交换网络，承载正常AP与控制器之间的控制及集中转发数据。具体端口功能与平台架构有关；例如FlexConnect本地交换业务并不都穿过控制器。\n\nA redundancy端口用于高可用同步；B service端口用于带外管理；C console端口用于本地管理，均非此题所需的普通AP业务连接。')
opts=options(669,[x['text'] for x in questions[669]['options']]);opts[0]['text']='The tunnel uses the IPsec protocol for encapsulation.'
fix(669,'限定AireOS 8.5.164.0，区分启用特性与启用后数据加密默认值可再调整，修正IPsec拼写和不可靠端口断言。',prompt='On a supported Cisco AireOS 8.5.164.0 WLC, after the encrypted mobility tunnel feature is enabled, which encryption setting is enabled by default?',options=opts,explanation='B。Cisco AireOS 8.5.164.0文档说明：启用控制器加密后控制与数据流量默认均加密，但数据加密可依网络需要另行禁用。特性本身并非所有设备默认启用，且有平台、对端及版本限制。\n\nA此功能使用CAPWAP DTLS而非题设所述IPsec；C加密模式的数据使用UDP 16667替代旧的EoIP；D不是此功能所列端口。具体控制与数据端口行为应按设备及版本文档和配置核验。')
fix(670,'原题要求阻止具备P2P能力的客户端接入，原答案D误将流量隔离当作阻止关联。根据Cisco Wi-Fi Direct策略修正答案并限定适用对象。',prompt='Refer to the exhibit. For this WLAN, an administrator wants to prevent Wi-Fi Direct clients from associating, using the controller policy shown. Which setting should be applied?',answer=['A'],explanation='A。将Wi-Fi Direct Client Policy设为Not-Allow可拒绝Wi-Fi Direct客户端关联该WLAN；图中该策略当前为Disabled。Cisco说明该策略的能力和适用条件取决于控制器版本及AP模式。\n\nD的P2P Blocking Action=Drop是限制受支持路径中的客户端间数据转发，不等于拒绝Wi-Fi Direct客户端关联，也不保证阻止所有直接无线链路；B的ACL取决于具体规则，不能由题目推断实现该功能；C的MFP针对管理帧保护，与Wi-Fi Direct客户端的关联策略不同。原答案D混淆设备关联控制与流量隔离，已改为A。')

assert sorted(changes)==list(range(661,671))
sources={'ssid':'https://www.cisco.com/c/en/us/support/docs/wireless-mobility/wireless-lan-wlan/98138-ssid-bss.html','trunk':'https://www.cisco.com/c/en/us/td/docs/switches/lan/c9000/lyr2-fwd/vlan/vlan-configuration-guide/configure-vlan-trunks.html','mobility':'https://www.cisco.com/c/en/us/td/docs/wireless/controller/8-5/config-guide/b_cg85/encrypted_mobility_tunnel.html','direct':'https://www.cisco.com/c/en/us/td/docs/wireless/controller/7-6/configuration-guide/b_cg76/b_cg76_chapter_01000001.pdf'}
per_question={
661:('SSID规范题；题干选项完整；C正确；原解析夸大ASCII和网络隔离，已修订。','无图与CLI。',['ssid']),
662:('WLC trunk题；四选项完整；B正确；原解析一SSID一VLAN的说法错误，已修订。','无图与CLI。',['trunk']),
663:('原图SSID broadcast已勾选、radio policy为All；原题误称安全和吞吐，限定指标后C正确。','原图已查看，图示完整；无CLI。',['ssid']),
664:('MAC老化题；A正确；解析错误声称有效防MAC flooding，已删除。','无图与CLI。',[]),
665:('图示PC VLAN及端口逐一核对；原C缺native VLAN，补齐前提及命令后C正确。','原图已查看；四选项CLI已还原换行，原D拼写错误作为干扰项保留。',['trunk']),
666:('图示A的Gi0/0/0通B，Gi0/0/1通C；补全接口初始状态，B正确。','原图已查看；各选项CLI恢复换行。',[]),
667:('原图ISP Gi0/1为.254、R1 Gi0/0为.253；题干原子网错误，修正后A正确。','原图已查看；选项CLI恢复换行。',[]),
668:('传统WLC接口功能题；D正确，删去所有数据必经WLC的绝对化表述。','无图与CLI。',[]),
669:('8.5.164.0加密特性启用后控制和数据默认加密；B正确，限定版本并更正解析。','无图与CLI。',['mobility']),
670:('原题阻止具备直连能力客户端关联，D仅隔离流量；限定Wi-Fi Direct并改答案A。','原图已查看，显示Wi-Fi Direct Clients Policy Disabled；无CLI。',['direct']),
}
reviews=[{'id':n,'content_answer_explanation':per_question[n][0],'image_code':per_question[n][1],'source_urls':[sources[k] for k in per_question[n][2]],'original_sha256':fp(questions[n]),'corrected_answer':changes[n]['updates'].get('answer',questions[n]['answer'])} for n in changes]
package={'scope':'Q661-Q670 manual review and proposed direct corrections','corrections':list(changes.values()),'reviews':reviews,'sources':sources,'images_directly_viewed':[f'exhibits/q{n}_agent.jpg' for n in (663,665,666,667,670)],'limitations':'No live WLC or IOS tests; corrections require integration into shared source and generated files.'}
(out/'agent-0661-0670.json').write_text(json.dumps(package,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
report='# Q661–Q670 逐题审查\n\n逐题核对题干、全部选项、答案、解释及原图/CLI；五幅原图已直接查看。下列修订已写入机器可应用的清单，尚待合并到共享题库。\n\n|题号|审查与修订|\n|---|---|\n'+''.join(f'|{n}|{changes[n]["reason"]}|\n' for n in changes)+'\n参考：\n'+''.join(f'- [{name}]({url})\n' for name,url in sources.items())+'\n未进行真实WLC或IOS设备实验。\n'
(out/'agent-review-0661-0670.md').write_text(report,encoding='utf8')
print('Prepared',len(changes),'corrections')
