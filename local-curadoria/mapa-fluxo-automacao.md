# Mapa Do Fluxo De Automacao

Este mapa mostra como o site hibrido monta noticias hoje e onde a inteligencia editorial deve entrar.

## Fluxo oficial atual

```txt
Google News RSS + Google Trends RSS
  -> scripts/lib/news.js
    -> capa de entretenimento
    -> buscas separadas para Famosos, Musica, TV e Cinema
    -> buscas extras para tendencias ligadas a cultura pop
    -> reserva minima de candidatos por editoria
  -> data/news.json
  -> scripts/lib/editorial-drafts.js
    -> transforma as manchetes do cluster em evidencias explicitas
    -> o redator usa somente essas evidencias
    -> aceita nota curta e rejeita pauta sem lastro
    -> um segundo passe audita afirmacoes, exageros e preenchimento
    -> quando houver erro corrigivel, reescreve uma vez usando o parecer do revisor
  -> data/editorial-run-report.json
    -> registra aprovadas, rejeitadas, erros e motivos
  -> scripts/lib/illustrative-images.js
    -> coleta candidatas fora das fontes da noticia
    -> OpenAI Vision ou Codex CLI abre os pixels
    -> foto insegura fica pendente; nunca cai no primeiro resultado
  -> data/review-queue.json
  -> Caique acompanha o grupo de WhatsApp do BuzzPop
  -> Rafael/Gabi/time avaliam as materias no grupo
  -> scripts/editorial-review.js
    -> registra aprovacao/rejeicao humana
    -> bloqueia aprovacao sem foto revisada
  -> data/articles.json
  -> a materia aprovada entra na home principal do GitHub Pages
  -> site:final
  -> site:gh-pages
  -> commit/push explicito
```

## Regra operacional

- Publicacao principal do BuzzPop passa por avaliacao humana no grupo de WhatsApp onde o Caique esta presente.
- O grupo funciona como etapa de aprovacao editorial antes da home principal.
- So depois da aprovacao humana a materia deve subir para `docs/index.html` e para a versao publicada no GitHub Pages.
- Categorias obrigatorias da home principal:
  - `Famosos` para famosos e influenciadores
  - `Musica` para cantores, bandas e assuntos musicais
  - `TV` para programas, emissoras, realities e talentos da televisao
  - `Cinema` para filmes, atores, festivais e streaming quando o gancho principal for audiovisual

## Separacao obrigatoria

```txt
Texto publico da materia
  -> noticia, lead, contexto, detalhes, atualizacao, fontes no rodape
  -> nunca menciona curadoria, sistema, ranking, radar, algoritmo ou motivo da selecao

Metadados internos
  -> numero de fontes
  -> score
  -> sinais de tendencia
  -> decisao editorial
  -> notas de risco
  -> consulta sugerida para imagem
```

## Papel dos modelos

1. O provedor configurado em `AI_BASE_URL` escreve o rascunho.
2. Um segundo passe revisa cada afirmacao somente contra `evidenceClaims`.
3. `OPENAI_VISION_MODEL` pode revisar as fotos pela API.
4. Se a API visual estiver indisponivel, `USE_CODEX_VISION=true` permite usar o Codex CLI local.
5. Sem revisor visual disponivel, a imagem fica pendente para avaliacao humana.
6. Nenhum modelo publica. A promocao para `data/articles.json` exige comando de aprovacao humana.

## Proximo nivel desejado

```txt
Coleta de fontes
  -> buscar URLs reais das 3 principais fontes
  -> extrair texto das paginas quando permitido
  -> resumir fatos por fonte
  -> agrupar fatos repetidos

OpenAI como editor
  -> comparar fontes
  -> decidir se ha informacao suficiente
  -> montar plano de materia
  -> escrever texto final
  -> revisar linguagem interna
  -> revisar riscos juridicos

Imagem
  -> listar imagens candidatas
  -> nunca usar imagem da fonte original nem do artigo que serviu como referencia
  -> para pessoa especifica, preferir Instagram publico/oficial via Apify quando houver perfil mapeado
  -> senao, preferir imagem ilustrativa coerente: arquivo, perfil publico, rede oficial, banco permitido ou pagina relacionada que nao cobre a mesma noticia
  -> usar OpenAI para escolher a imagem mais adequada entre candidatas e rejeitar fonte proibida
  -> abrir/ler a pagina de origem da imagem e extrair credito textual quando existir
  -> registrar imagePostUrl, imageCredit, imageCreditStatus, origem e motivo interno
  -> checar no navegador/Browser Harness se a imagem e a legenda aparecem corretamente no site
```

## Comandos principais

```bash
npm run hybrid:refresh
npm run site:hoje
npm run site:referencia
npm run build
npm run post:wordpress
```
