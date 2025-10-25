import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import App from './App';

import '@mantine/core/styles.css';

const theme = createTheme({
  colors: {
    'bu-red': [
      '#ffe8e8',
      '#ffcfcf',
      '#ff9d9d',
      '#ff6868',
      '#ff3a3a',
      '#ff1a1a',
      '#CC0000', // BU Red
      '#b30000',
      '#990000',
      '#800000',
    ],
  },
  primaryColor: 'bu-red',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <App />
    </MantineProvider>
  </React.StrictMode>
);