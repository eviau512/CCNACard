/**
 * Virtual Cisco IOS Simulator (ios_simulator.js)
 * Lightweight interactive Cisco IOS terminal sandbox for CCNA 200-301 Lab Questions.
 * Replicates genuine Cisco IOS CLI behavior, prompt transitions, prefix abbreviation matching,
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
        staticRoutes: [],
        users: {},
        lines: {
          'console 0': { loginLocal: false, transport: 'all' },
          'vty 0 4': { loginLocal: true, transport: 'ssh' }
        }
      };

      // Populate default interfaces based on device type
      if (this.type === 'switch' || this.hostname.toLowerCase().startsWith('sw')) {
        ['Ethernet0/0', 'Ethernet0/1', 'Ethernet0/2', 'Ethernet0/3', 'GigabitEthernet0/1', 'GigabitEthernet0/2', 'Vlan1'].forEach(name => {
          this.config.interfaces[name] = {
            name: name,
            ip: null,
            mask: null,
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
            bpduguard: false
          };
        });
      } else {
        ['GigabitEthernet0/0', 'GigabitEthernet0/1', 'GigabitEthernet0/2', 'Serial0/1/0', 'Loopback0'].forEach(name => {
          this.config.interfaces[name] = {
            name: name,
            ip: null,
            mask: null,
            status: 'administratively down',
            protocol: 'down',
            description: null
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
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.getElementById(container) : container;
      if (!this.container) throw new Error('IosSimulator container element not found');

      this.options = options;
      this.devices = {};
      this.activeDeviceName = null;
      this.isFullscreen = false;

      const deviceList = options.devices && options.devices.length > 0 ? options.devices : ['SW-1', 'SW-2'];
      deviceList.forEach(devName => {
        const isRouter = /^(r\d+|router)/i.test(devName);
        this.devices[devName] = new IosDeviceSession(devName, isRouter ? 'router' : 'switch');
      });
      this.activeDeviceName = deviceList[0];

      this.render();
    }

    getActiveSession() {
      return this.devices[this.activeDeviceName];
    }

    render() {
      this.container.innerHTML = '';

      const wrap = document.createElement('div');
      wrap.className = 'ios-sim-container' + (this.isFullscreen ? ' ios-fullscreen' : '');
      this.wrapEl = wrap;

      // Header Bar
      const header = document.createElement('div');
      header.className = 'ios-sim-header';

      // Device Tabs
      const tabsWrap = document.createElement('div');
      tabsWrap.className = 'ios-device-tabs';
      this.tabsWrapEl = tabsWrap;
      this.renderTabs();

      // Controls (Clear, Reset, Expand)
      const ctrls = document.createElement('div');
      ctrls.className = 'ios-header-controls';
      ctrls.innerHTML = `
        <button type="button" class="ios-ctrl-btn" title="Clear Screen">Clear</button>
        <button type="button" class="ios-ctrl-btn" title="Reset Session">↺ Reset</button>
        <button type="button" class="ios-ctrl-btn" title="Toggle Fullscreen">${this.isFullscreen ? '↙ Collapse' : '⛶ Expand'}</button>
      `;

      const [clearBtn, resetBtn, fullBtn] = ctrls.querySelectorAll('button');
      clearBtn.onclick = () => this.clearScreen();
      resetBtn.onclick = () => this.resetActiveDevice();
      fullBtn.onclick = () => this.toggleFullscreen();

      header.appendChild(tabsWrap);
      header.appendChild(ctrls);
      wrap.appendChild(header);

      // Terminal Screen
      const screen = document.createElement('div');
      screen.className = 'ios-sim-screen';
      this.screenEl = screen;
      wrap.appendChild(screen);

      // Mobile Virtual Keyboard Control Deck (Only hardware-missing control keys!)
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
        btn.onmousedown = (e) => e.preventDefault(); // Prevent blur
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
        const devCount = Object.keys(this.devices).length + 1;
        const newName = `Device-${devCount}`;
        this.devices[newName] = new IosDeviceSession(newName, 'switch');
        this.switchDevice(newName);
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
        if (window.showToast) showToast(`Device ${this.activeDeviceName} reset`);
      }
    }

    toggleFullscreen() {
      this.isFullscreen = !this.isFullscreen;
      this.render();
    }

    // --- Control Key Handlers ---
    handleCtrlC() {
      const s = this.getActiveSession();
      if (!s) return;
      const currentInput = this.inputEl ? this.inputEl.value : '';
      s.addLog('input', s.getPrompt() + ' ' + currentInput + '^C');
      if (this.inputEl) this.inputEl.value = '';

      if (s.mode.startsWith('config')) {
        s.mode = 'priv';
        s.context = null;
        s.addLog('system', '% SYS-5-CONFIG_I: Configured from console by console');
      }
      this.refreshScreen();
      if (this.inputEl) this.inputEl.focus();
    }

    handleBreakSequence() {
      const s = this.getActiveSession();
      if (!s) return;
      s.addLog('system', '\nType escape sequence to abort.\nAborted.');
      this.refreshScreen();
      if (this.inputEl) this.inputEl.focus();
    }

    handleCtrlA() {
      if (!this.inputEl) return;
      this.inputEl.focus();
      this.inputEl.setSelectionRange(0, 0);
    }

    handleCtrlE() {
      if (!this.inputEl) return;
      this.inputEl.focus();
      const len = this.inputEl.value.length;
      this.inputEl.setSelectionRange(len, len);
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
      if (this.inputEl) this.inputEl.focus();
    }

    handleCtrlU() {
      if (!this.inputEl) return;
      this.inputEl.value = '';
      this.inputEl.focus();
    }

    handleQuestionMark() {
      const s = this.getActiveSession();
      if (!s) return;
      const raw = this.inputEl ? this.inputEl.value : '';
      s.addLog('input', s.getPrompt() + ' ' + raw + '?');
      this.outputHelp(s, raw);
      this.refreshScreen();
      if (this.inputEl) this.inputEl.focus();
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
      const val = this.inputEl.value;
      const s = this.getActiveSession();
      const tokens = val.trim().split(/\s+/);
      const curr = tokens[tokens.length - 1] || '';

      const candidates = this.getAvailableCommands(s.mode);
      const matches = candidates.filter(c => c.toLowerCase().startsWith(curr.toLowerCase()));

      if (matches.length === 1) {
        tokens[tokens.length - 1] = matches[0];
        this.inputEl.value = tokens.join(' ') + ' ';
      } else if (matches.length > 1) {
        s.addLog('input', s.getPrompt() + ' ' + val);
        s.addLog('output', matches.join('   '));
        this.refreshScreen();
      }
    }

    getAvailableCommands(mode) {
      if (mode === 'user') return ['enable', 'show', 'ping', 'traceroute', 'exit', 'help'];
      if (mode === 'priv') return ['configure', 'disable', 'show', 'ping', 'traceroute', 'write', 'copy', 'reload', 'exit', 'help'];
      if (mode === 'config') return ['hostname', 'interface', 'router', 'vlan', 'ip', 'line', 'username', 'no', 'exit', 'end', 'do'];
      if (mode === 'config-if' || mode === 'config-if-range') return ['ip', 'ipv6', 'switchport', 'channel-group', 'spanning-tree', 'description', 'shutdown', 'no', 'exit', 'end', 'do'];
      if (mode === 'config-router') return ['router-id', 'network', 'passive-interface', 'exit', 'end', 'do'];
      if (mode === 'config-vlan') return ['name', 'exit', 'end', 'do'];
      if (mode === 'config-line') return ['login', 'password', 'transport', 'exit', 'end', 'do'];
      return ['exit', 'end', 'help'];
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

      const lower = cmd.toLowerCase();
      const parts = cmd.split(/\s+/);
      const p0 = (parts[0] || '').toLowerCase();
      const p1 = (parts[1] || '').toLowerCase();
      const p2 = (parts[2] || '').toLowerCase();

      // Help '?'
      if (lower === '?' || lower === 'help') {
        this.outputHelp(s, '');
        this.refreshScreen();
        return;
      }

      // Mode Navigation - Prefix Matching: en, ena, enable
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
      // conf, config, configure terminal
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
            s.config.interfaces[ifName] = { name: ifName, ip: null, mask: null, status: 'up', protocol: 'up' };
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

        // ip route <net> <mask> <nexthop>
        if (p0 === 'ip' && matchesPrefix(p1, 'route', 2)) {
          const [net, mask, nh] = [parts[2], parts[3], parts[4]];
          if (net && mask && nh) {
            s.config.staticRoutes.push({ net, mask, nh });
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

        // ip address ...
        if (p0 === 'ip' && (matchesPrefix(p1, 'address', 2))) {
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
          const mode = lower.includes('trunk') ? 'trunk' : 'access';
          if (intf) intf.mode = mode;
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

      // SHOW & EXECUTION COMMANDS (Available in Priv mode or with 'do')
      if (matchesPrefix(p0, 'show', 2)) {
        this.handleShowCommand(s, parts.slice(1));
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
      return clean;
    }

    handleShowCommand(s, args) {
      const sub0 = (args[0] || '').toLowerCase();
      const sub1 = (args[1] || '').toLowerCase();
      const sub2 = (args[2] || '').toLowerCase();

      // show running-config
      if (matchesPrefix(sub0, 'running-config', 2)) {
        let out = `Building configuration...\n\nCurrent configuration : 1582 bytes\n!\nversion 15.4\nservice timestamps debug datetime msec\nservice timestamps log datetime msec\nno service password-encryption\n!\nhostname ${s.config.hostname}\n!`;

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
          if (intf.channelGroup) {
            out += `\n channel-group ${intf.channelGroup} mode ${intf.channelMode || 'active'}`;
          }
          if (intf.ip && intf.mask) {
            out += `\n ip address ${intf.ip} ${intf.mask}`;
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

        // Static routes
        s.config.staticRoutes.forEach(r => {
          out += `\nip route ${r.net} ${r.mask} ${r.nh}`;
        });

        out += `\n!\nline con 0\nline vty 0 4\n login local\n transport input ssh\n!\nend`;
        s.addLog('output', out);
        return;
      }

      // show ip interface brief
      if (sub0 === 'ip' && matchesPrefix(sub1, 'interface', 2) && matchesPrefix(sub2, 'brief', 2)) {
        let out = 'Interface              IP-Address      OK? Method Status                Protocol\n';
        Object.values(s.config.interfaces).forEach(i => {
          const nameCol = i.name.padEnd(23, ' ');
          const ipCol = (i.ip || 'unassigned').padEnd(16, ' ');
          const okCol = 'YES '.padEnd(4, ' ');
          const methCol = (i.ip ? 'manual ' : 'unset  ').padEnd(7, ' ');
          const statCol = (i.status || 'up').padEnd(22, ' ');
          const protoCol = i.protocol || 'up';
          out += `${nameCol}${ipCol}${okCol}${methCol}${statCol}${protoCol}\n`;
        });
        s.addLog('output', out.trimEnd());
        return;
      }

      // show interfaces trunk
      if (matchesPrefix(sub0, 'interfaces', 2) && matchesPrefix(sub1, 'trunk', 2)) {
        let out = 'Port        Mode             Encapsulation  Status        Native vlan\n';
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
        s.addLog('output', out.trimEnd());
        return;
      }

      // show etherchannel summary
      if (matchesPrefix(sub0, 'etherchannel', 2)) {
        const groups = {};
        Object.values(s.config.interfaces).forEach(i => {
          if (i.channelGroup) {
            if (!groups[i.channelGroup]) groups[i.channelGroup] = [];
            groups[i.channelGroup].push(i.name);
          }
        });
        let out = `Flags:  D - down        P - bundled in port-channel\n        I - stand-alone s - suspended\n        H - Hot-standby (LACP only)\n`;
        out += `Number of channel-groups in use: ${Object.keys(groups).length}\n`;
        out += `Group  Port-channel  Protocol    Ports\n`;
        out += `------+-------------+-----------+-----------------------------------------------\n`;
        Object.keys(groups).forEach(g => {
          const portsStr = groups[g].map(p => `${p}(P)`).join(' ');
          out += `${g.padEnd(7, ' ')}Po${g}(SU)       LACP        ${portsStr}\n`;
        });
        s.addLog('output', out.trimEnd());
        return;
      }

      // show vlan brief
      if (matchesPrefix(sub0, 'vlan', 2)) {
        let out = 'VLAN Name                             Status    Ports\n';
        out += '---- -------------------------------- --------- -------------------------------\n';
        Object.keys(s.config.vlans).forEach(v => {
          const vCol = v.padEnd(5, ' ');
          const nCol = (s.config.vlans[v] || 'VLAN').padEnd(33, ' ');
          out += `${vCol}${nCol}active    \n`;
        });
        s.addLog('output', out.trimEnd());
        return;
      }

      // show ip route
      if (sub0 === 'ip' && matchesPrefix(sub1, 'route', 2)) {
        let out = 'Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP\n       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area \n\n';
        out += 'Gateway of last resort is not set\n\n';
        s.config.staticRoutes.forEach(r => {
          out += `S    ${r.net}/${r.mask} [1/0] via ${r.nh}\n`;
        });
        Object.values(s.config.interfaces).forEach(i => {
          if (i.ip && i.mask) {
            out += `C    ${i.ip}/24 is directly connected, ${i.name}\n`;
            out += `L    ${i.ip}/32 is directly connected, ${i.name}\n`;
          }
        });
        s.addLog('output', out.trimEnd());
        return;
      }

      // show version
      if (matchesPrefix(sub0, 'version', 2)) {
        s.addLog('output', `Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.4(3)M2\nROM: Bootstrap program is C2960 boot loader\nSystem image file is "flash:/c2960-lanbasek9-mz.154-3.M2.bin"\nModel number: WS-C2960-24TT-L\nConfiguration register is 0xF`);
        return;
      }

      s.addLog('output', `% Incomplete command or options not supported in sandbox.`);
    }

    outputHelp(s, currentInput) {
      const cmds = this.getAvailableCommands(s.mode);
      let out = 'Exec commands:\n';
      cmds.forEach(c => {
        out += `  ${c.padEnd(14, ' ')} Execute or configure ${c}\n`;
      });
      s.addLog('output', out.trimEnd());
    }

    static extractDevices(promptText) {
      if (!promptText) return ['SW-1', 'SW-2'];
      const found = new Set();
      const re = /\b(SW(?:ITCH)?-?\d+|R\d+|Router\d+|Sw\d+)\b/gi;
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
