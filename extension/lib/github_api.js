/**
 * chitgit GitHub REST API Client
 */
const GitHubAPI = {
  /**
   * Parse owner and repository from a GitHub URL or string.
   * Supports:
   *  - https://github.com/owner/repo
   *  - https://github.com/owner/repo/tree/main
   *  - https://github.com/owner/repo/commits/...
   *  - owner/repo
   */
  extractRepoInfo(urlOrPath) {
    if (!urlOrPath) return null;
    let clean = urlOrPath.trim().replace(/\/+$/, '');

    // Match github.com/:owner/:repo
    const webMatch = clean.match(/^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i);
    if (webMatch) {
      return {
        owner: webMatch[1],
        repo: webMatch[2].replace(/\.git$/, '')
      };
    }

    // Match "owner/repo" shorthand (allowing optional trailing slash or .git)
    const shortMatch = clean.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/);
    if (shortMatch) {
      return {
        owner: shortMatch[1],
        repo: shortMatch[2]
      };
    }

    return null;
  },

  /**
   * Builds request headers including GitHub token if available.
   */
  _getHeaders(token) {
    const headers = {
      'Accept': 'application/vnd.github.v3+json'
    };
    if (token && token.trim().length > 0) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }
    return headers;
  },

  /**
   * Fetch commit list for a repository.
   */
  async fetchCommits({ owner, repo, limit = 10, branch = null, token = '' }) {
    let url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=${Math.min(limit, 100)}`;
    if (branch) {
      url += `&sha=${encodeURIComponent(branch)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: this._getHeaders(token)
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Repository "${owner}/${repo}" not found or is private.`);
      }
      if (response.status === 403) {
        const rateRemaining = response.headers.get('x-ratelimit-remaining');
        if (rateRemaining === '0') {
          throw new Error('GitHub API rate limit exceeded. Please add a GitHub Personal Access Token in Settings.');
        }
        throw new Error('GitHub API access forbidden (403). Check repository permissions or token.');
      }
      throw new Error(`GitHub API error (${response.status}): ${response.statusText}`);
    }

    return await response.json();
  },

  /**
   * Fetch detailed commit info including patch diffs for each changed file.
   */
  async fetchCommitDetails({ owner, repo, sha, token = '' }) {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(sha)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this._getHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch details for commit ${sha.substring(0, 7)}: ${response.statusText}`);
    }

    const data = await response.json();

    // Consolidate diff patches for substantive source code
    const ignorableExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.pdf',
      '.lock', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
      '.min.js', '.min.css', '.map'
    ];

    let combinedDiff = '';
    const files = data.files || [];

    for (const file of files) {
      const filename = file.filename || '';
      const isIgnored = ignorableExtensions.some(ext => filename.toLowerCase().endsWith(ext));

      if (!isIgnored && file.patch) {
        combinedDiff += `\n--- a/${filename}\n+++ b/${filename}\n${file.patch}\n`;
      }
    }

    // Limit diff size to ~16,000 characters to stay within fast AI processing windows
    const maxDiffChars = 16000;
    const truncated = combinedDiff.length > maxDiffChars;
    const finalDiff = truncated
      ? combinedDiff.substring(0, maxDiffChars) + '\n... [Diff truncated for size limit] ...'
      : combinedDiff;

    return {
      sha: data.sha,
      html_url: data.html_url,
      author: {
        name: data.commit?.author?.name || 'Unknown',
        email: data.commit?.author?.email || 'N/A',
        date: data.commit?.author?.date || new Date().toISOString()
      },
      message: data.commit?.message || '',
      stats: {
        total_files: files.length,
        additions: data.stats?.additions || 0,
        deletions: data.stats?.deletions || 0,
        total: data.stats?.total || 0
      },
      files: files.map(f => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions
      })),
      diff: finalDiff
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GitHubAPI;
}
