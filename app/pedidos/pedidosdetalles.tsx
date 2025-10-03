import { useState } from "react";

export default function PedidoResumen({ pedido, zonaNombre }: { pedido: any; zonaNombre: string }) {
  const [open, setOpen] = useState(false);
  const [empresas, setEmpresas] = useState([
    { nombre: "MERCAMIO", kilos: "" },
    { nombre: "COMERCIALIZADORA", kilos: "" },
  ]);

  const titulo =
    zonaNombre === "Desposte"
      ? "PEDIDO SALMUERA CARNES"
      : zonaNombre === "Desprese"
      ? "PEDIDO SALMUERA POLLO"
      : "PEDIDO PANIFICADORA";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-blue-600 text-white px-3 py-1 text-sm hover:bg-blue-700"
      >
        Ver formato
      </button>

      {open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg w-[500px] p-6 space-y-4">
            <h2 className="text-xl font-bold text-center">{titulo}</h2>

            <table className="w-full border text-sm text-center">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2">CANTIDAD KILOS</th>
                  <th className="border p-2">EMPRESA</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((e, idx) => (
                  <tr key={idx}>
                    <td className="border p-2">
                      <input
                        type="text"
                        value={e.kilos}
                        onChange={(ev) =>
                          setEmpresas((prev) =>
                            prev.map((p, i) =>
                              i === idx ? { ...p, kilos: ev.target.value } : p
                            )
                          )
                        }
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder="0 KG"
                      />
                    </td>
                    <td className="border p-2 font-semibold">{e.nombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-right mt-4 font-semibold">
              FECHA DE ENTREGA:{" "}
              <span className="text-blue-700">
                {new Date(pedido.fecha_entrega ?? "").toLocaleDateString("es-ES", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </span>
            </p>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1 rounded border hover:bg-gray-100"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
