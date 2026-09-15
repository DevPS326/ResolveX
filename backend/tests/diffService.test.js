'use strict';

const { generateDiff } = require('../services/diffService');

describe('generateDiff', () => {
  // -------------------------------------------------------------------------
  // Identical
  // -------------------------------------------------------------------------
  test('identical strings → identical: true', () => {
    const code = 'int main() {\n  return 0;\n}\n';
    const r = generateDiff(code, code);
    expect(r.identical).toBe(true);
    expect(r.changed).toBe(false);
    expect(r.additions).toBe(0);
    expect(r.deletions).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Additions
  // -------------------------------------------------------------------------
  test('source2 has extra lines → additions > 0', () => {
    const s1 = 'int main() {\n  return 0;\n}\n';
    const s2 = 'int main() {\n  int x = 1;\n  return 0;\n}\n';
    const r = generateDiff(s1, s2);
    expect(r.additions).toBeGreaterThan(0);
    expect(r.deletions).toBe(0);
    expect(r.identical).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Deletions
  // -------------------------------------------------------------------------
  test('source2 is missing lines → deletions > 0', () => {
    const s1 = 'line1\nline2\nline3\nline4\n';
    const s2 = 'line1\nline4\n';
    const r = generateDiff(s1, s2);
    expect(r.deletions).toBeGreaterThan(0);
    expect(r.identical).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Both additions and deletions
  // -------------------------------------------------------------------------
  test('changed lines → both additions and deletions', () => {
    const s1 = 'a\nb\nc\n';
    const s2 = 'a\nX\nc\n';
    const r = generateDiff(s1, s2);
    expect(r.additions).toBeGreaterThan(0);
    expect(r.deletions).toBeGreaterThan(0);
    expect(r.changed).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Null inputs
  // -------------------------------------------------------------------------
  test('null, null → identical', () => {
    const r = generateDiff(null, null);
    expect(r.identical).toBe(true);
    expect(r.additions).toBe(0);
    expect(r.deletions).toBe(0);
    expect(typeof r.patch).toBe('string');
  });

  test('null, non-empty → additions > 0', () => {
    const r = generateDiff(null, 'hello\n');
    expect(r.additions).toBeGreaterThan(0);
    expect(r.identical).toBe(false);
  });

  test('non-empty, null → deletions > 0', () => {
    const r = generateDiff('hello\n', null);
    expect(r.deletions).toBeGreaterThan(0);
    expect(r.identical).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Empty strings
  // -------------------------------------------------------------------------
  test('empty string, empty string → identical', () => {
    const r = generateDiff('', '');
    expect(r.identical).toBe(true);
  });

  test('empty string, content → additions > 0', () => {
    const r = generateDiff('', 'content\n');
    expect(r.additions).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Patch output
  // -------------------------------------------------------------------------
  test('patch is a string', () => {
    const r = generateDiff('old\n', 'new\n');
    expect(typeof r.patch).toBe('string');
    expect(r.patch.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Sections
  // -------------------------------------------------------------------------
  test('sections is an array', () => {
    const r = generateDiff('a\nb\nc\n', 'a\nX\nc\n');
    expect(Array.isArray(r.sections)).toBe(true);
  });

  test('section types are add, remove, or context', () => {
    const r = generateDiff('a\nb\nc\n', 'a\nX\nc\n');
    for (const section of r.sections) {
      expect(['add', 'remove', 'context']).toContain(section.type);
      expect(typeof section.count).toBe('number');
      expect(section.count).toBeGreaterThan(0);
    }
  });

  test('identical inputs → empty sections', () => {
    const code = 'same\n';
    const r = generateDiff(code, code);
    expect(r.sections.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Custom labels
  // -------------------------------------------------------------------------
  test('custom labels appear in patch', () => {
    const r = generateDiff('old\n', 'new\n', 'fileA', 'fileB');
    expect(r.patch).toContain('fileA');
  });
});
