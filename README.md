# BuzzNews Hibrido

Projeto hibrido criado a partir do visual do BuzzNews com a inteligencia do sistema automatizado.

## O que tem aqui

- Site React/TanStack com a identidade visual do BuzzNews.
- Feed responsivo para mobile e desktop.
- API local para noticias recentes em `/api/news`.
- Atualizacao dinamica em `/api/refresh`.
- Coleta por Google News RSS.
- Cruzamento com Google Trends Brasil.
- Regra editorial de 2+ fontes antes de entrar no radar.
- Rodada atual configurada para publicar pelo menos 10 materias aprovadas.
- Cron horario configuravel.
- Publisher WordPress por REST API.
- Workflow n8n em `n8n/news-to-wordpress-workflow.json`.
- Plugin WordPress em `wordpress-plugin/auto-entretenimento-poster.php`.

## Rodar

```bash
npm install
npm run hybrid:refresh
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
- `POSTS_PER_RUN`: quantidade minima de posts publicaveis gerados por rodada. Padrao atual: 10.
- `USE_OPENAI_FOR_POSTS`: use `true` para ativar OpenAI nos posts dinamicos.
- `OPENAI_API_KEY`: chave OpenAI, opcional.
- `WP_URL`, `WP_USER`, `WP_APP_PASSWORD`, `WP_STATUS`: publicacao WordPress.

Por padrao, o refresh dinamico usa geracao local para ser rapido. A OpenAI so entra quando `USE_OPENAI_FOR_POSTS=true`.

## Publicar no GitHub Pages

O GitHub Pages recebe apenas arquivos estaticos. A inteligencia roda localmente e gera a pasta `docs/`.

```bash
npm run hybrid:refresh
npm run site:final
npm run site:gh-pages
```

Depois publique a branch `main` usando `docs/` como origem no GitHub Pages.

Nunca publique `.env` ou chaves de API. O arquivo `.env` ja fica ignorado pelo Git.
