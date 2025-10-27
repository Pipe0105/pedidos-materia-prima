"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fmtNum } from "@/lib/format";
import { useToast } from "@/components/toastprovider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PedidoDetalle from "./pedidosdetalles";
import {
  getPedidosCache,
  invalidatePedidosCache,
  PEDIDOS_CACHE_TTL,
  setPedidosCache,
} from "./pedidosCache";

type unidadMedida = "bulto" | "unidad" | "litro" | null;

type PedidoItem = {
  bultos: number;
  kg: number | null;
  materiales: {
    nombre: string | null;
    unidad_medida: unidadMedida;
  } | null;
};

type Pedido = {
  id: string;
  fecha_pedido: string;
  fecha_entrega: string | null;
  solicitante: string | null;
  estado: "enviado" | "recibido" | "completado";
  total_bultos?: number | null;
  total_kg?: number | null;
  notas?: string | null;
  pedido_items?: PedidoItem[];
};

type MovimientoItem = {
  id: string;
  material_id: string;
  bultos: number;
  kg: number | null;
  materiales: {
    unidad_medida: "bulto" | "unidad" | "litro" | null;
    presentacion_kg_por_bulto: number | null;
  } | null;
};

type PedidoItemFromSupabase = Omit<PedidoItem, "materiales"> & {
  materiales:
    | { nombre: string | null; unidad_medida: unidadMedida }
    | { nombre: string | null; unidad_medida: unidadMedida }[]
    | null;
};

type PedidoFromSupabase = Omit<Pedido, "pedido_items"> & {
  pedido_items: PedidoItemFromSupabase[] | null;
};

type MovimientoItemFromSupabase = Omit<MovimientoItem, "materiales"> & {
  materiales:
    | {
        unidad_medida: unidadMedida;
        presentacion_kg_por_bulto: number | null;
      }[]
    | null;
};

const ESTADO_LABELS: Record<Pedido["estado"], string> = {
  enviado: "Enviados",
  recibido: "Recibidos",
  completado: "Completados",
};

const ESTADO_HELPERS: Record<Pedido["estado"], string> = {
  enviado: "Pedidos recién solicitados",
  recibido: "Pendientes de completar",
  completado: "Ingresados al inventario",
};

export default function PedidosZona({
  zonaId,
  nombre,
}: {
  zonaId: string;
  nombre: string;
}) {
  const router = useRouter();
  const { notify } = useToast();

  const cached = getPedidosCache<Pedido[]>(zonaId);
  const [pedidos, setPedidos] = useState<Pedido[]>(cached?.data ?? []);
  const [loading, setLoading] = useState(!cached);
  const [q, setQ] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<Pedido["estado"] | "">("");
  const [mostrarCompletados, setMostrarCompletados] = useState(false);
  const [deshaciendoPedido, setDeshaciendoPedido] = useState(false);

  const resumenPorEstado = useMemo(() => {
    return pedidos.reduce<Record<Pedido["estado"], number>>(
      (acc, pedido) => {
        acc[pedido.estado] = acc[pedido.estado] + 1;
        return acc;
      },
      { enviado: 0, recibido: 0, completado: 0 }
    );
  }, [pedidos]);

  const cargarPedidos = useCallback(
    async ({ force } = { force: false }) => {
      const cache = getPedidosCache<Pedido[]>(zonaId);

      if (!force && cache) {
        setPedidos(cache.data);
        if (Date.now() - cache.fetchedAt < PEDIDOS_CACHE_TTL) {
          setLoading(false);
          return;
        }
      }

      setLoading(!cache || force);
      const { data, error } = await supabase
        .from("pedidos")
        .select(
          `
          id, fecha_pedido, fecha_entrega, solicitante, estado, total_bultos, total_kg, notas,
        pedido_items (
          bultos, kg,
          materiales (nombre, unidad_medida)

        )
      `
        )
        .eq("zona_id", zonaId)
        .order("fecha_pedido", { ascending: false });

      if (error) {
        notify("Error cargando pedidos: " + error.message, "error");
      } else {
        const normalizados = (data ?? []).map((pedido) => {
          const pedidoTyped = pedido as PedidoFromSupabase;
          const items = pedidoTyped.pedido_items?.map((item) => {
            const itemTyped = item as PedidoItemFromSupabase;
            const materialRaw = itemTyped.materiales;
            const material = Array.isArray(materialRaw)
              ? materialRaw[0] ?? null
              : materialRaw ?? null;
            return {
              ...itemTyped,
              materiales: material
                ? {
                    nombre: material.nombre ?? null,
                    unidad_medida: material.unidad_medida ?? null,
                  }
                : null,
            } satisfies PedidoItem;
          });

          return {
            ...pedidoTyped,
            pedido_items: items,
          } satisfies Pedido;
        });

        setPedidos(normalizados);
        setPedidosCache(zonaId, normalizados);
      }
      setLoading(false);
    },
    [zonaId, notify]
  );

  useEffect(() => {
    void cargarPedidos();
  }, [cargarPedidos]);

  const deshacerUltimoPedido = useCallback(async () => {
    if (deshaciendoPedido) return;

    const confirmar = window.confirm(
      "¿Deseas deshacer el último pedido completado de esta planta?"
    );

    if (!confirmar) return;

    setDeshaciendoPedido(true);

    try {
      const { data: ultimoMovimiento, error: ultimoError } = await supabase
        .from("movimientos_inventario")
        .select("ref_id")
        .eq("zona_id", zonaId)
        .eq("ref_tipo", "pedido")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ultimoError) {
        console.error(ultimoError);
        notify(
          "No pudimos buscar pedidos completados recientes. Intenta más tarde.",
          "error"
        );
        return;
      }

      const pedidoId = ultimoMovimiento?.ref_id;

      if (!pedidoId) {
        notify(
          "No hay pedidos completados para deshacer en esta planta.",
          "info"
        );
        return;
      }

      const { data: pedidoActual, error: pedidoError } = await supabase
        .from("pedidos")
        .select("id, estado")
        .eq("id", pedidoId)
        .maybeSingle();

      if (pedidoError) {
        console.error(pedidoError);
        notify(
          "No pudimos verificar el estado del pedido seleccionado.",
          "error"
        );
        return;
      }

      if (!pedidoActual || pedidoActual.estado !== "completado") {
        notify(
          "El último pedido encontrado ya no figura como completado.",
          "warning"
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
        notify("Error obteniendo los movimientos del pedido.", "error");
        return;
      }

      if (!movimientosPedido?.length) {
        notify(
          "No encontramos movimientos de inventario asociados a ese pedido.",
          "warning"
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

      const { data: movimientosInsertados, error: insertError } = await supabase
        .from("movimientos_inventario")
        .insert(movimientosReverso)
        .select("id")
        .returns<{ id: string }[]>();

      if (insertError) {
        console.error(insertError);
        notify("No pudimos registrar la reversión del pedido.", "error");
        return;
      }

      const { error: actualizarPedidoError } = await supabase
        .from("pedidos")
        .update({ estado: "recibido", inventario_posteado: false })
        .eq("id", pedidoId);

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
        notify(
          "No se pudo actualizar el pedido. Intenta nuevamente en unos minutos.",
          "error"
        );
        return;
      }

      notify(
        "Pedido deshecho ✅ y devuelto a la lista de pedidos recibidos.",
        "success"
      );

      setPedidos((prev) => {
        const actualizados = prev.map(
          (pedido): Pedido =>
            pedido.id === pedidoId ? { ...pedido, estado: "recibido" } : pedido
        );
        setPedidosCache(zonaId, actualizados);
        return actualizados;
      });

      await cargarPedidos({ force: true });

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("pedidos:invalidate", { detail: { zonaId } })
        );
      }
    } catch (error) {
      console.error(error);
      notify("Ocurrió un error inesperado al deshacer el pedido.", "error");
    } finally {
      setDeshaciendoPedido(false);
    }
  }, [cargarPedidos, deshaciendoPedido, notify, zonaId]);
  const filtrados = useMemo(() => {
    return pedidos
      .filter((p) =>
        q ? (p.solicitante ?? "").toLowerCase().includes(q.toLowerCase()) : true
      )
      .filter((p) => (estadoFiltro ? p.estado === estadoFiltro : true))
      .filter((p) => (mostrarCompletados ? true : p.estado !== "completado"));
  }, [pedidos, q, estadoFiltro, mostrarCompletados]);

  async function eliminarPedido(id: string) {
    if (!confirm("¿Eliminar este pedido?")) return;
    const { error } = await supabase.from("pedidos").delete().eq("id", id);
    if (error) {
      notify("Error al eliminar pedido: " + error.message, "error");
    } else {
      setPedidos((prev) => {
        const actualizados = prev.filter((p) => p.id !== id);
        setPedidosCache(zonaId, actualizados);
        return actualizados;
      });
      notify("Pedido eliminado ✅", "success");
    }
  }

  async function marcarCompletado(id: string) {
    const { data: items, error: errItems } = await supabase
      .from("pedido_items")
      .select(
        `id, material_id, bultos, kg,
         materiales ( unidad_medida, presentacion_kg_por_bulto )`
      )
      .eq("pedido_id", id);

    if (errItems) {
      notify("Error cargando materiales: " + errItems.message, "error");
      return;
    }

    const typedItems = (items ?? []).map((item) => {
      const itemTyped = item as MovimientoItemFromSupabase;
      return {
        ...itemTyped,
        materiales: itemTyped.materiales?.[0] ?? null,
      } satisfies MovimientoItem;
    });
    const movimientos = typedItems.map((item) => {
      const unidad = item.materiales?.unidad_medida;
      const presentacion = item.materiales?.presentacion_kg_por_bulto;
      let kg = 0;

      if (unidad === "bulto") {
        kg = item.kg ?? (presentacion ? item.bultos * presentacion : 0);
      } else if (unidad === "litro") {
        kg = item.kg ?? item.bultos;
      } else {
        kg = item.kg ?? (presentacion ? item.bultos * presentacion : 0);
      }

      return {
        zona_id: zonaId,
        material_id: item.material_id,
        fecha: new Date().toISOString().slice(0, 10),
        tipo: "entrada",
        bultos: item.bultos,
        kg,
        ref_tipo: "pedido",
        ref_id: id,
        notas: "Ingreso por pedido completado",
      };
    });

    const { error: errMov } = await supabase
      .from("movimientos_inventario")
      .insert(movimientos);

    if (errMov) {
      notify("Error registrando inventario: " + errMov.message, "error");
      return;
    }

    const { error } = await supabase
      .from("pedidos")
      .update({ estado: "completado" })
      .eq("id", id);

    if (error) {
      notify("Error al completar pedido: " + error.message, "error");
    } else {
      setPedidos((prev) => {
        const actualizados = prev.map(
          (p): Pedido => (p.id === id ? { ...p, estado: "completado" } : p)
        );
        setPedidosCache(zonaId, actualizados);
        return actualizados;
      });
      notify("Pedido completado ✅, inventario actualizado", "success");
    }
  }

  useEffect(() => {
    const handleInvalidate = (event: Event) => {
      const customEvent = event as CustomEvent<{ zonaId?: string }>;
      if (!customEvent.detail?.zonaId || customEvent.detail.zonaId === zonaId) {
        invalidatePedidosCache(customEvent.detail?.zonaId);
        void cargarPedidos({ force: true });
      }
    };

    window.addEventListener("pedidos:invalidate", handleInvalidate);
    return () => {
      window.removeEventListener("pedidos:invalidate", handleInvalidate);
    };
  }, [zonaId, cargarPedidos]);

  const badgeEstado = (estado: Pedido["estado"]) => {
    const base =
      "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold";
    switch (estado) {
      case "enviado":
        return (
          <span className={`${base} bg-blue-100 text-blue-700`}>Enviado</span>
        );
      case "recibido":
        return (
          <span className={`${base} bg-amber-100 text-amber-700`}>
            Recibido
          </span>
        );
      case "completado":
        return (
          <span className={`${base} bg-emerald-100 text-emerald-700`}>
            Completado
          </span>
        );
    }
  };

  const renderTotales = (pedido: Pedido) => {
    if (!pedido.pedido_items?.length) {
      return <span className="text-muted-foreground">Sin materiales</span>;
    }

    return (
      <div className="flex flex-wrap justify-center gap-2">
        {pedido.pedido_items.map((item: PedidoItem, index) => {
          const unidad = item.materiales?.unidad_medida ?? "bulto";
          const nombreMaterial =
            item.materiales?.nombre ?? "Material sin nombre";
          const cantidad = (() => {
            if (unidad === "unidad") {
              return `${fmtNum(item.bultos ?? 0)} unidades`;
            }

            if (unidad === "litro") {
              return `${fmtNum(item.bultos ?? 0)} litros`;
            }

            return `${fmtNum(item.bultos ?? 0)} bultos`;
          })();

          const extras: string[] = [];
          if (
            (unidad === "bulto" || unidad === "litro") &&
            (item.kg ?? 0) > 0
          ) {
            extras.push(`${fmtNum(item.kg ?? 0)} kg`);
          }

          const texto = [cantidad, ...extras].join(" · ");

          return (
            <span
              key={`${pedido.id}-${index}`}
              className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              {`${nombreMaterial} · ${texto}`}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader className="gap-6 md:flex md:items-center md:justify-between">
          <div>
            <CardTitle className="text-2xl">Pedidos de {nombre}</CardTitle>
            <CardDescription></CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => void deshacerUltimoPedido()}
              disabled={deshaciendoPedido}
              className="bg-amber-100 text-amber-800 hover:bg-amber-200"
            >
              {deshaciendoPedido
                ? "Deshaciendo pedido..."
                : "Deshacer pedido completado"}
            </Button>
            <Button
              onClick={() =>
                router.push(
                  `/pedidos/nuevo?zonaId=${zonaId}&zonaNombre=${encodeURIComponent(
                    nombre
                  )}`
                )
              }
            >
              Crear nuevo pedido
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {(Object.keys(resumenPorEstado) as Pedido["estado"][]).map(
              (estado) => (
                <div
                  key={estado}
                  className="rounded-xl border bg-gradient-to-br from-background via-background to-muted/60 p-4"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {ESTADO_LABELS[estado]}
                  </p>
                  <p className="mt-2 text-3xl font-semibold">
                    {fmtNum(resumenPorEstado[estado])}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {ESTADO_HELPERS[estado]}
                  </p>
                </div>
              )
            )}
          </div>
          <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground"></p>
            <p>
              Completa el pedido cuando llegue la mercancía para actualizar el
              inventario.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>Filtros Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Solicitante
              </label>
              <Input
                placeholder="Ej. Juan Pérez"
                value={q}
                onChange={(event) => setQ(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Estado
              </label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={estadoFiltro}
                onChange={(event) =>
                  setEstadoFiltro(event.target.value as Pedido["estado"] | "")
                }
              >
                <option value="">Todos los estados</option>
                <option value="enviado">Enviado</option>
                <option value="recibido">Recibido</option>
                <option value="completado">Completado</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Mostrar completados
              </label>
              <label className="flex h-10 items-center gap-3 rounded-md border border-input bg-background px-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input text-primary focus:ring-primary"
                  checked={mostrarCompletados}
                  onChange={(event) =>
                    setMostrarCompletados(event.target.checked)
                  }
                />
                Sí
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>Pedidos Enviados</CardTitle>
          <CardDescription>
            Selecciona un pedido para ver su detalle, completarlo o eliminarlo
            si fue un error.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              <div className="h-10 animate-pulse rounded-lg bg-muted" />
              <div className="h-10 animate-pulse rounded-lg bg-muted" />
              <div className="h-10 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : filtrados.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Fecha pedido</TableHead>
                  <TableHead className="text-center">Fecha entrega</TableHead>
                  <TableHead className="text-center">Solicitante</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-center">Totales</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((pedido) => (
                  <TableRow key={pedido.id}>
                    <TableCell className="text-center">
                      {pedido.fecha_pedido?.slice(0, 10) ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {pedido.fecha_entrega
                        ? pedido.fecha_entrega.slice(0, 10)
                        : "Pendiente"}
                    </TableCell>
                    <TableCell className="text-center">
                      {pedido.solicitante ?? "Sin solicitante"}
                    </TableCell>
                    <TableCell className="text-center">
                      {badgeEstado(pedido.estado)}
                    </TableCell>
                    <TableCell className="text-center">
                      {renderTotales(pedido)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <PedidoDetalle pedido={pedido} zonaNombre={nombre} />
                        {pedido.estado !== "completado" && (
                          <Button
                            className="bg-green-700 text-white h-7 border-current"
                            variant="secondary"
                            onClick={() => marcarCompletado(pedido.id)}
                          >
                            Completar
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          onClick={() => eliminarPedido(pedido.id)}
                          className="bg-red-600 h-7 text-white"
                        >
                          Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="font-semibold text-foreground">
                No encontramos pedidos en esta planta
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                Usa el botón “Crear nuevo pedido” para registrar la primera
                solicitud.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
