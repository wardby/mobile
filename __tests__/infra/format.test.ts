import docker from '../../src/api/__fixtures__/infra.json';
import kubernetes from '../../src/api/__fixtures__/infra-kubernetes.json';
import unconfigured from '../../src/api/__fixtures__/infra-unconfigured.json';
import type { components } from '../../src/api/schema';
import {
  CODING_NOT_CONFIGURED_TEXT,
  codingKubernetesRows,
  formatLabels,
  isCodingLauncherConfigured,
  launcherLabel,
  nativeKubernetesRows,
  warmPoolLabel,
} from '../../src/infra/format';

type Infra = components['schemas']['infra-info'];
type CodingK8s = NonNullable<Infra['kubernetes']>;
type NativeK8s = NonNullable<NonNullable<Infra['native']>['kubernetes']>;
const k8sInfra = kubernetes as Infra;
const coding = k8sInfra.kubernetes!;
const native = k8sInfra.native!.kubernetes!;

// Records every property read, so a test can prove which fields a builder uses.
function tracked<T extends object>(value: T) {
  const reads: string[] = [];
  const proxy = new Proxy(value, {
    get(target, key, receiver) {
      if (typeof key === 'string') reads.push(key);
      return Reflect.get(target, key, receiver);
    },
  });
  return { proxy, reads };
}

test.each([
  ['local', 'Not configured', false],
  ['docker', 'Docker', true],
  ['kubernetes', 'Kubernetes', true],
] as const)('launcher %p reads %p (configured: %p)', (launcher, label, configured) => {
  expect(launcherLabel(launcher)).toBe(label);
  expect(isCodingLauncherConfigured(launcher)).toBe(configured);
});

test('fixture launchers map to their labels', () => {
  expect(launcherLabel((unconfigured as Infra).launcher)).toBe('Not configured');
  expect(isCodingLauncherConfigured((unconfigured as Infra).launcher)).toBe(false);
  expect(launcherLabel((docker as Infra).launcher)).toBe('Docker');
  expect(launcherLabel((docker as Infra).native!.launcher)).toBe('Docker');
  expect(launcherLabel(k8sInfra.launcher)).toBe('Kubernetes');
  expect(launcherLabel(k8sInfra.native!.launcher)).toBe('Kubernetes');
});

test('nothing says "Local" or mentions the server host', () => {
  const texts = [
    ...(['local', 'docker', 'kubernetes'] as const).map(launcherLabel),
    CODING_NOT_CONFIGURED_TEXT,
  ];
  for (const text of texts) {
    expect(text).not.toMatch(/local/i);
    expect(text).not.toMatch(/server host/i);
  }
});

test('the coding not-configured text is the agreed wording', () => {
  expect(CODING_NOT_CONFIGURED_TEXT).toBe(
    "Coding agents can't run on this server. It needs a Docker or Kubernetes launcher.",
  );
});

test('codingKubernetesRows shows every coding Kubernetes field once', () => {
  expect(codingKubernetesRows(coding)).toEqual([
    { label: 'Namespace', value: 'example-namespace' },
    { label: 'Platform', value: 'example-platform' },
    { label: 'Runtime class', value: 'example-runtime' },
    { label: 'Proxy service', value: 'example-proxy' },
    { label: 'Run label', value: 'example.test/run' },
    { label: 'Run label hash', value: '12 characters' },
    { label: 'Component labels', value: 'example.test/component=coding' },
    { label: 'Managed-by labels', value: 'example.test/managed-by=wardby' },
  ]);
});

test('codingKubernetesRows reads exactly the schema fields, each once', () => {
  const { proxy, reads } = tracked(coding);
  codingKubernetesRows(proxy);
  const fields: (keyof CodingK8s)[] = [
    'namespace',
    'platform',
    'runtimeClass',
    'proxyService',
    'runLabel',
    'runLabelHashChars',
    'componentLabel',
    'managedByLabel',
  ];
  expect([...reads].sort()).toEqual([...fields].sort());
});

test('nativeKubernetesRows shows every native Kubernetes field once', () => {
  expect(nativeKubernetesRows(native)).toEqual([
    { label: 'Namespace', value: 'example-native-namespace' },
    { label: 'Runtime class', value: 'Default' },
    { label: 'Run label', value: 'example.test/native-run' },
    { label: 'Component labels', value: 'example.test/component=native' },
    { label: 'Warm pool labels', value: 'example.test/pool=warm\nexample.test/tier=native' },
    { label: 'Warm worker', value: 'example.test/warm-worker' },
  ]);
});

test('nativeKubernetesRows reads exactly the schema fields, each once', () => {
  const { proxy, reads } = tracked(native);
  nativeKubernetesRows(proxy);
  const fields: (keyof NativeK8s)[] = [
    'namespace',
    'runtimeClass',
    'runLabel',
    'componentLabel',
    'warmPoolLabel',
    'warmWorkerLabel',
  ];
  expect([...reads].sort()).toEqual([...fields].sort());
});

test('a null runtime class and empty label maps read as words, not blanks', () => {
  const codingRows = codingKubernetesRows({
    ...coding,
    runtimeClass: null,
    componentLabel: {},
    managedByLabel: {},
  });
  const nativeRows = nativeKubernetesRows({
    ...native,
    runtimeClass: null,
    componentLabel: {},
    warmPoolLabel: {},
  });
  const value = (rows: { label: string; value: string }[], label: string) =>
    rows.find((row) => row.label === label)?.value;
  expect(value(codingRows, 'Runtime class')).toBe('Default');
  expect(value(codingRows, 'Component labels')).toBe('None');
  expect(value(codingRows, 'Managed-by labels')).toBe('None');
  expect(value(nativeRows, 'Runtime class')).toBe('Default');
  expect(value(nativeRows, 'Component labels')).toBe('None');
  expect(value(nativeRows, 'Warm pool labels')).toBe('None');
  for (const row of [...codingRows, ...nativeRows]) {
    expect(row.value).not.toBe('');
    expect(row.value).not.toMatch(/null|undefined/);
  }
});

test.each([
  [{}, 'None'],
  [{ 'example.test/a': 'one' }, 'example.test/a=one'],
  [
    { 'example.test/b': 'two', 'example.test/a.b': 'three', 'example.test/a': 'one' },
    'example.test/a=one\nexample.test/a.b=three\nexample.test/b=two',
  ],
])('formatLabels(%p) is %p', (map, text) => {
  expect(formatLabels(map)).toBe(text);
});

test.each([
  [0, 'None'],
  [1, '1 worker'],
  [2, '2 workers'],
  [3, '3 workers'],
])('warmPoolLabel(%p) is %p', (size, text) => {
  expect(warmPoolLabel(size)).toBe(text);
});

test('fixture warm pools read as worker counts', () => {
  expect(warmPoolLabel((docker as Infra).native!.warmPoolSize)).toBe('2 workers');
  expect(warmPoolLabel(k8sInfra.native!.warmPoolSize)).toBe('3 workers');
});
