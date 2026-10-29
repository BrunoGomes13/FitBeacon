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
