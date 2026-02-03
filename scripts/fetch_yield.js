const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

async function run() {
  try {
    // TradingEconomics blocks GitHub Actions (HTTP 403).
    // Switching to CNBC which is more reliable for automation.
    const targetUrl = 'https://www.cnbc.com/quotes/US10Y';
    console.log(`Fetching ${targetUrl}...`);

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    };

    const res = await fetch(targetUrl, { headers, timeout: 15000 });
    
    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // CNBC: Try meta tags first (structured data is more stable)
    // <meta itemprop="price" content="4.234" />
    let yieldRaw = $('meta[itemprop="price"]').attr('content');
    let changeRaw = $('meta[itemprop="priceChange"]').attr('content');

    // Fallback: Try visual elements if meta tags are missing
    if (!yieldRaw) {
        yieldRaw = $('.QuoteStrip-lastPrice').first().text().trim();
        changeRaw = $('.QuoteStrip-changeDown, .QuoteStrip-changeUp').first().text().trim();
    }

    if (!yieldRaw) {
        const title = $('title').text().trim();
        console.error(`Parsing failed. Page title: "${title}" (Length: ${html.length})`);
        throw new Error('Yield value not found in CNBC HTML.');
    }

    // Clean up strings (remove %)
    yieldRaw = yieldRaw.replace('%', '');

    const yieldValue = parseFloat(yieldRaw);
    const dayChangeValue = parseFloat(changeRaw) || 0;
    
    const timeText = new Date().toLocaleTimeString('en-US', { 
        timeZone: 'America/New_York', 
        hour: '2-digit', 
        minute: '2-digit',
        timeZoneName: 'short'
    });

    const data = {
        yieldValue,
        dayChangeValue,
        tooltip: `US 10Y Yield: ${yieldValue}%\nChange: ${dayChangeValue}%\nTime: ${timeText}`,
        updatedAt: new Date().toISOString()
    };

    const outDir = path.join(__dirname, '../data');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    
    const outPath = path.join(outDir, 'yield.json');
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
    console.log('Successfully wrote yield data:', data);

  } catch (error) {
    console.error('Failed to fetch yield data:', error.message);
    process.exit(1);
  }
}

run();
