import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageViewer } from "@/components/ui/image-viewer";
import { Upload, Eye, X } from "lucide-react";

interface ReceiptImageUploadProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ReceiptImageUpload({ value, onChange, placeholder = "Número de recibo" }: ReceiptImageUploadProps) {
  // Parse existing value to separate text and image
  const parseValue = (val: string) => {
    if (!val) return { text: "", image: "" };
    const parts = val.split("|IMAGE:");
    return {
      text: parts[0] || "",
      image: parts[1] || ""
    };
  };

  const parsed = parseValue(value || "");
  const [receiptText, setReceiptText] = useState(parsed.text);
  const [imageUrl, setImageUrl] = useState<string>(parsed.image);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local state when value prop changes
  useEffect(() => {
    console.log("=== ReceiptImageUpload - value prop changed:", value);
    const newParsed = parseValue(value || "");
    console.log("=== ReceiptImageUpload - parsed:", newParsed);
    setReceiptText(newParsed.text);
    setImageUrl(newParsed.image);
  }, [value]);

  const handleReceiptTextChange = (text: string) => {
    setReceiptText(text);
    // Combine text and image for the form
    const combinedValue = imageUrl ? `${text}|IMAGE:${imageUrl}` : text;
    onChange(combinedValue);
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions to keep under 200KB
        const maxWidth = 800;
        const maxHeight = 600;
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
        
        // Start with quality 0.7 and reduce if still too large
        let quality = 0.7;
        let result = canvas.toDataURL('image/jpeg', quality);
        
        // Keep reducing quality until under 200KB
        while (result.length > 300000 && quality > 0.1) {
          quality -= 0.1;
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
        // Combine text and image for the form
        const combinedValue = `${receiptText}|IMAGE:${compressedImage}`;
        onChange(combinedValue);
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
    // Update form with just the text (no image)
    onChange(receiptText);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={receiptText}
          onChange={(e) => handleReceiptTextChange(e.target.value)}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="px-3"
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
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearImage}
              className="px-3 text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
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
        title={`Recibo: ${receiptText || "Sin número"}`}
      />
    </div>
  );
}