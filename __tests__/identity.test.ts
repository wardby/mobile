import { redirectUri } from '../app.identity';

describe('redirectUri', () => {
  it('returns the default OAuth redirect', () => {
    expect(redirectUri()).toBe('com.wardby.mobile:/oauth');
  });
});
