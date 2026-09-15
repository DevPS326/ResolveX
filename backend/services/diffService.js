'use strict';

const Diff = require('diff');

/**
 * Generate a structural diff between two source code strings.
 * Handles null/empty sources gracefully by treating them as empty strings.
 *
 * @param {string|null} source1
 * @param {string|null} source2
 * @param {string} label1
 * @param {string} label2
 * @returns {{
 *   identical: boolean,
 *   additions: number,
 *   deletions: number,
 *   changed: boolean,
 *   patch: string,
 *   sections: Array<{ type: 'add'|'remove'|'context', count: number }>
 * }}
 */
function generateDiff(source1, source2, label1 = 'source1', label2 = 'source2') {
  const s1 = source1 || '';
  const s2 = source2 || '';

  const patch = Diff.createPatch(label1, s1, s2, label1, label2);

  const hunks = Diff.structuredPatch(label1, label2, s1, s2, label1, label2);

  let additions = 0;
  let deletions = 0;
  const sections = [];

  for (const hunk of hunks.hunks) {
    for (const line of hunk.lines) {
      if (line.startsWith('+')) {
        additions++;
        const last = sections[sections.length - 1];
        if (last && last.type === 'add') {
          last.count++;
        } else {
          sections.push({ type: 'add', count: 1 });
        }
      } else if (line.startsWith('-')) {
        deletions++;
        const last = sections[sections.length - 1];
        if (last && last.type === 'remove') {
          last.count++;
        } else {
          sections.push({ type: 'remove', count: 1 });
        }
      } else {
        const last = sections[sections.length - 1];
        if (last && last.type === 'context') {
          last.count++;
        } else {
          sections.push({ type: 'context', count: 1 });
        }
      }
    }
  }

  const identical = additions === 0 && deletions === 0;

  return {
    identical,
    additions,
    deletions,
    changed: !identical,
    patch,
    sections
  };
}

module.exports = { generateDiff };
