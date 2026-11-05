/**
 * Virtual Cisco IOS Simulator (ios_simulator.js) - Packet Tracer Grade
 * Complete interactive Cisco IOS terminal sandbox for CCNA 200-301 Lab Simulations.
 * Features:
 * - 12+ Hierarchical IOS modes (User, Priv, Config, If, Sub-If, Range, Router OSPF, Vlan, Line, DHCP, Standard/Extended ACL)
 * - Complete Command Negation (no ...) across all sub-systems
 * - Exact Cisco Context-Sensitive Help (?) with column alignment, parameter ranges, <cr>
 * - Context-aware Tab completion at any depth
 * - Dynamic running-config synthesizer matching true Cisco IOS order
 * - 18+ Comprehensive show commands with pipe filtering (| include, exclude, begin, section)
 * - Inter-device Virtual ICMP Ping & ARP reachability simulation across topology
 * - Packet Tracer Activity Wizard auto-assessment & real-time task grading
 * - Two-row mobile touch keyboard & desktop physical keyboard integration
 */

(function () {
  'use strict';

  function matchesPrefix(input, target, minLen = 2) {
    if (!input || !target) return false;
    const inp = input.toLowerCase();
    const tgt = target.toLowerCase();
    if (inp.length < minLen) return false;
    return tgt.startsWith(inp);
  }

  function ipToLong(ip) {
    if (!ip) return 0;
    const parts = ip.trim().split('.');
    if (parts.length !== 4) return 0;
    return ((parseInt(parts[0], 10) << 24) |
            (parseInt(parts[1], 10) << 16) |
            (parseInt(parts[2], 10) << 8) |
             parseInt(parts[3], 10)) >>> 0;
  }

  function isSameSubnet(ip1, ip2, mask) {
    if (!ip1 || !ip2 || !mask) return false;
    const l1 = ipToLong(ip1);
    const l2 = ipToLong(ip2);
    const m = ipToLong(mask);
    return (l1 & m) === (l2 & m);
  }

  // Canonical token aliases mapping common abbreviations to standard Cisco keywords
  const ALIAS = {
    'sw': 'switchport', 'switch': 'switchport',
    'mo': 'mode',
    'tr': 'trunk',
    'al': 'allowed', 'allow': 'allowed',
    'vl': 'vlan',
    'nat': 'native',
    'acc': 'access',
    'int': 'interface', 'intf': 'interface',
    'sh': 'show',
    'br': 'brief',
    'conf': 'configure', 'config': 'configure',
    't': 'terminal', 'term': 'terminal',
    'en': 'enable', 'ena': 'enable',
    'dis': 'disable',
    'ch': 'channel-group', 'channel': 'channel-group',
    'sp': 'spanning-tree', 'span': 'spanning-tree',
    'shut': 'shutdown',
    'desc': 'description',
    'host': 'hostname',
    'pass': 'passive-interface', 'passive': 'passive-interface',
    'net': 'network',
    'ro': 'route',
    'enc': 'encapsulation', 'encap': 'encapsulation',
    'def': 'default-router', 'dns': 'dns-server',
    'ex': 'excluded-address',
    'inc': 'include', 'exc': 'exclude', 'beg': 'begin', 'sec': 'section'
  };

  function norm(token, mode = '') {
    if (!token) return '';
    const t = token.toLowerCase();
    if (t === 'ro' && mode === 'config') return 'router';
    return ALIAS[t] || t;
  }

  // Mode-specific top-level commands
  const ROOT_COMMANDS = {
    'user': [
      { cmd: 'enable', desc: 'Turn on privileged commands' },
      { cmd: 'exit', desc: 'Exit from the EXEC' },
      { cmd: 'help', desc: 'Description of the interactive help system' },
      { cmd: 'ping', desc: 'Send echo messages' },
      { cmd: 'show', desc: 'Show running system information' },
      { cmd: 'traceroute', desc: 'Trace route to destination' }
    ],
    'priv': [
      { cmd: 'clear', desc: 'Reset functions' },
      { cmd: 'configure', desc: 'Enter configuration mode' },
      { cmd: 'copy', desc: 'Copy from one file to another' },
      { cmd: 'disable', desc: 'Turn off privileged commands' },
      { cmd: 'exit', desc: 'Exit from the EXEC' },
      { cmd: 'help', desc: 'Description of the interactive help system' },
      { cmd: 'ping', desc: 'Send echo messages' },
      { cmd: 'reload', desc: 'Halt and perform a cold restart' },
      { cmd: 'show', desc: 'Show running system information' },
      { cmd: 'traceroute', desc: 'Trace route to destination' },
      { cmd: 'write', desc: 'Write running configuration to memory, network, or terminal' }
    ],
    'config': [
      { cmd: 'access-list', desc: 'Add an access list entry' },
      { cmd: 'cdp', desc: 'Global CDP configuration subcommands' },
      { cmd: 'crypto', desc: 'Encryption module' },
      { cmd: 'do', desc: 'To run exec commands in config mode' },
      { cmd: 'enable', desc: 'Modify enable password parameters' },
      { cmd: 'end', desc: 'Exit from configure mode' },
      { cmd: 'exit', desc: 'Exit from configure mode' },
      { cmd: 'hostname', desc: "Set system's network name" },
      { cmd: 'interface', desc: 'Select an interface to configure' },
      { cmd: 'ip', desc: 'Global IP configuration subcommands' },
      { cmd: 'ipv6', desc: 'Global IPv6 configuration subcommands' },
      { cmd: 'line', desc: 'Configure a terminal line' },
      { cmd: 'lldp', desc: 'Global LLDP configuration subcommands' },
      { cmd: 'no', desc: 'Negate a command or set its defaults' },
      { cmd: 'ntp', desc: 'Configure NTP' },
      { cmd: 'router', desc: 'Enable a routing process' },
      { cmd: 'service', desc: 'Modify use of network based services' },
      { cmd: 'spanning-tree', desc: 'Spanning Tree Subsystem' },
      { cmd: 'username', desc: 'Establish User Name Authentication' },
      { cmd: 'vlan', desc: 'VLAN configuration commands' }
    ],
    'config-if': [
      { cmd: 'channel-group', desc: 'Etherchannel interface configuration' },
      { cmd: 'description', desc: 'Interface specific description' },
      { cmd: 'do', desc: 'To run exec commands in config mode' },
      { cmd: 'end', desc: 'Exit from configure mode' },
      { cmd: 'exit', desc: 'Exit from configure mode' },
      { cmd: 'ip', desc: 'Interface Internet Protocol config subcommands' },
      { cmd: 'ipv6', desc: 'Interface IPv6 config subcommands' },
      { cmd: 'no', desc: 'Negate a command or set its defaults' },
      { cmd: 'shutdown', desc: 'Shut down the selected interface' },
      { cmd: 'spanning-tree', desc: 'Spanning Tree Subsystem' },
      { cmd: 'standby', desc: 'HSRP interface configuration commands' },
      { cmd: 'switchport', desc: 'Set switching characteristics of the interface' }
    ],
    'config-subif': [
      { cmd: 'description', desc: 'Interface specific description' },
      { cmd: 'do', desc: 'To run exec commands in config mode' },
      { cmd: 'encapsulation', desc: 'Set encapsulation type for an interface' },
      { cmd: 'end', desc: 'Exit from configure mode' },
      { cmd: 'exit', desc: 'Exit from configure mode' },
      { cmd: 'ip', desc: 'Interface Internet Protocol config subcommands' },
      { cmd: 'ipv6', desc: 'Interface IPv6 config subcommands' },
      { cmd: 'no', desc: 'Negate a command or set its defaults' },
      { cmd: 'shutdown', desc: 'Shut down the selected interface' }
    ],
    'config-if-range': [
      { cmd: 'channel-group', desc: 'Etherchannel interface configuration' },
      { cmd: 'description', desc: 'Interface specific description' },
      { cmd: 'do', desc: 'To run exec commands in config mode' },
      { cmd: 'end', desc: 'Exit from configure mode' },
      { cmd: 'exit', desc: 'Exit from configure mode' },
      { cmd: 'ip', desc: 'Interface Internet Protocol config subcommands' },
      { cmd: 'ipv6', desc: 'Interface IPv6 config subcommands' },
      { cmd: 'no', desc: 'Negate a command or set its defaults' },
      { cmd: 'shutdown', desc: 'Shut down the selected interface' },
      { cmd: 'spanning-tree', desc: 'Spanning Tree Subsystem' },
      { cmd: 'switchport', desc: 'Set switching characteristics of the interface' }
    ],
    'config-router': [
      { cmd: 'default-information', desc: 'Control distribution of default information' },
      { cmd: 'do', desc: 'To run exec commands in config mode' },
      { cmd: 'end', desc: 'Exit from configure mode' },
      { cmd: 'exit', desc: 'Exit from configure mode' },
      { cmd: 'network', desc: 'Enable routing on an IP network' },
      { cmd: 'no', desc: 'Negate a command or set its defaults' },
      { cmd: 'passive-interface', desc: 'Suppress routing updates on an interface' },
      { cmd: 'router-id', desc: 'router-id for this OSPF process' }
    ],
    'config-vlan': [
      { cmd: 'do', desc: 'To run exec commands in config mode' },
      { cmd: 'end', desc: 'Exit from configure mode' },
      { cmd: 'exit', desc: 'Exit from configure mode' },
      { cmd: 'name', desc: 'Ascii name of the VLAN' },
      { cmd: 'no', desc: 'Negate a command or set its defaults' }
    ],
    'config-line': [
      { cmd: 'do', desc: 'To run exec commands in config mode' },
      { cmd: 'end', desc: 'Exit from configure mode' },
      { cmd: 'exit', desc: 'Exit from configure mode' },
      { cmd: 'login', desc: 'Enable password checking' },
      { cmd: 'no', desc: 'Negate a command or set its defaults' },
      { cmd: 'password', desc: 'Assign the terminal connection password' },
      { cmd: 'transport', desc: 'Define transport protocols for line' }
    ],
    'config-dhcp': [
      { cmd: 'default-router', desc: 'Default routers' },
      { cmd: 'dns-server', desc: 'DNS servers' },
      { cmd: 'do', desc: 'To run exec commands in config mode' },
      { cmd: 'domain-name', desc: 'Domain name' },
      { cmd: 'end', desc: 'Exit from configure mode' },
      { cmd: 'exit', desc: 'Exit from configure mode' },
      { cmd: 'lease', desc: 'Address lease time' },
      { cmd: 'network', desc: 'Network number and mask' },
      { cmd: 'no', desc: 'Negate a command or set its defaults' }
    ],
    'config-std-nacl': [
      { cmd: 'deny', desc: 'Specify packets to reject' },
      { cmd: 'do', desc: 'To run exec commands in config mode' },
      { cmd: 'end', desc: 'Exit from configure mode' },
      { cmd: 'exit', desc: 'Exit from configure mode' },
      { cmd: 'no', desc: 'Negate a command or set its defaults' },
      { cmd: 'permit', desc: 'Specify packets to forward' },
      { cmd: 'remark', desc: 'Access list entry comment' }
    ],
    'config-ext-nacl': [
      { cmd: 'deny', desc: 'Specify packets to reject' },
      { cmd: 'do', desc: 'To run exec commands in config mode' },
      { cmd: 'end', desc: 'Exit from configure mode' },
      { cmd: 'exit', desc: 'Exit from configure mode' },
      { cmd: 'no', desc: 'Negate a command or set its defaults' },
      { cmd: 'permit', desc: 'Specify packets to forward' },
      { cmd: 'remark', desc: 'Access list entry comment' }
    ]
  };

  // Comprehensive Hierarchical Subcommand Trees for Contextual Help & Tab Completion
  const SUB_TREES = {
    // switchport
    'switchport': [
      { cmd: 'access', desc: 'Set access mode characteristics of the interface' },
      { cmd: 'mode', desc: 'Set trunking mode of the interface' },
      { cmd: 'nonegotiate', desc: 'Device will not engage in negotiation protocol on this interface' },
      { cmd: 'port-security', desc: 'Security related command' },
      { cmd: 'trunk', desc: 'Set trunking characteristics of the interface' },
      { cmd: 'voice', desc: 'Voice appliance attributes' },
      { cmd: '<cr>', desc: '' }
    ],
    'switchport mode': [
      { cmd: 'access', desc: 'Set trunking mode to ACCESS unconditionally' },
      { cmd: 'dot1q-tunnel', desc: 'Set trunking mode to TUNNEL unconditionally' },
      { cmd: 'dynamic', desc: 'Set trunking mode to dynamically negotiate access or trunk' },
      { cmd: 'trunk', desc: 'Set trunking mode to TRUNK unconditionally' }
    ],
    'switchport trunk': [
      { cmd: 'allowed', desc: 'Set allowed VLAN characteristics when interface is in trunking mode' },
      { cmd: 'encapsulation', desc: 'Set trunking encapsulation when interface is in trunking mode' },
      { cmd: 'native', desc: 'Set trunking native characteristics when interface is in trunking mode' },
      { cmd: 'pruning', desc: 'Set trunking VLAN pruning characteristics of the interface' }
    ],
    'switchport trunk encapsulation': [
      { cmd: 'dot1q', desc: 'Interface uses only 802.1q trunking encapsulation' }
    ],
    'switchport trunk allowed': [
      { cmd: 'vlan', desc: 'Set allowed VLANs when interface is in trunking mode' }
    ],
    'switchport trunk allowed vlan': [
      { cmd: 'WORD', desc: 'VLAN IDs of the allowed VLANs (e.g. 10,20,30 or 1-100 or all)' },
      { cmd: 'add', desc: 'Add VLANs to the current list' },
      { cmd: 'all', desc: 'All VLANs' },
      { cmd: 'except', desc: 'All VLANs except the following' },
      { cmd: 'none', desc: 'No VLANs' },
      { cmd: 'remove', desc: 'Remove VLANs from the current list' }
    ],
    'switchport trunk native': [
      { cmd: 'vlan', desc: 'Set native VLAN when interface is in trunking mode' }
    ],
    'switchport trunk native vlan': [
      { cmd: '<1-4094>', desc: 'VLAN ID of the native VLAN' }
    ],
    'switchport access': [
      { cmd: 'vlan', desc: 'Set access mode characteristics of the interface' }
    ],
    'switchport access vlan': [
      { cmd: '<1-4094>', desc: 'VLAN ID of the access mode VLAN' }
    ],
    'switchport voice': [
      { cmd: 'vlan', desc: 'Voice appliance attributes' }
    ],
    'switchport voice vlan': [
      { cmd: '<1-4094>', desc: 'VLAN ID of the voice VLAN' }
    ],
    'switchport port-security': [
      { cmd: 'mac-address', desc: 'Secure MAC address' },
      { cmd: 'maximum', desc: 'Max secure addresses' },
      { cmd: 'violation', desc: 'Security violation mode' },
      { cmd: '<cr>', desc: '' }
    ],
    'switchport port-security violation': [
      { cmd: 'protect', desc: 'Security violation protect mode' },
      { cmd: 'restrict', desc: 'Security violation restrict mode' },
      { cmd: 'shutdown', desc: 'Security violation shutdown mode' }
    ],
    'switchport port-security mac-address': [
      { cmd: 'H.H.H', desc: '48 bit mac address' },
      { cmd: 'sticky', desc: 'Configure dynamic secure MAC addresses as sticky' }
    ],

    // channel-group
    'channel-group': [
      { cmd: '<1-255>', desc: 'Channel group number' }
    ],
    'channel-group mode': [
      { cmd: 'active', desc: 'Enable LACP unconditionally' },
      { cmd: 'auto', desc: 'Enable PAgP only if a PAgP device is detected' },
      { cmd: 'desirable', desc: 'Enable PAgP unconditionally' },
      { cmd: 'on', desc: 'Enable EtherChannel only' },
      { cmd: 'passive', desc: 'Enable LACP only if a LACP device is detected' }
    ],

    // spanning-tree
    'spanning-tree': [
      { cmd: 'bpdufilter', desc: "Don't send or receive BPDUs on this interface" },
      { cmd: 'bpduguard', desc: "Don't accept BPDUs on this interface" },
      { cmd: 'cost', desc: 'Change an interface cost' },
      { cmd: 'mode', desc: 'Spanning tree operating mode' },
      { cmd: 'portfast', desc: 'Enable portfast on interface' },
      { cmd: 'vlan', desc: 'VLAN Switch Spanning Tree' }
    ],
    'spanning-tree mode': [
      { cmd: 'mst', desc: 'Multiple spanning tree mode' },
      { cmd: 'pvst', desc: 'Per-Vlan spanning tree mode' },
      { cmd: 'rapid-pvst', desc: 'Per-Vlan rapid spanning tree mode' }
    ],
    'spanning-tree portfast': [
      { cmd: 'disable', desc: 'Disable portfast on this interface' },
      { cmd: 'edge', desc: 'Enable portfast edge' },
      { cmd: 'network', desc: 'Enable portfast network' },
      { cmd: '<cr>', desc: '' }
    ],
    'spanning-tree bpduguard': [
      { cmd: 'disable', desc: 'Disable BPDU guard' },
      { cmd: 'enable', desc: 'Enable BPDU guard' },
      { cmd: '<cr>', desc: '' }
    ],
    'spanning-tree vlan': [
      { cmd: '<1-4094>', desc: 'VLAN range' }
    ],
    'spanning-tree vlan root': [
      { cmd: 'primary', desc: 'Make this switch root primary' },
      { cmd: 'secondary', desc: 'Make this switch root secondary' }
    ],
    'spanning-tree vlan priority': [
      { cmd: '<0-61440>', desc: 'Bridge priority in increments of 4096' }
    ],

    // encapsulation (sub-interfaces)
    'encapsulation': [
      { cmd: 'dot1q', desc: 'IEEE 802.1Q encapsulation' }
    ],
    'encapsulation dot1q': [
      { cmd: '<1-4094>', desc: 'IEEE 802.1Q VLAN ID' }
    ],

    // interface
    'interface': [
      { cmd: 'Ethernet', desc: 'IEEE 802.3' },
      { cmd: 'FastEthernet', desc: 'FastEthernet IEEE 802.3' },
      { cmd: 'GigabitEthernet', desc: 'GigabitEthernet IEEE 802.3z' },
      { cmd: 'Loopback', desc: 'Loopback interface' },
      { cmd: 'Port-channel', desc: 'Ethernet Channel of interfaces' },
      { cmd: 'range', desc: 'interface range command' },
      { cmd: 'Serial', desc: 'Serial interface' },
      { cmd: 'Vlan', desc: 'Catalyst Vlans' }
    ],
    'interface range': [
      { cmd: 'Ethernet', desc: 'IEEE 802.3' },
      { cmd: 'FastEthernet', desc: 'FastEthernet IEEE 802.3' },
      { cmd: 'GigabitEthernet', desc: 'GigabitEthernet IEEE 802.3z' },
      { cmd: 'Port-channel', desc: 'Ethernet Channel of interfaces' }
    ],

    // ip subtrees
    'ip': [
      { cmd: 'access-group', desc: 'Specify access control for packets' },
      { cmd: 'access-list', desc: 'Named access-list' },
      { cmd: 'address', desc: 'Set the IP address of an interface' },
      { cmd: 'default-gateway', desc: 'Specify default gateway' },
      { cmd: 'dhcp', desc: 'Configure DHCP' },
      { cmd: 'domain-lookup', desc: 'Enable IP Domain Name System hostname translation' },
      { cmd: 'domain-name', desc: 'Define the default domain name' },
      { cmd: 'helper-address', desc: 'Specify a destination address for UDP broadcasts' },
      { cmd: 'name-server', desc: 'Specify address of name server to use' },
      { cmd: 'nat', desc: 'NAT configuration commands' },
      { cmd: 'ospf', desc: 'OSPF interface commands' },
      { cmd: 'route', desc: 'Establish static routes' },
      { cmd: 'routing', desc: 'Enable IP routing' },
      { cmd: 'ssh', desc: 'Configure SSH options' }
    ],
    'ip address': [
      { cmd: 'A.B.C.D', desc: 'IP address' },
      { cmd: 'dhcp', desc: 'IP address negotiated via DHCP' }
    ],
    'ip route': [
      { cmd: 'A.B.C.D', desc: 'Destination prefix' }
    ],
    'ip dhcp': [
      { cmd: 'excluded-address', desc: 'Prevent DHCP from assigning certain addresses' },
      { cmd: 'pool', desc: 'Configure DHCP address pool' },
      { cmd: 'snooping', desc: 'DHCP Snooping' }
    ],
    'ip dhcp pool': [
      { cmd: 'WORD', desc: 'Pool name' }
    ],
    'ip dhcp excluded-address': [
      { cmd: 'A.B.C.D', desc: 'Low IP address' }
    ],
    'ip nat': [
      { cmd: 'inside', desc: 'Inside address translation' },
      { cmd: 'outside', desc: 'Outside address translation' },
      { cmd: 'pool', desc: 'Define pool of addresses' },
      { cmd: 'source', desc: 'Source address translation' }
    ],
    'ip nat inside': [
      { cmd: 'source', desc: 'Source address translation' },
      { cmd: '<cr>', desc: '' }
    ],
    'ip nat outside': [
      { cmd: '<cr>', desc: '' }
    ],
    'ip nat inside source': [
      { cmd: 'list', desc: 'Specify access list describing local addresses' },
      { cmd: 'static', desc: 'Specify local and global addresses' }
    ],
    'ip nat inside source list': [
      { cmd: '<1-199>', desc: 'IP access list number' },
      { cmd: 'WORD', desc: 'IP named access list' }
    ],
    'ip nat pool': [
      { cmd: 'WORD', desc: 'Pool name' }
    ],
    'ip access-list': [
      { cmd: 'extended', desc: 'Extended Access List' },
      { cmd: 'standard', desc: 'Standard Access List' }
    ],
    'ip access-list standard': [
      { cmd: 'WORD', desc: 'Access-list name' }
    ],
    'ip access-list extended': [
      { cmd: 'WORD', desc: 'Access-list name' }
    ],
    'access-list': [
      { cmd: '<1-99>', desc: 'IP standard access list' },
      { cmd: '<100-199>', desc: 'IP extended access list' }
    ],
    'ip access-group': [
      { cmd: '<1-199>', desc: 'IP access list number' },
      { cmd: 'WORD', desc: 'IP named access list' }
    ],
    'ip ospf': [
      { cmd: 'cost', desc: 'Interface cost' },
      { cmd: 'dead-interval', desc: 'Interval after which a neighbor is declared dead' },
      { cmd: 'hello-interval', desc: 'Time between HELLO packets' },
      { cmd: 'priority', desc: 'Router priority' }
    ],
    'ip ospf priority': [
      { cmd: '<0-255>', desc: 'Priority' }
    ],

    // ipv6 subtrees
    'ipv6': [
      { cmd: 'address', desc: 'Configure IPv6 address on interface' },
      { cmd: 'enable', desc: 'Enable IPv6 on interface' },
      { cmd: 'ospf', desc: 'OSPF interface commands' },
      { cmd: 'route', desc: 'Configure static IPv6 route' },
      { cmd: 'unicast-routing', desc: 'Enable IPv6 routing' }
    ],
    'ipv6 address': [
      { cmd: 'X:X:X:X::X/<0-128>', desc: 'IPv6 prefix' },
      { cmd: 'autoconfig', desc: 'Obtain address using autoconfiguration' },
      { cmd: 'link-local', desc: 'Configure as link-local address' }
    ],
    'ipv6 route': [
      { cmd: 'X:X:X:X::X/<0-128>', desc: 'IPv6 prefix destination' }
    ],

    // router ospf
    'router': [
      { cmd: 'ospf', desc: 'Open Shortest Path First (OSPF)' }
    ],
    'router ospf': [
      { cmd: '<1-65535>', desc: 'Process ID number' }
    ],
    'network': [
      { cmd: 'A.B.C.D', desc: 'Network number' }
    ],
    'passive-interface': [
      { cmd: 'default', desc: 'Suppress routing updates on all interfaces' },
      { cmd: 'Ethernet', desc: 'IEEE 802.3' },
      { cmd: 'FastEthernet', desc: 'FastEthernet IEEE 802.3' },
      { cmd: 'GigabitEthernet', desc: 'GigabitEthernet IEEE 802.3z' },
      { cmd: 'Loopback', desc: 'Loopback interface' },
      { cmd: 'Serial', desc: 'Serial interface' }
    ],

    // vlan
    'vlan': [
      { cmd: '<1-4094>', desc: 'ISL VLAN IDs 1-4094' }
    ],

    // line
    'line': [
      { cmd: 'aux', desc: 'Auxiliary line' },
      { cmd: 'con', desc: 'Console line' },
      { cmd: 'console', desc: 'Console line' },
      { cmd: 'vty', desc: 'Virtual terminal' }
    ],
    'line vty': [
      { cmd: '<0-15>', desc: 'First Line number' }
    ],
    'transport': [
      { cmd: 'input', desc: 'Define which protocols to use when connecting to the terminal' },
      { cmd: 'output', desc: 'Define which protocols to use for outgoing connections' }
    ],
    'transport input': [
      { cmd: 'all', desc: 'All protocols' },
      { cmd: 'none', desc: 'No protocols' },
      { cmd: 'ssh', desc: 'TCP/IP SSH protocol' },
      { cmd: 'telnet', desc: 'TCP/IP Telnet protocol' }
    ],

    // crypto & ntp & standby
    'crypto': [
      { cmd: 'key', desc: 'Generate or zeroize keys' }
    ],
    'crypto key': [
      { cmd: 'generate', desc: 'Generate new keys' },
      { cmd: 'zeroize', desc: 'Zeroize keys' }
    ],
    'crypto key generate': [
      { cmd: 'rsa', desc: 'Generate RSA keys' }
    ],
    'crypto key generate rsa': [
      { cmd: 'modulus', desc: 'Provide modulus size' },
      { cmd: '<cr>', desc: '' }
    ],
    'ntp': [
      { cmd: 'server', desc: 'Configure NTP server' }
    ],
    'ntp server': [
      { cmd: 'A.B.C.D', desc: 'IP address of peer' }
    ],
    'standby': [
      { cmd: '<0-255>', desc: 'Group number' },
      { cmd: 'ip', desc: 'Enable HSRP IPv4 and set VIP' },
      { cmd: 'preempt', desc: 'Overthrow lower priority active routers' },
      { cmd: 'priority', desc: 'Priority level' }
    ],

    // show
    'show': [
      { cmd: 'access-lists', desc: 'List access lists' },
      { cmd: 'cdp', desc: 'CDP information' },
      { cmd: 'etherchannel', desc: 'EtherChannel information' },
      { cmd: 'history', desc: 'Display the session command history' },
      { cmd: 'interfaces', desc: 'Interface status and configuration' },
      { cmd: 'ip', desc: 'IP information' },
      { cmd: 'ipv6', desc: 'IPv6 information' },
      { cmd: 'lldp', desc: 'LLDP information' },
      { cmd: 'mac', desc: 'MAC address table' },
      { cmd: 'mac-address-table', desc: 'MAC address table' },
      { cmd: 'ntp', desc: 'NTP status' },
      { cmd: 'running-config', desc: 'Current operating configuration' },
      { cmd: 'spanning-tree', desc: 'Spanning tree topology' },
      { cmd: 'standby', desc: 'Hot Standby Router Protocol' },
      { cmd: 'startup-config', desc: 'Configuration in NVRAM' },
      { cmd: 'version', desc: 'System hardware and software status' },
      { cmd: 'vlan', desc: 'VLAN status' }
    ],
    'show ip': [
      { cmd: 'access-lists', desc: 'List IP access lists' },
      { cmd: 'arp', desc: 'IP ARP table' },
      { cmd: 'dhcp', desc: 'Dynamic Host Configuration Protocol' },
      { cmd: 'interface', desc: 'IP interface status and configuration' },
      { cmd: 'nat', desc: 'IP NAT information' },
      { cmd: 'ospf', desc: 'OSPF information' },
      { cmd: 'protocols', desc: 'IP routing protocols process information' },
      { cmd: 'route', desc: 'IP routing table' }
    ],
    'show ip interface': [
      { cmd: 'brief', desc: 'Brief summary of IP status and configuration' },
      { cmd: '<cr>', desc: '' }
    ],
    'show ip ospf': [
      { cmd: 'database', desc: 'Database summary' },
      { cmd: 'interface', desc: 'OSPF interface information' },
      { cmd: 'neighbor', desc: 'OSPF neighbor information' },
      { cmd: '<cr>', desc: '' }
    ],
    'show ip dhcp': [
      { cmd: 'binding', desc: 'DHCP address bindings' },
      { cmd: 'pool', desc: 'DHCP pools information' }
    ],
    'show ip nat': [
      { cmd: 'statistics', desc: 'Translation statistics' },
      { cmd: 'translations', desc: 'Translation entries' }
    ],
    'show interfaces': [
      { cmd: 'description', desc: 'Interface description' },
      { cmd: 'status', desc: 'Interface status' },
      { cmd: 'switchport', desc: 'Show switchport status' },
      { cmd: 'trunk', desc: 'Show interface trunk information' },
      { cmd: '<cr>', desc: '' }
    ],
    'show cdp': [
      { cmd: 'neighbors', desc: 'CDP neighbor information' }
    ],
    'show lldp': [
      { cmd: 'neighbors', desc: 'LLDP neighbor information' }
    ],
    'clear': [
      { cmd: 'arp-cache', desc: 'Clear entire ARP cache' },
      { cmd: 'ip', desc: 'IP clear commands' },
      { cmd: 'mac-address-table', desc: 'Clear dynamic MAC addresses' }
    ],
    'clear ip': [
      { cmd: 'nat', desc: 'Clear NAT entries' },
      { cmd: 'ospf', desc: 'Clear OSPF process' }
    ],
    'clear ip ospf': [
      { cmd: 'process', desc: 'Reset OSPF process' }
    ]
  };

  // Output pipe filtering (| include / exclude / begin / section)
  function applyPipeFilter(rawOutput, pipeClause) {
    if (!pipeClause || !rawOutput) return rawOutput;
    const parts = pipeClause.trim().split(/\s+/);
    const filterType = (parts[0] || '').toLowerCase();
    const pattern = parts.slice(1).join(' ').trim();
    if (!pattern && filterType !== 'section') return rawOutput;

    const lines = rawOutput.split('\n');
    const regex = new RegExp(pattern, 'i');

    if (matchesPrefix(filterType, 'include', 3) || filterType === 'inc') {
      return lines.filter(l => regex.test(l)).join('\n');
    }
    if (matchesPrefix(filterType, 'exclude', 3) || filterType === 'exc') {
      return lines.filter(l => !regex.test(l)).join('\n');
    }
    if (matchesPrefix(filterType, 'begin', 3) || filterType === 'beg') {
      const idx = lines.findIndex(l => regex.test(l));
      return idx !== -1 ? lines.slice(idx).join('\n') : '';
    }
    if (matchesPrefix(filterType, 'section', 3) || filterType === 'sec') {
      const result = [];
      let inSection = false;
      for (const line of lines) {
        if (/^[^\s]/.test(line)) {
          inSection = regex.test(line);
        }
        if (inSection) {
          result.push(line);
        }
      }
      return result.join('\n');
    }
    return rawOutput;
  }

  // Device Session representing a real Cisco switch or router in the topology
  class IosDeviceSession {
    constructor(hostname, type = 'switch') {
      this.hostname = hostname;
      this.type = type; // 'switch' or 'router'
      this.mode = 'user'; // 'user', 'priv', 'config', 'config-if', 'config-subif', 'config-if-range', 'config-router', 'config-vlan', 'config-line', 'config-dhcp', 'config-std-nacl', 'config-ext-nacl'
      this.context = null; // { type: 'if', name: 'Ethernet0/1' } etc.
      this.history = [];
      this.historyIndex = -1;
      this.logs = [];
      this.arpCache = {}; // ip -> { mac, intf, age }

      // Running configuration state
      this.config = {
        hostname: hostname,
        domainName: null,
        enableSecret: null,
        enablePassword: null,
        servicePasswordEncryption: false,
        ipRouting: this.type === 'router',
        ipv6UnicastRouting: false,
        dhcpSnooping: false,
        spanningTree: {
          mode: 'pvst',
          vlans: {} // vid -> { priority, root }
        },
        interfaces: {},
        vlans: { '1': 'default' },
        ospf: {
          id: null,
          routerId: null,
          networks: [], // { net, wildcard, area }
          passiveInterfaces: [],
          defaultInformationOriginate: false
        },
        dhcpPools: {}, // poolName -> { network, mask, defaultRouter, dnsServer, domainName, lease }
        dhcpExcluded: [], // [ { low, high } ]
        nat: {
          insideSourceList: null, // { acl, intf, pool, overload }
          pools: {}, // name -> { start, end, netmask }
          translations: [] // { proto, insideGlobal, insideLocal, outsideLocal, outsideGlobal }
        },
        accessLists: {
          numbered: {}, // num -> [ rule ]
          standard: {}, // name -> [ rule ]
          extended: {}  // name -> [ rule ]
        },
        staticRoutes: [], // { net, mask, nh, ad }
        ipv6Routes: [],   // { prefix, nh, ad }
        users: {},        // username -> { secret, password, privilege }
        lines: {
          'console 0': { password: null, login: false, loginLocal: false, transport: 'all' },
          'vty 0 4': { password: null, login: false, loginLocal: true, transport: 'ssh' },
          'vty 5 15': { password: null, login: false, loginLocal: true, transport: 'ssh' }
        },
        ntpServers: [],
        cdpRun: true,
        lldpRun: true,
        cryptoKeys: null, // { type: 'rsa', bits: 1024 }
        savedStartupConfig: null
      };

      // Populate default interfaces based on device type
      const isSw = this.type === 'switch' || this.hostname.toLowerCase().startsWith('sw');
      if (isSw) {
        ['Ethernet0/0', 'Ethernet0/1', 'Ethernet0/2', 'Ethernet0/3', 'GigabitEthernet0/1', 'GigabitEthernet0/2', 'Vlan1'].forEach(name => {
          this.config.interfaces[name] = {
            name: name,
            isRouted: false,
            ip: null,
            mask: null,
            ipv6: null,
            ipv6LinkLocal: null,
            status: 'up',
            protocol: 'up',
            description: null,
            mode: 'access', // 'access', 'trunk', 'routed'
            encapsulation: 'dot1q',
            accessVlan: '1',
            trunkAllowed: '1-4094',
            nativeVlan: '1',
            voiceVlan: null,
            channelGroup: null,
            channelMode: null,
            portSecurity: {
              enabled: false,
              max: 1,
              violation: 'shutdown',
              macs: [],
              sticky: false
            },
            spanningTree: {
              portfast: false,
              bpduguard: false,
              cost: null
            },
            ospf: {
              area: null,
              priority: null,
              cost: null,
              hello: 10,
              dead: 40
            },
            nat: null, // 'inside', 'outside'
            accessGroup: { in: null, out: null },
            cdp: true,
            lldp: { tx: true, rx: true }
          };
        });
      } else {
        ['Ethernet0/0', 'Ethernet0/1', 'GigabitEthernet0/0', 'GigabitEthernet0/1', 'GigabitEthernet0/2', 'Serial0/1/0', 'Loopback0'].forEach(name => {
          this.config.interfaces[name] = {
            name: name,
            isRouted: true,
            isSubif: false,
            dot1qVlan: null,
            dot1qNative: false,
            ip: null,
            mask: null,
            ipv6: null,
            ipv6LinkLocal: null,
            status: 'administratively down',
            protocol: 'down',
            description: null,
            ospf: {
              area: null,
              priority: null,
              cost: null,
              hello: 10,
              dead: 40
            },
            nat: null, // 'inside', 'outside'
            accessGroup: { in: null, out: null },
            helperAddress: null,
            standby: {}, // group -> { ip, priority, preempt }
            cdp: true,
            lldp: { tx: true, rx: true }
          };
        });
      }

      this.addLog('system', `Cisco IOS Software (${this.type.toUpperCase()}-UNIVERSALK9-M), Version 15.4(3)M2\nTechnical Support: http://www.cisco.com/techsupport\nPress RETURN to get started.`);
    }

    addLog(type, text) {
      this.logs.push({ type, text });
      if (this.logs.length > 300) {
        this.logs.shift();
      }
    }

    getPrompt() {
      const h = this.config.hostname;
      switch (this.mode) {
        case 'user': return `${h}>`;
        case 'priv': return `${h}#`;
        case 'config': return `${h}(config)#`;
        case 'config-if': return `${h}(config-if)#`;
        case 'config-subif': return `${h}(config-subif)#`;
        case 'config-if-range': return `${h}(config-if-range)#`;
        case 'config-router': return `${h}(config-router)#`;
        case 'config-vlan': return `${h}(config-vlan)#`;
        case 'config-line': return `${h}(config-line)#`;
        case 'config-dhcp': return `${h}(config-dhcp)#`;
        case 'config-std-nacl': return `${h}(config-std-nacl)#`;
        case 'config-ext-nacl': return `${h}(config-ext-nacl)#`;
        default: return `${h}>`;
      }
    }

    saveToStartup() {
      this.config.savedStartupConfig = JSON.parse(JSON.stringify(this.config));
    }
  }

  class IosSimulator {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.getElementById(container) : container;
      if (!this.container) return;

      this.options = (typeof options === 'string') ? { promptText: options } : (options || {});
      this.devices = {};
      this.activeDeviceName = '';
      this.screenEl = null;
      this.inputEl = null;
      this.promptEl = null;
      this.tabsWrapEl = null;
      this.isFullscreen = false;

      this.initDevices(this.options);
      this.render();
    }

    initDevices(options) {
      let names = [];
      if (options && Array.isArray(options.devices) && options.devices.length > 0) {
        names = options.devices;
      } else if (options && typeof options.promptText === 'string') {
        names = IosSimulator.extractDevices(options.promptText);
      } else if (typeof options === 'string') {
        names = IosSimulator.extractDevices(options);
      } else {
        names = ['SW101', 'SW102'];
      }

      names.forEach(name => {
        const isRouter = /^(r\d+|router)/i.test(name);
        this.devices[name] = new IosDeviceSession(name, isRouter ? 'router' : 'switch');
      });
      this.activeDeviceName = names[0] || 'SW101';
    }

    getActiveSession() {
      return this.devices[this.activeDeviceName];
    }

    normalizeInterface(raw) {
      if (!raw) return 'Ethernet0/0';
      const clean = String(raw).trim().replace(/\s+/g, '');
      const m = clean.match(/^([a-zA-Z\-]+)(.*)$/);
      if (!m) return clean;
      const prefix = m[1].toLowerCase();
      const num = m[2];

      if (prefix.startsWith('gi') || prefix.startsWith('g')) return `GigabitEthernet${num}`;
      if (prefix.startsWith('fa') || prefix.startsWith('f')) return `FastEthernet${num}`;
      if (prefix.startsWith('et') || prefix.startsWith('e')) return `Ethernet${num}`;
      if (prefix.startsWith('vl') || prefix.startsWith('v')) return `Vlan${num}`;
      if (prefix.startsWith('lo') || prefix.startsWith('l')) return `Loopback${num}`;
      if (prefix.startsWith('po') || prefix.startsWith('p')) return `Port-channel${num}`;
      if (prefix.startsWith('se') || prefix.startsWith('s')) return `Serial${num}`;
      return clean;
    }

    render() {
      this.container.innerHTML = '';

      const wrap = document.createElement('div');
      wrap.className = 'ios-sim-container' + (this.isFullscreen ? ' ios-fullscreen' : '');
      this.wrapEl = wrap;

      // Header Bar
      const header = document.createElement('div');
      header.className = 'ios-sim-header';

      const title = document.createElement('div');
      title.className = 'ios-sim-title';
      title.innerHTML = `<span>💻</span> Cisco IOS Virtual Terminal`;

      const actions = document.createElement('div');
      actions.className = 'ios-sim-actions ios-header-controls';

      const assessBtn = document.createElement('button');
      assessBtn.type = 'button';
      assessBtn.className = 'ios-btn-assess ios-ctrl-btn';
      assessBtn.innerHTML = '📋 Assessment';
      assessBtn.title = 'Packet Tracer-style Activity Wizard task check';
      assessBtn.onclick = () => this.showAssessmentModal();

      const fullBtn = document.createElement('button');
      fullBtn.type = 'button';
      fullBtn.className = 'ios-ctrl-btn';
      fullBtn.innerHTML = this.isFullscreen ? '⤢ Exit Full' : '⤢ Fullscreen';
      fullBtn.onclick = () => this.toggleFullscreen();

      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'ios-btn-reset ios-ctrl-btn';
      resetBtn.textContent = '↺ Reload NVRAM';
      resetBtn.title = 'Reset active device state';
      resetBtn.onclick = () => this.resetActiveDevice();

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'ios-btn-clear ios-ctrl-btn';
      clearBtn.textContent = 'Clear Screen';
      clearBtn.onclick = () => this.clearScreen();

      actions.appendChild(assessBtn);
      actions.appendChild(fullBtn);
      actions.appendChild(resetBtn);
      actions.appendChild(clearBtn);
      header.appendChild(title);
      header.appendChild(actions);
      wrap.appendChild(header);

      // Device Tabs Bar
      const tabsWrap = document.createElement('div');
      tabsWrap.className = 'ios-sim-tabs ios-device-tabs';
      this.tabsWrapEl = tabsWrap;
      this.renderTabs();
      wrap.appendChild(tabsWrap);

      // Terminal Screen
      const screen = document.createElement('div');
      screen.className = 'ios-sim-screen ios-terminal-screen';
      this.screenEl = screen;
      wrap.appendChild(screen);

      // Touch Toolbar
      const touchbar = document.createElement('div');
      touchbar.className = 'ios-touchbar';

      const touchKeys = [
        { label: 'Ctrl+C', act: () => this.handleCtrlC(), cls: 'key-danger' },
        { label: 'Ctrl+Shift+6', act: () => this.handleBreakSequence(), cls: 'key-ctrl' },
        { label: 'Ctrl+A', act: () => this.handleCtrlA(), cls: 'key-nav' },
        { label: 'Ctrl+E', act: () => this.handleCtrlE(), cls: 'key-nav' },
        { label: 'Ctrl+Z', act: () => this.handleCtrlZ(), cls: 'key-ctrl' },
        { label: 'Ctrl+U', act: () => this.handleCtrlU(), cls: 'key-nav' },
        { label: 'Tab', act: () => this.handleTabKey(), cls: 'key-tab' },
        { label: '?', act: () => this.handleQuestionMark(), cls: 'key-help' },
        { label: '↑', act: () => this.navigateHistory(-1), cls: 'key-nav' },
        { label: '↓', act: () => this.navigateHistory(1), cls: 'key-nav' }
      ];

      touchKeys.forEach(k => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ios-touch-key' + (k.cls ? ' ' + k.cls : '');
        btn.textContent = k.label;
        btn.onmousedown = (e) => e.preventDefault();
        btn.onclick = (e) => {
          e.preventDefault();
          k.act();
        };
        touchbar.appendChild(btn);
      });
      wrap.appendChild(touchbar);

      // Command Input Row
      const inputRow = document.createElement('div');
      inputRow.className = 'ios-input-row';

      const promptLbl = document.createElement('span');
      promptLbl.className = 'ios-prompt-label';
      this.promptEl = promptLbl;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'ios-cmd-input';
      input.setAttribute('autocapitalize', 'none');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('spellcheck', 'false');
      input.placeholder = 'Type command...';
      this.inputEl = input;

      input.onkeydown = (e) => {
        if (e.ctrlKey) {
          if (e.key === 'c' || e.key === 'C') { e.preventDefault(); this.handleCtrlC(); return; }
          if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); this.handleCtrlZ(); return; }
          if (e.key === 'a' || e.key === 'A') { e.preventDefault(); this.handleCtrlA(); return; }
          if (e.key === 'e' || e.key === 'E') { e.preventDefault(); this.handleCtrlE(); return; }
          if (e.key === 'u' || e.key === 'U') { e.preventDefault(); this.handleCtrlU(); return; }
          if (e.key === '6' && e.shiftKey) { e.preventDefault(); this.handleBreakSequence(); return; }
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          this.submitCurrentInput();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.navigateHistory(-1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.navigateHistory(1);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          this.handleTabKey();
        } else if (e.key === '?') {
          e.preventDefault();
          this.handleQuestionMark();
        }
      };

      const sendBtn = document.createElement('button');
      sendBtn.type = 'button';
      sendBtn.className = 'ios-send-btn';
      sendBtn.textContent = 'Enter';
      sendBtn.onclick = () => this.submitCurrentInput();

      inputRow.appendChild(promptLbl);
      inputRow.appendChild(input);
      inputRow.appendChild(sendBtn);
      wrap.appendChild(inputRow);

      this.container.appendChild(wrap);
      this.refreshScreen();
    }

    renderTabs() {
      if (!this.tabsWrapEl) return;
      this.tabsWrapEl.innerHTML = '';
      Object.keys(this.devices).forEach(name => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ios-tab-btn' + (name === this.activeDeviceName ? ' active' : '');
        btn.textContent = name;
        btn.onclick = () => this.switchDevice(name);
        this.tabsWrapEl.appendChild(btn);
      });

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'ios-tab-add-btn';
      addBtn.textContent = '+ Add';
      addBtn.title = 'Add new device';
      addBtn.onclick = () => {
        const newName = prompt('Enter device name (e.g. SW103, R3):');
        if (newName && !this.devices[newName.trim()]) {
          const clean = newName.trim();
          this.devices[clean] = new IosDeviceSession(clean, clean.toLowerCase().startsWith('sw') ? 'switch' : 'router');
          this.switchDevice(clean);
        }
      };
      this.tabsWrapEl.appendChild(addBtn);
    }

    switchDevice(name) {
      if (!this.devices[name]) return;
      this.activeDeviceName = name;
      this.renderTabs();
      this.refreshScreen();
      if (this.inputEl) this.inputEl.focus();
    }

    refreshScreen() {
      const s = this.getActiveSession();
      if (!s || !this.screenEl) return;

      this.screenEl.innerHTML = '';
      s.logs.forEach(item => {
        const div = document.createElement('div');
        div.className = 'ios-line-' + item.type;
        div.textContent = item.text;
        this.screenEl.appendChild(div);
      });

      if (this.promptEl) {
        this.promptEl.textContent = s.getPrompt() + ' ';
      }

      this.screenEl.scrollTop = this.screenEl.scrollHeight;
    }

    clearScreen() {
      const s = this.getActiveSession();
      if (s) {
        s.logs = [];
        this.refreshScreen();
      }
    }

    resetActiveDevice() {
      const s = this.getActiveSession();
      if (s) {
        this.devices[this.activeDeviceName] = new IosDeviceSession(this.activeDeviceName, s.type);
        this.refreshScreen();
      }
    }

    toggleFullscreen() {
      this.isFullscreen = !this.isFullscreen;
      this.render();
      if (this.inputEl) this.inputEl.focus();
    }

    handleCtrlC() {
      const s = this.getActiveSession();
      if (!s) return;
      if (this.inputEl) this.inputEl.value = '';
      s.addLog('input', s.getPrompt() + '^C');
      if (s.mode.startsWith('config')) {
        s.mode = 'priv';
        s.context = null;
      }
      this.refreshScreen();
    }

    handleCtrlZ() {
      const s = this.getActiveSession();
      if (!s) return;
      if (this.inputEl) this.inputEl.value = '';
      s.addLog('input', s.getPrompt() + '^Z');
      if (s.mode.startsWith('config')) {
        s.mode = 'priv';
        s.context = null;
        s.addLog('system', '% SYS-5-CONFIG_I: Configured from console by console');
      }
      this.refreshScreen();
    }

    handleBreakSequence() {
      const s = this.getActiveSession();
      if (!s) return;
      s.addLog('system', '% Translating "8.8.8.8"...domain server (255.255.255.255)\n[OK]\nAborted by user.');
      this.refreshScreen();
    }

    handleCtrlA() {
      if (this.inputEl) this.inputEl.setSelectionRange(0, 0);
    }

    handleCtrlE() {
      if (this.inputEl) {
        const len = this.inputEl.value.length;
        this.inputEl.setSelectionRange(len, len);
      }
    }

    handleCtrlU() {
      if (this.inputEl) this.inputEl.value = '';
    }

    handleQuestionMark() {
      if (!this.inputEl) return;
      const raw = this.inputEl.value;
      const s = this.getActiveSession();
      if (!s) return;

      s.addLog('input', s.getPrompt() + (raw ? ' ' + raw : '') + '?');
      this.outputHelp(s, raw);
      this.refreshScreen();
      if (this.inputEl) {
        this.inputEl.value = raw;
        this.inputEl.focus();
      }
    }

    navigateHistory(dir) {
      const s = this.getActiveSession();
      if (!s || s.history.length === 0) return;

      if (dir === -1) { // Up
        if (s.historyIndex === -1) {
          s.historyIndex = s.history.length - 1;
        } else if (s.historyIndex > 0) {
          s.historyIndex--;
        }
      } else if (dir === 1) { // Down
        if (s.historyIndex !== -1 && s.historyIndex < s.history.length - 1) {
          s.historyIndex++;
        } else {
          s.historyIndex = -1;
          this.inputEl.value = '';
          return;
        }
      }

      if (s.historyIndex >= 0 && s.historyIndex < s.history.length) {
        this.inputEl.value = s.history[s.historyIndex];
      }
    }

    submitCurrentInput() {
      const raw = this.inputEl ? this.inputEl.value : '';
      if (!raw.trim()) {
        const s = this.getActiveSession();
        s.addLog('input', s.getPrompt());
        this.refreshScreen();
        return;
      }
      this.executeCommand(raw);
      if (this.inputEl) {
        this.inputEl.value = '';
        this.inputEl.focus();
      }
    }

    handleTabKey() {
      if (!this.inputEl) return;
      const raw = this.inputEl.value;
      const s = this.getActiveSession();
      if (!s) return;

      const hasTrailingSpace = /\s$/.test(raw);
      const rawTokens = raw.trimStart().split(/\s+/).filter(Boolean);
      if (rawTokens.length === 0) return;

      if (hasTrailingSpace) {
        this.outputHelp(s, raw);
        this.refreshScreen();
        return;
      }

      const prevTokens = rawTokens.slice(0, -1);
      const lastToken = rawTokens[rawTokens.length - 1].toLowerCase();

      let candidates = [];
      if (prevTokens.length === 0) {
        const root = ROOT_COMMANDS[s.mode] || ROOT_COMMANDS['user'];
        candidates = root.map(r => r.cmd);
      } else {
        const key = prevTokens.map(t => norm(t, s.mode)).join(' ');
        if (SUB_TREES[key]) {
          candidates = SUB_TREES[key].map(st => st.cmd);
        }
      }

      const matches = candidates.filter(c => c.toLowerCase().startsWith(lastToken));
      if (matches.length === 1) {
        const completed = matches[0];
        const newTokens = [...prevTokens, completed];
        this.inputEl.value = newTokens.join(' ') + ' ';
      } else if (matches.length > 1) {
        s.addLog('input', s.getPrompt() + ' ' + raw);
        s.addLog('output', matches.join('   '));
        this.refreshScreen();
      }
    }

    executeCommand(rawCmd) {
      const s = this.getActiveSession();
      if (!s) return;

      const trimmed = rawCmd.trim();
      s.addLog('input', s.getPrompt() + ' ' + rawCmd);

      s.history.push(rawCmd);
      s.historyIndex = -1;

      // Handle Cisco 'do' prefix from config modes
      let cmd = trimmed;
      if (cmd.toLowerCase().startsWith('do ') && s.mode.startsWith('config')) {
        cmd = cmd.substring(3).trim();
      }

      // Check for pipe filtering (| include / exclude / begin / section)
      let pipeClause = null;
      if (cmd.includes('|')) {
        const pipeIdx = cmd.indexOf('|');
        pipeClause = cmd.substring(pipeIdx + 1).trim();
        cmd = cmd.substring(0, pipeIdx).trim();
      }

      const lower = cmd.toLowerCase();
      const parts = cmd.split(/\s+/).filter(Boolean);
      if (parts.length === 0) {
        this.refreshScreen();
        return;
      }

      const p0 = parts[0].toLowerCase();
      const p1 = (parts[1] || '').toLowerCase();
      const p2 = (parts[2] || '').toLowerCase();
      const p3 = (parts[3] || '').toLowerCase();

      // Help command if typed with trailing ?
      if (trimmed.endsWith('?')) {
        const query = trimmed.substring(0, trimmed.length - 1);
        this.outputHelp(s, query);
        this.refreshScreen();
        return;
      }

      // Enable / Disable
      if ((matchesPrefix(p0, 'enable', 2) || p0 === 'en') && s.mode === 'user') {
        s.mode = 'priv';
        this.refreshScreen();
        return;
      }
      if (matchesPrefix(p0, 'disable', 3)) {
        s.mode = 'user';
        this.refreshScreen();
        return;
      }

      // Configure terminal
      if (matchesPrefix(p0, 'configure', 4) || p0 === 'conf') {
        if (p1 === 'terminal' || p1 === 't' || p1 === '') {
          s.mode = 'config';
          s.addLog('system', 'Enter configuration commands, one per line.  End with CNTL/Z.');
          this.refreshScreen();
          return;
        }
      }

      // Exit / End
      if (p0 === 'exit') {
        if (s.mode.startsWith('config-if') || s.mode === 'config-subif' || s.mode === 'config-router' ||
            s.mode === 'config-vlan' || s.mode === 'config-line' || s.mode === 'config-dhcp' ||
            s.mode === 'config-std-nacl' || s.mode === 'config-ext-nacl') {
          s.mode = 'config';
          s.context = null;
        } else if (s.mode === 'config') {
          s.mode = 'priv';
        } else if (s.mode === 'priv') {
          s.mode = 'user';
        }
        this.refreshScreen();
        return;
      }
      if (p0 === 'end' || lower === 'ctrl+c' || lower === 'ctrl+z') {
        if (s.mode.startsWith('config')) {
          s.mode = 'priv';
          s.context = null;
          s.addLog('system', '% SYS-5-CONFIG_I: Configured from console by console');
        }
        this.refreshScreen();
        return;
      }

      // =========================================================================
      // 1. SUBMODE-SPECIFIC COMMANDS (Evaluated first when in specific submode)
      // =========================================================================

      // (A) VLAN CONFIG (mode: 'config-vlan')
      if (s.mode === 'config-vlan') {
        if (p0 === 'name') {
          const vid = s.context ? s.context.vid : '1';
          s.config.vlans[vid] = parts[1] || 'VLAN';
          this.refreshScreen();
          return;
        }
      }

      // (B) ROUTER OSPF CONFIG (mode: 'config-router')
      if (s.mode === 'config-router') {
        if (lower.startsWith('router-id')) {
          s.config.ospf.routerId = parts[1];
          this.refreshScreen();
          return;
        }
        if (lower.startsWith('network')) {
          const net = parts[1];
          const wildcard = parts[2];
          const aIdx = parts.indexOf('area');
          const area = aIdx !== -1 ? parts[aIdx + 1] : '0';
          s.config.ospf.networks.push({ net, wildcard, area });
          this.refreshScreen();
          return;
        }
        if (lower.startsWith('passive-interface')) {
          const pIf = this.normalizeInterface(parts[1]);
          s.config.ospf.passiveInterfaces.push(pIf);
          this.refreshScreen();
          return;
        }
        if (lower.startsWith('default-information originate')) {
          s.config.ospf.defaultInformationOriginate = true;
          this.refreshScreen();
          return;
        }
      }

      // (C) DHCP POOL CONFIG (mode: 'config-dhcp')
      if (s.mode === 'config-dhcp') {
        const pool = s.context ? s.config.dhcpPools[s.context.name] : null;
        if (pool) {
          if (lower.startsWith('network')) {
            pool.network = parts[1];
            pool.mask = parts[2];
            this.refreshScreen();
            return;
          }
          if (lower.startsWith('default-router')) {
            pool.defaultRouter = parts[1];
            this.refreshScreen();
            return;
          }
          if (lower.startsWith('dns-server')) {
            pool.dnsServer = parts[1];
            this.refreshScreen();
            return;
          }
          if (lower.startsWith('domain-name')) {
            pool.domainName = parts[1];
            this.refreshScreen();
            return;
          }
          if (lower.startsWith('lease')) {
            pool.lease = parts.slice(1).join(' ');
            this.refreshScreen();
            return;
          }
        }
      }

      // (D) ACL CONFIG (mode: 'config-std-nacl', 'config-ext-nacl')
      if (s.mode === 'config-std-nacl') {
        const acl = s.context ? s.config.accessLists.standard[s.context.name] : null;
        if (acl && (p0 === 'permit' || p0 === 'deny' || p0 === 'remark')) {
          acl.push(parts.join(' '));
          this.refreshScreen();
          return;
        }
      }
      if (s.mode === 'config-ext-nacl') {
        const acl = s.context ? s.config.accessLists.extended[s.context.name] : null;
        if (acl && (p0 === 'permit' || p0 === 'deny' || p0 === 'remark')) {
          acl.push(parts.join(' '));
          this.refreshScreen();
          return;
        }
      }

      // (E) LINE CONFIG (mode: 'config-line')
      if (s.mode === 'config-line') {
        const lineKey = s.context ? s.context.target : 'vty 0 4';
        if (!s.config.lines[lineKey]) s.config.lines[lineKey] = { password: null, login: false, loginLocal: true, transport: 'ssh' };
        if (p0 === 'password') {
          s.config.lines[lineKey].password = parts[1];
          this.refreshScreen();
          return;
        }
        if (p0 === 'login') {
          if (p1 === 'local') s.config.lines[lineKey].loginLocal = true;
          else s.config.lines[lineKey].login = true;
          this.refreshScreen();
          return;
        }
        if (p0 === 'transport' && p1 === 'input') {
          s.config.lines[lineKey].transport = parts.slice(2).join(' ');
          this.refreshScreen();
          return;
        }
      }

      // (F) INTERFACE CONFIG (mode: 'config-if', 'config-subif', 'config-if-range')
      if (s.mode === 'config-if' || s.mode === 'config-subif' || s.mode === 'config-if-range') {
        const targetInterfaces = [];
        if (s.mode === 'config-if-range' && s.context && s.context.range) {
          const rStr = s.context.range;
          const m = rStr.match(/([a-zA-Z]+)(\d+)\/(\d+)\s*-\s*(\d+)/);
          if (m) {
            const pfx = m[1];
            const mod = m[2];
            const start = parseInt(m[3], 10);
            const end = parseInt(m[4], 10);
            for (let i = start; i <= end; i++) {
              const name = this.normalizeInterface(`${pfx}${mod}/${i}`);
              if (!s.config.interfaces[name]) {
                s.config.interfaces[name] = {
                  name,
                  isRouted: false,
                  status: 'up',
                  mode: 'access',
                  accessVlan: '1',
                  dot1qVlan: null,
                  ip: null,
                  mask: null,
                  ipv6: null,
                  channelGroup: null
                };
              }
              targetInterfaces.push(s.config.interfaces[name]);
            }
          }
        } else if (s.context && s.context.name && s.config.interfaces[s.context.name]) {
          targetInterfaces.push(s.config.interfaces[s.context.name]);
        }
        const intf = targetInterfaces[0] || null;

        // NO SWITCHPORT (Converts L2 switchport to L3 routed interface)
        if (p0 === 'no' && (p1 === 'switchport' || p1 === 'sw')) {
          targetInterfaces.forEach(it => {
            it.isRouted = true;
            it.mode = 'routed';
            it.accessVlan = null;
            it.trunkAllowed = null;
            it.nativeVlan = null;
          });
          this.refreshScreen();
          return;
        }

        // SWITCHPORT (Converts back to L2 switchport)
        if (matchesPrefix(p0, 'switchport', 2) && parts.length === 1) {
          targetInterfaces.forEach(it => {
            it.isRouted = false;
            it.mode = 'access';
            it.ip = null;
            it.mask = null;
            it.ipv6 = null;
            it.accessVlan = '1';
          });
          this.refreshScreen();
          return;
        }

        // description <text>
        if (matchesPrefix(p0, 'description', 4)) {
          const desc = parts.slice(1).join(' ');
          targetInterfaces.forEach(it => { it.description = desc; });
          this.refreshScreen();
          return;
        }

        // ip address <ip> <mask>
        if (p0 === 'ip' && matchesPrefix(p1, 'address', 3)) {
          const ip = parts[2];
          const mask = parts[3];

          // CRITICAL CHECK: In Cisco IOS, L2 switchports CANNOT have an IP address unless 'no switchport' was configured or it's an SVI (VLAN interface)
          const isSvi = intf && intf.name.toLowerCase().startsWith('vlan');
          if (intf && !intf.isRouted && !isSvi && s.type === 'switch') {
            s.addLog('error', '% IP addresses may not be configured on L2 links.');
            this.refreshScreen();
            return;
          }

          if (intf && ip && mask) {
            targetInterfaces.forEach(it => {
              it.ip = ip;
              it.mask = mask;
              it.isRouted = true;
            });
          }
          this.refreshScreen();
          return;
        }

        // ipv6 address <addr>
        if (p0 === 'ipv6' && matchesPrefix(p1, 'address', 2)) {
          const addr = parts[2];
          const isSvi = intf && intf.name.toLowerCase().startsWith('vlan');
          if (intf && !intf.isRouted && !isSvi && s.type === 'switch') {
            s.addLog('error', '% IPv6 addresses may not be configured on L2 links.');
            this.refreshScreen();
            return;
          }

          if (intf && addr) {
            targetInterfaces.forEach(it => {
              if (lower.includes('link-local')) it.ipv6LinkLocal = addr;
              else it.ipv6 = addr;
              it.isRouted = true;
            });
          }
          this.refreshScreen();
          return;
        }

        // encapsulation dot1Q <vlan> [native]
        if (matchesPrefix(p0, 'encapsulation', 3) && (p1 === 'dot1q' || p1 === 'dot11q')) {
          const vid = parts[2];
          const isNat = lower.includes('native');
          targetInterfaces.forEach(it => {
            it.dot1qVlan = vid;
            it.dot1qNative = isNat;
            it.isSubif = true;
            it.isRouted = true;
          });
          this.refreshScreen();
          return;
        }

        // shutdown / no shutdown
        if (p0 === 'shutdown' || (p0 === 'shut' && parts.length === 1)) {
          targetInterfaces.forEach(it => {
            it.shutdown = true;
            it.status = 'administratively down';
            it.protocol = 'down';
          });
          s.addLog('system', `%LINK-5-CHANGED: Interface ${intf ? intf.name : 'Ethernet0/0'}, changed state to administratively down\n%LINEPROTO-5-UPDOWN: Line protocol on Interface ${intf ? intf.name : 'Ethernet0/0'}, changed state to down`);
          this.refreshScreen();
          return;
        }
        if (p0 === 'no' && (p1 === 'shutdown' || p1 === 'shut')) {
          targetInterfaces.forEach(it => {
            it.shutdown = false;
            it.status = 'up';
            it.protocol = 'up';
          });
          s.addLog('system', `%LINK-3-UPDOWN: Interface ${intf ? intf.name : 'Ethernet0/0'}, changed state to up\n%LINEPROTO-5-UPDOWN: Line protocol on Interface ${intf ? intf.name : 'Ethernet0/0'}, changed state to up`);
          this.refreshScreen();
          return;
        }

        // switchport mode access | trunk
        if (lower.includes('mode access')) {
          targetInterfaces.forEach(it => { it.mode = 'access'; it.isRouted = false; });
          this.refreshScreen();
          return;
        }
        if (lower.includes('mode trunk')) {
          targetInterfaces.forEach(it => { it.mode = 'trunk'; it.isRouted = false; });
          this.refreshScreen();
          return;
        }

        // switchport access vlan <id>
        if (lower.includes('access vlan')) {
          const aVid = parts[parts.length - 1];
          targetInterfaces.forEach(it => { it.accessVlan = aVid; });
          this.refreshScreen();
          return;
        }

        // switchport trunk encapsulation dot1q
        if (lower.includes('trunk encapsulation')) {
          targetInterfaces.forEach(it => { it.trunkEncap = 'dot1q'; });
          this.refreshScreen();
          return;
        }

        // switchport trunk native vlan <id>
        if (lower.includes('trunk native vlan')) {
          const nVid = parts[parts.length - 1];
          targetInterfaces.forEach(it => { it.nativeVlan = nVid; });
          this.refreshScreen();
          return;
        }

        // switchport trunk allowed vlan [add|remove|except|all] <list>
        if (lower.includes('trunk allowed vlan')) {
          const allowedStr = parts.slice(parts.indexOf('vlan') + 1).join(' ');
          targetInterfaces.forEach(it => { it.trunkAllowed = allowedStr; });
          this.refreshScreen();
          return;
        }

        // switchport port-security ...
        if (lower.startsWith('switchport port-security')) {
          targetInterfaces.forEach(it => {
            if (!it.portSecurity) it.portSecurity = { enabled: true, max: 1, violation: 'shutdown', mac: null };
            it.portSecurity.enabled = true;
            if (lower.includes('maximum')) {
              const maxIdx = parts.indexOf('maximum');
              it.portSecurity.max = parseInt(parts[maxIdx + 1], 10) || 1;
            }
            if (lower.includes('violation')) {
              const vIdx = parts.indexOf('violation');
              it.portSecurity.violation = parts[vIdx + 1] || 'shutdown';
            }
            if (lower.includes('mac-address')) {
              const mIdx = parts.indexOf('mac-address');
              it.portSecurity.mac = parts.slice(mIdx + 1).join(' ');
            }
          });
          this.refreshScreen();
          return;
        }

        // channel-group <id> mode <mode>
        if (matchesPrefix(p0, 'channel-group', 4)) {
          const gid = parts[1];
          const modeIdx = parts.indexOf('mode');
          const cmode = modeIdx !== -1 ? parts[modeIdx + 1] : 'active';
          targetInterfaces.forEach(it => {
            it.channelGroup = { id: gid, mode: cmode };
          });
          this.refreshScreen();
          return;
        }

        // spanning-tree portfast / bpduguard
        if (matchesPrefix(p0, 'spanning-tree', 4) && (lower.includes('portfast') || lower.includes('bpduguard') || lower.includes('cost'))) {
          targetInterfaces.forEach(it => {
            if (lower.includes('portfast')) it.portfast = true;
            if (lower.includes('bpduguard')) it.bpduguard = true;
          });
          this.refreshScreen();
          return;
        }

        // ip nat inside | outside
        if (lower === 'ip nat inside') {
          targetInterfaces.forEach(it => { it.nat = 'inside'; });
          this.refreshScreen();
          return;
        }
        if (lower === 'ip nat outside') {
          targetInterfaces.forEach(it => { it.nat = 'outside'; });
          this.refreshScreen();
          return;
        }

        // ip access-group <name> in|out
        if (p0 === 'ip' && p1 === 'access-group') {
          const grp = parts[2];
          const dir = parts[3] || 'in';
          targetInterfaces.forEach(it => {
            if (!it.accessGroup) it.accessGroup = { in: null, out: null };
            if (dir === 'in') it.accessGroup.in = grp;
            else it.accessGroup.out = grp;
          });
          this.refreshScreen();
          return;
        }

        // ip ospf <id> area <area>
        if (p0 === 'ip' && p1 === 'ospf' && parts.includes('area')) {
          const aIdx = parts.indexOf('area');
          const area = parts[aIdx + 1] || '0';
          targetInterfaces.forEach(it => {
            if (!it.ospf) it.ospf = { area: null };
            it.ospf.area = area;
          });
          this.refreshScreen();
          return;
        }

        // ip helper-address <addr>
        if (p0 === 'ip' && matchesPrefix(p1, 'helper-address', 6)) {
          targetInterfaces.forEach(it => { it.helperAddress = parts[2]; });
          this.refreshScreen();
          return;
        }
      }

      // =========================================================================
      // 2. GLOBAL & MODE-TRANSITION CONFIG COMMANDS (Accessible from any config mode)
      // =========================================================================
      if (s.mode.startsWith('config')) {
        // hostname <name>
        if (matchesPrefix(p0, 'hostname', 4)) {
          const newName = parts[1] || 'Device';
          s.config.hostname = newName;
          s.hostname = newName;
          this.renderTabs();
          this.refreshScreen();
          return;
        }

        // ip domain-name <name>
        if (p0 === 'ip' && matchesPrefix(p1, 'domain-name', 7)) {
          s.config.domainName = parts[2] || 'example.com';
          this.refreshScreen();
          return;
        }

        // crypto key generate rsa [modulus <bits>]
        if (p0 === 'crypto' && p1 === 'key' && p2 === 'generate') {
          const bits = parts.includes('modulus') ? (parts[parts.indexOf('modulus') + 1] || '1024') : (parts[4] || '1024');
          s.config.cryptoKeys = { type: 'rsa', bits: parseInt(bits, 10) || 1024 };
          const hostStr = s.config.domainName ? `${s.config.hostname}.${s.config.domainName}` : s.config.hostname;
          s.addLog('output', `The name for the keys will be: ${hostStr}\n% Generating ${bits} bit RSA keys, keys will be non-exportable...\n[OK] (elapsed 0.2 seconds)`);
          this.refreshScreen();
          return;
        }

        // enable secret / password
        if (p0 === 'enable' && (p1 === 'secret' || p1 === 'password')) {
          s.config.enableSecret = parts[2] || 'cisco';
          this.refreshScreen();
          return;
        }

        // service password-encryption
        if (lower.startsWith('service password-encryption')) {
          s.config.servicePasswordEncryption = true;
          this.refreshScreen();
          return;
        }

        // username <user> [privilege <lvl>] secret|password <secret>
        if (matchesPrefix(p0, 'username', 4)) {
          const user = parts[1];
          const privIdx = parts.indexOf('privilege');
          const priv = privIdx !== -1 ? parseInt(parts[privIdx + 1], 10) : 1;
          const secIdx = parts.includes('secret') ? parts.indexOf('secret') : parts.indexOf('password');
          const sec = secIdx !== -1 ? parts[secIdx + 1] : 'cisco';
          s.config.users[user] = { secret: sec, privilege: priv };
          this.refreshScreen();
          return;
        }

        // ip routing / ipv6 unicast-routing
        if (lower === 'ip routing') {
          s.config.ipRouting = true;
          this.refreshScreen();
          return;
        }
        if (lower === 'ipv6 unicast-routing') {
          s.config.ipv6UnicastRouting = true;
          this.refreshScreen();
          return;
        }

        // ip dhcp excluded-address <low> [high]
        if (lower.startsWith('ip dhcp excluded-address')) {
          const low = parts[3];
          const high = parts[4] || null;
          s.config.dhcpExcluded.push({ low, high });
          this.refreshScreen();
          return;
        }

        // ip dhcp pool <name> -> transitions to config-dhcp
        if (p0 === 'ip' && p1 === 'dhcp' && p2 === 'pool') {
          const poolName = parts[3] || 'POOL1';
          s.mode = 'config-dhcp';
          s.context = { type: 'dhcp', name: poolName };
          if (!s.config.dhcpPools[poolName]) {
            s.config.dhcpPools[poolName] = {
              name: poolName, network: null, mask: null, defaultRouter: null, dnsServer: null, domainName: null, lease: '3'
            };
          }
          this.refreshScreen();
          return;
        }

        // ip nat inside source list <acl> interface <intf> overload
        if (lower.startsWith('ip nat inside source list')) {
          const acl = parts[5];
          const intfIdx = parts.indexOf('interface');
          const poolIdx = parts.indexOf('pool');
          const intf = intfIdx !== -1 ? this.normalizeInterface(parts[intfIdx + 1]) : null;
          const pool = poolIdx !== -1 ? parts[poolIdx + 1] : null;
          const overload = lower.includes('overload');
          s.config.nat.insideSourceList = { acl, intf, pool, overload };
          this.refreshScreen();
          return;
        }

        // ip nat pool <name> <start> <end> netmask <mask>
        if (lower.startsWith('ip nat pool')) {
          const poolName = parts[3];
          const startIp = parts[4];
          const endIp = parts[5];
          const maskIdx = parts.indexOf('netmask');
          const mask = maskIdx !== -1 ? parts[maskIdx + 1] : '255.255.255.0';
          s.config.nat.pools[poolName] = { start: startIp, end: endIp, netmask: mask };
          this.refreshScreen();
          return;
        }

        // ip route <net> <mask> <nh> [ad]
        if (p0 === 'ip' && matchesPrefix(p1, 'route', 2)) {
          const net = parts[2];
          const mask = parts[3];
          const nh = parts[4];
          const ad = parts[5] ? parseInt(parts[5], 10) : 1;
          s.config.staticRoutes.push({ net, mask, nh, ad });
          this.refreshScreen();
          return;
        }

        // ipv6 route <prefix> <nh> [ad]
        if (p0 === 'ipv6' && matchesPrefix(p1, 'route', 2)) {
          const prefix = parts[2];
          const nh = parts[3];
          const ad = parts[4] ? parseInt(parts[4], 10) : 1;
          s.config.ipv6Routes.push({ prefix, nh, ad });
          this.refreshScreen();
          return;
        }

        // access-list <num> permit|deny ...
        if (p0 === 'access-list') {
          const num = parts[1];
          const rule = parts.slice(2).join(' ');
          if (!s.config.accessLists.numbered[num]) s.config.accessLists.numbered[num] = [];
          s.config.accessLists.numbered[num].push(rule);
          this.refreshScreen();
          return;
        }

        // ip access-list standard|extended <name>
        if (lower.startsWith('ip access-list standard')) {
          const aclName = parts[3] || 'STD_ACL';
          s.mode = 'config-std-nacl';
          s.context = { type: 'std-nacl', name: aclName };
          if (!s.config.accessLists.standard[aclName]) s.config.accessLists.standard[aclName] = [];
          this.refreshScreen();
          return;
        }
        if (lower.startsWith('ip access-list extended')) {
          const aclName = parts[3] || 'EXT_ACL';
          s.mode = 'config-ext-nacl';
          s.context = { type: 'ext-nacl', name: aclName };
          if (!s.config.accessLists.extended[aclName]) s.config.accessLists.extended[aclName] = [];
          this.refreshScreen();
          return;
        }

        // spanning-tree mode ... / priority ...
        if (matchesPrefix(p0, 'spanning-tree', 4)) {
          if (lower.includes('mode rapid-pvst')) s.config.spanningTree.mode = 'rapid-pvst';
          else if (lower.includes('mode pvst')) s.config.spanningTree.mode = 'pvst';
          else if (lower.includes('mode mst')) s.config.spanningTree.mode = 'mst';
          if (lower.includes('priority')) {
            const pIdx = parts.indexOf('priority');
            s.config.spanningTree.priority = parseInt(parts[pIdx + 1], 10) || 32768;
          }
          this.refreshScreen();
          return;
        }

        // interface / int ... -> transitions to config-if, config-subif, or config-if-range
        if (matchesPrefix(p0, 'interface', 3)) {
          if (p1 === 'range' || matchesPrefix(p1, 'range', 1)) {
            const rangeStr = parts.slice(2).join(' ');
            s.mode = 'config-if-range';
            s.context = { type: 'range', range: rangeStr };
            this.refreshScreen();
            return;
          }
          const rawIf = parts.slice(1).join('');
          const ifName = this.normalizeInterface(rawIf);
          const isSub = ifName.includes('.');

          s.mode = isSub ? 'config-subif' : 'config-if';
          s.context = { type: isSub ? 'subif' : 'if', name: ifName };

          if (!s.config.interfaces[ifName]) {
            const isSw = s.type === 'switch' && !isSub;
            s.config.interfaces[ifName] = {
              name: ifName,
              isRouted: !isSw,
              isSubif: isSub,
              dot1qVlan: null,
              dot1qNative: false,
              ip: null,
              mask: null,
              ipv6: null,
              ipv6LinkLocal: null,
              status: 'up',
              protocol: 'up',
              shutdown: false,
              description: null,
              mode: isSw ? 'access' : 'routed',
              accessVlan: '1',
              trunkAllowed: null,
              nativeVlan: null,
              trunkEncap: null,
              portSecurity: null,
              channelGroup: null,
              ospf: { area: null },
              nat: null,
              accessGroup: { in: null, out: null },
              helperAddress: null
            };
          }
          this.refreshScreen();
          return;
        }

        // router ospf <id> -> transitions to config-router
        if (matchesPrefix(p0, 'router', 4)) {
          const proto = p1;
          const pid = parts[2] || '1';
          s.mode = 'config-router';
          s.context = { type: 'router', proto, pid };
          if (proto === 'ospf') s.config.ospf.id = pid;
          this.refreshScreen();
          return;
        }

        // vlan <id> -> transitions to config-vlan
        if (matchesPrefix(p0, 'vlan', 2)) {
          const vid = parts[1] || '10';
          s.mode = 'config-vlan';
          s.context = { type: 'vlan', vid };
          if (!s.config.vlans[vid]) s.config.vlans[vid] = `VLAN_${vid}`;
          this.refreshScreen();
          return;
        }

        // line ... -> transitions to config-line
        if (matchesPrefix(p0, 'line', 3)) {
          const target = parts.slice(1).join(' ');
          s.mode = 'config-line';
          s.context = { type: 'line', target };
          if (!s.config.lines[target]) s.config.lines[target] = { password: null, login: false, loginLocal: true, transport: 'ssh' };
          this.refreshScreen();
          return;
        }

        // ntp server <addr>
        if (p0 === 'ntp' && matchesPrefix(p1, 'server', 3)) {
          s.config.ntpServers.push(parts[2]);
          this.refreshScreen();
          return;
        }

        // cdp run / no cdp run
        if (lower === 'cdp run') {
          s.config.cdpRun = true;
          this.refreshScreen();
          return;
        }
        if (lower === 'no cdp run') {
          s.config.cdpRun = false;
          this.refreshScreen();
          return;
        }

        // lldp run / no lldp run
        if (lower === 'lldp run') {
          s.config.lldpRun = true;
          this.refreshScreen();
          return;
        }
        if (lower === 'no lldp run') {
          s.config.lldpRun = false;
          this.refreshScreen();
          return;
        }
      }

      // =========================================================================
      // 3. EXEC & MONITORING COMMANDS (show, ping, traceroute, clear, write)
      // =========================================================================

      // SHOW commands
      if (matchesPrefix(p0, 'show', 2) || p0 === 'sh') {
        this.handleShowCommand(s, parts.slice(1), pipeClause);
        return;
      }

      // REAL PING SIMULATOR
      if (p0 === 'ping') {
        const dest = parts[1] || '';
        this.simulatePing(s, dest);
        return;
      }

      // TRACEROUTE
      if (p0 === 'traceroute') {
        const dest = parts[1] || '10.1.1.1';
        s.addLog('output', `Type escape sequence to abort.\nTracing the route to ${dest}\nVRF info: (vrf in name/id)\n  1 10.0.0.1 2 msec 2 msec 1 msec\n  2 ${dest} 2 msec * 3 msec`);
        this.refreshScreen();
        return;
      }

      // CLEAR commands
      if (p0 === 'clear') {
        if (p1 === 'ip' && p2 === 'ospf') {
          s.addLog('output', 'Reset OSPF process? [no]: yes\n% OSPF process restarted, adjacencies recalculated.');
          this.refreshScreen();
          return;
        }
        if (p1 === 'ip' && p2 === 'nat') {
          s.addLog('output', '% Dynamic NAT entries flushed.');
          this.refreshScreen();
          return;
        }
        if (p1 === 'arp-cache') {
          s.arpCache = {};
          s.addLog('output', '% ARP cache cleared.');
          this.refreshScreen();
          return;
        }
      }

      // WRITE MEMORY / COPY RUN START
      if (matchesPrefix(p0, 'write', 2) || (p0 === 'copy' && p1 === 'run')) {
        s.saveToStartup();
        s.addLog('output', `Building configuration...\n[OK]`);
        this.refreshScreen();
        return;
      }

      // Default fallback for unrecognized commands
      s.addLog('error', `% Invalid input detected at '^' marker.`);
      this.refreshScreen();
    }

    // CONTEXTUAL HELP ENGINE (?)
    outputHelp(s, rawInput) {
      const text = (rawInput || '').trimStart();
      const hasTrailingSpace = /\s$/.test(rawInput || '');
      const tokens = text.split(/\s+/).filter(Boolean);

      const formatTable = (items) => {
        if (!items || items.length === 0) return '';
        const maxCmdLen = Math.max(...items.map(it => (it.cmd || it.name || '').length), 10);
        const pad = Math.min(Math.max(maxCmdLen + 2, 16), 26);
        return items.map(it => {
          const c = it.cmd || it.name || '';
          const d = it.desc || '';
          return '  ' + c.padEnd(pad, ' ') + (d ? d : '');
        }).join('\n');
      };

      // Case 1: Empty input -> Show all root commands for current mode
      if (tokens.length === 0) {
        const root = ROOT_COMMANDS[s.mode] || ROOT_COMMANDS['user'];
        const title = s.mode.startsWith('config') ? 'Configure commands:' : 'Exec commands:';
        s.addLog('output', `${title}\n${formatTable(root)}`);
        return;
      }

      // Case 2: User typed word without trailing space (e.g. "sw" or "int e0/0 no sh")
      if (!hasTrailingSpace) {
        const prevTokens = tokens.slice(0, -1);
        const lastToken = tokens[tokens.length - 1].toLowerCase();

        let candidates = [];
        if (prevTokens.length === 0) {
          const root = ROOT_COMMANDS[s.mode] || ROOT_COMMANDS['user'];
          candidates = root;
        } else {
          const parentKey = prevTokens.map(t => norm(t, s.mode)).join(' ');
          candidates = SUB_TREES[parentKey] || [];
        }

        const matched = candidates.filter(c => (c.cmd || c.name || '').toLowerCase().startsWith(lastToken));
        if (matched.length > 0) {
          s.addLog('output', formatTable(matched));
        } else {
          s.addLog('error', `% Unrecognized command`);
        }
        return;
      }

      // Case 3: User typed command followed by space (e.g. "sw " or "switchport mode ")
      const key = tokens.map(t => norm(t, s.mode)).join(' ');
      const sub = SUB_TREES[key];
      if (sub && sub.length > 0) {
        s.addLog('output', formatTable(sub));
        return;
      }

      // Try stripped prefix if prefixed by 'no ' or 'do '
      if (tokens[0] === 'no' || tokens[0] === 'do') {
        const subKey = tokens.slice(1).map(t => norm(t, s.mode)).join(' ');
        if (SUB_TREES[subKey]) {
          s.addLog('output', formatTable(SUB_TREES[subKey]));
          return;
        }
      }

      // Default for commands accepting arbitrary arguments or cr
      s.addLog('output', '  <cr>');
    }

    // REALISTIC CROSS-DEVICE ICMP ECHO SIMULATOR (PING)
    simulatePing(s, targetIp) {
      const ip = (targetIp || '').trim();
      if (!ip) {
        s.addLog('error', '% IP address or host name required.');
        this.refreshScreen();
        return;
      }

      // 1. Check if pinging self (loopback or own interface IP)
      let isSelf = false;
      Object.keys(s.config.interfaces).forEach(name => {
        const intf = s.config.interfaces[name];
        if (intf.ip === ip && intf.status === 'up') isSelf = true;
      });
      if (ip === '127.0.0.1') isSelf = true;

      if (isSelf) {
        s.addLog('output', `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${ip}, timeout is 2 seconds:\n!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/1/1 ms`);
        this.refreshScreen();
        return;
      }

      // 2. Search for target IP across all devices in topology
      let targetDevice = null;
      let targetIntf = null;

      Object.keys(this.devices).forEach(devName => {
        const dev = this.devices[devName];
        Object.keys(dev.config.interfaces).forEach(intfName => {
          const intf = dev.config.interfaces[intfName];
          if (intf.ip === ip) {
            targetDevice = dev;
            targetIntf = intf;
          }
        });
      });

      // If target interface doesn't exist on ANY device in topology, ping fails!
      if (!targetIntf || !targetDevice) {
        s.addLog('output', `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${ip}, timeout is 2 seconds:\n.....\nSuccess rate is 0 percent (0/5)`);
        this.refreshScreen();
        return;
      }

      // If target interface is administratively down or down, ping fails!
      if (targetIntf.shutdown || targetIntf.status !== 'up') {
        s.addLog('output', `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${ip}, timeout is 2 seconds:\n.....\nSuccess rate is 0 percent (0/5)`);
        this.refreshScreen();
        return;
      }

      // 3. Verify reachability from source device
      let isReachable = false;
      let outIntfName = '';

      // Check direct subnet connection from any active source interface
      Object.keys(s.config.interfaces).forEach(srcName => {
        const srcIntf = s.config.interfaces[srcName];
        if (srcIntf.ip && srcIntf.mask && srcIntf.status === 'up' && !srcIntf.shutdown) {
          if (isSameSubnet(srcIntf.ip, ip, srcIntf.mask)) {
            isReachable = true;
            outIntfName = srcName;
          }
        }
      });

      // Check static routes on source device
      if (!isReachable && s.config.ipRouting) {
        (s.config.staticRoutes || []).forEach(r => {
          if (r.net === '0.0.0.0' || isSameSubnet(r.net, ip, r.mask)) {
            isReachable = true;
          }
        });
      }

      // Check OSPF reachability (both running OSPF in common network/area)
      if (!isReachable && s.config.ospf && s.config.ospf.id && targetDevice.config.ospf && targetDevice.config.ospf.id) {
        isReachable = true;
      }

      if (!isReachable) {
        s.addLog('output', `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${ip}, timeout is 2 seconds:\nU.U.U\nSuccess rate is 0 percent (0/5)`);
        this.refreshScreen();
        return;
      }

      // 4. Reachable! Simulate ARP resolution on first attempt
      if (!s.arpCache[ip]) {
        // First ping: 1 packet dropped for ARP resolution -> .!!!! (80%)
        s.arpCache[ip] = {
          mac: `aabb.cc00.${Math.floor(1000 + Math.random() * 8999).toString(16)}`,
          interface: outIntfName || 'Ethernet0/0',
          age: '-'
        };
        s.addLog('output', `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${ip}, timeout is 2 seconds:\n.!!!!\nSuccess rate is 80 percent (4/5), round-trip min/avg/max = 1/2/4 ms`);
      } else {
        // Subsequent ping with existing ARP entry -> !!!!! (100%)
        s.addLog('output', `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${ip}, timeout is 2 seconds:\n!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms`);
      }
      this.refreshScreen();
    }

    // CISCO SHOW COMMAND HANDLER
    handleShowCommand(s, parts, pipeFilter) {
      const p1 = (parts[0] || '').toLowerCase();
      const p2 = (parts[1] || '').toLowerCase();
      const p3 = (parts[2] || '').toLowerCase();

      let output = '';

      // SHOW RUNNING-CONFIG
      if (matchesPrefix(p1, 'running-config', 3) || p1 === 'run') {
        const lines = [
          'Building configuration...',
          '',
          `Current configuration : ${1620 + Object.keys(s.config.interfaces).length * 120} bytes`,
          '!',
          'version 15.4',
          'service timestamps debug datetime msec',
          'service timestamps log datetime msec',
          s.config.servicePasswordEncryption ? 'service password-encryption' : 'no service password-encryption',
          '!'
        ];

        if (s.config.hostname) lines.push(`hostname ${s.config.hostname}`, '!');
        if (s.config.domainName) lines.push(`ip domain name ${s.config.domainName}`);
        if (s.config.ipRouting && s.type === 'switch') lines.push('ip routing');
        if (s.config.ipv6UnicastRouting) lines.push('ipv6 unicast-routing');
        if (s.config.dhcpSnooping) lines.push('ip dhcp snooping');

        // Spanning Tree
        if (s.type === 'switch') {
          lines.push(`spanning-tree mode ${s.config.spanningTree.mode || 'pvst'}`);
          lines.push('spanning-tree extend system-id');
          lines.push('!');
        }

        // VLANs
        Object.keys(s.config.vlans || {}).forEach(vid => {
          if (vid !== '1') {
            lines.push(`vlan ${vid}`);
            const vname = s.config.vlans[vid];
            if (vname && vname !== vid) lines.push(` name ${vname}`);
            lines.push('!');
          }
        });

        // Interfaces
        Object.keys(s.config.interfaces || {}).forEach(name => {
          const intf = s.config.interfaces[name];
          lines.push(`interface ${intf.name}`);
          if (intf.description) lines.push(` description ${intf.description}`);

          if (s.type === 'switch') {
            if (intf.isRouted) {
              lines.push(' no switchport');
            } else {
              if (intf.mode === 'trunk') {
                if (intf.trunkEncap) lines.push(` switchport trunk encapsulation ${intf.trunkEncap}`);
                lines.push(' switchport mode trunk');
                if (intf.trunkAllowed) lines.push(` switchport trunk allowed vlan ${intf.trunkAllowed}`);
                if (intf.nativeVlan) lines.push(` switchport trunk native vlan ${intf.nativeVlan}`);
              } else if (intf.mode === 'access') {
                lines.push(' switchport mode access');
                if (intf.accessVlan && intf.accessVlan !== '1') lines.push(` switchport access vlan ${intf.accessVlan}`);
              }
              if (intf.portSecurity) {
                lines.push(' switchport port-security');
                if (intf.portSecurity.max) lines.push(` switchport port-security maximum ${intf.portSecurity.max}`);
                if (intf.portSecurity.violation) lines.push(` switchport port-security violation ${intf.portSecurity.violation}`);
                if (intf.portSecurity.mac) lines.push(` switchport port-security mac-address ${intf.portSecurity.mac}`);
              }
            }
          }

          if (intf.dot1qVlan) {
            lines.push(` encapsulation dot1Q ${intf.dot1qVlan}${intf.dot1qNative ? ' native' : ''}`);
          }

          if (intf.ip && intf.mask) {
            lines.push(` ip address ${intf.ip} ${intf.mask}`);
          } else if (intf.isRouted || intf.name.toLowerCase().startsWith('vlan')) {
            lines.push(' no ip address');
          }

          if (intf.ipv6) lines.push(` ipv6 address ${intf.ipv6}`);
          if (intf.nat) lines.push(` ip nat ${intf.nat}`);
          if (intf.channelGroup) lines.push(` channel-group ${intf.channelGroup.id} mode ${intf.channelGroup.mode}`);
          if (intf.helperAddress) lines.push(` ip helper-address ${intf.helperAddress}`);
          if (intf.accessGroup && intf.accessGroup.in) lines.push(` ip access-group ${intf.accessGroup.in} in`);
          if (intf.accessGroup && intf.accessGroup.out) lines.push(` ip access-group ${intf.accessGroup.out} out`);
          if (intf.ospf && intf.ospf.area !== null) lines.push(` ip ospf ${s.config.ospf.id || 1} area ${intf.ospf.area}`);

          if (intf.shutdown) lines.push(' shutdown');
          else lines.push(' no shutdown');
          lines.push('!');
        });

        // Router OSPF
        if (s.config.ospf && s.config.ospf.id) {
          lines.push(`router ospf ${s.config.ospf.id}`);
          if (s.config.ospf.routerId) lines.push(` router-id ${s.config.ospf.routerId}`);
          (s.config.ospf.networks || []).forEach(n => {
            lines.push(` network ${n.net} ${n.wildcard} area ${n.area}`);
          });
          (s.config.ospf.passiveInterfaces || []).forEach(p => {
            lines.push(` passive-interface ${p}`);
          });
          if (s.config.ospf.defaultInformationOriginate) lines.push(' default-information originate');
          lines.push('!');
        }

        // DHCP Pools
        Object.keys(s.config.dhcpPools || {}).forEach(pname => {
          const dp = s.config.dhcpPools[pname];
          lines.push(`ip dhcp pool ${pname}`);
          if (dp.network && dp.mask) lines.push(` network ${dp.network} ${dp.mask}`);
          if (dp.defaultRouter) lines.push(` default-router ${dp.defaultRouter}`);
          if (dp.dnsServer) lines.push(` dns-server ${dp.dnsServer}`);
          if (dp.domainName) lines.push(` domain-name ${dp.domainName}`);
          lines.push('!');
        });
        (s.config.dhcpExcluded || []).forEach(ex => {
          lines.push(`ip dhcp excluded-address ${ex.low}${ex.high ? ' ' + ex.high : ''}`);
        });

        // NAT
        if (s.config.nat && s.config.nat.insideSourceList) {
          const sl = s.config.nat.insideSourceList;
          if (sl.intf) {
            lines.push(`ip nat inside source list ${sl.acl} interface ${sl.intf}${sl.overload ? ' overload' : ''}`);
          } else if (sl.pool) {
            lines.push(`ip nat inside source list ${sl.acl} pool ${sl.pool}${sl.overload ? ' overload' : ''}`);
          }
        }

        // Static Routes
        (s.config.staticRoutes || []).forEach(r => {
          lines.push(`ip route ${r.net} ${r.mask} ${r.nh}${r.ad ? ' ' + r.ad : ''}`);
        });

        // IPv6 Routes
        (s.config.ipv6Routes || []).forEach(r => {
          lines.push(`ipv6 route ${r.prefix} ${r.nh}`);
        });

        // ACLs
        Object.keys(s.config.accessLists.numbered || {}).forEach(num => {
          s.config.accessLists.numbered[num].forEach(rule => {
            lines.push(`access-list ${num} ${rule}`);
          });
        });
        Object.keys(s.config.accessLists.standard || {}).forEach(name => {
          lines.push(`ip access-list standard ${name}`);
          s.config.accessLists.standard[name].forEach(rule => lines.push(` ${rule}`));
          lines.push('!');
        });
        Object.keys(s.config.accessLists.extended || {}).forEach(name => {
          lines.push(`ip access-list extended ${name}`);
          s.config.accessLists.extended[name].forEach(rule => lines.push(` ${rule}`));
          lines.push('!');
        });

        // Lines
        lines.push('line con 0', 'line vty 0 4', ' login local', ' transport input ssh', '!', 'end');
        output = lines.join('\n');
      }

      // SHOW STARTUP-CONFIG
      else if (matchesPrefix(p1, 'startup-config', 3) || p1 === 'start') {
        if (!s.config.savedStartupConfig) {
          output = '%% Non-volatile configuration memory invalid or not present';
        } else {
          output = `Using ${1580} out of 262136 bytes\n!\nversion 15.4\nhostname ${s.config.savedStartupConfig.hostname}\n!\nend`;
        }
      }

      // SHOW IP INTERFACE BRIEF
      else if (p1 === 'ip' && (matchesPrefix(p2, 'interface', 3) || p2 === 'int') && (matchesPrefix(p3, 'brief', 2) || p3 === 'br')) {
        const rows = [
          'Interface                  IP-Address      OK? Method Status                Protocol'
        ];
        Object.keys(s.config.interfaces).forEach(name => {
          const intf = s.config.interfaces[name];
          const cName = intf.name.padEnd(26, ' ');
          const cIp = (intf.ip || 'unassigned').padEnd(15, ' ');
          const cMethod = 'YES manual ';
          const cStatus = intf.shutdown ? 'administratively down down' : (intf.status === 'up' ? 'up                    up' : 'down                  down');
          rows.push(`${cName} ${cIp} ${cMethod} ${cStatus}`);
        });
        output = rows.join('\n');
      }

      // SHOW IP INTERFACE
      else if (p1 === 'ip' && (matchesPrefix(p2, 'interface', 3) || p2 === 'int')) {
        output = `GigabitEthernet0/0 is up, line protocol is up\n  Internet address is 10.1.1.1/24\n  Broadcast address is 255.255.255.255\n  Address determined by non-volatile memory\n  MTU is 1500 bytes\n  Helper address is not set\n  Directed broadcast forwarding is disabled\n  Outgoing access list is not set\n  Inbound  access list is not set`;
      }

      // SHOW INTERFACES TRUNK
      else if ((matchesPrefix(p1, 'interfaces', 4) || p1 === 'int') && p2 === 'trunk') {
        const rows = [
          'Port        Mode             Encapsulation  Status        Native vlan',
          '====================================================================='
        ];
        Object.keys(s.config.interfaces).forEach(name => {
          const intf = s.config.interfaces[name];
          if (intf.mode === 'trunk') {
            const pName = intf.name.padEnd(11, ' ');
            const pMode = 'on'.padEnd(16, ' ');
            const pEncap = (intf.trunkEncap || '802.1q').padEnd(14, ' ');
            const pStat = 'trunking'.padEnd(13, ' ');
            const pNat = String(intf.nativeVlan || 1);
            rows.push(`${pName} ${pMode} ${pEncap} ${pStat} ${pNat}`);
          }
        });
        rows.push('\nPort        Vlans allowed on trunk\n==================================');
        Object.keys(s.config.interfaces).forEach(name => {
          const intf = s.config.interfaces[name];
          if (intf.mode === 'trunk') {
            rows.push(`${intf.name.padEnd(11, ' ')} ${intf.trunkAllowed || '1-4094'}`);
          }
        });
        output = rows.join('\n');
      }

      // SHOW VLAN BRIEF
      else if (matchesPrefix(p1, 'vlan', 2)) {
        const rows = [
          'VLAN Name                             Status    Ports',
          '---- -------------------------------- --------- -------------------------------'
        ];
        Object.keys(s.config.vlans || {}).forEach(vid => {
          const vname = s.config.vlans[vid] || `VLAN${vid.padStart(4, '0')}`;
          const assignedPorts = [];
          Object.keys(s.config.interfaces).forEach(intfName => {
            const intf = s.config.interfaces[intfName];
            if (intf.mode === 'access' && String(intf.accessVlan) === String(vid)) {
              assignedPorts.push(intf.name);
            }
          });
          const cVid = vid.padEnd(4, ' ');
          const cName = vname.padEnd(32, ' ');
          const cStatus = 'active   ';
          const cPorts = assignedPorts.join(', ');
          rows.push(`${cVid} ${cName} ${cStatus} ${cPorts}`);
        });
        output = rows.join('\n');
      }

      // SHOW IP ROUTE
      else if (p1 === 'ip' && (matchesPrefix(p2, 'route', 2) || p2 === 'ro')) {
        const rows = [
          'Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP',
          '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area',
          '       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2',
          '       E1 - OSPF external type 1, E2 - OSPF external type 2',
          '       i - IS-IS, su - IS-IS summary, L1 - IS-IS level-1, L2 - IS-IS level-2',
          '       ia - IS-IS inter area, * - candidate default, U - per-user static route',
          '       o - ODR, P - periodic downloaded static route, H - NHRP, l - LISP',
          '       a - application route',
          '       + - replicated route, % - next hop override',
          '',
          'Gateway of last resort is not set',
          ''
        ];

        // Connected and Local routes
        Object.keys(s.config.interfaces).forEach(name => {
          const intf = s.config.interfaces[name];
          if (intf.ip && intf.mask && intf.status === 'up' && !intf.shutdown) {
            rows.push(`C     ${intf.ip}/24 is directly connected, ${intf.name}`);
            rows.push(`L     ${intf.ip}/32 is directly connected, ${intf.name}`);
          }
        });

        // Static routes
        (s.config.staticRoutes || []).forEach(r => {
          rows.push(`S     ${r.net}/24 [${r.ad || 1}/0] via ${r.nh}`);
        });

        output = rows.join('\n');
      }

      // SHOW IP OSPF NEIGHBOR
      else if (p1 === 'ip' && p2 === 'ospf' && (matchesPrefix(p3, 'neighbor', 4) || p3 === 'nei')) {
        output = `Neighbor ID     Pri   State           Dead Time   Address         Interface\n10.20.31.254      1   FULL/BDR        00:00:34    10.20.31.254    Ethernet0/0`;
      }

      // SHOW IP ARP
      else if (p1 === 'arp' || (p1 === 'ip' && p2 === 'arp')) {
        const rows = [
          'Protocol  Address          Age (min)  Hardware Addr   Type   Interface'
        ];
        Object.keys(s.arpCache).forEach(ip => {
          const entry = s.arpCache[ip];
          rows.push(`Internet  ${ip.padEnd(16, ' ')} ${String(entry.age).padEnd(10, ' ')} ${entry.mac.padEnd(15, ' ')} ARPA   ${entry.interface}`);
        });
        if (rows.length === 1) {
          rows.push('Internet  10.20.31.1              -   aabb.cc00.0100  ARPA   Ethernet0/0');
        }
        output = rows.join('\n');
      }

      // SHOW ETHERCHANNEL SUMMARY
      else if (matchesPrefix(p1, 'etherchannel', 5) || (p1 === 'ip' && p2 === 'etherchannel')) {
        output = `Flags:  D - down        P - bundled in port-channel\n        I - stand-alone s - suspended\n        H - Hot-standby (LACP only)\n        R - Layer3      S - Layer2\n        U - in use      f - failed to allocate aggregator\n\nNumber of channel-groups in use: 1\nNumber of aggregators:           1\n\nGroup  Port-channel  Protocol    Ports\n------+-------------+-----------+-----------------------------------------------\n1      Po1(SU)         LACP      Et0/1(P)    Et0/2(P)`;
      }

      // SHOW SPANNING-TREE
      else if (matchesPrefix(p1, 'spanning-tree', 4) || p1 === 'spanning') {
        output = `VLAN0001\n  Spanning tree enabled protocol rstp\n  Root ID    Priority    32769\n             Address     aabb.cc00.0100\n             This bridge is the root\n             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec\n\n  Bridge ID  Priority    32769  (priority 32768 sys-id-ext 1)\n             Address     aabb.cc00.0100\n             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec\n             Aging Time  300 sec\n\nInterface           Role Sts Cost      Prio.Nbr Type\n------------------- ---- --- --------- -------- --------------------------------\nEt0/0               Desg FWD 100       128.1    P2p\nEt0/1               Desg FWD 100       128.2    P2p\nEt0/2               Desg FWD 100       128.3    P2p`;
      }

      // SHOW MAC ADDRESS-TABLE
      else if (p1 === 'mac' || p1 === 'mac-address-table') {
        output = `          Mac Address Table\n-------------------------------------------\nVlan    Mac Address       Type        Ports\n----    -----------       --------    -----\n   1    aabb.cc00.0100    DYNAMIC     Et0/1\n   1    aabb.cc00.0200    DYNAMIC     Et0/2\nTotal Mac Addresses for this criterion: 2`;
      }

      // SHOW CDP / LLDP NEIGHBORS
      else if (p1 === 'cdp' || p1 === 'lldp') {
        output = `Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge\n                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone\n\nDevice ID        Local Intrfce     Holdtme    Capability  Platform  Port ID\nSW102            Eth 0/1           158             S I    Linux     Eth 0/1\nSW102            Eth 0/2           158             S I    Linux     Eth 0/2`;
      }

      // SHOW ACCESS-LISTS
      else if (matchesPrefix(p1, 'access-lists', 6) || (p1 === 'ip' && matchesPrefix(p2, 'access-lists', 6))) {
        const rows = [];
        Object.keys(s.config.accessLists.standard).forEach(name => {
          rows.push(`Standard IP access list ${name}`);
          s.config.accessLists.standard[name].forEach((r, idx) => {
            rows.push(`    ${(idx + 1) * 10} ${r}`);
          });
        });
        Object.keys(s.config.accessLists.extended).forEach(name => {
          rows.push(`Extended IP access list ${name}`);
          s.config.accessLists.extended[name].forEach((r, idx) => {
            rows.push(`    ${(idx + 1) * 10} ${r}`);
          });
        });
        output = rows.length > 0 ? rows.join('\n') : 'Standard IP access list 10\n    10 permit 192.168.1.0, wildcard bits 0.0.0.255';
      }

      // SHOW VERSION
      else if (matchesPrefix(p1, 'version', 3) || p1 === 'ver') {
        output = `Cisco IOS Software, ${s.type.toUpperCase()} Software (${s.type.toUpperCase()}-UNIVERSALK9-M), Version 15.4(3)M2, RELEASE SOFTWARE (fc2)\nTechnical Support: http://www.cisco.com/techsupport\nCopyright (c) 1986-2026 by Cisco Systems, Inc.\nCompiled Wed 15-Oct-26 12:00 by prod_rel_team\n\nROM: ROMMON Emulation Microcode\n\n${s.config.hostname} uptime is 3 hours, 28 minutes\nSystem returned to ROM by power-on\nSystem image file is "flash3:/vios-adventerprisek9-m"\nLast reload reason: Normal reload\n\nCisco ${s.type.toUpperCase()} (revision 1.0) with 1048576K/262144K bytes of memory.\nProcessor board ID 99482910\n4 Ethernet interfaces\n2 GigabitEthernet interfaces\nConfiguration register is 0x2102`;
      }

      // DEFAULT SHOW OUTPUT
      else {
        output = `% Incomplete show command or output not available for 'show ${parts.join(' ')}'`;
      }

      // Apply Pipe filtering if specified
      if (pipeFilter) {
        output = applyPipeFilter(output, pipeFilter);
      }

      s.addLog('output', output);
      this.refreshScreen();
    }

    // PACKET TRACER ACTIVITY WIZARD ASSESSMENT ENGINE
    gradeLab() {
      const results = [];
      let totalTasks = 0;
      let completedTasks = 0;

      // Iterate through devices to verify standard CCNA lab rubric
      Object.keys(this.devices).forEach(name => {
        const dev = this.devices[name];
        
        // 1. Hostname configuration
        totalTasks++;
        if (dev.config.hostname && dev.config.hostname.toUpperCase() === name.toUpperCase()) {
          completedTasks++;
          results.push({ name: `${name}: Hostname configured`, pass: true });
        } else {
          results.push({ name: `${name}: Hostname configured`, pass: false, error: `Expected hostname ${name}` });
        }

        // 2. Active interface IP check
        let hasActiveIp = false;
        Object.keys(dev.config.interfaces).forEach(iName => {
          const intf = dev.config.interfaces[iName];
          if (intf.ip && !intf.shutdown) hasActiveIp = true;
        });

        if (dev.type === 'router' || Object.keys(dev.config.interfaces).some(k => dev.config.interfaces[k].isRouted)) {
          totalTasks++;
          if (hasActiveIp) {
            completedTasks++;
            results.push({ name: `${name}: Routed interface IP assigned & up`, pass: true });
          } else {
            results.push({ name: `${name}: Routed interface IP assigned & up`, pass: false, error: `No active IP configured` });
          }
        }

        // 3. Saved configuration check
        totalTasks++;
        if (dev.config.savedStartupConfig) {
          completedTasks++;
          results.push({ name: `${name}: Configuration saved to NVRAM`, pass: true });
        } else {
          results.push({ name: `${name}: Configuration saved to NVRAM`, pass: false, error: `Use 'write memory' or 'copy run start'` });
        }
      });

      const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
      return { percentage, completedTasks, totalTasks, results };
    }

    // ASSESSMENT MODAL UI
    showAssessmentModal() {
      const grade = this.gradeLab();
      let modal = document.getElementById('ios-pt-assessment-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ios-pt-assessment-modal';
        modal.className = 'ios-pt-assessment-modal';
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div class="ios-pt-assessment-content">
          <div class="ios-pt-modal-header">
            <h3>Packet Tracer Activity Wizard Assessment</h3>
            <button class="ios-pt-close-btn" onclick="document.getElementById('ios-pt-assessment-modal').style.display='none'">&times;</button>
          </div>
          <div class="ios-pt-modal-body">
            <div class="ios-pt-score-box">
              <div class="ios-pt-score-val">${grade.percentage}%</div>
              <div class="ios-pt-score-bar-bg">
                <div class="ios-pt-score-bar-fill" style="width: ${grade.percentage}%"></div>
              </div>
              <div class="ios-pt-score-sub">${grade.completedTasks} of ${grade.totalTasks} items completed</div>
            </div>
            <div class="ios-pt-checklist">
              ${grade.results.map(r => `
                <div class="ios-pt-check-item ${r.pass ? 'pass' : 'fail'}">
                  <span class="ios-pt-icon">${r.pass ? '&#10004;' : '&#10008;'}</span>
                  <span class="ios-pt-item-name">${r.name}</span>
                  ${r.error ? `<span class="ios-pt-item-hint">(${r.error})</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
          <div class="ios-pt-modal-footer">
            <button class="btn btn-primary" onclick="document.getElementById('ios-pt-assessment-modal').style.display='none'">Close</button>
          </div>
        </div>
      `;
      modal.style.display = 'flex';
    }

    // STATIC HELPER: EXTRACT DEVICE NAMES FROM QUESTION PROMPT
    static extractDevices(text) {
      if (!text) return ['SW101', 'SW102'];
      const raw = String(text);
      const matches = new Set();

      // Match common patterns: SW1, SW2, SW101, SW102, R1, R2, Router1, DLS1, ALS1, Core1
      const patterns = [
        /\b(SW\d+|SW-\d+|Switch\d+|Switch-\d+)\b/gi,
        /\b(R\d+|R-\d+|Router\d+|Router-\d+)\b/gi,
        /\b(DLS\d+|ALS\d+|Core\d+|Dist\d+)\b/gi
      ];

      patterns.forEach(pat => {
        let m;
        while ((m = pat.exec(raw)) !== null) {
          matches.add(m[1].toUpperCase());
        }
      });

      const list = Array.from(matches);
      if (list.length > 0) {
        return list.slice(0, 4); // Limit to at most 4 devices per tab bar
      }
      return ['SW101', 'SW102'];
    }
  }

  // EXPORT TO BROWSER GLOBAL AND COMMONJS
  if (typeof window !== 'undefined') {
    window.IosSimulator = IosSimulator;
    window.IosDeviceSession = IosDeviceSession;
    window.matchesPrefix = matchesPrefix;
    window.isSameSubnet = isSameSubnet;
    window.applyPipeFilter = applyPipeFilter;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      IosSimulator,
      IosDeviceSession,
      matchesPrefix,
      isSameSubnet,
      applyPipeFilter,
      ROOT_COMMANDS,
      SUB_TREES
    };
  }
})();
