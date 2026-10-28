-- Tabela de avaliação padrão da associação (Hien Karate Kyokai): Branca a Laranja.
-- dojo_id NULL = visível para todos os dojos. Os IDs de seções e técnicas são estáveis:
-- as notas das provas são gravadas por item_id.

INSERT INTO exam_templates (id, dojo_id, name, description, from_belt, to_belt, sections)
VALUES (
  '01929b2c-5e00-7000-8000-000000000001',
  NULL,
  'Exame de faixa — Branca a Laranja',
  'Tabela de avaliação Hien Karate Kyokai: dois blocos de kihon e dois katas.',
  'branca',
  'laranja',
  $json$[
  {
    "id": "kihon-1",
    "title": "Kihon — parte 1",
    "kanji": "基本",
    "showTotal": true,
    "items": [
      {
        "id": "k1-01",
        "label": "Shoku-zuki/Kibadachi"
      },
      {
        "id": "k1-02",
        "label": "Maegueri/zenkutso"
      },
      {
        "id": "k1-03",
        "label": "Guiaku-zuki/zenkutso"
      },
      {
        "id": "k1-04",
        "label": "Mawashi-Gueri"
      },
      {
        "id": "k1-05",
        "label": "Riken/kibadachi"
      },
      {
        "id": "k1-06",
        "label": "Yoko-gueri/Shizentai"
      },
      {
        "id": "k1-07",
        "label": "Shuto-uke/Kokutso"
      },
      {
        "id": "k1-08",
        "label": "Ushiro-gueri/Shizentai"
      }
    ]
  },
  {
    "id": "kihon-2",
    "title": "Kihon — parte 2",
    "kanji": "基本",
    "showTotal": true,
    "items": [
      {
        "id": "k2-01",
        "label": "Oizuki/zenkutso-dachi"
      },
      {
        "id": "k2-02",
        "label": "Jodan ague-uke/guiaku"
      },
      {
        "id": "k2-03",
        "label": "Chudan-sotouke/guiaku"
      },
      {
        "id": "k2-04",
        "label": "Chudan-uti-uke/guiaku"
      },
      {
        "id": "k2-05",
        "label": "Shuto-uke/Kokutso"
      },
      {
        "id": "k2-06",
        "label": "Maegueri"
      },
      {
        "id": "k2-07",
        "label": "Yoko-gueri/kibadachi"
      },
      {
        "id": "k2-08",
        "label": "Sambun-gueri"
      }
    ]
  },
  {
    "id": "kata",
    "title": "Kata",
    "kanji": "型",
    "showTotal": false,
    "items": [
      {
        "id": "kt-01",
        "label": "Kata 1"
      },
      {
        "id": "kt-02",
        "label": "Kata 2"
      }
    ]
  }
]$json$::jsonb
)
ON CONFLICT (id) DO NOTHING;
