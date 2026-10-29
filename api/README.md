# FitBeacon API

API REST em Node.js, Express 5, TypeScript strict e MongoDB/Mongoose. A versão da API é
`/api/v1`.

## Requisitos

- Node.js 22 ou superior.
- MongoDB 7.0 ou superior, local ou MongoDB Atlas.

## Instalação e execução

Na raiz do monorepo, instale as dependências:

```powershell
npm install
```

Crie `api/.env` a partir do exemplo e ajuste a conexão MongoDB e os segredos:

```powershell
Copy-Item api\.env.example api\.env
```

Em desenvolvimento, inicie a API:

```powershell
npm run dev --workspace @fitbeacon/api
```

O health check fica em `http://localhost:3000/health`. Para compilar e iniciar a versão
compilada:

```powershell
npm run build --workspace @fitbeacon/api
npm run start --workspace @fitbeacon/api
```

### Seed

Com o MongoDB disponível e `api/.env` configurado:

```powershell
npm run seed --workspace @fitbeacon/api
```

O seed é repetível e cria uma academia de demonstração, quatro áreas, doze equipamentos,
vinte exercícios, contas de administrador e aluno e 360 sessões distribuídas pelos últimos
30 dias, com uma série por sessão.

Contas locais de demonstração:

| Perfil        | E-mail                  | Senha                   |
| ------------- | ----------------------- | ----------------------- |
| Administrador | `admin@fitbeacon.local` | `FitBeacon-Admin-2026!` |
| Aluno         | `aluno@fitbeacon.local` | `FitBeacon-Aluno-2026!` |

Troque os segredos JWT e as senhas de demonstração antes de expor a API. Os valores do
exemplo são exclusivamente para desenvolvimento local.

## Autenticação e teste manual

No Postman ou Insomnia, use a base `http://localhost:3000/api/v1`.

1. Faça `POST /auth/login` com `Content-Type: application/json`:

```json
{
  "email": "admin@fitbeacon.local",
  "password": "FitBeacon-Admin-2026!"
}
```

2. Copie `accessToken` e envie nas rotas protegidas como
   `Authorization: Bearer <accessToken>`.
3. Faça `GET /reports/summary` para consultar resumo e ociosos.
4. Faça login como aluno e procure o beacon de demonstração:
   `GET /equipment/beacon?uuid=00000000-0000-4000-8000-000000000001&major=1&minor=1`.

No PowerShell, o login e o relatório também podem ser testados assim:

```powershell
$admin = Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3000/api/v1/auth/login `
  -ContentType application/json `
  -Body '{"email":"admin@fitbeacon.local","password":"FitBeacon-Admin-2026!"}'

Invoke-RestMethod `
  -Method Get `
  -Uri http://localhost:3000/api/v1/reports/summary `
  -Headers @{ Authorization = "Bearer $($admin.accessToken)" }
```

`POST /auth/register` sempre cria um aluno; o papel administrativo não pode ser atribuído
por esse endpoint. O cadastro exige `gymId` e `consentTracking`. O consentimento pode ser
alterado pelo próprio usuário com `PATCH /auth/me/consent` e
`{"consentTracking":true}`. A busca de beacon e o registro de sessões exigem consentimento.

## Rotas

Todas as entradas são validadas com Zod. Respostas de erro usam
`{ "code": "...", "message": "...", "details": null }`.

### Autenticação

| Método  | Rota               | Acesso                             |
| ------- | ------------------ | ---------------------------------- |
| `POST`  | `/auth/register`   | Público; cria aluno                |
| `POST`  | `/auth/login`      | Público; rate limit                |
| `POST`  | `/auth/refresh`    | Público; rotaciona refresh token   |
| `POST`  | `/auth/logout`     | Access token; revoga refresh token |
| `GET`   | `/auth/me`         | Access token                       |
| `PATCH` | `/auth/me/consent` | Access token                       |

### Aluno

| Método | Rota                                             | Acesso                     |
| ------ | ------------------------------------------------ | -------------------------- |
| `GET`  | `/equipment/beacon?uuid=...&major=...&minor=...` | Aluno com consentimento    |
| `POST` | `/sessions/batch`                                | Aluno com consentimento    |
| `GET`  | `/sessions?page=1&limit=20`                      | Próprio histórico paginado |

O lote de sessões aceita de 1 a 100 registros. `clientSessionId` é um UUID único; o mesmo
conteúdo repetido é idempotente e a reutilização do identificador com dados diferentes
retorna `409 IDEMPOTENCY_CONFLICT`. Duração é calculada a partir de `startedAt` e `endedAt`.

### Administração

As rotas abaixo exigem `role: admin` e são limitadas à academia do administrador. Listas
aceitam `page`, `limit` (máximo 100) e `search`.

| Método                   | Rota                   |
| ------------------------ | ---------------------- |
| `GET`, `POST`            | `/admin/areas`         |
| `GET`, `PATCH`, `DELETE` | `/admin/areas/:id`     |
| `GET`, `POST`            | `/admin/equipment`     |
| `GET`, `PATCH`, `DELETE` | `/admin/equipment/:id` |
| `GET`, `POST`            | `/admin/exercises`     |
| `GET`, `PATCH`, `DELETE` | `/admin/exercises/:id` |

Exclusões administrativas são soft delete, preservando referências do histórico.

### Relatórios

Todos exigem perfil administrador. `from` e `to` aceitam data/hora ISO 8601; o intervalo
padrão é de 30 dias e o máximo, 366 dias.

| Método | Rota                                    | Resultado                                     |
| ------ | --------------------------------------- | --------------------------------------------- |
| `GET`  | `/reports/usage?groupBy=equipment`      | Uso por equipamento                           |
| `GET`  | `/reports/usage?groupBy=area`           | Uso por área                                  |
| `GET`  | `/reports/usage?groupBy=hour`           | Uso por hora UTC                              |
| `GET`  | `/reports/summary?idleDays=7`           | Média, rankings, horas e equipamentos ociosos |
| `GET`  | `/reports/export.csv?groupBy=equipment` | Exportação CSV                                |

`groupBy` também aceita `area` e `hour` na exportação CSV. Os relatórios respeitam o
escopo da academia autenticada.

## Qualidade

```powershell
npm run typecheck --workspace @fitbeacon/api
npm run lint --workspace @fitbeacon/api
npm run test --workspace @fitbeacon/api
npm run build --workspace @fitbeacon/api
```

Os testes Jest/Supertest iniciam MongoDB em memória e cobrem autenticação, busca por beacon,
sessões duplicadas e idempotentes, relatórios e repetibilidade do seed. Na primeira
execução, `mongodb-memory-server` baixa o binário compatível do MongoDB; não é necessário
um serviço MongoDB local para rodar os testes.
