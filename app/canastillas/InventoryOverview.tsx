"use client";

import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ClipboardList, RefreshCw, Warehouse } from "lucide-react";

interface CrateHistoryEntry {
  fecha: string;
  fecha_devolucion: string | null;
  proveedor: string;
  nombre_autoriza: string;
  placa_vh: string | null;
  cantidad: number;
  tipo_canastilla: string;
}

interface Props {
  refreshKey: number;
}

export const InventoryOverview: React.FC<Props> = ({ refreshKey }) => {
  const [history, setHistory] = useState<CrateHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("canastillas")
      .select(
        "fecha, fecha_devolucion, proveedor, nombre_autoriza, placa_vh, cantidad, tipo_canastilla",
      )
      .order("fecha", { ascending: false });

    if (error) {
      setErrorMessage(
        "No se pudo cargar el inventario. Intenta actualizar la página.",
      );
      setHistory([]);
      setIsLoading(false);
      return;
    }

    setHistory(data ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, refreshKey]);

  const totalCrates = history.reduce(
    (acc, entry) => acc + (entry.cantidad ?? 0),
    0,
  );

  return (
    <section className="mt-10 space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Warehouse size={20} className="text-blue-600" />
            <h2 className="text-lg font-bold">Inventario Actual</h2>
          </div>
          <button
            type="button"
            onClick={() => void loadHistory()}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-700">
              Total de canastillas registradas
            </p>
            <p className="text-3xl font-black text-blue-900 mt-2">
              {totalCrates}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-600">
              Entradas registradas
            </p>
            <p className="text-3xl font-black text-slate-900 mt-2">
              {history.length}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList size={20} className="text-blue-600" />
            <h2 className="text-lg font-bold">Historial de Canastillas</h2>
          </div>
          {isLoading && (
            <span className="text-xs font-semibold text-slate-400">
              Cargando...
            </span>
          )}
        </div>

        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : history.length === 0 && !isLoading ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Aún no hay ingresos registrados en el historial.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2 pr-4">Canastillas</th>
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Devolución</th>
                  <th className="py-2 pr-4">Proveedor</th>
                  <th className="py-2 pr-4">Placa VH</th>
                  <th className="py-2">Aceptó</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((entry, index) => (
                  <tr key={`${entry.fecha}-${entry.proveedor}-${index}`}>
                    <td className="py-3 pr-4 font-semibold text-slate-700">
                      {entry.cantidad} {entry.tipo_canastilla}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{entry.fecha}</td>
                    <td className="py-3 pr-4 text-slate-600">
                      {entry.fecha_devolucion || "Sin devolución"}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {entry.proveedor}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {entry.placa_vh || "Sin placa"}
                    </td>
                    <td className="py-3 text-slate-600">
                      {entry.nombre_autoriza}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
