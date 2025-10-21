import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ConsumoAutomaticoRow } from "../types";

type ConsumoAutomaticoCardProps = {
  zonaNombre: string;
  rows: ConsumoAutomaticoRow[];
  loading: boolean;
};

export function ConsumoAutomaticoCard({
  zonaNombre,
  rows,
  loading,
}: ConsumoAutomaticoCardProps) {
  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-xl font-semibold">
            Consumo automático reservado
          </CardTitle>
          <CardDescription>
            Stock reservado para consumo programado en {zonaNombre}.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando reservas…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay stock reservado para el consumo automático en esta zona.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Stock reservado</TableHead>
                <TableHead>Consumo diario</TableHead>
                <TableHead>Cobertura</TableHead>
                <TableHead>Actualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const stockUnidad =
                  row.unidad === "unidad" ? "unid." : "bultos";
                const consumoUnidad = row.unidad === "unidad" ? "unid." : "kg";
                const stockTexto =
                  row.unidad === "unidad"
                    ? `${row.stock.toLocaleString("es-AR", {
                        maximumFractionDigits: 2,
                      })} ${stockUnidad}`
                    : `${row.stockKg.toLocaleString("es-AR", {
                        maximumFractionDigits: 2,
                      })} kg`;
                const consumoTexto = (() => {
                  if (row.unidad === "unidad" && row.consumoDiario) {
                    return `${row.consumoDiario.toLocaleString("es-AR", {
                      maximumFractionDigits: 2,
                    })} ${consumoUnidad}`;
                  }
                  if (row.consumoDiarioKg) {
                    return `${row.consumoDiarioKg.toLocaleString("es-AR", {
                      maximumFractionDigits: 2,
                    })} ${consumoUnidad}`;
                  }
                  return "-";
                })();

                const coberturaTexto = (() => {
                  if (row.cobertura == null) return "-";
                  if (row.hasta) {
                    return `${row.cobertura} días (hasta ${row.hasta})`;
                  }
                  return `${row.cobertura} días`;
                })();

                const actualizado = row.updatedAt
                  ? new Date(row.updatedAt).toLocaleString("es-AR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : "-";

                return (
                  <TableRow key={row.material_id}>
                    <TableCell className="font-medium">{row.nombre}</TableCell>
                    <TableCell>{stockTexto}</TableCell>
                    <TableCell>{consumoTexto}</TableCell>
                    <TableCell>{coberturaTexto}</TableCell>
                    <TableCell>{actualizado}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
