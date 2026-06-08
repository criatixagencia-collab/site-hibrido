# Teste do criterio Google Trends - 18/05/2026

Horario do teste: 20:13 BRT

## Resultado tecnico

O Google Trends novo foi acessado em:

```txt
https://trends.google.com.br/trending?geo=BR&hl=pt-BR
```

A pagina carregou, mas a lista de tendencias nao veio pronta no HTML simples. O Google informa oficialmente que a pagina "Em alta" permite exportar por CSV, copiar para area de transferencia e Feed RSS, mas a automacao direta do RSS testada retornou vazia nesta rodada.

Conclusao tecnica: para automatizar o Trends com seguranca, o melhor caminho e usar exportacao manual por CSV/RSS da tela ou criar depois um conector especifico que leia o arquivo exportado. Por enquanto, o criterio funciona melhor como etapa de triagem assistida.

Fonte de apoio: https://support.google.com/trends/answer/3076011?hl=pt-br

## Fallback usado no teste

Para validar a logica "assunto quente -> noticia verificavel", usei o feed de entretenimento do Google Noticias Brasil:

```txt
https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=pt-BR&gl=BR&ceid=BR:pt-419
```

Esse feed nao substitui o Trends, mas ajuda a testar a segunda metade do fluxo: confirmar se existe materia real e repeticao entre fontes.

## Sinais encontrados

| Ordem | Assunto percebido            | Fonte principal no Google Noticias | Fontes relacionadas vistas                 | Decisao                                                      |
| ----- | ---------------------------- | ---------------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| 1     | Nova novela "Quem Ama Cuida" | UOL                                | Gshow, Noticias da TV, GZH, Veja           | Monitorar/Publicar se combinar com BuzzPop TV               |
| 2     | Vini Jr. e Virginia          | CNN Brasil                         | O Globo, Metropoles, ESPN Brasil, Migalhas | Alta prioridade: ja aparece nas fontes fixas e tem repeticao |
| 3     | Coração Acelerado            | Noticias da TV                     | Gshow, O Tempo, Veja                       | Publicar so se o site quiser cobrir novela diariamente       |
| 4     | Virginia e Ze Felipe         | Radio Itatiaia                     | Globo, Portal UAI, Purepeople, CNN Brasil  | Prioridade media/alta, mas cuidado com especulacao           |
| 5     | Noca da Portela              | O Globo                            | assunto de cultura/musica                  | Publicar com cuidado, tom respeitoso                         |
| 6     | Samira / BBB 26              | NaTelinha                          | assunto de reality                         | Monitorar se houver fonte forte                              |
| 7     | Harry Potter serie           | Omelete                            | assunto de streaming/franquia              | Bom para cultura pop se confirmado em mais fontes            |
| 8     | Ivete Sangalo                | O Globo                            | assunto de celebridade                     | Monitorar, risco de vida pessoal                             |

## Aplicacao da regra

### Melhor pauta pelo criterio combinado

```txt
Assunto: Vini Jr. e Virginia
Motivo: aparece no Google Noticias, apareceu antes nas fontes fixas e tem muitas fontes falando.
Decisao: alta prioridade.
Risco: medio, porque envolve termino e vida pessoal.
Regra: publicar apenas fatos confirmados e tratar repercussao como repercussao.
```

### Pautas que nao entrariam automaticamente

```txt
Virginia e Ze Felipe:
  motivo: pode virar especulacao sobre reconciliação.
  decisao: monitorar ou publicar com muito cuidado.

Maíra Cardi / abuso:
  motivo: tema sensivel e risco alto.
  decisao: nao priorizar para BuzzPop leve sem checagem forte e abordagem cuidadosa.

Assuntos de politica/guerra que aparecem no feed:
  motivo: fora do foco de entretenimento.
  decisao: descartar.
```

## Conclusao

O criterio funciona como ideia editorial, mas ainda nao esta pronto para automacao direta pelo Google Trends dentro do terminal. O caminho mais seguro por enquanto:

1. Abrir Google Trends.
2. Filtrar Brasil, ultimas 24 horas, Entretenimento.
3. Exportar CSV/RSS pela propria tela.
4. Usar o arquivo exportado para cruzar com fontes fixas e Google Noticias.
5. Publicar apenas quando existir fonte jornalistica confirmando o fato.
