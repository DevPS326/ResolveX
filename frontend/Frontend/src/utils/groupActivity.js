'use strict';

/**
 * Groups a flat array of submissions into journey events.
 * A journey = all submissions by the same handle for the same problem.
 * Returns journeys sorted by most recent submission first.
 */
export function groupIntoJourneys(activity) {
  if (!activity || activity.length === 0) return [];

  const map = new Map();
  // Sort oldest-first so submissions within a journey are chronological
  const sorted = [...activity].sort(
    (a, b) => (a.creationTimeSeconds || 0) - (b.creationTimeSeconds || 0)
  );

  for (const sub of sorted) {
    if (!sub.contestId || !sub.problemIndex) continue;
    const key = `${sub.handle}__${sub.contestId}__${sub.problemIndex}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        handle: sub.handle,
        contestId: sub.contestId,
        problemIndex: sub.problemIndex,
        problemName: sub.problemName,
        problemRating: sub.problemRating,
        tags: sub.tags || [],
        submissions: [],
      });
    }
    map.get(key).submissions.push(sub);
  }

  return Array.from(map.values())
    .map(j => {
      const subs = j.submissions;
      const solved = subs.some(s => s.verdict === 'OK');
      const firstAt = subs[0]?.creationTimeSeconds || null;
      const lastAt = subs[subs.length - 1]?.creationTimeSeconds || null;
      const duration = firstAt && lastAt && subs.length > 1 ? lastAt - firstAt : 0;
      return {
        ...j,
        verdicts: subs.map(s => s.verdict),
        firstAt,
        lastAt,
        solved,
        attemptCount: subs.length,
        duration,
      };
    })
    .sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
}
