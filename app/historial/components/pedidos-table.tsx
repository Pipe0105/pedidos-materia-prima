import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { fmtNum } from "@/lib/format";

import { PedidoEstadoBadge } from "@/app/historial/components/pedido-estado-badge";
import type { Pedido } from "@/app/historial/types";

type PedidosTableProps = {
  pedidos: Pedido[];
};

function formatMaterial(pedido: Pedido) {
  if (!pedido.pedido_items?.length) return "Sin materiales";

  return pedido.pedido_items.map((item) => {
    const unidades = item.bultos ?? item.kg ?? 0;
    const unidadMedida = item.materiales?.unidad_medida ?? "unidad";
    const nombre = item.materiales?.nombre ?? "Material";
    return `${fmtNum(unidades)} ${unidadMedida}${
      unidades === 1 ? "" : "s"
    } · ${nombre}`;
  });
}

export function PedidosTable({ pedidos }: PedidosTableProps) {
  const router = useRouter();

  const rows = useMemo(
    () =>
      pedidos.map((pedido) => ({
        ...pedido,
        materiales: formatMaterial(pedido),
      })),
    [pedidos]
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="max-h-[520px] overflow-x-auto overflow-y-auto">
        <table className="min-w-[720px] w-full divide-y divide-slate-200 text-left text-sm">
          {""}
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr className="text-center">
              <th scope="col" className="px-4 py-3">
                Fecha pedido
              </th>
              <th scope="col" className="px-4 py-3">
                Fecha entrega
              </th>
              <th scope="col" className="px-4 py-3">
                Solicitante
              </th>
              <th scope="col" className="px-4 py-3">
                Estado
              </th>
              <th scope="col" className="px-4 py-3">
                Materiales
              </th>
              <th scope="col" className="px-4 py-3">
                Totales
              </th>
              <th scope="col" className="px-4 py-3 ">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((pedido) => (
              <tr
                key={pedido.id}
                className="odd:bg-white even:bg-slate-50/60 text-center"
              >
                <td className="px-4 py-3 text-slate-700">
                  {pedido.fecha_pedido?.slice(0, 10) ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {pedido.fecha_entrega
                    ? pedido.fecha_entrega.slice(0, 10)
                    : "—"}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {pedido.solicitante ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <PedidoEstadoBadge pedido={pedido} />
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {Array.isArray(pedido.materiales) ? (
                    <ul className="flex flex-col gap-1">
                      {pedido.materiales.map((material) => (
                        <li
                          key={`${pedido.id}-${material}`}
                          className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                        >
                          {material}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-500">Sin materiales</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <div className="flex flex-col text-xs font-medium text-slate-600">
                    <span>{fmtNum(pedido.total_bultos ?? 0)} bultos</span>
                    <span>{fmtNum(pedido.total_kg ?? 0)} kg</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/pedidos/${pedido.id}/ver`)}
                      className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-100"
                    >
                      Ver detalle
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/pedidos/${pedido.id}`)}
                      className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:border-amber-200 hover:bg-amber-100"
                    >
                      Editar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
