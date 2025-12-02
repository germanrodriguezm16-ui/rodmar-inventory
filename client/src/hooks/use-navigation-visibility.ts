import { createContext, useContext, useState } from "react";

interface NavigationVisibilityContextType {
  isNavigationHidden: boolean;
  hideNavigation: () => void;
  showNavigation: () => void;
}

export const NavigationVisibilityContext = createContext<NavigationVisibilityContextType | undefined>(undefined);

export function useNavigationVisibility() {
  const context = useContext(NavigationVisibilityContext);
  if (!context) {
    throw new Error("useNavigationVisibility must be used within a NavigationVisibilityProvider");
  }
  return context;
}

export function useNavigationVisibilityState() {
  const [isNavigationHidden, setIsNavigationHidden] = useState(false);

  const hideNavigation = () => setIsNavigationHidden(true);
  const showNavigation = () => setIsNavigationHidden(false);

  return {
    isNavigationHidden,
    hideNavigation,
    showNavigation,
  };
}