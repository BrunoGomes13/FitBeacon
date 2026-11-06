# FitBeacon API

API REST em Node.js, Express 5, TypeScript, Zod e MongoDB/Mongoose. Prefixo versionado: `/api/v1`. O banco da aplicação deve se chamar `fitbeacon`.

## Scripts e execução

Rode na raiz do monorepo:

| Comando | Descrição |
|---|---|
| `npm run dev --workspace @fitbeacon/api` | Servidor de desenvolvimento com watch |
| `npm run build --workspace @fitbeacon/api` | Compila para `dist/` |
| `npm run start --workspace @fitbeacon/api` | Inicia o servidor compilado |
| `npm run seed --workspace @fitbeacon/api` | Cria/atualiza dados de demonstração; confira a base antes |
| `npm run mark-demo-data --workspace @fitbeacon/api` | Marca dados antigos conhecidos do seed como demo |
| `npm run purge-demo-data --workspace @fitbeacon/api` | Simula remoção de demo |
| `npm run purge-demo-data --workspace @fitbeacon/api -- --confirm` | Confirma remoção de sessões/séries demo |
| `npm run typecheck --workspace @fitbeacon/api` | Typecheck |
| `npm run lint --workspace @fitbeacon/api` | ESLint |
| `npm test --workspace @fitbeacon/api` | Jest/Supertest |

O servidor carrega `api/.env`, conecta ao MongoDB antes de abrir o listener e usa porta padrão `3000`. `GET /health` informa disponibilidade HTTP e do banco. O listener chama `app.listen(PORT)` sem host explícito; o endereço efetivo segue o comportamento padrão do Node.

Crie localmente `api/.env` a partir de `api/.env.example`. Não coloque valores privados em documentação. O schema requer segredos JWT distintos com pelo menos 32 caracteres. Em produção, configure credenciais e CORS específicos; a validação rejeita defaults de desenvolvimento.

## Variáveis

| Nome | Finalidade | Exemplo seguro | Regra |
|---|---|---|---|
| `NODE_ENV` | Ambiente | `development` | Default `development` |
| `PORT` | Porta HTTP | `3000` | Default `3000`, faixa 1–65535 |
| `MONGODB_URI` | MongoDB da aplicação | `mongodb://127.0.0.1:27017/fitbeacon` apenas local | Default local; banco `fitbeacon` |
| `JWT_ACCESS_SECRET` | Assinatura access token | `<segredo privado exclusivo; mínimo 32 caracteres>` | Obrigatória |
| `JWT_REFRESH_SECRET` | Assinatura refresh token | `<segredo privado diferente; mínimo 32 caracteres>` | Obrigatória |
| `JWT_ACCESS_TTL` | Validade access | `15m` | Default `15m`; formato número+s/m/h/d |
| `JWT_REFRESH_TTL` | Validade refresh | `30d` | Default `30d`; mesmo formato |
| `CORS_ORIGINS` | Origens web permitidas | `http://localhost:5173` | Default apenas Vite local |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | Janela de tentativas | `900000` | Default 15 min |
| `LOGIN_RATE_LIMIT_MAX` | Limite de login na janela | `10` | Default 10 |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Identidade de administrador do seed | `<credenciais locais não compartilhadas>` | Defaults de desenvolvimento; não usar em produção |
| `SEED_STUDENT_EMAIL`, `SEED_STUDENT_PASSWORD` | Identidade de aluno do seed | `<credenciais locais não compartilhadas>` | Defaults de desenvolvimento; não usar em produção |
| `LOG_LEVEL` | Nível Pino | `info` | Default `info` |

`api/.env.example` é a fonte dos nomes; `src/config.ts` valida defaults, requisitos e produção. Nunca publique `.env`, URI Atlas, tokens ou senhas.

## Rotas

Todas as rotas abaixo são relativas a `/api/v1`. Rotas privadas usam `Authorization: Bearer <access_token>`. Os exemplos são esquemáticos e usam somente placeholders.

### Saúde e autenticação

| Método | Rota | Acesso | Resposta resumida |
|---|---|---|---|
| `GET` | `/health` | Público, fora do prefixo `/api/v1` | `200` se API/DB conectados; `503` se DB indisponível |
| `POST` | `/auth/register` | Público; cria aluno | `{ user, accessToken, refreshToken, tokenType, expiresIn }` |
| `POST` | `/auth/login` | Público; limite por janela | `{ user, accessToken, refreshToken, tokenType, expiresIn }` |
| `POST` | `/auth/refresh` | Refresh token | Tokens rotacionados |
| `POST` | `/auth/logout` | Access token | Revoga refresh token |
| `GET` | `/auth/me` | Access token | Perfil do usuário atual |
| `PATCH` | `/auth/me/consent` | Access token | Atualiza consentimento do usuário |

Exemplo de login sem credencial real:

```json
{
  "identifier": "<e-mail ou CPF de uma conta de teste autorizada>",
  "password": "<senha local, nunca registrar ou compartilhar>"
}
```

Cadastro público cria sempre aluno; não aceita definir papel de admin. CPF é validado e normalizado. O login aceita `identifier` (e-mail ou CPF) e mantém compatibilidade com clientes que enviam `email`.

### Catálogo e sessões de aluno

| Método | Rota | Acesso |
|---|---|---|
| `GET` | `/areas` | Autenticado; academia do token |
| `GET` | `/equipment?areaId=<id>` | Autenticado; academia do token |
| `GET` | `/equipment/beacon?uuid=<uuid>&major=<n>&minor=<n>` | Autenticado e consentimento ativo |
| `POST` | `/sessions/batch` | Autenticado e consentimento ativo |
| `GET` | `/sessions?page=1&limit=20` | Autenticado; histórico do usuário |

Exemplo de item de lote:

```json
{
  "clientSessionId": "00000000-0000-4000-8000-000000000001",
  "origin": "manual",
  "equipmentId": "<id do equipamento>",
  "exerciseIds": ["<id do exercício>"],
  "startedAt": "<data-hora ISO 8601>",
  "endedAt": "<data-hora ISO 8601>",
  "sets": [
    { "exerciseId": "<id do exercício>", "reps": 10, "weightKg": 20 }
  ]
}
```

O lote aceita 1–100 sessões. Repetir o mesmo `clientSessionId` e conteúdo é idempotente; reutilizá-lo com conteúdo diferente retorna `409 IDEMPOTENCY_CONFLICT`. A duração deriva dos timestamps. Sessão com séries não depende do mínimo de 20 segundos; a regra do mínimo se aplica a sessões sem série, como indicado no app.

### Administração e relatórios

Admin significa token com `role=admin`; o escopo dos dados é a academia autenticada. Listas aceitam paginação e busca conforme endpoint.

| Método | Rota | Acesso / observação |
|---|---|---|
| `GET`, `POST` | `/admin/areas` | Admin |
| `GET`, `PATCH`, `DELETE` | `/admin/areas/:id` | Admin; delete desativa registro |
| `GET`, `POST` | `/admin/equipment` | Admin |
| `GET`, `PATCH`, `DELETE` | `/admin/equipment/:id` | Admin; delete desativa registro |
| `GET`, `POST` | `/admin/exercises` | Admin |
| `GET`, `PATCH`, `DELETE` | `/admin/exercises/:id` | Admin; delete desativa registro |
| `GET`, `PATCH` | `/admin/gym/settings` | Admin; fuso e horário de funcionamento |
| `GET` | `/reports/usage?groupBy=equipment` | Admin; agrupamento equipamento, área ou hora |
| `GET` | `/reports/summary` | Admin; KPIs, ranking, horas e ociosos |
| `GET` | `/reports/heatmap` | Admin; área/hora |
| `GET` | `/reports/export.csv` | Admin; exportação filtrada |

`from` e `to` aceitam ISO 8601; período padrão 30 dias, máximo 366. `idleDays` padrão 7. `includeDemo=true` inclui demonstração; omitido, `isDemo` é excluído. Origem aceita `beacon` ou `manual`. Agrupamentos locais usam o fuso da academia (padrão `America/Fortaleza`); o funcionamento padrão é 06:00–22:00.

Respostas de lista usam `{ "data": [], "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 } }`; paginação e campos variam por rota. Sessões em lote retornam `{ "data": [], "created": 0, "idempotent": 0 }`.

### Padrão de erro

O envelope público é:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "<descrição segura do erro>",
  "details": [{ "path": "<campo>", "message": "<regra violada>" }]
}
```

`details` pode ser `null` para erros sem detalhes de validação. Respostas Zod inválidas usam HTTP `400`; autenticação/autorização usa `401`/`403`; conflitos idempotentes usam `409`; erros inesperados usam `500 INTERNAL_ERROR`. Não se deve incluir stack, senha, token, CPF ou URI de banco no corpo.

## Dados, privacidade e segurança

Modelos Mongoose: `Gym`, `User`, `Area`, `Equipment`, `Exercise`, `UsageSession`, `SetLog`. Academia tem fuso/horário; usuário inclui consentimento e CPF excluído por padrão de serialização; sessões têm `clientSessionId` único, origem e vínculos ao catálogo. CPF mascarado pode aparecer em respostas individuais de cadastro/perfil; não aparece no login, listas administrativas ou relatórios e não deve ir para logs.

O consentimento deve estar ativo para lookup de beacon e gravação de sessão. Revogar consentimento é uma alteração de preferência; não exclui registros já persistidos no servidor. A API ainda não oferece endpoints automatizados de exportação/exclusão de dados pessoais.

## Dados de demonstração e seed

O seed cria academia demo, 4 áreas, 12 equipamentos, 20 exercícios, contas de teste e 360 sessões de demonstração. Não execute sem conferir que a URI aponta para `fitbeacon` e que o alvo foi autorizado. Não use o seed em produção.

`mark-demo-data` marca dados antigos reconhecidos do seed; `purge-demo-data` mostra contagens sem apagar, salvo `--confirm`, e remove somente sessões/séries demonstrativas marcadas; não remove usuários nem catálogo. Faça backup e revisão antes de qualquer purge.

## Estrutura interna e convenções

- `src/auth/`: autenticação, tokens, CPF e middleware.
- `src/student/`: catálogo por academia, beacon e sessões.
- `src/admin/`: CRUD, configurações e posições do catálogo.
- `src/reports/`: agregações, filtros de demonstração/origem e CSV.
- `src/models/`: esquemas e inicialização de índices.
- `scripts/`: manutenção explícita dos dados demo.
- `tests/api.test.ts`: integração HTTP com MongoDB em memória.

Validar entrada por Zod, escopo sempre por `gymId`, logs sem dados pessoais e operações de exclusão como desativação lógica. Links relacionados: [arquitetura](../docs/ARQUITETURA.md), [testes](../docs/TESTES.md), [solução de problemas](../docs/SOLUCAO_DE_PROBLEMAS.md) e [tema visual](../docs/design/ESPECIFICACAO_VISUAL.md).

## Limitações conhecidas

- A UI do mapa emite `PUT /admin/equipment/positions`. No código atual, a declaração dessa rota está dentro do handler de criação `POST /admin/equipment`, e a lista CORS de métodos não inclui `PUT`. Portanto, o salvamento em lote não pode ser documentado como garantido; a rota/allowlist precisa de correção e teste antes de depender desse fluxo.
- O app não tem API de exportação/exclusão individual do histórico do aluno.
- A conexão de thresholds específicos cadastrados no equipamento à máquina de estados do runtime do app ainda precisa ser confirmada.
