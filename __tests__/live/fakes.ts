type Chunk = { done: boolean; value?: Uint8Array };

// A fake readable body that tests feed chunk by chunk.
export function fakeStream() {
  const encoder = new TextEncoder();
  const chunks: (Chunk | Error)[] = [];
  let waiting: ((chunk: Chunk | Error) => void) | null = null;
  const deliver = (chunk: Chunk | Error) => {
    if (waiting) {
      const resolve = waiting;
      waiting = null;
      resolve(chunk);
    } else chunks.push(chunk);
  };
  const stream = {
    cancelled: false,
    body: {
      getReader: () => ({
        read: async (): Promise<Chunk> => {
          const next =
            chunks.shift() ?? (await new Promise<Chunk | Error>((resolve) => (waiting = resolve)));
          if (next instanceof Error) throw next;
          return next;
        },
        cancel: async () => {
          stream.cancelled = true;
          deliver({ done: true });
        },
      }),
    },
    push: (text: string) => deliver({ done: false, value: encoder.encode(text) }),
    end: () => deliver({ done: true }),
    fail: (error = new Error('network')) => deliver(error),
  };
  return stream;
}

export type FakeStream = ReturnType<typeof fakeStream>;

export const baseUrl = new URL('/ ', 'https://example.invalid').origin;

export const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
