import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import { ExamSheet, SheetRow } from './exam-sheet';

// Desenha a folha de avaliação em A4 paisagem, no mesmo formato do formulário em papel:
// técnicas nas linhas, alunos nas colunas (nomes na vertical). Este módulo é carregado
// sob demanda (import dinâmico) para o jsPDF não pesar no carregamento inicial.

const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 10;
const LABEL_W = 58;
const HEADER_H = 32;
const MAX_COLUMNS_PER_PAGE = 25;
/** Com poucos alunos as colunas alargam (quadrados maiores para escrever à mão). */
const MAX_COL_W = 28;
const MAX_ROW_H = 6.5;

const INK: [number, number, number] = [29, 27, 24];
const LINE: [number, number, number] = [125, 115, 104];
const MUTED: [number, number, number] = [95, 88, 80];
const HANKO: [number, number, number] = [198, 40, 40];
const SECTION_FILL: [number, number, number] = [236, 230, 218];
const TOTAL_FILL: [number, number, number] = [246, 242, 234];

export function renderExamPdf(sheet: ExamSheet, generatedAt = new Date()): Blob {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setProperties({ title: pdfText(`${sheet.title} - Shiken Dojo`), creator: 'Shiken Dojo' });

  // Mais de 25 alunos: as colunas continuam na página seguinte, repetindo as técnicas.
  const pages = chunk(
    sheet.columns.map((_, index) => index),
    MAX_COLUMNS_PER_PAGE,
  );
  if (pages.length === 0) pages.push([]);

  pages.forEach((columnIndexes, pageIndex) => {
    if (pageIndex > 0) doc.addPage();
    drawHeader(doc, sheet);
    drawTable(doc, sheet, columnIndexes);
    drawFooter(doc, generatedAt, pageIndex + 1, pages.length);
  });

  return doc.output('blob');
}

function drawHeader(doc: jsPDF, sheet: ExamSheet): void {
  // Ensō com o sol vermelho, como no logotipo.
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.9);
  doc.circle(MARGIN + 5, MARGIN + 4, 5, 'S');
  doc.setFillColor(...HANKO);
  doc.circle(MARGIN + 5, MARGIN + 4, 2.6, 'F');

  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Shiken Dojo', MARGIN + 13, MARGIN + 3);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text(pdfText(sheet.title), MARGIN + 13, MARGIN + 8.5);

  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(pdfText(sheet.statusNote), PAGE_W - MARGIN, MARGIN + 3, { align: 'right' });
  doc.text(pdfText(sheet.scaleNote), PAGE_W - MARGIN, MARGIN + 8.5, { align: 'right' });

  let x = MARGIN;
  const y = MARGIN + 16;
  for (const { label, value } of sheet.info) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MUTED);
    const labelText = `${pdfText(label)}: `;
    doc.text(labelText, x, y);
    x += doc.getTextWidth(labelText);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK);
    const valueText = pdfText(value);
    doc.text(valueText, x, y);
    x += doc.getTextWidth(valueText) + 8;
  }
}

function drawTable(doc: jsPDF, sheet: ExamSheet, columnIndexes: readonly number[]): void {
  const top = MARGIN + 21;
  const footerTop = PAGE_H - MARGIN - 12;
  const colW = Math.min(
    MAX_COL_W,
    (PAGE_W - 2 * MARGIN - LABEL_W) / Math.max(columnIndexes.length, 1),
  );
  const rowH = Math.min(MAX_ROW_H, (footerTop - top - HEADER_H) / sheet.rows.length);
  const tableW = LABEL_W + colW * columnIndexes.length;

  doc.setLineWidth(0.2);
  doc.setDrawColor(...LINE);

  // Cabeçalho: canto + número e nome (vertical) de cada aluno.
  doc.rect(MARGIN, top, LABEL_W, HEADER_H, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Técnica \\ Aluno nº', MARGIN + 2, top + HEADER_H - 2.5);

  columnIndexes.forEach((columnIndex, position) => {
    const column = sheet.columns[columnIndex]!;
    const x = MARGIN + LABEL_W + position * colW;
    doc.rect(x, top, colW, HEADER_H, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(String(column.number), x + colW / 2, top + 4, { align: 'center', baseline: 'middle' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const name = fitText(doc, pdfText(column.name), HEADER_H - 9);
    doc.text(name, x + colW / 2, top + HEADER_H - 2, { angle: 90, baseline: 'middle' });
  });

  let y = top + HEADER_H;
  for (const row of sheet.rows) {
    drawRow(doc, row, columnIndexes, y, rowH, colW, tableW);
    y += rowH;
  }

  // Borda externa e divisória mais forte depois da coluna de técnicas.
  doc.setLineWidth(0.5);
  doc.setDrawColor(...INK);
  doc.rect(MARGIN, top, tableW, y - top, 'S');
  doc.line(MARGIN + LABEL_W, top, MARGIN + LABEL_W, y);
}

function drawRow(
  doc: jsPDF,
  row: SheetRow,
  columnIndexes: readonly number[],
  y: number,
  rowH: number,
  colW: number,
  tableW: number,
): void {
  doc.setLineWidth(0.2);
  doc.setDrawColor(...LINE);
  doc.setTextColor(...INK);
  const middle = y + rowH / 2;

  if (row.kind === 'section') {
    doc.setFillColor(...SECTION_FILL);
    doc.rect(MARGIN, y, tableW, rowH, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(pdfText(row.title), MARGIN + 2, middle, { baseline: 'middle' });
    return;
  }

  const emphasis = row.kind !== 'item';
  const style = emphasis ? 'FD' : 'S';
  // No jsPDF, escrever texto altera a cor de preenchimento: a cor é redefinida antes de cada célula.
  const fillCell = () => {
    if (emphasis) doc.setFillColor(...TOTAL_FILL);
  };

  fillCell();
  doc.rect(MARGIN, y, LABEL_W, rowH, style);
  doc.setFont('helvetica', emphasis ? 'bold' : 'normal');
  doc.setFontSize(8);
  doc.text(fitText(doc, pdfText(row.label), LABEL_W - 4), MARGIN + 2, middle, {
    baseline: 'middle',
  });

  columnIndexes.forEach((columnIndex, position) => {
    const x = MARGIN + LABEL_W + position * colW;
    fillCell();
    doc.rect(x, y, colW, rowH, style); // célula vazia = quadrado em branco
    const value = row.cells[columnIndex] ?? '';
    if (value) {
      const isResult = value === 'Aprovado' || value === 'Reprovado';
      // "Aprovado" acompanha a largura da coluna: pequeno com 25 alunos, legível com poucos.
      doc.setFontSize(isResult ? Math.min(8, Math.max(5.5, colW * 0.5)) : 8.5);
      if (value === 'Aprovado') doc.setTextColor(...HANKO);
      doc.text(fitText(doc, value, colW - 1), x + colW / 2, middle, {
        align: 'center',
        baseline: 'middle',
      });
      doc.setTextColor(...INK);
    }
  });
}

function drawFooter(doc: jsPDF, generatedAt: Date, page: number, pageCount: number): void {
  const y = PAGE_H - MARGIN - 3;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, MARGIN + 85, y);
  doc.line(MARGIN + 100, y, MARGIN + 140, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('Assinatura do(a) examinador(a)', MARGIN, y + 3.5);
  doc.text('Data', MARGIN + 100, y + 3.5);
  doc.text(
    `Gerado em ${format(generatedAt, 'dd/MM/yyyy HH:mm')} - Shiken Dojo - página ${page} de ${pageCount}`,
    PAGE_W - MARGIN,
    y + 3.5,
    { align: 'right' },
  );
}

/**
 * As fontes padrão do PDF cobrem o Latin-1 (acentos do português funcionam),
 * mas não travessões tipográficos, setas ou kanji.
 */
export function pdfText(text: string): string {
  const replaced = text.replace(/[—–]/g, '-').replace(/→/g, '->').replace(/…/g, '...');
  return Array.from(replaced)
    .filter((char) => (char.codePointAt(0) ?? 0) <= LATIN1_MAX)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

const LATIN1_MAX = 0xff;

function fitText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(`${cut}...`) > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}...`;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
