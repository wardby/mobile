import fixtures from '../fixtures/events.json';
import { SseParser, type SseFrame } from '../../src/live/sse';

const expected: SseFrame[] = [
  { event: 'hello', data: '{"connected":true}', id: '' },
  {
    event: 'run',
    data: '{"kind":"run","runId":"run-coding","parentRunId":"run-parent","agentId":"builder","status":"succeeded","turns":7,"tokensIn":5000,"tokensOut":900,"costUsd":0.5,"finishedAt":"2026-10-01T10:05:00.000Z"}',
    id: '41',
  },
  {
    event: 'service',
    data: '{"kind":"service","runId":"run-coding","name":"postgres","state":"failed","attempts":3}',
    id: '42',
  },
  {
    event: 'outcome',
    data: '{"kind":"outcome","runId":"run-coding","source":"pull_request"}',
    id: '43',
  },
  { event: 'status', data: '{"connected":false}', id: '43' },
  { event: 'status', data: '{"connected":true}', id: '43' },
  { event: 'resync', data: '{}', id: '43' },
];
function parse(chunks: string[]) {
  const parser = new SseParser();
  return { frames: chunks.flatMap((chunk) => parser.push(chunk)), parser };
}

test('parses the recorded stream in one chunk', () => {
  const { frames, parser } = parse([fixtures.stream]);
  expect(frames).toEqual(expected);
  expect(parser.retry).toBe(3000);
});
test.each(['\n', '\r\n'])('splits chunks at every position with %j line endings', (ending) => {
  const stream = fixtures.stream.replace(/\n/g, ending);
  for (let i = 0; i <= stream.length; i++)
    expect(parse([stream.slice(0, i), stream.slice(i)]).frames).toEqual(expected);
});
test('parses one character at a time with \\r\\n line endings', () => {
  const stream = fixtures.stream.replace(/\n/g, '\r\n');
  expect(parse(stream.split('')).frames).toEqual(expected);
});
test('joins multi-line data and defaults the event name', () => {
  expect(parse(['data: first\ndata:second\ndata:  third\n\n']).frames).toEqual([
    { event: 'message', data: 'first\nsecond\n third', id: '' },
  ]);
});
test('ignores comments and frames without data and holds incomplete frames', () => {
  const { frames } = parse([': ping\n\nevent: run\n\n: ping\nevent: x\ndata: partial\n']);
  expect(frames).toEqual([]);
});
test('reads retry only when it is a number', () => {
  const parser = new SseParser();
  parser.push('retry: 5000\n\n');
  expect(parser.retry).toBe(5000);
  parser.push('retry: soon\n\nretry: 1e3\n\n');
  expect(parser.retry).toBe(5000);
});
test('keeps the last id and passes unknown event names through', () => {
  expect(parse(['id: 7\nevent: novel\ndata: x\n\nevent: other\ndata: y\n\n']).frames).toEqual([
    { event: 'novel', data: 'x', id: '7' },
    { event: 'other', data: 'y', id: '7' },
  ]);
});
