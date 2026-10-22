// Modal accessibility tests (NFR5, FR3.7): dialog semantics, focus moves in,
// Tab wraps inside, Esc closes and gives focus back to the opener, and a
// dialog that cannot close ignores Esc. Inside a host (the track frame) it
// opens in the host from the sm breakpoint up, and over the viewport on phones.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal, ModalHostContext } from './Modal.tsx';

function Harness({ canClose = true, onClose }: { canClose?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="opener">
        เปิด
      </button>
      <button type="button" data-testid="behind">
        ด้านหลัง
      </button>
      <Modal
        open={open}
        title="ทดสอบ"
        canClose={canClose}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
      >
        <button type="button" data-testid="inside-a">
          A
        </button>
        <button type="button" data-testid="inside-b">
          B
        </button>
      </Modal>
    </>
  );
}

function openModal() {
  const opener = screen.getByTestId('opener');
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

describe('Modal', () => {
  it('renders a labelled modal dialog and moves focus inside', () => {
    render(<Harness />);
    openModal();

    const dialog = screen.getByRole('dialog', { name: 'ทดสอบ' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('keeps Tab and Shift+Tab inside the dialog', () => {
    render(<Harness />);
    openModal();

    const close = screen.getByTestId('modal-close');
    const last = screen.getByTestId('inside-b');

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();

    // Focus that somehow escaped is pulled back in.
    screen.getByTestId('behind').focus();
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Tab' });
    expect(close).toHaveFocus();
  });

  it('closes on Esc and returns focus to the button that opened it', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = openModal();

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('ignores Esc and disables the close button when it cannot close', () => {
    const onClose = vi.fn();
    render(<Harness canClose={false} onClose={onClose} />);
    openModal();

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('modal-close')).toBeDisabled();
  });
});

describe('Modal host on phones', () => {
  function mockScreenWide(isWide: boolean) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn((query: string) => ({
        matches: isWide,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  }

  function HostedModal({ stayInHost = false }: { stayInHost?: boolean }) {
    const [host, setHost] = useState<HTMLDivElement | null>(null);
    return (
      <div ref={setHost} className="relative" data-testid="host">
        <ModalHostContext.Provider value={host}>
          <Modal
            open
            title="ในกรอบ"
            onClose={() => {}}
            testId="hosted"
            stayInHost={stayInHost}
            compact={stayInHost}
          >
            <p>body</p>
          </Modal>
        </ModalHostContext.Provider>
      </div>
    );
  }

  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it('opens inside the host from the sm breakpoint up', () => {
    mockScreenWide(true);
    render(<HostedModal />);
    expect(screen.getByTestId('host')).toContainElement(screen.getByRole('dialog'));
    expect(screen.getByTestId('hosted-backdrop')).toHaveClass('absolute');
  });

  it('opens over the whole viewport on a phone, where the host is too small', () => {
    mockScreenWide(false);
    render(<HostedModal />);
    expect(screen.getByTestId('host')).not.toContainElement(screen.getByRole('dialog'));
    expect(screen.getByTestId('hosted-backdrop')).toHaveClass('fixed', 'z-50');
  });

  it('keeps a stayInHost dialog centered in the host on a phone, as a compact card', () => {
    mockScreenWide(false);
    render(<HostedModal stayInHost />);
    expect(screen.getByTestId('host')).toContainElement(screen.getByRole('dialog'));
    expect(screen.getByTestId('hosted-backdrop')).toHaveClass(
      'absolute',
      'inset-0',
      'items-center',
      'justify-center',
    );
    expect(screen.getByTestId('hosted')).toHaveClass('max-w-sm', 'max-h-full');
  });
});
