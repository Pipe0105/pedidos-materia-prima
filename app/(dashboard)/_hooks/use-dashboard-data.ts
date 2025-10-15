"use client";

import { useCallback, useState } from "react";

import { supabase } from "@/lib/supabase";

import { ToastType } from "@/components/toastprovider";
import {
  MaterialConConsumo,
  MaterialRow,
  Pedido,
} from "@/app/(dashboard)/_components/_types";

type UseDashboardDataArgs = {
  notify: (msg: string, type?: ToastType) => void;
};

type UseDashboardDataResult = {
  pedidos: Pedido[];
  pedidosLoading: boolean;
  pedidosError: string | null;
  inventarioLoading: boolean;
  inventarioError: string | null;
  materialesConCobertura: MaterialRow[];
  lastUpdated: Date | null;
  cargarDashboard: () => Promise<void>;
  marcarCompletado: (id: string) => Promise<void>;
};

export function useDashboardData({
  notify,
}: UseDashboardDataArgs): UseDashboardDataResult {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [materialesConCobertura, setMaterialesConCobertura] = useState<
    MaterialRow[]
  >([]);
  const [pedidosLoading, setPedidosLoading] = useState(true);
  const [inventarioLoading, setInventarioLoading] = useState(true);
  const [pedidosError, setPedidosError] = useState<string | null>(null);
  const [inventarioError, setInventarioError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
        supabase
          .from("materiales")
          .select(
            "id,nombre,tasa_consumo_diaria_kg,unidad_medida,presentacion_kg_por_bulto"
          ),
        supabase
          .from("movimientos_inventario")
          .select("material_id,kg,bultos,tipo"),
      ]);

    if (matsError || movsError) {
      setInventarioError(matsError?.message ?? movsError?.message ?? null);
      notify("No pudimos calcular la cobertura de inventario", "error");
    }

    const stockKg: Record<string, number> = {};
    const stockBultos: Record<string, number> = {};
    (movs ?? []).forEach((mv) => {
      const mult = mv.tipo === "entrada" ? 1 : mv.tipo === "salida" ? -1 : 1;
      const materialId = mv.material_id;
      stockKg[materialId] =
        (stockKg[materialId] ?? 0) + Number(mv.kg ?? 0) * mult;
      stockBultos[materialId] =
        (stockBultos[materialId] ?? 0) + Number(mv.bultos ?? 0) * mult;
    });

    const materiales =
      (mats as MaterialConConsumo[] | null)
        ?.map((m) => {
          const unidad = m.unidad_medida ?? "bulto";
          const stockActualKg = stockKg[m.id] ?? 0;
          const stockActualBultos = stockBultos[m.id] ?? 0;

          let cobertura: number | null = null;

          if (unidad === "unidad") {
            const consumoUnidades =
              m.tasa_consumo_diaria_kg && m.tasa_consumo_diaria_kg > 0
                ? m.tasa_consumo_diaria_kg
                : null;
            if (consumoUnidades) {
              cobertura = stockActualBultos / consumoUnidades;
            }
          } else {
            let consumoKg: number | null = null;

            if (unidad === "bulto") {
              if (
                m.tasa_consumo_diaria_kg &&
                m.tasa_consumo_diaria_kg > 0 &&
                m.presentacion_kg_por_bulto &&
                m.presentacion_kg_por_bulto > 0
              ) {
                consumoKg =
                  m.tasa_consumo_diaria_kg * m.presentacion_kg_por_bulto;
              }
            } else {
              consumoKg =
                m.tasa_consumo_diaria_kg && m.tasa_consumo_diaria_kg > 0
                  ? m.tasa_consumo_diaria_kg
                  : null;
            }
            if (consumoKg) {
              cobertura = stockActualKg / consumoKg;
            }
          }

          return { id: m.id, nombre: m.nombre, cobertura };
        })
        .filter((m) => m.cobertura !== null) ?? [];

    setMaterialesConCobertura(materiales);
    setInventarioLoading(false);
  }, [notify]);

  const cargarDashboard = useCallback(async () => {
    await Promise.all([cargarPedidos(), cargarInventario()]);
    setLastUpdated(new Date());
  }, [cargarInventario, cargarPedidos]);

  const marcarCompletado = useCallback(
    async (id: string) => {
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
        return;
      }

      setPedidos((prev) => prev.filter((p) => p.id !== id));
      await cargarPedidos();
      setLastUpdated(new Date());
      notify("Pedido completado ✅", "success");
    },
    [cargarPedidos, notify, pedidos]
  );

  return {
    pedidos,
    pedidosLoading,
    pedidosError,
    inventarioLoading,
    inventarioError,
    materialesConCobertura,
    lastUpdated,
    cargarDashboard,
    marcarCompletado,
  };
}
