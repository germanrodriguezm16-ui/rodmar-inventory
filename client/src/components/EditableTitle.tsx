import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Edit3, Check, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface EditableTitleProps {
  id: number;
  currentName: string;
  type: "mina" | "comprador" | "volquetero";
  className?: string;
}

export function EditableTitle({ id, currentName, type, className = "" }: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(currentName);
  const [displayName, setDisplayName] = useState(currentName); // Estado local para mostrar nombre actualizado inmediatamente
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Sincronizar displayName cuando currentName cambia (desde props)
  useEffect(() => {
    setDisplayName(currentName);
  }, [currentName]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) {
        throw new Error("El nombre no puede estar vacío");
      }
      
      // Construir URL correcta según el tipo de entidad
      const endpoint = type === 'comprador' ? 'compradores' : type === 'volquetero' ? 'volqueteros' : 'minas';
      const url = `/api/${endpoint}/${id}/nombre`;
      const payload = { nombre: newName.trim() };
      
      console.log(`🔄 EDITABLE TITLE: Iniciando actualización de ${type} ID ${id} - Nombre actual: "${currentName}"`);
      console.log(`🔄 TIPO DE ID:`, typeof id, id);
      console.log(`🔄 URL: ${url}`);
      console.log(`🔄 Payload:`, payload);
      console.log(`🔄 NUEVO NOMBRE:`, `"${newName.trim()}"`);
      console.log(`🔄 NOMBRE ORIGINAL:`, `"${currentName}"`);
      
      try {
        const result = await apiRequest("PUT", url, payload);
        console.log(`✅ EDITABLE TITLE: Actualización exitosa para ${type} ID ${id}`, result);
        return result;
      } catch (error) {
        console.error(`❌ EDITABLE TITLE: Error actualizando ${type} ID ${id}:`, error);
        throw error;
      }
    },
    onSuccess: () => {
      // 1. ACTUALIZACIÓN INMEDIATA: Cambiar displayName localmente para feedback instantáneo
      setDisplayName(newName.trim());
      
      // 2. INVALIDACIÓN SELECTIVA: Solo queries que contienen nombres
      console.log(`🔄 Actualizando nombre de ${type} ID ${id} a "${newName.trim()}"`);
      
      // 3. Definir endpoint correcto antes de usarlo
      const entityEndpoint = type === 'comprador' ? '/api/compradores' : type === 'volquetero' ? '/api/volqueteros' : '/api/minas';
      
      // 4. Invalidar queries específicas que contienen nombres
      queryClient.invalidateQueries({ queryKey: [entityEndpoint] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/viajes"] });
      
      // 5. Invalidar queries específicas del socio afectado (crítico para nombres actualizados)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey;
          if (!Array.isArray(queryKey) || queryKey.length < 3) return false;
          
          // Invalidar queries como ["/api/transacciones", "socio", "comprador", "88"]
          return queryKey[0] === "/api/transacciones" && 
                 queryKey[1] === "socio" && 
                 queryKey[2] === type && 
                 queryKey[3] === id.toString();
        }
      });
      
      // 6. Invalidar queries específicas de volqueteros que usan nombres
      if (type === 'volquetero') {
        queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            if (!Array.isArray(queryKey)) return false;
            
            // Invalidar queries como ["/api/volqueteros", ID, "transacciones"]
            return queryKey.length === 3 && 
                   queryKey[0] === "/api/volqueteros" && 
                   queryKey[2] === "transacciones";
          }
        });
      }
      
      // 7. Invalidar balances si es necesario (para actualizar nombres en tarjetas)
      if (type === 'mina') {
        queryClient.invalidateQueries({ queryKey: ["/api/balances/minas"] });
        queryClient.refetchQueries({ queryKey: ["/api/balances/minas"] }); // Refetch inmediato para balances
      } else if (type === 'comprador') {
        queryClient.invalidateQueries({ queryKey: ["/api/balances/compradores"] });
        queryClient.refetchQueries({ queryKey: ["/api/balances/compradores"] }); // Refetch inmediato para balances
      } else if (type === 'volquetero') {
        queryClient.invalidateQueries({ queryKey: ["/api/balances/volqueteros"] });
        queryClient.refetchQueries({ queryKey: ["/api/balances/volqueteros"] }); // Refetch inmediato para balances
      }
      
      // React Query refetchea automáticamente las queries activas
      
      toast({
        title: "Nombre actualizado",
        description: `${newName.trim()} - Se están actualizando todos los registros...`,
      });
      
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el nombre",
        variant: "destructive",
      });
      
      // Restaurar nombre original en caso de error
      setNewName(currentName);
    },
  });

  const handleStartEdit = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
      e.nativeEvent.stopImmediatePropagation();
    }
    setIsEditing(true);
    setNewName(currentName);
  };

  const handleCancel = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
      e.nativeEvent.stopImmediatePropagation();
    }
    setIsEditing(false);
    setNewName(displayName); // Usar displayName que puede ser más actual que currentName
  };

  const handleSave = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
      e.nativeEvent.stopImmediatePropagation();
    }
    if (newName.trim() === currentName) {
      setIsEditing(false);
      return;
    }
    
    updateMutation.mutate();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const stopAllPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    e.nativeEvent.stopImmediatePropagation();
  };

  if (isEditing) {
    return (
      <div className={`flex items-center gap-2 ${className}`} onClick={stopAllPropagation}>
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyPress}
          className="text-xl font-bold h-8"
          autoFocus
          disabled={updateMutation.isPending}
          onClick={stopAllPropagation}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="h-8 w-8 p-0"
        >
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          disabled={updateMutation.isPending}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    );
  }

  // Manejar click simple en el nombre (permite que el click de la tarjeta funcione)
  const handleNameClick = (e: React.MouseEvent) => {
    // No hacer nada, dejar que el click se propague a la tarjeta
  };

  // Manejar doble click para activar edición
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevenir que active el click de la tarjeta
    e.preventDefault();
    // Limpiar timer si existe (por si acaso)
    if (clickTimer) {
      clearTimeout(clickTimer);
      setClickTimer(null);
    }
    handleStartEdit();
  };

  return (
    <div className={`flex items-center gap-2 group ${className}`}>
      <h1 
        className="cursor-text select-none font-bold" 
        onClick={handleNameClick}
        onDoubleClick={handleDoubleClick}
        title="Doble click para editar"
      >
        {displayName}
      </h1>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleStartEdit}
        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Edit3 className="h-4 w-4 text-gray-500" />
      </Button>
    </div>
  );
}