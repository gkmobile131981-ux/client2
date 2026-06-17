import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React UI error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400 mb-4 animate-bounce">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Something went wrong</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            A rendering error occurred in the user interface. Our technical logs have captured the event details.
          </p>
          {this.state.error && (
            <div className="mt-4 max-w-lg rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-left font-mono text-xs text-red-300 overflow-auto">
              {this.state.error.toString()}
            </div>
          )}
          <Button onClick={this.handleReset} className="mt-6 gap-2">
            <RefreshCw className="h-4 w-4" /> Reset Interface
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
