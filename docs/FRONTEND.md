# Guia de Boas Práticas — Front-end

> Stack: **Angular (v20+) · TypeScript (strict) · Angular Material (M3) · Tailwind CSS (v4)**
>
> Este documento é a referência oficial de como escrevemos código no front-end do **Shiken Dojo**.
> Ele existe para que qualquer pessoa (ou agente de IA) consiga ler, entender e reutilizar o código rapidamente.
> Quando uma regra daqui conflitar com um hábito pessoal, a regra vence. Quando a regra estiver errada, abra um PR alterando este arquivo.

---

## Sumário

1. [Princípios](#1-princípios)
2. [Estrutura de pastas](#2-estrutura-de-pastas)
3. [Nomenclatura](#3-nomenclatura)
4. [TypeScript](#4-typescript)
5. [Componentes](#5-componentes)
6. [Templates](#6-templates)
7. [Estado e reatividade (Signals + RxJS)](#7-estado-e-reatividade-signals--rxjs)
8. [Serviços e injeção de dependência](#8-serviços-e-injeção-de-dependência)
9. [Comunicação HTTP](#9-comunicação-http)
10. [Roteamento](#10-roteamento)
11. [Formulários](#11-formulários)
12. [Angular Material](#12-angular-material)
13. [Tailwind CSS](#13-tailwind-css)
14. [Estilos em geral](#14-estilos-em-geral)
15. [Performance](#15-performance)
16. [Segurança](#16-segurança)
17. [UX na implementação](#17-ux-na-implementação)
18. [Acessibilidade (a11y)](#18-acessibilidade-a11y)
19. [Tratamento de erros e logs](#19-tratamento-de-erros-e-logs)
20. [Testes](#20-testes)
21. [Qualidade de código e ferramentas](#21-qualidade-de-código-e-ferramentas)
22. [Git e fluxo de trabalho](#22-git-e-fluxo-de-trabalho)
23. [Checklist de Pull Request](#23-checklist-de-pull-request)

---

## 1. Princípios

| Princípio | O que significa na prática |
|---|---|
| **Legibilidade acima de esperteza** | Código é lido 10x mais do que escrito. Prefira o óbvio ao "elegante". |
| **Responsabilidade única** | Um arquivo = uma coisa. Um componente = uma responsabilidade. |
| **Reutilização consciente** | Extraia para `shared/` apenas quando houver **2+ usos reais**. Não crie abstrações especulativas. |
| **Tipagem como documentação** | Os tipos devem contar a história do dado. `any` é proibido. |
| **Reatividade declarativa** | Derive estado (`computed`) em vez de sincronizá-lo manualmente. |
| **Falhar de forma visível** | Todo fluxo assíncrono tem estados de *loading*, *vazio*, *erro* e *sucesso*. |
| **Front-end não é fronteira de segurança** | Toda regra de negócio e permissão é validada no back-end. O front apenas melhora a UX. |

---

## 2. Estrutura de pastas

Organização **por funcionalidade (feature)**, não por tipo de arquivo.

```
src/
├── app/
│   ├── core/                    # Singletons da aplicação (carregados uma vez)
│   │   ├── auth/                # AuthService, guards, interceptors de auth
│   │   ├── http/                # Interceptors genéricos (erro, loading, base URL)
│   │   ├── error-handling/      # ErrorHandler global, logger
│   │   ├── layout/              # Shell, header, sidebar, footer
│   │   └── config/              # InjectionTokens, configuração de ambiente
│   │
│   ├── shared/                  # Reutilizável e SEM regra de negócio
│   │   ├── ui/                  # Componentes de apresentação (button, empty-state, skeleton)
│   │   ├── directives/
│   │   ├── pipes/
│   │   ├── utils/               # Funções puras
│   │   ├── validators/
│   │   └── models/              # Tipos genéricos (Paginated<T>, ApiError…)
│   │
│   ├── features/                # Uma pasta por domínio/funcionalidade
│   │   └── exams/
│   │       ├── data-access/     # Services HTTP, stores, mappers, DTOs
│   │       ├── feature/         # Componentes "smart" (páginas/containers)
│   │       ├── ui/              # Componentes "dumb" exclusivos desta feature
│   │       ├── models/          # Tipos de domínio da feature
│   │       └── exams.routes.ts  # Rotas lazy da feature
│   │
│   ├── app.config.ts            # providers da aplicação
│   ├── app.routes.ts            # rotas raiz
│   └── app.component.ts
│
├── assets/                      # Imagens, ícones, fontes, i18n
├── environments/                # Configurações por ambiente (SEM segredos)
└── styles/
    ├── tailwind.css             # Entrada do Tailwind + mapeamento de tokens
    ├── material-theme.scss      # Tema do Angular Material
    └── global.css               # Reset mínimo e estilos realmente globais
```

### Regras de dependência entre pastas

```
features/*  ──►  shared/  ──►  (nada do app)
features/*  ──►  core/
core/       ──►  shared/
```

- `shared/` **nunca** importa de `features/` ou `core/`.
- Uma feature **não importa** de outra feature. Se duas features precisam da mesma coisa, ela sobe para `shared/` (se for genérica) ou para um `data-access` compartilhado.
- `core/` é importado apenas pelo `app.config.ts`, pelo layout e por features que precisem de serviços globais (ex.: `AuthService`).
- Aplique essas regras com lint (ex.: `eslint-plugin-boundaries` ou `@nx/enforce-module-boundaries`).

### Path aliases

Configure no `tsconfig.json` para evitar `../../../`:

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@core/*":     ["src/app/core/*"],
      "@shared/*":   ["src/app/shared/*"],
      "@features/*": ["src/app/features/*"],
      "@env/*":      ["src/environments/*"]
    }
  }
}
```

---

## 3. Nomenclatura

### Arquivos

- **kebab-case** sempre: `exam-result-card.component.ts`.
- Mantemos **sufixos explícitos de tipo** para facilitar busca e leitura (o CLI v20+ os omite por padrão; reative no `angular.json`):

```jsonc
"schematics": {
  "@schematics/angular:component": { "type": "component", "changeDetection": "OnPush", "style": "css" },
  "@schematics/angular:directive": { "type": "directive" },
  "@schematics/angular:service":   { "type": "service" },
  "@schematics/angular:guard":     { "typeSeparator": "." },
  "@schematics/angular:pipe":      { "typeSeparator": "." },
  "@schematics/angular:interceptor": { "typeSeparator": "." },
  "@schematics/angular:resolver":  { "typeSeparator": "." }
}
```

| Tipo | Arquivo | Classe / símbolo |
|---|---|---|
| Componente | `exam-card.component.ts` | `ExamCardComponent` |
| Serviço | `exam-api.service.ts` | `ExamApiService` |
| Store (estado) | `exam.store.ts` | `ExamStore` |
| Diretiva | `autofocus.directive.ts` | `AutofocusDirective` |
| Pipe | `duration.pipe.ts` | `DurationPipe` |
| Guard | `auth.guard.ts` | `authGuard` (função) |
| Interceptor | `error.interceptor.ts` | `errorInterceptor` (função) |
| Resolver | `exam.resolver.ts` | `examResolver` (função) |
| Modelo de domínio | `exam.model.ts` | `Exam` |
| DTO da API | `exam.dto.ts` | `ExamDto` |
| Mapper | `exam.mapper.ts` | `toExam()`, `toExamDto()` |
| Rotas | `exams.routes.ts` | `EXAMS_ROUTES` |
| Teste | `exam-card.component.spec.ts` | — |

### Seletores

- Prefixo do projeto: **`sd`** (Shiken Dojo). Configure `"prefix": "sd"` no `angular.json`.
- Componentes: `sd-exam-card` (kebab-case).
- Diretivas: `sdAutofocus` (camelCase, atributo).

### Código

| Elemento | Convenção | Exemplo |
|---|---|---|
| Variáveis e funções | `camelCase` | `totalScore`, `calculateScore()` |
| Classes, interfaces, types | `PascalCase` | `ExamSession` |
| Constantes globais | `UPPER_SNAKE_CASE` | `MAX_ATTEMPTS` |
| Booleanos | prefixo `is/has/can/should` | `isLoading`, `hasError`, `canSubmit` |
| Observables | sufixo `$` | `results$` |
| Signals | **sem** sufixo | `results`, `isLoading` |
| Signal privado gravável | prefixo `_` + exposição readonly | `_items` → `items` |
| Event handlers no template | `on` + evento/ação | `onSubmit()`, `onAnswerSelected()` |
| Outputs | verbo no passado/evento, sem prefixo `on` | `answerSelected`, `closed` |
| InjectionToken | `UPPER_SNAKE_CASE` | `API_BASE_URL` |

### Regras gerais

- Nomes em **inglês** no código; textos de interface via i18n.
- Nomes descrevem **intenção**, não implementação: `activeExams`, não `filteredArray`.
- Evite abreviações (`usr`, `btn`, `cfg`), exceto as universais (`id`, `url`, `api`, `dto`).
- Não use prefixo `I` em interfaces (`IUser` ✗ → `User` ✓).

---

## 4. TypeScript

### Configuração obrigatória (`tsconfig.json`)

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true
  },
  "angularCompilerOptions": {
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true,
    "extendedDiagnostics": { "defaultCategory": "error" }
  }
}
```

### Regras

- **Proibido `any`.** Use `unknown` e faça *narrowing* com type guards.
- Evite o operador de asserção não-nula `!`. Se precisar, é sinal de modelagem errada.
- Prefira **union types** a `enum`:
  ```ts
  export type ExamStatus = 'draft' | 'published' | 'archived';
  ```
  Se precisar iterar valores, use `as const`:
  ```ts
  export const EXAM_STATUSES = ['draft', 'published', 'archived'] as const;
  export type ExamStatus = (typeof EXAM_STATUSES)[number];
  ```
- `interface` para formatos de objeto; `type` para unions, interseções e utilitários.
- Marque como `readonly` tudo que não deve ser reatribuído (propriedades de classe, arrays em modelos).
- Funções e métodos públicos devem ter **tipo de retorno explícito**.
- Use utilitários nativos (`Pick`, `Omit`, `Partial`, `Readonly`, `Record`) em vez de duplicar tipos.
- Separe **DTO** (formato da API) de **Model** (formato que a UI usa). Converta em um *mapper*.
- Datas trafegam como string ISO‑8601 (UTC) no DTO e viram `Date` (ou tipo de biblioteca de datas) no Model.
- Use *discriminated unions* para estados:
  ```ts
  type LoadState<T> =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; data: T }
    | { status: 'error'; error: ApiError };
  ```

---

## 5. Componentes

### Regras gerais

- Todos os componentes são **standalone** (padrão do Angular moderno) — não criamos `NgModule`.
- **`ChangeDetectionStrategy.OnPush` sempre.**
- Use as APIs baseadas em funções: `input()`, `input.required()`, `output()`, `model()`, `viewChild()`, `contentChild()`, `inject()`.
- Não use os decorators legados `@Input`, `@Output`, `@ViewChild`, `@HostBinding`, `@HostListener`. Use o objeto `host` no decorator.
- Membros usados apenas pelo template: `protected`. Membros de API pública: `readonly`.
- Templates com mais de ~3 linhas vão para arquivo `.html` separado.
- Um componente com mais de **~200 linhas** ou mais de uma responsabilidade deve ser quebrado.

### Smart (container) × Dumb (presentational)

| | **Smart** (`feature/`) | **Dumb** (`ui/`) |
|---|---|---|
| Injeta serviços/stores | ✅ | ❌ |
| Faz chamadas HTTP | ✅ (via store/serviço) | ❌ |
| Recebe dados por `input()` | Raramente | ✅ sempre |
| Emite eventos por `output()` | Raramente | ✅ sempre |
| Reutilizável | Pouco | Muito |
| Fácil de testar | Médio | Muito |

### Exemplo de componente de apresentação

```ts
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Exam } from '../models/exam.model';

@Component({
  selector: 'sd-exam-card',
  imports: [MatCardModule, MatButtonModule],
  templateUrl: './exam-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class ExamCardComponent {
  readonly exam = input.required<Exam>();
  readonly isCompact = input(false);

  readonly started = output<Exam>();

  protected readonly questionLabel = computed(() => {
    const count = this.exam().questionCount;
    return count === 1 ? '1 questão' : `${count} questões`;
  });

  protected onStart(): void {
    this.started.emit(this.exam());
  }
}
```

### Ordem dos membros na classe

1. Injeções (`inject()`)
2. Inputs / models
3. Outputs
4. Queries (`viewChild`, `contentChild`)
5. Signals e estado interno
6. `computed`
7. Construtor / `effect`s
8. Hooks de ciclo de vida
9. Métodos públicos
10. Métodos protegidos (handlers do template)
11. Métodos privados

---

## 6. Templates

- Use o **control flow nativo**: `@if`, `@for`, `@switch`, `@defer`, `@let`. Não use `*ngIf`/`*ngFor`.
- `@for` **sempre** com `track` por um identificador estável (`track item.id`), nunca pelo índice quando a lista pode mudar.
- Sempre trate o caso vazio com `@empty`.
- **Não chame funções/métodos no template** para calcular valores — use `computed()` ou `pipe` puro.
- Nada de lógica complexa no template: se tem `&&`/`||` encadeados ou ternários aninhados, mova para um `computed`.
- Use `[class.x]` e `[style.x]` em vez de `ngClass`/`ngStyle`.
- Use `@defer` para blocos pesados abaixo da dobra ou acionados por interação.

```html
@if (store.isLoading()) {
  <sd-exam-list-skeleton />
} @else if (store.error(); as error) {
  <sd-error-state [error]="error" (retry)="store.reload()" />
} @else {
  @for (exam of store.exams(); track exam.id) {
    <sd-exam-card [exam]="exam" (started)="onStart($event)" />
  } @empty {
    <sd-empty-state
      title="Nenhuma prova ainda"
      description="Crie sua primeira prova para começar a estudar."
      actionLabel="Criar prova"
      (action)="onCreate()" />
  }
}

@defer (on viewport) {
  <sd-performance-chart [data]="store.history()" />
} @placeholder {
  <div class="h-64 animate-pulse rounded-lg bg-surface-variant"></div>
}
```

---

## 7. Estado e reatividade (Signals + RxJS)

### Quando usar cada um

| Use **Signals** para… | Use **RxJS** para… |
|---|---|
| Estado síncrono de UI e de domínio | Fluxos de eventos ao longo do tempo |
| Valores derivados (`computed`) | Requisições HTTP, WebSockets |
| Comunicação entre componentes | Operadores de tempo (`debounceTime`, `throttleTime`) |
| Templates (leitura direta) | Orquestração complexa (`switchMap`, `combineLatest`, cancelamento) |

Faça a ponte com `toSignal()` e `toObservable()` (`@angular/core/rxjs-interop`). Para carregamento de dados simples, considere `resource()` / `httpResource()`.

### Regras

- Estado derivado **sempre** com `computed()`, nunca sincronizado manualmente via `effect()`.
- `effect()` apenas para **efeitos colaterais** fora do Angular (localStorage, analytics, APIs do DOM). Nunca para setar outro signal.
- Atualize signals de forma **imutável**: `update(list => [...list, item])`, nunca `list().push(item)`.
- Exponha signals graváveis apenas como `asReadonly()`.
- Prefira o pipe `async`/`toSignal` a `.subscribe()` manual.
- Se precisar de `subscribe`, use `takeUntilDestroyed()` — nunca deixe subscriptions abertas.
- **Proibido `subscribe` dentro de `subscribe`.** Use `switchMap`, `concatMap`, `mergeMap` ou `exhaustMap`.
  - `switchMap` → busca/autocomplete (cancela a anterior)
  - `exhaustMap` → submit de formulário (ignora cliques repetidos)
  - `concatMap` → operações que precisam de ordem
  - `mergeMap` → operações paralelas independentes

### Padrão de store com signals

```ts
@Injectable({ providedIn: 'root' })
export class ExamStore {
  private readonly api = inject(ExamApiService);

  private readonly _exams = signal<readonly Exam[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<ApiError | null>(null);

  readonly exams = this._exams.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly publishedExams = computed(() => this.exams().filter(e => e.status === 'published'));

  load(): void {
    this._isLoading.set(true);
    this._error.set(null);
    this.api
      .list()
      .pipe(finalize(() => this._isLoading.set(false))) // roda em sucesso E em erro
      .subscribe({
        next: exams => this._exams.set(exams),
        error: (err: ApiError) => this._error.set(err),
      });
  }
}
```

> Se o estado global crescer muito, avalie **NgRx SignalStore**. Não adicione biblioteca de estado antes de sentir a dor.

---

## 8. Serviços e injeção de dependência

- Use `inject()` em vez de injeção por construtor.
- Serviços globais: `@Injectable({ providedIn: 'root' })` (tree-shakable).
- Serviços com escopo de feature: forneça no `providers` da rota.
- Use `InjectionToken` para configurações e valores não-classe:
  ```ts
  export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
  ```
- Separe responsabilidades:
  - `*-api.service.ts` → só fala com HTTP (sem estado).
  - `*.store.ts` → mantém estado e orquestra chamadas.
  - `*.mapper.ts` → funções puras de conversão DTO ↔ Model.
- Serviços **não** manipulam DOM e **não** abrem diálogos/snackbars diretamente — exponha estado/eventos e deixe a UI reagir (ou use um `NotificationService` dedicado em `core/`).

---

## 9. Comunicação HTTP

- Configure com `provideHttpClient(withFetch(), withInterceptors([...]))`.
- Interceptors **funcionais** (`HttpInterceptorFn`), um por responsabilidade:
  - `baseUrlInterceptor` — prefixa a URL da API.
  - `authInterceptor` — anexa credenciais / trata `401`.
  - `errorInterceptor` — normaliza erros para `ApiError`.
  - `loadingInterceptor` — (opcional) indicador global de carregamento.
- **Nunca** hardcode URLs em serviços. Use `environment` + `InjectionToken`.
- Tipar sempre a resposta: `http.get<ExamDto[]>(...)` e mapear para Model.
- Trate erros em **um** lugar (interceptor + store). Componentes recebem um erro já normalizado.
- Use `retry({ count: 2, delay: backoff })` **apenas** em requisições idempotentes (GET).
- Cancelamento: buscas e filtros usam `switchMap` para descartar requisições obsoletas.
- Paginação, filtros e ordenação via `HttpParams`, nunca concatenando strings.

```ts
@Injectable({ providedIn: 'root' })
export class ExamApiService {
  private readonly http = inject(HttpClient);

  list(params: ExamQuery): Observable<Paginated<Exam>> {
    return this.http
      .get<PaginatedDto<ExamDto>>('/exams', { params: toHttpParams(params) })
      .pipe(map(res => ({ ...res, items: res.items.map(toExam) })));
  }
}
```

---

## 10. Roteamento

- **Lazy loading em todas as features**: `loadComponent` / `loadChildren`.
- Guards e resolvers **funcionais** (`CanActivateFn`, `ResolveFn`).
- Ative `withComponentInputBinding()` para receber parâmetros de rota como `input()`.
- Defina `title` em todas as rotas (acessibilidade e SEO) — use um `TitleStrategy` customizado para o sufixo " · Shiken Dojo".
- Rota coringa `**` para uma página 404 amigável.
- URLs em **kebab-case**, em inglês, e refletindo o estado relevante (filtros e paginação em query params para permitir compartilhar e voltar).
- Use `withPreloading(PreloadAllModules)` ou estratégia customizada para rotas prováveis.

```ts
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'exams',
    canActivate: [authGuard],
    loadChildren: () => import('@features/exams/exams.routes').then(m => m.EXAMS_ROUTES),
  },
  { path: '**', loadComponent: () => import('@core/layout/not-found.component').then(m => m.NotFoundComponent), title: 'Página não encontrada' },
];
```

> ⚠️ Guards **não são segurança**. Eles só evitam navegação desnecessária. A API deve recusar o acesso.

---

## 11. Formulários

- Use **Reactive Forms tipados** com `NonNullableFormBuilder`.
- Não use Template-driven forms (exceto casos triviais isolados).
- Validações reutilizáveis ficam em `shared/validators/` como funções puras.
- Mensagens de erro centralizadas (um componente/pipe que traduz `ValidationErrors` → texto).
- Mostre erros **após** o usuário interagir (`touched`) ou ao tentar enviar — nunca enquanto ele ainda está digitando o primeiro caractere.
- Ao submeter um formulário inválido: `form.markAllAsTouched()` e mova o foco para o primeiro campo inválido.
- Desabilite o botão de envio **durante** o envio (não antes — deixe o usuário clicar e ver o que falta).
- Use os atributos corretos: `type="email"`, `inputmode`, `autocomplete="email"`, `autocomplete="current-password"`, etc.
- Formulários longos: confirmação antes de sair com alterações não salvas (`CanDeactivateFn`).

```ts
private readonly fb = inject(NonNullableFormBuilder);

protected readonly form = this.fb.group({
  title: ['', [Validators.required, Validators.maxLength(120)]],
  durationMinutes: [30, [Validators.required, Validators.min(1)]],
  isPublic: [false],
});
```

---

## 12. Angular Material

- Use **Material 3** com a API de tema baseada em *system tokens* (`mat.theme`).
- Importe **apenas os módulos usados** em cada componente (`MatButtonModule`, `MatInputModule`…).
- **Nunca** sobrescreva classes internas (`.mdc-*`, `.mat-mdc-*`) — elas mudam entre versões. Use as APIs de *overrides* de tokens (`mat.button-overrides`, `mat.form-field-overrides`…).
- Use **Component Harnesses** (`@angular/material/testing`) nos testes.
- Use o **CDK** para comportamentos sem visual próprio: `cdk/a11y` (FocusTrap, LiveAnnouncer), `cdk/overlay`, `cdk/drag-drop`, `cdk/scrolling` (virtual scroll), `cdk/layout` (BreakpointObserver).
- Envolva componentes Material usados com a mesma configuração em vários lugares num componente de `shared/ui/` (ex.: `sd-confirm-dialog`), para padronizar.
- Ícones: use **Material Symbols** e sempre `aria-hidden="true"` quando decorativos, ou `aria-label` quando o ícone for o único conteúdo do botão.

### Tema (`styles/material-theme.scss`)

```scss
@use '@angular/material' as mat;

html {
  color-scheme: light dark; // segue a preferência do sistema
  @include mat.theme((
    color: (
      primary: mat.$azure-palette,
      tertiary: mat.$violet-palette,
    ),
    typography: (plain-family: 'Inter', brand-family: 'Inter'),
    density: 0,
  ));
}

// Ajustes pontuais via tokens — nunca via classes internas
html {
  @include mat.button-overrides((filled-container-shape: 8px));
}
```

---

## 13. Tailwind CSS

### Divisão de responsabilidades

| Material cuida de… | Tailwind cuida de… |
|---|---|
| Componentes interativos (botões, inputs, diálogos, menus, tabelas) | Layout (`flex`, `grid`, `gap`) |
| Tema, cores de componentes, tipografia de componentes | Espaçamento (`p-*`, `m-*`) |
| Estados (hover/focus/ripple) dos componentes | Responsividade (`sm:`, `md:`, `lg:`) |
| Acessibilidade embutida | Utilitários pontuais (largura, alinhamento, truncar texto) |

> Regra de ouro: **não recrie com Tailwind um componente que o Material já oferece.**

### Configuração (Tailwind v4)

- Tailwind fica em um arquivo **`.css`** separado (Tailwind v4 não é feito para passar por Sass); o tema Material fica no `.scss`. Ambos listados em `styles` no `angular.json`.
- `.postcssrc.json` com `@tailwindcss/postcss`.
- **Mapeie as cores do Tailwind para os tokens do Material**, para que tudo responda ao mesmo tema e ao modo escuro:

```css
/* styles/tailwind.css */
@import 'tailwindcss';

@theme inline {
  --color-primary: var(--mat-sys-primary);
  --color-on-primary: var(--mat-sys-on-primary);
  --color-surface: var(--mat-sys-surface);
  --color-surface-variant: var(--mat-sys-surface-variant);
  --color-on-surface: var(--mat-sys-on-surface);
  --color-on-surface-variant: var(--mat-sys-on-surface-variant);
  --color-outline: var(--mat-sys-outline);
  --color-error: var(--mat-sys-error);
}
```

### Regras

- **Use apenas valores do design system.** Proibido valores arbitrários (`w-[347px]`, `text-[#3a7bd5]`) salvo exceção justificada em comentário.
- Cores sempre por **papel semântico** (`bg-surface`, `text-primary`), nunca por paleta crua (`bg-blue-500`).
- **Mobile-first**: classes base são para mobile; `md:`/`lg:` ampliam.
- Ordene as classes automaticamente com `prettier-plugin-tailwindcss`.
- Se uma lista de classes se repete ou passa de ~10 utilitários, **extraia um componente** (preferível) — não use `@apply` como atalho.
- Não misture Tailwind com estilos que alteram o interior de componentes Material.
- Verifique conflitos do *preflight* (reset) do Tailwind com Material; se necessário, ajuste a ordem de `@layer`.

---

## 14. Estilos em geral

- Estilos de componente ficam no próprio componente (encapsulamento emulado padrão).
- **Proibido `::ng-deep`** e `ViewEncapsulation.None` (salvo exceção documentada).
- **Evite `!important`.** Se precisar, o problema é especificidade.
- Não estilize por ID nem por seletores de tag genéricos.
- Unidades: `rem` para tipografia e espaçamento; `px` apenas para bordas finas.
- Respeite `prefers-reduced-motion` e `prefers-color-scheme`.
- Todos os valores visuais (cores, raios, sombras, durações) vêm de tokens — ver [DESIGN.md](./DESIGN.md).

---

## 15. Performance

- `OnPush` em todos os componentes; avalie **zoneless** (`provideZonelessChangeDetection()`) — é o padrão em versões recentes.
- Lazy loading de rotas e `@defer` para blocos pesados.
- `@for` com `track` estável. Listas longas (> 100 itens) com `cdk-virtual-scroll-viewport`.
- Imagens com `NgOptimizedImage` (`ngSrc`, `width`, `height`, `priority` na imagem LCP).
- Debounce em buscas e inputs que disparam requisições (`debounceTime(300)` + `distinctUntilChanged()`).
- Evite bibliotecas pesadas; prefira `date-fns` (tree-shakable) a bibliotecas monolíticas.
- Configure **budgets** no `angular.json` e falhe o build se forem estourados.
- Analise o bundle periodicamente (`ng build --stats-json` + `esbuild-visualizer`/`source-map-explorer`).
- Metas (Core Web Vitals): **LCP < 2,5s · INP < 200ms · CLS < 0,1**.
- Reserve espaço para conteúdo assíncrono (skeletons com altura definida) para evitar *layout shift*.
- Se SEO ou primeiro carregamento forem críticos, use **SSR + hydration incremental**.

---

## 16. Segurança

> O código front-end é **público**. Qualquer usuário pode lê-lo, alterá-lo e chamar a API diretamente.

### XSS e sanitização

- Angular sanitiza interpolação e bindings por padrão — **não contorne**.
- **Proibido** `bypassSecurityTrustHtml/Url/Script/Style/ResourceUrl` sem revisão de segurança e comentário justificando.
- Evite `[innerHTML]`. Se inevitável (ex.: Markdown), sanitize com **DOMPurify** antes.
- Nunca manipule DOM com `ElementRef.nativeElement.innerHTML`; use `Renderer2` ou bindings.
- Nunca construa templates dinamicamente a partir de input do usuário.

### Autenticação e tokens

- **Prefira cookies `HttpOnly; Secure; SameSite=Lax/Strict`** emitidos pelo back-end. Eles não são acessíveis via JavaScript.
- **Não guarde tokens de acesso em `localStorage`/`sessionStorage`** (vulnerável a XSS). Se o fluxo exigir token em JS, mantenha-o **apenas em memória** e use refresh via cookie HttpOnly.
- Use a proteção XSRF do `HttpClient` (`withXsrfConfiguration`) alinhada com o back-end.
- Faça logout limpando estado em memória, caches e stores.
- Em login social / OIDC, use **Authorization Code + PKCE**, nunca Implicit Flow.

### Dados e segredos

- **Nenhum segredo no front-end** (chaves privadas de API, senhas, tokens de serviço). `environment.ts` é público após o build.
- Não exponha dados sensíveis em URLs (query params ficam em logs e histórico).
- Não registre dados pessoais em `console`, analytics ou ferramentas de monitoramento de erros.
- Mascare dados sensíveis na UI quando adequado (ex.: últimos 4 dígitos).

### Outros

- Redirecionamentos (`?returnUrl=`) devem aceitar **apenas rotas internas** — evite *open redirect*.
- Links externos com `target="_blank"` levam `rel="noopener noreferrer"`.
- Apoie a **Content Security Policy** definida pelo servidor: sem scripts inline, sem `eval`. Considere habilitar **Trusted Types**.
- Dependências: `npm audit` no CI, Dependabot/Renovate ativo, lockfile versionado, revisar pacotes novos antes de adicionar.
- Validação no front é **UX**, não segurança: o back-end revalida tudo.

---

## 17. UX na implementação

Todo fluxo de dados implementa os **quatro estados**:

| Estado | Implementação |
|---|---|
| **Carregando** | Skeleton com o formato do conteúdo (preferível) ou spinner local. Nunca tela em branco. |
| **Vazio** | Componente `sd-empty-state` com explicação + ação principal. |
| **Erro** | Mensagem humana + ação de recuperação ("Tentar novamente"). |
| **Sucesso** | Conteúdo + feedback quando houver ação do usuário (snackbar, mudança visual). |

Regras adicionais:

- **Feedback em até 100 ms** para qualquer interação (estado visual de clique, ripple, botão em loading).
- **Evite duplo envio**: `exhaustMap` + botão com estado de loading.
- Prefira **desfazer** ("Prova excluída · Desfazer") a diálogos de confirmação, exceto em ações destrutivas irreversíveis.
- **Atualizações otimistas** onde o risco de falha for baixo, com rollback em caso de erro.
- Preserve o estado do usuário: filtros na URL, rascunhos de formulário, posição de rolagem ao voltar.
- Use `MatSnackBar` para confirmações breves; `MatDialog` só para decisões que bloqueiam o fluxo.
- Textos de interface vêm de i18n — nada de strings soltas espalhadas.
- Consulte o [DESIGN.md](./DESIGN.md) para as regras visuais e de interação.

---

## 18. Acessibilidade (a11y)

Meta: **WCAG 2.2 nível AA**.

- HTML semântico primeiro: `<button>` para ações, `<a>` para navegação, `<nav>`, `<main>`, `<header>`, headings em ordem (`h1` → `h2` → `h3`).
- **Nunca** `(click)` em `<div>`/`<span>`. Se for clicável, é um `<button>` ou `<a>`.
- Todo campo de formulário tem `<mat-label>` visível (placeholder não é label).
- Botões apenas com ícone têm `aria-label`.
- Foco sempre visível; nunca remova `outline` sem substituto.
- Navegação completa por teclado (Tab, Shift+Tab, Enter, Espaço, Esc, setas em listas/menus).
- Ao abrir diálogos, o foco vai para dentro; ao fechar, volta ao elemento que o abriu (Material faz isso — não quebre).
- Ao trocar de rota, mova o foco para o `<h1>` ou conteúdo principal e atualize o `title`.
- Anuncie mudanças dinâmicas importantes com `LiveAnnouncer` (CDK).
- Imagens informativas com `alt` descritivo; decorativas com `alt=""`.
- Teste com: `angular-eslint` (regras de template a11y), **axe** (extensão ou `@axe-core/playwright`), leitor de tela (NVDA/VoiceOver) e navegação só por teclado.

---

## 19. Tratamento de erros e logs

- Implemente um `ErrorHandler` global em `core/error-handling/` que:
  - registre o erro em uma ferramenta de monitoramento (ex.: Sentry) **sem dados pessoais**;
  - mostre feedback genérico ao usuário quando apropriado.
- Erros HTTP normalizados para um tipo único:
  ```ts
  export interface ApiError {
    readonly status: number;
    readonly code: string;        // código estável vindo do back-end
    readonly message: string;     // mensagem amigável
    readonly fieldErrors?: Readonly<Record<string, string>>;
  }
  ```
- Mapeie status comuns: `401` → sessão expirada/login · `403` → sem permissão · `404` → não encontrado · `409` → conflito · `422` → erros de validação nos campos · `429` → aguarde · `5xx` → erro genérico + tentar novamente.
- **Proibido `console.log` em código commitado.** Use um `LoggerService` com níveis, desativado em produção.

---

## 20. Testes

| Tipo | Ferramenta | O que testar |
|---|---|---|
| Unitário | **Vitest** (padrão do CLI recente) ou Jest | Funções puras, mappers, validators, pipes, stores |
| Componente | Angular Testing Library / TestBed + **Material Harnesses** | Comportamento visível ao usuário |
| E2E | **Playwright** | Fluxos críticos ponta a ponta (login, fazer prova, ver resultado) |
| Acessibilidade | `@axe-core/playwright` | Violações automáticas nas páginas principais |

Regras:

- Teste **comportamento**, não implementação. Consulte elementos por papel/label (`getByRole`), não por classe CSS.
- Cada bug corrigido ganha um teste que o reproduz.
- Mock da API com **MSW** ou `provideHttpClientTesting()`.
- Cobertura é consequência, não meta. Foque em lógica de negócio e fluxos críticos.
- Testes devem ser determinísticos: sem dependência de horário real, rede ou ordem de execução.

---

## 21. Qualidade de código e ferramentas

- **ESLint** com `angular-eslint` (inclui regras de template e acessibilidade) + `typescript-eslint` (strict).
- **Prettier** para formatação (com `prettier-plugin-tailwindcss`). Ninguém discute formatação em code review.
- **Husky + lint-staged**: lint e format nos arquivos alterados antes do commit.
- **CI** bloqueia merge se: lint, testes, build ou budgets falharem.
- `.editorconfig` versionado.
- Comentários explicam o **porquê**, não o **o quê**. Código autoexplicativo dispensa comentário.
- `TODO` só com referência a uma issue: `// TODO(#123): ...`.
- Remova código morto — o Git guarda o histórico.

---

## 22. Git e fluxo de trabalho

- Branch principal: `main` (sempre deployável).
- Branches curtas: `feat/exam-timer`, `fix/login-redirect`, `chore/update-deps`.
- **Conventional Commits**: `feat(exams): add countdown timer`, `fix(auth): handle expired session`.
- PRs pequenos (idealmente < 400 linhas alteradas), com descrição, screenshots para mudanças visuais e passos para testar.
- Pelo menos **1 aprovação** antes do merge. Squash merge para manter o histórico limpo.

---

## 23. Checklist de Pull Request

**Código**
- [ ] Segue a estrutura de pastas e as regras de dependência
- [ ] Nomes seguem as convenções deste guia
- [ ] Sem `any`, sem `!` desnecessário, sem `console.log`
- [ ] Componentes standalone, `OnPush`, `input()`/`output()`, `inject()`
- [ ] Sem subscriptions vazando; sem `subscribe` aninhado
- [ ] Estado derivado com `computed`, não com `effect`

**UI / UX**
- [ ] Estados de carregando, vazio, erro e sucesso implementados
- [ ] Responsivo (testado em 360px, 768px e 1280px)
- [ ] Funciona em tema claro e escuro
- [ ] Apenas tokens do design system (sem cores/medidas arbitrárias)
- [ ] Textos via i18n

**Acessibilidade**
- [ ] Navegável por teclado, foco visível
- [ ] Labels, `aria-label` e `alt` adequados
- [ ] Sem violações no axe

**Segurança**
- [ ] Sem segredos no código
- [ ] Sem `bypassSecurityTrust*` / `innerHTML` sem sanitização
- [ ] Nenhum dado sensível em logs, URLs ou analytics

**Qualidade**
- [ ] Testes adicionados/atualizados e passando
- [ ] Lint e build sem erros; budgets respeitados
