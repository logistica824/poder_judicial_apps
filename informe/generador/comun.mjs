// Formato de marca Procom compartido por los informes (docx-js).
import fs from "node:fs";
import {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, Header, Footer,
  AlignmentType, BorderStyle, WidthType, ShadingType, PageNumber, PageBreak, LineRuleType,
  HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, HeadingLevel,
} from "docx";

export const SKILL = process.env.SKILL ?? "/skill";
export const OUT = process.env.OUT ?? "/out/informe.docx";

export const P = {
  verdeTecnologico: "A1C623", verdeVision: "6AB333", verdeEvolucion: "12A039",
  azulProfundo: "1166B0", azulMedio: "2B90CF", celeste: "29B0E6", negro: "1D1E1B",
  azulInstitucional: "182C49", fondoClaro: "EAF4FA", texto: "333333", textoSuave: "6B7280",
  linea: "D9DEE3", zebra: "F4F6F8", blanco: "FFFFFF",
  critico: "C0392B", alto: "E67E22", medio: "F1C40F", ok: "12A039",
};
const FT = "Sofia Sans", FC = "STEM";
export const CLIENTE = "Poder Judicial de la Provincia de Córdoba";
const ANCHO_UTIL = 9638; // A4 (11906) - 2 x 1134

export const img = (f) => fs.readFileSync(f);
export const validaciones = (clave) =>
  JSON.parse(fs.readFileSync(new URL("./validaciones.json", import.meta.url), "utf8"))[clave];

// ---------- helpers de texto ----------
export function runs(texto, base = {}) {
  // **negrita** simple
  return texto.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((t) =>
    t.startsWith("**") ? new TextRun({ ...base, text: t.slice(2, -2), bold: true }) : new TextRun({ ...base, text: t }));
}
export const p = (texto, opts = {}) => new Paragraph({ children: runs(texto), ...opts });
export const pSuave = (texto) => new Paragraph({ children: runs(texto, { size: 18, color: P.textoSuave }) });
export const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
export const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
export const vineta = (t, nivel = 0) => new Paragraph({ numbering: { reference: "vinetas", level: nivel }, children: runs(t), spacing: { after: 60 } });
export const numerado = (t) => new Paragraph({ numbering: { reference: "numeros", level: 0 }, children: runs(t), spacing: { after: 60 } });
export const nota = (t) => new Paragraph({
  children: runs(t, { size: 19, color: P.azulInstitucional }),
  shading: { type: ShadingType.CLEAR, fill: P.fondoClaro, color: "auto" },
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: P.azulProfundo, space: 8 } },
  spacing: { before: 120, after: 160 }, indent: { left: 120, right: 120 },
});
export const salto = () => new Paragraph({ children: [new PageBreak()] });
export const imagen = (data, ancho, alto) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60, line: 240, lineRule: LineRuleType.AUTO },
  children: [new ImageRun({ type: "png", data, transformation: { width: ancho, height: alto } })] });
export const epigrafe = (t) => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, size: 16, color: P.textoSuave, italics: true })] });

// Índice estático: un campo TOC se ve vacío en visores que no recalculan campos.
export const indice = (titulos) => [h1("Índice"), ...titulos.map((t) => new Paragraph({ spacing: { after: 80 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: P.linea, space: 4 } },
  children: [new TextRun({ text: t, font: FT, size: 22, color: P.azulInstitucional })] })), salto()];

// ---------- tablas ----------
const bordesTabla = {
  top: { style: BorderStyle.SINGLE, size: 4, color: P.linea },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: P.linea },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: P.linea },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};
const SEV = { "Crítico": P.critico, "Alto": P.alto, "Medio": P.medio, "Bajo": P.ok };

export function tabla(encabezados, filas, anchosPct) {
  const anchos = anchosPct.map((x) => Math.round((ANCHO_UTIL * x) / 100));
  const celda = (contenido, i, opts = {}) => new TableCell({
    width: { size: anchos[i], type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    ...opts,
    children: (Array.isArray(contenido) ? contenido : [contenido]).map((c) =>
      c instanceof Paragraph ? c : new Paragraph({ spacing: { after: 0 }, children: runs(String(c), { size: 19 }) })),
  });
  const cab = new TableRow({
    tableHeader: true,
    children: encabezados.map((e, i) => celda(
      new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: e, bold: true, color: P.blanco, font: FT, size: 19 })] }),
      i, { shading: { type: ShadingType.CLEAR, fill: P.azulInstitucional, color: "auto" } })),
  });
  const cuerpo = filas.map((f, r) => new TableRow({
    cantSplit: true,
    children: f.map((c, i) => {
      // Semáforo sólo en la columna "Severidad" (no en "Esfuerzo", que usa las mismas palabras).
      const sev = encabezados[i] === "Severidad" ? SEV[c] : undefined;
      if (sev) {
        return celda(new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: c, bold: true, size: 19, color: c === "Medio" ? P.negro : P.blanco })] }), i,
          { shading: { type: ShadingType.CLEAR, fill: sev, color: "auto" } });
      }
      return celda(c, i, r % 2 ? { shading: { type: ShadingType.CLEAR, fill: P.zebra, color: "auto" } } : {});
    }),
  }));
  return [new Table({ width: { size: ANCHO_UTIL, type: WidthType.DXA }, columnWidths: anchos, borders: bordesTabla, rows: [cab, ...cuerpo] }),
    new Paragraph({ spacing: { after: 120 }, children: [] })];
}

// ---------- portada ----------
function portada(titulo, subtitulo, fechaVersion) {
  return [
    new Paragraph({ spacing: { after: 0 }, children: [new ImageRun({
      type: "png", data: img(`${SKILL}/assets/fondo-portada-a4.png`), transformation: { width: 794, height: 1123 },
      floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
        verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 }, behindDocument: true, zIndex: 0 },
    })] }),
    new Paragraph({ spacing: { after: 0, line: 240, lineRule: LineRuleType.AUTO }, children: [new ImageRun({
      type: "png", data: img(`${SKILL}/assets/logo-horizontal-blanco.png`), transformation: { width: 220, height: Math.round(220 / 4.44) } })] }),
    new Paragraph({ spacing: { before: 5200, after: 200 }, children: [new TextRun({ text: titulo, font: FT, size: 64, bold: true, color: P.blanco })] }),
    new Paragraph({ spacing: { after: 280, line: 240, lineRule: LineRuleType.AUTO }, children: [new ImageRun({
      type: "png", data: img(`${SKILL}/assets/barra-gradiente.png`), transformation: { width: 320, height: 6 } })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: CLIENTE, font: FT, size: 30, bold: true, color: P.blanco })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: subtitulo, size: 22, color: P.blanco })] }),
    new Paragraph({ spacing: { after: 1400 }, children: [new TextRun({ text: fechaVersion, size: 22, color: P.blanco })] }),
    new Paragraph({ spacing: { after: 120 }, children: [
      new TextRun({ text: "› ", bold: true, size: 26, color: P.verdeTecnologico }),
      new TextRun({ text: "Doing ", size: 26, color: P.blanco }), new TextRun({ text: "IT", bold: true, size: 26, color: P.verdeTecnologico }),
      new TextRun({ text: " Better Every Day", size: 26, color: P.blanco })] }),
    new Paragraph({ children: [new TextRun({ text: `Documento confidencial — uso exclusivo de ${CLIENTE} y PROCOM IT SOLUTIONS. Prohibida su reproducción total o parcial sin autorización.`, size: 15, color: "C9D3DF" })] }),
  ];
}

const cierre = () => [
  new Paragraph({ spacing: { before: 600, after: 60 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PROCOM IT SOLUTIONS", font: FT, bold: true, size: 26, color: P.azulInstitucional })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [
    new TextRun({ text: "› ", bold: true, color: P.verdeTecnologico }), new TextRun({ text: "Doing ", color: P.azulInstitucional }),
    new TextRun({ text: "IT", bold: true, color: P.verdeTecnologico }), new TextRun({ text: " Better Every Day", color: P.azulInstitucional })] }),
];

// ---------- documento ----------
export async function guardar({ titulo, subtitulo, fechaVersion, cuerpo }) {
  const pieTxt = { font: FC, size: 16, color: P.textoSuave };
  const header = new Header({ children: [new Paragraph({
    tabStops: [{ type: "right", position: ANCHO_UTIL }],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: P.linea, space: 4 } },
    children: [new TextRun({ ...pieTxt, text: titulo }), new TextRun({ ...pieTxt, text: `\t${CLIENTE}` })] })] });
  const footer = new Footer({ children: [new Paragraph({
    tabStops: [{ type: "right", position: ANCHO_UTIL }],
    children: [new TextRun({ ...pieTxt, text: "PROCOM IT SOLUTIONS — Doing IT Better Every Day" }), new TextRun({ ...pieTxt, text: "\tPágina " }),
      new TextRun({ ...pieTxt, children: [PageNumber.CURRENT] }), new TextRun({ ...pieTxt, text: " de " }), new TextRun({ ...pieTxt, children: [PageNumber.TOTAL_PAGES] })] })] });

  const margenes = { top: 1417, bottom: 1417, left: 1134, right: 1134 };
  const doc = new Document({
    creator: "PROCOM IT SOLUTIONS", title: titulo, description: `${subtitulo} — ${CLIENTE}`,
    numbering: { config: [
      { reference: "vinetas", levels: [{ level: 0, format: "bullet", text: "•", alignment: AlignmentType.LEFT, style: { run: { color: P.verdeTecnologico }, paragraph: { indent: { left: 360, hanging: 240 } } } }] },
      { reference: "numeros", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 300 } } } }] },
    ] },
    styles: {
      default: { document: { run: { font: FC, size: 21, color: P.texto }, paragraph: { spacing: { line: 276, lineRule: LineRuleType.AUTO, after: 140 } } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: FT, size: 36, bold: true, color: P.azulInstitucional },
          paragraph: { spacing: { before: 340, after: 180 }, keepNext: true, outlineLevel: 0,
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.verdeTecnologico, space: 6 } } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: FT, size: 28, bold: true, color: P.azulProfundo }, paragraph: { spacing: { before: 260, after: 120 }, keepNext: true, outlineLevel: 1 } },
      ],
    },
    sections: [
      { properties: { page: { margin: margenes } }, children: portada(titulo, subtitulo, fechaVersion) },
      { properties: { page: { margin: margenes } }, headers: { default: header }, footers: { default: footer }, children: [...cuerpo, ...cierre()] },
    ],
  });

  fs.writeFileSync(OUT, await Packer.toBuffer(doc));
  console.log("ok", OUT);
}
