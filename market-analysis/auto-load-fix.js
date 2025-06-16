/**
 * Loading Indicators and Auto-Load Fix
 * Ensures live data loads automatically on page load with visual loading states
 */

// CRITICAL: Override the data engine's loadData method BEFORE it loads
(function() {
    // Store the original loadData method
    let originalLoadData = null;
    
    // Wait for cryptoDataEngine to be available and override its loadData method
    const overrideDataLoad = setInterval(() => {
        if (window.CryptoDataEngine && window.CryptoDataEngine.prototype.loadData) {
            clearInterval(overrideDataLoad);
            
            // Store original method
            originalLoadData = window.CryptoDataEngine.prototype.loadData;
            
            // Override loadData to automatically fetch live data after loading static data
            window.CryptoDataEngine.prototype.loadData = async function() {
                console.log('🔄 Intercepted loadData - will load live data automatically...');
                
                // Call original loadData first
                const result = await originalLoadData.call(this);
                
                // Immediately load live data after static data is loaded
                console.log('📡 Auto-loading live data after static data...');
                try {
                    await this.refreshLiveData();
                    console.log('✅ Auto-load of live data completed successfully');
                } catch (error) {
                    console.error('❌ Auto-load of live data failed:', error);
                }
                
                return result;
            };
            
            console.log('✅ Data engine loadData method overridden for auto-loading');
        }
    }, 50);
})();
    
    function showLoadingIndicators() {
        console.log('🔄 Showing loading indicators...');
        
        // Key data elements to show loading for
        const loadingTargets = [
            '[data-bind*="bitcoin.price"]',
            '[data-bind*="ethereum.price"]', 
            '[data-bind*="totalMarketCap.value"]',
            '[data-bind*="bitcoinDominance.percentage"]',
            '[data-bind*="fearGreedIndex.value"]'
        ];
        
        loadingTargets.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                // Store original content
                element.setAttribute('data-original-content', element.textContent);
                
                // Show loading spinner
                element.innerHTML = '<span class="loading-spinner">⏳ Loading...</span>';
                element.style.opacity = '0.7';
            }
        });
        
        // Add loading styles
        addLoadingStyles();
    }
    
    function hideLoadingIndicators() {
        console.log('✅ Hiding loading indicators...');
        
        const loadingElements = document.querySelectorAll('[data-original-content]');
        loadingElements.forEach(element => {
            element.style.opacity = '1';
            element.removeAttribute('data-original-content');
        });
        
        // Remove loading class from any elements that have it
        const spinners = document.querySelectorAll('.loading-spinner');
        spinners.forEach(spinner => spinner.remove());
    }
    
    function showErrorIndicators() {
        console.log('❌ Showing error indicators...');
        
        const loadingElements = document.querySelectorAll('[data-original-content]');
        loadingElements.forEach(element => {
            element.innerHTML = '<span style="color: #dc3545;">⚠️ Error</span>';
            element.style.opacity = '1';
        });
    }
    
    function addLoadingStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .loading-spinner {
                color: #6c757d;
                font-size: 0.9em;
                animation: loading-pulse 1.5s ease-in-out infinite;
            }
            
            @keyframes loading-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            /* Make LIVE badges show "LOADING" during load */
            .source-badge.loading {
                background-color: #ffc107 !important;
                color: #212529 !important;
            }
            
            .source-badge.loading::before {
                content: "⏳ ";
            }
        `;
        document.head.appendChild(style);
        
        // Add loading class to LIVE badges
        const liveBadges = document.querySelectorAll('.source-badge');
        liveBadges.forEach(badge => {
            if (badge.textContent.includes('Live')) {
                badge.classList.add('loading');
                badge.textContent = 'Loading...';
            }
        });
    }
    
    // Override the data engine's init to ensure live data loads
    if (window.cryptoDataEngine && window.cryptoDataEngine.init) {
        const originalInit = window.cryptoDataEngine.init;
        window.cryptoDataEngine.init = function() {
            console.log('🔄 Data engine init - ensuring live data loads...');
            
            // Call original init
            const result = originalInit.call(this);
            
            // Force live data refresh immediately after init
            setTimeout(() => {
                console.log('📡 Auto-triggering live data refresh after init...');
                this.refreshLiveData().catch(error => {
                    console.error('❌ Auto-refresh after init failed:', error);
                });
            }, 200);
            
            return result;
        };
    }
    
    console.log('✅ Auto-load fix initialized');
});
