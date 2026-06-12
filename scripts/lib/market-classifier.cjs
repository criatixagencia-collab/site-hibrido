function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripSourcesHtml(value = "") {
  return String(value).replace(/<p[^>]*class=["'][^"']*article-sources[^"']*["'][\s\S]*?<\/p>/gi, " ");
}

function textForMarket(item = {}) {
  return normalize(
    [
      item.title,
      item.originalTitle,
      item.excerpt,
      item.summary,
      item.category,
      Array.isArray(item.tags) ? item.tags.join(" ") : "",
      Array.isArray(item.body) ? item.body.join(" ") : "",
      stripSourcesHtml(item.html || ""),
      item.editorialMeta?.originalTitle,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function hasTerm(text, term) {
  return ` ${text} `.includes(` ${normalize(term)} `);
}

function hasAny(text, terms) {
  return terms.some((term) => hasTerm(text, term));
}

const STRONG_BRAZIL_MARKET_TERMS = [
  "sao paulo",
  "sp",
  "rio de janeiro",
  "rio",
  "ceara",
  "sobral",
  "bahia",
  "salvador",
  "minas gerais",
  "belo horizonte",
  "pernambuco",
  "recife",
  "parana",
  "curitiba",
  "rio grande do sul",
  "porto alegre",
  "brasilia",
  "goias",
  "goiania",
  "festa junina",
  "quadrilha junina",
  "novela",
  "bbb",
  "a fazenda",
  "globoplay",
  "carlos alberto de nobrega",
  "bruna furlan",
  "gabriely miranda",
  "endrick",
  "igor cosso",
  "heron leal",
  "fabio giga",
  "bitelo",
  "carolina dieckmann",
  "mc gui",
  "mc guime",
  "casa do patrao",
  "virginia",
  "leonardo",
  "datena",
  "xuxa",
  "anitta",
  "iza",
  "boninho",
  "faustao",
  "tati machado",
  "graciele",
  "graciele lacerda",
  "zeze di camargo",
  "ivete sangalo",
  "paula fernandes",
  "lucas lima",
  "nina forlin",
  "viih tube",
  "eliezer",
  "ana maria braga",
  "gil do vigor",
  "poliana",
  "lele lopes",
  "leandro amar",
  "bruno monteiro",
  "mais voce",
  "encontro com fatima bernardes",
  "copa do mundo",
  "selecao brasileira",
];

const WEAK_BRAZIL_MARKET_TERMS = ["brasil", "brasileiro", "brasileira"];

const INTERNATIONAL_MARKET_TERMS = [
  "internacional",
  "estados unidos",
  "eua",
  "hollywood",
  "los angeles",
  "nova york",
  "londres",
  "paris",
  "italia",
  "italiano",
  "italiana",
  "monaco",
  "china",
  "chines",
  "chinesa",
  "coreia",
  "japao",
  "doramas",
  "netflix coreia",
  "dua lipa",
  "callum turner",
  "jennifer lopez",
  "j lo",
  "kim kardashian",
  "lewis hamilton",
  "clint eastwood",
  "taylor swift",
  "beyonce",
  "lady gaga",
  "madonna",
  "rihanna",
  "selena gomez",
  "justin bieber",
  "kanye west",
  "brad pitt",
  "angelina jolie",
  "tom cruise",
  "super mario",
  "mario galaxy",
  "nintendo",
  "michael jackson",
  "backrooms",
  "todo mundo em panico",
  "irmaos wayans",
  "marlon wayans",
  "a24",
  "familia real britanica",
  "rainha elizabeth",
  "principe andrew",
  "jin ze",
  "he man",
  "she ra",
  "mestres do universo",
  "marvel",
  "dc comics",
  "oscar",
  "grammy",
  "jared leto",
  "nicholas galitzine",
];

function classifyMarket(item = {}) {
  const text = textForMarket(item);
  if (hasAny(text, STRONG_BRAZIL_MARKET_TERMS)) return "brasil";
  if (hasAny(text, INTERNATIONAL_MARKET_TERMS)) return "internacional";
  if (hasAny(text, WEAK_BRAZIL_MARKET_TERMS)) return "brasil";
  return "brasil";
}

function maxInternationalFor(total) {
  return 1;
}

function marketCounts(items = []) {
  return items.reduce(
    (counts, item) => {
      const market = classifyMarket(item);
      counts[market] = (counts[market] || 0) + 1;
      return counts;
    },
    { brasil: 0, internacional: 0 },
  );
}

module.exports = {
  classifyMarket,
  marketCounts,
  maxInternationalFor,
};
