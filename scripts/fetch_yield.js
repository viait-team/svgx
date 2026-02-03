const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
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

(async () => {
  try {
    const target = 'https://tradingeconomics.com/united-states/government-bond-yield';
    const html = await fetchPage(target);
    const parsed = parse10yFromHtml(html);
    if (!parsed) throw new Error('Could not parse 10Y');
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
