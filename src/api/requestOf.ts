export type RunRequest =
  { kind: 'unsupported' } | { kind: 'none' } | { kind: 'text'; text: string; truncated: boolean };

// Servers before 0.9.6 send run detail without the request fields, and responses
// are not checked at run time, so read the request fields only through here.
export function requestOf(run: {
  request?: unknown;
  requestTruncated?: unknown;
  [field: string]: unknown;
}): RunRequest {
  if (run.request === null || run.request === '') return { kind: 'none' };
  if (typeof run.request !== 'string') return { kind: 'unsupported' };
  return { kind: 'text', text: run.request, truncated: run.requestTruncated === true };
}
