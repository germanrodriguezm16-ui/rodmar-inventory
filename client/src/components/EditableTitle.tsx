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
      
      // 2. INVALIDACIÓN ULTRA-AGRESIVA: Limpiar todo el cache y refrescar
      console.log(`🔄 INVALIDACIÓN MASIVA: Actualizando nombre de ${type} ID ${id} a "${newName.trim()}"`);
      
      // 3. Definir endpoint correcto antes de usarlo
      const entityEndpoint = type === 'comprador' ? '/api/compradores' : type === 'volquetero' ? '/api/volqueteros' : '/api/minas';
      
      // 4. Usar predicates para capturar TODAS las queries que pueden contener nombres
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          if (!Array.isArray(queryKey)) return false;
          
          // Invalidar cualquier query que contenga transacciones, viajes, o entidades
          const keyStr = queryKey.join('/').toLowerCase();
          return keyStr.includes('transacciones') || 
                 keyStr.includes('viajes') || 
                 keyStr.includes('minas') || 
                 keyStr.includes('compradores') || 
                 keyStr.includes('volqueteros') ||
                 keyStr.includes('rodmar-accounts');
        }
      });
      
      // 5. Remover completamente del cache las queries más críticas
      queryClient.removeQueries({ queryKey: ["/api/transacciones"] });
      queryClient.removeQueries({ queryKey: ["/api/viajes"] });
      queryClient.removeQueries({ queryKey: [entityEndpoint] });
      
      // 3. INVALIDACIÓN ESPECÍFICA: Transacciones por socio (crítico para nombres actualizados)
      queryClient.removeQueries({ 
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
      
      // 3. Configurar staleTime: 0 para forzar queries frescas
      queryClient.setQueriesData(
        { queryKey: ["/api/transacciones"] },
        undefined // Esto limpia el cache
      );
      
      // 4. Forzar refetch inmediato de entidades específicas
      
      queryClient.refetchQueries({ 
        queryKey: [entityEndpoint],
        type: 'active'
      });
      
      queryClient.refetchQueries({ 
        queryKey: ["/api/transacciones"],
        type: 'active'
      });
      
      queryClient.refetchQueries({ 
        queryKey: ["/api/viajes"],
        type: 'active'
      });
      
      // 5. También refrescar queries específicas de volqueteros que usan nombres
      queryClient.refetchQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          if (!Array.isArray(queryKey)) return false;
          
          // Refrescar queries como ["/api/volqueteros", ID, "transacciones"]
          return queryKey.length === 3 && 
                 queryKey[0] === "/api/volqueteros" && 
                 queryKey[2] === "transacciones";
        }
      });
      
      // 6. Wait and force final refresh (para asegurar consistency)
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: [entityEndpoint] });
        queryClient.refetchQueries({ queryKey: ["/api/transacciones"] });
        console.log(`🔄 REFETCH TARDÍO: Nombres actualizados completamente`);
      }, 500);
      
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

  // Manejar doble click para activar edición
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevenir que active el click de la tarjeta
    e.preventDefault();
    handleStartEdit();
  };

  return (
    <div className={`flex items-center gap-2 group ${className}`}>
      <h1 
        className="cursor-text select-none font-bold" 
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