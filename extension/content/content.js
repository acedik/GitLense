/**
 * chitgit GitHub Content Script
 * Injects one-click plagiarism analysis button directly into GitHub repository pages.
 */
(() => {
  // Prevent duplicate injections
  if (window.__chitgit_injected) return;
  window.__chitgit_injected = true;

  function getRepoInfo() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const owner = parts[0];
      const repo = parts[1];
      // Skip non-repo GitHub paths
      const reserved = ['settings', 'marketplace', 'explore', 'topics', 'trending', 'orgs', 'users'];
      if (!reserved.includes(owner.toLowerCase())) {
        return { owner, repo };
      }
    }
    return null;
  }

  function injectChitGitButton() {
    const repoInfo = getRepoInfo();
    if (!repoInfo) return;

    if (document.getElementById('chitgit-btn-injected')) return;

    // Candidates for injection point on GitHub
    const targets = [
      document.querySelector('.file-navigation'), // Code tab next to "Code" button
      document.querySelector('#repository-details-container ul'),
      document.querySelector('.pagehead-actions'),
      document.querySelector('[data-component="PH_Actions"]'),
      document.querySelector('[data-hotkey="w"]')?.parentElement, // Branch selector row
      document.querySelector('#repo-title-component')?.parentElement
    ];

    const target = targets.find(el => el !== null);
    if (!target) return;

    const btn = document.createElement('button');
    btn.id = 'chitgit-btn-injected';
    btn.className = 'chitgit-gh-btn';
    btn.innerHTML = `<span class="chitgit-icon">⚡</span><span>chitgit Plagiarism Scan</span>`;
    btn.title = `Scan commits for plagiarism and export CSV for ${repoInfo.owner}/${repoInfo.repo}`;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openQuickModal(repoInfo);
    });

    target.appendChild(btn);
  }

  function openQuickModal(repoInfo) {
    if (document.getElementById('chitgit-quick-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'chitgit-quick-modal';
    overlay.className = 'chitgit-overlay';

    overlay.innerHTML = `
      <div class="chitgit-modal">
        <div class="chitgit-modal-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;">⚡</span>
            <span class="chitgit-modal-title">chitgit Plagiarism Checker</span>
          </div>
          <button class="chitgit-modal-close" id="chitgit-close-btn">&times;</button>
        </div>
        <div class="chitgit-modal-body">
          <p>Ready to inspect commits and detect code plagiarism for:</p>
          <p style="margin: 8px 0; font-family: monospace; font-size: 14px; color: #a5b4fc; background: #0f172a; padding: 6px 10px; border-radius: 6px;">
            ${repoInfo.owner}/${repoInfo.repo}
          </p>
          <p style="margin-top: 10px;">
            Click the <strong>chitgit icon</strong> in your Chrome extension toolbar (top right) to configure your Gemini API Key, customize commit depth, and download the full <strong>CSV report</strong>.
          </p>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('chitgit-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => overlay.remove());
    }
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // Initial attempt
  injectChitGitButton();

  // Handle GitHub Turbo / soft page transitions
  document.addEventListener('turbo:load', injectChitGitButton);
  document.addEventListener('turbo:render', injectChitGitButton);
  document.addEventListener('pjax:end', injectChitGitButton);

  const observer = new MutationObserver(() => {
    if (!document.getElementById('chitgit-btn-injected')) {
      injectChitGitButton();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
