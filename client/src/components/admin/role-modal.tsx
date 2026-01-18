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
  const [groupFilter, setGroupFilter] = useState<string>("all");
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
    setGroupFilter("all");
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
      queryClient.invalidateQueries({ queryKey: ["/api/user/permissions"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/user/permissions"] });
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

    const permissionIds = Array.from(selectedPermissions);
    const data = { nombre, descripcion, permissionIds };

    if (role) updateMutation.mutate({ roleId: role.id, ...data });
    else createMutation.mutate(data);
  };

  const allPermissions = permissionsData?.all || [];
  const groupLabels: Record<string, string> = {
    ui: "Acceso UI",
    visibility: "Visibilidad",
    ops: "Operación",
    other: "Otros",
  };

  const getPermissionGroup = (perm: Permission) => {
    const key = perm.key;

    if (key.startsWith("module.")) {
      if (key.includes(".tab.")) {
        return { group: "ui", subgroup: "Pestañas" };
      }
      if (
        key.startsWith("module.MINAS.mina.") ||
        key.startsWith("module.COMPRADORES.comprador.") ||
        key.startsWith("module.VOLQUETEROS.volquetero.") ||
        key.startsWith("module.RODMAR.tercero.") ||
        key.startsWith("module.RODMAR.account.")
      ) {
        if (key.startsWith("module.MINAS.mina.")) return { group: "visibility", subgroup: "Minas" };
        if (key.startsWith("module.COMPRADORES.comprador.")) return { group: "visibility", subgroup: "Compradores" };
        if (key.startsWith("module.VOLQUETEROS.volquetero.")) return { group: "visibility", subgroup: "Volqueteros" };
        if (key.startsWith("module.RODMAR.tercero.")) return { group: "visibility", subgroup: "Terceros" };
        if (key.startsWith("module.RODMAR.account.")) return { group: "visibility", subgroup: "Cuentas RodMar" };
      }
      return { group: "ui", subgroup: "Módulos" };
    }

    if (key.startsWith("action.")) {
      if (key.includes(".use")) {
        return { group: "ops", subgroup: "Usar por entidad" };
      }
      return { group: "ops", subgroup: "Acciones" };
    }

    return { group: "other", subgroup: "Otros" };
  };

  const groupOptions = Array.from(
    new Set(allPermissions.map((perm) => getPermissionGroup(perm).group)),
  );

  const filteredPermissions = allPermissions.filter((perm) => {
    const matchesSearch =
      perm.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perm.descripcion.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGroup = groupFilter === "all" || getPermissionGroup(perm).group === groupFilter;
    return matchesSearch && matchesGroup;
  });

  const groupedPermissions = filteredPermissions.reduce((acc, perm) => {
    const { group, subgroup } = getPermissionGroup(perm);
    if (!acc[group]) {
      acc[group] = {};
    }
    if (!acc[group][subgroup]) {
      acc[group][subgroup] = [];
    }
    acc[group][subgroup].push(perm);
    return acc;
  }, {} as Record<string, Record<string, Permission[]>>);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-w-5xl w-full p-4 sm:p-6 overflow-hidden overflow-x-hidden flex flex-col min-h-0 border border-blue-200/60 ring-1 ring-blue-100/60 shadow-xl sm:rounded-2xl"
      >
        <DialogHeader className="shrink-0 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-blue-100/70 bg-gradient-to-r from-blue-50/90 via-blue-50/30 to-transparent sm:rounded-t-2xl">
          <DialogTitle className="text-blue-800">
            {role ? "Editar Rol" : "Crear Nuevo Rol"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 min-h-0 flex-1">
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

          <div className="flex flex-col gap-2 flex-1 min-h-0">
            <Label>Permisos ({selectedPermissions.size} seleccionados)</Label>
            <div className="flex flex-col sm:flex-row gap-2 mb-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar permisos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {groupOptions.map((group) => (
                    <SelectItem key={group} value={group}>
                      {groupLabels[group] || group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="flex-1 min-h-0 border rounded-xl border-blue-200/60 bg-white/40">
              <div className="p-4 space-y-5">
                {["ui", "visibility", "ops", "other"]
                  .filter((group) => groupedPermissions[group])
                  .map((group) => (
                    <div key={group} className="space-y-3">
                      <h4 className="font-semibold text-sm uppercase text-muted-foreground">
                        {groupLabels[group] || group}
                      </h4>
                      {Object.entries(groupedPermissions[group]).map(([subgroup, perms]) => (
                        <div key={subgroup} className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground">
                            {subgroup}
                          </div>
                          <div className="space-y-2">
                            {perms.map((perm) => (
                              <div key={perm.id} className="flex items-start gap-2 min-w-0">
                                <Checkbox
                                  id={`perm-${perm.id}`}
                                  checked={selectedPermissions.has(perm.id)}
                                  onCheckedChange={() => handleTogglePermission(perm.id)}
                                />
                                <label
                                  htmlFor={`perm-${perm.id}`}
                                  className="text-sm leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1 min-w-0"
                                >
                                  <div className="font-medium break-words">{perm.descripcion}</div>
                                  <div className="text-xs text-muted-foreground break-all">
                                    {perm.key}
                                  </div>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="shrink-0 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-3 border-t border-blue-100/70 bg-gradient-to-r from-white via-white to-blue-50/20 sm:rounded-b-2xl flex-row gap-2 justify-end">
          <Button
            variant="outline"
            className="border-blue-200/70 hover:bg-blue-50/60 flex-1 sm:flex-none"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm focus-visible:ring-blue-300 flex-1 sm:flex-none"
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

