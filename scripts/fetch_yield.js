const fs = require('fs');
const path = require('path');
// const fetch = require('node-fetch');

async function run() {
  try {
    // DEBUG MODE: Just write timestamp to verify workflow runs
    const now = new Date();

    const data = {
      yieldValue: 0, // Placeholder
      dayChangeValue: 0,
      tooltip: `Workflow Check: ${now.toLocaleTimeString()}`,
      updatedAt: now.toISOString()
    };

    const outDir = path.join(__dirname, '../data');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    
    const outPath = path.join(outDir, 'yield.json');
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
    console.log('Successfully wrote yield data:', data);

  } catch (error) {
    console.error('Workflow failed:', error.message);
    process.exit(1);
  }
}

run();
