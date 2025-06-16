/**
 * Phase 3: Auto-Update System Enhancements
 * Builds on existing auto-refresh with intelligent polling and status indicators
 */

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        if (!window.cryptoDataEngine) {
            console.error('cryptoDataEngine instance not found.');
            return;
        }

        console.log('🔄 Initializing Phase 3: Auto-Update System...');

        /**
         * Enhanced RealTimeUpdater class that extends existing functionality
         */
        window.cryptoDataEngine.RealTimeUpdater = class {
            constructor(dataEngine) {
                this.dataEngine = dataEngine;
                this.isActive = false;
                this.isTabVisible = true;
                this.priceInterval = null;
                this.sentimentInterval = null;
                this.lastUpdateTime = null;
                this.updateCount = 0;
                this.failCount = 0;
                
                // Configuration
                this.config = {
                    pricesIntervalActive: 60000,    // 1 minute when tab active
                    pricesIntervalInactive: 300000, // 5 minutes when tab inactive
                    sentimentInterval: 300000,      // 5 minutes for sentiment data
                    maxFailures: 3                  // Stop after 3 consecutive failures
                };
                
                this.setupVisibilityDetection();
                this.createStatusIndicator();
            }
            
            /**
             * Start intelligent polling with different intervals
             */
            start() {
                if (this.isActive) {
                    console.log('Auto-updater already running');
                    return;
                }
                
                console.log('🚀 Starting intelligent auto-updater...');
                this.isActive = true;
                this.failCount = 0;
                
                // Start price updates (frequent)
                this.startPriceUpdates();
                
                // Start sentiment updates (less frequent)
                this.startSentimentUpdates();
                
                this.updateStatusDisplay();
            }
            
            /**
             * Stop all polling
             */
            stop() {
                console.log('⏹️ Stopping auto-updater...');
                this.isActive = false;
                
                if (this.priceInterval) {
                    clearInterval(this.priceInterval);
                    this.priceInterval = null;
                }
                
                if (this.sentimentInterval) {
                    clearInterval(this.sentimentInterval);
                    this.sentimentInterval = null;
                }
                
                // Stop the legacy auto refresh if it's running
                if (this.dataEngine.refreshInterval) {
                    clearInterval(this.dataEngine.refreshInterval);
                    this.dataEngine.refreshInterval = null;
                }
                
                this.updateStatusDisplay();
            }
            
            /**
             * Start price update polling
             */
            startPriceUpdates() {
                const interval = this.isTabVisible ? 
                    this.config.pricesIntervalActive : 
                    this.config.pricesIntervalInactive;
                    
                if (this.priceInterval) {
                    clearInterval(this.priceInterval);
                }
                
                console.log(`⏰ Price updates every ${interval/1000} seconds (tab ${this.isTabVisible ? 'active' : 'inactive'})`);
                
                this.priceInterval = setInterval(() => {
                    this.updatePrices();
                }, interval);
            }
            
            /**
             * Start sentiment update polling
             */
            startSentimentUpdates() {
                if (this.sentimentInterval) {
                    clearInterval(this.sentimentInterval);
                }
                
                console.log(`📊 Sentiment updates every ${this.config.sentimentInterval/1000} seconds`);
                
                this.sentimentInterval = setInterval(() => {
                    this.updateSentiment();
                }, this.config.sentimentInterval);
            }
            
            /**
             * Update prices and market data
             */
            async updatePrices() {
                if (!this.isActive) return;
                
                try {
                    console.log('🔄 Updating prices...');
                    this.lastUpdateTime = new Date();
                    this.updateCount++;
                    
                    // Use existing refresh functionality
                    await this.dataEngine.refreshLiveData();
                    
                    this.failCount = 0; // Reset failure count on success
                    this.updateStatusDisplay();
                    this.showUpdateAnimation();
                    
                } catch (error) {
                    console.error('❌ Price update failed:', error);
                    this.failCount++;
                    
                    if (this.failCount >= this.config.maxFailures) {
                        console.error('Too many failures, stopping auto-updater');
                        this.stop();
                    }
                    
                    this.updateStatusDisplay();
                }
            }
            
            /**
             * Update sentiment data (Fear & Greed, etc.)
             */
            async updateSentiment() {
                if (!this.isActive) return;
                
                try {
                    console.log('📊 Updating sentiment data...');
                    
                    // Update Fear & Greed specifically
                    await this.dataEngine.fetchFearGreedIndex();
                    await this.dataEngine.updateFearGreedGauge();
                    
                    console.log('✅ Sentiment data updated');
                    this.showUpdateAnimation();
                    
                } catch (error) {
                    console.error('❌ Sentiment update failed:', error);
                }
            }
            
            /**
             * Detect when tab becomes visible/hidden
             */
            setupVisibilityDetection() {
                document.addEventListener('visibilitychange', () => {
                    this.isTabVisible = !document.hidden;
                    console.log(`👁️ Tab ${this.isTabVisible ? 'visible' : 'hidden'}`);
                    
                    if (this.isActive) {
                        // Restart price updates with new interval
                        this.startPriceUpdates();
                        this.updateStatusDisplay();
                    }
                });
            }
            
            /**
             * Create status indicator UI
             */
            createStatusIndicator() {
                // Create status bar if it doesn't exist
                let statusBar = document.getElementById('auto-update-status');
                if (!statusBar) {
                    statusBar = document.createElement('div');
                    statusBar.id = 'auto-update-status';
                    statusBar.style.cssText = `
                        position: fixed;
                        bottom: 1rem;
                        right: 1rem;
                        background: rgba(0, 0, 0, 0.8);
                        color: white;
                        padding: 0.5rem 1rem;
                        border-radius: 0.5rem;
                        font-size: 0.75rem;
                        z-index: 1000;
                        backdrop-filter: blur(10px);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        min-width: 200px;
                    `;
                    document.body.appendChild(statusBar);
                }
                
                this.statusBar = statusBar;
                this.updateStatusDisplay();
            }
            
            /**
             * Update status display
             */
            updateStatusDisplay() {
                if (!this.statusBar) return;
                
                let status = '';
                let color = '#10b981'; // green
                
                if (!this.isActive) {
                    status = '⏸️ Auto-update paused';
                    color = '#6b7280'; // gray
                } else if (this.failCount > 0) {
                    status = `⚠️ ${this.failCount} failures • Still trying`;
                    color = '#f59e0b'; // yellow
                } else {
                    const interval = this.isTabVisible ? 
                        this.config.pricesIntervalActive : 
                        this.config.pricesIntervalInactive;
                    status = `🟢 Live • ${interval/1000}s intervals`;
                    color = '#10b981'; // green
                }
                
                let timeInfo = '';
                if (this.lastUpdateTime) {
                    const timeAgo = Math.floor((Date.now() - this.lastUpdateTime) / 1000);
                    timeInfo = `<br>Last: ${timeAgo}s ago • Count: ${this.updateCount}`;
                }
                
                this.statusBar.innerHTML = `
                    <div style="color: ${color}; font-weight: 600;">${status}</div>
                    <div style="color: #9ca3af; font-size: 0.65rem;">${timeInfo}</div>
                `;
            }
            
            /**
             * Show subtle update animation
             */
            showUpdateAnimation() {
                // Flash the source badges briefly
                const badges = document.querySelectorAll('.source-badge');
                badges.forEach(badge => {
                    badge.style.animation = 'pulse 0.5s ease-in-out';
                    setTimeout(() => {
                        badge.style.animation = '';
                    }, 500);
                });
                
                // Add pulse animation if not exists
                if (!document.getElementById('pulse-animation-style')) {
                    const style = document.createElement('style');
                    style.id = 'pulse-animation-style';
                    style.textContent = `
                        @keyframes pulse {
                            0% { transform: scale(1); opacity: 1; }
                            50% { transform: scale(1.05); opacity: 0.8; }
                            100% { transform: scale(1); opacity: 1; }
                        }
                    `;
                    document.head.appendChild(style);
                }
            }
        };

        // Initialize the enhanced auto-updater
        window.cryptoDataEngine.realTimeUpdater = new window.cryptoDataEngine.RealTimeUpdater(window.cryptoDataEngine);
        
        // Add convenient global controls
        window.startLiveUpdates = () => window.cryptoDataEngine.realTimeUpdater.start();
        window.stopLiveUpdates = () => window.cryptoDataEngine.realTimeUpdater.stop();
        
        // Auto-start the updater
        window.cryptoDataEngine.realTimeUpdater.start();

        console.log('✅ Phase 3: Auto-Update System loaded successfully');

    }, 150); // Wait a bit longer for Phase 2 to complete
});
