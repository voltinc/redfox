import React from 'react';

/* Keeps a render error from blanking the whole console: the route shell stays
   usable and the user gets a reload path plus the error text. */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Redfox view error', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-xl border border-line bg-panel p-5 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accentInk">Something broke</p>
          <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.01em] text-fg">This view could not render</h2>
          <p className="mt-1.5 text-[12.5px] leading-5 text-muted">
            The rest of the console is fine. Reloading usually clears it; if it keeps happening, the message below is
            what an operator needs.
          </p>
          <pre className="mt-3 max-h-32 overflow-auto rounded-md border border-line bg-base px-2.5 py-2 font-mono text-[11px] leading-5 text-muted">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-8 items-center rounded-full bg-[color:var(--ink)] px-3.5 text-[12.5px] font-medium text-[color:var(--bg)] hover:bg-accent hover:text-[color:var(--ink)]"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              className="inline-flex h-8 items-center rounded-full border border-line px-3.5 text-[12.5px] text-fg hover:border-strong"
            >
              Back to overview
            </button>
          </div>
        </div>
      </div>
    );
  }
}
