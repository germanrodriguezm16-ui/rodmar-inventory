import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mountain, Plus, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function MinasSimple() {
  const [expandedMina, setExpandedMina] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"viajes" | "transacciones" | "balance">("viajes");

  // Queries con tipado simplificado
  const { data: minas = [] } = useQuery({
    queryKey: ["/api/minas"],
  });

  const toggleMina = (minaId: number) => {
    console.log("Toggling mina:", minaId);
    setExpandedMina(expandedMina === minaId ? null : minaId);
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mountain className="h-6 w-6" />
          Minas
        </h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Agregar Mina
        </Button>
      </div>

      <div className="grid gap-4">
        {Array.isArray(minas) && minas.map((mina: any) => (
          <Card key={mina.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
                onClick={() => toggleMina(mina.id)}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Mountain className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{mina.nombre}</h3>
                    <p className="text-sm text-muted-foreground">Saldo: {formatCurrency(mina.saldo || "0")}</p>
                  </div>
                </div>
                <Badge variant={parseFloat(mina.saldo || "0") >= 0 ? "default" : "destructive"}>
                  {parseFloat(mina.saldo || "0") >= 0 ? "Al día" : "Pendiente"}
                </Badge>
              </div>

              {expandedMina === mina.id && (
                <div className="border-t bg-gray-50">
                  <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 m-4 mb-0">
                      <TabsTrigger value="viajes">Viajes</TabsTrigger>
                      <TabsTrigger value="transacciones">Transacciones</TabsTrigger>
                      <TabsTrigger value="balance">Balance</TabsTrigger>
                    </TabsList>

                    <TabsContent value="transacciones" className="p-4">
                      <MinaTransactions minaId={mina.id} />
                    </TabsContent>

                    <TabsContent value="viajes" className="p-4">
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">Contenido de viajes</p>
                      </div>
                    </TabsContent>

                    <TabsContent value="balance" className="p-4">
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">Contenido de balance</p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Componente separado para las transacciones de una mina
function MinaTransactions({ minaId }: { minaId: number }) {
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<any>(null);

  const { data: transacciones = [] } = useQuery({
    queryKey: [`/api/transacciones/socio/mina/${minaId}`],
  });

  const handleEdit = (transaction: any) => {
    console.log('✅ EDITAR TRANSACCIÓN:', transaction.id);
    setEditingTransaction(transaction);
  };

  const handleDelete = (transaction: any) => {
    console.log('🗑️ ELIMINAR TRANSACCIÓN:', transaction.id);
    setDeletingTransaction(transaction);
  };

  if (!Array.isArray(transacciones) || transacciones.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground text-sm">No hay transacciones registradas para esta mina</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">FECHA</TableHead>
            <TableHead className="text-xs">CONCEPTO</TableHead>
            <TableHead className="text-xs">VALOR</TableHead>
            <TableHead className="text-xs">OBSERVACIONES</TableHead>
            <TableHead className="text-xs w-20">ACCIONES</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transacciones.map((transaccion: any) => (
            <TableRow key={transaccion.id}>
              <TableCell className="text-xs">{formatDate(transaccion.fecha)}</TableCell>
              <TableCell className="text-xs">{transaccion.concepto}</TableCell>
              <TableCell className={`font-semibold text-xs ${
                (transaccion.concepto === "Pago" || transaccion.concepto === "Adelanto") ? "text-red-600" : 
                (transaccion.concepto === "Saldo a Favor" || transaccion.concepto.startsWith("Viaje")) ? "text-green-600" : 
                "text-foreground"
              }`}>
                {(transaccion.concepto === "Pago" || transaccion.concepto === "Adelanto") ? '-' : '+'}
                {formatCurrency(transaccion.valor)}
              </TableCell>
              <TableCell className="text-xs">{transaccion.comentario || "-"}</TableCell>
              <TableCell className="text-xs">
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-blue-100"
                    onClick={() => handleEdit(transaccion)}
                    title="Editar transacción"
                  >
                    <Edit className="h-3 w-3 text-blue-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-red-100"
                    onClick={() => handleDelete(transaccion)}
                    title="Eliminar transacción"
                  >
                    <Trash2 className="h-3 w-3 text-red-600" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Modales de editar/eliminar */}
      {editingTransaction && (
        <Dialog open={!!editingTransaction} onOpenChange={() => setEditingTransaction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Transacción #{editingTransaction.id}</DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <p>Modal de edición de transacción aquí</p>
              <p>Concepto: {editingTransaction.concepto}</p>
              <p>Valor: {formatCurrency(editingTransaction.valor)}</p>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {deletingTransaction && (
        <Dialog open={!!deletingTransaction} onOpenChange={() => setDeletingTransaction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Eliminar Transacción #{deletingTransaction.id}</DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <p>¿Estás seguro de que quieres eliminar esta transacción?</p>
              <p>Concepto: {deletingTransaction.concepto}</p>
              <p>Valor: {formatCurrency(deletingTransaction.valor)}</p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}