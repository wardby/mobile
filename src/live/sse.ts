export type SseFrame = { event: string; data: string; id: string };

// Incremental Server-Sent Events parser. Chunks may split anywhere.
export class SseParser {
  retry: number | undefined;
  private buffer = '';
  private event = '';
  private data: string[] = [];
  private id = '';

  push(chunk: string): SseFrame[] {
    const frames: SseFrame[] = [];
    this.buffer += chunk;
    let start = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      const char = this.buffer[i];
      if (char !== '\n' && char !== '\r') continue;
      // A trailing \r may be the first half of \r\n: wait for the next chunk.
      if (char === '\r' && i + 1 === this.buffer.length) break;
      this.line(this.buffer.slice(start, i), frames);
      if (char === '\r' && this.buffer[i + 1] === '\n') i++;
      start = i + 1;
    }
    this.buffer = this.buffer.slice(start);
    return frames;
  }

  private line(line: string, frames: SseFrame[]) {
    if (line === '') {
      if (this.data.length)
        frames.push({ event: this.event || 'message', data: this.data.join('\n'), id: this.id });
      this.event = '';
      this.data = [];
      return;
    }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') this.event = value;
    else if (field === 'data') this.data.push(value);
    else if (field === 'id' && !value.includes('\0')) this.id = value;
    else if (field === 'retry' && /^\d+$/.test(value)) this.retry = Number(value);
  }
}
