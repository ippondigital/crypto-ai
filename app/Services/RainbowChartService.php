<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;

class RainbowChartService
{
    private $coinGeckoService;
    private $cacheService;
    
    // Bitcoin genesis date
    private const GENESIS_DATE = '2009-01-09';
    
    // Power Law coefficients - Based on Giovanni Santostasi's research
    // Formula: log10(Price) = a * log10(days_since_genesis) + b
    // This creates a power law: Price = 10^b * days^a
    private const POWER_LAW_EXPONENT = 5.82;  // The power (slope in log-log space)
    private const POWER_LAW_INTERCEPT = -17.01;  // Y-intercept in log-log space
    
    // Band offsets from the power law line (in log10 space)
    // These create the rainbow bands by adding/subtracting from the base curve
    // Based on historical Bitcoin price corridors
    private const BAND_OFFSETS = [
        'band9' => 0.50,   // Dark Red - Maximum Bubble Territory (3.16x above fair value)
        'band8' => 0.40,   // Red - Sell. Seriously, SELL! (2.51x above)
        'band7' => 0.30,   // Orange - FOMO Intensifies (2x above)
        'band6' => 0.20,   // Light Orange - Is this a bubble? (1.58x above)
        'band5' => 0.10,   // Yellow - HODL! (1.26x above)
        'band4' => 0.0,    // Light Green - Fair Value (power law line)
        'band3' => -0.10,  // Green - Still Cheap (0.79x below)
        'band2' => -0.20,  // Light Blue - Accumulate (0.63x below)
        'band1' => -0.38,  // Blue - Fire Sale (0.42x below - historical bottom)
    ];
    
    // Band labels
    private const BAND_LABELS = [
        'band1' => 'Fire Sale',
        'band2' => 'Accumulate',
        'band3' => 'Still Cheap',
        'band4' => 'Fair Value',
        'band5' => 'HODL!',
        'band6' => 'Is this a bubble?',
        'band7' => 'FOMO Intensifies',
        'band8' => 'Sell. Seriously, SELL!',
        'band9' => 'Maximum Bubble Territory',
    ];
    
    // Band colors
    private const BAND_COLORS = [
        'band1' => '#0D47A1',  // Dark Blue
        'band2' => '#1976D2',  // Blue
        'band3' => '#42A5F5',  // Light Blue
        'band4' => '#4CAF50',  // Green
        'band5' => '#FFEB3B',  // Yellow
        'band6' => '#FFB74D',  // Light Orange
        'band7' => '#FF9800',  // Orange
        'band8' => '#F44336',  // Red
        'band9' => '#B71C1C',  // Dark Red
    ];

    public function __construct(CoinGeckoService $coinGeckoService, CacheService $cacheService)
    {
        $this->coinGeckoService = $coinGeckoService;
        $this->cacheService = $cacheService;
    }

    /**
     * Get rainbow chart data with calculated bands
     */
    public function getRainbowChartData($days = 'max')
    {
        try {
            // Get historical data (cached FOREVER since historical prices never change)
            $historicalKey = "rainbow_chart_historical_v2";
            $historicalResult = $this->cacheService->rememberHistoricalForever($historicalKey, function($fromDate, $toDate) {
                $allPrices = [];
                
                // First try CryptoCompare for maximum historical data
                try {
                    $historicalData = $this->fetchCryptoCompareHistory();
                    if (!empty($historicalData)) {
                        foreach ($historicalData as $dataPoint) {
                            $allPrices[$dataPoint['date']] = [
                                'timestamp' => $dataPoint['timestamp'] * 1000,
                                'price' => $dataPoint['price']
                            ];
                        }
                        Log::info("Rainbow Chart Historical: Got " . count($allPrices) . " days from CryptoCompare");
                    }
                } catch (\Exception $e) {
                    Log::warning("CryptoCompare failed for Rainbow Chart Historical: " . $e->getMessage());
                }
                
                // If we don't have enough data, try CoinGecko for the gap
                if (count($allPrices) < 365) {
                    try {
                        $cgResult = $this->coinGeckoService->getMarketChart('bitcoin', 'usd', 'max', 'daily');
                        $cgData = $cgResult['data'] ?? [];
                        
                        if (!empty($cgData['prices'])) {
                            foreach ($cgData['prices'] as $pricePoint) {
                                $date = date('Y-m-d', $pricePoint[0] / 1000);
                                // Only add if we don't already have this date
                                if (!isset($allPrices[$date])) {
                                    $allPrices[$date] = [
                                        'timestamp' => $pricePoint[0],
                                        'price' => $pricePoint[1]
                                    ];
                                }
                            }
                            Log::info("Rainbow Chart Historical: Added CoinGecko data, total: " . count($allPrices));
                        }
                    } catch (\Exception $e) {
                        Log::warning('CoinGecko historical failed: ' . $e->getMessage());
                    }
                }
                
                // Sort by date
                ksort($allPrices);
                
                // Convert to array format
                $result = [];
                foreach ($allPrices as $date => $data) {
                    $result[] = [
                        'date' => $date,
                        'timestamp' => $data['timestamp'],
                        'price' => $data['price']
                    ];
                }
                
                return $result;
            }, 'date');
            
            $historicalData = $historicalResult['data'] ?? [];
            
            // Get recent data (last 14 days, cached for 1 minute)
            $recentKey = "rainbow_chart_recent_v2";
            $recentResult = $this->cacheService->remember($recentKey, 60, function() {
                $recentPrices = [];
                
                try {
                    // Get last 14 days of data
                    $cgResult = $this->coinGeckoService->getMarketChart('bitcoin', 'usd', 14, 'daily');
                    $cgData = $cgResult['data'] ?? [];
                    
                    if (!empty($cgData['prices'])) {
                        foreach ($cgData['prices'] as $pricePoint) {
                            $date = date('Y-m-d', $pricePoint[0] / 1000);
                            $recentPrices[$date] = [
                                'date' => $date,
                                'timestamp' => $pricePoint[0],
                                'price' => $pricePoint[1]
                            ];
                        }
                        Log::info("Rainbow Chart Recent: Got " . count($recentPrices) . " days from CoinGecko");
                    }
                } catch (\Exception $e) {
                    Log::warning('Recent rainbow data failed: ' . $e->getMessage());
                    
                    // Try OHLC as fallback
                    try {
                        $ohlcResult = $this->coinGeckoService->getOHLC('bitcoin', 'usd', 14);
                        $ohlcData = $ohlcResult['data'] ?? [];
                        
                        if (!empty($ohlcData)) {
                            foreach ($ohlcData as $candle) {
                                $date = date('Y-m-d', $candle[0] / 1000);
                                $recentPrices[$date] = [
                                    'date' => $date,
                                    'timestamp' => $candle[0],
                                    'price' => $candle[4] // closing price
                                ];
                            }
                            Log::info('Rainbow Chart Recent: Using OHLC data');
                        }
                    } catch (\Exception $e2) {
                        Log::warning('OHLC also failed for recent: ' . $e2->getMessage());
                    }
                }
                
                // Get current price for today
                try {
                    $priceResult = $this->coinGeckoService->getSimplePrice('bitcoin', 'usd');
                    $priceData = $priceResult['data'] ?? [];
                    $currentPrice = $priceData['bitcoin']['usd'] ?? null;
                    
                    if ($currentPrice) {
                        $today = now()->format('Y-m-d');
                        $recentPrices[$today] = [
                            'date' => $today,
                            'timestamp' => now()->timestamp * 1000,
                            'price' => $currentPrice
                        ];
                    }
                } catch (\Exception $e) {
                    Log::warning('Failed to get current price for rainbow: ' . $e->getMessage());
                }
                
                // Sort by date and convert to array
                ksort($recentPrices);
                return array_values($recentPrices);
            });
            
            $recentData = $recentResult['data'] ?? [];
            
            // Merge historical and recent data
            $allData = [];
            $dataByDate = [];
            
            // Add historical data
            foreach ($historicalData as $item) {
                $dataByDate[$item['date']] = $item;
            }
            
            // Overwrite with recent data (last 14 days)
            foreach ($recentData as $item) {
                $dataByDate[$item['date']] = $item;
            }
            
            // Sort by date and convert to array
            ksort($dataByDate);
            $allData = array_values($dataByDate);
            
            // Process data to add rainbow bands
            $processedData = [];
            $genesis = Carbon::parse(self::GENESIS_DATE);
            
            foreach ($allData as $item) {
                $date = Carbon::parse($item['date']);
                $timestamp = $item['timestamp'];
                $price = $item['price'];
                
                // Calculate days since genesis
                $daysSinceGenesis = $genesis->diffInDays($date);
                
                if ($daysSinceGenesis <= 0) {
                    continue;
                }
                
                // Calculate rainbow bands
                $bands = $this->calculateRainbowBands($daysSinceGenesis);
                
                // Determine current band
                $currentBand = $this->getCurrentBand($price, $bands);
                
                $processedData[] = [
                    'date' => $date->format('Y-m-d'),
                    'timestamp' => $timestamp,
                    'price' => round($price, 2),
                    'daysSinceGenesis' => $daysSinceGenesis,
                    'bands' => $bands,
                    'currentBand' => $currentBand,
                    'currentBandLabel' => self::BAND_LABELS[$currentBand] ?? 'Unknown',
                    'currentBandColor' => self::BAND_COLORS[$currentBand] ?? '#999999',
                ];
            }
            
            // Filter data based on requested days
            if ($days !== 'max') {
                $daysToShow = intval($days);
                $cutoffDate = now()->subDays($daysToShow)->format('Y-m-d');
                $processedData = array_filter($processedData, function($item) use ($cutoffDate) {
                    return $item['date'] >= $cutoffDate;
                });
                $processedData = array_values($processedData); // Re-index
            }
            
            // Add metadata
            $metadata = [
                'lastUpdate' => now()->toIso8601String(),
                'dataPoints' => count($processedData),
                'bandLabels' => self::BAND_LABELS,
                'bandColors' => self::BAND_COLORS,
                'historicalCacheAge' => $historicalResult['metadata']['cacheAge'] ?? 0,
                'recentCacheAge' => $recentResult['metadata']['cacheAge'] ?? 0,
            ];
            
            return [
                'data' => $processedData,
                'metadata' => $metadata,
            ];
            
        } catch (\Exception $e) {
            Log::error('Rainbow chart data error: ' . $e->getMessage());
            
            // Return empty data structure
            return [
                'data' => [],
                'metadata' => [
                    'lastUpdate' => now()->toIso8601String(),
                    'dataPoints' => 0,
                    'bandLabels' => self::BAND_LABELS,
                    'bandColors' => self::BAND_COLORS,
                    'error' => 'Unable to fetch rainbow chart data'
                ]
            ];
        }
    }
    
    /**
     * Calculate rainbow bands for a given number of days since genesis
     */
    private function calculateRainbowBands($daysSinceGenesis)
    {
        // Calculate using power law: Price = C * days^n
        // In log-log space: log10(Price) = log10(C) + n * log10(days)
        // Where C = 10^intercept and n = exponent
        
        // Ensure we have valid days (minimum 1 day)
        if ($daysSinceGenesis <= 0) {
            $daysSinceGenesis = 1;
        }
        
        // Calculate the power law value (in log10 space)
        // This is the "fair value" line in the middle of the corridor
        $logFairValue = self::POWER_LAW_INTERCEPT + self::POWER_LAW_EXPONENT * log10($daysSinceGenesis);
        
        $bands = [];
        foreach (self::BAND_OFFSETS as $band => $offset) {
            // Add the offset to create each band (in log10 space)
            $logBandValue = $logFairValue + $offset;
            
            // Convert back from log10 to actual price
            $bandPrice = pow(10, $logBandValue);
            
            // Round to reasonable precision
            if ($bandPrice < 1) {
                $bands[$band] = round($bandPrice, 4);
            } elseif ($bandPrice < 100) {
                $bands[$band] = round($bandPrice, 2);
            } elseif ($bandPrice < 10000) {
                $bands[$band] = round($bandPrice, 0);
            } else {
                $bands[$band] = round($bandPrice / 1000, 0) * 1000; // Round to nearest 1000
            }
        }
        
        // Ensure bands are in ascending order
        asort($bands);
        
        return $bands;
    }
    
    /**
     * Determine which band the current price falls into
     */
    private function getCurrentBand($price, $bands)
    {
        // Start from the highest band and work down
        $bandNames = array_reverse(array_keys(self::BAND_OFFSETS));
        
        foreach ($bandNames as $band) {
            if (isset($bands[$band]) && $price >= $bands[$band]) {
                return $band;
            }
        }
        
        // If price is below all bands, return the lowest band
        return 'band1';
    }
    
    /**
     * Get current rainbow chart status
     */
    public function getCurrentStatus()
    {
        try {
            // Get current Bitcoin price
            $priceResult = $this->coinGeckoService->getSimplePrice('bitcoin', 'usd');
            $priceData = $priceResult['data'] ?? [];
            $currentPrice = $priceData['bitcoin']['usd'] ?? 0;
            
            if ($currentPrice <= 0) {
                throw new \Exception('Invalid current price');
            }
            
            // Calculate days since genesis
            $genesis = Carbon::parse(self::GENESIS_DATE);
            $daysSinceGenesis = $genesis->diffInDays(now());
            
            // Calculate current bands
            $bands = $this->calculateRainbowBands($daysSinceGenesis);
            
            // Determine current band
            $currentBand = $this->getCurrentBand($currentPrice, $bands);
            
            return [
                'price' => round($currentPrice, 2),
                'band' => $currentBand,
                'bandLabel' => self::BAND_LABELS[$currentBand] ?? 'Unknown',
                'bandColor' => self::BAND_COLORS[$currentBand] ?? '#999999',
                'bands' => $bands,
                'daysSinceGenesis' => $daysSinceGenesis,
                'lastUpdate' => now()->toIso8601String(),
            ];
            
        } catch (\Exception $e) {
            Log::error('Rainbow chart status error: ' . $e->getMessage());
            throw $e;
        }
    }
    
    
    /**
     * Fetch historical Bitcoin data from CryptoCompare
     * This gives us up to 2000 days of historical data (about 5.5 years)
     */
    private function fetchCryptoCompareHistory()
    {
        $url = 'https://min-api.cryptocompare.com/data/v2/histoday';
        $params = [
            'fsym' => 'BTC',
            'tsym' => 'USD',
            'limit' => 2000, // Maximum allowed by free tier
            'aggregate' => 1,
            'api_key' => config('services.cryptocompare.key')
        ];
        
        try {
            $response = Http::timeout(30)->get($url, $params);
            
            if ($response->successful()) {
                $data = $response->json();
                
                if (isset($data['Data']['Data']) && is_array($data['Data']['Data'])) {
                    $dailyPrices = [];
                    
                    foreach ($data['Data']['Data'] as $day) {
                        if (isset($day['time']) && isset($day['close']) && $day['close'] > 0) {
                            $dailyPrices[] = [
                                'date' => date('Y-m-d', $day['time']),
                                'timestamp' => $day['time'],
                                'price' => $day['close']
                            ];
                        }
                    }
                    
                    // Sort by date ascending
                    usort($dailyPrices, function($a, $b) {
                        return $a['timestamp'] - $b['timestamp'];
                    });
                    
                    return $dailyPrices;
                }
            }
            
            return [];
        } catch (\Exception $e) {
            Log::error('CryptoCompare API error: ' . $e->getMessage());
            return [];
        }
    }
}