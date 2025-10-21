"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCcw, Play, Clock } from "lucide-react";
import { calcularConsumoDiarioKg } from "@/lib/consumo";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  consumo_config_kg: number | null;
  presentacion_kg_por_bulto: number | null;
  consumo_diario_unidad: number | null;
  cobertura_real_fecha: string | null;
  cobertura_real_dias: number | null;
  cobertura_teorica_fecha: string | null;
  cobertura_teorica_dias: number | null;
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

function calcularConsumoDiarioPorUnidad(
  consumoKg: number | null,
  unidad: Unidad,
  presentacionKgPorBulto: number | null
) {
  if (!consumoKg || consumoKg <= 0) return null;

  if (unidad === "bulto") {
    if (!presentacionKgPorBulto || presentacionKgPorBulto <= 0) {
      return null;
    }
    return consumoKg / presentacionKgPorBulto;
  }

  return consumoKg;
}

function sumarDiasCalendario(fechaBase: string, dias: number) {
  const fecha = new Date(`${fechaBase}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime())) {
    return null;
  }
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function calcularCoberturaDesdeStock(
  fechaBase: string | null,
  stockDisponible: number,
  consumoDiario: number | null
) {
  if (!consumoDiario || consumoDiario <= 0) {
    return { fecha: null as string | null, dias: null as number | null };
  }

  const stockNormalizado = Number.isFinite(stockDisponible)
    ? Math.max(0, stockDisponible)
    : 0;
  const diasEstimados = stockNormalizado / consumoDiario;
  const diasEnteros = Number.isFinite(diasEstimados)
    ? Math.floor(diasEstimados)
    : null;

  if (!fechaBase || diasEnteros == null) {
    return { fecha: null, dias: diasEnteros };
  }

  const fechaCobertura = sumarDiasCalendario(fechaBase, diasEnteros);

  return { fecha: fechaCobertura, dias: diasEnteros };
}

function formatCobertura(fechaISO: string | null, dias: number | null) {
  if (!fechaISO && dias == null) {
    return "Sin consumo configurado";
  }

  const partes: string[] = [];

  if (fechaISO) {
    partes.push(`Hasta ${safeFormatDate(fechaISO)}`);
  }

  if (dias != null) {
    partes.push(
      `(${fmtNum(dias)} ${dias === 1 ? "día" : "días"} de cobertura)`
    );
  }

  if (!partes.length) {
    return "Sin fecha base";
  }

  return partes.join(" ");
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
  const [materialEnEdicion, setMaterialEnEdicion] = useState<Row | null>(null);
  const [consumoKgInput, setConsumoKgInput] = useState("");
  const [consumoBultosInput, setConsumoBultosInput] = useState("");
  const [actualizandoConsumo, setActualizandoConsumo] = useState(false);
  const [consumoError, setConsumoError] = useState<string | null>(null);

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
      const stockPromise = fetch("/api/inventario", {
        cache: "no-store",
      }).then(async (response) => {
        let payload: unknown = null;
        try {
          payload = await response.json();
        } catch (error) {
          console.error("Error parseando inventario_actual", error);
        }

        if (!response.ok) {
          const message =
            payload &&
            typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error: string }).error ??
                "No se pudo obtener el inventario actual."
              : "No se pudo obtener el inventario actual.";
          throw new Error(message);
        }

        if (!Array.isArray(payload)) {
          throw new Error("Respuesta de inventario inválida.");
        }

        return payload as InventarioActualRow[];
      });

      const [zonasRes, stockData, autoRes] = await Promise.all([
        supabase
          .from("zonas")
          .select("id, nombre")
          .eq("activo", true)
          .order("nombre")
          .returns<Zona[]>(),
        stockPromise,
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

      stockData.forEach((stock: InventarioActualRow) => {
        stockIndex.set(`${stock.zona_id}-${stock.material_id}`, stock);
      });

      const registros = (autoRes.data ?? []).map<Row>((item) => {
        const stock = stockIndex.get(`${item.zona_id}-${item.material_id}`);
        const unidad = (item.materiales?.unidad_medida ??
          stock?.unidad_medida ??
          "bulto") as Unidad;
        const stockReal = obtenerStockReal(stock, unidad);
        const consumoAuto = Number(item.bultos ?? 0);
        const stockTeorico = stockReal - consumoAuto;
        const diferencia = stockReal - stockTeorico;
        const fechaISO =
          typeof item.fecha === "string" ? item.fecha.slice(0, 10) : "";
        const fechaDisplay = safeFormatDate(item.fecha);
        const timestamp = new Date(item.fecha).getTime();
        const consumoConfigKg = calcularConsumoDiarioKg({
          nombre: stock?.nombre ?? item.materiales?.nombre ?? null,
          unidad_medida:
            (stock?.unidad_medida as Unidad | undefined) ??
            (item.materiales?.unidad_medida as Unidad | undefined) ??
            null,
          presentacion_kg_por_bulto:
            stock?.presentacion_kg_por_bulto ??
            item.materiales?.presentacion_kg_por_bulto ??
            null,
          tasa_consumo_diaria_kg: stock?.tasa_consumo_diaria_kg ?? null,
        });
        const presentacionKgPorBulto =
          item.materiales?.presentacion_kg_por_bulto ??
          stock?.presentacion_kg_por_bulto ??
          null;

        const consumoDiarioUnidad = calcularConsumoDiarioPorUnidad(
          consumoConfigKg,
          unidad,
          presentacionKgPorBulto
        );
        const { fecha: coberturaRealFecha, dias: coberturaRealDias } =
          calcularCoberturaDesdeStock(
            fechaISO || null,
            stockReal,
            consumoDiarioUnidad
          );
        const { fecha: coberturaTeoricaFecha, dias: coberturaTeoricaDias } =
          calcularCoberturaDesdeStock(
            fechaISO || null,
            stockTeorico,
            consumoDiarioUnidad
          );

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
          consumo_config_kg: consumoConfigKg,
          presentacion_kg_por_bulto: presentacionKgPorBulto,
          consumo_diario_unidad: consumoDiarioUnidad,
          cobertura_real_fecha: coberturaRealFecha,
          cobertura_real_dias: coberturaRealDias,
          cobertura_teorica_fecha: coberturaTeoricaFecha,
          cobertura_teorica_dias: coberturaTeoricaDias,
        };
      });

      registros.sort((a, b) => b.timestamp - a.timestamp);
      const registrosUnicos: Row[] = [];
      const combinacionesVistas = new Set<string>();

      for (const registro of registros) {
        const llave = `${registro.zona_id}-${registro.material_id}`;
        if (combinacionesVistas.has(llave)) {
          continue;
        }
        combinacionesVistas.add(llave);
        registrosUnicos.push(registro);
      }

      setRows(registrosUnicos);
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

  const cerrarDialogoConsumo = useCallback(() => {
    setMaterialEnEdicion(null);
    setConsumoKgInput("");
    setConsumoBultosInput("");
    setConsumoError(null);
  }, []);

  const abrirDialogoConsumo = useCallback((row: Row) => {
    const kg = row.consumo_config_kg;
    if (kg !== null && Number.isFinite(kg)) {
      const normalizado = Math.round(kg * 1e4) / 1e4;
      setConsumoKgInput(normalizado.toString());
    } else {
      setConsumoKgInput("");
    }

    const presentacion = row.presentacion_kg_por_bulto;
    if (
      presentacion !== null &&
      presentacion > 0 &&
      kg !== null &&
      Number.isFinite(kg)
    ) {
      const bultos = kg / presentacion;
      setConsumoBultosInput((Math.round(bultos * 1e4) / 1e4).toString());
    } else {
      setConsumoBultosInput("");
    }

    setConsumoError(null);
    setMaterialEnEdicion(row);
  }, []);

  const manejarCambioKg = useCallback(
    (value: string) => {
      setConsumoKgInput(value);
      if (!materialEnEdicion) return;
      const presentacion = materialEnEdicion.presentacion_kg_por_bulto;
      if (!presentacion || presentacion <= 0) return;
      const parsed = Number.parseFloat(value.replace(",", "."));
      if (Number.isNaN(parsed)) {
        if (value.trim() === "") {
          setConsumoBultosInput("");
        }
        return;
      }
      const bultos = parsed / presentacion;
      setConsumoBultosInput((Math.round(bultos * 1e4) / 1e4).toString());
    },
    [materialEnEdicion]
  );

  const manejarCambioBultos = useCallback(
    (value: string) => {
      setConsumoBultosInput(value);
      if (!materialEnEdicion) return;
      const presentacion = materialEnEdicion.presentacion_kg_por_bulto;
      if (!presentacion || presentacion <= 0) return;
      const parsed = Number.parseFloat(value.replace(",", "."));
      if (Number.isNaN(parsed)) {
        if (value.trim() === "") {
          setConsumoKgInput("");
        }
        return;
      }
      const kg = parsed * presentacion;
      setConsumoKgInput((Math.round(kg * 1e4) / 1e4).toString());
    },
    [materialEnEdicion]
  );

  const guardarConsumoAutomatico = useCallback(async () => {
    if (!materialEnEdicion) return;

    const rawKg = consumoKgInput.trim();
    const parsedKg =
      rawKg === "" ? null : Number.parseFloat(rawKg.replace(",", "."));

    if (parsedKg !== null) {
      if (Number.isNaN(parsedKg) || parsedKg < 0) {
        setConsumoError("Ingresa un valor válido en kg (mayor o igual a 0).");
        return;
      }
    }

    const valorKg = parsedKg === null ? null : Math.round(parsedKg * 1e4) / 1e4;

    setActualizandoConsumo(true);
    setConsumoError(null);

    try {
      const { error: supabaseError } = await supabase
        .from("materiales")
        .update({ tasa_consumo_diaria_kg: valorKg })
        .eq("id", materialEnEdicion.material_id);

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      setFeedback({
        type: "success",
        message: `Consumo automático actualizado para ${materialEnEdicion.material_nombre}.`,
      });

      cerrarDialogoConsumo();
      await cargarDatos();
    } catch (err) {
      console.error("Error actualizando consumo automático", err);
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo actualizar el consumo automático.";
      setConsumoError(message);
    } finally {
      setActualizandoConsumo(false);
    }
  }, [
    materialEnEdicion,
    consumoKgInput,
    cerrarDialogoConsumo,
    cargarDatos,
    setFeedback,
  ]);

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
                        <th className="px-4 py-3 font-semibold">
                          Cobertura (stock real)
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          Cobertura (stock teórico)
                        </th>
                        <th className="px-4 py-3 font-semibold text-center">
                          Estado
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Configurar
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={10} className="py-10 text-center">
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
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatCobertura(
                                fila.cobertura_real_fecha,
                                fila.cobertura_real_dias
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatCobertura(
                                fila.cobertura_teorica_fecha,
                                fila.cobertura_teorica_dias
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {fila.diferencia >= 0
                                ? "🟢"
                                : fila.diferencia > -5
                                ? "🟡"
                                : "🔴"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => abrirDialogoConsumo(fila)}
                              >
                                Cambiar
                              </Button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={8}
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
                            <td className="px-4 py-3" />
                          </tr>
                        ) : (
                          <tr>
                            <td
                              colSpan={8}
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
      <Dialog
        open={Boolean(materialEnEdicion)}
        onOpenChange={(open) => {
          if (!open) {
            if (actualizandoConsumo) return;
            cerrarDialogoConsumo();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar consumo automático</DialogTitle>
            <DialogDescription>
              Ajusta el consumo diario programado para{" "}
              <span className="font-medium">
                {materialEnEdicion?.material_nombre ?? ""}
              </span>
              {materialEnEdicion?.zona_nombre
                ? ` en ${materialEnEdicion.zona_nombre}`
                : ""}
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Consumo diario en kg
              </label>
              <Input
                inputMode="decimal"
                value={consumoKgInput}
                onChange={(event) => manejarCambioKg(event.target.value)}
                placeholder="Ej: 130"
                disabled={actualizandoConsumo}
              />
              <p className="text-xs text-muted-foreground">
                Este valor se guarda en la configuración del material y se
                utilizará en los consumos automáticos.
              </p>
            </div>

            {materialEnEdicion &&
            materialEnEdicion.presentacion_kg_por_bulto &&
            materialEnEdicion.presentacion_kg_por_bulto > 0 ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Consumo diario en bultos
                </label>
                <Input
                  inputMode="decimal"
                  value={consumoBultosInput}
                  onChange={(event) => manejarCambioBultos(event.target.value)}
                  placeholder="Ej: 6.5"
                  disabled={actualizandoConsumo}
                />
                <p className="text-xs text-muted-foreground">
                  Se convierte automáticamente usando{" "}
                  {fmtNum(materialEnEdicion.presentacion_kg_por_bulto)} kg por
                  bulto.
                </p>
              </div>
            ) : null}

            {consumoError ? (
              <p className="text-sm text-red-600">{consumoError}</p>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={cerrarDialogoConsumo}
              disabled={actualizandoConsumo}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void guardarConsumoAutomatico()}
              disabled={actualizandoConsumo}
            >
              {actualizandoConsumo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function obtenerStockReal(
  stock: InventarioActualRow | undefined,
  unidad: Unidad
) {
  if (!stock) return 0;

  const parseValor = (valor: unknown) => {
    if (valor === null || typeof valor === "undefined") return null;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  };

  const seleccionarValor = (
    campos: (keyof InventarioActualRow)[]
  ): number | null => {
    for (const campo of campos) {
      const numero = parseValor(stock[campo]);
      if (numero !== null && numero !== 0) {
        return numero;
      }
    }

    for (const campo of campos) {
      const numero = parseValor(stock[campo]);
      if (numero !== null) {
        return numero;
      }
    }

    return null;
  };

  switch (unidad) {
    case "litro":
      return Number(stock.stock_kg ?? 0);
    case "unidad":
      return Number(stock.stock ?? stock.stock_bultos ?? 0);
    case "litro": {
      const valor = seleccionarValor(["stock", "stock_kg", "stock_bultos"]);
      return valor ?? 0;
    }
    case "unidad": {
      const valor = seleccionarValor(["stock", "stock_bultos", "stock_kg"]);
      return valor ?? 0;
    }
    case "bulto":
    default: {
      const valor = seleccionarValor(["stock_bultos", "stock", "stock_kg"]);
      return valor ?? 0;
    }
  }
}
