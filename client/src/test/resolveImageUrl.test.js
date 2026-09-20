/**
 * Unit tests for resolveImageUrl()
 *
 * This utility is the single most security-sensitive piece of the client
 * because it controls whether images are served from localhost (broken) or
 * the real backend (working), and whether http:// slips through on an https:
 * page (mixed-content error).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveImageUrl } from '../services/api';

// The REMOTE_BACKEND constant inside api.js reads from import.meta.env.VITE_SERVER_URL.
// Vitest injects import.meta.env from vite.config.js — in tests it resolves to '' so
// REMOTE_BACKEND falls back to 'https://framehouse-r7yy.onrender.com'.
const EXPECTED_REMOTE = 'https://framehouse-r7yy.onrender.com';

describe('resolveImageUrl — empty / null guards', () => {
  it('returns empty string for null', () => {
    expect(resolveImageUrl(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(resolveImageUrl(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(resolveImageUrl('')).toBe('');
  });

  it('returns empty string for non-string number', () => {
    expect(resolveImageUrl(42)).toBe('');
  });
});

describe('resolveImageUrl — localhost rewriting', () => {
  it('rewrites http://localhost:5000 mock-view URL to remote backend', () => {
    const input = 'http://localhost:5000/api/mock-view/events%2Fabc%2Fthumbnails%2Fphoto.jpg';
    const result = resolveImageUrl(input);
    expect(result.startsWith(EXPECTED_REMOTE)).toBe(true);
    expect(result).not.toContain('localhost');
  });

  it('rewrites http://localhost:3000 (any port) to remote backend', () => {
    const input = 'http://localhost:3000/api/mock-view/some-key.jpg';
    const result = resolveImageUrl(input);
    expect(result).not.toContain('localhost');
    expect(result.startsWith(EXPECTED_REMOTE)).toBe(true);
  });

  it('rewrites http://127.0.0.1:5000 to remote backend', () => {
    const input = 'http://127.0.0.1:5000/api/mock-view/photo.jpg';
    const result = resolveImageUrl(input);
    expect(result).not.toContain('127.0.0.1');
    expect(result.startsWith(EXPECTED_REMOTE)).toBe(true);
  });

  it('preserves the path after rewriting localhost', () => {
    const path = '/api/mock-view/events%2Ftest%2Fthumbnails%2Ftest.jpg';
    const input = `http://localhost:5000${path}`;
    const result = resolveImageUrl(input);
    expect(result).toBe(`${EXPECTED_REMOTE}${path}`);
  });

  it('rewrites https://localhost (no port) as well', () => {
    const input = 'https://localhost/api/mock-view/key.jpg';
    const result = resolveImageUrl(input);
    expect(result).not.toContain('localhost');
  });
});

describe('resolveImageUrl — mixed-content guard (http → https)', () => {
  afterEach(() => {
    // Restore window.location.protocol to default (http: in jsdom)
    Object.defineProperty(window, 'location', {
      value: { ...window.location, protocol: 'http:' },
      writable: true,
    });
  });

  it('upgrades http:// to https:// when page protocol is https:', () => {
    Object.defineProperty(window, 'location', {
      value: { protocol: 'https:' },
      writable: true,
    });

    const input = 'http://framehouse-r7yy.onrender.com/api/mock-view/photo.jpg';
    const result = resolveImageUrl(input);
    expect(result.startsWith('https://')).toBe(true);
    expect(result).not.toMatch(/^http:\/\/[^/]/);
  });

  it('does NOT upgrade http:// when page protocol is http:', () => {
    Object.defineProperty(window, 'location', {
      value: { protocol: 'http:' },
      writable: true,
    });

    // Non-localhost http URL — should pass through unchanged on http page
    const input = 'http://framehouse-r7yy.onrender.com/api/mock-view/photo.jpg';
    const result = resolveImageUrl(input);
    expect(result).toBe(input);
  });
});

describe('resolveImageUrl — already valid URLs', () => {
  it('passes through https:// remote URL unchanged', () => {
    const input = 'https://framehouse-r7yy.onrender.com/api/mock-view/photo.jpg';
    const result = resolveImageUrl(input);
    expect(result).toBe(input);
  });

  it('passes through real AWS S3 presigned URL unchanged', () => {
    const s3Url = 'https://my-bucket.s3.amazonaws.com/events/abc/thumbnails/photo.jpg?X-Amz-Signature=xxx';
    expect(resolveImageUrl(s3Url)).toBe(s3Url);
  });
});

describe('resolveImageUrl — relative URLs', () => {
  it('prepends REMOTE_BACKEND to relative /api/... paths', () => {
    const result = resolveImageUrl('/api/mock-view/photo.jpg');
    expect(result).toBe(`${EXPECTED_REMOTE}/api/mock-view/photo.jpg`);
  });

  it('handles root-relative path correctly', () => {
    const result = resolveImageUrl('/some/path');
    expect(result).toBe(`${EXPECTED_REMOTE}/some/path`);
  });
});
