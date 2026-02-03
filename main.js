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
        placeholderImageUrl: 'chart_after_x.svg'
    });

    if (location.protocol !== 'file:') {
        
        viewer.setDarkModeBasedOnTime();

        viewer.loadSvgFromUrl('chart_after_x.svg').then(() => {
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
    if (!data) return null;

    const timestampTicks = Date.now() * 1e4 + 621355968000000000;
    const yieldValue = data.yieldValue;
    // alert(yieldValue);

    // Use the viewer's public helper method to get coordinates.
    const coords = viewer.getLogicalCoordinates(timestampTicks, yieldValue);
    if (!coords) return null;
    
    // Return the final "paint instructions" for the dot.
    return {
        cx: coords.vx,
        cy: coords.vy,
        color: data.dayChangeValue >= 0 ? 'crimson' : 'limegreen',
        tooltip: data.tooltip
    };
}

async function fetchYieldData() {
    try {
        const targetUrl = 'https://tradingeconomics.com/united-states/government-bond-yield';

        // Try multiple proxy endpoints since some proxies block certain origins.
        const proxies = [
            'https://corsproxy.io/?',         // append raw URL
            'https://thingproxy.freeboard.io/fetch/', // append raw URL
            'https://api.allorigins.win/raw?url='    // uses url= param (encode)
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

        // Try the known selector first, then several fallbacks.
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

        // Extract numeric tokens as a fallback (e.g. "4.23" "-0.02%")
        const nums = rowText.match(/-?\d+\.\d+%?|-?\d+%?/g) || [];

        let yieldRaw = tds[1]?.textContent.trim() || nums[0] || null;
        let dayChangeText = tds[3]?.textContent.trim() || nums[1] || '0';
        let timeText = tds[6]?.textContent.trim() || new Date().toLocaleTimeString();

        if (!yieldRaw) throw new Error('Yield value not found.');
        // Remove trailing percent if present
        yieldRaw = yieldRaw.replace('%', '');
        dayChangeText = (dayChangeText || '').replace('%', '');

        const yieldValue = parseFloat(yieldRaw);
        const dayChangeValue = parseFloat(dayChangeText) || 0;

        if (Number.isNaN(yieldValue)) throw new Error('Parsed yield is NaN.');

        return {
            yieldValue,
            dayChangeValue,
            tooltip: `US 10Y Yield: ${yieldRaw}\nChange: ${dayChangeText}%\nTime: ${timeText}`
        };
    } catch (error) {
        console.warn('Yield fetch failed:', error);
        debugStatus('Yield fetch failed: ' + (error && error.message ? error.message : String(error)));
        return null;
    }
}