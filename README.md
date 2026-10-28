# Shiken Dojo 試験道場

Sistema para professores de karatê cadastrarem alunos, aplicarem provas de faixa e manterem o histórico de graduações.

| Pasta | Conteúdo |
|---|---|
| [backend/](backend/) | API Node.js + PostgreSQL ([como rodar](backend/README.md)) |
| [frontend/](frontend/) | Aplicação Angular ([como rodar](frontend/README.md)) |
| [docs/](docs/) | Guias do projeto |

## Rodando localmente

```bash
cd backend && npm install && npm run db:setup && npm run db:migrate && npm run db:seed && npm run dev
cd frontend && npm install && npm start   # em outro terminal: http://localhost:4200
```

Login de demonstração: `okada@dojo.exemplo`, senha em `SEED_PASSWORD` no `backend/.env`.

## Guias

- [FRONTEND.md](docs/FRONTEND.md) — boas práticas de Angular, TypeScript, Material e Tailwind
- [DESIGN.md](docs/DESIGN.md) — boas práticas de interface e experiência do usuário
- [BACKEND.md](docs/BACKEND.md) — boas práticas de back-end, banco de dados e segurança
- [INTEGRACAO-BACKEND.md](docs/INTEGRACAO-BACKEND.md) — contrato da API, esquema PostgreSQL e próximos passos
- [docs/adr/](docs/adr/) — decisões de arquitetura

## Branches

- `main` — versão estável
- `dev` — desenvolvimento e testes
