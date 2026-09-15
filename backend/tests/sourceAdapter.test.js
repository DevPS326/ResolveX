'use strict';

const fs   = require('fs');
const path = require('path');

const {
  normalizeSource,
  hashSource,
  isCloudflareChallenge
} = require('../services/sourceAdapter');

const { generateDiff } = require('../services/diffService');

// ---------------------------------------------------------------------------
// Load fixtures
// ---------------------------------------------------------------------------
const FIXTURES = path.join(__dirname, 'fixtures');

const successHtml = fs.readFileSync(path.join(FIXTURES, 'cf_submission_success.html'), 'utf8');
const blockedHtml = fs.readFileSync(path.join(FIXTURES, 'cf_submission_blocked.html'), 'utf8');
const nosrcHtml   = fs.readFileSync(path.join(FIXTURES, 'cf_submission_nosource.html'), 'utf8');

// ---------------------------------------------------------------------------
// normalizeSource
// ---------------------------------------------------------------------------
describe('normalizeSource', () => {
  test('converts CRLF to LF', () => {
    const input  = 'line1\r\nline2\r\nline3';
    const result = normalizeSource(input);
    expect(result).toBe('line1\nline2\nline3');
    expect(result).not.toContain('\r');
  });

  test('converts lone CR to LF', () => {
    const result = normalizeSource('a\rb');
    expect(result).toBe('a\nb');
  });

  test('trims trailing whitespace on each line', () => {
    const result = normalizeSource('hello   \nworld  \n  ');
    const lines  = result.split('\n');
    expect(lines[0]).toBe('hello');
    expect(lines[1]).toBe('world');
    expect(lines[2]).toBe('');
  });

  test('returns empty string for null', () => {
    expect(normalizeSource(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(normalizeSource(undefined)).toBe('');
  });

  test('returns empty string for empty string', () => {
    expect(normalizeSource('')).toBe('');
  });

  test('handles mixed CRLF and LF', () => {
    const result = normalizeSource('a\r\nb\nc\r\n');
    expect(result).toBe('a\nb\nc\n');
  });
});

// ---------------------------------------------------------------------------
// hashSource
// ---------------------------------------------------------------------------
describe('hashSource', () => {
  test('returns a 64-character hex string', () => {
    const h = hashSource('hello world');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  test('is consistent — same input same hash', () => {
    const code = '#include<bits/stdc++.h>\nint main(){}';
    expect(hashSource(code)).toBe(hashSource(code));
  });

  test('different inputs produce different hashes', () => {
    const h1 = hashSource('int main() { return 0; }');
    const h2 = hashSource('int main() { return 1; }');
    expect(h1).not.toBe(h2);
  });

  test('handles null gracefully — returns 64-char hex', () => {
    const h = hashSource(null);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  test('handles empty string', () => {
    const h = hashSource('');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// isCloudflareChallenge
// ---------------------------------------------------------------------------
describe('isCloudflareChallenge', () => {
  test('returns true for blocked fixture', () => {
    expect(isCloudflareChallenge(blockedHtml)).toBe(true);
  });

  test('returns false for success fixture', () => {
    expect(isCloudflareChallenge(successHtml)).toBe(false);
  });

  test('returns false for nosource fixture', () => {
    expect(isCloudflareChallenge(nosrcHtml)).toBe(false);
  });

  test('returns false for null', () => {
    expect(isCloudflareChallenge(null)).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(isCloudflareChallenge('')).toBe(false);
  });

  test('detects "Just a moment" text', () => {
    expect(isCloudflareChallenge('<title>Just a moment...</title>')).toBe(true);
  });

  test('detects cf-browser-verification div', () => {
    expect(isCloudflareChallenge('<div id="cf-browser-verification">...</div>')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateDiff (imported from diffService)
// ---------------------------------------------------------------------------
describe('generateDiff (via sourceAdapter tests)', () => {
  test('identical sources → identical: true, additions=0, deletions=0', () => {
    const code = 'int main() {\n  return 0;\n}\n';
    const result = generateDiff(code, code, 'a', 'b');
    expect(result.identical).toBe(true);
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
    expect(result.changed).toBe(false);
  });

  test('addition is counted correctly', () => {
    const s1 = 'line1\nline2\n';
    const s2 = 'line1\nline2\nnewline\n';
    const result = generateDiff(s1, s2, 'a', 'b');
    expect(result.additions).toBeGreaterThan(0);
    expect(result.identical).toBe(false);
  });

  test('deletion is counted correctly', () => {
    const s1 = 'line1\nline2\nline3\n';
    const s2 = 'line1\nline3\n';
    const result = generateDiff(s1, s2, 'a', 'b');
    expect(result.deletions).toBeGreaterThan(0);
    expect(result.identical).toBe(false);
  });

  test('handles null inputs gracefully', () => {
    const result = generateDiff(null, null, 'a', 'b');
    expect(result.identical).toBe(true);
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
  });

  test('handles empty string inputs', () => {
    const result = generateDiff('', '', 'a', 'b');
    expect(result.identical).toBe(true);
  });

  test('null vs non-null → not identical', () => {
    const result = generateDiff(null, 'something\n', 'a', 'b');
    expect(result.identical).toBe(false);
    expect(result.additions).toBeGreaterThan(0);
  });
});
