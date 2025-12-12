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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  roleId: number | null;
  roleNombre: string | null;
}

interface Role {
  id: number;
  nombre: string;
  descripcion: string | null;
}

interface Permission {
  id: number;
  key: string;
  descripcion: string;
  categoria: string | null;
}

interface Override {
  permissionId: number;
  overrideType: "allow" | "deny";
}

interface UserModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
}

export default function UserModal({ open, onClose, user }: UserModalProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [newOverridePermissionId, setNewOverridePermissionId] = useState<string>("");
  const [newOverrideType, setNewOverrideType] = useState<"allow" | "deny">("deny");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/api/admin/roles"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/admin/roles"), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Error al cargar roles");
      return response.json();
    },
  });

  const { data: permissionsData } = useQuery<{ all: Permission[] }>({
    queryKey: ["/api/admin/permissions"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/admin/permissions"), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Error al cargar permisos");
      return response.json();
    },
  });

  const { data: effectivePermissions = [] } = useQuery<string[]>({
    queryKey: ["/api/admin/users", user?.id, "permissions"],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(apiUrl(`/api/admin/users/${user.id}/permissions`), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Error al cargar permisos");
      const data = await response.json();
      return data.permissions || [];
    },
    enabled: !!user?.id && open,
  });

  useEffect(() => {
    if (user) {
      setSelectedRoleId(user.roleId?.toString() || "");
      setOverrides([]); // Los overrides se cargarían desde el backend si los guardamos
      setShowAddOverride(false);
      setNewOverridePermissionId("");
      setNewOverrideType("deny");
    }
  }, [user, open]);

  const updateMutation = useMutation({
    mutationFn: async (data: { roleId: number | null; overrides: Override[] }) => {
      const response = await fetch(apiUrl(`/api/admin/users/${user!.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al actualizar usuario");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/permissions"] });
      toast({
        title: "Usuario actualizado",
        description: "El usuario ha sido actualizado correctamente",
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

  const handleAddOverride = () => {
    if (!newOverridePermissionId) return;

    const permissionId = parseInt(newOverridePermissionId);
    if (overrides.some((o) => o.permissionId === permissionId)) {
      toast({
        title: "Error",
        description: "Este permiso ya tiene un override",
        variant: "destructive",
      });
      return;
    }

    setOverrides([
      ...overrides,
      { permissionId, overrideType: newOverrideType },
    ]);
    setNewOverridePermissionId("");
    setShowAddOverride(false);
  };

  const handleRemoveOverride = (permissionId: number) => {
    setOverrides(overrides.filter((o) => o.permissionId !== permissionId));
  };

  const handleSubmit = () => {
    const roleId = selectedRoleId ? parseInt(selectedRoleId) : null;
    updateMutation.mutate({ roleId, overrides });
  };

  const allPermissions = permissionsData?.all || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Editar Usuario: {user?.firstName && user?.lastName
              ? `${user.firstName} ${user.lastName}`
              : user?.email || user?.id}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="text-sm text-muted-foreground">{user?.email || "N/A"}</div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rol Principal *</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin rol</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id.toString()}>
                      {role.nombre} {role.descripcion && `- ${role.descripcion}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Overrides Individuales (Opcional)</Label>
              <div className="space-y-2">
                {overrides.map((override) => {
                  const perm = allPermissions.find((p) => p.id === override.permissionId);
                  return (
                    <div
                      key={override.permissionId}
                      className="flex items-center justify-between p-2 border rounded-md"
                    >
                      <div>
                        <div className="font-medium text-sm">{perm?.key}</div>
                        <div className="text-xs text-muted-foreground">
                          {perm?.descripcion} -{" "}
                          <span
                            className={
                              override.overrideType === "allow"
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {override.overrideType === "allow" ? "Permitir" : "Denegar"}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOverride(override.permissionId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}

                {!showAddOverride ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddOverride(true)}
                  >
                    + Agregar Override
                  </Button>
                ) : (
                  <div className="space-y-2 p-2 border rounded-md">
                    <Select
                      value={newOverridePermissionId}
                      onValueChange={setNewOverridePermissionId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar permiso" />
                      </SelectTrigger>
                      <SelectContent>
                        {allPermissions
                          .filter(
                            (p) => !overrides.some((o) => o.permissionId === p.id)
                          )
                          .map((perm) => (
                            <SelectItem key={perm.id} value={perm.id.toString()}>
                              {perm.key} - {perm.descripcion}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Select value={newOverrideType} onValueChange={(v: "allow" | "deny") => setNewOverrideType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allow">Permitir</SelectItem>
                        <SelectItem value="deny">Denegar</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddOverride}>
                        Agregar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowAddOverride(false);
                          setNewOverridePermissionId("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {effectivePermissions.length > 0 && (
              <div className="space-y-2">
                <Label>Permisos Efectivos del Usuario</Label>
                <div className="text-xs text-muted-foreground p-2 bg-muted rounded-md">
                  {effectivePermissions.length} permiso{effectivePermissions.length !== 1 ? "s" : ""} total
                  {effectivePermissions.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      {effectivePermissions.map((perm) => (
                        <div key={perm} className="py-1">
                          • {perm}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

