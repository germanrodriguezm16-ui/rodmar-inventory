import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeftRight, Plus, Download, Filter, GripVertical } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, highlightText, highlightValue } from "@/lib/utils";
import type { TransaccionWithSocio } from "@shared/schema";

// Definir categorías para organizar las transacciones
const TRANSACTION_CATEGORIES = {
  pending: { title: "Pendientes", color: "bg-yellow-50 border-yellow-200" },
  processing: { title: "En Proceso", color: "bg-blue-50 border-blue-200" },
  completed: { title: "Completadas", color: "bg-green-50 border-green-200" },
  cancelled: { title: "Canceladas", color: "bg-red-50 border-red-200" }
};

// Componente de transacción arrastrable
interface DraggableTransactionProps {
  transaction: TransaccionWithSocio;
  searchTerm?: string;
}

function DraggableTransaction({ transaction, searchTerm = "" }: DraggableTransactionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: transaction.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? 'opacity-50' : ''}`}
    >
      <Card className="mb-2 hover:shadow-md transition-shadow">
        <CardContent className="p-3">
          <div className="flex items-center space-x-3">
            <div 
              {...attributes} 
              {...listeners}
              className="cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 text-gray-400" />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{highlightText(transaction.concepto, searchTerm)}</p>
                  <p className="text-xs text-muted-foreground">
                    {transaction.socioNombre} • {formatDate(transaction.fecha)}
                  </p>
                  {transaction.comentario && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {highlightText(transaction.comentario, searchTerm)}
                    </p>
                  )}
                </div>
                
                <div className="text-right">
                  <p className={`font-semibold text-sm ${
                    parseFloat(transaction.valor) >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {highlightValue(formatCurrency(transaction.valor), searchTerm)}
                  </p>
                  
                  <Badge variant="outline" className="text-xs">
                    {transaction.tipoSocio}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Componente de zona de drop para categorías
interface DroppableCategoryProps {
  category: keyof typeof TRANSACTION_CATEGORIES;
  transactions: TransaccionWithSocio[];
  children: React.ReactNode;
}

function DroppableCategory({ category, transactions, children }: DroppableCategoryProps) {
  const categoryInfo = TRANSACTION_CATEGORIES[category];
  
  return (
    <Card className={`${categoryInfo.color} min-h-[200px]`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          {categoryInfo.title}
          <Badge variant="secondary" className="text-xs">
            {transactions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <SortableContext 
          items={transactions.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {children}
        </SortableContext>
        
        {transactions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Arrastra transacciones aquí
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TransaccionesDND() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTipoSocio, setSelectedTipoSocio] = useState<string>("");
  const { toast } = useToast();

  // Estado local para las transacciones organizadas por categoría
  const [transactionsByCategory, setTransactionsByCategory] = useState<{
    [K in keyof typeof TRANSACTION_CATEGORIES]: TransaccionWithSocio[]
  }>({
    pending: [],
    processing: [],
    completed: [],
    cancelled: []
  });

  const { data: transactions = [], isLoading } = useQuery<TransaccionWithSocio[]>({
    queryKey: ["/api/transacciones"],
    onSuccess: (data) => {
      // Organizar transacciones por categoría al cargar
      const organized = {
        pending: data.filter(t => !t.estado || t.estado === 'pendiente'),
        processing: data.filter(t => t.estado === 'procesando'),
        completed: data.filter(t => t.estado === 'completada'),
        cancelled: data.filter(t => t.estado === 'cancelada')
      };
      setTransactionsByCategory(organized);
    }
  });

  // Sensores para drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Mutación para actualizar el estado de una transacción
  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, estado }: { id: number; estado: string }) => {
      return await apiRequest("PATCH", `/api/transacciones/${id}`, { estado });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
      toast({
        title: "Transacción actualizada",
        description: "El estado de la transacción ha sido actualizado.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la transacción: " + error.message,
        variant: "destructive",
      });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id as number;
    const overId = over.id;

    // Encontrar la transacción que se está arrastrando
    const transaction = Object.values(transactionsByCategory)
      .flat()
      .find(t => t.id === activeId);

    if (!transaction) return;

    // Determinar la categoría de destino
    let targetCategory: keyof typeof TRANSACTION_CATEGORIES | null = null;

    // Si se arrastra sobre una categoría directamente
    if (typeof overId === 'string' && overId in TRANSACTION_CATEGORIES) {
      targetCategory = overId as keyof typeof TRANSACTION_CATEGORIES;
    } else {
      // Si se arrastra sobre otra transacción, determinar su categoría
      for (const [category, transactions] of Object.entries(transactionsByCategory)) {
        if (transactions.some(t => t.id === overId)) {
          targetCategory = category as keyof typeof TRANSACTION_CATEGORIES;
          break;
        }
      }
    }

    if (!targetCategory) return;

    // Encontrar la categoría actual de la transacción
    let currentCategory: keyof typeof TRANSACTION_CATEGORIES | null = null;
    for (const [category, transactions] of Object.entries(transactionsByCategory)) {
      if (transactions.some(t => t.id === activeId)) {
        currentCategory = category as keyof typeof TRANSACTION_CATEGORIES;
        break;
      }
    }

    if (!currentCategory || currentCategory === targetCategory) return;

    // Actualizar el estado local inmediatamente
    setTransactionsByCategory(prev => {
      const newCategories = { ...prev };
      
      // Remover de la categoría actual
      newCategories[currentCategory] = newCategories[currentCategory].filter(t => t.id !== activeId);
      
      // Agregar a la nueva categoría
      newCategories[targetCategory] = [...newCategories[targetCategory], transaction];
      
      return newCategories;
    });

    // Mapear categoría a estado
    const stateMap = {
      pending: 'pendiente',
      processing: 'procesando',
      completed: 'completada',
      cancelled: 'cancelada'
    };

    // Actualizar en el servidor
    updateTransactionMutation.mutate({
      id: activeId,
      estado: stateMap[targetCategory]
    });
  }

  // Filtrar transacciones según los criterios de búsqueda
  const getFilteredTransactions = (transactions: TransaccionWithSocio[]) => {
    return transactions.filter(transaction => {
      const searchLower = searchTerm.toLowerCase();
      const searchNumeric = searchTerm.replace(/[^\d]/g, ''); // Solo números para búsqueda en valor
      const valor = String(transaction.valor || '').replace(/[^\d]/g, ''); // Solo números del valor
      const matchesSearch = !searchTerm || 
        transaction.socioNombre?.toLowerCase().includes(searchLower) ||
        transaction.concepto.toLowerCase().includes(searchLower) ||
        (transaction.comentario || '').toLowerCase().includes(searchLower) ||
        (searchNumeric && valor.includes(searchNumeric));
      
      const matchesTipoSocio = !selectedTipoSocio || selectedTipoSocio === "all" || transaction.tipoSocio === selectedTipoSocio;
      
      return matchesSearch && matchesTipoSocio;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Cargando transacciones...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Gestión de Transacciones</h2>
        <Button size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex space-x-2">
        <Input
          placeholder="Buscar transacciones..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Select value={selectedTipoSocio} onValueChange={setSelectedTipoSocio}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="mina">Minas</SelectItem>
            <SelectItem value="comprador">Compradores</SelectItem>
            <SelectItem value="volquetero">Volqueteros</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tablero de drag and drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(TRANSACTION_CATEGORIES).map(([category, info]) => (
            <DroppableCategory
              key={category}
              category={category as keyof typeof TRANSACTION_CATEGORIES}
              transactions={getFilteredTransactions(transactionsByCategory[category as keyof typeof TRANSACTION_CATEGORIES])}
            >
              {getFilteredTransactions(transactionsByCategory[category as keyof typeof TRANSACTION_CATEGORIES]).map((transaction) => (
                <DraggableTransaction
                  key={transaction.id}
                  transaction={transaction}
                  searchTerm={searchTerm}
                />
              ))}
            </DroppableCategory>
          ))}
        </div>
      </DndContext>

      {/* Resumen */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Resumen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            {Object.entries(TRANSACTION_CATEGORIES).map(([category, info]) => {
              const count = transactionsByCategory[category as keyof typeof TRANSACTION_CATEGORIES].length;
              const total = transactionsByCategory[category as keyof typeof TRANSACTION_CATEGORIES]
                .reduce((sum, t) => sum + parseFloat(t.valor), 0);
              
              return (
                <div key={category}>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{info.title}</p>
                  <p className="text-xs font-medium">{formatCurrency(total)}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}