# Mapa Do Fluxo De Automacao

Este mapa mostra como o site hibrido monta noticias hoje e onde a inteligencia editorial deve entrar.

## Fluxo atual

```txt
Google News RSS + Google Trends RSS
  -> scripts/lib/news.js
    -> normaliza titulos
    -> remove assuntos bloqueados
    -> exige multiplas fontes no cluster
    -> pontua por fonte, atualidade, termos de entretenimento e tendencia
    -> tenta escolher imagem por RSS, metadados da pagina ou busca automatica
  -> data/news.json
    -> lista bruta aprovada para trabalho editorial
  -> scripts/lib/articles.js
    -> se USE_OPENAI_FOR_POSTS=true e OPENAI_API_KEY existe:
         OpenAI analisa dados internos, escolhe titulo, editoria, tags, consulta de imagem e escreve a materia
         -> validador confere titulo copiado, linguagem interna e corpo curto
         -> se falhar, OpenAI recebe os problemas e reescreve a materia
         -> se ainda falhar, o texto fica em fallback cauteloso e marcado em editorialMeta
       senao:
         fallback local escreve uma materia cautelosa, sem bastidor editorial no corpo
  -> data/articles.json
    -> posts prontos com html, body, excerpt, tags, fonte original e metadados internos
  -> scripts/lib/illustrative-images.js
    -> usa imageSearchQuery sugerida pela OpenAI
    -> se a materia falar de pessoa com perfil mapeado em data/instagram-profiles.json:
         Apify busca posts recentes do Instagram publico/oficial
         OpenAI visual escolhe a melhor foto ilustrativa
         foto e salva com credito de Instagram
       senao:
         segue para busca ilustrativa aberta
    -> busca imagens candidatas fora das fontes da noticia
    -> bloqueia dominio/site que publicou a materia original ou o mesmo cluster
    -> OpenAI escolhe a candidata mais coerente quando houver opcoes
    -> se nao houver candidata segura, usa placeholder
  -> scripts/lib/local-images.js
    -> baixa imagem remota quando possivel e salva em public/images/auto
  -> data/hybrid-feed.json
    -> feed usado pelo site
  -> frontend React ou HTML estatico
    -> mostra as materias
  -> scripts/post-wordpress.js
    -> publica no WordPress como rascunho ou post, conforme WP_STATUS
```

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

## Papel da OpenAI

Quando `USE_OPENAI_FOR_POSTS=true`, a OpenAI deve atuar como editor antes de escrever:

1. Ler titulo, resumo, fonte original, fontes detectadas, data, score e sinais internos.
2. Decidir se o assunto rende materia, nota curta ou deve ser descartado.
3. Identificar risco: acusacao, morte, processo, boato, exposicao pessoal, dado sensivel.
4. Escolher editoria: TV, Famosos, Musica, Cinema, Streaming ou Entretenimento.
5. Escrever titulo, linha de apoio e corpo como noticia para leitor final.
6. Passar pela revisao automatica: titulo nao pode copiar RSS, texto nao pode citar processo, corpo nao pode parecer explicacao de curadoria.
7. Se falhar, receber uma segunda chamada de reparo da OpenAI.
8. Sugerir `imageSearchQuery` e `imageAlt` para a camada de imagens.
9. Salvar decisao e risco em `editorialMeta`, sem expor isso no corpo da materia.

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
