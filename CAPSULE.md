# CP COMBAT COMMAND — CAPSULE

## 0. PURPOSE OF THIS FILE

This file is the persistent engineering context for the project.

Read this file BEFORE modifying the codebase.

This is not a generic coding project. The objective is to transform the existing CP tracker into a reliable **Competitive Programming Intelligence + Learning Engine**.

Use this capsule together with:

* the actual repository
* existing source files
* current Codeforces documentation/behavior
* any implementation proposal supplied by another model

Treat external proposals as references, NOT as ground truth.

---

# 1. CORE OBJECTIVE

The system exists to turn publicly observable competitive-programming activity from tracked peers into useful learning information.

The central workflow is:

```
PROBLEM
   ↓
FRIENDS WHO ATTEMPTED IT
   ↓
EVERY SUBMISSION ATTEMPT
   ↓
VERDICT / TIMESTAMP / LANGUAGE
   ↓
PUBLIC SOURCE CODE WHEN RETRIEVABLE
   ↓
SOURCE VERSION HISTORY
   ↓
CODE DIFF / EVOLUTION
   ↓
EDITORIAL INFORMATION WHEN RELIABLY AVAILABLE
   ↓
APPROACH / ALGORITHM / DATA STRUCTURE ANALYSIS
   ↓
FRIEND CODING PATTERNS
   ↓
MY APPROACH VS THEIR APPROACH
   ↓
MY SKILL GAPS
   ↓
PERSONALIZED LEARNING TARGETS
```

The important outcome is not "show me my friend's final code."

The important outcome is:

> "Show me how strong programmers approached the same problem, how their solutions evolved, and what I can learn from that process."

---

# 2. EXISTING PROJECT

The repository is an existing application named:

```
CP COMBAT COMMAND
```

Existing architecture:

```
Backend:
- Node.js
- Express
- axios
- MongoDB / Mongoose
- Codeforces API

Frontend:
- React
- Vite
- Recharts
- Lucide React
- Tailwind/CSS-based styling
```

Existing functionality includes:

* tracked Codeforces user list
* my Codeforces handle
* friend/rival tracking
* Codeforces user information
* Codeforces submission retrieval
* solved-problem aggregation
* tag aggregation
* seven-day activity / velocity
* missed-problem detection
* rating buckets
* tactical dashboard
* rival surveillance UI

DO NOT discard the existing project.

Extend and refactor it.

---

# 3. CURRENT TRACKED USERS

The existing project has a configured ME handle and a list of FRIENDS.

Do not remove or silently replace the existing list.

Inspect the actual repository for the authoritative current values.

Make the implementation scalable enough to support additional handles later.

---

# 4. NON-NEGOTIABLE ENGINEERING PRINCIPLES

## 4.1 Actual repository is the source of truth

Never assume a proposed code listing is identical to the real repository.

Inspect the real files first.

## 4.2 External model-generated code is NOT trusted

Another model may provide:

* architecture
* code
* API assumptions
* comments
* endpoint assumptions

Use these as implementation references only.

Verify them before integrating.

## 4.3 Never invent external APIs

If Codeforces does not officially expose something:

* do not pretend it does
* do not fabricate endpoints
* isolate the capability behind an adapter
* provide graceful fallback behavior

## 4.4 Correctness over feature count

A smaller reliable implementation is better than a larger fake implementation.

## 4.5 Metadata and source are different layers

Submission metadata and source-code retrieval must be independently resilient.

A source retrieval failure must NEVER invalidate submission ingestion.

## 4.6 Incremental ingestion is mandatory

Do not repeatedly download an entire user history every time the dashboard opens.

Initial synchronization may be historical.

All subsequent synchronization should be incremental.

## 4.7 Never make unsupported claims

The system may calculate evidence or correlations.

It must NOT state:

```
"Friend copied the editorial."
```

merely because:

* they solved after the editorial
* they had an immediate AC
* their code resembles the editorial
* their timing suggests assistance

Use conservative labels such as:

```
HIGH INDEPENDENT-ATTEMPT EVIDENCE
MIXED / UNCERTAIN
LOW INDEPENDENT-ATTEMPT EVIDENCE
INSUFFICIENT DATA
```

These are heuristics, not proof.

---

# 5. PRIMARY DATA MODEL

Use MongoDB / Mongoose unless the real repository strongly justifies another choice.

Core entities:

```
User
Problem
Contest
Submission
SubmissionSource / CodeVersion
Editorial
SyncState
```

Prefer separating large source blobs from submission metadata.

---

# 6. SUBMISSION MODEL

Every individual submission is important.

Store at minimum:

```
submissionId
handle
contestId
problemIndex
problemName
problemRating
tags
verdict
programmingLanguage
creationTimeSeconds
relativeTimeSeconds
submissionUrl
```

Source-related metadata:

```
sourceAvailable
sourceFetchStatus
sourceHash
sourceVersionId/reference
sourceFetchedAt
```

Editorial-related metadata may include:

```
editorialAvailable
editorialPublishedAt
```

Index appropriately, especially:

```
submissionId
handle
contestId + problemIndex
creationTimeSeconds
handle + contestId + problemIndex
```

submissionId must be unique.

Do not create duplicate submission records.

---

# 7. SYNC STATE

Each tracked handle needs persistent synchronization state.

At minimum:

```
handle
lastSyncedSubmissionId
lastSyncAt
status
error information when needed
```

The system must survive:

* process restart
* partial synchronization
* API failures
* network failures

A failed sync must not corrupt the last known successful cursor.

---

# 8. CODEFORCES API

Use the CURRENT official Codeforces API documentation as the authority.

Before implementation, verify:

* current API parameters
* pagination behavior
* current rate limits
* returned submission structure
* error behavior

Do not rely on stale assumptions.

The important official capability is user submission metadata.

The system needs complete historical retrieval, not only a single default response page.

Therefore implement proper pagination using supported parameters.

Conceptually:

```
initial sync:
    paginate until historical target is exhausted

incremental sync:
    fetch newest submissions
    persist only submissions newer than saved cursor
    stop when existing cursor is reached
```

Do not assume one response contains the full history.

---

# 9. RATE LIMITING

All Codeforces traffic must pass through a centralized rate-controlled mechanism.

Do NOT put arbitrary delays independently throughout the codebase.

Create one service/queue/rate limiter responsible for:

* spacing requests
* retries
* backoff
* handling rate-limit responses
* preventing uncontrolled concurrency

The exact delay/rate must be based on CURRENT verified Codeforces behavior.

Do not trust comments such as:

```
"1 req/sec is compliant"
```

without verification.

---

# 10. BACKGROUND SYNCHRONIZATION

A route such as:

```
POST /api/sync
```

should not pretend to be a background job while performing a large blocking operation inside the same HTTP request.

Prefer:

```
POST /api/sync
    ↓
create/start sync job
    ↓
return job status
    ↓
worker/service performs sync
    ↓
SyncState updated
    ↓
frontend polls or refreshes status
```

For this project's likely scale, a lightweight in-process queue/service is acceptable initially.

Do not unnecessarily introduce Redis/BullMQ/etc. unless scale actually requires it.

---

# 11. ALL ATTEMPTS FOR A PROBLEM

This is one of the most important requirements.

For every:

```
friend + problem
```

the system must retain every known submission.

Example:

```
CoderAbhi27
Problem 1900C

17:02  WRONG_ANSWER
17:08  WRONG_ANSWER
17:19  TIME_LIMIT_EXCEEDED
17:37  ACCEPTED
```

Do NOT reduce this to:

```
CoderAbhi27 → AC
```

The entire chronology is valuable.

---

# 12. PROBLEM-LEVEL ANALYSIS OBJECT

For a given problem + friend, the backend should be able to produce something conceptually like:

```
{
    handle,
    problem,
    attempts,
    attemptCount,
    firstAttemptAt,
    acceptedAt,
    solvingDuration,
    verdictSequence,
    languagesUsed,
    attemptsBeforeEditorial,
    attemptsAfterEditorial,
    editorialAvailable,
    learningSignal
}
```

Attempts must be chronologically ordered.

---

# 13. PUBLIC SOURCE RETRIEVAL

The official Codeforces API does not generally provide other users' source code.

Therefore source retrieval MUST be implemented as a separate adapter/service.

Potential conceptual flow:

```
submission metadata
    ↓
public submission URL
    ↓
public page retrieval
    ↓
source extraction
    ↓
normalization
    ↓
hash
    ↓
persistent source record
```

Do not mix source retrieval logic into the Codeforces API service.

---

# 14. SOURCE RETRIEVAL REQUIREMENTS

The source adapter must:

* retrieve ONLY publicly accessible content
* never bypass authentication
* never use private account credentials
* never bypass CAPTCHAs or security controls
* cache successful source retrieval
* cache terminal failures appropriately
* record fetch status
* survive parser failures
* never block metadata ingestion

Suggested states:

```
PENDING
SUCCESS
NOT_AVAILABLE
BLOCKED
PARSE_ERROR
ERROR
```

Source fetching should be lazy where sensible.

There is no need to immediately scrape every historical source if doing so creates unnecessary load.

Prioritize sources that the user actually asks to inspect.

---

# 15. SOURCE STORAGE

Prefer a separate source/version entity.

Conceptually:

```
Submission
    |
    +---- SourceVersion 1
    +---- SourceVersion 2
    +---- SourceVersion 3
    +---- SourceVersion 4
```

Store:

* submissionId
* raw source
* normalized source where useful
* hash
* language
* fetchedAt
* fetch status

This makes version comparison easier.

---

# 16. CODE EVOLUTION

When multiple source versions for the same problem/friend are available:

```
V1 → V2
V2 → V3
V3 → V4
```

provide source diffs.

The system should help answer:

* What changed?
* Which sections changed?
* How much changed?
* Did the implementation become structurally different?
* Did the language or approach change?

Do not automatically invent semantic explanations unless the analyzer actually has sufficient evidence.

For example, it is safe to say:

```
"42 lines changed."
```

It is NOT safe to automatically claim:

```
"They realized the binary-search invariant here."
```

unless the system can substantiate that conclusion.

---

# 17. EDITORIALS

The system should associate contests/problems with editorials where this can be done reliably.

IMPORTANT:

There may not be a simple universal official endpoint such as:

```
/contest/{id}/editorial
```

Do not fabricate one.

First verify the current Codeforces/editorial structure.

Possible legitimate sources may include:

* contest pages
* Codeforces blog entries
* blogEntry-related APIs
* publicly accessible editorial pages

Editorial retrieval must be implemented as an isolated service.

If the editorial cannot be identified confidently:

```
editorialAvailable = false
```

Do not guess.

---

# 18. EDITORIAL TIMING

Where publication/availability time is reliably known, compare it with submission timestamps.

Example:

```
Editorial available:
    18:30

Friend:
    17:42 WA
    17:51 WA
    18:03 TLE
    18:17 AC
```

This supports a stronger independent-attempt signal.

Example:

```
Editorial available:
    18:30

Friend:
    18:46 AC
```

This provides weaker evidence.

However:

```
timing != proof
```

Never convert timing into a definite accusation.

---

# 19. LEARNING / INDEPENDENCE SIGNAL

Build a transparent heuristic.

Possible features:

* first attempt before editorial
* multiple attempts before AC
* time between attempts
* verdict progression
* source evolution
* large code changes
* first accepted attempt after editorial
* immediate AC
* number of failed attempts

Use weighted evidence rather than binary claims.

Return:

* signal
* confidence
* supporting factors

Example:

```
{
    signal: "HIGH_INDEPENDENT_ATTEMPT_EVIDENCE",
    confidence: "MEDIUM",
    factors: [
        "first attempt preceded editorial",
        "three failed attempts before AC",
        "source changed across attempts"
    ]
}
```

Do not hide why a signal was assigned.

---

# 20. CODE ANALYSIS

Where source is available, analyze:

## Algorithms

Examples:

* binary search
* two pointers
* sliding window
* greedy
* BFS
* DFS
* Dijkstra
* DSU
* dynamic programming
* segment tree
* Fenwick tree
* etc.

## Data structures

Examples:

* vector
* map
* set
* unordered_map
* priority_queue
* deque
* stack
* queue
* graph structures
* etc.

## Techniques

Examples:

* prefix sums
* coordinate compression
* monotonic stack
* binary lifting
* bitmasking
* state compression
* offline processing
* etc.

Every classification must include confidence:

```
HIGH
MEDIUM
LOW
```

Do not hallucinate classifications.

---

# 21. ALGORITHM ANALYSIS STRATEGY

Do NOT immediately depend on an LLM for every source file.

Prefer a layered approach:

```
deterministic/static signals
        +
structural heuristics
        +
optional AI analysis
```

Examples of deterministic signals:

* presence of BFS queue
* priority_queue
* DSU parent arrays
* Fenwick update/query pattern
* binary-search loops
* recursion
* adjacency lists
* common STL patterns

AI can be added later for semantic reasoning.

The system should remain useful without an AI API dependency.

---

# 22. FRIEND CODING FINGERPRINT

For each friend, calculate observational statistics such as:

* language distribution
* algorithm distribution
* data-structure distribution
* tag distribution
* rating distribution
* typical complexity
* average attempts before AC
* WA frequency
* TLE frequency
* recent activity
* solving speed
* recurring techniques

Example:

```
CODERABHI27

Languages:
    C++ 94%
    Python 6%

Algorithms:
    Greedy
    Binary Search
    Graph
    DP

Patterns:
    STL-heavy
    iterative
    short functions
```

These are descriptive statistics.

Do NOT convert them into unsupported personality judgments.

---

# 23. MY PROFILE VS FRIENDS

Build analytics comparing:

```
MY PROFILE
FRIEND PROFILE
GROUP PROFILE
```

Do not rely only on raw number of solves.

Prefer normalized signals such as:

* rating-adjusted exposure
* tag diversity
* difficulty distribution
* recent activity
* number of distinct techniques
* repeated exposure to harder categories

The output should reveal areas where my peers show stronger demonstrated experience.

---

# 24. SKILL-GAP ENGINE

The system should answer:

```
"What am I relatively weak at compared with the people I track?"
```

Example:

```
DP                 HIGH GAP
Tree DP            HIGH GAP
Segment Tree       MEDIUM GAP
Game Theory        MEDIUM GAP
Binary Search      LOW GAP
```

Recommendations must be derived from observed data.

Do not generate generic study advice unrelated to the actual dataset.

---

# 25. PERSONALIZED LEARNING ENGINE

Possible output:

```
TODAY'S LEARNING TARGETS

1. Solve one 1600–1700 DP problem.
2. Study a peer's Tree DP attempt evolution.
3. Reattempt a problem where peer strategy differed significantly from mine.
```

The recommendation engine should consider:

* my weaknesses
* peer strengths
* difficulty
* recency
* repetition
* prior performance

Do not overwhelm the user with dozens of recommendations.

Prioritize the highest-value next action.

---

# 26. PROBLEM INTELLIGENCE PAGE

Create a dedicated route similar to:

```
/problem/:contestId/:index
```

The page should expose:

```
Problem identity
Rating
Tags
Editorial
Friends who attempted it
All attempts
Verdict sequence
Source availability
Source viewer
Code diff
Timeline
Learning signals
Approach analysis
My own attempts when available
My-vs-peer comparison
```

Conceptual layout:

```
--------------------------------------------------
1900C — PROBLEM NAME
Rating: 1900
Tags: Trees, DP
--------------------------------------------------

EDITORIAL
[VIEW EDITORIAL]

FRIEND ATTEMPTS

CoderAbhi27
WA → WA → TLE → AC
35 min
[TIMELINE] [CODE] [DIFF]

HarshitMathur
AC
4 min
[TIMELINE] [CODE]

Daksh_Mor
WA → AC
18 min
[TIMELINE] [CODE] [DIFF]

--------------------------------------------------

COMMON APPROACHES

Greedy
DP
Binary Search

--------------------------------------------------

MY APPROACH VS PEERS

ME
Peer A
Peer B
Editorial

--------------------------------------------------

WHAT I MISSED

Only show conclusions supported by actual evidence.
```

---

# 27. LIVE ACTIVITY FEED

The dashboard should show recent peer activity:

```
Friend
Problem
Verdict
Time
Analyze button
```

Clicking activity should open the relevant problem intelligence view.

The dashboard should NOT need to perform heavy Codeforces API retrieval just to render.

Use the local database.

---

# 28. EXISTING DASHBOARD

Preserve useful parts of the tactical UI.

Existing concepts include:

* rival watchlist
* rating
* last seen
* velocity
* rating buckets
* missed problems

Enhance them with:

* recent submissions
* problem intelligence access
* skill gaps
* friend profiles
* approach patterns

Visual polish is secondary to information quality.

---

# 29. FRONTEND ARCHITECTURE

Do not keep the entire system inside one giant App.jsx.

Use components/pages such as:

```
Dashboard
LiveActivityFeed
RivalTable
ProblemExplorer
ProblemIntelligence
SubmissionTimeline
SubmissionCodeViewer
CodeDiffViewer
FriendProfile
SkillGapPanel
LearningRecommendations
EditorialPanel
```

Names may vary according to the existing repository.

---

# 30. API CONTRACT

At minimum, provide clean endpoints such as:

```
GET  /api/health

POST /api/sync

GET  /api/sync/status

GET  /api/dashboard

GET  /api/activity

GET  /api/rivals

GET  /api/problems

GET  /api/problems/:contestId/:index

GET  /api/problems/:contestId/:index/friends

GET  /api/friends/:handle

GET  /api/friends/:handle/problems

GET  /api/friends/:handle/problems/:contestId/:index/submissions

GET  /api/submissions/:submissionId

GET  /api/submissions/:submissionId/source

GET  /api/submissions/diff/:id1/:id2

GET  /api/analytics/skills

GET  /api/analytics/friends/:handle
```

Adapt this contract to the actual implementation where appropriate.

---

# 31. PERFORMANCE

Design for at least the current friend count and future growth.

Mandatory:

* database indexes
* incremental sync
* caching
* pagination
* controlled concurrency
* lazy source retrieval
* no repeated expensive analysis
* no full historical ingestion during normal dashboard loads

Avoid N+1 queries.

---

# 32. FAILURE ISOLATION

The following must be independently survivable:

```
Codeforces API failure
database failure
source retrieval failure
editorial retrieval failure
parser failure
analysis failure
one user's invalid handle
```

Example:

If Friend A's source page cannot be parsed:

```
Friend A source = ERROR
```

but:

```
Friend B/C/D data continues to work.
```

---

# 33. TESTING

Do not rely on live Codeforces during tests.

Use fixtures/mocks.

Test at minimum:

```
API parsing
pagination
incremental synchronization
duplicate prevention
cursor handling
submission grouping
chronological ordering
verdict sequencing
source extraction
source failure
diff generation
editorial association
learning-signal calculation
analytics aggregation
```

Run:

* tests
* lint
* frontend build

after major implementation changes.

---

# 34. GEMINI PROPOSAL — TREAT AS REFERENCE ONLY

A previous model supplied an implementation proposal containing:

* Submission model
* SyncState model
* Cheerio source extraction
* incremental sync
* REST endpoints
* React Router
* ProblemIntelligence page
* source diffing
* Jest/Supertest tests

Useful pieces include:

* persistent submission storage
* source-fetch isolation
* attempt timelines
* problem-level grouping
* version diff concept

However the proposal is NOT production-ready and must be audited.

Known weaknesses to correct:

## 34.1 Pagination

The proposal's sync implementation does not robustly paginate complete historical user.status data.

Correct this.

## 34.2 Background sync

The proposal returns a response saying sync runs asynchronously but continues executing inside the request handler.

Correct this architecture.

## 34.3 Rate-limit assumptions

The proposal contains an arbitrary delay and an unsupported/simple rate-limit comment.

Verify current behavior and centralize rate limiting.

## 34.4 Source parser

The proposal assumes one DOM selector:

```
#program-source-text
```

Treat this only as a parser implementation detail that must be verified against CURRENT public pages.

Make parser failures graceful.

## 34.5 Source storage

The proposal stores source directly inside Submission.

Prefer a separate SourceVersion/SubmissionSource model when practical.

## 34.6 Editorial implementation

The proposal claims editorial support conceptually but does not contain a complete editorial service.

Actually implement or explicitly mark unavailable.

## 34.7 AI/code analysis

The proposal mentions advanced analysis but does not actually implement a serious algorithm/DS/skill analysis engine.

Do not claim these features are complete unless they are implemented.

## 34.8 Frontend completeness

The proposal's ProblemIntelligence page is only a foundation.

Extend it to deliver the full intended learning workflow.

## 34.9 Testing

The proposal's tests are mostly boundary tests and include a mocked endpoint rather than comprehensive real service behavior.

Increase test coverage.

---

# 35. DATA ETHICS / ACCESS BOUNDARY

This system operates on public competitive-programming information.

Allowed:

* public Codeforces user metadata
* public submission metadata
* publicly accessible submission pages
* publicly accessible editorials/blogs

Not allowed:

* private repositories
* private submissions
* credentials belonging to others
* bypassing authentication
* bypassing CAPTCHA/security controls
* leaked data
* hidden/private activity

The purpose is learning from publicly observable programming activity, not unauthorized surveillance.

---

# 36. PRODUCT PHILOSOPHY

The application should encourage:

```
LEARN THE PATTERN
NOT
COPY THE CODE
```

The ideal interaction is:

```
Friend solves problem
    ↓
inspect attempt history
    ↓
predict their approach
    ↓
inspect source
    ↓
inspect evolution
    ↓
compare against editorial
    ↓
compare against my own approach
    ↓
identify missed idea
    ↓
practice the underlying technique
```

This should shape the UX.

---

# 37. FUTURE FEATURES

Do not implement these before the core system works.

Potential future additions:

* semantic code-change explanations
* AST-based structural diffs
* advanced algorithm classification
* automatic complexity estimation
* peer clusters
* skill graph visualization
* personalized problem generation
* spaced repetition
* mistake taxonomy
* contest-specific performance analysis
* "predict friend's approach before reveal" mode
* AI-assisted approach comparison

The current priority is reliable data and reproducible analysis.

---

# 38. IMPLEMENTATION ORDER

Implement in this order:

```
PHASE 1
Existing Codeforces ingestion refactor

PHASE 2
MongoDB persistence

PHASE 3
Complete historical sync

PHASE 4
Incremental sync

PHASE 5
All attempts per problem

PHASE 6
Public source adapter

PHASE 7
Source storage/versioning

PHASE 8
Code diff

PHASE 9
Editorial adapter

PHASE 10
Timeline + learning signals

PHASE 11
Algorithm / DS analysis

PHASE 12
Friend fingerprints

PHASE 13
My-vs-peer comparison

PHASE 14
Skill gaps

PHASE 15
Personalized learning

PHASE 16
Final dashboard / UX polish
```

Do not jump to advanced AI analysis while ingestion is unreliable.

---

# 39. DEFINITION OF DONE

The system is successful when I can:

```
1. Start backend.
2. Start frontend.
3. Trigger a sync.
4. Import tracked friends.
5. Persist submission metadata.
6. Open a problem.
7. See every known attempt by each friend.
8. See exact chronological verdict progression.
9. See timestamps/language.
10. Retrieve public source when available.
11. View different code versions.
12. Diff code versions.
13. See editorial information when reliably available.
14. See transparent learning/evidence signals.
15. Inspect observed friend coding patterns.
16. Compare my approach against peer approaches.
17. Identify skill gaps.
18. Receive evidence-based learning targets.
19. Continue using the existing dashboard functionality.
20. Recover gracefully from external failures.
```

---

# 40. CLAUDE'S OPERATING RULE

Before implementing any feature:

```
INSPECT
    ↓
VERIFY
    ↓
DESIGN
    ↓
IMPLEMENT
    ↓
TEST
    ↓
VERIFY AGAIN
```

Never:

```
GUESS
    ↓
CODE
    ↓
CLAIM DONE
```

When an external limitation exists, explicitly model it.

When a feature cannot reliably be implemented, implement the strongest reliable fallback rather than faking completeness.

The ultimate objective is:

> Turn public peer coding activity into a technically reliable personal competitive-programming learning engine.

Priorities:

```
CORRECTNESS
  >
DATA INTEGRITY
  >
RELIABILITY
  >
LEARNING VALUE
  >
PERFORMANCE
  >
UI POLISH
```
