// ThemeToggle tests: the button reports dark mode through aria-pressed, its
// title names the action, and clicking it flips the theme.

import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from './theme-context.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('flips between dark and light', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const toggle = screen.getByRole('button', { name: 'โหมดมืด' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAttribute('title', 'เปลี่ยนเป็นโหมดสว่าง');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAttribute('title', 'เปลี่ยนเป็นโหมดมืด');
    expect(document.documentElement.dataset.theme).toBe('light');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
