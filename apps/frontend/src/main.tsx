import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import App from './App';

import '@mantine/core/styles.css';

const theme = createTheme({
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <App />
    </MantineProvider>
  </React.StrictMode>
);