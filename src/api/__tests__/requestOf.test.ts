import run from '../__fixtures__/run-detail.json';
import truncated from '../__fixtures__/run-detail-request-truncated.json';
import none from '../__fixtures__/run-detail-request-null.json';
import pre09 from '../__fixtures__/run-detail-pre-0.9.json';
import { requestOf } from '../requestOf';

test('reports unsupported for a server older than 0.9.6', () => {
  expect(pre09).not.toHaveProperty('request');
  expect(pre09).not.toHaveProperty('requestTruncated');
  expect(requestOf(pre09)).toEqual({ kind: 'unsupported' });
});
test('reports none when the request is null', () => {
  expect(requestOf(none)).toEqual({ kind: 'none' });
});
test('reports none when the request is empty', () => {
  expect(requestOf({ ...run, request: '' })).toEqual({ kind: 'none' });
});
test('returns the request text from run detail', () => {
  expect(requestOf(run)).toEqual({ kind: 'text', text: run.request, truncated: false });
});
test('returns truncated for a request cut to its first 8,000 characters', () => {
  expect(requestOf(truncated)).toEqual({ kind: 'text', text: truncated.request, truncated: true });
});
it.each([3, {}, ['x'], true])('reports unsupported when request is %p', (request) => {
  expect(() => requestOf({ ...run, request })).not.toThrow();
  expect(requestOf({ ...run, request })).toEqual({ kind: 'unsupported' });
});
it.each([undefined, null, 'true', 1, {}])(
  'reads requestTruncated %p as not truncated',
  (requestTruncated) => {
    expect(requestOf({ ...run, requestTruncated })).toEqual({
      kind: 'text',
      text: run.request,
      truncated: false,
    });
  },
);
