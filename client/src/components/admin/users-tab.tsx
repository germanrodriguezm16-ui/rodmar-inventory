import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Users as UsersIcon, Plus } from "lucide-react";
import { apiUrl } from "@/lib/api";
import UserModal from "./user-modal";

interface User {
  id: string;
  phone: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  roleId: number | null;
  roleNombre: string | null;
  roleDescripcion: string | null;
}

export default function UsersTab() {
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/admin/users"), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Error al cargar usuarios");
      return response.json();
    },
  });

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setShowModal(true);
  };

  const filteredUsers = users.filter((user) => {
    const search = searchTerm.toLowerCase();
    return (
      user.phone?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search) ||
      user.firstName?.toLowerCase().includes(search) ||
      user.lastName?.toLowerCase().includes(search) ||
      user.roleNombre?.toLowerCase().includes(search)
    );
  });

  if (isLoading) {
    return <div className="text-center py-8">Cargando usuarios...</div>;
  }

  const handleCreate = () => {
    setEditingUser(null);
    setShowModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Usuarios del Sistema</h3>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Crear Usuario
        </Button>
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder="Buscar usuarios..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border rounded-md"
        />
      </div>

      <div className="grid gap-4">
        {filteredUsers.map((user) => (
          <Card key={user.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <UsersIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.phone || user.email || user.id}
                    </CardTitle>
                    {user.phone && (
                      <p className="text-sm text-muted-foreground mt-1">
                        📱 {user.phone}
                      </p>
                    )}
                    {user.email && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {user.email}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Rol: {user.roleNombre || "Sin rol asignado"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(user)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Editar Rol
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}

        {filteredUsers.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchTerm ? "No se encontraron usuarios" : "No hay usuarios en el sistema"}
            </CardContent>
          </Card>
        )}
      </div>

      {showModal && (
        <UserModal
          open={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingUser(null);
          }}
          user={editingUser}
        />
      )}
    </div>
  );
}

