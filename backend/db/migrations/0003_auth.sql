-- Autenticação de professores: senha (Argon2id), bloqueio progressivo, sessões no servidor
-- e convites de uso único (docs/BACKEND.md §4).

ALTER TABLE teachers
  -- NULL até o professor aceitar o convite e definir a própria senha.
  ADD COLUMN password_hash       text,
  ADD COLUMN failed_login_count  smallint NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  ADD COLUMN locked_until        timestamptz;

-- O cookie carrega um token aleatório; aqui fica só o hash (SHA-256) dele.
CREATE TABLE sessions (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  token_hash    bytea NOT NULL UNIQUE,
  teacher_id    uuid NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  dojo_id       uuid NOT NULL REFERENCES dojos (id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  -- Expiração absoluta; a de inatividade é calculada a partir de last_seen_at.
  expires_at    timestamptz NOT NULL,
  user_agent    text NOT NULL DEFAULT '' CHECK (length(user_agent) <= 200),
  ip            inet
);
CREATE INDEX sessions_teacher_idx ON sessions (teacher_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

-- Convite para o professor definir a senha. Token de uso único, guardado como hash.
CREATE TABLE teacher_invitations (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  token_hash  bytea NOT NULL UNIQUE,
  teacher_id  uuid NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  created_by  uuid REFERENCES teachers (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);
CREATE INDEX teacher_invitations_teacher_idx ON teacher_invitations (teacher_id);
CREATE INDEX teacher_invitations_created_by_idx ON teacher_invitations (created_by);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON sessions, teacher_invitations TO app_runtime;
  END IF;
END;
$$;
