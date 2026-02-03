// main.js

document.addEventListener('DOMContentLoaded', () => {

// Simple on-page debug status for fetch issues (visible on GitHub Pages)
function debugStatus(msg) {
    try {
        let el = document.getElementById('fetch-status');
        if (!el) {
            el = document.createElement('div');
            el.id = 'fetch-status';
            Object.assign(el.style, {
                position: 'fixed',
                right: '8px',
                bottom: '8px',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '6px 10px',
                fontSize: '12px',
                fontFamily: 'monospace',
                borderRadius: '4px',
                zIndex: 99999
            });
            document.body.appendChild(el);
        }
        el.textContent = new Date().toLocaleTimeString() + ' — ' + msg;
    } catch (e) {
        console.warn('debugStatus failed', e);
    }
}


    const viewer = new SVGXViewer('#viewer-root', {
        placeholderImageUrl: 'cbo_report.svg'
    });

    if (location.protocol !== 'file:') {
        
        viewer.setDarkModeBasedOnTime();

        viewer.loadSvgFromUrl('cbo_report.svg').then(() => {
            // The application is now fully responsible for the dot.
            
            // 1. Do the initial update immediately after the SVG loads.
            updateDot(viewer);
            
            // 2. Start a timer to call updateDot periodically.
            setInterval(() => updateDot(viewer), 60000); // Update every 30 seconds
        });
    }

});


// --- Application-Specific Logic ---

/**
 * Creates and updates the live dot on the SVG chart.
 * This is now part of the main application, not the viewer library.
 * @param {SVGXViewer} viewer The viewer instance, used as a tool.
 */
async function updateDot(viewer) {
    // We can't do anything if the viewer doesn't have an SVG loaded.
    if (!viewer.svgElement) return;

    // Get the data needed to draw the dot.
    const data = await getFinancialDotData(viewer);
    if (!data) return; // Exit if data fetching failed.

    // Find or create the dot element directly inside the viewer's SVG.
    let dot = viewer.svgElement.querySelector('circle[data-live-dot]');
    if (!dot) {
        dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('data-live-dot', 'true');
        dot.setAttribute('r', '5');
        dot.setAttribute('stroke', 'black');
        dot.setAttribute('stroke-width', '1');
        viewer.svgElement.appendChild(dot);
    }
 
    // Update the dot's visual properties based on the fetched data.
    dot.setAttribute('fill', data.color || 'red');
    dot.setAttribute('cx', data.cx);
    dot.setAttribute('cy', data.cy);

    // remove
    dot.querySelectorAll('animate').forEach(anim => dot.removeChild(anim));
    dot.querySelectorAll('title').forEach(t => dot.removeChild(t));

    // Update the dot's tooltip.
    let tooltip = dot.querySelector('title');
    if (!tooltip) {
        tooltip = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        dot.appendChild(tooltip);
    }
    tooltip.textContent = data.tooltip || '';

    // Add radius animation
    const radiusAnim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    radiusAnim.setAttribute('attributeName', 'r');
    radiusAnim.setAttribute('values', '5;7;5');
    radiusAnim.setAttribute('dur', '0.6s');
    radiusAnim.setAttribute('repeatCount', 'indefinite');
    radiusAnim.setAttribute('fill', 'freeze');
    dot.appendChild(radiusAnim);
    radiusAnim.beginElement();
}

/**
 * A bridge function that fetches financial data and uses the viewer's
 * helper method to translate it into SVG coordinates.
 * @param {SVGXViewer} viewer The viewer instance.
 */
async function getFinancialDotData(viewer) {

    const data = await fetchYieldData();
            // Prefer server-generated JSON when available on GitHub Pages.
            try {
                const local = await fetch('data/yield.json?ts=' + Date.now(), { cache: 'no-store' });
                if (local && local.ok) {
                    const j = await local.json();
                    if (j && typeof j.yieldValue === 'number') return j;
                }
            } catch (e) {
                // ignore and fall back to proxy scraping
            }

    // ... (rest of logic is handled by fetchYieldData in main.js if shared, 
    // but here it seems you might want to copy the logic from main.js or import it)
    // For now, I will assume you want the same logic as main.js:
    
    const targetUrl = 'https://tradingeconomics.com/united-states/government-bond-yield';

    const proxies = [
        'https://corsproxy.io/?',
        'https://thingproxy.freeboard.io/fetch/',
        'https://api.allorigins.win/raw?url='
    ];

    let response = null;
    let lastErr = null;
    for (const p of proxies) {
        const fetchUrl = p.includes('url=') ? p + encodeURIComponent(targetUrl) : p + targetUrl;
        try {
            response = await fetch(fetchUrl);
            if (response && response.ok) break;
            lastErr = new Error(`HTTP ${response ? response.status : 'NO_RESPONSE'} from ${fetchUrl}`);
        } catch (err) {
            lastErr = err;
        }
    }

    if (!response || !response.ok) {
        debugStatus(lastErr ? lastErr.message : 'No response from proxies');
        throw lastErr || new Error('No proxy response');
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let row = doc.querySelector('table.table.table-condensed tr[data-symbol="USGG10YR:IND"]');
    if (!row) {
        const rows = Array.from(doc.querySelectorAll('table tr'));
        row = rows.find(r => /10\s*Y|10Y|10-yr|10yr|10 Year|USGG10YR/i.test(r.textContent || ''));
    }

    if (!row) {
        const els = Array.from(doc.querySelectorAll('*'));
        const el = els.find(e => /US\s*10Y|USGG10YR|10\s*yr|10\s*Year/i.test(e.textContent || ''));
        if (el) row = el.closest('tr') || el.closest('table')?.querySelector('tr');
    }

    if (!row) throw new Error('Could not find data row in HTML.');

    const tds = row.querySelectorAll('td');
    const rowText = row.textContent || '';
    const nums = rowText.match(/-?\d+\.\d+%?|-?\d+%?/g) || [];

    const yieldRaw = tds[1]?.textContent.trim() || nums[0] || null;
    const dayChangeText = tds[3]?.textContent.trim() || nums[1] || '0';
    const timeText = tds[6]?.textContent.trim() || new Date().toLocaleTimeString();

    if (!yieldRaw) throw new Error('Yield value not found.');

    const yieldValue = parseFloat(yieldRaw.replace('%', ''));
    const dayChangeValue = parseFloat((dayChangeText || '').replace('%', '')) || 0;

    if (Number.isNaN(yieldValue)) throw new Error('Parsed yield is NaN.');

    return {
        yieldValue,
        dayChangeValue,
        tooltip: `US 10Y Yield: ${yieldRaw}\nChange: ${dayChangeText}%\nTime: ${timeText}`
    };
}