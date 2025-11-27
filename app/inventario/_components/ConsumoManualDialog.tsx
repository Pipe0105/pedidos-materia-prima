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
import { Textarea } from "@/components/ui/textarea";

import type { MaterialConsumo } from "../types";

type ConsumoManualDialogProps = {
  open: boolean;
  material: MaterialConsumo;
  value: string;
  selectedDay: string;
  disabledDays?: string[];
  notesValue?: string;
  notesLabel?: string;
  notesPlaceholder?: string;
  onClose: () => void;
  onChange: (value: string) => void;
  onDayChange: (day: string) => void;
  onNotesChange?: (notes: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
};

export function ConsumoManualDialog({
  open,
  material,
  value,
  selectedDay,
  disabledDays = [],
  notesValue,
  notesLabel,
  notesPlaceholder,
  onClose,
  onChange,
  onDayChange,
  onNotesChange,
  onSubmit,
  submitting = false,
}: ConsumoManualDialogProps) {
  const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const hoy = new Date();
  const indiceHoyNormalizado = Math.min(
    (hoy.getDay() + 6) % 7,
    dias.length - 1
  );
  const diasDisponibles = dias.filter(
    (_, index) => index <= indiceHoyNormalizado
  );
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
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Selecciona el día del proceso
          </label>
          <div className="flex flex-wrap gap-2">
            {diasDisponibles.map((dia) => {
              const estaDeshabilitado = disabledDays.includes(dia);
              return (
                <Button
                  key={dia}
                  type="button"
                  variant={dia === selectedDay ? "default" : "outline"}
                  className={`min-w-[110px] border transition focus-visible:ring-2 focus-visible:ring-primary/40
                    focus-visible:ring-offset-2 ${
                      dia === selectedDay
                        ? "border-primary bg-primary/10 text-primary"
                        : ""
                    }`}
                  disabled={estaDeshabilitado}
                  onClick={() => onDayChange(dia)}
                >
                  {dia}
                </Button>
              );
            })}
          </div>
        </div>
        {onNotesChange && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {notesLabel ?? "Notas"}
            </label>
            <Textarea
              value={notesValue ?? ""}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder={notesPlaceholder ?? "Agregar notas u observaciones"}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
