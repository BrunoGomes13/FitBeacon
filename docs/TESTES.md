# Estratégia de testes e aceite manual

Comandos e experiência geral estão no [README da raiz](../README.md). Instruções específicas: [app](../app/README.md), [API](../api/README.md), [painel](../web/README.md). Este documento descreve o que verificar, não substitui teste em aparelho.

## Comandos automatizados

Execute na raiz do repositório:

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e --workspace @fitbeacon/web
```

Os scripts são definidos na raiz e nos respectivos `package.json`. O comando Playwright requer Chromium; instalação inicial:

```powershell
npx playwright install chromium
```

Para validar um workspace isoladamente:

```powershell
npm run typecheck --workspace @fitbeacon/app
npm run lint --workspace @fitbeacon/app
npm test --workspace @fitbeacon/app

npm run typecheck --workspace @fitbeacon/api
npm run lint --workspace @fitbeacon/api
npm test --workspace @fitbeacon/api

npm run typecheck --workspace @fitbeacon/web
npm run lint --workspace @fitbeacon/web
npm test --workspace @fitbeacon/web
```

### Cobertura por workspace

| Workspace | Focos de teste |
|---|---|
| App | Parser iBeacon e payload inválido; entrada/saída/troca/timeout; Mock; cronômetro por horários; conclusão com 0/1/múltiplas séries; fila, migração, fallback, consentimento, recuperação e idempotência |
| API | Auth/CPF mascarado, consentimento, permissões e escopo academia; catálogo CRUD; batch idempotente; agregações, fuso local, demo, CSV e seed repetível com banco em memória |
| Web | Componentes e filtros; persistência/seleção de tema e logos; contraste; mapa e validação de coordenadas |
| Playwright | Login simulado, navegação das páginas e responsividade em larguras/temas configurados; capturas de referência em `web/e2e/__screenshots__/` |

Teste automatizado com API simulada não valida conexão MongoDB real, leitura BLE física nem armazenamento em aparelho. Para isso, siga os passos manuais.

## Preparação do Samsung

1. Instale o development build do app e confirme depuração USB autorizada (`adb devices` deve indicar `device`).
2. Inicie API e Metro. Configure `EXPO_PUBLIC_API_URL` para IP LAN do computador ou `localhost` com `adb reverse` da porta 3000.
3. Use uma conta de teste autorizada e uma base de desenvolvimento com catálogo/seeds conhecidos. Não use dados reais em capturas.
4. Para fluxo simulado, ative consentimento, modo desenvolvedor e Mock. Para hardware, use beacon autorizado e conceda permissões do Android.

## Checklist funcional manual

| # | Passo | Resultado esperado |
|---:|---|---|
| 1 | Cadastrar conta e revisar o texto de consentimento | O consentimento é explícito; sem consentimento não inicia tracking. |
| 2 | Abrir Perfil > Configurações e selecionar tema Sistema, Claro e Escuro | Preferência troca e permanece após fechar/reabrir. |
| 3 | Ativar modo desenvolvedor e Mock | Controles de simulação aparecem; ao abrir, Mock começa ocioso. |
| 4 | Acionar **Aproximar** no Mock | Equipamento simulado é reconhecido e fluxo correspondente abre sem erro de renderização. |
| 5 | Iniciar treino e verificar o exercício escolhido | Cabeçalho e equipamento correspondem ao escolhido/detectado, não a um aparelho fixo. |
| 6 | Registrar série com carga e repetições | Série aparece no treino e o checkpoint é salvo; aviso é temporário. |
| 7 | Iniciar descanso e deixar o timer correr | Temporizador de descanso progride e pode ser encerrado conforme controles da tela. |
| 8 | Pausar, esperar, retomar e alternar app para segundo plano | Tempo líquido exclui pausa e inclui o intervalo em segundo plano enquanto treino roda. |
| 9 | Finalizar treino pelo botão | Uma sessão com séries é salva localmente e aparece no Histórico; navega ao Início uma vez. |
| 10 | Iniciar outra sessão e simular afastamento | O mesmo fluxo de conclusão salva séries e não mostra erro técnico. |
| 11 | Com treino ativo, usar voltar da tela | Retorna normalmente e preserva rascunho; Início oferece Retomar/Finalizar. |
| 12 | Afastar Mock e esperar o timeout de perda de sinal | Após 15 s sem sinal, conclui pelo fluxo comum; sem série, aplica mínimo de 20 s. |
| 13 | Concluir uma sessão com série em menos de 20 s | A sessão é mantida; regra temporal só descarta sessão sem série. |
| 14 | Verificar Histórico e detalhe de treino com exercícios diferentes | Sessões/séries mostram equipamento, área e nomes dos exercícios correspondentes. |
| 15 | Trocar tema e validar mapas, cartões e logos | Cores e logos acompanham tema; texto/controles permanecem legíveis. |
| 16 | Aumentar tamanho da fonte do Android e testar tela estreita | Conteúdo reflowa sem corte de botões nem conteúdo atrás das barras/abas. |
| 17 | Negar permissão Bluetooth e abrir Diagnóstico | Mensagem explica a permissão necessária e oferece ação para configurações quando disponível. |
| 18 | Desligar Bluetooth e repetir diagnóstico | Estado desligado é reportado com orientação; app não mostra stack técnico. |
| 19 | Em Diagnóstico, usar **Testar armazenamento** | Testes de 1 KB, 10 KB e 100 KB mostram sucesso ou causa técnica sem dados pessoais. |
| 20 | Colocar telefone em modo avião, concluir treino e reabrir app | Sessão permanece local/pending e é enviada uma vez ao reconectar; não duplica. |
| 21 | Revogar consentimento | Fila e rascunho locais são limpos; histórico já enviado não é apagado automaticamente. |
| 22 | Testar beacon real em distâncias e orientações diferentes | Equipamento entra/sai conforme limiares; anote RSSI e confirme diagnóstico antes de calibrar. |

Registre resultado, modelo/Android, provider usado e logs sem token/CPF/URI. Não use dados pessoais em screenshots.

## Checklist do painel

1. Entrar com conta administrativa de teste; conta de aluno deve ser recusada.
2. Conferir dashboard sem dados demo por padrão e ativar/desativar inclusão demo.
3. Conferir gráficos, ranking, mapa de calor, filtros de origem/fuso e atualização do dashboard.
4. Abrir mapa da academia; verificar pins automáticos e posições existentes.
5. Validar CRUD de área, equipamento e exercício, inclusive associações e campos obrigatórios.
6. Exportar CSV e verificar agregados sem identidade de aluno.
7. Testar foco por teclado, tema claro/escuro, movimento reduzido e viewports desktop/mobile.

**Atenção:** salvar posições em lote está sujeito à limitação de registro da rota/CORS descrita em [api/README.md](../api/README.md#limitações-conhecidas); não trate um teste visual do mapa como validação do salvamento.

## Evidências e prints

Resultados automatizados devem ser registrados por comando e status, sem segredos. Prints finais de app ainda não foram fornecidos; os marcadores e destinos estão listados no [README da raiz](../README.md#prints-pendentes).
