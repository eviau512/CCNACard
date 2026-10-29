# chunk12_p1.py
part1 = {
    "398": """• 核心考点与原理分析：
本题考查 Cisco IOS DHCP 服务器的管理与地址绑定机制（DHCP Binding Table）。当 Cisco 路由器作为 DHCP 服务器向局域网客户端动态分发或静态保留 IP 地址时，系统会在内部维护一张 DHCP 地址绑定表（Binding Table）。该表记录了每一个已分配的 IP 地址、客户端的唯一硬件标识符（如 MAC 地址或 DHCP Client-ID）、租约到期时间（Lease Expiration）、以及分配类型（Automatic、Dynamic 或 Static）。网络管理员通过查看该绑定表，可以准确获知当前网络中哪些 IP 地址已经被分配给终端设备。

• 正确选项剖析：
选项 C（Show ip DHCP binding.）是完全符合 Cisco IOS 技术规范的标准特权执行模式命令（大小写不敏感，即 `show ip dhcp binding`）。
1. 执行 `show ip dhcp binding` 后，IOS 会输出清晰的地址绑定清单：
   - IP address：分配给客户端的 IP 地址。
   - Client-Identifier / Hardware address：客户端的 MAC 地址或基于 DUID 的客户端标识符。
   - Lease expiration：租约到期的具体时间戳或标记为 Infinite。
   - Type：地址绑定方式（如 Automatic/Dynamic）。
2. 该命令是验证 DHCP 服务器地址分发状态的最直接、最权威的命令，完全满足题干“determine the addresses that have been assigned”的要求。

• 干扰项排除与错误陷阱：
- 选项 A（Show ip DHCP database.）：命令语法错误。Cisco IOS 中没有 `show ip dhcp database` 命令。虽然存在用于将 DHCP 绑定数据库周期性写入外部 FTP/TFTP/RCP 服务器的配置命令（`ip dhcp database <url>`），但特权模式下不存在该查看命令。
- 选项 B（Show ip DHCP pool.）：概念与信息粒度混淆。`show ip dhcp pool [pool-name]` 用于查看 DHCP 地址池的整体配置结构与汇总指标（例如地址池名称、总地址数、租出地址数、可用子网掩码及利用率百分比），但它并不显示具体分配给哪些客户端 MAC 的地址明细表。
- 选项 D（Show ip DHCP server statistic.）：语法错误且功能不符。标准 IOS 命令为复数形式 `show ip dhcp server statistics`。该命令用于监控 DHCP 协议报文的计数器（如 DHCPDISCOVER 接收数、DHCPOFFER 发送数、DHCPREQUEST 接收数、DHCPACK 发送数以及地址冲突计数），不输出具体的已分配 IP 清单。

• 考试要点与速记技巧：
查具体已分配 IP 清单认准“绑定表”：`show ip dhcp binding`；查地址池整体容量与利用率认准“池汇总”：`show ip dhcp pool`；查报文收发计数器认准“统计”：`show ip dhcp server statistics`。""",

    "399": """• 核心考点与原理分析：
本题考查域名系统（DNS，Domain Name System，RFC 1034/1035）的层次化解析架构与权威域名源（Authoritative Source）原理。
1. DNS 采用分布式层次树状结构，由根域名服务器（Root）、顶级域名服务器（TLD）、二级域名服务器以及权威域名服务器（Authoritative Name Server）组成。
2. 权威域名服务器是特定 DNS 区域（Zone）的最终管理机构，持有经过管理员配置或动态注册的原始资源记录（如 A、AAAA、CNAME 等记录）。
3. 客户端在发起域名解析时，通常会先检索各个层级的本地或中间缓存（如浏览器缓存、操作系统 DNS 客户端缓存、本地路由器缓存、ISP 递归服务器缓存）。所有这些缓存记录都是带有生存时间（TTL）的临时副本，属于“非权威结果（Non-authoritative answer）”。如果权威服务器上的记录发生了变更，而缓存尚未过期，缓存将提供陈旧甚至错误的信息。
4. 递归 DNS 查询（Recursive DNS search/query）是 DNS 客户端向递归解析器发起的完整解析流程。递归解析器代客户端在互联网上逐级向根、顶级、权威域名服务器进行迭代查询，最终直接从拥有该区域权威记录的权威名称服务器获取真实、最新且经过签发的权威解析数据。因此，在所有备选解析途径中，只有发起完整的递归 DNS 搜索才能溯源直达权威记录源。

• 正确选项剖析：
选项 A（a recursive DNS search）正确。
- 在题干给出的 4 个选项中，选项 B、C、D 全部是各级“缓存（Cache）”。由于缓存可能包含已过期、被污染或滞后的数据，因此它们本质上都是非权威的（Non-authoritative）。
- 递归 DNS 搜索（a recursive DNS search）是由递归解析服务器代替主机向全球层次化 DNS 体系遍历查询，一路穿透中间缓存，直接连接拥有该域名的 Authoritative Name Server，进而返回权威的资源记录。因此，相比各类临时缓存，递归查询是获取权威解析源信息的唯一有效途径。

• 干扰项排除与错误陷阱：
- 选项 B（the operating system cache）：错误。操作系统内核的本地 DNS 缓存（如 Windows DNS Client 缓存，可通过 `ipconfig /displaydns` 查看）仅保留主机最近解析成功的记录，受限于 TTL，非权威源。
- 选项 C（the ISP local cache）：错误。互联网服务提供商（ISP）的本地 DNS 递归服务器会为成千上万的用户缓存热门域名解析结果。一旦目标主机 IP 发生变动且 TTL 未归零，ISP 缓存返回的均是非权威的暂存数据，并非权威源。
- 选项 D（the browser cache）：错误。现代 Web 浏览器（如 Chrome、Firefox）为了提高网页加载速度自带 DNS 内存缓存（如 Chrome 的 `chrome://net-internals/#dns`），其缓存时间通常仅有几十秒到数分钟，同样是非权威数据。

• 考试要点与速记技巧：
记住一条铁律：各种 Cache（浏览器、系统、ISP）皆为“非权威”（Non-authoritative）；唯有直达 Authoritative Name Server 的递归查询（Recursive DNS search）才能获取该域名的权威解析源！""",

    "400": """• 核心考点与原理分析：
本题考查 DHCP 中继代理（DHCP Relay Agent）的配置验证与 Cisco IOS 接口三层特性的显示机制。
1. 在网络架构中，DHCP 客户端发出的初始报文（DHCPDISCOVER、DHCPREQUEST）均为局域网广播包（目的 IP 为 255.255.255.255，目的 MAC 为全 F，UDP 端口 67）。路由器作为广播域的边界，默认会直接丢弃该广播报文。
2. 为了使不同子网的客户端能够向中心化的 DHCP 服务器获取 IP，必须在直接连接客户端子网的路由器三层接口（物理接口、子接口或 VLAN 虚接口 SVI）上配置 `ip helper-address <DHCP-Server-IP>`。
3. 配置后，路由器接口作为 DHCP Relay Agent，会截获客户端的 UDP 67 广播报文，将其封装为单播 IP 报文（源 IP 为该接口的 IP 地址，写入 `giaddr` 字段，目的 IP 为指定的 DHCP 服务器 IP），转发给目标服务器。
4. 验证中继地址是否已正确绑定至特定接口，必须检查该接口的 Layer 3 协议与特性明细。

• 正确选项剖析：
选项 D（show ip interface）完全正确。
- `show ip interface [interface-id]` 命令用于查看 Cisco IOS 设备上指定或所有三层接口的详细网络层协议属性与特性开关。
- 在该命令的输出结果中，包含了许多三层重要特性（如 MTU、定向广播、重定向、Split-Horizon 等），并且会明确显示如下关键行：
  `Helper address is 192.168.10.1` （若配置了中继地址）
  或 `Helper address is not set` （若未配置）。
- 因此，这是官方推荐且唯一的用于验证特定接口上配置的 DHCP Relay Agent（helper-address）的诊断命令。

• 干扰项排除与错误陷阱：
- 选项 A（show ip interface brief）：高频陷阱！`show ip interface brief` 仅提供紧凑的概览视图，包含：接口名称、分配的 IP 地址、OK 检查状态、配置方式（Method: manual/DHCP/NVRAM）、Layer 1 状态（Status）和 Layer 2 状态（Protocol）。它完全不显示 Helper address、ACL、NAT 等高级接口特性。
- 选项 B（show ip dhcp bindings）：用于在充当 DHCP 服务器的设备上查看已租出的客户端 IP/MAC 映射表，无法查看本地接口作为 Relay Agent 的辅助地址配置；且命令存在拼写多余 `s` 的问题（标准为 `binding`）。
- 选项 C（show ip route）：用于查看路由管理表（RIB），仅显示直连、静态或动态路由条目及出接口，不包含接口服务级特性。
- 选项 E（show interface）：用于显示接口的 Layer 1 物理和 Layer 2 数据链路层参数（MAC 地址、双工、速率、MTU、带宽、延迟、输入/输出错误计数器等），不输出 Layer 3 的 helper-address 详情。
- 选项 F（show ip dhcp pool）：用于查看 DHCP 服务器配置的地址池资源、子网范围及租约统计，与 DHCP 中继功能无关。

• 考试要点与速记技巧：
验证接口层面的高级 IP 属性（如 Helper address / Redirects / Directed-broadcast），必须敲完整版 `show ip interface`；而 `show ip interface brief` 只能看“IP + UP/DOWN”！""",

    "401": """• 核心考点与原理分析：
本题考查 DHCP 服务器（Dynamic Host Configuration Protocol Server，RFC 2131）的核心功能与所维护的数据结构。
1. DHCP 服务器的核心使命是实现 IP 地址的集中式、自动化生命周期管理，解决大型网络中手动配置静态 IP 容易引发的地址冲突、子网掩码配置错误、网关指向错误等问题。
2. 为实现动态分配，DHCP 服务器管理员必须首先定义一个或多个地址池（Address Pool / Scope）。地址池中包含可供分配的网络号、子网掩码、排除的保留地址（Excluded Addresses）、租约期限（Lease Time）以及网络选项（如默认网关 Default Router、域名服务器 DNS Server 等）。
3. 当客户端请求接入时，DHCP 服务器从该池的“可用地址清单（Available IP addresses）”中检索并租借一个空闲的 IP 地址，同时将该分配记录转移到“已分配绑定表（Binding Table）”中。

• 正确选项剖析：
选项 A（a list of the available IP addresses in a pool）准确描述了 DHCP 服务器内部驻留的核心业务数据。
- DHCP 服务器的核心常驻数据结构就是其地址池及其地址状态表。该表中清晰区分了：
  1) 池中可供新客户端租用的可用地址（Available IP addresses）；
  2) 当前已被占用且租约有效的已租地址（Leased/Active bindings）；
  3) 被管理员显式排除的不可分配保留地址（Excluded addresses，如预留给网关和服务器的静态 IP）；
  4) 发生冲突处于停用状态的冲突地址（Conflict addresses）。
- 因此，选项 A 完全符合 DHCP 服务器的设计原理与功能边界。

• 干扰项排除与错误陷阱：
- 选项 B（a list of public IP addresses and their corresponding names）：概念混淆。公网 IP 地址与其对应的主机名/完全限定域名（FQDN）的映射关系是由域名系统（DNS）服务器中的正向/反向解析记录（A/AAAA/PTR 记录）维护的，而非 DHCP 服务器的功能。
- 选项 C（usernames and passwords for the end users in a domain）：功能混淆。域内终端用户的用户名、密码凭据与权限数据库由网络目录服务（如微软 Active Directory Domain Services / LDAP）或 AAA 集中认证系统（如 Cisco ISE、RADIUS、TACACS+）管理，DHCP 绝不会存储此类敏感认证信息。
- 选项 D（a list of statically assigned MAC addresses）：设备角色混淆。静态或动态绑定的 MAC 地址表是二层局域网交换机（Layer 2 Switch）的 CAM（Content Addressable Memory）表所维护的硬件转发表项，用于数据帧的二层转发，而不是 DHCP 服务器的功能。

• 考试要点与速记技巧：
各司其职牢记心：
- DHCP 管：IP 地址池（Pool）及可租用/已租用地址清单；
- DNS 管：域名与公网/私网 IP 映射表；
- AD/AAA 管：域用户与账号密码；
- Switch 管：二层 MAC 地址表（CAM）。""",

    "402": """• 核心考点与原理分析：
本题考查 Cisco IOS 接口通过 DHCP 动态获取 IP 地址（配置命令为 `ip address dhcp`）的运行状态验证与排错。
1. 在很多企业分支机构网关（Cisco 路由器）连接 ISP 宽带上行链路，或者特定网络设备接入管理网时，路由器的接口并不配置静态 IP，而是启用内置的 DHCP Client 功能，自动向上游服务器索取 IP 地址、默认网关以及 DNS 信息。
2. 了解接口当前的 IP 地址是如何确定的（是手动配置的 Manual，还是由 DHCP 动态分发的，或者是 NVRAM 读取的），是网络故障排查的关键技能。
3. Cisco IOS 提供了不同粒度的接口状态查看指令，只有输出完整三层协议特性的命令才会明确标明 IP 地址的分发来源（Allocation Method）。

• 正确选项剖析：
选项 D（show ip interface GigabitEthernet 0/0）完全正确。
- 在 Cisco IOS 特权模式下执行 `show ip interface GigabitEthernet 0/0`，系统会打印出该物理接口的所有 Layer 3 运行参数。
- 当接口通过 DHCP 成功获取到 IP 地址时，命令输出的第一行会明确显示：
  `Internet address is 192.168.1.100/24 (via DHCP)`
  或者在底层显示 `Address determined by DHCP`。
- 该输出无可置疑地向网络管理员证明了 G0/0 接口当前使用的是通过 DHCP 协议动态协商得到的 IP 地址。

• 干扰项排除与错误陷阱：
- 选项 A（show ip interface GigabitEthernet 0/0 dhcp）：命令语法错误。Cisco IOS 的 `show ip interface <interface-id>` 后面不允许追加 `dhcp` 关键字，IOS CLI 会在 `dhcp` 处报错并显示 `% Invalid input detected at '^' marker`。
- 选项 B（show interface GigabitEthernet 0/0）：信息层级不足。`show interface` 是二层和物理层诊断命令，主要显示 MAC 地址、MTU、速率、双工、CRC 校验错误、输入输出帧数等。即使其中显示了 IP 地址，也不会说明该地址是静态手工指定还是通过 DHCP 动态租借的。
- 选项 C（show ip interface dhcp）：命令语法错误。在 `show ip interface` 之后只能接具体的接口类型与编号（如 `GigabitEthernet 0/0`）或全局概览关键字 `brief`，不存在 `dhcp` 这个接口类别。
- 选项 E（show ip interface GigabitEthernet 0/0 brief）：语法位置错误。在 Cisco IOS 命令行规范中，`brief` 只能直接作为 `show ip interface brief` 使用以输出全局接口列表，不能在指定单一具体接口名称后跟 `brief` 参数。

• 考试要点与速记技巧：
判断接口 IP 来源（是 static 手工配的，还是 via DHCP 租来的），必须查看三层接口明细：`show ip interface <interface>`。切记后方不要加任何多余的 `dhcp` 或 `brief` 尾缀！""",

    "403": """• 核心考点与原理分析：
本题考查 Cisco IOS 系统日志（Syslog，RFC 5424）的严重性级别（Severity Levels 0-7）及远程日志收集过滤命令 `logging trap <level>` 的技术机制。
1. Cisco IOS Syslog 体系将系统产生的事件划分为 8 个严格的严重性等级，数值由 0 到 7，严重程度依次递减：
   - 0: Emergency（系统完全不可用，如内核崩溃）
   - 1: Alert（需要立即采取行动）
   - 2: Critical（严重紧急状态）
   - 3: Error（常规错误条件）
   - 4: Warning（警告性条件）
   - 5: Notification（正常但重要的系统状态改变，如接口 Up/Down、系统重启）
   - 6: Informational（纯信息性消息）
   - 7: Debugging（极其详细的协议调试信息）
2. 路由器配置 `logging trap <level>` 命令用于控制发送到远程 Syslog 服务器（`logging host <ip>`）的日志门限值。
3. Cisco IOS 的过滤机制规定：一旦设定了 trap 级别，路由器将发送该级别**以及所有比该级别更严重（即严重性数字数值小于或等于该级别数值）**的所有日志消息！

• 正确选项剖析：
选项 C（It causes the router to send all messages to the syslog server）完全正确。
- Debugging（Debug）对应 Syslog 的最高数值级别：Severity Level 7。
- 依据 Cisco IOS 的包含规则，命令 `logging trap debugging`（或缩写 `logging trap debug`）代表将严重性数值 ≤ 7 的所有日志全部发送给远程 Syslog 服务器。
- 由于 Syslog 系统中全部的级别（0、1、2、3、4、5、6、7）都在 0 到 7 的闭区间内，因此设置 `logging trap debug` 将无保留地捕获并向 Syslog 服务器推送路由器产生的“所有消息（All messages）”。

• 干扰项排除与错误陷阱：
- 选项 A（It causes the router to send messages with lower severity levels to the syslog server）：表述存在重大歧义与概念误导。在 Syslog 体系中，Debug 属于严重性最低（Lowest Severity，即数值最大的 7），但设置该命令后发出的并不只是低严重级别的消息，而是从最危急的 Level 0 到最详细的 Level 7 全量发送。
- 选项 B（It causes the router to send all messages with the severity levels Warning, Error, Critical, and Emergency to the syslog server）：范围不完整。该描述仅包含了级别 0 到 4（Emergency, Critical, Error, Warning）。若只发送这些级别，配置命令应为 `logging trap warnings`。配置 `trap debug` 还会额外包含级别 5（Notice）、级别 6（Info）和级别 7（Debug）。
- 选项 D（It causes the router to stop sending all messages to the syslog server）：与事实完全相反。若要停止向远程服务器发送日志，应使用命令 `no logging trap`、`no logging host` 或全局关闭日志 `no logging on`。

• 考试要点与速记技巧：
Syslog 8 大级别八字口诀必须倒背如流：
“0 危 (Emerg), 1 警 (Alert), 2 严 (Crit), 3 错 (Err), 4 告 (Warn), 5 注 (Notice), 6 信 (Info), 7 调 (Debug)”。
命令 `logging trap X` 永远发送“≤ X 的所有日志”，设置 `trap 7 (debug)` 即“全部包揽，全量上报”！""",

    "406": """• 核心考点与原理分析：
本题考查简单网络管理协议（SNMP，Simple Network Management Protocol，RFC 1157/3411）的基础架构模型与 SNMP 代理（SNMP Agent）的核心职责。
1. SNMP 网络管理架构由三个核心组件构成：
   - 网络管理站（NMS，Network Management Station / SNMP Manager）：运行集中监控软件（如 Cisco Prime、SolarWinds、PRTG、Zabbix）的主机，作为管理者。
   - 被管理设备上的 SNMP 代理（SNMP Agent）：驻留在网络设备（路由器、交换机、防火墙）操作系统内核中的守护进程，作为被管端。
   - 管理信息库（MIB，Management Information Base）：定义了受管对象属性的树状层次化数据库结构，每个变量用唯一的对象标识符（OID）表示。
2. NMS 与 Agent 之间的典型通信模式包括：
   - 轮询读取（Polling / Read）：NMS 主动发送 GetRequest、GetNextRequest 或 GetBulkRequest 请求，Agent 接收并解析请求，读取本地硬件/系统状态变量，然后以 Response-PDU 将 MIB 变量数据回送给 NMS。
   - 远程修改（Write）：NMS 发送 SetRequest 改变被管设备的特定配置参数。
   - 异步通知（Trap / Inform）：Agent 在发生特定灾难性或状态切换事件时，主动向 NMS 发送告警。

• 正确选项剖析：
选项 A（It sends information about MIB variables in response to requests from the NMS）精准概括了 SNMP Agent 的经典工作模式。
- Agent 是 MIB 变量的持有者与本地执行者。当 NMS 想要监控接口流量、CPU 负载、内存剩余等状态时，会向 Agent 发出读取请求（Get-Request PDU）。
- Agent 收到请求后，检索对应 OID 的值，并将该 MIB 变量的信息封装到响应报文（Response PDU）中返回给 NMS。这是 SNMP 协议最频繁、最基本的交互操作。

• 干扰项排除与错误陷阱：
- 选项 B（It manages routing between Layer 3 devices in a network）：业务功能混淆。网络三层设备之间的路由计算与报文转发是由动态路由协议（如 OSPF、EIGRP、BGP）以及控制平面/数据平面（FIB、CEF）处理的，与网络管理协议 SNMP 无关。
- 选项 C（It coordinates user authentication between a network device and a TACACS+ or RADIUS server）：协议混淆。网络设备与认证服务器之间的用户接入安全认证是由 AAA 协议（TACACS+ 端口 TCP 49，或 RADIUS 端口 UDP 1812/1813）协调执行的，与 SNMP 无关。
- 选项 D（It requests information from remote network nodes about catastrophic system events）：主被动角色与主体混淆。
  1) SNMP Agent 是“被动响应者”，发起请求的是 NMS，Agent 不会向其他网络节点去“请求（request）”信息。
  2) 在发生突发灾难事件时，Agent 是向 NMS 主动推送 Trap 或 Inform 报文，而不是去向他人索取信息。

• 考试要点与速记技巧：
SNMP 双雄角色分工：
- NMS 是大脑/领导：主动发号施令（Get/Set）；
- Agent 是执行者/下属：驻留在设备内，持有 MIB 变量库，忠实回复请求（Response），出事主动打小报告（Trap/Inform）。""",

    "407": """• 核心考点与原理分析：
本题考查网络时间协议（NTP，Network Time Protocol，RFC 5905）的层级结构（Stratum）以及 Cisco IOS 独立权威时间源的配置命令。
1. NTP 采用分层时钟模型（Stratum）：
   - Stratum 0：高精度物理参考时钟（如 GPS 卫星授时、原子钟）。
   - Stratum 1：直接与 Stratum 0 设备物理相连的权威时间服务器。
   - Stratum 2：通过网络从 Stratum 1 同步时间的服务器，其层级以此类推递增，最大至 15；Stratum 16 表示时钟未同步（不可信）。
2. 在某些与外网物理隔离的独立私有网络中，设备无法通过互联网连接公网 Stratum 1/2 服务器。此时，网络管理员需要指定核心骨干设备（如核心路由器）使用其本地硬件时钟（Local Hardware Clock）充当整个局域网的“主 NTP 服务器”。
3. 在 Cisco IOS 中，使一台路由器在未与外部时间源同步的情况下，依然声明自己为可信时间源并向内网其他客户端提供 NTP 授时服务，必须使用专门的 Master 声明命令。

• 正确选项剖析：
选项 B（ntp master）完全正确。
- 在 Cisco IOS 全局配置模式下，输入 `ntp master [stratum-number]` 命令，路由器就会强制以自身的内部时钟为基准，将自己设定为权威的 NTP 主服务器（Authoritative NTP Server）。
- 如果命令后面省略具体的层级数字，Cisco IOS 默认分配 Stratum 8。其他配置了 `ntp server <该路由器IP>` 的客户端在与之同步后，其层级将递增为 Stratum 9。
- 因此，当需要将一台 Cisco 设备独立配置为 NTP 服务器时，必须输入 `ntp master`。

• 干扰项排除与错误陷阱：
- 选项 A（ntp peer）：模式混淆。`ntp peer <ip-address>` 命令用于配置 NTP 对称主动对等体模式（Symmetric Active Peering）。该模式用于同级别的两个设备之间相互比较和同步时间，互相备份，并不是将本地路由器单向确立为主 NTP 授时服务器。
- 选项 C（ntp authenticate）：功能混淆。`ntp authenticate` 用于在路由器上开启全局 NTP 认证功能，结合 `ntp authentication-key` 和 `ntp trusted-key` 来防范针对 NTP 的恶意欺骗攻击，但它不负责赋予设备 NTP 服务器的角色。
- 选项 D（ntp server）：极高频混淆陷阱！`ntp server <ip-address>` 是将本地路由器配置为 **NTP 客户端（Client）**，命令后跟的 IP 地址是外部上游时间服务器的地址，目的是让本地设备找别人同步时间，而不是让自己成为局域网的主时间服务器。

• 考试要点与速记技巧：
角色配置口诀：
- 自己当权威大管家（内部时钟做源）：敲 `ntp master [层级]`；
- 自己当下属找别人对表（做客户端）：敲 `ntp server <上游IP>`；
- 平级设备互相对表备份：敲 `ntp peer <对端IP>`。"""
}
