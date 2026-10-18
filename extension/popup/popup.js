/**
 * GitLense Popup Controller
 * Manages Glassmorphism UI, Auth State (Supabase / Firebase / Local), Scan Pipeline & CSV Export.
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

  // 1. Initialize Auth State
  await initAuthState();

  // 2. Load Stored Settings
  await loadSettings();

  // 3. Auto-detect active GitHub tab
  await detectActiveTabRepo();

  // --- Auth Event Listeners ---
  btnOpenAuth.addEventListener('click', () => {
    authPanel.classList.toggle('hidden');
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
    updateAuthUI(null);
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleAuthSubmit();
  });

  // --- General Event Listeners ---
  btnDetectTab.addEventListener('click', detectActiveTabRepo);
  inputRepo.addEventListener('input', () => {
    updateRepoIndicator(inputRepo.value);
  });

  btnToggleSettings.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
    authPanel.classList.add('hidden');
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
    const repoSlug = currentRepoInfo ? `${currentRepoInfo.owner}_${currentRepoInfo.repo}` : 'gitlense';
    const filename = `gitlense_${repoSlug}_plagiarism_${new Date().toISOString().slice(0, 10)}.csv`;
    await CSVExporter.downloadCSV(csvContent, filename);
  });

  // --- Auth Functions ---
  async function initAuthState() {
    const config = await AuthAPI.getConfig();
    updateAuthUI(config.user);
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

      authFeedback.textContent = `Welcome, ${user.email}!`;
      setTimeout(() => {
        updateAuthUI(user);
        authForm.reset();
        authFeedback.classList.add('hidden');
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
        const defaultKey = 'AQ.Ab8RN6LjjBwHW6qYQE1lDLvE7TTm1ZMZa99GEvwlb61BksyBSQ';
        inputGeminiKey.value = data.geminiApiKey || defaultKey;
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

      updateProgress(100, 'All commits analyzed! Generating CSV report...');
      
      const csvData = CSVExporter.generateCSV(currentRecords);
      const filename = `gitlense_${repoInfo.owner}_${repoInfo.repo}_plagiarism_${new Date().toISOString().slice(0, 10)}.csv`;
      await CSVExporter.downloadCSV(csvData, filename);

      setTimeout(() => {
        updateProgress(100, `Done! Downloaded ${filename}`);
      }, 1000);

    } catch (err) {
      console.error('Pipeline error:', err);
      alert(`Error during analysis: ${err.message}`);
      updateProgress(0, `Error: ${err.message}`);
    } finally {
      btnStartScan.disabled = false;
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

    card.innerHTML = `
      <div class="commit-header">
        <a href="${commit.html_url}" target="_blank" class="commit-sha-link">${shortSha} ↗</a>
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
