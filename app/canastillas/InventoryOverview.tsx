"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ClipboardList, RefreshCw, Warehouse } from "lucide-react";

interface CrateHistoryEntry {
  id: string;
  consecutivo?: string | null;
  fecha: string;
  fecha_devolucion: string | null;
  proveedor: string;
  nombre_cliente?: string | null;
  nombre_autoriza: string;
  placa_vh: string | null;
  cantidad: number;
  tipo_canastilla: string;
  firma: string | null;
  observaciones?: string | null;
  anulado?: boolean | null;
  fecha_anulacion?: string | null;
  motivo_anulacion?: string | null;
}

interface Props {
  refreshKey: number;
}

export const InventoryOverview: React.FC<Props> = ({ refreshKey }) => {
  const [history, setHistory] = useState<CrateHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<CrateHistoryEntry | null>(
    null,
  );
  const [editEntry, setEditEntry] = useState<CrateHistoryEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [providerFilter, setProviderFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("activos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [cancelEntry, setCancelEntry] = useState<CrateHistoryEntry | null>(
    null,
  );
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("canastillas")
      .select(
        "id, consecutivo, fecha, fecha_devolucion, proveedor, nombre_cliente, nombre_autoriza, placa_vh, cantidad, tipo_canastilla, firma, observaciones, anulado, fecha_anulacion, motivo_anulacion",
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

  const ingresoHistory = useMemo(
    () => history.filter((entry) => !entry.fecha_devolucion),
    [history],
  );
  const devolucionHistory = useMemo(
    () => history.filter((entry) => entry.fecha_devolucion),
    [history],
  );

  const totalIngresos = ingresoHistory.reduce((acc, entry) => {
    if (entry.anulado) return acc;
    return acc + (entry.cantidad ?? 0);
  }, 0);
  const totalDevoluciones = devolucionHistory.reduce((acc, entry) => {
    if (entry.anulado) return acc;
    return acc + (entry.cantidad ?? 0);
  }, 0);
  const totalCrates = totalIngresos - totalDevoluciones;

  const providerOptions = useMemo(() => {
    const values = new Set<string>();
    history.forEach((entry) => {
      if (entry.proveedor) values.add(entry.proveedor);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [history]);
  const totalPendingCrates = Math.max(totalCrates, 0);
  const totalCanceled = history.filter((entry) => entry.anulado).length;

  const getEntryDate = useCallback(
    (entry: CrateHistoryEntry, mode: "ingreso" | "devolucion") =>
      mode === "devolucion"
        ? entry.fecha_devolucion || entry.fecha
        : entry.fecha,
    [],
  );

  const filterEntries = useCallback(
    (entries: CrateHistoryEntry[], mode: "ingreso" | "devolucion") => {
      const term = searchTerm.trim().toLowerCase();
      return entries.filter((entry) => {
        if (providerFilter !== "todos" && entry.proveedor !== providerFilter) {
          return false;
        }
        if (statusFilter === "activos" && entry.anulado) {
          return false;
        }
        if (statusFilter === "anulados" && !entry.anulado) {
          return false;
        }

        const entryDate = getEntryDate(entry, mode);
        if (dateFrom && entryDate < dateFrom) return false;
        if (dateTo && entryDate > dateTo) return false;
        if (term.length === 0) return true;

        const haystack = [
          entry.consecutivo,
          entry.proveedor,
          entry.placa_vh,
          entry.nombre_autoriza,
          entry.nombre_cliente,
          entry.tipo_canastilla,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      });
    },
    [dateFrom, dateTo, getEntryDate, providerFilter, searchTerm, statusFilter],
  );

  const filteredIngresos = useMemo(
    () => filterEntries(ingresoHistory, "ingreso"),
    [filterEntries, ingresoHistory],
  );
  const filteredDevoluciones = useMemo(
    () => filterEntries(devolucionHistory, "devolucion"),
    [filterEntries, devolucionHistory],
  );

  const getEmptyMessage = useCallback(
    (
      baseEntries: CrateHistoryEntry[],
      filteredEntries: CrateHistoryEntry[],
      label: string,
    ) => {
      if (filteredEntries.length > 0) return "";
      if (baseEntries.length === 0) {
        return `Aún no hay ${label} registrados en el historial.`;
      }
      return "No hay resultados para los filtros seleccionados.";
    },
    [],
  );

  const getSignatureSrc = useCallback((signature?: string | null) => {
    if (!signature) return "";
    if (signature.startsWith("data:")) return signature;
    if (signature.startsWith("image/")) return `data:${signature}`;
    return `data:image/png;base64,${signature}`;
  }, []);

  const handleSaveEdit = async () => {
    if (!editEntry?.id) return;
    setIsUpdating(true);
    setErrorMessage(null);

    const { error } = await supabase
      .from("canastillas")
      .update({
        consecutivo: editEntry.consecutivo || null,
        proveedor: editEntry.proveedor,
        tipo_canastilla: editEntry.tipo_canastilla,
        cantidad: editEntry.cantidad,
        placa_vh: editEntry.placa_vh || null,
        fecha_devolucion: editEntry.fecha_devolucion || null,
        nombre_autoriza: editEntry.nombre_autoriza,
        nombre_cliente: editEntry.nombre_cliente || null,
        observaciones: editEntry.observaciones || null,
      })
      .eq("id", editEntry.id);

    if (error) {
      setErrorMessage("No se pudo guardar la edición.");
    } else {
      setEditEntry(null);
      await loadHistory();
    }
    setIsUpdating(false);
  };

  const handleCancelEntry = async () => {
    if (!cancelEntry?.id) return;
    const trimmedReason = cancelReason.trim();
    if (trimmedReason.length < 3) {
      setErrorMessage("Escribe un motivo de anulación (mínimo 3 caracteres).");
      return;
    }
    setIsCancelling(true);
    setErrorMessage(null);

    const { error } = await supabase
      .from("canastillas")
      .update({
        anulado: true,
        fecha_anulacion: new Date().toISOString(),
        motivo_anulacion: trimmedReason,
      })
      .eq("id", cancelEntry.id);

    if (error) {
      setErrorMessage("No se pudo anular el registro.");
    } else {
      setCancelEntry(null);
      setCancelReason("");
      await loadHistory();
    }
    setIsCancelling(false);
  };

  const renderHistoryTable = (
    entries: CrateHistoryEntry[],
    baseEntries: CrateHistoryEntry[],
    mode: "ingreso" | "devolucion",
    title: string,
  ) => {
    const emptyMessage = getEmptyMessage(
      baseEntries,
      entries,
      mode === "devolucion" ? "devoluciones" : "ingresos",
    );
    const dateLabel = mode === "devolucion" ? "Fecha devolución" : "Fecha";

    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
          {title}
        </h3>
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            {emptyMessage}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2 pr-4">Canastillas</th>
                  <th className="py-2 pr-4">Consecutivo</th>
                  <th className="py-2 pr-4">{dateLabel}</th>
                  <th className="py-2 pr-4">Proveedor</th>
                  <th className="py-2 pr-4">Placa VH</th>
                  <th className="py-2">Aceptó</th>
                  <th className="py-2">Estado</th>
                  <th className="py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td
                      className={`py-3 pr-4 font-semibold ${
                        entry.anulado
                          ? "text-slate-400 line-through"
                          : "text-slate-700"
                      }`}
                    >
                      {entry.cantidad} {entry.tipo_canastilla}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {entry.consecutivo || "Sin consecutivo"}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {getEntryDate(entry, mode)}
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
                    <td className="py-3 text-slate-600">
                      {entry.anulado ? (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase text-amber-700">
                          Anulado
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700">
                          Activo
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col items-end gap-2 text-right sm:flex-row sm:justify-end">
                        {entry.firma ? (
                          <button
                            type="button"
                            onClick={() => setSelectedEntry(entry)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                          >
                            Ver firma
                          </button>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400">
                            Sin firma
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setCancelEntry(entry);
                            setCancelReason("");
                          }}
                          className="text-xs font-semibold text-amber-600 hover:text-amber-800 disabled:cursor-not-allowed disabled:text-slate-300"
                          disabled={entry.anulado ?? false}
                        >
                          Anular
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditEntry({ ...entry })}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-800 disabled:cursor-not-allowed disabled:text-slate-300"
                          disabled={entry.anulado ?? false}
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

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

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              Pendientes de devolución
            </p>
            <p className="text-3xl font-black text-slate-900 mt-2">
              {totalPendingCrates}
            </p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-700">
              Registros anulados
            </p>
            <p className="text-3xl font-black text-amber-900 mt-2">
              {totalCanceled}
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
            Aún no hay registros en el historial.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-500 uppercase">
                  Buscar
                </label>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Proveedor, placa, cliente, autoriza..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">
                  Estado
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="activos">Activos</option>
                  <option value="anulados">Anulados</option>
                  <option value="todos">Todos</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">
                  Proveedor
                </label>
                <select
                  value={providerFilter}
                  onChange={(event) => setProviderFilter(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todos">Todos</option>
                  {providerOptions.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">
                  Desde
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">
                  Hasta
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {renderHistoryTable(
              filteredIngresos,
              ingresoHistory,
              "ingreso",
              "Historial de ingresos",
            )}
            {renderHistoryTable(
              filteredDevoluciones,
              devolucionHistory,
              "devolucion",
              "Historial de devoluciones",
            )}
          </div>
        )}
      </div>

      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Pedido con firma
                </p>
                <h3 className="text-lg font-bold text-slate-800">
                  {selectedEntry.cantidad} {selectedEntry.tipo_canastilla}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <div className="grid gap-1">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Detalles
                </span>
                <div className="grid gap-1">
                  <p>
                    <span className="font-semibold">Consecutivo:</span>{" "}
                    {selectedEntry.consecutivo || "Sin consecutivo"}
                  </p>
                  <p>
                    <span className="font-semibold">Proveedor:</span>{" "}
                    {selectedEntry.proveedor}
                  </p>
                  <p>
                    <span className="font-semibold">Cliente:</span>{" "}
                    {selectedEntry.nombre_cliente || "Sin cliente"}
                  </p>
                  <p>
                    <span className="font-semibold">Placa VH:</span>{" "}
                    {selectedEntry.placa_vh || "Sin placa"}
                  </p>
                  <p>
                    <span className="font-semibold">Fecha:</span>{" "}
                    {selectedEntry.fecha}
                  </p>
                  <p>
                    <span className="font-semibold">Devolución:</span>{" "}
                    {selectedEntry.fecha_devolucion || "Sin devolución"}
                  </p>
                  <p>
                    <span className="font-semibold">Aceptó:</span>{" "}
                    {selectedEntry.nombre_autoriza}
                  </p>
                  <p>
                    <span className="font-semibold">Observaciones:</span>{" "}
                    {selectedEntry.observaciones?.trim() || "Sin observaciones"}
                  </p>
                  <p>
                    <span className="font-semibold">Estado:</span>{" "}
                    {selectedEntry.anulado ? "Anulado" : "Activo"}
                  </p>
                  {selectedEntry.anulado && (
                    <>
                      <p>
                        <span className="font-semibold">Fecha anulación:</span>{" "}
                        {selectedEntry.fecha_anulacion || "Sin fecha"}
                      </p>
                      <p>
                        <span className="font-semibold">Motivo anulación:</span>{" "}
                        {selectedEntry.motivo_anulacion || "Sin motivo"}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-400 mb-2">
                  Firma
                </p>
                <img
                  src={getSignatureSrc(selectedEntry.firma)}
                  alt={`Firma de ${selectedEntry.nombre_autoriza}`}
                  className="h-40 w-full rounded-lg border border-slate-200 bg-white object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {editEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Editar registro
                </p>
                <h3 className="text-lg font-bold text-slate-800">
                  {editEntry.cantidad} {editEntry.tipo_canastilla}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditEntry(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Consecutivo
                </span>
                <input
                  type="text"
                  value={editEntry.consecutivo ?? ""}
                  onChange={(event) =>
                    setEditEntry({
                      ...editEntry,
                      consecutivo: event.target.value.replace(/\D/g, ""),
                    })
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Proveedor
                </span>
                <input
                  type="text"
                  value={editEntry.proveedor}
                  onChange={(event) =>
                    setEditEntry({
                      ...editEntry,
                      proveedor: event.target.value,
                    })
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Tipo canastilla
                </span>
                <input
                  type="text"
                  value={editEntry.tipo_canastilla}
                  onChange={(event) =>
                    setEditEntry({
                      ...editEntry,
                      tipo_canastilla: event.target.value,
                    })
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Cantidad
                </span>
                <input
                  type="number"
                  min={1}
                  value={editEntry.cantidad}
                  onChange={(event) =>
                    setEditEntry({
                      ...editEntry,
                      cantidad: Number(event.target.value),
                    })
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Placa VH
                </span>
                <input
                  type="text"
                  value={editEntry.placa_vh ?? ""}
                  onChange={(event) =>
                    setEditEntry({
                      ...editEntry,
                      placa_vh: event.target.value,
                    })
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Fecha devolución
                </span>
                <input
                  type="date"
                  value={editEntry.fecha_devolucion ?? ""}
                  onChange={(event) =>
                    setEditEntry({
                      ...editEntry,
                      fecha_devolucion: event.target.value,
                    })
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Nombre cliente
                </span>
                <input
                  type="text"
                  value={editEntry.nombre_cliente ?? ""}
                  onChange={(event) =>
                    setEditEntry({
                      ...editEntry,
                      nombre_cliente: event.target.value,
                    })
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Nombre quien autoriza
                </span>
                <input
                  type="text"
                  value={editEntry.nombre_autoriza}
                  onChange={(event) =>
                    setEditEntry({
                      ...editEntry,
                      nombre_autoriza: event.target.value,
                    })
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Observaciones
                </span>
                <textarea
                  value={editEntry.observaciones ?? ""}
                  onChange={(event) =>
                    setEditEntry({
                      ...editEntry,
                      observaciones: event.target.value,
                    })
                  }
                  rows={3}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditEntry(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                disabled={isUpdating}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                disabled={isUpdating}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
      {cancelEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Anular registro
                </p>
                <h3 className="text-lg font-bold text-slate-800">
                  {cancelEntry.cantidad} {cancelEntry.tipo_canastilla}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCancelEntry(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                disabled={isCancelling}
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 grid gap-2 text-sm text-slate-600">
              <p>
                <span className="font-semibold">Proveedor:</span>{" "}
                {cancelEntry.proveedor}
              </p>
              <p>
                <span className="font-semibold">Fecha:</span>{" "}
                {cancelEntry.fecha}
              </p>
              <label className="mt-2 grid gap-1">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Motivo de anulación
                </span>
                <textarea
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  rows={3}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setCancelEntry(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                disabled={isCancelling}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleCancelEntry()}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                disabled={isCancelling}
              >
                Confirmar anulación
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
