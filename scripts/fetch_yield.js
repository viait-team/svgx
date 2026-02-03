const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

async function fetchPageWithFallback(targetUrl) {
  const proxies = [
    '', // Try direct first
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url='
  ];

  let lastError = null;

  for (const proxy of proxies) {
    try {
      const url = proxy 
        ? (proxy.includes('url=') ? proxy + encodeURIComponent(targetUrl) : proxy + targetUrl)
        : targetUrl;
      
      console.log(`Fetching via: ${proxy || 'Direct'}...`);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36' },
        timeout: 15000
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      console.warn(`Failed via ${proxy || 'Direct'}: ${err.message}`);
      lastError = err;
    }
  }
  throw lastError || new Error('All fetch attempts failed');
}

function parse10yFromHtml(html) {
  const $ = cheerio.load(html);
  let row = $('tr[data-symbol="USGG10YR:IND"]');
  if (!row || row.length === 0) {
    // fallback: find a row that looks like 10Y
    const rows = $('table tr').toArray();
    for (const r of rows) {
      const text = $(r).text();
      if (/10\s*Y|10Y|10-yr|10yr|10 Year|USGG10YR/i.test(text)) {
        row = $(r);
        break;
      }
    }
  }
  if (!row || row.length === 0) return null;
  const tds = row.find('td');
  const yieldRaw = $(tds[1]).text().trim();
  let dayChangeText = $(tds[3]).text().trim();
  const timeText = tds.length >= 7 ? $(tds[6]).text().trim() : new Date().toLocaleTimeString();
  const yieldValue = parseFloat(yieldRaw.replace('%',''));
  dayChangeText = dayChangeText.replace('%', '');
  const dayChangeValue = parseFloat(dayChangeText) || 0;
  if (Number.isNaN(yieldValue)) return null;
  return {
    yieldValue,
    dayChangeValue,
    tooltip: `US 10Y Yield: ${yieldRaw}\nChange: ${dayChangeText}%\nTime: ${timeText}`
  };
}

function parseCNBCFromHtml(html) {
  const $ = cheerio.load(html);
  // CNBC selectors
  const yieldRaw = $('.QuoteStrip-lastPrice').first().text().trim().replace('%', '');
  const changeRaw = $('.QuoteStrip-changeDown, .QuoteStrip-changeUp').first().text().trim();
  
  if (!yieldRaw) return null;

  const yieldValue = parseFloat(yieldRaw);
  const dayChangeValue = parseFloat(changeRaw) || 0;

  if (Number.isNaN(yieldValue)) return null;

  return {
    yieldValue,
    dayChangeValue,
    tooltip: `US 10Y Yield: ${yieldRaw}%\nChange: ${changeRaw}\nTime: ${new Date().toLocaleTimeString()}`
  };
}

(async () => {
  try {
    // 1. Try TradingEconomics
    const target = 'https://tradingeconomics.com/united-states/government-bond-yield';
    let parsed = null;
    
    try {
      const html = await fetchPageWithFallback(target);
      parsed = parse10yFromHtml(html);
    } catch (e) {
      console.warn('TradingEconomics failed, trying CNBC...');
      const cnbcHtml = await fetchPageWithFallback('https://www.cnbc.com/quotes/US10Y');
      parsed = parseCNBCFromHtml(cnbcHtml);
    }

    if (!parsed) throw new Error('Could not parse 10Y yield from any source');

    const outDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'yield.json');
    fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2), 'utf8');
    console.log('Wrote', outPath);
    process.exit(0);
  } catch (err) {
    console.error(err && err.message ? err.message : String(err));
    process.exit(2);
  }
})();
