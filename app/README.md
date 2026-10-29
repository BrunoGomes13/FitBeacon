# FitBeacon app

App do aluno do FitBeacon. O scanner BLE usa `react-native-ble-plx` e exige um development build; Expo Go não inclui esse módulo nativo.

## Configuração

Copie `.env.example` para `.env` e configure:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000/api/v1
EXPO_PUBLIC_GYM_ID=
EXPO_PUBLIC_BEACON_GYM_UUID=00000000-0000-4000-8000-000000000001
EXPO_PUBLIC_BEACON_PROVIDER=mock
```

Substitua o IP pelo endereço LAN do computador que executa a API; `localhost` no telefone apontaria para o próprio telefone. Obtenha o ID da academia na saída do seed e informe-o em `EXPO_PUBLIC_GYM_ID` para pré-preencher o cadastro. O UUID acima é compartilhado pelos beacons da academia de demonstração; cada equipamento é distinguido pelo major/minor. O provedor inicial pode ser `mock` ou `real`; o modo desenvolvedor também permite alternar entre eles.

O plugin BLE declara `BLUETOOTH_SCAN` com `neverForLocation` e `BLUETOOTH_CONNECT` no Android 12 ou superior. As permissões de localização são removidas das declarações gerais e mantidas apenas até o Android 11; nesses aparelhos, o app solicita `ACCESS_FINE_LOCATION` durante a execução e precisa dos serviços de localização ligados. Depois de alterar plugins ou permissões, gere e instale novamente o development build.

## Android por USB

1. Instale o Android Studio e o Android SDK Platform Tools; no Samsung, habilite as opções do desenvolvedor e a depuração USB e autorize este computador.
2. Na raiz do monorepo, instale as dependências e compile/instale o development build:

   ```sh
   npm install
   npm run android --workspace @fitbeacon/app
   ```

3. Para iniciar o Metro depois de instalar o build:

   ```sh
   npm run start --workspace @fitbeacon/app
   ```

4. No primeiro acesso, conclua o onboarding, entre ou crie uma conta e conceda o consentimento de atividade para iniciar a detecção. Para validar o fluxo do aluno, ative o modo desenvolvedor e o Mock em **Perfil e configurações**, use **Aproximar** e, após registrar séries, **Afastar** para concluir a sessão e vê-la no histórico. Para o diagnóstico detalhado, abra **Galeria de componentes** e escolha **Abrir diagnóstico iBeacon**. Para testar um beacon físico, escolha **Bluetooth real** e conceda as permissões exibidas.

## Fluxo de validação

1. Inicie a API e execute o seed conforme o [README da API](../api/README.md).
2. Copie o ID da academia exibido pelo seed para `EXPO_PUBLIC_GYM_ID`.
3. Configure `EXPO_PUBLIC_API_URL` com o endereço LAN do computador e reinicie o Metro para carregar as variáveis.
4. Cadastre uma conta com consentimento; no perfil, habilite o modo desenvolvedor e o provedor Mock.
5. Aproxime-se do aparelho simulado, registre uma série e afaste-se para finalizar e sincronizar a sessão.
6. Abra o histórico e confirme a sessão e as séries registradas.

## Validação

Execute na raiz do monorepo:

```sh
npm run typecheck
npm run lint
npm test
```
