"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmt2, toNum } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  zonas?: { nombre: string } | null;
};

export default function MaterialesPage() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zonaId, setZonaId] = useState<string>("");
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    unidad_medida: "bulto" as "bulto" | "unidad" | "litro",
    presentacion: "",
    consumo: "",
    proveedor: "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function cargarZonas() {
    const { data } = await supabase
      .from("zonas")
      .select("id,nombre")
      .eq("activo", true)
      .order("nombre");

    const filtradas = (data ?? []).filter((z) =>
      ["desposte", "desprese", "panificadora"].includes(
        z.nombre.toLowerCase()
      )
    );

    setZonas(filtradas);
    if (filtradas.length && !zonaId) setZonaId(filtradas[0].id);
  }

  async function cargarMateriales(zid: string) {
    if (!zid) return;
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from("materiales")
      .select(
        "id,zona_id,nombre,presentacion_kg_por_bulto,tasa_consumo_diaria_kg,proveedor,activo,unidad_medida,zonas(nombre)"
      )
      .eq("zona_id", zid)
      .order("nombre");

    if (error) setErr(error.message);

    const normalized =
      data?.map((m: any) => ({
        ...m,
        zonas: Array.isArray(m.zonas) ? m.zonas[0] : m.zonas,
      })) ?? [];

    setItems(normalized);
    setLoading(false);
  }

  useEffect(() => {
    void cargarZonas();
  }, []);
  useEffect(() => {
    if (zonaId) void cargarMateriales(zonaId);
  }, [zonaId]);

  async function crearMaterial() {
    setErr(null);
    setMsg(null);
    if (!zonaId) return setErr("Selecciona una zona.");
    if (!form.nombre.trim()) return setErr("El nombre es obligatorio.");

    // validaciones según unidad
    if (form.unidad_medida === "bulto") {
      const presentacion = toNum(form.presentacion);
      if (!presentacion || presentacion <= 0)
        return setErr("Presentación debe ser un número > 0 (kg/bulto).");
    }

    const consumo = form.consumo.trim() === "" ? null : toNum(form.consumo);
    if (consumo !== null && (Number.isNaN(consumo) || consumo < 0))
      return setErr("Consumo diario inválido.");

    const { error } = await supabase.from("materiales").insert({
      zona_id: zonaId,
      nombre: form.nombre.trim(),
      presentacion_kg_por_bulto:
        form.unidad_medida === "bulto" ? toNum(form.presentacion) : null,
      tasa_consumo_diaria_kg: consumo,
      proveedor: form.proveedor.trim() || null,
      unidad_medida: form.unidad_medida,
      activo: true,
    });

    if (error) {
      setErr(
        error.code === "23505"
          ? "Ya existe un material con ese nombre en esta zona."
          : error.message
      );
      return;
    }

    setForm({
      nombre: "",
      unidad_medida: "bulto",
      presentacion: "",
      consumo: "",
      proveedor: "",
    });
    setMsg("Material creado.");
    await cargarMateriales(zonaId);
  }

  async function toggleActivo(id: string, activo: boolean) {
    await supabase.from("materiales").update({ activo: !activo }).eq("id", id);
    await cargarMateriales(zonaId);
  }

  async function eliminarMaterial(id: string) {
    if (!confirm("¿Seguro que quieres eliminar este material?")) return;
    await supabase.from("materiales").delete().eq("id", id);
    await cargarMateriales(zonaId);
  }

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Materiales</h1>
      </header>

      {/* Tabs de zonas */}
      <Tabs value={zonaId} onValueChange={setZonaId}>
        <TabsList>
          {zonas.map((z) => (
            <TabsTrigger key={z.id} value={z.id}>
              {z.nombre}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Crear material */}
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">➕ Nuevo material</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm">
            <span className="mb-1 block">Nombre *</span>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={form.nombre}
              onChange={(e) =>
                setForm((f) => ({ ...f, nombre: e.target.value }))
              }
              placeholder="Salmuera X"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block">Unidad de medida *</span>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={form.unidad_medida}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  unidad_medida: e.target.value as "bulto" | "unidad" | "litro",
                }))
              }
            >
              <option value="bulto">Bultos (kg por bulto)</option>
              <option value="unidad">Unidades</option>
              <option value="litro">Litros</option>
            </select>
          </label>

          {form.unidad_medida === "bulto" && (
            <label className="text-sm">
              <span className="mb-1 block">Presentación (kg/bulto) *</span>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={form.presentacion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, presentacion: e.target.value }))
                }
                placeholder="20.00"
              />
            </label>
          )}

          <label className="text-sm">
            <span className="mb-1 block">
              Consumo diario ({form.unidad_medida === "bulto"
                ? "bultos"
                : form.unidad_medida === "unidad"
                ? "unidades"
                : "litros"}
              )
            </span>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={form.consumo}
              onChange={(e) =>
                setForm((f) => ({ ...f, consumo: e.target.value }))
              }
              placeholder="Ej: 5"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block">Proveedor (opcional)</span>
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
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Guardar material
          </button>
        </div>
      </section>

      {/* Listado */}
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Listado ({items.length})</h2>
          <button
            onClick={() => cargarMateriales(zonaId)}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
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
                  <th className="p-2">Unidad</th>
                  <th className="p-2">Presentación</th>
                  <th className="p-2">Consumo diario</th>
                  <th className="p-2">Proveedor</th>
                  <th className="p-2">Zona</th>
                  <th className="p-2">Estado</th>
                  <th className="p-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id} className="border-b">
                    <td className="p-2">{m.nombre}</td>
                    <td className="p-2">{m.unidad_medida}</td>
                    <td className="p-2">
                      {m.unidad_medida === "bulto"
                        ? `${fmt2(Number(m.presentacion_kg_por_bulto))} kg/bulto`
                        : "—"}
                    </td>
                    <td className="p-2" >
                      {m.tasa_consumo_diaria_kg == null
                        ? "—"
                        : fmt2(Number(m.tasa_consumo_diaria_kg))}
                    </td>
                    <td className="p-2">{m.proveedor ?? "—"}</td>
                    <td className="p-2">{m.zonas?.nombre || "—"}</td>
                    <td className="p-2">
                      {m.activo ? (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                          Activo
                        </span>
                      ) : (
                        <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="p-2 flex gap-2">
                      <button
                        onClick={() => toggleActivo(m.id, m.activo)}
                        className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200"
                      >
                        {m.activo ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        onClick={() => eliminarMaterial(m.id)}
                        className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-700 hover:bg-rose-200"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={8} className="p-4 text-sm text-gray-500">
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
