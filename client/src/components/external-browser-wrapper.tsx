import { ReactNode, useEffect, useState } from 'react';

interface ExternalBrowserWrapperProps {
  children: ReactNode;
}

export function ExternalBrowserWrapper({ children }: ExternalBrowserWrapperProps) {
  const [isStabilized, setIsStabilized] = useState(false);

  useEffect(() => {
    // Detect external browser environment
    const isExternalBrowser = !window.parent || window.parent === window || 
                              !document.referrer.includes('replit.com');

    if (isExternalBrowser) {
      console.log('External browser detected - applying stability enhancements');
      
      // Add stabilization delay to ensure DOM is ready
      const stabilizationTimer = setTimeout(() => {
        setIsStabilized(true);
      }, 500);

      // Enhanced cleanup for external browsers
      return () => {
        clearTimeout(stabilizationTimer);
      };
    } else {
      // In Replit environment, render immediately
      setIsStabilized(true);
    }
  }, []);

  // Show loading state while stabilizing
  if (!isStabilized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Cargando RodMar...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}