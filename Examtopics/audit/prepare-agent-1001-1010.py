import json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2];audit=root/'Examtopics/audit'
s=(root/'CCNA-App/app/src/main/assets/data/ccna_cards_data.js').read_text(encoding='utf-8');data=json.loads(s[s.index('['):].strip().rstrip(';'));by={q['id']:q for q in data}
fp=lambda q:hashlib.sha256(json.dumps(q,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
sources={'etherchannel':'https://www.cisco.com/c/en/us/td/docs/switches/lan/c9000/lyr2-fwd/etherchannel/etherchannel-configuration-guide/m_ethernetchannel.html','flood':'https://www.cisco.com/c/en/us/support/docs/switches/catalyst-6000-series-switches/23563-143.html','eui':'https://www.rfc-editor.org/rfc/rfc4291#appendix-A'}
out=[]
for n in range(1001,1011):
 q=by[n];u={};reason='';source=[]
 if n in (1001,1006):
  u['prompt']='Refer to the exhibit. The displayed interfaces are Layer 2 ports, have compatible speed, duplex and VLAN settings, and have no conflicting channel configuration. Which command set configures an LACP EtherChannel?'
  modes=['auto','desirable','on','active'];u['options']=[{'label':label,'text':f'SW1(config)# interface range f0/13 - 14\nSW1(config-if-range)# channel-group 1 mode {mode}\nSW2(config)# interface range f0/13 - 14\nSW2(config-if-range)# channel-group 1 mode passive'} for label,mode in zip('ABCD',modes)]
  u['explanation']='D。图中两条链路分别连接 SW1 和 SW2 的 Fa0/13、Fa0/14。SW1 的 `active` 主动发送 LACP 报文，SW2 的 `passive` 响应，可协商同一 LACP 聚合；还需题设中的二层接口、速率、双工和 VLAN 等条件兼容。A 的 auto、B 的 desirable 属于 PAgP，不能与 passive LACP 协商；C 的 on 为静态聚合，不发起 LACP。双方均 passive 也不会主动发起协商。'
  reason='恢复多设备 CLI 换行、修正提示符并补二层接口与兼容配置前提。';source=[sources['etherchannel']]
 elif n in (1002,1007):
  u['prompt']='In a Wi-Fi receiver, which description best defines background noise?'
  opts=[dict(x) for x in q['options']];opts[1]['text']='unwanted background energy, including receiver thermal noise, that can degrade reception';u['options']=opts
  u['explanation']='B。背景噪声是接收机中的不需要的随机能量，例如热噪声；它与期望信号共同影响接收质量。非 Wi-Fi 发射源也可能产生干扰，但不应把所有非 Wi-Fi 信号都定义成随机噪声，也不能说干扰只来自 Wi-Fi。A 是两个信号的功率差，不是噪声定义；C 是其他 Wi-Fi 信号造成的干扰；D 是信噪比（SNR）指标而非噪声本身。信号与噪声均以 dBm 表示时，其差值以 dB 表示。'
  reason='原题将所有非 Wi-Fi 干扰等同随机噪声，且排除其他干扰来源；改为背景噪声的具体定义。'
 elif n in (1003,1008,1010):
  u['prompt']='Refer to the exhibit. For router R2 E0/1, use the LAN /64 prefix and displayed MAC address to calculate its modified EUI-64 IPv6 address. Treat the diagram’s .1 interface label as a placeholder to be replaced by the calculated address. Which address results?'
  if n in (1003,1008): mac='ca:01:b8:b8:00:01';iid='c801:b8ff:feb8:0001';prefix='2001:db8:8bb8:8bb1::/64';ans='D'
  else: mac='ca:01:b6:b4:00:01';iid='c801:b6ff:feb4:0001';prefix='2001:db8:9bb6:6bb9::/64';ans='A'
  u['explanation']=f'{ans}。图中 R2 E0/1 的 MAC 为 `{mac}`，LAN 前缀为 `{prefix}`。在 MAC 前后三字节中间插入 `ff:fe`，再将首字节 `ca` 与 `02` 异或得到 `c8`，接口标识符为 `{iid}`；与 /64 前缀拼接即为 {ans}。其余选项的前缀或接口标识符不符合该计算。图中的 `.1` 标签仅作占位，不能同时认定为生成的 EUI-64 接口地址；文档前缀 2001:db8::/32 供示例使用。'
  reason='已查看拓扑；补图中 .1 标签与实际 EUI-64 地址的冲突说明，修正题干拼写。';source=[sources['eui']]
 elif n in (1004,1009):
  u['prompt']='By default, how does a Layer 2 switch handle a unicast frame whose destination MAC address is absent from the forwarding table for the incoming VLAN?'
  opts=[dict(x) for x in q['options']];opts[0]['text']='It floods the frame through eligible forwarding ports in the same VLAN, except the ingress port.';u['options']=opts
  u['explanation']='A。默认情况下，交换机按入站 VLAN 和目的 MAC 查询转发表；未知单播会从同 VLAN 中符合条件的转发端口泛洪，排除入端口。STP 端口状态、VLAN 允许列表及未知单播抑制等配置会影响实际转发。B 不是默认未知单播行为；C 的 CDP 用于邻居发现而非数据帧转发；D 的 DoS 防护不是一般帧交换的保证。组播处理还可能受 IGMP snooping 等配置影响。'
  reason='限定未知单播、VLAN 与合格转发端口，避免声称所有端口与所有 BUM 一律泛洪。';source=[sources['flood']]
 else:
  u['prompt']='Refer to the exhibit. Which observation is directly supported by the displayed interface counters?'
  u['options']=[{'label':'A','text':'The interface is half-duplex and has recorded 480 collisions and 35 runts.'},{'label':'B','text':'The 30-second input rate is 200 Mb/s.'},{'label':'C','text':'The output proves that the attached NIC is faulty.'},{'label':'D','text':'The output queue is currently full and has recorded output drops.'}]
  u['explanation']='A。图示 Half-duplex、480 collisions、35 runts；计数器在 18 秒前清零。输出显示 30 秒入/出速率均为 0、output queue 为 0/300 且 output drops 为 0，因此 B 和 D 不符。C 无法仅凭此快照确定。碰撞和 runt 可提示进一步调查双工或物理链路，但也可能有其他原因；需检查对端双工、协商、线缆及计数变化后才能判断，不应直接断言双工不匹配。'
  reason='原题把半双工及碰撞断言为双工不匹配，单张计数器快照不能唯一确认原因；改为直接观察。'
 c={'id':n,'original_qid':q['qid'],'before_sha256':fp(q),'reason':reason,'updates':u,'original_fields':{k:q[k] for k in u},'review':{'prompt':'checked and corrected','options':'all checked','answer':'checked and retained','explanation':'checked and corrected','image':'viewed' if q.get('image') else 'none','code_cli':'checked and formatted where present','finding':reason,'references':source}}
 if q.get('image'):
  p=audit/'exhibits'/f'q{n}_agent.jpg';c['exhibit_path']=f'exhibits/{p.name}';c['image_sha256']=hashlib.sha256(p.read_bytes()).hexdigest()
 out.append(c)
manifest={'scope':'Q1001–Q1010','preserve_question_ids':True,'corrections':out,'sources':list(sources.values()),'limitations':'人工审查图像与题目，未进行真实网络设备实验。'}
(audit/'agent-1001-1010.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
lines=['# Q1001–Q1010 逐题审查','', '逐题检查题干、全部选项、答案、解析、图片及 CLI，涉及图片均直接查看。', '']+[f"- Q{c['id']}：{c['reason']} 答案 {','.join(by[c['id']]['answer'])} 保持。" for c in out]
lines+=['','参考资料：']+[f'- {v}' for v in sources.values()]+['','未执行真实设备实验。']
(audit/'agent-1001-1010.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('Prepared 10 corrections with fingerprints and per-question reviews.')
