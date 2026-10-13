import { Heading, Text } from '../../components/ui/text';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from './styles';

export function Placeholder({ title, testID }: { title: string; testID: string }) {
  const colors = useColors();
  return (
    <SafeAreaView
      testID={testID}
      edges={['left', 'right']}
      className="flex-1 items-center justify-center gap-2 p-6"
      style={[{ backgroundColor: colors.background }]}
    >
      <Heading className="text-[28px] font-bold" style={[{ color: colors.text }]}>
        {title}
      </Heading>
      <Text className="text-[17px]" style={[{ color: colors.muted }]}>
        Coming soon.
      </Text>
    </SafeAreaView>
  );
}
