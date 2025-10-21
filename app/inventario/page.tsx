"use client";
export const dynamic = "force-dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { InventarioActualRow } from "@/app/(dashboard)/_components/_types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageContainer } from "@/components/PageContainer";

import { InventarioHeader } from "./_components/InventarioHeader";
import { InventarioTable } from "./_components/InventarioTable";
import { HistorialDialog } from "./_components/HistorialDialog";
import { EditarInventarioDialog } from "./_components/EditarInventarioDialog";
import { ConsumoManualDialog } from "./_components/ConsumoManualDialog";
import { calcularFechaHasta } from "./utils";
import type {
  MaterialConsumo,
  MaterialEditar,
  MovimientoInventario,
  StockRow,
  Unidad,
  Zona,
} from "./types";

const EMPTY_EDITAR: MaterialEditar = { id: "", nombre: "", stockKg: 0 };
const EMPTY_CONSUMO: MaterialConsumo = { id: "", nombre: "", unidad: "bulto" };

export default function InventarioPage() {
  const searchParams = useSearchParams();

  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zonaId, setZonaId] = useState<string | null>(null);
  const zonaFromQuery = searchParams.get("zonaId");
  const fecha = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [materialHistorial, setMaterialHistorial] = useState("");
  const [showEditar, setShowEditar] = useState(false);
  const zonasInicializadas = useRef(false);
  const ultimaZonaQuery = useRef<string | null>(null);
  const [materialEditar, setMaterialEditar] =
    useState<MaterialEditar>(EMPTY_EDITAR);
  const [showConsumo, setShowConsumo] = useState(false);
  const [materialConsumo, setMaterialConsumo] =
    useState<MaterialConsumo>(EMPTY_CONSUMO);
  const [valorConsumo, setValorConsumo] = useState("");

  const abrirConsumoManual = (id: string, nombre: string, unidad: Unidad) => {
    setMaterialConsumo({ id, nombre, unidad });
    setValorConsumo("");
    setShowConsumo(true);
  };

  const guardarConsumoManual = async () => {
    const cantidad = parseFloat(valorConsumo);
    if (Number.isNaN(cantidad) || cantidad <= 0) {
      alert("Por favor ingrese una cantidad válida.");
      return;
    }

    if (!zonaId) {
      alert("Selecciona una zona antes de registrar consumo.");
      return;
    }

    const { id, unidad } = materialConsumo;

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
      kg = cantidad * presentacion;
    } else if (unidad === "litro") {
      bultos = null;
      kg = cantidad;
    } else if (unidad === "unidad") {
      bultos = cantidad;
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
      notas: `Consumo manual registrado (${cantidad} ${unidad}${
        cantidad !== 1 ? "s" : ""
      })`,
    });

    if (error) {
      alert("❌ Error registrando consumo manual: " + error.message);
    } else {
      alert("✅ Consumo manual guardado correctamente");
      setShowConsumo(false);
      await cargar();
    }
  };

  const deshacerConsumoManual = async (materialId: string) => {
    if (!zonaId) {
      alert("Selecciona una zona antes de deshacer un consumo.");
      return;
    }

    const { data: mov, error: errMov } = await supabase
      .from("movimientos_inventario")
      .select("id, bultos, kg, fecha")
      .eq("zona_id", zonaId)
      .eq("material_id", materialId)
      .eq("ref_tipo", "consumo_manual")
      .order("fecha", { ascending: false })
      .limit(1)
      .single();

    if (errMov || !mov) {
      alert("No hay consumos manuales para deshacer");
      return;
    }

    const { error: errUndo } = await supabase
      .from("movimientos_inventario")
      .insert({
        zona_id: zonaId,
        material_id: materialId,
        fecha: new Date().toISOString().slice(0, 10),
        tipo: "entrada",
        bultos: mov.bultos,
        kg: mov.kg,
        ref_tipo: "deshacer consumo",
        notas: "deshacer consumo manual anterior",
      });

    if (errUndo) {
      alert("error al dehacer consumo" + errUndo.message);
    } else {
      alert("consumo manual deshecho correctamente");
      await cargar();
    }
  };

  const abrirEditar = (id: string, nombre: string, stockKg: number) => {
    setMaterialEditar({ id, nombre, stockKg });
    setShowEditar(true);
  };

  const guardarEdicion = async () => {
    if (!zonaId) {
      alert("Selecciona una zona antes de ajustar inventario.");
      return;
    }

    const { id, stockKg } = materialEditar;

    const { data: materialData } = await supabase
      .from("materiales")
      .select("unidad_medida, presentacion_kg_por_bulto")
      .eq("id", id)
      .single();

    const unidad = (materialData?.unidad_medida as Unidad) || "bulto";
    const presentacion = materialData?.presentacion_kg_por_bulto || 1;

    const { data: movs, error: errMovs } = await supabase
      .from("movimientos_inventario")
      .select("kg, bultos, tipo")
      .eq("zona_id", zonaId)
      .eq("material_id", id);

    if (errMovs) {
      alert("❌ Error cargando inventario actual: " + errMovs.message);
      return;
    }

    let stockActual = 0;
    (movs ?? []).forEach((m) => {
      const mult = m.tipo === "entrada" || m.tipo === "ajuste" ? 1 : -1;

      if (unidad === "unidad") {
        stockActual += Number(m.bultos || 0) * mult;
      } else {
        stockActual += Number(m.kg || 0) * mult;
      }
    });

    const diferencia = stockKg - stockActual;

    if (diferencia === 0) {
      alert("ℹ️ El stock ya es correcto, no se registró ningún cambio.");
      setShowEditar(false);
      return;
    }

    const movimiento =
      unidad === "unidad"
        ? {
            zona_id: zonaId,
            material_id: id,
            fecha: new Date().toISOString().slice(0, 10),
            tipo: "ajuste",
            bultos: diferencia,
            kg: 0,
            ref_tipo: "ajuste_manual",
            ref_id: null,
            notas: `Ajuste manual: stock corregido a ${stockKg} ${unidad}${
              stockKg !== 1 ? "s" : ""
            }`,
          }
        : {
            zona_id: zonaId,
            material_id: id,
            fecha: new Date().toISOString().slice(0, 10),
            tipo: "ajuste",
            bultos: null,
            kg: unidad === "bulto" ? diferencia : diferencia * presentacion,
            ref_tipo: "ajuste_manual",
            ref_id: null,
            notas: `Ajuste manual: stock corregido a ${stockKg} ${unidad}${
              stockKg !== 1 ? "s" : ""
            }`,
          };

    const { error } = await supabase
      .from("movimientos_inventario")
      .insert(movimiento);

    if (error) {
      alert("❌ Error guardando ajuste: " + error.message);
    } else {
      setShowEditar(false);
      await cargar();
    }
  };

  const verHistorial = async (materialId: string, nombre: string) => {
    setMaterialHistorial(nombre);
    if (!zonaId) {
      alert("Selecciona una zona para ver el historial.");
      return;
    }
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
      setMovimientos((movs ?? []) as MovimientoInventario[]);
    }
    setShowHistorial(true);
  };

  const cargar = useCallback(async () => {
    if (!zonaId) return;
    setLoading(true);

    try {
      const response = await fetch(`/api/inventario?zonaId=${zonaId}`);

      if (!response.ok) {
        throw new Error("No se pudo obtener el inventario");
      }

      const payload = (await response.json()) as InventarioActualRow[];

      const data = payload.map((item) => {
        const unidad = item.unidad_medida as Unidad;
        const presentacion = item.presentacion_kg_por_bulto;

        let consumo: number | null = null;
        if (unidad === "unidad") {
          consumo = item.tasa_consumo_diaria_kg ?? 1;
        } else if (unidad === "bulto" && presentacion) {
          consumo = item.tasa_consumo_diaria_kg
            ? item.tasa_consumo_diaria_kg * presentacion
            : null;
        } else {
          consumo = item.tasa_consumo_diaria_kg ?? null;
        }

        let cobertura: number | null = null;
        let hasta: string | null = null;

        if (consumo && consumo > 0) {
          if (unidad === "unidad") {
            cobertura = Math.floor(item.stock_bultos / consumo);
            hasta = calcularFechaHasta(fecha, item.stock_bultos, consumo);
          } else {
            cobertura = Math.floor(item.stock_kg / consumo);
            hasta = calcularFechaHasta(fecha, item.stock_kg, consumo);
          }
        }

        return {
          material_id: item.material_id,
          nombre: item.nombre,
          stock: unidad === "unidad" ? item.stock_bultos : item.stock,
          stockKg: unidad === "unidad" ? 0 : item.stock_kg,
          unidad,
          hasta,
          cobertura,
        } satisfies StockRow;
      });

      setRows(data);
    } catch (err) {
      console.error(err);
      alert("❌ Error obteniendo el inventario actual");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [fecha, zonaId]);

  useEffect(() => {
    async function cargarZonas() {
      const { data } = await supabase
        .from("zonas")
        .select("id,nombre")
        .eq("activo", true)
        .order("nombre");

      if (data?.length) {
        const ordenPreferido = ["Desposte", "Desprese", "Panificadora"];
        const zonasOrdenadas = data
          .filter((zona) => zona.nombre !== "Inventario General")
          .sort((a, b) => {
            const indexA = ordenPreferido.indexOf(a.nombre);
            const indexB = ordenPreferido.indexOf(b.nombre);

            if (indexA === -1 && indexB === -1) {
              return a.nombre.localeCompare(b.nombre);
            }
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });

        setZonas(zonasOrdenadas);
      }
    }
    void cargarZonas();
  }, []);

  useEffect(() => {
    if (!zonas.length) {
      ultimaZonaQuery.current = null;
      zonasInicializadas.current = false;
      if (zonaId !== null) {
        setZonaId(null);
      }
      return;
    }

    const zonaQueryValida =
      zonas.find((zona) => zona.id === zonaFromQuery)?.id ?? null;
    if (
      zonasInicializadas.current &&
      zonaQueryValida === ultimaZonaQuery.current
    ) {
      return;
    }

    const zonaValida = zonaQueryValida ?? zonas[0]?.id ?? null;

    ultimaZonaQuery.current = zonaQueryValida;

    if (zonaValida !== zonaId) {
      setZonaId(zonaValida);
    }

    zonasInicializadas.current = true;
  }, [zonas, zonaFromQuery, zonaId]);

  useEffect(() => {
    if (zonaId) void cargar();
  }, [cargar, zonaId]);

  const zonaActual = zonas.find((zona) => zona.id === zonaId) ?? null;
  const totalMateriales = rows.length;
  const materialesCriticos = rows.filter(
    (row) => row.cobertura != null && row.cobertura <= 3
  ).length;
  const materialesEstables = rows.filter(
    (row) => row.cobertura != null && row.cobertura >= 10
  ).length;
  const mostrarColumnaKg = rows.some((row) => row.unidad !== "unidad");

  return (
    <PageContainer>
      <InventarioHeader
        zonaActual={zonaActual}
        totalMateriales={totalMateriales}
        materialesCriticos={materialesCriticos}
        materialesEstables={materialesEstables}
        zonaSeleccionada={zonaId}
        loading={loading}
        onRefresh={() => {
          if (!zonaId) return;
          void cargar();
        }}
      />

      <section className="space-y-6">
        {zonas.length ? (
          <Tabs
            value={zonaId ?? undefined}
            onValueChange={(value) => {
              setZonaId(value);
            }}
            className="space-y-6"
          >
            <TabsList className="flex w-full flex-initial justify-start gap-1.5 rounded-xl bg-muted/95 p-7 px-1 text">
              {" "}
              {zonas.map((zona) => (
                <TabsTrigger
                  key={zona.id}
                  value={zona.id}
                  className="rounded-lg border border-b-transparent px-10 py-6 text-md font-sem data-[state=active]:border-b-[#3e74cc] data-[state=active]:bg-white data-[state=active]:text-[#1F4F9C]"
                >
                  {zona.nombre}
                </TabsTrigger>
              ))}
            </TabsList>

            {zonas.map((zona) => (
              <TabsContent key={zona.id} value={zona.id} className="space-y-6">
                <Card className="border-none shadow-lg">
                  <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-xl font-semibold">
                        Inventario de {zona.nombre}
                      </CardTitle>
                      <CardDescription>
                        Última actualización{" "}
                        {new Date().toLocaleDateString("es-AR")}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2"></div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="overflow-hidden rounded-xl border">
                      <InventarioTable
                        rows={rows}
                        loading={loading}
                        mostrarColumnaKg={mostrarColumnaKg}
                        onVerHistorial={verHistorial}
                        onEditar={abrirEditar}
                        onConsumo={abrirConsumoManual}
                        onDeshacerConsumo={deshacerConsumoManual}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <Card className="border-none py-12 text-center shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">
                No hay zonas activas
              </CardTitle>
              <CardDescription>
                Configura zonas activas en el panel de administración para
                visualizar el inventario.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>

      <HistorialDialog
        open={showHistorial}
        materialNombre={materialHistorial}
        movimientos={movimientos}
        onClose={() => setShowHistorial(false)}
      />

      <EditarInventarioDialog
        open={showEditar}
        material={materialEditar}
        onClose={() => {
          setShowEditar(false);
          setMaterialEditar(EMPTY_EDITAR);
        }}
        onChange={(value) =>
          setMaterialEditar((prev) => ({
            ...prev,
            stockKg: value,
          }))
        }
        onSubmit={() => void guardarEdicion()}
      />

      <ConsumoManualDialog
        open={showConsumo}
        material={materialConsumo}
        value={valorConsumo}
        onClose={() => {
          setShowConsumo(false);
          setMaterialConsumo(EMPTY_CONSUMO);
        }}
        onChange={setValorConsumo}
        onSubmit={() => void guardarConsumoManual()}
      />
    </PageContainer>
  );
}
