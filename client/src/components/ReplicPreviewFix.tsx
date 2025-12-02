import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ReplicPreviewFix() {
  const [isReplicPreview, setIsReplicPreview] = useState(false);
  const [deploymentUrl, setDeploymentUrl] = useState<string>("");

  useEffect(() => {
    // Detectar si estamos en el preview de Replit (.replit.dev)
    const isPreview = window.location.hostname.includes('.replit.dev');
    setIsReplicPreview(isPreview);

    if (isPreview) {
      // Intentar obtener el URL público desde variables de entorno o generar uno probable
      const replId = window.location.hostname.split('.')[0];
      const publicUrl = `https://${replId}.replit.app`;
      setDeploymentUrl(publicUrl);
    }
  }, []);

  const handleRedirectToPublic = () => {
    if (deploymentUrl) {
      window.open(deploymentUrl, '_blank');
    }
  };

  if (!isReplicPreview) {
    return null; // No mostrar nada si no estamos en preview
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">RodMar App</h1>
          <p className="text-gray-600 mb-4">
            El preview interno de Replit tiene problemas de compatibilidad.
          </p>
        </div>

        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">Solución:</h3>
          <p className="text-blue-800 text-sm mb-3">
            La aplicación funciona perfectamente en el enlace público de deployment.
          </p>
          <Button 
            onClick={handleRedirectToPublic}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            Abrir RodMar en Nueva Pestaña
          </Button>
        </div>

        <div className="text-sm text-gray-500">
          <p className="mb-2">URL público sugerido:</p>
          <code className="bg-gray-100 px-2 py-1 rounded text-xs break-all">
            {deploymentUrl}
          </code>
        </div>
      </div>
    </div>
  );
}