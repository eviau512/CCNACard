# 缺失实验图逐题核对（Q1092–Q1166）

所有第三方拓扑均为练习站重建图，非 Cisco 原图；不能由参考图推断原实验特有参数。每题均需现场确认接口、VLAN 和地址。SVG 示意图按题干中已明确的链路绘制，标记不确定内容。

- Q1092：找到[第三方同任务示意图](https://ahmedhussein.org/examlabs/#9)，已直接查看，四交换机端口与题干相符；图中 Po34 属参考示例，VLAN 允许列表未在图中给出，继续保留未确定提示。
- Q1119：题干已明确两台交换机各自的 E0/0、E0/1 成员，已制作局部 LACP 示意图；物理线缆配对及 MONITORING VLAN ID 未知，不假定。
- Q1120：匹配题目文本的[练习页面](https://www.rivanit.com/ccna-reviewer-course-philippines/static_routing_configuration_sim)搜索结果提到图，但页面图像未能读取核实；未加入外部未经核实的接口或下一跳。
- Q1124：按题干重建 SW1–SW2 的 E0/2 与 SW2–SW3 的 E0/3，PC 和链路成员 VLAN 未知并明确标注。
- Q1126：公开材料可见相同 ACL/DHCP 任务文字，但未确认匹配拓扑；继续保留受信任端口需现场确认。
- Q1128：Cisco Community 搜索结果有相同任务及两个图片引用，但当前无法读取原帖图片，无法核对图中接口/下一跳；继续保留未知说明。
- Q1159：找到[第三方同任务示意图](https://ahmedhussein.org/examlabs/#22)，已直接查看；须现场核对 VLAN 和接口，不作为原题拓扑。
- Q1161：所有地址、前缀、接口及 16 站条件已在题干给出；移除无意义的模拟器 Topology 标签说明，改为自包含计算题，不虚构物理图。
- Q1165：找到[第三方同任务练习图](https://ahmedhussein.org/examlabs/#16)，已直接查看；站点给出的下一跳示例与其子网有冲突，仍须现场核对，不能直接照搬。
- Q1166：找到[第三方同任务练习图](https://ahmedhussein.org/examlabs/#8)，已直接查看；端口须在现场核对。

另核对父任务交办：Q1169 的[第三方练习图](https://ahmedhussein.org/examlabs/#13)与题干接口相符，聚合编号仍需现场确定；Q1201 的[第三方相似任务图](https://ahmedhussein.org/examlabs/#11)有用户名细微差异，不能认定原题拓扑，接口需现场确认。

数据文件为 `recover-missing-1092-1166.json`；图片来源及参考性质均明确标在题干和解析。未运行网络设备实验。
