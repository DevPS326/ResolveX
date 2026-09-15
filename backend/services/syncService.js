'use strict';

const { getUserInfo, fetchAllSubmissionsSince } = require('./codeforcesService');
const { extractProblems } = require('./problemService');
const { getTrackerConfig } = require('./trackerConfigService');
const User = require('../models/User');
const Submission = require('../models/Submission');
const SyncState = require('../models/SyncState');
const Problem = require('../models/Problem');

// In-memory lock: prevents concurrent sync runs for the same handle
const runningHandles = new Set();

function mapSubmission (handle, sub) {
  const contestId = sub.contestId != null
    ? sub.contestId
    : (sub.problem && sub.problem.contestId != null ? sub.problem.contestId : null);

  const problemIndex = sub.problem ? sub.problem.index : null;

  const submissionUrl = contestId != null
    ? `https://codeforces.com/contest/${contestId}/submission/${sub.id}`
    : `https://codeforces.com/submission/${sub.id}`;

  return {
    submissionId:        sub.id,
    handle,
    contestId,
    problemIndex,
    problemName:         sub.problem ? (sub.problem.name || null) : null,
    problemRating:       sub.problem ? (sub.problem.rating != null ? sub.problem.rating : null) : null,
    tags:                sub.problem ? (sub.problem.tags || []) : [],
    verdict:             sub.verdict || 'UNKNOWN',
    programmingLanguage: sub.programmingLanguage || null,
    creationTimeSeconds: sub.creationTimeSeconds != null ? sub.creationTimeSeconds : null,
    relativeTimeSeconds: sub.relativeTimeSeconds != null ? sub.relativeTimeSeconds : null,
    submissionUrl,
    sourceAvailable:   false,
    sourceFetchStatus: 'PENDING'
  };
}

async function syncUser (handle) {
  if (runningHandles.has(handle)) {
    return { handle, skipped: true, reason: 'already running' };
  }

  runningHandles.add(handle);

  await SyncState.findOneAndUpdate(
    { handle },
    { $set: { status: 'running', error: null } },
    { upsert: true }
  );

  try {
    const userInfoArr = await getUserInfo([handle]);
    const userInfo = userInfoArr && userInfoArr[0];
    if (!userInfo) throw new Error(`No user info returned for handle: ${handle}`);

    await User.findOneAndUpdate(
      { handle },
      {
        $set: {
          handle,
          rating:     userInfo.rating || 0,
          rank:       userInfo.rank || 'unrated',
          lastOnline: userInfo.lastOnlineTimeSeconds || 0,
          syncedAt:   new Date()
        }
      },
      { upsert: true }
    );

    const state = await SyncState.findOne({ handle });
    const cursor = (state && state.lastSyncedSubmissionId) ? state.lastSyncedSubmissionId : 0;
    const newSubs = await fetchAllSubmissionsSince(handle, cursor);

    if (newSubs.length === 0) {
      await SyncState.findOneAndUpdate(
        { handle },
        { $set: { status: 'done', lastSyncAt: new Date() } }
      );
      return { handle, newSubmissions: 0 };
    }

    const ops = newSubs.map(sub => ({
      updateOne: {
        filter:  { submissionId: sub.id },
        update:  { $setOnInsert: mapSubmission(handle, sub) },
        upsert:  true
      }
    }));

    await Submission.bulkWrite(ops, { ordered: false });

    const problems = extractProblems(newSubs);
    if (problems.length > 0) {
      const problemOps = problems.map(p => ({
        updateOne: {
          filter: { contestId: p.contestId, index: p.index },
          update: { $set: { name: p.name, rating: p.rating, tags: p.tags, updatedAt: new Date() } },
          upsert: true
        }
      }));
      await Problem.bulkWrite(problemOps, { ordered: false });
    }

    const highestId = newSubs.reduce((max, s) => Math.max(max, s.id), cursor);

    await SyncState.findOneAndUpdate(
      { handle },
      {
        $set: {
          lastSyncedSubmissionId: highestId,
          lastSyncAt:             new Date(),
          status:                 'done',
          error:                  null
        }
      }
    );

    return { handle, newSubmissions: newSubs.length };

  } catch (err) {
    await SyncState.findOneAndUpdate(
      { handle },
      { $set: { status: 'error', error: err.message } }
    ).catch(() => {});
    throw err;

  } finally {
    runningHandles.delete(handle);
  }
}

async function syncAll () {
  const { allHandles } = await getTrackerConfig();
  const results = [];

  for (const handle of allHandles) {
    try {
      const result = await syncUser(handle);
      results.push({ ...result, success: true });
    } catch (err) {
      results.push({ handle, success: false, error: err.message });
    }
  }

  return results;
}

async function getSyncStatus () {
  const { allHandles } = await getTrackerConfig();
  if (allHandles.length === 0) return [];

  const states = await SyncState.find({ handle: { $in: allHandles } }).lean();
  const stateMap = {};
  states.forEach(s => { stateMap[s.handle] = s; });

  return allHandles.map(handle => {
    const s = stateMap[handle];
    return {
      handle,
      status:                 s ? s.status : 'never_synced',
      lastSyncAt:             s ? s.lastSyncAt : null,
      lastSyncedSubmissionId: s ? s.lastSyncedSubmissionId : 0,
      error:                  s ? s.error : null
    };
  });
}

module.exports = { syncUser, syncAll, getSyncStatus, mapSubmission };
