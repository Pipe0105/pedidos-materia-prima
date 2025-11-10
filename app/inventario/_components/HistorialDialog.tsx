import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

import type { MovimientoInventario } from "../types";

type HistorialDialogProps = {
  open: boolean;
  materialNombre: string;
  movimientos: MovimientoInventario[];
  onClose: () => void;
};

export function HistorialDialog({
  open,
  materialNombre,
  movimientos,
  onClose,
}: HistorialDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-3xl:">
        <DialogHeader>
          <DialogTitle>Historial de movimientos</DialogTitle>
          <DialogDescription>
            {materialNombre
              ? `Movimientos registrados para ${materialNombre}.`
              : "Revisa los movimientos mas recientes del inventario."}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold">Fecha</TableHead>
                <TableHead className="font-semibold">Tipo</TableHead>
                <TableHead className="font-semibold">Bultos</TableHead>
                <TableHead className="font-semibold">Kg</TableHead>
                <TableHead className="font-semibold">Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientos.length ? (
                movimientos.map((movimientos, index) => (
                  <TableRow key={`${movimientos.created_at}-${index}`}>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex flex-col">
                        <span>
                          {new Date(movimientos.created_at).toLocaleString(
                            "es-CO",
                            {
                              dateStyle: "short",
                              timeStyle: "short",
                            }
                          )}
                        </span>
                        {movimientos.dia_proceso ? (
                          <span className="text-xs">
                            Día proceso:{" "}
                            <strong style={{ color: "black" }}>
                              {movimientos.dia_proceso}
                            </strong>
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">
                      {movimientos.tipo}
                    </TableCell>
                    <TableCell>{movimientos.bultos ?? "-"}</TableCell>
                    <TableCell>{movimientos.kg ?? "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {movimientos.notas ?? "sin notas"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    No hay movimientos registrados para este material
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
