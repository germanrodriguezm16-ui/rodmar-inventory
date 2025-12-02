import { AlertTriangle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportWarningBannerProps {
  onReimport: () => void;
  onDismiss: () => void;
}

export default function ImportWarningBanner({ onReimport, onDismiss }: ImportWarningBannerProps) {
  return (
    <Alert className="mb-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="flex items-center justify-between w-full">
        <div className="text-amber-800 dark:text-amber-200">
          <strong>Datos importados perdidos:</strong> Los viajes importados de Excel se perdieron tras el reinicio del servidor. 
          Para recuperarlos, reimporta tu archivo Excel.
        </div>
        <div className="flex gap-2 ml-4">
          <Button
            size="sm"
            variant="outline"
            onClick={onReimport}
            className="bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-800 dark:bg-amber-900 dark:hover:bg-amber-800 dark:border-amber-700 dark:text-amber-200"
          >
            <Upload className="h-3 w-3 mr-1" />
            Reimportar Excel
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
          >
            Descartar
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}