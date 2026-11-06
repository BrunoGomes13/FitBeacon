# Solução de problemas

Guia de diagnóstico Windows/PowerShell. Comece por [instalação na raiz](../README.md#instalação-e-execução), [arquitetura/rede](./ARQUITETURA.md) e os READMEs do [app](../app/README.md), [API](../api/README.md) e [painel](../web/README.md).

## MongoDB Atlas: `querySrv ECONNREFUSED`

Essa falha indica que a consulta DNS SRV necessária a uma URI `mongodb+srv` foi recusada/não resolvida pela rede ou pelo resolver. No desenvolvimento, `api/src/dns-dev.ts` configura os resolvers `8.8.8.8` e `1.1.1.1` quando `NODE_ENV` não é produção; firewall/rede universitária ainda pode bloquear DNS externo.

1. Confirme conectividade e resolução SRV usando um nome de cluster autorizado, sem copiar URI nem credenciais para o terminal compartilhado.
2. Teste em uma rede permitida ou peça liberação ao administrador de rede. Em redes gerenciadas, não contorne controles.
3. Confirme que o cluster permite o IP de saída atual e que o usuário de banco tem acesso.
4. Confira localmente que a URI seleciona o banco `fitbeacon`; não publique nem imprima seu valor.

Não cole a URI em logs, mensagens, capturas ou no repositório. Veja [configuração da API](../api/README.md#scripts-e-execução).

## Build Android: caminhos longos, CMake ou Ninja

Erros como caminho excedendo limite do Windows, falha de CMake/Ninja ou truncamento de caminho podem ocorrer quando o checkout e dependências nativas produzem caminhos muito profundos.

- Use um caminho curto para o repositório, por exemplo `C:\src\fitbeacon`.
- Mantenha Android SDK/NDK e Gradle nas versões compatíveis com o Expo/React Native instalados.
- Preserve o erro original do build; não apague artefatos nem rode limpeza destrutiva como primeira medida.
- Se a política local permitir, habilite suporte a caminhos longos do Windows e reinicie ferramentas que leem essa configuração.

Compile com `npm run android --workspace @fitbeacon/app` depois de confirmar JDK/SDK e espaço em disco. TypeScript/estilo não exigem recompilar o binário; módulo nativo/permissão/plugin exige novo build.

## `adb` não reconhecido

1. Instale Android SDK Platform-Tools pelo Android Studio.
2. Confirme que a pasta `platform-tools` do SDK está no `PATH` da sessão/usuário.
3. Abra um PowerShell novo e rode:

```powershell
adb version
adb devices
```

Se `adb` está instalado mas indisponível, invoque o executável `adb.exe` no diretório `platform-tools` do SDK configurado na máquina. Não assuma uma localização de SDK sem verificar.

## `adb reverse` parou de funcionar

Encaminhamentos são perdidos ao desconectar/reiniciar o aparelho ou o daemon. Reconecte, autorize a depuração USB e confira que `adb devices` mostra `device`, depois refaça:

```powershell
adb reverse tcp:8081 tcp:8081
adb reverse tcp:3000 tcp:3000
adb reverse --list
```

Porta 8081 é Metro; 3000 é API. O encaminhamento da API só é necessário se `EXPO_PUBLIC_API_URL` usar `localhost`; com Wi-Fi, use endereço LAN acessível e CORS/API configurados corretamente. Para remover todos os encaminhamentos:

```powershell
adb reverse --remove-all
```

## Rede de faculdade isolada

Isolamento de clientes Wi-Fi, firewall, proxy ou DNS filtrado pode impedir que telefone alcance o computador, que o computador conecte ao Atlas, ou que o aparelho abra Metro. Use USB com `adb reverse` quando autorizado, ou uma rede de desenvolvimento aprovada. Não desative firewall nem exponha a API/MongoDB publicamente. Solicite à instituição liberação de DNS/Atlas se necessário.

## Erro CORS no painel

O navegador envia a origem da página; a API só aceita origens listadas em `CORS_ORIGINS`. Em desenvolvimento inclua a origem real do Vite, normalmente `http://localhost:5173`, e reinicie a API após alterar a configuração local. A porta/origem acessada pelo browser precisa coincidir; `localhost` e `127.0.0.1` contam como origens diferentes.

O middleware atual lista `GET,POST,PATCH,DELETE,OPTIONS` e não `PUT`. Como o mapa usa `PUT /admin/equipment/positions`, isso pode falhar no preflight. Não habilite `*` em produção nem tente mascarar o erro: é uma limitação de implementação a corrigir.

## Limite de tentativas no login

O default é 10 tentativas por janela de 900000 ms (15 minutos). Resposta bloqueada indica rate limit, não senha incorreta. Aguarde o fim da janela, verifique credenciais e procure a causa da repetição; não automatize tentativas. Os limites podem ser configurados por `LOGIN_RATE_LIMIT_WINDOW_MS` e `LOGIN_RATE_LIMIT_MAX` em ambiente de desenvolvimento, seguindo `api/.env.example`.

## Treinos que parecem descartados

- Sessão **sem nenhuma série** abaixo de 20 s é descartada pelo critério de duração.
- Sessão com uma ou mais séries é preservada independentemente de ter menos de 20 s.
- Sem consentimento, a API bloqueia beacon/sessão; revogar consentimento limpa fila e rascunho local, mas não remove sessões já enviadas.
- Se ficar offline, confira Histórico/Diagnóstico e estado da fila. Falhas de rede devem permanecer pendentes; falhas locais são exibidas com opção de tentar novamente.
- Confirme usuário autenticado, academia, IDs de catálogo e `clientSessionId`; o mesmo ID com conteúdo conflitante retorna `409`.

## Tela vermelha no Metro: `Cannot update a component ... while rendering ...`

Esse erro React ocorreu quando um updater de estado chamado durante render atualizava a store Zustand; a store notificava outras telas assinantes durante a renderização. A regra é não executar efeitos colaterais em render/updater/reducer. O cronômetro atual calcula elapsed por horários em intervalo local da tela e a store só muda por eventos (iniciar, pausar, retomar, série, concluir). Não use `LogBox.ignoreLogs` para esconder esse erro.

Depois de corrigir código, reinicie/recarregue Metro e reproduza com Home, Equipamento e Treino montados. Se reaparecer, registre stack sem dados pessoais e procure chamadas a store, navegação ou I/O dentro de setters/reducers.

## Engrenagem do Expo Development Client

Se o development client abre o launcher sem encontrar Metro, confirme que `npm run start --workspace @fitbeacon/app` está ativo. No telefone/launcher, selecione a URL do servidor de desenvolvimento acessível; via USB, confirme `adb reverse tcp:8081 tcp:8081`. O QR/URL de Metro precisa apontar para host alcançável pelo telefone. Se a engrenagem abrir configuração manual, informe o endereço do servidor Metro da sessão atual; não confunda esse endereço com `EXPO_PUBLIC_API_URL`, que aponta para a API.

## Bluetooth e permissões

- Android 12+: confira Bluetooth Scan/Connect em permissões de app.
- Android 11 ou anterior: confira localização precisa e serviço de localização ligado.
- Se Bluetooth estiver desligado, ative-o e repita o diagnóstico.
- Revise o estado/última leitura em Perfil > Diagnóstico; não presuma que a troca de provider ocorreu só por `EXPO_PUBLIC_BEACON_PROVIDER`.

## Outros guias

- Execução e variáveis: [README raiz](../README.md).
- Contrato de API e erros: [API](../api/README.md).
- Testes automatizados e roteiro Samsung: [TESTES](./TESTES.md).
- Conclusão/armazenamento: [fluxo de conclusão](./design/FLUXO_CONCLUSAO_TREINO.md).
- Tema e contraste: [especificação visual](./design/ESPECIFICACAO_VISUAL.md).
