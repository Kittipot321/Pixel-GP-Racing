// Global test setup for the web workspace.
//
// - jest-dom adds DOM-specific matchers (toBeInTheDocument, toBeDisabled, …).
// - RTL cleanup runs after each test to unmount and reset the DOM.

import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
