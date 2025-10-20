"use client";

import { useCallback, useState } from "react";

import { supabase } from "@/lib/supabase";
import { calcularConsumoDiarioKg } from "@/lib/consumo";

import { ToastType } from "@/components/toastprovider";
import {
  MaterialRow,
  Pedido,
  InventarioActualRow,
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

    try {
      const response = await fetch("/api/inventario");

      if (!response.ok) {
        throw new Error("No pudimos obtener el inventario");
      }

      const payload = (await response.json()) as InventarioActualRow[];

      const materiales = payload.reduce<MaterialRow[]>((acc, item) => {
        const unidad = item.unidad_medida;
        let cobertura: number | null = null;

        if (unidad === "unidad") {
          const consumoUnidades =
            item.tasa_consumo_diaria_kg && item.tasa_consumo_diaria_kg > 0
              ? item.tasa_consumo_diaria_kg
              : null;
          if (consumoUnidades) {
            cobertura = item.stock_bultos / consumoUnidades;
          }
        } else {
          const consumoKg = calcularConsumoDiarioKg({
            nombre: item.nombre,
            unidad_medida: item.unidad_medida,
            presentacion_kg_por_bulto: item.presentacion_kg_por_bulto,
            tasa_consumo_diaria_kg: item.tasa_consumo_diaria_kg,
          });
          if (consumoKg) {
            cobertura = item.stock_kg / consumoKg;
          }
        }

        if (cobertura !== null) {
          acc.push({ id: item.material_id, nombre: item.nombre, cobertura });
        }

        return acc;
      }, []);

      setMaterialesConCobertura(materiales);
    } catch (error) {
      console.error(error);
      setInventarioError(
        error instanceof Error ? error.message : "Error inesperado"
      );
      notify("No pudimos calcular la cobertura de inventario", "error");
      setMaterialesConCobertura([]);
    } finally {
      setInventarioLoading(false);
    }
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
