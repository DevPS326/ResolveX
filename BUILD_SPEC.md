# BUILD SPEC — CP COMBAT COMMAND INTELLIGENCE ENGINE

## 1. PRODUCT OBJECTIVE

Transform the existing CP COMBAT COMMAND project into a reliable personal Competitive Programming Intelligence and Learning Engine.

The product must turn publicly available Codeforces activity from tracked peers into structured learning material.

Core outcome:

PROBLEM
→ FRIENDS WHO ATTEMPTED IT
→ ALL ATTEMPTS
→ VERDICTS + TIMESTAMPS
→ PUBLIC SOURCE CODE WHEN AVAILABLE
→ CODE VERSION HISTORY
→ CODE DIFF / EVOLUTION
→ EDITORIAL INFORMATION WHEN RELIABLY AVAILABLE
→ APPROACH ANALYSIS
→ PEER PATTERNS
→ MY APPROACH VS PEERS
→ MY SKILL GAPS
→ PERSONALIZED LEARNING TARGETS

The product is not primarily a surveillance dashboard.

Its purpose is to help me understand how other programmers solve problems and how I should improve.

---

# 2. EXISTING APPLICATION MUST BE PRESERVED

The current application already contains:

* Codeforces user tracking
* my Codeforces handle
* tracked friend list
* user rating/rank
* recent activity / velocity
* solved problem aggregation
* tags
* missed problems
* rating buckets
* React dashboard
* tactical visual styling

Do not discard these capabilities.

Refactor and extend them.

Do not rewrite unrelated functionality without a technical reason.

---

# 3. TARGET ARCHITECTURE

Use the existing stack unless there is a strong reason not to.

Backend:

* Node.js
* Express
* MongoDB
* Mongoose
* axios

Frontend:

* React
* Vite
* existing CSS/Tailwind setup
* existing Recharts/Lucide dependencies where useful

Architecture:

Codeforces Official API
|
v
API Adapter
|
v
Sync Engine
|
v
MongoDB
|
+----------------------+
|                      |
v                      v
Submission Metadata       Problem / Contest
|                      |
v                      v
Public Source Adapter    Editorial Adapter
|                      |
+----------+-----------+
|
v
Analysis Engine
|
+----------+----------+
|          |           |
v          v           v
Attempts    Approaches   Peer Skills
|          |           |
+----------+-----------+
|
v
Learning Engine
|
v
React UI

External data access must be isolated behind adapters/services.

---

# 4. DATA INGESTION

## 4.1 Codeforces user data

For every tracked user retrieve and persist:

* handle
* rating
* rank
* last online time
* submissions

Use the official Codeforces API where supported.

Do not fabricate undocumented endpoints.

Verify current API behavior before implementation.

---

## 4.2 Complete submission history

The system must retain every known submission for every tracked user.

A submission is an individual attempt, not just an accepted solution.

Store:

* submission ID
* handle
* contest ID
* problem index
* problem name
* problem rating
* tags
* verdict
* programming language
* creation timestamp
* relative time
* submission URL

Example:

Friend A
Problem C

14:02 WA
14:08 WA
14:19 TLE
14:37 AC

All four submissions must remain available.

Do not collapse them into a single "solved" record.

---

# 5. HISTORICAL SYNC

Implement complete historical synchronization.

The implementation must:

* paginate correctly
* handle the full available submission history
* persist data incrementally
* avoid duplicates
* survive partial failures

Do not assume a single Codeforces API response contains the entire history.

Initial synchronization may process historical data.

---

# 6. INCREMENTAL SYNC

After initial ingestion, normal synchronization must fetch only new submissions.

Maintain persistent sync state per user.

Store:

* handle
* newest processed submission ID
* last sync time
* status
* error information where useful

Do not refetch the entire submission history on every dashboard load.

---

# 7. RATE LIMITING

All Codeforces requests must use a centralized rate-limited mechanism.

Requirements:

* controlled concurrency
* safe request spacing
* retry/backoff for transient failures
* handling of rate-limit responses
* no uncontrolled parallel requests

Use current verified Codeforces limits.

Do not distribute arbitrary delays throughout unrelated services.

---

# 8. SYNCHRONIZATION API

Provide a backend sync mechanism.

Conceptually:

POST /api/sync

The endpoint should initiate synchronization and return promptly.

Synchronization should be represented as a job/state process rather than pretending that a long-running operation is asynchronous while still executing inside the request handler.

Provide sync-status information to the frontend.

---

# 9. DATABASE MODELS

Create clean persistent models for:

* User
* Problem
* Contest
* Submission
* SubmissionSource / CodeVersion
* Editorial
* SyncState

Use appropriate indexes.

Important indexes include:

* submissionId
* handle
* contestId + problemIndex
* handle + contestId + problemIndex
* creationTimeSeconds

submissionId must be unique.

---

# 10. PUBLIC SOURCE CODE

The official Codeforces API does not generally provide other users' source code.

Therefore source-code retrieval must be a separate adapter.

Conceptual pipeline:

submission metadata
→ public submission URL
→ public page retrieval
→ source extraction
→ normalization
→ hashing
→ persistence

Only use publicly accessible information.

Do not:

* access private submissions
* use another person's credentials
* bypass authentication
* bypass CAPTCHAs
* bypass access controls

---

# 11. SOURCE-CODE STORAGE

Prefer a separate source/version entity rather than embedding large source blobs directly into Submission.

Store where available:

* submission ID
* source code
* normalized source
* source hash
* language
* fetched timestamp
* fetch status

Fetch states may include:

PENDING
SUCCESS
NOT_AVAILABLE
BLOCKED
PARSE_ERROR
ERROR

Source retrieval must not break submission ingestion.

Cache retrieved source.

Do not repeatedly retrieve the same submission source.

Lazy retrieval is preferred when appropriate.

---

# 12. ALL-ATTEMPTS PROBLEM VIEW

For:

friend + problem

the backend must return all known attempts chronologically.

Example:

CoderAbhi27
Problem 1900C

Attempt 1 — WA
Attempt 2 — WA
Attempt 3 — TLE
Attempt 4 — AC

Each attempt must expose:

* submission ID
* timestamp
* verdict
* language
* source availability

Also calculate:

* attempt count
* first attempt
* accepted attempt
* solving duration
* verdict sequence
* languages used

---

# 13. EDITORIAL DATA

Associate a problem/contest with an editorial when reliably identifiable.

Do not invent an official editorial API endpoint.

Verify the current Codeforces editorial/blog mechanism.

Editorial information should include, when reliably available:

* contest ID
* blog entry ID
* editorial URL
* publication/availability time
* retrieval timestamp
* fetch status

If no editorial can be confidently identified:

* mark it unavailable
* do not guess

---

# 14. EDITORIAL / ATTEMPT TIMING

When reliable editorial timing exists, compare:

editorial availability
vs
friend submission timestamps

Example:

Editorial:
18:30

Friend:
17:42 WA
17:51 WA
18:03 TLE
18:17 AC

The system may calculate evidence supporting independent work.

Another example:

Editorial:
18:30

Friend:
18:46 AC

This is weaker evidence.

IMPORTANT:

Timing can never prove whether a person copied or used an editorial.

The system must use conservative probabilistic/evidence language.

Allowed labels:

HIGH INDEPENDENT-ATTEMPT EVIDENCE
MIXED / UNCERTAIN
LOW INDEPENDENT-ATTEMPT EVIDENCE
INSUFFICIENT DATA

Never output:

"Friend copied editorial."

unless there is independent evidence that genuinely establishes that fact.

---

# 15. SOURCE VERSIONING

For a friend with multiple source-code versions:

V1
V2
V3
V4

retain each version when available.

Associate each version with its submission ID.

Enable:

V1 → V2
V2 → V3
V3 → V4

comparison.

---

# 16. CODE DIFF

Provide code diffs between two source versions.

The system should expose:

* additions
* deletions
* modified sections
* line counts
* source versions

Do not generate semantic explanations unless analysis supports them.

It is safe to say:

"31 lines changed."

It is not safe to automatically say:

"They discovered the binary-search invariant."

unless the analyzer can substantiate that conclusion.

---

# 17. APPROACH ANALYSIS

For source code where possible, identify:

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
* stack
* queue
* deque
* adjacency structures
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

Each classification must carry confidence:

HIGH
MEDIUM
LOW

Do not hallucinate algorithm classifications.

---

# 18. ANALYSIS STRATEGY

Prefer a layered analysis system:

1. deterministic/static source signals
2. structural heuristics
3. optional local AI analysis
4. optional external AI analysis only where justified

Do not require an expensive AI call for trivial pattern detection.

Examples of deterministic analysis:

* queue-based BFS patterns
* priority_queue usage
* DSU parent structure
* Fenwick update/query patterns
* binary-search loops
* recursive graph traversal
* adjacency-list construction

Use AI primarily for semantic analysis that deterministic methods cannot reliably provide.

---

# 19. LOCAL OLLAMA SUPPORT

The system should be architected so local Ollama can optionally provide analysis.

Prefer local models for:

* source summarization
* code explanation
* approach comparison
* attempt-difference explanation
* skill extraction
* clustering
* lightweight analysis

Do not make the entire core product dependent on Ollama.

The application must remain functional when no AI model is available.

Provide a clean AI adapter/interface so the model can be changed later.

---

# 20. FRIEND CODING FINGERPRINT

For each friend calculate observational statistics:

* language distribution
* problem-tag distribution
* algorithm distribution
* data-structure distribution
* rating distribution
* difficulty distribution
* average attempts to AC
* WA frequency
* TLE frequency
* solving duration
* recent activity
* recurring techniques

These are descriptive measurements.

Do not infer unsupported personality traits.

---

# 21. MY PROFILE

Build the same profile for my own Codeforces activity.

Track:

* solved problems
* rating
* tags
* algorithms
* data structures
* languages
* difficulty distribution
* attempt patterns
* recent activity

---

# 22. PEER COMPARISON

Compare my profile against:

* individual friends
* tracked friend group

Use normalized metrics rather than only raw solve counts.

Useful normalization dimensions:

* difficulty
* rating
* tag diversity
* recent activity
* technique diversity
* problem volume

---

# 23. SKILL-GAP ENGINE

Identify areas where peers demonstrate stronger exposure or demonstrated performance than me.

Example output:

DP
HIGH GAP

Tree DP
HIGH GAP

Segment Tree
MEDIUM GAP

Binary Search
LOW GAP

Game Theory
MEDIUM GAP

The result must be based on observed data.

Do not produce generic recommendations unrelated to the database.

---

# 24. LEARNING ENGINE

Convert identified gaps into actionable next steps.

Example:

TODAY'S LEARNING TARGETS

1. Solve one 1600–1700 DP problem.
2. Study a friend's Tree DP attempt evolution.
3. Reattempt a problem where the peer strategy differs from mine.

Recommendations should consider:

* current weaknesses
* peer strengths
* difficulty
* recent exposure
* repeated mistakes
* prior performance

Prioritize a small number of high-value actions.

---

# 25. MY APPROACH VS PEER APPROACH

Where my submission and a friend's submission for the same problem are available, support comparison.

Compare:

* algorithm
* data structures
* techniques
* complexity
* source structure
* implementation differences

Example:

ME
Binary Search + Prefix Sum

FRIEND A
Greedy invariant

FRIEND B
Two Pointers

EDITORIAL
Greedy invariant

Then identify differences supported by evidence.

Do not manufacture explanations.

---

# 26. PROBLEM INTELLIGENCE PAGE

Create:

/problem/:contestId/:index

This page is the core learning interface.

Display:

Problem title
Contest
Rating
Tags

EDITORIAL
[View Editorial]

FRIEND ATTEMPTS

Friend A
WA → WA → TLE → AC
35 min
[Timeline]
[Code]
[Diff]

Friend B
AC
4 min
[Timeline]
[Code]

Friend C
WA → AC
18 min
[Timeline]
[Code]
[Diff]

LEARNING SIGNALS

COMMON APPROACHES

MY APPROACH

PEER APPROACHES

MY VS PEER COMPARISON

WHAT I MISSED

Only show conclusions that are supported by actual retrieved/derived evidence.

---

# 27. SUBMISSION TIMELINE UI

For each friend display a chronological timeline.

Example:

14:02
WRONG ANSWER

14:08
WRONG ANSWER

14:19
TIME LIMIT EXCEEDED

14:37
ACCEPTED

Make each event clickable.

Clicking an attempt should allow:

* view source
* view metadata
* compare with another version

---

# 28. SOURCE VIEWER

Display source code clearly.

Show:

* language
* submission ID
* verdict
* timestamp
* line numbers

The source viewer must clearly indicate when source is unavailable.

Do not fake source retrieval.

---

# 29. LIVE ACTIVITY DASHBOARD

Enhance the existing dashboard with:

* recent friend submissions
* recent accepted solutions
* problems with multiple attempts
* problem intelligence links
* sync status
* current skill gaps
* learning targets

Dashboard data should come from local persistent data whenever possible.

Do not trigger full external synchronization merely to render the dashboard.

---

# 30. EXISTING DASHBOARD FEATURES

Preserve:

* rival watchlist
* rating/rank
* last activity
* velocity
* rating buckets
* missed problems

Add:

* submission intelligence
* problem deep dive
* friend profiles
* skill gap analytics

---

# 31. API DESIGN

Provide clean REST APIs.

Suggested endpoints:

GET /api/health

POST /api/sync

GET /api/sync/status

GET /api/dashboard

GET /api/activity

GET /api/rivals

GET /api/problems

GET /api/problems/:contestId/:index

GET /api/problems/:contestId/:index/friends

GET /api/friends/:handle

GET /api/friends/:handle/problems

GET /api/friends/:handle/problems/:contestId/:index/submissions

GET /api/submissions/:submissionId

GET /api/submissions/:submissionId/source

GET /api/submissions/diff/:id1/:id2

GET /api/analytics/skills

GET /api/analytics/friends/:handle

Adapt endpoint naming when the existing project architecture suggests a better design.

---

# 32. SEARCH AND FILTERING

Support filtering/search by:

Friend
Rating
Tag
Contest
Verdict
Language
Date
Solved/not solved
Attempt count

Problem search should support:

* problem name
* contest ID
* index
* tag

---

# 33. PERFORMANCE

Mandatory:

* database indexes
* caching
* incremental sync
* pagination
* controlled concurrency
* lazy source fetching
* cached analysis
* no repeated historical downloads
* no heavy computation in frontend

Avoid N+1 queries.

---

# 34. ERROR HANDLING

Handle gracefully:

* invalid handle
* Codeforces API failure
* rate limiting
* network errors
* unavailable public source
* source parser failure
* unavailable editorial
* duplicate submission
* database failure
* partial synchronization
* analysis failure

One user's failure must not stop all users from synchronizing.

---

# 35. TESTING

Use mocked/fixture data for tests.

Do not make tests depend on live Codeforces.

Test:

* API parsing
* pagination
* historical import
* incremental sync
* cursor behavior
* duplicate prevention
* grouping by problem
* chronological ordering
* verdict sequences
* source extraction
* source failures
* source caching
* code diff
* editorial handling
* learning signal calculation
* analytics
* API endpoints

Run:

* backend tests
* lint
* frontend build
* relevant integration tests

after major changes.

---

# 36. SECURITY / DATA BOUNDARIES

Only use public information.

Never:

* access private accounts
* access private submissions
* use stolen credentials
* bypass authentication
* bypass CAPTCHA
* bypass access controls
* scrape private repositories

The system is for learning from publicly observable competitive-programming activity.

---

# 37. UX PRINCIPLE

The product should encourage:

LEARN THE PATTERN
NOT
COPY THE CODE

Ideal user flow:

Friend solves problem
↓
Inspect all attempts
↓
Predict their approach
↓
Inspect code
↓
Inspect source evolution
↓
Compare against editorial
↓
Compare against my solution
↓
Identify missed idea
↓
Practice the underlying technique

---

# 38. IMPLEMENTATION PRIORITY

Build in this exact dependency order:

PHASE 1
Codeforces API/service refactor

PHASE 2
Database models/persistence

PHASE 3
Complete historical ingestion

PHASE 4
Incremental synchronization

PHASE 5
All attempts per problem

PHASE 6
Public source retrieval

PHASE 7
Source versioning/caching

PHASE 8
Code diff

PHASE 9
Editorial integration

PHASE 10
Attempt timeline + evidence signals

PHASE 11
Problem Intelligence UI

PHASE 12
Algorithm/data-structure analysis

PHASE 13
Friend fingerprints

PHASE 14
My-vs-peer comparison

PHASE 15
Skill-gap engine

PHASE 16
Teaching/recommendation engine

PHASE 17
Final dashboard integration

Do not implement advanced intelligence before the underlying data pipeline is reliable.

---

# 39. DEFINITION OF DONE

The finished system must allow me to:

1. Start backend.
2. Start frontend.
3. Trigger synchronization.
4. Import tracked users.
5. Persist submission history.
6. Open any tracked problem.
7. See every known attempt by each friend.
8. See chronological verdicts.
9. See timestamps and programming languages.
10. Retrieve public source when available.
11. View different source versions.
12. Compare source versions.
13. See editorial information when reliably available.
14. See conservative evidence/learning signals.
15. Inspect observed coding patterns.
16. Compare my solution with peer solutions.
17. Identify skill gaps.
18. Receive evidence-based learning targets.
19. Continue using existing CP tracker functionality.
20. Remain functional when external APIs, source pages, editorials, or AI services fail.

---

# 40. QUALITY BAR

Do not optimize for number of files or number of features.

Optimize for:

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

Do not mark a feature complete merely because code exists.

A feature is complete only when it has been:

* implemented
* tested
* exercised against realistic data
* verified to fail gracefully
* integrated into the application

---

# 41. CRITICAL PRODUCT TEST

The final system should make this question easy to answer:

"For Problem X, what did each strong peer do, how did their attempts evolve, what differs from my approach, and what should I learn from that?"

If the implementation cannot answer that question reliably, the product is not finished.
