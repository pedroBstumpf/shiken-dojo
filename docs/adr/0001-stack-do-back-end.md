# ADR 0001 — Stack do back-end

- **Status:** aceito
- **Data:** 2026-10-28

## Contexto

O front-end (Angular) já consome uma API REST simulada que segue o contrato de
[INTEGRACAO-BACKEND.md](../INTEGRACAO-BACKEND.md). Precisamos de um back-end real que cumpra esse
contrato e as regras de [BACKEND.md](../BACKEND.md): validação por schema, Problem Details, sessão em
cookie, CSRF, autorização por dojo, auditoria, migrações versionadas e envio assíncrono de e-mails.

A equipe é pequena e já trabalha com TypeScript no front-end. O volume esperado é baixo (um dojo
tem dezenas de alunos), então simplicidade e segurança pesam mais que escala.

## Decisão

| Item | Escolha | Por quê |
|---|---|---|
| Linguagem / runtime | **Node.js 24 LTS + TypeScript (strict)** | Mesma linguagem do front; regras de pontuação podem ser espelhadas sem tradução. |
| Framework | **Fastify 5** | Leve, rápido, com plugins oficiais para helmet, CORS, cookies, rate limit e multipart. |
| Validação e contrato | **Zod 4** + `fastify-type-provider-zod` | Um schema valida a entrada, filtra a saída (DTO por allowlist) e gera o OpenAPI 3.1. |
| Banco de dados | **PostgreSQL 18** | Já definido; `uuidv7()` nativo, `citext`, constraints e triggers. |
| Acesso a dados | **node-postgres (`pg`)** com SQL parametrizado em repositórios | SQL explícito e revisável; sem ORM para um modelo pequeno. |
| Migrações | **Arquivos `.sql` versionados** + runner próprio (lock consultivo, checksum, uma transação por arquivo) | Sem mágica: o que roda em produção é o SQL que está no repositório. |
| Autenticação | **Login próprio** (e-mail + senha **Argon2id**) com **sessão no servidor** (tabela `sessions`) e cookie `HttpOnly` | Contrato pede cookie de sessão; OIDC fica como evolução (ADR futuro). |
| Fila / mensageria | **Tabela outbox no PostgreSQL** + worker no processo (`FOR UPDATE SKIP LOCKED`) | Entrega garantida na mesma transação da ação, sem infraestrutura extra. Trocar por fila dedicada se o volume crescer. |
| Cache | Nenhum por enquanto | Volume não justifica. |
| E-mail | **SMTP** via Nodemailer (provedor transacional em produção); em desenvolvimento, arquivos `.eml` locais | Envio real só com provedor configurado (SPF/DKIM/DMARC). |
| Observabilidade | **Logs JSON (pino)** com `traceId` e mascaramento de campos sensíveis | OpenTelemetry fica para quando houver mais de um serviço. |
| Hospedagem | _a definir_ (container) | — |

## Consequências

- Rate limit em memória (plugin do Fastify) vale **por instância**. Limites que precisam valer entre
  instâncias (envio de e-mail) são contados no banco. Ao escalar horizontalmente, mover o rate limit
  para Redis.
- O worker da outbox roda no mesmo processo da API. Se o envio de e-mails ficar pesado, ele pode
  virar um processo separado sem mudar o formato da tabela.
- MFA, OIDC e Row-Level Security ficam fora da primeira versão e estão registrados como próximos
  passos em [INTEGRACAO-BACKEND.md](../INTEGRACAO-BACKEND.md).
