/**
 * Phase 2: Data Source Transparency Extensions - SIMPLIFIED VERSION
 * Adds visual indicators and calculation explanations to the data engine
 */

document.addEventListener('DOMContentLoaded', function() {
    // Wait for cryptoDataEngine to be initialized
    setTimeout(function() {
        if (!window.cryptoDataEngine) {
            console.error('cryptoDataEngine instance not found.');
            return;
        }

        console.log('🏷️ Initializing Phase 2: Data Source Transparency (Simple Version)...');

        /**
         * Add source badges to card headers/corners only
         */
        window.cryptoDataEngine.addSourceBadges = function() {
            console.log('Adding source badges to card headers...');
            
            let badgeCount = 0;
            
            // Define cards and their data sources
            const cardSources = [
                {
                    selector: '.col-xl-3:has([data-bind*="bitcoin.price"])',
                    cardTitle: 'Bitcoin (BTC)',
                    badgeType: 'live',
                    source: 'CoinGecko'
                },
                {
                    selector: '.col-xl-3:has([data-bind*="ethereum.price"])', 
                    cardTitle: 'Ethereum (ETH)',
                    badgeType: 'live',
                    source: 'CoinGecko'
                },
                {
                    selector: '.col-xl-3:has([data-bind*="totalMarketCap"])',
                    cardTitle: 'Total Market Cap',
                    badgeType: 'live', 
                    source: 'CoinGecko'
                },
                {
                    selector: '.col-xl-3:has([data-bind*="bitcoinDominance"])',
                    cardTitle: 'BTC Dominance',
                    badgeType: 'live',
                    source: 'TradingView'
                },
                {
                    selector: '.card:has([data-bind*="fearGreedIndex"])',
                    cardTitle: 'Fear & Greed Index',
                    badgeType: 'live',
                    source: 'Alternative.me'
                },
                {
                    selector: '.card:has([data-bind*="cyclePosition"])',
                    cardTitle: 'Cycle Analysis',
                    badgeType: 'research',
                    source: 'Historical Analysis'
                },
                {
                    selector: '.card:has([data-bind*="probability"])',
                    cardTitle: 'Market Probabilities', 
                    badgeType: 'calculated',
                    source: 'Proprietary Model'
                }
            ];
            
            cardSources.forEach(cardDef => {
                const cardElement = document.querySelector(cardDef.selector);
                if (cardElement) {
                    // Find the card header or create one
                    let header = cardElement.querySelector('.card-header, h6, h5, h4');
                    if (!header) {
                        // Find the title text and wrap it
                        const titleElement = cardElement.querySelector('*');
                        if (titleElement) {
                            header = titleElement;
                        }
                    }
                    
                    if (header && !header.querySelector('.source-badge')) {
                        // Create badge
                        const badge = this.createSourceBadge(cardDef.badgeType, cardDef.source);
                        
                        // Position badge in top-right corner
                        const container = cardElement.querySelector('.card') || cardElement;
                        container.style.position = 'relative';
                        
                        badge.style.position = 'absolute';
                        badge.style.top = '0.5rem';
                        badge.style.right = '0.5rem';
                        badge.style.zIndex = '10';
                        
                        container.appendChild(badge);
                        badgeCount++;
                    }
                }
            });
            
            console.log(`✅ Added ${badgeCount} card source badges`);
            return badgeCount;
        };

        /**
         * Create a source badge element
         */
        window.cryptoDataEngine.createSourceBadge = function(badgeType, source) {
            const badge = document.createElement('span');
            badge.className = `source-badge badge badge-${badgeType}`;
            
            // Set content and styling based on type
            switch(badgeType) {
                case 'live':
                    badge.textContent = '🟢 Live';
                    badge.style.backgroundColor = '#10b981';
                    badge.style.color = 'white';
                    badge.title = `Live data from ${source} • Updates automatically`;
                    break;
                case 'calculated':
                    badge.textContent = '🔵 Calculated';
                    badge.style.backgroundColor = '#3b82f6';
                    badge.style.color = 'white';
                    badge.title = `Calculated using ${source} • Updated with live data`;
                    break;
                case 'research':
                    badge.textContent = '🟡 Research';
                    badge.style.backgroundColor = '#f59e0b';
                    badge.style.color = 'white';
                    badge.title = `Based on ${source} • Updated weekly`;
                    break;
            }
            
            // Common styling
            badge.style.fontSize = '0.65rem';
            badge.style.padding = '0.25rem 0.5rem';
            badge.style.borderRadius = '0.25rem';
            badge.style.fontWeight = '600';
            badge.style.textTransform = 'uppercase';
            badge.style.letterSpacing = '0.025em';
            badge.style.cursor = 'help';
            badge.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
            
            return badge;
        };

        /**
         * Get tooltip text for badges
         */
        window.cryptoDataEngine.getTooltipText = function(badgeType, dataBind) {
            switch(badgeType) {
                case 'live':
                    return 'Live data from CoinGecko/TradingView • Updates every 1-5 min';
                case 'calculated':
                    return 'Calculated from live data using formulas';
                case 'research':
                    return 'Research-based projections • Medium confidence';
                default:
                    return 'Data source information';
            }
        };

        /**
         * Show calculation details modal (simplified)
         */
        window.cryptoDataEngine.showCalculationDetails = function(element) {
            const dataBind = element.getAttribute('data-bind');
            let details = `Data source details for: ${dataBind}`;
            
            // Create simple alert for now (can be enhanced to modal later)
            alert(details);
        };

        // Initialize badges on load
        window.cryptoDataEngine.addSourceBadges();

        console.log('✅ Phase 2: Data Source Transparency loaded successfully');

    }, 100); // Wait 100ms for cryptoDataEngine initialization
});
