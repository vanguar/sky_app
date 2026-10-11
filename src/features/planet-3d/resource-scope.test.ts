import { expect, it, vi } from 'vitest';
import { ResourceScope } from './resource-scope';

it('releases replaced GPU resources and disposes textures arriving after close', () => {
  const scope = new ResourceScope();
  const old = { dispose: vi.fn() };
  const current = { dispose: vi.fn() };
  const late = { dispose: vi.fn() };
  scope.own(old);
  scope.own(current);
  scope.release(old);
  scope.dispose();
  scope.dispose();
  expect(scope.own(late)).toBe(false);
  expect(old.dispose).toHaveBeenCalledTimes(1);
  expect(current.dispose).toHaveBeenCalledTimes(1);
  expect(late.dispose).toHaveBeenCalledTimes(1);
});
