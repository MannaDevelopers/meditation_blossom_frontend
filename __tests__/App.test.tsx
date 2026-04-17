/**
 * @format
 */

import 'react-native';
import React , {act} from 'react';
import App from '../src/App';

// Note: import explicitly to use the types shipped with jest.
import {it} from '@jest/globals';

import { render } from '@testing-library/react-native';

it('renders correctly', async () => {
  await act(async () => {
    render(<App />);
  });
});
