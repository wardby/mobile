import type { LucideIcon, LucideProps } from 'lucide-react-native';
// Icons are decorative: the control around them carries the accessible label.
export function Icon({ as: Glyph, ...props }: LucideProps & { as: LucideIcon }) {
  return (
    <Glyph
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...props}
    />
  );
}
