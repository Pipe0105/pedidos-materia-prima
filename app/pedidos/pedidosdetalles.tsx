"use client";
import { useState, useRef } from "react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type UnidadMedida = "bulto" | "unidad" | "litro" | null;

type jsPDFWithAutoTable = InstanceType<typeof jsPDF> & {
  lastAutoTable?: { finalY?: number };
};

type PedidoItem = {
  bultos: number | null;
  kg: number | null;
  materiales: {
    nombre: string | null;
    unidad_medida: UnidadMedida;
  } | null;
};

type PedidoResumenData = {
  total_bultos?: number | null;
  total_kg?: number | null;
  fecha_entrega?: string | null;
  pedido_items?: PedidoItem[] | null;
};

type PedidoResumenProps = {
  pedido: PedidoResumenData;
  zonaNombre: string;
};

export default function PedidoResumen({
  pedido,
  zonaNombre,
}: PedidoResumenProps) {
  const [open, setOpen] = useState(false);
  const [empresas, setEmpresas] = useState([
    { nombre: "MERCAMIO", bultos: 0, kilos: 0 },
    { nombre: "COMERCIALIZADORA", bultos: 0, kilos: 0 },
  ]);

  const modalRef = useRef<HTMLDivElement>(null);

  const esPedidoMateriales = Array.isArray(pedido?.pedido_items)
    ? pedido.pedido_items.some((item) => item?.materiales)
    : false;

  const formatNumber = (value: number | null | undefined) =>
    new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value ?? 0);

  const unidadLabels: Record<string, string> = {
    bulto: "BULTOS",
    unidad: "UNIDADES",
    litro: "LITROS",
  };

  const primerMaterial = esPedidoMateriales
    ? (pedido.pedido_items ?? []).find((item) => item?.materiales?.nombre)
    : null;

  const unidadPrincipal = primerMaterial?.materiales?.unidad_medida ?? null;

  const tituloBase = esPedidoMateriales
    ? `PEDIDO ${
        primerMaterial?.materiales?.nombre
          ? primerMaterial.materiales.nombre.toUpperCase()
          : "MATERIALES"
      }`
    : zonaNombre === "Desposte"
    ? "PEDIDO SALMUERA CARNES"
    : zonaNombre === "Desprese"
    ? "PEDIDO SALMUERA POLLO"
    : "PEDIDO PANIFICADORA";

  const titulo = zonaNombre
    ? `${tituloBase} ${zonaNombre.toUpperCase()}`
    : tituloBase;

  const encabezadoCantidad = esPedidoMateriales
    ? `CANTIDAD ${
        unidadPrincipal ? unidadLabels[unidadPrincipal] ?? "BULTOS" : "BULTOS"
      }`
    : "CANTIDAD BULTOS";

  const etiquetaCantidad = esPedidoMateriales
    ? unidadLabels[unidadPrincipal ?? ""] ?? undefined
    : undefined;

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
            !(
              node instanceof HTMLElement &&
              node.classList.contains("no-export")
            ),
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
      head: [[encabezadoCantidad, "CANTIDAD KILOS", "EMPRESA"]],
      body: empresas.map((e) => [
        `${formatNumber(e.bultos ?? 0)}${
          etiquetaCantidad ? ` ${etiquetaCantidad}` : ""
        }`,
        e.kilos ? `${formatNumber(e.kilos)} KG` : "0 KG",
        e.nombre,
      ]),
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

    // Información adicional debajo de la tabla
    const docWithAutoTable = doc as jsPDFWithAutoTable;
    const finalY = docWithAutoTable.lastAutoTable?.finalY ?? 50;
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
        onClick={() => {
          // calcular reparto automático
          const bultosTotales = pedido.total_bultos ?? 0;
          const kilosTotales = pedido.total_kg ?? 0;

          // 60% para Mercamio, 40% para Comercializadora
          const mercamioBultos = Math.round(bultosTotales * 0.6);
          const comercialBultos = bultosTotales - mercamioBultos;

          const mercamioKg = Math.round(kilosTotales * 0.6);
          const comercialKg = kilosTotales - mercamioKg;

          setEmpresas([
            { nombre: "MERCAMIO", bultos: mercamioBultos, kilos: mercamioKg },
            {
              nombre: "COMERCIALIZADORA",
              bultos: comercialBultos,
              kilos: comercialKg,
            },
          ]);
          setOpen(true);
        }}
        className="rounded bg-blue-600 text-white px-3 py-1 text-sm hover:bg-blue-700"
      >
        Ver formato
      </button>
      {open && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40"
          onClick={() => setOpen(false)} // 👈 cierra al hacer clic fuera
        >
          <div
            ref={modalRef}
            onClick={(e) => e.stopPropagation()} // 👈 evita cierre al hacer clic dentro
            className="bg-white rounded-lg shadow-lg w-[500px] p-6 space-y-4"
          >
            <h2 className="text-xl font-bold text-center">{titulo}</h2>

            <table className="w-full border border-black text-sm text-center border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border-black p-2">{encabezadoCantidad}</th>
                  <th className="border border-black p-2">CANTIDAD KILOS</th>
                  <th className="border border-black p-2">EMPRESA</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((e, idx) => (
                  <tr key={idx}>
                    {/* Nueva columna: BULTOS */}
                    <td className="border border-black p-2 font text-base">
                      <span>
                        {formatNumber(e.bultos ?? 0)}
                        {etiquetaCantidad ? ` ${etiquetaCantidad}` : ""}
                      </span>
                    </td>

                    {/* Columna existente: KILOS */}
                    <td className="border border-black p-2 text-base">
                      <span>
                        {e.kilos ? `${formatNumber(e.kilos)} KG` : "0 KG"}
                      </span>
                    </td>

                    {/* EMPRESA */}
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
                  const fechaBase = new Date(pedido.fecha_entrega ?? "");

                  fechaBase.setDate(fechaBase.getDate() + 1);

                  const fecha = fechaBase.toLocaleDateString("es-ES", {
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
