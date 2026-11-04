# Especificação visual FitBeacon

Este documento é a referência de identidade visual para o app e o painel FitBeacon.

## Temas e cores

- As opções são Sistema, Claro e Escuro e são persistidas separadamente no app e
  no painel. Sistema acompanha a preferência do dispositivo/browser. O `app.json`
  já usa `userInterfaceStyle: "automatic"`; não foi alterado.
- Tema escuro: fundo `#040B14`, superfície `#071B30`, superfície elevada
  `#0C2744`, borda `#64798E`, texto `#FFFFFF`, texto secundário `#8FA3BA`,
  primária `#00B6F7`, sucesso `#28DB9E`, alerta `#E0B24A` e perigo `#FF6B4A`.
- Tema claro: fundo `#F4F8FC`, superfície `#FFFFFF`, superfície elevada
  `#EEF4FA`, borda `#70869D`, texto `#0B1B2E`, texto secundário `#52667D`,
  primária/link `#0069D9`, sucesso `#0E7D59`, alerta `#805400` e perigo
  `#C13D22`.
- Botões com texto branco usam o degradê `#007FA3` → `#006FE0`. O degradê de
  marca mais luminoso `#00C6FF` → `#0084FD` é reservado para ilustrações e não
  recebe texto branco.
- No claro, cartões são brancos com borda discreta e sombra difusa; campos focados
  têm contorno azul visível; abas têm superfície branca e sombra superior leve.
  Os gráficos e pins do mapa selecionam paletas distintas por tema.
- Logo e símbolo fornecidos em `docs/design/claro/` são usados no tema claro;
  os assets transparentes existentes permanecem no tema escuro.

### Contraste e acessibilidade

Os testes calculam contraste sRGB pelas fórmulas WCAG 2.2. Texto normal, links,
mensagens de sucesso/alerta/erro e texto sobre botões exigem no mínimo 4,5:1.
Limites e indicadores não textuais exigem no mínimo 3:1. Os testes cobrem cada
superfície (fundo, cartão e superfície elevada), ambos os extremos do degradê e
as cores das zonas do mapa nos dois temas. As bordas foram escurecidas para
atingirem 3:1; no claro, os estados de alerta e perigo também foram escurecidos
para passar AA.

Contraste mínimo efetivamente medido entre as superfícies do tema:

| Par de cores | Escuro | Claro | Mínimo |
|---|---:|---:|---:|
| Texto principal / superfície | 15,12:1 | 15,66:1 | 4,5:1 |
| Texto secundário / superfície | 5,84:1 | 5,33:1 | 4,5:1 |
| Link / superfície | 6,50:1 | 4,71:1 | 4,5:1 |
| Sucesso / superfície | 8,43:1 | 4,63:1 | 4,5:1 |
| Alerta / superfície | 7,66:1 | 5,95:1 | 4,5:1 |
| Erro / superfície | 5,37:1 | 4,79:1 | 4,5:1 |
| Borda / superfície | 3,36:1 | 3,39:1 | 3:1 |
| Texto branco / cada ponta do degradê de ação | 4,60:1 | 4,60:1 | 4,5:1 |
| Rótulo de zona / superfície elevada do mapa | 4,97:1 | 4,63:1 | 4,5:1 |

Respeitar `prefers-reduced-motion` no painel e a configuração de reduzir movimento
do sistema no app. O painel deve manter foco de teclado visível e as telas devem
continuar legíveis em larguras estreitas e com fonte ampliada.

## Tipografia e componentes

- Tipografia: Inter.
- Grade de espaçamento: múltiplos de 4 px.
- Cartões: raio entre 16 e 20 px.
- Campos: raio de 14 px.
- Botão primário: pílula, raio total e degradê acessível.
- Botão secundário: contorno ciano e fundo de superfície.
- Ícones: traço fino, Lucide.
- Foco de teclado sempre visível e com contraste suficiente.

## Uso da marca

- Logo completa no splash, login e cadastro.
- Tela Início do app: símbolo seguido por “FitBeacon”, com “Fit” branco e “Beacon”
  azul.
- Configurações do app: símbolo seguido por “Beacon”.
- Painel: logo completa no login; símbolo e nome na barra lateral e no menu mobile.
- A logo transparente com letras brancas deve ficar sobre um bloco de marca escuro
  `#070A0E`, também quando o tema claro estiver ativo.

## Responsividade

- App: telas a partir de 320 px até tablet, sem perda de conteúdo ou controles.
- Painel: 360 px a 1440 px, sem rolagem horizontal na página; conteúdo deve refluír
  conforme a largura.
