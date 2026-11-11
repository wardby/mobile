import { render, screen } from '@testing-library/react-native';
import { ExpoRoot } from 'expo-router';
import { getMockContext } from 'expo-router/testing-library';
import { Text } from 'react-native';
import TabsLayout from '../../app/(tabs)/_layout';

jest.mock('@expo/vector-icons/Ionicons', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ name, ...props }: { name: string }) => <Text {...props}>{name}</Text>,
  };
});
jest.mock('../../src/runs/LiveIndicator', () => ({ LiveIndicator: () => null }));

const stub = (name: string) =>
  function Stub() {
    return <Text>{name}</Text>;
  };
const context = getMockContext({
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': stub('runs screen'),
  '(tabs)/spend': stub('spend screen'),
  '(tabs)/infra': stub('infra screen'),
  '(tabs)/settings': stub('settings screen'),
});

test('the hidden infra route adds no tab button', async () => {
  await render(<ExpoRoot context={context} location={new URL('http://localhost/')} />);
  for (const tab of ['runs', 'spend', 'settings'])
    expect(screen.getByTestId(`tab-${tab}`)).toBeTruthy();
  expect(screen.queryByTestId('tab-infra')).toBeNull();
  expect(screen.queryByTestId('tab-infra-label')).toBeNull();
  expect(screen.queryByText('infra')).toBeNull();
  expect(screen.queryByLabelText(/infra/i)).toBeNull();
});
