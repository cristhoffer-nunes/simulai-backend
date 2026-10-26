import { Result } from '@/shared/result/result';

describe('Result', () => {
  it('holds a value or an error, never both', () => {
    const ok = Result.ok(1);
    const fail = Result.fail('x');
    expect(ok.isSuccess && !ok.isFailure).toBe(true);
    expect(ok.value).toBe(1);
    expect(() => ok.error).toThrow();
    expect(fail.isFailure).toBe(true);
    expect(fail.error).toBe('x');
    expect(() => fail.value).toThrow();
  });
});
