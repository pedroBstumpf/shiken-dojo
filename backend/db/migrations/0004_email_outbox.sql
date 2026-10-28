-- Fila de e-mails (transactional outbox). A mensagem é gravada na mesma transação da ação
-- que a originou e um worker a envia depois, com novas tentativas (docs/BACKEND.md §14).
-- O conteúdo (destinatário, corpo, anexo) é apagado assim que o envio termina: o PDF de uma
-- prova tem nomes de alunos e não deve ficar guardado além do necessário.

CREATE TABLE email_outbox (
  id                    uuid PRIMARY KEY DEFAULT uuidv7(),
  dojo_id               uuid REFERENCES dojos (id) ON DELETE CASCADE,
  kind                  text NOT NULL CHECK (kind ~ '^[a-z_]+\.[a-z_]+$'),
  -- Quem pediu o envio e para qual professor: base dos limites de envio por hora.
  requested_by          uuid REFERENCES teachers (id) ON DELETE SET NULL,
  recipient_teacher_id  uuid REFERENCES teachers (id) ON DELETE SET NULL,
  recipient_email       citext,
  subject               text,
  text_body             text,
  html_body             text,
  attachment_name       text,
  attachment            bytea,
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'sending', 'sent', 'dead')),
  attempts              smallint NOT NULL DEFAULT 0,
  next_attempt_at       timestamptz NOT NULL DEFAULT now(),
  locked_until          timestamptz,
  -- Só o código do erro, nunca o conteúdo da mensagem.
  last_error            text CHECK (length(last_error) <= 200),
  created_at            timestamptz NOT NULL DEFAULT now(),
  sent_at               timestamptz,
  CHECK (status IN ('sent', 'dead') OR recipient_email IS NOT NULL)
);
CREATE INDEX email_outbox_due_idx ON email_outbox (next_attempt_at)
  WHERE status IN ('pending', 'sending');
CREATE INDEX email_outbox_requested_by_idx ON email_outbox (requested_by, created_at);
CREATE INDEX email_outbox_recipient_idx ON email_outbox (recipient_teacher_id, created_at);
CREATE INDEX email_outbox_dojo_idx ON email_outbox (dojo_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON email_outbox TO app_runtime;
  END IF;
END;
$$;
