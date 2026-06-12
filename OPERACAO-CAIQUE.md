# Operacao do Caique - BuzzPop / Site Hibrido

Este arquivo existe para o agente Caique operar o site sem depender de memoria solta da conversa.

## Caminho principal

Projeto:

```bash
/Users/rafaeloliver/.openclaw/workspace-caique/SITE HIBRIDO
```

Workspace do agente:

```bash
/Users/rafaeloliver/.openclaw/workspace-caique
```

## Habilidade ativa

Este projeto e uma habilidade ativa do Caique.

Quando Rafael pedir para mexer no Site Hibrido, BuzzPop, noticias, automacao editorial, imagens, layout, build, GitHub Pages, WordPress ou n8n, assumir esta pasta como raiz de trabalho.

O Caique pode:

- criar e editar arquivos do projeto;
- revisar textos, materias, imagens e regras editoriais;
- rodar validacoes e builds locais;
- gerar HTML estatico em `docs/` e `public/final-site/`;
- preparar publicacao quando Rafael pedir explicitamente;
- estudar novos arquivos e atualizar esta memoria operacional.

Antes de qualquer alteracao:

```bash
git status --short
```

Nao apagar, resetar, reverter ou sobrescrever mudancas existentes sem autorizacao clara de Rafael.

## Publicacao atual

Por enquanto, o fluxo principal nao e WordPress. O site e gerado como HTML estatico para GitHub Pages.

- Home do GitHub Pages: `docs/index.html`
- Paginas internas: `docs/noticias/<slug>/index.html`
- Site final local: `public/final-site/`
- Dados das materias: `data/articles.json`
- Feed bruto/processado: `data/hybrid-feed.json` e `data/news.json`

## Comandos principais

Sempre rodar a partir da pasta do projeto:

```bash
cd "/Users/rafaeloliver/.openclaw/workspace-caique/SITE HIBRIDO"
```

Atualizar noticias, filtrar, escrever pelo menos 10 materias e validar:

```bash
npm run hybrid:refresh
```

Gerar site final:

```bash
npm run site:final
```

Preparar GitHub Pages:

```bash
npm run site:gh-pages
```

Fluxo completo recomendado:

```bash
npm run hybrid:refresh && npm run site:final && npm run site:gh-pages
```

Previa local da versao do GitHub Pages:

```bash
python3 -m http.server 4177 --directory docs
```

Abrir:

```text
http://localhost:4177/
```

## IA

O projeto usa uma API compativel com OpenAI configurada no `.env`.

Variaveis relevantes:

- `AI_API_KEY`
- `AI_BASE_URL`
- `AI_MODEL`
- `USE_OPENAI_FOR_POSTS=true`

Atencao:

- Nunca imprimir a chave no terminal, em logs, commits ou respostas.
- Nunca publicar `.env`.
- `.env.example` pode explicar as variaveis, mas sem chave real.

## Regras editoriais fixas

- A home deve ser um feed vertical com varias materias, titulo, subtitulo e imagem.
- Ao clicar numa materia, deve abrir uma pagina interna com a materia completa.
- No fim da pagina interna, manter blocos como `Mais vistas do dia` e `Mais lidas do dia`.
- A materia deve parecer uma noticia real, nao uma curadoria.
- Nao escrever frases como:
  - `A cobertura aparece em X referencias consultadas`
  - `Esse conjunto da mais consistencia`
  - `Esta curadoria`
  - `Pagina de noticias`
- Titulo deve ser reescrito com linguagem propria. Nao copiar titulo de fonte.
- Titulo precisa fazer sentido sozinho. Nao misturar assuntos diferentes.
- Texto deve ter corpo jornalistico, contexto, desenvolvimento e fechamento.
- Quando a IA gerar texto fraco, generico, curto, incoerente ou com metalinguagem, reprovar antes de publicar.
- A cada 10 materias, no maximo 3 podem ser internacionais.
- O restante deve ser Brasil. Fonte brasileira nao transforma pauta internacional em pauta brasileira.
- A coleta deve nascer Brasil-first: priorizar pautas nacionais antes da escrita.
- Pauta internacional so deve entrar como candidata se estiver realmente forte/popular, por score alto, tendencia ou varias fontes.

## SEO — Prioridade máxima (09/06/2026)

**Diretriz de Rafael:** todo texto, matéria e conteúdo gerado para o BuzzPop deve ser otimizado para SEO desde a criação. O objetivo é o site aparecer na primeira página do Google.

### Regras obrigatórias para cada matéria:

1. **Meta tags completas** — Toda página deve ter:
   - `<title>` com palavra-chave principal no início
   - `<meta name="description">` com resumo atraente e foco na pauta (máx. 160 caracteres)
   - Open Graph tags (`og:title`, `og:description`, `og:image`, `og:type`, `og:url`)
   - Twitter Card tags

2. **Schema markup** — Implementar schema Article/LiveBlogPosting no HTML de cada matéria para rich snippets no Google.

3. **Títulos com SEO** — Título da matéria deve:
   - Conter a palavra-chave principal (nome do artista, evento, assunto)
   - Ser descritivo e único
   - Ter no máximo 60 caracteres
   - Não copiar título de fonte nenhuma

4. **URL amigável (slug)** — Slug deve conter a palavra-chave principal, sem stop words desnecessárias, hifenizada.

5. **Headings (H1, H2, H3)** — Estrutura hierárquica:
   - H1: título da matéria (único por página)
   - H2: subtemas dentro da matéria
   - H3: detalhamento quando necessário

6. **Palavras-chave** — Identificar e distribuir naturalmente pelo texto:
   - Principal no título, H1, primeiro parágrafo e URL
   - Secundárias ao longo do corpo
   - Sem keyword stuffing (excesso forçado)

7. **Imagens otimizadas** — Toda imagem deve ter:
   - `alt text` descritivo com palavra-chave relevante
   - Nome do arquivo em português, hifenizado (ex: `show-lauryn-hill-rio.webp`)
   - Compressão para carregamento rápido

8. **Sitemap.xml** — Gerar automaticamente a cada build com todas as URLs do site.

9. **Robots.txt** — Permitir indexação completa, bloquear apenas páginas internas irrelevantes.

10. **Links internos** — No final de cada matéria, incluir links para matérias relacionadas do próprio site.

11. **Performance** — Site estático já é rápido naturalmente, mas garantir:
    - Imagens comprimidas
    - CSS/JS minificados
    - Lazy loading de imagens
    - Cache headers configurados

12. **Conteúdo original** — Google penaliza duplicação. Cada matéria deve ser reescrita com estrutura, frases e abordagem próprias. Nunca copiar e colar de fontes.

### Implementação técnica:
- `sitemap.xml` deve ser gerado no script de build (`npm run site:final`)
- Schema Article deve ser injetado no `<head>` de cada página interna
- Meta tags dinâmicas no HTML (title, description, og) por slug/matéria
- Verificar no Google Search Console após cada publicação

Essas regras são **prioridade máxima** e se aplicam a toda rodada de geração de conteúdo.

## Regras de imagem

- Nao copiar a imagem exata da materia usada como fonte.
- Preferir imagem ilustrativa de outro contexto que faca sentido para o assunto.
- A imagem nao deve vir da mesma URL da noticia nem do mesmo cluster exato.
- Para noticia centrada em uma pessoa, pode buscar candidato em Instagram/Apify quando existir fluxo disponivel.
- A IA deve validar se a imagem representa o assunto sem induzir erro.
- Quando a imagem vier de uma pagina externa, registrar `imagePostUrl` e tentar extrair o credito textual escrito nessa pagina.
- O credito exibido deve priorizar o credito real da pagina/post. Usar apenas dominio como fallback temporario, nunca como credito ideal.
- Para travar publicacao sem credito textual extraido, usar `REQUIRE_PAGE_IMAGE_CREDIT=true` antes de rodar `npm run validate:articles`.
- Usar navegador/Browser Harness/Playwright para checar visualmente home, paginas internas, imagens renderizadas e legendas quando houver duvida.
- No layout, usar imagem sem corte agressivo. O site deve preservar a imagem em tela cheia e mobile.

## GitHub Pages

Antes de publicar:

```bash
npm run validate:articles
npm run site:final
npm run site:gh-pages
```

Depois conferir:

```bash
git status --short
```

Nunca commitar:

- `.env`
- chaves de API
- arquivos temporarios locais

So publicar/push quando Rafael pedir ou quando a automacao tiver uma regra explicita para isso.

## Cuidado com filtros

Nao criar novos bloqueios editoriais globais sem Rafael pedir.

Se politica, apostas, loteria ou outros temas ja estiverem bloqueados no codigo, manter como esta. Mas nao adicionar novas categorias bloqueadas por conta propria.

## Estado atual esperado

O site deve operar como um portal estatico no GitHub Pages, com:

- Home em feed vertical
- Pelo menos 10 materias publicaveis por rodada
- No maximo 3 internacionais a cada 10 materias
- Internacionais filtradas ja na coleta, nao apenas no validador final
- Paginas internas por materia
- Materias escritas com tom jornalistico
- Imagens ilustrativas validadas
- Geracao diaria possivel por comando local
