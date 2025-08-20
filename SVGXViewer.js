// SVGXViewer.js

class SVGXViewer {
    viewerHTML = `
        <input type="file" class="hidden-file-input" accept=".svg, .svgx" style="display: none;">
        <main>
            <div id="svg-container"></div>
            <div class="floating-panel" id="floating-panel">
                <button class="icon-button" id="openFileButton" title="Open File">📂</button>
                <hr style="border-color: rgba(255,255,255,0.2); width: 100%; margin: 2px 0;">
                <button class="icon-button" id="zoomXButton" title="Zoom X-Axis">↔</button>
                <button class="icon-button" id="zoomYButton" title="Zoom Y-Axis">↕</button>    
                <button class="icon-button" id="resetButton" title="Reset View">⟲</button>
                <button class="icon-button" id="darkModeToggle" title="Toggle Dark Mode">🌙</button>
            </div>
        </main>
    `;

    constructor(targetElementSelector, options = {}) {
        this.hostElement = document.querySelector(targetElementSelector);
        if (!this.hostElement) throw new Error(`Viewer Error: Target element "${targetElementSelector}" not found.`);
        
        this.hostElement.svgxViewerInstance = this;
        this.options = options;

        // State properties
        this.currentZoomX = 1;
        this.currentZoomY = 1;
        this.zoomLevels = [1, 2, 3];
        this.isDragging = false;
        this.panelOffsetX = 0;
        this.panelOffsetY = 0;
        
        // Public property for the application to access the loaded SVG
        this.svgElement = null;

        this._init();
    }

    _init() {
        this.hostElement.innerHTML = this.viewerHTML;
        this.hostElement.classList.add('svgx-viewer');
        this._cacheDOMElements();
        this._bindEventListeners();

        if (this.options.placeholderImageUrl) {
            const img = document.createElement('img');
            img.src = this.options.placeholderImageUrl;
            img.alt = "Please open an SVG file to view it here.";
            this.svgContainer.innerHTML = '';
            this.svgContainer.appendChild(img);
        } else {
            this.svgContainer.innerHTML = '<p style="color:#888; text-align:center;">Viewer initialized.</p>';
        }
    }
    
    // --- Public API Methods ---
    async loadSvgFromUrl(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            const svgText = await response.text();
            this.loadSvgString(svgText);
        } catch (error) {
            console.error('[VIAIT Viewer] Failed to load SVG:', error);
            this.svgContainer.innerHTML = `<p style="color:red; text-align:center;">Failed to load SVG from ${url}.</p>`;
        }
    }

    loadSvgString(svgString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, "image/svg+xml");
        const svgElement = doc.documentElement;
        if (!svgElement || svgElement.tagName.toLowerCase() !== 'svg') {
            this.svgContainer.innerHTML = '<p style="color:#888; text-align:center;">Invalid SVG content.</p>';
            return;
        }
        this.svgContainer.innerHTML = '';
        this.svgContainer.appendChild(svgElement);
        this.svgElement = svgElement; // Expose the element publicly

        this.resetZoom();
    }
    
    getLogicalCoordinates(domainXValue, domainYValue) {
        if (!this.svgElement) return null;
        const ylmAttr = this.svgElement.getAttribute('ylm');
        const xlmAttr = this.svgElement.getAttribute('xlm');
        const yMapping = this._parseMapping(ylmAttr);
        const xMapping = this._parseMapping(xlmAttr);
        if (!yMapping || !xMapping) return null;
        
        const vx = this._mapValue(domainXValue, xMapping);
        const vy = this._mapValue(domainYValue, yMapping, true);
        return { vx, vy };
    }

    // --- TIME-BASED DARK MODE ---
    setDarkModeBasedOnTime() {
        const currentHour = new Date().getHours();
        if (currentHour >= 8 && currentHour < 17) {
            document.body.classList.add('dark-mode');
            console.log('[VIAIT] Dark mode enabled based on local time.');
        }
    }

    // --- Internal Methods (Private) ---
    _cacheDOMElements() {
        this.svgContainer = this.hostElement.querySelector('#svg-container');
        this.hiddenFileInput = this.hostElement.querySelector('.hidden-file-input');
        this.floatingPanel = this.hostElement.querySelector('.floating-panel');
        this.openFileButton = this.hostElement.querySelector('#openFileButton');
        this.zoomXButton = this.hostElement.querySelector('#zoomXButton');
        this.zoomYButton = this.hostElement.querySelector('#zoomYButton');
        this.resetButton = this.hostElement.querySelector('#resetButton');
        this.darkModeToggle = this.hostElement.querySelector('#darkModeToggle');
    }

    _bindEventListeners() {
        this.openFileButton.addEventListener('click', () => this.hiddenFileInput.click());
        this.hiddenFileInput.addEventListener('change', (e) => this._handleFileChange(e));
        this.floatingPanel.addEventListener('mousedown', (e) => this._startDrag(e));
        document.addEventListener('mousemove', (e) => this._drag(e));
        document.addEventListener('mouseup', () => this._stopDrag());
        this.zoomXButton.addEventListener('click', (e) => this.zoomX(e));
        this.zoomYButton.addEventListener('click', (e) => this.zoomY(e));
        this.resetButton.addEventListener('click', (e) => this.resetZoom(e));
        this.darkModeToggle.addEventListener('click', () => this.hostElement.classList.toggle('dark-mode'));
        window.addEventListener('resize', () => this._updateSvgTransform());
    }

    _handleFileChange(event) {
        const file = event.target.files[0];
        if (!file || !file.type.includes('svg')) {
            alert('Please select a valid SVG file.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => this.loadSvgString(e.target.result);
        reader.readAsText(file);
    }
    
    _updateSvgTransform() {
        if (this.svgElement) {
            this.svgElement.setAttribute('transform', `scale(${this.currentZoomX}, ${this.currentZoomY})`);
        }
    }
    
    zoomX(e) {
        e.stopPropagation();
        const currentIndex = this.zoomLevels.indexOf(this.currentZoomX);
        this.currentZoomX = this.zoomLevels[(currentIndex + 1) % this.zoomLevels.length];
        this._updateSvgTransform();
    }

    zoomY(e) {
        e.stopPropagation();
        const currentIndex = this.zoomLevels.indexOf(this.currentZoomY);
        this.currentZoomY = this.zoomLevels[(currentIndex + 1) % this.zoomLevels.length];
        this._updateSvgTransform();
    }

    resetZoom(e) {
        if (e) e.stopPropagation();
        this.currentZoomX = 1;
        this.currentZoomY = 1;
        this._updateSvgTransform();
    }

    _startDrag(e) {
        if (e.target.classList.contains('icon-button')) return;
        this.isDragging = true;
        this.panelOffsetX = e.clientX - this.floatingPanel.offsetLeft;
        this.panelOffsetY = e.clientY - this.floatingPanel.offsetTop;
        this.floatingPanel.style.cursor = 'grabbing';
    }

    _drag(e) {
        if (!this.isDragging) return;
        let newX = e.clientX - this.panelOffsetX;
        let newY = e.clientY - this.panelOffsetY;
        const containerRect = this.hostElement.getBoundingClientRect();
        newX = Math.max(0, Math.min(newX, containerRect.width - this.floatingPanel.offsetWidth));
        newY = Math.max(0, Math.min(newY, containerRect.height - this.floatingPanel.offsetHeight));
        this.floatingPanel.style.left = `${newX}px`;
        this.floatingPanel.style.top = `${newY}px`;
    }

    _stopDrag() {
        this.isDragging = false;
        this.floatingPanel.style.cursor = 'move';
    }

    _parseMapping(attr) {
        if (!attr) return null;
        try {
            const values = JSON.parse(attr.replace(/E\+?(\d+)/g, 'e$1'));
            if (Array.isArray(values) && values.length === 4) {
                return {
                    domainMin: parseFloat(values),
                    domainMax: parseFloat(values),
                    rangeMin: parseFloat(values),
                    rangeMax: parseFloat(values)
                };
            }
        } catch (e) {
            console.warn('Invalid mapping:', attr);
        }
        return null;
    }

    _mapValue(value, mapping, invert = false) {
        const { domainMin, domainMax, rangeMin, rangeMax } = mapping;
        const ratio = (value - domainMin) / (domainMax - domainMin);
        const adjusted = invert ? 1 - ratio : ratio;
        return rangeMin + adjusted * (rangeMax - rangeMin);
    }
}

