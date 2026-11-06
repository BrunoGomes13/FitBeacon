# FitBeacon Web

Painel administrativo responsivo para visão geral, mapas, manutenção do catálogo e relatórios. Implementado com React, Vite e TypeScript.

## Scripts

Execute na raiz:

| Comando | Descrição |
|---|---|
| `npm run dev --workspace @fitbeacon/web` | Vite de desenvolvimento |
| `npm run build --workspace @fitbeacon/web` | Typecheck de build e bundle de produção |
| `npm run typecheck --workspace @fitbeacon/web` | TypeScript sem emissão |
| `npm run lint --workspace @fitbeacon/web` | ESLint |
| `npm test --workspace @fitbeacon/web` | Testes Vitest |
| `npm run test:e2e --workspace @fitbeacon/web` | Testes Playwright |

Vite configura host `0.0.0.0`, porta fixa `5173` e `strictPort`. O API URL precisa permitir a origem da página em `CORS_ORIGINS`.

## Variáveis

Copie `web/.env.example` para `web/.env` e ajuste localmente:

| Nome | Finalidade | Exemplo seguro | Obrigatória? |
|---|---|---|---|
| `VITE_API_URL` | Base da API REST | `http://localhost:3000/api/v1` | Não; fallback igual no cliente |

Não coloque segredos em variáveis `VITE_*`: são expostas ao bundle do navegador.

## Páginas e fluxos

| Rota | Conteúdo |
|---|---|
| `/login` | Autenticação administrativa |
| `/` | Dashboard/KPIs, gráficos, rankings, filtro de origem e inclusão de demo; atualização automática a cada 60 s |
| `/heatmap` | Mapa de calor área/hora |
| `/gym-map` | Planta de academia, pins de equipamentos e posição automática/manual |
| `/equipment` | CRUD de equipamento, associação de área/exercícios e beacon |
| `/areas` | CRUD de áreas |
| `/exercises` | CRUD de exercícios |
| `/reports` | Uso, filtros, ociosos, horário da academia e CSV |

As páginas administrativas são protegidas por `ProtectedRoute` e exigem `role=admin`. O fluxo de login envia credenciais para `POST /auth/login`; se a resposta pertencer a aluno, tokens são descartados e o acesso é recusado. Tokens ficam em memória/armazenamento de sessão definido pelo cliente, não em listas de alunos; renovação usa refresh token.

O mapa usa as áreas/equipamentos reais retornados pela API; itens sem posição recebem coordenadas automáticas por zona. A edição pelo mapa é em lote. **Limitação atual:** a API declara `PUT /admin/equipment/positions` dentro do handler `POST /admin/equipment`, e CORS não lista `PUT`; valide a rota antes de depender do salvamento em lote. Não contorne a autorização CORS em produção.

Indicadores e CSV excluem `isDemo` por padrão, incluem sessões `beacon` e `manual` por padrão, e permitem filtros explícitos. O fuso e horário de funcionamento configurados pela academia são usados em agrupamentos e ocupação. Detalhes das rotas em [api/README.md](../api/README.md).

## Estrutura e convenções

- `src/pages/`: páginas roteadas e lazy-loaded.
- `src/components/`: layout, formulários, filtros, gráficos e componentes comuns.
- `src/auth/`: contexto de sessão do administrador.
- `src/lib/`: cliente HTTP, tipos, formatação e lógica de mapa.
- `src/design/`: provider, tokens, resolução de tema e helpers de acessibilidade.
- `e2e/`: Playwright; `e2e/__screenshots__/` armazena capturas de teste.

Tema Sistema/Claro/Escuro é salvo em localStorage. Um script em `index.html` aplica a preferência antes do bundle. O painel usa foco visível, `prefers-reduced-motion` e tokens CSS para cores/superfícies.

## Testes e documentação

Os testes Vitest cobrem componentes, dados de relatório, tema/contraste, logo, mapa e validação de coordenadas. Playwright percorre páginas em larguras diferentes e produz capturas automatizadas. Instale o navegador se necessário com `npx playwright install chromium`.

Leia [docs/TESTES.md](../docs/TESTES.md), [docs/ARQUITETURA.md](../docs/ARQUITETURA.md), [docs/SOLUCAO_DE_PROBLEMAS.md](../docs/SOLUCAO_DE_PROBLEMAS.md) e [docs/design/ESPECIFICACAO_VISUAL.md](../docs/design/ESPECIFICACAO_VISUAL.md).
