import { describe, expect, it } from 'vitest';
import { buildHash, parseHash } from './routes';

describe('hash routes', () => {
  it('parses object routes', () => {
    expect(parseHash('#/object/jupiter')).toEqual({ objectId: 'jupiter' });
    expect(parseHash('#/object/M31')).toEqual({ objectId: 'm31' });
    expect(parseHash('#/object/hip-32349')).toEqual({ objectId: 'hip-32349' });
  });

  it('ignores anything else', () => {
    expect(parseHash('')).toEqual({ objectId: null });
    expect(parseHash('#/')).toEqual({ objectId: null });
    expect(parseHash('#/object/<script>')).toEqual({ objectId: null });
  });

  it('builds hashes', () => {
    expect(buildHash({ objectId: 'saturn' })).toBe('#/object/saturn');
    expect(buildHash({ objectId: null })).toBe('#/');
  });
});
