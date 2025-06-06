/**
 * Crypto Market Analysis Data Engine
 * A lightweight vanilla JavaScript data binding solution
 * Author: AI Assistant
 * Created: June 2025
 */

class CryptoDataEngine {
    constructor() {
        this.data = null;
        this.liveData = null; // For API data
        this.bindingTypes = {
            'text': this.bindText,
            'html': this.bindHTML, 
            'class': this.bindClass,
            'attribute': this.bindAttribute,
            'style': this.bindStyle
        };
        this.templates = {};
        
        // API Configuration
        this.apiConfig = {
            coinGeckoBase: 'https://api.coingecko.com/api/v3',
            fearGreedApi: 'https://api.alternative.me/fng/',
            rateLimit: 30, // calls per minute for CoinGecko
            retryDelay: 2000, // 2 seconds
            maxRetries: 3
        };
        
        this.init();
    }

    /**
     * Initialize the data engine
     */
    async init() {
        try {
            console.log('🚀 Initializing Crypto Data Engine...');
            this.updateStatusIndicator('🔄 Loading...', 'loading');
            
            await this.loadData();
            await this.fetchLiveMarketData(); // Fetch live API data
            await this.bindAll();
            
            // Render templates with error handling for each section
            await this.renderTemplatesSafely();
            
            // Start auto-refresh every 1 minute automatically
            this.startAutoRefresh(1);
            
            this.updateStatusIndicator('🟢 Live (1min refresh)', 'success');
            console.log('✅ Data Engine initialized successfully');
            console.log('⏰ Auto-refresh started: Every 1 minute');
        } catch (error) {
            console.error('❌ Failed to initialize Data Engine:', error);
            this.updateStatusIndicator('🔴 Offline', 'error');
            // Continue with fallback data to prevent complete failure
            this.data = this.getDefaultData();
            try {
                await this.bindAll();
                console.log('⚠️ Data Engine running with fallback data');
            } catch (fallbackError) {
                console.error('❌ Complete initialization failure:', fallbackError);
            }
        }
    }

    /**
     * Render templates with individual error handling
     */
    async renderTemplatesSafely() {
        const tasks = [
            { name: 'News Items', fn: () => this.renderNewsItems() },
            { name: 'Economic Events', fn: () => this.renderEconomicEvents() },
            { name: 'Crypto Events', fn: () => this.renderCryptoEvents() },
            { name: 'Trading Timeline', fn: () => this.renderTradingTimeline() },
            { name: 'Trend Icons', fn: () => this.renderTrendIcons() },
            { name: 'Progress Bars', fn: () => this.updateProgressBars() },
            { name: 'Fear & Greed Display', fn: () => this.updateFearGreedGauge() },
            { name: 'Dominance Chart', fn: () => this.updateDominanceChart() }
        ];

        for (const task of tasks) {
            try {
                await task.fn();
                console.log(`✅ ${task.name} rendered successfully`);
            } catch (error) {
                console.warn(`⚠️ Failed to render ${task.name}:`, error);
                // Continue with other tasks
            }
        }
    }

    /**
     * Load JSON data from data.json file
     */
    async loadData() {
        try {
            console.log('📊 Loading data from ./data.json...');
            const response = await fetch('./data.json');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.warn('⚠️ Response is not JSON, attempting to parse anyway...');
            }
            
            this.data = await response.json();
            console.log('📊 Data loaded successfully. Sections:', Object.keys(this.data));
            
            // Validate critical data sections
            this.validateData();
            
        } catch (error) {
            console.error('❌ Failed to load data.json:', error);
            console.log('🔄 Attempting to load fallback data...');
            
            // Fallback to default data structure
            this.data = this.getDefaultData();
            console.log('⚠️ Using fallback data structure');
        }
    }

    /**
     * Validate that critical data sections exist
     */
    validateData() {
        const requiredSections = [
            'reportMetadata',
            'marketOverview', 
            'sentimentData',
            'onChainMetrics',
            'cycleAnalysis',
            'newsAndEvents'
        ];

        const missingSections = requiredSections.filter(section => !this.data[section]);
        
        if (missingSections.length > 0) {
            console.warn('⚠️ Missing data sections:', missingSections);
        } else {
            console.log('✅ All critical data sections present');
        }
    }

    /**
     * Bind all elements with data-bind attributes
     */
    async bindAll() {
        const elements = document.querySelectorAll('[data-bind]');
        console.log(`🔗 Found ${elements.length} elements to bind`);

        elements.forEach(element => {
            const bindExpression = element.getAttribute('data-bind');
            this.processBinding(element, bindExpression);
        });
    }

    /**
     * Process individual binding expressions
     * Supports: data-bind="text:reportMetadata.weekDate"
     *          data-bind="class:marketOverview.bitcoin.trendClass"
     *          data-bind="attribute:src:marketOverview.bitcoin.icon"
     */
    processBinding(element, expression) {
        try {
            const parts = expression.split(':');
            const bindType = parts[0].trim();
            const valuePath = parts[1] ? parts[1].trim() : '';
            const extra = parts[2] ? parts[2].trim() : '';

            if (this.bindingTypes[bindType]) {
                const value = this.getNestedValue(this.data, valuePath);
                this.bindingTypes[bindType].call(this, element, value, extra);
                
                // Special handling for percentage change text elements
                if (bindType === 'text' && valuePath.includes('.change')) {
                    this.applyTrendClassToChangeElement(element, valuePath);
                }
            } else {
                console.warn(`Unknown binding type: ${bindType}`);
            }
        } catch (error) {
            console.error(`Binding error for expression "${expression}":`, error);
        }
    }

    /**
     * Apply trend class to percentage change elements
     */
    applyTrendClassToChangeElement(element, valuePath) {
        try {
            // Get the corresponding trend class path
            const trendClassPath = valuePath.replace('.change', '.trendClass');
            const trendClass = this.getNestedValue(this.data, trendClassPath);
            
            if (trendClass) {
                // Remove existing trend classes
                element.classList.remove('trend-up', 'trend-down', 'trend-neutral');
                // Add the new trend class
                element.classList.add(trendClass);
            }
        } catch (error) {
            // Silently fail if trend class doesn't exist
        }
    }

    /**
     * Binding type handlers
     */
    bindText(element, value) {
        element.textContent = value || '';
    }

    bindHTML(element, value) {
        element.innerHTML = value || '';
    }

    bindClass(element, value) {
        if (value) {
            // Remove existing trend classes and text color classes
            element.classList.remove('trend-up', 'trend-down', 'trend-neutral');
            element.classList.remove('alert-success', 'alert-warning', 'alert-danger', 'alert-info');
            element.classList.remove('text-success', 'text-warning', 'text-danger', 'text-info', 'text-muted');
            
            // Add the new class with appropriate prefix
            if (value.includes('alert-') || value.includes('text-') || value.includes('trend-')) {
                element.classList.add(value);
            } else {
                // For risk levels and other color-coded values, add appropriate prefix
                if (['success', 'warning', 'danger', 'info'].includes(value)) {
                    element.classList.add(`text-${value}`);
                } else {
                    element.classList.add(value);
                }
            }
        }
    }

    bindAttribute(element, value, attributeName) {
        if (attributeName && value) {
            element.setAttribute(attributeName, value);
        }
    }

    bindStyle(element, value, styleProp) {
        if (styleProp && value) {
            element.style[styleProp] = value;
        }
    }

    /**
     * Get nested object value using dot notation
     * e.g., getNestedValue(data, 'marketOverview.bitcoin.price')
     */
    getNestedValue(obj, path) {
        if (!path) return obj;
        
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }

    /**
     * ===================================================================
     * LIVE API DATA FETCHING METHODS
     * ===================================================================
     */

    /**
     * Fetch live market data from multiple free APIs
     */
    async fetchLiveMarketData() {
        try {
            console.log('📡 Fetching live market data from APIs...');
            this.updateStatusIndicator('🔄 Refreshing...', 'refreshing');
            
            this.liveData = {};
            
            // Fetch in parallel for better performance
            const [priceData, globalData, fearGreedData] = await Promise.allSettled([
                this.fetchCoinPrices(),
                this.fetchGlobalData(),
                this.fetchFearGreedIndex()
            ]);

            // Process results
            if (priceData.status === 'fulfilled') {
                this.liveData.prices = priceData.value;
                console.log('✅ Price data fetched successfully');
            } else {
                console.warn('⚠️ Failed to fetch price data:', priceData.reason);
            }

            if (globalData.status === 'fulfilled') {
                this.liveData.global = globalData.value;
                console.log('✅ Global market data fetched successfully');
            } else {
                console.warn('⚠️ Failed to fetch global data:', globalData.reason);
            }

            if (fearGreedData.status === 'fulfilled') {
                this.liveData.fearGreed = fearGreedData.value;
                console.log('✅ Fear & Greed Index fetched successfully');
            } else {
                console.warn('⚠️ Failed to fetch Fear & Greed data:', fearGreedData.reason);
            }

            // Update the main data object with live values
            this.mergeLiveDataWithStatic();

            console.log('🎯 Live market data integration complete');
            
        } catch (error) {
            console.error('❌ Error fetching live market data:', error);
            this.updateStatusIndicator('🔴 API Error', 'error');
            console.log('📊 Continuing with static data from data.json');
            throw error; // Re-throw to handle in calling function
        }
    }

    /**
     * Fetch Bitcoin and Ethereum prices from CoinGecko
     */
    async fetchCoinPrices() {
        const url = `${this.apiConfig.coinGeckoBase}/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_market_cap=true&include_24hr_change=true&include_24hr_vol=true`;
        
        return this.retryApiCall(async () => {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        });
    }

    /**
     * Fetch global cryptocurrency market data from CoinGecko
     */
    async fetchGlobalData() {
        const url = `${this.apiConfig.coinGeckoBase}/global`;
        
        return this.retryApiCall(async () => {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`CoinGecko Global API error: ${response.status} ${response.statusText}`);
            }
            const result = await response.json();
            return result.data; // Extract the data object
        });
    }

    /**
     * Fetch Fear & Greed Index from Alternative.me
     */
    async fetchFearGreedIndex() {
        return this.retryApiCall(async () => {
            const response = await fetch(this.apiConfig.fearGreedApi);
            if (!response.ok) {
                throw new Error(`Fear & Greed API error: ${response.status} ${response.statusText}`);
            }
            const result = await response.json();
            return result.data[0]; // Get the latest entry
        });
    }

    /**
     * Retry API calls with exponential backoff
     */
    async retryApiCall(apiCall, retries = this.apiConfig.maxRetries) {
        try {
            return await apiCall();
        } catch (error) {
            if (retries > 0) {
                console.log(`⏳ API call failed, retrying in ${this.apiConfig.retryDelay}ms... (${retries} retries left)`);
                await new Promise(resolve => setTimeout(resolve, this.apiConfig.retryDelay));
                return this.retryApiCall(apiCall, retries - 1);
            }
            throw error;
        }
    }

    /**
     * Merge live API data with static data.json content
     */
    mergeLiveDataWithStatic() {
        if (!this.data || !this.liveData) return;

        try {
            // Update Bitcoin data
            if (this.liveData.prices?.bitcoin) {
                const btcData = this.liveData.prices.bitcoin;
                if (this.data.marketOverview?.bitcoin) {
                    this.data.marketOverview.bitcoin.price = this.formatCurrency(btcData.usd);
                    this.data.marketOverview.bitcoin.change = this.formatPercentage(btcData.usd_24h_change);
                    this.data.marketOverview.bitcoin.trendClass = this.getTrendClass(btcData.usd_24h_change);
                    this.data.marketOverview.bitcoin.trendIcon = this.getTrendIcon(btcData.usd_24h_change);
                }
            }

            // Update Ethereum data
            if (this.liveData.prices?.ethereum) {
                const ethData = this.liveData.prices.ethereum;
                if (this.data.marketOverview?.ethereum) {
                    this.data.marketOverview.ethereum.price = this.formatCurrency(ethData.usd);
                    this.data.marketOverview.ethereum.change = this.formatPercentage(ethData.usd_24h_change);
                    this.data.marketOverview.ethereum.trendClass = this.getTrendClass(ethData.usd_24h_change);
                    this.data.marketOverview.ethereum.trendIcon = this.getTrendIcon(ethData.usd_24h_change);
                }
            }

            // Update global market data
            if (this.liveData.global) {
                const globalData = this.liveData.global;
                
                // Total market cap
                if (this.data.marketOverview?.totalMarketCap && globalData.total_market_cap?.usd) {
                    this.data.marketOverview.totalMarketCap.value = this.formatMarketCap(globalData.total_market_cap.usd);
                    if (globalData.market_cap_change_percentage_24h_usd !== undefined) {
                        this.data.marketOverview.totalMarketCap.change = this.formatPercentage(globalData.market_cap_change_percentage_24h_usd);
                        this.data.marketOverview.totalMarketCap.trendClass = this.getTrendClass(globalData.market_cap_change_percentage_24h_usd);
                        this.data.marketOverview.totalMarketCap.trendIcon = this.getTrendIcon(globalData.market_cap_change_percentage_24h_usd);
                    }
                }

                // Bitcoin dominance
                if (this.data.marketOverview?.bitcoinDominance && globalData.market_cap_percentage?.btc) {
                    const oldDominance = parseFloat(this.data.marketOverview.bitcoinDominance.percentage) || 0;
                    const newDominance = globalData.market_cap_percentage.btc;
                    const dominanceChange = newDominance - oldDominance;
                    
                    this.data.marketOverview.bitcoinDominance.percentage = newDominance.toFixed(1);
                    this.data.marketOverview.bitcoinDominance.change = this.formatPercentage(dominanceChange);
                    this.data.marketOverview.bitcoinDominance.trendClass = this.getTrendClass(dominanceChange);
                    this.data.marketOverview.bitcoinDominance.trendIcon = this.getTrendIcon(dominanceChange);
                }

                // Calculate altcoin market cap
                if (globalData.total_market_cap?.usd && this.liveData.prices?.bitcoin?.usd_market_cap) {
                    const totalMarketCap = globalData.total_market_cap.usd;
                    const btcMarketCap = this.liveData.prices.bitcoin.usd_market_cap;
                    const altMarketCap = totalMarketCap - btcMarketCap;
                    
                    if (this.data.marketOverview?.altcoinMarketCap) {
                        this.data.marketOverview.altcoinMarketCap.value = this.formatMarketCap(altMarketCap);
                        
                        // Calculate altcoin change (approximate)
                        if (globalData.market_cap_change_percentage_24h_usd !== undefined) {
                            this.data.marketOverview.altcoinMarketCap.change = this.formatPercentage(globalData.market_cap_change_percentage_24h_usd);
                            this.data.marketOverview.altcoinMarketCap.trendClass = this.getTrendClass(globalData.market_cap_change_percentage_24h_usd);
                            this.data.marketOverview.altcoinMarketCap.trendIcon = this.getTrendIcon(globalData.market_cap_change_percentage_24h_usd);
                        }
                    }
                }
            }

            // Update Fear & Greed Index
            if (this.liveData.fearGreed) {
                const fgData = this.liveData.fearGreed;
                if (this.data.sentimentData?.fearGreedIndex) {
                    this.data.sentimentData.fearGreedIndex.value = fgData.value;
                    this.data.sentimentData.fearGreedIndex.label = fgData.value_classification;
                }
            }

            console.log('🔄 Successfully merged live API data with static data');

        } catch (error) {
            console.error('❌ Error merging live data:', error);
        }
    }

    /**
     * ===================================================================
     * FORMATTING HELPER METHODS
     * ===================================================================
     */

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
     * Get trend class based on percentage change
     */
    getTrendClass(change) {
        if (change === null || change === undefined) return 'trend-neutral';
        if (change > 0) return 'trend-up';
        if (change < 0) return 'trend-down';
        return 'trend-neutral';
    }

    /**
     * Get trend icon based on percentage change
     */
    getTrendIcon(change) {
        if (change === null || change === undefined) return 'fa-arrow-right';
        if (change > 0) return 'fa-arrow-up';
        if (change < 0) return 'fa-arrow-down';
        return 'fa-arrow-right';
    }

    /**
     * ===================================================================
     * END OF LIVE API METHODS
     * ===================================================================
     */

    /**
     * Render complex template sections
     */
    async renderTemplates() {
        await this.renderNewsItems();
        await this.renderEconomicEvents(); 
        await this.renderCryptoEvents();
        await this.renderTradingTimeline();
        await this.renderTrendIcons();
        await this.updateProgressBars();
        await this.updateDominanceChart();
    }

    /**
     * Render news items with template
     */
    renderNewsItems() {
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
        this.renderTimelineSection('next-30-days-container', this.data.tradingTimeline?.next30Days);
        this.renderTimelineSection('next-90-days-container', this.data.tradingTimeline?.next90Days);
        this.renderTimelineSection('major-cycle-events-container', this.data.tradingTimeline?.majorCycleEvents);
    }

    renderTimelineSection(containerId, events) {
        const container = document.getElementById(containerId);
        if (!container || !events) return;

        const eventsHTML = events.map(event => `
            <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="font-weight-bold text-primary">${event.date}</span>
                    <span class="badge badge-${this.getImpactBadgeColor(event.impact)}">${event.impact}</span>
                </div>
                <div class="text-sm">${event.title}</div>
                <div class="text-xs text-muted">${event.description}</div>
            </div>
        `).join('');

        container.innerHTML = eventsHTML;
    }

    /**
     * Update trend icons and alert classes based on data
     */
    renderTrendIcons() {
        // Bitcoin trend
        this.updateTrendIcon('btc-trend-icon', this.data.marketOverview?.bitcoin?.trendIcon);
        this.updateTrendIcon('eth-trend-icon', this.data.marketOverview?.ethereum?.trendIcon);
        this.updateTrendIcon('total-trend-icon', this.data.marketOverview?.totalMarketCap?.trendIcon);
        this.updateTrendIcon('dom-trend-icon', this.data.marketOverview?.bitcoinDominance?.trendIcon);
        this.updateTrendIcon('alt-trend-icon', this.data.marketOverview?.altcoinMarketCap?.trendIcon);
        
        // Update alert classes for trading signals and risk management
        this.updateAlertClasses();
        
        // Apply trend classes to percentage change text elements
        this.applyTrendClassesToPercentageElements();
    }

    /**
     * Apply trend classes to all percentage change elements
     */
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
                // Remove existing trend classes
                element.classList.remove('trend-up', 'trend-down', 'trend-neutral');
                // Add the new trend class
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

    /**
     * Update alert and dynamic classes throughout the page
     */
    updateAlertClasses() {
        // Trading signal alert
        const signalAlert = document.querySelector('[data-bind*="tradingActionPlan.primarySignal.signalColor"]');
        if (signalAlert && this.data.tradingActionPlan?.primarySignal?.signalColor) {
            const colorClass = this.data.tradingActionPlan.primarySignal.signalColor;
            signalAlert.className = signalAlert.className.replace(/alert-\w+/g, '') + ` alert-${colorClass}`;
        }

        // Trading signal icon
        const signalIcon = document.querySelector('[data-bind*="tradingActionPlan.primarySignal.signalIcon"]');
        if (signalIcon && this.data.tradingActionPlan?.primarySignal?.signalIcon) {
            const iconClass = this.data.tradingActionPlan.primarySignal.signalIcon;
            signalIcon.className = `fas ${iconClass} mr-2`;
        }

        // Risk management overall risk color
        const riskElement = document.querySelector('[data-bind*="riskManagement.overallRisk.color"]');
        if (riskElement && this.data.riskManagement?.overallRisk?.color) {
            const colorClass = this.data.riskManagement.overallRisk.color;
            riskElement.className = riskElement.className.replace(/text-\w+/g, '') + ` text-${colorClass}`;
        }

        // Risk alert
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
        // Dominance progress bar
        const domProgress = document.getElementById('dominance-progress');
        if (domProgress && this.data.marketOverview?.bitcoinDominance?.percentage) {
            const percentage = parseFloat(this.data.marketOverview.bitcoinDominance.percentage);
            domProgress.style.width = `${percentage}%`;
            domProgress.setAttribute('aria-valuenow', percentage);
        }

        // Fear & Greed progress bar
        const fearGreedProgress = document.getElementById('fear-greed-progress');
        if (fearGreedProgress && this.data.sentimentData?.fearGreedIndex?.value) {
            const value = parseFloat(this.data.sentimentData.fearGreedIndex.value);
            fearGreedProgress.style.width = `${value}%`;
            fearGreedProgress.setAttribute('aria-valuenow', value);
        }

        // Cycle progress bar
        const cycleProgress = document.getElementById('cycle-progress-bar');
        if (cycleProgress && this.data.cycleAnalysis?.currentPosition?.cyclePositionPercent) {
            const percentage = parseFloat(this.data.cycleAnalysis.currentPosition.cyclePositionPercent);
            cycleProgress.style.width = `${percentage}%`;
        }

        // Market probability bars
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
        // Check if Chart.js is loaded and chart exists
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
        
        // Check if chart instance exists
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
            // Store the data for later use when chart is ready
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
                console.warn('⚠️ Fear & Greed Index data not available, data:', this.data?.sentimentData);
                return;
            }

            const fearGreedValue = parseFloat(this.data.sentimentData.fearGreedIndex.value);
            const fearGreedLabel = this.data.sentimentData.fearGreedIndex.label;

            if (isNaN(fearGreedValue)) {
                console.error('❌ Invalid Fear & Greed value:', this.data.sentimentData.fearGreedIndex.value);
                return;
            }

            console.log(`📊 Fear & Greed Index: ${fearGreedValue} (${fearGreedLabel})`);

            // Update large number color based on value
            const valueElement = document.getElementById('fear-greed-value');
            if (valueElement) {
                // Remove existing color classes
                valueElement.classList.remove('text-danger', 'text-warning', 'text-primary', 'text-success', 'text-dark');
                
                // Apply color based on value zones
                if (fearGreedValue <= 24) {
                    valueElement.classList.add('text-danger'); // Extreme Fear: Red
                    console.log('🔴 Applied Extreme Fear color to value');
                } else if (fearGreedValue <= 44) {
                    valueElement.classList.add('text-warning'); // Fear: Yellow/Orange  
                    console.log('🟡 Applied Fear color to value');
                } else if (fearGreedValue <= 55) {
                    valueElement.classList.add('text-primary'); // Neutral: Blue
                    console.log('🔵 Applied Neutral color to value');
                } else if (fearGreedValue <= 75) {
                    valueElement.classList.add('text-success'); // Greed: Green
                    console.log('🟢 Applied Greed color to value');
                } else {
                    valueElement.classList.add('text-success'); // Extreme Greed: Deep Green
                    console.log('🟢 Applied Extreme Greed color to value');
                }
            } else {
                console.warn('⚠️ Fear & Greed value element not found');
            }

            // Update badge color based on value
            const badge = document.getElementById('fear-greed-badge');
            if (badge) {
                // Remove existing color classes
                badge.classList.remove('bg-danger', 'bg-warning', 'bg-primary', 'bg-success', 'text-white', 'text-dark');
                
                // Apply color based on value zones (matching the large number)
                if (fearGreedValue <= 24) {
                    badge.classList.add('bg-danger', 'text-white'); // Extreme Fear: Red
                    console.log('🔴 Applied Extreme Fear styling to badge');
                } else if (fearGreedValue <= 44) {
                    badge.classList.add('bg-warning', 'text-dark'); // Fear: Yellow/Orange  
                    console.log('🟡 Applied Fear styling to badge');
                } else if (fearGreedValue <= 55) {
                    badge.classList.add('bg-primary', 'text-white'); // Neutral: Blue
                    console.log('🔵 Applied Neutral styling to badge');
                } else if (fearGreedValue <= 75) {
                    badge.classList.add('bg-success', 'text-white'); // Greed: Green
                    console.log('🟢 Applied Greed styling to badge');
                } else {
                    badge.classList.add('bg-success', 'text-white'); // Extreme Greed: Deep Green
                    console.log('🟢 Applied Extreme Greed styling to badge');
                }
            } else {
                console.warn('⚠️ Fear & Greed badge element not found');
            }

            // Update progress bar
            const progressBar = document.getElementById('fear-greed-progress');
            if (progressBar) {
                // Remove existing color classes
                progressBar.classList.remove('bg-danger', 'bg-warning', 'bg-primary', 'bg-success');
                
                // Set width and color
                progressBar.style.width = `${fearGreedValue}%`;
                
                // Apply matching color to progress bar
                if (fearGreedValue <= 24) {
                    progressBar.classList.add('bg-danger');
                } else if (fearGreedValue <= 44) {
                    progressBar.classList.add('bg-warning');
                } else if (fearGreedValue <= 55) {
                    progressBar.classList.add('bg-primary');
                } else if (fearGreedValue <= 75) {
                    progressBar.classList.add('bg-success');
                } else {
                    progressBar.classList.add('bg-success');
                }
                
                console.log(`📊 Updated progress bar to ${fearGreedValue}%`);
            } else {
                console.warn('⚠️ Fear & Greed progress bar element not found');
            }

            console.log('✅ Fear & Greed Index display updated successfully');
            
        } catch (error) {
            console.error('❌ Failed to update Fear & Greed display:', error);
            console.error('Stack trace:', error.stack);
        }
    }

    /**
     * Helper functions for styling
     */
    getImpactColor(impact) {
        const colorMap = {
            'Bullish': 'success',
            'Bearish': 'danger', 
            'Neutral': 'secondary'
        };
        return colorMap[impact] || 'secondary';
    }

    getImpactBadgeColor(impact) {
        const colorMap = {
            'HIGH IMPACT': 'warning',
            'CRITICAL': 'danger',
            'MEDIUM': 'info',
            'LOW': 'secondary',
            'PEAK': 'danger',
            'DISTRIBUTION': 'secondary',
            'ACCUMULATION': 'info',
            'BOTTOM': 'success'
        };
        return colorMap[impact] || 'secondary';
    }

    /**
     * Default data fallback with more comprehensive structure
     */
    getDefaultData() {
        return {
            reportMetadata: {
                weekDate: "Week of June 3, 2025",
                reportNumber: "1", 
                generationDate: "June 3, 2025"
            },
            marketOverview: {
                bitcoin: { 
                    price: "Loading...", 
                    change: "0%", 
                    trendClass: "trend-neutral", 
                    trendIcon: "fa-arrow-right" 
                },
                ethereum: { 
                    price: "Loading...", 
                    change: "0%", 
                    trendClass: "trend-neutral", 
                    trendIcon: "fa-arrow-right" 
                },
                totalMarketCap: { 
                    value: "Loading...", 
                    change: "0%", 
                    trendClass: "trend-neutral", 
                    trendIcon: "fa-arrow-right" 
                },
                bitcoinDominance: { 
                    percentage: "50", 
                    change: "0%", 
                    trendClass: "trend-neutral", 
                    trendIcon: "fa-arrow-right" 
                },
                altcoinMarketCap: { 
                    value: "Loading...", 
                    change: "0%", 
                    trendClass: "trend-neutral", 
                    trendIcon: "fa-arrow-right" 
                }
            },
            sentimentData: {
                fearGreedIndex: {
                    value: "50",
                    label: "Neutral"
                }
            },
            onChainMetrics: {
                exchangeFlow: {
                    value: "Loading...",
                    analysis: "Data loading..."
                },
                mvrvRatio: {
                    value: "Loading...",
                    analysis: "Data loading..."
                },
                sopr: {
                    value: "Loading...",
                    analysis: "Data loading..."
                }
            },
            cycleAnalysis: {
                currentPosition: {
                    cyclePositionPercent: "50",
                    cyclePhase: "Loading...",
                    cycleStartDate: "Loading...",
                    daysInCycle: "Loading..."
                },
                predictions: {
                    btcCyclePeakTarget: "Loading...",
                    predictedPeakDate: "Loading...",
                    peakConfidence: "50",
                    bearMarketStart: "Loading...",
                    bearMarketBottom: "Loading...",
                    bottomTimeline: "Loading..."
                }
            },
            tradingTimeline: {
                next30Days: [],
                next90Days: [],
                majorCycleEvents: []
            },
            marketProbabilities: {
                pumpProbability1W: "50",
                pumpProbability1M: "50",
                dumpRisk30D: "25",
                sidewaysProbability: "25"
            },
            newsAndEvents: {
                newsItems: [],
                economicEvents: [],
                cryptoEvents: []
            },
            tradingActionPlan: {
                primarySignal: {
                    signal: "LOADING",
                    signalColor: "warning",
                    signalIcon: "fa-pause",
                    reasoning: "Data loading..."
                },
                entryLevels: {
                    btcEntryLevel1: "Loading...",
                    btcEntry1Probability: "0",
                    btcEntryLevel2: "Loading...",
                    btcEntry2Probability: "0",
                    btcEntryLevel3: "Loading...",
                    btcEntry3Probability: "0"
                },
                exitTargets: {
                    btcTarget1: "Loading...",
                    btcTarget1Timeline: "Loading...",
                    btcTarget2: "Loading...",
                    btcTarget2Timeline: "Loading...",
                    btcStopLoss: "Loading..."
                },
                positionSizing: {
                    recommendedAllocation: "Loading...",
                    riskLevel: "Loading...",
                    timeHorizon: "Loading..."
                }
            },
            riskManagement: {
                overallRisk: {
                    level: "LOADING",
                    color: "warning"
                },
                riskMetrics: {
                    drawdownRisk: "Loading...",
                    volatilityIndex: "MEDIUM"
                },
                riskAlert: {
                    alertColor: "info",
                    message: "Data loading..."
                },
                portfolioAllocation: {
                    btc: "25",
                    eth: "25",
                    alts: "25",
                    cash: "25"
                }
            },
            analysis: {
                executiveSummary: "Loading market analysis data...",
                nextWeekOutlook: "Loading outlook data...",
                dataSources: "Data loading..."
            }
        };
    }

    /**
     * Called when dominance chart is ready to receive updates
     */
    onChartReady() {
        if (window.pendingChartUpdate && window.dominanceChart) {
            try {
                const { btcDominance, altDominance } = window.pendingChartUpdate;
                window.dominanceChart.data.datasets[0].data = [btcDominance, altDominance];
                window.dominanceChart.update();
                window.pendingChartUpdate = null; // Clear pending update
                console.log('✅ Applied pending chart update');
            } catch (error) {
                console.warn('Failed to apply pending chart update:', error);
            }
        }
    }

    /**
     * Refresh data (useful for future real-time updates)
     */
    async refresh() {
        console.log('🔄 Refreshing data...');
        await this.loadData();
        await this.fetchLiveMarketData(); // Refresh live API data
        await this.bindAll();
        await this.renderTemplatesSafely();
        console.log('✅ Data refreshed successfully');
    }

    /**
     * Public API for external access
     */
    getData(path) {
        return this.getNestedValue(this.data, path);
    }

    updateData(path, value) {
        // Implementation for updating data and re-binding
        // This would be useful for real-time updates
        console.log(`Updating ${path} to ${value}`);
    }

    /**
     * Set up automatic refresh of live data
     * @param {number} intervalMinutes - How often to refresh (in minutes)
     */
    startAutoRefresh(intervalMinutes = 1) {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        console.log(`⏰ Setting up auto-refresh every ${intervalMinutes} minute(s)`);
        
        this.refreshInterval = setInterval(async () => {
            try {
                const timestamp = new Date().toLocaleTimeString();
                console.log(`🔄 Auto-refreshing live market data... (${timestamp})`);
                
                await this.fetchLiveMarketData();
                await this.bindAll();
                await this.renderTemplatesSafely();
                
                console.log(`✅ Auto-refresh complete (${timestamp})`);
                
                // Update any "last updated" display if it exists
                this.updateLastRefreshTime();
                
            } catch (error) {
                console.error('❌ Auto-refresh failed:', error);
                this.updateStatusIndicator('🔴 Refresh failed', 'error');
                // Try to recover on next interval
            }
        }, intervalMinutes * 60 * 1000);
        
        // Update status to show auto-refresh is active
        this.updateStatusIndicator(`🟢 Live (${intervalMinutes}min refresh)`, 'success');
    }

    /**
     * Stop automatic refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            this.updateStatusIndicator('⏸️ Manual mode', 'neutral');
            console.log('⏹️ Auto-refresh stopped');
        }
    }

    /**
     * Refresh only the live API data (faster than full refresh)
     */
    async refreshLiveData() {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`🔄 Refreshing live market data only... (${timestamp})`);
        try {
            await this.fetchLiveMarketData();
            await this.bindAll();
            // Only update specific dynamic elements
            await this.updateProgressBars();
            await this.updateFearGreedGauge();
            await this.renderTrendIcons();
            
            this.updateLastRefreshTime();
            console.log(`✅ Live data refreshed successfully (${timestamp})`);
        } catch (error) {
            console.error('❌ Live data refresh failed:', error);
        }
    }

    /**
     * Update last refresh time display
     */
    updateLastRefreshTime() {
        try {
            const now = new Date();
            const timestamp = now.toLocaleTimeString();
            
            // Try to find and update any last-updated elements
            const lastUpdatedElements = document.querySelectorAll('[data-last-updated], .last-updated, #last-updated');
            lastUpdatedElements.forEach(element => {
                element.textContent = `Last updated: ${timestamp}`;
            });
            
            // Update live status indicator if it exists
            const statusIndicator = document.getElementById('live-status');
            if (statusIndicator) {
                statusIndicator.textContent = `🟢 Live (${timestamp})`;
                statusIndicator.className = 'live-status-indicator success';
            }
            
            // Also update document title to show refresh status
            if (document.title && !document.title.includes('●')) {
                document.title = '● ' + document.title.replace('● ', '');
                // Remove the dot after 2 seconds to create a "pulse" effect
                setTimeout(() => {
                    document.title = document.title.replace('● ', '');
                }, 2000);
            }
            
        } catch (error) {
            // Silently fail if elements don't exist
        }
    }

    /**
     * Update status indicator during refresh
     */
    updateStatusIndicator(status, type = 'loading') {
        try {
            const statusIndicator = document.getElementById('live-status');
            if (statusIndicator) {
                statusIndicator.textContent = status;
                statusIndicator.className = `live-status-indicator ${type}`;
            }
        } catch (error) {
            // Silently fail if element doesn't exist
        }
    }
}

// Initialize the data engine when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.cryptoDataEngine = new CryptoDataEngine();
    
    // Expose useful methods globally for console access
    window.refreshLiveData = () => window.cryptoDataEngine.refreshLiveData();
    window.startAutoRefresh = (minutes = 1) => window.cryptoDataEngine.startAutoRefresh(minutes);
    window.stopAutoRefresh = () => window.cryptoDataEngine.stopAutoRefresh();
    window.getRefreshStatus = () => {
        const isRunning = !!window.cryptoDataEngine.refreshInterval;
        console.log(`Auto-refresh is ${isRunning ? 'RUNNING' : 'STOPPED'}`);
        if (isRunning) {
            console.log('Current interval: Every 1 minute');
            console.log('To stop: stopAutoRefresh()');
            console.log('To change interval: startAutoRefresh(minutes)');
        } else {
            console.log('To start: startAutoRefresh(minutes)');
        }
        return isRunning;
    };
    
    console.log('🎯 Global methods available:');
    console.log('  - refreshLiveData() - Refresh market data now');
    console.log('  - startAutoRefresh(minutes) - Start auto-refresh (default: 1 min)');
    console.log('  - stopAutoRefresh() - Stop auto-refresh');
    console.log('  - getRefreshStatus() - Check if auto-refresh is running');
    console.log('');
    console.log('📊 Auto-refresh: ENABLED (every 1 minute)');
    console.log('💡 Tip: Watch for "🔄" and "✅" messages to see live updates');
});

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CryptoDataEngine;
}