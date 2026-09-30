import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

function DefaultFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="grain flex min-h-[60dvh] w-full flex-col items-center justify-center bg-background p-6 text-center">
      <div className="w-full max-w-lg rounded-[28px] border border-border bg-card p-8 shadow-xl">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <span className="text-xl">⚠️</span>
        </div>
        <div className="mono-label text-muted-foreground">Workspace Recovery</div>
        <h2 className="mt-1 text-2xl font-extrabold tracking-[-.04em] text-sidebar">
          Something took a stumble.
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This section encountered an unexpected state, but your data and the rest of LifeOS remain safe.
        </p>
        {import.meta.env.DEV ? (
          <pre className="mt-4 max-h-40 overflow-x-auto rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-left font-mono text-xs text-destructive">
            {error.message || String(error)}
          </pre>
        ) : null}
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={resetError}
            className="focus-ring rounded-full bg-sidebar px-6 py-2.5 text-xs font-bold text-sidebar-foreground shadow-sm transition hover:opacity-90 active:scale-95"
            data-testid="button-error-retry"
          >
            Reload workspace view
          </button>
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      'ErrorBoundary caught an error:',
      toError(error),
      info.componentStack,
    );
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
