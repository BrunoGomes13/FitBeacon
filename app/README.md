# FitBeacon app

Aplicativo do aluno para cadastro, detecção BLE, registro de séries, histórico e preferências. O beacon real usa `react-native-ble-plx`, dependência nativa que requer development build; Expo Go não inclui esse módulo.

## Scripts

Execute na raiz do monorepo:

| Comando | Descrição |
|---|---|
| `npm run android --workspace @fitbeacon/app` | Compila/instala o development build em dispositivo selecionado |
| `npm run start --workspace @fitbeacon/app` | Inicia Metro com `expo start --dev-client` |
| `npm run typecheck --workspace @fitbeacon/app` | Typecheck TypeScript |
| `npm run lint --workspace @fitbeacon/app` | ESLint |
| `npm test --workspace @fitbeacon/app` | Testes Node usando `node --test` |

## Configuração Android

Requisitos: Node.js 22+, Android Studio, Android SDK/Platform-Tools, JDK 17 e aparelho com depuração USB autorizada. Configure localmente `app/.env` a partir de `app/.env.example`; variáveis `EXPO_PUBLIC_*` são incluídas no bundle e não devem conter segredos.

```powershell
npm install
npm run android --workspace @fitbeacon/app
```

Em seguida, mantenha Metro em execução:

```powershell
npm run start --workspace @fitbeacon/app
```

Com USB, `adb reverse tcp:8081 tcp:8081` encaminha Metro. Para usar a API via USB, configure `EXPO_PUBLIC_API_URL` para `http://localhost:3000/api/v1` e execute `adb reverse tcp:3000 tcp:3000`; via Wi-Fi, use o IP LAN do computador. Reinicie Metro após mudanças em variáveis Expo.

O plugin BLE configura `BLUETOOTH_SCAN` com `neverForLocation` e `BLUETOOTH_CONNECT` no Android 12+. Para Android 11 e anteriores, localização precisa é necessária em runtime. Mudança de permissões/plugins requer novo build.

## Variáveis

| Nome | Uso | Exemplo seguro | Obrigatória? |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | Base API, terminando em `/api/v1` | `http://localhost:3000/api/v1` com USB reverse | Não; fallback local no cliente |
| `EXPO_PUBLIC_GYM_ID` | Pré-preenche academia no cadastro | `<ID de desenvolvimento>` | Não |
| `EXPO_PUBLIC_BEACON_GYM_UUID` | Filtro de UUID iBeacon | `<UUID autorizado da academia>` | Não; valor padrão no código |
| `EXPO_PUBLIC_BEACON_PROVIDER` | Seleção inicial na tela de diagnóstico | `mock` | Não; não habilita Mock automaticamente no runtime |

Consulte a tabela consolidada na [documentação da raiz](../README.md#variáveis-de-ambiente).

## Telas e estrutura interna

As rotas Expo Router ficam em `app/`:

| Rota | Tela/função |
|---|---|
| `/` | Entrada e carregamento |
| `/onboarding`, `/login`, `/register`, `/forgot-password` | Acesso, consentimento e cadastro |
| `/home` | Início e treino em andamento |
| `/equipment-list`, `/equipment` | Catálogo e detalhe |
| `/workout` | Exercício, séries, cronômetro e descanso |
| `/history`, `/history-detail`, `/reports` | Histórico e indicadores do aluno |
| `/profile`, `/profile-info`, `/settings` | Perfil, privacidade e preferências |
| `/gym-map` | Planta e equipamentos |
| `/diagnostics`, `/gallery` | Diagnóstico BLE/armazenamento e componentes |

Organização do código:

- `src/beacon/`: parser iBeacon, provider BLE/Mock e máquina de estados.
- `src/student/`: runtime BLE, sincronização de eventos e conclusão de sessão.
- `src/api/`: cliente HTTP, armazenamento da fila/rascunho e sincronização.
- `src/state/`: Zustand, preferências e estado de tela.
- `src/theme/`, `src/brand/`, `src/components/`: tokens, escolha de logo e UI reutilizável.
- `tests/`: testes de parser, estados BLE, persistência, recuperação e renderização.

## Detecção BLE

O parser valida anúncio de fabricante Apple (`4C 00`), tipo iBeacon `02 15`, UUID, Major, Minor e TX Power assinado. O beacon identifica equipamento pela combinação UUID/Major/Minor cadastrada para a academia.

Parâmetros padrão de `src/beacon/config.ts`: janela mediana 5, EMA alpha 0,3; entrada após três confirmações acima de `-70 dBm`; saída abaixo de `-78 dBm`; troca se outro beacon tiver vantagem de `6 dB` sustentada por `2 s`; perda de sinal após `15 s`. O limiar de duração é 20 s somente para sessão sem nenhuma série. A fonte inclui overrides, mas o runtime atual cria a máquina com seus padrões; não prometa ajuste por aparelho sem integrar e testar os overrides.

O provider Mock emite leituras apenas quando acionado. No runtime, ele depende de modo desenvolvedor e controle Mock ativos; o app abre o Mock ocioso. `EXPO_PUBLIC_BEACON_PROVIDER` inicializa a seleção da tela de diagnóstico, não o runtime.

## Treino, conclusão e persistência

O treino conserva equipamento, exercício e origem (`beacon` ou `manual`). Cada série atualiza o checkpoint; o tempo é calculado pelos horários de início/retomada, pausas e tempo acumulado, não por gravações a cada segundo.

Finalizar manualmente, afastar-se, perder sinal e recuperar um rascunho usam o fluxo único e idempotente por `clientSessionId`. A sessão e as séries são gravadas localmente antes do envio. Uma falha da API não remove a cópia local. Sessão com uma ou mais séries não é descartada por curta duração; sem séries, o mínimo é 20 s.

A fila e os rascunhos usam arquivos JSON versionados no diretório privado do app e gravação atômica. Itens antigos do SecureStore são migrados; arquivos vazios/inválidos são isolados em quarentena. Se o arquivo falhar, o app tenta SecureStore em blocos pequenos e então memória/envio imediato. Tokens permanecem no SecureStore. Rede indisponível mantém sessões pendentes; respostas de cliente não recuperáveis ficam na lista de falhas para tentar novamente ou descartar. O limite padrão da fila é 50 itens.

Ao reabrir com rascunho não concluído, o runtime recupera e conclui/enfileira antes de retomar a detecção. O Histórico permite inspecionar pendências/falhas e acionar a recuperação prevista pela UI. Revogar consentimento limpa os dados pendentes locais, mas não remove sessões já salvas no servidor.

Fluxo de implementação: [docs/design/FLUXO_CONCLUSAO_TREINO.md](../docs/design/FLUXO_CONCLUSAO_TREINO.md). Testes e roteiro Samsung: [docs/TESTES.md](../docs/TESTES.md).

## Privacidade e convenções

Cadastro pede consentimento de rastreamento, que pode ser revogado no perfil. A API recebe identificadores necessários à conta, mas o CPF completo não deve ir a logs nem ao painel; sessões enviadas são agregadas nos relatórios administrativos. A tela de privacidade informa que exportação/exclusão automatizada do lado da API ainda não está implementada.

Use tokens de tema/componentes existentes, respeite safe areas e mantenha providers substituíveis nos testes. Não persista leituras BLE contínuas ou dados de sessão fora do fluxo consentido.

Para decisões do monorepo, consulte [docs/ARQUITETURA.md](../docs/ARQUITETURA.md); problemas de Metro, Dev Client e Android estão em [docs/SOLUCAO_DE_PROBLEMAS.md](../docs/SOLUCAO_DE_PROBLEMAS.md). A paleta aprovada está em [docs/design/ESPECIFICACAO_VISUAL.md](../docs/design/ESPECIFICACAO_VISUAL.md).

## Teste manual essencial

Com API/Metro ativos e usuário de desenvolvimento autorizado: conceda consentimento, ative Desenvolvedor e Mock, simule aproximação, inicie treino, registre séries, finalize ou simule afastamento, e confira Histórico. Depois repita sem rede, feche/reabra o app e confirme a pendência e sincronização após reconectar. Para checklist completo, use [docs/TESTES.md](../docs/TESTES.md).
