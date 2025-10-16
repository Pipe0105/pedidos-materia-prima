import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtNum } from "@/lib/format";

import { formatUnidad, obtenerEtiquetaCobertura } from "../utils";
import type { StockRow } from "../types";

type InventarioTableProps = {
  rows: StockRow[];
  loading: boolean;
  mostrarColumnaKg: boolean;
  onVerHistorial: (materialId: string, nombre: string) => void;
  onEditar: (materialId: string, nombre: string, stockKg: number) => void;
  onConsumo: (
    materialId: string,
    nombre: string,
    unidad: StockRow["unidad"]
  ) => void;
  onDeshacerConsumo: (materialId: string) => void;
};

export function InventarioTable({
  rows,
  loading,
  mostrarColumnaKg,
  onVerHistorial,
  onEditar,
  onConsumo,
  onDeshacerConsumo,
}: InventarioTableProps) {
  const renderSkeletonRows = () =>
    Array.from({ length: 5 }).map((_, index) => (
      <TableRow key={`skeleton-${index}`}>
        <TableCell>
          <Skeleton className="h-5 w-40 bg-slate-200" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-5 w-32 bg-slate-200" />
        </TableCell>
        {mostrarColumnaKg && (
          <TableCell>
            <Skeleton className="h-5 w-24 bg-slate-200" />
          </TableCell>
        )}
        <TableCell>
          <Skeleton className="h-5 w-24 bg-slate-200" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-5 w-24 bg-slate-200" />
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <Skeleton className="h-8 w-20 bg-slate-200" />
            <Skeleton className="h-8 w-20 bg-slate-200" />
          </div>
        </TableCell>
      </TableRow>
    ));

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-50">
          <TableHead className="font-semibold">Material</TableHead>
          <TableHead className="font-semibold">Stock</TableHead>
          {mostrarColumnaKg && (
            <TableHead className="font-semibold">Stock (kg)</TableHead>
          )}
          <TableHead className="font-semibold">Cobertura estimada</TableHead>
          <TableHead className="font-semibold">Estado</TableHead>
          <TableHead className="text-right font-semibold">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          renderSkeletonRows()
        ) : rows.length ? (
          rows.map((row) => {
            const { estilo, texto } = obtenerEtiquetaCobertura(row.cobertura);
            return (
              <TableRow key={row.material_id}>
                <TableCell className="font-medium">{row.nombre}</TableCell>
                <TableCell>{formatUnidad(row.stock, row.unidad)}</TableCell>
                {mostrarColumnaKg && (
                  <TableCell>
                    {row.unidad === "unidad"
                      ? "—"
                      : `${fmtNum(row.stockKg)} kg`}
                  </TableCell>
                )}
                <TableCell className="text-sm text-muted-foreground">
                  {row.hasta
                    ? `Hasta ${new Date(row.hasta).toLocaleDateString("es-AR")}`
                    : "Sin estimación"}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${estilo}`}
                  >
                    {texto}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onVerHistorial(row.material_id, row.nombre)
                      }
                    >
                      Historial
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onEditar(row.material_id, row.nombre, row.stockKg)
                      }
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onConsumo(row.material_id, row.nombre, row.unidad)
                      }
                    >
                      Consumo manual
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-600"
                      onClick={() => onDeshacerConsumo(row.material_id)}
                    >
                      Deshacer consumo
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        ) : (
          <TableRow>
            <TableCell
              colSpan={mostrarColumnaKg ? 6 : 5}
              className="py-12 text-center text-sm text-muted-foreground"
            >
              No hay materiales registrados para esta zona.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
