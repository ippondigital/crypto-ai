/**
 * Crypto Market Analysis Data Engine - Enhanced Version
 * Phase 1: Core API Integration Complete
 * Author: AI Assistant
 * Updated: June 16, 2025
 * 
 * Enhancements:
 * - Live API integration with CoinGecko and Alternative.me
 * - LocalStorage caching with expiry
 * - Intelligent fallback system
 * - CORS proxy support
 */

class CryptoDataEngine {
    constructor() {
        this.data = null;
        this.liveData = null;
        this.cache = new DataCache(); // New caching system
        this.bindingTypes = {
            'text': this.bindText,
            'html': this.bindHTML, 
            'class': this.bindClass,
            'attribute': this.bindAttribute,
            'style': this.bindStyle
        };
        this.templates = {};
        
        // Enhanced API Configuration
        this.apiConfig = {
            // Free APIs that work in browser
            apis: {
                coinGecko: {
                    base: 'https://api.coingecko.com/api/v3',
                    endpoints: {
                        prices: '/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_market_cap=true&include_24hr_change=true',
                        global: '/global'
                    },
                    rateLimit: 30, // calls per minute
                    requiresProxy: false
                },
                alternativeMe: {
                    base: 'https://api.alternative.me',
                    endpoints: {
                        fearGreed: '/fng/?limit=1'
                    },
                    rateLimit: 100, // reasonable use
                    requiresProxy: false
                },
                // Additional APIs that need CORS proxy
                tradingView: {
                    base: 'https://scanner.tradingview.com',
                    endpoints: {
                        btcDominance: '/crypto/scan'
                    },
                    requiresProxy: true
                }
            },
            
            // CORS proxy options
            corsProxies: [
                'https://corsproxy.io/?',
                'https://api.allorigins.win/raw?url='
            ],
            
            // Retry configuration
            retryDelay: 2000,
            maxRetries: 3,
            
            // Cache configuration (in milliseconds)
            cacheExpiry: {
                prices: 60 * 1000,        // 1 minute
                global: 5 * 60 * 1000,    // 5 minutes
                sentiment: 5 * 60 * 1000, // 5 minutes
                news: 30 * 60 * 1000      // 30 minutes
            }
        };
        
        // Data source tracking
        this.dataSourceMap = new Map();
        
        this.init();
    }

    /**
     * Initialize the data engine with enhanced API support
     */
    async init() {
        try {
            console.log('🚀 Initializing Enhanced Crypto Data Engine...');
            this.updateStatusIndicator('🔄 Loading...', 'loading');
            
            // Load static data first as base
            await this.loadStaticData();
            
            // Try to fetch live data and merge with static
            const liveDataSuccess = await this.fetchLiveMarketData();
            
            // Bind all data to UI
            await this.bindAll();
            
            // Render templates
            await this.renderTemplatesSafely();
            
            // Start auto-refresh if live data worked
            if (liveDataSuccess) {
                this.startAutoRefresh();
                this.updateStatusIndicator('🟢 Live Data Active', 'live');
            } else {
                this.updateStatusIndicator('🟡 Using Cached Data', 'cached');
            }
            
            console.log('✅ Data Engine initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Data Engine:', error);
            this.handleInitError(error);
        }
    }

    /**
     * Load static data from data.json
     */
    async loadStaticData() {
        try {
            console.log('📊 Loading static data from data.json...');
            const response = await fetch('./data.json');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.data = await response.json();
            
            // Mark all data as static initially
            this.markDataSource(this.data, 'static');
            
            console.log('✅ Static data loaded successfully');
            
        } catch (error) {
            console.error('❌ Failed to load data.json:', error);
            // Fallback to embedded data
            this.data = this.getDefaultData();
        }
    }

    /**
     * Fetch live market data from multiple APIs
     */
    async fetchLiveMarketData() {
        console.log('📡 Fetching live market data...');
        
        try {
            // Check cache first
            const cachedData = this.getCachedLiveData();
            if (cachedData) {
                console.log('📦 Using cached live data');
                this.mergeLiveData(cachedData);
                return true;
            }
            
            // Fetch fresh data
            const [priceData, globalData, fearGreedData] = await Promise.allSettled([
                this.fetchWithRetry(() => this.fetchCoinPrices()),
                this.fetchWithRetry(() => this.fetchGlobalData()),
                this.fetchWithRetry(() => this.fetchFearGreedIndex())
            ]);
            
            const liveData = {};
            
            // Process results
            if (priceData.status === 'fulfilled') {
                liveData.prices = priceData.value;
                console.log('✅ Price data fetched');
            }
            
            if (globalData.status === 'fulfilled') {
                liveData.global = globalData.value;
                console.log('✅ Global data fetched');
            }
            
            if (fearGreedData.status === 'fulfilled') {
                liveData.fearGreed = fearGreedData.value;
                console.log('✅ Fear & Greed data fetched');
            }
            
            // Cache the live data
            this.cache.set('liveData', liveData, 'prices');
            
            // Merge with existing data
            this.mergeLiveData(liveData);
            
            return Object.keys(liveData).length > 0;
            
        } catch (error) {
            console.error('❌ Error fetching live data:', error);
            return false;
        }
    }

    /**
     * Fetch Bitcoin and Ethereum prices
     */
    async fetchCoinPrices() {
        const url = this.apiConfig.apis.coinGecko.base + 
                   this.apiConfig.apis.coinGecko.endpoints.prices;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status}`);
        }
        
        return await response.json();
    }

    /**
     * Fetch global market data
     */
    async fetchGlobalData() {
        const url = this.apiConfig.apis.coinGecko.base + 
                   this.apiConfig.apis.coinGecko.endpoints.global;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`CoinGecko Global API error: ${response.status}`);
        }
        
        const result = await response.json();
        return result.data;
    }

    /**
     * Fetch Fear & Greed Index
     */
    async fetchFearGreedIndex() {
        const url = this.apiConfig.apis.alternativeMe.base + 
                   this.apiConfig.apis.alternativeMe.endpoints.fearGreed;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Fear & Greed API error: ${response.status}`);
        }
        
        const result = await response.json();
        return result.data[0];
    }

    /**
     * Fetch data with CORS proxy if needed
     */
    async fetchWithProxy(url) {
        // Try direct first
        try {
            const response = await fetch(url);
            if (response.ok) return response;
        } catch (error) {
            console.log('Direct fetch failed, trying proxy...');
        }
        
        // Try with proxies
        for (const proxy of this.apiConfig.corsProxies) {
            try {
                const proxyUrl = proxy + encodeURIComponent(url);
                const response = await fetch(proxyUrl);
                if (response.ok) {
                    console.log(`✅ Proxy successful: ${proxy}`);
                    return response;
                }
            } catch (error) {
                continue;
            }
        }
        
        throw new Error('All proxies failed');
    }

    /**
     * Fetch with retry logic
     */
    async fetchWithRetry(fetchFn, retries = this.apiConfig.maxRetries) {
        try {
            return await fetchFn();
        } catch (error) {
            if (retries > 0) {
                console.log(`⏳ Retrying in ${this.apiConfig.retryDelay}ms... (${retries} left)`);
                await new Promise(resolve => setTimeout(resolve, this.apiConfig.retryDelay));
                return this.fetchWithRetry(fetchFn, retries - 1);
            }
            throw error;
        }
    }

    /**
     * Get cached live data if available and not expired
     */
    getCachedLiveData() {
        return this.cache.get('liveData', 'prices');
    }

    /**
     * Merge live data with existing data
     */
    mergeLiveData(liveData) {
        if (!this.data || !liveData) return;
        
        console.log('🔄 Merging live data...');
        
        // Update Bitcoin data
        if (liveData.prices?.bitcoin) {
            const btcData = liveData.prices.bitcoin;
            if (this.data.marketOverview?.bitcoin) {
                this.data.marketOverview.bitcoin.price = this.formatCurrency(btcData.usd);
                this.data.marketOverview.bitcoin.change = this.formatPercentage(btcData.usd_24h_change);
                this.data.marketOverview.bitcoin.trendClass = this.getTrendClass(btcData.usd_24h_change);
                this.data.marketOverview.bitcoin.trendIcon = this.getTrendIcon(btcData.usd_24h_change);
                this.markDataSource(this.data.marketOverview.bitcoin, 'live', 'CoinGecko');
            }
        }
        
        // Update Ethereum data
        if (liveData.prices?.ethereum) {
            const ethData = liveData.prices.ethereum;
            if (this.data.marketOverview?.ethereum) {
                this.data.marketOverview.ethereum.price = this.formatCurrency(ethData.usd);
                this.data.marketOverview.ethereum.change = this.formatPercentage(ethData.usd_24h_change);
                this.data.marketOverview.ethereum.trendClass = this.getTrendClass(ethData.usd_24h_change);
                this.data.marketOverview.ethereum.trendIcon = this.getTrendIcon(ethData.usd_24h_change);
                this.markDataSource(this.data.marketOverview.ethereum, 'live', 'CoinGecko');
            }
        }
        
        // Update global market data
        if (liveData.global) {
            const globalData = liveData.global;
            
            // Total market cap
            if (this.data.marketOverview?.totalMarketCap && globalData.total_market_cap?.usd) {
                this.data.marketOverview.totalMarketCap.value = this.formatMarketCap(globalData.total_market_cap.usd);
                if (globalData.market_cap_change_percentage_24h_usd !== undefined) {
                    this.data.marketOverview.totalMarketCap.change = this.formatPercentage(globalData.market_cap_change_percentage_24h_usd);
                    this.data.marketOverview.totalMarketCap.trendClass = this.getTrendClass(globalData.market_cap_change_percentage_24h_usd);
                    this.data.marketOverview.totalMarketCap.trendIcon = this.getTrendIcon(globalData.market_cap_change_percentage_24h_usd);
                }
                this.markDataSource(this.data.marketOverview.totalMarketCap, 'live', 'CoinGecko');
            }
            
            // Bitcoin dominance
            if (this.data.marketOverview?.bitcoinDominance && globalData.market_cap_percentage?.btc) {
                this.data.marketOverview.bitcoinDominance.percentage = globalData.market_cap_percentage.btc.toFixed(1);
                this.markDataSource(this.data.marketOverview.bitcoinDominance, 'live', 'CoinGecko');
            }
        }
        
        // Update Fear & Greed Index
        if (liveData.fearGreed) {
            const fgData = liveData.fearGreed;
            if (this.data.sentimentData?.fearGreedIndex) {
                this.data.sentimentData.fearGreedIndex.value = fgData.value;
                this.data.sentimentData.fearGreedIndex.label = fgData.value_classification;
                this.markDataSource(this.data.sentimentData.fearGreedIndex, 'live', 'Alternative.me');
            }
        }
        
        console.log('✅ Live data merged successfully');
    }

    /**
     * Mark data source for transparency
     */
    markDataSource(dataObject, source, provider = null) {
        if (!dataObject) return;
        
        if (!dataObject._meta) {
            dataObject._meta = {};
        }
        
        dataObject._meta.source = source;
        dataObject._meta.lastUpdated = new Date().toISOString();
        dataObject._meta.provider = provider;
        
        // Track in source map for UI updates
        this.dataSourceMap.set(dataObject, {
            source,
            provider,
            timestamp: Date.now()
        });
    }

    /**
     * Start auto-refresh system
     */
    startAutoRefresh() {
        console.log('🔄 Starting auto-refresh system...');
        
        // Price updates every minute
        this.refreshTimers = {
            prices: setInterval(() => {
                this.fetchLiveMarketData().then(() => {
                    this.bindAll();
                    this.showUpdateAnimation();
                });
            }, 60000), // 1 minute
            
            // Status indicator update
            status: setInterval(() => {
                this.updateDataFreshness();
            }, 5000) // Every 5 seconds
        };
    }

    /**
     * Show subtle update animation
     */
    showUpdateAnimation() {
        const elements = document.querySelectorAll('[data-bind]');
        elements.forEach(el => {
            el.style.transition = 'opacity 0.3s ease';
            el.style.opacity = '0.7';
            setTimeout(() => {
                el.style.opacity = '1';
            }, 300);
        });
    }

    /**
     * Update data freshness indicators
     */
    updateDataFreshness() {
        const now = Date.now();
        
        // Check each data point's age
        this.dataSourceMap.forEach((meta, dataObject) => {
            const age = now - meta.timestamp;
            const element = this.findElementForData(dataObject);
            
            if (element) {
                // Remove old classes
                element.classList.remove('data-fresh', 'data-stale', 'data-offline');
                
                // Add appropriate class based on age
                if (age < 120000) { // Less than 2 minutes
                    element.classList.add('data-fresh');
                } else if (age < 600000) { // Less than 10 minutes
                    element.classList.add('data-stale');
                } else {
                    element.classList.add('data-offline');
                }
            }
        });
    }

    /**
     * Find DOM element bound to specific data
     */
    findElementForData(dataObject) {
        // This is a simplified version - in production you'd have a more robust mapping
        const elements = document.querySelectorAll('[data-bind]');
        for (const el of elements) {
            const bindPath = el.getAttribute('data-bind').split(':')[1];
            if (bindPath && this.getNestedValue(this.data, bindPath) === dataObject) {
                return el;
            }
        }
        return null;
    }

    /**
     * Handle initialization errors gracefully
     */
    handleInitError(error) {
        console.error('Initialization error:', error);
        this.updateStatusIndicator('🔴 Offline Mode', 'error');
        
        // Try to use cached data
        const cachedData = this.cache.get('lastKnownGood', 'global');
        if (cachedData) {
            this.data = cachedData;
            this.bindAll();
            console.log('📦 Using last known good data from cache');
        } else {
            // Use fallback data
            this.data = this.getDefaultData();
            this.bindAll();
        }
    }

    /**
     * Format currency values
     */
    formatCurrency(value) {
        if (value >= 1000) {
            return new Intl.NumberFormat('en-US').format(Math.round(value));
        }
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }

    /**
     * Format market cap values
     */
    formatMarketCap(value) {
        if (value >= 1e12) {
            return `$${(value / 1e12).toFixed(2)}T`;
        } else if (value >= 1e9) {
            return `$${(value / 1e9).toFixed(2)}B`;
        } else if (value >= 1e6) {
            return `$${(value / 1e6).toFixed(2)}M`;
        }
        return `$${new Intl.NumberFormat('en-US').format(value)}`;
    }

    /**
     * Format percentage values
     */
    formatPercentage(value) {
        if (value === null || value === undefined) return '0.0%';
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(1)}%`;
    }

    /**
     * Get trend class based on change
     */
    getTrendClass(change) {
        if (change === null || change === undefined) return 'trend-neutral';
        if (change > 0) return 'trend-up';
        if (change < 0) return 'trend-down';
        return 'trend-neutral';
    }

    /**
     * Get trend icon based on change
     */
    getTrendIcon(change) {
        if (change === null || change === undefined) return 'fa-arrow-right';
        if (change > 0) return 'fa-arrow-up';
        if (change < 0) return 'fa-arrow-down';
        return 'fa-arrow-right';
    }

    // ... [Previous binding and rendering methods remain the same] ...
}

/**
 * LocalStorage Cache Manager
 * Handles caching with expiry for different data types
 */
class DataCache {
    constructor() {
        this.prefix = 'crypto_cache_';
        this.expiry = {
            prices: 60 * 1000,        // 1 minute
            global: 5 * 60 * 1000,    // 5 minutes
            sentiment: 5 * 60 * 1000, // 5 minutes
            news: 30 * 60 * 1000      // 30 minutes
        };
    }
    
    /**
     * Get cached data if not expired
     */
    get(key, type = 'global') {
        try {
            const cached = localStorage.getItem(this.prefix + key);
            if (!cached) return null;
            
            const data = JSON.parse(cached);
            const age = Date.now() - data.timestamp;
            const maxAge = this.expiry[type] || this.expiry.global;
            
            if (age > maxAge) {
                this.remove(key);
                return null;
            }
            
            console.log(`📦 Cache hit for ${key} (age: ${Math.round(age/1000)}s)`);
            return data.value;
            
        } catch (error) {
            console.error('Cache read error:', error);
            return null;
        }
    }
    
    /**
     * Set cache data with timestamp
     */
    set(key, value, type = 'global') {
        try {
            const data = {
                value: value,
                timestamp: Date.now(),
                type: type
            };
            
            localStorage.setItem(this.prefix + key, JSON.stringify(data));
            console.log(`💾 Cached ${key} (type: ${type})`);
            
            // Also save as last known good
            if (key === 'liveData') {
                this.set('lastKnownGood', value, 'global');
            }
            
        } catch (error) {
            console.error('Cache write error:', error);
            // Clear old cache if storage is full
            if (error.name === 'QuotaExceededError') {
                this.clearOldCache();
                // Try again
                try {
                    localStorage.setItem(this.prefix + key, JSON.stringify({
                        value: value,
                        timestamp: Date.now(),
                        type: type
                    }));
                } catch (retryError) {
                    console.error('Cache write failed after clearing:', retryError);
                }
            }
        }
    }
    
    /**
     * Remove specific cache entry
     */
    remove(key) {
        localStorage.removeItem(this.prefix + key);
    }
    
    /**
     * Clear old cache entries
     */
    clearOldCache() {
        const keys = Object.keys(localStorage);
        const now = Date.now();
        let cleared = 0;
        
        keys.forEach(key => {
            if (key.startsWith(this.prefix)) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    const age = now - data.timestamp;
                    const maxAge = this.expiry[data.type] || this.expiry.global;
                    
                    if (age > maxAge * 2) { // Clear if twice the expiry time
                        localStorage.removeItem(key);
                        cleared++;
                    }
                } catch (error) {
                    // Remove corrupted entries
                    localStorage.removeItem(key);
                    cleared++;
                }
            }
        });
        
        console.log(`🧹 Cleared ${cleared} old cache entries`);
    }
    
    /**
     * Get cache statistics
     */
    getStats() {
        const keys = Object.keys(localStorage);
        const cacheKeys = keys.filter(k => k.startsWith(this.prefix));
        const totalSize = cacheKeys.reduce((sum, key) => {
            return sum + (localStorage.getItem(key) || '').length;
        }, 0);
        
        return {
            entries: cacheKeys.length,
            sizeKB: (totalSize / 1024).toFixed(2),
            keys: cacheKeys.map(k => k.replace(this.prefix, ''))
        };
    }
}Items() {
        const container = document.getElementById('news-container');
        if (!container || !this.data.newsAndEvents?.newsItems) return;

        const newsHTML = this.data.newsAndEvents.newsItems.map(item => `
            <div class="news-item">
                <h6 class="font-weight-bold text-primary mb-2">${item.headline}</h6>
                <p class="mb-2">${item.summary}</p>
                <small class="text-muted">Impact: <span class="text-${this.getImpactColor(item.impact)}">${item.impact}</span></small>
            </div>
        `).join('');

        container.innerHTML = newsHTML;
    }

    /**
     * Render economic events
     */
    renderEconomicEvents() {
        const container = document.getElementById('economic-events-container');
        if (!container || !this.data.newsAndEvents?.economicEvents) return;

        const eventsHTML = this.data.newsAndEvents.economicEvents.map(event => `
            <li class="mb-2">
                <strong class="text-primary">${event.date}:</strong> ${event.description}
            </li>
        `).join('');

        container.innerHTML = `<ul class="list-unstyled">${eventsHTML}</ul>`;
    }

    /**
     * Render crypto events
     */
    renderCryptoEvents() {
        const container = document.getElementById('crypto-events-container');
        if (!container || !this.data.newsAndEvents?.cryptoEvents) return;

        const eventsHTML = this.data.newsAndEvents.cryptoEvents.map(event => `
            <li class="mb-2">
                <strong class="text-primary">${event.date}:</strong> ${event.description}
            </li>
        `).join('');

        container.innerHTML = `<ul class="list-unstyled">${eventsHTML}</ul>`;
    }

    /**
     * Render trading timeline sections
     */
    renderTradingTimeline() {
        if (this.data.tradingTimeline && 
            (this.hasTimelineData(this.data.tradingTimeline.next30Days) ||
             this.hasTimelineData(this.data.tradingTimeline.next90Days) ||
             this.hasTimelineData(this.data.tradingTimeline.majorCycleEvents))) {
            
            this.renderTimelineSection('next-30-days-container', this.data.tradingTimeline?.next30Days);
            this.renderTimelineSection('next-90-days-container', this.data.tradingTimeline?.next90Days);
            this.renderTimelineSection('major-cycle-events-container', this.data.tradingTimeline?.majorCycleEvents);
            console.log('✅ Dynamic timeline data rendered from data.json');
        } else {
            console.log('📅 No timeline data in data.json, preserving static HTML timeline events');
        }
    }

    hasTimelineData(timelineArray) {
        return timelineArray && Array.isArray(timelineArray) && timelineArray.length > 0;
    }

    renderTimelineSection(containerId, events) {
        const container = document.getElementById(containerId);
        if (!container || !events) return;

        const eventsHTML = events.map(event => {
            const impactClass = this.getImpactClass(event.impact);
            const impactLabel = event.impact || '';
            
            return `
                <div class="timeline-event ${impactClass}">
                    <div class="timeline-event-header">
                        <div class="timeline-event-date">
                            <i class="fas fa-calendar-alt"></i>
                            ${event.date}
                        </div>
                        ${impactLabel ? `<span class="timeline-event-impact ${impactClass}">${impactLabel}</span>` : ''}
                    </div>
                    <div class="timeline-event-title">${event.title}</div>
                    <div class="timeline-event-description">${event.description}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = eventsHTML;
    }

    getImpactClass(impact) {
        if (!impact) return 'low';
        
        const impactUpper = impact.toString().toUpperCase();
        if (impactUpper.includes('CRITICAL') || impactUpper.includes('PEAK')) return 'critical';
        if (impactUpper.includes('HIGH') || impactUpper.includes('DISTRIBUTION')) return 'high';
        if (impactUpper.includes('MEDIUM')) return 'medium';
        return 'low';
    }

    getImpactColor(impact) {
        if (!impact) return 'secondary';
        
        const impactUpper = impact.toString().toUpperCase();
        if (impactUpper === 'BULLISH') return 'success';
        if (impactUpper === 'BEARISH') return 'danger';
        if (impactUpper === 'NEUTRAL') return 'secondary';
        return 'secondary';
    }

    /**
     * Update trend icons
     */
    renderTrendIcons() {
        this.updateTrendIcon('btc-trend-icon', this.data.marketOverview?.bitcoin?.trendIcon);
        this.updateTrendIcon('eth-trend-icon', this.data.marketOverview?.ethereum?.trendIcon);
        this.updateTrendIcon('total-trend-icon', this.data.marketOverview?.totalMarketCap?.trendIcon);
        this.updateTrendIcon('dom-trend-icon', this.data.marketOverview?.bitcoinDominance?.trendIcon);
        this.updateTrendIcon('alt-trend-icon', this.data.marketOverview?.altcoinMarketCap?.trendIcon);
        
        this.updateAlertClasses();
        this.applyTrendClassesToPercentageElements();
    }

    applyTrendClassesToPercentageElements() {
        const changeElements = [
            { selector: '[data-bind*="marketOverview.bitcoin.change"]', trendClass: this.data.marketOverview?.bitcoin?.trendClass },
            { selector: '[data-bind*="marketOverview.ethereum.change"]', trendClass: this.data.marketOverview?.ethereum?.trendClass },
            { selector: '[data-bind*="marketOverview.totalMarketCap.change"]', trendClass: this.data.marketOverview?.totalMarketCap?.trendClass },
            { selector: '[data-bind*="marketOverview.bitcoinDominance.change"]', trendClass: this.data.marketOverview?.bitcoinDominance?.trendClass }
        ];

        changeElements.forEach(({ selector, trendClass }) => {
            const element = document.querySelector(selector);
            if (element && trendClass) {
                element.classList.remove('trend-up', 'trend-down', 'trend-neutral');
                element.classList.add(trendClass);
            }
        });
    }

    updateTrendIcon(elementId, iconClass) {
        const element = document.getElementById(elementId);
        if (element && iconClass) {
            element.className = `fas ${iconClass}`;
        }
    }

    updateAlertClasses() {
        const signalAlert = document.querySelector('[data-bind*="tradingActionPlan.primarySignal.signalColor"]');
        if (signalAlert && this.data.tradingActionPlan?.primarySignal?.signalColor) {
            const colorClass = this.data.tradingActionPlan.primarySignal.signalColor;
            signalAlert.className = signalAlert.className.replace(/alert-\w+/g, '') + ` alert-${colorClass}`;
        }

        const signalIcon = document.querySelector('[data-bind*="tradingActionPlan.primarySignal.signalIcon"]');
        if (signalIcon && this.data.tradingActionPlan?.primarySignal?.signalIcon) {
            const iconClass = this.data.tradingActionPlan.primarySignal.signalIcon;
            signalIcon.className = `fas ${iconClass} mr-2`;
        }

        const riskElement = document.querySelector('[data-bind*="riskManagement.overallRisk.color"]');
        if (riskElement && this.data.riskManagement?.overallRisk?.color) {
            const colorClass = this.data.riskManagement.overallRisk.color;
            riskElement.className = riskElement.className.replace(/text-\w+/g, '') + ` text-${colorClass}`;
        }

        const riskAlert = document.querySelector('[data-bind*="riskManagement.riskAlert.alertColor"]');
        if (riskAlert && this.data.riskManagement?.riskAlert?.alertColor) {
            const alertColor = this.data.riskManagement.riskAlert.alertColor;
            riskAlert.className = riskAlert.className.replace(/alert-\w+/g, '') + ` alert-${alertColor}`;
        }
    }

    /**
     * Update progress bars
     */
    updateProgressBars() {
        const domProgress = document.getElementById('dominance-progress');
        if (domProgress && this.data.marketOverview?.bitcoinDominance?.percentage) {
            const percentage = parseFloat(this.data.marketOverview.bitcoinDominance.percentage);
            domProgress.style.width = `${percentage}%`;
            domProgress.setAttribute('aria-valuenow', percentage);
        }

        const fearGreedProgress = document.getElementById('fear-greed-progress');
        if (fearGreedProgress && this.data.sentimentData?.fearGreedIndex?.value) {
            const value = parseFloat(this.data.sentimentData.fearGreedIndex.value);
            fearGreedProgress.style.width = `${value}%`;
            fearGreedProgress.setAttribute('aria-valuenow', value);
        }

        const cycleProgress = document.getElementById('cycle-progress-bar');
        if (cycleProgress && this.data.cycleAnalysis?.currentPosition?.cyclePositionPercent) {
            const percentage = parseFloat(this.data.cycleAnalysis.currentPosition.cyclePositionPercent);
            cycleProgress.style.width = `${percentage}%`;
        }

        this.updateProbabilityBar('pump-1w-progress', this.data.marketProbabilities?.pumpProbability1W);
        this.updateProbabilityBar('pump-1m-progress', this.data.marketProbabilities?.pumpProbability1M);
        this.updateProbabilityBar('dump-30d-progress', this.data.marketProbabilities?.dumpRisk30D);
        this.updateProbabilityBar('sideways-progress', this.data.marketProbabilities?.sidewaysProbability);
    }

    updateProbabilityBar(elementId, value) {
        const element = document.getElementById(elementId);
        if (element && value) {
            const percentage = parseFloat(value);
            element.style.width = `${percentage}%`;
        }
    }

    /**
     * Update dominance chart if Chart.js is available
     */
    updateDominanceChart() {
        if (typeof Chart === 'undefined') {
            console.log('Chart.js not loaded yet, skipping chart update');
            return;
        }

        if (!this.data.marketOverview?.bitcoinDominance?.percentage) {
            console.log('Bitcoin dominance data not available');
            return;
        }

        const btcDominance = parseFloat(this.data.marketOverview.bitcoinDominance.percentage);
        const altDominance = 100 - btcDominance;
        
        if (window.dominanceChart && window.dominanceChart.data && window.dominanceChart.data.datasets) {
            try {
                window.dominanceChart.data.datasets[0].data = [btcDominance, altDominance];
                window.dominanceChart.update();
                console.log('✅ Dominance chart updated successfully');
            } catch (error) {
                console.warn('Failed to update dominance chart:', error);
            }
        } else {
            console.log('Dominance chart not initialized yet, will update when ready');
            window.pendingChartUpdate = { btcDominance, altDominance };
        }
    }

    /**
     * Update Fear & Greed Index large display
     */
    updateFearGreedGauge() {
        try {
            console.log('🎯 Updating Fear & Greed Index display...');
            
            if (!this.data || !this.data.sentimentData?.fearGreedIndex?.value) {
                console.warn('⚠️ Fear & Greed Index data not available');
                return;
            }

            const fearGreedValue = parseFloat(this.data.sentimentData.fearGreedIndex.value);
            const fearGreedLabel = this.data.sentimentData.fearGreedIndex.label;

            if (isNaN(fearGreedValue)) {
                console.error('❌ Invalid Fear & Greed value:', this.data.sentimentData.fearGreedIndex.value);
                return;
            }

            console.log(`📊 Fear & Greed Index: ${fearGreedValue} (${fearGreedLabel})`);

            const valueElement = document.getElementById('fear-greed-value');
            if (valueElement) {
                valueElement.classList.remove('text-danger', 'text-warning', 'text-primary', 'text-success', 'text-dark');
                
                if (fearGreedValue <= 24) {
                    valueElement.classList.add('text-danger');
                    console.log('🔴 Applied Extreme Fear color to value');
                } else if (fearGreedValue <= 44) {
                    valueElement.classList.add('text-warning');
                    console.log('🟡 Applied Fear color to value');
                } else if (fearGreedValue <= 55) {
                    valueElement.classList.add('text-primary');
                    console.log('🔵 Applied Neutral color to value');
                } else if (fearGreedValue <= 75) {
                    valueElement.classList.add('text-success');
                    console.log('🟢 Applied Greed color to value');
                } else {
                    valueElement.classList.add('text-success');
                    console.log('🟢 Applied Extreme Greed color to value');
                }
            }
        } catch (error) {
            console.error('❌ Error updating Fear & Greed display:', error);
        }
    }

    /**
     * Get default/fallback data
     */
    getDefaultData() {
        return {
            "reportMetadata": {
                "weekDate": "Week of June 16, 2025",
                "reportNumber": "1",
                "generationDate": "June 16, 2025",
                "methodology": "COMPREHENSIVE-REPORT-GUIDE.md v2.0",
                "validationStatus": "FALLBACK",
                "lastValidated": new Date().toISOString()
            },
            "marketOverview": {
                "bitcoin": {
                    "price": "0",
                    "change": "0.0%",
                    "trendClass": "trend-neutral",
                    "trendIcon": "fa-arrow-right",
                    "_meta": { "source": "fallback" }
                },
                "ethereum": {
                    "price": "0",
                    "change": "0.0%",
                    "trendClass": "trend-neutral",
                    "trendIcon": "fa-arrow-right",
                    "_meta": { "source": "fallback" }
                },
                "totalMarketCap": {
                    "value": "$0.00T",
                    "change": "0.0%",
                    "trendClass": "trend-neutral",
                    "trendIcon": "fa-arrow-right",
                    "_meta": { "source": "fallback" }
                },
                "bitcoinDominance": {
                    "percentage": "50.0",
                    "change": "0.0%",
                    "trendClass": "trend-neutral",
                    "trendIcon": "fa-arrow-right",
                    "_meta": { "source": "fallback" }
                },
                "altcoinMarketCap": {
                    "value": "$0.00T",
                    "change": "0.0%",
                    "trendClass": "trend-neutral",
                    "trendIcon": "fa-arrow-right",
                    "_meta": { "source": "fallback" }
                }
            },
            "sentimentData": {
                "fearGreedIndex": {
                    "value": "50",
                    "label": "Neutral",
                    "_meta": { "source": "fallback" }
                }
            },
            "newsAndEvents": {
                "newsItems": [],
                "economicEvents": [],
                "cryptoEvents": []
            }
        };
    }
}

// Initialize the data engine when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.cryptoEngine = new CryptoDataEngine();
    console.log('🚀 Enhanced Crypto Data Engine with Phase 1 improvements loaded');
});
