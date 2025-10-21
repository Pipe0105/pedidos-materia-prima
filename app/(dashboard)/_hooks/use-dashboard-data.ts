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

      const normalizarNumero = (valor: unknown) => {
        if (typeof valor === "number" && Number.isFinite(valor)) {
          return valor;
        }
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : 0;
      };

      type MaterialAgrupado = {
        id: string;
        nombre: string;
        unidad: InventarioActualRow["unidad_medida"];
        presentacionKgPorBulto: InventarioActualRow["presentacion_kg_por_bulto"];
        tasaConsumoDiariaKg: InventarioActualRow["tasa_consumo_diaria_kg"];
        stockKg: number;
        stockBultos: number;
      };

      const materialesAgrupados = payload.reduce<Map<string, MaterialAgrupado>>(
        (acc, item) => {
          const unidad = item.unidad_medida;
          const stockBase = normalizarNumero(item.stock);
          const stockKg = normalizarNumero(item.stock_kg);
          const stockBultos = normalizarNumero(item.stock_bultos);

          const stockPorUnidad = (() => {
            if (unidad === "unidad") {
              return {
                stockKg: 0,
                stockBultos: stockBultos || stockBase,
              };
            }

            const baseKg = stockKg || stockBase;
            const baseBultos =
              unidad === "bulto" ? stockBultos || stockBase : stockBultos;

            return {
              stockKg: baseKg,
              stockBultos: baseBultos,
            };
          })();

          const existente = acc.get(item.material_id);

          if (existente) {
            existente.stockKg += stockPorUnidad.stockKg;
            existente.stockBultos += stockPorUnidad.stockBultos;
          } else {
            acc.set(item.material_id, {
              id: item.material_id,
              nombre: item.nombre,
              unidad,
              presentacionKgPorBulto: item.presentacion_kg_por_bulto,
              tasaConsumoDiariaKg: item.tasa_consumo_diaria_kg,
              stockKg: stockPorUnidad.stockKg,
              stockBultos: stockPorUnidad.stockBultos,
            });
          }

          return acc;
        },
        new Map<string, MaterialAgrupado>()
      );

      const materiales = Array.from(materialesAgrupados.values()).reduce<
        MaterialRow[]
      >((acc, item) => {
        let cobertura: number | null = null;

        if (item.unidad === "unidad") {
          const consumoUnidades =
            item.tasaConsumoDiariaKg && item.tasaConsumoDiariaKg > 0
              ? item.tasaConsumoDiariaKg
              : null;
          if (consumoUnidades) {
            cobertura = item.stockBultos / consumoUnidades;
          }
        } else {
          const consumoKg = calcularConsumoDiarioKg({
            nombre: item.nombre,
            unidad_medida: item.unidad,
            presentacion_kg_por_bulto: item.presentacionKgPorBulto,
            tasa_consumo_diaria_kg: item.tasaConsumoDiariaKg,
          });
          if (consumoKg) {
            cobertura = item.stockKg / consumoKg;
          }
        }

        if (cobertura !== null) {
          acc.push({ id: item.id, nombre: item.nombre, cobertura });
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
