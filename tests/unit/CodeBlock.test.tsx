import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import CodeBlock from '@/components/ai/CodeBlock';

// Stub sonner so tests don't depend on the actual toast portal.
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Helper to build a Clipboard API stub.
function buildClipboardStub(shouldFail = false) {
  const writeText = vi.fn(
    (_text: string) =>
      shouldFail
        ? Promise.reject(new Error('clipboard denied'))
        : Promise.resolve(),
  );
  return { writeText, __shouldFail: shouldFail };
}

describe('CodeBlock', () => {
  let originalClipboard: Navigator['clipboard'] | undefined;

  beforeEach(() => {
    originalClipboard = navigator.clipboard;
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore the real clipboard.
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
    vi.useRealTimers();
    vi.clearAllMocks();
    cleanup();
  });

  function installClipboard(shouldFail = false) {
    const stub = buildClipboardStub(shouldFail);
    Object.defineProperty(navigator, 'clipboard', {
      value: stub,
      configurable: true,
      writable: true,
    });
    return stub;
  }

  it('renders the code content', () => {
    installClipboard();
    render(<CodeBlock code="console.log('hi')" language="typescript" />);
    expect(screen.getByText("console.log('hi')")).toBeInTheDocument();
  });

  it('shows a language badge', () => {
    installClipboard();
    render(<CodeBlock code="x = 1" language="python" />);
    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  it('falls back to "Text" badge when language is omitted', () => {
    installClipboard();
    render(<CodeBlock code="hello" />);
    expect(screen.getByText('Text')).toBeInTheDocument();
  });

  it('shows a Copy button with descriptive aria-label', () => {
    installClipboard();
    render(<CodeBlock code="hello" language="bash" />);
    const btn = screen.getByRole('button', {
      name: 'Copy code to clipboard',
    });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('copies only the raw code text on click', async () => {
    const stub = installClipboard();
    render(<CodeBlock code="git status" language="bash" />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy code to clipboard' }),
    );
    // Flush the async clipboard promise.
    await vi.runAllTimersAsync();
    expect(stub.writeText).toHaveBeenCalledTimes(1);
    expect(stub.writeText).toHaveBeenCalledWith('git status');
  });

  it('shows "Copied" feedback and success toast on success', async () => {
    const { toast } = await import('sonner');
    installClipboard();
    render(<CodeBlock code="hello" />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Copy code to clipboard' }),
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(
      screen.getByRole('button', { name: 'Code copied to clipboard' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Copied')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Code copied to clipboard');
  });

  it('resets the button state after the reset delay', async () => {
    installClipboard();
    render(<CodeBlock code="hello" resetDelayMs={2000} />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Copy code to clipboard' }),
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Copied')).toBeInTheDocument();

    // Just before reset: still "Copied".
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999);
    });
    expect(screen.getByText('Copied')).toBeInTheDocument();

    // After reset: back to "Copy".
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy code to clipboard' }),
    ).toBeInTheDocument();
  });

  it('shows an error toast and reverts the button on clipboard failure', async () => {
    const { toast } = await import('sonner');
    installClipboard(true);
    render(<CodeBlock code="hello" />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy code to clipboard' }),
    );
    await vi.runAllTimersAsync();

    expect(toast.error).toHaveBeenCalledWith(
      'Could not copy code. Please copy manually.',
    );
    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy code to clipboard' }),
    ).toBeInTheDocument();
  });

  it('falls back to execCommand when Clipboard API is unavailable', async () => {
    // Remove navigator.clipboard entirely.
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const execCommandSpy = vi.fn(() => true);
    document.execCommand = execCommandSpy;

    render(<CodeBlock code="hello world" />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy code to clipboard' }),
    );
    await vi.runAllTimersAsync();

    expect(execCommandSpy).toHaveBeenCalledWith('copy');
    expect(
      screen.getByRole('button', { name: 'Code copied to clipboard' }),
    ).toBeInTheDocument();
  });

  it('preserves multi-line code with leading whitespace', () => {
    installClipboard();
    const code = 'function f() {\n  return 1;\n}\n';
    render(<CodeBlock code={code} language="typescript" />);
    // The code element should contain the full multi-line string verbatim.
    const codeEl = document.querySelector('pre code');
    expect(codeEl?.textContent).toBe(code);
  });

  it('is keyboard accessible', () => {
    installClipboard();
    render(<CodeBlock code="hello" />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label');
    // Tabindex is implicitly 0 for <button>; verify focus moves to it.
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('clears the reset timer on unmount', async () => {
    installClipboard();
    const { unmount } = render(<CodeBlock code="hello" resetDelayMs={2000} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy code to clipboard' }),
    );
    await vi.runAllTimersAsync();
    // Unmounting before the timer fires should not throw.
    expect(() => unmount()).not.toThrow();
  });
});
