"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";

import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/components/toastprovider";
import { fmtDate, fmtNum } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import {
  COBERTURA_ALERTA,
  COBERTURA_CRITICA,
  agruparCobertura,
  obtenerNivelCobertura,
} from "@/lib/cobertura";
import { cn } from "@/lib/utils";

type Pedido = {
  id: string;
  fecha_pedido: string;
  fecha_entrega: string | null;
  solicitante: string | null;
  estado: "borrador" | "enviado" | "recibido" | "completado";
  total_bultos?: number | null;
  total_kg?: number | null;
};

type MaterialRow = {
  id: string;
  nombre: string;
  cobertura: number | null;
};

type CoberturaPayload = {
  id: string;
  nombre: string;
  cobertura: number | null;
};

type MaterialConConsumo = {
  id: string;
  nombre: string;
  tasa_consumo_diaria_kg: number | null;
  unidad_medida: "bulto" | "unidad" | "litro" | null;
  presentacion_kg_por_bulto: number | null;
};

const ESTADO_LABEL: Record<Pedido["estado"], string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  recibido: "Recibido",
  completado: "Completado",
};

const ESTADO_TONO: Record<Pedido["estado"], string> = {
  borrador: "bg-slate-100 text-slate-700 border border-slate-200",
  enviado: "bg-[#1F4F9C]/10 text-[#1F4F9C] border border-[#1F4F9C]/20",
  recibido: "bg-[#29B8A6]/10 text-[#1F4F9C] border border-[#29B8A6]/20",
  completado: "bg-[#29B8A6] text-white border border-[#29B8A6]",
};

const COBERTURA_TONO: Record<
  NonNullable<ReturnType<typeof obtenerNivelCobertura>>,
  {
    badge: string;
    accent: string;
    label: string;
    description: string;
  }
> = {
  critico: {
    badge: "bg-[#FF6B5A]/15 text-[#FF6B5A] border border-[#FF6B5A]/30",
    accent: "bg-[#FF6B5A]",
    label: "Crítico",
    description: `Menos de ${COBERTURA_CRITICA} días de stock`,
  },
  alerta: {
    badge: "bg-[#F5A623]/15 text-[#B45309] border border-[#F5A623]/30",
    accent: "bg-[#F5A623]",
    label: "En alerta",
    description: `Entre ${COBERTURA_CRITICA} y ${COBERTURA_ALERTA} días`,
  },
  seguro: {
    badge: "bg-[#29B8A6]/15 text-[#0F766E] border border-[#29B8A6]/20",
    accent: "bg-[#29B8A6]",
    label: "Seguro",
    description: `Más de ${COBERTURA_ALERTA} días cubiertos`,
  },
};

function initialsFromName(nombre: string | null) {
  if (!nombre) return "—";
  const parts = nombre.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "—";
}

export default function HomePage() {
  const { notify } = useToast();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [materialesConCobertura, setMaterialesConCobertura] = useState<
    MaterialRow[]
  >([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pedidosLoading, setPedidosLoading] = useState(true);
  const [inventarioLoading, setInventarioLoading] = useState(true);
  const [pedidosError, setPedidosError] = useState<string | null>(null);
  const [inventarioError, setInventarioError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const prevCriticos = useRef(0);
  const hasMounted = useRef(false);

  const cargarPedidos = useCallback(async () => {
    setPedidosLoading(true);
    setPedidosError(null);
    const { data, error } = await supabase
      .from("pedidos")
      .select(
        "id,fecha_pedido,fecha_entrega,solicitante,estado,total_bultos,total_kg"
      )
      .eq("estado", "enviado")
      .order("fecha_pedido", { ascending: false })
      .limit(5);

    if (error) {
      setPedidosError(error.message);
      notify("No pudimos cargar los pedidos pendientes", "error");
    }

    setPedidos(data ?? []);
    setPedidosLoading(false);
  }, [notify]);

  const cargarInventario = useCallback(async () => {
    setInventarioLoading(true);
    setInventarioError(null);

    const [{ data: mats, error: matsError }, { data: movs, error: movsError }] =
      await Promise.all([
        supabase.from("materiales").select("id,nombre,tasa_consumo_diaria_kg"),
        supabase.from("movimientos_inventario").select("material_id,kg,tipo"),
      ]);

    if (matsError || movsError) {
      setInventarioError(matsError?.message ?? movsError?.message ?? null);
      notify("No pudimos calcular la cobertura de inventario", "error");
    }

    const stock: Record<string, number> = {};
    (movs ?? []).forEach((mv) => {
      const mult = mv.tipo === "entrada" ? 1 : mv.tipo === "salida" ? -1 : 1;
      stock[mv.material_id] =
        (stock[mv.material_id] ?? 0) + Number(mv.kg) * mult;
    });

    const materiales =
      mats
        ?.map((m) => {
          const s = stock[m.id] ?? 0;
          const cobertura =
            m.tasa_consumo_diaria_kg && m.tasa_consumo_diaria_kg > 0
              ? s / m.tasa_consumo_diaria_kg
              : null;
          return { id: m.id, nombre: m.nombre, cobertura };
        })
        .filter((m) => m.cobertura !== null) ?? [];

    setMaterialesConCobertura(materiales);
    setInventarioLoading(false);
  }, [notify]);

  const cargarDashboard = useCallback(async () => {
    await Promise.all([cargarPedidos(), cargarInventario()]);
    setLastUpdated(new Date());
  }, [cargarPedidos, cargarInventario]);

  async function marcarCompletado(id: string) {
    const pedido = pedidos.find((p) => p.id === id);
    const confirmMessage = pedido
      ? `¿Confirmas completar el pedido #${pedido.id}?`
      : "¿Confirmas completar este pedido?";
    if (typeof window !== "undefined" && !window.confirm(confirmMessage)) {
      return;
    }
    const { error } = await supabase
      .from("pedidos")
      .update({ estado: "completado" })
      .eq("id", id);

    if (error) {
      notify("Error al completar pedido: " + error.message, "error");
    } else {
      // en el home solo muestras pedidos pendientes (estado=enviado)
      setPedidos((prev) => prev.filter((p) => p.id !== id));
      await cargarPedidos();
      setLastUpdated(new Date());
      notify("Pedido completado ✅", "success");
    }
  }

  useEffect(() => {
    void cargarDashboard();
  }, [cargarDashboard]);

  const resumenCobertura = useMemo(() => {
    return agruparCobertura<CoberturaPayload>(
      materialesConCobertura.map((m) => ({
        cobertura: m.cobertura,
        payload: m,
      }))
    );
  }, [materialesConCobertura]);

  useEffect(() => {
    const totalAlertas =
      resumenCobertura.critico.length + resumenCobertura.alerta.length;
    setUnreadCount(totalAlertas);

    const nuevosCriticos = resumenCobertura.critico.length;
    if (hasMounted.current && nuevosCriticos > prevCriticos.current) {
      notify("Se detectaron nuevos materiales en nivel crítico", "warning");
    }
    prevCriticos.current = nuevosCriticos;
    hasMounted.current = true;
  }, [notify, resumenCobertura.alerta.length, resumenCobertura.critico.length]);

  const criticos = resumenCobertura.critico
    .map((item) => item.payload)
    .filter(Boolean) as MaterialRow[];
  const alerta = resumenCobertura.alerta
    .map((item) => item.payload)
    .filter(Boolean) as MaterialRow[];
  const seguros = resumenCobertura.seguro
    .map((item) => item.payload)
    .filter(Boolean) as MaterialRow[];

  const resumenCards = [
    {
      key: "critico",
      value: criticos.length,
      tone: COBERTURA_TONO.critico,
      gradient: "from-[#FF6B5A]/90 via-[#FF6B5A]/60 to-[#FF6B5A]/30",
    },
    {
      key: "alerta",
      value: alerta.length,
      tone: COBERTURA_TONO.alerta,
      gradient: "from-[#F5A623]/90 via-[#F5A623]/60 to-[#F5A623]/30",
    },
    {
      key: "seguro",
      value: seguros.length,
      tone: COBERTURA_TONO.seguro,
      gradient: "from-[#29B8A6]/80 via-[#29B8A6]/50 to-[#1F4F9C]/30",
    },
  ];

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      {/* Header con campana */}
      <header className="flex flex-col gap-6 rounded-2xl border bg-gradient-to-r from-[#1F4F9C] via-[#1F4F9C]/90 to-[#29B8A6]/80 p-6 text-white shadow-lg lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-white/80">
            Mercamio
          </p>
          <h1 className="text-3xl font-semibold">Panel de abastecimiento</h1>
          <p className="text-sm text-white/80">
            {lastUpdated
              ? `Actualizado ${fmtDate(
                  lastUpdated
                )} a las ${lastUpdated.toLocaleTimeString("es-CO", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "Sincronizando datos..."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="secondary"
            className="bg-white/15 text-white hover:bg-white/25"
          >
            <Link href="/inventario">Ver inventario</Link>
          </Button>
          <Button
            onClick={() => void cargarDashboard()}
            className="bg-white text-[#1F4F9C] hover:bg-white/90"
            disabled={pedidosLoading || inventarioLoading}
          >
            {pedidosLoading || inventarioLoading ? (
              <span className="flex items-center gap-2 text-[#1F4F9C]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Actualizando
              </span>
            ) : (
              "Actualizar"
            )}
          </Button>
          <div className="relative">
            <Button
              variant="secondary"
              size="icon"
              className={cn(
                "rounded-full border border-white/40 bg-white/20 text-white transition",
                (unreadCount > 0 || resumenCobertura.critico.length > 0) &&
                  "border-[#FF6B5A]/70 bg-[#FF6B5A]/15 text-white animate-[pulse_2s_ease-in-out_infinite]"
              )}
              onClick={() => {
                setNotifOpen((prev) => !prev);
                if (!notifOpen) setUnreadCount(0);
              }}
              aria-label="Abrir panel de alertas"
            >
              <Bell className="h-5 w-5" />
            </Button>
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#FF6B5A] text-xs font-semibold text-white shadow-lg">
                {unreadCount}
              </span>
            )}
            <span className="sr-only" aria-live="polite">
              {unreadCount} alertas sin leer
            </span>
            {notifOpen && (
              <aside className="absolute right-0 top-14 z-20 w-96 overflow-hidden rounded-2xl border border-[#1F4F9C]/20 bg-white text-slate-900 shadow-2xl">
                <header className="bg-gradient-to-r from-[#1F4F9C]/90 to-[#5169a5] p-4 text-white">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <AlertTriangle className="h-5 w-5" /> Alertas de inventario
                  </h2>
                  <p className="text-xs text-white/80">
                    Prioriza los materiales críticos para evitar quiebres de
                    stock.
                  </p>
                </header>
                <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                  {["critico", "alerta", "seguro"].map((nivel) => {
                    const items =
                      nivel === "critico"
                        ? criticos
                        : nivel === "alerta"
                        ? alerta
                        : seguros;
                    const tone =
                      COBERTURA_TONO[nivel as keyof typeof COBERTURA_TONO];
                    return (
                      <section key={nivel} className="bg-white/80">
                        <div className="flex items-start gap-3 p-4">
                          <span
                            className={cn(
                              "mt-1 h-10 w-1 rounded-full",
                              tone.accent
                            )}
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold">
                                {tone.label}
                              </p>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-xs font-medium shadow-sm",
                                  tone.badge
                                )}
                              >
                                {tone.description}
                              </span>
                            </div>
                            {items.length ? (
                              <ul className="space-y-2">
                                {items.map((m) => (
                                  <li
                                    key={m.id}
                                    className="rounded-xl border border-slate-100 bg-white/90 px-3 py-2 shadow-sm transition hover:border-[#1F4F9C]/30 hover:shadow-md"
                                  >
                                    <p className="text-sm font-medium text-slate-900">
                                      {m.nombre}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {fmtNum(m.cobertura ?? 0)} días de
                                      cobertura
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                                <CheckCircle2 className="h-4 w-4" /> Sin
                                elementos en esta categoría
                              </p>
                            )}
                          </div>
                        </div>
                      </section>
                    );
                  })}
                </div>
                <footer className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/80 p-4">
                  <Button
                    asChild
                    className="flex-1 bg-[#FF6B5A] text-white hover:bg-[#FF6B5A]/90"
                  >
                    <Link href="/pedidos/nuevo">Crear pedido urgente</Link>
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-slate-600 hover:text-slate-900"
                    onClick={() => setNotifOpen(false)}
                  >
                    Cerrar
                  </Button>
                </footer>
              </aside>
            )}
          </div>
        </div>
      </header>

      {/* Resumen global de inventario */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Estado de cobertura
            </h2>
            <p className="text-sm text-slate-500">
              Seguimiento de materiales según días disponibles.
            </p>
          </div>
          {(inventarioLoading || pedidosLoading) && (
            <span className="flex items-center gap-2 text-xs font-medium text-[#1F4F9C]">
              <Loader2 className="h-4 w-4 animate-spin" /> Actualizando datos
            </span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resumenCards.map((card) => (
            <Card
              key={card.key}
              className="relative overflow-hidden border-none bg-[#F4F6FB] shadow-md"
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
                  card.gradient
                )}
              />
              <CardHeader className="relative flex items-center justify-between">
                <CardTitle className="text-2xl font-semibold text-slate-900">
                  {card.value}
                </CardTitle>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                    card.tone.badge
                  )}
                >
                  {card.tone.label}
                </span>
              </CardHeader>
              <CardContent className="relative space-y-3">
                {inventarioLoading && !materialesConCobertura.length ? (
                  <Skeleton className="h-6 w-24 bg-white/40" />
                ) : (
                  <p className="text-sm text-slate-700">
                    {card.tone.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        {inventarioError && (
          <div className="flex items-center gap-2 rounded-lg border border-[#F5A623]/40 bg-[#F5A623]/10 p-3 text-sm text-[#92400E]">
            <Info className="h-4 w-4" /> {inventarioError}
          </div>
        )}
      </section>

      {/* Pedidos pendientes */}
      <section>
        <Card className="border-slate-200 bg-white/80 shadow-lg">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl text-slate-900">
                Pedidos pendientes ({pedidos.length})
              </CardTitle>
              <CardDescription>
                Últimos movimientos listos para seguimiento y cierre.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                asChild
                variant="ghost"
                className="text-slate-600 hover:text-slate-900"
              >
                <Link href="/pedidos">Ver todos</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {pedidosError && (
              <div className="flex items-center gap-2 rounded-lg border border-[#FF6B5A]/40 bg-[#FF6B5A]/10 p-3 text-sm text-[#B91C1C]">
                <Info className="h-4 w-4" /> {pedidosError}
              </div>
            )}
            {pedidosLoading && !pedidos.length ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full bg-[#F4F6FB]" />
                ))}
              </div>
            ) : pedidos.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha pedido</TableHead>
                    <TableHead>Fecha entrega</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Totales</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidos.map((p) => (
                    <TableRow
                      key={p.id}
                      className={cn(
                        "bg-white/60 transition hover:shadow-sm",
                        "border-l-4",
                        resumenCobertura.critico.length
                          ? "border-l-[#FF6B5A]/70"
                          : "border-l-[#1F4F9C]/40"
                      )}
                    >
                      <TableCell>{fmtDate(p.fecha_pedido)}</TableCell>
                      <TableCell>{fmtDate(p.fecha_entrega)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1F4F9C]/40 bg-[#1F4F9C]/10 text-sm font-semibold text-[#1F4F9C]">
                            {initialsFromName(p.solicitante ?? "")}
                          </span>
                          <span className="text-sm text-slate-700">
                            {p.solicitante ?? "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {fmtNum(p.total_bultos ?? 0)} b /{" "}
                        {fmtNum(p.total_kg ?? 0)} kg
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                            ESTADO_TONO[p.estado]
                          )}
                        >
                          {ESTADO_LABEL[p.estado]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            asChild
                            variant="outline"
                            className="border-[#1F4F9C]/30 text-[#1F4F9C] hover:bg-[#1F4F9C]/10"
                          >
                            <Link href={`/pedidos/${p.id}/ver`}>Ver</Link>
                          </Button>
                          <Button
                            className="bg-[#29B8A6] text-white hover:bg-[#29B8A6]/90"
                            onClick={() => void marcarCompletado(p.id)}
                          >
                            Completar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#1F4F9C]/20 bg-[#F4F6FB] p-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-[#29B8A6]" />
                <p className="text-sm text-slate-600">
                  No hay pedidos pendientes en este momento.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
