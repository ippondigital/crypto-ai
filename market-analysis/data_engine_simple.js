/**
 * SIMPLIFIED AUTO-RELOADING LIVE DATA SYSTEM
 * Simple solution: Load static data first, then auto-refresh live data after page loads
 */

class CryptoDataEngine {
    constructor() {
        this.data = null;
        this.liveData = null;
        
        // Binding types
        this.bindingTypes = {
            'text': this.bindText,
            'class': this.bindClass,
            'attribute': this.bindAttribute,
            'style': this.bindStyle
        };
        
        // API Configuration
        this.apiConfig = {
            coinGeckoBase: 'https://api.coingecko.com/api/v3',
            fearGreedApi: 'https://api.alternative.me/fng/',
            retryDelay: 2000,
            maxRetries: 3
        };
        
        this.init();
    }

    /**
     * Simple initialization: Load static data, then auto-refresh live data
     */
    async init() {
        console.log('🚀 Starting Data Engine...');
        
        try {
            // Load static data and display it
            await this.loadData();
            await this.bindAll();
            await this.renderTemplatesSafely();
            
            console.log('✅ Static data loaded');
            
            // Auto-refresh live data after page is ready (SIMPLE SOLUTION)
            setTimeout(async () => {
                console.log('🔄 Auto-loading live data...');
                await this.refreshLiveData();
                console.log('✅ Live data loaded');
            }, 3000);
            
            // Start regular auto-refresh
            this.startAutoRefresh(60); // 60 seconds
            
        } catch (error) {
            console.error('❌ Init failed:', error);
        }
    }

    /**
     * Load static data from data.json
     */
    async loadData() {
        const response = await fetch('./data.json');
        this.data = await response.json();
    }

    /**
     * Refresh live data (existing method that works)
     */
    async refreshLiveData() {
        try {
            await this.fetchLiveMarketData();
            await this.bindAll();
            await this.updateProgressBars();
            await this.updateFearGreedGauge();
            await this.renderTrendIcons();
        } catch (error) {
            console.error('❌ Live refresh failed:', error);
        }
    }

    /**
     * Rest of the existing methods remain unchanged...
     */
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.cryptoDataEngine = new CryptoDataEngine();
});
