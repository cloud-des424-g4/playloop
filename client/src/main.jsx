import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import '@fontsource-variable/kode-mono';
import '@fontsource/palette-mosaic/latin-400.css';
import './styles/global.css';
import { router } from './routes.jsx';

// Development only: answer the auth endpoints from src/mocks until the server implements them.
// Set VITE_API_MOCKING=off to send every request to the real API instead. The DEV check lets the
// bundler drop the mocks from production builds.
async function enableApiMocking() {
  if (!import.meta.env.DEV || import.meta.env.VITE_API_MOCKING === 'off') return;
  const { worker } = await import('./mocks/browser.js');
  await worker.start({ onUnhandledRequest: 'bypass' });
}

enableApiMocking().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
});
