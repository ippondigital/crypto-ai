/**
 * Live Crypto Data Fetcher with CORS Proxy Support
 * Fetches real-time cryptocurrency data using public APIs with CORS proxy
 * Updates every 60 seconds
 */

class LiveCryptoDataFetcher {
    constructor() {
        // CORS proxy services (free tier)
        this.corsProxies = [
            'https://cors-anywhere.herokuapp.com/',
            'https://api.allorigins.win/raw?url=',
            'https://corsproxy.io/?',
            'https://proxy.cors.sh/'
        ];
        
        this.currentProxyIndex = 0;
        
        // API endpoints
        this.apis = {
            coinGecko: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_market_cap=true&include_24hr_change=true',
            coinGeckoGlobal: 'https://api.coingecko.com/api/v3/global',
            fearGreed: 'https://api.alternative.me/fng/?limit=1',
            // Backup APIs
            coinCap: 'https://api.coincap.io/v2/assets?ids=bitcoin,ethereum',
            cryptoCompare: 'https://min-api.cryptocompare.com/data/pricemultifull?fsyms=BTC,ETH&tsyms=USD'
        };
        
        this.updateInterval = 60000; // 60 seconds
        this.retryDelay = 5000; // 5 seconds
        this.maxRetries = 3;
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing Live Crypto Data Fetcher...');
        
        // Initial fetch
        await this.fetchAllData();
        
        // Set up auto-refresh
        this.startAutoRefresh();
    }
    
    async fetchWithProxy(url, proxyIndex = this.currentProxyIndex) {
        const proxy = this.corsProxies[proxyIndex];
        const proxiedUrl = proxy + encodeURIComponent(url);
        
        try {
            console.log(`🔄 Fetching via proxy ${proxyIndex}: ${proxy}`);
            const response = await fetch(proxiedUrl, {
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.warn(`❌ Proxy ${proxyIndex} failed:`, error.message);
            
            // Try next proxy
            if (proxyIndex < this.corsProxies.length - 1) {
                return this.fetchWithProxy(url, proxyIndex + 1);
            }
            
            throw new Error('All CORS proxies failed');
        }
    }
    
    async fetchAllData() {
        console.log('📡 Fetching all live crypto data...');
        const startTime = Date.now();
        
        try {
            // Fetch data in parallel
            const [priceData, globalData, fearGreedData] = await Promise.allSettled([
                this.fetchPriceData(),
                this.fetchGlobalData(),
                this.fetchFearGreedData()
            ]);
            
            // Process results
            const liveData = {
                timestamp: new Date().toISOString(),
                fetchTime: Date.now() - startTime
            };
            
            if (priceData.status === 'fulfilled') {
                liveData.prices = priceData.value;
                console.log('✅ Price data fetched successfully');
            }
            
            if (globalData.status === 'fulfilled') {
                liveData.global = globalData.value;
                console.log('✅ Global data fetched successfully');
            }
            
            if (fearGreedData.status === 'fulfilled') {
                liveData.fearGreed = fearGreedData.value;
                console.log('✅ Fear & Greed data fetched successfully');
            }
            
            // Update the dashboard
            this.updateDashboard(liveData);
            
            console.log(`✅ Live data fetch complete in ${Date.now() - startTime}ms`);
            
        } catch (error) {
            console.error('❌ Failed to fetch live data:', error);
            // Try backup APIs
            await this.fetchBackupData();
        }
    }
    
    async fetchPriceData() {
        try {
            // Try CoinGecko first
            const data = await this.fetchWithProxy(this.apis.coinGecko);
            return data;
        } catch (error) {
            console.warn('⚠️ CoinGecko failed, trying CoinCap...');
            // Try CoinCap as backup
            const data = await this.fetchWithProxy(this.apis.coinCap);
            // Transform CoinCap data to match CoinGecko format
            return this.transformCoinCapData(data);
        }
    }
    
    async fetchGlobalData() {
        const data = await this.fetchWithProxy(this.apis.coinGeckoGlobal);
        return data.data || data;
    }
    
    async fetchFearGreedData() {
        const response = await this.fetchWithProxy(this.apis.fearGreed);
        return response.data?.[0] || response;
    }
    
    transformCoinCapData(data) {
        const transformed = {};
        
        if (data.data) {
            data.data.forEach(asset => {
                const id = asset.id.toLowerCase();
                transformed[id] = {
                    usd: parseFloat(asset.priceUsd),
                    usd_24h_change: parseFloat(asset.changePercent24Hr),
                    usd_market_cap: parseFloat(asset.marketCapUsd)
                };
            });
        }
        
        return transformed;
    }
    
    updateDashboard(liveData) {
        console.log('🔄 Updating dashboard with live data...');
        
        // Check if data engine exists
        if (!window.dataEngine || !window.dataEngine.data) {
            console.warn('⚠️ Data engine not ready, retrying in 2 seconds...');
            setTimeout(() => this.updateDashboard(liveData), 2000);
            return;
        }
        
        const data = window.dataEngine.data;
        
        // Update Bitcoin data
        if (liveData.prices?.bitcoin) {
            const btc = liveData.prices.bitcoin;
            data.marketOverview.bitcoin.price = this.formatCurrency(btc.usd);
            data.marketOverview.bitcoin.change = this.formatPercentage(btc.usd_24h_change);
            data.marketOverview.bitcoin.trendClass = this.getTrendClass(btc.usd_24h_change);
            data.marketOverview.bitcoin.trendIcon = this.getTrendIcon(btc.usd_24h_change);
            
            console.log(`💰 BTC: $${btc.usd} (${btc.usd_24h_change.toFixed(2)}%)`);
        }
        
        // Update Ethereum data
        if (liveData.prices?.ethereum) {
            const eth = liveData.prices.ethereum;
            data.marketOverview.ethereum.price = this.formatCurrency(eth.usd);
            data.marketOverview.ethereum.change = this.formatPercentage(eth.usd_24h_change);
            data.marketOverview.ethereum.trendClass = this.getTrendClass(eth.usd_24h_change);
            data.marketOverview.ethereum.trendIcon = this.getTrendIcon(eth.usd_24h_change);
            
            console.log(`💎 ETH: $${eth.usd} (${eth.usd_24h_change.toFixed(2)}%)`);
        }
        
        // Update global market data
        if (liveData.global) {
            const global = liveData.global;
            
            // Total market cap
            if (global.total_market_cap?.usd) {
                data.marketOverview.totalMarketCap.value = this.formatMarketCap(global.total_market_cap.usd);
                data.marketOverview.totalMarketCap.change = this.formatPercentage(global.market_cap_change_percentage_24h_usd);
                data.marketOverview.totalMarketCap.trendClass = this.getTrendClass(global.market_cap_change_percentage_24h_usd);
                data.marketOverview.totalMarketCap.trendIcon = this.getTrendIcon(global.market_cap_change_percentage_24h_usd);
                
                console.log(`📊 Market Cap: ${this.formatMarketCap(global.total_market_cap.usd)}`);
            }
            
            // Bitcoin dominance
            if (global.market_cap_percentage?.btc) {
                const btcDom = global.market_cap_percentage.btc;
                const prevDom = parseFloat(data.marketOverview.bitcoinDominance.percentage);
                const domChange = btcDom - prevDom;
                
                data.marketOverview.bitcoinDominance.percentage = btcDom.toFixed(1);
                data.marketOverview.bitcoinDominance.change = this.formatPercentage(domChange);
                data.marketOverview.bitcoinDominance.trendClass = this.getTrendClass(domChange);
                data.marketOverview.bitcoinDominance.trendIcon = this.getTrendIcon(domChange);
                
                console.log(`📈 BTC Dominance: ${btcDom.toFixed(1)}%`);
            }
        }
        
        // Update Fear & Greed Index
        if (liveData.fearGreed) {
            const fg = liveData.fearGreed;
            data.sentimentData.fearGreedIndex.value = fg.value;
            data.sentimentData.fearGreedIndex.label = fg.value_classification;
            
            console.log(`😰 Fear & Greed: ${fg.value} (${fg.value_classification})`);
        }
        
        // Force re-render
        window.dataEngine.bindAll();
        window.dataEngine.renderTemplatesSafely();
        
        // Update timestamp
        const timestampEl = document.querySelector('.footer .text-muted');
        if (timestampEl) {
            timestampEl.innerHTML = `Last updated: ${new Date().toLocaleTimeString()} | Live data active`;
        }
        
        console.log('✅ Dashboard updated with live data!');
    }
    
    formatCurrency(value) {
        if (value >= 1000) {
            return new Intl.NumberFormat('en-US').format(Math.round(value));
        }
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }
    
    formatMarketCap(value) {
        if (value >= 1e12) {
            return `$${(value / 1e12).toFixed(2)}T`;
        } else if (value >= 1e9) {
            return `$${(value / 1e9).toFixed(2)}B`;
        }
        return `$${new Intl.NumberFormat('en-US').format(value)}`;
    }
    
    formatPercentage(value) {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(1)}%`;
    }
    
    getTrendClass(change) {
        if (change > 0) return 'trend-up';
        if (change < 0) return 'trend-down';
        return 'trend-neutral';
    }
    
    getTrendIcon(change) {
        if (change > 0) return 'fa-arrow-up';
        if (change < 0) return 'fa-arrow-down';
        return 'fa-arrow-right';
    }
    
    startAutoRefresh() {
        console.log(`⏰ Auto-refresh enabled (every ${this.updateInterval/1000} seconds)`);
        
        setInterval(() => {
            console.log('🔄 Auto-refreshing data...');
            this.fetchAllData();
        }, this.updateInterval);
    }
    
    async fetchBackupData() {
        console.log('🔄 Attempting to fetch from backup APIs...');
        // Implement backup API fetching logic here
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.liveCryptoDataFetcher = new LiveCryptoDataFetcher();
    });
} else {
    window.liveCryptoDataFetcher = new LiveCryptoDataFetcher();
}
