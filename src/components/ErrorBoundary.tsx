"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Terminal-styled error boundary. Catches React render errors
 * and shows a branded fallback instead of a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[you.md] render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex items-center justify-center min-h-[200px] p-6">
          <div className="max-w-md w-full">
            <div className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-5 font-mono text-[13px]" style={{ borderRadius: "2px" }}>
              <p className="text-[hsl(var(--accent))] mb-2">ERR: render failed</p>
              <p className="text-[hsl(var(--text-secondary))] opacity-50 text-[11px] mb-3">
                {this.state.error?.message || "an unexpected error occurred."}
              </p>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="text-[11px] text-[hsl(var(--accent-mid))] hover:text-[hsl(var(--accent))] transition-colors"
              >
                &gt; retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
