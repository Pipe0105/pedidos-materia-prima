"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ZoneSelector from "@/components/ZonaSelector";
import { fmtNum } from "@/lib/format";

type Zona = {
  id: string;
  nombre: string;
};

type Material = {
  id: string;
  nombre: string;
  presentacion_kg_por_bulto: number | null;
  tasa_consumo_diaria_kg: number | null;
  unidad_medida: "bulto" | "unidad" | "litro";
};

type StockRow = {
  material_id: string;
  nombre: string;
  stock: number; // en unidad original
  stockKg: number; // en kg
  unidad: "bulto" | "unidad" | "litro";
  hasta: string | null; // fecha estimada de agotamiento
  cobertura: number | null; // en días
};



// 👉 Singular/plural
function formatUnidad(valor: number, unidad: "bulto" | "unidad" | "litro") {
  const plural =
    unidad === "bulto" ? "bultos" : unidad === "unidad" ? "unidades" : "litros";
  const singular = unidad;
  return `${fmtNum(valor)} ${valor === 1 ? singular : plural}`;
}

// 👉 Fecha de agotamiento saltando domingos
function calcularFechaHasta(fechaBase: string, stockKg: number, consumoDiarioKg: number | null) {
  if (!consumoDiarioKg || consumoDiarioKg <= 0) return null;

  let dias = Math.floor(stockKg / consumoDiarioKg);
  let fecha = new Date(fechaBase);

  while (dias > 0) {
    fecha.setDate(fecha.getDate() + 1);
    if (fecha.getDay() !== 0) {
      dias--;
    }
  }

  return fecha.toISOString().slice(0, 10);
}
export default function InventarioPage() {
  const [zonas, setZonas] = useState<Zona[]>([]);  // 👈 este faltaba
  const [zonaId, setZonaId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [materialHistorial, setMaterialHistorial] = useState("");
  const [showEditar, setShowEditar] = useState(false);
  const [materialEditar, setMaterialEditar] = useState<{id: string, nombre: string, stockKg: number}>({id: "", nombre: "", stockKg: 0});
  


function abrirEditar(id: string, nombre: string, stockKg: number) {
  setMaterialEditar({ id, nombre, stockKg });
  setShowEditar(true);
}

// 👉 Función para guardar edición en la BD
async function guardarEdicion() {
  const { id, stockKg } = materialEditar;

  // 1. Buscar stock actual del material
  const { data: movs, error: errMovs } = await supabase
    .from("movimientos_inventario")
    .select("kg, tipo")
    .eq("zona_id", zonaId)
    .eq("material_id", id);

  if (errMovs) {
    alert("❌ Error cargando inventario actual: " + errMovs.message);
    return;
  }

  // Calcular stock actual real
  let stockActual = 0;
  (movs ?? []).forEach((m) => {
    const mult = m.tipo === "entrada" || m.tipo === "ajuste" ? 1 : -1;
    stockActual += Number(m.kg) * mult;
  });

  // 2. Calcular diferencia
  const diferencia = stockKg - stockActual;

  if (diferencia === 0) {
    alert("ℹ️ El stock ya es correcto, no se registró ningún cambio.");
    setShowEditar(false);
    return;
  }

  // 3. Insertar un movimiento de ajuste con la diferencia
  const { error } = await supabase.from("movimientos_inventario").insert({
    zona_id: zonaId,
    material_id: id,
    fecha: new Date().toISOString().slice(0, 10),
    tipo: "ajuste",
    bultos: null,
    kg: diferencia,
    ref_tipo: "ajuste",
    ref_id: null,
    notas: `Ajuste manual: stock corregido a ${stockKg} kg`,
  });

  if (error) {
    alert("❌ Error guardando ajuste: " + error.message);
  } else {
    setShowEditar(false);
    await cargar(); // refrescar inventario
  }
}


async function verHistorial(materialId: string, nombre: string) {
  setMaterialHistorial(nombre);

const { data: movs, error } = await supabase
  .from("movimientos_inventario")
  .select("fecha, tipo, bultos, kg, notas, created_at")
  .eq("material_id", materialId)
  .eq("zona_id", zonaId)
  .order("created_at", { ascending: false }); // más reciente arriba



  if (error) {
    console.error("Error cargando historial:", error.message);
    setMovimientos([]);
  } else {
    setMovimientos(movs ?? []);
  }

  setShowHistorial(true);
}




async function cargar() {
  if (!zonaId) return;
  setLoading(true);

  // 1. Traer materiales
  const { data: mats } = await supabase
    .from("materiales")
    .select("id,nombre,presentacion_kg_por_bulto,tasa_consumo_diaria_kg,unidad_medida")
    .eq("zona_id", zonaId)
    .eq("activo", true)
    .order("nombre")
    .returns<Material[]>();

  // 2. Traer movimientos de inventario
  const { data: movs, error: errMovs } = await supabase
    .from("movimientos_inventario")
    .select("material_id, bultos, kg, tipo")
    .eq("zona_id", zonaId);

  if (errMovs) {
    console.error("Error cargando movimientos:", errMovs);
    setLoading(false);
    return;
  }

  // 3. Acumuladores: uno en kg y otro en unidades
  const stockKg: Record<string, number> = {};
  const stockUnidades: Record<string, number> = {};

  (movs ?? []).forEach((mv) => {
    const mult = mv.tipo === "entrada" ? 1 : mv.tipo === "salida" ? -1 : 1;

    // acumulador en kg (bultos/litros)
    stockKg[mv.material_id] =
      (stockKg[mv.material_id] ?? 0) + Number(mv.kg) * mult;

    // acumulador en unidades
    stockUnidades[mv.material_id] =
      (stockUnidades[mv.material_id] ?? 0) + Number(mv.bultos) * mult;
  });

  // 4. Preparar filas para la tabla
  const data: StockRow[] =
    mats?.map((m) => {
      let stKg = 0;
      let stock = 0;

      if (m.unidad_medida === "unidad") {
        // ✅ materiales que se miden en unidades
        stock = stockUnidades[m.id] ?? 0;
        stKg = 0; // en inventario no tiene sentido en kg
      } else {
        // ✅ materiales que se miden en bultos/litros
        stKg = stockKg[m.id] ?? 0;
        stock = stKg;
        if (m.unidad_medida === "bulto" && m.presentacion_kg_por_bulto) {
          stock = stKg / m.presentacion_kg_por_bulto;
        }
      }

      // consumo diario en kg (solo aplica para bultos/litros)
      let consumo: number | null = null;

      if (m.unidad_medida === "unidad") {
        // 👈 en unidades usamos la tasa de consumo diaria directamente en unidades
        consumo = m.tasa_consumo_diaria_kg ?? 1; // por ahora mínimo 1 si no está definido
      } else if (m.unidad_medida === "bulto" && m.presentacion_kg_por_bulto) {
        consumo = m.tasa_consumo_diaria_kg
          ? m.tasa_consumo_diaria_kg * m.presentacion_kg_por_bulto
          : null;
      } else {
        consumo = m.tasa_consumo_diaria_kg ?? null;
      }

      // cobertura y fecha hasta (solo aplica si hay consumo en kg)
      let cobertura: number | null = null;
      let hasta: string | null = null;

      if (consumo && consumo > 0) {
        if (m.unidad_medida === "unidad") {
          // cobertura en unidades
          cobertura = Math.floor(stock / consumo);
          hasta = calcularFechaHasta(fecha, stock, consumo); // stock en unidades
        } else {
          // cobertura en kg
          cobertura = Math.floor(stKg / consumo);
          hasta = calcularFechaHasta(fecha, stKg, consumo);
        }
      }
      return {
        material_id: m.id,
        nombre: m.nombre,
        stock,
        stockKg: stKg,
        unidad: m.unidad_medida,
        hasta,
        cobertura,
      };
    }) ?? [];

  setRows(data);
  setLoading(false);
}


  

useEffect(() => {
  async function cargarZonas() {
    const { data, error } = await supabase
      .from("zonas")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre");

    if (!error && data) {
      setZonas(data);
      if (data.length > 0 && !zonaId) {
        setZonaId(data[0].id); // 👈 selecciona la primera zona por defecto
      }
    }
  }
  void cargarZonas();
  
}, []);
useEffect(() => {
  if (zonaId) {
    void cargar();
  }
}, [zonaId, fecha]); 



return (
  <main className="mx-auto max-w-7xl p-6 space-y-6">
    <header>
      <h1 className="text-2xl font-semibold mb-4">Inventario</h1>

      {/* Tabs de zonas */}
      <div className="flex gap-2 bg-gray-100 rounded-full p-1 w-fit mb-4">
        {zonas.map((z) => (
          <button
            key={z.id}
            onClick={() => setZonaId(z.id)}
            className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${
              zonaId === z.id
                ? "bg-blue-600 text-white"
                : "text-gray-700 hover:bg-gray-200"
            }`}
          >
            {z.nombre}
          </button>
        ))}
      </div>
    </header>

    {loading ? (
      <div className="text-sm text-gray-500">Cargando…</div>
    ) : (
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm text-center">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-2">Material</th>
              <th className="p-2">Stock (unidad)</th>
              {rows.some((r) => r.unidad !== "unidad") && (
                <th className="p-2">Stock (kg)</th>
              )}
              <th className="p-2">Hasta</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.material_id} className="border-b">
                <td className="p-2">{r.nombre}</td>
                <td className="p-2">{formatUnidad(r.stock, r.unidad)}</td>
                <td className="p-2">
                  {r.unidad === "unidad" ? "—" : `${fmtNum(r.stockKg)} kg`}
                </td>
                <td className="p-2">
                  {r.hasta
                    ? new Date(r.hasta).toLocaleDateString("es-ES")
                    : "—"}
                </td>
                <td className="p-2">
                  {r.cobertura != null ? (
                    r.cobertura >= 10 ? (
                      <span className="text-green-600 text-lg">🟢</span>
                    ) : r.cobertura <= 3 ? (
                      <span className="text-red-600 text-lg">🔴</span>
                    ) : (
                      <span className="text-yellow-600 text-lg">🟡</span>
                    )
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-2 flex gap-2 justify-center">
                  <button
                    onClick={() => verHistorial(r.material_id, r.nombre)}
                    className="flex items-center gap-1 rounded-full bg-blue-50 text-blue-600 px-3 py-1 text-sm font-medium hover:bg-blue-100"
                  >
                    📜 Historial
                  </button>
                  <button
                    onClick={() =>
                      abrirEditar(r.material_id, r.nombre, r.stockKg)
                    }
                    className="flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-sm font-medium hover:bg-gray-200"
                  >
                    ✏️ Editar
                  </button>
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td className="p-4 text-gray-500 text-center" colSpan={6}>
                  No hay datos para esta zona.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )}

    {/* 📜 Modal Historial */}
    {showHistorial && (
      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-lg w-[600px] max-h-[80vh] overflow-y-auto">
          <h2 className="text-lg font-bold mb-3">
            📜 Historial – {materialHistorial}
          </h2>

          <table className="w-full text-sm border">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2">Fecha</th>
                <th className="p-2">Tipo</th>
                <th className="p-2">Bultos</th>
                <th className="p-2">Kg</th>
                <th className="p-2">Notas</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.length > 0 ? (
                movimientos.map((m, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2 min-w-[180px] " align="center">
                      {new Date(m.created_at).toLocaleString("es-ES", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="p-2 text-center">{m.tipo}</td>
                    <td className="p-2 text-center">{m.bultos}</td>
                    <td className="p-2 text-center">{m.kg}</td>
                    <td className="p-2 min-w-[180px] text-center">{m.notas}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="p-4 text-gray-500 text-center"
                  >
                    No hay movimientos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setShowHistorial(false)}
              className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ✏️ Modal Editar */}
    {showEditar && (
      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-lg w-[400px]">
          <h2 className="text-lg font-bold mb-4">
            Editar inventario – {materialEditar.nombre}
          </h2>

          <label className="text-sm font-medium">Nuevo stock (kg)</label>
          <input
            type="number"
            value={materialEditar.stockKg}
            onChange={(e) =>
              setMaterialEditar((prev) => ({
                ...prev,
                stockKg: parseFloat(e.target.value) || 0,
              }))
            }
            className="w-full rounded-lg border px-3 py-2 text-sm mt-1 mb-4"
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowEditar(false)}
              className="px-4 py-2 rounded border hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={guardarEdicion}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    )}
  </main>
);

}
