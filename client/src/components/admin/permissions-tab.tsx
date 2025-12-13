import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiUrl } from "@/lib/api";
import { Search, Folder, FileText, Zap } from "lucide-react";

interface Permission {
  id: number;
  key: string;
  descripcion: string;
  categoria: string | null;
}

const categoryIcons: Record<string, any> = {
  module: Folder,
  tab: FileText,
  action: Zap,
};

export default function PermissionsTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: permissionsData, isLoading } = useQuery<{
    all: Permission[];
    grouped: Record<string, Permission[]>;
  }>({
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

  if (isLoading) {
    return <div className="text-center py-8">Cargando permisos...</div>;
  }

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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Catálogo de Permisos</h3>
        <p className="text-sm text-muted-foreground">
          {allPermissions.length} permisos totales
        </p>
      </div>

      <div className="flex gap-2">
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

      <div className="space-y-4">
        {Object.entries(groupedPermissions).map(([categoria, perms]) => {
          const Icon = categoryIcons[categoria] || FileText;
          return (
            <Card key={categoria}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold uppercase">{categoria}</h4>
                  <span className="text-xs text-muted-foreground">
                    ({perms.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {perms.map((perm) => (
                    <div
                      key={perm.id}
                      className="p-2 border rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <div className="font-mono text-sm font-medium">
                        {perm.key}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {perm.descripcion}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {Object.keys(groupedPermissions).length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No se encontraron permisos con los filtros aplicados
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

