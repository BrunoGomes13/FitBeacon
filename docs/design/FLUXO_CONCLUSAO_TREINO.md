# Fluxo de conclusão e persistência de treinos

## Persistência local

- O outbox e os rascunhos usam `fitbeacon-sessions-v1.json`, formato versionado em
  `app/src/api/sessionFileStorage.ts`.
- A escrita atualiza primeiro um arquivo temporário e o substitui como arquivo principal.
- Itens legados da fila no SecureStore são migrados sob demanda; o SecureStore continua
  destinado a tokens e valores privados pequenos.
- Cada série gravada é checkpointada com o equipamento, exercício, horário de início,
  duração acumulada e séries já registradas.

## Conclusão

Finalizar manualmente, afastar-se do beacon, perder sinal e enviar o app para segundo
plano percorrem o mesmo controlador idempotente por `clientSessionId`.

1. Construir a sessão e copiar os nomes do equipamento, área e exercícios.
2. Descartar somente se não houver séries e a duração for menor que 20 segundos.
3. Persistir o rascunho e adicionar a sessão ao outbox local.
4. Tentar sincronizar; falhas de rede/servidor mantêm a cópia local.
5. Após persistência local, limpar o treino ativo e voltar ao Início uma única vez.

Se a escrita local falhar, a navegação não acontece e o treino permanece disponível para
`Tentar de novo`. Ao reabrir o app, um rascunho pendente é concluído e enfileirado antes
de reativar a detecção. Sessões com uma ou mais séries não são descartadas por duração,
inclusive abaixo de 20 segundos.

## Diagnóstico

O diagnóstico da última conclusão contém apenas resultado, etapa (`local-save`,
`session-upload` ou `set-upload`), código, motivo e horário. Não contém dados pessoais.
