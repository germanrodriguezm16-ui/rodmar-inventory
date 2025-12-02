import { useLocation } from "wouter";

export function useGlobalNavigation() {
  const [, setLocation] = useLocation();

  const navigateToModule = (module: string) => {
    switch (module) {
      case "principal":
        setLocation("/principal");
        break;
      case "minas":
        setLocation("/minas");
        break;
      case "compradores":
        setLocation("/compradores");
        break;
      case "volqueteros":
        setLocation("/volqueteros");
        break;
      case "transacciones":
        setLocation("/transacciones");
        break;
      case "rodmar":
        setLocation("/rodmar");
        break;
      default:
        setLocation("/");
    }
  };

  const getCurrentModule = () => {
    const currentPath = window.location.pathname;
    if (currentPath.includes("/minas")) return "minas";
    if (currentPath.includes("/compradores")) return "compradores";
    if (currentPath.includes("/volqueteros")) return "volqueteros";
    if (currentPath.includes("/transacciones")) return "transacciones";
    if (currentPath.includes("/rodmar")) return "rodmar";
    if (currentPath.includes("/principal")) return "principal";
    return "principal"; // default
  };

  return {
    navigateToModule,
    getCurrentModule
  };
}