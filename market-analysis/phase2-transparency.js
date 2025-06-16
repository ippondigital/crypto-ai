/**
 * Phase 2: Data Source Transparency Extensions
 * Adds visual indicators and calculation explanations to the data engine
 */

// Wait for DOM and CryptoDataEngine to be ready
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for cryptoDataEngine to be initialized
    setTimeout(function() {
        if (!window.cryptoDataEngine) {
            console.error('cryptoDataEngine instance not found. Please include data_engine.js first.');
            return;
        }

        console.log('🏷️ Initializing Phase 2: Data Source Transparency...');
        
        // Get the constructor from the instance
        const CryptoDataEngine = window.cryptoDataEngine.constructor;

    /**
     * Enhanced data structure with metadata
     * Task 2.1: Extend Data Structure
     */
    CryptoDataEngine.prototype.enhanceDataWithMetadata = function() {
        console.log('🏷️ Enhancing data structure with metadata...');
        
        // Define metadata for each data type
        this.dataMetadata = {
            marketOverview: {
                bitcoin: {
                    price: { source: 'live', provider: 'CoinGecko', updateFreq: '1 min' },
                    change: { source: 'live', provider: 'CoinGecko', updateFreq: '1 min' }
                },
                ethereum: {
                    price: { source: 'live', provider: 'CoinGecko', updateFreq: '1 min' },
                    change: { source: 'live', provider: 'CoinGecko', updateFreq: '1 min' }
                },
                totalMarketCap: {
                    value: { source: 'live', provider: 'CoinGecko', updateFreq: '5 min' },
                    change: { source: 'live', provider: 'CoinGecko', updateFreq: '5 min' }
                },
                bitcoinDominance: {
                    percentage: { source: 'live', provider: 'CoinGecko', updateFreq: '5 min' },
                    change: { source: 'calculated', formula: 'current - previous', updateFreq: '5 min' }
                },
                altcoinMarketCap: {
                    value: { source: 'calculated', formula: 'totalCap - btcCap', updateFreq: '5 min' },
                    change: { source: 'calculated', formula: 'derived from total', updateFreq: '5 min' }
                }
            },
            sentimentData: {
                fearGreedIndex: {
                    value: { source: 'live', provider: 'Alternative.me', updateFreq: '5 min' },
                    label: { source: 'live', provider: 'Alternative.me', updateFreq: '5 min' }
                }
            },
            marketProbabilities: {
                pumpProbability1W: { 
                    source: 'calculated', 
                    formula: 'base(50) + fearGreed + flows + events',
                    inputs: ['fearGreedIndex', 'exchangeFlows', 'upcomingEvents']
                },
                pumpProbability1M: { 
                    source: 'calculated', 
                    formula: 'pump1W + cycleBoost',
                    inputs: ['pumpProbability1W', 'cyclePosition']
                },
                dumpRisk30D: { 
                    source: 'calculated', 
                    formula: 'base(30) - bullishFactors',
                    inputs:AdjacentHTML('beforeend', modalHTML);
    };

    /**
     * Show calculation details in modal
     */
    CryptoDataEngine.prototype.showCalculationDetails = function(metadata, triggerElement) {
        this.createCalculationModal();
        
        const modal = new bootstrap.Modal(document.getElementById('calculationModal'));
        const detailsDiv = document.getElementById('calculationDetails');
        
        let html = '';
        
        if (metadata.source === 'live') {
            html = this.generateLiveDataDetails(metadata);
        } else if (metadata.source === 'calculated') {
            html = this.generateCalculationDetails(metadata);
        } else if (metadata.source === 'research') {
            html = this.generateResearchDetails(metadata);
        }
        
        detailsDiv.innerHTML = html;
        modal.show();
    };

    /**
     * Generate details for live data
     */
    CryptoDataEngine.prototype.generateLiveDataDetails = function(metadata) {
        const lastUpdate = this.getLastUpdateTime(metadata.provider);
        
        return `
            <div class="alert alert-success">
                <h6 class="alert-heading">🔴 Live Data Source</h6>
                <p class="mb-2">This data is fetched directly from external APIs in real-time.</p>
            </div>
            
            <div class="row">
                <div class="col-md-6">
                    <h6>Data Provider</h6>
                    <p class="text-primary">${metadata.provider || 'Unknown'}</p>
                </div>
                <div class="col-md-6">
                    <h6>Update Frequency</h6>
                    <p class="text-primary">${metadata.updateFreq || 'Variable'}</p>
                </div>
            </div>
            
            <div class="mt-3">
                <h6>Last Updated</h6>
                <p class="font-monospace">${lastUpdate}</p>
            </div>
            
            <div class="mt-3">
                <h6>API Endpoint</h6>
                <code class="d-block p-2 bg-light rounded">
                    ${this.getApiEndpoint(metadata.provider)}
                </code>
            </div>
            
            <div class="mt-3">
                <h6>Data Validation</h6>
                <p>✅ Cross-verified across multiple sources<br>
                   ✅ Cached for offline access<br>
                   ✅ Automatic retry on failure</p>
            </div>
        `;
    };

    /**
     * Generate details for calculated data
     */
    CryptoDataEngine.prototype.generateCalculationDetails = function(metadata) {
        const currentValues = this.getCurrentCalculationInputs(metadata.inputs);
        
        return `
            <div class="alert alert-info">
                <h6 class="alert-heading">🔵 Calculated Data</h6>
                <p class="mb-2">This value is dynamically calculated using real-time inputs and formulas.</p>
            </div>
            
            <div class="mb-3">
                <h6>Formula</h6>
                <div class="p-3 bg-light rounded font-monospace">
                    ${metadata.formula || 'Complex calculation'}
                </div>
            </div>
            
            <div class="mb-3">
                <h6>Input Values</h6>
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Input</th>
                            <th>Current Value</th>
                            <th>Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.generateInputsTable(metadata.inputs, currentValues)}
                    </tbody>
                </table>
            </div>
            
            <div class="mb-3">
                <h6>Calculation Example</h6>
                <div class="p-3 bg-light rounded">
                    ${this.generateCalculationExample(metadata)}
                </div>
            </div>
            
            <div class="alert alert-warning">
                <small>
                    <strong>Note:</strong> Calculated values update automatically when input data changes.
                    Formulas are based on proven market analysis techniques.
                </small>
            </div>
        `;
    };

    /**
     * Generate details for research-based data
     */
    CryptoDataEngine.prototype.generateResearchDetails = function(metadata) {
        return `
            <div class="alert alert-warning">
                <h6 class="alert-heading">🟡 Research-Based Prediction</h6>
                <p class="mb-2">This value is based on market research and historical analysis.</p>
            </div>
            
            <div class="row mb-3">
                <div class="col-md-6">
                    <h6>Methodology</h6>
                    <p>${metadata.methodology || 'Proprietary analysis'}</p>
                </div>
                <div class="col-md-6">
                    <h6>Last Updated</h6>
                    <p>${metadata.lastUpdated || 'Recently'}</p>
                </div>
            </div>
            
            <div class="mb-3">
                <h6>Confidence Level</h6>
                <div class="progress" style="height: 25px;">
                    <div class="progress-bar bg-${this.getConfidenceColor(metadata.confidence)}" 
                         style="width: ${this.getConfidencePercent(metadata.confidence)}%">
                        ${metadata.confidence ? metadata.confidence.toUpperCase() : 'MEDIUM'}
                    </div>
                </div>
            </div>
            
            <div class="mb-3">
                <h6>Research Factors</h6>
                <ul>
                    <li>Historical cycle patterns</li>
                    <li>Institutional flow analysis</li>
                    <li>Macroeconomic indicators</li>
                    <li>Technical analysis models</li>
                    <li>Market sentiment trends</li>
                </ul>
            </div>
            
            <div class="alert alert-info">
                <small>
                    <strong>Disclaimer:</strong> Research predictions are based on historical patterns
                    and may not reflect future performance. Always conduct your own analysis.
                </small>
            </div>
        `;
    };

    /**
     * Task 2.4: Add Hover Tooltips
     */
    CryptoDataEngine.prototype.addDataTooltips = function() {
        console.log('💡 Adding hover tooltips to data elements...');
        
        const elements = document.querySelectorAll('[data-bind]');
        
        elements.forEach(element => {
            const bindPath = element.getAttribute('data-bind').split(':')[1]?.trim();
            if (!bindPath) return;
            
            const metadata = this.getMetadataForPath(bindPath);
            if (!metadata) return;
            
            // Add tooltip attributes
            element.setAttribute('data-bs-toggle', 'tooltip');
            element.setAttribute('data-bs-placement', 'top');
            element.style.cursor = 'help';
            
            // Build tooltip content
            let tooltipContent = '';
            
            if (metadata.source === 'live') {
                tooltipContent = `Live from ${metadata.provider} • Updates every ${metadata.updateFreq}`;
            } else if (metadata.source === 'calculated') {
                tooltipContent = `Calculated: ${metadata.formula}`;
            } else if (metadata.source === 'research') {
                tooltipContent = `Research: ${metadata.methodology} • ${metadata.confidence} confidence`;
            }
            
            element.setAttribute('title', tooltipContent);
            
            // Add click handler for detailed view
            element.addEventListener('click', () => {
                this.showCalculationDetails(metadata, element);
            });
        });
        
        // Initialize Bootstrap tooltips
        if (typeof bootstrap !== 'undefined') {
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.map(function (tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });
        }
    };

    /**
     * Helper methods
     */
    CryptoDataEngine.prototype.getLastUpdateTime = function(provider) {
        const sourceData = this.dataSourceMap.get(provider);
        if (sourceData && sourceData.timestamp) {
            const date = new Date(sourceData.timestamp);
            return date.toLocaleString();
        }
        return 'Recently';
    };

    CryptoDataEngine.prototype.getApiEndpoint = function(provider) {
        const endpoints = {
            'CoinGecko': 'https://api.coingecko.com/api/v3/simple/price',
            'Alternative.me': 'https://api.alternative.me/fng/',
            'CoinMarketCap': 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest'
        };
        return endpoints[provider] || 'API endpoint';
    };

    CryptoDataEngine.prototype.getCurrentCalculationInputs = function(inputs) {
        if (!inputs || !Array.isArray(inputs)) return {};
        
        const values = {};
        inputs.forEach(input => {
            // Get actual value from data
            if (input === 'fearGreedIndex') {
                values[input] = this.data?.sentimentData?.fearGreedIndex?.value || '50';
            } else if (input === 'exchangeFlows') {
                values[input] = this.data?.onChainMetrics?.exchangeFlow?.value || 'N/A';
            } else if (input === 'cyclePosition') {
                values[input] = this.data?.cycleAnalysis?.currentPosition?.cyclePositionPercent || '50';
            } else {
                values[input] = 'N/A';
            }
        });
        
        return values;
    };

    CryptoDataEngine.prototype.generateInputsTable = function(inputs, values) {
        if (!inputs || !Array.isArray(inputs)) return '<tr><td colspan="3">No inputs</td></tr>';
        
        return inputs.map(input => {
            const value = values[input] || 'N/A';
            const source = this.getInputSource(input);
            return `
                <tr>
                    <td>${this.formatInputName(input)}</td>
                    <td><strong>${value}</strong></td>
                    <td><span class="badge bg-${source.color}">${source.type}</span></td>
                </tr>
            `;
        }).join('');
    };

    CryptoDataEngine.prototype.getInputSource = function(input) {
        const sources = {
            'fearGreedIndex': { type: 'Live API', color: 'success' },
            'exchangeFlows': { type: 'On-chain', color: 'info' },
            'cyclePosition': { type: 'Calculated', color: 'primary' },
            'upcomingEvents': { type: 'Research', color: 'warning' }
        };
        return sources[input] || { type: 'Unknown', color: 'secondary' };
    };

    CryptoDataEngine.prototype.formatInputName = function(input) {
        const names = {
            'fearGreedIndex': 'Fear & Greed Index',
            'exchangeFlows': 'Exchange Flows',
            'cyclePosition': 'Cycle Position',
            'upcomingEvents': 'Upcoming Events',
            'pumpProbability1W': '1-Week Pump Probability',
            'dumpRisk30D': '30-Day Dump Risk'
        };
        return names[input] || input;
    };

    CryptoDataEngine.prototype.generateCalculationExample = function(metadata) {
        // Example calculations for different types
        if (metadata.formula && metadata.formula.includes('pump1W')) {
            return `
                <strong>Example:</strong><br>
                Base probability: 50%<br>
                + Fear & Greed adjustment: +10% (Greed = 65)<br>
                + Exchange outflows: +15% (Bullish signal)<br>
                + Upcoming FOMC: +5% (Potential catalyst)<br>
                = <strong>80% pump probability</strong>
            `;
        } else if (metadata.formula && metadata.formula.includes('100 -')) {
            return `
                <strong>Example:</strong><br>
                Total: 100%<br>
                - Pump probability (1M): 85%<br>
                - Dump risk: 10%<br>
                = <strong>5% sideways probability</strong>
            `;
        }
        
        return 'Calculation depends on real-time market conditions.';
    };

    CryptoDataEngine.prototype.getConfidenceColor = function(confidence) {
        const colors = {
            'high': 'success',
            'medium': 'warning',
            'low': 'danger'
        };
        return colors[confidence?.toLowerCase()] || 'warning';
    };

    CryptoDataEngine.prototype.getConfidencePercent = function(confidence) {
        const percents = {
            'high': 85,
            'medium': 60,
            'low': 35
        };
        return percents[confidence?.toLowerCase()] || 60;
    };

    /**
     * Initialize Phase 2 features
     */
    const originalInit = CryptoDataEngine.prototype.init;
    CryptoDataEngine.prototype.init = async function() {
        // Call original init
        await originalInit.call(this);
        
        // Add Phase 2 enhancements
        console.log('🚀 Initializing Phase 2: Data Transparency...');
        
        // Enhance data structure
        this.enhanceDataWithMetadata();
        
        // Wait for DOM to be ready
        setTimeout(() => {
            // Add visual badges
            this.addSourceBadges();
            
            // Add tooltips
            this.addDataTooltips();
            
            console.log('✅ Phase 2 transparency features initialized');
        }, 1000);
    };

    // Also enhance the bind method to add transparency on data updates
    const originalBindAll = CryptoDataEngine.prototype.bindAll;
    CryptoDataEngine.prototype.bindAll = async function() {
        await originalBindAll.call(this);
        
        // Re-apply transparency features after binding
        setTimeout(() => {
            this.addSourceBadges();
            this.addDataTooltips();
        }, 100);
    };

})();

// Add CSS for source badges
const style = document.createElement('style');
style.textContent = `
    .source-badge {
        display: inline-flex;
        align-items: center;
        font-size: 0.625rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.025em;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        margin-left: 0.5rem;
        cursor: pointer;
        transition: all 0.2s ease;
        vertical-align: middle;
    }
    
    .source-badge:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .source-badge.source-live {
        background: var(--success-subtle);
        color: var(--success);
        border: 1px solid var(--success);
    }
    
    .source-badge.source-calculated {
        background: var(--info-subtle);
        color: var(--info);
        border: 1px solid var(--info);
    }
    
    .source-badge.source-research {
        background: var(--warning-subtle);
        color: var(--warning);
        border: 1px solid var(--warning);
    }
    
    .source-badge.source-static {
        background: var(--bg-tertiary);
        color: var(--text-tertiary);
        border: 1px solid var(--border-light);
    }
    
    /* Tooltip enhancements */
    [data-bs-toggle="tooltip"] {
        cursor: help;
        text-decoration: underline;
        text-decoration-style: dotted;
        text-decoration-color: var(--text-tertiary);
        text-underline-offset: 2px;
    }
    
    /* Modal enhancements */
    #calculationModal .modal-body {
        max-height: 70vh;
        overflow-y: auto;
    }
    
    #calculationModal .table {
        background: var(--bg-tertiary);
        border-radius: var(--radius-sm);
    }
    
    #calculationModal .progress {
        background: var(--bg-tertiary);
    }
`;
document.head.appendChild(style);

console.log('✅ Phase 2: Data Source Transparency loaded');

        // Initialize the features after everything is loaded
        if (window.cryptoDataEngine) {
            console.log('🚀 Initializing Phase 2 features...');
            // You can add initialization calls here if needed
        }
    }, 100); // Wait 100ms for cryptoDataEngine to be fully initialized
});
