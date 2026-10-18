/**
 * chitgit CSV Exporter
 * Generates RFC 4180-compliant CSV files from commit plagiarism analysis results.
 */
const CSVExporter = {
  /**
   * Escapes a single CSV field value according to RFC 4180.
   */
  escapeCell(value) {
    if (value === null || value === undefined) {
      return '""';
    }
    const stringValue = String(value);
    // If the field contains comma, quote, or newline, escape internal quotes by doubling and wrap in quotes
    if (/[",\r\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return `"${stringValue}"`;
  },

  /**
   * Converts an array of analyzed commit objects into CSV format.
   *
   * @param {Array<Object>} records Array of analyzed commit objects
   * @returns {string} Formatted CSV content
   */
  generateCSV(records = []) {
    const headers = [
      'Commit SHA',
      'Commit URL',
      'Author Name',
      'Author Email',
      'Date (UTC)',
      'Commit Message',
      'Files Changed',
      'Additions',
      'Deletions',
      'Plagiarism Verdict',
      'Plagiarism Score (%)',
      'Plagiarism Category',
      'Flagged Snippets',
      'AI Analysis & Notes'
    ];

    const rows = [headers.map(this.escapeCell).join(',')];

    for (const record of records) {
      const commit = record.commit || {};
      const author = commit.author || {};
      const stats = commit.stats || {};
      const ai = record.ai_analysis || {};

      const flaggedSnippetsText = Array.isArray(ai.flagged_code_snippets) && ai.flagged_code_snippets.length > 0
        ? ai.flagged_code_snippets.join('\n---\n')
        : 'None';

      const row = [
        commit.sha || '',
        commit.html_url || '',
        author.name || '',
        author.email || '',
        author.date || '',
        (commit.message || '').replace(/\r?\n/g, ' '),
        stats.total_files || 0,
        stats.additions || 0,
        stats.deletions || 0,
        ai.verdict || 'N/A',
        ai.plagiarism_score !== undefined ? ai.plagiarism_score : 'N/A',
        ai.plagiarism_category || 'N/A',
        flaggedSnippetsText,
        ai.reasoning || ''
      ];

      rows.push(row.map(this.escapeCell).join(','));
    }

    return rows.join('\r\n');
  },

  /**
   * Triggers download of the CSV file.
   * Supports both Chrome Extension downloads API and standard browser Blob download.
   */
  async downloadCSV(csvContent, filename = 'chitgit_plagiarism_report.csv') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // Method 1: Chrome Downloads API (available in extension context)
    if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onloadend = () => {
          chrome.downloads.download(
            {
              url: reader.result,
              filename: filename,
              saveAs: true
            },
            downloadId => {
              if (chrome.runtime.lastError) {
                // Fallback to DOM method if chrome.downloads fails
                CSVExporter._fallbackDOMDownload(blob, filename);
                resolve(null);
              } else {
                resolve(downloadId);
              }
            }
          );
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    // Method 2: Fallback anchor tag click
    CSVExporter._fallbackDOMDownload(blob, filename);
  },

  _fallbackDOMDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CSVExporter;
}
