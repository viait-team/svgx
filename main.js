// main.js - FINAL VERSION
// alert("main.js is loading!");

// This is the single, most important change. We wait for the browser to confirm
// that the entire HTML page is loaded and ready before we run ANY code.
document.addEventListener('DOMContentLoaded', () => {

    // 1. Create the viewer instance INSIDE the listener.
    // We also pass the placeholder image URL here.
    const viewer = new SVGXViewer('#viewer-root', {
        placeholderImageUrl: 'chart_after_x.svg'
    });

    // 2. Check the environment and load the default SVG if on a server.
    if (location.protocol !== 'file:') {
        // We command the viewer to load the real SVG.
        // The .then() ensures the dot is enabled only AFTER the SVG is loaded.
        viewer.loadSvgFromUrl('chart_after_x.svg').then(() => {
            viewer.enableLiveDot(getFinancialDotData, 30000); // Update every 30 seconds
        });
    }

});


// --- Application-Specific Logic (No Changes Here) ---

// This function is the "brain" for the live dot. It's specific to this application.
async function getFinancialDotData() {
    // This function needs access to the `viewer` instance to use its helper methods.
    // Since this script won't run until after the viewer is created, this is safe.
    const viewer = document.querySelector('#viewer-root').svgxViewerInstance;
    if (!viewer) return null;

    const data = await fetchYieldData();
    if (!data) return null;

    const timestampTicks = Date.now() * 1e4 + 621355968000000000;
    const coords = viewer.getLogicalCoordinates(timestampTicks, data.yieldValue);
    if (!coords) return null;
    
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