# chitgit ⚡

**chitgit** is an AI-powered GitHub commit analysis tool and **Google Chrome Extension (Manifest V3)** with minimal frosted glassmorphism styling, user authentication (Supabase / Firebase / Local), and automated plagiarism detection powered by the **Google Gemini API**.

---

## 🌟 Key Features

- **Minimal Glassmorphism UI**: High-end frosted glass aesthetics with ambient glows, glowing status badges, and responsive commit preview cards.
- **Authentication System**: Built-in Sign In and Sign Up tabs supporting **Supabase Auth**, **Firebase Auth**, and local mock storage out of the box.
- **Chrome Extension (Manifest V3)**: Native browser extension that runs directly inside Google Chrome without requiring external servers.
- **GitHub In-Page Integration**: Auto-detects GitHub repositories and injects a one-click scan button directly into repository and commit pages.
- **AI Plagiarism Detection (Google Gemini)**: Analyzes commit diffs using structured JSON schemas to classify code changes into:
  - `ORIGINAL`: Custom, unique architecture or standard domain-specific implementation.
  - `SUSPICIOUS`: Obfuscated patterns, variable renaming mimicking online answers, or uncredited snippets.
  - `PLAGIARIZED`: Verbatim copies of LeetCode / textbook algorithms, open-source repositories, or online tutorials.
  - `BOILERPLATE_OR_LIBRARY`: Standard framework templates or configuration boilerplate.
- **Confidence Scoring & Flagged Code**: Scores each commit from 0% (original) to 100% (verbatim copy) and highlights specific copied code snippets with objective reasoning.
- **RFC 4180 CSV Export**: One-click export to CSV with commit SHAs, author details, dates, file diff stats, plagiarism scores, flagged snippets, and AI justifications.

---

## 🚀 Chrome Extension Installation

1. Open Google Chrome and navigate to:
   ```text
   chrome://extensions
   ```
2. Enable **Developer mode** using the toggle switch in the top right corner.
3. Click the **Load unpacked** button.
4. Select the `extension/` folder inside this repository:
   ```text
   D:\hp\osnit\GitLense\extension
   ```
5. The **chitgit - Commit Plagiarism & CSV Exporter** icon will now appear in your Chrome toolbar!

---

## ⚙️ Configuration

1. Click the **chitgit** icon in your Chrome toolbar.
2. Open **Settings** (⚙️ button).
3. Enter your **Google Gemini API Key**:
   - [Get a free API key at Google AI Studio](https://aistudio.google.com/app/apikey).
4. *(Optional)* Select your **Authentication Provider**:
   - **Local / Demo Storage** (default, no setup required)
   - **Supabase Auth** (enter Supabase Project URL & Anon Key)
   - **Firebase Auth** (enter Firebase Web API Key)
5. *(Optional)* Enter a **GitHub Personal Access Token** to increase GitHub API rate limits from 60 to 5,000 requests per hour.
6. Select your commit scan depth (e.g., 5, 10, 20, or 50 commits) and preferred Gemini model (`gemini-flash-latest` recommended).
7. Click **Save Settings**.

---

## 💻 How to Use

### Method A: Direct from Extension Popup
1. Open any GitHub repository (e.g. `https://github.com/lukecybers/luke-test-`).
2. Click the **chitgit** extension icon (it auto-detects the repository from the active tab).
3. Click **"Analyze Commits & Export CSV"**.
4. Watch the real-time progress bar analyze each commit diff with Gemini.
5. Review the live results and automatically download the generated CSV report (`chitgit_<repo>_plagiarism_<date>.csv`).

### Method B: In-page GitHub Button
1. While browsing any repository on `github.com`, look for the purple **⚡ chitgit Plagiarism Scan** button in the repository header.
2. Click it for quick access and launch the scan.

---

## 📊 CSV Export Schema

The exported CSV file includes the following columns:

| Column | Description |
| :--- | :--- |
| `Commit SHA` | Full Git commit hash |
| `Commit URL` | Direct link to commit view on GitHub |
| `Author Name` | Commit author name |
| `Author Email` | Commit author email address |
| `Date (UTC)` | ISO timestamp of the commit |
| `Commit Message` | Commit headline and message |
| `Files Changed` | Count of changed files |
| `Additions` | Lines added |
| `Deletions` | Lines removed |
| `Plagiarism Verdict` | `ORIGINAL`, `SUSPICIOUS`, `PLAGIARIZED`, or `BOILERPLATE_OR_LIBRARY` |
| `Plagiarism Score (%)` | Integer score from 0 (original) to 100 (verbatim copy) |
| `Plagiarism Category` | Classification type (e.g., LeetCode, Textbook Algorithm, Template) |
| `Flagged Snippets` | Specific suspicious code blocks identified by Gemini |
| `AI Analysis & Notes` | Objective rationale explaining the evaluation |

---

## 📁 Repository Structure

```
chitgit/
├── extension/                     # Chrome Extension (Manifest V3)
│   ├── manifest.json              # Extension manifest (chitgit)
│   ├── icons/                     # Extension branding icons (16, 48, 128px)
│   ├── popup/                     # Frosted glassmorphism interface
│   │   ├── popup.html             # HTML layout, Auth modal & settings
│   │   ├── popup.css              # Minimal glassmorphism styling
│   │   └── popup.js               # Reactive controller & scan pipeline
│   ├── content/                   # Content scripts injected into GitHub
│   │   ├── content.js             # Button injector & SPA observer
│   │   └── content.css            # Primer-matching button styling
│   ├── background/                # Background service worker
│   │   └── service_worker.js      # Lifecycle & default settings
│   └── lib/                       # Core client modules
│       ├── auth_api.js            # Supabase / Firebase / Local Auth API
│       ├── github_api.js          # GitHub REST API client & diff parser
│       ├── gemini_api.js          # Google Gemini AI plagiarism analyzer
│       └── csv_exporter.js        # RFC 4180 CSV generator & downloader
└── README.md                      # Project overview & documentation
```

---

## 🔒 Security & Privacy

- **Client-Side Only**: Your Gemini API key, GitHub tokens, and auth sessions are stored exclusively in your local browser storage (`chrome.storage.local`) and are never sent to third-party tracking servers.
- **Targeted Diff Evaluation**: Only public repository commit diffs that you explicitly scan are sent directly to Google's official Gemini endpoint. Binary assets, minified bundles, and sensitive lockfiles are automatically filtered out.
