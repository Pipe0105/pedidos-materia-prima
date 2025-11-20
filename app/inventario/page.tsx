"use client";
export const dynamic = "force-dynamic";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type {
  InventarioActualRow,
  PedidoEstado,
} from "@/app/(dashboard)/_components/_types";
import { shouldRetryEstadoRecibido } from "@/lib/pedidos";
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
import { calcularConsumoDiarioKg } from "@/lib/consumo";
import { calcularFechaCobertura } from "@/lib/utils";
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

function InventarioPageContent() {
  const searchParams = useSearchParams();

  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zonaId, setZonaId] = useState<string | null>(null);
  const zonaFromQuery = searchParams.get("zonaId");
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
  const [diaProceso, setDiaProceso] = useState("");

  const [deshaciendoPedidoMaterialId, setDeshaciendoPedidoMaterialId] =
    useState<string | null>(null);
  const deshaciendoPedidoRef = useRef(false);

  const abrirConsumoManual = (id: string, nombre: string, unidad: Unidad) => {
    setMaterialConsumo({ id, nombre, unidad });
    setValorConsumo("");
    setDiaProceso("");
    setShowConsumo(true);
  };

  const guardarConsumoManual = async () => {
    const cantidad = parseFloat(valorConsumo);
    if (Number.isNaN(cantidad) || cantidad <= 0) {
      alert("Por favor ingrese una cantidad válida.");
      return;
    }

    if (!diaProceso) {
      alert("Selecciona el día del proceso antes de guardar.");
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
      dia_proceso: diaProceso,
      notas: `Consumo manual registrado (${cantidad} ${unidad}${
        cantidad !== 1 ? "s" : ""
      })`,
    });

    if (error) {
      alert("❌ Error registrando consumo manual: " + error.message);
    } else {
      alert("✅ Consumo manual guardado correctamente");
      setShowConsumo(false);
      setDiaProceso("");
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
      .select("id, bultos, kg, fecha, created_at, dia_proceso")
      .eq("zona_id", zonaId)
      .eq("material_id", materialId)
      .eq("ref_tipo", "consumo_manual")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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
      const { error: errMark } = await supabase
        .from("Movimientos_inventaio")
        .update({ ref_tipo: " Consumo_manual_anulado" })
        .eq("id", mov.id);

      if (errMark) {
        console.error("Error marcando consumo manual", errMark);
      }
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
      .select("fecha, tipo, bultos, kg, notas, created_at, dia_proceso")
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

      const normalizarNumero = (valor: unknown) => {
        if (typeof valor === "number") {
          return valor;
        }
        if (typeof valor === "string") {
          const numero = Number(valor);
          return Number.isFinite(numero) ? numero : 0;
        }
        return 0;
      };

      const fechaReferencia = new Date();

      const data = payload.map((item) => {
        const unidad = item.unidad_medida as Unidad;
        const presentacion = item.presentacion_kg_por_bulto;

        const tasaConsumo = item.tasa_consumo_diaria_kg;

        const stockBase = normalizarNumero(item.stock);
        const stockKg = normalizarNumero(item.stock_kg);
        const stockBultos = normalizarNumero(item.stock_bultos);

        const stockBultosDisponibles =
          unidad === "unidad" ? stockBultos || stockBase : stockBultos;
        const stockKgDisponibles =
          unidad === "unidad" ? 0 : stockKg || stockBase;

        const consumoUnidades =
          unidad === "unidad" &&
          typeof tasaConsumo === "number" &&
          Number.isFinite(tasaConsumo) &&
          tasaConsumo > 0
            ? tasaConsumo
            : null;

        const consumoKg =
          unidad === "unidad"
            ? null
            : calcularConsumoDiarioKg({
                nombre: item.nombre,
                unidad_medida: unidad,
                presentacion_kg_por_bulto: presentacion,
                tasa_consumo_diaria_kg: tasaConsumo,
              });

        let coberturaDias: number | null = null;

        if (consumoUnidades && consumoUnidades > 0) {
          const diasCalculados = stockBultosDisponibles / consumoUnidades;
          if (Number.isFinite(diasCalculados)) {
            coberturaDias = Math.max(0, Math.floor(diasCalculados));
          }
        } else if (consumoKg && consumoKg > 0) {
          const diasCalculados = stockKgDisponibles / consumoKg;
          if (Number.isFinite(diasCalculados)) {
            coberturaDias = Math.max(0, Math.floor(diasCalculados));
          }
        }

        const cobertura = coberturaDias;

        let hasta: string | null = null;

        if (
          coberturaDias != null &&
          Number.isFinite(coberturaDias) &&
          coberturaDias > 0
        ) {
          const coberturaDate = calcularFechaCobertura({
            coberturaDias,
            fechaInicio: fechaReferencia,
          });
          hasta = coberturaDate.toISOString().slice(0, 10);
        }

        return {
          material_id: item.material_id,
          nombre: item.nombre,
          stock:
            unidad === "unidad"
              ? stockBultosDisponibles
              : stockBase || stockKgDisponibles,
          stockKg: unidad === "unidad" ? 0 : stockKgDisponibles,
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
  }, [zonaId]);

  const deshacerUltimoPedido = useCallback(
    async (materialId: string, materialNombre: string) => {
      if (deshaciendoPedidoRef.current) {
        return;
      }
      if (!zonaId) {
        alert("Selecciona una zona válida antes de deshacer un pedido.");
        return;
      }

      deshaciendoPedidoRef.current = true;

      const confirmar = window.confirm(
        `¿Deseas deshacer el último pedido completado de ${materialNombre} en esta zona?`
      );

      if (!confirmar) {
        deshaciendoPedidoRef.current = false;
        return;
      }

      setDeshaciendoPedidoMaterialId(materialId);

      try {
        const { data: ultimoMovimiento, error: ultimoError } = await supabase
          .from("movimientos_inventario")
          .select("ref_id")
          .eq("zona_id", zonaId)
          .eq("material_id", materialId)
          .eq("ref_tipo", "pedido")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (ultimoError) {
          console.error(ultimoError);
          alert("❌ Error buscando pedidos completados recientes.");
          return;
        }

        const pedidoId = ultimoMovimiento?.ref_id;

        if (!pedidoId) {
          alert("No se encontraron pedidos completados para deshacer.");
          return;
        }

        const { data: pedidoActual, error: pedidoError } = await supabase
          .from("pedidos")
          .select("id, estado")
          .eq("id", pedidoId)
          .maybeSingle();

        if (pedidoError) {
          console.error(pedidoError);
          alert("❌ Error verificando el estado del pedido seleccionado.");
          return;
        }

        if (!pedidoActual || pedidoActual.estado !== "completado") {
          alert(
            "El último pedido encontrado ya no está marcado como completado."
          );
          return;
        }

        const { data: reversionPrevia, error: reversionError } = await supabase
          .from("movimientos_inventario")
          .select("id")
          .eq("zona_id", zonaId)
          .eq("ref_tipo", "pedido_deshacer")
          .eq("ref_id", pedidoId)
          .limit(1)
          .returns<{ id: string }[]>();

        if (reversionError) {
          console.error(reversionError);
          alert(
            "❌ Error verificando si el pedido ya había sido deshecho anteriormente."
          );
          return;
        }

        if (reversionPrevia && reversionPrevia.length > 0) {
          alert(
            "Este pedido ya fue deshecho anteriormente. No es posible repetir la operación."
          );
          return;
        }

        const { data: movimientosPedido, error: movimientosError } =
          await supabase
            .from("movimientos_inventario")
            .select("id, material_id, bultos, kg")
            .eq("zona_id", zonaId)
            .eq("ref_tipo", "pedido")
            .eq("ref_id", pedidoId)
            .returns<
              {
                id: string;
                material_id: string;
                bultos: number | null;
                kg: number | null;
              }[]
            >();

        if (movimientosError) {
          console.error(movimientosError);
          alert("❌ Error obteniendo los movimientos del pedido.");
          return;
        }

        if (!movimientosPedido?.length) {
          alert(
            "No se encontraron movimientos de inventario para el pedido seleccionado."
          );
          return;
        }

        const fechaActual = new Date().toISOString().slice(0, 10);

        const movimientosReverso = movimientosPedido.map((mov) => ({
          zona_id: zonaId,
          material_id: mov.material_id,
          fecha: fechaActual,
          tipo: "salida" as const,
          bultos: mov.bultos === null ? null : Number(mov.bultos),
          kg: mov.kg === null ? null : Number(mov.kg),
          ref_tipo: "pedido_deshacer",
          ref_id: pedidoId,
          notas: "Salida automática por deshacer pedido completado",
        }));

        const { data: movimientosInsertados, error: insertError } =
          await supabase
            .from("movimientos_inventario")
            .insert(movimientosReverso)
            .select("id")
            .returns<{ id: string }[]>();

        if (insertError) {
          console.error(insertError);
          alert("❌ Error registrando la reversión del pedido.");
          return;
        }

        let pedidoActualizadoEstado: PedidoEstado | null = null;
        const actualizadoRecibido = await supabase
          .from("pedidos")
          .update({ estado: "recibido", inventario_posteado: false })
          .eq("id", pedidoId)
          .select("estado")
          .maybeSingle();

        let actualizarPedidoError = actualizadoRecibido.error ?? null;

        if (!actualizarPedidoError && actualizadoRecibido.data) {
          pedidoActualizadoEstado = actualizadoRecibido.data
            .estado as PedidoEstado;
        } else if (actualizarPedidoError) {
          if (shouldRetryEstadoRecibido(actualizarPedidoError)) {
            console.warn(
              "Fallo al devolver el pedido al estado 'recibido'. Se intentará marcar como 'enviado'.",
              actualizarPedidoError
            );
            const actualizadoEnviado = await supabase
              .from("pedidos")
              .update({ estado: "enviado", inventario_posteado: false })
              .eq("id", pedidoId)
              .select("estado")
              .maybeSingle();

            actualizarPedidoError = actualizadoEnviado.error ?? null;
            if (!actualizarPedidoError && actualizadoEnviado.data) {
              pedidoActualizadoEstado = actualizadoEnviado.data
                .estado as PedidoEstado;
            }
          }
        }

        if (actualizarPedidoError) {
          console.error(actualizarPedidoError);
          if (movimientosInsertados?.length) {
            await supabase
              .from("movimientos_inventario")
              .delete()
              .in(
                "id",
                movimientosInsertados.map((mov) => mov.id)
              );
          }
          alert(
            "❌ No se pudo actualizar el pedido. Intenta nuevamente en unos minutos."
          );
          return;
        }

        alert("✅ Pedido deshecho y restaurado en la lista de pedidos.");

        await cargar();

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("pedidos:invalidate", {
              detail: { zonaId },
            })
          );
        }
      } catch (error) {
        console.error(error);
        alert("❌ Ocurrió un error inesperado al deshacer el pedido.");
      } finally {
        deshaciendoPedidoRef.current = false;
        setDeshaciendoPedidoMaterialId(null);
      }
    },
    [cargar, zonaId]
  );

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
                        onDeshacerPedido={deshacerUltimoPedido}
                        deshaciendoPedidoMaterialId={
                          deshaciendoPedidoMaterialId
                        }
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
        selectedDay={diaProceso}
        onClose={() => {
          setShowConsumo(false);
          setMaterialConsumo(EMPTY_CONSUMO);
          setDiaProceso("");
        }}
        onChange={setValorConsumo}
        onDayChange={setDiaProceso}
        onSubmit={() => void guardarConsumoManual()}
      />
    </PageContainer>
  );
}

export default function InventarioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-10 text-sm text-muted-foreground">
          Cargando inventario...
        </div>
      }
    >
      <InventarioPageContent />
    </Suspense>
  );
}
