/**
 * chitgit Popup Controller
 * Manages Glassmorphism UI, Auth State (Supabase / Firebase / Local),
 * Device Fingerprinting & Anti-Abuse (20 Free Search Limit), Pro Pricing Modal,
 * Scan Pipeline & CSV Export.
 */
document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements - Auth & Header
  const btnOpenAuth = document.getElementById('btn-open-auth');
  const authPanel = document.getElementById('auth-panel');
  const tabSignIn = document.getElementById('tab-sign-in');
  const tabSignUp = document.getElementById('tab-sign-up');
  const authForm = document.getElementById('auth-form');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const authConfirmGroup = document.getElementById('auth-confirm-group');
  const authConfirmPassword = document.getElementById('auth-confirm-password');
  const authSubmitLabel = document.getElementById('auth-submit-label');
  const authFeedback = document.getElementById('auth-feedback');
  const btnDismissAuth = document.getElementById('btn-dismiss-auth');
  const authUserChip = document.getElementById('auth-user-chip');
  const userAvatarInitial = document.getElementById('user-avatar-initial');
  const userEmailText = document.getElementById('user-email-text');
  const btnSignOut = document.getElementById('btn-sign-out');

  // DOM Elements - Usage & Pricing Plans
  const usageStatusDot = document.getElementById('usage-status-dot');
  const usageLabel = document.getElementById('usage-label');
  const btnShowPlans = document.getElementById('btn-show-plans');
  const pricingModal = document.getElementById('pricing-modal');
  const btnClosePricing = document.getElementById('btn-close-pricing');
  const deviceLockedAlert = document.getElementById('device-locked-alert');
  const deviceLockedReason = document.getElementById('device-locked-reason');
  const inputLicenseKey = document.getElementById('input-license-key');
  const btnActivateLicense = document.getElementById('btn-activate-license');
  const licenseFeedback = document.getElementById('license-feedback');
  const planButtons = document.querySelectorAll('.btn-select-plan');

  // DOM Elements - Repo & Settings
  const inputRepo = document.getElementById('input-repo');
  const btnDetectTab = document.getElementById('btn-detect-tab');
  const repoIndicator = document.getElementById('repo-status-indicator');

  const btnToggleSettings = document.getElementById('btn-toggle-settings');
  const settingsPanel = document.getElementById('settings-panel');
  const selectAuthProvider = document.getElementById('select-auth-provider');
  const supabaseFields = document.getElementById('supabase-config-fields');
  const inputSupabaseUrl = document.getElementById('input-supabase-url');
  const inputSupabaseKey = document.getElementById('input-supabase-key');
  const firebaseFields = document.getElementById('firebase-config-fields');
  const inputFirebaseKey = document.getElementById('input-firebase-key');

  const inputGeminiKey = document.getElementById('input-gemini-key');
  const btnToggleKeyVis = document.getElementById('btn-toggle-key-visibility');
  const inputGithubToken = document.getElementById('input-github-token');
  const selectCommitCount = document.getElementById('select-commit-count');
  const selectModel = document.getElementById('select-model');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const settingsSavedFeedback = document.getElementById('settings-saved-feedback');

  // DOM Elements - Scanner & Results
  const btnStartScan = document.getElementById('btn-start-scan');
  const progressSection = document.getElementById('progress-section');
  const progressLabel = document.getElementById('progress-status-label');
  const progressPercentage = document.getElementById('progress-percentage');
  const progressBarFill = document.getElementById('progress-bar-fill');

  const resultsSection = document.getElementById('results-section');
  const resultsList = document.getElementById('results-list');
  const btnDownloadCSV = document.getElementById('btn-download-csv');

  const statTotal = document.getElementById('stat-total');
  const statOriginal = document.getElementById('stat-original');
  const statSuspicious = document.getElementById('stat-suspicious');
  const statPlagiarized = document.getElementById('stat-plagiarized');

  // State
  let currentRecords = [];
  let currentRepoInfo = null;
  let authMode = 'sign-in'; // 'sign-in' or 'sign-up'
  let currentUserEmail = 'guest';

  // 1. Initialize Auth State & Device Usage
  await initAuthState();

  // 2. Load Stored Settings
  await loadSettings();

  // 3. Auto-detect active GitHub tab
  await detectActiveTabRepo();

  // --- Auth Event Listeners ---
  btnOpenAuth.addEventListener('click', () => {
    authPanel.classList.toggle('hidden');
    pricingModal.classList.add('hidden');
    settingsPanel.classList.add('hidden');
  });

  btnDismissAuth.addEventListener('click', () => {
    authPanel.classList.add('hidden');
  });

  tabSignIn.addEventListener('click', () => {
    setAuthMode('sign-in');
  });

  tabSignUp.addEventListener('click', () => {
    setAuthMode('sign-up');
  });

  btnSignOut.addEventListener('click', async () => {
    await AuthAPI.signOut();
    currentUserEmail = 'guest';
    updateAuthUI(null);
    await updateUsageUI();
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleAuthSubmit();
  });

  // --- Pricing & Plan Listeners ---
  const usageBar = document.querySelector('.usage-bar');
  if (usageBar) {
    usageBar.addEventListener('click', (e) => {
      if (e.target !== btnShowPlans) {
        pricingModal.classList.toggle('hidden');
        authPanel.classList.add('hidden');
        settingsPanel.classList.add('hidden');
      }
    });
  }

  btnShowPlans.addEventListener('click', (e) => {
    e.stopPropagation();
    pricingModal.classList.toggle('hidden');
    authPanel.classList.add('hidden');
    settingsPanel.classList.add('hidden');
  });

  btnClosePricing.addEventListener('click', () => {
    pricingModal.classList.add('hidden');
  });

  planButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const plan = e.target.getAttribute('data-plan');
      alert(`Redirecting to secure Stripe checkout for chitgit ${plan === 'lifetime' ? 'Lifetime Access ($39)' : 'Monthly Pro ($7.99/mo)'}...\n\n(Tip: Enter test code 'PRO_UNLIMITED' below to unlock Pro immediately!)`);
      inputLicenseKey.value = 'PRO_UNLIMITED';
      inputLicenseKey.focus();
    });
  });

  btnActivateLicense.addEventListener('click', async () => {
    const key = inputLicenseKey.value.trim();
    if (!key) {
      licenseFeedback.className = 'feedback-text error';
      licenseFeedback.textContent = 'Please enter a valid license key or promo code.';
      licenseFeedback.classList.remove('hidden');
      return;
    }

    licenseFeedback.className = 'feedback-text';
    licenseFeedback.textContent = 'Verifying license with device signature...';
    licenseFeedback.classList.remove('hidden');

    await UsageManager.upgradeToPro(key);
    await updateUsageUI();

    licenseFeedback.textContent = '✓ Pro plan unlocked successfully! Enjoy unlimited searches.';
    setTimeout(() => {
      pricingModal.classList.add('hidden');
      licenseFeedback.classList.add('hidden');
      inputLicenseKey.value = '';
    }, 2000);
  });

  // --- General Event Listeners ---
  btnDetectTab.addEventListener('click', detectActiveTabRepo);
  inputRepo.addEventListener('input', () => {
    updateRepoIndicator(inputRepo.value);
  });

  btnToggleSettings.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
    authPanel.classList.add('hidden');
    pricingModal.classList.add('hidden');
  });

  selectAuthProvider.addEventListener('change', () => {
    toggleProviderFields(selectAuthProvider.value);
  });

  btnToggleKeyVis.addEventListener('click', () => {
    inputGeminiKey.type = inputGeminiKey.type === 'password' ? 'text' : 'password';
  });

  btnSaveSettings.addEventListener('click', async () => {
    await saveSettings();
  });

  btnStartScan.addEventListener('click', async () => {
    await runAnalysisPipeline();
  });

  btnDownloadCSV.addEventListener('click', async () => {
    if (currentRecords.length === 0) return;
    const csvContent = CSVExporter.generateCSV(currentRecords);
    const repoSlug = currentRepoInfo ? `${currentRepoInfo.owner}_${currentRepoInfo.repo}` : 'chitgit';
    const filename = `chitgit_${repoSlug}_plagiarism_${new Date().toISOString().slice(0, 10)}.csv`;
    await CSVExporter.downloadCSV(csvContent, filename);
  });

  // --- Auth Functions ---
  async function initAuthState() {
    const config = await AuthAPI.getConfig();
    if (config.user && config.user.email) {
      currentUserEmail = config.user.email;
      await UsageManager.registerDeviceAccount(currentUserEmail);
    } else {
      currentUserEmail = 'guest';
    }
    updateAuthUI(config.user);
    await updateUsageUI();
  }

  function updateAuthUI(user) {
    if (user && user.email) {
      authUserChip.classList.remove('hidden');
      btnOpenAuth.classList.add('hidden');
      authPanel.classList.add('hidden');
      userAvatarInitial.textContent = user.email.charAt(0).toUpperCase();
      userEmailText.textContent = user.email;
    } else {
      authUserChip.classList.add('hidden');
      btnOpenAuth.classList.remove('hidden');
    }
  }

  // --- Usage & Device Limit UI Enforcement ---
  async function updateUsageUI() {
    const status = await UsageManager.getUsageStatus(currentUserEmail);

    if (status.isPro) {
      usageLabel.textContent = 'Pro Unlimited Access';
      usageStatusDot.className = 'usage-dot pro';
      btnShowPlans.textContent = '★ PRO Active';
      btnStartScan.classList.remove('btn-locked');
      btnStartScan.disabled = false;
      btnStartScan.innerHTML = '<span class="btn-icon">⚡</span><span>Analyze Commits & Export CSV</span>';
      deviceLockedAlert.classList.add('hidden');
    } else {
      usageLabel.textContent = `${status.remainingScans}/${status.maxFreeScans} Free Scans Left`;

      if (status.remainingScans > 5) {
        usageStatusDot.className = 'usage-dot';
      } else if (status.remainingScans > 0) {
        usageStatusDot.className = 'usage-dot warning';
      } else {
        usageStatusDot.className = 'usage-dot danger';
      }

      if (status.isLocked) {
        btnStartScan.classList.add('btn-locked');
        btnStartScan.disabled = false;
        btnStartScan.innerHTML = '<span>🔒 Free Search Limit Reached - Upgrade to Pro</span>';
        deviceLockedAlert.classList.remove('hidden');
        deviceLockedReason.textContent = status.reason;
      } else {
        btnStartScan.classList.remove('btn-locked');
        btnStartScan.disabled = false;
        btnStartScan.innerHTML = '<span class="btn-icon">⚡</span><span>Analyze Commits & Export CSV</span>';
        deviceLockedAlert.classList.add('hidden');
      }
    }
    return status;
  }

  function setAuthMode(mode) {
    authMode = mode;
    authFeedback.classList.add('hidden');
    if (mode === 'sign-in') {
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      authConfirmGroup.classList.add('hidden');
      authSubmitLabel.textContent = 'Sign In';
      authConfirmPassword.removeAttribute('required');
    } else {
      tabSignUp.classList.add('active');
      tabSignIn.classList.remove('active');
      authConfirmGroup.classList.remove('hidden');
      authSubmitLabel.textContent = 'Create Account';
      authConfirmPassword.setAttribute('required', 'true');
    }
  }

  async function handleAuthSubmit() {
    const email = authEmail.value.trim();
    const password = authPassword.value;

    authFeedback.classList.remove('hidden', 'error');
    authFeedback.textContent = 'Authenticating...';

    if (authMode === 'sign-up') {
      const confirm = authConfirmPassword.value;
      if (password !== confirm) {
        authFeedback.classList.add('error');
        authFeedback.textContent = 'Passwords do not match.';
        return;
      }
    }

    try {
      let user;
      if (authMode === 'sign-in') {
        user = await AuthAPI.signIn({ email, password });
      } else {
        user = await AuthAPI.signUp({ email, password });
      }

      currentUserEmail = user.email;
      await UsageManager.registerDeviceAccount(currentUserEmail);
      authFeedback.textContent = `Welcome, ${user.email}!`;
      setTimeout(async () => {
        updateAuthUI(user);
        authForm.reset();
        authFeedback.classList.add('hidden');
        await updateUsageUI();
      }, 1000);
    } catch (err) {
      authFeedback.classList.add('error');
      authFeedback.textContent = err.message || 'Authentication error';
    }
  }

  function toggleProviderFields(provider) {
    supabaseFields.classList.toggle('hidden', provider !== 'supabase');
    firebaseFields.classList.toggle('hidden', provider !== 'firebase');
  }

  // --- Settings Persistence ---
  async function loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([
        'authProvider',
        'supabaseUrl',
        'supabaseAnonKey',
        'firebaseApiKey',
        'geminiApiKey',
        'githubToken',
        'commitCount',
        'geminiModel'
      ], (data) => {
        inputGeminiKey.value = data.geminiApiKey || '';
        if (data.githubToken) inputGithubToken.value = data.githubToken;
        if (data.commitCount) selectCommitCount.value = data.commitCount;
        selectModel.value = data.geminiModel || 'gemini-flash-latest';

        if (data.authProvider) {
          selectAuthProvider.value = data.authProvider;
          toggleProviderFields(data.authProvider);
        }
        if (data.supabaseUrl) inputSupabaseUrl.value = data.supabaseUrl;
        if (data.supabaseAnonKey) inputSupabaseKey.value = data.supabaseAnonKey;
        if (data.firebaseApiKey) inputFirebaseKey.value = data.firebaseApiKey;

        if (!inputGeminiKey.value) {
          settingsPanel.classList.remove('hidden');
        }
      });
    }
  }

  async function saveSettings() {
    const authProvider = selectAuthProvider.value;
    const supabaseUrl = inputSupabaseUrl.value.trim();
    const supabaseAnonKey = inputSupabaseKey.value.trim();
    const firebaseApiKey = inputFirebaseKey.value.trim();
    const geminiApiKey = inputGeminiKey.value.trim();
    const githubToken = inputGithubToken.value.trim();
    const commitCount = selectCommitCount.value;
    const geminiModel = selectModel.value;

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        authProvider,
        supabaseUrl,
        supabaseAnonKey,
        firebaseApiKey,
        geminiApiKey,
        githubToken,
        commitCount,
        geminiModel
      }, () => {
        settingsSavedFeedback.classList.remove('hidden');
        setTimeout(() => {
          settingsSavedFeedback.classList.add('hidden');
        }, 2500);
      });
    }
  }

  // --- Tab Detection ---
  async function detectActiveTabRepo() {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
      inputRepo.value = 'lukecybers/luke-test-';
      updateRepoIndicator(inputRepo.value);
      return;
    }

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.url) {
        const repoInfo = GitHubAPI.extractRepoInfo(activeTab.url);
        if (repoInfo) {
          inputRepo.value = `${repoInfo.owner}/${repoInfo.repo}`;
          updateRepoIndicator(inputRepo.value);
          return;
        }
      }
    } catch (e) {
      console.warn('Tab query error:', e);
    }

    if (!inputRepo.value) {
      inputRepo.value = 'lukecybers/luke-test-';
    }
    updateRepoIndicator(inputRepo.value);
  }

  function updateRepoIndicator(val) {
    currentRepoInfo = GitHubAPI.extractRepoInfo(val);
    if (currentRepoInfo) {
      repoIndicator.classList.add('detected');
    } else {
      repoIndicator.classList.remove('detected');
    }
  }

  // --- Scan Pipeline ---
  async function runAnalysisPipeline() {
    // 0. Verify device free search limits
    const usage = await UsageManager.getUsageStatus(currentUserEmail);
    if (usage.isLocked) {
      pricingModal.classList.remove('hidden');
      deviceLockedAlert.classList.remove('hidden');
      deviceLockedReason.textContent = usage.reason;
      alert(`Search Limit Reached:\n\n${usage.reason}`);
      return;
    }

    const repoInfo = GitHubAPI.extractRepoInfo(inputRepo.value);
    if (!repoInfo) {
      alert('Please enter a valid GitHub repository (e.g., owner/repo or full GitHub URL).');
      inputRepo.focus();
      return;
    }

    const geminiApiKey = inputGeminiKey.value.trim();
    if (!geminiApiKey) {
      settingsPanel.classList.remove('hidden');
      alert('Please enter your Google Gemini API Key in Settings to run plagiarism analysis.');
      inputGeminiKey.focus();
      return;
    }

    const githubToken = inputGithubToken.value.trim();
    const commitLimit = parseInt(selectCommitCount.value, 10) || 5;
    const model = selectModel.value || 'gemini-flash-latest';

    // UI state reset
    currentRecords = [];
    resultsList.innerHTML = '';
    btnStartScan.disabled = true;
    progressSection.classList.remove('hidden');
    resultsSection.classList.remove('hidden');

    statTotal.textContent = '0';
    statOriginal.textContent = '0';
    statSuspicious.textContent = '0';
    statPlagiarized.textContent = '0';

    updateProgress(0, `Fetching recent commits for ${repoInfo.owner}/${repoInfo.repo}...`);

    try {
      const commits = await GitHubAPI.fetchCommits({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        limit: commitLimit,
        token: githubToken
      });

      if (!commits || commits.length === 0) {
        throw new Error('No commits found in repository.');
      }

      const totalCommits = commits.length;
      updateProgress(10, `Found ${totalCommits} commits. Beginning diff analysis...`);

      let originalCount = 0;
      let suspiciousCount = 0;
      let plagiarizedCount = 0;

      for (let i = 0; i < totalCommits; i++) {
        const item = commits[i];
        const sha = item.sha;
        const shortSha = sha.substring(0, 7);

        updateProgress(
          Math.round(10 + (i / totalCommits) * 80),
          `Analyzing commit ${i + 1}/${totalCommits} (${shortSha})...`
        );

        const details = await GitHubAPI.fetchCommitDetails({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          sha: sha,
          token: githubToken
        });

        let aiResult;
        try {
          aiResult = await GeminiAPI.analyzeCommitPlagiarism({
            apiKey: geminiApiKey,
            model: model,
            repo: `${repoInfo.owner}/${repoInfo.repo}`,
            sha: sha,
            message: details.message,
            diff: details.diff
          });
        } catch (aiErr) {
          console.error(`AI analysis failed for ${shortSha}:`, aiErr);
          aiResult = {
            verdict: 'SUSPICIOUS',
            plagiarism_score: 50,
            plagiarism_category: 'AI Analysis Error',
            flagged_code_snippets: [],
            reasoning: `Analysis failed: ${aiErr.message}`
          };
        }

        const record = {
          commit: details,
          ai_analysis: aiResult
        };

        currentRecords.push(record);

        const verdict = (aiResult.verdict || '').toUpperCase();
        if (verdict === 'ORIGINAL') originalCount++;
        else if (verdict === 'PLAGIARIZED') plagiarizedCount++;
        else suspiciousCount++;

        statTotal.textContent = String(currentRecords.length);
        statOriginal.textContent = String(originalCount);
        statSuspicious.textContent = String(suspiciousCount);
        statPlagiarized.textContent = String(plagiarizedCount);

        renderCommitCard(record);
      }

      // Record successful search against device usage limit
      await UsageManager.recordScan(currentUserEmail);
      await updateUsageUI();

      updateProgress(100, 'All commits analyzed! Generating CSV report...');
      
      const csvData = CSVExporter.generateCSV(currentRecords);
      const filename = `chitgit_${repoInfo.owner}_${repoInfo.repo}_plagiarism_${new Date().toISOString().slice(0, 10)}.csv`;
      await CSVExporter.downloadCSV(csvData, filename);

      setTimeout(() => {
        updateProgress(100, `Done! Downloaded ${filename}`);
      }, 1000);

    } catch (err) {
      console.error('Pipeline error:', err);
      alert(`Error during analysis: ${err.message}`);
      updateProgress(0, `Error: ${err.message}`);
    } finally {
      // Re-evaluate button state according to updated usage status
      await updateUsageUI();
    }
  }

  function updateProgress(percent, label) {
    progressBarFill.style.width = `${percent}%`;
    progressPercentage.textContent = `${percent}%`;
    progressLabel.textContent = label;
  }

  function renderCommitCard(record) {
    const commit = record.commit;
    const ai = record.ai_analysis;
    const shortSha = commit.sha ? commit.sha.substring(0, 7) : 'Unknown';
    const verdict = ai.verdict || 'SUSPICIOUS';
    const score = ai.plagiarism_score !== undefined ? `${ai.plagiarism_score}%` : 'N/A';

    const card = document.createElement('div');
    card.className = 'commit-card glass-card';

    const hasSnippets = Array.isArray(ai.flagged_code_snippets) && ai.flagged_code_snippets.length > 0;
    const snippetsHTML = hasSnippets
      ? `<div class="commit-snippets">${escapeHTML(ai.flagged_code_snippets.join('\n---\n'))}</div>`
      : '';

    const safeUrl = (commit.html_url && /^https:\/\/github\.com\//i.test(commit.html_url))
      ? escapeHTML(commit.html_url)
      : '#';

    card.innerHTML = `
      <div class="commit-header">
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="commit-sha-link">${shortSha} ↗</a>
        <span class="verdict-badge verdict-${verdict}">${verdict} (${score})</span>
      </div>
      <div class="commit-msg">${escapeHTML(commit.message || 'No commit message')}</div>
      <div class="commit-meta">
        <span>👤 ${escapeHTML(commit.author.name)}</span>
        <span>📁 ${commit.stats.total_files} files (+${commit.stats.additions}/-${commit.stats.deletions})</span>
      </div>
      <div class="commit-reasoning">${escapeHTML(ai.reasoning || '')}</div>
      ${snippetsHTML}
    `;

    resultsList.prepend(card);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
});
