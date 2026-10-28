# Shiken Dojo — Front-end

Angular 22 · TypeScript (strict) · Angular Material 3 · Tailwind CSS 4 · Vitest

## Rodando

```bash
npm install
npm start          # http://localhost:4200
```

O front-end conversa com a API em [`backend/`](../backend/README.md): rode o back-end antes
(`npm run dev` na pasta `backend`, porta 3000). O `ng serve` encaminha `/api` para ele
(`proxy.conf.json`), então app e API ficam na mesma origem e os cookies de sessão funcionam sem CORS.

Para entrar com os dados de demonstração, use `okada@dojo.exemplo` (sensei responsável) ou
`mariana@dojo.exemplo` (instrutora), com a senha `SEED_PASSWORD` do `backend/.env`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm start` | Servidor de desenvolvimento |
| `npm test` | Testes unitários (Vitest) |
| `npm run lint` | ESLint (TypeScript + templates + acessibilidade) |
| `npm run build` | Build de produção em `dist/` |
| `npx prettier --write "src/**/*.{ts,html,css,scss}"` | Formatação (ordena as classes do Tailwind) |

## Funcionalidades

- **Acesso** — login de professores (sessão em cookie HttpOnly), convite por e-mail para definir a senha e sessões ativas.
- **Início** — resumo do dojo, avaliações em andamento, provas recentes e alunos por faixa.
- **Alunos** — cadastro, edição, busca, filtro por faixa (na URL) e exclusão com "Desfazer".
- **Professores** — cadastro com contato, faixa e grau (dan), registro na federação, função no dojo e situação (ativo/inativo). Professores ativos são os examinadores das provas.
- **Notas** — escala de 0 a 3 (aceita meio ponto, ex.: 2,5); valores acima de 3 não podem ser digitados.
- **Aplicar prova** — escolha da tabela de avaliação, dados do exame e alunos. A tabela de notas segue o formulário em papel (técnicas nas linhas, alunos nas colunas), destaca em cruz a linha e a coluna da célula ativa, navega pelo teclado (setas, Enter configurável, Esc desfaz) e salva automaticamente.
- **Histórico** — provas concluídas e em andamento, com resultado por aluno (carimbo 合格) e tabela completa.
- **PDF e e-mail** — na avaliação e no resultado: exportar a prova em PDF (com as notas lançadas — o que falta sai como quadrado em branco — ou totalmente em branco para preencher à mão) e enviar o PDF ao e-mail cadastrado de um professor. Sem servidor de e-mail configurado no back-end, o envio é só simulado (o e-mail fica em `backend/.local/mail`).
- Modo claro/escuro (segue o sistema; o botão no topo alterna).

## Estrutura

Siga [docs/FRONTEND.md](../docs/FRONTEND.md) (código) e [docs/DESIGN.md](../docs/DESIGN.md) (interface).
O contrato com a API está em [docs/INTEGRACAO-BACKEND.md](../docs/INTEGRACAO-BACKEND.md).

```
src/app/
├── core/          # shell, tema, interceptors, notificações e auth (sessão, guards)
├── shared/        # data-access (API, DTOs, regras de pontuação), ui, pipes, utils, validators, guards
├── features/
│   ├── auth/      # login, convite (definir senha) e sessões ativas
│   ├── dashboard/
│   ├── students/  # lista e formulário de alunos
│   ├── teachers/  # lista e formulário de professores
│   └── exams/     # aplicar prova, avaliar (tabela de notas), histórico e resultado
```
