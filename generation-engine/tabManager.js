import { spawn } from 'child_process';
import path from 'path';

export class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.idCounter = 0;
    this.pendingResolvers = new Map();
    this.eventListeners = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.onopen = () => {
        console.log(`[CDPClient] Connected to ${this.wsUrl}`);
        resolve();
      };
      
      this.ws.onerror = (err) => {
        console.error(`[CDPClient] Connection error:`, err);
        reject(err);
      };
      
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.id !== undefined) {
            const resolver = this.pendingResolvers.get(msg.id);
            if (resolver) {
              this.pendingResolvers.delete(msg.id);
              if (msg.error) {
                resolver.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
              } else {
                resolver.resolve(msg.result);
              }
            }
          } else if (msg.method) {
            const listeners = this.eventListeners.get(msg.method) || [];
            listeners.forEach(fn => fn(msg.params));
          }
        } catch (e) {
          console.error("[CDPClient] Message parse error:", e);
        }
      };

      this.ws.onclose = () => {
        console.log("[CDPClient] Connection closed");
        // Reject all pending resolvers
        for (const resolver of this.pendingResolvers.values()) {
          resolver.reject(new Error("CDP connection closed"));
        }
        this.pendingResolvers.clear();
      };
    });
  }

  async send(method, params = {}) {
    const id = ++this.idCounter;
    return new Promise((resolve, reject) => {
      this.pendingResolvers.set(id, { resolve, reject });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        this.pendingResolvers.delete(id);
        reject(err);
      }
    });
  }

  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  removeListener(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  async close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

export class TabManager {
  constructor(options = {}) {
    this.chromePort = options.chromePort || 9222;
    this.chromeProcess = null;
    this.client = null;
    this.tabId = null;
  }

  async isChromeResponding() {
    try {
      const res = await fetch(`http://127.0.0.1:${this.chromePort}/json/version`);
      return res.ok;
    } catch (err) {
      return false;
    }
  }

  async launchChrome() {
    const responding = await this.isChromeResponding();
    if (responding) {
      console.log(`[TabManager] Chrome is already active on port ${this.chromePort}`);
      return;
    }

    console.log(`[TabManager] Spawning Chrome with remote debugging on port ${this.chromePort}...`);
    const defaultChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const profileDir = path.resolve('./omniflow-temp/chrome-profile');

    this.chromeProcess = spawn(defaultChromePath, [
      `--remote-debugging-port=${this.chromePort}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-media-suspend',
      `--user-data-dir=${profileDir}`
    ], {
      detached: true,
      stdio: 'ignore'
    });

    this.chromeProcess.unref();

    // Wait up to 5 seconds for Chrome to respond
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (await this.isChromeResponding()) {
        console.log(`[TabManager] Chrome is launched and responding on port ${this.chromePort}`);
        return;
      }
    }

    throw new Error(`Chrome failed to start on port ${this.chromePort}`);
  }

  async openTab(url) {
    await this.launchChrome();

    console.log(`[TabManager] Opening new tab...`);
    const res = await fetch(`http://127.0.0.1:${this.chromePort}/json/new`, {
      method: 'PUT'
    });
    if (!res.ok) {
      throw new Error(`Failed to create new tab: ${res.statusText}`);
    }

    const tabData = await res.json();
    this.tabId = tabData.id;
    const wsUrl = tabData.webSocketDebuggerUrl;

    console.log(`[TabManager] Tab created with ID: ${this.tabId}`);
    
    this.client = new CDPClient(wsUrl);
    await this.client.connect();

    // Enable basic CDP domains
    await this.client.send('Page.enable');
    await this.client.send('Runtime.enable');
    await this.client.send('DOM.enable');

    // Enable focus emulation to run background tabs at full speed
    console.log(`[TabManager] Enabling focus emulation...`);
    await this.client.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(err => {
      console.warn(`[TabManager] Focus emulation failed to enable: ${err.message}`);
    });

    // Perform explicit navigation via CDP Page.navigate
    console.log(`[TabManager] Navigating to: ${url}`);
    await this.client.send('Page.navigate', { url });

    // Wait for the page to finish loading
    await this.waitForLoad(url);

    // Inject document visibility overrides so page never pauses in background
    console.log(`[TabManager] Injecting document visibility overrides...`);
    await this.client.send('Runtime.evaluate', {
      expression: `
        (() => {
          try {
            Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
            Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            console.log('[OmniFlow] Visibility overrides injected successfully.');
          } catch (e) {
            console.error('[OmniFlow] Failed to inject visibility overrides:', e);
          }
        })()
      `
    }).catch(err => {
      console.warn(`[TabManager] Visibility override injection failed: ${err.message}`);
    });

    return {
      tabId: this.tabId,
      client: this.client
    };
  }

  async waitForLoad(targetUrl) {
    console.log(`[TabManager] Waiting for page load: ${targetUrl}`);
    const startTime = Date.now();
    while (Date.now() - startTime < 15000) {
      try {
        const res = await this.client.send('Runtime.evaluate', {
          expression: '({ href: window.location.href, readyState: document.readyState })',
          returnByValue: true
        });
        
        if (res && res.result && res.result.value) {
          const { href, readyState } = res.result.value;
          if (href !== 'about:blank' && readyState === 'complete') {
            console.log(`[TabManager] Page loaded successfully: ${href}`);
            return true;
          }
        }
      } catch (err) {
        // Ignore errors during navigation transition
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error(`Timeout waiting for page to load: ${targetUrl}`);
  }

  async close() {
    if (this.client) {
      await this.client.close();
    }
  }
}
