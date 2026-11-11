import type { components } from '../api/schema';
export type Infra = components['schemas']['infra-info'];
export type Launcher = Infra['launcher'] | NonNullable<Infra['native']>['launcher'];
export type CodingKubernetes = NonNullable<Infra['kubernetes']>;
export type NativeKubernetes = NonNullable<NonNullable<Infra['native']>['kubernetes']>;
export type InfraRow = { label: string; value: string };
export type InfraLabelGroup = { label: string; entries: string[] };

// `local` means the server has no container executor, so it reads as "Not configured".
const LAUNCHER_LABELS: Record<Launcher, string> = {
  local: 'Not configured',
  docker: 'Docker',
  kubernetes: 'Kubernetes',
};

export const CODING_NOT_CONFIGURED_TEXT =
  "Coding agents can't run on this server. It needs a Docker or Kubernetes launcher.";

export function launcherLabel(launcher: Launcher) {
  return LAUNCHER_LABELS[launcher];
}

export function isCodingLauncherConfigured(launcher: Infra['launcher']) {
  return launcher !== 'local';
}

// `key=value` entries, sorted by key.
function labelEntries(map: Record<string, string>) {
  return Object.entries(map)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`);
}

// One `key=value` per line, sorted by key; "None" for an empty map.
export function formatLabels(map: Record<string, string>) {
  const entries = labelEntries(map);
  if (entries.length === 0) return 'None';
  return entries.join('\n');
}

const runtimeClassLabel = (runtimeClass: string | null) => runtimeClass ?? 'Default';

export function codingKubernetesRows(k8s: CodingKubernetes): InfraRow[] {
  return [
    { label: 'Namespace', value: k8s.namespace },
    { label: 'Platform', value: k8s.platform },
    { label: 'Runtime class', value: runtimeClassLabel(k8s.runtimeClass) },
    { label: 'Proxy service', value: k8s.proxyService },
    { label: 'Run label', value: k8s.runLabel },
    { label: 'Run label hash', value: `${k8s.runLabelHashChars} characters` },
  ];
}

// The coding label maps, shown behind a disclosure.
export function codingLabelGroups(k8s: CodingKubernetes): InfraLabelGroup[] {
  return [
    { label: 'Component labels', entries: labelEntries(k8s.componentLabel) },
    { label: 'Managed-by labels', entries: labelEntries(k8s.managedByLabel) },
  ];
}

export function labelEntryCount(groups: InfraLabelGroup[]) {
  return groups.reduce((total, group) => total + group.entries.length, 0);
}

export function nativeKubernetesRows(k8s: NativeKubernetes): InfraRow[] {
  return [
    { label: 'Namespace', value: k8s.namespace },
    { label: 'Runtime class', value: runtimeClassLabel(k8s.runtimeClass) },
    { label: 'Run label', value: k8s.runLabel },
    { label: 'Component labels', value: formatLabels(k8s.componentLabel) },
    { label: 'Warm pool labels', value: formatLabels(k8s.warmPoolLabel) },
    { label: 'Warm worker', value: k8s.warmWorkerLabel },
  ];
}

export function warmPoolLabel(size: number) {
  if (size === 0) return 'None';
  return `${size} ${size === 1 ? 'worker' : 'workers'}`;
}
