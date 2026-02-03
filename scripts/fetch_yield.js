const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

async function run() {
  try {
    const targetUrl = 'https://tradingeconomics.com/united-states/government-bond-yield';
    console.log(`Fetching ${targetUrl}...`);

    // Use a standard User-Agent to try to bypass basic bot detection
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    };

    const res = await fetch(targetUrl, { headers, timeout: 15000 });
    
    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Logic similar to main.js but using cheerio
    let row = $('table.table.table-condensed tr[data-symbol="USGG10YR:IND"]');

    if (row.length === 0) {
        $('table tr').each((i, el) => {
            if (/10\s*Y|10Y|10-yr|10yr|10 Year|USGG10YR/i.test($(el).text())) {
                row = $(el);
                return false;
            }
        });
    }

    if (row.length === 0) {
        throw new Error('Could not find data row in HTML.');
    }

    const tds = row.find('td');
    let yieldRaw = $(tds[1]).text().trim();
    let dayChangeText = $(tds[3]).text().trim();
    const timeText = $(tds[6]).text().trim();

    if (!yieldRaw) {
            // Fallback regex
            const rowText = row.text();
            const nums = rowText.match(/-?\d+\.\d+%?|-?\d+%?/g) || [];
            yieldRaw = nums[0];
            dayChangeText = nums[1] || '0';
    }

    if (!yieldRaw) throw new Error('Yield value not found.');

    // Clean up strings (remove %)
    yieldRaw = yieldRaw.replace('%', '');
    dayChangeText = dayChangeText.replace('%', '');

    const yieldValue = parseFloat(yieldRaw);
    const dayChangeValue = parseFloat(dayChangeText) || 0;

    const data = {
        yieldValue,
        dayChangeValue,
        tooltip: `US 10Y Yield: ${yieldRaw}\nChange: ${dayChangeText}%\nTime: ${timeText}`,
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
