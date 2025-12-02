import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import type { TransaccionWithSocio } from "@shared/schema";

interface TransactionActionsProps {
  transaction: TransaccionWithSocio;
  onEdit: (transaction: TransaccionWithSocio) => void;
  onDelete: (transaction: TransaccionWithSocio) => void;
}

export default function TransactionActions({ transaction, onEdit, onDelete }: TransactionActionsProps) {
  return (
    <div className="flex space-x-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 hover:bg-blue-100"
        onClick={() => onEdit(transaction)}
        title="Editar transacción"
      >
        <Edit className="h-3 w-3 text-blue-600" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 hover:bg-red-100"
        onClick={() => onDelete(transaction)}
        title="Eliminar transacción"
      >
        <Trash2 className="h-3 w-3 text-red-600" />
      </Button>
    </div>
  );
}