/**
 * chitgit Background Service Worker (Manifest V3)
 */

const DEFAULT_CONFIG = {
  geminiApiKey: '',
  geminiModel: 'gemini-flash-latest',
  commitCount: '5'
};

chrome.runtime.onInstalled.addListener((details) => {
  // Set defaults in chrome.storage.local
  chrome.storage.local.get(Object.keys(DEFAULT_CONFIG), (existing) => {
    const toSet = {};
    for (const [key, val] of Object.entries(DEFAULT_CONFIG)) {
      if (!existing[key]) {
        toSet[key] = val;
      }
    }
    if (Object.keys(toSet).length > 0) {
      chrome.storage.local.set(toSet);
    }
  });
  console.log('chitgit extension installed successfully with default Gemini configuration.');
});

// Listener for runtime messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PING') {
    sendResponse({ status: 'PONG' });
    return true;
  }
  return false;
});
