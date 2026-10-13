import { cn } from 'tailwind-variants';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  type ViewProps,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { statusStyle, type RunStatus } from '../../src/runs/status';
import { useThemeMode } from './provider';
import { Box } from './box';
import { Text } from './text';

// Matches the web viewer's running-node pulse: a 4px ring at 35% every 2s.
const ringWidth = 4;
const ringOpacity = 0.35;
const pulseMs = 2000;

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => active && setReduce(value));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

function PulseRing({ color, testID }: { color: string; testID?: string }) {
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const half = {
      duration: pulseMs / 2,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    };
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: ringOpacity, ...half }),
        Animated.timing(opacity, { toValue: 0, ...half }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessible={false}
      style={{
        position: 'absolute',
        top: -ringWidth,
        left: -ringWidth,
        right: -ringWidth,
        bottom: -ringWidth,
        borderRadius: 999,
        borderWidth: ringWidth,
        borderColor: color,
        opacity,
      }}
    />
  );
}

export function Badge({
  status,
  style,
  textStyle,
  className = '',
  ...props
}: ViewProps & { status: RunStatus; textStyle?: StyleProp<TextStyle> }) {
  const pill = statusStyle(status);
  const colors = pill[useThemeMode()];
  const reduceMotion = useReduceMotion();
  return (
    <Box
      {...props}
      className={cn('rounded-[10px] px-2 py-0.5', className)}
      style={[{ backgroundColor: colors.background }, style]}
    >
      {status === 'running' && !reduceMotion && (
        <PulseRing color={colors.text} testID={props.testID && `${props.testID}-pulse`} />
      )}
      <Text style={[{ fontSize: 13, fontWeight: '600', color: colors.text }, textStyle]}>
        {pill.label}
      </Text>
    </Box>
  );
}
