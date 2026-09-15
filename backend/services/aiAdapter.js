'use strict';

const axios = require('axios');

const OLLAMA_BASE    = process.env.OLLAMA_BASE || 'http://localhost:11434';
const CODE_MODEL     = 'qwen2.5-coder:7b';
const GENERAL_MODEL  = 'llama3.1:8b';
const TIMEOUT_MS     = 30000;
const AVAIL_CACHE_MS = 60 * 1000; // cache availability check for 60 seconds

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _availabilityCache = { available: null, checkedAt: 0 };
const _analysisCache   = new Map(); // keyed by source hash

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

/**
 * Check whether Ollama is reachable. Caches result for 60 seconds.
 * @returns {Promise<boolean>}
 */
async function isOllamaAvailable() {
  const now = Date.now();
  if (_availabilityCache.available !== null && (now - _availabilityCache.checkedAt) < AVAIL_CACHE_MS) {
    return _availabilityCache.available;
  }

  try {
    await axios.get(`${OLLAMA_BASE}/api/tags`, { timeout: 5000 });
    _availabilityCache = { available: true, checkedAt: now };
    return true;
  } catch (_err) {
    _availabilityCache = { available: false, checkedAt: now };
    return false;
  }
}

// ---------------------------------------------------------------------------
// Core generate call
// ---------------------------------------------------------------------------

/**
 * Call Ollama /api/generate with a prompt and return the response text.
 * Returns null if unavailable or times out.
 * @param {string} model
 * @param {string} prompt
 * @returns {Promise<string|null>}
 */
async function ollamaGenerate(model, prompt) {
  try {
    const res = await axios.post(
      `${OLLAMA_BASE}/api/generate`,
      { model, prompt, stream: false },
      { timeout: TIMEOUT_MS }
    );
    return res.data && res.data.response ? res.data.response : null;
  } catch (_err) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public: analyzeCodeWithAI
// ---------------------------------------------------------------------------

/**
 * Analyze source code with Ollama (qwen2.5-coder:7b).
 * Returns { available: false } if Ollama is unreachable or times out.
 * Caches results by source hash.
 *
 * @param {string}      sourceCode
 * @param {string}      language
 * @param {string}      context    — extra context (e.g. problem name)
 * @returns {Promise<{
 *   available: false
 * } | {
 *   available: true,
 *   summary: string,
 *   algorithms: string[],
 *   techniques: string[],
 *   explanation: string
 * }>}
 */
async function analyzeCodeWithAI(sourceCode, language = '', context = '') {
  const available = await isOllamaAvailable();
  if (!available) return { available: false };

  // Cache check (key by a simple hash of the source)
  const crypto  = require('crypto');
  const cacheKey = crypto.createHash('sha256').update(sourceCode || '').digest('hex');
  if (_analysisCache.has(cacheKey)) {
    return _analysisCache.get(cacheKey);
  }

  const prompt = `You are a competitive programming code analyzer.
Language: ${language || 'unknown'}
Context: ${context || 'none'}

Analyze the following code and respond with ONLY a JSON object with these fields:
{
  "summary": "one-sentence description",
  "algorithms": ["list", "of", "algorithms"],
  "techniques": ["list", "of", "techniques"],
  "explanation": "brief explanation of approach"
}

Code:
\`\`\`
${(sourceCode || '').slice(0, 4000)}
\`\`\``;

  const raw = await ollamaGenerate(CODE_MODEL, prompt);
  if (!raw) return { available: false };

  // Try to parse JSON from the response
  let parsed;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (_err) {
    parsed = null;
  }

  const result = {
    available:   true,
    summary:     parsed && parsed.summary     ? parsed.summary     : raw.slice(0, 200),
    algorithms:  parsed && parsed.algorithms  ? parsed.algorithms  : [],
    techniques:  parsed && parsed.techniques  ? parsed.techniques  : [],
    explanation: parsed && parsed.explanation ? parsed.explanation : ''
  };

  _analysisCache.set(cacheKey, result);
  return result;
}

// ---------------------------------------------------------------------------
// Public: generateLearningNote
// ---------------------------------------------------------------------------

/**
 * Compare two sources and generate a brief "what I missed" learning note.
 * Returns null if Ollama is unavailable.
 *
 * @param {string} mySource
 * @param {string} peerSource
 * @param {string} problemName
 * @returns {Promise<string|null>}
 */
async function generateLearningNote(mySource, peerSource, problemName = '') {
  const available = await isOllamaAvailable();
  if (!available) return null;

  const prompt = `You are a competitive programming coach.
Problem: ${problemName || 'unknown'}

My solution:
\`\`\`
${(mySource || '').slice(0, 2000)}
\`\`\`

Peer's solution:
\`\`\`
${(peerSource || '').slice(0, 2000)}
\`\`\`

In 2-3 sentences, what key technique or insight is in the peer's solution that my solution might be missing or doing differently? Focus on algorithms and data structures, not style.`;

  const response = await ollamaGenerate(GENERAL_MODEL, prompt);
  return response || null;
}

module.exports = {
  analyzeCodeWithAI,
  isOllamaAvailable,
  generateLearningNote
};
