/**
 * GitLense Google Gemini AI Plagiarism Detection Client
 */
const GeminiAPI = {
  DEFAULT_MODEL: 'gemini-flash-latest',

  /**
   * Evaluates a commit's code diff using Gemini API for potential plagiarism.
   *
   * @param {Object} params
   * @param {string} params.apiKey Google Gemini API key
   * @param {string} params.model Optional model name (default: gemini-flash-latest)
   * @param {string} params.repo Repository name (owner/repo)
   * @param {string} params.sha Commit SHA
   * @param {string} params.message Commit message
   * @param {string} params.diff Combined code diff patch
   */
  async analyzeCommitPlagiarism({ apiKey, model = this.DEFAULT_MODEL, repo, sha, message, diff }) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('Google Gemini API Key is missing. Please set your API key in Extension Settings.');
    }

    const key = apiKey.trim();
    const shortSha = sha ? sha.substring(0, 7) : 'unknown';

    // If diff is empty (e.g., pure file delete, merge commit, or binary files)
    if (!diff || diff.trim().length === 0) {
      return {
        verdict: 'ORIGINAL',
        plagiarism_score: 0,
        plagiarism_category: 'No substantive code changes / Merge commit',
        flagged_code_snippets: [],
        reasoning: 'Commit contains no substantive source code additions or modifications to evaluate.'
      };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const promptText = `You are an expert static code analyst, software engineer, and academic integrity reviewer specializing in source code originality and plagiarism detection.

Analyze the following Git commit diff from repository "${repo}" (commit ${shortSha}).
Determine if any of the added or modified code is plagiarized, verbatim copied without attribution, taken from well-known online solutions (e.g., LeetCode, GeeksForGeeks, StackOverflow, common tutorial repositories, assignment sample answers), or if it represents original custom software engineering.

Commit Details:
Repository: ${repo}
Commit SHA: ${sha}
Commit Message: ${message || 'No message provided'}

Code Diff:
\`\`\`diff
${diff}
\`\`\`

Instructions:
1. Ignore standard imports, configuration boilerplate, and trivial language syntax.
2. Differentiate between:
   - ORIGINAL: Custom, unique architecture, domain-specific logic, or standard idiomatic development.
   - BOILERPLATE_OR_LIBRARY: Framework starter templates, common boilerplate (e.g., React scaffolds, basic CRUD skeletons).
   - SUSPICIOUS: Unusually structured algorithms, variable naming patterns mimicking known online solution templates, or disguised copy-pastes.
   - PLAGIARIZED: Verbatim or near-verbatim copy of online repositories, textbook algorithms, or homework solutions without attribution.
3. Assign a plagiarism_score from 0 (completely original) to 100 (complete verbatim copy).
4. Provide specific flagged code snippets if suspicious/plagiarized.
5. Provide clear, objective reasoning for your verdict.`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: promptText }]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        responseSchema: {
          type: 'OBJECT',
          properties: {
            verdict: {
              type: 'STRING',
              enum: ['ORIGINAL', 'SUSPICIOUS', 'PLAGIARIZED', 'BOILERPLATE_OR_LIBRARY']
            },
            plagiarism_score: {
              type: 'INTEGER',
              description: 'Score between 0 (completely original) and 100 (verbatim copy)'
            },
            plagiarism_category: {
              type: 'STRING',
              description: 'e.g. Original Implementation, LeetCode / Competitive Programming, Textbook Algorithm, Boilerplate / Template, StackOverflow Snippet'
            },
            flagged_code_snippets: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Specific code lines or signatures flagged'
            },
            reasoning: {
              type: 'STRING',
              description: 'Objective justification explaining the verdict and score'
            }
          },
          required: ['verdict', 'plagiarism_score', 'plagiarism_category', 'flagged_code_snippets', 'reasoning']
        }
      }
    };

    let response;
    let lastError = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': key
          },
          body: JSON.stringify(requestBody)
        });

        // If 503 (Overloaded) or 429 (Rate Limit), retry after a short pause
        if ((response.status === 503 || response.status === 429) && attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1500));
          continue;
        }

        break;
      } catch (networkErr) {
        lastError = networkErr;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1500));
          continue;
        }
        throw new Error(`Network failure communicating with Gemini API: ${networkErr.message}`);
      }
    }

    if (!response || !response.ok) {
      let errorMsg = response ? `Gemini API error (${response.status})` : (lastError ? lastError.message : 'Unknown error');
      if (response) {
        try {
          const errJson = await response.json();
          if (errJson.error && errJson.error.message) {
            errorMsg = `Gemini API Error: ${errJson.error.message}`;
          }
        } catch (_) {
          errorMsg += `: ${response.statusText}`;
        }

        if (response.status === 400 && errorMsg.includes('API_KEY_INVALID')) {
          throw new Error('Invalid Gemini API Key. Please verify your key at https://aistudio.google.com/');
        }
        if (response.status === 429) {
          throw new Error('Gemini API quota/rate limit exceeded. Please wait a few moments or check your tier.');
        }
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const textResponse = candidate?.content?.parts?.[0]?.text;

    if (!textResponse) {
      throw new Error('Gemini API returned an empty response.');
    }

    try {
      const parsed = JSON.parse(textResponse);
      return {
        verdict: parsed.verdict || 'SUSPICIOUS',
        plagiarism_score: typeof parsed.plagiarism_score === 'number' ? parsed.plagiarism_score : 50,
        plagiarism_category: parsed.plagiarism_category || 'Unclassified',
        flagged_code_snippets: Array.isArray(parsed.flagged_code_snippets) ? parsed.flagged_code_snippets : [],
        reasoning: parsed.reasoning || 'No explanation provided.'
      };
    } catch (parseErr) {
      const cleaned = textResponse.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      return parsed;
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GeminiAPI;
}
