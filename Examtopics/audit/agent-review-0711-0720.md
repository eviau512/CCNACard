# Q711–Q720 逐题审查

范围：题干、全部选项、答案、解析、图片与CLI。原题编号和答案均保持。

| 题号 | 判断及修订 | 原图 |
| --- | --- | --- |
| Q711 | 原题声称立即恢复并保证接入电路故障均能检测，属于过度保证；限定第一跳冗余并区分上游故障跟踪。 | 不需要 |
| Q712 | 按图核对子网掩码；图中前缀未按网络边界规范显示，按掩码计算网络范围而非照抄。 | 已直接查看 |
| Q713 | 按图核对两条EIGRP下一跳；移除等价路径一定安装及流量必然平均的绝对化描述。 | 已直接查看 |
| Q714 | 原解释无条件承诺回ICMP，不符合抑制规则；核对原图全部路由。 | 已直接查看 |
| Q715 | 题目遗漏主默认路由的管理距离，10并非对任意动态协议都能浮动；补充主路由、下一跳条件并去掉毫秒级保证。 | 不需要 |
| Q716 | 按照图核对两个默认路由及下一跳可达性；限制竞争路由条件。 | 已直接查看 |
| Q717 | 图中最长前缀与下一跳核对无误；修正将RIB路由选择与FIB查找混为一步的表述。 | 已直接查看 |
| Q718 | 收到前缀不保证安装；限定三个OSPF前缀已被选中有效，同时恢复CLI选项换行。 | 不需要 |
| Q719 | 缺默认路由不是唯一缺失路由的修复方式；题项改为无任何匹配路由，避免误导。 | 已直接查看 |
| Q720 | 限定共同体字符串适用v1/v2c，避免把明文口令称为强认证，也不保证所有失败都发trap。 | 不需要 |

依据：
- https://www.cisco.com/c/en/us/support/docs/ip/hot-standby-router-protocol-hsrp/9234-hsrpguidetoc.html
- https://www.cisco.com/c/en/us/support/docs/ip/border-gateway-protocol-bgp/15986-admin-distance.html
- https://www.cisco.com/c/en/us/support/docs/dial-access/floating-static-route/118263-technote-nexthop-00.html
- https://www.cisco.com/c/en/us/support/docs/ip/simple-network-management-protocol-snmp/20370-snmpsecurity-20370.html

未进行真实设备实验。
