import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, X } from 'lucide-react';

interface AutocompleteOption {
  value: string;
  label: string;
}

interface AutocompleteProps {
  options: AutocompleteOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  className?: string;
  allowClear?: boolean;
}

export function Autocomplete({ 
  options, 
  value, 
  onValueChange, 
  placeholder, 
  className = "",
  allowClear = true 
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayValue, setDisplayValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizar displayValue con value seleccionado
  useEffect(() => {
    if (value && value !== "all" && value !== "") {
      const selectedOption = options.find(opt => opt.value === value);
      if (selectedOption) {
        setDisplayValue(selectedOption.label);
        setSearchQuery('');
      }
    } else {
      setDisplayValue('');
      setSearchQuery('');
    }
  }, [value, options]);

  // Filtrar opciones basado en búsqueda
  const filteredOptions = options.filter(option => 
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Manejar clic fuera del componente
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Si no hay valor seleccionado, limpiar la búsqueda
        if (!value || value === "all" || value === "") {
          setSearchQuery('');
          setDisplayValue('');
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setDisplayValue(query);
    setIsOpen(true);
    
    // Si el campo está vacío, resetear selección
    if (query === '') {
      onValueChange('');
    }
  };

  const handleOptionSelect = (option: AutocompleteOption) => {
    onValueChange(option.value);
    setDisplayValue(option.label);
    setSearchQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onValueChange('');
    setDisplayValue('');
    setSearchQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={displayValue || searchQuery}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-8 text-xs pr-8"
        />
        
        <div className="absolute right-1 top-1 flex items-center gap-1">
          {(value && value !== "all" && value !== "" && allowClear) && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-muted rounded"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 hover:bg-muted rounded"
          >
            <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg">
          <ScrollArea className="max-h-48">
            <div className="p-1">
              {/* Opción "Todos" siempre visible */}
              <div
                className="px-2 py-1.5 text-xs cursor-pointer hover:bg-muted rounded"
                onClick={() => handleOptionSelect({ value: "all", label: "Todos" })}
              >
                Todos
              </div>
              
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    className="px-2 py-1.5 text-xs cursor-pointer hover:bg-muted rounded"
                    onClick={() => handleOptionSelect(option)}
                  >
                    {option.label}
                  </div>
                ))
              ) : searchQuery ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No se encontraron resultados
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}