# Memoria do Projeto BuzzPop

Este arquivo guarda o contexto operacional do projeto para agentes como Claude Code.

## Projeto

- Pasta: `/Users/rafaeloliver/Downloads/buzz`
- Stack: React + TanStack Start + Vite + Tailwind.
- Site local: `http://127.0.0.1:8080/`
- Dev server:

```bash
npm run dev -- --host 127.0.0.1 --port 8080
```

- Build:

```bash
npm run build
```

O build executa `npm run validate:news` antes de compilar.

## Arquivos importantes

- `src/lib/news-data.ts`: base atual das noticias, imagens, fontes e validacoes editoriais em runtime de dev.
- `src/components/news/NewsFeed.tsx`: feed principal.
- `src/components/news/SmartNewsImage.tsx`: componente de imagem com modo `cover` e modo seguro `safe`.
- `src/routes/noticia.$slug.tsx`: pagina interna de cada materia.
- `scripts/validate-news-content.cjs`: bloqueia materia curta ou com linguagem interna.
- `scripts/instagram-image-candidates.cjs`: busca imagens candidatas no Instagram via Apify.
- `local-curadoria/regras-curadoria.md`: arvore editorial e regras de curadoria.
- `local-curadoria/linguagem/guia-editorial.md`: voz editorial BuzzPop.
- `local-curadoria/noticias/checklist-imagem.md`: checklist de imagem.

## Regras editoriais obrigatorias

### Texto da noticia

- O texto publicado deve ser jornalistico, direto ou com voz BuzzPop.
- O corpo deve contar a noticia diretamente ao leitor.
- Nao escrever como relatorio de apuracao.
- Nao explicar por que a noticia foi escolhida.
- Nao preencher tamanho com contexto generico.
- Cada paragrafo precisa vir de informacao publicada nas paginas de referencia.
- Se um paragrafo nao tiver fonte clara, remover ou refazer.
- Fontes ficam no rodape da pagina, nao no corpo.
- No corpo, evitar frases como:
  - `a CNN publicou`
  - `a reportagem diz`
  - `a materia relembrou`
  - `segundo a fonte`
  - `o site informou`
- Atribuicao dentro do texto so deve aparecer quando for indispensavel por risco juridico, acusacao, declaracao ou dado sensivel.

### Tamanho minimo

Materia principal precisa ter no corpo:

- minimo de 350 palavras;
- minimo de 2.200 caracteres;
- minimo de 6 paragrafos.

Nota curta e excecao, mas nao deve entrar como materia principal.

### Trava automatica

`npm run validate:news` bloqueia:

- textos abaixo do minimo;
- linguagem interna de curadoria;
- citacoes indevidas a fontes no corpo (`CNN`, `R7`, `Exame`, `UOL`, `G1`, `reportagem`, `materia`, `site`, `fonte`);
- termos internos como `rodada`, `pauta`, `monitorado`, `ranking`, `curadoria`, `materia-base`, `para mim`.

Se essa validacao falhar, a materia deve voltar para reescrita.

## Fontes e reescrita

- A materia deve nascer de paginas publicadas sobre o mesmo assunto.
- Ideal: usar tres fontes sobre o mesmo fato quando existirem.
- Se so houver uma fonte forte para noticia simples, registrar a fonte no rodape e manter texto factual.
- Nunca copiar titulo, frases longas ou estrutura de uma materia original.
- Reescrever fatos com ordem propria e linguagem BuzzPop.
- Nao inventar fatos, relacoes, motivos ou analises.

## Imagens

### Regra principal: Busca Direta no Instagram

- **PROIBIÇÃO DE IMAGENS DE REFERÊNCIA:** É expressamente proibido puxar imagens dos sites jornalísticos de referência onde as matérias são extraídas.
- **INSTAGRAM DIRETO:** Quando a notícia for sobre pessoa real (celebridades, influenciadores, etc.), o sistema deve obrigatoriamente ir direto ao Instagram oficial e verificado da pessoa e obter as fotos recentes através da busca via Apify.
- **REGRA DE DUAS PESSOAS (FOTOS EM DUPLA):** Se a notícia estiver falando sobre duas pessoas centrais, priorizar obrigatoriamente a busca e escolha de fotos no Instagram em que as duas apareçam juntas.
- Para filmes, séries, eventos, programas, lugares e objetos, usar divulgação oficial, imagem de agência, poster, frame ou fonte com crédito claro.

Fluxo:
1. Identificar a(s) pessoa(s) central(is) da notícia.
2. Procurar os perfis do Instagram oficial/verificado correspondentes. Se forem duas pessoas, buscar posts em comum, fotos marcadas ou publicações em que apareçam juntas.
3. Buscar posts recentes via Apify no(s) perfil(is).
4. Escolher imagem de qualidade que esteja de acordo com o assunto.
5. Registrar a URL do post original e o crédito correto.

Fluxo operacional no repo:
1. Rodar `npm run images:instagram -- --date YYYY-MM-DD` para criar o plano em `data/daily/YYYY-MM-DD.images.json`.
2. Preencher `officialProfile` ou `officialUrl` para cada noticia com o perfil oficial/verificado.
3. Rodar `npm run images:search -- --date YYYY-MM-DD` para gravar 3 candidatos vindos somente do Instagram via Apify.
4. O sistema usa OpenAI com visão para escolher `candidateIndex`, priorizando rosto claro da pessoa central, foto correta e boa qualidade.
5. Revisar `candidateIndex` se necessário.
6. Rodar `npm run images:instagram -- --date YYYY-MM-DD` para baixar e aplicar a imagem escolhida.

Perfis oficiais conhecidos ficam em `data/instagram-profiles.json`. Se o nome central da noticia nao estiver nesse mapa, preencher `officialProfile` ou `officialUrl` no plano; nao adivinhar handle.

O pipeline diario nao usa busca textual de imagens por padrao. O script `collect-google-images.cjs` nao faz parte do fluxo editorial aprovado.

Crédito padrão:
```txt
Foto: Reprodução/Instagram/@usuario
```

### Formato Original no Desktop (Sem Margens)

- **VERSÃO DESKTOP:** As fotos reais encontradas devem ficar sempre no formato original delas lá no site (Instagram). É proibido cortar, aplicar bordas, preenchimento cinza, ou margens desfocadas (letterboxing via modo `safe` ou blur de fundo) no viewport desktop. A imagem deve fluir naturalmente com `md:aspect-auto` e `md:relative md:inset-auto md:h-auto md:w-full md:object-contain`.
- **VERSÃO MOBILE:** A versão mobile continua responsiva usando a limitação de proporção original com enquadramento (`aspect-[4/5]` ou `aspect-[4/3]`) e o gradiente sobreposto para garantir a excelente legibilidade do texto.
- O componente `SmartNewsImage` aceita `fit="cover"` e `fit="safe"`. O desfoque de fundo do modo `safe` deve ser ocultado em desktop com a classe `md:hidden` no elemento de blur.

## Apify / Instagram

`.env` local deve conter:

```env
APIFY_TOKEN=...
```

`.env` esta no `.gitignore`. Nao expor a chave em mensagens, commits ou logs.

Actor padrao:

```txt
apify/instagram-scraper
```

Comandos:

```bash
npm run images:instagram -- --date 2026-05-23
npm run images:search -- --date 2026-05-23
npm run instagram:images -- --profile virginia --limit 6
npm run instagram:images -- --url https://www.instagram.com/virginia/ --since "14 days"
npm run instagram:images -- --profile virginia --json
```

O script retorna candidatos com URL da imagem, URL do post, legenda, data, dimensoes e credito.

Nao rodar scraping real sem necessidade, porque pode consumir creditos da Apify.

## Estado atual do feed

O feed foi refeito com noticias de 22 de maio de 2026. Principais pautas atuais:

- Luis Felippe eliminado de Casa do Patrao.
- Boninho promete reset em Casa do Patrao.
- Video de abordagem de Britney Spears.
- Virginia em Dubai.
- Duda Freire, Virginia e Luana Piovani.
- Filho de Gugu mostra carro favorito do apresentador.
- Sheryl Crow relembra cancer e fim de noivado.
- The Black Ball tem 20 minutos de aplausos em Cannes.
- Trajetoria de Deolane.
- Virada Cultural em museus de Sao Paulo.

Todas passaram em `npm run validate:news` e `npm run build`.

## Coisas a preservar

- Nao remover regras editoriais sem substituir por regra melhor.
- Nao reduzir tamanho minimo das materias.
- Nao voltar a usar texto com cara de anotacao interna.
- Nao citar fonte de referencia no corpo por padrao.
- Nao trocar imagem boa por modo seguro se ela ja estiver bem enquadrada.
- Nao commitar `.env`.
