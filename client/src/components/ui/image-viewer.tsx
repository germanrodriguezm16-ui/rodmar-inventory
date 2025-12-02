import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  title?: string;
}

export function ImageViewer({ isOpen, onClose, imageUrl, title = "Imagen del Recibo" }: ImageViewerProps) {
  if (!imageUrl) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0" aria-describedby="image-viewer-description">
        <DialogHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div id="image-viewer-description" className="sr-only">
          Visualizador de imagen del recibo
        </div>
        <div className="p-4 pt-0">
          <div className="relative bg-muted/20 rounded-lg overflow-hidden">
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-auto max-h-[70vh] object-contain"
              style={{ maxHeight: "70vh" }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}