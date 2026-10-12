export type Identity = {
  name: string;
  slug: string;
  scheme: string;
  iosBundleId: string;
  androidPackage: string;
  easProjectId?: string;
};

const identity: Identity = {
  name: 'Wardby',
  slug: 'wardby',
  scheme: 'com.wardby.mobile',
  iosBundleId: 'com.wardby.mobile',
  androidPackage: 'com.wardby.mobile',
  easProjectId: '1d693772-46a8-4b89-a9f1-f0db791473cf',
};

export const { name, slug, scheme, iosBundleId, androidPackage, easProjectId } = identity;

export function redirectUri(): string {
  return `${scheme}:/oauth`;
}

export default identity;
