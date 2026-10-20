# Manager Challenger (nome provisório)

Jogo de gestão de futebol para navegador em que você **joga os lances decisivos**: a partida corre em texto e, quando o seu time tem uma chance, ela vira um lance em 3D. Nesse lance você conduz, passa e chuta deslizando o dedo.

> Em desenvolvimento. Etapa atual: **(a) motor + partida jogável**. Veja `docs/relatorio-etapa-a.md`.

## Como jogar

1. Toque em **Jogar** no pré-jogo.
2. Durante a partida, ajuste o **ritmo de trabalho** e o **foco**, ou use **»** para acelerar.
3. Quando aparecer um lance:
   - **arraste** do seu jogador (com o anel branco) para conduzir;
   - **toque** num companheiro para passar;
   - **toque no gol** para abrir o close da bola e **deslize o dedo** em direção ao gol para chutar (curve o deslize para dar efeito).
4. Errou? Dá para **voltar o lance** uma vez por partida.

## Rodar no computador

Precisa de Node 20 ou mais novo.

```
npm install          # só para os testes (Playwright)
npm run serve        # abre em http://127.0.0.1:8080/
```

Não há build: a pasta é um site estático. Bibliotecas fixadas em `vendor/` (veja `vendor/README.md`).

## Testes

```
npm test             # motor e regras (Node)
npm run test:e2e     # navegador (Playwright): celular e notebook
```

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/engine/` | Motor sem tela: partida em texto e lance jogável |
| `src/render/` | Cena 3D (Three.js) |
| `src/input/` | Regras de gesto |
| `src/ui/` | Telas (Preact + htm) |
| `src/i18n/` | Textos (pt-BR) |
| `data/` | Dados do jogo |
| `docs/` | Plano, referência de mecânica e relatórios |
