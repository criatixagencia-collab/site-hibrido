# BuzzPop Hibrido

Projeto hibrido criado a partir do visual do BuzzPop com a inteligencia do sistema automatizado.

## O que tem aqui

- Site React/TanStack com a identidade visual do BuzzPop.
- Feed responsivo para mobile e desktop.
- API local para noticias recentes em `/api/news`.
- Atualizacao dinamica em `/api/refresh`.
- Coleta por Google News RSS.
- Cruzamento com Google Trends Brasil.
- Regra editorial de 2+ fontes antes de entrar no radar.
- Rodada automatica gera rascunhos; publicacao exige aprovacao humana.
- Mix editorial: no maximo 3 materias internacionais a cada 10; o restante deve ser Brasil.
- A coleta ja prioriza pautas nacionais; internacional so entra como candidato se tiver sinal forte de popularidade.
- Cron horario configuravel.
- Publisher WordPress por REST API.
- Workflow n8n em `n8n/news-to-wordpress-workflow.json`.
- Plugin WordPress em `wordpress-plugin/auto-entretenimento-poster.php`.

## Rodar

```bash
npm install
npm run hybrid:refresh
npm run editorial:list
npm run editorial:report
npm run editorial:approve -- ID1,ID2
npm run site:final
npm run site:gh-pages
python3 -m http.server 4177 --directory docs
```

Abra:

```text
http://localhost:4177
```

## Scripts principais

```bash
npm run hybrid:refresh
npm run editorial:list
npm run editorial:report
npm run editorial:approve -- ID1,ID2
npm run editorial:reject -- ID3 --reason "motivo"
npm run editorial:image -- ID4:0
npm run editorial:publish
npm run site:final
npm run site:gh-pages
npm run hybrid:server
npm run hybrid
npm run hybrid:daily
npm run post:wordpress
npm run build
```

## Variaveis

Copie `.env.example` para `.env` e preencha apenas o que for usar.

- `PORT`: porta do servidor hibrido.
- `CRON_SCHEDULE`: agenda do cron, padrao `0 * * * *`.
- `MAX_ITEMS`: maximo de noticias coletadas.
- `POSTS_PER_RUN`: alvo de rascunhos aprovados pela revisao automatica por rodada.
- `MIN_REVIEW_DRAFTS`: minimo de rascunhos factuais para concluir uma rodada.
- `MAX_EDITORIAL_ATTEMPTS`: maximo de candidatos enviados ao redator em uma rodada.
- `MIN_CANDIDATES_PER_CATEGORY`: reserva de candidatos por Famosos, Musica, TV e Cinema.
- `MAX_TREND_SEARCHES`: quantidade maxima de tendencias usadas para abrir buscas extras.
- `MIN_INTERNATIONAL_SCORE`: pontuacao minima para uma pauta internacional entrar como candidata. Padrao atual: 120.
- `MAX_INTERNATIONAL_CANDIDATES`: limite de pautas internacionais levadas para a etapa de escrita. Padrao atual: 3.
- `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`: provedor que escreve o primeiro rascunho.
- `OPENAI_API_KEY`: revisao factual/visual independente quando a chave estiver valida.
- `USE_CODEX_FOR_POSTS`: ativa a gambiarra de redacao/revisao via Codex CLI autenticado por OAuth.
- `CODEX_HOME`, `CODEX_BIN`, `CODEX_MODEL`, `CODEX_REASONING_EFFORT`, `CODEX_POSTS_TIMEOUT_MS`: ajustes do Codex CLI local quando `USE_CODEX_FOR_POSTS=true`.
- `USE_CODEX_VISION`: ativa o Codex CLI local como fallback visual quando definido como `true`.
- `WP_URL`, `WP_USER`, `WP_APP_PASSWORD`, `WP_STATUS`: publicacao WordPress.

O provedor configurado escreve o primeiro rascunho. Uma segunda revisao factual
compara o texto somente com as evidencias coletadas. A OpenAI Vision avalia os
pixels das fotos candidatas; quando nao houver foto segura, o item fica pendente
para escolha humana.

## Publicar no GitHub Pages

O GitHub Pages recebe apenas arquivos estaticos. A inteligencia roda localmente e gera a pasta `docs/`.

```bash
npm run hybrid:refresh
npm run editorial:list
node scripts/automacao-caique-buzzpop.cjs --detail ID_DA_MATERIA
npm run editorial:approve -- ID_DA_MATERIA
npm run editorial:publish
```

`hybrid:refresh` grava `data/review-queue.json` e nunca substitui
`data/articles.json`. Somente `editorial:approve` promove uma materia para o
feed publicado.

O coletor combina capa de entretenimento, buscas por editoria e tendencias
relacionadas a cultura pop. `npm run editorial:report` mostra cada pauta
analisada e o motivo exato de aprovacao, rejeicao ou erro.

Depois publique a branch `main` usando `docs/` como origem no GitHub Pages.

Nunca publique `.env` ou chaves de API. O arquivo `.env` ja fica ignorado pelo Git.
