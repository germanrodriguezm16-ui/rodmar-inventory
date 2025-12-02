import React from 'react';

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
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Filter out the specific DOM errors we're seeing
    if (
      error.message.includes('removeChild') ||
      error.message.includes('The node to be removed is not a child of this node') ||
      error.message.includes('NotFoundError')
    ) {
      // Log these specific errors but don't crash the app
      console.warn('DOM manipulation error caught and handled:', error.message);
      this.setState({ hasError: false });
      return;
    }
    
    // Log other errors normally
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <h2 className="text-lg font-semibold text-red-800">Algo salió mal</h2>
          <p className="text-red-600">
            Ha ocurrido un error inesperado. Por favor, recarga la página.
          </p>
          <button
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            onClick={() => window.location.reload()}
          >
            Recargar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}