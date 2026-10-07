import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Translation } from 'react-i18next';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/** Keeps a crash in one feature from blanking the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AstroPoint] UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <Translation>
        {(t) => (
          <div className="fatal" role="alert">
            <p>{t('errors.generic')}</p>
            <button type="button" className="btn" onClick={() => location.reload()}>
              {t('errors.reload')}
            </button>
          </div>
        )}
      </Translation>
    );
  }
}
