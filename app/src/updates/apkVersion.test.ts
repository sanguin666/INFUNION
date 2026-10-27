import { describe, expect, it } from 'vitest';
import { needsNewApk } from './apkVersion';

describe('needsNewApk', () => {
  it('asks for the new APK when the native builds differ', () => {
    expect(needsNewApk('27cd3e8c', '9f00aa11')).toBe(true);
  });

  it('stays quiet on the same build', () => {
    expect(needsNewApk('27cd3e8c', '27cd3e8c')).toBe(false);
  });

  it('stays quiet when either side is unknown', () => {
    expect(needsNewApk(null, '27cd3e8c')).toBe(false);
    expect(needsNewApk('27cd3e8c', undefined)).toBe(false);
  });
});
