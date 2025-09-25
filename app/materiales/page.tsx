"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import ZoneSelector from "@/components/ZonaSelector";
import { fmt2, toNum } from "@/lib/format";

type Material = {
  id: string;
  zona_id: string;
  nombre: string;
  presentacion_kg_por_bulto: number;
  tasa_consumo_diaria_kg: number | null;
  proveedor: string | null;
  activo: boolean;
};

export default function MaterialesPage() {
  const [zonaId, setZonaId] = useState<string>("");
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    presentacion: "",
    consumo: "",
    proveedor: "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function cargar(zid: string) {
    if (!zid) return;
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("materiales")
      .select(
        "id,zona_id,nombre,presentacion_kg_por_bulto,tasa_consumo_diaria_kg,proveedor,activo"
      )
      .eq("zona_id", zid)
      .eq("activo", true)
      .order("nombre")
      .returns<Material[]>();

    if (error) setErr(error.message);
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (zonaId) void cargar(zonaId);
  }, [zonaId]);

  async function crearMaterial() {
    setErr(null);
    setMsg(null);
    if (!zonaId) return setErr("Selecciona una zona.");
    if (!form.nombre.trim()) return setErr("El nombre es obligatorio.");

    const presentacion = toNum(form.presentacion);
    if (!presentacion || presentacion <= 0)
      return setErr("Presentación debe ser un número > 0 (kg/bulto).");

    const consumo =
      form.consumo.trim() === "" ? null : toNum(form.consumo);
    if (consumo !== null && (Number.isNaN(consumo) || (consumo as number) < 0))
      return setErr("Consumo diario inválido.");

    const { error } = await supabase.from("materiales").insert({
      zona_id: zonaId,
      nombre: form.nombre.trim(),
      presentacion_kg_por_bulto: presentacion,
      tasa_consumo_diaria_kg: consumo,
      proveedor: form.proveedor.trim() || null,
      activo: true,
    });

    // Código de Postgres para unique violation = 23505
    if (error) {
      setErr(error.code === "23505"
        ? "Ya existe un material con ese nombre en esta zona."
        : error.message);
      return;
    }

    setForm({ nombre: "", presentacion: "", consumo: "", proveedor: "" });
    setMsg("Material creado.");
    await cargar(zonaId);
  }

  const totalMateriales = useMemo(() => items.length, [items]);

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Materiales</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Zona:</span>
          <ZoneSelector value={zonaId} onChange={setZonaId} />
        </div>
      </header>

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Nuevo material</h2>

        {err && (
          <div className="mb-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        )}
        {msg && (
          <div className="mb-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {msg}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Nombre *</span>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Salmuera X"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Presentación (kg/bulto) *</span>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={form.presentacion}
              onChange={(e) =>
                setForm((f) => ({ ...f, presentacion: e.target.value }))
              }
              placeholder="20.00"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Consumo diario (kg)</span>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={form.consumo}
              onChange={(e) => setForm((f) => ({ ...f, consumo: e.target.value }))}
              placeholder="10.00"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-700">Proveedor (opcional)</span>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={form.proveedor}
              onChange={(e) =>
                setForm((f) => ({ ...f, proveedor: e.target.value }))
              }
              placeholder="ACME"
            />
          </label>
        </div>

        <div className="mt-3">
          <button
            onClick={crearMaterial}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white"
          >
            Guardar material
          </button>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Listado ({totalMateriales})</h2>
          <button
            onClick={() => cargar(zonaId)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            Refrescar
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500">Cargando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="p-2">Material</th>
                  <th className="p-2">Presentación (kg/bulto)</th>
                  <th className="p-2">Consumo diario (kg)</th>
                  <th className="p-2">Proveedor</th>
                  <th className="p-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id} className="border-b">
                    <td className="p-2">{m.nombre}</td>
                    <td className="p-2">
                      {fmt2(Number(m.presentacion_kg_por_bulto))} kg/bulto
                    </td>
                    <td className="p-2">
                      {m.tasa_consumo_diaria_kg == null
                        ? "—"
                        : fmt2(Number(m.tasa_consumo_diaria_kg))}
                    </td>
                    <td className="p-2">{m.proveedor ?? "—"}</td>
                    <td className="p-2">{m.activo ? "Activo" : "Inactivo"}</td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td className="p-4 text-sm text-gray-500" colSpan={5}>
                      No hay materiales en esta zona todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
