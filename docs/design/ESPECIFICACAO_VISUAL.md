# Especificação visual FitBeacon

Este documento é a referência de identidade visual para o app e o painel FitBeacon.

## Temas e cores

- Tema escuro como padrão; o tema claro continua acompanhando automaticamente a
  preferência do sistema. Contrastes equivalentes devem ser mantidos nos dois temas.
- Paleta escura:
  - Fundo: `#040B14`.
  - Superfície para cartões e campos: `#071B30`.
  - Superfície elevada: `#0C2744`.
  - Borda: `#1E3F63`.
  - Texto: `#FFFFFF`.
  - Texto secundário: `#8FA3BA`.
  - Azul de destaque: `#00B6F7`, para links, “Beacon” no logotipo e valores em
    destaque.
  - Sucesso: `#28DB9E`.
  - Alerta: `#E0B24A`.
  - Perigo e ação “Sair”: `#FF6B4A`.
- Primária de marca: degradê `#00C6FF` para `#0084FD`; o texto sobre a primária é
  branco.
- A paleta clara usa fundo `#F4F8FC`, superfícies `#FFFFFF` e `#EAF3FA`, borda
  `#788FA6`, texto `#071B30` e texto secundário `#40576D`. Estados de cor são
  escurecidos no tema claro quando usados como texto para preservar contraste.

### Contraste e ajustes de acessibilidade

Contraste calculado segundo WCAG 2.2 (luminância relativa sRGB):

| Combinação | Contraste | Resultado |
|---|---:|---|
| `#8FA3BA` sobre `#040B14` | 7,63:1 | AA e AAA para texto normal |
| `#8FA3BA` sobre `#071B30` | 6,72:1 | AA e AAA para texto normal |
| `#40576D` sobre `#F4F8FC` | 7,02:1 | AA e AAA para texto normal |
| `#788FA6` contra branco | 3,34:1 | AA para limites de componentes |
| Branco sobre `#00C6FF` | 2,00:1 | Reprovado |
| Branco sobre `#0084FD` | 3,67:1 | Reprovado para texto normal |
| Branco sobre `#007FA3` | 4,60:1 | AA para texto normal |
| Branco sobre `#006FE0` | 4,83:1 | AA para texto normal |

Por isso, o degradê de marca original permanece para ilustrações e usos sem texto
sobreposto. Botões, banners e abas com texto branco usam o degradê acessível
`#007FA3` → `#006FE0`. Os tokens preservam o azul vibrante original para ícones e
elementos de destaque sobre superfícies escuras. No tema claro, os destaques usados
como texto passam para tons escuros equivalentes.

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
