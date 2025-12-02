import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  // Autenticación deshabilitada - siempre retornar usuario autenticado
  const mockUser = {
    id: "main_user",
    email: "usuario@rodmar.com",
    firstName: "Usuario",
    lastName: "Principal",
  };

  return {
    user: mockUser,
    isLoading: false,
    isAuthenticated: true,
  };
}