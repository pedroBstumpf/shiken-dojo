# Shiken Dojo — Back-end

Node.js 24 · TypeScript (strict) · Fastify 5 · Zod 4 · PostgreSQL 18 · Vitest

API REST em `/api/v1` consumida pelo front-end Angular. Decisões de stack em
[ADR 0001](../docs/adr/0001-stack-do-back-end.md); regras em [BACKEND.md](../docs/BACKEND.md);
contrato em [INTEGRACAO-BACKEND.md](../docs/INTEGRACAO-BACKEND.md).

## Rodando pela primeira vez

Pré-requisitos: Node.js 24+ e PostgreSQL 18 instalado (só os binários; não precisa da senha do
usuário `postgres`).

```bash
npm install
npm run db:setup     # cria um PostgreSQL só do projeto (porta 5433) e preenche o .env
npm run db:migrate   # aplica as migrações
npm run db:seed      # dados de demonstração (dojo, 2 professores, 12 alunos, 1 prova)
npm run dev          # API em http://localhost:3000
```

Depois, em outro terminal, `npm start` na pasta `frontend` (http://localhost:4200). Entre com
`okada@dojo.exemplo` (sensei responsável) ou `mariana@dojo.exemplo` (instrutora) e a senha que está
em `SEED_PASSWORD` no `.env`.

O cluster local fica em `.local/` (ignorado pelo Git). Depois de reiniciar o computador, rode
`npm run db:start` antes do `npm run dev`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | API com recarga automática |
| `npm test` | Testes (unitários e de API contra o banco `shiken_dojo_test`) |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm run build` · `npm start` | Build para `dist/` · roda o build |
| `npm run db:setup` / `db:start` / `db:stop` / `db:status` | PostgreSQL local de desenvolvimento |
| `npm run db:migrate` | Aplica migrações pendentes (papel `app_migrator`) |
| `npm run db:seed` | Dados fictícios de demonstração (recusa rodar em produção) |
| `npm run bootstrap -- --dojo "Nome" --name "Nome completo" --email e@mail` | Cria um dojo e o primeiro sensei responsável, que recebe um convite por e-mail |

O contrato OpenAPI 3.1 fica em `http://localhost:3000/api/v1/openapi.json` (fora de produção).

## E-mails em desenvolvimento

Com `MAIL_TRANSPORT=file` (padrão), nada é enviado: cada e-mail vira um arquivo `.eml` em
`.local/mail/` (abra com qualquer cliente de e-mail). Convites de professores e PDFs de provas
aparecem lá alguns segundos depois da ação. Em produção use `MAIL_TRANSPORT=smtp` e `SMTP_URL` de um
provedor transacional com SPF/DKIM/DMARC configurados.

## Estrutura

```
backend/
├── db/migrations/        # SQL versionado, aplicado em ordem (nunca edite uma migração aplicada)
├── scripts/dev-db.ts     # PostgreSQL local de desenvolvimento
├── src/
│   ├── main.ts           # inicialização, worker de e-mails e desligamento gracioso
│   ├── app.ts            # monta o Fastify e os serviços
│   ├── api.ts            # rotas /api/v1 (públicas e protegidas por sessão)
│   ├── config/           # variáveis de ambiente validadas na inicialização
│   ├── infra/            # banco (pool, migrações), e-mail (outbox + worker), limpeza periódica
│   ├── shared/           # erros (Problem Details), CSRF, cookies, paginação, validação
│   ├── modules/          # auth, teachers, students, exams, audit, health
│   └── cli/              # migrate, seed, bootstrap
└── test/                 # testes de API e do banco (cada teste cria o próprio dojo)
```

Cada módulo separa **rotas** (schema Zod de entrada e saída), **service** (autorização, regras e
transações) e **repository** (SQL parametrizado, sempre filtrado pelo `dojo_id` da sessão).

## Segurança, em resumo

- Sessão no servidor com cookie `HttpOnly` + `SameSite=Lax` (`__Host-` e `Secure` com HTTPS);
  senhas com Argon2id; bloqueio progressivo e rate limit no login.
- CSRF por *double submit* assinado (`XSRF-TOKEN` → `X-XSRF-TOKEN`), compatível com o Angular.
- Autorização por dojo em todas as consultas (outro dojo → `404`) e por papel (`403`).
- Dois papéis no banco: `app_migrator` (schema) e `app_runtime` (só DML; auditoria append-only).
- Provas finalizadas imutáveis também no banco (trigger).
- Headers de segurança, CORS por allowlist, limites de corpo e de upload, logs JSON sem dados
  sensíveis e com `traceId`.

## Produção

Variáveis obrigatórias: `NODE_ENV=production`, `DATABASE_URL` (papel `app_runtime`),
`MIGRATION_DATABASE_URL` (só no pipeline), `CSRF_SECRET`, `APP_BASE_URL` (https),
`MAIL_TRANSPORT=smtp` e `SMTP_URL`. A API se recusa a subir sem elas (veja `.env.example`).
Sirva front-end e API na mesma origem (proxy reverso encaminhando `/api`) e informe
`TRUST_PROXY_HOPS`.

Papéis no PostgreSQL de produção (rodar uma vez, como administrador):

```sql
CREATE ROLE app_migrator LOGIN PASSWORD '…';
CREATE ROLE app_runtime  LOGIN PASSWORD '…';
CREATE DATABASE shiken_dojo OWNER app_migrator;
REVOKE ALL ON DATABASE shiken_dojo FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE shiken_dojo TO app_runtime;
\c shiken_dojo
REVOKE ALL ON SCHEMA public FROM PUBLIC;
```

As permissões de cada tabela são concedidas pelas próprias migrações.
