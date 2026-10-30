# FitBeacon

Monorepo do FitBeacon. A fundação está dividida em:

- `app/`: React Native com Expo SDK 58, Expo Router e development build Android.
- `api/`: Node.js, Express, TypeScript, MongoDB/Mongoose, JWT e Zod.
- `web/`: React, Vite, TypeScript, Tailwind CSS, shadcn/ui e Recharts.

## Backend

Configuração, rotas, seed e instruções para testar a API estão em [api/README.md](./api/README.md).

## Requisitos

- Node.js 22 ou superior.
- Android Studio com Android SDK e Android SDK Platform-Tools para compilar e instalar
  no Samsung via USB.
- No telefone, habilite as opções do desenvolvedor e a depuração USB.

## Instalação e desenvolvimento

Na raiz do monorepo:

```powershell
npm install
npm run android
```

O primeiro comando compila e instala o development build no dispositivo conectado. Para
iniciar o servidor JavaScript depois da instalação:

```powershell
npm start
```

Para conferir a conexão antes da compilação:

```powershell
adb devices
```

O dispositivo deve aparecer como `device` (e não `unauthorized`). Aceite a solicitação de
depuração USB no telefone.

## Qualidade

```powershell
npm run typecheck
npm run lint
npm test
```

## Painel administrativo web

Crie `web/.env` a partir de `web/.env.example` e configure `VITE_API_URL` para a URL
da API. Inicie o painel na raiz do monorepo:

```powershell
npm run dev --workspace @fitbeacon/web
```

O Vite usa a porta `5173`; para permitir o acesso durante o desenvolvimento, acrescente
`http://localhost:5173` a `CORS_ORIGINS` na configuração da API.

O painel mantém os tokens somente em memória e não persiste dados pessoais de alunos.
Permanece conhecida uma vulnerabilidade transitiva de Zod trazida pela cadeia de
dependências da Expo CLI no app. Ela fica pendente de uma atualização compatível do
Expo; não foi aplicado `npm audit fix --force`.

## Dependências principais do app (Expo SDK 58)

| Dependência                      | Versão     |
| -------------------------------- | ---------- |
| `expo` (SDK)                     | `~58.0.19` |
| `expo-dev-client`                | `~58.0.15` |
| `expo-router`                    | `~58.0.26` |
| `expo-font`                      | `~58.0.10` |
| `expo-system-ui`                 | `~58.0.6`  |
| `expo-status-bar`                | `~58.0.4`  |
| `expo-constants`                 | `~58.0.13` |
| `expo-linking`                   | `~58.0.14` |
| `react` / `react-dom`            | `19.3.0`   |
| `react-native`                   | `0.88.0`   |
| `react-native-safe-area-context` | `~5.10.1`  |
| `react-native-screens`           | `~4.30.0`  |
| `react-native-web`               | `^0.21.4`  |
| `@expo-google-fonts/inter`       | `^0.4.2`   |
| `typescript`                     | `~6.0.3`   |

Na raiz do monorepo, `npm install` instala as versões travadas no `package-lock.json`.
Para adicionar módulos Expo compatíveis com o SDK:

```powershell
cd app
npx expo install expo-router expo-dev-client expo-font expo-system-ui expo-status-bar expo-constants expo-linking react-native-safe-area-context react-native-screens react-native-web react-dom
```

A fonte Inter já está incluída. Para adicioná-la separadamente, execute da raiz:

```powershell
npm install @expo-google-fonts/inter --workspace @fitbeacon/app
```

## Arquitetura

- `api/`: Express + TypeScript; autenticação JWT, autorização por papel e academia,
  persistência MongoDB, validação Zod e relatórios.
- `app/`: React Native + Expo Router; perfil e consentimento, registro de séries,
  máquina de estados BLE, providers real/Mock, histórico e fila local de sincronização.
- `web/`: React + Vite + TypeScript; painel administrativo com React Router, TanStack
  Query, formulários Zod e gráficos carregados sob demanda.

Os registros de uso enviados pela aplicação são identificados por `clientSessionId`.
Relatórios e o mapa de calor apresentam agregados; nomes e identificadores de alunos não
são mostrados no painel.

### Fila offline do app

Sessões concluídas aguardam em armazenamento seguro, isoladas pelo identificador do
usuário autenticado, até que a API confirme o envio. A fila mantém até 50 sessões; ao
exceder o limite, a mais antiga é descartada e o app informa o usuário. A sincronização
é tentada ao abrir o app, ao voltar para primeiro plano, após um envio bem-sucedido e
pelo botão manual em Perfil e Histórico. Falhas de rede e respostas 5xx permanecem
pendentes com retentativas exponenciais e jitter; a renovação de autenticação é tentada
uma vez pelo cliente da API. Outros erros 4xx ficam na lista de falhas com o motivo para
consulta. A revogação do consentimento elimina pendências e falhas locais de uso.

## Variáveis de ambiente

Configure os arquivos locais a partir dos exemplos de cada workspace. Não compartilhe
valores de segredos, tokens ou URI do banco.

**API:** `NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `CORS_ORIGINS`,
`LOGIN_RATE_LIMIT_WINDOW_MS`, `LOGIN_RATE_LIMIT_MAX`, `SEED_ADMIN_EMAIL`,
`SEED_ADMIN_PASSWORD`, `SEED_STUDENT_EMAIL`, `SEED_STUDENT_PASSWORD` e `LOG_LEVEL`.

**App:** `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_GYM_ID`.

**Web:** `VITE_API_URL`. Durante desenvolvimento, acrescente a origem local do Vite à
configuração `CORS_ORIGINS` da API.

O banco deste projeto deve se chamar `fitbeacon`. Confira o nome na configuração da URI
sem imprimir a URI. Nunca rode o seed sobre coleções que já contenham dados.

## Como rodar os workspaces

Execute os comandos na raiz do monorepo, em PowerShell:

```powershell
npm install
npm run dev --workspace @fitbeacon/api
npm start --workspace @fitbeacon/app
npm run dev --workspace @fitbeacon/web
```

O app usa um development build. Para testar no dispositivo por USB, confirme a conexão
com `adb devices`; o estado esperado é `device`. Inicie o Metro com o development client
instalado.

Verificações:

```powershell
npm run typecheck --workspace @fitbeacon/api
npm run lint --workspace @fitbeacon/api
npm test --workspace @fitbeacon/api
npm run typecheck --workspace @fitbeacon/app
npm run lint --workspace @fitbeacon/app
npm test --workspace @fitbeacon/app
npm run typecheck --workspace @fitbeacon/web
npm run lint --workspace @fitbeacon/web
npm test --workspace @fitbeacon/web
npm run test:e2e --workspace @fitbeacon/web
```

Playwright requer Chromium. Instale o navegador uma vez com `npx playwright install chromium`.

## Atualização do app no celular

- Alterações somente em TypeScript/JavaScript, estilos, telas e assets podem ser
  carregadas reiniciando ou recarregando o Metro.
- Mudanças em módulos nativos, permissões Android, plugins Expo ou dependências nativas
  exigem gerar e instalar um novo development build.
- Antes de recompilar, verifique a compatibilidade das bibliotecas com o SDK Expo
  instalado. Não use `prebuild --clean` nem remova `android/` sem avaliar os artefatos
  nativos que seriam perdidos.

## Diagnóstico e calibração BLE

1. Use o modo desenvolvedor e habilite o provider Mock para validar entrada, troca,
   saída, descarte de sessões curtas e encerramento por perda de sinal sem um beacon
   físico.
2. No modo real, abra Diagnóstico e confirme permissões Bluetooth, estado do adaptador,
   leituras recentes e RSSI observado junto ao equipamento.
3. Meça várias leituras a distâncias conhecidas e anote os valores observados. Ajuste
   entrada/saída no cadastro do equipamento conforme o local e o aparelho; mantenha a
   histerese entre os limiares para evitar flicker.
4. Faça os testes perto do equipamento e no limite da área. Não use uma única leitura
   para calibrar; repita com o telefone em posições e orientações diferentes.
5. Para testar sem beacon, use o Mock. Para validar o provider real, use um beacon
   autorizado com UUID, major e minor cadastrados.

## Painel no Chrome Android e ADB

Para acessar a API local a partir do Chrome do telefone conectado por USB, configure o
endereço de desenvolvimento para `localhost` e execute:

```powershell
adb reverse tcp:3000 tcp:3000
adb reverse tcp:5173 tcp:5173
npm run dev --workspace @fitbeacon/web
```

Abra `http://localhost:5173` no Chrome do telefone. Para remover os encaminhamentos ao
terminar, use `adb reverse --remove-all`. CSV é baixado por uma requisição autenticada;
confirme a permissão de downloads e a pasta de arquivos do Chrome.

## Problemas conhecidos no Windows

- **DNS SRV / MongoDB:** se `mongodb+srv` não resolver, confira conectividade DNS e a
  resolução SRV/TXT da rede, a configuração de acesso do cluster e o firewall. Compare
  com outra rede autorizada; não copie nem publique a URI. Em rede corporativa ou
  universitária, peça liberação ao administrador em vez de contornar controles.
- **Caminhos longos / Ninja / Android NDK:** mantenha o checkout em um caminho curto,
  como `C:\fb`, habilite suporte a caminhos longos no Windows quando autorizado e use
  versões de Android SDK/NDK compatíveis com o Expo/Gradle do projeto. Se o build falhar,
  preserve o log completo e verifique primeiro o caminho do workspace e a instalação do
  Ninja.
- **ADB reverse:** confirme que `adb devices` mostra `device`, aceite a autorização USB
  no telefone e refaça `adb reverse tcp:3000 tcp:3000` após reconectar. A opção não
  funciona se o aparelho estiver `unauthorized` ou desconectado.
- **Rede de faculdade:** firewall, isolamento de clientes Wi-Fi, DNS filtrado ou proxy
  podem bloquear API, Metro e MongoDB. Prefira USB com `adb reverse` ou uma rede de teste
  aprovada; não exponha a API publicamente nem desative o firewall.
- **Permissões Android:** revise a permissão Bluetooth nas configurações do telefone,
  verifique se Bluetooth está ligado e abra Diagnóstico para conferir a mensagem e a
  ação de recuperação.

## Checklist manual de aceite

1. Entrar no painel com administrador; confirmar que uma conta de aluno é recusada com
   orientação clara.
2. Revisar dashboard, períodos, KPIs, rankings, relatório e CSV autenticado.
3. Conferir o mapa de calor, filtros, legenda e tooltip por toque.
4. Criar, editar e excluir área, exercício e equipamento; testar UUID duplicado,
   validações, ação de desfazer e restauração quando a API rejeitar a exclusão.
5. No Chrome Android, validar retrato/paisagem, fonte grande, teclado numérico, tema,
   navegação, safe area e download CSV.
6. No app, cadastrar-se e consentir com o rastreamento; testar aproximação, séries,
   temporizador, saída, Histórico e os limiares na tela de Diagnóstico.
7. Testar provider Mock e beacon real; negar permissões, desligar Bluetooth e confirmar
   a orientação apresentada.
8. Colocar o telefone offline, concluir uma sessão, fechar/reabrir o app e reconectar;
   conferir contador, sincronização, ausência de duplicatas e a lista de falhas.
9. Revogar consentimento e confirmar que a fila de uso local é eliminada.
