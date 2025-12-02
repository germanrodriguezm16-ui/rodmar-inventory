import { useEffect, useState } from 'react';

interface KeyboardAdjusterProps {
  children: React.ReactNode;
  className?: string;
}

export function KeyboardAdjuster({ children, className = '' }: KeyboardAdjusterProps) {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    let initialHeight = window.innerHeight;
    let timeoutId: NodeJS.Timeout;

    // Función para detectar teclado virtual de manera más robusta
    const detectKeyboard = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const heightDiff = initialHeight - currentHeight;
      const isOpen = heightDiff > 80; // Umbral más bajo para mayor sensibilidad
      
      setIsKeyboardOpen(isOpen);
      setKeyboardHeight(isOpen ? heightDiff : 0);
      
      console.log('📱 Keyboard detection:', {
        initial: initialHeight,
        current: currentHeight,
        diff: heightDiff,
        isOpen
      });
    };

    // Múltiples eventos para máxima cobertura
    const handleChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(detectKeyboard, 100);
    };

    // Detectar enfoque en campos de entrada
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        setTimeout(detectKeyboard, 200);
      }
    };

    const handleBlur = () => {
      setTimeout(detectKeyboard, 200);
    };

    // Agregar múltiples listeners
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleChange);
    }
    window.addEventListener('resize', handleChange);
    window.addEventListener('orientationchange', handleChange);
    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    return () => {
      clearTimeout(timeoutId);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleChange);
      }
      window.removeEventListener('resize', handleChange);
      window.removeEventListener('orientationchange', handleChange);
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
    };
  }, []);

  // Estilos dinámicos basados en el estado del teclado
  const adjustedStyle = isKeyboardOpen ? {
    maxHeight: `calc(100vh - ${keyboardHeight}px - 20px)`,
    paddingBottom: '20px',
    overflow: 'auto'
  } : {};

  return (
    <div 
      className={`keyboard-adjuster ${className} ${isKeyboardOpen ? 'keyboard-open' : ''}`}
      style={adjustedStyle}
    >
      {children}
    </div>
  );
}

// CSS adicional que se puede agregar globalmente
export const keyboardAdjusterStyles = `
.keyboard-adjuster {
  transition: max-height 0.3s ease, padding 0.3s ease;
}

.keyboard-adjuster.keyboard-open {
  overflow-y: auto;
}

.keyboard-adjuster.keyboard-open .space-y-4 > * + * {
  margin-top: 12px;
}
`;