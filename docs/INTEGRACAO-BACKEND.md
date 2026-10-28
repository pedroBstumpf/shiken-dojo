# Integração Front-end ↔ Back-end

> Este documento descreve **o que o back-end precisa entregar** para substituir a API simulada do front-end,
> e os cuidados de segurança e privacidade específicos do Shiken Dojo.
> Ele complementa o [BACKEND.md](./BACKEND.md) (regras gerais) e o [FRONTEND.md](./FRONTEND.md).

---

## 1. Situação atual

O front-end já conversa com uma API REST de verdade via `HttpClient`. Enquanto o back-end não existe, um
interceptor (`frontend/src/app/mock-api/`) responde às requisições e guarda os dados no `localStorage`.

```
Componente → *ApiService (HttpClient) → errorInterceptor → mockApiInterceptor ─╳─ (back-end real)
                                                            └─ localStorage (só em desenvolvimento)
```

- Os serviços (`StudentApiService`, `ExamApiService`) **não sabem** que a API é simulada.
- O mock segue o contrato abaixo: rotas, status HTTP, validações e erros no formato **Problem Details (RFC 9457)**.
- ⚠️ O `localStorage` guarda nomes e datas de nascimento de alunos **apenas para desenvolvimento**. Isso não pode ir para produção.

### Como trocar para a API real

1. Implementar os endpoints da seção 2 no back-end.
2. Em `frontend/src/environments/environment*.ts`, definir `useMockApi: false` (e `apiBaseUrl`, se for diferente de `/api/v1`).
3. Em desenvolvimento, criar `frontend/proxy.conf.json` apontando `/api` para o servidor local e referenciá-lo no `angular.json` (`serve.options.proxyConfig`). Assim o front e a API ficam na mesma origem, sem CORS.
4. Remover a pasta `src/app/mock-api/` e a referência a ela no `app.config.ts`.

---

## 2. Contrato da API (`/api/v1`)

Convenções gerais: JSON em camelCase · datas de calendário como `yyyy-MM-dd` · instantes em ISO‑8601 UTC ·
IDs em UUID · listas paginadas no formato `{ items, nextCursor, hasMore }` · erros em Problem Details com `code` estável.

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

### Tabelas de avaliação (templates)

| Método | Rota | Sucesso |
|---|---|---|
| `GET` | `/exam-templates` | `200` `Paginated<ExamTemplateDto>` |

Cada template tem `sections[]` (ex.: *Kihon — parte 1*, *Kihon — parte 2*, *Kata*), e cada seção tem `items[]`
(as técnicas avaliadas) e `showTotal` (se a tabela mostra a linha "Total" do bloco).
O template inicial é a tabela **Branca a Laranja** da Hien Karate Kyokai (ver `mock-seed.ts`).

### Provas

| Método | Rota | Corpo | Sucesso | Erros |
|---|---|---|---|---|
| `GET` | `/exams?limit=&cursor=` | — | `200` `Paginated<ExamSummaryDto>` (mais recentes primeiro) | `401` |
| `GET` | `/exams/{id}` | — | `200` `ExamDto` | `401`, `404` |
| `POST` | `/exams` | `ExamCreateDto` | `201` `ExamDto` (status `draft`) | `401`, `422` |
| `PUT` | `/exams/{id}/grades` | `{ grades: GradeSheet }` | `200` `ExamDto` | `401`, `404`, `409 EXAM_LOCKED`, `422` |
| `POST` | `/exams/{id}/complete` | — | `200` `ExamDto` (status `completed`) | `401`, `404`, `409 EXAM_LOCKED`, `422 EXAM_INCOMPLETE` |
| `DELETE` | `/exams/{id}` | — | `204` (só rascunhos) | `401`, `404`, `409 EXAM_LOCKED` |

Regras que o servidor **precisa** garantir (o front também valida, mas só como UX):

- `POST /exams` grava um **retrato** dos alunos (`participants`: nome e faixa no dia) e das seções do template. O histórico não pode mudar se o cadastro do aluno ou o template mudarem depois.
- `PUT /grades` substitui a planilha inteira (idempotente — o front salva automaticamente a cada pausa na digitação). Descarta alunos/técnicas que não pertencem à prova e rejeita notas fora de 0–10 (uma casa decimal).
- `complete` só é aceito com **todas** as notas lançadas. Depois disso a prova é **imutável**.
- `ExamSummaryDto.approvedCount` é calculado no servidor com a mesma regra do front: média de todas as notas, arredondada para uma casa decimal, ≥ `passingGrade` (ver `exam-scoring.ts`).

---

## 3. Modelo de dados (PostgreSQL)

Rascunho inicial. Toda tabela com dados de um dojo carrega `dojo_id` (isolamento entre dojos/academias).

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
  role           text NOT NULL CHECK (role IN ('head_instructor', 'instructor')),
  mfa_enabled    boolean NOT NULL DEFAULT false,
  disabled_at    timestamptz,
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
  passing_grade  numeric(3,1) NOT NULL CHECK (passing_grade BETWEEN 0 AND 10),
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
  grade       numeric(3,1) NOT NULL CHECK (grade BETWEEN 0 AND 10),
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

O front-end ainda não tem login. Quando o back-end existir:

**Back-end**
- Login de professores com sessão em cookie `HttpOnly; Secure; SameSite=Lax` (`__Host-` prefix) — ou um provedor OIDC (Authorization Code + PKCE). **Nada de token em `localStorage`.**
- Proteção CSRF com o padrão *double submit*: cookie `XSRF-TOKEN` → header `X-XSRF-TOKEN` (o front já está configurado com `withXsrfConfiguration`).
- MFA obrigatório para o papel `head_instructor`; rate limit e bloqueio progressivo no login.
- **Autorização em todo request**, com o `dojo_id` vindo da sessão — nunca de parâmetros:
  - professor só lê/edita alunos e provas do **próprio dojo** (prevenção de BOLA);
  - `head_instructor` gerencia professores e templates; `instructor` cadastra alunos e aplica provas;
  - recurso de outro dojo responde `404` (não confirma que existe).
- O examinador da prova passa a ser o professor logado (`examiner_id`), em vez do campo de texto livre.

**Front-end (a fazer)**
- Página de login e `authGuard` funcional nas rotas.
- `errorInterceptor`: em `401`, limpar o estado e redirecionar para o login preservando a rota (`returnUrl` apenas interno).
- `withCredentials` se a API ficar em outra origem.
- Exibir o professor logado no cabeçalho, com "Sair" e "Sessões ativas".

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

- [ ] Endpoints da seção 2 com validação por schema e Problem Details
- [ ] Contrato em OpenAPI 3.1, validado no CI contra os tipos do front-end
- [ ] Migrações do esquema da seção 3 (versionadas) + seed do template Branca a Laranja
- [ ] Login de professores, sessão em cookie HttpOnly, CSRF, rate limit
- [ ] Autorização por dojo em todas as consultas + testes de "outro dojo → 404"
- [ ] Trigger de imutabilidade de provas concluídas
- [ ] Auditoria das ações sensíveis
- [ ] Fluxos LGPD: consentimento do responsável, exportação, anonimização
- [ ] Front: `useMockApi: false`, proxy de desenvolvimento, login, remoção do `mock-api/`
