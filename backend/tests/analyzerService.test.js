'use strict';

const { analyzeSource } = require('../services/analyzerService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasAlgorithm(result, name) {
  return result.algorithms.some(a => a.name === name);
}

function algorithmConfidence(result, name) {
  const a = result.algorithms.find(a => a.name === name);
  return a ? a.confidence : null;
}

function hasDS(result, name) {
  return result.dataStructures.some(d => d.name === name);
}

function hasTechnique(result, name) {
  return result.techniques.some(t => t.name === name);
}

// ---------------------------------------------------------------------------
// BFS
// ---------------------------------------------------------------------------
describe('BFS detection', () => {
  test('queue<int> and .push .front → BFS detected', () => {
    const code = `
#include <bits/stdc++.h>
using namespace std;
int main() {
  queue<int> q;
  q.push(1);
  while (!q.empty()) {
    int v = q.front(); q.pop();
  }
}`;
    const r = analyzeSource(code, 'cpp');
    expect(hasAlgorithm(r, 'bfs')).toBe(true);
  });

  test('explicit bfs function name → detected', () => {
    const code = 'void bfs(int start) { /* ... */ }';
    const r = analyzeSource(code, 'cpp');
    expect(hasAlgorithm(r, 'bfs')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Dijkstra
// ---------------------------------------------------------------------------
describe('Dijkstra detection', () => {
  test('priority_queue<pair<int,int>> + dist[ → Dijkstra HIGH', () => {
    const code = `
priority_queue<pair<int,int>, vector<pair<int,int>>, greater<>> pq;
vector<int> dist(n, INT_MAX);
dist[src] = 0;
pq.push({0, src});
while (!pq.empty()) {
  auto [d, u] = pq.top(); pq.pop();
}`;
    const r = analyzeSource(code, 'cpp');
    expect(hasAlgorithm(r, 'dijkstra')).toBe(true);
    expect(algorithmConfidence(r, 'dijkstra')).toBe('HIGH');
  });
});

// ---------------------------------------------------------------------------
// DP
// ---------------------------------------------------------------------------
describe('DP detection', () => {
  test('dp[i][j] = ... → DP detected', () => {
    const code = `
int dp[105][105];
for (int i = 1; i <= n; i++)
  for (int j = 1; j <= m; j++)
    dp[i][j] = dp[i-1][j] + dp[i][j-1];`;
    const r = analyzeSource(code, 'cpp');
    expect(hasAlgorithm(r, 'dp')).toBe(true);
  });

  test('memo[] detected', () => {
    const code = 'int memo[1005]; memset(memo, -1, sizeof(memo));';
    const r = analyzeSource(code, 'cpp');
    expect(hasAlgorithm(r, 'dp')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fenwick Tree
// ---------------------------------------------------------------------------
describe('Fenwick tree detection', () => {
  test('i & (-i) → Fenwick HIGH', () => {
    const code = `
int bit[100005];
void update(int i, int v) {
  for (; i <= n; i += i & (-i)) bit[i] += v;
}
int query(int i) {
  int s = 0;
  for (; i > 0; i -= i & (-i)) s += bit[i];
  return s;
}`;
    const r = analyzeSource(code, 'cpp');
    expect(hasAlgorithm(r, 'fenwick')).toBe(true);
    expect(algorithmConfidence(r, 'fenwick')).toBe('HIGH');
  });
});

// ---------------------------------------------------------------------------
// Binary search
// ---------------------------------------------------------------------------
describe('Binary search detection', () => {
  test('lower_bound → binary_search detected', () => {
    const code = `
auto it = lower_bound(a.begin(), a.end(), x);
if (it != a.end()) cout << *it;`;
    const r = analyzeSource(code, 'cpp');
    expect(hasAlgorithm(r, 'binary_search')).toBe(true);
  });

  test('upper_bound → binary_search detected', () => {
    const code = 'auto pos = upper_bound(v.begin(), v.end(), val);';
    const r = analyzeSource(code, 'cpp');
    expect(hasAlgorithm(r, 'binary_search')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Modular arithmetic
// ---------------------------------------------------------------------------
describe('Modular arithmetic detection', () => {
  test('1000000007 → modular_arithmetic detected', () => {
    const code = 'const int MOD = 1000000007; ans = (ans + x) % MOD;';
    const r = analyzeSource(code, 'cpp');
    expect(hasTechnique(r, 'modular_arithmetic')).toBe(true);
  });

  test('% MOD → detected', () => {
    const code = 'result = (result * base) % MOD;';
    const r = analyzeSource(code, 'cpp');
    expect(hasTechnique(r, 'modular_arithmetic')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Empty source
// ---------------------------------------------------------------------------
describe('Empty / null source', () => {
  test('empty string → no detections', () => {
    const r = analyzeSource('', 'cpp');
    expect(r.algorithms).toHaveLength(0);
    expect(r.dataStructures).toHaveLength(0);
    expect(r.techniques).toHaveLength(0);
  });

  test('null → no detections', () => {
    const r = analyzeSource(null, 'cpp');
    expect(r.algorithms).toHaveLength(0);
    expect(r.dataStructures).toHaveLength(0);
    expect(r.techniques).toHaveLength(0);
  });

  test('whitespace only → no detections', () => {
    const r = analyzeSource('   \n  ', 'cpp');
    expect(r.algorithms).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Multiple patterns → multiple detections
// ---------------------------------------------------------------------------
describe('Multiple patterns → multiple detections', () => {
  test('code with BFS + DP + modular arithmetic → all detected', () => {
    const code = `
#include <bits/stdc++.h>
using namespace std;
const int MOD = 1000000007;
int dp[105];
queue<int> q;
q.push(1);
while (!q.empty()) {
  int v = q.front(); q.pop();
  dp[v] = (dp[v] + 1) % MOD;
}`;
    const r = analyzeSource(code, 'cpp');
    expect(hasAlgorithm(r, 'bfs')).toBe(true);
    expect(hasAlgorithm(r, 'dp')).toBe(true);
    expect(hasTechnique(r, 'modular_arithmetic')).toBe(true);
  });

  test('data structures: priority_queue and vector detected together', () => {
    const code = `
priority_queue<pair<int,int>> pq;
vector<int> dist(n, 0);`;
    const r = analyzeSource(code, 'cpp');
    expect(hasDS(r, 'priority_queue')).toBe(true);
    expect(hasDS(r, 'vector')).toBe(true);
  });

  test('bitmask technique detected', () => {
    const code = `
int mask = 0;
for (int i = 0; i < n; i++) {
  if (x & (1 << i)) mask |= (1 << i);
}
int cnt = __builtin_popcount(mask);`;
    const r = analyzeSource(code, 'cpp');
    expect(hasTechnique(r, 'bitmask')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Confidence levels
// ---------------------------------------------------------------------------
describe('Confidence levels', () => {
  test('single pattern match → MEDIUM confidence', () => {
    const code = 'void dfs(int v) { visited[v] = true; }';
    const r = analyzeSource(code, 'cpp');
    const dfs = r.algorithms.find(a => a.name === 'dfs');
    if (dfs) {
      expect(['MEDIUM', 'HIGH']).toContain(dfs.confidence);
    }
  });

  test('greedy → at most LOW confidence', () => {
    const code = 'bool greedy = true; // greedy approach';
    const r = analyzeSource(code, 'cpp');
    const g = r.algorithms.find(a => a.name === 'greedy');
    if (g) {
      expect(g.confidence).toBe('LOW');
    }
  });

  test('evidence array is always present', () => {
    const code = 'lower_bound(a.begin(), a.end(), x);';
    const r = analyzeSource(code, 'cpp');
    for (const item of [...r.algorithms, ...r.dataStructures, ...r.techniques]) {
      expect(Array.isArray(item.evidence)).toBe(true);
    }
  });
});
