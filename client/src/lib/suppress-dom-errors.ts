/**
 * Suppresses common DOM manipulation errors that occur during React component cleanup
 * These errors are usually harmless but create noise in the console
 */
export function suppressDOMErrors() {
  // Store original console.error
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  // Override console.error to filter DOM errors
  console.error = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    
    // Filter out specific DOM manipulation errors
    const shouldSuppress = [
      'The node to be removed is not a child of this node',
      'NotFoundError: Failed to execute \'removeChild\'',
      'Warning: Missing "Description" or "aria-describedby={undefined}" for {DialogContent}',
      'Uncaught NotFoundError: Failed to execute \'removeChild\' on \'Node\'',
      'removeChild',
      'Failed to execute \'removeChild\' on \'Node\'',
      'aria-describedby={undefined}',
      'NotFoundError'
    ].some(errorText => message.includes(errorText));
    
    if (!shouldSuppress) {
      originalConsoleError.apply(console, args);
    }
  };

  // Override console.warn to filter warnings
  console.warn = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    
    const shouldSuppress = [
      'Missing "Description" or "aria-describedby={undefined}"',
      'DialogContent',
      'aria-describedby={undefined}'
    ].some(errorText => message.includes(errorText));
    
    if (!shouldSuppress) {
      originalConsoleWarn.apply(console, args);
    }
  };
  
  // Handle uncaught DOM errors - more comprehensive
  const handleUncaughtError = (event: ErrorEvent) => {
    const message = event.error?.message || event.message || '';
    
    if (
      message.includes('removeChild') ||
      message.includes('The node to be removed is not a child of this node') ||
      message.includes('NotFoundError') ||
      message.includes('Failed to execute \'removeChild\'') ||
      message.includes('aria-describedby')
    ) {
      console.log('DOM error suppressed in external browser:', message);
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  };

  // Handle unhandled promise rejections that might be DOM related
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const message = event.reason?.message || event.reason?.toString() || '';
    
    if (
      message.includes('removeChild') ||
      message.includes('NotFoundError') ||
      message.includes('Failed to execute \'removeChild\'')
    ) {
      console.log('Promise rejection suppressed:', message);
      event.preventDefault();
      return false;
    }
  };
  
  // Add listeners for both iframe and external browser contexts
  window.addEventListener('error', handleUncaughtError, true);
  window.addEventListener('unhandledrejection', handleUnhandledRejection, true);
  
  // Also handle errors on document for broader coverage
  if (typeof document !== 'undefined') {
    document.addEventListener('error', handleUncaughtError, true);
  }
  
  return () => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    window.removeEventListener('error', handleUncaughtError, true);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
    if (typeof document !== 'undefined') {
      document.removeEventListener('error', handleUncaughtError, true);
    }
  };
}