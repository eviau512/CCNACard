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
    'inc': 'include', 'exc': 'exclude', 'beg': 'begin', 'sec': 'section'
  };

  function norm(token, mode = '') {
    if (!token) return '';
    const t = token.toLowerCase();
    if (t === 'ro' && mode === 'config') return 'router';
    if ((t === 'ex' || t === 'exi') && mode.startsWith('config')) return 'exit';
    if (t === 'ex' && mode === 'config-dhcp') return 'excluded-address';
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
      { cmd: 'arp', desc: 'Set arp type (arpa, probe, snap) or timeout' },
      { cmd: 'bandwidth', desc: 'Set bandwidth informational parameter' },
      { cmd: 'cdp', desc: 'Global CDP configuration subcommands' },
      { cmd: 'channel-group', desc: 'Etherchannel/port bundling configuration' },
      { cmd: 'channel-protocol', desc: 'Select the channel protocol (LACP, PAgP)' },
      { cmd: 'delay', desc: 'Specify interface throughput delay' },
      { cmd: 'description', desc: 'Interface specific description' },
      { cmd: 'do', desc: 'To run exec commands in config mode' },
      { cmd: 'duplex', desc: 'Configure duplex operation.' },
      { cmd: 'end', desc: 'Exit from configure mode' },
      { cmd: 'exit', desc: 'Exit from interface configuration mode' },
      { cmd: 'hold-queue', desc: 'Set hold queue depth' },
      { cmd: 'ip', desc: 'Interface Internet Protocol config commands' },
      { cmd: 'ipv6', desc: 'IPv6 interface subcommands' },
      { cmd: 'lldp', desc: 'LLDP interface subcommands' },
      { cmd: 'mdix', desc: 'Set Media Dependent Interface with Crossover' },
      { cmd: 'mls', desc: 'mls interface commands' },
      { cmd: 'no', desc: 'Negate a command or set its defaults' },
      { cmd: 'power', desc: 'Power configuration' },
      { cmd: 'rep', desc: 'Resilient Ethernet Protocol characteristics' },
      { cmd: 'service-policy', desc: 'Configure QoS Service Policy' },
      { cmd: 'shutdown', desc: 'Shutdown the selected interface' },
      { cmd: 'spanning-tree', desc: 'Spanning Tree Subsystem' },
      { cmd: 'speed', desc: 'Configure speed operation.' },
      { cmd: 'standby', desc: 'HSRP interface configuration commands' },
      { cmd: 'storm-control', desc: 'storm configuration' },
      { cmd: 'switchport', desc: 'Set switching mode characteristics' },
      { cmd: 'tx-ring-limit', desc: 'Configure PA level transmit ring limit' }
    ],
    'config-subif': [
      { cmd: 'description', desc: 'Interface specific description' },
      { cmd: 'do', desc: 'To run exec commands in config mode' },
      { cmd: 'encapsulation', desc: 'Set encapsulation type for an interface' },
      { cmd: 'end', desc: 'Exit from configure mode' },
      { cmd: 'exit', desc: 'Exit from configure mode' },
      { cmd: 'ip', desc: 'Interface Internet Protocol config commands' },
      { cmd: 'ipv6', desc: 'IPv6 interface subcommands' },
      { cmd: 'no', desc: 'Negate a command or set its defaults' },
      { cmd: 'shutdown', desc: 'Shutdown the selected interface' }
    ],
    'config-if-range': [
      { cmd: 'arp', desc: 'Set arp type (arpa, probe, snap) or timeout' },
      { cmd: 'bandwidth', desc: 'Set bandwidth informational parameter' },
      { cmd: 'cdp', desc: 'Global CDP configuration subcommands' },
      { cmd: 'channel-group', desc: 'Etherchannel/port bundling configuration' },
      { cmd: 'channel-protocol', desc: 'Select the channel protocol (LACP, PAgP)' },
      { cmd: 'delay', desc: 'Specify interface throughput delay' },
      { cmd: 'description', desc: 'Interface specific description' },
      { cmd: 'do', desc: 'To run exec commands in config mode' },
      { cmd: 'duplex', desc: 'Configure duplex operation.' },
      { cmd: 'end', desc: 'Exit from configure mode' },
      { cmd: 'exit', desc: 'Exit from interface configuration mode' },
      { cmd: 'hold-queue', desc: 'Set hold queue depth' },
      { cmd: 'ip', desc: 'Interface Internet Protocol config commands' },
      { cmd: 'ipv6', desc: 'IPv6 interface subcommands' },
      { cmd: 'lldp', desc: 'LLDP interface subcommands' },
      { cmd: 'mdix', desc: 'Set Media Dependent Interface with Crossover' },
      { cmd: 'mls', desc: 'mls interface commands' },
      { cmd: 'no', desc: 'Negate a command or set its defaults' },
      { cmd: 'power', desc: 'Power configuration' },
      { cmd: 'rep', desc: 'Resilient Ethernet Protocol characteristics' },
      { cmd: 'service-policy', desc: 'Configure QoS Service Policy' },
      { cmd: 'shutdown', desc: 'Shutdown the selected interface' },
      { cmd: 'spanning-tree', desc: 'Spanning Tree Subsystem' },
      { cmd: 'speed', desc: 'Configure speed operation.' },
      { cmd: 'standby', desc: 'HSRP interface configuration commands' },
      { cmd: 'storm-control', desc: 'storm configuration' },
      { cmd: 'switchport', desc: 'Set switching mode characteristics' },
      { cmd: 'tx-ring-limit', desc: 'Configure PA level transmit ring limit' }
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
    // configure command in privileged exec
    'configure': [
      { cmd: 'memory', desc: 'Configure from NV memory' },
      { cmd: 'network', desc: 'Configure from a TFTP/FTP/RCP network host' },
      { cmd: 'terminal', desc: 'Configure from the terminal' },
      { cmd: '<cr>', desc: '' }
    ],
    // channel-protocol
    'channel-protocol': [
      { cmd: 'lacp', desc: 'Prepare interface for LACP protocol' },
      { cmd: 'pagp', desc: 'Prepare interface for PAgP protocol' }
    ],
    // duplex
    'duplex': [
      { cmd: 'auto', desc: 'Enable AUTO duplex configuration' },
      { cmd: 'full', desc: 'Force full duplex operation' },
      { cmd: 'half', desc: 'Force half duplex operation' }
    ],
    // speed
    'speed': [
      { cmd: '10', desc: 'Force 10 Mbps operation' },
      { cmd: '100', desc: 'Force 100 Mbps operation' },
      { cmd: '1000', desc: 'Force 1000 Mbps operation' },
      { cmd: 'auto', desc: 'Enable AUTO speed configuration' }
    ],
    // mdix
    'mdix': [
      { cmd: 'auto', desc: 'Enable Media Dependent Interface with Crossover' }
    ],
    // storm-control
    'storm-control': [
      { cmd: 'broadcast', desc: 'Broadcast address storm control' },
      { cmd: 'multicast', desc: 'Multicast address storm control' },
      { cmd: 'unicast', desc: 'Unicast address storm control' }
    ],
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

  const TOPOLOGY_REGISTRY = {
  "1092": {
    "devices": [
      "SW-1",
      "SW-2",
      "SW-3",
      "SW-4"
    ],
    "deviceTypes": {
      "SW-1": "l3switch",
      "SW-2": "l3switch",
      "SW-3": "l3switch",
      "SW-4": "l3switch"
    },
    "links": [
      {
        "from": "SW-1",
        "fromPort": "Ethernet0/1",
        "to": "SW-2",
        "toPort": "Ethernet0/1"
      },
      {
        "from": "SW-1",
        "fromPort": "Ethernet0/2",
        "to": "SW-3",
        "toPort": "Ethernet0/2"
      },
      {
        "from": "SW-2",
        "fromPort": "Ethernet0/2",
        "to": "SW-4",
        "toPort": "Ethernet0/2"
      },
      {
        "from": "SW-3",
        "fromPort": "Ethernet0/0",
        "to": "SW-4",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "SW-3",
        "fromPort": "Ethernet0/1",
        "to": "SW-4",
        "toPort": "Ethernet0/1"
      }
    ],
    "initialConfigs": {
      "all": {
        "trunkPorts": [
          "Ethernet0/1",
          "Ethernet0/2"
        ],
        "encapsulation": "dot1q"
      }
    }
  },
  "1119": {
    "devices": [
      "SW1",
      "SW2"
    ],
    "deviceTypes": {
      "SW1": "l3switch",
      "SW2": "l3switch"
    },
    "links": [
      {
        "from": "SW1",
        "fromPort": "Ethernet0/0",
        "to": "SW2",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "SW1",
        "fromPort": "Ethernet0/1",
        "to": "SW2",
        "toPort": "Ethernet0/1"
      }
    ],
    "initialConfigs": {
      "all": {
        "vlans": {
          "50": "MONITORING"
        }
      }
    }
  },
  "1120": {
    "devices": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "deviceTypes": {
      "R1": "router",
      "R2": "router",
      "R3": "router",
      "R4": "router"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "GigabitEthernet0/0",
        "to": "R3",
        "toPort": "GigabitEthernet0/0"
      },
      {
        "from": "R2",
        "fromPort": "GigabitEthernet0/1",
        "to": "R4",
        "toPort": "GigabitEthernet0/1"
      }
    ]
  },
  "1121": {
    "devices": [
      "R1",
      "R2",
      "R3"
    ],
    "deviceTypes": {
      "R1": "router",
      "R2": "router",
      "R3": "router"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "Ethernet0/2",
        "to": "R2",
        "toPort": "Ethernet0/2"
      },
      {
        "from": "R2",
        "fromPort": "Ethernet0/0",
        "to": "R3",
        "toPort": "Ethernet0/0"
      }
    ]
  },
  "1122": {
    "devices": [
      "SW1",
      "SW2"
    ],
    "deviceTypes": {
      "SW1": "l3switch",
      "SW2": "l3switch"
    },
    "links": [
      {
        "from": "SW1",
        "fromPort": "Ethernet0/1",
        "to": "SW2",
        "toPort": "Ethernet0/1"
      }
    ],
    "initialConfigs": {
      "SW2": {
        "vlans": {
          "20": "Available"
        }
      }
    }
  },
  "1123": {
    "devices": [
      "R1",
      "R2"
    ],
    "deviceTypes": {
      "R1": "router",
      "R2": "router"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "Ethernet0/1",
        "to": "R2",
        "toPort": "Ethernet0/1"
      }
    ]
  },
  "1124": {
    "devices": [
      "SW1",
      "SW2",
      "SW3"
    ],
    "deviceTypes": {
      "SW1": "l3switch",
      "SW2": "l3switch",
      "SW3": "l3switch"
    },
    "links": [
      {
        "from": "SW1",
        "fromPort": "Ethernet0/2",
        "to": "SW2",
        "toPort": "Ethernet0/2"
      },
      {
        "from": "SW2",
        "fromPort": "Ethernet0/3",
        "to": "SW3",
        "toPort": "Ethernet0/3"
      }
    ]
  },
  "1125": {
    "devices": [
      "SW101",
      "SW102"
    ],
    "deviceTypes": {
      "SW101": "l3switch",
      "SW102": "l3switch"
    },
    "links": [
      {
        "from": "SW101",
        "fromPort": "Ethernet0/0",
        "to": "SW102",
        "toPort": "Ethernet0/0"
      }
    ]
  },
  "1126": {
    "devices": [
      "SW1"
    ],
    "deviceTypes": {
      "SW1": "l3switch"
    },
    "links": [
      {
        "from": "SW1",
        "fromPort": "GigabitEthernet0/1",
        "to": "Server",
        "toPort": "eth0"
      },
      {
        "from": "SW1",
        "fromPort": "GigabitEthernet0/2",
        "to": "Host",
        "toPort": "eth0"
      }
    ]
  },
  "1128": {
    "devices": [
      "R1",
      "R2",
      "SW1"
    ],
    "deviceTypes": {
      "R1": "router",
      "R2": "router",
      "SW1": "l3switch"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "Ethernet0/1",
        "to": "R2",
        "toPort": "Ethernet0/1"
      },
      {
        "from": "R1",
        "fromPort": "Ethernet0/2",
        "to": "R2",
        "toPort": "Ethernet0/2"
      },
      {
        "from": "R1",
        "fromPort": "GigabitEthernet0/0",
        "to": "SW1",
        "toPort": "GigabitEthernet0/0"
      }
    ]
  },
  "1149": {
    "devices": [
      "R1",
      "R2",
      "R3"
    ],
    "deviceTypes": {
      "R1": "router",
      "R2": "router",
      "R3": "router"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "Ethernet0/0",
        "to": "R2",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "R2",
        "fromPort": "Ethernet0/1",
        "to": "R3",
        "toPort": "Ethernet0/1"
      },
      {
        "from": "R1",
        "fromPort": "Ethernet0/2",
        "to": "R3",
        "toPort": "Ethernet0/2"
      }
    ]
  },
  "1159": {
    "devices": [
      "R1",
      "SW-1"
    ],
    "deviceTypes": {
      "R1": "router",
      "SW-1": "l3switch"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "GigabitEthernet0/0/1",
        "to": "SW-1",
        "toPort": "GigabitEthernet0/1"
      }
    ]
  },
  "1160": {
    "devices": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "deviceTypes": {
      "R1": "router",
      "R2": "router",
      "R3": "router",
      "R4": "router"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "GigabitEthernet0/1",
        "to": "R2",
        "toPort": "GigabitEthernet0/1"
      },
      {
        "from": "R2",
        "fromPort": "GigabitEthernet0/2",
        "to": "R3",
        "toPort": "GigabitEthernet0/2"
      },
      {
        "from": "R3",
        "fromPort": "GigabitEthernet0/3",
        "to": "R4",
        "toPort": "GigabitEthernet0/3"
      }
    ]
  },
  "1161": {
    "devices": [
      "SW101",
      "SW102"
    ],
    "deviceTypes": {
      "SW101": "l3switch",
      "SW102": "l3switch"
    },
    "links": [
      {
        "from": "SW101",
        "fromPort": "Ethernet0/0",
        "to": "SW102",
        "toPort": "Ethernet0/0"
      }
    ]
  },
  "1165": {
    "devices": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "deviceTypes": {
      "R1": "router",
      "R2": "router",
      "R3": "router",
      "R4": "router"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "GigabitEthernet0/0",
        "to": "R2",
        "toPort": "GigabitEthernet0/0"
      },
      {
        "from": "R2",
        "fromPort": "GigabitEthernet0/1",
        "to": "R3",
        "toPort": "GigabitEthernet0/1"
      },
      {
        "from": "R3",
        "fromPort": "GigabitEthernet0/2",
        "to": "R4",
        "toPort": "GigabitEthernet0/2"
      }
    ]
  },
  "1166": {
    "devices": [
      "R1",
      "R2",
      "SW-1",
      "SW-2"
    ],
    "deviceTypes": {
      "R1": "router",
      "R2": "router",
      "SW-1": "l3switch",
      "SW-2": "l3switch"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "Ethernet0/0",
        "to": "SW-1",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "R2",
        "fromPort": "Ethernet0/0",
        "to": "SW-2",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "SW-1",
        "fromPort": "Ethernet0/2",
        "to": "SW-2",
        "toPort": "Ethernet0/2"
      }
    ]
  },
  "1167": {
    "devices": [
      "R1",
      "SW-1",
      "SW-2"
    ],
    "deviceTypes": {
      "R1": "router",
      "SW-1": "l3switch",
      "SW-2": "l3switch"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "Ethernet0/1",
        "to": "SW-1",
        "toPort": "Ethernet0/1"
      },
      {
        "from": "SW-1",
        "fromPort": "Ethernet0/2",
        "to": "SW-2",
        "toPort": "Ethernet0/2"
      }
    ]
  },
  "1169": {
    "devices": [
      "SW-1",
      "SW-2",
      "SW-3"
    ],
    "deviceTypes": {
      "SW-1": "l3switch",
      "SW-2": "l3switch",
      "SW-3": "l3switch"
    },
    "links": [
      {
        "from": "SW-1",
        "fromPort": "Ethernet0/0",
        "to": "SW-2",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "SW-1",
        "fromPort": "Ethernet0/1",
        "to": "SW-2",
        "toPort": "Ethernet0/1"
      },
      {
        "from": "SW-2",
        "fromPort": "Ethernet0/2",
        "to": "SW-3",
        "toPort": "Ethernet0/2"
      }
    ]
  },
  "1177": {
    "devices": [
      "SW-2",
      "SW-3"
    ],
    "deviceTypes": {
      "SW-2": "l3switch",
      "SW-3": "l3switch"
    },
    "links": [
      {
        "from": "SW-2",
        "fromPort": "Ethernet0/0",
        "to": "SW-3",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "SW-2",
        "fromPort": "Ethernet0/2",
        "to": "PC1",
        "toPort": "eth0"
      },
      {
        "from": "SW-2",
        "fromPort": "Ethernet0/3",
        "to": "PC2",
        "toPort": "eth0"
      }
    ]
  },
  "1180": {
    "devices": [
      "SW101",
      "SW102"
    ],
    "deviceTypes": {
      "SW101": "l3switch",
      "SW102": "l3switch"
    },
    "links": [
      {
        "from": "SW101",
        "fromPort": "Ethernet0/0",
        "to": "SW102",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "SW101",
        "fromPort": "Ethernet0/1",
        "to": "PC1",
        "toPort": "eth0"
      },
      {
        "from": "SW102",
        "fromPort": "Ethernet0/1",
        "to": "Server",
        "toPort": "eth0"
      }
    ]
  },
  "1184": {
    "devices": [
      "R1",
      "SW-1",
      "SW-2",
      "SW-3",
      "SW-4"
    ],
    "deviceTypes": {
      "R1": "router",
      "SW-1": "l3switch",
      "SW-2": "l3switch",
      "SW-3": "l3switch",
      "SW-4": "l3switch"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "Ethernet0/0",
        "to": "SW-1",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "SW-1",
        "fromPort": "Ethernet0/1",
        "to": "SW-2",
        "toPort": "Ethernet0/1"
      },
      {
        "from": "SW-1",
        "fromPort": "Ethernet0/2",
        "to": "SW-3",
        "toPort": "Ethernet0/2"
      },
      {
        "from": "SW-2",
        "fromPort": "Ethernet0/2",
        "to": "SW-4",
        "toPort": "Ethernet0/2"
      },
      {
        "from": "SW-3",
        "fromPort": "Ethernet0/0",
        "to": "SW-4",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "SW-3",
        "fromPort": "Ethernet0/1",
        "to": "SW-4",
        "toPort": "Ethernet0/1"
      }
    ]
  },
  "1189": {
    "devices": [
      "R1",
      "SW101",
      "SW103"
    ],
    "deviceTypes": {
      "R1": "router",
      "SW101": "l3switch",
      "SW103": "l3switch"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "Ethernet0/1",
        "to": "SW101",
        "toPort": "Ethernet0/1"
      },
      {
        "from": "SW101",
        "fromPort": "Ethernet0/2",
        "to": "SW103",
        "toPort": "Ethernet0/2"
      }
    ]
  },
  "1191": {
    "devices": [
      "SW101",
      "SW102"
    ],
    "deviceTypes": {
      "SW101": "l3switch",
      "SW102": "l3switch"
    },
    "links": [
      {
        "from": "SW101",
        "fromPort": "Ethernet0/0",
        "to": "SW102",
        "toPort": "Ethernet0/0"
      }
    ]
  },
  "1192": {
    "devices": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "deviceTypes": {
      "R1": "router",
      "R2": "router",
      "R3": "router",
      "R4": "router"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "GigabitEthernet0/0",
        "to": "R2",
        "toPort": "GigabitEthernet0/0"
      },
      {
        "from": "R2",
        "fromPort": "GigabitEthernet0/1",
        "to": "R3",
        "toPort": "GigabitEthernet0/1"
      },
      {
        "from": "R3",
        "fromPort": "GigabitEthernet0/2",
        "to": "R4",
        "toPort": "GigabitEthernet0/2"
      }
    ]
  },
  "1193": {
    "devices": [
      "R1",
      "SW-1",
      "SW-2"
    ],
    "deviceTypes": {
      "R1": "router",
      "SW-1": "l3switch",
      "SW-2": "l3switch"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "Ethernet0/0",
        "to": "SW-1",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "SW-1",
        "fromPort": "Ethernet0/1",
        "to": "SW-2",
        "toPort": "Ethernet0/1"
      }
    ]
  },
  "1194": {
    "devices": [
      "SW1",
      "SW2"
    ],
    "deviceTypes": {
      "SW1": "l3switch",
      "SW2": "l3switch"
    },
    "links": [
      {
        "from": "SW1",
        "fromPort": "Ethernet0/0",
        "to": "SW2",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "SW1",
        "fromPort": "Ethernet0/1",
        "to": "SW2",
        "toPort": "Ethernet0/1"
      }
    ]
  },
  "1195": {
    "devices": [
      "SW-1",
      "SW-2",
      "SW-3",
      "SW-4"
    ],
    "deviceTypes": {
      "SW-1": "l3switch",
      "SW-2": "l3switch",
      "SW-3": "l3switch",
      "SW-4": "l3switch"
    },
    "links": [
      {
        "from": "SW-1",
        "fromPort": "Ethernet0/0",
        "to": "SW-2",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "SW-1",
        "fromPort": "Ethernet0/1",
        "to": "SW-2",
        "toPort": "Ethernet0/1"
      },
      {
        "from": "SW-1",
        "fromPort": "Ethernet0/2",
        "to": "SW-3",
        "toPort": "Ethernet0/2"
      },
      {
        "from": "SW-2",
        "fromPort": "Ethernet0/2",
        "to": "SW-4",
        "toPort": "Ethernet0/2"
      }
    ]
  },
  "1196": {
    "devices": [
      "R1",
      "SW101",
      "SW102",
      "SW103"
    ],
    "deviceTypes": {
      "R1": "router",
      "SW101": "l3switch",
      "SW102": "l3switch",
      "SW103": "l3switch"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "Ethernet0/0",
        "to": "SW101",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "SW101",
        "fromPort": "Ethernet0/1",
        "to": "SW102",
        "toPort": "Ethernet0/1"
      },
      {
        "from": "SW101",
        "fromPort": "Ethernet0/2",
        "to": "SW103",
        "toPort": "Ethernet0/2"
      }
    ]
  },
  "1197": {
    "devices": [
      "R1",
      "R2",
      "R3"
    ],
    "deviceTypes": {
      "R1": "router",
      "R2": "router",
      "R3": "router"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "Ethernet0/1",
        "to": "R2",
        "toPort": "Ethernet0/1"
      },
      {
        "from": "R2",
        "fromPort": "Ethernet0/2",
        "to": "R3",
        "toPort": "Ethernet0/2"
      }
    ]
  },
  "1198": {
    "devices": [
      "SW-1",
      "SW-2",
      "SW-3"
    ],
    "deviceTypes": {
      "SW-1": "l3switch",
      "SW-2": "l3switch",
      "SW-3": "l3switch"
    },
    "links": [
      {
        "from": "SW-1",
        "fromPort": "Ethernet0/1",
        "to": "SW-2",
        "toPort": "Ethernet0/1"
      },
      {
        "from": "SW-2",
        "fromPort": "Ethernet0/2",
        "to": "SW-3",
        "toPort": "Ethernet0/2"
      }
    ]
  },
  "1199": {
    "devices": [
      "R1",
      "R2"
    ],
    "deviceTypes": {
      "R1": "router",
      "R2": "router"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "Ethernet0/0",
        "to": "R2",
        "toPort": "Ethernet0/0"
      }
    ]
  },
  "1200": {
    "devices": [
      "R1",
      "R2",
      "R3",
      "R4",
      "R5",
      "R6"
    ],
    "deviceTypes": {
      "R1": "router",
      "R2": "router",
      "R3": "router",
      "R4": "router",
      "R5": "router",
      "R6": "router"
    },
    "links": [
      {
        "from": "R5",
        "fromPort": "Ethernet0/0",
        "to": "R1",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "R1",
        "fromPort": "Ethernet0/1",
        "to": "R3",
        "toPort": "Ethernet0/1"
      },
      {
        "from": "R1",
        "fromPort": "Ethernet0/2",
        "to": "R2",
        "toPort": "Ethernet0/2"
      },
      {
        "from": "R3",
        "fromPort": "Ethernet0/3",
        "to": "R6",
        "toPort": "Ethernet0/3"
      },
      {
        "from": "R2",
        "fromPort": "Ethernet0/3",
        "to": "R6",
        "toPort": "Ethernet0/4"
      }
    ]
  },
  "1201": {
    "devices": [
      "R1",
      "SW2",
      "SW3"
    ],
    "deviceTypes": {
      "R1": "router",
      "SW2": "l3switch",
      "SW3": "l3switch"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "GigabitEthernet0/0",
        "to": "SW2",
        "toPort": "GigabitEthernet0/0"
      },
      {
        "from": "SW2",
        "fromPort": "GigabitEthernet0/1",
        "to": "SW3",
        "toPort": "GigabitEthernet0/1"
      }
    ]
  },
  "1202": {
    "devices": [
      "SW1",
      "SW2"
    ],
    "deviceTypes": {
      "SW1": "l3switch",
      "SW2": "l3switch"
    },
    "links": [
      {
        "from": "SW1",
        "fromPort": "Ethernet0/0",
        "to": "SW2",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "SW1",
        "fromPort": "Ethernet0/1",
        "to": "SW2",
        "toPort": "Ethernet0/1"
      }
    ]
  },
  "1203": {
    "devices": [
      "SW1",
      "SW2"
    ],
    "deviceTypes": {
      "SW1": "l3switch",
      "SW2": "l3switch"
    },
    "links": [
      {
        "from": "SW1",
        "fromPort": "Ethernet0/0",
        "to": "SW2",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "SW1",
        "fromPort": "Ethernet0/1",
        "to": "PC1",
        "toPort": "eth0"
      },
      {
        "from": "SW1",
        "fromPort": "Ethernet0/2",
        "to": "Phone1",
        "toPort": "eth0"
      },
      {
        "from": "SW2",
        "fromPort": "Ethernet0/1",
        "to": "PC2",
        "toPort": "eth0"
      },
      {
        "from": "SW2",
        "fromPort": "Ethernet0/2",
        "to": "Phone2",
        "toPort": "eth0"
      }
    ]
  },
  "1204": {
    "devices": [
      "R1",
      "R2",
      "R3"
    ],
    "deviceTypes": {
      "R1": "router",
      "R2": "router",
      "R3": "router"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "Ethernet0/0",
        "to": "R2",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "R1",
        "fromPort": "Ethernet0/1",
        "to": "R3",
        "toPort": "Ethernet0/1"
      }
    ]
  },
  "1227": {
    "devices": [
      "R1",
      "R2",
      "SW-1",
      "SW-2"
    ],
    "deviceTypes": {
      "R1": "router",
      "R2": "router",
      "SW-1": "l3switch",
      "SW-2": "l3switch"
    },
    "links": [
      {
        "from": "R1",
        "fromPort": "Ethernet0/0",
        "to": "SW-1",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "R2",
        "fromPort": "Ethernet0/0",
        "to": "SW-2",
        "toPort": "Ethernet0/0"
      },
      {
        "from": "SW-1",
        "fromPort": "Ethernet0/2",
        "to": "SW-2",
        "toPort": "Ethernet0/2"
      }
    ]
  }
};

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
      const isSw = (this.type === 'switch' || this.type === 'l3switch') || this.type === 'l3switch' || /^(sw|switch|dls|als)/i.test(this.hostname);
      if (isSw) {
        ['Ethernet0/0', 'Ethernet0/1', 'Ethernet0/2', 'Ethernet0/3', 'GigabitEthernet0/1', 'GigabitEthernet0/2', 'Vlan1'].forEach(name => {
          const isVlan = name.toLowerCase().startsWith('vlan');
          this.config.interfaces[name] = {
            name: name,
            isRouted: isVlan, // SVI VLAN interfaces are Layer 3 by definition
            ip: null,
            mask: null,
            ipv6: null,
            ipv6LinkLocal: null,
            status: isVlan ? 'up' : 'down',
            protocol: isVlan ? 'up' : 'down',
            connected: false,
            peerDevice: null,
            peerPort: null,
            description: null,
            mode: isVlan ? 'routed' : 'access', // 'access', 'trunk', 'routed'
            encapsulation: 'dot1q',
            accessVlan: isVlan ? null : '1',
            trunkAllowed: '1-4094',
            nativeVlan: '1',
            voiceVlan: null,
            channelGroup: null,
            channelMode: null,
            portSecurity: { enabled: false, max: 1, violation: 'shutdown', macs: [], sticky: false },
            spanningTree: { portfast: false, bpduguard: false, cost: null },
            ospf: { area: null, priority: null, cost: null, hello: 10, dead: 40 },
            nat: null,
            accessGroup: { in: null, out: null },
            cdp: true,
            lldp: { tx: true, rx: true }
          };
        });
      } else {
        ['Ethernet0/0', 'Ethernet0/1', 'Ethernet0/2', 'GigabitEthernet0/0', 'GigabitEthernet0/1', 'GigabitEthernet0/2', 'Serial0/0/0', 'Serial0/0/1', 'Loopback0'].forEach(name => {
          this.config.interfaces[name] = {
            name: name,
            isRouted: true,
            ip: null,
            mask: null,
            ipv6: null,
            ipv6LinkLocal: null,
            status: name.startsWith('Loopback') ? 'up' : 'down',
            protocol: name.startsWith('Loopback') ? 'up' : 'down',
            connected: false,
            peerDevice: null,
            peerPort: null,
            shutdown: false,
            description: null,
            ospf: {
              area: null,
              priority: null,
              cost: null,
              hello: 10,
              dead: 40
            },
            nat: null,
            accessGroup: { in: null, out: null },
            helperAddress: null,
            standby: {},
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

    createDefaultInterface(name, devType) {
      const isVlan = name.toLowerCase().startsWith('vlan');
      const isRouter = devType === 'router';
      return {
        name: name,
        isRouted: isRouter || isVlan,
        ip: null,
        mask: null,
        ipv6: null,
        ipv6LinkLocal: null,
        status: isVlan ? 'up' : 'down',
        protocol: isVlan ? 'up' : 'down',
        connected: false,
        peerDevice: null,
        peerPort: null,
        shutdown: false,
        description: null,
        mode: (isRouter || isVlan) ? 'routed' : 'access',
        encapsulation: 'dot1q',
        accessVlan: isVlan ? null : '1',
        trunkAllowed: '1-4094',
        nativeVlan: '1',
        voiceVlan: null,
        channelGroup: null,
        channelMode: null,
        portSecurity: { enabled: false, max: 1, violation: 'shutdown', macs: [], sticky: false },
        spanningTree: { portfast: false, bpduguard: false, cost: null },
        ospf: { area: null, priority: null, cost: null, hello: 10, dead: 40 },
        nat: null,
        accessGroup: { in: null, out: null },
        cdp: true,
        lldp: { tx: true, rx: true }
      };
    }

    applyTopology(topo) {
      if (!topo) return;

      // 1. Mark links on connected interfaces
      (topo.links || []).forEach(l => {
        const fromDev = this.devices[l.from];
        const toDev = this.devices[l.to];
        const fromP = this.normalizeInterface(l.fromPort);
        const toP = this.normalizeInterface(l.toPort);

        if (fromDev) {
          if (!fromDev.config.interfaces[fromP]) {
            fromDev.config.interfaces[fromP] = this.createDefaultInterface(fromP, fromDev.type);
          }
          const it = fromDev.config.interfaces[fromP];
          it.connected = true;
          it.status = 'up';
          it.protocol = 'up';
          it.peerDevice = l.to;
          it.peerPort = toP;
        }

        if (toDev) {
          if (!toDev.config.interfaces[toP]) {
            toDev.config.interfaces[toP] = this.createDefaultInterface(toP, toDev.type);
          }
          const it = toDev.config.interfaces[toP];
          it.connected = true;
          it.status = 'up';
          it.protocol = 'up';
          it.peerDevice = l.from;
          it.peerPort = fromP;
        }
      });

      // 2. Apply initial configs if specified (e.g. initial trunks, VLANs)
      if (topo.initialConfigs) {
        Object.keys(topo.initialConfigs).forEach(target => {
          const cfg = topo.initialConfigs[target];
          const targetDevs = target === 'all' ? Object.keys(this.devices) : [target];
          targetDevs.forEach(devName => {
            const dev = this.devices[devName];
            if (!dev) return;

            if (cfg.trunkPorts && Array.isArray(cfg.trunkPorts)) {
              cfg.trunkPorts.forEach(rawP => {
                const p = this.normalizeInterface(rawP);
                if (dev.config.interfaces[p]) {
                  dev.config.interfaces[p].mode = 'trunk';
                  dev.config.interfaces[p].isRouted = false;
                  dev.config.interfaces[p].trunkEncap = cfg.encapsulation || 'dot1q';
                }
              });
            }

            if (cfg.vlans && typeof cfg.vlans === 'object') {
              Object.keys(cfg.vlans).forEach(vid => {
                dev.config.vlans[vid] = cfg.vlans[vid];
              });
            }
          });
        });
      }
    }

    static detectQuestionId(text) {
      if (!text) return null;
      const str = String(text);
      const m = str.match(/(?:question|card|id|#)\s*[:#]?\s*(\d{4})/i) || str.match(/\b(1092|1119|1120|1121|1122|1123|1124|1125|1126|1128|1149|1159|1160|1161|1165|1166|1167|1169|1177|1180|1184|1189|1191|1192|1193|1194|1195|1196|1197|1198|1199|1200|1201|1202|1203|1204|1227)\b/);
      if (m) {
        const id = parseInt(m[1], 10);
        if (TOPOLOGY_REGISTRY[id]) return id;
      }
      return null;
    }

    initDevices(options) {
      let qId = options.questionId;
      if (!qId && options.promptText) {
        qId = IosSimulator.detectQuestionId(options.promptText);
      }

      const topo = qId && TOPOLOGY_REGISTRY[qId] ? TOPOLOGY_REGISTRY[qId] : null;

      let devNames = [];
      if (topo && topo.devices && topo.devices.length > 0) {
        devNames = topo.devices;
      } else if (options && Array.isArray(options.devices) && options.devices.length > 0) {
        devNames = options.devices;
      } else if (options && typeof options.promptText === 'string') {
        devNames = IosSimulator.extractDevices(options.promptText);
      } else {
        devNames = ['SW101', 'SW102'];
      }

      devNames.forEach(name => {
        let devType = 'switch';
        if (topo && topo.deviceTypes && topo.deviceTypes[name]) {
          devType = topo.deviceTypes[name];
        } else if (/^(r\d+|router)/i.test(name)) {
          devType = 'router';
        } else if (/^(sw\d+|switch|dls|als)/i.test(name)) {
          devType = 'l3switch';
        }
        this.devices[name] = new IosDeviceSession(name, devType);
      });

      if (topo) {
        this.applyTopology(topo);
      }

      this.activeDeviceName = devNames[0] || 'SW101';
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

// Authentic lab topology: tabs strictly match question topology devices
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

      // Configure command (terminal, memory, network)
      if (matchesPrefix(p0, 'configure', 4) || p0 === 'conf') {
        if (!p1 || p1 === 'terminal' || p1 === 't' || p1 === 'term') {
          s.mode = 'config';
          if (!p1) {
            s.addLog('system', 'Configuring from terminal, memory, or network [terminal]?\nEnter configuration commands, one per line.  End with CNTL/Z.');
          } else {
            s.addLog('system', 'Enter configuration commands, one per line.  End with CNTL/Z.');
          }
          this.refreshScreen();
          return;
        } else if (p1 === 'memory' || p1 === 'mem') {
          s.addLog('system', 'Non-Volatile memory configuration loaded into running configuration.\n[OK]');
          this.refreshScreen();
          return;
        } else if (p1 === 'network' || p1 === 'net') {
          s.addLog('system', 'Host or network configuration file [host]? \nAddress of remote host [255.255.255.255]? \nName of configuration file [network-confg]? \nConfigure using network-confg... [timed out]');
          this.refreshScreen();
          return;
        }
      }

      // Exit / End (supports 'exit', 'exi', 'ex')
      if (p0 === 'exit' || p0 === 'exi' || p0 === 'ex') {
        if (s.mode.startsWith('config-if') || s.mode === 'config-subif' || s.mode === 'config-router' ||
            s.mode === 'config-vlan' || s.mode === 'config-line' || s.mode === 'config-dhcp' ||
            s.mode === 'config-std-nacl' || s.mode === 'config-ext-nacl') {
          s.mode = 'config';
          s.context = null;
        } else if (s.mode === 'config') {
          s.mode = 'priv';
          s.context = null;
        } else if (s.mode === 'priv') {
          s.mode = 'user';
          s.context = null;
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

        // channel-protocol (lacp / pagp)
        if (p0 === 'channel-protocol') {
          targetInterfaces.forEach(it => {
            it.channelProtocol = p1;
          });
          this.refreshScreen();
          return;
        }

        // duplex (auto / full / half)
        if (p0 === 'duplex') {
          targetInterfaces.forEach(it => { it.duplex = p1; });
          this.refreshScreen();
          return;
        }

        // speed (10 / 100 / 1000 / auto)
        if (p0 === 'speed') {
          targetInterfaces.forEach(it => { it.speed = p1; });
          this.refreshScreen();
          return;
        }

        // mdix auto
        if (p0 === 'mdix') {
          this.refreshScreen();
          return;
        }

        // storm-control
        if (p0 === 'storm-control') {
          this.refreshScreen();
          return;
        }

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
          if (intf && !intf.isRouted && !isSvi && (s.type === 'switch' || s.type === 'l3switch')) {
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
          if (intf && !intf.isRouted && !isSvi && (s.type === 'switch' || s.type === 'l3switch')) {
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
          targetInterfaces.forEach(it => { it.shutdown = true; });
          this.refreshScreen();
          return;
        }
        if (p0 === 'no' && (p1 === 'shutdown' || p1 === 'shut')) {
          targetInterfaces.forEach(it => { it.shutdown = false; });
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
            const isSw = (s.type === 'switch' || s.type === 'l3switch') && !isSub;
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
      this.reportInvalid(s, rawCmd);
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
        if (s.config.ipRouting && (s.type === 'switch' || s.type === 'l3switch')) lines.push('ip routing');
        if (s.config.ipv6UnicastRouting) lines.push('ipv6 unicast-routing');
        if (s.config.dhcpSnooping) lines.push('ip dhcp snooping');

        // Spanning Tree
        if ((s.type === 'switch' || s.type === 'l3switch')) {
          lines.push(`spanning-tree mode ${s.config.spanningTree.mode || 'pvst'}`);
          lines.push('spanning-tree extend system-id');
          Object.keys((s.config.spanningTree && s.config.spanningTree.vlans) || {}).forEach(v => {
            lines.push(`spanning-tree vlan ${v} priority ${s.config.spanningTree.vlans[v].priority}`);
          });
          Object.keys((s.config.spanningTree && s.config.spanningTree.vlans) || {}).forEach(v => {
            lines.push(`spanning-tree vlan ${v} priority ${s.config.spanningTree.vlans[v].priority}`);
          });
          Object.keys((s.config.spanningTree && s.config.spanningTree.vlans) || {}).forEach(v => {
            lines.push(`spanning-tree vlan ${v} priority ${s.config.spanningTree.vlans[v].priority}`);
          });
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

          const isVlan = intf.name.toLowerCase().startsWith('vlan');
          const isSwitchDev = s.type === 'switch' || s.type === 'l3switch';
          if (isSwitchDev && !isVlan) {
            if (intf.isRouted) {
              lines.push(' no switchport');
            } else {
              if (intf.mode === 'trunk') {
                if (intf.trunkEncap) lines.push(` switchport trunk encapsulation ${intf.trunkEncap}`);
                lines.push(' switchport mode trunk');
                if (intf.trunkAllowed === '') lines.push(' switchport trunk allowed vlan none');
                else if (intf.trunkAllowed && intf.trunkAllowed !== '1-4094') lines.push(` switchport trunk allowed vlan ${intf.trunkAllowed}`);
                if (intf.nativeVlan && intf.nativeVlan !== '1') lines.push(` switchport trunk native vlan ${intf.nativeVlan}`);
              } else if (intf.mode === 'access') {
                if (intf.explicitMode) lines.push(' switchport mode access');
                if (intf.accessVlan && intf.accessVlan !== '1') lines.push(` switchport access vlan ${intf.accessVlan}`);
              }
              if (intf.portSecurity && intf.portSecurity.enabled) {
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

      // SHOW IP INTERFACE BRIEF (Authentic Cisco IOS / Packet Tracer output format)
      else if (p1 === 'ip' && (matchesPrefix(p2, 'interface', 3) || p2 === 'int') && (matchesPrefix(p3, 'brief', 2) || p3 === 'br')) {
        const rows = [
          'Interface                  IP-Address      OK? Method Status                Protocol'
        ];
        Object.keys(s.config.interfaces).forEach(name => {
          const intf = s.config.interfaces[name];
          const cName = intf.name.padEnd(26, ' ');
          const cIp = (intf.ip || 'unassigned').padEnd(15, ' ');
          const cMethod = intf.ip ? 'YES manual ' : 'YES unset  ';
          let cStatus = 'down                  down';
          if (intf.shutdown) {
            cStatus = 'administratively down down';
          } else if (intf.status === 'up' && intf.protocol === 'up') {
            cStatus = 'up                    up';
          }
          rows.push(`${cName} ${cIp} ${cMethod} ${cStatus}`);
        });
        output = rows.join('\n');
      }

      // SHOW INTERFACES STATUS (Packet Tracer switchport status table)
      else if ((matchesPrefix(p1, 'interfaces', 4) || p1 === 'int') && (p2 === 'status' || matchesPrefix(p2, 'status', 4))) {
        const rows = [
          'Port      Name               Status       Vlan       Duplex  Speed Type'
        ];
        Object.keys(s.config.interfaces).forEach(name => {
          const intf = s.config.interfaces[name];
          if (intf.name.toLowerCase().startsWith('vlan') || intf.name.toLowerCase().startsWith('loopback')) return;
          const shortP = intf.name.replace(/^GigabitEthernet/, 'Gi').replace(/^FastEthernet/, 'Fa').replace(/^Ethernet/, 'Et').replace(/^Port-channel/, 'Po');
          const pCol = shortP.padEnd(9, ' ');
          const nameCol = (intf.description || '').substring(0, 18).padEnd(18, ' ');
          const statCol = (intf.shutdown ? 'disabled' : (intf.connected ? 'connected' : 'notconnect')).padEnd(12, ' ');
          const vlanCol = (intf.isRouted ? 'routed' : (intf.mode === 'trunk' ? 'trunk' : (intf.accessVlan || '1'))).padEnd(10, ' ');
          const dupCol = 'auto  ';
          const spdCol = 'auto ';
          const typeCol = intf.name.startsWith('Gi') ? '1000BaseTX' : '10/100BaseTX';
          rows.push(`${pCol} ${nameCol} ${statCol} ${vlanCol} ${dupCol} ${spdCol} ${typeCol}`);
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
            if (intf.mode === 'access' && intf.accessVlan === vid && !intf.isRouted && !intf.name.toLowerCase().startsWith('vlan')) {
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

      // SHOW ETHERCHANNEL SUMMARY (Dynamic based on configured channel-groups)
      else if (matchesPrefix(p1, 'etherchannel', 5) || (p1 === 'ip' && p2 === 'etherchannel')) {
        const groups = {};
        Object.keys(s.config.interfaces).forEach(name => {
          const intf = s.config.interfaces[name];
          if (intf.channelGroup && intf.channelGroup.id) {
            const gid = intf.channelGroup.id;
            if (!groups[gid]) {
              groups[gid] = {
                id: gid,
                mode: intf.channelGroup.mode || 'active',
                ports: [],
                isRouted: intf.isRouted
              };
            }
            const shortP = intf.name.replace(/^Ethernet/, 'Et').replace(/^GigabitEthernet/, 'Gi').replace(/^FastEthernet/, 'Fa');
            groups[gid].ports.push(`${shortP}(P)`);
          }
        });

        const gKeys = Object.keys(groups);
        const header = [
          'Flags:  D - down        P - bundled in port-channel',
          '        I - stand-alone s - suspended',
          '        H - Hot-standby (LACP only)',
          '        R - Layer3      S - Layer2',
          '        U - in use      f - failed to allocate aggregator',
          '',
          `Number of channel-groups in use: ${gKeys.length}`,
          `Number of aggregators:           ${gKeys.length}`,
          '',
          'Group  Port-channel  Protocol    Ports',
          '------+-------------+-----------+-----------------------------------------------'
        ];

        gKeys.forEach(gid => {
          const g = groups[gid];
          const proto = (g.mode === 'active' || g.mode === 'passive') ? 'LACP' : ((g.mode === 'auto' || g.mode === 'desirable') ? 'PAgP' : '-');
          const poType = g.isRouted ? 'RU' : 'SU';
          const poName = `Po${gid}(${poType})`.padEnd(13, ' ');
          const gCol = String(gid).padEnd(6, ' ');
          const protoCol = proto.padEnd(11, ' ');
          const portsCol = g.ports.join('    ');
          header.push(`${gCol} ${poName} ${protoCol} ${portsCol}`);
        });

        output = header.join('\n');
      }

      // SHOW SPANNING-TREE
      else if (matchesPrefix(p1, 'spanning-tree', 4) || p1 === 'spanning') {
        output = `VLAN0001\n  Spanning tree enabled protocol rstp\n  Root ID    Priority    32769\n             Address     aabb.cc00.0100\n             This bridge is the root\n             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec\n\n  Bridge ID  Priority    32769  (priority 32768 sys-id-ext 1)\n             Address     aabb.cc00.0100\n             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec\n             Aging Time  300 sec\n\nInterface           Role Sts Cost      Prio.Nbr Type\n------------------- ---- --- --------- -------- --------------------------------\nEt0/0               Desg FWD 100       128.1    P2p\nEt0/1               Desg FWD 100       128.2    P2p\nEt0/2               Desg FWD 100       128.3    P2p`;
      }

      // SHOW MAC ADDRESS-TABLE
      else if (p1 === 'mac' || p1 === 'mac-address-table') {
        output = `          Mac Address Table\n-------------------------------------------\nVlan    Mac Address       Type        Ports\n----    -----------       --------    -----\n   1    aabb.cc00.0100    DYNAMIC     Et0/1\n   1    aabb.cc00.0200    DYNAMIC     Et0/2\nTotal Mac Addresses for this criterion: 2`;
      }

      // SHOW CDP / LLDP NEIGHBORS (Dynamic Cisco device neighbor table)
      else if (p1 === 'cdp' || p1 === 'lldp') {
        const rows = [
          'Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge',
          '                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone',
          '',
          'Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID'
        ];

        let count = 0;
        Object.keys(s.config.interfaces).forEach(name => {
          const intf = s.config.interfaces[name];
          if (intf.connected && intf.peerDevice && !intf.shutdown && intf.status === 'up') {
            const isCisco = /^(sw|r|switch|router|dls|als|dist|core)/i.test(intf.peerDevice);
            if (isCisco) {
              count++;
              const devCol = intf.peerDevice.padEnd(16, ' ');
              const locCol = intf.name.replace(/^GigabitEthernet/, 'Gig ').replace(/^Ethernet/, 'Eth ').padEnd(17, ' ');
              const holdCol = (150 + Math.floor(Math.random() * 30)).toString().padEnd(10, ' ');
              const capCol = intf.peerDevice.toUpperCase().startsWith('R') ? 'R        ' : 'S I      ';
              const platCol = intf.peerDevice.toUpperCase().startsWith('R') ? 'ISR4321   ' : 'WS-C2960 ';
              const portCol = (intf.peerPort || intf.name).replace(/^GigabitEthernet/, 'Gig ').replace(/^Ethernet/, 'Eth ');
              rows.push(`${devCol} ${locCol} ${holdCol} ${capCol} ${platCol} ${portCol}`);
            }
          }
        });

        output = count > 0 ? rows.join('\n') : '% CDP neighbor table is empty or no CDP neighbors discovered.';
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
        output = `Cisco IOS Software, ${s.type === 'router' ? 'ROUTER' : 'SWITCH'} Software (${s.type === 'router' ? 'ROUTER' : 'SWITCH'}-UNIVERSALK9-M), Version 15.4(3)M2, RELEASE SOFTWARE (fc2)\nTechnical Support: http://www.cisco.com/techsupport\nCopyright (c) 1986-2026 by Cisco Systems, Inc.\nCompiled Wed 15-Oct-26 12:00 by prod_rel_team\n\nROM: ROMMON Emulation Microcode\n\n${s.config.hostname} uptime is 3 hours, 28 minutes\nSystem returned to ROM by power-on\nSystem image file is "flash3:/vios-adventerprisek9-m"\nLast reload reason: Normal reload\n\nCisco ${s.type === 'router' ? 'ROUTER' : 'SWITCH'} (revision 1.0) with 1048576K/262144K bytes of memory.\nProcessor board ID 99482910\n4 Ethernet interfaces\n2 GigabitEthernet interfaces\nConfiguration register is 0x2102`;
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

  // ===========================================================================
  // PT ENGINE: topology-driven link state, L2/L3 reachability, routing table,
  // OSPF, STP, CDP/LLDP, IOS-accurate errors and show commands
  // ===========================================================================
  (function installPtEngine() {
    const SIM = IosSimulator.prototype;
    const rawExec = SIM.executeCommand;
    const rawShow = SIM.handleShowCommand;
    const rawInit = SIM.initDevices;

    // ---------- generic helpers ----------
    const isPhysical = n => /^(Ethernet|FastEthernet|GigabitEthernet|TenGigabitEthernet|Serial)/.test(n);
    const isSvi = n => /^Vlan\d+$/i.test(n);
    const isLoop = n => /^Loopback/i.test(n);
    const isPo = n => /^Port-channel/i.test(n);
    const isSub = n => n.indexOf('.') >= 0;
    const isSwitchDev = d => d.type === 'switch' || d.type === 'l3switch';
    function shortName(n) {
      return n.replace(/^GigabitEthernet/, 'Gi').replace(/^FastEthernet/, 'Fa').replace(/^TenGigabitEthernet/, 'Te')
        .replace(/^Ethernet/, 'Et').replace(/^Port-channel/, 'Po').replace(/^Serial/, 'Se').replace(/^Loopback/, 'Lo');
    }
    function longToIp(l) { return [(l >>> 24) & 255, (l >>> 16) & 255, (l >>> 8) & 255, l & 255].join('.'); }
    function validIp(s) { return /^\d{1,3}(\.\d{1,3}){3}$/.test(s || '') && s.split('.').every(x => +x <= 255); }
    function validMask(m) {
      if (!validIp(m)) return false;
      const l = ipToLong(m);
      let seenZero = false;
      for (let i = 31; i >= 0; i--) {
        const bit = (l >>> i) & 1;
        if (bit === 0) seenZero = true; else if (seenZero) return false;
      }
      return true;
    }
    function maskToPrefix(mask) {
      const l = ipToLong(mask); let n = 0;
      for (let i = 31; i >= 0; i--) { if ((l >>> i) & 1) n++; else break; }
      return n;
    }
    function prefixToMask(p) { return longToIp(p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0); }
    function netOf(ip, mask) { return (ipToLong(ip) & ipToLong(mask)) >>> 0; }
    function pad(s, n) { return String(s).padEnd(n, ' '); }

    function devKeys(sim) { return Object.keys(sim.devices); }
    function physList(dev) { return Object.keys(dev.config.interfaces).filter(n => isPhysical(n) && !isSub(n)); }
    function ifMac(sim, dev, intf) {
      const i = devKeys(sim).indexOf(dev.hostname);
      let idx = 0;
      if (isPhysical(intf.name) && !isSub(intf.name)) idx = Math.max(0, physList(dev).indexOf(intf.name));
      return 'aabb.cc00.' + ((i + 1) * 0x100 + idx).toString(16).padStart(4, '0');
    }
    function bridgeMac(sim, dev) {
      const i = devKeys(sim).indexOf(dev.hostname);
      return 'aabb.cc00.' + ((i + 1) * 0x100).toString(16).padStart(4, '0');
    }
    function portNum(dev, name) {
      if (isPo(name)) return 64 + parseInt(name.replace(/\D/g, ''), 10);
      return physList(dev).indexOf(name) + 1;
    }
    function realName(dev) { return dev.config.hostname || dev.hostname; }

    // ---------- VLAN list helpers ----------
    function parseVlanList(str) {
      const set = new Set();
      String(str || '').split(',').forEach(p => {
        p = p.trim(); if (!p) return;
        const m = p.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
        if (!m) return;
        const a = +m[1], b = m[2] ? +m[2] : a;
        for (let v = a; v <= b && v <= 4094; v++) set.add(v);
      });
      return set;
    }
    function formatVlanSet(set) {
      const arr = Array.from(set).sort((a, b) => a - b); const out = []; let i = 0;
      while (i < arr.length) {
        let j = i;
        while (j + 1 < arr.length && arr[j + 1] === arr[j] + 1) j++;
        out.push(j > i ? arr[i] + '-' + arr[j] : String(arr[i]));
        i = j + 1;
      }
      return out.join(',') || 'none';
    }
    function trunkSet(i) { return parseVlanList(i.trunkAllowed == null ? '1-4094' : i.trunkAllowed); }
    function carries(i, v) {
      if (i.isRouted) return false;
      if (i.mode === 'trunk') return trunkSet(i).has(+v);
      return String(i.accessVlan || '1') === String(v);
    }
    function poOf(dev, i) {
      return i.channelGroup ? dev.config.interfaces['Port-channel' + i.channelGroup.id] : null;
    }
    function carriesEff(dev, i, v) {
      if (carries(i, v)) return true;
      const po = poOf(dev, i);
      return !!(po && carries(po, v));
    }

    // ---------- link state ----------
    function peerOf(sim, intf) {
      if (!intf.connected || !intf.peerDevice) return null;
      const d = sim.devices[intf.peerDevice];
      if (!d) return { host: true };
      const p = d.config.interfaces[intf.peerPort];
      return { dev: d, intf: p };
    }
    function physUp(sim, dev, intf) {
      if (intf.shutdown || !intf.connected) return false;
      const p = peerOf(sim, intf);
      if (!p) return false;
      if (p.host) return true;
      if (!p.intf) return false;
      return !p.intf.shutdown;
    }
    function sviActive(sim, dev, v) {
      if (String(v) !== '1' && !dev.config.vlans[String(v)]) return false;
      return Object.values(dev.config.interfaces).some(i =>
        isPhysical(i.name) && !isSub(i.name) && !i.isRouted && physUp(sim, dev, i) && carriesEff(dev, i, v));
    }
    function computeIf(sim, dev, i) {
      if (i.shutdown) return ['administratively down', 'down'];
      const n = i.name;
      if (isLoop(n)) return ['up', 'up'];
      if (isSvi(n)) return sviActive(sim, dev, parseInt(n.replace(/\D/g, ''), 10)) ? ['up', 'up'] : ['down', 'down'];
      if (isPo(n)) {
        const gid = n.replace(/\D/g, '');
        const mem = Object.values(dev.config.interfaces).filter(x => x.channelGroup && String(x.channelGroup.id) === gid && physUp(sim, dev, x));
        return mem.length ? ['up', 'up'] : ['down', 'down'];
      }
      if (isSub(n)) {
        const parent = dev.config.interfaces[n.split('.')[0]];
        return parent ? computeIf(sim, dev, parent) : ['down', 'down'];
      }
      return physUp(sim, dev, i) ? ['up', 'up'] : ['down', 'down'];
    }
    function logChange(dev, i, old) {
      const n = i.name; const lines = [];
      if (i.status === 'administratively down') {
        lines.push('%LINK-5-CHANGED: Interface ' + n + ', changed state to administratively down');
        if (old.pr === 'up') lines.push('%LINEPROTO-5-UPDOWN: Line protocol on Interface ' + n + ', changed state to down');
      } else if (old.st === 'administratively down') {
        if (i.status === 'up') lines.push('%LINK-3-UPDOWN: Interface ' + n + ', changed state to up');
        if (i.protocol === 'up') lines.push('%LINEPROTO-5-UPDOWN: Line protocol on Interface ' + n + ', changed state to up');
      } else {
        if (old.st !== i.status) lines.push('%LINK-3-UPDOWN: Interface ' + n + ', changed state to ' + i.status);
        if (old.pr !== i.protocol) lines.push('%LINEPROTO-5-UPDOWN: Line protocol on Interface ' + n + ', changed state to ' + i.protocol);
      }
      if (lines.length) dev.addLog('system', lines.join('\n'));
    }
    function reconcile(sim, silent) {
      devKeys(sim).forEach(k => {
        const dev = sim.devices[k];
        Object.values(dev.config.interfaces).forEach(i => {
          const r = computeIf(sim, dev, i);
          if (i.status !== r[0] || i.protocol !== r[1]) {
            const old = { st: i.status, pr: i.protocol };
            i.status = r[0]; i.protocol = r[1];
            if (!silent) logChange(dev, i, old);
          }
        });
      });
    }
    const ifUp = i => i.status === 'up' && i.protocol === 'up';
    const l3Ifs = dev => Object.values(dev.config.interfaces).filter(i => i.ip && i.mask && ifUp(i));

    // ---------- L2 domain walk / L3 neighbours ----------
    function bfsL2(sim, startDev, v, exclude) {
      const seen = new Set([startDev.hostname + '#' + v]);
      const q = [[startDev, v]]; const eps = [];
      while (q.length) {
        const [d, vl] = q.shift();
        const svi = d.config.interfaces['Vlan' + vl];
        if (svi && svi.ip && ifUp(svi)) eps.push({ dev: d, intf: svi });
        Object.values(d.config.interfaces).forEach(i => {
          if (!isPhysical(i.name) || isSub(i.name) || i.isRouted) return;
          if (!physUp(sim, d, i) || !carriesEff(d, i, vl)) return;
          const p = peerOf(sim, i);
          if (!p || p.host || !p.intf) return;
          const pd = p.dev, pi = p.intf;
          if (isSwitchDev(pd) && !pi.isRouted) {
            if (carriesEff(pd, pi, vl)) {
              const key = pd.hostname + '#' + vl;
              if (!seen.has(key)) { seen.add(key); q.push([pd, vl]); }
            }
          } else if (pi.isRouted) {
            const subs = Object.values(pd.config.interfaces).filter(x => x.name.indexOf(pi.name + '.') === 0 && String(x.dot1qVlan) === String(vl));
            if (i.mode === 'trunk' && subs.length) subs.forEach(x => { if (ifUp(x)) eps.push({ dev: pd, intf: x }); });
            else if (!isSub(pi.name) && i.mode !== 'trunk' && String(i.accessVlan || '1') === String(vl) && ifUp(pi)) eps.push({ dev: pd, intf: pi });
            else if (!isSub(pi.name) && i.mode === 'trunk' && String(i.nativeVlan || '1') === String(vl) && ifUp(pi) && !subs.length) eps.push({ dev: pd, intf: pi });
          }
        });
      }
      return eps.filter(e => e.intf !== exclude);
    }
    function neighborsOf(sim, dev, intf) {
      const n = intf.name;
      let res = [];
      if (isSvi(n)) {
        res = bfsL2(sim, dev, parseInt(n.replace(/\D/g, ''), 10), intf);
      } else if (isPhysical(n) || isSub(n)) {
        const phys = isSub(n) ? dev.config.interfaces[n.split('.')[0]] : intf;
        if (!phys || !physUp(sim, dev, phys)) return [];
        const p = peerOf(sim, phys);
        if (!p || p.host || !p.intf) return [];
        const pd = p.dev, pi = p.intf;
        if (isSwitchDev(pd) && !pi.isRouted) {
          let v;
          if (isSub(n)) {
            v = parseInt(intf.dot1qVlan, 10);
            if (!(pi.mode === 'trunk' && carriesEff(pd, pi, v))) return [];
          } else {
            v = pi.mode === 'trunk' ? parseInt(pi.nativeVlan || '1', 10) : parseInt(pi.accessVlan || '1', 10);
          }
          res = bfsL2(sim, pd, v, intf);
        } else if (!isSub(n)) {
          res = pi.isRouted && !isSvi(pi.name) && !isSub(pi.name) ? [{ dev: pd, intf: pi }] : [];
        } else {
          res = Object.values(pd.config.interfaces).filter(x => x.name.indexOf(pi.name + '.') === 0 && String(x.dot1qVlan) === String(intf.dot1qVlan)).map(x => ({ dev: pd, intf: x }));
        }
      }
      if (!intf.ip || !intf.mask) return [];
      return res.filter(e => e.dev !== dev && e.intf.ip && e.intf.mask && ifUp(e.intf) &&
        netOf(e.intf.ip, e.intf.mask) === netOf(intf.ip, intf.mask) && maskToPrefix(e.intf.mask) === maskToPrefix(intf.mask));
    }

    // ---------- OSPF ----------
    function ospfAreaOf(dev, i) {
      const o = dev.config.ospf;
      if (!i.ip || !i.mask) return null;
      if (i.ospf && i.ospf.area !== null && i.ospf.area !== undefined) return String(i.ospf.area);
      if (!o || !o.id) return null;
      const ipl = ipToLong(i.ip);
      for (const nw of (o.networks || [])) {
        const w = ipToLong(nw.wildcard), nl = ipToLong(nw.net);
        if (((ipl & ~w) >>> 0) === ((nl & ~w) >>> 0)) return String(nw.area);
      }
      return null;
    }
    function ospfPassive(dev, i) {
      const p = (dev.config.ospf && dev.config.ospf.passiveInterfaces) || [];
      return p.indexOf(i.name) >= 0 || p.indexOf('default') >= 0;
    }
    function ospfCost(i) {
      if (i.ospf && i.ospf.cost != null) return +i.ospf.cost;
      if (/^Serial/.test(i.name)) return 64;
      if (/^(Gigabit|TenGigabit|FastEthernet|Vlan|Loopback)/.test(i.name)) return 1;
      return 10;
    }
    function routerId(dev) {
      const o = dev.config.ospf;
      if (o && validIp(o.routerId)) return o.routerId;
      const ifs = Object.values(dev.config.interfaces).filter(i => i.ip && ifUp(i));
      const best = lst => lst.map(i => ipToLong(i.ip)).sort((a, b) => b - a)[0];
      const lo = ifs.filter(i => isLoop(i.name));
      if (lo.length) return longToIp(best(lo));
      if (ifs.length) return longToIp(best(ifs));
      return '0.0.0.0';
    }
    function ospfOn(dev) {
      return !!((dev.config.ospf && dev.config.ospf.id) || Object.values(dev.config.interfaces).some(i => i.ospf && i.ospf.area !== null && i.ospf.area !== undefined));
    }
    function ospfAdj(sim) {
      const edges = [];
      devKeys(sim).forEach(k => {
        const dev = sim.devices[k];
        if (!ospfOn(dev)) return;
        Object.values(dev.config.interfaces).forEach(x => {
          if (!x.ip || !ifUp(x)) return;
          const ax = ospfAreaOf(dev, x);
          if (ax === null || ospfPassive(dev, x)) return;
          neighborsOf(sim, dev, x).forEach(y => {
            if (!ospfOn(y.dev)) return;
            const ay = ospfAreaOf(y.dev, y.intf);
            if (ay === null || ay !== ax || ospfPassive(y.dev, y.intf)) return;
            const hx = (x.ospf && x.ospf.hello) || 10, hy = (y.intf.ospf && y.intf.ospf.hello) || 10;
            const dx = (x.ospf && x.ospf.dead) || 40, dy = (y.intf.ospf && y.intf.ospf.dead) || 40;
            if (hx !== hy || dx !== dy) return;
            if (routerId(dev) === routerId(y.dev)) return;
            edges.push({ x: { dev, intf: x }, y });
          });
        });
      });
      return edges;
    }
    function ospfRoles(sim, edges) {
      // returns map "dev#intf" -> 'DR'|'BDR'|'DROTHER'|'P2P'
      const roles = {}; const done = new Set();
      edges.forEach(e => {
        const key = e.x.dev.hostname + '#' + e.x.intf.name;
        if (done.has(key)) return;
        const seg = [e.x].concat(edges.filter(z => z.x === e.x).map(z => z.y));
        seg.forEach(m => done.add(m.dev.hostname + '#' + m.intf.name));
        const p2p = seg.every(m => m.intf.ospf && m.intf.ospf.network === 'point-to-point');
        if (p2p) { seg.forEach(m => { roles[m.dev.hostname + '#' + m.intf.name] = 'P2P'; }); return; }
        const el = seg.filter(m => !(m.intf.ospf && m.intf.ospf.priority === 0)).sort((a, b) => {
          const pa = (a.intf.ospf && a.intf.ospf.priority != null) ? a.intf.ospf.priority : 1;
          const pb = (b.intf.ospf && b.intf.ospf.priority != null) ? b.intf.ospf.priority : 1;
          if (pa !== pb) return pb - pa;
          return ipToLong(routerId(b.dev)) - ipToLong(routerId(a.dev));
        });
        seg.forEach(m => { roles[m.dev.hostname + '#' + m.intf.name] = 'DROTHER'; });
        if (el[0]) roles[el[0].dev.hostname + '#' + el[0].intf.name] = 'DR';
        if (el[1]) roles[el[1].dev.hostname + '#' + el[1].intf.name] = 'BDR';
      });
      return roles;
    }
    function ospfRoutesFor(sim, src) {
      const out = [];
      if (!ospfOn(src)) return out;
      const edges = ospfAdj(sim);
      const dist = {}; const firsts = {};
      dist[src.hostname] = 0; firsts[src.hostname] = [];
      let changed = true; let guard = 0;
      while (changed && guard++ < 50) {
        changed = false;
        edges.forEach(e => {
          const a = e.x.dev.hostname, b = e.y.dev.hostname;
          if (dist[a] === undefined) return;
          const nd = dist[a] + ospfCost(e.x.intf);
          const f = a === src.hostname ? [{ intf: e.x.intf, nh: e.y.intf.ip, nbr: e.y }] : firsts[a];
          if (dist[b] === undefined || nd < dist[b]) { dist[b] = nd; firsts[b] = f.slice(); changed = true; }
          else if (nd === dist[b] && b !== src.hostname) {
            f.forEach(h => { if (!firsts[b].some(z => z.intf === h.intf && z.nh === h.nh)) { firsts[b].push(h); changed = true; } });
          }
        });
      }
      const best = {};
      Object.keys(dist).forEach(hn => {
        if (hn === src.hostname) return;
        const rd = sim.devices[hn];
        Object.values(rd.config.interfaces).forEach(i => {
          if (!i.ip || !i.mask || !ifUp(i) || ospfAreaOf(rd, i) === null) return;
          const net = netOf(i.ip, i.mask), prefix = maskToPrefix(i.mask);
          const cost = dist[hn] + ospfCost(i);
          const key = net + '/' + prefix;
          if (!best[key] || cost < best[key].metric) best[key] = { code: 'O', net, prefix, ad: 110, metric: cost, hops: firsts[hn].slice() };
        });
        if (rd.config.ospf && rd.config.ospf.defaultInformationOriginate) {
          const key = '0/0';
          const m = 1;
          if (!best[key] || dist[hn] < best[key].dist) best[key] = { code: 'O*E2', net: 0, prefix: 0, ad: 110, metric: m, dist: dist[hn], hops: firsts[hn].slice() };
        }
      });
      Object.keys(best).forEach(k => out.push(best[k]));
      return out;
    }

    // ---------- RIB / forwarding ----------
    function forwarding(dev) { return dev.type === 'router' || !!dev.config.ipRouting; }
    function ribOf(sim, dev) {
      const rib = [];
      l3Ifs(dev).forEach(i => {
        const net = netOf(i.ip, i.mask), prefix = maskToPrefix(i.mask);
        rib.push({ code: 'C', net, prefix, ad: 0, metric: 0, hops: [{ intf: i }] });
        rib.push({ code: 'L', net: ipToLong(i.ip), prefix: 32, ad: 0, metric: 0, hops: [{ intf: i }] });
      });
      if (forwarding(dev)) {
        (dev.config.staticRoutes || []).forEach(r => {
          if (!validIp(r.net) || !validMask(r.mask)) return;
          const prefix = maskToPrefix(r.mask), net = netOf(r.net, r.mask);
          const ad = r.ad || 1;
          if (validIp(r.nh)) {
            const c = l3Ifs(dev).find(i => netOf(i.ip, i.mask) === netOf(r.nh, i.mask));
            if (!c) return;
            const nbr = neighborsOf(sim, dev, c).find(n => n.intf.ip === r.nh) || null;
            rib.push({ code: 'S', net, prefix, ad, metric: 0, hops: [{ intf: c, nh: r.nh, nbr }] });
          } else {
            const ifc = dev.config.interfaces[sim.normalizeInterface(r.nh)];
            if (ifc && ifUp(ifc)) rib.push({ code: 'S', net, prefix, ad, metric: 0, hops: [{ intf: ifc }], direct: true });
          }
        });
        ospfRoutesFor(sim, dev).forEach(r => rib.push(r));
      } else if (dev.config.defaultGateway && validIp(dev.config.defaultGateway)) {
        const c = l3Ifs(dev).find(i => netOf(i.ip, i.mask) === netOf(dev.config.defaultGateway, i.mask));
        if (c) {
          const nbr = neighborsOf(sim, dev, c).find(n => n.intf.ip === dev.config.defaultGateway) || null;
          rib.push({ code: 'S*', net: 0, prefix: 0, ad: 1, metric: 0, hops: [{ intf: c, nh: dev.config.defaultGateway, nbr }] });
        }
      }
      // best path per prefix (lowest AD, then metric)
      const best = {};
      rib.forEach(r => {
        const k = r.net + '/' + r.prefix;
        const cur = best[k];
        if (!cur || r.ad < cur.ad || (r.ad === cur.ad && r.metric < cur.metric)) best[k] = r;
        else if (r.ad === cur.ad && r.metric === cur.metric && r.code === cur.code && r.code !== 'C' && r.code !== 'L') cur.hops = cur.hops.concat(r.hops);
      });
      // a default static route is the gateway of last resort
      Object.values(best).forEach(r => { if (r.code === 'S' && r.prefix === 0) r.code = 'S*'; });
      return Object.values(best);
    }
    function lookup(rib, ipLong) {
      let b = null;
      rib.forEach(r => {
        const mask = r.prefix === 0 ? 0 : (0xFFFFFFFF << (32 - r.prefix)) >>> 0;
        if (((ipLong & mask) >>> 0) === r.net) {
          if (r.code === 'L' && r.net !== ipLong) return;
          if (!b || r.prefix > b.prefix) b = r;
        }
      });
      return b;
    }
    function owns(dev, ip) {
      return Object.values(dev.config.interfaces).some(i => i.ip === ip && ifUp(i));
    }
    function resolveHop(sim, dev, destIp) {
      if (owns(dev, destIp) || destIp === '127.0.0.1') return { kind: 'local' };
      const rib = ribOf(sim, dev);
      const e = lookup(rib, ipToLong(destIp));
      if (!e || e.code === 'L') return { kind: 'none' };
      const h = e.hops[0];
      if (e.code === 'C' || e.direct) {
        const owner = neighborsOf(sim, dev, h.intf).find(n => n.intf.ip === destIp);
        if (!owner) return { kind: 'arpfail', intf: h.intf };
        return { kind: 'direct', intf: h.intf, nbr: owner, nh: destIp };
      }
      if (!h.nbr) return { kind: 'arpfail', intf: h.intf };
      return { kind: 'via', intf: h.intf, nbr: h.nbr, nh: h.nh };
    }
    function tracePath(sim, srcDev, destIp) {
      let cur = srcDev; const hops = []; let firstIntf = null;
      for (let ttl = 0; ttl < 30; ttl++) {
        const r = resolveHop(sim, cur, destIp);
        if (r.kind === 'local') return { ok: true, hops, firstIntf, destDev: cur };
        if (ttl > 0 && !forwarding(cur)) return { ok: false, hops, reason: 'unreach', at: cur };
        if (r.kind === 'none') return { ok: false, hops, reason: ttl === 0 ? 'noroute' : 'unreach', at: cur };
        if (r.kind === 'arpfail') return { ok: false, hops, reason: 'arpfail', at: cur };
        if (ttl === 0) firstIntf = r.intf;
        hops.push({ dev: r.nbr.dev, inIntf: r.nbr.intf, nh: r.nh });
        cur = r.nbr.dev;
      }
      return { ok: false, hops, reason: 'ttl', at: cur };
    }
    function pingEval(sim, s, ip) {
      if (owns(s, ip) || ip === '127.0.0.1') return { code: '!!!!!', rate: 100, local: true, hops: 0 };
      const fw = tracePath(sim, s, ip);
      if (!fw.ok) return { code: fw.reason === 'unreach' ? 'U.U.U' : '.....', rate: 0, hops: fw.hops.length, fw };
      const srcIp = fw.firstIntf ? fw.firstIntf.ip : null;
      if (srcIp) {
        const back = tracePath(sim, fw.destDev, srcIp);
        if (!back.ok) return { code: '.....', rate: 0, hops: fw.hops.length, fw };
      }
      return { code: '!!!!!', rate: 100, hops: fw.hops.length, fw };
    }

    SIM.simulatePing = function (s, targetIp) {
      const ip = (targetIp || '').trim();
      if (!ip) { s.addLog('error', '% Incomplete command.'); this.refreshScreen(); return; }
      if (!validIp(ip)) {
        s.addLog('error', '% Unrecognized host or address, or protocol not running.');
        this.refreshScreen(); return;
      }
      const r = pingEval(this, s, ip);
      const head = 'Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ' + ip + ', timeout is 2 seconds:\n';
      if (r.rate === 0) {
        s.addLog('output', head + r.code + '\nSuccess rate is 0 percent (0/5)');
      } else if (r.local) {
        s.addLog('output', head + '!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/1/1 ms');
      } else {
        const nhKey = r.fw.hops[0] ? r.fw.hops[0].nh : ip;
        const first = !s.arpCache[nhKey];
        if (first) {
          const nb = r.fw.hops[0];
          s.arpCache[nhKey] = { mac: ifMac(this, nb.dev, nb.inIntf), interface: r.fw.firstIntf.name, age: 0 };
        }
        const h = r.hops;
        const rt = ' round-trip min/avg/max = ' + h + '/' + (h + 1) + '/' + (h + 3) + ' ms';
        s.addLog('output', head + (first ? '.!!!!\nSuccess rate is 80 percent (4/5),' : '!!!!!\nSuccess rate is 100 percent (5/5),') + rt);
        const dd = r.fw.hops.length ? r.fw.hops[r.fw.hops.length - 1].dev : null;
        if (dd && r.fw.firstIntf && !dd.arpCache[r.fw.firstIntf.ip] && r.fw.hops.length === 1) {
          dd.arpCache[r.fw.firstIntf.ip] = { mac: ifMac(this, s, r.fw.firstIntf), interface: r.fw.hops[0].inIntf.name, age: 0 };
        }
      }
      this.refreshScreen();
    };

    // ---------- spanning tree ----------
    function bw(i) { return /^(GigabitEthernet|TenGigabitEthernet)/.test(i.name) ? 1000 : (/^FastEthernet/.test(i.name) ? 100 : 10); }
    function stpCost(mbps) { return mbps >= 10000 ? 2 : mbps >= 1000 ? 4 : mbps >= 100 ? 19 : mbps >= 10 ? 100 : 250; }
    function stpPrio(dev, v) {
      const sp = dev.config.spanningTree || {};
      return (sp.vlans && sp.vlans[v] && sp.vlans[v].priority != null) ? sp.vlans[v].priority : 32768;
    }
    function stpVlans(sim, dev) {
      const set = new Set();
      Object.values(dev.config.interfaces).forEach(i => {
        if (!isPhysical(i.name) || isSub(i.name) || i.isRouted || !physUp(sim, dev, i)) return;
        const vs = i.mode === 'trunk' ? Array.from(trunkSet(i)) : [parseInt(i.accessVlan || '1', 10)];
        vs.forEach(v => { if (v === 1 || dev.config.vlans[String(v)]) set.add(v); });
      });
      return Array.from(set).sort((a, b) => a - b);
    }
    function stpCompute(sim, v) {
      const sw = Object.values(sim.devices).filter(d => isSwitchDev(d) && stpVlans(sim, d).indexOf(v) >= 0);
      const info = {};
      sw.forEach(d => { info[d.hostname] = { dev: d, id: [stpPrio(d, v) + v, bridgeMac(sim, d)], ports: [] }; });
      // edges (aggregate port-channel members)
      const edgeMap = {};
      sw.forEach(d => {
        Object.values(d.config.interfaces).forEach(i => {
          if (!isPhysical(i.name) || isSub(i.name) || i.isRouted || !physUp(sim, d, i) || !carriesEff(d, i, v)) return;
          const p = peerOf(sim, i);
          if (!p || p.host || !p.intf || !info[p.dev.hostname]) return;
          if (!carriesEff(p.dev, p.intf, v)) return;
          const gA = i.channelGroup ? 'Po' + i.channelGroup.id : i.name;
          const gB = p.intf.channelGroup ? 'Po' + p.intf.channelGroup.id : p.intf.name;
          const A = d.hostname + ':' + gA, B = p.dev.hostname + ':' + gB;
          const key = A < B ? A + '|' + B : B + '|' + A;
          if (!edgeMap[key]) edgeMap[key] = { a: { dev: d, port: gA }, b: { dev: p.dev, port: gB }, bw: 0 };
          const e = edgeMap[key];
          if (e.a.dev === d && e.a.port === gA) e.bw += bw(i);
        });
      });
      const edges = Object.values(edgeMap);
      edges.forEach(e => {
        e.cost = stpCost(e.bw);
        e.a.num = portNum(e.a.dev, e.a.port.indexOf('Po') === 0 ? 'Port-channel' + e.a.port.slice(2) : e.a.port);
        e.b.num = portNum(e.b.dev, e.b.port.indexOf('Po') === 0 ? 'Port-channel' + e.b.port.slice(2) : e.b.port);
      });
      const cmp = (x, y) => x[0] !== y[0] ? x[0] - y[0] : (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0);
      // components
      const comp = {}; let cid = 0;
      sw.forEach(d => {
        if (comp[d.hostname] !== undefined) return;
        const q = [d.hostname]; comp[d.hostname] = cid;
        while (q.length) {
          const h = q.shift();
          edges.forEach(e => {
            const o = e.a.dev.hostname === h ? e.b.dev.hostname : (e.b.dev.hostname === h ? e.a.dev.hostname : null);
            if (o && comp[o] === undefined) { comp[o] = cid; q.push(o); }
          });
        }
        cid++;
      });
      for (let c = 0; c < cid; c++) {
        const members = sw.filter(d => comp[d.hostname] === c).map(d => info[d.hostname]);
        let root = members[0];
        members.forEach(m => { if (cmp(m.id, root.id) < 0) root = m; });
        members.forEach(m => { m.root = root; m.cost = m === root ? 0 : Infinity; m.rootPort = null; });
        let ch = true, g = 0;
        while (ch && g++ < 50) {
          ch = false;
          edges.forEach(e => {
            [[e.a, e.b], [e.b, e.a]].forEach(([me, nb]) => {
              const m = info[me.dev.hostname], n = info[nb.dev.hostname];
              if (m === root || comp[me.dev.hostname] !== c) return;
              if (n.cost === Infinity) return;
              const nc = n.cost + e.cost;
              const better = nc < m.cost ||
                (nc === m.cost && m.rootPort && (cmp(n.id, m.rootPort.nbrId) < 0 || (cmp(n.id, m.rootPort.nbrId) === 0 && nb.num < m.rootPort.nbrNum)));
              if (better) { m.cost = nc; m.rootPort = { port: me.port, nbrId: n.id, nbrNum: nb.num, edge: e, nbrDev: nb.dev }; ch = true; }
            });
          });
        }
      }
      // port roles
      edges.forEach(e => {
        const ma = info[e.a.dev.hostname], mb = info[e.b.dev.hostname];
        const va = [ma.cost, ma.id[0], ma.id[1], e.a.num], vb = [mb.cost, mb.id[0], mb.id[1], e.b.num];
        const less = (x, y) => { for (let k = 0; k < 4; k++) { if (x[k] < y[k]) return true; if (x[k] > y[k]) return false; } return false; };
        const aDesg = less(va, vb);
        [[e.a, ma, aDesg], [e.b, mb, !aDesg]].forEach(([end, m, desg]) => {
          let role;
          if (m.rootPort && m.rootPort.edge === e && m.rootPort.port === end.port) role = 'Root';
          else role = desg ? 'Desg' : 'Altn';
          m.ports.push({ name: end.port, role, sts: role === 'Altn' ? 'BLK' : 'FWD', cost: e.cost, num: end.num });
        });
      });
      // edge ports toward routers/hosts
      sw.forEach(d => {
        Object.values(d.config.interfaces).forEach(i => {
          if (!isPhysical(i.name) || isSub(i.name) || i.isRouted || !physUp(sim, d, i) || !carriesEff(d, i, v) || i.channelGroup) return;
          const p = peerOf(sim, i);
          const toSwitch = p && !p.host && p.intf && info[p.dev.hostname] && carriesEff(p.dev, p.intf, v);
          if (toSwitch) return;
          info[d.hostname].ports.push({ name: i.name, role: 'Desg', sts: 'FWD', cost: stpCost(bw(i)), num: portNum(d, i.name), edge: !!i.portfast });
        });
      });
      return info;
    }
    function showSpanningTree(sim, s, vlanArg) {
      const rapid = (s.config.spanningTree.mode || 'pvst') === 'rapid-pvst';
      const vlans = stpVlans(sim, s).filter(v => vlanArg == null || v === vlanArg);
      if (!vlans.length) return vlanArg != null ? 'Spanning tree instance(s) for vlan ' + vlanArg + ' does not exist.' : '';
      const out = [];
      vlans.forEach(v => {
        const info = stpCompute(sim, v); const me = info[s.hostname];
        if (!me) return;
        const root = me.root;
        out.push('VLAN' + String(v).padStart(4, '0'));
        out.push('  Spanning tree enabled protocol ' + (rapid ? 'rstp' : 'ieee'));
        out.push('  Root ID    Priority    ' + root.id[0]);
        out.push('             Address     ' + root.id[1]);
        if (root === me) {
          out.push('             This bridge is the root');
        } else {
          out.push('             Cost        ' + me.cost);
          const rp = me.rootPort;
          const nm = rp.port.indexOf('Po') === 0 ? 'Port-channel' + rp.port.slice(2) : rp.port;
          out.push('             Port        ' + portNum(s, nm) + ' (' + nm + ')');
        }
        out.push('             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec');
        out.push('');
        out.push('  Bridge ID  Priority    ' + me.id[0] + '  (priority ' + (me.id[0] - v) + ' sys-id-ext ' + v + ')');
        out.push('             Address     ' + me.id[1]);
        out.push('             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec');
        out.push('             Aging Time  300 sec');
        out.push('');
        out.push('Interface           Role Sts Cost      Prio.Nbr Type');
        out.push('------------------- ---- --- --------- -------- --------------------------------');
        me.ports.sort((a, b) => a.num - b.num).forEach(p => {
          out.push(pad(shortName(p.name), 19) + ' ' + pad(p.role, 4) + ' ' + p.sts + ' ' + pad(p.cost, 9) + ' ' + pad('128.' + p.num, 8) + ' ' + (p.edge ? 'P2p Edge' : 'P2p'));
        });
        out.push('');
      });
      return out.join('\n').replace(/\n+$/, '');
    }

    // ---------- show helpers ----------
    function resolveIfName(sim, s, tokens) {
      const raw = tokens.join('');
      const n = sim.normalizeInterface(raw);
      return s.config.interfaces[n] ? s.config.interfaces[n] : null;
    }
    function ifaceBlock(sim, s, i) {
      const n = i.name;
      const status = i.status === 'administratively down' ? 'administratively down' : i.status;
      const stateTxt = (n && isPhysical(n) && !isSub(n) && i.status === 'down' && !i.shutdown) ? ' (notconnect)' : (ifUp(i) && isPhysical(n) && !isSub(n) ? ' (connected)' : '');
      const mac = ifMac(sim, s, i);
      const lines = [];
      lines.push(n + ' is ' + status + ', line protocol is ' + i.protocol + (isSvi(n) ? '' : stateTxt));
      lines.push('  Hardware is ' + (isSvi(n) ? 'EtherSVI' : isLoop(n) ? 'Loopback' : 'AmdP2') + ', address is ' + mac + ' (bia ' + mac + ')');
      if (i.description) lines.push('  Description: ' + i.description);
      if (i.ip && i.mask) lines.push('  Internet address is ' + i.ip + '/' + maskToPrefix(i.mask));
      lines.push('  MTU 1500 bytes, BW ' + (bw(i) * 1000) + ' Kbit/sec, DLY ' + (bw(i) >= 1000 ? 10 : 1000) + ' usec,');
      lines.push('     reliability 255/255, txload 1/255, rxload 1/255');
      lines.push('  Encapsulation ' + (i.dot1qVlan ? '802.1Q Virtual LAN, Vlan ID ' + i.dot1qVlan : 'ARPA') + ', loopback not set');
      lines.push('  Keepalive set (10 sec)');
      if (isPhysical(n)) lines.push('  ' + (i.speed && i.speed !== 'auto' ? 'Full-duplex, ' + i.speed + 'Mb/s' : 'Auto-duplex, Auto-speed') + ', media type is RJ45');
      lines.push('  ARP type: ARPA, ARP Timeout 04:00:00');
      lines.push('  Last input never, output never, output hang never');
      lines.push('  Last clearing of "show interface" counters never');
      lines.push('  Input queue: 0/75/0/0 (size/max/drops/flushes); Total output drops: 0');
      lines.push('  Queueing strategy: fifo');
      lines.push('  5 minute input rate 0 bits/sec, 0 packets/sec');
      lines.push('  5 minute output rate 0 bits/sec, 0 packets/sec');
      return lines.join('\n');
    }
    function switchportBlock(sim, s, i) {
      const trunk = i.mode === 'trunk';
      const opTrunk = trunk && ifUp(i);
      const L = [];
      L.push('Name: ' + shortName(i.name));
      L.push('Switchport: Enabled');
      L.push('Administrative Mode: ' + (trunk ? 'trunk' : 'static access'));
      L.push('Operational Mode: ' + (opTrunk ? 'trunk' : (ifUp(i) ? 'static access' : 'down')));
      L.push('Administrative Trunking Encapsulation: dot1q');
      L.push('Operational Trunking Encapsulation: ' + (opTrunk ? 'dot1q' : 'native'));
      L.push('Negotiation of Trunking: ' + (trunk ? 'Off' : 'Off'));
      L.push('Access Mode VLAN: ' + (i.accessVlan || '1') + (String(i.accessVlan || '1') === '1' ? ' (default)' : ' (' + (s.config.vlans[i.accessVlan] || 'VLAN' + String(i.accessVlan).padStart(4, '0')) + ')'));
      L.push('Trunking Native Mode VLAN: ' + (i.nativeVlan || '1') + (String(i.nativeVlan || '1') === '1' ? ' (default)' : ''));
      L.push('Administrative Native VLAN tagging: enabled');
      L.push('Voice VLAN: ' + (i.voiceVlan || 'none'));
      L.push('Administrative private-vlan host-association: none');
      L.push('Operational private-vlan: none');
      const ts = trunkSet(i);
      L.push('Trunking VLANs Enabled: ' + (ts.size >= 4094 ? 'ALL' : formatVlanSet(ts)));
      L.push('Pruning VLANs Enabled: 2-1001');
      L.push('Capture Mode Disabled');
      L.push('Protected: false');
      L.push('Appliance trust: none');
      return L.join('\n');
    }
    function cdpTable(sim, s, kind) {
      const rows = [];
      Object.values(s.config.interfaces).forEach(i => {
        if (!isPhysical(i.name) || isSub(i.name) || !ifUp(i)) return;
        const p = peerOf(sim, i);
        if (!p || p.host || !p.intf) return;
        if (kind === 'cdp') {
          if (s.config.cdpRun === false || p.dev.config.cdpRun === false || i.cdp === false || p.intf.cdp === false) return;
        } else {
          if (!s.config.lldpRun || !p.dev.config.lldpRun) return;
          if ((i.lldp && i.lldp.tx === false) || (p.intf.lldp && p.intf.lldp.rx === false)) return;
        }
        rows.push({ i, p });
      });
      return rows;
    }
    function showCdp(sim, s, kind, detail) {
      if (kind === 'cdp' && s.config.cdpRun === false) return '% CDP is not enabled';
      if (kind === 'lldp' && !s.config.lldpRun) return '% LLDP is not enabled';
      const rows = cdpTable(sim, s, kind);
      if (kind === 'cdp') {
        const out = ['Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge', '                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone,', '                  D - Remote, C - CVTA, M - Two-port Mac Relay ', '', 'Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID'];
        rows.forEach(r => {
          const d = r.p.dev; const router = d.type === 'router';
          out.push(pad(realName(d), 16) + ' ' + pad(shortName(r.i.name).replace(/^(\D+)/, '$1 '), 17).replace(/^(Et|Gi|Fa) /, m => m.replace('Et', 'Eth').replace('Gi', 'Gig').replace('Fa', 'Fas')) + ' ' + pad(150 + (r.i.name.length % 20), 10) + ' ' + pad(router ? 'R B' : 'R S I', 11) + ' ' + pad(router ? 'Linux Uni' : 'Linux Uni', 9) + ' ' + shortName(r.p.intf.name).replace(/^(Et|Gi|Fa)/, m => m === 'Et' ? 'Eth ' : (m === 'Gi' ? 'Gig ' : 'Fas ')));
        });
        out.push('');
        out.push('Total cdp entries displayed : ' + rows.length);
        return out.join('\n');
      }
      const out = ['Capability codes:', '    (R) Router, (B) Bridge, (T) Telephone, (C) DOCSIS Cable Device', '    (W) WLAN Access Point, (P) Repeater, (S) Station, (O) Other', '', 'Device ID           Local Intf     Hold-time  Capability      Port ID'];
      rows.forEach(r => {
        const d = r.p.dev;
        out.push(pad(realName(d), 19) + ' ' + pad(shortName(r.i.name), 14) + ' ' + pad(120, 10) + ' ' + pad(d.type === 'router' ? 'R' : 'B,R', 15) + ' ' + shortName(r.p.intf.name));
      });
      out.push('');
      out.push('Total entries displayed: ' + rows.length);
      return out.join('\n');
    }
    function groupRoute(rib, filterCode) {
      const sorted = rib.filter(r => r.code !== 'L' || true).slice().sort((a, b) => a.net - b.net || a.prefix - b.prefix);
      let lines = []; const groups = {};
      sorted.forEach(r => {
        if (filterCode && !(r.code[0] === filterCode)) return;
        const first = r.net >>> 24; const cls = first < 128 ? 8 : first < 192 ? 16 : 24;
        const cmask = (0xFFFFFFFF << (32 - cls)) >>> 0;
        const key = ((r.net & cmask) >>> 0);
        (groups[key] = groups[key] || { cls, list: [] }).list.push(r);
      });
      const fmt = (r, w) => {
        const p = longToIp(r.net) + '/' + r.prefix;
        const h = r.hops[0];
        let tail;
        if (r.code === 'C' || r.code === 'L' || r.direct) tail = p + ' is directly connected, ' + h.intf.name;
        else if (r.code === 'O' || r.code === 'O*E2') tail = p + ' [110/' + r.metric + '] via ' + h.nh + ', 00:00:' + String(10 + (r.metric % 40)).padStart(2, '0') + ', ' + h.intf.name;
        else tail = p + ' [' + r.ad + '/' + r.metric + '] via ' + h.nh;
        return pad(r.code, w) + tail;
      };
      Object.keys(groups).map(Number).sort((a, b) => a - b).forEach(k => {
        const g = groups[k];
        if (g.list.length === 1 && g.list[0].prefix === 0) { lines.push(fmt(g.list[0], 6)); return; }
        const masks = new Set(g.list.map(r => r.prefix));
        const cn = longToIp(k) + '/' + g.cls;
        if (masks.size > 1 || g.list.length > 1 && masks.size > 1) lines.push('      ' + cn + ' is variably subnetted, ' + g.list.length + ' subnets, ' + masks.size + ' masks');
        else lines.push('      ' + cn + ' is subnetted, ' + g.list.length + ' subnets');
        g.list.forEach(r => lines.push(fmt(r, 9)));
      });
      return lines;
    }
    function showIpRoute(sim, s, args) {
      if (!forwarding(s)) {
        const gw = s.config.defaultGateway;
        return (gw ? 'Default gateway is ' + gw : 'Default gateway is not set') + '\n\nHost               Gateway           Last Use    Total Uses  Interface\nICMP redirect cache is empty';
      }
      const rib = ribOf(sim, s);
      const codes = ['Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP', '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area ', '       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2', '       E1 - OSPF external type 1, E2 - OSPF external type 2', '       i - IS-IS, su - IS-IS summary, L1 - IS-IS level-1, L2 - IS-IS level-2', '       ia - IS-IS inter area, * - candidate default, U - per-user static route', '       o - ODR, P - periodic downloaded static route, H - NHRP, l - LISP', '       a - application route', '       + - replicated route, % - next hop override'];
      let filter = null;
      const a0 = (args[0] || '').toLowerCase();
      if (a0 && validIp(args[0])) {
        const e = lookup(rib, ipToLong(args[0]));
        if (!e) return '% Network not in table';
        return 'Routing entry for ' + longToIp(e.net) + '/' + e.prefix + '\n  Known via "' + ({ C: 'connected', L: 'local', S: 'static', 'S*': 'static', O: 'ospf 1', 'O*E2': 'ospf 1' }[e.code]) + '", distance ' + e.ad + ', metric ' + e.metric;
      }
      if (a0) filter = ({ ospf: 'O', static: 'S', connected: 'C' })[a0];
      if (a0 && !filter) return null;
      const out = codes.slice();
      out.push('');
      const def = rib.find(r => r.prefix === 0);
      if (def && def.hops[0].nh) out.push('Gateway of last resort is ' + def.hops[0].nh + ' to network 0.0.0.0'); else out.push('Gateway of last resort is not set');
      out.push('');
      const body = groupRoute(rib, filter);
      return out.concat(body).join('\n');
    }
    function showOspfNeighbor(sim, s) {
      const edges = ospfAdj(sim).filter(e => e.x.dev === s);
      if (!edges.length) return '';
      const roles = ospfRoles(sim, ospfAdj(sim));
      const out = ['Neighbor ID     Pri   State           Dead Time   Address         Interface'];
      edges.forEach(e => {
        const myRole = roles[e.x.dev.hostname + '#' + e.x.intf.name];
        const nbRole = roles[e.y.dev.hostname + '#' + e.y.intf.name];
        let st;
        if (nbRole === 'P2P') st = 'FULL/  -';
        else if (myRole === 'DROTHER' && nbRole === 'DROTHER') st = '2WAY/DROTHER';
        else st = 'FULL/' + nbRole;
        const pri = (e.y.intf.ospf && e.y.intf.ospf.priority != null) ? e.y.intf.ospf.priority : 1;
        out.push(pad(routerId(e.y.dev), 15) + ' ' + pad(pri, 5) + ' ' + pad(st, 15) + ' 00:00:3' + (e.y.intf.name.length % 9) + '    ' + pad(e.y.intf.ip, 15) + ' ' + e.x.intf.name);
      });
      return out.join('\n');
    }
    function showOspfIntBrief(sim, s) {
      const adj = ospfAdj(sim); const roles = ospfRoles(sim, adj);
      const pid = (s.config.ospf && s.config.ospf.id) || 1;
      const out = ['Interface    PID   Area            IP Address/Mask    Cost  State Nbrs F/C'];
      Object.values(s.config.interfaces).forEach(i => {
        const area = ospfAreaOf(s, i);
        if (area === null || !i.ip) return;
        const nb = adj.filter(e => e.x.intf === i).length;
        let st = ospfPassive(s, i) ? 'DROTH' : 'DOWN';
        if (!ospfPassive(s, i) && ifUp(i)) { const r = roles[s.hostname + '#' + i.name]; st = r === 'DROTHER' ? 'DROTH' : (r || 'DOWN'); if (isLoop(i.name)) st = 'LOOP'; if (r === undefined && nb === 0) st = isLoop(i.name) ? 'LOOP' : 'DR'; }
        out.push(pad(shortName(i.name), 12) + ' ' + pad(pid, 5) + ' ' + pad(area, 15) + ' ' + pad(i.ip + '/' + maskToPrefix(i.mask), 18) + ' ' + pad(ospfCost(i), 5) + ' ' + pad(st, 5) + ' ' + nb + '/' + nb);
      });
      return out.join('\n');
    }
    function showIpArp(sim, s) {
      const out = ['Protocol  Address          Age (min)  Hardware Addr   Type   Interface'];
      Object.values(s.config.interfaces).forEach(i => {
        if (i.ip && ifUp(i)) out.push('Internet  ' + pad(i.ip, 16) + ' ' + pad('-', 10) + ' ' + pad(ifMac(sim, s, i), 15) + ' ARPA   ' + i.name);
      });
      Object.keys(s.arpCache).forEach(ip => {
        const e = s.arpCache[ip];
        out.push('Internet  ' + pad(ip, 16) + ' ' + pad(e.age === '-' ? 0 : (e.age || 0), 10) + ' ' + pad(e.mac, 15) + ' ARPA   ' + e.interface);
      });
      return out.join('\n');
    }
    function showVlanBrief(sim, s) {
      const out = ['VLAN Name                             Status    Ports', '---- -------------------------------- --------- -------------------------------'];
      const vids = Object.keys(s.config.vlans || {}).map(Number).sort((a, b) => a - b);
      vids.forEach(vid => {
        let nm = s.config.vlans[String(vid)];
        if (!nm || nm === 'VLAN' || nm === String(vid)) nm = vid === 1 ? 'default' : 'VLAN' + String(vid).padStart(4, '0');
        const ports = Object.values(s.config.interfaces).filter(i => isPhysical(i.name) && !isSub(i.name) && !i.isRouted && i.mode !== 'trunk' && !i.channelGroup && String(i.accessVlan || '1') === String(vid)).map(i => shortName(i.name));
        const pl = [];
        let cur = '';
        ports.forEach(p => { const nx = cur ? cur + ', ' + p : p; if (nx.length > 31 && cur) { pl.push(cur + ','); cur = p; } else cur = nx; });
        if (cur) pl.push(cur);
        out.push(pad(vid, 4) + ' ' + pad(nm, 32) + ' ' + pad('active', 9) + ' ' + (pl[0] || ''));
        for (let k = 1; k < pl.length; k++) out.push(pad('', 48) + pl[k]);
      });
      [['1002', 'fddi-default'], ['1003', 'token-ring-default'], ['1004', 'fddinet-default'], ['1005', 'trnet-default']].forEach(r => out.push(pad(r[0], 4) + ' ' + pad(r[1], 32) + ' act/unsup'));
      return out.join('\n');
    }
    function showMacTable(sim, s) {
      const out = ['          Mac Address Table', '-------------------------------------------', '', 'Vlan    Mac Address       Type        Ports', '----    -----------       --------    -----'];
      let n = 0;
      Object.values(s.config.interfaces).forEach(i => {
        if (!isPhysical(i.name) || isSub(i.name) || i.isRouted || !ifUp(i)) return;
        const p = peerOf(sim, i);
        if (!p || p.host || !p.intf) return;
        const v = i.mode === 'trunk' ? parseInt(i.nativeVlan || '1', 10) : parseInt(i.accessVlan || '1', 10);
        out.push(pad(v, 7) + ' ' + pad(ifMac(sim, p.dev, p.intf), 17) + ' ' + pad('DYNAMIC', 11) + ' ' + shortName(i.name));
        n++;
      });
      out.push('Total Mac Addresses for this criterion: ' + n);
      return out.join('\n');
    }
    function extractIfaceRun(full, name) {
      const lines = full.split('\n'); const out = []; let on = false;
      for (const l of lines) {
        if (l === 'interface ' + name) { on = true; out.push(l); continue; }
        if (on) { if (l === '!') { out.push(l); break; } out.push(l); }
      }
      return out;
    }
    function captureRaw(sim, s, parts) {
      const n = s.logs.length;
      rawShow.call(sim, s, parts, null);
      const added = s.logs.splice(n);
      return added.map(x => x.text).join('\n');
    }

    // ---------- invalid input / caret reporting ----------
    const SHOW_KW = ['access-lists', 'arp', 'cdp', 'clock', 'etherchannel', 'flash', 'history', 'interfaces', 'ip', 'ipv6', 'lldp', 'logging', 'mac', 'ntp', 'port-security', 'running-config', 'sessions', 'spanning-tree', 'standby', 'startup-config', 'users', 'version', 'vlan', 'vtp'];
    function caretMsg(sim, s, rawCmd, token, fromIdx) {
      const idx = rawCmd.indexOf(token, fromIdx || 0);
      const off = s.getPrompt().length + 1 + Math.max(0, idx);
      return ' '.repeat(off) + '^\n% Invalid input detected at \'^\' marker.';
    }
    SIM.reportInvalid = function (s, rawCmd) {
      const trimmed = String(rawCmd).trim();
      const doM = trimmed.match(/^do\s+/i);
      const body = doM ? trimmed.slice(doM[0].length) : trimmed;
      const parts = body.split(/\s+/).filter(Boolean);
      const baseOff = doM ? doM[0].length : 0;
      const modeKey = doM ? 'priv' : s.mode;
      const root = (ROOT_COMMANDS[modeKey] || ROOT_COMMANDS['user']).map(c => c.cmd);
      const t0 = parts[0].toLowerCase();
      const cands = root.filter(c => c.indexOf(t0) === 0);
      if (!cands.length) { s.addLog('error', caretMsg(this, s, trimmed, parts[0], baseOff)); return; }
      if (cands.length > 1 && cands.indexOf(t0) < 0) { s.addLog('error', '% Ambiguous command:  "' + parts[0] + '"'); return; }
      // walk subtree
      const walk = [norm(cands[0], modeKey)];
      let pos = baseOff + parts[0].length;
      for (let k = 1; k < parts.length; k++) {
        const key = walk.join(' ');
        const sub = SUB_TREES[key];
        if (!sub) { s.addLog('error', caretMsg(this, s, trimmed, parts[k], pos)); return; }
        const t = parts[k].toLowerCase();
        const words = sub.map(x => x.cmd).filter(c => !/^[<A-Z]/.test(c));
        const m = words.filter(c => c.indexOf(t) === 0);
        const hasWild = sub.some(x => /^[<A-Z]/.test(x.cmd));
        if (m.length === 1 || (m.length > 1 && m.indexOf(t) >= 0)) { walk.push(m.indexOf(t) >= 0 ? t : m[0]); }
        else if (m.length > 1) { s.addLog('error', '% Ambiguous command:  "' + trimmed + '"'); return; }
        else if (hasWild) { walk.push(parts[k]); }
        else { s.addLog('error', caretMsg(this, s, trimmed, parts[k], pos)); return; }
        pos = trimmed.indexOf(parts[k], pos) + parts[k].length;
      }
      s.addLog('error', '% Incomplete command.');
    };

    // ---------- interface target helpers ----------
    function targetsOf(sim, s) {
      const list = [];
      if (s.mode === 'config-if-range' && s.context && s.context.range) {
        const m = s.context.range.match(/([a-zA-Z]+)\s*(\d+)\/(\d+)\s*-\s*(\d+)/);
        if (m) for (let k = +m[3]; k <= +m[4]; k++) { const nm = sim.normalizeInterface(m[1] + m[2] + '/' + k); if (s.config.interfaces[nm]) list.push(s.config.interfaces[nm]); }
      } else if ((s.mode === 'config-if' || s.mode === 'config-subif') && s.context && s.context.name && s.config.interfaces[s.context.name]) {
        list.push(s.config.interfaces[s.context.name]);
      }
      return list;
    }
    function ensureVlan(s, v) {
      const k = String(v);
      if (!s.config.vlans[k]) { s.config.vlans[k] = 'VLAN' + k.padStart(4, '0'); return true; }
      return false;
    }

    // ---------- the new command wrapper ----------
    SIM.initDevices = function (o) {
      rawInit.call(this, o);
      Object.values(this.devices).forEach(d => {
        d.config.lldpRun = false;
        if (d.type === 'router') Object.values(d.config.interfaces).forEach(i => { if (isPhysical(i.name) && !i.connected) i.shutdown = true; });
      });
      reconcile(this, true);
    };

    SIM.executeCommand = function (rawCmd) {
      const s = this.getActiveSession();
      if (!s) return;
      const trimmed = String(rawCmd == null ? '' : rawCmd).trim();
      const done = () => { reconcile(this); this.refreshScreen(); };
      if (!trimmed || trimmed.endsWith('?') || /^ctrl\+/i.test(trimmed)) { rawExec.call(this, rawCmd); reconcile(this); this.refreshScreen(); return; }

      let cmd = trimmed; let viaDo = false;
      if (/^do\s+/i.test(cmd) && s.mode.startsWith('config')) { cmd = cmd.replace(/^do\s+/i, ''); viaDo = true; }
      let pipe = null;
      const pIdx = cmd.indexOf('|');
      if (pIdx >= 0) { pipe = cmd.slice(pIdx + 1).trim(); cmd = cmd.slice(0, pIdx).trim(); }
      const parts = cmd.split(/\s+/).filter(Boolean);
      const lower = cmd.toLowerCase();
      const p0 = (parts[0] || '').toLowerCase();
      const p1 = (parts[1] || '').toLowerCase();
      const p2 = (parts[2] || '').toLowerCase();
      const execLike = viaDo || s.mode === 'user' || s.mode === 'priv';
      const echo = () => s.addLog('input', s.getPrompt() + ' ' + rawCmd);
      const out = text => { s.addLog('output', pipe ? applyPipeFilter(text, pipe) : text); };

      // ===== EXEC-level commands =====
      if (execLike) {
        if (/^(c|co|con)$/i.test(trimmed)) {
          echo();
          s.addLog('error', '% Ambiguous command:  "' + trimmed + '"');
          return done();
        }
        if (matchesPrefix(p0, 'traceroute', 3) || p0 === 'tracert') {
          echo();
          const dest = parts[1];
          if (!dest) { s.addLog('error', '% Incomplete command.'); return done(); }
          if (!validIp(dest)) { s.addLog('error', '% Unrecognized host or address or protocol not running.'); return done(); }
          const r = tracePath(this, s, dest);
          const lines = ['Type escape sequence to abort.', 'Tracing the route to ' + dest, 'VRF info: (vrf in name/id, vrf out name/id)'];
          if (r.ok && r.hops.length === 0) {
            lines.push('  1 ' + dest + ' 1 msec 1 msec 1 msec');
          }
          r.hops.forEach((h, k) => {
            const last = k === r.hops.length - 1 && r.ok;
            lines.push('  ' + (k + 1) + ' ' + (last ? dest : h.inIntf.ip) + ' ' + (k + 1) + ' msec ' + (k + 1) + ' msec ' + (k + 2) + ' msec');
          });
          if (!r.ok) {
            const n0 = r.hops.length;
            if (r.reason === 'unreach' || r.reason === 'noroute') lines.push('  ' + (n0 + 1) + ' ' + (r.at && r.hops.length ? r.hops[n0 - 1].inIntf.ip : (r.at ? (l3Ifs(r.at)[0] || {}).ip || '*' : '*')) + ' !H  !H  !H');
            else for (let k = 1; k <= 3; k++) lines.push('  ' + (n0 + k) + '  *  *  *');
          }
          out(lines.join('\n'));
          return done();
        }
        if (p0 === 'copy' || p0 === 'cop') {
          echo();
          if (parts.length < 3) { s.addLog('error', '% Incomplete command.'); return done(); }
          if (matchesPrefix(p1, 'running-config', 1) && matchesPrefix(p2, 'startup-config', 1)) {
            s.saveToStartup();
            s.addLog('output', 'Destination filename [startup-config]? \nBuilding configuration...\n[OK]');
          } else if (matchesPrefix(p1, 'startup-config', 1) && matchesPrefix(p2, 'running-config', 1)) {
            s.addLog('output', 'Destination filename [running-config]? \n' + (s.config.savedStartupConfig ? '1580 bytes copied in 0.560 secs (2821 bytes/sec)' : '%Error opening nvram:/startup-config (No such file or directory)'));
          } else {
            s.addLog('error', '% Invalid input detected at \'^\' marker.');
          }
          return done();
        }
        if (matchesPrefix(p0, 'show', 2) || p0 === 'sh') {
          const args = parts.slice(1);
          const a0 = (args[0] || '').toLowerCase(), a1 = (args[1] || '').toLowerCase(), a2 = (args[2] || '').toLowerCase();
          let text = null;
          if (matchesPrefix(a0, 'ip', 2) && matchesPrefix(a1, 'route', 3)) text = showIpRoute(this, s, args.slice(2));
          else if (matchesPrefix(a0, 'ip', 2) && matchesPrefix(a1, 'ospf', 2) && matchesPrefix(a2, 'neighbor', 3)) text = showOspfNeighbor(this, s);
          else if (matchesPrefix(a0, 'ip', 2) && matchesPrefix(a1, 'ospf', 2) && matchesPrefix(a2, 'interface', 3)) text = showOspfIntBrief(this, s);
          else if ((matchesPrefix(a0, 'ip', 2) && matchesPrefix(a1, 'arp', 2)) || a0 === 'arp') text = showIpArp(this, s);
          else if (matchesPrefix(a0, 'vlan', 2) && (!a1 || a1 === 'brief' || a1 === 'br')) text = showVlanBrief(this, s);
          else if (a0 === 'mac' || a0 === 'mac-address-table' || (a0 === 'mac' && a1 === 'address-table')) text = showMacTable(this, s);
          else if (matchesPrefix(a0, 'spanning-tree', 2)) {
            if (!a1) text = showSpanningTree(this, s, null);
            else if (a1 === 'vlan' && /^\d+$/.test(args[2] || '')) text = showSpanningTree(this, s, parseInt(args[2], 10));
          }
          else if (a0 === 'cdp') { const nei = !a1 || matchesPrefix(a1, 'neighbors', 3); text = nei ? showCdp(this, s, 'cdp') : (a1 === 'run' ? null : null); if (!a1) text = showCdp(this, s, 'cdp'); }
          else if (a0 === 'lldp') { if (!a1 || matchesPrefix(a1, 'neighbors', 3)) text = showCdp(this, s, 'lldp'); }
          else if (matchesPrefix(a0, 'interfaces', 3) && matchesPrefix(a1, 'switchport', 2)) {
            const list = Object.values(s.config.interfaces).filter(i => isPhysical(i.name) && !isSub(i.name) && !i.isRouted);
            text = list.map(i => switchportBlock(this, s, i)).join('\n\n');
          }
          else if (matchesPrefix(a0, 'interfaces', 3) && a1 && !['status', 'trunk', 'description', 'counters', 'switchport', 'brief'].includes(a1)) {
            const lastArg = (args[args.length - 1] || '').toLowerCase();
            const wantSw = args.length >= 3 && matchesPrefix(lastArg, 'switchport', 2);
            const ifTokens = wantSw ? args.slice(1, -1) : args.slice(1);
            const i = resolveIfName(this, s, ifTokens);
            if (!i) { echo(); s.addLog('error', caretMsg(this, s, rawCmd, args[1], rawCmd.toLowerCase().indexOf(a0) + a0.length)); return done(); }
            text = wantSw ? switchportBlock(this, s, i) : ifaceBlock(this, s, i);
          }
          else if (matchesPrefix(a0, 'interfaces', 3) && !a1) text = Object.values(s.config.interfaces).map(i => ifaceBlock(this, s, i)).join('\n');
          else if (matchesPrefix(a0, 'interfaces', 3) && matchesPrefix(a1, 'description', 1)) {
            const o = ['Interface                      Status         Protocol Description'];
            Object.values(s.config.interfaces).forEach(i => o.push(pad(shortName(i.name), 30) + ' ' + pad(i.status === 'administratively down' ? 'admin down' : i.status, 14) + ' ' + pad(i.protocol, 8) + ' ' + (i.description || '')));
            text = o.join('\n');
          }
          else if (matchesPrefix(a0, 'ip', 2) && matchesPrefix(a1, 'interface', 1) && a2 && !matchesPrefix(a2, 'brief', 1)) {
            const i = resolveIfName(this, s, args.slice(2));
            if (i) text = i.name + ' is ' + i.status + ', line protocol is ' + i.protocol + '\n' + (i.ip ? '  Internet address is ' + i.ip + '/' + maskToPrefix(i.mask) : '  Internet protocol processing disabled') + '\n  Broadcast address is 255.255.255.255\n  MTU is 1500 bytes\n  Helper address is ' + (i.helperAddress || 'not set') + '\n  Directed broadcast forwarding is disabled\n  Outgoing access list is ' + ((i.accessGroup && i.accessGroup.out) || 'not set') + '\n  Inbound  access list is ' + ((i.accessGroup && i.accessGroup.in) || 'not set');
          }
          else if (matchesPrefix(a0, 'running-config', 3) && matchesPrefix(a1, 'interface', 1) && args[2]) {
            const i = resolveIfName(this, s, args.slice(2));
            if (!i) { echo(); s.addLog('error', caretMsg(this, s, rawCmd, args[2], rawCmd.indexOf(args[1]) + args[1].length)); return done(); }
            const block = extractIfaceRun(captureRaw(this, s, ['running-config']), i.name);
            text = 'Building configuration...\n\nCurrent configuration : ' + (block.join('\n').length + 20) + ' bytes\n' + block.join('\n') + '\nend';
          }
          else if (matchesPrefix(a0, 'startup-config', 3)) {
            if (!s.config.savedStartupConfig) text = 'startup-config is not present';
            else {
              const live = s.config; s.config = s.config.savedStartupConfig;
              let body;
              try { body = captureRaw(this, s, ['running-config']); } finally { s.config = live; }
              text = body.replace(/^Building configuration\.\.\.\n\nCurrent configuration : \d+ bytes/, 'Using ' + (body.length) + ' out of 262136 bytes');
            }
          }
          else if (a0 === 'clock') text = '*' + new Date().toUTCString().slice(17, 25) + '.000 UTC ' + new Date().toUTCString().slice(0, 16);
          else if (a0 === 'logging') text = 'Syslog logging: enabled (0 messages dropped, 0 flushes, 0 overruns)\n    Console logging: level debugging\n    Monitor logging: level debugging\n    Buffer logging: disabled\n    Trap logging: level informational';
          else if (a0 === 'flash' || a0 === 'flash:') text = 'Directory of flash:/\n\n    1  -rw-     4414921            <no date>  ' + (s.type === 'router' ? 'c2900-universalk9-mz.SPA.154-3.M2.bin' : 'c2960-lanbasek9-mz.150-2.SE4.bin') + '\n    2  -rw-         616            <no date>  vlan.dat\n\n32514048 bytes total (28098511 bytes free)';
          else if (matchesPrefix(a0, 'ip', 2) && matchesPrefix(a1, 'protocols', 4)) {
            if (!ospfOn(s)) text = '*** IP Routing is NSF aware ***';
            else {
              const o = s.config.ospf || { id: 1, networks: [], passiveInterfaces: [] };
              const pLines = ['*** IP Routing is NSF aware ***', '', 'Routing Protocol is "ospf ' + (o.id || 1) + '"', '  Outgoing update filter list for all interfaces is not set', '  Incoming update filter list for all interfaces is not set', '  Router ID ' + routerId(s), '  Number of areas in this router is 1. 1 normal 0 stub 0 nssa', '  Maximum path: 4', '  Routing for Networks:'];
              (o.networks || []).forEach(n => pLines.push('    ' + n.net + ' ' + n.wildcard + ' area ' + n.area));
              if ((o.passiveInterfaces || []).length) {
                pLines.push('  Passive Interface(s):');
                o.passiveInterfaces.forEach(pi => pLines.push('    ' + pi));
              }
              pLines.push('  Routing Information Sources:');
              pLines.push('    Gateway         Distance      Last Update');
              ospfAdj(this).filter(e => e.x.dev === s).forEach(e => pLines.push('    ' + pad(routerId(e.y.dev), 15) + ' 110           00:00:12'));
              pLines.push('  Distance: (default is 110)');
              text = pLines.join('\n');
            }
          }
          if (text !== null && text !== undefined) { echo(); out(text); return done(); }
          // fall back to the base implementation, then normalise its generic error
          const before = s.logs.length;
          rawExec.call(this, rawCmd);
          const last = s.logs[s.logs.length - 1];
          if (s.logs.length > before && last && last.type === 'output' && /^% Incomplete show command/.test(last.text)) {
            s.logs.pop();
            const t = (args[0] || '').toLowerCase();
            const kwm = SHOW_KW.filter(k => k.indexOf(t) === 0);
            if (!t) s.addLog('error', '% Incomplete command.');
            else if (!kwm.length) s.addLog('error', caretMsg(this, s, trimmed, args[0], trimmed.toLowerCase().indexOf('s')));
            else if (args.length === 1) s.addLog('error', '% Incomplete command.');
            else s.addLog('error', caretMsg(this, s, trimmed, args[1], trimmed.indexOf(args[0]) + args[0].length));
          }
          return done();
        }
      }

      // ===== CONFIG-mode pre-hooks =====
      if (!execLike && s.mode.startsWith('config')) {
        const inIf = s.mode === 'config-if' || s.mode === 'config-if-range' || s.mode === 'config-subif';
        const incomplete = () => { echo(); s.addLog('error', '% Incomplete command.'); return done(); };
        if (p0 === 'no' && parts.length === 1) return incomplete();
        if (matchesPrefix(p0, 'interface', 3) && parts.length === 1) return incomplete();
        if (matchesPrefix(p0, 'hostname', 4) && parts.length === 1) return incomplete();
        if (p0 === 'ip' && parts.length === 1) return incomplete();
        if (s.mode === 'config' && matchesPrefix(p0, 'vlan', 2) && parts.length === 1) return incomplete();
        if (s.mode === 'config' && matchesPrefix(p0, 'router', 3) && parts.length === 1) return incomplete();
        if (p0 === 'ip' && matchesPrefix(p1, 'route', 2) && parts.length < 5) return incomplete();
        if (inIf && p0 === 'ip' && matchesPrefix(p1, 'address', 3) && s.mode === 'config-if' && parts.length < 4 && !(parts[2] || '').toLowerCase().startsWith('dhcp')) return incomplete();
        if (inIf && matchesPrefix(p0, 'description', 3) && parts.length === 1) return incomplete();
        if (inIf && matchesPrefix(p0, 'channel-group', 4) && parts.length === 1) return incomplete();

        // ip address validation (invalid mask, bad mask, overlap)
        if (s.mode === 'config-if' && p0 === 'ip' && matchesPrefix(p1, 'address', 3) && parts.length >= 4 && !p2.startsWith('dhcp')) {
          const intf = s.config.interfaces[s.context && s.context.name];
          const bad = (tok) => { echo(); s.addLog('error', caretMsg(this, s, rawCmd, tok, rawCmd.indexOf(parts[1]) + parts[1].length)); return done(); };
          if (!validIp(parts[2])) return bad(parts[2]);
          if (!validMask(parts[3])) return bad(parts[3]);
          if (intf) {
            const pre = maskToPrefix(parts[3]); const net = netOf(parts[2], parts[3]);
            const bc = (net | (~ipToLong(parts[3]) >>> 0)) >>> 0;
            const il = ipToLong(parts[2]);
            if (pre < 31 && (il === net || il === bc)) { echo(); s.addLog('error', 'Bad mask /' + pre + ' for address ' + parts[2]); return done(); }
            const clash = Object.values(s.config.interfaces).find(o => o !== intf && o.ip && o.mask && !(o.shutdown && false) &&
              (netOf(o.ip, o.mask) === netOf(parts[2], o.mask) || netOf(parts[2], parts[3]) === netOf(o.ip, parts[3])) &&
              Math.min(maskToPrefix(o.mask), pre) <= Math.max(maskToPrefix(o.mask), pre) && (((il & (pre < maskToPrefix(o.mask) ? ipToLong(parts[3]) : ipToLong(o.mask))) >>> 0) === ((ipToLong(o.ip) & (pre < maskToPrefix(o.mask) ? ipToLong(parts[3]) : ipToLong(o.mask))) >>> 0)));
            if (clash) { echo(); s.addLog('error', '% ' + longToIp(netOf(parts[2], parts[3])) + ' overlaps with ' + clash.name); return done(); }
          }
        }

        // ip default-gateway (switch)
        if (s.mode === 'config' && p0 === 'ip' && p1 === 'default-gateway' && parts[2]) {
          echo();
          if (!validIp(parts[2])) s.addLog('error', caretMsg(this, s, rawCmd, parts[2], rawCmd.indexOf(parts[1]) + parts[1].length));
          else s.config.defaultGateway = parts[2];
          return done();
        }
        if (s.mode === 'config' && lower === 'no ip default-gateway') { echo(); s.config.defaultGateway = null; return done(); }

        // spanning-tree vlan <list> priority N | root primary|secondary
        if (matchesPrefix(p0, 'spanning-tree', 4) && p1 === 'vlan' && parts[2] && (p1 !== undefined)) {
          const sp = s.config.spanningTree; sp.vlans = sp.vlans || {};
          const vl = Array.from(parseVlanList(parts[2]));
          if (parts[3] === 'priority' && /^\d+$/.test(parts[4] || '')) {
            echo();
            const pr = parseInt(parts[4], 10);
            if (pr % 4096 !== 0 || pr > 61440) { s.addLog('error', '% Bridge Priority must be in increments of 4096.\n% Allowed values are:\n  0     4096  8192  12288 16384 20480 24576 28672\n  32768 36864 40960 45056 49152 53248 57344 61440'); return done(); }
            vl.forEach(v => { sp.vlans[v] = { priority: pr }; });
            return done();
          }
          if (parts[3] === 'root' && (parts[4] === 'primary' || parts[4] === 'secondary')) {
            echo();
            vl.forEach(v => { sp.vlans[v] = { priority: parts[4] === 'primary' ? 24576 : 28672 }; });
            return done();
          }
        }
        if (matchesPrefix(p0, 'no', 2) && matchesPrefix(p1, 'spanning-tree', 4) && (parts[2] || '').toLowerCase() === 'vlan' && parts[3]) {
          echo(); const sp = s.config.spanningTree; sp.vlans = sp.vlans || {};
          Array.from(parseVlanList(parts[3])).forEach(v => { delete sp.vlans[v]; });
          return done();
        }

        if (inIf) {
          const targets = targetsOf(this, s);
          // switchport trunk allowed vlan
          if (matchesPrefix(p0, 'switchport', 2) && matchesPrefix(p1, 'trunk', 2) && matchesPrefix(p2, 'allowed', 2) && matchesPrefix((parts[3] || '').toLowerCase(), 'vlan', 1)) {
            echo();
            const op = (parts[4] || '').toLowerCase();
            if (!op) { s.addLog('error', '% Incomplete command.'); return done(); }
            let list = parts.slice(op === 'add' || op === 'remove' || op === 'except' ? 5 : 4).join('');
            if (op === 'add' || op === 'remove' || op === 'except') { if (!list) { s.addLog('error', '% Incomplete command.'); return done(); } }
            targets.forEach(t => {
              const cur = trunkSet(t);
              let res;
              if (op === 'all') res = parseVlanList('1-4094');
              else if (op === 'none') res = new Set();
              else if (op === 'add') { res = new Set(cur); parseVlanList(list).forEach(v => res.add(v)); }
              else if (op === 'remove') { res = new Set(cur); parseVlanList(list).forEach(v => res.delete(v)); }
              else if (op === 'except') { res = parseVlanList('1-4094'); parseVlanList(list).forEach(v => res.delete(v)); }
              else res = parseVlanList(list);
              t.trunkAllowed = res.size >= 4094 ? '1-4094' : (res.size ? formatVlanSet(res) : 'none');
              if (t.trunkAllowed === 'none') t.trunkAllowed = '';
            });
            return done();
          }
          if (matchesPrefix(p0, 'no', 2) && matchesPrefix(p1, 'switchport', 2) && matchesPrefix(p2, 'trunk', 2) && matchesPrefix((parts[3] || '').toLowerCase(), 'allowed', 2)) {
            echo(); targets.forEach(t => { t.trunkAllowed = '1-4094'; }); return done();
          }
          // switchport access vlan
          if (matchesPrefix(p0, 'switchport', 2) && matchesPrefix(p1, 'access', 2) && matchesPrefix(p2, 'vlan', 1) && parts.length >= 4) {
            echo();
            if (!/^\d+$/.test(parts[3]) || +parts[3] < 1 || +parts[3] > 4094) { s.addLog('error', caretMsg(this, s, rawCmd, parts[3], rawCmd.toLowerCase().indexOf(parts[2].toLowerCase()) + parts[2].length)); return done(); }
            let created = false;
            targets.forEach(t => { t.accessVlan = String(parseInt(parts[3], 10)); if (ensureVlan(s, parts[3])) created = true; });
            if (created) s.addLog('system', '% Access VLAN does not exist. Creating vlan ' + parseInt(parts[3], 10));
            return done();
          }
          // interface-level toggles
          if (lower === 'no cdp enable') { echo(); targets.forEach(t => { t.cdp = false; }); return done(); }
          if (lower === 'cdp enable') { echo(); targets.forEach(t => { t.cdp = true; }); return done(); }
          if (/^(no )?lldp (transmit|receive)$/.test(lower)) {
            echo(); const neg = p0 === 'no'; const w = neg ? parts[2] : parts[1];
            targets.forEach(t => { t.lldp = t.lldp || { tx: true, rx: true }; if (w === 'transmit') t.lldp.tx = !neg; else t.lldp.rx = !neg; });
            return done();
          }
          // OSPF interface options
          if (p0 === 'ip' && matchesPrefix(p1, 'ospf', 2) && ['priority', 'cost', 'hello-interval', 'dead-interval', 'network'].indexOf(p2) >= 0) {
            echo();
            if (!parts[3]) { s.addLog('error', '% Incomplete command.'); return done(); }
            targets.forEach(t => {
              t.ospf = t.ospf || { area: null };
              if (p2 === 'priority') t.ospf.priority = parseInt(parts[3], 10);
              else if (p2 === 'cost') t.ospf.cost = parseInt(parts[3], 10);
              else if (p2 === 'hello-interval') { t.ospf.hello = parseInt(parts[3], 10); t.ospf.dead = t.ospf.hello * 4; }
              else if (p2 === 'dead-interval') t.ospf.dead = parseInt(parts[3], 10);
              else if (p2 === 'network') t.ospf.network = parts[3] === 'point-to-point' ? 'point-to-point' : 'broadcast';
            });
            return done();
          }
        }
      }

      // ===== delegate to the base engine, then post-process =====
      const modeBefore = s.mode;
      rawExec.call(this, rawCmd);
      if (modeBefore.startsWith('config') || viaDo) {
        // explicit switchport mode flag
        if (/switchport\s+mode\s+(access|trunk)/i.test(trimmed) && s.context) targetsOf(this, s).forEach(t => { t.explicitMode = true; });
        // channel-group creates the Port-channel interface
        const cg = trimmed.match(/^channel-group\s+(\d+)/i);
        if (cg) {
          const nm = 'Port-channel' + cg[1];
          if (!s.config.interfaces[nm]) {
            const ni = this.createDefaultInterface(nm, s.type);
            ni.isRouted = false; ni.mode = 'access'; ni.accessVlan = '1';
            s.config.interfaces[nm] = ni;
          }
        }
      }
      done();
    };
  })();

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
