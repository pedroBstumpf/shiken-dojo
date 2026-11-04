# Firebase: como o Ryu-kan funciona e como publicar

O nome do repositório e do projeto Firebase continuam `shiken-dojo`; o nome **Ryu-kan** aparece no
site, no endereço e nos PDFs. O app não tem servidor próprio. O front-end Angular fala direto com o Firebase, no plano gratuito
(Spark), que não pede cartão. A API em [`backend/`](../backend/) está guardada, mas **não é usada**.

| Peça | Serviço | Limite gratuito relevante |
|---|---|---|
| Login e e-mails de senha | Firebase Authentication | 150 e-mails de redefinição de senha por dia |
| Dados | Cloud Firestore | 1 GiB, 50 mil leituras e 20 mil gravações por dia |
| Site | Firebase Hosting | 10 GB armazenados, 360 MB transferidos por dia |

## Como funciona

### Segurança

O código e a chave de API são públicos, como em qualquer app Firebase. Quem protege os dados são as
regras em [`frontend/firestore.rules`](../frontend/firestore.rules), que rodam nos servidores do
Google: só lê ou grava quem tem **e-mail comprovado e cadastro ativo em `/teachers`**.

Criar uma conta de login é aberto no Firebase, e precisa ser assim para os convites funcionarem sem
servidor. Essa conta sozinha não dá acesso a nada.

### Convite de professor

Qualquer professor logado pode convidar. O app então:

1. Cria o login do convidado com uma senha aleatória que ninguém conhece.
2. Grava o cadastro em `/teachers/{e-mail}`. As regras validam quem convidou.
3. Pede ao Firebase o e-mail de redefinição de senha, que é o convite.

O convidado abre o link, define a senha na página do Firebase e entra. Abrir o link também comprova
o e-mail. Se o link expirar, basta usar **Esqueci minha senha** na tela de login: é o mesmo fluxo.

| Quem | Convida | Edita e desativa | Exclui |
|---|---|---|---|
| Instrutor | Só instrutores | Ninguém | Ninguém |
| Sensei responsável | Qualquer função | Todos (em si mesmo, não muda função nem situação) | Outros |

Excluir ou desativar um professor tira o acesso na hora. Como ninguém consegue remover a si mesmo do
papel de responsável, o dojo nunca fica sem um.

### Dados no dispositivo

O Firestore mantém uma cópia local (IndexedDB). Sem internet, o app continua funcionando e as
gravações são enviadas quando a conexão volta. Ao **Sair**, a cópia é apagada; se ainda houver dados
não enviados, o app avisa e não sai. O login fica salvo no dispositivo até o professor sair, então
oriente a sempre usar **Sair** em aparelhos compartilhados.

### PDF

- **Exportar:** o PDF leva os dados da prova nos metadados, e o hash desse conteúdo é registrado em
  `/pdfExports`.
- **Importar:** só aceita o arquivo se o conteúdo estiver embutido e o hash estiver registrado. Isso
  recusa PDFs de outra origem e arquivos alterados depois de exportados.
- **Nunca sobrescreve:** se a prova já existe no sistema, nada muda. Na prática, a importação serve
  para trazer de volta um rascunho excluído.
- **PDF preenchido à mão ou escaneado não é importado.**

## Publicar: primeira vez

**No [console do Firebase](https://console.firebase.google.com), com uma conta Google:**

1. Crie um projeto. O Google Analytics não é necessário.
2. **Authentication → Começar → E-mail/senha:** ative a primeira opção. Deixe "Link do e-mail"
   desligado.
3. **Authentication → Configurações → Política de senha:** exija pelo menos 10 caracteres.
4. **Firestore Database → Criar banco de dados:** escolha `southamerica-east1` (São Paulo). **Essa
   escolha é definitiva.** Pode iniciar em modo de produção.
5. **Configurações do projeto → Seus apps → Web (`</>`):** registre o app e copie o `firebaseConfig`.

**No código:**

6. Preencha `apiKey`, `authDomain`, `projectId` e `appId` em
   [`frontend/src/environments/environment.ts`](../frontend/src/environments/environment.ts). Esses
   valores não são segredo.
7. Em `frontend/.firebaserc`, troque `demo-shiken-dojo` pelo ID do projeto.

**No terminal, na pasta `frontend`:**

```bash
npx firebase login
npx firebase hosting:sites:create ryu-kan   # só na primeira vez
npm run deploy
```

O site fica em `https://ryu-kan.web.app`; o endereço antigo `shiken-dojo.web.app` redireciona para ele.

Antes do deploy, adicione `ryu-kan.web.app` em **Authentication → Configurações → Domínios autorizados**. Sem isso, os e-mails de convite e de senha falham.

**Crie o primeiro professor (só uma vez):**

8. **Authentication → Usuários → Adicionar usuário:** use o seu e-mail e uma senha qualquer.
9. **Firestore → Iniciar coleção** `teachers`, com o ID do documento igual ao seu e-mail **em
   minúsculas**, e os campos:

   | Campo | Tipo | Valor |
   |---|---|---|
   | `fullName` | string | Seu nome |
   | `role` | string | `head_instructor` |
   | `active` | boolean | `true` |

10. Entre no site. Na primeira vez, o app envia um link de confirmação para o seu e-mail; confirme e
    entre de novo. Depois, complete seu cadastro em **Professores**.

**Ajuste o e-mail do convite:** em **Authentication → Modelos → Redefinição de senha**, troque o nome
do remetente para `Ryu-kan`, escolha o português e use um texto que sirva para os dois casos,
por exemplo:

> Olá! Use o link abaixo para definir sua senha de acesso ao Ryu-kan: %LINK%
>
> Se você não esperava este e-mail, pode ignorá-lo.

**Confira depois de publicar:** os e-mails podem cair no spam, porque saem de um endereço do
Firebase. Faça um convite real para testar. Para conferir os headers de segurança, que o emulador
local não aplica:

```bash
curl -I https://ryu-kan.web.app/login
```

A resposta precisa trazer `content-security-policy` e `strict-transport-security`.

## Publicar: atualizações

```bash
cd frontend
npm run deploy
```

O comando publica o site e as regras de segurança juntos.

## Desenvolver

Tudo roda em emuladores locais, sem tocar nos dados reais. O emulador do Firestore precisa do
[Java 21](https://adoptium.net/temurin/releases/?version=21).

```bash
cd frontend
npm run emulators       # em um terminal; painel em http://127.0.0.1:4000
npm run emulators:seed  # dados de demonstração; a senha aparece na saída
npm start               # http://localhost:4200
```

Os e-mails não são enviados: os links aparecem no terminal dos emuladores e no painel, em
**Authentication**. Os dados somem quando os emuladores param.

| Comando | O que faz |
|---|---|
| `npm test -- --watch=false` | Testes unitários |
| `npm run test:rules` | Testes das regras de segurança, no emulador |
| `npm run lint` | ESLint |

Mudou o `firestore.rules`? Atualize também `frontend/firebase-tests/firestore.rules.spec.mjs`.

## Limitações conhecidas

- **Backups:** o plano gratuito não faz backup automático do Firestore. O sensei responsável baixa
  um arquivo com alunos e provas em **menu da conta → Baixar backup**; faça isso com regularidade e
  guarde em local seguro, porque o arquivo tem dados de alunos. O app ainda não tem tela para
  restaurar: a restauração é feita pelo desenvolvedor, a partir desse arquivo.
- **Provas finalizadas:** as regras impedem alterá-las, mas não conseguem conferir nota por nota. A
  validação da escala fica no app, e só professores cadastrados chegam a gravar.
- **Envio de PDF por e-mail:** saiu junto com o servidor, porque o Firebase gratuito só envia os
  e-mails de autenticação. No lugar dele há **Compartilhar**, que abre a tela do sistema (WhatsApp,
  e-mail…), nos dispositivos que oferecem isso.
- **Vários dojos:** o app assume um único dojo. Um segundo dojo pede outro projeto Firebase ou uma
  mudança no modelo de dados.
- **LGPD:** o app não tem termo de consentimento nem política de privacidade, por decisão do
  responsável pelo projeto.
