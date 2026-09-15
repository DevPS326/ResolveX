'use strict';

const { filterPageByCursor } = require('../services/codeforcesService');

const makeSub = id => ({ id, problem: { contestId: 1900, index: 'A', name: 'P', tags: [] }, verdict: 'OK' });

describe('filterPageByCursor', () => {
  test('cursor = 0: returns all submissions, reachedCursor = false', () => {
    const page = [makeSub(100), makeSub(90), makeSub(80)];
    const { submissions, reachedCursor } = filterPageByCursor(page, 0);
    expect(submissions).toHaveLength(3);
    expect(reachedCursor).toBe(false);
  });

  test('stops at cursor and returns only newer submissions', () => {
    const page = [makeSub(100), makeSub(90), makeSub(80), makeSub(70)];
    const { submissions, reachedCursor } = filterPageByCursor(page, 85);
    // 100 and 90 are > 85; 80 triggers stop
    expect(submissions.map(s => s.id)).toEqual([100, 90]);
    expect(reachedCursor).toBe(true);
  });

  test('first submission is exactly at cursor: returns empty', () => {
    const page = [makeSub(50), makeSub(40)];
    const { submissions, reachedCursor } = filterPageByCursor(page, 50);
    expect(submissions).toHaveLength(0);
    expect(reachedCursor).toBe(true);
  });

  test('all submissions are above cursor: returns all, reachedCursor = false', () => {
    const page = [makeSub(200), makeSub(150), makeSub(120)];
    const { submissions, reachedCursor } = filterPageByCursor(page, 100);
    expect(submissions).toHaveLength(3);
    expect(reachedCursor).toBe(false);
  });

  test('empty page: returns empty, reachedCursor = false', () => {
    const { submissions, reachedCursor } = filterPageByCursor([], 100);
    expect(submissions).toHaveLength(0);
    expect(reachedCursor).toBe(false);
  });

  test('single-element page above cursor', () => {
    const { submissions, reachedCursor } = filterPageByCursor([makeSub(101)], 100);
    expect(submissions).toHaveLength(1);
    expect(reachedCursor).toBe(false);
  });

  test('single-element page at cursor', () => {
    const { submissions, reachedCursor } = filterPageByCursor([makeSub(100)], 100);
    expect(submissions).toHaveLength(0);
    expect(reachedCursor).toBe(true);
  });
});
