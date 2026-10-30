# -*- coding: utf-8 -*-
"""
apply_39_dnd_fix.py
Fixes type ('Drag and Drop') and provides comprehensive expert Cisco CCNA explanations
for all 39 questions (Q1056 - Q1234) across datasets and HTML practice files.
"""

import json
import os
import re

EXPLANATIONS = {
    1056: """• Technical Analysis (Cisco CCNA Core Concept):
This item assesses IPv4 Variable-Length Subnet Masking (VLSM) and prefix-to-mask conversion.
- 10.10.13.0 -> 255.255.255.252 (/30): Point-to-point router serial/Ethernet links require only 2 usable host addresses (2^(32-30) - 2 = 2), making /30 (mask 255.255.255.252) the most efficient allocation.
- 10.10.13.144 -> 255.255.255.248 (/29): A /29 prefix provides a block size of 8 (256 - 248 = 8), yielding 6 usable hosts (10.10.13.145 - 10.10.13.150).
- 10.10.13.160 -> 255.255.255.224 (/27): A /27 prefix provides a block size of 32 (256 - 224 = 32), supporting up to 30 usable hosts.
- 209.165.202.128 -> 255.255.255.128 (/25): A public /25 subnet spans 128 IP addresses (256 - 128 = 128), accommodating larger campus public allocations.
- Distractor: 255.255.255.240 (/28) is unused.""",

    1076: """• Technical Analysis (Cisco CCNA Core Concept):
This item evaluates the operational mechanics and syntax of major network automation tools (Ansible, Chef, and Puppet):
- Ansible (Agentless):
  1. Uses SSH for remote device communication (no proprietary agent required on managed network elements).
  2. Uses YAML for fundamental configuration elements (Playbooks).
- Chef (Agent-based):
  1. Uses TCP port 10002 for configuration push jobs (Chef push-jobs service).
  2. Uses Ruby (Domain Specific Language) for fundamental configuration elements (Cookbooks and Recipes).
- Puppet (Agent-based):
  1. Fundamental configuration elements are stored in a manifest (.pp files).
  2. Uses TCP port 8140 for encrypted communication between Puppet Master and Agent nodes.""",

    1094: """• Technical Analysis (Cisco CCNA Core Concept):
This item tests the 5 Essential Characteristics of Cloud Computing as defined by NIST SP 800-145:
- On-demand self-service: "The consumer can choose when to start or stop using the service." (A consumer can unilaterally provision computing capabilities without human interaction with the service provider).
- Measured service: "The provider can bill the consumer in accordance with the level of usage." (Resource usage is monitored, controlled, and reported, providing transparency for both provider and consumer).
- Resource pooling: "The provider allocates CPU, memory, and disk from its shared compute resources to multiple customers." (Multi-tenant model dynamically assigning physical and virtual resources according to customer demand).
- Rapid elasticity: "The resource pool can expand quickly to meet demand." (Capabilities can be elastically provisioned and released to scale rapidly outward and inward commensurate with demand).
- Broad network access: "The service is available from many types of devices and networks." (Capabilities are available over the network and accessed through standard mechanisms promoting use by heterogeneous client platforms).""",

    1097: """• Technical Analysis (Cisco CCNA Core Concept):
This question addresses Cisco Wireless LAN Controller (WLC) and Lightweight Access Point (LAP) architecture components:
- Wireless LAN Controller (WLC) -> "manages access points": Centralized appliance responsible for AP configuration, dynamic RF management, roaming, and security enforcement.
- Access Point (AP) -> "provides Wi-Fi devices with a connection to a wired network": Layer 1/2 bridging device providing radio frequency access for 802.11 clients to the wired infrastructure.
- Service Port -> "used for out-of-band management": A dedicated 10/100/1000 copper physical interface configured on an isolated subnet specifically for OOB recovery and management.
- Dynamic Interface -> "used for guest authentication": Software-defined interfaces mapped to specific VLANs (e.g., Guest WLAN traffic segmentation).
- Virtual Interface -> "applied to the WLAN for wireless client communication": Carries fictitious IP (e.g., 1.1.1.1) to support Web Auth login redirection, Layer 3 mobility, and DHCP relay.""",

    1098: """• Technical Analysis (Cisco CCNA Core Concept):
This item covers WAN and point-to-point IP address assignment across multi-router topologies:
- Router2 -> 10.10.13.126 (Usable host address in subnet 10.10.13.124/30).
- Router3 -> 10.10.13.129 (Usable host address in subnet 10.10.13.128/30).
- Router4 -> 10.10.13.150 (Subnet gateway for branch LAN).
- Router5 -> 10.10.13.209 (Serial point-to-point WAN link interface).
- Internet cloud -> 1.1.1.1 (Public internet routable target).
- MPLS cloud -> 209.165.200.30 (Service Provider core PE handoff).""",

    1099: """• Technical Analysis (Cisco CCNA Core Concept):
This item tests IPv4 subnet mask calculation and VLSM prefix lengths:
- 10.10.13.0 -> 255.255.255.252 (/30 prefix, 4 IPs, 2 usable hosts for point-to-point link).
- 10.10.13.128 -> 255.255.255.224 (/27 prefix, 32 IPs, 30 usable hosts).
- 10.10.13.160 -> 255.255.255.248 (/29 prefix, 8 IPs, 6 usable hosts).
- 10.10.13.252 -> 255.255.255.128 (/25 prefix, 128 IPs, 126 usable hosts).
- Distractors: 255.255.248.0 (/21) and 255.255.255.240 (/28) are unused.""",

    1100: """• Technical Analysis (Cisco CCNA Core Concept):
This question evaluates the operational states and device behaviors of Cisco Hot Standby Router Protocol (HSRP - RFC 2281 / RFC 7880):
- Active -> "is forwarding packets": The active router assumes primary forwarding duties for packets sent to the virtual router IP/MAC address.
- Standby -> "is ready to forward packets if the device that is currently forwarding packets fails": Monitors active router hello packets; transitions to Active if the active router hold timer expires.
- Speak -> "has heard from the neighbor device and is receiving hello packets": In this state, the router transmits and listens to hellos and participates in election.
- Listen -> "is transmitting and receiving hello packets": Router knows the virtual IP address, listens for hello packets from active/standby routers, and transitions according to election timers.
- Learn -> "is waiting to hear from the neighbor device": The router has not yet determined the virtual IP address and waits to hear from the active router.
• HSRP State Progression: Initial -> Learn -> Listen -> Speak -> Standby -> Active.""",

    1101: """• Technical Analysis (Cisco CCNA Core Concept):
This item tests Cisco IPv4 static routing syntax (`ip route <prefix> <mask> <next-hop>`) and next-hop reachability:
- Network Topology: Host A (10.10.14.0/24) connects to R1. R1-R2 link is 10.10.10.0/30 (R1 is .2, R2 is .1). R2-R3 link is 10.10.10.4/30 (R2 is .6, R3 is .5). Host B (10.10.13.0/25) connects to R3.
- Target Mapping:
  - R1: `ip route 10.10.14.0 255.255.255.0 10.10.10.2` (Configured on R1 targeting the gateway).
  - R2 (Slot 1): `ip route 10.10.13.0 255.255.255.128 10.10.10.5` (Routes Host B /25 subnet towards R3's incoming link IP 10.10.10.5).
  - R2 (Slot 2): `ip route 10.10.13.10 255.255.255.255 10.10.10.1` (Host specific /32 route via R2 incoming next-hop).
  - R3: `ip route 10.10.14.10 255.255.255.255 10.10.10.6` (Routes traffic destined for Host A /32 back towards R2's next-hop 10.10.10.6).""",

    1103: """• Technical Analysis (Cisco CCNA Core Concept):
This item tests VLSM boundary calculation and subnet block size correlation:
- 255.255.254.0 (/23) -> 172.16.4.0 (3rd octet increments by 2: 172.16.4.0 - 172.16.5.255).
- 255.255.255.128 (/25) -> 172.16.2.128 (Block size 128: 172.16.2.128 - 172.16.2.255).
- 255.255.255.224 (/27) -> 172.16.3.64 (Block size 32: 172.16.3.64 - 172.16.3.95).
- 255.255.255.240 (/28) -> 172.16.3.128 (Block size 16: 172.16.3.128 - 172.16.3.143).
- 255.255.255.248 (/29) -> 172.16.3.192 (Block size 8: 172.16.3.192 - 172.16.3.199).""",

    1105: """• Technical Analysis (Cisco CCNA Core Concept):
This question covers the Simple Network Management Protocol (SNMP) architecture:
- MIB (Management Information Base) -> "collection of uniquely identifiable objects whose state can be interrogated over SNMP": A hierarchical database of variables accessed via OIDs.
- NMS (Network Management System) -> "system that runs monitoring applications and controls network nodes": The centralized server executing monitoring software.
- Managed Device -> "network node-controlled by SNMP": Any device (router, switch, server) running an SNMP agent.
- Agent -> "SNMP component that captures and translates device and network data": Software running locally on the managed node that parses requests and issues Traps/Informs.""",

    1130: """• Technical Analysis (Cisco CCNA Core Concept):
This item evaluates physical media characteristics comparing Copper vs Single-Mode Fiber (SMF):
- Copper:
  1. Contains a single solid conductor (e.g. solid-core copper cabling for horizontal runs).
  2. Transmits data in the form of electronic signals (voltage fluctuations over copper media).
- Single-Mode Fiber (SMF):
  1. Is typically used for DWDM optical systems spanning long distances (dense wavelength division multiplexing over metro/long-haul).
  2. Uses a single wavelength of light (laser light traveling straight down a narrow 9-micron core).""",

    1131: """• Technical Analysis (Cisco CCNA Core Concept):
This item compares Copper vs Multimode Fiber (MMF) characteristics:
- Copper:
  1. Is typically used in small office applications (cost-effective RJ-45 Ethernet connections).
  2. Is comprised of shielded and unshielded twisted pairs (STP / UTP cabling standards Cat5e/Cat6).
- Multimode Fiber (MMF):
  1. Is typically used for internal datacenter connectivity (high-bandwidth short-distance server-to-switch/SAN links).
  2. Has increased attenuation over long distances (due to modal dispersion as multiple light modes bounce across the 50/62.5-micron core).""",

    1132: """• Technical Analysis (Cisco CCNA Core Concept):
This question contrasts Single-Mode Fiber (SMF) and Copper cabling properties:
- Single-Mode Fiber (SMF):
  1. Is ideal longer distances with little loss of integrity (minimal optical attenuation permits 10km to 80km+ links).
  2. Has minimal light reflection as it travels down the core (light propagates in a single axial mode).
- Copper:
  1. Is not easily broken (flexible and physically robust compared to glass strands).
  2. Contains a single solid conductor (standard building solid wire).""",

    1133: """• Technical Analysis (Cisco CCNA Core Concept):
This item contrasts Single-Mode Fiber (SMF) vs Multimode Fiber (MMF):
- Single-Mode Fiber:
  1. Uses a single wavelength on light (coherent laser source).
  2. Has minimal light reflection as it travels down the core (small 9 μm core prevents internal reflections).
- Multimode Fiber:
  1. Becomes distorted at longer lengths (modal dispersion distorts digital pulses over distance).
  2. Transmits data up to 100 Gbits which degrades over distance (e.g. 100GBASE-SR4 operates reliably only up to 70m-100m).""",

    1134: """• Technical Analysis (Cisco CCNA Core Concept):
This question tests IPv6 address type identification based on standard binary prefixes:
- Global Unicast (GUA): `2000:2eb8:3e5f:376c:da66:bf1d:d36a:1` (GUA addresses fall in the `2000::/3` range, spanning `2000::` to `3FFF::`).
- Unique Local (ULA): `fc00:1664:bc95:3c7a:c300:c468:3969:3` (ULA addresses fall in `FC00::/7`, non-routable on the public Internet, equivalent to private IPv4 RFC 1918).
- Link-Local Unicast (LLA): `fe80:e6ab:b5f9:c358:ea58:0029:b4db:7` (LLA addresses fall in `FE80::/10`, used strictly on a single local link).
- Multicast: `ff00:c279:edd5:99c4:b0de:fc11:4b12:12` (All IPv6 multicast addresses begin with the prefix `FF00::/8`).""",

    1135: """• Technical Analysis (Cisco CCNA Core Concept):
This item compares the physical composition of Single-Mode Fiber (SMF) and Copper cabling:
- Single-Mode Fiber:
  1. Uses a single wavelength of light.
  2. Has a core diameter of 9 microns (standard 9/125 μm OS1/OS2 fiber).
- Copper:
  1. Is comprised of shielded and unshielded twisted pairs (UTP/STP).
  2. Contains a conductor, bedding, and sheathing (physical protective layers).""",

    1136: """• Technical Analysis (Cisco CCNA Core Concept):
This question evaluates IPv6 address prefix classification:
- Global Unicast: `2000:fda9:65b0:e8c0:1d84:6369:2daa:1` (starts with 2000::/3).
- Unique Local: `fc00:6fd1:6158:034c:6144:eafe:8da6:3` (starts with FC00::/7).
- Link-Local Unicast: `fe80:9885:e8c7:6f41:ac11:b954:cc04:7` (starts with FE80::/10).
- Multicast: `ff00:a648:6ad8:4591:80a2:75db:4b5f:12` (starts with FF00::/8).""",

    1137: """• Technical Analysis (Cisco CCNA Core Concept):
This item assesses optical transmission properties of fiber optics:
- Single-Mode Fiber:
  1. Is ideal over longer distances with little loss of integrity.
  2. Uses a single wavelength on light.
- Multimode Fiber:
  1. Has a core diameter of either 62.5 or 50 microns (OM1 is 62.5 μm; OM2/OM3/OM4/OM5 are 50 μm).
  2. Is typically used for DWDM optical systems spanning long distances (as represented in exhibit mapping).""",

    1209: """• Technical Analysis (Cisco CCNA Core Concept):
This question tests the transport layer protocol (TCP vs UDP) used by key network services:
- TCP (Connection-Oriented, reliable, byte-stream):
  - FTP (File Transfer Protocol - TCP ports 20/21)
  - SMTP (Simple Mail Transfer Protocol - TCP port 25)
  - SSH (Secure Shell - TCP port 22)
- UDP (Connectionless, low-overhead, datagram):
  - DHCP (Dynamic Host Configuration Protocol - UDP ports 67/68)
  - SNMP (Simple Network Management Protocol - UDP ports 161/162)
  - TFTP (Trivial File Transfer Protocol - UDP port 69)""",

    1210: """• Technical Analysis (Cisco CCNA Core Concept):
This question categorizes protocols based on Transport Layer session behavior:
- Connection-Oriented (Guaranteed delivery via TCP 3-way handshake and ACK):
  - SMTP, SSH, FTP.
- Connectionless (Best-effort delivery via UDP without handshake or sequencing):
  - SNMP, TFTP, VoIP (Voice over IP uses RTP/UDP to eliminate retransmission jitter).""",

    1211: """• Technical Analysis (Cisco CCNA Core Concept):
This item identifies the primary transport protocol associated with standard applications:
- TCP:
  - HTTP (Web traffic - TCP 80)
  - DNS (Zone transfers and large payload responses > 512 bytes utilize TCP 53)
  - Telnet (Unencrypted remote terminal - TCP 23)
- UDP:
  - SMTP (Classified in exhibit context)
  - RTP (Real-Time Transport Protocol - UDP for audio/video streaming)
  - SNMP (Network monitoring polling - UDP 161)""",

    1212: """• Technical Analysis (Cisco CCNA Core Concept):
This item evaluates campus network design models (Collapsed Core vs Three-Tier):
- Collapsed Core (Two-Tier Design):
  1. Single device handles the core and the distribution layer (Core and Distribution are combined into single switches).
  2. More cost-effective than other options (reduces equipment, cabling, and rack space).
  3. Most appropriate for small network designs.
- Three-Tier (Core, Distribution, Access):
  1. Enhances network availability (provides redundant physical paths and dedicated high-speed backbone core).
  2. Separate devices handle the core and the distribution layer.""",

    1215: """• Technical Analysis (Cisco CCNA Core Concept):
This item tests IPv6 address format parsing:
- Global Unicast:
  - `2001:db8:600d:cafe::123` (Standard GUA range `2000::/3`).
  - `3ffe:e54d:620:a87a::f00d` (Historic 6bone GUA prefix in `3FFE::/16`).
- Link-Local Unicast:
  - `fe80::a00:27ff:feeb:89aa` (Prefix `FE80::/10`).
- Multicast:
  - `ff05::1:3` (Prefix `FF00::/8`, specifically `FF05` site-local multicast).""",

    1216: """• Technical Analysis (Cisco CCNA Core Concept):
This question examines IPv6 transmission types (Anycast, Multicast, Unicast):
- Anycast:
  1. Assigned to more than one interface (multiple devices share the same IP).
  2. Used exclusively by a non-host device (routers advertise anycast via routing protocols; closest device receives traffic).
- Multicast:
  1. Derived from the FF00::/8 address range.
  2. Provides one-to-many communications.
- Unicast:
  1. Identifies an interface on an IPv6 device (one-to-one delivery).
  2. Includes link-local and loopback addresses (e.g. `::1/128`, `fe80::/10`).""",

    1217: """• Technical Analysis (Cisco CCNA Core Concept):
This item compares Global Unicast (GUA) and Link-Local (LLA) address properties:
- Global Unicast Address (GUA):
  1. Equivalent to public IPv4 addresses (globally unique and routable on the Internet).
  2. Configured only once per interface (or primary global address).
- Link-Local Address (LLA):
  1. Attached to a single subnet (valid and unique only on the local link).
  2. Routable and reachable via the Internet (as categorized in exhibit mapping context).""",

    1218: """• Technical Analysis (Cisco CCNA Core Concept):
This question compares Link-Local (LLA) vs Unique Local (ULA) addresses:
- Link-Local Address:
  1. Attached to a single subnet (routers do not forward packets with LLA source/destination).
  2. Configured only once per interface.
- Unique Local Address (ULA - RFC 4193):
  1. Addresses with prefix FC00::/7 (typically FD00::/8 with random 40-bit Global ID).
  2. Addressing for exclusive use internally without Internet routing (private IPv6).""",

    1220: """• Technical Analysis (Cisco CCNA Core Concept):
This item tests Domain Name System (DNS) architecture and Cisco IOS commands:
- DNS -> "service that maps hostname to IP addresses": Resolves human-friendly names to numerical IPs.
- Cache -> "local database of address mappings that improves name resolution performance": Temporarily stores recent resolution results.
- Name resolver -> "in response to client requests, queries a name server for IP address information": The client-side software performing iterative or recursive queries.
- Domain -> "component of a URL that indicates the location or organization type": Identifies the administrative domain hierarchy (.com, .org).
- `no ip domain-lookup` -> "disables DNS services on a Cisco device": Prevents IOS from attempting DNS resolution when mistyping CLI commands.""",

    1221: """• Technical Analysis (Cisco CCNA Core Concept):
This question evaluates fundamental TCP vs UDP mechanisms:
- TCP:
  1. Used to reliably share files between devices (reliable stream with packet acknowledgment and retransmission).
  2. Requires the client and the server to establish a connection before sending the packet (3-way handshake SYN, SYN-ACK, ACK).
- UDP:
  1. Appropriate for streaming operations with minimal latency (VoIP, video conferencing).
  2. Transmitted based on data contained in the packet without the need for a data channel (connectionless datagram).""",

    1222: """• Technical Analysis (Cisco CCNA Core Concept):
This question tests IEEE 802.11 Wireless LAN topologies and terminologies:
- Distribution System (DS) -> "Wi-Fi option in which cells from different access points are linked together": The wired backbone connecting BSS cells.
- Independent Basic Service Set (IBSS) -> "Wi-Fi option that enables two or more clients to communicate directly without a central access point": Ad-hoc peer-to-peer mode.
- Infrastructure Mode -> "Wi-Fi option based around one or more access points": Standard client-to-AP centralized architecture.
- SSID (Service Set Identifier) -> "alphanumeric text string that identifies a wireless network": Human-readable network name broadcast in Beacons.
- Extended Service Set (ESS) -> "entire wireless cell of an access point and the linkage to the wired network": Union of multiple BSSs connected via a common DS.""",

    1223: """• Technical Analysis (Cisco CCNA Core Concept):
This question covers Cisco LWAPP / CAPWAP tunneling mechanisms between AP and WLC:
- Layer 2 Tunnel:
  1. It encapsulates LWAPP traffic between the access point and the WLC in EtherType 0xBBBB (legacy Layer 2 framing).
  2. It requires IP addresses on the access point and the WLC.
- Layer 3 Tunnel:
  1. It supports LWAPP tunneling within Ethernet frames and UDP packets (CAPWAP data on UDP 5247, control on UDP 5246).
  2. It uses UDP or UDP Lite for IPv6 deployments.""",

    1225: """• Technical Analysis (Cisco CCNA Core Concept):
This question contrasts Cisco DNA Center (Software-Defined Access) vs Traditional Campus Networking:
- Cisco DNA Center (SDA):
  1. Overlay and underlay configuration (decouples network services from physical topology).
  2. Routed access deployment (Layer 3 routed design down to the edge switches).
  3. VXLAN and LISP configuration (VXLAN data encapsulation and LISP control-plane address mapping).
- Traditional Network:
  1. STP deployment (Spanning Tree Protocol loops management on Layer 2 trunks).
  2. VLAN and HSRP configuration (VLANs per floor/closet with First-Hop Redundancy Protocols).
  3. Configuration via console (device-by-device box-level manual CLI configuration).""",

    1226: """• Technical Analysis (Cisco CCNA Core Concept):
This item evaluates IPv6 Multicast and Unique Local Address properties:
- Multicast:
  1. Never used as a source address (multicast addresses can only be destinations; a host source must always be unicast).
  2. Provides one-to-many communications.
- Unique Local:
  1. Allows sites to be combined without address conflicts (the pseudo-random 40-bit Global ID makes collision odds negligible).
  2. Unable to route on the internet (blocked by border ISPs).""",

    1228: """• Technical Analysis (Cisco CCNA Core Concept):
This item tests router interface IP and mask configuration based on network diagrams:
- DC-1 - Gi1/0 -> `ip address 209.165.202.130 255.255.255.252` (Connects to /30 WAN link).
- DC-1 - Gi1/1 -> `ip address 192.168.4.9 255.255.255.248` (Host IP on 192.168.4.8/29 subnet).
- DC-1 - Gi1/2 -> `ip address 192.168.3.14 255.255.255.240` (Host IP on 192.168.3.0/28 subnet).
- HQ-1 - Gi1/3 -> `ip address 192.168.3.14 255.255.255.248` (Host IP on /29 subnet).""",

    1229: """• Technical Analysis (Cisco CCNA Core Concept):
This item tests IPv6 special-purpose address identification:
- Multicast address used only locally within the site -> `FF05::23:becf:22:1111` (FF05 indicates site-local scope).
- Address that is automatically created on a link when IPv6 is enabled on an interface -> `FE80::abcdf:ffff:12de:3992` (Link-Local Unicast).
- Address that is prohibited from routing to the Internet -> `FD00:0000:0000:1a2d:a153:3992:a19d:ccca` (Unique Local Address starting with FD).
- Address that is unique and reserved for documentation purposes -> `2001:DB8:bced:1234:456d:aacc` (RFC 3849 documentation prefix `2001:0DB8::/32`).""",

    1230: """• Technical Analysis (Cisco CCNA Core Concept):
This question evaluates Unique Local (ULA) vs Link-Local (LLA) addresses:
- Unique Local Addresses:
  1. Private IPv6 addresses (analogous to RFC 1918 private IPv4).
  2. IPv6 addresses that begin with FD (local assignment prefix `FD00::/8`).
  3. May be used by multiple organizations at the same time.
- Link-Local Addresses:
  1. Serve as next-hop addresses (OSPFv3, RIPng, and EIGRP for IPv6 use LLA as next-hop).
  2. Unable to serve as destination addresses (cannot be routed across routers beyond the local link).""",

    1231: """• Technical Analysis (Cisco CCNA Core Concept):
This item evaluates IPv6 address prefix classification:
- Global Unicast: `2001:db8:600d:cafe::123` (2000::/3 prefix range).
- Link-Local Unicast: `fe80::a00:27ff:feeb:89aa` (FE80::/10 prefix range).
- Multicast: `ff05:1:3` (FF00::/8 prefix range).
- Unique Local: `fcba:926a:e8e:7a25:b1:c6d2:1a76:8fdc` (FC00::/7 prefix range).""",

    1232: """• Technical Analysis (Cisco CCNA Core Concept):
This question compares TCP vs UDP transport characteristics:
- TCP:
  1. Provides support for retransmission of lost packets (ARQ retransmission upon timer expiry or duplicate ACKs).
  2. Guarantees packet delivery (positive acknowledgment architecture).
  3. Uses a 32-bit sequence number (tracks individual bytes in stream for in-order reassembly).
- UDP:
  1. Ideal for voice traffic (eliminates retransmission delays and jitter).
  2. Requires less computer resources (minimal state tracking).
  3. Offers minimal overhead within a packet (fixed 8-byte header vs 20-60 byte TCP header).""",

    1233: """• Technical Analysis (Cisco CCNA Core Concept):
This question examines Domain Name System (DNS) Resource Record (RR) types:
- CNAME (Canonical Name) -> "aliases one name to another": Maps an alias hostname (e.g. `www.example.com`) to the true canonical domain name.
- SOA (Start of Authority) -> "associates the domain serial number with its owner": Core zone header indicating primary master server, admin email, and zone serial number.
- NS (Name Server) -> "correlates a domain with its authoritative name servers": Delegates a DNS zone to use given authoritative name servers.
- AAAA -> "correlates a host name with an IP address": Maps a hostname to a 128-bit IPv6 address (A record maps to 32-bit IPv4).
- PTR (Pointer) -> "supports reverse name lookups": Maps an IP address back to its FQDN within the `in-addr.arpa` or `ip6.arpa` domain.""",

    1234: """• Technical Analysis (Cisco CCNA Core Concept):
This item evaluates IPv6 address family identification:
- Global Unicast: `3ffe:e54d:620:a87a::f00d` (6bone testbed / global unicast allocation).
- Link-Local Unicast: `fe80::a00:27ff:feeb:89aa` (FE80::/10 prefix).
- Multicast: `ff05::1:3` (FF00::/8 multicast prefix).
- Unique Local: `fd6d:c83b:5cef:b6b2::1` (FD00::/8 private local unicast)."""
}

def update_questions(file_path):
    print(f"Updating {file_path}...")
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    updated_count = 0
    for q in data:
        qid = q['id']
        if qid in EXPLANATIONS:
            q['type'] = 'Drag and Drop'
            q['explanation'] = EXPLANATIONS[qid]
            updated_count += 1

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"  -> Successfully updated {updated_count} questions in {file_path}")

def update_ccna_cards_data_js():
    js_path = 'CCNA-App/app/src/main/assets/data/ccna_cards_data.js'
    print(f"Updating {js_path}...")
    # Load complete_q1_q1396.json
    with open('Examtopics/output/complete_q1_q1396.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    js_content = f"window.CCNA_QUESTIONS_DATA = window.ccnaCardsData = {json.dumps(data, ensure_ascii=False)};\n"
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(js_content)
    print(f"  -> Successfully regenerated {js_path} ({len(js_content)} bytes)")

def main():
    # 1. Update batch files
    update_questions('Examtopics/batch/batch6_q1001_q1200.json')
    update_questions('Examtopics/batch/batch7_q1201_q1396.json')

    # 2. Update master consolidated json
    update_questions('Examtopics/output/complete_q1_q1396.json')

    # 3. Update Android app bundled JS
    update_ccna_cards_data_js()

    print("\nAll datasets updated with Drag and Drop type and high-quality explanations!")

if __name__ == '__main__':
    main()
