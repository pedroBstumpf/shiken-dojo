import { Exam } from '@shared/data-access/exams/exam.model';
import {
  decodeExamPdfData,
  encodeExamPdfData,
  extractExamPdfData,
  sha256Hex,
} from './exam-pdf-data';
import { renderExamPdf } from './exam-pdf';
import { buildExamSheet } from './exam-sheet';

const EXAM: Exam = {
  id: 'exam-1',
  status: 'completed',
  templateId: 'tpl-1',
  templateName: 'Exame de faixa — Branca a Laranja',
  fromBelt: 'branca',
  toBelt: 'laranja',
  sections: [
    {
      id: 'kihon',
      title: 'Kihon',
      kanji: '基本',
      showTotal: true,
      items: [
        { id: 'k1', label: 'Maegueri' },
        { id: 'k2', label: 'Guiaku-zuki' },
      ],
    },
  ],
  date: new Date(2026, 5, 20),
  location: 'São Paulo',
  examinerId: 'sensei@dojo.test',
  examinerName: 'João Ação',
  passingGrade: 2,
  notes: '',
  participants: [{ studentId: 's1', fullName: 'Ângela Conceição', belt: 'branca' }],
  grades: { s1: { k1: 2.5, k2: 3 } },
  createdAt: new Date(2026, 5, 20),
  updatedAt: new Date(2026, 5, 20),
  completedAt: new Date('2026-06-20T15:00:00.000Z'),
};

const bytesOf = (text: string) => Uint8Array.from(text, (char) => char.charCodeAt(0));

async function pdfBytes(metadata: string): Promise<Uint8Array> {
  const blob = renderExamPdf(buildExamSheet(EXAM, 'filled'), new Date(), metadata);
  return new Uint8Array(await blob.arrayBuffer());
}

/** Reescreve o conteúdo embutido em uma cópia do JSON original. */
function tamper(change: (data: Record<string, unknown>) => void): string {
  const { encoded } = encodeExamPdfData(EXAM, 'filled', 'export-1');
  const data = JSON.parse(
    new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))),
  ) as Record<string, unknown>;
  change(data);
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  return btoa(String.fromCharCode(...bytes));
}

describe('dados da prova dentro do PDF', () => {
  it('recupera do PDF gerado exatamente o que foi embutido, com acentos', async () => {
    const { encoded, metadata } = encodeExamPdfData(EXAM, 'filled', 'export-1');

    const extracted = extractExamPdfData(await pdfBytes(metadata));

    expect(extracted).toBe(encoded);
    const decoded = decodeExamPdfData(extracted!);
    expect(decoded).toMatchObject({
      id: 'exam-1',
      status: 'completed',
      examinerName: 'João Ação',
      location: 'São Paulo',
      participants: EXAM.participants,
      grades: EXAM.grades,
      completedAt: EXAM.completedAt,
    });
    expect(decoded?.sections[0]?.kanji).toBe('基本');
    expect(decoded?.date.getDate()).toBe(20);
  });

  it('a versão em branco não leva notas nem a finalização', () => {
    const { encoded } = encodeExamPdfData(EXAM, 'blank', 'export-1');

    expect(decodeExamPdfData(encoded)).toMatchObject({
      status: 'draft',
      grades: {},
      completedAt: null,
    });
  });

  it('cada exportação tem conteúdo e hash próprios', async () => {
    const first = encodeExamPdfData(EXAM, 'filled', 'export-1').encoded;
    const second = encodeExamPdfData(EXAM, 'filled', 'export-2').encoded;

    expect(await sha256Hex(first)).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex(first)).not.toBe(await sha256Hex(second));
  });

  it('não encontra dados em um PDF de outra origem nem em outro tipo de arquivo', async () => {
    expect(extractExamPdfData(await pdfBytes(''))).toBeNull();
    expect(extractExamPdfData(bytesOf('%PDF-1.7 um pdf qualquer'))).toBeNull();
    const { metadata } = encodeExamPdfData(EXAM, 'filled', 'export-1');
    expect(extractExamPdfData(bytesOf(`nao sou um pdf ${metadata}`))).toBeNull();
  });

  it.each([
    ['nota fora da escala', (d: Record<string, unknown>) => (d['grades'] = { s1: { k1: 9 } })],
    ['nota de aluno de fora', (d: Record<string, unknown>) => (d['grades'] = { x: { k1: 1 } })],
    ['nota de técnica de fora', (d: Record<string, unknown>) => (d['grades'] = { s1: { x: 1 } })],
    ['faixa desconhecida', (d: Record<string, unknown>) => (d['toBelt'] = 'azul')],
    ['situação desconhecida', (d: Record<string, unknown>) => (d['status'] = 'hacked')],
    ['data inválida', (d: Record<string, unknown>) => (d['date'] = 'ontem')],
    ['identificador com caminho', (d: Record<string, unknown>) => (d['id'] = '../teachers/x')],
    ['sem alunos', (d: Record<string, unknown>) => (d['participants'] = [])],
    ['finalizada sem data', (d: Record<string, unknown>) => (d['completedAt'] = null)],
  ])('recusa conteúdo com %s', (_name, change) => {
    expect(decodeExamPdfData(tamper(change))).toBeNull();
  });

  it('recusa conteúdo que nem é JSON', () => {
    expect(decodeExamPdfData('bm90IGpzb24=')).toBeNull();
    expect(decodeExamPdfData('***')).toBeNull();
  });
});
