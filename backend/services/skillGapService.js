'use strict';

const Submission = require('../models/Submission');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute a tag score map for a handle: tag → (solved with tag / total solved).
 * Returns { totalSolved, tagScores: { [tag]: number } }.
 * @param {string} handle
 * @returns {Promise<{ totalSolved: number, tagScores: Object }>}
 */
async function computeTagScores(handle) {
  const subs = await Submission.find({ handle, verdict: 'OK' }).lean();

  // Deduplicate by (contestId, problemIndex) — keep one per unique solved problem
  const solvedSet = new Map();
  for (const s of subs) {
    const key = `${s.contestId}_${s.problemIndex}`;
    if (!solvedSet.has(key)) solvedSet.set(key, s);
  }

  const solvedList   = Array.from(solvedSet.values());
  const totalSolved  = solvedList.length;

  const tagCounts = {};
  for (const s of solvedList) {
    for (const tag of (s.tags || [])) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const tagScores = {};
  for (const [tag, count] of Object.entries(tagCounts)) {
    tagScores[tag] = totalSolved > 0 ? count / totalSolved : 0;
  }

  return { totalSolved, tagScores };
}

/**
 * Determine gap level from myScore and peerAvgScore.
 * @param {number} myScore
 * @param {number} peerAvgScore
 * @returns {'HIGH'|'MEDIUM'|'LOW'|'NONE'}
 */
function classifyGap(myScore, peerAvgScore) {
  if (peerAvgScore <= 0) return 'NONE';
  if (peerAvgScore > myScore * 2)   return 'HIGH';
  if (peerAvgScore > myScore * 1.5) return 'MEDIUM';
  if (peerAvgScore > myScore * 1.1) return 'LOW';
  return 'NONE';
}

// ---------------------------------------------------------------------------
// Public: computeSkillGaps
// ---------------------------------------------------------------------------

/**
 * Compare my tag/algorithm exposure vs. peers.
 *
 * @param {string}   myHandle
 * @param {string[]} friendHandles
 * @returns {Promise<Array<{
 *   tag: string,
 *   myScore: number,
 *   peerAvgScore: number,
 *   gap: number,
 *   gapLevel: 'HIGH'|'MEDIUM'|'LOW'|'NONE'
 * }>>}
 */
async function computeSkillGaps(myHandle, friendHandles) {
  const [myData, ...friendsData] = await Promise.all([
    computeTagScores(myHandle),
    ...friendHandles.map(h => computeTagScores(h))
  ]);

  // Collect all tags seen across peers
  const allTags = new Set();
  for (const fd of friendsData) {
    for (const tag of Object.keys(fd.tagScores)) allTags.add(tag);
  }
  // Also add my tags
  for (const tag of Object.keys(myData.tagScores)) allTags.add(tag);

  const gaps = [];

  for (const tag of allTags) {
    const myScore = myData.tagScores[tag] || 0;

    // Average peer score for this tag
    let peerSum   = 0;
    let peerCount = 0;
    for (const fd of friendsData) {
      if (fd.tagScores[tag] != null) {
        peerSum += fd.tagScores[tag];
        peerCount++;
      } else {
        peerSum += 0; // peer has zero exposure
        peerCount++;
      }
    }
    const peerAvgScore = peerCount > 0 ? peerSum / peerCount : 0;

    const gap      = peerAvgScore - myScore;
    const gapLevel = classifyGap(myScore, peerAvgScore);

    gaps.push({ tag, myScore, peerAvgScore, gap, gapLevel });
  }

  // Sort by gap descending
  gaps.sort((a, b) => b.gap - a.gap);

  return gaps;
}

// ---------------------------------------------------------------------------
// Public: generateLearningTargets
// ---------------------------------------------------------------------------

/**
 * Generate learning targets based on skill gaps and recent friend activity.
 *
 * @param {string}   myHandle
 * @param {string[]} friendHandles
 * @param {number}   limit
 * @returns {Promise<Array<{
 *   priority: number,
 *   action: string,
 *   reason: string,
 *   relatedTag: string|null,
 *   suggestedRating: string|null
 * }>>}
 */
async function generateLearningTargets(myHandle, friendHandles, limit = 5) {
  const gaps = await computeSkillGaps(myHandle, friendHandles);

  // Filter to meaningful gaps only
  const meaningfulGaps = gaps.filter(g => g.gapLevel === 'HIGH' || g.gapLevel === 'MEDIUM');

  // Also look at recent friend activity for context
  const now       = Date.now() / 1000;
  const day30ago  = now - 30 * 86400;
  const recentFriendSubs = await Submission.find({
    handle:              { $in: friendHandles },
    verdict:             'OK',
    creationTimeSeconds: { $gte: day30ago }
  }).lean();

  // Count recent solved tags among friends
  const recentTagCounts = {};
  for (const s of recentFriendSubs) {
    for (const tag of (s.tags || [])) {
      recentTagCounts[tag] = (recentTagCounts[tag] || 0) + 1;
    }
  }

  // Get my solved ratings to suggest a next level
  const mySolvedSubs = await Submission.find({ handle: myHandle, verdict: 'OK' }).lean();
  const myRatings    = mySolvedSubs.map(s => s.problemRating).filter(r => r != null);
  const myMaxRating  = myRatings.length > 0 ? Math.max(...myRatings) : 1200;
  const suggestRating = `${myMaxRating + 100}-${myMaxRating + 200}`;

  const targets = [];
  let priority  = 1;

  for (const gap of meaningfulGaps) {
    if (targets.length >= limit) break;

    const peerMultiple = gap.myScore > 0
      ? (gap.peerAvgScore / gap.myScore).toFixed(1)
      : 'many more';

    const recentCount = recentTagCounts[gap.tag] || 0;
    const recentNote  = recentCount > 0 ? ` (${recentCount} recent peer solves in last 30 days)` : '';

    targets.push({
      priority,
      action:          `Solve a ${suggestRating} ${gap.tag} problem`,
      reason:          `Peers solve ${gap.tag} ${peerMultiple}x more than you${recentNote}`,
      relatedTag:      gap.tag,
      suggestedRating: suggestRating
    });
    priority++;
  }

  // If we don't have enough from gaps, add a general "keep solving" target
  if (targets.length === 0) {
    targets.push({
      priority:        1,
      action:          `Solve more problems in the ${suggestRating} range`,
      reason:          'No significant tag gaps detected — focus on increasing difficulty',
      relatedTag:      null,
      suggestedRating: suggestRating
    });
  }

  return targets;
}

module.exports = { computeSkillGaps, generateLearningTargets };
