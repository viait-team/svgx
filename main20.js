// main.js

document.addEventListener('DOMContentLoaded', () => {

    const viewer = new SVGXViewer('#viewer-root', {
        placeholderImageUrl: 'chart_after_20.svg'
    });

    if (location.protocol !== 'file:') {
          
        viewer.setDarkModeBasedOnTime();

        viewer.loadSvgFromUrl('chart_after_20.svg').then(() => {
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
        const proxyUrl = 'https://corsproxy.io/?';
        const targetUrl = 'https://tradingeconomics.com/united-states/20-year-bond-yield';
        const response = await fetch(proxyUrl + encodeURIComponent(targetUrl));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        // Prefer explicit data-symbol, then fall back to heuristics.
        let row = doc.querySelector('tr[data-symbol="USGG20Y:IND"]');

        if (!row) {
            const rows = Array.from(doc.querySelectorAll('table tr'));
            row = rows.find(r => /20\s*Y|20Y|20-yr|20yr|20 Year|USGG20Y/i.test(r.textContent || ''));
        }

        if (!row) {
            const els = Array.from(doc.querySelectorAll('*'));
            const el = els.find(e => /US\s*20Y|USGG20Y|20\s*yr|20\s*Year/i.test(e.textContent || ''));
            if (el) row = el.closest('tr') || el.closest('table')?.querySelector('tr');
        }

        if (!row) throw new Error('Could not find data row in HTML.');

        const cells = row.querySelectorAll('td');
        const rowText = row.textContent || '';
        const nums = rowText.match(/-?\d+\.\d+%?|-?\d+%?/g) || [];

        const yieldRaw = cells[1]?.innerText.trim() || nums[0] || null;
        const dayChangeText = cells[3]?.innerText.trim() || nums[1] || '0';
        const timeText = cells[6]?.innerText.trim() || new Date().toLocaleTimeString();

        if (!yieldRaw) throw new Error('Yield value not found.');

        const yieldValue = parseFloat(yieldRaw.replace('%', ''));
        const dayChangeValue = parseFloat((dayChangeText || '').replace('%', '')) || 0;

        if (Number.isNaN(yieldValue)) throw new Error('Parsed yield is NaN.');

        return {
            yieldValue: isNaN(yieldValue) ? 0.0 : yieldValue,
            dayChangeValue,
            tooltip: `US 20Y Yield: ${yieldRaw}\nChange: ${dayChangeText}%\nTime: ${timeText}`
        };

    } catch (error) {
        console.warn('Yield fetch failed:', error);
        return null;
    }
}
