import { ExamDto, ExamTemplateDto } from '@shared/data-access/exams/exam.dto';
import { GradeSheet } from '@shared/data-access/exams/exam.model';
import { StudentDto } from '@shared/data-access/students/student.dto';
import { Belt } from '@shared/models/belt.model';

// Dados fictícios para desenvolvimento. Nunca use dados reais de alunos aqui.

function items(prefix: string, labels: readonly string[]) {
  return labels.map((label, index) => ({
    id: `${prefix}-${String(index + 1).padStart(2, '0')}`,
    label,
  }));
}

/** Tabela "Branca a Laranja" da Hien Karate Kyokai (formulário em papel de referência). */
export const SEED_TEMPLATES: readonly ExamTemplateDto[] = [
  {
    id: 'tpl-branca-laranja',
    name: 'Exame de faixa — Branca a Laranja',
    description: 'Tabela de avaliação Hien Karate Kyokai: dois blocos de kihon e dois katas.',
    fromBelt: 'branca',
    toBelt: 'laranja',
    sections: [
      {
        id: 'kihon-1',
        title: 'Kihon — parte 1',
        kanji: '基本',
        showTotal: true,
        items: items('k1', [
          'Shoku-zuki/Kibadachi',
          'Maegueri/zenkutso',
          'Guiaku-zuki/zenkutso',
          'Mawashi-Gueri',
          'Riken/kibadachi',
          'Yoko-gueri/Shizentai',
          'Shuto-uke/Kokutso',
          'Ushiro-gueri/Shizentai',
        ]),
      },
      {
        id: 'kihon-2',
        title: 'Kihon — parte 2',
        kanji: '基本',
        showTotal: true,
        items: items('k2', [
          'Oizuki/zenkutso-dachi',
          'Jodan ague-uke/guiaku',
          'Chudan-sotouke/guiaku',
          'Chudan-uti-uke/guiaku',
          'Shuto-uke/Kokutso',
          'Maegueri',
          'Yoko-gueri/kibadachi',
          'Sambun-gueri',
        ]),
      },
      {
        id: 'kata',
        title: 'Kata',
        kanji: '型',
        showTotal: false,
        items: items('kt', ['Kata 1', 'Kata 2']),
      },
    ],
  },
];

const SEED_STUDENT_DATA: readonly [string, Belt, string | null, string | null][] = [
  ['Ana Beatriz Carvalho', 'branca', '2014-03-12', '2025-02-10'],
  ['Bruno Henrique Lima', 'branca', '2012-07-25', '2025-03-03'],
  ['Carla Mendes', 'branca', '2010-11-02', '2025-02-17'],
  ['Diego Fernandes Rocha', 'amarela', '2013-01-30', '2024-08-05'],
  ['Eduarda Nogueira', 'branca', '2015-06-18', '2025-04-07'],
  ['Felipe Augusto Martins', 'vermelha', '2009-09-09', '2024-03-11'],
  ['Gabriela Tanaka', 'laranja', '2011-04-21', '2023-09-04'],
  ['Henrique Sato', 'branca', '2013-12-05', '2025-05-12'],
  ['Isabela Costa Ribeiro', 'amarela', '2012-02-14', '2024-10-21'],
  ['João Pedro Almeida', 'branca', '2014-08-27', '2025-02-24'],
  ['Larissa Yamamoto', 'verde', '2008-05-03', '2022-07-18'],
  ['Mateus Oliveira', 'branca', null, '2025-06-02'],
];

export function createSeedStudents(now: string): StudentDto[] {
  return SEED_STUDENT_DATA.map(([fullName, belt, birthDate, enrollmentDate], index) => ({
    id: `stu-${String(index + 1).padStart(3, '0')}`,
    fullName,
    belt,
    birthDate,
    enrollmentDate,
    notes: '',
    createdAt: now,
    updatedAt: now,
  }));
}

/** Uma prova já concluída, para o histórico não começar vazio. */
export function createSeedExam(students: readonly StudentDto[], now: string): ExamDto {
  const template = SEED_TEMPLATES[0]!;
  const participants = students
    .filter((student) => student.belt === 'amarela' || student.belt === 'vermelha')
    .map(({ id, fullName }) => ({ studentId: id, fullName, belt: 'branca' as const }));

  const allItems = template.sections.flatMap((section) => section.items);
  const grades: Record<string, Record<string, number>> = {};
  participants.forEach((participant, p) => {
    grades[participant.studentId] = Object.fromEntries(
      // Notas determinísticas entre 5,5 e 9,5 para a demonstração.
      allItems.map((item, i) => [item.id, 5.5 + (((p + 1) * 7 + i * 3) % 9) * 0.5]),
    );
  });

  return {
    id: 'exam-seed-001',
    status: 'completed',
    templateId: template.id,
    templateName: template.name,
    fromBelt: template.fromBelt,
    toBelt: template.toBelt,
    sections: template.sections,
    date: '2026-06-20',
    location: 'Dojo central',
    examinerName: 'Sensei Okada',
    passingGrade: 6,
    notes: 'Exame semestral de junho.',
    participants,
    grades: grades as GradeSheet,
    createdAt: now,
    updatedAt: now,
    completedAt: now,
  };
}
