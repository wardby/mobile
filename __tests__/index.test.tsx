import { render, screen } from '@testing-library/react-native';

import { name } from '../app.identity';
import Index from '../app/index';

describe('Index', () => {
  it('shows the app name and connection state', async () => {
    await render(<Index />);
    expect(screen.getByText(name)).toBeTruthy();
    expect(screen.getByText('Not connected')).toBeTruthy();
  });
});
