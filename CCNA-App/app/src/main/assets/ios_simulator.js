/**
 * Virtual Cisco IOS Simulator (ios_simulator.js)
 * Lightweight interactive Cisco IOS terminal sandbox for CCNA 200-301 Lab Questions.
 * Replicates genuine Cisco IOS CLI behavior, prompt transitions, prefix abbreviation matching,
 * hierarchical contextual help (?), Tab auto-completion, pipe filtering (| include/exclude/begin/section),
 * and essential terminal control keys (Ctrl+C, Ctrl+Shift+6, Ctrl+A, Ctrl+E, Ctrl+Z, Tab, ?).
 * Exclusively active on Simulation / Lab questions.
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

  // Token normalizer mapping abbreviations to canonical Cisco IOS keywords
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
      { cmd: 'cdp', desc: 'Global CDP configuration subcommands' },
      { cmd: 'do', desc: 'To run exec commands in config mode' },
      { cmd: 'end', desc: 'Exit from configure mode' },
      { cmd: 'exit', desc: 'Exit from configure mode' },
      { cmd: 'hostname', desc: "Set system's network name" },
      { cmd: 'interface', desc: 'Select an interface to configure' },
      { cmd: 'ip', desc: 'Global IP configuration subcommands' },
      { cmd: 'ipv6', desc: 'Global IPv6 configuration subcommands' },
      { cmd: 'line', desc: 'Configure a terminal line' },
      { cmd: 'lldp', desc: 'Global LLDP configuration subcommands' },
      { cmd: 'no', desc: 'Negate a command or set its defaults' },
      { cmd: 'router', desc: 'Enable a routing process' },
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
      { cmd: 'switchport', desc: 'Set switching characteristics of the interface' }
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
      { cmd: 'do', desc: 'To run exec commands in config mode' },
      { cmd: 'end', desc: 'Exit from configure mode' },
      { cmd: 'exit', desc: 'Exit from configure mode' },
      { cmd: 'network', desc: 'Enable routing on an IP network' },
      { cmd: 'passive-interface', desc: 'Suppress routing updates on an interface' },
      { cmd: 'router-id', desc: 'router-id for this OSPF process' }
    ],
    'config-vlan': [
      { cmd: 'do', desc: 'To run exec commands in config mode' },
      { cmd: 'end', desc: 'Exit from configure mode' },
      { cmd: 'exit', desc: 'Exit from configure mode' },
      { cmd: 'name', desc: 'Ascii name of the VLAN' }
    ],
    'config-line': [
      { cmd: 'do', desc: 'To run exec commands in config mode' },
      { cmd: 'end', desc: 'Exit from configure mode' },
      { cmd: 'exit', desc: 'Exit from configure mode' },
      { cmd: 'login', desc: 'Enable password checking' },
      { cmd: 'password', desc: 'Assign the terminal connection password' },
      { cmd: 'transport', desc: 'Define transport protocols for line' }
    ]
  };

  // Hierarchical subcommand trees for contextual help & completion
  const SUB_TREES = {
    // switchport
    'switchport': [
      { cmd: 'access', desc: 'Set access mode characteristics of the interface' },
      { cmd: 'mode', desc: 'Set trunking mode of the interface' },
      { cmd: 'nonegotiate', desc: 'Device will not engage in negotiation protocol on this interface' },
      { cmd: 'port-security', desc: 'Security related command' },
      { cmd: 'trunk', desc: 'Set trunking characteristics of the interface' },
      { cmd: 'voice', desc: 'Voice appliance attributes' }
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
      { cmd: 'portfast', desc: 'Enable portfast on interface' },
      { cmd: 'vlan', desc: 'VLAN Switch Spanning Tree' }
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

    // show
    'show': [
      { cmd: 'cdp', desc: 'CDP information' },
      { cmd: 'etherchannel', desc: 'EtherChannel information' },
      { cmd: 'history', desc: 'Display the session command history' },
      { cmd: 'interfaces', desc: 'Interface status and configuration' },
      { cmd: 'ip', desc: 'IP information' },
      { cmd: 'ipv6', desc: 'IPv6 information' },
      { cmd: 'lldp', desc: 'LLDP information' },
      { cmd: 'mac', desc: 'MAC address table' },
      { cmd: 'mac-address-table', desc: 'MAC address table' },
      { cmd: 'running-config', desc: 'Current operating configuration' },
      { cmd: 'spanning-tree', desc: 'Spanning tree topology' },
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
      { cmd: 'interface', desc: 'OSPF interface information' },
      { cmd: 'neighbor', desc: 'OSPF neighbor information' },
      { cmd: '<cr>', desc: '' }
    ],
    'show interfaces': [
      { cmd: 'description', desc: 'Interface description' },
      { cmd: 'status', desc: 'Interface status' },
      { cmd: 'switchport', desc: 'Interface switchport status' },
      { cmd: 'trunk', desc: 'Interface trunking status' },
      { cmd: '<cr>', desc: '' }
    ],
    'show etherchannel': [
      { cmd: 'detail', desc: 'Detailed information' },
      { cmd: 'port-channel', desc: 'Port-channel information' },
      { cmd: 'summary', desc: 'One-line summary per channel-group' }
    ],
    'show cdp': [
      { cmd: 'interface', desc: 'CDP interface status' },
      { cmd: 'neighbors', desc: 'CDP neighbor information' }
    ],
    'show lldp': [
      { cmd: 'interface', desc: 'LLDP interface status' },
      { cmd: 'neighbors', desc: 'LLDP neighbor information' }
    ],
    'show mac-address-table': [
      { cmd: 'dynamic', desc: 'List dynamic addresses' },
      { cmd: 'vlan', desc: 'List by VLAN' },
      { cmd: '<cr>', desc: '' }
    ],
    'show spanning-tree': [
      { cmd: 'summary', desc: 'Summary of Spanning Tree state' },
      { cmd: 'vlan', desc: 'VLAN Spanning Tree' },
      { cmd: '<cr>', desc: '' }
    ],
    'show ipv6': [
      { cmd: 'interface', desc: 'IPv6 interface status' },
      { cmd: 'route', desc: 'IPv6 routing table' }
    ],
    'show ipv6 interface': [
      { cmd: 'brief', desc: 'Brief summary of IPv6 interface status' },
      { cmd: '<cr>', desc: '' }
    ]
  };

  // Pipe filter utility for Cisco IOS show output
  function applyPipeFilter(text, pipeClause) {
    if (!pipeClause || !text) return text;
    const parts = pipeClause.trim().split(/\s+/);
    const filterType = (parts[0] || '').toLowerCase();
    const patternStr = parts.slice(1).join(' ').trim();
    if (!patternStr) return text;

    const lines = text.split('\n');

    if (matchesPrefix(filterType, 'include', 3) || filterType === 'inc') {
      const re = new RegExp(patternStr, 'i');
      return lines.filter(l => re.test(l)).join('\n');
    }

    if (matchesPrefix(filterType, 'exclude', 3) || filterType === 'exc') {
      const re = new RegExp(patternStr, 'i');
      return lines.filter(l => !re.test(l)).join('\n');
    }

    if (matchesPrefix(filterType, 'begin', 3) || filterType === 'beg') {
      const re = new RegExp(patternStr, 'i');
      const startIdx = lines.findIndex(l => re.test(l));
      if (startIdx === -1) return '';
      return lines.slice(startIdx).join('\n');
    }

    if (matchesPrefix(filterType, 'section', 3) || filterType === 'sec') {
      const re = new RegExp(patternStr, 'i');
      const result = [];
      let inSection = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isTopLevel = line.length > 0 && !line.startsWith(' ') && !line.startsWith('!');
        if (isTopLevel) {
          if (re.test(line)) {
            inSection = true;
            result.push(line);
          } else {
            inSection = false;
          }
        } else if (inSection) {
          result.push(line);
        }
      }
      return result.length > 0 ? result.join('\n') : lines.filter(l => re.test(l)).join('\n');
    }

    return text;
  }

  class IosDeviceSession {
    constructor(hostname, type = 'switch') {
      this.hostname = hostname;
      this.type = type; // 'switch' or 'router'
      this.mode = 'user'; // 'user', 'priv', 'config', 'config-if', 'config-if-range', 'config-router', 'config-vlan', 'config-line'
      this.context = null; // { type: 'if', name: 'Ethernet0/1' } etc.
      this.history = [];
      this.historyIndex = -1;
      this.logs = [];

      // Initial device running-config state
      this.config = {
        hostname: hostname,
        interfaces: {},
        vlans: { '1': 'default' },
        ospf: { id: null, routerId: null, networks: [], passiveInterfaces: [] },
        staticRoutes: [], // { net, mask, nh, ad }
        ipv6Routes: [],   // { prefix, nh, ad }
        users: {},
        lines: {
          'console 0': { loginLocal: false, transport: 'all' },
          'vty 0 4': { loginLocal: true, transport: 'ssh' }
        }
      };

      // Populate default interfaces based on device type
      const isSw = this.type === 'switch' || this.hostname.toLowerCase().startsWith('sw');
      if (isSw) {
        ['Ethernet0/0', 'Ethernet0/1', 'Ethernet0/2', 'Ethernet0/3', 'GigabitEthernet0/1', 'GigabitEthernet0/2', 'Vlan1'].forEach(name => {
          this.config.interfaces[name] = {
            name: name,
            ip: null,
            mask: null,
            ipv6: null,
            ipv6LinkLocal: null,
            status: 'up',
            protocol: 'up',
            mode: 'access',
            accessVlan: '1',
            trunkAllowed: '1-4094',
            nativeVlan: '1',
            voiceVlan: null,
            channelGroup: null,
            channelMode: null,
            portfast: false,
            bpduguard: false,
            ospfPriority: null
          };
        });
      } else {
        ['Ethernet0/0', 'Ethernet0/1', 'GigabitEthernet0/0', 'GigabitEthernet0/1', 'GigabitEthernet0/2', 'Serial0/1/0', 'Loopback0'].forEach(name => {
          this.config.interfaces[name] = {
            name: name,
            ip: null,
            mask: null,
            ipv6: null,
            ipv6LinkLocal: null,
            status: 'administratively down',
            protocol: 'down',
            description: null,
            ospfPriority: null
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
        case 'config-if-range': return `${h}(config-if-range)#`;
        case 'config-router': return `${h}(config-router)#`;
        case 'config-vlan': return `${h}(config-vlan)#`;
        case 'config-line': return `${h}(config-line)#`;
        default: return `${h}>`;
      }
    }
  }

  class IosSimulator {
    constructor(container, promptText) {
      this.container = container;
      this.promptText = promptText;
      this.devices = {};
      this.activeDeviceName = '';
      this.screenEl = null;
      this.inputEl = null;
      this.promptEl = null;
      this.tabsWrapEl = null;

      this.initDevices(promptText);
    }

    initDevices(promptText) {
      const names = IosSimulator.extractDevices(promptText);
      names.forEach(name => {
        const isSwitch = /^sw/i.test(name);
        this.devices[name] = new IosDeviceSession(name, isSwitch ? 'switch' : 'router');
      });
      this.activeDeviceName = names[0] || 'SW-1';
    }

    getActiveSession() {
      return this.devices[this.activeDeviceName];
    }

    render() {
      this.container.innerHTML = '';

      const wrap = document.createElement('div');
      wrap.className = 'ios-sim-container';

      // Header Bar
      const header = document.createElement('div');
      header.className = 'ios-sim-header';

      const title = document.createElement('div');
      title.className = 'ios-sim-title';
      title.innerHTML = `<span>💻</span> Cisco IOS Virtual Terminal`;

      const actions = document.createElement('div');
      actions.className = 'ios-sim-actions';

      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'ios-btn-reset';
      resetBtn.textContent = '↺ Reload NVRAM';
      resetBtn.title = 'Reset active device state';
      resetBtn.onclick = () => this.resetActiveDevice();

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'ios-btn-clear';
      clearBtn.textContent = 'Clear Screen';
      clearBtn.onclick = () => this.clearScreen();

      actions.appendChild(resetBtn);
      actions.appendChild(clearBtn);
      header.appendChild(title);
      header.appendChild(actions);
      wrap.appendChild(header);

      // Device Tabs Bar
      const tabsWrap = document.createElement('div');
      tabsWrap.className = 'ios-sim-tabs';
      this.tabsWrapEl = tabsWrap;
      this.renderTabs();
      wrap.appendChild(tabsWrap);

      // Terminal Screen
      const screen = document.createElement('div');
      screen.className = 'ios-terminal-screen';
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
        btn.onmousedown = (e) => e.preventDefault(); // Prevent input blur
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
        // Physical keyboard shortcuts
        if (e.ctrlKey) {
          if (e.key === 'c' || e.key === 'C') {
            e.preventDefault();
            this.handleCtrlC();
            return;
          }
          if (e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            this.handleCtrlZ();
            return;
          }
          if (e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            this.handleCtrlA();
            return;
          }
          if (e.key === 'e' || e.key === 'E') {
            e.preventDefault();
            this.handleCtrlE();
            return;
          }
          if (e.key === 'u' || e.key === 'U') {
            e.preventDefault();
            this.handleCtrlU();
            return;
          }
          if (e.shiftKey && e.key === '6') {
            e.preventDefault();
            this.handleBreakSequence();
            return;
          }
        }

        // Intercept physical ? key
        if (e.key === '?') {
          e.preventDefault();
          this.handleQuestionMark();
          return;
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

      // Add device button
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'ios-tab-add-btn';
      addBtn.textContent = '+ Add';
      addBtn.title = 'Add new device';
      addBtn.onclick = () => {
        const newName = prompt('Enter device name (e.g. SW-3, R3):');
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

      // Scroll to bottom
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

    handleCtrlC() {
      const s = this.getActiveSession();
      if (!s) return;
      if (this.inputEl) this.inputEl.value = '';
      if (s.mode.startsWith('config')) {
        s.mode = 'priv';
        s.context = null;
      }
      s.addLog('input', s.getPrompt() + ' ^C');
      this.refreshScreen();
    }

    handleCtrlZ() {
      const s = this.getActiveSession();
      if (!s) return;
      if (this.inputEl) this.inputEl.value = '';
      if (s.mode.startsWith('config')) {
        s.mode = 'priv';
        s.context = null;
        s.addLog('system', '% SYS-5-CONFIG_I: Configured from console by console');
      }
      this.refreshScreen();
    }

    handleCtrlA() {
      if (this.inputEl) {
        this.inputEl.setSelectionRange(0, 0);
        this.inputEl.focus();
      }
    }

    handleCtrlE() {
      if (this.inputEl) {
        const len = this.inputEl.value.length;
        this.inputEl.setSelectionRange(len, len);
        this.inputEl.focus();
      }
    }

    handleCtrlU() {
      if (this.inputEl) {
        this.inputEl.value = '';
        this.inputEl.focus();
      }
    }

    handleBreakSequence() {
      const s = this.getActiveSession();
      if (!s) return;
      s.addLog('system', '\nAborted.');
      this.refreshScreen();
    }

    handleQuestionMark() {
      const s = this.getActiveSession();
      if (!s) return;
      const raw = this.inputEl ? this.inputEl.value : '';
      s.addLog('input', s.getPrompt() + ' ' + raw + '?');
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

      // If user typed words ending with space and pressed tab -> show next-level options
      if (hasTrailingSpace) {
        this.outputHelp(s, raw);
        this.refreshScreen();
        return;
      }

      // Autocomplete the last token
      const curr = rawTokens[rawTokens.length - 1];
      const prevTokens = rawTokens.slice(0, -1);
      const parentKey = prevTokens.map(t => norm(t, s.mode)).join(' ');

      let candidates = [];
      if (prevTokens.length === 0) {
        const root = ROOT_COMMANDS[s.mode] || ROOT_COMMANDS['user'];
        candidates = root.map(it => it.cmd);
      } else {
        if (SUB_TREES[parentKey]) {
          candidates = SUB_TREES[parentKey].map(it => it.cmd);
        } else if (norm(prevTokens[0], s.mode) === 'channel-group' && prevTokens.length >= 2) {
          candidates = ['mode'];
        }
      }

      const matches = candidates.filter(c =>
        c.toLowerCase().startsWith(curr.toLowerCase()) &&
        !c.startsWith('<') && c !== 'WORD' && c !== 'A.B.C.D' && c !== 'X:X:X:X::X/<0-128>' && c !== '<cr>'
      );

      if (matches.length === 1) {
        rawTokens[rawTokens.length - 1] = matches[0];
        this.inputEl.value = rawTokens.join(' ') + ' ';
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

      // Record in history
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
      const parts = cmd.split(/\s+/);
      const p0 = (parts[0] || '').toLowerCase();
      const p1 = (parts[1] || '').toLowerCase();
      const p2 = (parts[2] || '').toLowerCase();

      // Help '?' or commands containing '?'
      if (lower === '?' || lower === 'help' || rawCmd.includes('?')) {
        const query = rawCmd.replace(/\?.*$/, '');
        this.outputHelp(s, query);
        this.refreshScreen();
        if (this.inputEl) {
          this.inputEl.value = query;
          this.inputEl.focus();
        }
        return;
      }

      // Mode Navigation - enable, disable
      if (matchesPrefix(p0, 'enable', 2)) {
        s.mode = 'priv';
        this.refreshScreen();
        return;
      }
      if (matchesPrefix(p0, 'disable', 3)) {
        s.mode = 'user';
        this.refreshScreen();
        return;
      }

      // configure terminal
      if (matchesPrefix(p0, 'configure', 4)) {
        if (s.mode === 'user') {
          s.addLog('error', '% Type "enable" first to enter privileged mode.');
        } else {
          s.mode = 'config';
          s.addLog('system', 'Enter configuration commands, one per line.  End with CNTL/Z.');
        }
        this.refreshScreen();
        return;
      }

      // Exit / End
      if (p0 === 'exit') {
        if (s.mode.startsWith('config-if') || s.mode === 'config-router' || s.mode === 'config-vlan' || s.mode === 'config-line') {
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

      // GLOBAL CONFIG COMMANDS
      if (s.mode === 'config') {
        // hostname <name>
        if (matchesPrefix(p0, 'hostname', 4)) {
          const newName = parts[1] || 'Router';
          s.config.hostname = newName;
          s.hostname = newName;
          this.renderTabs();
          this.refreshScreen();
          return;
        }

        // interface / int ...
        if (matchesPrefix(p0, 'interface', 3)) {
          if (p1 === 'range' || matchesPrefix(p1, 'range', 1)) {
            const rangeStr = parts.slice(2).join(' ');
            s.mode = 'config-if-range';
            s.context = { type: 'range', range: rangeStr };
            this.refreshScreen();
            return;
          }
          const ifName = this.normalizeInterface(parts.slice(1).join(''));
          s.mode = 'config-if';
          s.context = { type: 'if', name: ifName };
          if (!s.config.interfaces[ifName]) {
            s.config.interfaces[ifName] = {
              name: ifName,
              ip: null,
              mask: null,
              ipv6: null,
              ipv6LinkLocal: null,
              status: 'up',
              protocol: 'up'
            };
          }
          this.refreshScreen();
          return;
        }

        // router ospf <id>
        if (matchesPrefix(p0, 'router', 4)) {
          const proto = p1;
          const pid = parts[2] || '1';
          s.mode = 'config-router';
          s.context = { type: 'router', proto, pid };
          if (proto === 'ospf') s.config.ospf.id = pid;
          this.refreshScreen();
          return;
        }

        // vlan <id>
        if (matchesPrefix(p0, 'vlan', 2)) {
          const vid = parts[1] || '10';
          s.mode = 'config-vlan';
          s.context = { type: 'vlan', vid };
          if (!s.config.vlans[vid]) s.config.vlans[vid] = `VLAN_${vid}`;
          this.refreshScreen();
          return;
        }

        // line ...
        if (matchesPrefix(p0, 'line', 3)) {
          const target = parts.slice(1).join(' ');
          s.mode = 'config-line';
          s.context = { type: 'line', target };
          this.refreshScreen();
          return;
        }

        // ip route <net> <mask> <nexthop> [ad]
        if (p0 === 'ip' && matchesPrefix(p1, 'route', 2)) {
          const [net, mask, nh, ad] = [parts[2], parts[3], parts[4], parts[5]];
          if (net && mask && nh) {
            s.config.staticRoutes.push({ net, mask, nh, ad: ad || '1' });
          }
          this.refreshScreen();
          return;
        }

        // ipv6 route <prefix> <nexthop> [ad]
        if (p0 === 'ipv6' && matchesPrefix(p1, 'route', 2)) {
          const [prefix, nh, ad] = [parts[2], parts[3], parts[4]];
          if (prefix && nh) {
            s.config.ipv6Routes.push({ prefix, nh, ad: ad || '1' });
          }
          this.refreshScreen();
          return;
        }

        // ip dhcp snooping
        if (lower.includes('dhcp snooping')) {
          s.config.dhcpSnooping = true;
          this.refreshScreen();
          return;
        }
      }

      // INTERFACE CONFIG COMMANDS
      if (s.mode === 'config-if' || s.mode === 'config-if-range') {
        const intf = (s.context && s.context.name) ? s.config.interfaces[s.context.name] : null;

        // ip address <ip> <mask>
        if (p0 === 'ip' && matchesPrefix(p1, 'address', 2)) {
          const ip = parts[2];
          const mask = parts[3];
          if (intf && ip && mask) {
            intf.ip = ip;
            intf.mask = mask;
            intf.status = 'up';
            intf.protocol = 'up';
          }
          this.refreshScreen();
          return;
        }

        // ipv6 address <prefix>
        if (p0 === 'ipv6' && matchesPrefix(p1, 'address', 2)) {
          const addr = parts[2];
          if (intf && addr) {
            if (parts.includes('link-local')) {
              intf.ipv6LinkLocal = addr;
            } else {
              intf.ipv6 = addr;
            }
            intf.status = 'up';
            intf.protocol = 'up';
          }
          this.refreshScreen();
          return;
        }

        // ip ospf priority <val>
        if (p0 === 'ip' && p1 === 'ospf' && matchesPrefix(p2, 'priority', 3)) {
          const pri = parts[3] || '1';
          if (intf) intf.ospfPriority = pri;
          this.refreshScreen();
          return;
        }

        // no shutdown / shutdown
        if (p0 === 'no' && matchesPrefix(p1, 'shutdown', 4)) {
          if (intf) {
            intf.status = 'up';
            intf.protocol = 'up';
          }
          s.addLog('system', `%LINK-3-UPDOWN: Interface ${intf ? intf.name : 'port'}, changed state to up\n%LINEPROTO-5-UPDOWN: Line protocol on Interface ${intf ? intf.name : 'port'}, changed state to up`);
          this.refreshScreen();
          return;
        }
        if (matchesPrefix(p0, 'shutdown', 4)) {
          if (intf) {
            intf.status = 'administratively down';
            intf.protocol = 'down';
          }
          s.addLog('system', `%LINK-5-CHANGED: Interface ${intf ? intf.name : 'port'}, changed state to administratively down`);
          this.refreshScreen();
          return;
        }

        // switchport mode access / trunk
        if (matchesPrefix(p0, 'switchport', 2) && lower.includes('mode')) {
          const smode = lower.includes('trunk') ? 'trunk' : 'access';
          if (intf) intf.mode = smode;
          this.refreshScreen();
          return;
        }

        // switchport trunk allowed vlan ...
        if (lower.includes('trunk allowed vlan')) {
          const vlans = parts.slice(parts.indexOf('vlan') + 1).join(' ');
          if (intf) intf.trunkAllowed = vlans;
          this.refreshScreen();
          return;
        }

        // switchport trunk native vlan <id>
        if (lower.includes('trunk native vlan')) {
          const nVid = parts[parts.length - 1];
          if (intf) intf.nativeVlan = nVid;
          this.refreshScreen();
          return;
        }

        // switchport access vlan <id>
        if (lower.includes('access vlan')) {
          const aVid = parts[parts.length - 1];
          if (intf) intf.accessVlan = aVid;
          this.refreshScreen();
          return;
        }

        // switchport voice vlan <id>
        if (lower.includes('voice vlan')) {
          const vVid = parts[parts.length - 1];
          if (intf) intf.voiceVlan = vVid;
          this.refreshScreen();
          return;
        }

        // channel-group <id> mode <mode>
        if (matchesPrefix(p0, 'channel-group', 4)) {
          const gid = parts[1];
          const modeIdx = parts.indexOf('mode');
          const cmode = modeIdx !== -1 ? parts[modeIdx + 1] : 'active';
          if (intf) {
            intf.channelGroup = gid;
            intf.channelMode = cmode;
          }
          const poName = `Port-channel${gid}`;
          if (!s.config.interfaces[poName]) {
            s.config.interfaces[poName] = { name: poName, mode: 'trunk', status: 'up', protocol: 'up' };
          }
          s.addLog('system', `Creating a port-channel interface Port-channel ${gid}`);
          this.refreshScreen();
          return;
        }

        // spanning-tree portfast / bpduguard
        if (lower.includes('portfast')) {
          if (intf) intf.portfast = true;
          s.addLog('system', `%Warning: portfast should only be enabled on ports connected to a single host.`);
          this.refreshScreen();
          return;
        }
        if (lower.includes('bpduguard')) {
          if (intf) intf.bpduguard = true;
          this.refreshScreen();
          return;
        }
      }

      // ROUTER CONFIG COMMANDS
      if (s.mode === 'config-router') {
        if (lower.startsWith('router-id')) {
          s.config.ospf.routerId = parts[1];
          this.refreshScreen();
          return;
        }
        if (lower.startsWith('network')) {
          s.config.ospf.networks.push(parts.slice(1).join(' '));
          this.refreshScreen();
          return;
        }
        if (lower.startsWith('passive-interface')) {
          s.config.ospf.passiveInterfaces.push(parts[1]);
          this.refreshScreen();
          return;
        }
      }

      // VLAN CONFIG COMMANDS
      if (s.mode === 'config-vlan') {
        if (p0 === 'name') {
          const vid = s.context ? s.context.vid : '1';
          s.config.vlans[vid] = parts[1] || 'VLAN';
          this.refreshScreen();
          return;
        }
      }

      // LINE CONFIG COMMANDS
      if (s.mode === 'config-line') {
        if (p0 === 'transport' && p1 === 'input') {
          const proto = parts[2] || 'ssh';
          s.addLog('system', `% Transport input set to ${proto}`);
          this.refreshScreen();
          return;
        }
        if (p0 === 'login' || p0 === 'password') {
          this.refreshScreen();
          return;
        }
      }

      // SHOW & EXECUTION COMMANDS (Available in Priv mode or with 'do')
      if (matchesPrefix(p0, 'show', 2)) {
        this.handleShowCommand(s, parts.slice(1), pipeClause);
        this.refreshScreen();
        return;
      }

      // Ping & Traceroute
      if (p0 === 'ping') {
        const dest = parts[1] || '8.8.8.8';
        s.addLog('output', `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${dest}, timeout is 2 seconds:\n!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms`);
        this.refreshScreen();
        return;
      }
      if (p0 === 'traceroute') {
        const dest = parts[1] || '10.1.1.1';
        s.addLog('output', `Type escape sequence to abort.\nTracing the route to ${dest}\nVRF info: (vrf in name/id)\n  1 10.0.0.1 2 msec 2 msec 1 msec\n  2 ${dest} 2 msec * 3 msec`);
        this.refreshScreen();
        return;
      }

      // Clear ip ospf process
      if (p0 === 'clear' && p1 === 'ip' && p2 === 'ospf') {
        s.addLog('output', 'Reset OSPF process? [no]: yes\n% OSPF process 33 restarted, adjacencies recalculated.');
        this.refreshScreen();
        return;
      }

      // Write memory / copy run start
      if (matchesPrefix(p0, 'write', 2) || (p0 === 'copy' && p1 === 'run')) {
        s.addLog('output', `Building configuration...\n[OK]`);
        this.refreshScreen();
        return;
      }

      // Default fallback for unrecognized commands
      s.addLog('error', `% Invalid input detected at '^' marker.`);
      this.refreshScreen();
    }

    normalizeInterface(raw) {
      if (!raw) return 'Ethernet0/0';
      const clean = raw.trim();
      if (/^e(th)?\d/i.test(clean)) return clean.replace(/^e(th)?/i, 'Ethernet');
      if (/^g(i|ig)?\d/i.test(clean)) return clean.replace(/^g(i|ig)?/i, 'GigabitEthernet');
      if (/^fa(st)?\d/i.test(clean)) return clean.replace(/^fa(st)?/i, 'FastEthernet');
      if (/^po(rt)?\d/i.test(clean)) return clean.replace(/^po(rt)?/i, 'Port-channel');
      if (/^vl(an)?\d/i.test(clean)) return clean.replace(/^vl(an)?/i, 'Vlan');
      if (/^lo(op)?\d/i.test(clean)) return clean.replace(/^lo(op)?/i, 'Loopback');
      if (/^se(r)?\d/i.test(clean)) return clean.replace(/^se(r)?/i, 'Serial');
      return clean;
    }

    handleShowCommand(s, args, pipeClause) {
      const sub0 = (args[0] || '').toLowerCase();
      const sub1 = (args[1] || '').toLowerCase();
      const sub2 = (args[2] || '').toLowerCase();

      let out = '';

      // show running-config
      if (matchesPrefix(sub0, 'running-config', 2)) {
        out = `Building configuration...\n\nCurrent configuration : 1850 bytes\n!\nversion 15.4\nservice timestamps debug datetime msec\nservice timestamps log datetime msec\nno service password-encryption\n!\nhostname ${s.config.hostname}\n!`;

        // VLANs
        Object.keys(s.config.vlans).forEach(v => {
          if (v !== '1') {
            out += `\nvlan ${v}\n name ${s.config.vlans[v]}`;
          }
        });

        // Interfaces
        Object.values(s.config.interfaces).forEach(intf => {
          out += `\n!\ninterface ${intf.name}`;
          if (intf.mode === 'trunk') {
            out += `\n switchport trunk encapsulation dot1q\n switchport mode trunk`;
            if (intf.trunkAllowed) out += `\n switchport trunk allowed vlan ${intf.trunkAllowed}`;
            if (intf.nativeVlan && intf.nativeVlan !== '1') out += `\n switchport trunk native vlan ${intf.nativeVlan}`;
          } else if (intf.mode === 'access') {
            out += `\n switchport mode access`;
            if (intf.accessVlan && intf.accessVlan !== '1') out += `\n switchport access vlan ${intf.accessVlan}`;
          }
          if (intf.voiceVlan) out += `\n switchport voice vlan ${intf.voiceVlan}`;
          if (intf.channelGroup) {
            out += `\n channel-group ${intf.channelGroup} mode ${intf.channelMode || 'active'}`;
          }
          if (intf.ip && intf.mask) {
            out += `\n ip address ${intf.ip} ${intf.mask}`;
          }
          if (intf.ipv6) {
            out += `\n ipv6 address ${intf.ipv6}`;
          }
          if (intf.ipv6LinkLocal) {
            out += `\n ipv6 address ${intf.ipv6LinkLocal} link-local`;
          }
          if (intf.ospfPriority) {
            out += `\n ip ospf priority ${intf.ospfPriority}`;
          }
          if (intf.status === 'administratively down') {
            out += `\n shutdown`;
          } else {
            out += `\n no shutdown`;
          }
          if (intf.portfast) out += `\n spanning-tree portfast`;
          if (intf.bpduguard) out += `\n spanning-tree bpduguard enable`;
        });

        // OSPF
        if (s.config.ospf.id) {
          out += `\n!\nrouter ospf ${s.config.ospf.id}`;
          if (s.config.ospf.routerId) out += `\n router-id ${s.config.ospf.routerId}`;
          s.config.ospf.networks.forEach(net => out += `\n network ${net}`);
          s.config.ospf.passiveInterfaces.forEach(p => out += `\n passive-interface ${p}`);
        }

        // Static routes IPv4
        s.config.staticRoutes.forEach(r => {
          out += `\nip route ${r.net} ${r.mask} ${r.nh}${r.ad && r.ad !== '1' ? ' ' + r.ad : ''}`;
        });

        // Static routes IPv6
        s.config.ipv6Routes.forEach(r => {
          out += `\nipv6 route ${r.prefix} ${r.nh}${r.ad && r.ad !== '1' ? ' ' + r.ad : ''}`;
        });

        out += `\n!\nline con 0\nline vty 0 4\n login local\n transport input ssh\n!\nend`;
      }

      // show ip interface brief
      else if (sub0 === 'ip' && matchesPrefix(sub1, 'interface', 2) && matchesPrefix(sub2, 'brief', 2)) {
        out = 'Interface              IP-Address      OK? Method Status                Protocol\n';
        Object.values(s.config.interfaces).forEach(i => {
          const nameCol = i.name.padEnd(23, ' ');
          const ipCol = (i.ip || 'unassigned').padEnd(16, ' ');
          const okCol = 'YES '.padEnd(4, ' ');
          const methCol = (i.ip ? 'manual ' : 'unset  ').padEnd(7, ' ');
          const statCol = (i.status || 'up').padEnd(22, ' ');
          const protoCol = i.protocol || 'up';
          out += `${nameCol}${ipCol}${okCol}${methCol}${statCol}${protoCol}\n`;
        });
      }

      // show ipv6 interface brief
      else if (sub0 === 'ipv6' && matchesPrefix(sub1, 'interface', 2) && matchesPrefix(sub2, 'brief', 2)) {
        out = 'Interface              IPv6-Address                            Status                Protocol\n';
        Object.values(s.config.interfaces).forEach(i => {
          const nameCol = i.name.padEnd(23, ' ');
          const ipCol = (i.ipv6 || 'unassigned').padEnd(40, ' ');
          const statCol = (i.status || 'up').padEnd(22, ' ');
          const protoCol = i.protocol || 'up';
          out += `${nameCol}${ipCol}${statCol}${protoCol}\n`;
        });
      }

      // show interfaces trunk
      else if (matchesPrefix(sub0, 'interfaces', 2) && matchesPrefix(sub1, 'trunk', 2)) {
        out = 'Port        Mode             Encapsulation  Status        Native vlan\n';
        const trunks = Object.values(s.config.interfaces).filter(i => i.mode === 'trunk');
        if (trunks.length === 0) {
          out += 'No trunk ports configured.\n';
        } else {
          trunks.forEach(t => {
            out += `${t.name.padEnd(12, ' ')}on               802.1q         trunking      ${t.nativeVlan || '1'}\n`;
          });
          out += '\nPort        Vlans allowed on trunk\n';
          trunks.forEach(t => {
            out += `${t.name.padEnd(12, ' ')}${t.trunkAllowed || '1-4094'}\n`;
          });
        }
      }

      // show etherchannel summary
      else if (matchesPrefix(sub0, 'etherchannel', 2)) {
        const groups = {};
        Object.values(s.config.interfaces).forEach(i => {
          if (i.channelGroup) {
            if (!groups[i.channelGroup]) groups[i.channelGroup] = [];
            groups[i.channelGroup].push(i.name);
          }
        });
        out = `Flags:  D - down        P - bundled in port-channel\n        I - stand-alone s - suspended\n        H - Hot-standby (LACP only)\n`;
        out += `Number of channel-groups in use: ${Object.keys(groups).length}\n`;
        out += `Group  Port-channel  Protocol    Ports\n`;
        out += `------+-------------+-----------+-----------------------------------------------\n`;
        Object.keys(groups).forEach(g => {
          const portsStr = groups[g].map(p => `${p}(P)`).join(' ');
          out += `${g.padEnd(7, ' ')}Po${g}(SU)       LACP        ${portsStr}\n`;
        });
        if (Object.keys(groups).length === 0) {
          out += `No active channel-groups configured.\n`;
        }
      }

      // show vlan brief
      else if (matchesPrefix(sub0, 'vlan', 2)) {
        out = 'VLAN Name                             Status    Ports\n';
        out += '---- -------------------------------- --------- -------------------------------\n';
        Object.keys(s.config.vlans).forEach(v => {
          const vCol = v.padEnd(5, ' ');
          const nCol = (s.config.vlans[v] || 'VLAN').padEnd(33, ' ');
          out += `${vCol}${nCol}active    \n`;
        });
      }

      // show ip route
      else if (sub0 === 'ip' && matchesPrefix(sub1, 'route', 2)) {
        out = 'Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP\n       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area \n\n';
        out += 'Gateway of last resort is not set\n\n';
        s.config.staticRoutes.forEach(r => {
          out += `S    ${r.net}/${r.mask} [${r.ad || '1'}/0] via ${r.nh}\n`;
        });
        Object.values(s.config.interfaces).forEach(i => {
          if (i.ip && i.mask) {
            out += `C    ${i.ip}/24 is directly connected, ${i.name}\n`;
            out += `L    ${i.ip}/32 is directly connected, ${i.name}\n`;
          }
        });
      }

      // show ipv6 route
      else if (sub0 === 'ipv6' && matchesPrefix(sub1, 'route', 2)) {
        out = 'IPv6 Routing Table - default - 4 entries\nCodes: C - Connected, L - Local, S - Static, U - RIP\n\n';
        s.config.ipv6Routes.forEach(r => {
          out += `S    ${r.prefix} [${r.ad || '1'}/0] via ${r.nh}\n`;
        });
        Object.values(s.config.interfaces).forEach(i => {
          if (i.ipv6) {
            out += `C    ${i.ipv6} [0/0] via ${i.name}, directly connected\n`;
          }
        });
      }

      // show ip ospf neighbor
      else if (sub0 === 'ip' && p1 === 'ospf' && (p2 === 'neighbor' || matchesPrefix(p2, 'neighbor', 3))) {
        out = 'Neighbor ID     Pri   State           Dead Time   Address         Interface\n';
        out += '10.1.1.2          1   FULL/DR         00:00:34    192.168.1.2     Ethernet0/0\n';
        out += '10.1.1.3          1   FULL/BDR        00:00:38    192.168.1.3     Ethernet0/1\n';
      }

      // show interfaces switchport
      else if (matchesPrefix(sub0, 'interfaces', 2) && matchesPrefix(sub1, 'switchport', 2)) {
        out = 'Name: Ethernet0/0\nSwitchport: Enabled\nAdministrative Mode: dynamic auto\nOperational Mode: static access\nAdministrative Trunking Encapsulation: dot1q\nOperational Trunking Encapsulation: native\nNegotiation of Trunking: On\nAccess Mode VLAN: 1 (default)\nTrunking Native Mode VLAN: 1 (default)\nVoice VLAN: none\n';
      }

      // show interfaces status
      else if (matchesPrefix(sub0, 'interfaces', 2) && matchesPrefix(sub1, 'status', 2)) {
        out = 'Port      Name               Status       Vlan       Duplex  Speed Type\n';
        Object.values(s.config.interfaces).forEach(i => {
          const pCol = i.name.padEnd(10, ' ');
          const nCol = '                  ';
          const sCol = (i.status === 'up' ? 'connected   ' : 'notconnect  ');
          const vCol = (i.mode === 'trunk' ? 'trunk     ' : `${i.accessVlan || '1'}        `).slice(0, 10);
          out += `${pCol}${nCol}${sCol}${vCol}a-full  a-100 10/100BaseTX\n`;
        });
      }

      // show cdp neighbors / show lldp neighbors
      else if ((sub0 === 'cdp' || sub0 === 'lldp') && matchesPrefix(sub1, 'neighbors', 3)) {
        out = `Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge\n                  S - Switch, H - Host, I - IGMP, r - Repeater\n\nDevice ID        Local Intrfce     Holdtme    Capability  Platform  Port ID\n`;
        out += `SW-2             Eth 0/1           152              S I   WS-C2960  Eth 0/1\n`;
        out += `R1               Eth 0/0           164              R     CISCO2901 Eth 0/0\n`;
      }

      // show mac-address-table
      else if (sub0 === 'mac' || sub0 === 'mac-address-table') {
        out = `          Mac Address Table\n-------------------------------------------\nVlan    Mac Address       Type        Ports\n----    -----------       --------    -----\n   1    aabb.cc00.0100    DYNAMIC     Et0/1\n  10    aabb.cc00.0200    DYNAMIC     Et0/2\n`;
      }

      // show version
      else if (matchesPrefix(sub0, 'version', 2)) {
        out = `Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.4(3)M2\nROM: Bootstrap program is C2960 boot loader\nSystem image file is "flash:/c2960-lanbasek9-mz.154-3.M2.bin"\nModel number: WS-C2960-24TT-L\nConfiguration register is 0xF`;
      }

      else {
        out = `% Incomplete command or options not supported in sandbox.`;
      }

      // Apply pipe filter if requested
      if (pipeClause) {
        out = applyPipeFilter(out, pipeClause);
      }

      s.addLog('output', out.trimEnd() || '(no matching output)');
    }

    outputHelp(s, currentInput) {
      const mode = s.mode;
      const raw = (currentInput || '').trimStart();
      const hasTrailingSpace = /\s$/.test(currentInput || '');

      const modeHeaders = {
        'user': 'User Exec commands:',
        'priv': 'Exec commands:',
        'config': 'Configure commands:',
        'config-if': 'Interface configuration commands:',
        'config-if-range': 'Interface configuration commands:',
        'config-router': 'Router configuration commands:',
        'config-vlan': 'VLAN configuration commands:',
        'config-line': 'Line configuration commands:'
      };
      const headerTitle = modeHeaders[mode] || 'Commands:';

      function formatList(items, customHeader) {
        let out = (customHeader || headerTitle) + '\n';
        items.forEach(it => {
          out += `  ${it.cmd.padEnd(16, ' ')} ${it.desc}\n`;
        });
        return out.trimEnd();
      }

      const rawTokens = raw.split(/\s+/).filter(Boolean);

      // Case 1: Empty input -> show root mode commands
      if (rawTokens.length === 0) {
        const root = ROOT_COMMANDS[mode] || ROOT_COMMANDS['user'];
        s.addLog('output', formatList(root));
        return;
      }

      // Normalized tokens
      const normTokens = rawTokens.map(t => norm(t, mode));

      // Handle dynamic parameters
      if (normTokens[0] === 'channel-group' && normTokens.length >= 2 && /^\d+$/.test(normTokens[1])) {
        if (normTokens.length === 2 && hasTrailingSpace) {
          s.addLog('output', formatList([
            { cmd: 'mode', desc: 'Etherchannel mode of the interface' }
          ]));
          return;
        }
        if (normTokens.length >= 3 && normTokens[2] === 'mode') {
          if (hasTrailingSpace && normTokens.length === 3) {
            s.addLog('output', formatList(SUB_TREES['channel-group mode']));
            return;
          }
        }
      }

      // Case 2: Input has trailing space -> user wants next-level subcommands
      if (hasTrailingSpace) {
        const key = normTokens.join(' ');
        if (SUB_TREES[key]) {
          s.addLog('output', formatList(SUB_TREES[key]));
          return;
        }

        // Check if last token is an IP or number
        if (/^\d+$/.test(normTokens[normTokens.length - 1])) {
          s.addLog('output', `  <cr>`);
          return;
        }

        s.addLog('output', `  <cr>`);
        return;
      }

      // Case 3: Input has NO trailing space -> user wants completion/prefix help on the last word
      if (normTokens.length === 1) {
        const prefix = rawTokens[0].toLowerCase();
        const root = ROOT_COMMANDS[mode] || ROOT_COMMANDS['user'];
        const matches = root.filter(it => it.cmd.toLowerCase().startsWith(prefix));
        if (matches.length > 0) {
          s.addLog('output', formatList(matches));
        } else {
          s.addLog('error', `% Unrecognized command`);
        }
        return;
      }

      // Multiple tokens, incomplete last token
      const parentKey = normTokens.slice(0, -1).join(' ');
      const lastPrefix = rawTokens[rawTokens.length - 1].toLowerCase();
      if (SUB_TREES[parentKey]) {
        const matches = SUB_TREES[parentKey].filter(it => it.cmd.toLowerCase().startsWith(lastPrefix));
        if (matches.length > 0) {
          s.addLog('output', formatList(matches));
          return;
        }
      }

      s.addLog('error', `% Unrecognized command`);
    }

    static extractDevices(promptText) {
      if (!promptText) return ['SW-1', 'SW-2'];
      const found = new Set();
      const re = /\b(SW(?:ITCH)?-?\d+|R\d+|Router\d+|Sw\d+|Gw\d+)\b/gi;
      let m;
      while ((m = re.exec(promptText)) !== null) {
        const norm = m[1].toUpperCase();
        found.add(norm);
      }
      const list = Array.from(found);
      if (list.length === 0) {
        const isRouter = /router|ospf|route|ipv6/i.test(promptText);
        return isRouter ? ['R1', 'R2'] : ['SW-1', 'SW-2'];
      }
      return list.sort();
    }
  }

  window.IosSimulator = IosSimulator;
})();
