# PROJECT STATE — CP COMBAT COMMAND

Last updated: 2026-08-28

---

## OVERALL STATUS

**ALL PHASES COMPLETE. 121/121 tests pass. Frontend builds clean.**

---

## COMPLETED PHASES

### PHASE 1 — Foundation: Database + Submission Ingestion

**Status: DONE. Verified.**

| File | Purpose |
|---|---|
| `backend/.gitignore` | Excludes .env, node_modules |
| `backend/config/handles.js` | ME + FRIENDS handles, env-overridable |
| `backend/models/User.js` | Codeforces user profile |
| `backend/models/Submission.js` | Every submission attempt (all verdicts) |
| `backend/models/SyncState.js` | Per-handle sync cursor + status |
| `backend/services/codeforcesService.js` | Rate-limited CF API queue (400ms/req), paginated user.status |
| `backend/services/syncService.js` | syncUser, syncAll, getSyncStatus, mapSubmission |
| `backend/routes/health.js` | GET /api/health |
| `backend/routes/sync.js` | POST /api/sync (background), GET /api/sync/status |
| `backend/routes/compare.js` | GET /compare-all (legacy, live CF calls) |
| `backend/server.js` | Express entry point, mongoose connect |

**Key invariants:**
- Cursor (lastSyncedSubmissionId) only advances after successful DB write
- Failed individual user sync does not abort others
- All CF requests through one shared rate-limited queue
- `$setOnInsert` upsert — duplicate submissions never created
- All verdicts stored (WA, TLE, RE, AC, etc.)

---

### PHASE 2 — Problem Intelligence Backend

**Status: DONE. Verified.**

| File | Purpose |
|---|---|
| `backend/models/Problem.js` | Problem metadata (contestId, index, name, rating, tags) |
| `backend/models/Contest.js` | Contest record stub |
| `backend/services/problemService.js` | computeProblemTimeline, groupSubmissionsByHandle, extractProblems |
| `backend/routes/rivals.js` | GET /api/rivals |
| `backend/routes/activity.js` | GET /api/activity[?limit=N] |
| `backend/routes/problems.js` | GET /api/problems/:contestId/:index/friends |
| `backend/routes/friends.js` | GET /api/friends/:handle/problems/:contestId/:index/submissions |

---

### MILESTONE A — Source Retrieval

**Status: DONE. 25 tests pass.**

| File | Purpose |
|---|---|
| `backend/models/SubmissionSource.js` | Source cache with fetchStatus enum |
| `backend/services/sourceAdapter.js` | Cheerio scraper, Cloudflare detection, hash |
| `backend/routes/submissions.js` | GET /source (lazy), GET /diff/:id1/:id2 |
| `backend/services/diffService.js` | Unified diff via `diff` package |
| `backend/tests/sourceAdapter.test.js` | 25 fixture-based tests |
| `backend/tests/diffService.test.js` | 14 tests |
| `backend/tests/fixtures/` | 3 HTML fixture files |

**fetchStatus values:** PENDING → SUCCESS | NOT_AVAILABLE | BLOCKED | PARSE_ERROR | ERROR

---

### MILESTONE B — Editorial Integration

**Status: DONE. 7 tests pass.**

| File | Purpose |
|---|---|
| `backend/models/Editorial.js` | contestId-unique editorial record |
| `backend/services/editorialService.js` | getEditorialForContest, setEditorialManually, timing computation |
| `backend/routes/editorials.js` | GET + POST /api/editorials/:contestId, GET /timing/:handle/:index |
| `backend/tests/editorialService.test.js` | 7 tests |

**Limitation:** No reliable CF API endpoint exists for editorial discovery by contestId; manual registration via POST is primary mechanism.

---

### MILESTONE C — Deterministic Analysis

**Status: DONE. 21 tests pass.**

| File | Purpose |
|---|---|
| `backend/services/analyzerService.js` | Regex-based algorithm/DS/technique detection |
| `backend/services/aiAdapter.js` | Ollama qwen2.5-coder:7b wrapper (graceful degradation) |
| `backend/tests/analyzerService.test.js` | 21 tests |

**Detected algorithms:** binary_search, bfs, dfs, dijkstra, dsu, dp, segment_tree, fenwick, two_pointers, sliding_window, greedy
**Detected structures:** priority_queue, set/multiset, map/unordered_map, stack, queue, deque, vector, graph_adj
**Detected techniques:** prefix_sum, coordinate_compression, monotonic_stack, bitmask, modular_arithmetic

---

### MILESTONE D — Skill Gap + Independence Evidence

**Status: DONE. 20 tests pass (10 + 10).**

| File | Purpose |
|---|---|
| `backend/services/fingerprintService.js` | Per-handle coding fingerprint via MongoDB aggregation |
| `backend/services/skillGapService.js` | Tag-level gap scoring and learning targets |
| `backend/services/evidenceService.js` | Conservative independence signal (4 non-accusatory labels) |
| `backend/routes/analytics.js` | GET /api/analytics/skills, /learning, /friends/:handle, /problems/…/evidence/:handle |
| `backend/tests/skillGap.test.js` | 10 tests |
| `backend/tests/evidenceService.test.js` | 10 tests |

**Evidence labels (never accusatory):**
- HIGH_INDEPENDENT_ATTEMPT_EVIDENCE
- MIXED_UNCERTAIN
- LOW_INDEPENDENT_ATTEMPT_EVIDENCE
- INSUFFICIENT_DATA

---

### MILESTONE E + F — Frontend + Final Integration

**Status: DONE. Build passes. 54 modules, 0 errors.**

| File | Purpose |
|---|---|
| `frontend/Frontend/vite.config.js` | Proxy /api + /compare-all to localhost:5000 |
| `frontend/Frontend/src/main.jsx` | BrowserRouter wrapper |
| `frontend/Frontend/src/App.jsx` | NavBar + 3-route router |
| `frontend/Frontend/src/services/api.js` | All API calls as relative paths |
| `frontend/Frontend/src/components/VerdictBadge.jsx` | Color-coded verdict display |
| `frontend/Frontend/src/components/SubmissionTimeline.jsx` | Chronological attempt list |
| `frontend/Frontend/src/components/SourceViewer.jsx` | Lazy source fetch + display |
| `frontend/Frontend/src/components/CodeDiffViewer.jsx` | On-demand unified diff |
| `frontend/Frontend/src/components/EvidenceSignal.jsx` | Independence signal + factors |
| `frontend/Frontend/src/components/SkillGapPanel.jsx` | Tag gap bars |
| `frontend/Frontend/src/components/LearningTargets.jsx` | Prioritized action list |
| `frontend/Frontend/src/components/ActivityFeed.jsx` | Live activity with problem/friend links |
| `frontend/Frontend/src/pages/Dashboard.jsx` | Sync panel, rivals, tabbed analytics, legacy grid |
| `frontend/Frontend/src/pages/ProblemIntelligence.jsx` | Problem analysis: timeline, source, diff, evidence |
| `frontend/Frontend/src/pages/FriendProfile.jsx` | Fingerprint charts, activity feed |
| `frontend/Frontend/src/App.css` | Extended with Phase 2–F styles |

---

## ACTIVE ENDPOINTS

| Method | Path | Milestone | Description |
|---|---|---|---|
| GET | /api/health | 1 | DB connection state |
| POST | /api/sync | 1 | Start background sync (all handles) |
| GET | /api/sync/status | 1 | Per-handle sync state |
| GET | /api/rivals | 2 | Friend list with stats from DB |
| GET | /api/activity | 2 | Recent submissions across all handles |
| GET | /api/problems/:contestId/:index/friends | 2 | All friends' timelines for a problem |
| GET | /api/friends/:handle/problems/:contestId/:index/submissions | 2 | One friend's timeline for a problem |
| GET | /compare-all | legacy | Live CF call (original dashboard data) |
| GET | /api/submissions/:submissionId | A | Submission metadata |
| GET | /api/submissions/:submissionId/source | A | Lazy source fetch (cache-first) |
| GET | /api/submissions/diff/:id1/:id2 | A | Unified diff between two submissions |
| GET | /api/editorials/:contestId | B | Editorial record for contest |
| POST | /api/editorials/:contestId | B | Register editorial manually |
| GET | /api/editorials/:contestId/timing/:handle/:index | B | Editorial timing vs. attempt timeline |
| GET | /api/analytics/skills | D | My skill gaps vs. peer average |
| GET | /api/analytics/learning | D | Prioritized learning targets |
| GET | /api/analytics/friends/:handle | D | Friend coding fingerprint |
| GET | /api/analytics/problems/:contestId/:index/evidence/:handle | D | Independence evidence signal |

---

## TEST STATUS

```
Tests:  121 passed, 0 failed
Suites: 9 passed

  codeforcesService.test.js   (7)   — cursor filter, pagination edge cases
  syncService.test.js         (8)   — submission mapping, verdict handling
  problemService.test.js      (19)  — timeline computation, grouping, extraction
  sourceAdapter.test.js       (25)  — scraper, Cloudflare detection, hash
  diffService.test.js         (14)  — unified diff edge cases
  editorialService.test.js    (7)   — timing, manual registration
  analyzerService.test.js     (21)  — algorithm/DS/technique detection
  evidenceService.test.js     (10)  — independence signal, non-accusatory language
  skillGap.test.js            (10)  — gap calculation, learning targets
```

---

## FRONTEND BUILD STATUS

```
Vite v7.3.1 — production build
54 modules transformed
dist/index.html          0.46 kB (gzip: 0.29 kB)
dist/assets/*.css       13.93 kB (gzip: 3.55 kB)
dist/assets/*.js       254.54 kB (gzip: 80.65 kB)
Built in 1.81s — 0 errors, 0 warnings
```

---

## KNOWN LIMITATIONS

### Source Retrieval
- Codeforces submission source pages are subject to Cloudflare protection; blocked responses are stored as `BLOCKED` status without retry
- Only public submissions can be scraped; private/contest-locked submissions return `NOT_AVAILABLE`
- CF may change HTML structure; CSS selectors tried: `#program-source-text`, `pre.prettyprint`, `.source-code pre`

### Editorial Discovery
- No reliable Codeforces API endpoint maps contestId → editorial blogEntryId
- Auto-discovery is not implemented; editorials must be registered manually via `POST /api/editorials/:contestId`
- Once a blogEntryId is registered, `blogEntry.view` can fetch full content

### AI Analysis (Ollama)
- `analyzeCodeWithAI()` requires Ollama running locally with `qwen2.5-coder:7b` loaded
- System degrades gracefully: all routes work without Ollama; AI fields return `{available: false}`
- No cloud LLM fallback (by design — no API keys required)

### Sync
- Sync must be triggered manually via `POST /api/sync`; no scheduler or cron built in
- Initial sync of large accounts (10k+ submissions) takes several minutes due to 400ms/req rate limit
- Contest names are not populated (Contest model is a stub)

### Independence Evidence
- Signal is based on timing and behavioral patterns only — deterministic, no inference about intent
- `INSUFFICIENT_DATA` is returned when fewer than 2 submissions exist for a problem
- System never produces accusatory language; labels describe evidence strength, not conclusions

---

## ARCHITECTURE NOTES

- All CF API requests share one centralized rate-limited queue (400ms interval) — no ad-hoc delays anywhere
- Cursor advances only after successful `bulkWrite` — sync is safe to interrupt and resume
- `$setOnInsert` in all upserts — re-syncing never creates duplicates
- No N+1 queries: all multi-handle aggregations use compound indexes and single DB calls
- Vite proxy eliminates hardcoded backend URLs in frontend
- Ollama availability is cached 60s to avoid hammering the health endpoint
