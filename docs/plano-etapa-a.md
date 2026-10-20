# Etapa (a) — Motor + partida jogável — Plano de Implementação

**Objetivo:** uma partida completa no navegador: simulação em texto com lances jogáveis em 3D, gol, replay, "voltar o lance" e resultado coerente com a força dos times.

**Arquitetura:** motor em JS puro (sem DOM), determinístico (semente + passo fixo de 60 Hz), testado em Node. Render 3D (Three.js) e interface (Preact + htm) só leem o estado do motor e enviam comandos. Sem build: módulos ES nativos + import map, bibliotecas copiadas em `vendor/`.

**Stack:** HTML/CSS/JS (ES modules), Three.js, Preact 10.x + htm, `node:test`, Playwright.

Referência de mecânica: `docs/referencia.md` (análise dos prints e do vídeo).

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.html`, `css/tokens.css`, `css/app.css` | Casca, import map, tokens de cor |
| `vendor/three.module.min.js`, `vendor/preact.mjs`, `vendor/htm.mjs` | Bibliotecas com versão fixada |
| `src/engine/rng.js` | Sorteio com semente |
| `src/engine/teams.js` | Força de ataque/defesa a partir dos atributos |
| `src/engine/match-sim.js` | Relógio, eventos, nota ao vivo, energia, ritmo/foco |
| `src/engine/highlight/scenario.js` | Monta o lance (22 posições pela formação + contexto) |
| `src/engine/highlight/physics.js` | Bola (gravidade, atrito, efeito) em passo fixo |
| `src/engine/highlight/agents.js` | Movimento dos jogadores, corridas, marcação, desarme |
| `src/engine/highlight/keeper.js` | IA do goleiro |
| `src/engine/highlight/actions.js` | Conduzir, passar, chutar, desarmar → comandos |
| `src/engine/highlight/highlight.js` | Ciclo do lance, desfecho, snapshot (voltar), buffer de replay |
| `src/render/scene.js`, `src/render/figure.js`, `src/render/camera.js` | Campo, bonecos por código, câmera isométrica e close do chute |
| `src/input/gestures.js` | Arrastar, tocar, deslizar (toque = mouse; teclado extra) |
| `src/ui/match-screen.js`, `src/ui/pre-match.js`, `src/ui/result.js` | Telas da partida |
| `src/i18n/pt-BR.js` | Todos os textos |
| `data/fixtures/demo-teams.json` | 2 times de teste (até a etapa de dados) |
| `tests/engine/*.test.js` | Testes do motor |
| `tests/e2e/match.e2e.js` | Playwright: celular e notebook, FPS, console |

## Tarefas (cada uma: teste que falha → mínimo → refatorar → commit)

### Base
- [x] A1 Casca: `index.html` com import map + `vendor/` fixado; teste: página abre sem erro no console (Playwright).
- [x] A2 `rng.js`: mesma semente → mesma sequência; sementes diferentes → sequências diferentes.

### Simulação em texto
- [x] A3 `teams.js`: força calculada dos atributos; time mais forte tem ataque maior.
- [x] A4 `match-sim` relógio: 90 min + 2 tempos, intervalo, fim de jogo.
- [x] A5 Eventos (chance, falta, escanteio, pênalti, gol) por força; teste: em 1.000 sementes o mais forte vence mais e a média de gols fica entre 2 e 3.5.
- [x] A6 Nota ao vivo (começa 6.5, muda por evento) e energia (cai com ritmo de trabalho).
- [x] A7 Ritmo e foco alteram chances e energia (teste comparativo).
- [x] A8 Chance do time do jogador gera pedido de lance jogável; "simular" resolve sem lance.

### Lance jogável (motor)
- [x] A9 `physics.js`: bola rola e para por atrito; voo com gravidade; efeito curva a trajetória.
- [x] A10 `agents.js`: jogador vai ao alvo com aceleração limitada; corridas tracejadas dos companheiros.
- [x] A11 Conduzir: bola presa ao pé dentro do raio de controle; adversário próximo pode desarmar (por atributos).
- [x] A12 Passe: tempo de viagem; interceptação se defensor cruza a linha (por atributos).
- [ ] A13 Chute: direção + força + efeito do deslize; gol/fora/trave detectados.
- [ ] A14 `keeper.js`: goleiro prevê a bola e mergulha; defende por atributo e distância.
- [ ] A15 Desfecho do lance volta para a simulação (gol muda placar).
- [ ] A16 Voltar o lance: snapshot antes do lance; 1 uso por partida; estado restaurado idêntico.
- [ ] A17 Replay: buffer dos últimos segundos; distância do chute calculada ("27.0 metros").

### Render e controles
- [ ] A18 Cena: gramado, linhas, gols, arquibancada simples; câmera isométrica seguindo a bola.
- [ ] A19 Boneco por código com cor do uniforme; animação de corrida e chute.
- [ ] A20 Gestos: arrastar = conduzir (seta verde), tocar companheiro = passe, tocar adversário = desarme.
- [ ] A21 Chute: corte para close da bola, deslizar define direção/força/efeito, Cancelar.
- [ ] A22 Sobreposições: círculo de controle, nomes, linhas tracejadas, marcador na defesa.

### Interface da partida
- [ ] A23 Tela da partida: campo com nota/energia, relógio com acelerar, relato de eventos, ritmo/foco, pausar.
- [ ] A24 Pré-jogo e resultado (placar, autores dos gols, notas).
- [ ] A25 Botão "simular" e intervalo.

### Verificação da etapa
- [ ] A26 E2E Playwright (390×844 e 1366×768): jogar uma partida inteira com lance roteirizado, zero erros no console.
- [ ] A27 Medir FPS no lance com 22 bonecos em tela de celular (meta 60; registrar o medido).
- [ ] A28 Relatório da etapa com evidências (saída dos testes, FPS, prints).
