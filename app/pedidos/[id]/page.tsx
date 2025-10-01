"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import MaterialPicker from "@/components/MaterialPicker";
import { AsyncButton } from "@/components/AsyncButton";
import { useToast } from "@/components/toastprovider";
import { fmtNum } from "@/lib/format";

type Pedido = {
  id?: string;
  zona_id: string;
  fecha_pedido: string;
  fecha_entrega: string | null;
  solicitante: string | null;
  estado: "borrador" | "enviado" | "recibido" | "completado";
};

type ItemRow = {
  id?: string;
  material_id: string | null;
  material_nombre?: string;
  presentacion?: number;
  bultos: number;
  kg: number;
};

export default function PedidoEditor() {
  const params = useParams<{ id: string }>();
  const pedidoId = params?.id;
  const router = useRouter();
  const { push } = useToast();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (pedidoId === "nuevo") {
          const { data: zona } = await supabase
            .from("zonas")
            .select("id")
            .eq("activo", true)
            .order("nombre")
            .limit(1)
            .maybeSingle();

          setPedido({
            zona_id: zona?.id ?? "",
            fecha_pedido: new Date().toISOString().slice(0, 10),
            fecha_entrega: null,
            solicitante: null,
            estado: "borrador",
          });
          setItems([]);
          setLoading(false);
          return;
        }

        setLoading(true);
        const { data: ped, error: e1 } = await supabase
          .from("pedidos")
          .select(
            "id,zona_id,fecha_pedido,fecha_entrega,solicitante,estado"
          )
          .eq("id", pedidoId)
          .single();
        if (e1) throw e1;

        const { data: its, error: e2 } = await supabase
          .from("pedido_items")
          .select(
            "id,material_id,bultos,kg,materiales(nombre,presentacion_kg_por_bulto)"
          )
          .eq("pedido_id", pedidoId)
          .order("id");
        if (e2) throw e2;

        const mapped: ItemRow[] =
          (its ?? []).map((r: any) => ({
            id: r.id,
            material_id: r.material_id,
            material_nombre: Array.isArray(r.materiales)
              ? r.materiales[0]?.nombre
              : r.materiales?.nombre ?? "",
            presentacion: Array.isArray(r.materiales)
              ? r.materiales[0]?.presentacion_kg_por_bulto
              : r.materiales?.presentacion_kg_por_bulto ?? undefined,
            bultos: r.bultos ?? 0,
            kg: r.kg ?? 0,
          })) ?? [];

        setPedido(ped as Pedido);
        setItems(mapped);
      } catch (e: any) {
        push(e?.message ?? "No se pudo cargar el pedido", "err");
      } finally {
        setLoading(false);
      }
    })();
  }, [pedidoId, push]);

  const totals = useMemo(() => {
    let b = 0,
      k = 0;
    items.forEach((i) => {
      b += Number(i.bultos || 0);
      k += Number(i.kg || 0);
    });
    return { b, k };
  }, [items]);

  function setItem(idx: number, patch: Partial<ItemRow>) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  async function guardar(cambiarEstado?: Pedido["estado"]) {
    try {
      if (!pedido) return;
      setGuardando(true);

      if (pedido.id) {
        const updateData: any = {
          solicitante: pedido.solicitante,
          fecha_pedido: pedido.fecha_pedido,
          fecha_entrega: pedido.fecha_entrega,
          total_bultos: totals.b,
          total_kg: totals.k,
        };
        if (cambiarEstado) updateData.estado = cambiarEstado;

        const { error: e1 } = await supabase
          .from("pedidos")
          .update(updateData)
          .eq("id", pedido.id);
        if (e1) throw e1;

        const toUpsert = items
          .filter((i) => i.material_id) // 👈 solo con material válido
          .map((i) => ({
            id: i.id,
            pedido_id: pedido.id,
            material_id: i.material_id,
            bultos: i.bultos,
            kg: i.kg,
          }));

        if (toUpsert.length) {
          await supabase.from("pedido_items").upsert(toUpsert);
        }

        setPedido({ ...pedido, ...updateData });
      } else {
        const { data: ins, error: e2 } = await supabase
          .from("pedidos")
          .insert({
            zona_id: pedido.zona_id,
            fecha_pedido: pedido.fecha_pedido,
            fecha_entrega: pedido.fecha_entrega,
            solicitante: pedido.solicitante,
            estado: cambiarEstado ?? "borrador",
            total_bultos: totals.b,
            total_kg: totals.k,
          })
          .select("id,estado")
          .single();
        if (e2) throw e2;

        const nuevos = items
          .filter((i) => i.material_id) // 👈 evitar undefined
          .map((i) => ({
            pedido_id: ins!.id,
            material_id: i.material_id,
            bultos: i.bultos,
            kg: i.kg,
          }));

        if (nuevos.length) {
          await supabase.from("pedido_items").insert(nuevos);
        }
        router.replace(`/pedidos/${ins!.id}`);
        setPedido({ ...pedido, id: ins!.id, estado: ins!.estado });
      }

      push("Pedido guardado");
    } catch (e: any) {
      push(e?.message ?? "Error al guardar", "err");
    } finally {
      setGuardando(false);
    }
  }

  function cancelar() {
    if (!confirm("¿Cancelar este pedido? Perderás los cambios.")) return;
    router.push("/pedidos");
  }

  if (loading || !pedido) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-gray-500">Cargando pedido…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          {pedido.id ? `Pedido #${pedido.id.slice(0, 8)}` : "Nuevo Pedido"}
        </h1>
        <div className="flex flex-wrap gap-2">
          <AsyncButton onClick={() => guardar()} disabled={guardando}>
            Guardar
          </AsyncButton>
          <AsyncButton
            onClick={() => guardar("enviado")}
            disabled={guardando || pedido.estado === "enviado"}
          >
            Enviar
          </AsyncButton>
          <AsyncButton
            onClick={() => guardar("completado")}
            disabled={guardando || pedido.estado === "completado"}
          >
            Completar
          </AsyncButton>
          <button
            onClick={cancelar}
            className="rounded-lg border px-3 py-2 text-sm text-rose-700"
          >
            Cancelar
          </button>
        </div>
      </header>

      {/* fechas */}
      <div className="flex gap-6">
        <div>
          <label className="block text-xs text-gray-500">Fecha pedido</label>
          <input
            type="date"
            value={pedido.fecha_pedido.slice(0, 10)}
            onChange={(e) =>
              setPedido({ ...pedido, fecha_pedido: e.target.value })
            }
            className="rounded-lg border px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Fecha entrega</label>
          <input
            type="date"
            value={pedido.fecha_entrega ?? ""}
            onChange={(e) =>
              setPedido({ ...pedido, fecha_entrega: e.target.value })
            }
            className="rounded-lg border px-2 py-1 text-sm"
          />
        </div>
      </div>

      {/* tabla items */}
      <section className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2 w-[350px]">Material</th>
              <th className="p-2">Presentación</th>
              <th className="p-2">Bultos</th>
              <th className="p-2">Kg</th>
              <th className="p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, idx) => (
              <tr key={row.id ?? idx} className="border-b">
                <td className="p-2 w-[350px]">
                  <MaterialPicker
                    zonaId={pedido.zona_id}
                    value={row.material_id ?? ""}
                    onChange={(material_id, meta: any) => {
                      setItem(idx, {
                        material_id,
                        material_nombre: meta?.nombre,
                        presentacion: meta?.presentacion_kg_por_bulto,
                        kg:
                          (meta?.presentacion_kg_por_bulto ?? 0) *
                          (row.bultos ?? 0),
                      });
                    }}
                  />
                </td>
                <td className="p-2">{fmtNum(row.presentacion ?? 0)} kg/bulto</td>
                <td className="p-2">
                  <input
                    type="number"
                    min={0}
                    value={row.bultos}
                    onChange={(e) => {
                      const b = Number(e.target.value || 0);
                      setItem(idx, {
                        bultos: b,
                        kg: (row.presentacion ?? 0) * b,
                      });
                    }}
                    className="w-24 rounded-lg border px-2 py-1"
                  />
                </td>
                <td className="p-2">{fmtNum(row.kg)}</td>
                <td className="p-2">
                  <button
                    onClick={() =>
                      setItems((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="rounded-lg border px-3 py-1 text-sm text-rose-700"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td className="p-4 text-center text-gray-500" colSpan={5}>
                  Sin ítems. Agrega materiales abajo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <button
        onClick={() =>
          setItems((prev) => [
            ...prev,
            { material_id: null, bultos: 0, kg: 0, presentacion: undefined },
          ])
        }
        className="rounded-lg border px-3 py-2 text-sm"
      >
        + Agregar material
      </button>

      {/* totales */}
      <div className="mt-4 rounded-lg border p-3">
        <div className="text-xs text-gray-500">Totales</div>
        <div className="text-lg">
          {fmtNum(totals.b)} b / {fmtNum(totals.k)} kg
        </div>
        <div className="text-sm text-gray-500 mt-1">
          Estado actual: <strong>{pedido.estado}</strong>
        </div>
      </div>
    </main>
  );
}
