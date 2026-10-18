/**
 * chitgit Usage & Plan Manager
 * Enforces a strict 20-free-search limit per device and prevents multi-account credit abuse.
 */
const UsageManager = {
  MAX_FREE_SCANS: 20,

  /**
   * Retrieves current device usage status and anti-abuse checks.
   *
   * @param {string} currentUserEmail Current logged in email or 'guest'
   * @returns {Promise<Object>} Usage details and lock status
   */
  async getUsageStatus(currentUserEmail = 'guest') {
    const deviceId = await DeviceFingerprint.getDeviceId();
    const data = await this._loadDeviceRecord(deviceId);

    const email = (currentUserEmail || 'guest').trim().toLowerCase();
    const associatedEmails = Array.isArray(data.associated_emails) ? data.associated_emails : [];
    
    // Check if multiple accounts have logged in or are being attempted on this same device
    const isNewEmailOnDevice = email !== 'guest' && !associatedEmails.includes(email);
    const allEmails = isNewEmailOnDevice ? [...associatedEmails, email] : associatedEmails;
    const multiAccountDetected = allEmails.length > 1;

    const used = typeof data.total_scans_used === 'number' ? data.total_scans_used : 0;
    const isPro = !!data.is_pro;
    const max = this.MAX_FREE_SCANS;

    let isLocked = false;
    let reason = '';
    let remaining = Math.max(0, max - used);

    if (!isPro) {
      if (multiAccountDetected) {
        // Multi-account abuse detected on same hardware: immediately terminate free credits
        isLocked = true;
        remaining = 0;
        reason = `Anti-Abuse Policy Triggered: Multiple accounts (${allEmails.join(', ')}) detected on this device. Free trial searches are strictly limited to 1 account per physical device. Free trial credits have ended. Upgrade to Pro to continue.`;
      } else if (used >= max) {
        isLocked = true;
        remaining = 0;
        reason = `Free Plan Limit Reached: This device has used all ${max} free searches. Upgrade to Pro to unlock unlimited searches.`;
      }
    }

    return {
      deviceId,
      totalScansUsed: used,
      maxFreeScans: max,
      remainingScans: isPro ? Infinity : remaining,
      isPro,
      isLocked,
      reason,
      multiAccountDetected,
      associatedEmails: allEmails,
      associatedEmailsCount: allEmails.length
    };
  },

  /**
   * Registers an account email with the device identity upon login or signup.
   *
   * @param {string} currentUserEmail
   */
  async registerDeviceAccount(currentUserEmail) {
    if (!currentUserEmail || currentUserEmail === 'guest') return;
    const deviceId = await DeviceFingerprint.getDeviceId();
    const data = await this._loadDeviceRecord(deviceId);

    const email = currentUserEmail.trim().toLowerCase();
    const associatedEmails = Array.isArray(data.associated_emails) ? [...data.associated_emails] : [];

    if (!associatedEmails.includes(email)) {
      associatedEmails.push(email);
      const updatedData = {
        ...data,
        device_id: deviceId,
        associated_emails: associatedEmails,
        last_seen_at: new Date().toISOString()
      };
      await this._saveDeviceRecord(deviceId, updatedData);
      return updatedData;
    }
    return data;
  },

  /**
   * Increments the scan count for this device and registers the current email.
   *
   * @param {string} currentUserEmail
   */
  async recordScan(currentUserEmail = 'guest') {
    const deviceId = await DeviceFingerprint.getDeviceId();
    const data = await this._loadDeviceRecord(deviceId);

    const email = (currentUserEmail || 'guest').trim().toLowerCase();
    const associatedEmails = Array.isArray(data.associated_emails) ? [...data.associated_emails] : [];

    if (email !== 'guest' && !associatedEmails.includes(email)) {
      associatedEmails.push(email);
    }

    const currentUsed = typeof data.total_scans_used === 'number' ? data.total_scans_used : 0;
    const updatedData = {
      ...data,
      device_id: deviceId,
      total_scans_used: currentUsed + 1,
      associated_emails: associatedEmails,
      last_scan_at: new Date().toISOString()
    };

    await this._saveDeviceRecord(deviceId, updatedData);
    return updatedData;
  },

  /**
   * Upgrades the device to Pro (unlimited searches)
   */
  async upgradeToPro(licenseKey = 'PRO_LIFETIME') {
    const deviceId = await DeviceFingerprint.getDeviceId();
    const data = await this._loadDeviceRecord(deviceId);

    const updatedData = {
      ...data,
      is_pro: true,
      license_key: licenseKey,
      upgraded_at: new Date().toISOString()
    };

    await this._saveDeviceRecord(deviceId, updatedData);
    return updatedData;
  },

  /**
   * Internal storage loaders with sync fallback
   */
  async _loadDeviceRecord(deviceId) {
    return new Promise(resolve => {
      const storageKey = `usage_${deviceId}`;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([storageKey], (res) => {
          if (res && res[storageKey]) {
            resolve(res[storageKey]);
          } else if (chrome.storage.sync) {
            chrome.storage.sync.get([storageKey], (syncRes) => {
              if (syncRes && syncRes[storageKey]) {
                const payload = {};
                payload[storageKey] = syncRes[storageKey];
                chrome.storage.local.set(payload);
                resolve(syncRes[storageKey]);
              } else {
                resolve({
                  device_id: deviceId,
                  total_scans_used: 0,
                  associated_emails: [],
                  is_pro: false
                });
              }
            });
          } else {
            resolve({
              device_id: deviceId,
              total_scans_used: 0,
              associated_emails: [],
              is_pro: false
            });
          }
        });
      } else {
        const stored = localStorage.getItem(storageKey);
        resolve(stored ? JSON.parse(stored) : {
          device_id: deviceId,
          total_scans_used: 0,
          associated_emails: [],
          is_pro: false
        });
      }
    });
  },

  async _saveDeviceRecord(deviceId, record) {
    return new Promise(resolve => {
      const storageKey = `usage_${deviceId}`;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const payload = {};
        payload[storageKey] = record;
        chrome.storage.local.set(payload, () => {
          if (chrome.storage.sync) {
            chrome.storage.sync.set(payload, () => resolve());
          } else {
            resolve();
          }
        });
      } else {
        localStorage.setItem(storageKey, JSON.stringify(record));
        resolve();
      }
    });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UsageManager;
}
