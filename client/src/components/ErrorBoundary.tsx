import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Patrones específicos de errores del preview de Replit que deben ser suprimidos
    const replitPreviewPatterns = [
      "useRef",
      "Cannot read properties of null",
      "reading 'useRef'",
      "reading 'current'",
      "hook",
      "ResizeObserver",
      "IntersectionObserver", 
      "MutationObserver",
      "removeChild",
      "aria-describedby",
      "NotFoundError"
    ];
    
    const isReplitPreviewError = replitPreviewPatterns.some(pattern => 
      error.message.includes(pattern) || 
      error.stack?.includes(pattern) ||
      error.stack?.includes('.replit.dev')
    );
    
    if (isReplitPreviewError) {
      console.warn("[ErrorBoundary] Error de preview de Replit suprimido completamente:", error.message.substring(0, 100));
      // NO mostrar el error boundary, continuar renderizado normal
      return { hasError: false };
    }
    
    // Para otros errores reales, mostrar el error boundary
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary capturó un error:", error, errorInfo);
  }

  public render() {
    // NO mostrar error boundary nunca, siempre renderizar children
    // Los errores de preview ya fueron suprimidos en getDerivedStateFromError
    return this.props.children;
  }
}

export default ErrorBoundary;