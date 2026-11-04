import { ExamTemplate } from './exam.model';

// Tabela da associação (Hien Karate Kyokai). Os IDs de seções e técnicas são estáveis: as notas
// são gravadas por item. A prova guarda uma cópia, então mudar a tabela não altera o histórico.
export const EXAM_TEMPLATES: readonly ExamTemplate[] = [
  {
    id: '01929b2c-5e00-7000-8000-000000000001',
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
        items: [
          {
            id: 'k1-01',
            label: 'Shoku-zuki/Kibadachi',
          },
          {
            id: 'k1-02',
            label: 'Maegueri/zenkutso',
          },
          {
            id: 'k1-03',
            label: 'Guiaku-zuki/zenkutso',
          },
          {
            id: 'k1-04',
            label: 'Mawashi-Gueri',
          },
          {
            id: 'k1-05',
            label: 'Riken/kibadachi',
          },
          {
            id: 'k1-06',
            label: 'Yoko-gueri/Shizentai',
          },
          {
            id: 'k1-07',
            label: 'Shuto-uke/Kokutso',
          },
          {
            id: 'k1-08',
            label: 'Ushiro-gueri/Shizentai',
          },
        ],
      },
      {
        id: 'kihon-2',
        title: 'Kihon — parte 2',
        kanji: '基本',
        showTotal: true,
        items: [
          {
            id: 'k2-01',
            label: 'Oizuki/zenkutso-dachi',
          },
          {
            id: 'k2-02',
            label: 'Jodan ague-uke/guiaku',
          },
          {
            id: 'k2-03',
            label: 'Chudan-sotouke/guiaku',
          },
          {
            id: 'k2-04',
            label: 'Chudan-uti-uke/guiaku',
          },
          {
            id: 'k2-05',
            label: 'Shuto-uke/Kokutso',
          },
          {
            id: 'k2-06',
            label: 'Maegueri',
          },
          {
            id: 'k2-07',
            label: 'Yoko-gueri/kibadachi',
          },
          {
            id: 'k2-08',
            label: 'Sambun-gueri',
          },
        ],
      },
      {
        id: 'kata',
        title: 'Kata',
        kanji: '型',
        showTotal: false,
        items: [
          {
            id: 'kt-01',
            label: 'Kata 1',
          },
          {
            id: 'kt-02',
            label: 'Kata 2',
          },
        ],
      },
    ],
  },
];
