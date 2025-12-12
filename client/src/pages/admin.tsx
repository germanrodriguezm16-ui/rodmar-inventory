import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Key } from "lucide-react";
import RolesTab from "@/components/admin/roles-tab";
import UsersTab from "@/components/admin/users-tab";
import PermissionsTab from "@/components/admin/permissions-tab";
import { usePermissions } from "@/hooks/usePermissions";

export default function Admin() {
  const { has, isLoading } = usePermissions();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !has("module.ADMIN.view")) {
      setLocation("/");
    }
  }, [has, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!has("module.ADMIN.view")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="py-8 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acceso Denegado</h2>
            <p className="text-muted-foreground">
              No tienes permiso para acceder a esta sección.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-7xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Administración de Roles y Permisos
            </CardTitle>
            <p className="text-muted-foreground text-sm mt-2">
              Gestiona roles, usuarios y permisos del sistema
            </p>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="p-6">
            <Tabs defaultValue="roles" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="roles" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Roles
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Usuarios
                </TabsTrigger>
                <TabsTrigger value="permissions" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Permisos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="roles" className="mt-6">
                <RolesTab />
              </TabsContent>

              <TabsContent value="users" className="mt-6">
                <UsersTab />
              </TabsContent>

              <TabsContent value="permissions" className="mt-6">
                <PermissionsTab />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

