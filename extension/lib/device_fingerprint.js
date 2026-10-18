/**
 * chitgit Device Fingerprint Engine
 * Collects persistent hardware, display, and browser environment signals to establish
 * a tamper-resistant device identity for free-tier abuse prevention.
 */
const DeviceFingerprint = {
  /**
   * Generates or retrieves the persistent device identity.
   * Combines hardware attributes, canvas hashing, and chrome.storage sync UUID.
   */
  async getDeviceId() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['chitgit_device_id'], async (result) => {
          if (result && result.chitgit_device_id) {
            resolve(result.chitgit_device_id);
          } else if (chrome.storage.sync) {
            chrome.storage.sync.get(['chitgit_sync_device_id'], async (syncRes) => {
              if (syncRes && syncRes.chitgit_sync_device_id) {
                chrome.storage.local.set({ chitgit_device_id: syncRes.chitgit_sync_device_id });
                resolve(syncRes.chitgit_sync_device_id);
              } else {
                const newId = await this._generateDeviceFingerprint();
                chrome.storage.local.set({ chitgit_device_id: newId });
                chrome.storage.sync.set({ chitgit_sync_device_id: newId });
                resolve(newId);
              }
            });
          } else {
            const newId = await this._generateDeviceFingerprint();
            chrome.storage.local.set({ chitgit_device_id: newId });
            resolve(newId);
          }
        });
      } else {
        let stored = localStorage.getItem('chitgit_device_id');
        if (!stored) {
          stored = this._generateQuickHash();
          localStorage.setItem('chitgit_device_id', stored);
        }
        resolve(stored);
      }
    });
  },

  /**
   * Extracts hardware and environment metrics to construct a unique fingerprint
   */
  async _generateDeviceFingerprint() {
    const components = [];

    // 1. Hardware Concurrency (CPU cores)
    components.push(`cores:${navigator.hardwareConcurrency || 4}`);

    // 2. Screen Dimensions & Color Depth
    if (typeof screen !== 'undefined') {
      components.push(`res:${screen.width}x${screen.height}`);
      components.push(`avail:${screen.availWidth}x${screen.availHeight}`);
      components.push(`depth:${screen.colorDepth}`);
      components.push(`pixelRatio:${window.devicePixelRatio || 1}`);
    }

    // 3. Timezone & Locale
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      components.push(`tz:${tz}`);
    } catch (_) {}

    // 4. Platform & User Agent Architecture
    components.push(`platform:${navigator.platform || 'unknown'}`);
    components.push(`lang:${navigator.language || 'en'}`);

    // 5. Canvas Fingerprint Hash
    const canvasHash = this._getCanvasFingerprint();
    components.push(`canvas:${canvasHash}`);

    const rawString = components.join('|');
    return 'dev_' + this._hashString(rawString);
  },

  /**
   * Generates a canvas rendering hash specific to the GPU and graphics driver
   */
  _getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 30;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'nocanvas';

      ctx.textBaseline = 'top';
      ctx.font = '14px "Arial", sans-serif';
      ctx.fillStyle = '#f60';
      ctx.fillRect(10, 1, 62, 20);

      ctx.fillStyle = '#069';
      ctx.fillText('chitgit_fp_v1', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('chitgit_fp_v1', 4, 17);

      return this._hashString(canvas.toDataURL());
    } catch (_) {
      return 'canvas_err';
    }
  },

  /**
   * Simple, fast 32-bit FNV-1a hash algorithm
   */
  _hashString(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  },

  _generateQuickHash() {
    return 'dev_' + Math.random().toString(36).substring(2, 12);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DeviceFingerprint;
}
