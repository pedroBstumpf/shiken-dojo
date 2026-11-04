# Shiken Dojo — Front-end

Angular 22 · TypeScript (strict) · Angular Material 3 · Tailwind CSS 4 · Vitest

## Rodando

Os dados ficam no Firebase. Em desenvolvimento tudo roda em emuladores locais, que precisam do
[Java 21](https://adoptium.net/temurin/releases/?version=21).

```bash
npm install
npm run emulators       # deixe rodando; em outro terminal, continue abaixo
npm run emulators:seed  # dados de demonstração; mostra o login e a senha
npm start               # http://localhost:4200
```

Como o app funciona e como publicar: [docs/FIREBASE.md](../docs/FIREBASE.md).

## Comandos

| Comando | O que faz |
|---|---|
| `npm start` | Servidor de desenvolvimento |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:rules` | Testes das regras de segurança, no emulador |
| `npm run deploy` | Publica o site e as regras no Firebase |
| `npm run lint` | ESLint (TypeScript + templates + acessibilidade) |
| `npm run build` | Build de produção em `dist/` |
| `npx prettier --write "src/**/*.{ts,html,css,scss}"` | Formatação (ordena as classes do Tailwind) |

## Funcionalidades

- **Acesso** — login de professores (Firebase), convite por e-mail feito por qualquer professor logado e "Esqueci minha senha".
- **Início** — resumo do dojo, avaliações em andamento, provas recentes e alunos por faixa.
- **Alunos** — cadastro, edição, busca, filtro por faixa (na URL) e exclusão com "Desfazer".
- **Professores** — cadastro com contato, faixa e grau (dan), registro na federação, função no dojo e situação (ativo/inativo). Professores ativos são os examinadores das provas.
- **Notas** — escala de 0 a 3 (aceita meio ponto, ex.: 2,5); valores acima de 3 não podem ser digitados.
- **Aplicar prova** — escolha da tabela de avaliação, dados do exame e alunos. A tabela de notas segue o formulário em papel (técnicas nas linhas, alunos nas colunas), destaca em cruz a linha e a coluna da célula ativa, navega pelo teclado (setas, Enter configurável, Esc desfaz) e salva automaticamente.
- **Histórico** — provas concluídas e em andamento, com resultado por aluno (carimbo 合格) e tabela completa.
- **PDF** — na avaliação e no resultado: exportar a prova (com as notas lançadas ou em branco), compartilhar pelo sistema e, no histórico, importar PDFs gerados pelo próprio app.
- Modo claro/escuro (segue o sistema; o botão no topo alterna).

## Estrutura

Siga [docs/FRONTEND.md](../docs/FRONTEND.md) (código) e [docs/DESIGN.md](../docs/DESIGN.md) (interface).
Como os dados e o login funcionam: [docs/FIREBASE.md](../docs/FIREBASE.md).

```
src/app/
├── core/          # shell, tema, notificações, conexão com o Firebase e auth (sessão, guards)
├── shared/        # data-access (Firestore, regras de pontuação), ui, pipes, utils, validators, guards
├── features/
│   ├── auth/      # login e recuperação de senha
│   ├── dashboard/
│   ├── students/  # lista e formulário de alunos
│   ├── teachers/  # lista e formulário de professores
│   └── exams/     # aplicar prova, avaliar (tabela de notas), histórico e resultado
```
