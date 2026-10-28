# Shiken Dojo — Front-end

Angular 22 · TypeScript (strict) · Angular Material 3 · Tailwind CSS 4 · Vitest

## Rodando

```bash
npm install
npm start          # http://localhost:4200
```

Não precisa de back-end: a API é simulada por `src/app/mock-api/` e os dados ficam no `localStorage`
do navegador (com alunos e uma prova de exemplo). Para recomeçar do zero, apague a chave `sd-mock-db`
no DevTools → Application → Local Storage.

## Comandos

| Comando | O que faz |
|---|---|
| `npm start` | Servidor de desenvolvimento |
| `npm test` | Testes unitários (Vitest) |
| `npm run lint` | ESLint (TypeScript + templates + acessibilidade) |
| `npm run build` | Build de produção em `dist/` |
| `npx prettier --write "src/**/*.{ts,html,css,scss}"` | Formatação (ordena as classes do Tailwind) |

## Funcionalidades

- **Início** — resumo do dojo, avaliações em andamento, provas recentes e alunos por faixa.
- **Alunos** — cadastro, edição, busca, filtro por faixa (na URL) e exclusão com "Desfazer".
- **Professores** — cadastro com contato, faixa e grau (dan), registro na federação, função no dojo e situação (ativo/inativo). Professores ativos são os examinadores das provas.
- **Notas** — escala de 0 a 3 (aceita meio ponto, ex.: 2,5); valores acima de 3 não podem ser digitados.
- **Aplicar prova** — escolha da tabela de avaliação, dados do exame e alunos. A tabela de notas segue o formulário em papel (técnicas nas linhas, alunos nas colunas), destaca em cruz a linha e a coluna da célula ativa, navega pelo teclado (setas, Enter configurável, Esc desfaz) e salva automaticamente.
- **Histórico** — provas concluídas e em andamento, com resultado por aluno (carimbo 合格), tabela completa e impressão.
- Modo claro/escuro (segue o sistema; o botão no topo alterna).

## Estrutura

Siga [docs/FRONTEND.md](../docs/FRONTEND.md) (código) e [docs/DESIGN.md](../docs/DESIGN.md) (interface).
O que falta para ligar o back-end está em [docs/INTEGRACAO-BACKEND.md](../docs/INTEGRACAO-BACKEND.md).

```
src/app/
├── core/          # shell (cabeçalho, navegação), tema, interceptors, notificações
├── shared/        # data-access (API, DTOs, regras de pontuação), ui, pipes, utils, validators, guards
├── features/
│   ├── dashboard/
│   ├── students/  # lista e formulário de alunos
│   ├── teachers/  # lista e formulário de professores
│   └── exams/     # aplicar prova, avaliar (tabela de notas), histórico e resultado
└── mock-api/      # back-end simulado (temporário)
```
