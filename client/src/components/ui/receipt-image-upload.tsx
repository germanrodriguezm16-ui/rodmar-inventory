import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ImageViewer } from "@/components/ui/image-viewer";
import { Upload, Eye, X, Camera } from "lucide-react";

interface ReceiptImageUploadProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ReceiptImageUpload({ value, onChange, placeholder = "Número de recibo" }: ReceiptImageUploadProps) {
  // Parse existing value to get image (text field removed)
  const parseValue = (val: string) => {
    if (!val) return { image: "" };
    const parts = val.split("|IMAGE:");
    return {
      image: parts[1] || parts[0] || "" // Support both old format and new format
    };
  };

  const parsed = parseValue(value || "");
  const [imageUrl, setImageUrl] = useState<string>(parsed.image);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Sync local state when value prop changes
  useEffect(() => {
    console.log("=== ReceiptImageUpload - value prop changed:", value);
    const newParsed = parseValue(value || "");
    console.log("=== ReceiptImageUpload - parsed:", newParsed);
    setImageUrl(newParsed.image);
  }, [value]);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions - increased for better quality
        const maxWidth = 1200;
        const maxHeight = 900;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Start with quality 0.90 (90%) for better image quality
        let quality = 0.90;
        let result = canvas.toDataURL('image/jpeg', quality);
        
        // Keep reducing quality in smaller steps until under 1MB (aumentado para mejor calidad)
        while (result.length > 1000000 && quality > 0.1) {
          quality -= 0.05;
          result = canvas.toDataURL('image/jpeg', quality);
        }
        
        resolve(result);
      };
      
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      try {
        const compressedImage = await compressImage(file);
        console.log("Compressed image size:", compressedImage.length, "characters");
        
        setImageUrl(compressedImage);
        // Store only the image (text field removed)
        onChange(`|IMAGE:${compressedImage}`);
      } catch (error) {
        console.error("Error compressing image:", error);
        alert("Error al procesar la imagen. Por favor intenta con otra imagen.");
      }
    }
  };

  const clearImage = () => {
    setImageUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
    // Clear the form value
    onChange("");
  };

  const handleCameraCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      try {
        const compressedImage = await compressImage(file);
        console.log("Compressed image from camera size:", compressedImage.length, "characters");
        
        setImageUrl(compressedImage);
        // Store only the image
        onChange(`|IMAGE:${compressedImage}`);
      } catch (error) {
        console.error("Error compressing image from camera:", error);
        alert("Error al procesar la imagen. Por favor intenta de nuevo.");
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {/* Botón de cámara para tomar foto directamente */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => cameraInputRef.current?.click()}
          className="flex-1"
          title="Tomar foto"
        >
          <Camera className="h-4 w-4" />
        </Button>
        
        {/* Botón para subir desde galería */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1"
          title="Subir archivo"
        >
          <Upload className="h-4 w-4" />
        </Button>
        
        {imageUrl && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowImageViewer(true)}
              className="px-3"
              title="Ver imagen"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearImage}
              className="px-3 text-red-600 hover:text-red-700"
              title="Eliminar imagen"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
      
      {/* Input oculto para subir archivo desde galería */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {/* Input oculto para tomar foto con cámara */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        className="hidden"
      />
      
      {imageUrl && (
        <div className="text-xs text-muted-foreground">
          Imagen adjuntada. Haz clic en el ícono del ojo para ver.
        </div>
      )}

      <ImageViewer
        isOpen={showImageViewer}
        onClose={() => setShowImageViewer(false)}
        imageUrl={imageUrl}
        title="Comprobante"
      />
    </div>
  );
}