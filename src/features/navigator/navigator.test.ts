import { describe, expect, it } from 'vitest';
import { navigationHints } from './navigation-hints';

describe('navigationHints', () => {
  it('tells the user to turn right and up', () => {
    expect(navigationHints({ deltaAz: 34.4, deltaAlt: 12.2 })).toEqual([
      { key: 'navigator.right', value: 34 },
      { key: 'navigator.raise', value: 12 },
    ]);
  });

  it('tells the user to turn left and down', () => {
    expect(navigationHints({ deltaAz: -90, deltaAlt: -5 })).toEqual([
      { key: 'navigator.left', value: 90 },
      { key: 'navigator.lower', value: 5 },
    ]);
  });

  it('gives no hints when aligned', () => {
    expect(navigationHints({ deltaAz: 0.5, deltaAlt: -0.3 })).toEqual([]);
  });
});
