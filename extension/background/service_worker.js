/**
 * chitgit Background Service Worker (Manifest V3)
 * Initializes zero-config defaults so the extension works immediately.
 */

const DEFAULT_CONFIG = {
  aiEngineMode: 'proxy',
  backendUrl: 'http://localhost:5000',
  geminiModel: 'gemini-1.5-flash',
  commitCount: '5',
  authProvider: 'supabase',
  supabaseUrl: '',
  supabaseAnonKey: '',
  geminiApiKey: ''
};

chrome.runtime.onInstalled.addListener((details) => {
  // Pre-seed storage with robust zero-config defaults
  chrome.storage.local.get(Object.keys(DEFAULT_CONFIG), (existing) => {
    const toSet = {};
    for (const [key, val] of Object.entries(DEFAULT_CONFIG)) {
      if (existing[key] === undefined || existing[key] === null) {
        toSet[key] = val;
      }
    }
    if (Object.keys(toSet).length > 0) {
      chrome.storage.local.set(toSet);
    }
  });
  console.log('⚡ chitgit initialized with ready-to-run zero-setup defaults.');
});

// Listener for runtime messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PING') {
    sendResponse({ status: 'PONG', version: '1.1.0' });
    return true;
  }
  return false;
});
