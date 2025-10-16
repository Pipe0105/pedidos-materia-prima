"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCcw, Play, Info, Clock } from "lucide-react";

import { PageContainer } from "@/components/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fmtNum } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { InventarioActualRow } from "@/app/(dashboard)/_components/_types";

type Unidad = "bulto" | "unidad" | "litro";

type Zona = {
  id: string;
  nombre: string;
};

type ConsumoAutoRecord = {
  fecha: string;
  zona_id: string;
  material_id: string;
  bultos: number | null;
  materiales: {
    nombre: string | null;
    unidad_medida: Unidad | null;
    presentacion_kg_por_bulto: number | null;
  } | null;
  zonas: {
    nombre: string | null;
  } | null;
};

type Row = {
  id: string;
  fechaISO: string;
  fechaDisplay: string;
  timestamp: number;
  material_id: string;
  material_nombre: string;
  unidad_medida: Unidad;
  zona_id: string;
  zona_nombre: string;
  stock_real: number;
  stock_teorico: number;
  consumo_auto: number;
  diferencia: number;
};

type FeedbackState = { type: "success" | "error"; message: string } | null;

const DATE_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
});

const UNIDAD_LABEL: Record<Unidad, { singular: string; plural: string }> = {
  bulto: { singular: "bulto", plural: "bultos" },
  unidad: { singular: "unidad", plural: "unidades" },
  litro: { singular: "litro", plural: "litros" },
};

function formatCantidad(valor: number, unidad: Unidad) {
  const abs = Math.abs(valor);
  const prefix = valor < 0 ? "-" : "";
  const label =
    abs === 1 ? UNIDAD_LABEL[unidad].singular : UNIDAD_LABEL[unidad].plural;
  return `${prefix}${fmtNum(abs)} ${label}`;
}

function formatDiff(valor: number, unidad: Unidad) {
  if (valor === 0) return `0 ${UNIDAD_LABEL[unidad].plural}`;
  const sign = valor > 0 ? "+" : "-";
  const abs = Math.abs(valor);
  const label =
    abs === 1 ? UNIDAD_LABEL[unidad].singular : UNIDAD_LABEL[unidad].plural;
  return `${sign}${fmtNum(abs)} ${label}`;
}

function estadoColor(diff: number) {
  if (diff >= 0) return "text-green-600";
  if (diff < 0 && diff > -5) return "text-yellow-600";
  return "text-red-600";
}

function safeFormatDate(fecha: string) {
  const parsed = new Date(fecha);
  if (Number.isNaN(parsed.getTime())) return fecha;
  return DATE_FORMATTER.format(parsed);
}

export default function ControlPage() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zonaActiva, setZonaActiva] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [fechaObjetivo, setFechaObjetivo] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [horaProgramada, setHoraProgramada] = useState(() => "00:00");
  const [timezone, setTimezone] = useState(() => "America/Bogota");
  const [endpointBase, setEndpointBase] = useState("https://tu-dominio.com");
  const isMounted = useRef(true);
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [zonasRes, stockRes, autoRes] = await Promise.all([
        supabase
          .from("zonas")
          .select("id, nombre")
          .eq("activo", true)
          .order("nombre")
          .returns<Zona[]>(),
        supabase.rpc("get_stock_actual").returns<InventarioActualRow[]>(),
        supabase
          .from("consumo_auto")
          .select(
            "fecha, zona_id, material_id, bultos, materiales(nombre, unidad_medida, presentacion_kg_por_bulto), zonas(nombre)"
          )
          .order("fecha", { ascending: false })
          .returns<ConsumoAutoRecord[]>(),
      ]);

      if (!isMounted.current) return;

      if (zonasRes.error) throw zonasRes.error;
      if (stockRes.error) throw stockRes.error;
      if (autoRes.error) throw autoRes.error;

      const zonasData = zonasRes.data ?? [];
      setZonas(zonasData);
      setZonaActiva((prev) => {
        if (prev && zonasData.some((z) => z.id === prev)) {
          return prev;
        }
        return zonasData[0]?.id ?? null;
      });

      const stockIndex = new Map<string, InventarioActualRow>();
      const stockPayload = stockRes.data;
      if (stockPayload && !Array.isArray(stockPayload)) {
        const rpcMessage =
          typeof stockPayload === "object" &&
          stockPayload !== null &&
          "Error" in stockPayload &&
          typeof stockPayload.Error === "string"
            ? stockPayload.Error
            : null;
        throw new Error(
          rpcMessage ?? "No se pudo obtener el inventario actual."
        );
      }

      const stockData = Array.isArray(stockPayload) ? stockPayload : [];
      stockData.forEach((stock: InventarioActualRow) => {
      stockData.forEach((stock: InventarioActualRow) => {
        stockIndex.set(`${stock.zona_id}-${stock.material_id}`, stock);
      });

      const registros = (autoRes.data ?? []).map<Row>((item) => {
        const unidad = (item.materiales?.unidad_medida ?? "bulto") as Unidad;
        const stock = stockIndex.get(`${item.zona_id}-${item.material_id}`);
        const stockReal = obtenerStockReal(stock, unidad);
        const consumoAuto = Number(item.bultos ?? 0);
        const stockTeorico = stockReal - consumoAuto;
        const diferencia = stockReal - stockTeorico;
        const fechaISO =
          typeof item.fecha === "string" ? item.fecha.slice(0, 10) : "";
        const fechaDisplay = safeFormatDate(item.fecha);
        const timestamp = new Date(item.fecha).getTime();

        return {
          id: `${item.zona_id}-${item.material_id}-${fechaISO}`,
          fechaISO,
          fechaDisplay,
          timestamp: Number.isNaN(timestamp) ? 0 : timestamp,
          material_id: item.material_id,
          material_nombre: item.materiales?.nombre ?? "",
          unidad_medida: unidad,
          zona_id: item.zona_id,
          zona_nombre: item.zonas?.nombre ?? "",
          stock_real: stockReal,
          stock_teorico: stockTeorico,
          consumo_auto: consumoAuto,
          diferencia,
        };
      });

      registros.sort((a, b) => b.timestamp - a.timestamp);
      setRows(registros);
    } catch (err) {
      if (!isMounted.current) return;
      console.error("Error cargando datos de control", err);
      setError("No se pudieron cargar los datos.");
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const storedHour = window.localStorage.getItem("control.auto.hour");
    const storedTz = window.localStorage.getItem("control.auto.tz");
    const resolvedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setHoraProgramada(storedHour ?? "00:00");
    setTimezone(storedTz ?? resolvedTz);
    setEndpointBase(window.location.origin);
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("control.auto.hour", horaProgramada);
  }, [horaProgramada]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("control.auto.tz", timezone);
  }, [timezone]);

  const filasPorZona = useMemo(() => {
    const grouped = new Map<string, Row[]>();
    rows.forEach((row) => {
      const current = grouped.get(row.zona_id) ?? [];
      current.push(row);
      grouped.set(row.zona_id, current);
    });
    return grouped;
  }, [rows]);

  const cronExpresion = useMemo(() => {
    const [hourStr, minuteStr] = horaProgramada.split(":");
    const hour = Number(hourStr ?? "0");
    const minute = Number(minuteStr ?? "0");
    if (Number.isNaN(hour) || Number.isNaN(minute)) return "0 0 * * *";
    return `${minute} ${hour} * * *`;
  }, [horaProgramada]);

  const aplicarConsumoAutomatico = useCallback(async () => {
    if (!zonaActiva) {
      setFeedback({
        type: "error",
        message: "Selecciona una zona para aplicar el consumo.",
      });
      return;
    }

    setAplicando(true);
    setFeedback(null);
    try {
      const params = new URLSearchParams({ zonaId: zonaActiva });
      if (fechaObjetivo) {
        params.set("date", fechaObjetivo);
      }

      const response = await fetch(
        `/inventario/api/consumo/apply?${params.toString()}`,
        {
          method: "POST",
        }
      );

      const payload = await response.json();

      if (!response.ok || payload?.error) {
        throw new Error(
          payload?.error ?? "No se pudo aplicar el consumo automático."
        );
      }

      setFeedback({
        type: "success",
        message: `Consumo automático aplicado para ${
          payload?.zonaId ?? zonaActiva
        } (${payload?.date ?? fechaObjetivo}).`,
      });

      await cargarDatos();
    } catch (err) {
      console.error("Error aplicando consumo automático", err);
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo aplicar el consumo automático.";
      setFeedback({
        type: "error",
        message,
      });
    } finally {
      setAplicando(false);
    }
  }, [zonaActiva, fechaObjetivo, cargarDatos]);

  const zonaActivaValue = zonaActiva ?? zonas[0]?.id ?? "";

  return (
    <PageContainer className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Control de Consumo</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Compara el inventario real (consumos manuales) frente a las
            deducciones automáticas programadas para cada zona y material.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void cargarDatos()}
            disabled={loading}
          >
            <RefreshCcw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Consumo automático diario
          </CardTitle>
          <CardDescription>
            Define la fecha de corte y la hora objetivo del consumo automático.
            Usa este bloque para disparar el proceso manualmente o configurar
            una tarea programada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedback && (
            <div
              className={`rounded-md border px-4 py-3 text-sm ${
                feedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {feedback.message}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-muted-foreground">
                Zona a controlar
              </label>
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                value={zonaActivaValue}
                onChange={(event) => setZonaActiva(event.target.value)}
              >
                {zonas.map((zona) => (
                  <option key={zona.id} value={zona.id}>
                    {zona.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-muted-foreground">
                Fecha de aplicación
              </label>
              <Input
                type="date"
                value={fechaObjetivo}
                onChange={(event) => setFechaObjetivo(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-muted-foreground">
                Hora objetivo (local)
              </label>
              <Input
                type="time"
                value={horaProgramada}
                onChange={(event) => setHoraProgramada(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-muted-foreground">
                Zona horaria
              </label>
              <Input
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                placeholder="America/Bogota"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void aplicarConsumoAutomatico()}
              disabled={aplicando || !zonaActivaValue}
            >
              {aplicando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aplicando…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Aplicar consumo automático ahora
                </>
              )}
            </Button>
            <span className="text-sm text-muted-foreground">
              Se usará la fecha seleccionada como corte para registrar el
              movimiento diario.
            </span>
          </div>

          <div className="space-y-2 rounded-md border border-dashed p-4 text-sm">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <p>
                Programa una tarea (por ejemplo en Vercel Cron o Supabase Edge
                Jobs) que ejecute una petición <code>POST</code> diaria al
                endpoint indicado. Usa la expresión cron
                <code className="ml-1 rounded bg-muted px-2 py-0.5 text-xs">
                  {cronExpresion}
                </code>
                en la zona horaria <strong>{timezone}</strong>.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-muted">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase text-muted-foreground">
                    <th className="px-3 py-2">Zona</th>
                    <th className="px-3 py-2">Endpoint</th>
                  </tr>
                </thead>
                <tbody>
                  {zonas.map((zona) => (
                    <tr key={`endpoint-${zona.id}`} className="text-xs">
                      <td className="px-3 py-2 font-medium">{zona.nombre}</td>
                      <td className="px-3 py-2 font-mono">
                        {endpointBase}/inventario/api/consumo/apply?zonaId=
                        {zona.id}
                      </td>
                    </tr>
                  ))}
                  {zonas.length === 0 && (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-3 py-2 text-center text-muted-foreground"
                      >
                        No hay zonas activas para configurar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {zonas.length ? (
        <Tabs value={zonaActivaValue} onValueChange={setZonaActiva}>
          <TabsList>
            {zonas.map((zona) => (
              <TabsTrigger key={zona.id} value={zona.id}>
                {zona.nombre}
              </TabsTrigger>
            ))}
          </TabsList>

          {zonas.map((zona) => {
            const filas = filasPorZona.get(zona.id) ?? [];
            const totales = filas.reduce(
              (acc, fila) => {
                acc.stockReal += fila.stock_real;
                acc.stockTeorico += fila.stock_teorico;
                acc.consumoAuto += fila.consumo_auto;
                acc.diferencia += fila.diferencia;
                acc.unidades.add(fila.unidad_medida);
                return acc;
              },
              {
                stockReal: 0,
                stockTeorico: 0,
                consumoAuto: 0,
                diferencia: 0,
                unidades: new Set<Unidad>(),
              }
            );
            const unidadTotales =
              filas.length && totales.unidades.size === 1
                ? Array.from(totales.unidades)[0]
                : null;

            return (
              <TabsContent key={zona.id} value={zona.id}>
                <div className="mt-4 overflow-hidden rounded-lg border bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-muted text-sm">
                    <thead className="bg-muted/40">
                      <tr className="text-left">
                        <th className="px-4 py-3 font-semibold">Fecha</th>
                        <th className="px-4 py-3 font-semibold">Material</th>
                        <th className="px-4 py-3 font-semibold">Stock real</th>
                        <th className="px-4 py-3 font-semibold">
                          Consumo automático
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          Stock teórico
                        </th>
                        <th className="px-4 py-3 font-semibold">Diferencia</th>
                        <th className="px-4 py-3 font-semibold text-center">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                          </td>
                        </tr>
                      ) : filas.length ? (
                        filas.map((fila) => (
                          <tr key={fila.id} className="border-t">
                            <td className="px-4 py-3 text-muted-foreground">
                              {fila.fechaDisplay}
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {fila.material_nombre}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatCantidad(
                                fila.stock_real,
                                fila.unidad_medida
                              )}
                            </td>
                            <td className="px-4 py-3 text-blue-600">
                              {formatCantidad(
                                fila.consumo_auto,
                                fila.unidad_medida
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatCantidad(
                                fila.stock_teorico,
                                fila.unidad_medida
                              )}
                            </td>
                            <td
                              className={`px-4 py-3 font-semibold ${estadoColor(
                                fila.diferencia
                              )}`}
                            >
                              {formatDiff(fila.diferencia, fila.unidad_medida)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {fila.diferencia >= 0
                                ? "🟢"
                                : fila.diferencia > -5
                                ? "🟡"
                                : "🔴"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-10 text-center text-sm text-muted-foreground"
                          >
                            No hay registros automáticos para esta zona.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {!loading && filas.length > 0 && (
                      <tfoot className="bg-muted/30 text-sm">
                        {unidadTotales ? (
                          <tr>
                            <td className="px-4 py-3 font-semibold" colSpan={2}>
                              Totales de zona
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              {formatCantidad(totales.stockReal, unidadTotales)}
                            </td>
                            <td className="px-4 py-3 font-semibold text-blue-600">
                              {formatCantidad(
                                totales.consumoAuto,
                                unidadTotales
                              )}
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              {formatCantidad(
                                totales.stockTeorico,
                                unidadTotales
                              )}
                            </td>
                            <td
                              className={`px-4 py-3 font-semibold ${estadoColor(
                                totales.diferencia
                              )}`}
                            >
                              {formatDiff(totales.diferencia, unidadTotales)}
                            </td>
                            <td className="px-4 py-3" />
                          </tr>
                        ) : (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-4 py-3 text-center text-muted-foreground"
                            >
                              No se muestran totales porque la zona mezcla
                              unidades distintas.
                            </td>
                          </tr>
                        )}
                      </tfoot>
                    )}
                  </table>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      ) : !loading ? (
        <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No hay zonas activas configuradas. Crea una zona para comenzar a
          controlar el consumo.
        </div>
      ) : null}
    </PageContainer>
  );
}

function obtenerStockReal(
  stock: InventarioActualRow | undefined,
  unidad: Unidad
) {
  if (!stock) return 0;

  switch (unidad) {
    case "litro":
      return Number(stock.stock_kg ?? 0);
    case "unidad":
      return Number(stock.stock ?? stock.stock_bultos ?? 0);
    case "bulto":
    default:
      return Number(stock.stock_bultos ?? 0);
  }
}
