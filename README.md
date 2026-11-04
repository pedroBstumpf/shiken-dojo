# Shiken Dojo 試験道場

Sistema para professores de karatê cadastrarem alunos, aplicarem provas de faixa e manterem o histórico de graduações.

| Pasta | Conteúdo |
|---|---|
| [frontend/](frontend/) | Aplicação Angular com Firebase ([como funciona, rodar e publicar](docs/FIREBASE.md)) |
| [backend/](backend/) | API Node.js + PostgreSQL. **Fora de uso:** guardada para o caso de ser necessária no futuro |
| [docs/](docs/) | Guias do projeto |

## Rodando localmente

Precisa de Node.js 24+ e [Java 21](https://adoptium.net/temurin/releases/?version=21) (para o emulador do Firestore).

```bash
cd frontend
npm install
npm run emulators       # deixe rodando; em outro terminal, continue abaixo
npm run emulators:seed  # dados de demonstração; mostra o login e a senha
npm start               # http://localhost:4200
```

## Guias

- [FIREBASE.md](docs/FIREBASE.md) — como o app funciona, como publicar e como desenvolver
- [FRONTEND.md](docs/FRONTEND.md) — boas práticas de Angular, TypeScript, Material e Tailwind
- [DESIGN.md](docs/DESIGN.md) — boas práticas de interface e experiência do usuário
- [BACKEND.md](docs/BACKEND.md) — boas práticas de back-end, banco de dados e segurança
- [INTEGRACAO-BACKEND.md](docs/INTEGRACAO-BACKEND.md) — contrato da API, esquema PostgreSQL e próximos passos
- [docs/adr/](docs/adr/) — decisões de arquitetura

## Branches

- `main` — versão estável
- `dev` — desenvolvimento e testes
