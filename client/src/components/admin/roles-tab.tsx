import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, Shield } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import RoleModal from "./role-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

export default function RolesTab() {
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: roles = [], isLoading } = useQuery<Role[]>({
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

  const deleteMutation = useMutation({
    mutationFn: async (roleId: number) => {
      const { getAuthToken } = await import('@/hooks/useAuth');
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl(`/api/admin/roles/${roleId}`), {
        method: "DELETE",
        credentials: "include",
        headers,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al eliminar rol");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setDeletingRole(null);
      toast({
        title: "Rol eliminado",
        description: "El rol ha sido eliminado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    setEditingRole(null);
    setShowModal(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setShowModal(true);
  };

  const handleDelete = (role: Role) => {
    setDeletingRole(role);
  };

  if (isLoading) {
    return <div className="text-center py-8">Cargando roles...</div>;
  }

  const getPreviewText = (items: Role["permissions"], limit = 2) => {
    const preview = items
      .map((perm) => perm.descripcion || perm.permissionKey)
      .filter(Boolean)
      .slice(0, limit);
    const remaining = items.length - preview.length;
    if (preview.length === 0) return "";
    return `${preview.join(", ")}${remaining > 0 ? ` y ${remaining} más` : ""}`;
  };

  const getPermissionGroup = (permissionKey: string) => {
    if (permissionKey.startsWith("module.")) {
      if (permissionKey.includes(".tab.")) return "ui";
      if (
        permissionKey.startsWith("module.MINAS.mina.") ||
        permissionKey.startsWith("module.COMPRADORES.comprador.") ||
        permissionKey.startsWith("module.VOLQUETEROS.volquetero.") ||
        permissionKey.startsWith("module.RODMAR.tercero.") ||
        permissionKey.startsWith("module.RODMAR.account.")
      ) {
        return "visibility";
      }
      return "ui";
    }
    if (permissionKey.startsWith("action.")) return "ops";
    return "other";
  };

  const groupLabels: Record<string, string> = {
    ui: "Acceso UI",
    visibility: "Visibilidad",
    ops: "Operación",
    other: "Otros",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Roles del Sistema</h3>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Crear Nuevo Rol
        </Button>
      </div>

      <div className="grid gap-4">
        {roles.map((role) => (
          <Card key={role.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{role.nombre}</CardTitle>
                    {role.descripcion && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {role.descripcion}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {role.permissions.length} permiso{role.permissions.length !== 1 ? "s" : ""}
                    </p>
                    {(() => {
                      const grouped = role.permissions.reduce<Record<string, Role["permissions"]>>(
                        (acc, perm) => {
                          const group = getPermissionGroup(perm.permissionKey);
                          if (!acc[group]) acc[group] = [];
                          acc[group].push(perm);
                          return acc;
                        },
                        {},
                      );
                      const orderedGroups = ["ui", "visibility", "ops", "other"].filter(
                        (group) => grouped[group]?.length,
                      );

                      return (
                        <>
                          {orderedGroups.map((group) => (
                            <p key={group} className="text-xs text-muted-foreground mt-1">
                              {groupLabels[group]}: {grouped[group].length}
                              {getPreviewText(grouped[group]) ? ` — ${getPreviewText(grouped[group])}` : ""}
                            </p>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(role)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(role)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Eliminar
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}

        {roles.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No hay roles creados. Crea tu primer rol para comenzar.
            </CardContent>
          </Card>
        )}
      </div>

      {showModal && (
        <RoleModal
          open={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingRole(null);
          }}
          role={editingRole}
        />
      )}

      {deletingRole && (
        <AlertDialog open={!!deletingRole} onOpenChange={() => setDeletingRole(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar rol?</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que deseas eliminar el rol "{deletingRole.nombre}"?
                Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(deletingRole.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

