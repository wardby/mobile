import { render, screen } from '@testing-library/react-native';
import * as Native from 'react-native';
import fixture from '../../src/api/__fixtures__/run-detail.json';
import { theme } from '../../components/ui/theme';
import { stepsOf } from '../../src/api/stepsOf';
import { StepRow } from '../../src/runs/StepRow';

const loaded = stepsOf(fixture);
const steps = loaded.kind === 'steps' ? loaded.steps : [];
const bySeq = (seq: number) => steps.find((step) => step.seq === seq)!;
type Node = { props: Record<string, unknown>; children: (Node | string)[] | null };
function nodes(node: Node | Node[] | null): Node[] {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const children = (node.children ?? []).filter(
    (child): child is Node => typeof child !== 'string',
  );
  return [node, ...children.flatMap(nodes)];
}
const rendered = () => nodes(screen.toJSON() as Node | Node[] | null);

test.each([
  [13, 'Read: src/live/stream.ts, succeeded'],
  [14, "Agent said: I'll run the tests next."],
  [15, 'Bash: npm run lint, exited with code 1'],
  [16, 'Edit: app/runs/[id].tsx, failed'],
  [18, 'Bash: npm test, in progress'],
])('step %p renders as one accessible row labelled %p', async (seq, label) => {
  await render(<StepRow step={bySeq(seq)} />);
  const row = screen.getByTestId(`run-step-${seq}`);
  expect(row.props.accessible).toBe(true);
  expect(row.props.accessibilityLabel).toBe(label);
  expect(row.props.onPress).toBeUndefined();
});

test('the glyph is shown but hidden from screen readers', async () => {
  await render(<StepRow step={bySeq(15)} />);
  const glyph = screen.getByTestId('run-step-15-glyph', { includeHiddenElements: true });
  expect(glyph).toHaveTextContent('exit 1');
  expect(glyph.props.importantForAccessibility).toBe('no-hide-descendants');
  expect(glyph.props.accessibilityElementsHidden).toBe(true);
});

test('a said step is quoted, italic and muted, with a quote bar and no glyph', async () => {
  await render(<StepRow step={bySeq(14)} />);
  expect(screen.queryByTestId('run-step-14-glyph', { includeHiddenElements: true })).toBeNull();
  expect(screen.getByTestId('run-step-14-bar')).toBeTruthy();
  const text = screen.getByTestId('run-step-14-text');
  expect(text).toHaveTextContent(`"I'll run the tests next."`);
  expect(Native.StyleSheet.flatten(text.props.style)).toMatchObject({ fontStyle: 'italic' });
  await render(<StepRow step={bySeq(13)} />);
  expect(screen.queryByTestId('run-step-13-bar')).toBeNull();
  expect(
    Native.StyleSheet.flatten(screen.getByTestId('run-step-13-text').props.style),
  ).not.toMatchObject({ fontStyle: 'italic' });
});

test('a Markdown summary with a URL renders literally, with no link', async () => {
  await render(<StepRow step={bySeq(17)} />);
  const text = screen.getByTestId('run-step-17-text');
  expect(text).toHaveTextContent('Bash: echo **bold** [link](https://example.test/x)');
  for (const node of rendered()) {
    expect(node.props.accessibilityRole).not.toBe('link');
    expect(node.props.role).not.toBe('link');
    expect(node.props.onPress).toBeUndefined();
  }
});

test('the text truncates at two lines by default, or at numberOfLines', async () => {
  await render(<StepRow step={bySeq(13)} />);
  expect(screen.getByTestId('run-step-13-text').props).toMatchObject({
    numberOfLines: 2,
    ellipsizeMode: 'tail',
  });
  await render(<StepRow step={bySeq(13)} numberOfLines={1} />);
  expect(screen.getByTestId('run-step-13-text').props.numberOfLines).toBe(1);
});

test('rows never use the accent colour', async () => {
  for (const step of steps) {
    await render(<StepRow step={step} />);
    const colors = rendered().flatMap((node) => {
      const style = Native.StyleSheet.flatten(
        node.props.style as Native.StyleProp<Native.TextStyle>,
      );
      return [style?.color, style?.backgroundColor].filter(Boolean);
    });
    expect(colors.length).toBeGreaterThan(0);
    for (const color of colors) expect([theme.light.tint, theme.dark.tint]).not.toContain(color);
  }
});
