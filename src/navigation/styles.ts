import { useTheme } from '../../components/ui/provider';
export function useColors(): Pick<
  ReturnType<typeof useTheme>,
  'background' | 'fill' | 'text' | 'muted' | 'destructive' | 'tint'
> {
  return useTheme();
}
