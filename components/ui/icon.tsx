import type { LucideIcon, LucideProps } from 'lucide-react-native';
export function Icon({ as: Glyph, ...props }: LucideProps & { as: LucideIcon }) {
  return <Glyph accessible={false} {...props} />;
}
