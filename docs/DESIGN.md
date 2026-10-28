# Guia de Design de Interface e Experiência (UI/UX)

> Este documento define **como as interfaces do Shiken Dojo devem parecer, se comportar e se comunicar**.
> O objetivo é uma experiência **fluida, previsível e intuitiva**: o usuário nunca deve precisar pensar em *como* usar a interface — apenas no que quer fazer.
>
> Implementação técnica (Angular Material + Tailwind): veja [FRONTEND.md](./FRONTEND.md).

---

## Sumário

1. [Princípios de design](#1-princípios-de-design)
2. [Design tokens](#2-design-tokens)
3. [Cor](#3-cor)
4. [Tipografia](#4-tipografia)
5. [Espaçamento e layout](#5-espaçamento-e-layout)
6. [Hierarquia visual](#6-hierarquia-visual)
7. [Componentes](#7-componentes)
8. [Estados de interface](#8-estados-de-interface)
9. [Feedback e tempo de resposta](#9-feedback-e-tempo-de-resposta)
10. [Movimento e animação](#10-movimento-e-animação)
11. [Navegação e arquitetura de informação](#11-navegação-e-arquitetura-de-informação)
12. [Formulários](#12-formulários)
13. [Escrita para interfaces (UX Writing)](#13-escrita-para-interfaces-ux-writing)
14. [Acessibilidade](#14-acessibilidade)
15. [Responsividade e mobile](#15-responsividade-e-mobile)
16. [Onboarding, estados vazios e primeiro uso](#16-onboarding-estados-vazios-e-primeiro-uso)
17. [Prevenção e recuperação de erros](#17-prevenção-e-recuperação-de-erros)
18. [Dados, tabelas e visualizações](#18-dados-tabelas-e-visualizações)
19. [Ética e confiança](#19-ética-e-confiança)
20. [Processo de design](#20-processo-de-design)
21. [Checklist de tela](#21-checklist-de-tela)

---

## 1. Princípios de design

### Nossos princípios

1. **Clareza antes de tudo.** Se algo pode ser mal interpretado, será. Cada tela tem **um propósito claro** e **uma ação principal**.
2. **Consistência gera confiança.** O mesmo problema é sempre resolvido da mesma forma. Mesmo componente, mesma posição, mesmo comportamento, mesmas palavras.
3. **Feedback imediato.** Toda ação do usuário recebe uma resposta visível. Silêncio é percebido como erro.
4. **Menos é mais.** Cada elemento na tela compete por atenção. Remova até que só reste o necessário.
5. **O usuário está no controle.** Permita desfazer, voltar, cancelar e editar. Nunca prenda o usuário.
6. **Prevenir é melhor que corrigir.** Projete para que o erro seja difícil de cometer.
7. **Acessível por padrão.** Acessibilidade não é uma etapa final; é critério de qualidade desde o primeiro rascunho.

### As 10 heurísticas de Nielsen (referência para revisão)

| # | Heurística | Pergunta de checagem |
|---|---|---|
| 1 | Visibilidade do status do sistema | O usuário sabe o que está acontecendo agora? |
| 2 | Correspondência com o mundo real | Usamos a linguagem do usuário, não a do sistema? |
| 3 | Controle e liberdade | Existe uma "saída de emergência" (cancelar, desfazer, voltar)? |
| 4 | Consistência e padrões | Isto funciona como no resto do app e como em apps conhecidos? |
| 5 | Prevenção de erros | Poderíamos ter evitado esse erro em vez de exibir uma mensagem? |
| 6 | Reconhecer em vez de lembrar | O usuário precisa memorizar algo de outra tela? |
| 7 | Flexibilidade e eficiência | Há atalhos para usuários experientes sem atrapalhar iniciantes? |
| 8 | Estética e design minimalista | Tudo na tela é realmente necessário? |
| 9 | Ajudar a reconhecer e se recuperar de erros | A mensagem de erro explica o problema e como resolver? |
| 10 | Ajuda e documentação | Ajuda está disponível no contexto, quando necessária? |

### Leis de UX úteis

- **Lei de Hick** — mais opções = decisão mais lenta. Limite escolhas; destaque a recomendada.
- **Lei de Fitts** — alvos maiores e mais próximos são mais rápidos de acertar. Ações principais grandes e acessíveis.
- **Lei de Jakob** — usuários passam a maior parte do tempo em outros apps. Siga padrões conhecidos.
- **Lei de Miller** — agrupe informações em blocos (≈ 5 a 7 itens por grupo).
- **Efeito Von Restorff** — o que é diferente é lembrado. Use destaque com parcimônia, só no que importa.
- **Lei de Tesler** — a complexidade não desaparece; decida se o sistema ou o usuário vai lidar com ela (prefira o sistema).
- **Limiar de Doherty** — respostas em menos de 400 ms mantêm o usuário engajado.

---

## 2. Design tokens

Tokens são a **única fonte de verdade** dos valores visuais. Designers e desenvolvedores usam os mesmos nomes.
Nenhum valor visual (cor, tamanho, raio, sombra, duração) é usado fora dos tokens.

| Categoria | Exemplos de token | Origem |
|---|---|---|
| Cor | `primary`, `on-primary`, `surface`, `on-surface`, `error`, `outline` | Material 3 (`--mat-sys-*`) mapeado no Tailwind |
| Tipografia | `display`, `headline`, `title`, `body`, `label` (cada um em `lg/md/sm`) | Escala tipográfica do Material 3 |
| Espaçamento | `1` (4px), `2` (8px), `3` (12px), `4` (16px), `6` (24px), `8` (32px), `12` (48px), `16` (64px) | Escala do Tailwind (base 4px) |
| Raio | `sm` (4px), `md` (8px), `lg` (12px), `xl` (16px), `full` | Tema |
| Elevação | `0` a `5` | Material 3 |
| Movimento | `fast` (100ms), `base` (200ms), `slow` (300ms) + curvas de easing | Tema |
| Breakpoints | `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 | Tailwind |

---

## 3. Cor

### Uso por papel, não por matiz

Nunca pense "botão azul"; pense "**ação principal**". As cores são definidas por **papel semântico**:

| Papel | Uso |
|---|---|
| `primary` | Ação principal, elementos ativos, links, foco |
| `secondary` / `tertiary` | Ações e destaques de apoio |
| `surface` / `surface-variant` | Fundos de página, cards, painéis |
| `on-*` | Texto/ícone sobre a cor correspondente (garante contraste) |
| `outline` | Bordas e divisores |
| `error` | Erros e ações destrutivas |
| `success` / `warning` / `info` | Estados de sistema (definir tokens adicionais) |

### Regras

- **Regra 60-30-10**: ~60% cor neutra (superfícies), ~30% cor secundária (estrutura), ~10% cor de destaque (ações).
- **Contraste mínimo (WCAG AA)**:
  - Texto normal: **4.5:1**
  - Texto grande (≥ 24px, ou ≥ 18.66px bold): **3:1**
  - Componentes de UI e ícones informativos: **3:1**
- **Nunca use apenas a cor para transmitir informação.** Combine com ícone, texto ou padrão (ex.: resposta correta = verde **+ ícone ✓ + texto "Correta"**). Cerca de 8% dos homens têm alguma forma de daltonismo.
- Vermelho é reservado para **erros e destruição**. Não use vermelho como cor decorativa.
- **Modo escuro** é cidadão de primeira classe:
  - Não é só inverter cores: use superfícies cinza-escuras (não `#000` puro) e reduza saturação.
  - Elevação no escuro é comunicada por superfícies mais claras, não por sombras.
  - Teste toda tela nos dois temas.

---

## 4. Tipografia

- **Uma família tipográfica** (no máximo duas: uma para títulos, uma para texto). Recomendação: **Inter** ou **Roboto**.
- Use a **escala tipográfica do Material 3** — não invente tamanhos.
- Tamanho mínimo de texto corrido: **16px** (mobile e desktop). Textos auxiliares: mínimo **12px**.
- **Altura de linha**: 1.4–1.6 para texto corrido; 1.1–1.3 para títulos.
- **Comprimento de linha**: **45–75 caracteres** (`max-w-prose` / `~65ch`). Linhas longas cansam a leitura.
- Hierarquia por **tamanho e peso**, não por cor ou CAIXA ALTA.
- Use no máximo **3 pesos** (ex.: 400, 500, 700).
- Evite texto em itálico longo e texto justificado (cria "rios" de espaço).
- Alinhe texto à **esquerda**. Centralize apenas textos curtos (títulos de estado vazio, por exemplo).
- Números em tabelas e placares: use **algarismos tabulares** (`font-variant-numeric: tabular-nums`) e alinhe à direita.

---

## 5. Espaçamento e layout

### Grid de 4/8 pontos

Todo espaçamento é múltiplo de **4px** (preferencialmente **8px**). Isso cria ritmo visual e elimina decisões arbitrárias.

### Proximidade (Gestalt)

- Elementos relacionados ficam **próximos**; grupos diferentes ficam **separados**.
- **Espaço interno < espaço externo**: o padding de um card é menor que o espaço entre cards.
- Use espaço em branco antes de usar bordas ou divisores para separar conteúdo.

| Relação | Espaço sugerido |
|---|---|
| Ícone ↔ texto | 4–8px |
| Label ↔ campo | 4–8px |
| Itens de um mesmo grupo | 8–16px |
| Grupos/seções | 24–48px |
| Seções de página | 48–96px |

### Layout

- **Mobile-first**: projete primeiro para 360px e expanda.
- Largura máxima de conteúdo: ~**1200–1280px**, centralizado.
- Grid de **4 colunas** (mobile), **8** (tablet), **12** (desktop).
- Margens laterais: **16px** (mobile), **24px** (tablet), **32px+** (desktop).
- Alinhe elementos a uma grade comum. Desalinhamentos sutis parecem erros.

---

## 6. Hierarquia visual

- **Uma ação principal por tela** (botão `filled`). Ações secundárias em `outlined`/`tonal`; terciárias em `text`.
- O olho deve ter um **caminho claro**: título → informação principal → ação.
- Padrões de leitura: **F** para telas com muito texto, **Z** para telas com pouco conteúdo (landing pages).
- Use tamanho, peso, cor, espaço e posição — nessa ordem de preferência — para criar ênfase.
- **Teste do "olhar semicerrado"**: desfoque a tela; o elemento mais importante deve continuar se destacando.
- Agrupe conteúdo em **cards** apenas quando o agrupamento tiver significado (um item clicável, uma entidade). Não coloque tudo em cards.

---

## 7. Componentes

### Botões

| Variante | Quando usar |
|---|---|
| **Filled** (preenchido) | A ação principal da tela/diálogo. **Apenas um** por contexto. |
| **Tonal** | Ação importante, mas não principal. |
| **Outlined** | Ações secundárias. |
| **Text** | Ações de baixa ênfase (Cancelar, Ver mais). |
| **Icon button** | Ações compactas e universalmente reconhecidas (fechar, menu, favoritar) — sempre com tooltip e `aria-label`. |
| **FAB** | Ação primária e frequente de uma tela inteira (mobile). |

Regras:
- Rótulo com **verbo de ação específico**: "Iniciar prova", "Salvar alterações" — não "OK", "Enviar", "Sim".
- Em diálogos, a ação principal fica **à direita**; cancelar à esquerda dela.
- Ações destrutivas usam cor `error` e rótulo explícito: "Excluir prova".
- Botão em processamento mostra **loading no próprio botão** e mantém a largura.
- Não desabilite botões sem explicar o porquê — prefira deixar clicável e mostrar o que falta.

### Diálogos (modais)

- Use **somente** para decisões que precisam interromper o fluxo ou para tarefas curtas e focadas.
- Título como pergunta ou ação clara: "Excluir a prova 'JLPT N5'?"
- Corpo explica **a consequência**: "Esta ação não pode ser desfeita. 12 resultados serão perdidos."
- Fecháveis por `Esc`, botão de fechar e (quando não destrutivo) clique fora.
- **Nunca** abra um diálogo sobre outro diálogo.
- Formulários longos não cabem em diálogo — use uma página.

### Snackbars / toasts

- Mensagens curtas (1 linha) sobre o resultado de uma ação: "Prova salva".
- No máximo **uma ação** (geralmente "Desfazer").
- Duração: 4–6s; mais tempo se houver ação. Não use para erros críticos que exigem decisão.
- Posição consistente (base da tela).

### Ícones

- Um único conjunto: **Material Symbols** (mesmo estilo e peso em todo o app).
- Ícones **acompanhados de texto** sempre que o significado não for universal. Ícone sozinho é ambíguo.
- Tamanhos padronizados: 16, 20, 24 px.

### Cards e listas

- Toda a área do card é clicável quando ele leva a um detalhe (não só o título).
- Informação mais importante no topo-esquerda.
- Listas longas: busca, filtros e ordenação; paginação ou rolagem infinita com indicação de posição.

### Tooltips

- Apenas para informação **complementar**. Nunca coloque informação essencial só em tooltip (não funciona bem em touch).

---

## 8. Estados de interface

### Estados de componente

Todo componente interativo deve ter **todos** os estados desenhados:

| Estado | Descrição |
|---|---|
| Default | Aparência em repouso |
| Hover | Indica que é interativo (desktop) |
| Focus | Anel de foco visível e de alto contraste (teclado) |
| Pressed / Active | Resposta ao clique/toque |
| Selected | Item escolhido em um conjunto |
| Disabled | Indisponível (com motivo comunicado quando possível) |
| Loading | Ação em processamento |
| Error | Valor inválido ou ação falhou |

### Estados de tela

Toda tela que exibe dados tem **cinco estados** projetados:

1. **Ideal** — conteúdo completo.
2. **Carregando** — skeleton com o formato do conteúdo.
3. **Vazio** — explica o que aparecerá aqui e oferece a ação para começar.
4. **Erro** — o que aconteceu + como resolver + ação ("Tentar novamente").
5. **Parcial** — pouco conteúdo (1 item), conteúdo muito longo (textos enormes, nomes de 80 caracteres), permissões limitadas.

> Projete sempre com **dados reais** — nunca só com "Lorem ipsum" e nomes curtos perfeitos.

---

## 9. Feedback e tempo de resposta

| Tempo | Percepção | O que fazer |
|---|---|---|
| **< 100 ms** | Instantâneo | Nenhum indicador necessário; só a mudança de estado visual |
| **100 ms – 1 s** | Pequeno atraso perceptível | Indicador sutil (botão em loading) |
| **1 – 10 s** | Atenção começa a se perder | Skeleton ou spinner + manter contexto visível |
| **> 10 s** | Usuário vai fazer outra coisa | Barra de progresso determinada, estimativa de tempo, permitir sair e notificar ao concluir |

Regras:
- **Performance percebida** importa tanto quanto a real: skeletons, atualizações otimistas e carregamento progressivo.
- Não mostre spinner por menos de ~300 ms (gera "piscada"); aguarde um pequeno atraso antes de exibi-lo.
- Confirme ações bem-sucedidas de forma proporcional: mudança visual simples para ações pequenas, snackbar para ações relevantes, tela de sucesso só para marcos (ex.: concluir uma prova).
- **Prefira "Desfazer" a "Tem certeza?"** — diálogos de confirmação são ignorados por hábito.

---

## 10. Movimento e animação

- Animação tem **função**: orientar, dar feedback, mostrar relação entre estados. Nunca decoração gratuita.
- **Durações**:
  - Microinterações (hover, toggle): **100–150 ms**
  - Transições de componentes (expandir, menu): **200–250 ms**
  - Transições de tela/elementos grandes: **300–400 ms**
- **Easing**:
  - Entrada: *decelerate* (`ease-out`) — o elemento chega suavemente.
  - Saída: *accelerate* (`ease-in`) — sai rapidamente. Saídas são mais curtas que entradas.
  - Movimento na tela: *standard* (`ease-in-out`).
- Anime **apenas `transform` e `opacity`** (performance).
- **Respeite `prefers-reduced-motion`**: substitua movimento por fade simples ou remova.
- Nunca bloqueie o usuário esperando uma animação terminar.

---

## 11. Navegação e arquitetura de informação

- O usuário deve sempre saber responder: **Onde estou? De onde vim? Para onde posso ir?**
- Item de menu ativo claramente destacado; título da página visível.
- **Navegação principal**:
  - Desktop: barra lateral (navigation rail/drawer) ou barra superior.
  - Mobile: **bottom navigation** com 3 a 5 destinos.
- **Breadcrumbs** em hierarquias com mais de 2 níveis.
- Nomes de menu usam a linguagem do usuário, não a estrutura interna do sistema.
- O botão "voltar" do navegador sempre funciona como esperado (estado refletido na URL).
- Mantenha a navegação rasa: tarefas frequentes a **no máximo 3 cliques/toques**.
- Busca global quando houver muito conteúdo.
- Faça *card sorting* e *tree testing* para validar a arquitetura antes de implementar.

---

## 12. Formulários

Formulários são onde os usuários mais desistem. Trate cada campo como um custo.

### Estrutura

- **Peça apenas o necessário.** Cada campo removido aumenta a conversão. Campos opcionais: questione se devem existir.
- **Uma coluna.** Formulários em várias colunas quebram o fluxo de leitura (exceção: campos naturalmente juntos, como cidade/UF).
- Agrupe campos relacionados com títulos de seção.
- Formulários longos: divida em **etapas** com indicador de progresso (stepper), salvando o progresso.
- Ordem lógica e natural (nome antes de e-mail, CEP preenchendo endereço).

### Campos

- **Label sempre visível**, acima ou flutuante (Material). **Placeholder não substitui label.**
- Indique o que é **opcional** (e não o que é obrigatório, se a maioria for obrigatória) — ou vice-versa, mas sempre de forma consistente.
- Texto de ajuda abaixo do campo quando o formato não for óbvio ("Mínimo 8 caracteres").
- Tamanho do campo sugere o tamanho da resposta (CEP curto, endereço longo).
- Use o **controle certo**:
  - 2–5 opções exclusivas → **radio buttons** (todas visíveis)
  - 6+ opções → **select** / autocomplete
  - Ligar/desligar com efeito imediato → **toggle**
  - Seleção múltipla → **checkboxes** / chips
  - Datas → date picker **com digitação permitida**
- Teclado correto no mobile (`type="email"`, `inputmode="numeric"`), autocompletar habilitado e máscaras que não atrapalham colar.
- Mostrar/ocultar senha; nunca bloqueie colar em campos de senha.

### Validação

- Valide **ao sair do campo** (blur) e no envio — não a cada tecla enquanto o usuário ainda digita.
- Depois que um erro aparece, revalide em tempo real para mostrar quando foi corrigido.
- Mensagem de erro **junto ao campo**, em vermelho **+ ícone**, dizendo **como corrigir**.
- No envio com erros: resumo no topo (em formulários longos) e foco no primeiro campo inválido.
- **Nunca apague** o que o usuário digitou por causa de um erro.

---

## 13. Escrita para interfaces (UX Writing)

Texto é interface. Palavras ruins arruinam um bom layout.

### Tom de voz

- **Claro, direto e amigável.** Como um bom professor de dojo: encorajador, sem ser infantil.
- Fale com o usuário em segunda pessoa ("Suas provas"), de forma natural.
- Evite jargão técnico ("Erro 500", "token inválido", "registro") — use a linguagem do usuário.
- **Sentence case** ("Criar nova prova"), não Title Case nem CAIXA ALTA.

### Regras

- **Seja breve.** Corte palavras até que o significado comece a se perder, então volte uma.
- Comece pelo mais importante.
- Botões com **verbo + objeto**: "Salvar resposta", "Ver resultado".
- Mantenha **o mesmo termo** para o mesmo conceito em todo o app (glossário). Se é "prova", nunca vira "teste" ou "exame" em outra tela.
- Números como dígitos ("3 questões", não "três questões").
- Datas e horas relativas quando recentes ("há 5 minutos"), absolutas quando distantes.

### Mensagens de erro

Fórmula: **o que aconteceu + por que (se útil) + o que fazer agora.**

| ❌ Ruim | ✅ Bom |
|---|---|
| "Erro." | "Não foi possível salvar sua prova. Verifique sua conexão e tente novamente." |
| "Entrada inválida." | "O e-mail precisa ter um @, como nome@exemplo.com." |
| "Erro 403." | "Você não tem permissão para editar esta prova. Peça acesso ao autor." |
| "Senha incorreta!" | "E-mail ou senha incorretos." *(não revele qual dos dois)* |

- **Nunca culpe o usuário.** Nada de "Você digitou errado".
- Sem pontos de exclamação em erros; sem humor em situações de frustração.

---

## 14. Acessibilidade

Meta: **WCAG 2.2 nível AA**. Acessibilidade beneficia todos (luz do sol forte, braço quebrado, conexão lenta, idosos).

### Perceptível
- Contraste conforme seção [Cor](#3-cor).
- Texto alternativo em imagens informativas.
- Legendas/transcrições para áudio e vídeo (importante para conteúdo de estudo, ex.: listening).
- Conteúdo legível com **zoom de 200%** e texto ampliado, sem perda de funcionalidade.
- Não dependa de cor, forma ou posição isoladamente.

### Operável
- **Tudo** acessível por teclado, em ordem lógica.
- **Foco visível** com contraste alto (≥ 3:1) e não encoberto por outros elementos.
- **Alvos de toque**: mínimo **24×24px** (WCAG 2.2); recomendado **44×44px** (mobile) com espaçamento entre alvos.
- Tempo limite ajustável ou extensível (relevante para provas cronometradas: ofereça opção de acessibilidade com tempo estendido).
- Nada piscando mais de 3 vezes por segundo.
- Alternativa a gestos complexos (arrastar → também botões).

### Compreensível
- Idioma da página declarado (`lang="pt-BR"`; trechos em japonês com `lang="ja"`).
- Navegação e componentes consistentes entre telas.
- Labels e instruções claras; erros identificados e explicados.
- Não peça a mesma informação duas vezes no mesmo fluxo.

### Robusto
- HTML semântico; ARIA apenas quando o HTML não for suficiente ("nenhum ARIA é melhor que ARIA ruim").
- Teste com leitores de tela reais (NVDA, VoiceOver, TalkBack).

---

## 15. Responsividade e mobile

- **Mobile-first**: o mobile força a priorização do essencial.
- Teste nas larguras: **360px**, **390px**, **768px**, **1024px**, **1280px**, **1440px+**.
- **Zona do polegar**: ações principais na metade inferior da tela em mobile.
- Nada de hover como única forma de revelar ações (não existe hover em touch).
- Tabelas largas em mobile: transformar em lista de cards ou permitir rolagem horizontal **com indicação visual**.
- Respeite as *safe areas* (notch, barra de gestos).
- Suporte orientação retrato e paisagem.
- Considere conexões lentas: carregamento progressivo, imagens otimizadas, estado offline claro ("Você está offline. Suas respostas serão sincronizadas.").

---

## 16. Onboarding, estados vazios e primeiro uso

- O **primeiro uso** define se o usuário volta. Leve-o ao primeiro valor (*aha moment*) o mais rápido possível.
- Prefira **aprender fazendo** a tours longos. Dicas contextuais no momento em que a funcionalidade é útil.
- Tours, se existirem: curtos (≤ 3–4 passos), puláveis e reabríveis.
- **Estados vazios são oportunidades**:
  - Ilustração ou ícone simples (opcional)
  - Título: o que é este espaço ("Nenhuma prova ainda")
  - Descrição: o benefício ("Crie uma prova para acompanhar seu progresso")
  - **Ação principal** ("Criar primeira prova")
- Diferencie vazio por **primeiro uso**, por **filtro sem resultado** ("Nenhum resultado para 'kanji N1'. Limpar filtros") e por **tudo concluído** ("Tudo revisado por hoje 🎉").
- Valores padrão inteligentes: pré-preencha o que for possível prever.

---

## 17. Prevenção e recuperação de erros

- **Restrinja entradas inválidas** em vez de reclamar delas depois (date picker em vez de texto livre para datas; desabilite datas impossíveis).
- **Confirmação** apenas para ações destrutivas **e irreversíveis**; para o resto, ofereça **desfazer**.
- Em exclusões muito graves, peça confirmação ativa (digitar o nome do item).
- **Salvamento automático** de rascunhos e respostas em andamento — uma prova interrompida por queda de conexão não pode perder respostas.
- Aviso ao sair de uma página com alterações não salvas.
- Erros de sistema: mantenha os dados do usuário, explique, ofereça tentar novamente.
- Páginas 404/500 amigáveis, com caminho de volta (início, busca).

---

## 18. Dados, tabelas e visualizações

### Tabelas
- Cabeçalho fixo em tabelas longas; colunas alinhadas: **texto à esquerda, números à direita**.
- Ordenação indicada visualmente na coluna; filtros visíveis e removíveis (chips).
- Densidade ajustável quando for uso intenso.
- Ações por linha consistentes (menu "⋮" ou ícones no hover + sempre acessíveis por teclado).
- Seleção múltipla com barra de ações contextual.

### Gráficos e progresso
- Escolha o gráfico pela pergunta: **comparação** → barras; **evolução no tempo** → linhas; **parte do todo** → barra empilhada (evite pizza com mais de 3–4 fatias).
- Eixos começando em zero em gráficos de barras.
- Rótulos diretos em vez de legendas distantes, quando possível.
- Paletas acessíveis para daltônicos; nunca diferencie séries só por cor.
- Mostre o **número** junto do visual em indicadores-chave (ex.: "78% de acerto").
- Progresso do usuário (metas, sequência de estudo, níveis) deve ser **motivador e honesto**: celebre conquistas reais sem punir falhas de forma desencorajadora.

---

## 19. Ética e confiança

- **Sem dark patterns**: nada de cancelamento escondido, opções pré-marcadas de marketing, urgência falsa, culpabilização ("Não, não quero aprender").
- Consentimento de cookies/analytics **claro**, com "Recusar" tão fácil quanto "Aceitar" (LGPD).
- Explique **por que** pedimos cada dado pessoal.
- Permita que o usuário veja, exporte e exclua seus dados com facilidade.
- Notificações: o usuário escolhe o que receber e com que frequência. Peça permissão de notificação **no contexto**, depois de mostrar o valor, nunca no primeiro acesso.
- Gamificação a serviço do aprendizado, não do vício (evite mecânicas que exploram ansiedade).

---

## 20. Processo de design

1. **Entender** — Qual problema? Para quem? Como saberemos que deu certo (métrica)?
2. **Pesquisar** — Entrevistas, análise de concorrentes, dados de uso existentes.
3. **Explorar** — Fluxos de usuário e wireframes de baixa fidelidade. Gere várias alternativas antes de escolher.
4. **Prototipar** — Protótipo navegável em alta fidelidade usando **apenas componentes e tokens do design system**.
5. **Testar** — Teste de usabilidade com **5 usuários** revela ~80% dos problemas. Observe; não explique.
6. **Especificar** — Entregue para desenvolvimento: todos os estados, comportamentos responsivos, textos finais, interações e casos extremos.
7. **Revisar (Design QA)** — Designer revisa a implementação antes do merge (comparar com o protótipo, temas claro/escuro, mobile).
8. **Medir** — Taxa de sucesso na tarefa, tempo na tarefa, taxa de erro, abandono, SUS/NPS, retenção.

### Design system

- Todo componente novo é avaliado: ele já existe? Pode ser uma variação de algo existente?
- Componentes novos são documentados (propósito, variações, estados, do/don't) antes de serem usados em larga escala.
- Divergências entre design e código são corrigidas na fonte (tokens), não pontualmente.

---

## 21. Checklist de tela

**Propósito e hierarquia**
- [ ] A tela tem um propósito claro e uma ação principal evidente
- [ ] O teste do olhar semicerrado destaca o que importa
- [ ] O usuário sabe onde está e como voltar

**Consistência**
- [ ] Usa apenas componentes e tokens do design system
- [ ] Mesmos termos, ícones e padrões do resto do app

**Estados**
- [ ] Carregando, vazio, erro, parcial e ideal projetados
- [ ] Todos os estados de componentes interativos (hover, focus, disabled, loading…)
- [ ] Testado com dados reais e extremos (textos longos, listas grandes, valores zero)

**Interação e feedback**
- [ ] Toda ação tem feedback em até 100 ms
- [ ] Ações destrutivas têm desfazer ou confirmação explícita
- [ ] Nenhum dado do usuário se perde em erro ou saída acidental

**Texto**
- [ ] Linguagem do usuário, sentence case, verbos de ação nos botões
- [ ] Mensagens de erro explicam o que fazer

**Acessibilidade**
- [ ] Contraste AA em texto e componentes
- [ ] Navegável e utilizável só com teclado; foco visível
- [ ] Alvos de toque ≥ 44px em mobile
- [ ] Informação não depende apenas de cor
- [ ] Funciona com zoom de 200% e `prefers-reduced-motion`

**Responsividade**
- [ ] Testado de 360px a 1440px+
- [ ] Testado em tema claro e escuro
