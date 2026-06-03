# Arvore de Curadoria BuzzNews

Esta arvore define como decidir se uma noticia entra no BuzzNews, qual prioridade ela recebe e como deve ser reescrita.

## Visao geral

```txt
Rodada de curadoria
  -> consultar Google Trends Brasil em Entretenimento
  -> pegar as 5 ultimas noticias de cada site fonte
  -> juntar tudo em uma lista unica
  -> agrupar noticias que falam do mesmo assunto
  -> contar quantos sites falaram do mesmo assunto
  -> quanto mais sites falando, maior a prioridade
  -> cruzar assuntos com tendencias do Google Trends
  -> filtrar se o tema combina com BuzzNews
  -> verificar se existe fato confirmavel
  -> classificar categoria
  -> medir risco
  -> juntar pelo menos 3 fontes do mesmo assunto exato
  -> escolher imagem e credito
  -> escolher formato
  -> gerar ranking de postagem
  -> reescrever titulo e texto a partir das fontes no tom BuzzNews
  -> revisar antes de publicar
```

## 1. Entrada da noticia

Cada rodada de curadoria deve buscar as 5 noticias mais recentes de cada fonte permitida.

### Sinal auxiliar: Google Trends

O Google Trends deve ser usado como termometro de interesse, nao como fonte final da noticia.

```txt
URL: https://trends.google.com.br/trending
Local: Brasil
Periodo padrao: ultimas 24 horas
Categoria padrao: Entretenimento
Ordenacao padrao: relevancia ou volume de pesquisa
Quantidade inicial: ate 20 tendencias para triagem
```

### Como usar o Trends

- Usar para descobrir quais nomes, obras, programas, artistas e assuntos estao sendo pesquisados.
- Cruzar cada termo em alta com Google Noticias e fontes jornalisticas confiaveis.
- Dar pontos extras quando uma noticia das fontes fixas tambem aparecer no Google Trends.
- Nao publicar assunto que apareceu so no Trends sem uma materia/fato verificavel.
- Descartar termo em alta que seja meme solto, boato, duplo sentido, crime sem relacao com entretenimento ou assunto fora do BuzzNews.

### Fluxo com Trends

```txt
Termo aparece no Google Trends
  -> combina com entretenimento?
    -> nao: descartar
    -> sim: buscar noticia real sobre o termo
      -> existe fonte jornalistica confiavel?
        -> nao: guardar para monitorar
        -> sim: cruzar com fontes fixas e pontuar
```

### Fontes iniciais permitidas

- R7 Entretenimento
- Exame Pop
- Papelpop
- CNN Brasil Pop
- G1 Pop & Arte

### Quantidade por rodada

```txt
R7 Entretenimento: 5 noticias
Exame Pop: 5 noticias
Papelpop: 5 noticias
CNN Brasil Pop: 5 noticias
G1 Pop & Arte: 5 noticias

Total inicial esperado: ate 25 noticias
```

### Regras de entrada

- Entrar se for sobre entretenimento, famosos, musica, TV, streaming, cinema, series, internet ou cultura pop.
- Entrar se tiver nome, data, evento, lancamento, fala publica, publicacao oficial ou repercussao relevante.
- Entrar com cuidado se for boato, suposta treta, bastidor anonimo ou especulacao.
- Descartar se for assunto fora do universo BuzzNews.
- Descartar se depender de exposicao intima, acusacao grave sem confirmacao ou fofoca sem base clara.

## 1.1. Fontes obrigatorias

Toda materia principal publicada no BuzzNews precisa nascer de tres fontes exatas, atuais e ja publicadas sobre o mesmo assunto.

```txt
Assunto escolhido
  -> buscar materia atual sobre o mesmo assunto exato
  -> encontrar pelo menos 3 fontes confiaveis
  -> priorizar sites mais populares/confiaveis
  -> salvar URL da fonte principal e das fontes de apoio
  -> extrair fatos principais, contexto, nomes, datas, falas e pontos repetidos
  -> reescrever titulo, linha de apoio e texto no tom BuzzNews
  -> publicar com fontes visiveis
```

### Criterio das tres fontes

```txt
3 fontes ou mais: pode virar materia principal
2 fontes: guardar para monitorar ou publicar como nota curta
1 fonte: nao publicar como materia principal, salvo anuncio oficial simples
```

As tres fontes precisam falar do mesmo fato central. Materias sobre a mesma pessoa, mas com outro acontecimento, servem apenas como contexto.

Exemplo:

```txt
Mesma noticia:
Atriz anuncia gravidez
Atriz confirma primeira gravidez em entrevista
Famosa espera primeiro filho, diz assessoria

Contexto, nao mesma noticia:
Atriz anuncia gravidez
Atriz relembra novela antiga
Atriz muda visual para campanha
```

### Prioridade de fonte

Quando houver varias materias sobre o mesmo assunto, usar esta ordem:

1. G1 Pop & Arte ou CNN Brasil Pop, quando tiverem a materia exata.
2. R7 Entretenimento, Exame Pop ou Papelpop, quando forem a melhor fonte do assunto.
3. Fonte especializada reconhecida, quando a noticia vier de cinema, musica, streaming ou industria.
4. Post oficial ou rede social da pessoa/marca apenas como apoio, nao como unica fonte, salvo anuncio oficial simples.

### Regra de reescrita

- O titulo do BuzzNews deve nascer do fato central confirmado pelas fontes.
- A linha de apoio deve explicar o que aconteceu sem virar anotacao interna.
- O corpo da materia deve ser para leitor final, nunca para o dono do projeto.
- A reescrita deve misturar informacoes das fontes em ordem propria, sem copiar frases inteiras.
- O texto nao deve seguir a estrutura de nenhuma fonte individual.
- Cada paragrafo precisa ser rastreavel a uma das fontes consultadas.
- Nao criar explicacao editorial sobre por que o assunto foi escolhido.
- Nao usar contexto generico para bater meta de tamanho.
- Informacoes sensiveis devem ser atribuidas: "segundo", "de acordo com", "afirmou", "publicou".
- Se a fonte original for coluna, video ou opiniao, o BuzzNews deve deixar isso claro no texto.
- As URLs consultadas devem ficar registradas no dado da noticia.

### Prova de fonte por paragrafo

Antes de publicar uma materia, revisar cada paragrafo com esta pergunta:

```txt
Este paragrafo veio de qual fonte?
```

Se a resposta for "foi uma conclusao nossa", "foi para explicar a pauta" ou "foi para completar tamanho", o paragrafo nao entra.

O texto final deve ser uma reformulacao jornalistica das paginas de referencia, nao uma criacao livre sobre o assunto.

As fontes usadas na apuracao devem aparecer no rodape da noticia. No corpo, nao usar frases como "a CNN publicou", "a reportagem diz", "segundo a materia" ou "a fonte relembrou". O leitor deve receber a noticia pronta, nao o bastidor da reescrita.

### Trava contra linguagem interna

Titulo, linha de apoio e corpo nao podem parecer anotacao do processo. Antes de publicar, revisar se o texto parece uma materia real para leitor final.

```txt
Permitido:
  -> Deolane e presa em Sao Paulo e caso repercute entre famosos
  -> Prisao de Deolane movimenta famosos e familia reage nas redes
  -> Rafa Brites critica ostentacao de influenciadores

Proibido:
  -> Deolane vira centro da rodada
  -> Assunto segue como pauta forte
  -> Tema monitorado hoje
```

Palavras proibidas no texto publico:

- rodada;
- pauta;
- monitorado;
- ranking;
- curadoria;
- materia-base;
- fonte principal;
- fontes de apoio;
- anotacao;
- para mim;
- sistema;
- projeto.

Esses termos so podem aparecer em arquivos internos de planejamento, nunca na noticia renderizada no site.

### Tamanho minimo do texto

```txt
Materia principal:
  -> minimo de 350 palavras no corpo
  -> minimo de 2.200 caracteres no corpo
  -> minimo de 6 paragrafos

Nota curta:
  -> minimo de 220 palavras no corpo
  -> minimo de 1.400 caracteres no corpo
  -> minimo de 4 paragrafos
```

Se o assunto nao render esse minimo sem enrolar ou inventar informacao, ele deve ficar como nota monitorada, nao como materia principal.

No codigo do site, essa regra tambem deve ser validada antes de publicar. Se uma materia principal tiver menos de 350 palavras, 2.200 caracteres ou 6 paragrafos, ela precisa voltar para reescrita.

O comando `npm run build` executa `npm run validate:news` antes de compilar. Isso impede que novas materias curtas, com linguagem interna ou abaixo do minimo editorial passem despercebidas.

## 2. Agrupamento de noticias repetidas

Depois de pegar as noticias, agrupar assuntos parecidos.

### Quando considerar que e a mesma noticia

Considere como mesmo assunto quando duas ou mais noticias tiverem:

- a mesma pessoa, obra, programa, artista, filme, serie ou evento principal;
- o mesmo fato central;
- a mesma data ou acontecimento;
- titulos diferentes, mas falando da mesma historia.

### Exemplos

```txt
"Atriz anuncia gravidez" em um site
"Famosa espera primeiro filho" em outro site
  -> mesmo assunto

"Cantor lanca album novo" em um site
"Cantor confirma turne internacional" em outro site
  -> assuntos diferentes, mesmo personagem
```

### Regra principal de prioridade

Quanto mais fontes diferentes falarem do mesmo assunto, maior a prioridade.

```txt
4 fontes falando: prioridade maxima
3 fontes falando: prioridade alta
2 fontes falando: prioridade media
1 fonte falando: prioridade baixa, publicar apenas se tiver bom apelo
```

## 3. Ranking de postagem

Cada grupo de noticias recebe uma nota de 0 a 100.

### Pontuacao por repeticao entre fontes

```txt
4 fontes: +60 pontos
3 fontes: +45 pontos
2 fontes: +30 pontos
1 fonte: +10 pontos
```

### Pontos extras

- +15 se envolve celebridade, artista, programa ou franquia muito conhecida.
- +15 se o assunto estiver no Google Trends Brasil em Entretenimento.
- +10 se for novidade das ultimas 24 horas.
- +10 se tiver imagem, video ou post oficial forte para feed.
- +10 se estiver gerando repercussao nas redes.
- +10 se o termo estiver com volume alto ou tendencia ativa no Google Trends.
- +5 se tiver informacao util, como data, horario, onde assistir ou onde comprar.
- +5 se conectar com assunto que ja esta em alta.

### Penalidades

- -40 se apareceu no Google Trends, mas nao tem fonte jornalistica confirmando o fato.
- -30 se for rumor sem confirmacao.
- -25 se tiver risco juridico, acusacao grave ou tema sensivel.
- -15 se a fonte for unica e o assunto nao tiver confirmacao externa.
- -10 se a noticia for velha ou repetida demais.
- -10 se nao combinar bem com o publico do BuzzNews.
- -5 se nao render bom titulo, imagem ou chamada.

### Decisao por nota

```txt
80 a 100: postar primeiro
60 a 79: postar no topo do dia
40 a 59: postar se houver espaco
20 a 39: guardar para monitorar
0 a 19: descartar
```

### Desempate

Se duas noticias tiverem nota parecida, usar esta ordem:

1. Mais fontes falando.
2. Mais recente.
3. Menor risco.
4. Melhor imagem/video.
5. Mais alinhada com celebridades, musica, TV ou cultura pop.
6. Melhor desempenho no Google Trends Brasil.

## 4. Classificacao por categoria

```txt
Celebridades
  -> famosos, influenciadores, casais, aparicoes, eventos, entrevistas

Musica
  -> lancamentos, shows, turnes, parcerias, charts, festivais

TV e Reality
  -> novelas, programas, participantes, bastidores, audiencia

Cinema e Series
  -> trailers, estreias, elenco, streaming, premios

Internet
  -> viral, redes sociais, memes, criadores, tendencias

Polêmica
  -> discussao publica, acusacao, resposta, nota oficial
```

## 5. Nivel de risco

```txt
Baixo
  -> lancamentos, datas, eventos, trailers, posts oficiais

Medio
  -> repercussao, resposta de famoso, critica publica, bastidor leve

Alto
  -> acusacoes, separacoes nao confirmadas, saude, morte, crime, processos, menores de idade
```

### Regras para risco alto

- Nao publicar como certeza se nao houver confirmacao.
- Usar termos como "segundo", "de acordo com", "ainda nao confirmado" quando necessario.
- Preferir fontes oficiais ou mais de uma fonte confiavel.
- Evitar titulo agressivo.
- Separar claramente fato, resposta e contexto.

## 6. Escolha da imagem

A imagem faz parte da curadoria. Ela deve ser escolhida com cuidado, com credito visivel.

### Regra principal: Busca Direta e Proibição de Referência

```txt
- PROIBIÇÃO ABSOLUTA: É expressamente proibido extrair ou utilizar imagens diretamente dos sites jornalísticos de referência onde as matérias são obtidas.
- INSTAGRAM OBRIGATÓRIO: Quando a matéria envolver pessoa real (famosos, influenciadores), deve-se obrigatoriamente realizar a busca e extração de imagens direto de seu perfil do Instagram oficial via Apify.
- REGRA DE DUAS PESSOAS: Se a pauta envolver duas pessoas centrais, a busca e escolha deve priorizar obrigatoriamente fotos das duas juntas. O scraper deve analisar postagens marcadas, fotos em comum ou publicações que reúnam ambos os personagens.
- REGISTRO DE CRÉDITO: O crédito deve apontar claramente para o perfil do Instagram da celebridade que originou a foto.
```

### Prioridade para pessoas

Quando a noticia for sobre uma pessoa real, a primeira busca de imagem deve ser no Instagram oficial dessa pessoa, via Apify, antes de usar Google Imagens ou imagem da fonte jornalistica (esta última apenas em último caso de impossibilidade técnica completa).

```txt
Pessoa central da noticia
  -> procurar Instagram oficial/verificado
  -> se forem duas pessoas: buscar fotos onde ambas estejam juntas (posts em colaboração, marcações, posts em comum)
  -> buscar posts recentes com Apify
  -> escolher imagem relacionada ao assunto ou recente o suficiente
  -> registrar URL do post e credito
  -> se nao houver imagem boa/publica após esgotar buscas no Instagram, seguir para agencia/divulgacao/Google Imagens
```

Comando local:

```txt
npm run instagram:images -- --profile usuario --limit 6
npm run instagram:images -- --url https://www.instagram.com/usuario/ --since "14 days"
```

Credito padrao:

```txt
Foto: Reprodução/Instagram/@usuario
```

### Regras de Exibição e Layout (Desktop Original)

```txt
- FORMATO ORIGINAL EM DESKTOP: Na versão desktop do site, as fotos encontradas no Instagram devem ser renderizadas SEMPRE em seu formato/proporção original (seja 1:1, 4:5, 16:9, etc.).
- SEM MARGENS OU BLUR: No desktop, é proibido aplicar cortes, margens, cores de fundo ou o blur artificial (letterboxing) do modo seguro. O componente de imagem no desktop deve usar as classes `md:aspect-auto md:bg-transparent md:overflow-visible` no contêiner e `md:relative md:inset-auto md:h-auto md:w-full md:object-contain` na imagem para preservar o layout natural.
- FORMATO MOBILE: A versão mobile deve continuar responsiva e usar proporções controladas (aspect-[4/5] no feed e aspect-[4/3] na interna) com o gradiente inferior escuro sobreposto, mantendo a harmonia visual nos dispositivos móveis.
```

### Busca no Google Imagens

Usar depois da busca no Instagram quando a pauta for sobre pessoa, ou como primeira opcao quando a pauta for filme, serie, show, evento, programa, lugar ou objeto.

Pesquisar usando combinacoes como:

```txt
"nome da pessoa" recente
"nome da pessoa" evento 2026
"nome do filme/serie/show" divulgacao
"nome do assunto" foto recente
"nome da pessoa" Getty Images
"nome da pessoa" Instagram
```

Filtros desejados:

```txt
Tamanho: grande / alta qualidade
Periodo: mais recente possivel
Tipo: foto real, imagem oficial, divulgacao ou agencia
Contexto: parecido com a materia de referencia
```

### Similaridade com a imagem de referencia

A imagem alternativa deve tentar manter:

- mesma pessoa ou personagem principal;
- mesmo tipo de cena, evento ou contexto;
- enquadramento parecido quando fizer sentido;
- expressao/atmosfera coerente com a noticia;
- qualidade visual igual ou melhor que a imagem da fonte.

Exemplo:

```txt
Se a materia de referencia usa foto de tapete vermelho, buscar outra foto recente da pessoa em evento parecido.
Se usa frame de serie, buscar imagem oficial ou poster da mesma serie.
Se usa foto de show, buscar imagem recente do artista no palco.
```

### Ordem de preferencia

1. Post recente no Instagram oficial da pessoa central (ou conjunto se duas pessoas), obtido via Apify.
2. Imagem oficial divulgada pelo artista, emissora, filme, serie, evento ou plataforma.
3. Foto de agencia, banco de imagem ou fonte com credito claro.
4. Frame, poster, capa ou material promocional oficial.
5. Imagem do proprio post/publicacao oficial citada na noticia.
6. Imagem da fonte original apenas em último caso se não houver alternativa e se o uso/crédito estiver claro.

### Credito obrigatorio

Toda imagem publicada precisa ter credito logo abaixo.

Formato sugerido:

```txt
Foto: Nome do fotografo/agencia/fonte
```

Exemplos:

```txt
Foto: Reprodução/Instagram/@usuario
Foto: Divulgacao/Netflix
Foto: John Doe/Getty Images
Foto: Globo/Divulgacao
```

### O que registrar internamente

```txt
URL da imagem:
Origem da imagem:
Credito exibido:
Tipo de imagem: oficial / agencia / reproducao / divulgacao / banco de imagem
Tamanho/qualidade:
Por que essa imagem foi escolhida:
Parecida com a referencia? Sim / Nao
Observacao de uso:
```

### Evitar

- Copiar automaticamente a imagem do site fonte.
- Usar imagem sem credito.
- Usar imagem pequena, borrada, cortada demais ou de baixa qualidade.
- Usar foto antiga quando houver imagem recente melhor.
- Usar imagem que nao tenha relacao clara com o assunto.
- Usar foto retirada de redes sociais sem indicar reproducao/origem.
- Usar imagem que exponha menores de idade, vitimas ou situacoes sensiveis sem necessidade editorial.
- Usar montagem enganosa ou imagem que faca parecer algo que nao aconteceu.

### Regra de desempate visual

Se duas noticias tiverem prioridade parecida, a noticia com imagem mais forte, clara e segura pode subir no ranking..

## 7. Escolha de formato

```txt
Noticia rapida
  -> fato simples, lancamento, anuncio, foto, video

Repercussao
  -> algo que virou assunto nas redes

Contexto
  -> noticia que precisa explicar historico

Lista
  -> estreias, datas, indicacoes, principais pontos

Atualizacao
  -> noticia ja publicada que ganhou novo detalhe
```

## 8. Regra de reescrita

Antes de publicar, a noticia precisa virar texto proprio do BuzzNews.

### Ordem da reescrita

1. Ler a fonte e separar apenas os fatos.
2. Identificar o ponto mais chamativo.
3. Criar um titulo proprio.
4. Escrever uma linha de apoio.
5. Recontar a noticia com outras palavras e outra estrutura.
6. Conferir nomes, datas, numeros e contexto.
7. Marcar a fonte original internamente.

### Proibido

- Copiar titulo da fonte.
- Copiar paragrafos ou frases inteiras.
- Inventar detalhe para deixar mais chamativo.
- Omitir que algo e rumor quando ainda nao esta confirmado.
- Usar imagem sem permissao, origem ou credito claro.

## 9. Saida final esperada

Toda noticia aprovada deve sair neste formato:

```txt
Status:
Ranking:
Pontuacao:
Quantidade de fontes:
Fontes que falaram:
Risco:
Categoria:
Fonte principal:
Fontes de apoio:
Imagem escolhida:
Credito da imagem:
Titulo BuzzNews:
Linha de apoio:
Texto reescrito:
Tags:
Observacoes de revisao:
```
