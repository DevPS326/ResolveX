'use strict';

// ---------------------------------------------------------------------------
// Detection pattern definitions
// ---------------------------------------------------------------------------

const ALGORITHM_PATTERNS = [
  {
    name: 'binary_search',
    patterns: [
      /lower_bound/,
      /upper_bound/,
      /binary_search/,
      /\blo\b.*\bhi\b.*\bmid\b/s,
      /while.*lo.*<=.*hi/s,
      /\bl\b.*\br\b.*mid/s
    ]
  },
  {
    name: 'bfs',
    patterns: [
      /\bqueue\b.*push/s,
      /\.push.*\.front/s,
      /\bbfs\b/i,
      /level.*order/i
    ]
  },
  {
    name: 'dfs',
    patterns: [
      /\bdfs\b/i,
      /\bvisit\[/,
      /recursive.*adj/s,
      /adj\[.*\].*dfs/s
    ]
  },
  {
    name: 'dijkstra',
    patterns: [
      /priority_queue.*pair/s,
      /\bdist\[/,
      /\brelax\b/,
      /\bdijkstra\b/i
    ]
  },
  {
    name: 'dsu',
    patterns: [
      /\bparent\[/,
      /\bfind\(/,
      /\bunion\(/,
      /\bdsu\b/i,
      /\bufind\b/i
    ]
  },
  {
    name: 'dp',
    patterns: [
      /\bdp\[/,
      /\bmemo\[/,
      /\bmemoization\b/i,
      /\bknapsack\b/i,
      /longest.*sub/i
    ]
  },
  {
    name: 'segment_tree',
    patterns: [
      /\bseg\[/,
      /segment.*tree/i,
      /\bsegtree\b/i,
      /\bbuild\(.*l.*r/s,
      /\bquery\(.*l.*r/s
    ]
  },
  {
    name: 'fenwick',
    patterns: [
      /\bbit\[/,
      /i\s*&\s*\(-i\)/,
      /\bfenwick\b/i,
      /\bBIT\b/
    ]
  },
  {
    name: 'two_pointers',
    patterns: [
      /\bl\s*=\s*0.*r\s*=/s,
      /left.*right.*while/s,
      /two.pointer/i
    ]
  },
  {
    name: 'sliding_window',
    patterns: [
      /sliding.*window/i,
      /window.*size/i,
      /l\+\+.*while.*r/s
    ]
  },
  {
    name: 'greedy',
    patterns: [
      /\bgreedy\b/i,
      /locally.*optimal/i
    ],
    maxConfidence: 'LOW'
  }
];

const DS_PATTERNS = [
  { name: 'priority_queue', patterns: [/priority_queue</] },
  { name: 'set',            patterns: [/\bset</,  /\bmultiset</] },
  { name: 'map',            patterns: [/\bmap</,  /\bunordered_map</] },
  { name: 'stack',          patterns: [/\bstack</] },
  { name: 'queue',          patterns: [/\bqueue</] },
  { name: 'deque',          patterns: [/\bdeque</] },
  { name: 'vector',         patterns: [/\bvector</] },
  { name: 'graph_adj',      patterns: [/vector.*vector.*pair/s, /\badj\[/, /\bgraph\[/] }
];

const TECHNIQUE_PATTERNS = [
  { name: 'prefix_sum',              patterns: [/\bprefix\[/, /\bpsum\b/, /\bcumsum\b/, /cumulative/i] },
  { name: 'coordinate_compression',  patterns: [/\bcompress\b/i, /\bdiscretize\b/i, /sorted.*unique/s, /coordinate/i] },
  { name: 'monotonic_stack',         patterns: [/monotonic.*stack/i, /while.*stack.*top.*>/s, /next.*greater/i] },
  { name: 'bitmask',                 patterns: [/\(1 << /, /\(1LL <</, /__builtin_popcount/, /mask &/, /mask \|/] },
  { name: 'modular_arithmetic',      patterns: [/% MOD/, /% 1e9/, /1000000007/, /\bmod\b/] }
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Count how many patterns match in the source code.
 * @param {string} source
 * @param {RegExp[]} patterns
 * @returns {{ matchCount: number, evidence: string[] }}
 */
function countMatches(source, patterns) {
  const evidence = [];
  let matchCount = 0;
  for (const re of patterns) {
    if (re.test(source)) {
      matchCount++;
      evidence.push(re.source.slice(0, 60));
    }
  }
  return { matchCount, evidence };
}

/**
 * Derive confidence level from match count.
 * @param {number} matchCount
 * @param {string|undefined} maxConfidence - cap (e.g. 'LOW')
 * @returns {'HIGH'|'MEDIUM'|'LOW'}
 */
function deriveConfidence(matchCount, maxConfidence) {
  let conf;
  if (matchCount >= 2) conf = 'HIGH';
  else if (matchCount === 1) conf = 'MEDIUM';
  else conf = 'LOW';

  if (maxConfidence === 'LOW') return 'LOW';
  if (maxConfidence === 'MEDIUM' && conf === 'HIGH') return 'MEDIUM';
  return conf;
}

/**
 * Run a set of detection rules against a source string.
 * @param {string} source
 * @param {Array} ruleset
 * @returns {Array<{ name, confidence, evidence }>}
 */
function runDetection(source, ruleset) {
  const results = [];
  for (const rule of ruleset) {
    const { matchCount, evidence } = countMatches(source, rule.patterns);
    if (matchCount === 0) continue;
    results.push({
      name:       rule.name,
      confidence: deriveConfidence(matchCount, rule.maxConfidence),
      evidence
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze source code for algorithms, data structures, and techniques.
 *
 * @param {string|null} sourceCode
 * @param {string}      language   (e.g. 'GNU C++17 (64)')
 * @returns {{
 *   algorithms:     Array<{ name, confidence, evidence }>,
 *   dataStructures: Array<{ name, confidence, evidence }>,
 *   techniques:     Array<{ name, confidence, evidence }>
 * }}
 */
function analyzeSource(sourceCode, language = '') {
  if (!sourceCode || typeof sourceCode !== 'string' || sourceCode.trim() === '') {
    return { algorithms: [], dataStructures: [], techniques: [] };
  }

  const src = sourceCode;

  return {
    algorithms:     runDetection(src, ALGORITHM_PATTERNS),
    dataStructures: runDetection(src, DS_PATTERNS),
    techniques:     runDetection(src, TECHNIQUE_PATTERNS)
  };
}

module.exports = { analyzeSource };
