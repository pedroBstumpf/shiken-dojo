# Guia de Boas Práticas — Back-end e Banco de Dados

> Este documento define os padrões obrigatórios para o back-end, a API e o banco de dados do **Shiken Dojo**.
> O foco é **proteger os usuários e seus dados**, manter os servidores sob controle e garantir integrações confiáveis.
>
> As regras são **independentes de linguagem/framework**. Quando a stack for definida, registre aqui as escolhas concretas (ex.: NestJS + PostgreSQL + Prisma) na seção [Decisões de stack](#0-decisões-de-stack).
>
> Contrato com o front-end: veja [FRONTEND.md](./FRONTEND.md).

---

## Sumário

0. [Decisões de stack](#0-decisões-de-stack)
1. [Princípios](#1-princípios)
2. [Arquitetura e organização](#2-arquitetura-e-organização)
3. [Design de API](#3-design-de-api)
4. [Autenticação](#4-autenticação)
5. [Autorização](#5-autorização)
6. [Validação de entrada](#6-validação-de-entrada)
7. [Prevenção de injeções e ataques comuns](#7-prevenção-de-injeções-e-ataques-comuns)
8. [Proteções na camada HTTP](#8-proteções-na-camada-http)
9. [Banco de dados](#9-banco-de-dados)
10. [Privacidade e LGPD](#10-privacidade-e-lgpd)
11. [Coleta de dados e analytics](#11-coleta-de-dados-e-analytics)
12. [Gestão de segredos e criptografia](#12-gestão-de-segredos-e-criptografia)
13. [Integração com APIs externas](#13-integração-com-apis-externas)
14. [Processamento assíncrono](#14-processamento-assíncrono)
15. [Tratamento de erros](#15-tratamento-de-erros)
16. [Observabilidade (logs, métricas, traces)](#16-observabilidade-logs-métricas-traces)
17. [Infraestrutura e controle de servidor](#17-infraestrutura-e-controle-de-servidor)
18. [Performance e escalabilidade](#18-performance-e-escalabilidade)
19. [Testes](#19-testes)
20. [CI/CD e deploy](#20-cicd-e-deploy)
21. [Backup, continuidade e resposta a incidentes](#21-backup-continuidade-e-resposta-a-incidentes)
22. [Referência OWASP](#22-referência-owasp)
23. [Checklist de Pull Request](#23-checklist-de-pull-request)

---

## 0. Decisões de stack

> Preencha conforme as decisões forem tomadas. Toda decisão relevante de arquitetura deve ter um **ADR** (Architecture Decision Record) em `docs/adr/`.

| Item | Escolha | ADR |
|---|---|---|
| Linguagem / runtime | _a definir_ | |
| Framework | _a definir_ | |
| Banco de dados principal | **PostgreSQL** | |
| ORM / query builder | _a definir_ | |
| Autenticação | _a definir (recomendado: provedor OIDC gerenciado)_ | |
| Cache | _a definir_ | |
| Fila / mensageria | _a definir_ | |
| Hospedagem | _a definir_ | |
| Observabilidade | _a definir (recomendado: OpenTelemetry)_ | |

---

## 1. Princípios

| Princípio | Significado |
|---|---|
| **Security by design** | Segurança é requisito desde o início, não uma camada adicionada no fim. |
| **Menor privilégio** | Cada usuário, serviço, credencial e processo tem **apenas** as permissões necessárias. |
| **Defesa em profundidade** | Várias camadas de proteção; a falha de uma não compromete o sistema. |
| **Negar por padrão** | Tudo é proibido até ser explicitamente permitido. |
| **Falhar de forma segura** | Em caso de erro, o sistema nega acesso e não vaza informação. |
| **Nunca confie no cliente** | Todo dado vindo de fora (front-end, apps, integrações, headers) é hostil até ser validado. |
| **Minimização de dados** | Colete, guarde e exponha o mínimo de dados pessoais possível. |
| **Simplicidade** | Complexidade é inimiga da segurança. Prefira soluções conhecidas e auditadas. |
| **Observável** | Se não é medido nem registrado, não é controlado. |

---

## 2. Arquitetura e organização

### Camadas

```
┌────────────────────────────────────────────┐
│  Transporte (controllers / handlers / rotas)│  ← HTTP, validação de formato, autenticação
├────────────────────────────────────────────┤
│  Aplicação (casos de uso / services)        │  ← orquestração, autorização, transações
├────────────────────────────────────────────┤
│  Domínio (entidades, regras de negócio)     │  ← regras puras, sem dependência de framework
├────────────────────────────────────────────┤
│  Infraestrutura (repositórios, clients)     │  ← banco, cache, filas, APIs externas
└────────────────────────────────────────────┘
```

- Dependências apontam **para dentro**: o domínio não conhece HTTP nem banco.
- Controllers são finos: recebem, validam, delegam, respondem.
- Regras de negócio **nunca** ficam em controllers nem em queries SQL espalhadas.

### Organização por módulo de domínio

```
src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── exams/
│   │   ├── exams.controller.*
│   │   ├── exams.service.*
│   │   ├── exams.repository.*
│   │   ├── dto/                 # Request/Response DTOs
│   │   ├── entities/
│   │   └── exams.*.spec.*
│   └── ...
├── shared/                      # Utilitários, erros, middlewares genéricos
├── config/                      # Leitura e validação de configuração
├── infra/                       # Banco, cache, filas, clients externos
└── main.*
```

### Regras

- **Stateless**: nenhuma sessão em memória do processo. Estado em banco/cache — permite escalar horizontalmente.
- **Configuração por ambiente** (12-Factor): tudo que muda entre ambientes vem de variáveis de ambiente / secret manager, **validado na inicialização** (a aplicação não sobe com configuração inválida).
- **Paridade de ambientes**: dev, staging e produção o mais parecidos possível (mesmo banco, mesmas versões).
- Comece com um **monólito modular** bem organizado. Microsserviços só quando houver necessidade real (escala de equipe ou de carga), não por moda.

---

## 3. Design de API

### Convenções REST

- Recursos no **plural**, em **kebab-case**, em inglês: `/exams`, `/exam-sessions`.
- Hierarquia apenas quando houver dependência real e no máximo 2 níveis: `/exams/{examId}/questions`.
- Verbos HTTP com semântica correta:

| Verbo | Uso | Idempotente | Sucesso |
|---|---|---|---|
| `GET` | Ler | ✅ | `200` |
| `POST` | Criar / ação não idempotente | ❌ | `201` + header `Location` (ou `200`/`202` para ações) |
| `PUT` | Substituir por completo | ✅ | `200` / `204` |
| `PATCH` | Atualizar parcialmente | ⚠️ | `200` |
| `DELETE` | Remover | ✅ | `204` |

- **`GET` nunca altera estado.**
- Campos JSON em **camelCase** (consistente com o front-end TypeScript).
- Datas em **ISO‑8601 em UTC** (`2026-10-28T14:30:00Z`).
- Valores monetários como **inteiros em centavos** ou string decimal — nunca float.
- IDs expostos são **opacos** (UUID), nunca IDs sequenciais (evita enumeração).

### Status de erro

| Código | Quando |
|---|---|
| `400` | Requisição malformada |
| `401` | Não autenticado (sem credencial ou credencial inválida) |
| `403` | Autenticado, mas sem permissão |
| `404` | Não encontrado **ou** sem permissão para saber que existe |
| `409` | Conflito de estado (duplicidade, versão desatualizada) |
| `422` | Validação de negócio/campos falhou |
| `429` | Limite de requisições excedido (com header `Retry-After`) |
| `500` | Erro inesperado (sem detalhes internos) |
| `503` | Indisponível temporariamente |

### Formato de erro padronizado (RFC 9457 — Problem Details)

```json
{
  "type": "https://shiken-dojo.app/errors/validation",
  "title": "Dados inválidos",
  "status": 422,
  "code": "VALIDATION_FAILED",
  "detail": "Alguns campos precisam ser corrigidos.",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "errors": {
    "title": "O título é obrigatório.",
    "durationMinutes": "Deve ser maior que zero."
  }
}
```

- `code` é **estável** e usado pelo front-end para lógica; `title`/`detail` são para humanos.
- `traceId` permite correlacionar com os logs — **nunca** inclua stack trace, SQL ou nomes de tabelas.

### Listagens

- **Sempre paginadas**, com tamanho máximo imposto pelo servidor (ex.: `limit` ≤ 100).
- Prefira **paginação por cursor** para listas grandes ou que mudam com frequência; offset é aceitável para listas pequenas.
- Filtros e ordenação via query params, com **allowlist** de campos permitidos.

```json
{ "items": [ ... ], "nextCursor": "eyJpZCI6...", "hasMore": true }
```

### Contrato e versionamento

- API documentada em **OpenAPI 3.1**, gerada a partir do código ou validada contra ele no CI.
- Gere os tipos do front-end a partir do contrato OpenAPI sempre que possível.
- Versionamento na URL (`/v1/...`). Mudanças incompatíveis exigem nova versão e período de depreciação comunicado (header `Deprecation`/`Sunset`).
- Mudanças **aditivas** (novo campo opcional) não quebram clientes — clientes devem ignorar campos desconhecidos.

### Idempotência

- Operações `POST` críticas (pagamentos, envio de prova, criação de recursos acionada por retry) aceitam o header **`Idempotency-Key`**; o servidor armazena o resultado e devolve a mesma resposta em repetições.

### DTOs

- **Nunca** exponha entidades do banco diretamente. Use DTOs de entrada e de saída.
- O DTO de saída contém **apenas** os campos que o cliente precisa (nunca `passwordHash`, flags internas, dados de outros usuários).

---

## 4. Autenticação

> Autenticação é difícil de acertar. **Prefira um provedor de identidade consolidado** (OIDC) a implementar do zero.

### Senhas (se houver login próprio)

- Hash com **Argon2id** (preferido) ou **bcrypt** (custo ≥ 12). **Nunca** MD5, SHA-1, SHA-256 puro ou criptografia reversível.
- Política: mínimo de **8 caracteres** (recomendado 12+), sem regras de composição arbitrárias, máximo de pelo menos 64 caracteres.
- Verifique contra listas de **senhas vazadas** (ex.: API *k-anonymity* do Have I Been Pwned).
- Nunca envie senha por e-mail nem a registre em logs.

### Sessões e tokens

- **Para aplicações web (preferido)**: sessão no servidor + cookie com `HttpOnly; Secure; SameSite=Lax` (ou `Strict`), `Path=/`, nome com prefixo `__Host-`.
- **Se usar JWT**:
  - Access token de **vida curta** (5–15 min).
  - Refresh token **rotativo**, de uso único, armazenado em cookie `HttpOnly`, com detecção de reutilização (reuso → revoga toda a família).
  - Assine com algoritmo forte (`RS256`/`EdDSA` ou `HS256` com segredo forte); **rejeite `alg: none`** e valide `iss`, `aud`, `exp`, `nbf`.
  - Não coloque dados sensíveis no payload (JWT é apenas codificado, não criptografado).
  - Mantenha uma forma de **revogação** (lista de sessões ativas ou versão de token por usuário).
- Regenere o ID de sessão após login e mudança de privilégio (evita *session fixation*).
- Expiração por inatividade e expiração absoluta.
- Logout invalida a sessão **no servidor**.
- Permita ao usuário ver e encerrar **sessões ativas** em outros dispositivos.

### Fluxos sensíveis

- **MFA** disponível para todos e obrigatório para administradores. Prefira **passkeys/WebAuthn** e TOTP; SMS apenas como último recurso.
- **Rate limit e bloqueio progressivo** em login, cadastro, recuperação de senha e verificação de MFA.
- **Não revele se uma conta existe**: "Se este e-mail estiver cadastrado, você receberá um link."
- Tokens de recuperação/verificação: aleatórios (≥ 128 bits), **uso único**, expiração curta (15–60 min), armazenados como **hash**.
- Ações críticas (trocar e-mail, senha, excluir conta, desativar MFA) exigem **reautenticação** e geram **notificação** ao usuário.
- OAuth/OIDC: **Authorization Code + PKCE**, validação de `state` e `nonce`, `redirect_uri` com correspondência exata.

---

## 5. Autorização

- Verificada **no servidor, em todo request**, na camada de aplicação — nunca confiando em algo enviado pelo cliente (ex.: `role` no body, `userId` no body).
- O ID do usuário vem **da sessão/token validado**, nunca de parâmetros.
- **Autorização em nível de objeto (BOLA — risco nº 1 da OWASP API)**: para cada recurso acessado, verifique se *este* usuário pode acessar *este* objeto.
  ```
  // ❌ busca apenas pelo ID
  exam = repo.findById(examId)

  // ✅ restringe pelo dono/escopo
  exam = repo.findOne({ id: examId, ownerId: currentUser.id })
  ```
- **Autorização em nível de propriedade**: o usuário pode ver/alterar *este campo*? (Evita *mass assignment*: usuário enviando `"role": "admin"`.)
- **Autorização em nível de função**: endpoints administrativos separados e protegidos.
- Modelo: comece com **RBAC** (papéis) e evolua para **ABAC/ReBAC** se necessário. Centralize a lógica de permissão em um único módulo (políticas), não espalhada em `if`s.
- Para recursos que o usuário não pode ver, retorne **`404`** em vez de `403` (não confirma a existência).
- Em multi-tenant, **todo** acesso a dados é filtrado pelo tenant. Considere *Row-Level Security* no banco como camada extra.
- Teste de autorização é obrigatório: cada endpoint tem teste para "usuário sem permissão" e "usuário de outro dono".

---

## 6. Validação de entrada

- **Valide tudo** que entra: body, query, params, headers, cookies, arquivos, mensagens de fila, webhooks.
- Use **validação por schema** com **allowlist** (ex.: Zod, class-validator, Pydantic, JSON Schema). Campos não declarados são **rejeitados ou descartados**.
- Valide **tipo, formato, tamanho, faixa e enumerações**.
- Limites explícitos: tamanho de strings, tamanho de arrays, profundidade de JSON, tamanho total do body.
- Normalize antes de validar (trim, Unicode NFC, e-mail em minúsculas).
- Validação de formato no transporte; validação de **regras de negócio** no domínio.
- **Validação do front-end não conta** — é só UX.

### Upload de arquivos

- Allowlist de tipos verificada pelo **conteúdo (magic bytes)**, não só pela extensão ou `Content-Type`.
- Limite de tamanho por arquivo e por usuário.
- **Renomeie** o arquivo (nome gerado pelo servidor); nunca use o nome original no caminho.
- Armazene **fora do servidor da aplicação** (object storage), em bucket privado, servido por URLs assinadas e com tempo de expiração.
- Escaneie contra malware quando o arquivo for compartilhado com outros usuários.
- Remova metadados (EXIF com localização) de imagens.
- Sirva com `Content-Disposition: attachment` quando não for para exibição, e `X-Content-Type-Options: nosniff`.

---

## 7. Prevenção de injeções e ataques comuns

| Ataque | Prevenção |
|---|---|
| **SQL Injection** | **Sempre** queries parametrizadas / ORM. Proibido concatenar input em SQL. Nomes de colunas para ordenação dinâmica via allowlist. |
| **NoSQL Injection** | Valide tipos (não aceite objetos onde se espera string, ex.: `{"$gt": ""}`). |
| **Command Injection** | Evite chamar shell. Se inevitável, use APIs com array de argumentos, nunca string interpolada. |
| **Path Traversal** | Nunca use input do usuário em caminhos de arquivo; use IDs mapeados no servidor. |
| **SSRF** | Ao buscar URLs fornecidas pelo usuário: allowlist de domínios, bloqueio de IPs internos/metadata (`169.254.169.254`, `10.0.0.0/8`, `localhost`…), sem seguir redirects cegamente. |
| **XSS armazenado** | Armazene o dado bruto; o front-end escapa ao exibir. Se aceitar HTML/Markdown rico, sanitize no servidor com allowlist. |
| **Desserialização insegura** | Nunca desserialize formatos que executam código (pickle, serialização nativa de objetos) a partir de dados externos. |
| **XXE** | Desabilite entidades externas em parsers XML (ou evite XML). |
| **ReDoS** | Evite regex com backtracking catastrófico em input do usuário; limite o tamanho da entrada. |
| **Mass Assignment** | DTOs com allowlist de campos editáveis; nunca `update(entity, req.body)`. |
| **Race conditions** | Transações, locks otimistas (`version`), constraints únicas no banco e idempotência em operações críticas. |

---

## 8. Proteções na camada HTTP

### Transporte

- **HTTPS obrigatório** em todos os ambientes expostos. TLS **1.2+** (preferir 1.3).
- **HSTS**: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- Redirecione HTTP → HTTPS.

### Headers de segurança

```
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
```

- Remova headers que revelam tecnologia (`X-Powered-By`, versão do servidor).

### CORS

- **Allowlist explícita** de origens. **Nunca** `Access-Control-Allow-Origin: *` com credenciais.
- Não reflita o header `Origin` sem validar.
- Restrinja métodos e headers permitidos.

### CSRF

- Com cookies de sessão: `SameSite=Lax/Strict` **+** token anti-CSRF (padrão *double submit* compatível com o `HttpClient` do Angular: cookie `XSRF-TOKEN` → header `X-XSRF-TOKEN`).
- Nunca altere estado em `GET`.

### Rate limiting e proteção contra abuso

- Limite **por IP e por usuário/chave**, com limites mais rígidos em endpoints sensíveis (login, cadastro, recuperação de senha, envio de e-mail, busca).
- Responda `429` com `Retry-After`.
- Timeouts em todas as requisições, limite de tamanho de body e de conexões simultâneas.
- CAPTCHA (preferencialmente invisível) em pontos de abuso automatizado, após detectar comportamento suspeito.
- WAF e proteção DDoS na borda (CDN / provedor de nuvem).

---

## 9. Banco de dados

### Modelagem

- Recomendado: **PostgreSQL** (robusto, transacional, rico em tipos, RLS, JSONB quando necessário).
- Modele normalizado (3FN) por padrão; desnormalize **conscientemente** e com motivo documentado.
- Nomes em **snake_case**, inglês, tabelas no **plural**: `users`, `exam_sessions`.
- Chaves primárias: **UUID v7** (ordenável por tempo, bom para índices) ou `bigint` interno + UUID público.
- **Constraints são regras de negócio que o banco garante**: `NOT NULL`, `UNIQUE`, `CHECK`, `FOREIGN KEY`. Não confie só na aplicação.
- Colunas de auditoria em toda tabela: `created_at`, `updated_at` (e `created_by`/`updated_by` quando relevante).
- **Timestamps sempre em UTC** (`timestamptz`).
- Dinheiro: `numeric(12,2)` ou inteiro em centavos. **Nunca `float`.**
- Enumerações: `CHECK` constraint ou tabela de referência.
- Controle de concorrência otimista com coluna `version` em entidades editadas simultaneamente.

### Índices e consultas

- Índice em toda **chave estrangeira** e em colunas usadas em `WHERE`, `JOIN` e `ORDER BY` frequentes.
- Analise consultas lentas com `EXPLAIN ANALYZE`; monitore o *slow query log*.
- Evite **N+1**: use joins/eager loading conscientes ou carregamento em lote.
- Nunca `SELECT *` em código de produção — selecione as colunas necessárias.
- Todas as listagens com `LIMIT`.
- Não crie índices sem necessidade: eles custam em escrita e armazenamento.

### Transações

- Operações que alteram múltiplas tabelas ocorrem em **uma transação**.
- Transações **curtas**: nunca chame APIs externas dentro de uma transação aberta.
- Conheça o nível de isolamento usado e suas anomalias; use `SELECT ... FOR UPDATE` ou constraints quando houver disputa.
- Para eventos que precisam ser publicados junto com a alteração no banco, use o padrão **Transactional Outbox**.

### Migrações

- Todo alteração de schema via **migração versionada** no repositório. **Nunca** altere o schema de produção manualmente.
- Migrações são revisadas como código e testadas em staging com volume de dados realista.
- **Compatíveis com deploy sem downtime** (padrão *expand → migrate → contract*):
  1. Adicione a nova coluna/tabela (compatível com o código antigo).
  2. Faça o deploy do código que usa ambas; migre os dados.
  3. Remova o que é antigo em um deploy posterior.
- Cuidado com operações que travam tabelas grandes (adicionar coluna com default em versões antigas, criar índice sem `CONCURRENTLY`).

### Acesso e segurança do banco

- O banco **não é acessível pela internet** — apenas pela rede privada da aplicação.
- **Usuários separados** com menor privilégio:
  - `app_runtime`: apenas `SELECT/INSERT/UPDATE/DELETE` nas tabelas necessárias.
  - `app_migrator`: alterações de schema (usado só no pipeline).
  - Acesso humano: somente leitura por padrão, nominal, auditado e temporário.
- Conexões com **TLS**.
- **Criptografia em repouso** habilitada (disco/volume).
- **Criptografia em nível de coluna** para dados altamente sensíveis (documentos, dados de saúde, tokens de terceiros).
- **Pool de conexões** dimensionado; configure `statement_timeout` para evitar consultas eternas.
- **Proibido usar dados reais de produção em desenvolvimento/testes.** Use dados sintéticos (seeds) ou cópias **anonimizadas**.

### Exclusão de dados

- Defina por entidade: **soft delete** (`deleted_at`) ou **hard delete**.
- Soft delete **não** atende ao direito de exclusão da LGPD para dados pessoais — tenha um processo de exclusão/anonimização definitiva.
- Lembre-se de backups, caches, índices de busca, logs e terceiros ao excluir dados.

---

## 10. Privacidade e LGPD

> O Shiken Dojo trata dados pessoais de usuários brasileiros: a **LGPD (Lei 13.709/2018)** se aplica. Se houver usuários na Europa, a **GDPR** também.

### Princípios aplicados

| Princípio LGPD | Na prática |
|---|---|
| **Finalidade** | Todo dado coletado tem um propósito documentado. |
| **Adequação / Necessidade** | Colete apenas o mínimo necessário para essa finalidade. |
| **Livre acesso** | O usuário pode ver quais dados temos sobre ele. |
| **Qualidade** | O usuário pode corrigir seus dados. |
| **Transparência** | Política de privacidade clara e acessível. |
| **Segurança / Prevenção** | Medidas técnicas deste documento. |
| **Não discriminação** | Dados não usados para fins discriminatórios. |
| **Responsabilização** | Registro das operações de tratamento e das medidas adotadas. |

### Obrigações técnicas

- **Inventário de dados (data mapping)**: quais dados pessoais existem, onde estão, por que, base legal, por quanto tempo, com quem são compartilhados.
- **Classificação de dados**:
  - *Público* — conteúdo publicado.
  - *Interno* — métricas agregadas.
  - *Pessoal* — nome, e-mail, histórico de estudo.
  - *Sensível* (art. 5º, II) — saúde, biometria, origem racial, religião etc. **Evite coletar.** Se inevitável, proteção reforçada e base legal específica.
- **Base legal registrada** para cada tratamento (consentimento, execução de contrato, legítimo interesse, obrigação legal…).
- **Consentimento** (quando for a base legal): livre, informado, específico, registrado (quem, quando, versão do termo) e **revogável tão facilmente quanto foi dado**.
- **Direitos do titular** implementados como funcionalidades:
  - Acesso e **exportação** (portabilidade) em formato estruturado (JSON/CSV).
  - Correção.
  - **Exclusão / anonimização** da conta e dos dados.
  - Revogação de consentimento.
  - Informação sobre compartilhamento com terceiros.
- **Política de retenção**: cada tipo de dado tem prazo de guarda; jobs automáticos excluem/anonimizam o que expirou.
- **Pseudonimização/anonimização** para análises e ambientes não produtivos.
- **Menores de idade**: se o público incluir crianças/adolescentes, tratamento no melhor interesse deles e consentimento de um responsável quando exigido.
- **Encarregado (DPO)** definido e canal de contato publicado.
- **Incidentes**: comunicação à **ANPD** e aos titulares afetados em prazo razoável (conforme regulamentação vigente da ANPD) quando houver risco ou dano relevante.
- **Contratos com operadores** (provedores de nuvem, e-mail, analytics) prevendo proteção de dados; transferência internacional apenas com salvaguardas.

---

## 11. Coleta de dados e analytics

- **Consentimento antes** de qualquer rastreamento não essencial (analytics, marketing, pixels). Cookies estritamente necessários dispensam consentimento.
- **Nada de dados pessoais em ferramentas de analytics**: sem e-mail, nome, CPF ou texto livre do usuário. Use um ID pseudônimo.
- Prefira ferramentas que respeitem privacidade, ou analytics *self-hosted*/*server-side*, com IPs anonimizados.
- **Plano de rastreamento (tracking plan)** versionado: cada evento tem nome, descrição, propriedades, tipo e responsável.
- Convenção de nome de eventos: **`objeto_ação`** no passado, em snake_case: `exam_started`, `question_answered`, `exam_completed`.
- Propriedades com tipos estáveis; não mude o significado de um evento existente — crie um novo.
- Colete **apenas eventos ligados a uma pergunta de produto**. "Coletar tudo, vai que um dia precise" viola a LGPD e gera ruído.
- Valide eventos no CI/staging para garantir qualidade dos dados.
- Defina **retenção** dos dados analíticos.
- Separe **dados operacionais** (banco da aplicação) de **dados analíticos** (data warehouse); replique para análise via ETL/ELT, nunca rode consultas analíticas pesadas no banco de produção.

---

## 12. Gestão de segredos e criptografia

### Segredos

- **Nunca** no código, no repositório, em imagens Docker, em logs ou em mensagens de erro.
- Armazenados em um **secret manager** (AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, Vault, Doppler…) e injetados em tempo de execução.
- `.env` apenas em desenvolvimento local, sempre no `.gitignore`; mantenha um `.env.example` **sem valores reais**.
- Segredos **diferentes por ambiente**.
- **Rotação** periódica e imediata em caso de suspeita de vazamento (e após saída de membros da equipe).
- **Varredura de segredos** no CI e em *pre-commit* (ex.: gitleaks, trufflehog). Ative o *secret scanning* do GitHub.
- Se um segredo vazar no Git: **rotacione primeiro**, limpe o histórico depois (o histórico já pode ter sido clonado).

### Criptografia

- **Não implemente criptografia própria.** Use bibliotecas consolidadas (libsodium, bibliotecas nativas da plataforma).
- Criptografia simétrica: **AES-256-GCM** ou **ChaCha20-Poly1305**.
- Chaves geridas por **KMS**, com *envelope encryption* e rotação.
- Números aleatórios de segurança (tokens, IDs de sessão) com **CSPRNG**, nunca `Math.random()` ou equivalentes.
- Compare tokens/segredos com **comparação em tempo constante**.
- Hash de senhas: ver [Autenticação](#4-autenticação). Hash ≠ criptografia.

---

## 13. Integração com APIs externas

### Chamadas de saída

- **Timeout obrigatório** em toda chamada (conexão e leitura). Nunca use o padrão "infinito".
- **Retries** apenas em erros transitórios (`5xx`, `429`, timeout) e apenas para operações **idempotentes**, com **backoff exponencial + jitter** e número máximo de tentativas.
- **Circuit breaker** para não derrubar a aplicação quando um fornecedor cair.
- **Fallback** definido: degradar funcionalidade com elegância (ex.: mostrar dado em cache) em vez de falhar tudo.
- **Valide as respostas** de terceiros como se fossem input do usuário (schema).
- Isole cada integração em um **client/adaptador** próprio (camada de infraestrutura) — o domínio não conhece o fornecedor.
- Chaves de API de terceiros com **escopo mínimo**, guardadas no secret manager, uma por ambiente.
- Respeite os limites de uso do fornecedor; monitore cotas e custos.
- Chamadas lentas ou não essenciais vão para **filas** (processamento assíncrono), não para o fluxo síncrono da requisição do usuário.
- Registre latência, taxa de erro e volume por integração.

### Webhooks recebidos

- **Verifique a assinatura** (HMAC ou assinatura assimétrica) usando comparação em tempo constante.
- Proteja contra **replay**: valide timestamp (janela curta) e armazene IDs de eventos já processados.
- **Responda rápido** (`2xx`) e processe de forma assíncrona.
- Processamento **idempotente** — o mesmo evento pode chegar mais de uma vez e fora de ordem.
- Não confie no conteúdo: se necessário, busque o estado atualizado na API do fornecedor.

### Webhooks enviados (se oferecermos)

- Assine os payloads, inclua timestamp e ID do evento, faça retries com backoff e ofereça forma de reenvio.
- Proteja contra SSRF ao chamar URLs configuradas pelos clientes.

---

## 14. Processamento assíncrono

- Use **filas** para tarefas lentas, sujeitas a falha ou que não precisam bloquear o usuário: envio de e-mails, geração de relatórios, processamento de arquivos, chamadas a terceiros.
- Jobs são **idempotentes** (podem rodar mais de uma vez sem efeito duplicado).
- **Dead-letter queue** para mensagens que falharam após N tentativas, com alerta.
- Mensagens contêm IDs, não dados pessoais completos (busque os dados ao processar).
- Agendamentos (cron) com **lock distribuído** para não executar em duplicidade com várias instâncias.
- Monitore tamanho da fila, idade da mensagem mais antiga e taxa de falha.

---

## 15. Tratamento de erros

- **Um handler global** de erros converte exceções no formato Problem Details (seção [Design de API](#3-design-de-api)).
- Diferencie **erros esperados** (validação, não encontrado, conflito → `4xx`, log `info`/`warn`) de **erros inesperados** (bugs, falhas de infraestrutura → `5xx`, log `error` + alerta).
- **Nunca** retorne ao cliente: stack traces, mensagens de exceção do banco, caminhos de arquivos, versões de bibliotecas, nomes de tabelas.
- Mensagens de autenticação genéricas ("E-mail ou senha incorretos").
- Não engula exceções silenciosamente (`catch {}` vazio é proibido).
- Garanta liberação de recursos (conexões, arquivos, locks) em caso de erro.
- Desligamento **gracioso**: ao receber `SIGTERM`, pare de aceitar requisições, termine as em andamento e feche conexões.

---

## 16. Observabilidade (logs, métricas, traces)

### Logs

- **Estruturados (JSON)**, com campos consistentes: `timestamp`, `level`, `message`, `service`, `env`, `traceId`, `userId` (pseudônimo), `route`, `durationMs`.
- **ID de correlação** (`traceId`) propagado em todas as chamadas e retornado ao cliente nos erros.
- Níveis usados corretamente: `debug` (desligado em produção), `info`, `warn`, `error`, `fatal`.
- **Nunca registre**: senhas, tokens, cookies, headers `Authorization`, números de documentos, dados de cartão, conteúdo completo de requests com dados pessoais. Implemente **mascaramento automático** de campos sensíveis.
- Retenção de logs definida e acesso restrito.

### Logs de auditoria

- Registro **imutável** (append-only) de eventos de segurança: login (sucesso/falha), logout, MFA, troca de senha/e-mail, mudança de permissões, acesso administrativo, exportação e exclusão de dados.
- Responda: **quem** fez **o quê**, **quando**, **de onde** e **com qual resultado**.

### Métricas

- **RED** para serviços: *Rate* (requisições/s), *Errors* (taxa de erro), *Duration* (latência p50/p95/p99).
- **USE** para recursos: *Utilization*, *Saturation*, *Errors* (CPU, memória, disco, conexões do banco).
- Métricas de negócio: cadastros, provas iniciadas/concluídas, falhas de pagamento.

### Traces

- **OpenTelemetry** para tracing distribuído (HTTP, banco, filas, APIs externas).

### Health checks e alertas

- `/health/live` (o processo está vivo) e `/health/ready` (pronto para receber tráfego: banco e dependências críticas ok). Sem dados sensíveis na resposta.
- Defina **SLOs** (ex.: 99,9% de disponibilidade, p95 < 300 ms) e alerte quando o *error budget* estiver sendo consumido rápido demais.
- Alertas **acionáveis**: cada alerta tem um *runbook* dizendo o que fazer. Alerta que ninguém age é ruído — remova.

---

## 17. Infraestrutura e controle de servidor

- **Infraestrutura como código** (Terraform, Pulumi, CDK…) versionada e revisada. Nada configurado manualmente no console.
- **Containers**:
  - Imagens base mínimas (distroless/alpine/slim) e com versões fixadas.
  - Executar como **usuário não-root**, sistema de arquivos somente leitura quando possível.
  - *Multi-stage build*: a imagem final não contém ferramentas de build nem código-fonte desnecessário.
  - Varredura de vulnerabilidades nas imagens no CI.
- **Rede**:
  - Banco, cache e filas em **sub-redes privadas**.
  - Apenas o load balancer/API gateway exposto publicamente.
  - Security groups / firewalls com **menor privilégio** (portas e origens específicas).
- **IAM**: identidades de serviço com permissões mínimas; sem chaves de longa duração quando houver alternativa (roles, workload identity).
- **Acesso humano à produção**: excepcional, nominal, com MFA, temporário (*just-in-time*) e auditado. Nada de contas compartilhadas.
- **Patching**: sistema operacional, runtime e dependências atualizados regularmente; vulnerabilidades críticas corrigidas em prazo definido (ex.: 7 dias).
- **Ambientes isolados**: dev, staging e produção em contas/projetos separados, com dados e segredos separados.
- **Autoscaling** com limites mínimos e máximos e **alertas de custo**.
- Recursos com **limites de CPU/memória** definidos.
- Sincronização de horário (NTP) em todos os servidores — essencial para logs, tokens e auditoria.

---

## 18. Performance e escalabilidade

- **Meça antes de otimizar.** Otimize com base em métricas, não em suposições.
- **Cache** em camadas, com estratégia de invalidação definida *antes* de cachear:
  - HTTP (`Cache-Control`, `ETag`) para dados públicos/estáveis.
  - Cache de aplicação (ex.: Redis) para consultas caras.
  - Nunca cacheie respostas personalizadas em caches compartilhados (CDN) sem chave por usuário — risco de vazar dados entre usuários.
- Compressão (`gzip`/`brotli`) das respostas.
- Paginação obrigatória; evite respostas gigantes.
- Réplicas de leitura para consultas de leitura intensa, quando necessário.
- Trabalho pesado fora do ciclo da requisição (filas).
- **Testes de carga** antes de lançamentos importantes, com metas definidas.

---

## 19. Testes

| Tipo | Objetivo |
|---|---|
| **Unitário** | Regras de domínio e funções puras — rápidos e numerosos. |
| **Integração** | Repositórios e módulos com **banco real** (ex.: Testcontainers), não mocks de banco. |
| **API / E2E** | Endpoints completos: status, contrato, autenticação e **autorização**. |
| **Contrato** | Garante que a API cumpre o OpenAPI que o front-end consome. |
| **Segurança** | SAST (análise estática), SCA (dependências), DAST (ex.: OWASP ZAP) em staging, varredura de segredos. |
| **Carga** | Comportamento sob carga esperada e de pico (k6, Gatling, JMeter). |

Regras:

- Todo endpoint tem testes para: **sucesso**, **validação inválida**, **não autenticado (401)**, **sem permissão / recurso de outro usuário (403/404)**.
- Todo bug corrigido ganha um teste que o reproduz.
- Testes independentes, determinísticos e com dados criados pelo próprio teste.
- *Pentest* externo periódico e antes de lançamentos importantes.

---

## 20. CI/CD e deploy

### Pipeline (cada PR)

1. Lint e formatação
2. Testes unitários e de integração
3. Build
4. Varredura de segredos
5. SAST + análise de dependências (SCA) — bloqueia em vulnerabilidades críticas/altas
6. Validação do contrato OpenAPI
7. Build e scan da imagem de container

### Deploy

- **Automatizado**, reproduzível e a partir da `main` (ninguém faz deploy da própria máquina).
- **Imutável**: a mesma imagem promovida de staging para produção.
- Migrações de banco executadas pelo pipeline, com usuário de migração dedicado.
- Estratégia sem downtime: **rolling**, **blue/green** ou **canary**.
- **Rollback** rápido e testado.
- **Feature flags** para desacoplar deploy de lançamento.
- Monitoramento reforçado logo após cada deploy.
- Dependências com versões fixadas (lockfile) e atualizadas com ferramenta automática (Dependabot/Renovate).
- Branch `main` protegida: PR obrigatório, aprovações e checks verdes.

---

## 21. Backup, continuidade e resposta a incidentes

### Backup

- Regra **3-2-1**: 3 cópias, em 2 tipos de mídia/serviço, 1 fora da região/conta principal.
- **Point-in-time recovery** habilitado no banco.
- Backups **criptografados** e com acesso restrito (idealmente imutáveis, para resistir a ransomware).
- **Teste de restauração** periódico (ex.: trimestral). Backup não testado não é backup.
- Defina e documente **RPO** (quanto dado podemos perder) e **RTO** (em quanto tempo voltamos).

### Resposta a incidentes

- Plano documentado: **detectar → conter → erradicar → recuperar → aprender**.
- Papéis definidos (quem coordena, quem comunica, quem investiga).
- *Runbooks* para cenários previsíveis (banco fora, vazamento de credencial, ataque DDoS, fornecedor indisponível).
- Em incidente com dados pessoais: avaliar risco e comunicar ANPD e titulares conforme a LGPD (seção [Privacidade](#10-privacidade-e-lgpd)).
- **Post-mortem sem culpados** após cada incidente relevante, com ações corretivas rastreadas.
- Página de status para comunicar indisponibilidades aos usuários.

---

## 22. Referência OWASP

### OWASP Top 10 (Web)

| Risco | Onde tratamos |
|---|---|
| Broken Access Control | §5 Autorização |
| Cryptographic Failures | §12 Segredos e criptografia, §8 Transporte |
| Injection | §6 Validação, §7 Injeções |
| Insecure Design | §1 Princípios, §2 Arquitetura |
| Security Misconfiguration | §8 Headers/CORS, §17 Infraestrutura |
| Vulnerable and Outdated Components | §20 CI/CD (SCA), §17 Patching |
| Identification and Authentication Failures | §4 Autenticação |
| Software and Data Integrity Failures | §20 Pipeline, §13 Webhooks, §7 Desserialização |
| Security Logging and Monitoring Failures | §16 Observabilidade |
| Server-Side Request Forgery | §7 SSRF |

### OWASP API Security Top 10

| Risco | Onde tratamos |
|---|---|
| Broken Object Level Authorization | §5 (verificar dono/escopo em toda consulta) |
| Broken Authentication | §4 |
| Broken Object Property Level Authorization | §3 DTOs, §5, §7 Mass Assignment |
| Unrestricted Resource Consumption | §8 Rate limiting, §3 Paginação, §6 Limites |
| Broken Function Level Authorization | §5 Endpoints administrativos |
| Unrestricted Access to Sensitive Business Flows | §8 Anti-abuso / CAPTCHA |
| Server Side Request Forgery | §7 |
| Security Misconfiguration | §8, §17 |
| Improper Inventory Management | §3 OpenAPI e versionamento |
| Unsafe Consumption of APIs | §13 Integrações |

---

## 23. Checklist de Pull Request

**API**
- [ ] Rotas, verbos, status e formato de erro seguem o padrão
- [ ] Entrada validada por schema com allowlist e limites de tamanho
- [ ] DTO de saída expõe apenas o necessário
- [ ] Listagens paginadas com limite máximo
- [ ] Contrato OpenAPI atualizado

**Segurança**
- [ ] Autenticação exigida onde necessário
- [ ] Autorização verificada no servidor, **em nível de objeto**
- [ ] Sem SQL/comandos montados por concatenação
- [ ] Sem segredos no código ou nos logs
- [ ] Nenhum dado sensível em logs, mensagens de erro ou URLs
- [ ] Endpoints sensíveis com rate limit

**Banco de dados**
- [ ] Migração versionada, revisada e compatível com deploy sem downtime
- [ ] Constraints e índices adequados
- [ ] Operações multi-tabela em transação; sem chamada externa dentro da transação
- [ ] Sem N+1 e sem `SELECT *`

**Privacidade**
- [ ] Novos dados pessoais têm finalidade, base legal e retenção definidas
- [ ] Inclusos nos fluxos de exportação e exclusão de dados do usuário
- [ ] Eventos de analytics sem dados pessoais e registrados no tracking plan

**Integrações**
- [ ] Timeouts, retries com backoff e tratamento de falha definidos
- [ ] Webhooks com verificação de assinatura e idempotência

**Qualidade**
- [ ] Testes de sucesso, validação, 401 e 403/404
- [ ] Logs estruturados com `traceId`; métricas/alertas para o novo fluxo, se crítico
- [ ] Pipeline verde (lint, testes, SAST, SCA, secret scan)
