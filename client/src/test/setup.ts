/**
 * Vitest global setup — runs before every test file.
 * Extends expect with @testing-library/jest-dom matchers and
 * resets all mocks between tests.
 */
import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';

// Silence noisy console.error / console.warn in tests unless explicitly needed
const originalError = console.error.bind(console);
const originalWarn = console.warn.bind(console);

beforeEach(() => {
  console.error = (...args: unknown[]) => {
    // Let through React act() warnings so we notice async issues
    const msg = args[0]?.toString() ?? '';
    if (
      msg.includes('Warning: An update to') ||
      msg.includes('Warning: ReactDOM.render')
    ) return;
    originalError(...args);
  };
  console.warn = (...args: unknown[]) => {
    const msg = args[0]?.toString() ?? '';
    if (msg.includes('Warning:')) return;
    originalWarn(...args);
  };
});

afterEach(() => {
  console.error = originalError;
  console.warn = originalWarn;
  vi.clearAllMocks();
});
