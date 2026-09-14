import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function RouteEffects() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const path = location.pathname;
    document.title = path.startsWith('/game/')
      ? 'Play game — UploadNPlay'
      : path === '/developer'
        ? 'Developer — UploadNPlay'
        : path === '/admin'
          ? 'Admin — UploadNPlay'
          : path === '/upload'
            ? 'Publish — UploadNPlay'
            : path === '/library'
              ? 'Library — UploadNPlay'
              : path === '/profile'
                ? 'Profile — UploadNPlay'
                : path === '/auth'
                  ? 'Sign in — UploadNPlay'
                  : 'UploadNPlay';
  }, [location.pathname]);

  return null;
}

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export class ProductionBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('UploadNPlay application error', error, info.componentStack);
  }

  private recover = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="app-error-page">
        <div className="app-error-card">
          <span className="app-error-kicker">UPLOADNPLAY</span>
          <h1>Something went wrong.</h1>
          <p>The page hit an unexpected error. Your account and published games are still stored safely.</p>
          {this.state.message && <code>{this.state.message}</code>}
          <button type="button" onClick={this.recover}>Reload UploadNPlay</button>
        </div>
      </main>
    );
  }
}
