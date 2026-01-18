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
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Copy, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface User {
  id: string;
  phone: string | null;
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
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [newOverridePermissionId, setNewOverridePermissionId] = useState<string>("");
  const [newOverrideType, setNewOverrideType] = useState<"allow" | "deny">("deny");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Verificar si el usuario es ADMIN
  const isAdminUser = user?.roleNombre === "ADMIN";

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/api/admin/roles"],
    queryFn: async () => {
      const { getAuthToken } = await import('@/hooks/useAuth');
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl("/api/admin/roles"), {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error("Error al cargar roles");
      return response.json();
    },
  });

  const { data: permissionsData } = useQuery<{ all: Permission[] }>({
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

  const { data: effectivePermissions = [] } = useQuery<string[]>({
    queryKey: ["/api/admin/users", user?.id, "permissions"],
    queryFn: async () => {
      if (!user?.id) return [];
      const { getAuthToken } = await import('@/hooks/useAuth');
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl(`/api/admin/users/${user.id}/permissions`), {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error("Error al cargar permisos");
      const data = await response.json();
      return data.permissions || [];
    },
    enabled: !!user?.id && open,
  });

  useEffect(() => {
    if (user) {
      setPhone(user.phone || "");
      setPassword(""); // No mostrar contraseña existente
      setCurrentPassword(""); // Campo para contraseña actual (no se puede obtener del backend por seguridad)
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setSelectedRoleId(user.roleId?.toString() || "none");
      setOverrides([]); // Los overrides se cargarían desde el backend si los guardamos
      setShowAddOverride(false);
      setNewOverridePermissionId("");
      setNewOverrideType("deny");
    } else {
      // Reset para crear nuevo usuario
      setPhone("");
      setPassword("");
      setCurrentPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setFirstName("");
      setLastName("");
      setSelectedRoleId("none");
      setOverrides([]);
      setShowAddOverride(false);
      setNewOverridePermissionId("");
      setNewOverrideType("deny");
    }
  }, [user, open]);

  const createMutation = useMutation({
    mutationFn: async (data: { phone: string; password: string; firstName?: string; lastName?: string; roleId: number | null }) => {
      const { getAuthToken } = await import('@/hooks/useAuth');
      const token = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl("/api/admin/users"), {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al crear usuario");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Usuario creado",
        description: "El usuario ha sido creado correctamente",
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

  const [showPassword, setShowPassword] = useState(false);
  const [userPassword, setUserPassword] = useState<string | null>(null);
  const [loadingPassword, setLoadingPassword] = useState(false);

  const fetchPasswordMutation = useMutation({
    mutationFn: async () => {
      const { getAuthToken } = await import('@/hooks/useAuth');
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl(`/api/admin/users/${user!.id}/password`), {
        credentials: "include",
        headers,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al obtener contraseña");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setUserPassword(data.password);
      setShowPassword(true);
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
    mutationFn: async (data: { roleId: number | null; overrides: Override[]; phone?: string; password?: string; firstName?: string; lastName?: string }) => {
      const { getAuthToken } = await import('@/hooks/useAuth');
      const token = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl(`/api/admin/users/${user!.id}`), {
        method: "PUT",
        headers,
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
    const roleId = selectedRoleId && selectedRoleId !== "none" ? parseInt(selectedRoleId) : null;
    
    if (!user) {
      // Crear nuevo usuario
      if (!phone || !password) {
        toast({
          title: "Error",
          description: "Celular y contraseña son requeridos",
          variant: "destructive",
        });
        return;
      }
      createMutation.mutate({
        phone,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        roleId,
      });
    } else {
      // Actualizar usuario existente
      const updateData: any = { roleId, overrides };
      if (phone && phone !== user.phone) {
        updateData.phone = phone;
      }
      if (password) {
        updateData.password = password;
      }
      if (firstName !== user.firstName) {
        updateData.firstName = firstName || null;
      }
      if (lastName !== user.lastName) {
        updateData.lastName = lastName || null;
      }
      updateMutation.mutate(updateData);
    }
  };

  const allPermissions = permissionsData?.all || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-full p-4 sm:p-6 overflow-hidden overflow-x-hidden flex flex-col min-h-0 border border-blue-200/60 ring-1 ring-blue-100/60 shadow-xl sm:rounded-2xl">
        <DialogHeader className="shrink-0 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-blue-100/70 bg-gradient-to-r from-blue-50/90 via-blue-50/30 to-transparent sm:rounded-t-2xl">
          <DialogTitle className="text-blue-800">
            {user ? `Editar Usuario: ${user.firstName && user.lastName
              ? `${user.firstName} ${user.lastName}`
              : user.email || user.id}` : "Crear Nuevo Usuario"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 mt-4 border rounded-xl border-blue-200/60 bg-white/40">
          <div className="p-4 space-y-4">
            {/* Campos para crear/editar usuario */}
            <div className="space-y-2">
              <Label htmlFor="phone">Número de Celular *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Ej: 3001234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required={!user} // Requerido solo al crear
                disabled={!!user && !isAdminUser} // Editable solo si es ADMIN o al crear
              />
              {user && !isAdminUser && (
                <p className="text-xs text-muted-foreground">
                  El celular no se puede cambiar por seguridad
                </p>
              )}
              {user && isAdminUser && (
                <p className="text-xs text-muted-foreground">
                  Como administrador, puedes editar el número de celular
                </p>
              )}
            </div>

            {user && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Contraseña del Usuario</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setLoadingPassword(true);
                      fetchPasswordMutation.mutate();
                      setLoadingPassword(false);
                    }}
                    disabled={fetchPasswordMutation.isPending || loadingPassword}
                    className="text-xs"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-3 h-3 mr-1" />
                        Ocultar
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3 mr-1" />
                        Ver Contraseña
                      </>
                    )}
                  </Button>
                </div>
                {showPassword && (
                  <div className="p-3 bg-muted rounded-md border">
                    {userPassword ? (
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-sm font-mono flex-1 break-all">{userPassword}</code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(userPassword);
                            toast({
                              title: "Copiado",
                              description: "Contraseña copiada al portapapeles",
                            });
                          }}
                          className="shrink-0"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Este usuario no tiene contraseña almacenada en texto plano (fue creado antes de implementar esta funcionalidad)
                      </p>
                    )}
                  </div>
                )}
                {!showPassword && (
                  <p className="text-xs text-muted-foreground">
                    Haz clic en "Ver Contraseña" para ver la contraseña actual del usuario. Esta acción será registrada en los logs.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">
                {user ? "Nueva Contraseña (dejar vacío para no cambiar)" : "Contraseña *"}
              </Label>
              <PasswordInput
                id="password"
                placeholder={user ? "Dejar vacío para mantener la actual" : "Ingresa la contraseña"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!user} // Requerido solo al crear
                showPassword={showNewPassword}
                onToggleShowPassword={() => setShowNewPassword(!showNewPassword)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombre</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Nombre"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellido</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Apellido"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            {user?.email && (
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="text-sm text-muted-foreground">{user.email}</div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="role">Rol Principal *</Label>
              <Select value={selectedRoleId || "none"} onValueChange={(v) => setSelectedRoleId(v === "none" ? "" : v)}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin rol</SelectItem>
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

        <DialogFooter className="shrink-0 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-3 border-t border-blue-100/70 bg-gradient-to-r from-white via-white to-blue-50/20 sm:rounded-b-2xl">
          <Button
            variant="outline"
            className="border-blue-200/70 hover:bg-blue-50/60"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm focus-visible:ring-blue-300"
          >
            {createMutation.isPending || updateMutation.isPending
              ? "Guardando..."
              : user
                ? "Guardar Cambios"
                : "Crear Usuario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

