#!/usr/bin/env node
// scripts/process_trends.js
// Parse Google Trends CSV export and cross-check against configured news sources via Google News RSS.
// Usage:
//   node scripts/process_trends.js /path/to/trends.csv --fetch --out data/trends-processed.json

const fs = require('fs');
const https = require('https');
const { URL } = require('url');

function parseCSV(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  // Heuristic: assume first column contains the search term
  const rows = lines.map(l => l.split(/,|;|\t/).map(c => c.trim()));
  // If header contains 'term' or 'query', drop it
  const header = rows[0].map(h => h.toLowerCase());
  let dataRows = rows;
  if (header.some(h => /term|query|search/.test(h))) dataRows = rows.slice(1);
  return dataRows.map(r => r[0]).filter(Boolean);
}

function buildGoogleNewsRSSUrl(term) {
  const q = encodeURIComponent(term);
  return `https://news.google.com/rss/search?q=${q}&hl=pt-BR&gl=BR&ceid=BR:pt-BR`;
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'node.js' } }, res => {
      let body = '';
      res.on('data', d => (body += d.toString()));
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

function parseRssItems(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml))) {
    const itemXml = m[1];
    const titleM = itemXml.match(/<title>([\s\S]*?)<\/title>/i);
    const linkM = itemXml.match(/<link>([\s\S]*?)<\/link>/i);
    const dateM = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const sourceM = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    const title = titleM ? titleM[1].trim() : '';
    const link = linkM ? linkM[1].trim() : '';
    const pubDate = dateM ? dateM[1].trim() : '';
    const source = sourceM ? sourceM[1].trim() : '';
    items.push({ title, link, pubDate, source });
  }
  return items;
}

function hostnameOf(link) {
  try { return new URL(link).hostname.replace(/^www\./, ''); } catch(e) { return ''; }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error('Usage: node scripts/process_trends.js /path/to/trends.csv [--fetch] [--out out.json]');
    process.exit(2);
  }
  const csvPath = argv[0];
  const fetchFlag = argv.includes('--fetch');
  const outIndex = argv.indexOf('--out');
  const outPath = outIndex !== -1 && argv[outIndex+1] ? argv[outIndex+1] : `data/trends-processed-${Date.now()}.json`;

  if (!fs.existsSync(csvPath)) { console.error('CSV not found:', csvPath); process.exit(2); }

  const terms = parseCSV(csvPath);
  if (terms.length === 0) { console.error('No terms found in CSV'); process.exit(1); }

  // Configure preferred sources (hosts or unique substrings)
  const preferredSources = [
    'g1.globo.com',
    'cnnbrasil.com.br',
    'exame.com',
    'r7.com',
    'portalcorreio.com.br',
    'veja.abril.com.br',
    'papelpop.com.br',
    'gettyimages.com',
    'agencias',
  ];

  const result = { generatedAt: new Date().toISOString(), terms: [] };

  for (const term of terms) {
    const entry = { term, matched: [], articles: [] };

    if (fetchFlag) {
      try {
        const rssUrl = buildGoogleNewsRSSUrl(term);
        const xml = await fetchUrl(rssUrl);
        const items = parseRssItems(xml);
        for (const it of items) {
          const host = hostnameOf(it.link);
          entry.articles.push({ title: it.title, link: it.link, pubDate: it.pubDate, source: it.source || host });
          for (const s of preferredSources) {
            if (host.includes(s) || (it.source && it.source.toLowerCase().includes(s.replace(/\./g, '')))) {
              if (!entry.matched.includes(s)) entry.matched.push(s);
            }
          }
        }
      } catch (err) {
        console.error('Fetch error for term', term, err.message || err);
      }
    } else {
      // If not fetching, just emit the constructed RSS URL so user can export and inspect manually
      entry.rss = buildGoogleNewsRSSUrl(term);
    }

    entry.matchedCount = entry.matched.length;
    entry.priority = entry.matchedCount >= 2 ? 'high' : (entry.matchedCount === 1 ? 'medium' : 'low');
    result.terms.push(entry);
  }

  // Ensure out dir exists
  const outDir = require('path').dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log('Wrote report to', outPath);
  console.log('Summary:');
  for (const t of result.terms) {
    console.log('-', t.term, `(${t.priority}, matches: ${t.matchedCount})`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
