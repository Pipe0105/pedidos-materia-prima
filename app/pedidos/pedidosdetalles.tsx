"use client";
import { useState, useRef } from "react";
import html2canvas from "html2canvas";

export default function PedidoResumen({ pedido, zonaNombre }: { pedido: any; zonaNombre: string }) {
  const [open, setOpen] = useState(false);
  const [empresas, setEmpresas] = useState([
    { nombre: "MERCAMIO", kilos: "" },
    { nombre: "COMERCIALIZADORA", kilos: "" },
  ]);

  const modalRef = useRef<HTMLDivElement>(null);

  const titulo =
    zonaNombre === "Desposte"
      ? "PEDIDO SALMUERA CARNES"
      : zonaNombre === "Desprese"
      ? "PEDIDO SALMUERA POLLO"
      : "PEDIDO PANIFICADORA";

  // Descargar como PNG
  const descargarPNG = async () => {
    if (modalRef.current) {
      const canvas = await html2canvas(modalRef.current);
      const link = document.createElement("a");
      link.download = `${titulo}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    }
  };

  // Descargar como CSV
  const descargarCSV = () => {
    const header = ["EMPRESA", "KILOS"];
    const rows = empresas.map((e) => [e.nombre, e.kilos || "0"]);
    const csvContent = [header, ...rows].map((r) => r.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${titulo}.csv`);
    link.click();
  };

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
          <div
            ref={modalRef}
            className="bg-white rounded-lg shadow-lg w-[500px] p-6 space-y-4"
          >
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

            {/* Fecha de entrega */}
            <p className="text-left mt-4 font-semibold">
              FECHA DE ENTREGA:{" "}
              <span className="text-lg font-semibold text-blue-700">
                {(() => {
                  const fecha = new Date(pedido.fecha_entrega ?? "").toLocaleDateString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  });
                  return fecha.charAt(0).toUpperCase() + fecha.slice(1);
                })()}
              </span>
            </p>

            {/* Botones */}
            <div className="flex justify-between gap-2 mt-4">
              <div className="flex gap-2">
                <button
                  onClick={descargarPNG}
                  className="px-3 py-1 rounded border bg-green-600 text-white hover:bg-green-700"
                >
                  Descargar PNG
                </button>
                <button
                  onClick={descargarCSV}
                  className="px-3 py-1 rounded border bg-orange-600 text-white hover:bg-orange-700"
                >
                  Descargar CSV
                </button>
              </div>

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
