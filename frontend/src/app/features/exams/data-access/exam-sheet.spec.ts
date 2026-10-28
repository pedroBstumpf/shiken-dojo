import { Exam } from '@shared/data-access/exams/exam.model';
import { renderExamPdf, pdfText } from './exam-pdf';
import { buildExamSheet, examPdfFileName, SheetRow } from './exam-sheet';

const exam: Exam = {
  id: 'e1',
  status: 'draft',
  templateId: 't1',
  templateName: 'Exame de faixa — Branca a Laranja',
  fromBelt: 'branca',
  toBelt: 'laranja',
  sections: [
    {
      id: 'k1',
      title: 'Kihon — parte 1',
      kanji: '基本',
      showTotal: true,
      items: [
        { id: 'i1', label: 'Maegueri/zenkutso' },
        { id: 'i2', label: 'Mawashi-Gueri' },
      ],
    },
  ],
  date: new Date(2026, 5, 20),
  location: 'Dojo central',
  examinerId: 'tch-001',
  examinerName: 'Hiroshi Okada',
  passingGrade: 2,
  notes: '',
  participants: [
    { studentId: 's1', fullName: 'Ana Beatriz Carvalho', belt: 'branca' },
    { studentId: 's2', fullName: 'Bruno Lima', belt: 'branca' },
  ],
  // s1 completo; s2 com uma nota faltando.
  grades: { s1: { i1: 3, i2: 2 }, s2: { i1: 1.5 } },
  createdAt: new Date(),
  updatedAt: new Date(),
  completedAt: null,
};

function row(rows: readonly SheetRow[], label: string) {
  const found = rows.find((r) => r.kind !== 'section' && r.label.startsWith(label));
  if (!found || found.kind === 'section') throw new Error(`linha ${label} não encontrada`);
  return found.cells;
}

describe('buildExamSheet', () => {
  it('mantém notas lançadas e deixa em branco o que falta (prova incompleta)', () => {
    const sheet = buildExamSheet(exam, 'filled');
    expect(row(sheet.rows, 'Maegueri')).toEqual(['3', '1,5']);
    expect(row(sheet.rows, 'Mawashi')).toEqual(['2', '']);
    // Total, média e resultado só aparecem para quem tem o bloco/prova completos.
    expect(row(sheet.rows, 'Total')).toEqual(['5,0', '']);
    expect(row(sheet.rows, 'Média')).toEqual(['2,5', '']);
    expect(row(sheet.rows, 'Resultado')).toEqual(['Aprovado', '']);
    expect(sheet.statusNote).toBe('Prova em andamento: 3 de 4 notas lançadas');
  });

  it('gera a folha totalmente em branco para preencher à mão', () => {
    const sheet = buildExamSheet(exam, 'blank');
    const cells = sheet.rows.flatMap((r) => (r.kind === 'section' ? [] : r.cells));
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((cell) => cell === '')).toBe(true);
    expect(sheet.columns.map((c) => c.name)).toEqual(['Ana Carvalho', 'Bruno Lima']);
    expect(sheet.statusNote).toBe('Folha em branco para preenchimento manual');
  });

  it('monta um nome de arquivo legível', () => {
    expect(examPdfFileName(exam, 'filled')).toBe(
      'prova-exame-de-faixa-branca-a-laranja-2026-06-20.pdf',
    );
    expect(examPdfFileName(exam, 'blank')).toBe(
      'prova-exame-de-faixa-branca-a-laranja-2026-06-20-em-branco.pdf',
    );
  });
});

describe('renderExamPdf', () => {
  it('troca caracteres que as fontes padrão do PDF não têm', () => {
    expect(pdfText('Kihon — parte 1 基本')).toBe('Kihon - parte 1');
    expect(pdfText('Branca → Laranja')).toBe('Branca -> Laranja');
    expect(pdfText('Técnica · nº')).toBe('Técnica · nº');
  });

  it('gera um arquivo PDF', async () => {
    const blob = renderExamPdf(buildExamSheet(exam, 'filled'));
    expect(blob.type).toBe('application/pdf');
    const header = new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer());
    expect(header).toBe('%PDF-');
  });
});
