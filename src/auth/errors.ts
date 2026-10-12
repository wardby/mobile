export const messages = {
  invalid_host: 'Enter a server address like wardby.example.com.',
  unreachable: "Can't reach that server. Check the address and your connection.",
  not_wardby: "That address isn't a wardby server.",
  admin_view_unsupported:
    "This server doesn't offer admin viewing. Update wardby or ask your operator.",
  mobile_disabled:
    'Mobile sign-in is off on this server. Ask your operator to set WARDBY_MOBILE_ENABLED.',
  cancelled: 'Sign-in was cancelled.',
  failed: 'Sign-in failed. Try again.',
};
export class AuthError extends Error {
  constructor(public readonly code: keyof typeof messages) {
    super(
      code === 'mobile_disabled'
        ? messages[code].replace('WARDBY_MOBILE_ENABLED.', 'WARDBY_MOBILE_ENABLED=true.')
        : messages[code],
    );
    this.name = 'AuthError';
  }
}
