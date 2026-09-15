'use strict';

const Submission = require('../models/Submission');
const SyncState   = require('../models/SyncState');
const User        = require('../models/User');

const RECENT_WINDOW_SECONDS = 180 * 24 * 60 * 60;
const MIN_PEER_RATED_SOLVES = 3;
const MAX_PROBLEM_RATING = 3500;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundTo100(value) {
  return Math.round(value / 100) * 100;
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

function uniqueSolvedProblems(submissions) {
  const solvedSet = new Map();
  for (const s of submissions || []) {
    if (s.verdict && s.verdict !== 'OK') continue;
    const key = `${s.contestId}_${s.problemIndex}`;
    if (!solvedSet.has(key)) solvedSet.set(key, s);
  }
  return Array.from(solvedSet.values());
}

/**
 * Build difficulty-aware tag statistics from accepted submissions.
 * A tag is measured by demonstrated difficulty + sample size, not by its share
 * of all solved problems. This avoids false gaps for high-volume/elite users.
 */
function buildSkillProfile(submissions, nowSeconds = Math.floor(Date.now() / 1000)) {
  const solved = uniqueSolvedProblems(submissions);
  const recentCutoff = nowSeconds - RECENT_WINDOW_SECONDS;
  const tagBuckets = new Map();
  const overallRatings = [];
  const recentRatings = [];

  for (const s of solved) {
    const rating = Number.isFinite(s.problemRating) ? s.problemRating : null;
    const isRecent = Number.isFinite(s.creationTimeSeconds) && s.creationTimeSeconds >= recentCutoff;

    if (rating != null) {
      overallRatings.push(rating);
      if (isRecent) recentRatings.push(rating);
    }

    for (const tag of (s.tags || [])) {
      if (!tagBuckets.has(tag)) {
        tagBuckets.set(tag, { solvedCount: 0, ratedCount: 0, recentCount: 0, ratings: [] });
      }
      const bucket = tagBuckets.get(tag);
      bucket.solvedCount += 1;
      if (rating != null) {
        bucket.ratedCount += 1;
        bucket.ratings.push(rating);
      }
      if (isRecent) bucket.recentCount += 1;
    }
  }

  const tags = {};
  for (const [tag, bucket] of tagBuckets.entries()) {
    tags[tag] = {
      solvedCount: bucket.solvedCount,
      ratedCount: bucket.ratedCount,
      recentCount: bucket.recentCount,
      medianRating: percentile(bucket.ratings, 0.50),
      q75Rating: percentile(bucket.ratings, 0.75),
      maxRating: bucket.ratings.length ? Math.max(...bucket.ratings) : null
    };
  }

  return {
    totalSolved: solved.length,
    ratedSolved: overallRatings.length,
    overallMedianRating: percentile(overallRatings, 0.50),
    overallQ75Rating: percentile(overallRatings, 0.75),
    recentQ75Rating: percentile(recentRatings, 0.75),
    tags
  };
}

function profileDifficultyFloor(profile, userRating) {
  const ratingFloor = userRating > 0 ? Math.min(userRating, MAX_PROBLEM_RATING) - 200 : 0;
  const historyFloor = profile.overallQ75Rating || 0;
  return clamp(Math.max(800, ratingFloor, historyFloor), 800, MAX_PROBLEM_RATING);
}

function tagStrength(stats) {
  if (!stats || stats.solvedCount <= 0) return 0;
  const difficulty = stats.q75Rating || 800;
  const difficultyScore = clamp((difficulty - 800) / (MAX_PROBLEM_RATING - 800), 0, 1);
  const volumeScore = clamp(Math.log2(1 + stats.solvedCount) / 5, 0, 1);
  const recentScore = clamp(stats.recentCount / 8, 0, 1);
  return clamp(0.75 * difficultyScore + 0.20 * volumeScore + 0.05 * recentScore, 0, 1);
}

/**
 * Compare one personal tag profile to one peer benchmark.
 * Volume can strengthen evidence, but cannot by itself create a medium/high gap.
 */
function evaluateTagGap(myStats, peerStats, context = {}) {
  const myRating = context.myRating || 0;
  const peerRating = context.peerRating || 0;
  const myDifficultyFloor = context.myDifficultyFloor || 800;

  if (!peerStats || peerStats.ratedCount < MIN_PEER_RATED_SOLVES || peerStats.q75Rating == null) {
    return { gapLevel: 'NONE', gapScore: 0, difficultyDelta: 0 };
  }

  const myTag = myStats || { solvedCount: 0, ratedCount: 0, recentCount: 0, q75Rating: null };
  const myDifficulty = Math.max(myTag.q75Rating || 0, myDifficultyFloor);
  const difficultyDelta = peerStats.q75Rating - myDifficulty;

  // A substantially lower-rated peer doing more easy problems is not evidence
  // that the stronger user needs practice in that tag.
  const peerClearlyWeaker = myRating > 0 && peerRating > 0 && peerRating < myRating - 500;
  if (peerClearlyWeaker && difficultyDelta < 250) {
    return { gapLevel: 'NONE', gapScore: 0, difficultyDelta };
  }

  // If my demonstrated tag difficulty is already higher, raw solve volume is
  // descriptive only and should not become a prescriptive "gap".
  if (difficultyDelta < -100) {
    return { gapLevel: 'NONE', gapScore: 0, difficultyDelta };
  }

  const countRatio = (peerStats.solvedCount + 1) / (myTag.solvedCount + 1);
  const difficultyComponent = clamp(difficultyDelta / 400, 0, 1);
  const volumeComponent = difficultyDelta >= -50
    ? clamp(Math.log2(Math.max(1, countRatio)) / 2, 0, 1)
    : 0;

  let gapScore = 0.75 * difficultyComponent + 0.25 * volumeComponent;

  // Missing exposure can be a real gap only when the peer evidence is both
  // sufficiently difficult and sufficiently repeated.
  if (myTag.ratedCount === 0 && peerStats.ratedCount >= 5 && difficultyDelta >= 100) {
    gapScore = Math.max(gapScore, 0.46);
  }

  let gapLevel = 'NONE';
  if (gapScore >= 0.70 && peerStats.ratedCount >= 5) gapLevel = 'HIGH';
  else if (gapScore >= 0.45 && peerStats.ratedCount >= 4) gapLevel = 'MEDIUM';
  else if (gapScore >= 0.25) gapLevel = 'LOW';

  return { gapLevel, gapScore, difficultyDelta };
}

function confidenceFor(peerStats, supportingPeerCount) {
  if (peerStats.ratedCount >= 8 && supportingPeerCount >= 2) return 'HIGH';
  if (peerStats.ratedCount >= 5) return 'MEDIUM';
  return 'LOW';
}

function buildGapReason(tag, myStats, peerStats, benchmarkHandle, difficultyDelta, myComparableDifficulty) {
  const myCount = myStats?.solvedCount || 0;
  const peerQ75 = peerStats?.q75Rating;
  const peerCount = peerStats?.solvedCount || 0;

  if (!myStats || (myStats.ratedCount || 0) === 0) {
    return `${benchmarkHandle} has ${peerCount} rated ${tag} solves with a 75th-percentile difficulty around ${peerQ75}. You have no rated ${tag} solve in the synced history.`;
  }

  if (difficultyDelta >= 100) {
    return `${benchmarkHandle}'s ${tag} benchmark is about ${Math.round(difficultyDelta / 100) * 100} rating points higher (${peerQ75} vs your ${myComparableDifficulty} rating/history benchmark).`;
  }

  return `${benchmarkHandle} has stronger repeated ${tag} evidence (${peerCount} solves vs ${myCount}) at comparable difficulty.`;
}

async function loadReadyContext(myHandle, friendHandles) {
  const handles = [myHandle, ...friendHandles];
  const [states, users] = await Promise.all([
    SyncState.find({ handle: { $in: handles } }).lean(),
    User.find({ handle: { $in: handles } }).lean()
  ]);

  const stateMap = new Map(states.map(s => [s.handle, s]));
  const userMap = new Map(users.map(u => [u.handle, u]));
  const myState = stateMap.get(myHandle);

  // Never generate personalized advice from a partial personal history.
  if (!myState || myState.status !== 'done') {
    return { ready: false, readyFriends: [], userMap };
  }

  const readyFriends = friendHandles.filter(handle => stateMap.get(handle)?.status === 'done');
  return { ready: readyFriends.length > 0, readyFriends, userMap };
}

async function computeProfile(handle) {
  const submissions = await Submission.find({ handle, verdict: 'OK' })
    .select('contestId problemIndex problemRating tags verdict creationTimeSeconds')
    .lean();
  return buildSkillProfile(submissions);
}

async function computeSkillGaps(myHandle, friendHandles) {
  if (!myHandle || !Array.isArray(friendHandles) || friendHandles.length === 0) return [];

  const context = await loadReadyContext(myHandle, friendHandles);
  if (!context.ready) return [];

  const handles = [myHandle, ...context.readyFriends];
  const profiles = await Promise.all(handles.map(computeProfile));
  const myProfile = profiles[0];
  const friendProfiles = context.readyFriends.map((handle, index) => ({
    handle,
    profile: profiles[index + 1],
    rating: context.userMap.get(handle)?.rating || 0
  }));

  const myRating = context.userMap.get(myHandle)?.rating || 0;
  const myDifficultyFloor = profileDifficultyFloor(myProfile, myRating);

  const allTags = new Set(Object.keys(myProfile.tags));
  for (const friend of friendProfiles) {
    for (const tag of Object.keys(friend.profile.tags)) allTags.add(tag);
  }

  const gaps = [];

  for (const tag of allTags) {
    const myStats = myProfile.tags[tag] || null;

    const candidates = friendProfiles
      .map(friend => ({
        ...friend,
        stats: friend.profile.tags[tag] || null
      }))
      .filter(friend => friend.stats && friend.stats.ratedCount >= MIN_PEER_RATED_SOLVES)
      .sort((a, b) => {
        const q75Diff = (b.stats.q75Rating || 0) - (a.stats.q75Rating || 0);
        if (q75Diff !== 0) return q75Diff;
        return b.stats.solvedCount - a.stats.solvedCount;
      });

    if (candidates.length === 0) continue;

    const benchmark = candidates[0];
    const evaluation = evaluateTagGap(myStats, benchmark.stats, {
      myRating,
      peerRating: benchmark.rating,
      myDifficultyFloor
    });

    const myComparableDifficulty = Math.max(myStats?.q75Rating || 0, myDifficultyFloor);
    const supportingPeerCount = candidates.filter(c =>
      c.stats.q75Rating != null && c.stats.q75Rating >= myComparableDifficulty + 100
    ).length;
    const confidence = confidenceFor(benchmark.stats, supportingPeerCount);
    const actionable = (evaluation.gapLevel === 'HIGH' || evaluation.gapLevel === 'MEDIUM') && confidence !== 'LOW';

    if (evaluation.gapLevel === 'NONE') continue;
    if (!actionable) continue;

    const myScore = tagStrength(myStats);
    const peerAvgScore = tagStrength(benchmark.stats);
    const gap = peerAvgScore - myScore;

    gaps.push({
      tag,
      myScore,
      peerAvgScore,
      gap,
      gapLevel: evaluation.gapLevel,
      gapScore: evaluation.gapScore,
      confidence,
      actionable,
      benchmarkPeer: benchmark.handle,
      supportingPeerCount,
      myEvidence: {
        solvedCount: myStats?.solvedCount || 0,
        ratedCount: myStats?.ratedCount || 0,
        recentCount: myStats?.recentCount || 0,
        q75Rating: myStats?.q75Rating || null,
        comparisonRating: myComparableDifficulty
      },
      peerEvidence: {
        solvedCount: benchmark.stats.solvedCount,
        ratedCount: benchmark.stats.ratedCount,
        recentCount: benchmark.stats.recentCount,
        q75Rating: benchmark.stats.q75Rating,
        comparisonRating: benchmark.stats.q75Rating
      },
      reason: buildGapReason(tag, myStats, benchmark.stats, benchmark.handle, evaluation.difficultyDelta, myComparableDifficulty)
    });
  }

  gaps.sort((a, b) => {
    if (a.actionable !== b.actionable) return a.actionable ? -1 : 1;
    if (b.gapScore !== a.gapScore) return b.gapScore - a.gapScore;
    return b.gap - a.gap;
  });

  return gaps;
}

function suggestDifficultyRange(userRating, profile, peerQ75 = null) {
  const recent = profile.recentQ75Rating || 0;
  const historical = profile.overallQ75Rating || 0;
  const current = userRating > 0 ? Math.min(userRating, MAX_PROBLEM_RATING) : 0;
  let baseline = Math.max(800, recent, historical, current);

  if (peerQ75 != null && peerQ75 > baseline) {
    baseline = Math.min(peerQ75, baseline + 200);
  }

  const low = clamp(roundTo100(baseline), 800, 3400);
  const high = Math.min(low + 200, MAX_PROBLEM_RATING);
  return `${low}-${high}`;
}

async function generateLearningTargets(myHandle, friendHandles, limit = 5) {
  const gaps = await computeSkillGaps(myHandle, friendHandles);
  const meaningfulGaps = gaps.filter(g => g.actionable && (g.gapLevel === 'HIGH' || g.gapLevel === 'MEDIUM'));
  if (meaningfulGaps.length === 0) return [];

  const [user, myProfile] = await Promise.all([
    User.findOne({ handle: myHandle }).lean(),
    computeProfile(myHandle)
  ]);
  const userRating = user?.rating || 0;

  return meaningfulGaps.slice(0, limit).map((gap, index) => {
    const suggestedRating = suggestDifficultyRange(userRating, myProfile, gap.peerEvidence?.q75Rating || null);
    return {
      priority: index + 1,
      action: `Solve one ${suggestedRating} ${gap.tag} problem`,
      reason: gap.reason,
      relatedTag: gap.tag,
      suggestedRating,
      confidence: gap.confidence,
      benchmarkPeer: gap.benchmarkPeer
    };
  });
}

module.exports = {
  buildSkillProfile,
  evaluateTagGap,
  suggestDifficultyRange,
  computeSkillGaps,
  generateLearningTargets
};
