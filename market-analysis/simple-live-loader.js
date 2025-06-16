/**
 * SIMPLE LIVE DATA LOADER
 * Forces live data to load automatically after page initialization
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 SIMPLE LIVE DATA LOADER STARTING...');
    
    // Wait for data engine to be ready, then force live data load
    setTimeout(() => {
        if (window.cryptoDataEngine) {
            console.log('🚀 FORCING LIVE DATA LOAD...');
            
            // Show loading indicators first
            showLoadingState();
            
            // Force live data refresh
            window.cryptoDataEngine.refreshLiveData()
                .then(() => {
                    console.log('✅ LIVE DATA LOADED SUCCESSFULLY');
                    hideLoadingState();
                    showSuccessIndicator();
                })
                .catch(error => {
                    console.error('❌ LIVE DATA LOAD FAILED:', error);
                    hideLoadingState();
                    showErrorIndicator();
                });
        } else {
            console.log('❌ Data engine not found');
        }
    }, 2000); // Give the engine time to initialize
    
    function showLoadingState() {
        // Change status indicator to show loading
        const statusElement = document.querySelector('#auto-update-status');
        if (statusElement) {
            statusElement.innerHTML = `
                <div style="color: #ffc107; font-weight: 600;">⏳ Loading Live Data...</div>
                <div style="color: #9ca3af; font-size: 0.65rem;">Fetching current prices...</div>
            `;
        }
        
        // Add loading effect to price elements
        const priceElements = [
            '[data-bind*="bitcoin.price"]',
            '[data-bind*="ethereum.price"]',
            '[data-bind*="fearGreedIndex.value"]'
        ];
        
        priceElements.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.opacity = '0.6';
                element.style.transition = 'opacity 0.3s ease';
            }
        });
    }
    
    function hideLoadingState() {
        // Restore opacity to price elements
        const priceElements = [
            '[data-bind*="bitcoin.price"]',
            '[data-bind*="ethereum.price"]',
            '[data-bind*="fearGreedIndex.value"]'
        ];
        
        priceElements.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.opacity = '1';
            }
        });
    }
    
    function showSuccessIndicator() {
        // Show brief success message
        const statusElement = document.querySelector('#auto-update-status');
        if (statusElement) {
            statusElement.innerHTML = `
                <div style="color: #10b981; font-weight: 600;">✅ Live Data Loaded</div>
                <div style="color: #9ca3af; font-size: 0.65rem;">Auto-refresh active</div>
            `;
            
            // Reset to normal status after 3 seconds
            setTimeout(() => {
                if (window.cryptoDataEngine && window.cryptoDataEngine.realTimeUpdater) {
                    const updater = window.cryptoDataEngine.realTimeUpdater;
                    const interval = updater.isTabVisible ? 60 : 300;
                    statusElement.innerHTML = `
                        <div style="color: #10b981; font-weight: 600;">🟢 Live • ${interval}s intervals</div>
                        <div style="color: #9ca3af; font-size: 0.65rem;">Last: Just now • Count: ${updater.updateCount}</div>
                    `;
                }
            }, 3000);
        }
    }
    
    function showErrorIndicator() {
        const statusElement = document.querySelector('#auto-update-status');
        if (statusElement) {
            statusElement.innerHTML = `
                <div style="color: #dc3545; font-weight: 600;">❌ Load Failed</div>
                <div style="color: #9ca3af; font-size: 0.65rem;">Using static data</div>
            `;
        }
    }
});
