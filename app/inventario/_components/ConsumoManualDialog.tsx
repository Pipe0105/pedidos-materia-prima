import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { MaterialConsumo } from "../types";

type ConsumoManualDialogProps = {
  open: boolean;
  material: MaterialConsumo;
  value: string;
  onClose: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function ConsumoManualDialog({
  open,
  material,
  value,
  onClose,
  onChange,
  onSubmit,
}: ConsumoManualDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar consumo manual</DialogTitle>
          <DialogDescription>
            Indica el consumo realizado de {material.nombre}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            ¿Cuanto fue el consumo de hoy? ({material.unidad}
            {material.unidad !== "unidad" ? "s" : ""})
          </label>
          <Input
            type="number"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={`Ingrese cantidad en ${material.unidad}${
              material.unidad !== "unidad" ? "s" : ""
            }`}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSubmit}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
