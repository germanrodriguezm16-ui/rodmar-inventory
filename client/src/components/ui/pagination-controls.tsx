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
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
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

  // Generar números de página a mostrar (máximo 7 páginas en desktop, 3-5 en móvil)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = isMobile ? 5 : 7;
    
    if (totalPages <= maxVisible) {
      // Mostrar todas las páginas si son pocas
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // En móviles, mostrar solo página actual y adyacentes
      if (isMobile) {
        // Móvil: mostrar página actual, anterior, siguiente, primera y última
        if (page === 1) {
          pages.push(1);
          if (totalPages > 2) pages.push(2);
          if (totalPages > 3) pages.push("ellipsis");
          if (totalPages > 1) pages.push(totalPages);
        } else if (page === totalPages) {
          pages.push(1);
          if (totalPages > 2) pages.push("ellipsis");
          if (totalPages > 1) pages.push(totalPages - 1);
          pages.push(totalPages);
        } else {
          pages.push(1);
          if (page > 2) pages.push("ellipsis");
          pages.push(page - 1);
          pages.push(page);
          pages.push(page + 1);
          if (page < totalPages - 1) pages.push("ellipsis");
          pages.push(totalPages);
        }
      } else {
        // Desktop: lógica original con más páginas
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
    }
    
    return pages;
  };

  if (total === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 py-4 px-2">
      {/* Información de resultados */}
      <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
        Mostrando {startItem} - {endItem} de {total} {total === 1 ? 'registro' : 'registros'}
      </div>

      {/* Controles de paginación */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
        {/* Selector de tamaño de página - Más compacto en móviles */}
        <div className="flex items-center gap-2 order-2 sm:order-1">
          <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">Por página:</span>
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
            <SelectTrigger className="w-[70px] sm:w-[100px] h-8 text-xs">
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
        <div className="w-full sm:w-auto order-1 sm:order-2">
          <Pagination>
            <PaginationContent className="flex-wrap justify-center gap-0.5 sm:gap-1 max-w-full">
              {/* Primera página - Solo icono en móviles */}
              <PaginationItem>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleFirstPage}
                  disabled={page === 1}
                  className="h-8 w-8 sm:h-9 sm:w-9"
                  title="Primera página"
                >
                  <ChevronsLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </PaginationItem>

              {/* Página anterior - Solo icono en móviles */}
              <PaginationItem>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePreviousPage}
                  disabled={page === 1}
                  className="h-8 w-8 sm:h-9 sm:w-9"
                  title="Página anterior"
                >
                  <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </PaginationItem>

              {/* Números de página */}
              {getPageNumbers().map((pageNum, index) => (
                <PaginationItem key={index}>
                  {pageNum === "ellipsis" ? (
                    <span className="px-1 sm:px-2 text-xs sm:text-sm">...</span>
                  ) : (
                    <PaginationLink
                      onClick={() => onPageChange(pageNum as number)}
                      isActive={page === pageNum}
                      className="cursor-pointer h-8 w-8 sm:h-9 sm:w-9 text-xs sm:text-sm min-w-[32px] sm:min-w-[36px]"
                    >
                      {pageNum}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}

              {/* Página siguiente - Solo icono en móviles */}
              <PaginationItem>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNextPage}
                  disabled={!hasMore}
                  className="h-8 w-8 sm:h-9 sm:w-9"
                  title="Página siguiente"
                >
                  <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </PaginationItem>

              {/* Última página - Solo icono en móviles */}
              <PaginationItem>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleLastPage}
                  disabled={page === totalPages}
                  className="h-8 w-8 sm:h-9 sm:w-9"
                  title="Última página"
                >
                  <ChevronsRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
        )}
      </div>
    </div>
  );
}

