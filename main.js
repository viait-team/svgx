// main.js

document.addEventListener('DOMContentLoaded', () => {

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
            setInterval(() => updateDot(viewer), 30000); // Update every 30 seconds
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

    // Update the dot's tooltip.
    let tooltip = dot.querySelector('title');
    if (!tooltip) {
        tooltip = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        dot.appendChild(tooltip);
    }
    tooltip.textContent = data.tooltip || '';
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
    alert(yieldValue);

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
        const targetUrl = 'https://tradingeconomics.com/united-states/government-bond-yield';
        const response = await fetch(proxyUrl + targetUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const row = doc.querySelector('table.table.table-condensed tr[data-symbol="USGG10YR:IND"]');
        const tds = row?.querySelectorAll('td');

        if (!tds || tds.length < 4) throw new Error("Could not find data row in HTML.");

        const yieldRaw = tds[1].textContent.trim();
        const dayChangeText = tds[3].textContent.trim();
        const timeText = tds.length >= 6 ? tds[6].textContent.trim() : new Date().toLocaleTimeString();
        return {
            yieldValue: parseFloat(yieldRaw),
            dayChangeValue: parseFloat(dayChangeText.replace('%', '')),
            tooltip: `US 10Y Yield: ${yieldRaw}\nChange: ${dayChangeText}\nTime: ${timeText}`
        };
    } catch (error) {
        console.warn('Yield fetch failed:', error);
        return null;
    }
}