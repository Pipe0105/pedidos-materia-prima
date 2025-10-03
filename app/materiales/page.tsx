"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Zona = { id: string; nombre: string };

type Material = {
  id: string;
  zona_id: string;
  nombre: string;
  presentacion_kg_por_bulto: number | null;
  tasa_consumo_diaria_kg: number | null;
  proveedor: string | null;
  activo: boolean;
  unidad_medida: "bulto" | "unidad" | "litro";
};

export default function MaterialesPage() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zonaId, setZonaId] = useState<string>("");
  const [items, setItems] = useState<Material[]>([]);
  const [form, setForm] = useState({
    nombre: "",
    presentacion: "",
    consumo: "",
    proveedor: "",
    unidad_medida: "bulto" as "bulto" | "unidad" | "litro",
  });
  const [err, setErr] = useState<string | null>(null);

  // cargar zonas
  async function cargarZonas() {
    const { data, error } = await supabase.from("zonas").select("*");
    if (error) {
      console.error(error);
      return;
    }
    const filtradas = (data ?? []).filter((z) =>
      ["desposte", "desprese", "panificadora"].includes(
        z.nombre.trim().toLowerCase()
      )
    );
    setZonas(filtradas);
    if (filtradas.length > 0) setZonaId(filtradas[0].id);
  }

  // cargar materiales
  async function cargarMateriales() {
    if (!zonaId) return;
    const { data, error } = await supabase
      .from("materiales")
      .select("*")
      .eq("zona_id", zonaId)
      .eq("activo", true)  
      .returns<Material[]>();
    if (error) {
      console.error(error);
      return;
    }
    setItems(data ?? []);
  }

  useEffect(() => {
    void cargarZonas();
  }, []);

  useEffect(() => {
    if (zonaId) void cargarMateriales();
  }, [zonaId]);

  async function guardarMaterial() {
  if (!zonaId) {
    setErr("Selecciona una zona.");
    console.error("❌ Error: zonaId vacío");
    return;
  }

  const nombre = form.nombre.trim();
  if (!nombre) {
    setErr("El nombre es obligatorio.");
    return;
  }

  const presentacion =
    form.unidad_medida === "bulto"
      ? parseFloat(form.presentacion) || 0
      : 1; // ✅ nunca null, cumple NOT NULL

  const consumo =
    form.consumo.trim() === "" ? null : parseFloat(form.consumo);

  if (consumo !== null && (Number.isNaN(consumo) || consumo < 0)) {
    return setErr("Consumo diario inválido.");
  }

  // 👀 Log de lo que vas a insertar
  const nuevo = {
    zona_id: zonaId,
    nombre,
    presentacion_kg_por_bulto: presentacion,
    tasa_consumo_diaria_kg: consumo,
    proveedor: form.proveedor.trim() || null,
    unidad_medida: form.unidad_medida,
    activo: true,
  };

  console.log("🔍 Insertando material:", nuevo);

  const { error } = await supabase.from("materiales").insert(nuevo);

  if (error) {
    console.error("❌ Error al guardar material:", JSON.stringify(error, null, 2));
    setErr("Error al guardar material.");
  } else {
    console.log("✅ Material guardado correctamente");
    setForm({
      nombre: "",
      presentacion: "",
      consumo: "",
      proveedor: "",
      unidad_medida: "bulto",
    });
    setErr(null);
    await cargarMateriales();
  }
}

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold mb-4">Materiales</h1>
        {/* Tabs de zonas */}
        <div className="flex gap-3 mb-6">
          {zonas.map((z) => (
            <button
              key={z.id}
              onClick={() => setZonaId(z.id)}
              className={`px-4 py-1 rounded-full border ${
                zonaId === z.id
                  ? "bg-gray-200 font-medium"
                  : "hover:bg-gray-50"
              }`}
            >
              {z.nombre}
            </button>
          ))}
        </div>
      </header>

      {/* Formulario */}
      <section className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-lg font-medium flex items-center gap-2">
          <span className="text-blue-600 text-xl">＋</span> Nuevo material
        </h2>
        {err && <p className="text-sm text-red-600">{err}</p>}

        <div className="grid md:grid-cols-5 gap-4">
          <label className="text-sm col-span-1">
            <span className="mb-1 block">Nombre *</span>
            <input
              type="text"
              className="w-full rounded-lg border px-3 py-2"
              value={form.nombre}
              onChange={(e) =>
                setForm((f) => ({ ...f, nombre: e.target.value }))
              }
              placeholder="Ej: Salmuera X"
            />
          </label>

          <label className="text-sm col-span-1">
            <span className="mb-1 block">Unidad de medida *</span>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={form.unidad_medida}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  unidad_medida: e.target.value as
                    | "bulto"
                    | "unidad"
                    | "litro",
                }))
              }
            >
              <option value="bulto">Bultos (kg por bulto)</option>
              <option value="unidad">Unidades</option>
              <option value="litro">Litros</option>
            </select>
          </label>

          {form.unidad_medida === "bulto" && (
            <label className="text-sm col-span-1">
              <span className="mb-1 block">Presentación (kg/bulto) *</span>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-lg border px-3 py-2"
                value={form.presentacion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, presentacion: e.target.value }))
                }
                placeholder="20.00"
              />
            </label>
          )}

          <label className="text-sm col-span-1">
            <span className="mb-1 block">
              Consumo diario (
              {form.unidad_medida === "bulto"
                ? "bultos"
                : form.unidad_medida === "unidad"
                ? "unidades"
                : "litros"}
              )
            </span>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-lg border px-3 py-2"
              value={form.consumo}
              onChange={(e) =>
                setForm((f) => ({ ...f, consumo: e.target.value }))
              }
              placeholder="Ej: 5.25"
            />
          </label>

          <label className="text-sm col-span-1">
            <span className="mb-1 block">Proveedor (opcional)</span>
            <input
              type="text"
              className="w-full rounded-lg border px-3 py-2"
              value={form.proveedor}
              onChange={(e) =>
                setForm((f) => ({ ...f, proveedor: e.target.value }))
              }
              placeholder="ACME"
            />
          </label>
        </div>

        <button
          onClick={guardarMaterial}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          Guardar material
        </button>
      </section>

      {/* Tabla */}
      <section className="rounded-xl border bg-white shadow-sm">
        <div className="flex justify-between items-center p-4">
          <h2 className="font-medium">Listado ({items.length})</h2>
          <button
            onClick={cargarMateriales}
            className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-100"
          >
            Refrescar
          </button>
        </div>
        <table className="min-w-full text-sm text-center">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-2">Material</th>
              <th className="p-2">Unidad</th>
              <th className="p-2">Presentación</th>
              <th className="p-2">Consumo diario</th>
              <th className="p-2">Proveedor</th>
              <th className="p-2">Zona</th>
              <th className="p-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-b">
                <td className="p-2">{m.nombre}</td>
                <td className="p-2">{m.unidad_medida}</td>
                <td className="p-2">
                  {m.presentacion_kg_por_bulto ?? "—"}
                </td>
                <td className="p-2">{m.tasa_consumo_diaria_kg ?? "—"}</td>
                <td className="p-2">{m.proveedor ?? "—"}</td>
                <td className="p-2">
                  {zonas.find((z) => z.id === m.zona_id)?.nombre ?? "—"}
                </td>
                <td className="p-2">
                  {m.activo ? (
                    <span className="text-green-600 font-medium">Activo</span>
                  ) : (
                    <span className="text-red-600 font-medium">Inactivo</span>
                  )}
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={7} className="p-4 text-gray-500">
                  No hay materiales en esta zona.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
