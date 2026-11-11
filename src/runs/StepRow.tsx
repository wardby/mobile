import { Box, HStack } from '../../components/ui/box';
import { useThemeMode } from '../../components/ui/provider';
import { Text } from '../../components/ui/text';
import { statusTokens } from '../../components/ui/theme';

import type { RunStep } from '../api/stepsOf';
import { useColors } from '../navigation/styles';
import { stepLabel, stepStatus, stepText } from './steps';

// A step is server text: shown as plain text, never Markdown or a link.
export function StepRow({ step, numberOfLines = 2 }: { step: RunStep; numberOfLines?: number }) {
  const colors = useColors();
  const mode = useThemeMode();
  const { glyph, tone } = stepStatus(step);
  const said = step.kind === 'said';
  const testID = `run-step-${step.seq}`;
  return (
    <HStack
      testID={testID}
      accessible
      accessibilityLabel={stepLabel(step)}
      className="items-start gap-2 py-1"
    >
      {said ? (
        <Box
          testID={`${testID}-bar`}
          className="w-[3px] self-stretch rounded-full"
          style={{ backgroundColor: colors.muted }}
        />
      ) : (
        <Box
          className="w-14"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID={`${testID}-glyph`}
        >
          <Text
            className="text-[14px] font-semibold"
            style={{ color: tone === 'muted' ? colors.muted : statusTokens[tone][mode].text }}
          >
            {glyph}
          </Text>
        </Box>
      )}
      <Text
        testID={`${testID}-text`}
        numberOfLines={numberOfLines}
        ellipsizeMode="tail"
        className="flex-1 min-w-0 text-[14px]"
        style={said ? { color: colors.muted, fontStyle: 'italic' } : { color: colors.text }}
      >
        {said ? `"${stepText(step)}"` : stepText(step)}
      </Text>
    </HStack>
  );
}
