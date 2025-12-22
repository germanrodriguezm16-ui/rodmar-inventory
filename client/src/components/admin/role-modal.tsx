import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Search } from "lucide-react";

interface Role {
  id: number;
  nombre: string;
  descripcion: string | null;
  permissions: Array<{
    permissionId: number;
    permissionKey: string;
    descripcion: string;
    categoria: string | null;
  }>;
}

interface Permission {
  id: number;
  key: string;
  descripcion: string;
  categoria: string | null;
}

interface RoleModalProps {
  open: boolean;
  onClose: () => void;
  role?: Role | null;
}

export default function RoleModal({ open, onClose, role }: RoleModalProps) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: permissionsData } = useQuery<{ all: Permission[]; grouped: Record<string, Permission[]> }>({
    queryKey: ["/api/admin/permissions"],
    queryFn: async () => {
      const { getAuthToken } = await import('@/hooks/useAuth');
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl("/api/admin/permissions"), {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error("Error al cargar permisos");
      return response.json();
    },
  });

  useEffect(() => {
    if (role) {
      setNombre(role.nombre);
      setDescripcion(role.descripcion || "");
      setSelectedPermissions(new Set(role.permissions.map((p) => p.permissionId)));
    } else {
      setNombre("");
      setDescripcion("");
      setSelectedPermissions(new Set());
    }
    setSearchTerm("");
    setCategoryFilter("all");
  }, [role, open]);

  const createMutation = useMutation({
    mutationFn: async (data: { nombre: string; descripcion: string; permissionIds: number[] }) => {
      const { getAuthToken } = await import('@/hooks/useAuth');
      const token = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl("/api/admin/roles"), {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al crear rol");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      toast({
        title: "Rol creado",
        description: "El rol ha sido creado correctamente",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { roleId: number; nombre: string; descripcion: string; permissionIds: number[] }) => {
      const { getAuthToken } = await import('@/hooks/useAuth');
      const token = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const { roleId, ...bodyData } = data;
      const response = await fetch(apiUrl(`/api/admin/roles/${roleId}`), {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify(bodyData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al actualizar rol");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Rol actualizado",
        description: "El rol ha sido actualizado correctamente",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTogglePermission = (permissionId: number) => {
    const newSet = new Set(selectedPermissions);
    if (newSet.has(permissionId)) {
      newSet.delete(permissionId);
    } else {
      newSet.add(permissionId);
    }
    setSelectedPermissions(newSet);
  };

  const handleSubmit = () => {
    if (!nombre.trim()) {
      toast({
        title: "Error",
        description: "El nombre del rol es requerido",
        variant: "destructive",
      });
      return;
    }

    if (!role) {
      toast({
        title: "Error",
        description: "No se puede actualizar: rol no encontrado",
        variant: "destructive",
      });
      return;
    }

    const permissionIds = Array.from(selectedPermissions);
    const data = { nombre, descripcion, permissionIds };

    if (role) {
      updateMutation.mutate({ roleId: role.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const allPermissions = permissionsData?.all || [];
  const categories = Array.from(new Set(allPermissions.map((p) => p.categoria).filter(Boolean)));

  const filteredPermissions = allPermissions.filter((perm) => {
    const matchesSearch =
      perm.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perm.descripcion.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || perm.categoria === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const groupedPermissions = filteredPermissions.reduce((acc, perm) => {
    const categoria = perm.categoria || "other";
    if (!acc[categoria]) {
      acc[categoria] = [];
    }
    acc[categoria].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{role ? "Editar Rol" : "Crear Nuevo Rol"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre del Rol *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: OPERADORA_FIN"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción del rol..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Permisos ({selectedPermissions.size} seleccionados)</Label>
            
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar permisos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="h-[400px] border rounded-md p-4">
              <div className="space-y-4">
                {Object.entries(groupedPermissions).map(([categoria, perms]) => (
                  <div key={categoria}>
                    <h4 className="font-semibold mb-2 text-sm uppercase text-muted-foreground">
                      {categoria}
                    </h4>
                    <div className="space-y-2">
                      {perms.map((perm) => (
                        <div key={perm.id} className="flex items-start space-x-2">
                          <Checkbox
                            id={`perm-${perm.id}`}
                            checked={selectedPermissions.has(perm.id)}
                            onCheckedChange={() => handleTogglePermission(perm.id)}
                          />
                          <label
                            htmlFor={`perm-${perm.id}`}
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                          >
                            <div className="font-medium">{perm.key}</div>
                            <div className="text-xs text-muted-foreground">
                              {perm.descripcion}
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending
              ? "Guardando..."
              : role
              ? "Actualizar"
              : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

