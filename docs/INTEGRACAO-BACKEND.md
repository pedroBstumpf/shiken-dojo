# Integração Front-end ↔ Back-end

> Contrato entre o front-end ([frontend/](../frontend/)) e a API ([backend/](../backend/)), e os
> cuidados de segurança e privacidade específicos do Shiken Dojo.
> Complementa o [BACKEND.md](./BACKEND.md) (regras gerais) e o [FRONTEND.md](./FRONTEND.md).

---

## 1. Situação atual

O front-end conversa com a API real via `HttpClient`. A API simulada (`mock-api/`, com dados no
`localStorage`) foi removida.

```
Componente → *ApiService (HttpClient) → authInterceptor → errorInterceptor → /api/v1 (Fastify) → PostgreSQL
```

- Em desenvolvimento, o `ng serve` encaminha `/api` para `http://localhost:3000` (`frontend/proxy.conf.json`):
  front e API ficam na mesma origem, sem CORS. Em produção, o proxy reverso faz o mesmo papel.
- A sessão é um cookie `HttpOnly`; o front só guarda em memória quem está logado (`AuthService`).
- Como rodar: [backend/README.md](../backend/README.md) e [frontend/README.md](../frontend/README.md).

---

## 2. Contrato da API (`/api/v1`)

Convenções gerais: JSON em camelCase · datas de calendário como `yyyy-MM-dd` · instantes em ISO‑8601 UTC ·
IDs em UUID · listas paginadas no formato `{ items, nextCursor, hasMore }` · erros em Problem Details com `code` estável.

### Professores

| Método | Rota | Corpo | Sucesso | Erros |
|---|---|---|---|---|
| `GET` | `/teachers?limit=&cursor=` | — | `200` `Paginated<TeacherDto>` (ordem alfabética) | `401` |
| `GET` | `/teachers/{id}` | — | `200` `TeacherDto` | `401`, `404` |
| `POST` | `/teachers` | `TeacherWriteDto` | `201` `TeacherDto` | `401`, `403`, `409 EMAIL_TAKEN`, `422` |
| `PUT` | `/teachers/{id}` | `TeacherWriteDto` | `200` `TeacherDto` | `401`, `403`, `404`, `409 EMAIL_TAKEN`, `422` |
| `DELETE` | `/teachers/{id}` | — | `204` | `401`, `403`, `404` |

```ts
interface TeacherWriteDto {
  fullName: string;          // 2–120 caracteres
  email: string;             // e-mail de acesso, único (o servidor normaliza para minúsculas)
  phone: string;             // só dígitos com DDD (10 ou 11), ou '' se não informado
  role: 'head_instructor' | 'instructor';
  belt: Belt;
  dan: number | null;        // 1–10, obrigatório se belt = 'preta'; null nas demais faixas
  federationId: string;      // registro na federação/associação, até 30 caracteres, ou ''
  active: boolean;           // inativos não podem ser examinadores em provas novas
}
// TeacherDto = TeacherWriteDto + { id, createdAt, updatedAt }
```

- **Senha não trafega neste cadastro.** Ao criar um professor, o back-end envia um **convite por e-mail** com link de uso único (72 h, token no fragmento `#token=`) para ele definir a própria senha em `/accept-invite`.
- `TeacherDto` traz também `invitationPending` (ainda não definiu a senha). `POST /teachers/{id}/invitation` reenvia o convite (`202`, só `head_instructor`).
- O dojo sempre mantém um `head_instructor` ativo (`409 LAST_HEAD_INSTRUCTOR`); ninguém exclui o próprio cadastro (`409 CANNOT_DELETE_SELF`).
- Criar, editar e excluir professores deve ser permitido só ao papel `head_instructor` (`403` para os demais).
- Na exclusão, provas antigas mantêm `examiner_name` (retrato). Preferir **desativar** a excluir.

### Alunos

| Método | Rota | Corpo | Sucesso | Erros |
|---|---|---|---|---|
| `GET` | `/students?limit=&cursor=` | — | `200` `Paginated<StudentDto>` (ordem alfabética) | `401` |
| `GET` | `/students/{id}` | — | `200` `StudentDto` | `401`, `404` |
| `POST` | `/students` | `StudentWriteDto` | `201` `StudentDto` | `401`, `422` |
| `PUT` | `/students/{id}` | `StudentWriteDto` | `200` `StudentDto` | `401`, `404`, `422` |
| `DELETE` | `/students/{id}` | — | `204` | `401`, `404` |

```ts
interface StudentWriteDto {
  fullName: string;              // 2–120 caracteres
  belt: Belt;                    // 'branca' | 'amarela' | 'vermelha' | 'laranja' | 'verde' | 'roxa' | 'marrom' | 'preta'
  birthDate: string | null;      // yyyy-MM-dd, não pode ser futura
  enrollmentDate: string | null; // yyyy-MM-dd, não pode ser futura
  notes: string;                 // até 500 caracteres
}
// StudentDto = StudentWriteDto + { id, createdAt, updatedAt }
```

### Privacidade do aluno (LGPD)

| Método | Rota | Sucesso | Erros |
|---|---|---|---|
| `GET` | `/students/{id}/export` | `200` JSON (cadastro + provas, como anexo) | `401`, `404` |
| `POST` | `/students/{id}/erasure` | `204` (exclui e anonimiza o nome nas provas) | `401`, `403`, `404` |

### Autenticação

| Método | Rota | Corpo | Sucesso | Erros |
|---|---|---|---|---|
| `POST` | `/auth/login` | `{ email, password }` | `200` `SessionDto` + cookie de sessão | `401 INVALID_CREDENTIALS`, `403 CSRF_INVALID`, `429` |
| `POST` | `/auth/logout` | — | `204` | `403 CSRF_INVALID` |
| `GET` | `/auth/session` | — | `200` `SessionDto` | `401` |
| `POST` | `/auth/invitations/accept` | `{ token, password }` | `200` `SessionDto` + cookie | `422 INVITATION_INVALID`, `422`, `429` |
| `GET` | `/auth/sessions` | — | `200` `{ items: ActiveSessionDto[] }` | `401` |
| `DELETE` | `/auth/sessions/{id}` | — | `204` | `401`, `404` |

```ts
interface SessionDto {
  teacher: { id: string; fullName: string; email: string; role: 'head_instructor' | 'instructor' };
  dojo: { id: string; name: string };
}
```

Toda requisição que altera estado precisa do header `X-XSRF-TOKEN` igual ao cookie `XSRF-TOKEN`
(o `HttpClient` do Angular faz isso sozinho). O cookie é emitido em qualquer `GET` da API.

### Tabelas de avaliação (templates)

| Método | Rota | Sucesso |
|---|---|---|
| `GET` | `/exam-templates` | `200` `Paginated<ExamTemplateDto>` |

Cada template tem `sections[]` (ex.: *Kihon — parte 1*, *Kihon — parte 2*, *Kata*), e cada seção tem `items[]`
(as técnicas avaliadas) e `showTotal` (se a tabela mostra a linha "Total" do bloco).
O template inicial é a tabela **Branca a Laranja** da Hien Karate Kyokai
(migração `backend/db/migrations/0002_default_exam_template.sql`).

### Provas

| Método | Rota | Corpo | Sucesso | Erros |
|---|---|---|---|---|
| `GET` | `/exams?limit=&cursor=` | — | `200` `Paginated<ExamSummaryDto>` (mais recentes primeiro) | `401` |
| `GET` | `/exams/{id}` | — | `200` `ExamDto` | `401`, `404` |
| `POST` | `/exams` | `ExamCreateDto` | `201` `ExamDto` (status `draft`) | `401`, `422` |
| `PUT` | `/exams/{id}/grades` | `{ grades: GradeSheet }` | `200` `ExamDto` | `401`, `404`, `409 EXAM_LOCKED`, `422` |
| `POST` | `/exams/{id}/complete` | — | `200` `ExamDto` (status `completed`) | `401`, `404`, `409 EXAM_LOCKED`, `422 EXAM_INCOMPLETE` |
| `DELETE` | `/exams/{id}` | — | `204` (só rascunhos) | `401`, `404`, `409 EXAM_LOCKED` |
| `POST` | `/exams/{id}/email` | `multipart/form-data`: `teacherId`, `variant` (`filled`\|`blank`), `file` (PDF) | `202` `EmailDeliveryDto` | `401`, `404`, `422`, `429` |

#### Envio do PDF por e-mail

O PDF é gerado no navegador (jsPDF) e enviado como anexo. O servidor:

- **Só envia para o e-mail cadastrado** do professor `teacherId` (ativo e do mesmo dojo). O cliente nunca informa o endereço — isso impede usar o sistema para mandar spam ou vazar dados para terceiros.
- Valida o anexo: `Content-Type` **e** assinatura do arquivo (`%PDF-`), tamanho máximo de 5 MB.
- Aplica **rate limit** por professor e por usuário (ex.: 10 envios/hora) — `429` com `Retry-After`.
- Envia de forma assíncrona (fila) por um provedor de e-mail transacional com SPF/DKIM/DMARC configurados; responde `202` assim que enfileira.
- Registra o envio na auditoria (`exam.emailed`: quem enviou, para qual professor, quando) — sem guardar o PDF nos logs.
- O PDF contém nomes de alunos (muitos menores): não guardar cópias além do necessário para o envio.

```ts
interface EmailDeliveryDto {
  recipientEmail: string; // e-mail do cadastro do professor
  sentAt: string;         // ISO-8601 UTC (momento em que foi enfileirado)
  simulated: boolean;     // true quando o servidor não tem provedor de e-mail (MAIL_TRANSPORT=file)
}
```

Regras que o servidor **precisa** garantir (o front também valida, mas só como UX):

- `POST /exams` grava um **retrato** dos alunos (`participants`: nome e faixa no dia) e das seções do template. O histórico não pode mudar se o cadastro do aluno ou o template mudarem depois.
- `PUT /grades` substitui a planilha inteira (idempotente — o front salva automaticamente a cada pausa na digitação). Descarta alunos/técnicas que não pertencem à prova e rejeita notas fora de **0–3** (uma casa decimal).
- `ExamCreateDto` traz `examinerId` (professor **ativo** do dojo); o servidor grava também `examinerName` como retrato, para o histórico não mudar se o cadastro do professor mudar. Se o professor for excluído, `ExamDto.examinerId` passa a ser `null`.
- `complete` só é aceito com **todas** as notas lançadas. Depois disso a prova é **imutável**.
- `ExamSummaryDto.approvedCount` é calculado no servidor com a mesma regra do front: média de todas as notas, arredondada para uma casa decimal, ≥ `passingGrade` (`exam-scoring.ts` no front, espelhado em `backend/src/modules/exams/domain/scoring.ts`).

---

## 3. Modelo de dados (PostgreSQL)

Rascunho que deu origem às migrações de [`backend/db/migrations/`](../backend/db/migrations/) — a fonte da
verdade é o SQL de lá. Toda tabela com dados de um dojo carrega `dojo_id` (isolamento entre dojos).
Diferenças implementadas: `exam_participants.student_id` não tem FK (o histórico e a planilha de notas
sobrevivem à exclusão do aluno), `exams.examiner_id` é `ON DELETE SET NULL`, a senha e o bloqueio de
login ficam em colunas próprias, e há as tabelas `sessions`, `teacher_invitations` e `email_outbox`.

```sql
CREATE TABLE dojos (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  name        text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Professores (usuários do sistema). Senha só se não usarmos um provedor OIDC.
CREATE TABLE teachers (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  dojo_id        uuid NOT NULL REFERENCES dojos(id),
  full_name      text NOT NULL CHECK (length(full_name) BETWEEN 2 AND 120),
  email          citext NOT NULL UNIQUE,
  password_hash  text,                                 -- Argon2id
  phone          text NOT NULL DEFAULT '' CHECK (phone ~ '^(\d{10,11})?$'),
  role           text NOT NULL CHECK (role IN ('head_instructor', 'instructor')),
  belt           text NOT NULL,
  dan            smallint CHECK (dan BETWEEN 1 AND 10),
  federation_id  text NOT NULL DEFAULT '' CHECK (length(federation_id) <= 30),
  active         boolean NOT NULL DEFAULT true,
  mfa_enabled    boolean NOT NULL DEFAULT false,
  CHECK ((belt = 'preta') = (dan IS NOT NULL)),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE students (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  dojo_id          uuid NOT NULL REFERENCES dojos(id),
  full_name        text NOT NULL CHECK (length(full_name) BETWEEN 2 AND 120),
  belt             text NOT NULL CHECK (belt IN ('branca','amarela','vermelha','laranja','verde','roxa','marrom','preta')),
  birth_date       date CHECK (birth_date <= current_date),
  enrollment_date  date CHECK (enrollment_date <= current_date),
  notes            text NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX students_dojo_name_idx ON students (dojo_id, full_name);

CREATE TABLE exam_templates (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  dojo_id     uuid REFERENCES dojos(id),             -- NULL = template padrão da associação
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  from_belt   text NOT NULL,
  to_belt     text NOT NULL,
  sections    jsonb NOT NULL,                         -- [{ id, title, kanji, showTotal, items: [{ id, label }] }]
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE exams (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  dojo_id        uuid NOT NULL REFERENCES dojos(id),
  template_id    uuid NOT NULL REFERENCES exam_templates(id),
  template_name  text NOT NULL,                        -- retrato do template no dia
  from_belt      text NOT NULL,
  to_belt        text NOT NULL,
  sections       jsonb NOT NULL,                       -- retrato das seções/técnicas
  exam_date      date NOT NULL,
  location       text NOT NULL DEFAULT '',
  examiner_id    uuid NOT NULL REFERENCES teachers(id),
  examiner_name  text NOT NULL,
  passing_grade  numeric(2,1) NOT NULL CHECK (passing_grade BETWEEN 0 AND 3),
  notes          text NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  status         text NOT NULL CHECK (status IN ('draft', 'completed')),
  completed_at   timestamptz,
  version        integer NOT NULL DEFAULT 1,           -- concorrência otimista
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
CREATE INDEX exams_dojo_date_idx ON exams (dojo_id, exam_date DESC);

-- Retrato do aluno na prova. student_id fica NULL se o aluno for excluído (o histórico permanece).
CREATE TABLE exam_participants (
  exam_id     uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  position    smallint NOT NULL,                       -- ordem da coluna na tabela
  student_id  uuid REFERENCES students(id) ON DELETE SET NULL,
  full_name   text NOT NULL,
  belt        text NOT NULL,
  PRIMARY KEY (exam_id, position)
);

CREATE TABLE exam_grades (
  exam_id     uuid NOT NULL,
  position    smallint NOT NULL,
  item_id     text NOT NULL,
  grade       numeric(2,1) NOT NULL CHECK (grade BETWEEN 0 AND 3),
  PRIMARY KEY (exam_id, position, item_id),
  FOREIGN KEY (exam_id, position) REFERENCES exam_participants(exam_id, position) ON DELETE CASCADE
);

-- Auditoria (append-only): quem fez o quê, quando.
CREATE TABLE audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dojo_id     uuid,
  actor_id    uuid,
  action      text NOT NULL,                           -- ex.: 'student.deleted', 'exam.completed', 'auth.login_failed'
  target_id   uuid,
  metadata    jsonb NOT NULL DEFAULT '{}',
  ip          inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

Pontos de atenção:

- A imutabilidade de provas concluídas deve ser garantida **também no banco** (trigger que bloqueia `UPDATE/DELETE` em `exam_grades` quando `exams.status = 'completed'`).
- Considerar **Row-Level Security** com `dojo_id` como segunda camada de isolamento entre dojos.
- `uuidv7()` é nativo a partir do PostgreSQL 18; em versões anteriores, gerar na aplicação.

---

## 4. Professores: autenticação e autorização

**Back-end** (implementado, exceto MFA)
- Login de professores com sessão em cookie `HttpOnly; Secure; SameSite=Lax` (`__Host-` prefix) — ou um provedor OIDC (Authorization Code + PKCE). **Nada de token em `localStorage`.**
- Proteção CSRF com o padrão *double submit*: cookie `XSRF-TOKEN` → header `X-XSRF-TOKEN` (o front já está configurado com `withXsrfConfiguration`).
- MFA obrigatório para o papel `head_instructor`; rate limit e bloqueio progressivo no login.
- **Autorização em todo request**, com o `dojo_id` vindo da sessão — nunca de parâmetros:
  - professor só lê/edita alunos e provas do **próprio dojo** (prevenção de BOLA);
  - `head_instructor` gerencia professores e templates; `instructor` cadastra alunos e aplica provas;
  - recurso de outro dojo responde `404` (não confirma que existe).
- O examinador já é escolhido entre os professores cadastrados (`examiner_id`). Com login, pode vir pré-selecionado como o professor logado.

**Front-end** (implementado)
- Página de login e `authGuard`; `guestGuard` no login e `headInstructorGuard` nas telas de gestão de professores.
- `authInterceptor`: em `401`, limpa o estado e leva ao login preservando a rota (`returnUrl` apenas interno).
- Professor logado no cabeçalho, com "Sessões ativas" e "Sair" (o logout recarrega a página para não sobrar dados em memória).
- `withCredentials` só será necessário se a API passar a ficar em outra origem.

---

## 5. Privacidade (LGPD) — cuidados específicos

- **Muitos alunos de karatê são crianças e adolescentes.** O tratamento de dados de menores exige o melhor interesse do menor e, para crianças, consentimento específico de um dos pais ou responsável (LGPD, art. 14). Prever no cadastro: responsável legal e registro do consentimento (quem, quando, versão do termo).
- **Minimização:** o cadastro pede só nome e faixa; datas são opcionais. Não coletar CPF, endereço, dados de saúde ou fotos sem uma finalidade clara. O campo "Observações" avisa para não registrar dados de saúde.
- **Exclusão:** ao excluir um aluno, o histórico de provas guarda um retrato com o nome. Em um pedido de exclusão (direito do titular), **anonimizar** `exam_participants.full_name` (ex.: "Aluno removido") — e lembrar de backups e logs.
- **Exportação:** endpoint para exportar os dados de um aluno (cadastro + provas) em JSON/CSV, a pedido do responsável.
- **Retenção:** definir por quanto tempo o histórico de provas é guardado após o aluno sair do dojo.
- **Logs e analytics:** nunca registrar nomes de alunos ou notas em logs, ferramentas de erro ou analytics. Usar IDs.

---

## 6. Checklist para a primeira versão do back-end

- [x] Endpoints da seção 2 com validação por schema e Problem Details
- [x] Contrato em OpenAPI 3.1 (`/api/v1/openapi.json`, gerado dos schemas Zod)
- [ ] Validar o contrato no CI contra os tipos do front-end (gerar os DTOs do Angular a partir do OpenAPI)
- [x] Migrações do esquema da seção 3 (versionadas) + seed do template Branca a Laranja
- [x] Login de professores, sessão em cookie HttpOnly, CSRF, rate limit e bloqueio progressivo
- [x] Autorização por dojo em todas as consultas + testes de "outro dojo → 404"
- [x] Trigger de imutabilidade de provas concluídas
- [x] Auditoria das ações sensíveis
- [x] Envio do PDF por e-mail (outbox + worker, rate limit, validação do anexo)
- [x] Fluxos LGPD: exportação e exclusão com anonimização
- [ ] LGPD: responsável legal e registro do consentimento para alunos menores (exige campos novos no cadastro)
- [x] Front: proxy de desenvolvimento, login, convite, sessões ativas, remoção do `mock-api/`

### Próximos passos

- **MFA** (TOTP ou passkeys) obrigatório para `head_instructor` — o fluxo ainda não existe.
- **Troca de senha** pelo próprio professor (com reautenticação e aviso por e-mail); hoje a redefinição é por novo convite.
- **Row-Level Security** com `dojo_id` como segunda camada de isolamento.
- **Rate limit compartilhado** (Redis) quando houver mais de uma instância da API.
- **Pipeline de CI** (lint, testes com PostgreSQL, build, varredura de segredos e dependências) e deploy.
- **OIDC** como alternativa ao login próprio, se a associação adotar um provedor de identidade.
