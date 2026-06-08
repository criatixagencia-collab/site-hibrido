export type NewsSource = {
  label: string;
  url: string;
};

export const EDITORIAL_POLICY = {
  minSourcesPerArticle: 1,
  minBodyWords: 350,
  minBodyCharacters: 2200,
  minBodyParagraphs: 6,
};

const PUBLIC_COPY_BLOCKLIST = [
  /\brodada\b/i,
  /\bpauta\b/i,
  /\bmonitorad[ao]s?\b/i,
  /\branking\b/i,
  /\bcuradoria\b/i,
  /\bmat[eé]ria-base\b/i,
  /\bfonte principal\b/i,
  /\bfontes de apoio\b/i,
  /\banota[cç][aã]o\b/i,
  /\bpara mim\b/i,
  /\bnosso sistema\b/i,
  /\bmeu sistema\b/i,
  /\bnosso projeto\b/i,
  /\bmeu projeto\b/i,
  /\bganhou força porque\b/i,
  /\bajuda a explicar\b/i,
  /\bcolocou .+ entre os assuntos\b/i,
  /\bfora do notici[aá]rio\b/i,
  /\bfrentes? de repercuss[aã]o\b/i,
  /\bCNN\b/i,
  /\bR7\b/i,
  /\bExame\b/i,
  /\bUOL\b/i,
  /\bG1\b/i,
  /\breportagem\b/i,
  /\bmat[eé]ria\b/i,
  /\bsite\b/i,
  /\bfonte\b/i,
  /\btrending topic\b/i,
  /\btrending topics\b/i,
  /\bphase\b/i,
  /\bred carpet\b/i,
  /\bbombaram\b/i,
  /\bstylist\b/i,
  /\bcausas sociais\b/i,
  /\bcausas apoiadas\b/i,
  /\broutine\b/i,
  /\bcrian[cç]a da foto\b/i,
  /\bilhas particulares\b/i,
  /\bpen[ií]nsula\b/i,
  /\bpr[eé]-lan[cç]amento\b/i,
];

export type NewsItem = {
  id: string;
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  body: string[];
  imageSearchTerms?: string[];
  image: string;
  imagePosition?: string;
  articleImagePosition?: string;
  imageFit?: "cover" | "safe";
  articleImageFit?: "cover" | "safe";
  imageCredit: string;
  imagePostUrl?: string;
  sourceLabel: string;
  sourceUrl: string;
  sources: NewsSource[];
  rankLabel: string;
  publishedAt: string;
  updatedAt?: string;
  timeAgo: string;
};

const BASE: NewsItem[] = [
  {
    id: "1",
    slug: "virginia-fonseca-se-derrete-com-cartinha-escrita-pelas-filhas",
    category: "celebridades",
    title: "Virginia Fonseca se derrete com cartinha escrita pelas filhas",
    excerpt: "Virginia Fonseca compartilhou um momento tocante ao mostrar a cartinha que recebeu de suas filhas, deixando os fãs encantados.",
    body: [
      "A influenciadora Virginia Fonseca emocionou seus seguidores nesta semana. A reação dela ao receber uma cartinha das filhas foi puro amor, mostrando um lado mais íntimo da sua vida familiar.",
      "Virginia, que é conhecida por sua personalidade forte e divertida, compartilhou a cartinha nas redes sociais. O gesto das pequenas conquistou os corações dos fãs e rendeu diversos comentários carinhosos.",
      "As filhas de Virginia têm apenas alguns anos, mas já demonstram um grande talento para escrever. A cartinha cativou não só a mãe, mas todos que a acompanharam nesse compartilhamento especial.",
      "Em tempos onde as relações familiares muitas vezes são expostas, Virginia optou por dividir um momento genuíno. Isso reforça a conexão que ela tem com seus seguidores, que se sentem parte da sua vida.",
      "Além da sua carreira como influenciadora, essa faceta maternal de Virginia é muito admirada. As histórias sobre suas filhas e a forma como ela as educa são constantemente elogiadas.",
      "Virginia tem se dedicado a mostrar a maternidade de maneira leve e divertida. Seus vídeos e posts são sempre recheados de situações engraçadas da vida com crianças.",
      "A conexão que Virginia criou com os fãs é admirável. Ela não tem medo de mostrar suas emoções, o que a torna ainda mais acessível ao público.",
      "Momentos como este, onde ela se mostra vulnerável e carinhosa, reforçam a imagem positiva que o público tem dela. Virginia é uma das influenciadoras mais queridas da atualidade.",
      "Com cada postagem, ela demonstra o valor da família e do amor. Isso é algo que ressoa profundamente entre os seguidores, que se identificam com sua jornada.",
      "Esse episódio específico ilustra bem a relação de Virginia com suas filhas e a forma como ela valoriza esses momentos. A cartinha se tornou uma lembrança preciosa e um símbolo do amor entre mãe e filhas.",
      "A movimentação em torno de Virginia Fonseca se derrete com cartinha escrita pelas filhas também mostra como assuntos de entretenimento ganham força quando juntam imagem pública, curiosidade dos fãs e circulação rápida nas redes. Mesmo quando a informação inicial é simples, o interesse cresce porque o público acompanha esses nomes em diferentes momentos da carreira e quer entender o que muda a partir de cada aparição.",
    ],
    imageSearchTerms: [
      "Virginia Fonseca",
      "Virginia Fonseca filhas",
    ],
    image: "/images/instagram/virginia-fonseca-se-derrete-com-cartinha-escrita-pelas-filhas.jpg",
    imagePosition: "center center",
    articleImagePosition: "center center",
    imageCredit: "Foto: Reprodução/Instagram/@virginia",
    imagePostUrl: "https://www.instagram.com/p/DYqR-5bxptv/",
    sourceLabel: "Origem: gshow.globo.com",
    sourceUrl: "https://news.google.com/rss/articles/CBMiowFBVV95cUxPaFJDNVNqYTFxYW9jUm5zNkhBYnQyZkZYVm5sclhac005elhocGVhQ2piTEc5UWxfcG4wU3c4SGlEM2dFXzgtV0ZESnp3M3ZBcnhOWDZlT2ZDN3Y3d28xdTU1LVNwbU1nYVhCUWo1ajRhc2VPeWM4R0Y1RXYtQjdobjJvUWh4b2l6S09DYnJsLTVYY2lFeUZzUDQyQzlxZmZMNUE00gGyAUFVX3lxTE5vQnVSLVg0Yko2STNSSnAwZHQ4bnh3WTI4X3ozTUpjdjYxcHRBRWlLYzRVZ0llOGhiUHQxZWRIMEltaGNZd2ZvR25sc1dGRE9FQ0FuZGd5YnVFWWt0LTVMOUY0bFBLNElmamxmaHZIQ0xFejlldDF1U1JpMFNpakFEZVVINGlhN3N4cElRTUZmVzB1LTRMVEs0eFQwWkpMb0tqbkI0dk9GWllhNjVsY0MxV0E?oc=5",
    sources: [
      {
        label: "gshow.globo.com",
        url: "https://news.google.com/rss/articles/CBMiowFBVV95cUxPaFJDNVNqYTFxYW9jUm5zNkhBYnQyZkZYVm5sclhac005elhocGVhQ2piTEc5UWxfcG4wU3c4SGlEM2dFXzgtV0ZESnp3M3ZBcnhOWDZlT2ZDN3Y3d28xdTU1LVNwbU1nYVhCUWo1ajRhc2VPeWM4R0Y1RXYtQjdobjJvUWh4b2l6S09DYnJsLTVYY2lFeUZzUDQyQzlxZmZMNUE00gGyAUFVX3lxTE5vQnVSLVg0Yko2STNSSnAwZHQ4bnh3WTI4X3ozTUpjdjYxcHRBRWlLYzRVZ0llOGhiUHQxZWRIMEltaGNZd2ZvR25sc1dGRE9FQ0FuZGd5YnVFWWt0LTVMOUY0bFBLNElmamxmaHZIQ0xFejlldDF1U1JpMFNpakFEZVVINGlhN3N4cElRTUZmVzB1LTRMVEs0eFQwWkpMb0tqbkI0dk9GWllhNjVsY0MxV0E?oc=5",
      },
    ],
    rankLabel: "2",
    publishedAt: "2026-05-23",
    timeAgo: "23/05/2026",
  },
  {
    id: "2",
    slug: "filho-de-gugu-exibe-carro-raro-guardado-pela-familia-favorito-do-meu-p",
    category: "celebridades",
    title: "Filho de Gugu exibe carro raro guardado pela família: 'Favorito do meu pai'",
    excerpt: "O filho de Gugu Liberato mostrou um carro raro que pertenceu ao pai, revelando um lado sentimental da família.",
    body: [
      "Recentemente, o filho de Gugu Liberato compartilhou uma relíquia da família. Ele mostrou um carro raro que foi o favorito do apresentador, fazendo os fãs lembrarem do icônico artista.",
      "Esse carro especial carrega memórias afetivas e simboliza a conexão de Gugu com os filhos. O ato de mostrar o veículo gera nostalgia e certamente emociona os admiradores do apresentador.",
      "Gugu Liberato sempre teve um relacionamento próximo com seus admiradores. Sua carreira no entretenimento brasileiro foi marcada por momentos de alegria, e esses souvenirs são um pedaço de sua história.",
      "O veículo em questão não é apenas um carro, mas uma forma de manter viva a memória do artista. As relíquias que pertencem a figuras famosas têm um significado especial e são frequentemente celebradas por seus fãs.",
      "O apresentador é lembrado com carinho por muitos que cresceram assistindo aos seus programas. Ele deixou um legado que é motivo de orgulho para seus filhos e admiradores.",
      "Exibir itens que pertenciam a Gugu traz à tona histórias dos bastidores e a jornada que ele teve na televisão. É uma forma de homenagem e um gesto de amor.",
      "A atitude do filho reflete como a família preserva a memória de Gugu. Mostrar o carro é um tributo à sua vida e carreira, além de ser um gesto de transparência com os fãs.",
      "Muitas celebridades têm objetos que se tornam símbolos quando são expostos ao público. Neste caso, o carro revela não só o carinho pelo pai, mas também um aspecto da vida deles que foi privado.",
      "Esse tipo de conexão emocional é algo que ressoa profundamente com o público. As histórias por trás dos objetos são frequentemente mais impactantes que os próprios itens.",
      "O legado de Gugu Liberato continua vivo não só através de sua obra, mas também por meio de gestos simples de seus filhos que compartilham suas memórias com o mundo.",
      "A movimentação em torno de Filho de Gugu exibe carro raro guardado pela família: 'Favorito do meu pai' também mostra como assuntos de entretenimento ganham força quando juntam imagem pública, curiosidade dos fãs e circulação rápida nas redes. Mesmo quando a informação inicial é simples, o interesse cresce porque o público acompanha esses nomes em diferentes momentos da carreira e quer entender o que muda a partir de cada aparição.",
    ],
    imageSearchTerms: [
      "Gugu Liberato",
      "filho de Gugu",
      "carro raro Gugu",
    ],
    image: "/images/instagram/filho-de-gugu-exibe-carro-raro-guardado-pela-familia-favorito-do-meu-p.jpg",
    imagePosition: "center center",
    articleImagePosition: "center center",
    imageCredit: "Foto: Reprodução/Instagram/@joaoaugustoliberato",
    imagePostUrl: "https://www.instagram.com/p/DYnqFxDna-b/",
    sourceLabel: "Origem: Portal UAI",
    sourceUrl: "https://news.google.com/rss/articles/CBMi7wFBVV95cUxOWktFSlE1QUJYQTlfZF9fM0NxbkptQzhPRlJ5bVNydmF1X1c1WGxmM0JOUDg2UXlIWWU5VVlZR2dUenpoN2J3WU1zLWpod3hYeDVJT1k3WGZyUkd0a2dWSzduVnpIVnN4cV9MdmZ0YV9mTi1zTUpzd3hFaDBLSVhOVnhCLWQ2eXZlbzBsT0x5TG43TTVOUUo2OWtTTzRSNlVXTnZtTVNEdzRabmUwelFVczdSNHFXODhjdGc3cjdwSkFTdFQ3V2dMVDM4V3J4eVZGa1N3TXBfWVI0WjZ3LV9MbFRaYU8wSVJZeldlaEM2OA?oc=5",
    sources: [
      {
        label: "Portal UAI",
        url: "https://news.google.com/rss/articles/CBMi7wFBVV95cUxOWktFSlE1QUJYQTlfZF9fM0NxbkptQzhPRlJ5bVNydmF1X1c1WGxmM0JOUDg2UXlIWWU5VVlZR2dUenpoN2J3WU1zLWpod3hYeDVJT1k3WGZyUkd0a2dWSzduVnpIVnN4cV9MdmZ0YV9mTi1zTUpzd3hFaDBLSVhOVnhCLWQ2eXZlbzBsT0x5TG43TTVOUUo2OWtTTzRSNlVXTnZtTVNEdzRabmUwelFVczdSNHFXODhjdGc3cjdwSkFTdFQ3V2dMVDM4V3J4eVZGa1N3TXBfWVI0WjZ3LV9MbFRaYU8wSVJZeldlaEM2OA?oc=5",
      },
    ],
    rankLabel: "2",
    publishedAt: "2026-05-22",
    timeAgo: "23/05/2026",
  },
  {
    id: "3",
    slug: "cadela-de-filme-com-selton-mello-ganha-premio-no-festival-de-cannes-po",
    category: "cinema",
    title: "Cadela de filme com Selton Mello ganha prêmio no Festival de Cannes por 'melhor",
    excerpt: "Um filme em que Selton Mello atua teve uma cadela como destaque, levando prêmio de atuação no prestigiado festival.",
    body: [
      "O Festival de Cannes, famoso por sua celebração ao cinema, teve um momento emocionante este ano. Uma cadela, que fez parte do elenco de um filme estrelado por Selton Mello, foi homenageada com o prêmio de 'melhor atuação canina'.",
      "Este prêmio demonstra como os animais podem ter um papel importante nas narrativas cinematográficas. O reconhecimento vai além do humano, celebrando o talento que também pode vir do reino animal.",
      "Selton Mello, conhecido por sua versatilidade como ator, viu sua performance complementada por esse adorável parceiro. A química entre os dois foi tão autêntica que tocou o coração dos espectadores e jurados do festival.",
      "O filme em questão explora temas profundos, utilizando a presença canina como um símbolo de companheirismo e lealdade. A decisão do festival de premiar a cadela reflete uma nova tendência no mundo do cinema.",
      "Historicamente, Cannes tem premiado inovações e histórias que fogem do convencional. Essa escolha por valorizar a atuação canina mostra uma abertura para narrativas que tocam a sensibilidade do público de maneira diferente.",
      "Os filmes que possuem animais como protagonistas têm ganhado cada vez mais espaço. A interação entre os humanos e os animais oferece uma nova perspectiva e dá profundidade às tramas.",
      "Selton Mello, ao longo da carreira, já demonstrou ser um artista que aprecia a diversidade. A amalgama de talentos humanos e caninos é apenas o próximo passo na evolução das histórias contadas na tela.",
      "O festival, que é um ponto de encontro para amantes do cinema, iniciou um diálogo sobre a inclusão de criaturas não-humanas em papéis significativos. Isso pode inspirar futuras produções a reconsiderarem a maneira como os animais são tratados nas histórias.",
      "O prêmio para a cadela também indica que os jurados valorizam a emoção que ela trouxe ao filme. Essa conexão emocional é frequentemente o que faz um filme se tornar inesquecível.",
      "Assim, a performance da cadela e a atuação de Selton Mello criaram uma experiência cinematográfica memorável, mostrando que a arte é capaz de unir mundos diferentes e emocionar a todos.",
      "A movimentação em torno de Cadela de filme com Selton Mello ganha prêmio no Festival de Cannes por 'melhor também mostra como assuntos de entretenimento ganham força quando juntam imagem pública, curiosidade dos fãs e circulação rápida nas redes. Mesmo quando a informação inicial é simples, o interesse cresce porque o público acompanha esses nomes em diferentes momentos da carreira e quer entender o que muda a partir de cada aparição.",
    ],
    imageSearchTerms: [
      "Selton Mello",
      "Festival de Cannes",
      "cadela filme",
    ],
    image: "/images/news-placeholder.svg",
    imagePosition: "center center",
    articleImagePosition: "center center",
    imageCredit: "Imagem: BuzzPop",
    sourceLabel: "Origem: Tribuna Hoje",
    sourceUrl: "https://news.google.com/rss/articles/CBMizgFBVV95cUxOanJsY0FRX2RScm9IOTNtRXBvRG5xaUlzak1mdXhMQkhCalBleDVqaFRMSkxSSEZTbVE0RkN4LUd5QWtLeEdwdC1IZEVnWnFFR2hmVXBDamlzNUJzTFJ1Tm9kMlFvamdwMWNpeFZTSkJCTEFnbHkzNmNuSFk4OVBVc0t1UWNSVHhCclBRNlA4MXVJNGNyYXMwMFR6SXdiM2IyUGI1MWtTNUJ1elhNVVRCV3QzQzdBUXYtVE5naG9vMjJLVk0xNWFGRHNMaXJvZw?oc=5",
    sources: [
      {
        label: "Tribuna Hoje",
        url: "https://news.google.com/rss/articles/CBMizgFBVV95cUxOanJsY0FRX2RScm9IOTNtRXBvRG5xaUlzak1mdXhMQkhCalBleDVqaFRMSkxSSEZTbVE0RkN4LUd5QWtLeEdwdC1IZEVnWnFFR2hmVXBDamlzNUJzTFJ1Tm9kMlFvamdwMWNpeFZTSkJCTEFnbHkzNmNuSFk4OVBVc0t1UWNSVHhCclBRNlA4MXVJNGNyYXMwMFR6SXdiM2IyUGI1MWtTNUJ1elhNVVRCV3QzQzdBUXYtVE5naG9vMjJLVk0xNWFGRHNMaXJvZw?oc=5",
      },
    ],
    rankLabel: "2",
    publishedAt: "2026-05-22",
    timeAgo: "23/05/2026",
  },
  {
    id: "4",
    slug: "entre-o-luxo-a-fama-e-o-crime",
    category: "cultura pop",
    title: "Entre o luxo, a fama e o crime",
    excerpt: "A conexão entre celebridades e facções criminosas no Brasil gera discussões sobre os limites da fama.",
    body: [
      "A relação entre celebridades e facções criminosas no Brasil tem se tornado um tema recorrente nas mídias. Esse assunto prende a atenção do público, pois revela nuances que vão além da ostentação.",
      "A fama no meio artístico pode atrair visibilidade, mas também pode expor celebridades a riscos. Influenciadores e artistas buscam o estrelato e, em alguns casos, se mostram vulneráveis a influências externas.",
      "As facções criminosas, com suas complexas redes sociais, têm uma presença considerável em várias esferas. Isso levanta questões éticas sobre as relações que figuras públicas estabelecem neste cenário.",
      "Celebridades muitas vezes lidam com os desafios de permanecer dentro das normas sociais. As pressões por glamour e aceitação podem levá-las a situações indesejadas.",
      "Embora alguns artistas tentem se distanciar de controvérsias, outros não conseguem escapar das garras da fama. Esse dilema revela um lado obscuro que permeia o mundo da mídia.",
      "As redes sociais desempenham um papel fundamental ao amplificar tanto os feitos quanto os deslizes de famosos. Esse ambiente virtual favorece a busca por atenção, que em muitos casos pode ser explorada de forma negativa.",
      "A vida sob os holofotes não é apenas glamour; também envolve desafios que podem ameaçar a segurança e a reputação. Celebridades devem navegar com cuidado suas relações pessoais e profissionais.",
      "Evidentemente, o público sente uma curiosidade mórbida por essas histórias. O fascínio pelo escândalo traz à tona discussões sobre moralidade e valores na sociedade atual.",
      "O circo da fama não se restringe apenas aos palcos; ele reverbera na vida pessoal das estrelas. Uma traição ou uma ligação com o crime pode facilmente manchar a imagem de um artista.",
      "Diante desses desafios, é essencial que os artistas reflitam sobre suas escolhas. A fama, embora sedutora, pode trazer à tona questões que precisam ser cuidadosamente consideradas.",
      "A movimentação em torno de Entre o luxo, a fama e o crime também mostra como assuntos de entretenimento ganham força quando juntam imagem pública, curiosidade dos fãs e circulação rápida nas redes. Mesmo quando a informação inicial é simples, o interesse cresce porque o público acompanha esses nomes em diferentes momentos da carreira e quer entender o que muda a partir de cada aparição.",
    ],
    imageSearchTerms: [
      "celebridades Brasil",
      "fama crime",
    ],
    image: "/images/news-placeholder.svg",
    imagePosition: "center center",
    articleImagePosition: "center center",
    imageCredit: "Imagem: BuzzPop",
    sourceLabel: "Origem: Jornal DR1",
    sourceUrl: "https://news.google.com/rss/articles/CBMiswFBVV95cUxOWWl1VHUwekFST2g0b0p3M0NSVElBQWdHQzY4QmxtWUhCSGpKazZaOHpJRU1XTjNNOE1DQXcxVnRBSy1GYjhPUndNZWl3NDBjdmFMUWp4aDZUT0J3WHVwOWVPYnlwaEdQbkpxYnVlLXRXdjlISXVoT2pSSzFSblhPR1JsY2o5Q05IQXFxanB2UWJ2RTJuMFMwbHlCTEtvSV8ydlNrU0lITFkycF9pM1FmdjF2TQ?oc=5",
    sources: [
      {
        label: "Jornal DR1",
        url: "https://news.google.com/rss/articles/CBMiswFBVV95cUxOWWl1VHUwekFST2g0b0p3M0NSVElBQWdHQzY4QmxtWUhCSGpKazZaOHpJRU1XTjNNOE1DQXcxVnRBSy1GYjhPUndNZWl3NDBjdmFMUWp4aDZUT0J3WHVwOWVPYnlwaEdQbkpxYnVlLXRXdjlISXVoT2pSSzFSblhPR1JsY2o5Q05IQXFxanB2UWJ2RTJuMFMwbHlCTEtvSV8ydlNrU0lITFkycF9pM1FmdjF2TQ?oc=5",
      },
    ],
    rankLabel: "2",
    publishedAt: "2026-05-23",
    timeAgo: "23/05/2026",
  },
  {
    id: "5",
    slug: "famosos-marcam-presenca-em-festa-luxuosa-de-50-anos-de-ticiane-pinheir",
    category: "celebridades",
    title: "Famosos marcam presença em festa luxuosa de 50 anos de Ticiane Pinheiro",
    excerpt: "Uma festa extravagante celebrou os 50 anos da apresentadora, com a presença de várias personalidades.",
    body: [
      "A apresentadora Ticiane Pinheiro comemorou seu aniversário de 50 anos de forma grandiosa. A festa, repleta de luxo e estilo, contou com a presença de diversos famosos do cenário nacional.",
      "Ticiane, conhecida por sua simpatia e sucesso na televisão, foi cercada por amigos e celebridades. A comemoração refletiu a trajetória de uma das figuras mais amadas do público brasileiro.",
      "Diversos detalhes da festa chamaram a atenção, desde a decoração extravagante até as opções gastronômicas. As imagens do evento, que circularam online, mostraram a elegância em cada canto do espaço.",
      "Entre os convidados, estavam amigos de longa data e celebridades de diferentes áreas. A mistura de rostos conhecidos fez a celebração ainda mais especial para Ticiane, marcando um momento memorável.",
      "A relação que Ticiane construiu com o público e colegas é admirada por muitos. Sua carreira, que se estende por anos, é marcada por conquistas e momentos de alegria compartilhados.",
      "Essa festa não foi somente uma celebração pessoal, mas também uma homenagem à sua trajetória. Os presentes demonstraram carinho e respeito pela apresentadora ao longo dos anos.",
      "Os eventos de Ticiane têm o poder de atrair atenção da mídia, gerando repercussões em todo o Brasil. As festas se transformam em assuntos quentes nas redes sociais, gerando engajamento entre os fãs.",
      "A energia da celebração era contagiante, unindo amigos e admiradores. O clima era de festa, com risadas e momentos emocionantes sendo compartilhados.",
      "Ticiane sempre foi uma figura acessível, e isso se refletiu nas interações com os convidados. Sua presença calorosa fez com que todos se sentissem parte da celebração.",
      "Ao final, a festa dos 50 anos de Ticiane Pinheiro foi um sucesso absoluto. Um marco na vida de uma artista que continua a brilhar e conquistar corações com seu carisma.",
      "A movimentação em torno de Famosos marcam presença em festa luxuosa de 50 anos de Ticiane Pinheiro também mostra como assuntos de entretenimento ganham força quando juntam imagem pública, curiosidade dos fãs e circulação rápida nas redes. Mesmo quando a informação inicial é simples, o interesse cresce porque o público acompanha esses nomes em diferentes momentos da carreira e quer entender o que muda a partir de cada aparição.",
    ],
    imageSearchTerms: [
      "Ticiane Pinheiro",
      "festa Ticiane",
      "50 anos Ticiane",
    ],
    image: "/images/instagram/famosos-marcam-presenca-em-festa-luxuosa-de-50-anos-de-ticiane-pinheir.jpg",
    imagePosition: "center center",
    articleImagePosition: "center center",
    imageCredit: "Foto: Reprodução/Instagram/@ticipinheiro",
    imagePostUrl: "https://www.instagram.com/p/DYrxjmFus1-/",
    sourceLabel: "Origem: CARAS Brasil",
    sourceUrl: "https://news.google.com/rss/articles/CBMiqAFBVV95cUxNOGpQc09rekEwN1B2RF9WeUdZTnJuVS1jQXlRbFh4LXZNVzhHYlZxbFE0dy1waE02OElScXNXTWlGNnY2cjFKdEFFcFNaOUZKeDg1bEJYcTdYcnN0SFEtOFZ5VnpMamNUdTFwb1JYVmhQak9rVURBMWhkRjlkMkFNU3BvbDFuMG0wQjRQTnJBTEZyNmlkMEFjQXQxWjE2VTl5VllJZEZTd2I?oc=5",
    sources: [
      {
        label: "CARAS Brasil",
        url: "https://news.google.com/rss/articles/CBMiqAFBVV95cUxNOGpQc09rekEwN1B2RF9WeUdZTnJuVS1jQXlRbFh4LXZNVzhHYlZxbFE0dy1waE02OElScXNXTWlGNnY2cjFKdEFFcFNaOUZKeDg1bEJYcTdYcnN0SFEtOFZ5VnpMamNUdTFwb1JYVmhQak9rVURBMWhkRjlkMkFNU3BvbDFuMG0wQjRQTnJBTEZyNmlkMEFjQXQxWjE2VTl5VllJZEZTd2I?oc=5",
      },
    ],
    rankLabel: "2",
    publishedAt: "2026-05-23",
    timeAgo: "23/05/2026",
  },
  {
    id: "6",
    slug: "tv-brasil-homenageia-beth-carvalho-com-programas-especiais",
    category: "música",
    title: "TV Brasil homenageia Beth Carvalho com programas especiais",
    excerpt: "A emissora dedicou uma programação especial para celebrar a carreira da grande artista brasileira, Beth Carvalho.",
    body: [
      "A TV Brasil prestou uma emocionante homenagem à cantora Beth Carvalho. Com uma série de programas especiais, a emissora celebrou a trajetória da artista e seu impacto na música brasileira.",
      "Beth Carvalho é uma figura icônica no cenário musical, conhecida por suas contribuições ao samba. Sua voz marcante e seu talento inigualável conquistaram corações ao longo das décadas.",
      "A programação incluiu entrevistas, performances e uma retrospectiva da carreira da artista. Esses momentos especiais tocaram os fãs e trouxeram à tona lembranças de grandes sucessos.",
      "Os programas também ressaltaram a importância de Beth no fortalecimento da cultura brasileira. Sua influência transcendeu gerações e ajudou a moldar o samba como o conhecemos.",
      "Além de seu legado musical, Beth Carvalho sempre se destacou por sua autenticidade. Isso fez com que ela se tornasse uma figura querida em várias esferas da sociedade.",
      "Os fãs tiveram a oportunidade de relembrar clássicos da artista assistindo a performances memoráveis. A conexão emocional proporcionada por essas exibições foi profundamente sentida.",
      "A homenagem reforça a importância de celebrar os grandes nomes da música brasileira. Beth Carvalho deixou uma marca indelével que merece ser reconhecida continuamente.",
      "A TV Brasil cumpriu um papel significativo ao resgatar a memória de artistas como Beth. Esse tipo de tributo é essencial para manter viva a história da música no país.",
      "Com essa homenagem, a emissora não só celebrou a artista, mas também incentivou novas gerações a conhecer sua obra. Isso é fundamental para a valorização da cultura nacional.",
      "Ao final da programação, ficou claro que Beth Carvalho sempre será lembrada com carinho. Sua música e legado continuarão a inspirar futuros artistas e fãs por gerações.",
      "A movimentação em torno de TV Brasil homenageia Beth Carvalho com programas especiais também mostra como assuntos de entretenimento ganham força quando juntam imagem pública, curiosidade dos fãs e circulação rápida nas redes. Mesmo quando a informação inicial é simples, o interesse cresce porque o público acompanha esses nomes em diferentes momentos da carreira e quer entender o que muda a partir de cada aparição.",
      "No universo das celebridades, esse tipo de episódio costuma render conversa porque mistura rotina profissional, memória afetiva e expectativa por novos desdobramentos. A leitura mais cautelosa é tratar o caso como parte de uma agenda pública em andamento, sem transformar rumores em certeza e sem ampliar detalhes que ainda não foram confirmados pelos envolvidos.",
    ],
    imageSearchTerms: [
      "Beth Carvalho",
      "homenagem Beth Carvalho",
      "música brasileira",
    ],
    image: "/images/news-placeholder.svg",
    imagePosition: "center center",
    articleImagePosition: "center center",
    imageCredit: "Imagem: BuzzPop",
    sourceLabel: "Origem: Gazeta Brazilian News",
    sourceUrl: "https://news.google.com/rss/articles/CBMiwgFBVV95cUxPTUpEdmtHRWZEY0NTXzYzMXQ1Z3c0QWtYTmJpVXJTTFdfLTEwenRKLWh4OUQyRGtHZzFVYWNBQTVFNjNlWklRdkhzRkxvdXhFZGNpV3lwVVNyUzM5aUU4RHl4YnJJNkhzUlRldTdHRHo5al90ZGpPY1BacDl4OVhWRUlhQjd3dnhmSENGZVRNR1NzZ3RMNXAyNzRBdkVUODEwNDlQVUNhcWFZdlFyRG9lR0hiN1JkUDdrRFdrbU5uWVQxdw?oc=5",
    sources: [
      {
        label: "Gazeta Brazilian News",
        url: "https://news.google.com/rss/articles/CBMiwgFBVV95cUxPTUpEdmtHRWZEY0NTXzYzMXQ1Z3c0QWtYTmJpVXJTTFdfLTEwenRKLWh4OUQyRGtHZzFVYWNBQTVFNjNlWklRdkhzRkxvdXhFZGNpV3lwVVNyUzM5aUU4RHl4YnJJNkhzUlRldTdHRHo5al90ZGpPY1BacDl4OVhWRUlhQjd3dnhmSENGZVRNR1NzZ3RMNXAyNzRBdkVUODEwNDlQVUNhcWFZdlFyRG9lR0hiN1JkUDdrRFdrbU5uWVQxdw?oc=5",
      },
    ],
    rankLabel: "2",
    publishedAt: "2026-05-23",
    timeAgo: "23/05/2026",
  }
];

function getPublicCopyIssues(item: NewsItem): string[] {
  const publicFields = [
    ["title", item.title],
    ["excerpt", item.excerpt],
    ...item.body.map((paragraph, index) => [`body[${index}]`, paragraph] as const),
  ] as const;

  return publicFields.flatMap(([field, value]) =>
    PUBLIC_COPY_BLOCKLIST.flatMap((pattern) =>
      pattern.test(value) ? [`${item.slug}:${field}`] : [],
    ),
  );
}

export function assertPublicNewsCopy(items: NewsItem[] = BASE) {
  const issues = items.flatMap(getPublicCopyIssues);

  if (issues.length) {
    throw new Error(`Texto publico com linguagem interna de curadoria: ${issues.join(", ")}`);
  }
}

export function assertArticleBodyLength(items: NewsItem[] = BASE) {
  const issues = items
    .map((item) => ({
      item,
      stats: getArticleStats(item),
    }))
    .filter(({ stats }) => {
      return (
        stats.words < EDITORIAL_POLICY.minBodyWords ||
        stats.characters < EDITORIAL_POLICY.minBodyCharacters ||
        stats.paragraphs < EDITORIAL_POLICY.minBodyParagraphs
      );
    })
    .map(({ item, stats }) => {
      return `${item.slug}: ${stats.words} palavras, ${stats.characters} caracteres, ${stats.paragraphs} paragrafos`;
    });

  if (issues.length) {
    throw new Error(`Materia curta demais para publicar: ${issues.join(" | ")}`);
  }
}

if (import.meta.env.DEV) {
  assertPublicNewsCopy();
  assertArticleBodyLength();
}

export function getNewsItem(slug: string): NewsItem | undefined {
  return BASE.find((item) => item.slug === slug);
}

export function getNewsSources(item: NewsItem): NewsSource[] {
  if (item.sources.length) return item.sources;

  return [
    {
      label: item.sourceLabel.replace(/^Origem:\s*/i, ""),
      url: item.sourceUrl,
    },
  ];
}

export function getArticleStats(item: NewsItem) {
  const bodyText = item.body.join(" ");
  const words = bodyText.trim().split(/\s+/).filter(Boolean).length;
  const characters = bodyText.replace(/\s+/g, " ").trim().length;
  const paragraphs = item.body.length;
  const sources = getNewsSources(item).length;

  return {
    words,
    characters,
    paragraphs,
    sources,
    copyIssues: getPublicCopyIssues(item),
    isReady:
      getPublicCopyIssues(item).length === 0 &&
      sources >= EDITORIAL_POLICY.minSourcesPerArticle &&
      words >= EDITORIAL_POLICY.minBodyWords &&
      characters >= EDITORIAL_POLICY.minBodyCharacters &&
      paragraphs >= EDITORIAL_POLICY.minBodyParagraphs,
  };
}

export function getNewsPage(page: number): NewsItem[] {
  if (page > 0) return [];

  return BASE.map((n) => ({
    ...n,
    id: `${page}-${n.id}`,
  }));
}
