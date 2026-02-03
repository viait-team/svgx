const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

async function run() {
  try {
    // Yahoo Finance API for ^TNX (10-Year Treasury Note Yield)
    // This returns JSON, which is much more reliable than scraping HTML.
    const targetUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=1d&range=1d';
    console.log(`Fetching ${targetUrl}...`);

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    };

    const res = await fetch(targetUrl, { headers, timeout: 10000 });
    
    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
    }

    const json = await res.json();
    const result = json.chart?.result?.[0]?.meta;

    if (!result) {
        throw new Error('Yahoo Finance returned invalid JSON structure');
    }

    const yieldValue = result.regularMarketPrice;
    const changePercent = result.regularMarketChangePercent || 0;
    const timeDate = new Date(result.regularMarketTime * 1000);
    
    const timeText = timeDate.toLocaleTimeString('en-US', { 
        timeZone: 'America/New_York', 
        hour: '2-digit', 
        minute: '2-digit',
        timeZoneName: 'short'
    });

    const data = {
        yieldValue,
        dayChangeValue: changePercent,
        tooltip: `US 10Y Yield: ${yieldValue}%\nChange: ${changePercent.toFixed(2)}%\nTime: ${timeText}`,
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
