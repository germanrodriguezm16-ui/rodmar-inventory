import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface PaginationControlsProps {
  page: number;
  limit: number | "todo";
  total: number;
  totalPages: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number | "todo") => void;
  limitOptions?: number[];
  showAllOption?: boolean;
}

export function PaginationControls({
  page,
  limit,
  total,
  totalPages,
  hasMore,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 20, 50, 100, 200, 500, 1000],
  showAllOption = true,
}: PaginationControlsProps) {
  const isAllMode = limit === "todo";
  const startItem = total === 0 ? 0 : isAllMode ? 1 : (page - 1) * (limit as number) + 1;
  const endItem = isAllMode ? total : Math.min(page * (limit as number), total);

  const handleFirstPage = () => {
    if (page > 1) onPageChange(1);
  };

  const handlePreviousPage = () => {
    if (page > 1) onPageChange(page - 1);
  };

  const handleNextPage = () => {
    if (hasMore) onPageChange(page + 1);
  };

  const handleLastPage = () => {
    if (page < totalPages) onPageChange(totalPages);
  };

  // Generar números de página a mostrar (máximo 7 páginas visibles)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;
    
    if (totalPages <= maxVisible) {
      // Mostrar todas las páginas si son pocas
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Lógica para mostrar páginas con elipsis
      if (page <= 3) {
        // Al inicio
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        // Al final
        pages.push(1);
        pages.push("ellipsis");
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // En el medio
        pages.push(1);
        pages.push("ellipsis");
        for (let i = page - 1; i <= page + 1; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  if (total === 0) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2">
      {/* Información de resultados */}
      <div className="text-sm text-muted-foreground">
        Mostrando {startItem} - {endItem} de {total} {total === 1 ? 'registro' : 'registros'}
      </div>

      {/* Controles de paginación */}
      <div className="flex items-center gap-4">
        {/* Selector de tamaño de página */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Por página:</span>
          <Select
            value={limit.toString()}
            onValueChange={(value) => {
              if (value === "todo") {
                onLimitChange("todo");
              } else {
                const newLimit = parseInt(value, 10);
                onLimitChange(newLimit);
              }
              // Resetear a página 1 cuando cambia el límite
              onPageChange(1);
            }}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {limitOptions.map((option) => (
                <SelectItem key={option} value={option.toString()}>
                  {option}
                </SelectItem>
              ))}
              {showAllOption && (
                <SelectItem value="todo">Todo</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Navegación de páginas - Solo mostrar si no está en modo "Todo" */}
        {!isAllMode && (
        <Pagination>
          <PaginationContent>
            {/* Primera página */}
            <PaginationItem>
              <Button
                variant="outline"
                size="icon"
                onClick={handleFirstPage}
                disabled={page === 1}
                className="h-8 w-8"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
            </PaginationItem>

            {/* Página anterior */}
            <PaginationItem>
              <PaginationPrevious
                onClick={handlePreviousPage}
                className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>

            {/* Números de página */}
            {getPageNumbers().map((pageNum, index) => (
              <PaginationItem key={index}>
                {pageNum === "ellipsis" ? (
                  <span className="px-2">...</span>
                ) : (
                  <PaginationLink
                    onClick={() => onPageChange(pageNum as number)}
                    isActive={page === pageNum}
                    className="cursor-pointer"
                  >
                    {pageNum}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}

            {/* Página siguiente */}
            <PaginationItem>
              <PaginationNext
                onClick={handleNextPage}
                className={!hasMore ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>

            {/* Última página */}
            <PaginationItem>
              <Button
                variant="outline"
                size="icon"
                onClick={handleLastPage}
                disabled={page === totalPages}
                className="h-8 w-8"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
        )}
      </div>
    </div>
  );
}

