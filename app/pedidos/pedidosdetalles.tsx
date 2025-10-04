"use client";
import { useState, useRef } from "react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function PedidoResumen({
  pedido,
  zonaNombre,
}: {
  pedido: any;
  zonaNombre: string;
}) {
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

  // Descargar como PNG con html-to-image
  const descargarPNG = async () => {
    if (modalRef.current) {
      try {
        modalRef.current.classList.add("export-mode");

        const dataUrl = await toPng(modalRef.current, {
          pixelRatio: 2, // alta resolución
          quality: 1,
          backgroundColor: "#ffffff",
          filter: (node) =>
            !(node instanceof HTMLElement && node.classList.contains("no-export")),
        });

        const link = document.createElement("a");
        link.download = `${titulo}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error("Error al generar el PNG:", err);
      } finally {
        modalRef.current.classList.remove("export-mode");
      }
    }
  };

  // Descargar como PDF con estilos
  const descargarPDF = () => {
    const doc = new jsPDF();

    // Forzar texto negro
    doc.setTextColor(0, 0, 0);

    // Título
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(titulo, 105, 20, { align: "center" });

    // Tabla con estilo
    autoTable(doc, {
      startY: 35,
      head: [["CANTIDAD KILOS", "EMPRESA"]],
      body: empresas.map((e) => [e.kilos || "0 KG", e.nombre]),
      theme: "grid",
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: 0,
        halign: "center",
        valign: "middle",
        fontStyle: "bold",
      },
      bodyStyles: {
        halign: "center",
        valign: "middle",
        textColor: 0,
      },
      styles: {
        lineColor: 0,
        lineWidth: 0.5,
      },
    });

    // Fecha debajo de la tabla
    const finalY = (doc as any).lastAutoTable.finalY || 50;
    const fechaTexto = new Date(pedido.fecha_entrega ?? "").toLocaleDateString(
      "es-ES",
      { weekday: "long", day: "numeric", month: "long" }
    );

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`FECHA DE ENTREGA: ${fechaTexto}`, 14, finalY + 15);

    doc.save(`${titulo}.pdf`);
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

            <table className="w-full border border-black text-sm text-center border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black p-2">CANTIDAD KILOS</th>
                  <th className="border border-black p-2">EMPRESA</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((e, idx) => (
                  <tr key={idx}>
                    <td className="border border-black p-2">
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
                        className="w-full border rounded px-2 py-1 text-sm export-hidden"
                        placeholder="0 KG"
                      />
                      <span className="export-only hidden">{e.kilos || "0 KG"}</span>
                    </td>
                    <td className="border border-black p-2 font-semibold">
                      {e.nombre}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-left mt-4 font-semibold">
              FECHA DE ENTREGA:{" "}
              <span className="text-lg font-semibold text-blue-700">
                {(() => {
                  const fecha = new Date(
                    pedido.fecha_entrega ?? ""
                  ).toLocaleDateString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  });
                  return fecha.charAt(0).toUpperCase() + fecha.slice(1);
                })()}
              </span>
            </p>

            <div className="flex justify-between gap-2 mt-4 no-export">
              <div className="flex gap-2">
                <button
                  onClick={descargarPNG}
                  className="px-3 py-1 rounded border bg-green-600 text-white hover:bg-green-700"
                >
                  Descargar PNG
                </button>
                <button
                  onClick={descargarPDF}
                  className="px-3 py-1 rounded border bg-red-600 text-white hover:bg-red-700"
                >
                  Descargar PDF
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
