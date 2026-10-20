# Relatório — Etapa (a): motor + partida jogável

Data: 2026-10-20 · Branch: `claude/clever-rubin-y9bqef`

## O que ficou pronto

| Parte | O que faz | Onde |
|---|---|---|
| Sorteio com semente | Mesma semente + mesmos comandos = mesma partida | `src/engine/rng.js` |
| Força dos times | Ataque/defesa por posição, atributos e energia | `src/engine/teams.js` |
| Partida em texto | Relógio 2×45, chances, escanteios, faltas, pênaltis, gols, nota ao vivo (6.5), energia, ritmo de trabalho, foco | `src/engine/match-sim.js` |
| Lance jogável (motor) | Bola com gravidade, atrito, quique e efeito; jogadores com aceleração; conduzir; passe com erro e interceptação; chute com força/altura/efeito; trave; goleiro com reação e mergulho; defesa por funções; lance por vez (pausa até o comando) | `src/engine/highlight/` |
| Voltar o lance | 1 por partida, estado idêntico ao início do lance | `scenario.js` |
| Replay | Gravador dos últimos segundos + distância do chute | `replay.js` |
| Cena 3D | Gramado, linhas, gols, arquibancadas, 22 bonecos por código, câmera isométrica que segue a bola | `src/render/` |
| Controles | Arrastar = conduzir (seta verde); tocar companheiro = passe; tocar no gol = close da bola; deslizar = chute; Cancelar | `src/input/gestures.js`, `highlight-view.js` |
| Sobreposições | Círculo de controle, anel no jogador, corridas tracejadas, nomes | `src/render/overlays.js` |
| Telas | Pré-jogo, partida (placar, campo com notas/energia, relato, controles), resultado do lance, intervalo, resultado final | `src/ui/` |

## Evidências

Comandos e saídas desta data:

```
npm test            → # pass 101 · # fail 0
npm run test:e2e    → # pass 12  · # fail 0
```

- E2E da partida inteira jogada pela interface em **390×844, 844×390 e 1366×768**, com todos os controles visíveis sem rolar e **zero erros no console**.
- Equilíbrio (1.000 sementes): times iguais = **2,51 gols/jogo**; 80×50 = o forte vence 977.
- Lance com jogada simples "conduzir e chutar no canto": **~22% de gol** (simulação automática converte ~24%).

### Desempenho (A27)

| Medida | Valor | Observação |
|---|---|---|
| Chamadas de desenho no lance | 103 | meta ≤ 250 |
| Triângulos | 3.058 | leve |
| Motor por passo (60/s) | 0,009 ms | meta < 1 ms |
| FPS | 20,3 | **WebGL por software, sem GPU** — não representa celular |

**60 fps em celular real: não verificado.** Precisa de um teste num aparelho físico.

## Decisões tomadas durante a etapa

- **Lance por vez:** o tempo do lance pausa até o jogador dar um comando e pausa de novo quando a jogada se completa (condução chega ao ponto, passe é dominado).
- **Defesa por funções** (pressão, cobertura, posição) em vez de todos irem na bola: a sondagem mostrou 36% de lances "perdidos" com todos pressionando.
- **Corte de bola depende da velocidade:** chute forte é bloqueado bem menos que passe lento.
- **Times provisórios** (`data/demo-teams.json`): o pacote do Botton só tem 8 jogadores reais (Palmeiras); não foi inventado nenhum jogador real.

## O que ficou de fora (e para quando)

| Item | Motivo / etapa |
|---|---|
| Lances de defesa (marcador vermelho no adversário) | Desenho do lance defensivo ainda não feito; próximo ajuste do motor |
| Bolas paradas com minijogo próprio (falta, escanteio, pênalti) | Hoje viram lance normal; minijogo de mira/força/efeito pendente |
| Tela de replay (rever o gol) | Gravador pronto; falta a tela que toca os quadros |
| Rostos dos jogadores, estádio atrás do gol, torcida animada | Polimento visual — etapa (g) |
| Tática, substituições, conversa no intervalo | Etapa (b) |
| Elencos, escudos e estádios reais | Etapa de dados (pesquisa com fonte) |
| PWA, offline, `netlify.toml` | Etapa (g) |
| 60 fps medido em celular real | Precisa de aparelho físico |
