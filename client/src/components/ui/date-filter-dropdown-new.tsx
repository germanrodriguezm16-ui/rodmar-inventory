import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, ChevronDown } from "lucide-react";

interface DateFilterDropdownProps {
  buttonText: string;
  onApplyFilter: (filterType: string, startDate?: Date, endDate?: Date, sortOrder?: string) => void;
  currentFilter?: string;
  currentSort?: string;
}

const dateFilterOptions = [
  { value: "exactamente", label: "Exactamente" },
  { value: "entre", label: "Entre" },
  { value: "despues_de", label: "Después de" },
  { value: "antes_de", label: "Antes de" },
  { value: "hoy", label: "Hoy" },
  { value: "ayer", label: "Ayer" },
  { value: "esta_semana", label: "Esta semana" },
  { value: "semana_pasada", label: "Semana pasada" },
  { value: "este_mes", label: "Este mes" },
  { value: "mes_pasado", label: "Mes pasado" },
  { value: "este_año", label: "Este año" },
  { value: "año_pasado", label: "Año pasado" },
];

function DateFilterDropdown({ buttonText, onApplyFilter, currentFilter, currentSort }: DateFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");

  const needsCustomDate = ["exactamente", "despues_de", "antes_de"].includes(selectedFilter);
  const needsDateRange = selectedFilter === "entre";
  const isPresetFilter = [
    "hoy", "ayer", "esta_semana", "semana_pasada", 
    "este_mes", "mes_pasado", "este_año", "año_pasado"
  ].includes(selectedFilter);

  const handleApply = () => {
    // Si no hay filtro seleccionado pero se cambió el ordenamiento, aplicar solo ordenamiento
    if (!selectedFilter) {
      onApplyFilter("all", undefined, undefined, sortOrder);
    } else if (isPresetFilter) {
      onApplyFilter(selectedFilter, undefined, undefined, sortOrder);
    } else if (needsCustomDate && startDate) {
      onApplyFilter(selectedFilter, new Date(startDate), undefined, sortOrder);
    } else if (needsDateRange && startDate && endDate) {
      onApplyFilter(selectedFilter, new Date(startDate), new Date(endDate), sortOrder);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedFilter("");
    setStartDate("");
    setEndDate("");
    setSortOrder("desc");
    onApplyFilter("clear");
    setIsOpen(false);
  };

  const getSortIcon = () => {
    if (currentSort === "asc") return "↑";
    if (currentSort === "desc") return "↓";
    return "↑↓";
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="justify-between min-w-[200px]"
        >
          {buttonText} {getSortIcon()}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Filtro por fecha</Label>
            <Select value={selectedFilter} onValueChange={setSelectedFilter}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Seleccionar filtro" />
              </SelectTrigger>
              <SelectContent>
                {dateFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campos de fecha para filtros que los necesitan */}
          {needsCustomDate && (
            <div>
              <Label className="text-sm font-medium">
                {selectedFilter === "exactamente" ? "Fecha" : 
                 selectedFilter === "despues_de" ? "Desde fecha" : "Hasta fecha"}
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
          )}

          {needsDateRange && (
            <div className="space-y-2">
              <div>
                <Label className="text-sm font-medium">Fecha inicio</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Fecha fin</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Ordenamiento */}
          <div>
            <Label className="text-sm font-medium">Ordenar por fecha</Label>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Más reciente a más antiguo</SelectItem>
                <SelectItem value="asc">Más antiguo a más reciente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col space-y-2">
            {/* Botón para aplicar solo ordenamiento */}
            <Button
              variant="secondary"
              onClick={() => {
                onApplyFilter("all", undefined, undefined, sortOrder);
                setIsOpen(false);
              }}
              className="w-full"
            >
              Aplicar ordenamiento
            </Button>
            
            {/* Botones para filtros */}
            <div className="flex gap-2">
              <Button
                onClick={handleApply}
                disabled={
                  selectedFilter ? (
                    (needsCustomDate && !startDate) ||
                    (needsDateRange && (!startDate || !endDate))
                  ) : false
                }
                className="flex-1"
                ref={(el) => {
                  if (el) {
                    el.style.setProperty('background-color', '#16a34a', 'important');
                    el.style.setProperty('color', 'white', 'important');
                    el.style.setProperty('border-color', '#16a34a', 'important');
                  }
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.setProperty('background-color', '#15803d', 'important');
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.setProperty('background-color', '#16a34a', 'important');
                  }
                }}
              >
                Aplicar filtro
              </Button>
              <Button variant="outline" onClick={handleClear}>
                Limpiar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DateFilterDropdown;