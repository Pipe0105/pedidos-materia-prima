"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";


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
  const [editando, setEditando] = useState<Material | null>(null);
  const [form, setForm] = useState({
    id: "",
    nombre: "",
    presentacion: "",
    consumo: "",
    proveedor: "",
    unidad_medida: "bulto" as "bulto" | "unidad" | "litro",
  });
  const [err, setErr] = useState<string | null>(null);

  async function eliminarMaterial(id: string) {
  const { error } = await supabase
    .from("materiales")
    .update({ activo: false })
    .eq("id", id);

  if (error) {
    alert("❌ Error al eliminar: " + error.message);
  } else {
    alert("✅ Material eliminado");
    await cargarMateriales();
  }
}

function editarMaterial(material: Material) {
  // 👇 cargamos los datos en el formulario para editarlos
  setForm({
    id: material.id,
    nombre: material.nombre,
    presentacion: material.presentacion_kg_por_bulto?.toString() ?? "",
    consumo: material.tasa_consumo_diaria_kg?.toString() ?? "",
    proveedor: material.proveedor ?? "",
    unidad_medida: material.unidad_medida,
  });
  setZonaId(material.zona_id);
}


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
  if (!zonaId) return setErr("Selecciona una zona.");
  const nombre = form.nombre.trim();
  if (!nombre) return setErr("El nombre es obligatorio.");

  const presentacion =
    form.unidad_medida === "bulto"
      ? parseFloat(form.presentacion) || 0
      : 1;

  const consumo =
    form.consumo.trim() === "" ? null : parseFloat(form.consumo);

  if (consumo !== null && (Number.isNaN(consumo) || consumo < 0)) {
    return setErr("Consumo diario inválido.");
  }

  const nuevo = {
    zona_id: zonaId,
    nombre,
    presentacion_kg_por_bulto: presentacion,
    tasa_consumo_diaria_kg: consumo,
    proveedor: form.proveedor.trim() || null,
    unidad_medida: form.unidad_medida,
    activo: true,
  };

  let error;
  if (form.id) {
    // 👇 actualizar
    ({ error } = await supabase.from("materiales").update(nuevo).eq("id", form.id));
  } else {
    // 👇 insertar
    ({ error } = await supabase.from("materiales").insert(nuevo));
  }

  if (error) {
    console.error("❌ Error al guardar material:", JSON.stringify(error, null, 2));
    setErr("Error al guardar material.");
  } else {
    setForm({
      id: "",
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
<Tabs value={zonaId} onValueChange={setZonaId} className="w-full">
  <TabsList className="flex space-x-2 mb-4">
    {zonas.map((zona) => (
      <TabsTrigger
        key={zona.id}
        value={zona.id}
        className="px-6 py-2 text-sm font-medium rounded-full
                   data-[state=active]:bg-blue-600 
                   data-[state=active]:text-white 
                   data-[state=inactive]:bg-gray-200 
                   data-[state=inactive]:text-gray-700"
      >
        {zona.nombre}
      </TabsTrigger>
    ))}
  </TabsList>

  {zonas.map((zona) => (
    <TabsContent key={zona.id} value={zona.id}>
    </TabsContent>
  ))}
</Tabs>

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
              <th className="p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-b">
                <td className="p-2">{m.nombre}</td>
                <td className="p-2">{m.unidad_medida}</td>
                <td className="p-2">
                  {m.unidad_medida === "bulto" && m.presentacion_kg_por_bulto
                    ? `${m.presentacion_kg_por_bulto} kg/bulto`
                    : m.unidad_medida === "unidad"
                    ? "unidades"
                    : m.unidad_medida === "litro"
                    ? "litros"
                    : "—"}
                </td>
                <td className="p-2">
                <button
                  onClick={() => setEditando(m)} // 👈 abre el modal con este material
                  className="px-2 py-1 text-xs rounded bg-yellow-500 text-white hover:bg-yellow-600 mr-2"
                >
                  Editar
                </button>
                  <button
                    onClick={() => eliminarMaterial(m.id)}
                    className="px-2 py-1 text-xs  rounded bg-red-600 text-white hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}

            {!items.length && (
              <tr>
                <td colSpan={8} className="p-4 text-gray-500">
                  No hay materiales en esta zona.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Dialog open={!!editando} onOpenChange={() => setEditando(null)}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Editar material</DialogTitle>
    </DialogHeader>

    {editando && (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase
            .from("materiales")
            .update({
              nombre: editando.nombre,
              presentacion_kg_por_bulto:
                editando.unidad_medida === "bulto"
                  ? editando.presentacion_kg_por_bulto
                  : 1,
              tasa_consumo_diaria_kg: editando.tasa_consumo_diaria_kg,
              proveedor: editando.proveedor,
              unidad_medida: editando.unidad_medida,
            })
            .eq("id", editando.id);

          if (!error) {
            await cargarMateriales();
            setEditando(null);
          } else {
            console.error(error);
            alert("❌ Error al editar: " + error.message);
          }
        }}
        className="space-y-4"
      >
        {/* Nombre */}
        <div>
          <label className="text-sm block mb-1">Nombre *</label>
          <input
            type="text"
            className="w-full rounded-lg border px-3 py-2"
            value={editando.nombre}
            onChange={(e) =>
              setEditando({ ...editando, nombre: e.target.value })
            }
          />
        </div>

        {/* Unidad de medida */}
        <div>
          <label className="text-sm block mb-1">Unidad de medida *</label>
          <select
            className="w-full rounded-lg border px-3 py-2"
            value={editando.unidad_medida}
            onChange={(e) =>
              setEditando({
                ...editando,
                unidad_medida: e.target.value as "bulto" | "unidad" | "litro",
              })
            }
          >
            <option value="bulto">Bultos (kg por bulto)</option>
            <option value="unidad">Unidades</option>
            <option value="litro">Litros</option>
          </select>
        </div>

        {/* Presentación */}
        {editando.unidad_medida === "bulto" && (
          <div>
            <label className="text-sm block mb-1">Presentación (kg/bulto) *</label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-lg border px-3 py-2"
              value={editando.presentacion_kg_por_bulto ?? ""}
              onChange={(e) =>
                setEditando({
                  ...editando,
                  presentacion_kg_por_bulto: parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>
        )}

        <DialogFooter>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            Guardar cambios
          </button>
        </DialogFooter>
      </form>
    )}
  </DialogContent>
</Dialog>

      </section>
    </main>
  );
}
