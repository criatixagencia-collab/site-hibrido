# Criterio auxiliar: Google Trends Brasil

Este criterio ajuda o BuzzNews a descobrir assuntos quentes antes ou durante a rodada de fontes fixas.

## Configuracao padrao

```txt
Site: https://trends.google.com.br/trending
Local: Brasil
Periodo: ultimas 24 horas
Categoria: Entretenimento
Ordenacao: relevancia ou volume de pesquisa
Quantidade analisada: ate 20 tendencias
```

## Papel na curadoria

Google Trends nao prova que uma noticia aconteceu. Ele mostra que pessoas estao buscando um termo.

Por isso, o Trends serve para:

- indicar assuntos com demanda;
- reforcar prioridade de uma noticia ja encontrada;
- sugerir nomes/temas para buscar no Google Noticias;
- ajudar no desempate entre pautas parecidas.

## Regra de publicacao

```txt
Termo em alta + fonte jornalistica confirmando = pode entrar no ranking
Termo em alta + fontes fixas tambem falando = prioridade sobe
Termo em alta sem noticia confiavel = monitorar
Termo em alta fora de entretenimento = descartar
```

## Pontuacao

```txt
+15 se estiver no Google Trends Brasil em Entretenimento
+10 se estiver como tendencia ativa ou com volume alto
+5 se o termo tambem estiver repercutindo em redes sociais
-40 se nao houver noticia jornalistica confirmando o fato
```

## Checklist por termo

```txt
Termo:
Volume/status:
Horario em que apareceu:
Combina com BuzzNews? Sim / Nao
Categoria provavel:
Fato verificavel encontrado? Sim / Nao
Fonte principal:
Fontes de apoio:
Risco:
Decisao: publicar / monitorar / descartar
Observacoes:
```
