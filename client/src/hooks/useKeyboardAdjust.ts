import { useEffect, useState } from 'react';

interface KeyboardState {
  isOpen: boolean;
  height: number;
}

export function useKeyboardAdjust() {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isOpen: false,
    height: 0
  });

  useEffect(() => {
    let initialViewportHeight = window.visualViewport?.height || window.innerHeight;
    let timeoutId: NodeJS.Timeout;
    let isInputFocused = false;

    const updateKeyboardState = (currentHeight: number) => {
      const heightDifference = initialViewportHeight - currentHeight;
      const isKeyboardOpen = heightDifference > 60; // Umbral muy sensible para móviles
      
      console.log('🔧 Keyboard detection:', {
        initial: initialViewportHeight,
        current: currentHeight,
        difference: heightDifference,
        isOpen: isKeyboardOpen,
        inputFocused: isInputFocused
      });
      
      setKeyboardState({
        isOpen: isKeyboardOpen,
        height: isKeyboardOpen ? heightDifference : 0
      });
    };
    
    const handleViewportChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const currentHeight = window.visualViewport?.height || window.innerHeight;
        updateKeyboardState(currentHeight);
      }, 100);
    };

    // Detectar focus en inputs para forzar chequeo del teclado
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        isInputFocused = true;
        // Chequear después de que el teclado tenga tiempo de aparecer
        setTimeout(() => {
          const currentHeight = window.visualViewport?.height || window.innerHeight;
          updateKeyboardState(currentHeight);
        }, 300);
      }
    };

    const handleFocusOut = () => {
      isInputFocused = false;
      // Chequear después de que el teclado tenga tiempo de desaparecer
      setTimeout(() => {
        const currentHeight = window.visualViewport?.height || window.innerHeight;
        updateKeyboardState(currentHeight);
      }, 300);
    };

    // Múltiples eventos para máxima compatibilidad
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }
    
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      clearTimeout(timeoutId);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return keyboardState;
}

// Hook para scroll automático al input activo
export function useInputFocus() {
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        // Esperar un poco para que el teclado se abra
        setTimeout(() => {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }, 300);
      }
    };

    document.addEventListener('focusin', handleFocus);
    
    return () => {
      document.removeEventListener('focusin', handleFocus);
    };
  }, []);
}