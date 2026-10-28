-- Esquema inicial (docs/INTEGRACAO-BACKEND.md §3).
-- Toda tabela com dados de um dojo carrega dojo_id: é o escopo de isolamento entre academias.

CREATE EXTENSION IF NOT EXISTS citext;

-- Ordem alfabética em português ("Ângela" junto de "Ana", não depois de "Zé").
CREATE COLLATION IF NOT EXISTS pt_br (provider = icu, locale = 'pt-BR');

CREATE DOMAIN belt AS text
  CHECK (VALUE IN ('branca', 'amarela', 'vermelha', 'laranja', 'verde', 'roxa', 'marrom', 'preta'));

CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Dojos
-- ---------------------------------------------------------------------------

CREATE TABLE dojos (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  name        text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON dojos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Professores (também são os usuários do sistema)
-- ---------------------------------------------------------------------------

CREATE TABLE teachers (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  dojo_id        uuid NOT NULL REFERENCES dojos (id) ON DELETE CASCADE,
  full_name      text COLLATE pt_br NOT NULL CHECK (length(full_name) BETWEEN 2 AND 120),
  email          citext NOT NULL UNIQUE CHECK (length(email) <= 254),
  phone          text NOT NULL DEFAULT '' CHECK (phone ~ '^(\d{10,11})?$'),
  role           text NOT NULL CHECK (role IN ('head_instructor', 'instructor')),
  belt           belt NOT NULL,
  dan            smallint CHECK (dan BETWEEN 1 AND 10),
  federation_id  text NOT NULL DEFAULT '' CHECK (length(federation_id) <= 30),
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- Faixa preta tem grau (dan); as demais faixas, não.
  CHECK ((belt = 'preta') = (dan IS NOT NULL))
);
CREATE INDEX teachers_dojo_name_idx ON teachers (dojo_id, full_name, id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON teachers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Alunos
-- ---------------------------------------------------------------------------

CREATE TABLE students (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  dojo_id          uuid NOT NULL REFERENCES dojos (id) ON DELETE CASCADE,
  full_name        text COLLATE pt_br NOT NULL CHECK (length(full_name) BETWEEN 2 AND 120),
  belt             belt NOT NULL,
  birth_date       date CHECK (birth_date <= current_date),
  enrollment_date  date CHECK (enrollment_date <= current_date),
  notes            text NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX students_dojo_name_idx ON students (dojo_id, full_name, id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Tabelas de avaliação (templates)
-- ---------------------------------------------------------------------------

CREATE TABLE exam_templates (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  -- NULL = template padrão da associação, visível para todos os dojos.
  dojo_id      uuid REFERENCES dojos (id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  description  text NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  from_belt    belt NOT NULL,
  to_belt      belt NOT NULL,
  -- [{ id, title, kanji, showTotal, items: [{ id, label }] }]
  sections     jsonb NOT NULL CHECK (jsonb_typeof(sections) = 'array'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exam_templates_dojo_idx ON exam_templates (dojo_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON exam_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Provas
-- ---------------------------------------------------------------------------

CREATE TABLE exams (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  dojo_id        uuid NOT NULL REFERENCES dojos (id) ON DELETE CASCADE,
  template_id    uuid NOT NULL REFERENCES exam_templates (id),
  -- Retratos do dia da prova: o histórico não muda se o template ou o professor mudarem.
  template_name  text NOT NULL,
  from_belt      belt NOT NULL,
  to_belt        belt NOT NULL,
  sections       jsonb NOT NULL CHECK (jsonb_typeof(sections) = 'array'),
  exam_date      date NOT NULL,
  location       text NOT NULL DEFAULT '' CHECK (length(location) <= 120),
  -- NULL se o professor for excluído; examiner_name mantém o nome no histórico.
  examiner_id    uuid REFERENCES teachers (id) ON DELETE SET NULL,
  examiner_name  text NOT NULL,
  passing_grade  numeric(2, 1) NOT NULL CHECK (passing_grade BETWEEN 0 AND 3),
  notes          text NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  completed_at   timestamptz,
  version        integer NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
CREATE INDEX exams_dojo_date_idx ON exams (dojo_id, exam_date DESC, created_at DESC, id DESC);
CREATE INDEX exams_template_idx ON exams (template_id);
CREATE INDEX exams_examiner_idx ON exams (examiner_id);

-- Retrato do aluno na prova. student_id não tem FK de propósito: o aluno pode ser excluído
-- e o histórico (e a planilha de notas, indexada por ele) continua íntegro.
CREATE TABLE exam_participants (
  exam_id     uuid NOT NULL REFERENCES exams (id) ON DELETE CASCADE,
  position    smallint NOT NULL CHECK (position >= 0),
  student_id  uuid NOT NULL,
  full_name   text NOT NULL,
  belt        belt NOT NULL,
  PRIMARY KEY (exam_id, position),
  UNIQUE (exam_id, student_id)
);
CREATE INDEX exam_participants_student_idx ON exam_participants (student_id);

CREATE TABLE exam_grades (
  exam_id   uuid NOT NULL,
  position  smallint NOT NULL,
  item_id   text NOT NULL CHECK (length(item_id) <= 64),
  grade     numeric(2, 1) NOT NULL CHECK (grade BETWEEN 0 AND 3),
  PRIMARY KEY (exam_id, position, item_id),
  FOREIGN KEY (exam_id, position)
    REFERENCES exam_participants (exam_id, position) ON DELETE CASCADE
);

-- Provas concluídas são imutáveis, garantido também no banco (defesa em profundidade).
-- Exceções: o examinador pode virar NULL (professor excluído) e o nome do participante
-- pode ser anonimizado (pedido de exclusão de dados — LGPD).
CREATE FUNCTION guard_completed_exam() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'completed' THEN
    IF TG_OP = 'UPDATE'
       AND NEW.examiner_id IS NULL
       AND to_jsonb(NEW) - 'examiner_id' - 'updated_at' = to_jsonb(OLD) - 'examiner_id' - 'updated_at' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'EXAM_LOCKED' USING DETAIL = 'Provas concluídas não podem ser alteradas.';
  END IF;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
-- O prefixo "a_" faz este trigger rodar antes de set_updated_at (ordem alfabética).
CREATE TRIGGER a_guard_completed_exam BEFORE UPDATE OR DELETE ON exams
  FOR EACH ROW EXECUTE FUNCTION guard_completed_exam();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE FUNCTION guard_completed_exam_rows() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target_exam uuid := CASE TG_OP WHEN 'DELETE' THEN OLD.exam_id ELSE NEW.exam_id END;
BEGIN
  IF TG_TABLE_NAME = 'exam_participants'
     AND TG_OP = 'UPDATE'
     AND to_jsonb(NEW) - 'full_name' = to_jsonb(OLD) - 'full_name' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM exams WHERE id = target_exam AND status = 'completed') THEN
    RAISE EXCEPTION 'EXAM_LOCKED' USING DETAIL = 'Provas concluídas não podem ser alteradas.';
  END IF;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER guard_completed_exam BEFORE INSERT OR UPDATE OR DELETE ON exam_participants
  FOR EACH ROW EXECUTE FUNCTION guard_completed_exam_rows();
CREATE TRIGGER guard_completed_exam BEFORE INSERT OR UPDATE OR DELETE ON exam_grades
  FOR EACH ROW EXECUTE FUNCTION guard_completed_exam_rows();

-- ---------------------------------------------------------------------------
-- Auditoria (append-only): quem fez o quê, quando e de onde. Sem dados pessoais em metadata.
-- ---------------------------------------------------------------------------

CREATE TABLE audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dojo_id     uuid,
  actor_id    uuid,
  action      text NOT NULL CHECK (action ~ '^[a-z_]+\.[a-z_]+$'),
  target_id   uuid,
  metadata    jsonb NOT NULL DEFAULT '{}',
  ip          inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_dojo_created_idx ON audit_log (dojo_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Permissões do papel da API: só o necessário (BACKEND.md §9).
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT USAGE ON SCHEMA public TO app_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON dojos, teachers, students, exam_templates, exams, exam_participants, exam_grades
      TO app_runtime;
    -- Auditoria é append-only: a API só insere e consulta.
    GRANT SELECT, INSERT ON audit_log TO app_runtime;
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM app_runtime;
  END IF;
END;
$$;
