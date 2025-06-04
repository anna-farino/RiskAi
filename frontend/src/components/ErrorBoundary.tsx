import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application Error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            {/* Error Icon */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full mb-4">
                <AlertTriangle className="w-10 h-10 text-red-400" />
              </div>
              
              {/* RisqAi Logo */}
              <div className="mb-4">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-[#BF00FF] to-[#00FFFF] bg-clip-text text-transparent">
                  RisqAi
                </h1>
              </div>
            </div>

            {/* Error Content */}
            <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 text-center">
              <h2 className="text-xl font-semibold text-white mb-3">
                Oops! Something went wrong
              </h2>
              
              <p className="text-slate-300 mb-6">
                Don't worry - we're working to fix this. Try refreshing the page or return to your dashboard.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={this.handleReload}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] rounded-lg transition-all duration-200"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all duration-200"
                >
                  <Home className="w-4 h-4" />
                  Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Functional Error Fallback Component for specific components
export function ErrorFallback({ 
  error, 
  resetErrorBoundary 
}: { 
  error: Error; 
  resetErrorBoundary: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl">
      <div className="inline-flex items-center justify-center w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-full mb-4">
        <AlertTriangle className="w-6 h-6 text-red-400" />
      </div>
      
      <h3 className="text-lg font-semibold text-white mb-2">
        Component Error
      </h3>
      
      <p className="text-slate-300 text-center mb-4 max-w-md">
        This section encountered an error and couldn't load properly.
      </p>

      {process.env.NODE_ENV === 'development' && (
        <details className="mb-4 w-full max-w-md">
          <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-300 mb-2">
            Error Details
          </summary>
          <div className="bg-slate-800/70 border border-slate-700/50 rounded-lg p-3">
            <pre className="text-xs text-red-300 overflow-auto max-h-24">
              {error.message}
            </pre>
          </div>
        </details>
      )}
      
      <button
        onClick={resetErrorBoundary}
        className="flex items-center gap-2 px-4 py-2 bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] rounded-lg transition-all duration-200"
      >
        <RefreshCw className="w-4 h-4" />
        Try Again
      </button>
    </div>
  );
}