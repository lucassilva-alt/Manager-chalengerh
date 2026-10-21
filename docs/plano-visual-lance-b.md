# Visual novo + lance completo + Etapa (b) — Plano de Implementação

**Objetivo:** visual de nível bem acima da referência, lance com defesa, bolas paradas e replay, e a etapa (b): elenco e tática.

**Arquitetura:** o motor continua sem tela e testado em Node. A arte entra só em `src/render/` e `src/ui/`: bonecos com esqueleto e animação de verdade, ambiente gerado por código com iluminação física, interface no estilo transmissão de TV. Sem build; modelos em glTF dentro de `assets/`.

**Stack:** Three.js 0.186.1, Preact 10.29.8 + htm, `node:test`, Playwright; bonecos CC0 da Quaternius (Universal Animation Library); fontes Barlow (OFL, já usadas no Botton).

## Direção de arte (proposta)

| Elemento | Hoje | Novo |
|---|---|---|
| Jogadores | Caixas por código | Boneco CC0 com esqueleto (53 ossos) e animações reais (parado, trote, corrida, comemoração, queda); chute e mergulho do goleiro feitos por código sobre o esqueleto; uniforme com cores do time e número |
| Campo | Faixas lisas | Gramado com corte em faixas, ruído e desgaste na área; linhas nítidas |
| Gol | Caixa em aramado | Traves arredondadas e rede de malha que balança no gol |
| Bola | Esfera branca | Bola com gomos de desenho próprio, girando pela velocidade |
| Estádio | Duas caixas | Arquibancadas em níveis, cobertura, refletores, placas de patrocínio fictícias, torcida com as cores dos times |
| Luz | Plana | Tone mapping filmico, sombras suaves, céu em gradiente |
| Interface | Simples | Placar estilo TV, tipografia Barlow, retratos dos jogadores desenhados por código, transições curtas |
| Câmeras | Uma | Transmissão, close do chute, replay atrás do gol e em câmera lenta |

## Tarefas

### V — Visual
- [x] V1 Boneco CC0: reduzir o pacote às animações usadas → `assets/models/player.glb` + créditos
- [x] V2 Uniforme por shader (camisa, calção, meião, pele, goleiro) + número nas costas
- [x] V3 Animação: mistura parado/trote/corrida pela velocidade; chute e mergulho por código; comemoração
- [x] V4 Luz, sombras, céu e tone mapping
- [x] V5 Gramado de alta qualidade
- [x] V6 Gols com rede de malha e bandeiras de escanteio
- [x] V7 Estádio, refletores, placas e torcida
- [x] V8 Bola com gomos e giro
- [x] V9 Interface estilo TV + fontes
- [x] V10 Retratos dos jogadores por código
- [x] V11 Orçamento de desempenho (instâncias, sombras, medir)

### L — Lance completo
- [x] L1 Lance de defesa: adversário ataca, você escolhe o bote ou a cobertura (marcador vermelho + seta)
- [ ] L2 Pênalti: mira, força, efeito; goleiro escolhe o lado
- [ ] L3 Falta: barreira + chute com efeito
- [ ] L4 Escanteio: alvo do cruzamento + cabeceio no tempo certo
- [ ] L5 Tela de replay: câmera lenta, dois ângulos

### B — Etapa (b): elenco e tática
- [ ] B1 Elenco: atributos, idade, potencial, traços, moral, forma (modelo de dados + gerador)
- [ ] B2 Formações (4-4-2, 4-3-3, 3-5-2, 4-2-3-1, 5-3-2) com funções; afetam força e cenário do lance
- [ ] B3 Tela de escalação: cartas com retrato, arrastar entre campo e banco
- [ ] B4 Substituições na partida (5 trocas, 3 paradas)
- [ ] B5 Conversa no intervalo (elogiar, cobrar, acalmar) com efeito e risco por traço
- [ ] B6 Cartões e lesões na simulação
- [ ] B7 Entrevista pós-jogo (moral, torcida, diretoria)

Cada tarefa: teste que falha → mínimo → refatorar → commit. Toda tarefa visual fecha com print em celular e notebook para comparação.

### E — Clubes reais e escudos (pedido do usuário)
- [ ] E1 Escudos: SVGs brasileiros de JoseArroyave/football-logos (MIT) copiados em `assets/crests/`, limpos (sem script/eventos), com fallback para o escudo desenhado
- [ ] E2 Cadastro de clubes reais (nome, sigla, cores, escudo, estádio, capacidade) com fonte por clube
- [ ] E3 Elencos reais com fonte por clube (sem inventar jogador)

### NSM — Funcionalidades de gestão (após L e B)
Lista viva: o que aparece no material enviado (prints/vídeo) vira especificação; o que não aparece segue o prompt do projeto.
