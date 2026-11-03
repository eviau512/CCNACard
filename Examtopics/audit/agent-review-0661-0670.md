# Q661–Q670 逐题审查

逐题核对题干、全部选项、答案、解释及原图/CLI；五幅原图已直接查看。下列修订已写入机器可应用的清单，尚待合并到共享题库。

|题号|审查与修订|
|---|---|
|661|修正SSID字符集、长度和安全性过度概括。|
|662|取消SSID必须一一对应独立VLAN及服务端口适用所有型号的绝对描述。|
|663|图中SSID广播已选；隐藏SSID并非认证或加密，54 Mbps是物理速率而非保证吞吐量。|
|664|修正老化不能保证抗MAC flooding或保证永远有表项空间，默认值依平台而异。|
|665|恢复选项CLI逐行格式，C补路由器侧trunk native VLAN 5，明确路由和主机前提，缩窄VLAN 1要求。|
|666|还原CLI换行，补充到C接口已启用和其他接口不发送的前提。|
|667|展图为10.0.0.252/30而非10.0.0.0/30；恢复代码格式并指出目标在ISP而非R1。|
|668|避免对所有WLC机型及本地交换流量作绝对化断言。|
|669|限定AireOS 8.5.164.0，区分启用特性与启用后数据加密默认值可再调整，修正IPsec拼写和不可靠端口断言。|
|670|原题要求阻止具备P2P能力的客户端接入，原答案D误将流量隔离当作阻止关联。根据Cisco Wi-Fi Direct策略修正答案并限定适用对象。|

参考：
- [ssid](https://www.cisco.com/c/en/us/support/docs/wireless-mobility/wireless-lan-wlan/98138-ssid-bss.html)
- [trunk](https://www.cisco.com/c/en/us/td/docs/switches/lan/c9000/lyr2-fwd/vlan/vlan-configuration-guide/configure-vlan-trunks.html)
- [mobility](https://www.cisco.com/c/en/us/td/docs/wireless/controller/8-5/config-guide/b_cg85/encrypted_mobility_tunnel.html)
- [direct](https://www.cisco.com/c/en/us/td/docs/wireless/controller/7-6/configuration-guide/b_cg76/b_cg76_chapter_01000001.pdf)

未进行真实WLC或IOS设备实验。
