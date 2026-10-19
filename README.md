# chitgit ⚡

**chitgit** is an AI-powered GitHub commit analysis tool and **Google Chrome Extension (Manifest V3)** with minimal frosted glassmorphism styling, user authentication (Supabase / Firebase / Local), and automated plagiarism detection powered by the **Google Gemini API**.

🌐 **Official Free Web App & Direct Download**: [https://acedik.github.io/GitLense/](https://acedik.github.io/GitLense/)  
📦 **Direct ZIP Download**: [Download chitgit (.zip)](https://acedik.github.io/GitLense/chitgit_chrome_extension.zip)  
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/acedik/GitLense&env=GEMINI_API_KEY,SUPABASE_URL,SUPABASE_ANON_KEY)

---

## 🌟 Key Features

- **Minimal Glassmorphism UI**: High-end frosted glass aesthetics with ambient glows, glowing status badges, and responsive commit preview cards.
- **⚡ Email OTP Authentication**: Built-in passwordless 6-digit OTP verification via **Supabase Auth** (or traditional email/password and local demo fallback).
- **🔒 Hidden API Key Architecture**: Google Gemini API key is kept 100% secret and protected on your **Vercel Serverless Backend**. End users do NOT need to input an API key!
- **📊 Cloud Web Dashboard**: Obsidian-black web dashboard on Vercel with real-time scan feeds, plagiarism KPI metrics, and 1-click CSV exports.
- **Chrome Extension (Manifest V3)**: Native browser extension that runs directly inside Google Chrome, Edge, and Brave.
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

## ⚙️ Configuration & Cloud Setup

### 1. Vercel Cloud Backend (Hidden API Key)
1. Deploy this repository to **Vercel**.
2. In Vercel Project Settings → **Environment Variables**, add:
   - `GEMINI_API_KEY`: Your Google AI Studio API key (kept 100% hidden).
   - `SUPABASE_URL`: Your Supabase Project URL (`https://xyz.supabase.co`).
   - `SUPABASE_ANON_KEY`: Your Supabase Anon API key.
3. In the Chrome Extension Settings (⚙️):
   - Set **AI Plagiarism Engine Mode** to `⚡ Vercel Backend Proxy (Key Hidden)`.
   - Enter your Vercel URL (e.g. `https://your-app.vercel.app`).
   - Done! You can now analyze commits without exposing your API key to any client!

### 2. Supabase Database & OTP Auth (1-Click SQL Setup)
1. Open your [Supabase Dashboard](https://supabase.com/dashboard) → **SQL Editor**.
2. Run the ready-to-use SQL schema from [`supabase/schema.sql`](file:///D:/hp/osnit/GitLense/supabase/schema.sql).
3. Under **Authentication** → **Providers** → **Email**, ensure email sign-in / OTP is enabled.


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
