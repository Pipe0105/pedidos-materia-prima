"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ZoneSelector from "@/components/ZonaSelector";
import { fmtNum } from "@/lib/format";
import { ref } from "pdfkit";

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
  stock: number;
  stockKg: number;
  unidad: "bulto" | "unidad" | "litro";
  hasta: string | null;
  cobertura: number | null;
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
    if (fecha.getDay() !== 0) dias--;
  }
  return fecha.toISOString().slice(0, 10);
}

export default function InventarioPage() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zonaId, setZonaId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [materialHistorial, setMaterialHistorial] = useState("");
  const [showEditar, setShowEditar] = useState(false);
  const [materialEditar, setMaterialEditar] = useState<{ id: string; nombre: string; stockKg: number }>({
    id: "",
    nombre: "",
    stockKg: 0,
  });

  // 🟢 Consumo manual
  const [showConsumo, setShowConsumo] = useState(false);
  const [materialConsumo, setMaterialConsumo] = useState<{
    id: string;
    nombre: string;
    unidad: "bulto" | "unidad" | "litro";
  }>({ id: "", nombre: "", unidad: "bulto" });
  const [valorConsumo, setValorConsumo] = useState("");

  function abrirConsumoManual(id: string, nombre: string, unidad: "bulto" | "unidad" | "litro") {
    setMaterialConsumo({ id, nombre, unidad });
    setValorConsumo("");
    setShowConsumo(true);
  }

  // ✅ corregido
  async function guardarConsumoManual() {
    const cantidad = parseFloat(valorConsumo);
    if (isNaN(cantidad) || cantidad <= 0) {
      alert("Por favor ingrese una cantidad válida.");
      return;
    }

    const { id, unidad } = materialConsumo;

    // obtener presentación del material (kg por bulto)
    const { data: matData, error: matError } = await supabase
      .from("materiales")
      .select("presentacion_kg_por_bulto")
      .eq("id", id)
      .single();

    if (matError) {
      alert("❌ Error obteniendo presentación del material.");
      return;
    }

    const presentacion = matData?.presentacion_kg_por_bulto || 1;

    let bultos: number | null = null;
    let kg = 0;

    if (unidad === "bulto") {
      bultos = cantidad;
      kg = cantidad * presentacion; // ✅ conversión correcta
    } else if (unidad === "litro") {
      bultos = null;
      kg = cantidad;
    } else if (unidad === "unidad") {
      bultos = cantidad; // ✅ guarda unidades en la columna bultos
      kg = 0;
    }

    const { error } = await supabase.from("movimientos_inventario").insert({
      zona_id: zonaId,
      material_id: id,
      fecha: new Date().toISOString().slice(0, 10),
      tipo: "salida",
      bultos,
      kg,
      ref_tipo: "consumo_manual",
      notas: `Consumo manual registrado (${cantidad} ${unidad}${cantidad !== 1 ? "s" : ""})`,
    });

    if (error) {
      alert("❌ Error registrando consumo manual: " + error.message);
    } else {
      alert("✅ Consumo manual guardado correctamente");
      setShowConsumo(false);
      await cargar();
    }
  }

  // deshacer consumo manual

  async function deshacerConsumoManual() {

    const { id } = materialConsumo;

    // busca el ultimo movimiento
    const { data: mov, error: errMov } = await supabase
    .from("movimientos_inventario")
    .select("id, bultos, kg, fecha")
    .eq("zona_id", zonaId)
    .eq("material_id", id)
    .eq("ref_tipo", "consumo_manual")
    .order("fecha", { ascending: false })
    .limit(1)
    .single();

    if (errMov || !mov) {
      alert("No hay consumos manuales para deshacer");
      return;
    }

    // movimiento inverso

    const { error: errUndo } = await supabase.from("movimientos_inventario").insert({
      zona_id: zonaId,
      material_id: id,
      fecha: new Date().toISOString().slice(0, 10),
      tipo: "entrada",
      bultos: mov.bultos,
      kg: mov.kg,
      ref_tipo: "deshacer consumo",
      notas: "deshacer consumo manual anterior"
    });

    if (errUndo) {
      alert("error al dehacer consumo" + errUndo.message);
    }else{
      alert("consumo manual deshecho correctamente");
      await cargar();
    }

  }

  // 🟦 Editar inventario (igual que tenías)
  function abrirEditar(id: string, nombre: string, stockKg: number) {
    setMaterialEditar({ id, nombre, stockKg });
    setShowEditar(true);
  }

async function guardarEdicion() {
  const { id, stockKg } = materialEditar;

  // 🔹 Obtener información del material (para saber la unidad de medida)
  const { data: materialData } = await supabase
    .from("materiales")
    .select("unidad_medida, presentacion_kg_por_bulto")
    .eq("id", id)
    .single();

  const unidad = materialData?.unidad_medida || "bulto";
  const presentacion = materialData?.presentacion_kg_por_bulto || 1;

  // 🔹 Obtener movimientos actuales del material
  const { data: movs, error: errMovs } = await supabase
    .from("movimientos_inventario")
    .select("kg, bultos, tipo")
    .eq("zona_id", zonaId)
    .eq("material_id", id);

  if (errMovs) {
    alert("❌ Error cargando inventario actual: " + errMovs.message);
    return;
  }

  // 🔹 Calcular stock actual dependiendo de la unidad
  let stockActual = 0;
  (movs ?? []).forEach((m) => {
    const mult = m.tipo === "entrada" || m.tipo === "ajuste" ? 1 : -1;

    if (unidad === "unidad") {
      stockActual += Number(m.bultos || 0) * mult;
    } else if (unidad === "bulto") {
      stockActual += Number(m.kg || 0) * mult; // se guarda en kg
    } else if (unidad === "litro") {
      stockActual += Number(m.kg || 0) * mult; // litros usan kg
    }
  });

  // 🔹 Calcular diferencia
  const diferencia = stockKg - stockActual;

  if (diferencia === 0) {
    alert("ℹ️ El stock ya es correcto, no se registró ningún cambio.");
    setShowEditar(false);
    return;
  }

  // 🔹 Insertar movimiento de ajuste
const movimiento =
  unidad === "unidad"
    ? {
        zona_id: zonaId,
        material_id: id,
        fecha: new Date().toISOString().slice(0, 10),
        tipo: "ajuste",
        bultos: diferencia, // unidades se guardan aquí
        kg: 0, // 👈 en lugar de null, ponemos 0
        ref_tipo: "ajuste_manual",
        ref_id: null,
        notas: `Ajuste manual: stock corregido a ${stockKg} ${unidad}${stockKg !== 1 ? "s" : ""}`,
      }
    : {
        zona_id: zonaId,
        material_id: id,
        fecha: new Date().toISOString().slice(0, 10),
        tipo: "ajuste",
        bultos: null,
        kg:
          unidad === "bulto"
            ? diferencia
            : diferencia * presentacion, // litros y bultos en kg
        ref_tipo: "ajuste_manual",
        ref_id: null,
        notas: `Ajuste manual: stock corregido a ${stockKg} ${unidad}${stockKg !== 1 ? "s" : ""}`,
      };


  const { error } = await supabase
    .from("movimientos_inventario")
    .insert(movimiento);

  if (error) {
    alert("❌ Error guardando ajuste: " + error.message);
  } else {
    setShowEditar(false);
    await cargar(); // refrescar inventario
  }
}


  // 📜 Historial (sin cambios)
  async function verHistorial(materialId: string, nombre: string) {
    setMaterialHistorial(nombre);
    const { data: movs, error } = await supabase
      .from("movimientos_inventario")
      .select("fecha, tipo, bultos, kg, notas, created_at")
      .eq("material_id", materialId)
      .eq("zona_id", zonaId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando historial:", error.message);
      setMovimientos([]);
    } else {
      setMovimientos(movs ?? []);
    }
    setShowHistorial(true);
  }

  // 🔄 Cargar inventario
  async function cargar() {
    if (!zonaId) return;
    setLoading(true);

    const { data: mats } = await supabase
      .from("materiales")
      .select("id,nombre,presentacion_kg_por_bulto,tasa_consumo_diaria_kg,unidad_medida")
      .eq("zona_id", zonaId)
      .eq("activo", true)
      .order("nombre");

    const { data: movs } = await supabase
      .from("movimientos_inventario")
      .select("material_id,bultos,kg,tipo")
      .eq("zona_id", zonaId);

    const stockKg: Record<string, number> = {};
    const stockUnidades: Record<string, number> = {};

    (movs ?? []).forEach((mv) => {
      const mult = mv.tipo === "entrada" ? 1 : mv.tipo === "salida" ? -1 : 1;
      stockKg[mv.material_id] =
        (stockKg[mv.material_id] ?? 0) + Number(mv.kg) * mult;
      stockUnidades[mv.material_id] =
        (stockUnidades[mv.material_id] ?? 0) + Number(mv.bultos) * mult;
    });

    const data =
      mats?.map((m) => {
        let stKg = 0;
        let stock = 0;

        if (m.unidad_medida === "unidad") {
          stock = stockUnidades[m.id] ?? 0;
          stKg = 0;
        } else {
          stKg = stockKg[m.id] ?? 0;
          stock =
            m.unidad_medida === "bulto" && m.presentacion_kg_por_bulto
              ? stKg / m.presentacion_kg_por_bulto
              : stKg;
        }

        let consumo: number | null = null;
        if (m.unidad_medida === "unidad") {
          consumo = m.tasa_consumo_diaria_kg ?? 1;
        } else if (m.unidad_medida === "bulto" && m.presentacion_kg_por_bulto) {
          consumo = m.tasa_consumo_diaria_kg
            ? m.tasa_consumo_diaria_kg * m.presentacion_kg_por_bulto
            : null;
        } else {
          consumo = m.tasa_consumo_diaria_kg ?? null;
        }

        let cobertura: number | null = null;
        let hasta: string | null = null;

        if (consumo && consumo > 0) {
          if (m.unidad_medida === "unidad") {
            cobertura = Math.floor(stock / consumo);
            hasta = calcularFechaHasta(fecha, stock, consumo);
          } else {
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

  // useEffect zonas
  useEffect(() => {
    async function cargarZonas() {
      const { data } = await supabase
        .from("zonas")
        .select("id,nombre")
        .eq("activo", true)
        .order("nombre");
      if (data?.length) {
        setZonas(data);
        if (!zonaId) setZonaId(data[0].id);
      }
    }
    void cargarZonas();
  }, []);

  useEffect(() => {
    if (zonaId) void cargar();
  }, [zonaId, fecha]);

  // ✅ RENDER original completo
  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold mb-4">Inventario</h1>
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
                      onClick={() =>
                        verHistorial(r.material_id, r.nombre)
                      }
                      className="flex items-center gap-1 rounded-full bg-blue-50 text-gray-700 px-3 py-1 text-sm font-medium hover:bg-gray-200"
                    >
                       Historial
                    </button>
                    <button
                      onClick={() =>
                        abrirEditar(r.material_id, r.nombre, r.stockKg)
                      }
                      className="flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-sm font-medium hover:bg-gray-200"
                    >
                       Editar
                    </button>
                    <button
                      onClick={() =>
                        abrirConsumoManual(
                          r.material_id,
                          r.nombre,
                          r.unidad
                        )
                      }
                      className="flex items-center gap-1 rounded-full bg-green-50 text-green-700 px-3 py-1 text-sm font-medium hover:bg-gray-200"
                    >
                       Consumo manual
                    </button>
                    <button
                    onClick={() => {
                      if (confirm("¿Seguro que deseas deshacer el último consumo manual?")) {
                        deshacerConsumoManual();
                      }
                    }}
                    className="flex items-center gap-1 rounded-full bg-gray-100 text-red-700 px-3 py-1 text-sm font-medium hover:bg-gray-200"
                  >
                    Deshacer Consumo
                  </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="p-4 text-gray-500 text-center">
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
                      <td className="p-2 min-w-[180px]" align="center">
                        {new Date(m.created_at).toLocaleString("es-ES")}
                      </td>
                      <td className="p-2 text-center">{m.tipo}</td>
                      <td className="p-2 text-center">{m.bultos}</td>
                      <td className="p-2 text-center">{m.kg}</td>
                      <td className="p-2 min-w-[180px] text-center">
                        {m.notas}
                      </td>
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

      {/* 🟢 Modal Consumo Manual */}
      {showConsumo && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg w-[400px]">
            <h2 className="text-lg font-bold mb-4">
              Registrar consumo manual – {materialConsumo.nombre}
            </h2>
            <label className="text-sm font-medium mb-2 block">
              ¿Cuánto fue el consumo de hoy? ({materialConsumo.unidad}
              {materialConsumo.unidad !== "unidad" ? "s" : ""})
            </label>
            <input
              type="number"
              value={valorConsumo}
              onChange={(e) => setValorConsumo(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm mt-1 mb-4"
              placeholder={`Ingrese cantidad en ${materialConsumo.unidad}${
                materialConsumo.unidad !== "unidad" ? "s" : ""
              }`}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConsumo(false)}
                className="px-4 py-2 rounded border hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={guardarConsumoManual}
                className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
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
