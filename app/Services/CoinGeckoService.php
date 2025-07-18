<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class CoinGeckoService
{
    private $baseUrl;
    private $apiKey;
    private $cacheService;

    public function __construct(CacheService $cacheService)
    {
        $this->apiKey = config('services.coingecko.key');
        $this->baseUrl = config('services.coingecko.base_url');
        $this->cacheService = $cacheService;
    }

    /**
     * Get market data for cryptocurrencies
     */
    public function getMarkets($vsCurrency = 'usd', $ids = null, $perPage = 100)
    {
        $cacheKey = "coingecko_markets_{$vsCurrency}_{$perPage}" . ($ids ? "_{$ids}" : "");
        
        // Use longer cache for wallet coins (5 minutes instead of 1)
        $cacheDuration = $ids ? 300 : 60;
        
        return $this->cacheService->remember($cacheKey, $cacheDuration, function () use ($vsCurrency, $ids, $perPage) {
            $params = [
                'vs_currency' => $vsCurrency,
                'order' => 'market_cap_desc',
                'per_page' => $perPage,
                'page' => 1,
                'sparkline' => false,
                'price_change_percentage' => '24h,7d,30d,90d,200d'
            ];

            if ($ids) {
                $params['ids'] = $ids;
            }

            $response = Http::timeout(30)->get("{$this->baseUrl}/coins/markets", $params);

            if ($response->successful()) {
                $data = $response->json();
                
                // Cache each coin individually for future use
                if ($ids && is_array($data)) {
                    foreach ($data as $coin) {
                        $this->cacheIndividualCoin($coin);
                    }
                }
                
                return $data;
            }

            Log::error('CoinGecko API error', [
                'status' => $response->status(),
                'body' => $response->body()
            ]);

            // If rate limited and we have specific IDs, try to build from individual caches
            if ($response->status() === 429 && $ids) {
                Log::warning('CoinGecko rate limit hit, building from individual caches');
                $data = $this->buildFromIndividualCaches($ids);
                if (!empty($data)) {
                    // Check if we got all requested coins
                    $requestedIds = explode(',', $ids);
                    $returnedIds = array_map(function($coin) { return $coin['id'] ?? ''; }, $data);
                    $missingIds = array_diff($requestedIds, $returnedIds);
                    
                    if (!empty($missingIds)) {
                        Log::warning('Rate limit fallback returned incomplete data', [
                            'requested' => $requestedIds,
                            'returned' => $returnedIds,
                            'missing' => $missingIds
                        ]);
                        // Don't cache incomplete data - throw exception to prevent caching
                        throw new \Exception('Incomplete data from rate limit fallback');
                    }
                    
                    return $data;
                }
            }

            throw new \Exception('CoinGecko API failed');
        });
    }

    /**
     * Get market data from cache only - for frontend display
     * This method is specifically for market overview where we want to show cached data
     * even if it's stale, rather than making API calls
     */
    public function getMarketsFromCache($vsCurrency = 'usd', $ids = null, $perPage = 250)
    {
        $cacheKey = "coingecko_markets_{$vsCurrency}_{$perPage}" . ($ids ? "_{$ids}" : "");
        
        // Check if we have this exact cache key
        $cachedData = $this->cacheService->getCachedWithMetadataPublic($cacheKey);
        if ($cachedData) {
            return $this->cacheService->formatResponsePublic(
                $cachedData['data'], 
                $cachedData['timestamp'], 
                $cachedData['age'], 
                'cache'
            );
        }
        
        // If no exact match and no IDs specified, try to use a larger cache and slice it
        if (!$ids) {
            // Try common cache sizes in order
            $fallbackSizes = [250, 500, 100, 50];
            foreach ($fallbackSizes as $size) {
                if ($size === $perPage) continue; // Skip the size we already tried
                
                $fallbackKey = "coingecko_markets_{$vsCurrency}_{$size}";
                $fallbackData = $this->cacheService->getCachedWithMetadataPublic($fallbackKey);
                
                if ($fallbackData && is_array($fallbackData['data'])) {
                    // Return the requested number of items from the larger cache
                    $slicedData = array_slice($fallbackData['data'], 0, $perPage);
                    
                    Log::debug("Using fallback cache for market data", [
                        'requested' => $perPage,
                        'found_cache_size' => $size,
                        'returned_count' => count($slicedData)
                    ]);
                    
                    return $this->cacheService->formatResponsePublic(
                        $slicedData, 
                        $fallbackData['timestamp'], 
                        $fallbackData['age'], 
                        'cache'
                    );
                }
            }
        }
        
        // No cache available
        return $this->cacheService->formatResponsePublic([], now(), 0, 'none');
    }
    
    /**
     * Get market data for wallet coins - always returns cache if available
     * This method is specifically for wallet display where we want to show cached prices
     * even if they're stale, rather than failing
     */
    /**
     * Get wallet coins from cache - ultra-simplified version
     * For wallet display, we always want to return whatever data we have in cache
     */
    public function getWalletCoins($vsCurrency = 'usd', $ids = null, $perPage = 250)
    {
        if (!$ids) {
            return $this->cacheService->formatResponsePublic([], now(), 0, 'none');
        }
        
        $requestedIds = explode(',', $ids);
        $result = [];
        
        // 1. First check the general market cache
        $generalCache = Cache::get("coingecko_markets_{$vsCurrency}_{$perPage}");
        if ($generalCache && is_array($generalCache)) {
            foreach ($generalCache as $coin) {
                if (isset($coin['id']) && in_array($coin['id'], $requestedIds)) {
                    $result[$coin['id']] = $coin;
                }
            }
        }
        
        // 2. For any missing coins, check individual caches
        foreach ($requestedIds as $coinId) {
            if (!isset($result[$coinId])) {
                $individualData = Cache::get("coin_data_{$coinId}");
                if ($individualData) {
                    $result[$coinId] = $individualData;
                }
            }
        }
        
        // Return as indexed array
        return $this->cacheService->formatResponsePublic(
            array_values($result), 
            now(), 
            0, 
            'cache'
        );
    }

    /**
     * Get simple price data
     */
    public function getSimplePrice($ids, $vsCurrencies = 'usd')
    {
        $cacheKey = "price_{$ids}_{$vsCurrencies}";
        
        return $this->cacheService->remember($cacheKey, 60, function () use ($ids, $vsCurrencies, $cacheKey) {
            $response = Http::timeout(30)->get("{$this->baseUrl}/simple/price", [
                'ids' => $ids,
                'vs_currencies' => $vsCurrencies,
                'include_24hr_change' => true
            ]);

            if ($response->successful()) {
                return $response->json();
            }

            // If rate limited, try to return cached data
            if ($response->status() === 429) {
                Log::warning('CoinGecko rate limit hit for prices, using extended cache');
                $cachedData = $this->cacheService->getStale($cacheKey);
                if ($cachedData !== null) {
                    return $cachedData;
                }
            }

            throw new \Exception('CoinGecko price API failed');
        });
    }

    /**
     * Get OHLC data for a coin
     */
    public function getOHLC($id, $vsCurrency = 'usd', $days = 365)
    {
        $cacheKey = "ohlc_{$id}_{$vsCurrency}_{$days}";
        
        return $this->cacheService->remember($cacheKey, 60, function () use ($id, $vsCurrency, $days) {
            $response = Http::timeout(30)->get("{$this->baseUrl}/coins/{$id}/ohlc", [
                'vs_currency' => $vsCurrency,
                'days' => $days
            ]);

            if ($response->successful()) {
                return $response->json();
            }

            if ($response->status() === 429) {
                Log::warning('CoinGecko rate limit exceeded');
                throw new \Exception('Rate limit exceeded. Please wait a moment.');
            }

            throw new \Exception('CoinGecko OHLC API failed');
        });
    }

    /**
     * Get market chart data for a coin
     */
    public function getMarketChart($id, $vsCurrency = 'usd', $days = 'max', $interval = 'daily')
    {
        $cacheKey = "market_chart_{$id}_{$vsCurrency}_{$days}_{$interval}";
        
        return $this->cacheService->remember($cacheKey, 60, function () use ($id, $vsCurrency, $days, $interval) {
            $params = [
                'vs_currency' => $vsCurrency,
                'days' => $days,
            ];
            
            if ($interval) {
                $params['interval'] = $interval;
            }
            
            $response = Http::timeout(30)->get("{$this->baseUrl}/coins/{$id}/market_chart", $params);

            if ($response->successful()) {
                return $response->json();
            }

            if ($response->status() === 429) {
                Log::warning('CoinGecko rate limit exceeded');
                throw new \Exception('Rate limit exceeded. Please wait a moment.');
            }

            throw new \Exception('CoinGecko Market Chart API failed');
        });
    }

    /**
     * Get trending coins
     */
    public function getTrending()
    {
        $cacheKey = 'trending';
        
        return $this->cacheService->rememberWithoutFreshness($cacheKey, function () {
            $response = Http::timeout(30)->get("{$this->baseUrl}/search/trending");

            if ($response->successful()) {
                return $response->json();
            }

            throw new \Exception('CoinGecko trending API failed');
        });
    }

    /**
     * Get global market data
     */
    public function getGlobalData()
    {
        $cacheKey = 'global';
        
        return $this->cacheService->rememberWithoutFreshness($cacheKey, function () {
            $response = Http::timeout(30)->get("{$this->baseUrl}/global");

            if ($response->successful()) {
                return $response->json();
            }
            
            if ($response->status() === 429) {
                Log::warning('CoinGecko rate limit exceeded for global data');
                throw new \Exception('Rate limit exceeded');
            }

            throw new \Exception('CoinGecko global API failed');
        });
    }

    /**
     * Force fetch fresh market data - used by wallet cache update cron job
     * This bypasses cache and always tries to get fresh data from APIs
     */
    public function fetchFreshMarketData($vsCurrency = 'usd', $ids = null, $perPage = 250)
    {
        Log::info('Fetching fresh market data', ['ids' => $ids]);
        
        $params = [
            'vs_currency' => $vsCurrency,
            'order' => 'market_cap_desc',
            'per_page' => $perPage,
            'page' => 1,
            'sparkline' => false,
            'price_change_percentage' => '24h,7d,30d,90d'
        ];

        if ($ids) {
            $params['ids'] = $ids;
        }

        try {
            $response = Http::timeout(30)->get("{$this->baseUrl}/coins/markets", $params);

            if ($response->successful()) {
                $data = $response->json();
                
                // Store in cache
                $cacheKey = "coingecko_markets_{$vsCurrency}_{$perPage}" . ($ids ? "_{$ids}" : "");
                $this->cacheService->storeWithMetadata($cacheKey, $data);
                
                // Cache each coin individually for future use
                if ($ids && is_array($data)) {
                    foreach ($data as $coin) {
                        $this->cacheIndividualCoin($coin);
                    }
                }
                
                Log::info('Successfully fetched fresh market data', [
                    'coin_count' => count($data),
                    'cache_key' => $cacheKey
                ]);
                
                return ['success' => true, 'data' => $data];
            }

            Log::error('CoinGecko API error', [
                'status' => $response->status(),
                'body' => $response->body()
            ]);

            // If rate limited, try fallback APIs
            if ($response->status() === 429) {
                Log::warning('CoinGecko rate limit hit, trying fallback APIs');
                
                // Try AlphaVantage for major cryptos
                if ($ids) {
                    $fallbackData = $this->tryAlphaVantageForCoins(explode(',', $ids));
                    if (!empty($fallbackData)) {
                        // Don't cache partial data with the full request key
                        if (count($fallbackData) < count(explode(',', $ids))) {
                            Log::warning('Fallback API returned partial data, not caching with full key');
                        } else {
                            $this->cacheService->storeWithMetadata($cacheKey, $fallbackData);
                        }
                        return ['success' => true, 'data' => $fallbackData, 'source' => 'fallback'];
                    }
                }
            }

            return ['success' => false, 'error' => 'API failed', 'status' => $response->status()];
            
        } catch (\Exception $e) {
            Log::error('Exception fetching market data', [
                'error' => $e->getMessage()
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
    
    /**
     * Force refresh specific coin data - used when adding new coins to wallet
     * This ensures fresh price data is available for newly added coins
     */
    public function refreshCoinData($coinId, $symbol = null, $name = null, $image = null)
    {
        // Check if we already have recent data for this coin
        $existingData = Cache::get("coin_data_{$coinId}");
        $existingMeta = Cache::get("coin_data_{$coinId}_meta");
        
        // If we have data that's less than 5 minutes old and has a price, don't refresh
        if ($existingData && isset($existingData['current_price']) && $existingData['current_price'] > 0) {
            if ($existingMeta && isset($existingMeta['timestamp'])) {
                $age = time() - $existingMeta['timestamp'];
                if ($age < 300) { // Less than 5 minutes old
                    Log::info("Skipping refresh for {$coinId} - already have recent data", [
                        'price' => $existingData['current_price'],
                        'age_seconds' => $age
                    ]);
                    return true;
                }
            }
        }
        
        $cacheKey = "coingecko_markets_usd_250_{$coinId}";
        
        try {
            $response = Http::timeout(30)->get("{$this->baseUrl}/coins/markets", [
                'vs_currency' => 'usd',
                'ids' => $coinId,
                'order' => 'market_cap_desc',
                'per_page' => 1,
                'page' => 1,
                'sparkline' => false,
                'price_change_percentage' => '24h,7d,30d,90d,200d'
            ]);

            if ($response->successful()) {
                $data = $response->json();
                
                if (!empty($data)) {
                    // Store in cache with metadata
                    $this->cacheService->storeWithMetadata($cacheKey, $data);
                    
                    // Also cache individually
                    if (isset($data[0])) {
                        $this->cacheIndividualCoin($data[0]);
                    }
                    
                    Log::info("Refreshed coin data for {$coinId}");
                    return true;
                }
            } else if ($response->status() === 429 && $symbol) {
                // Rate limited - try AlphaVantage as fallback
                Log::warning("CoinGecko rate limited for {$coinId}, trying AlphaVantage with symbol {$symbol}");
                
                try {
                    $alphaVantage = app(\App\Services\AlphaVantageService::class);
                    $exchangeRate = $alphaVantage->getCryptoExchangeRate(strtoupper($symbol), 'USD');
                    
                    if ($exchangeRate && isset($exchangeRate['data'])) {
                        $coinInfo = ['symbol' => strtoupper($symbol), 'name' => $name ?? $coinId];
                        $coinData = $this->convertAlphaVantageToCoinGecko($coinId, $coinInfo, $exchangeRate['data']);
                        
                        if ($coinData) {
                            // Store as array to match expected format
                            $this->cacheService->storeWithMetadata($cacheKey, [$coinData]);
                            $this->cacheIndividualCoin($coinData);
                            
                            Log::info("Refreshed coin data for {$coinId} using AlphaVantage fallback");
                            return true;
                        }
                    }
                } catch (\Exception $alphaError) {
                    Log::error("AlphaVantage fallback also failed for {$coinId}", ['error' => $alphaError->getMessage()]);
                }
            }
        } catch (\Exception $e) {
            Log::error("Failed to refresh coin data for {$coinId}", ['error' => $e->getMessage()]);
        }
        
        // If API failed but we have placeholder data, create and cache a placeholder
        if ($symbol && $name) {
            // IMPORTANT: Check if we already have price data for this coin
            $existingCoinData = Cache::get("coin_data_{$coinId}");
            
            $placeholderData = [[
                'id' => $coinId,
                'symbol' => strtolower($symbol), // Ensure lowercase
                'name' => $name,
                'image' => $image ?: 'https://via.placeholder.com/150',
                // Preserve existing price data if available, otherwise use 0
                'current_price' => $existingCoinData['current_price'] ?? 0,
                'market_cap' => $existingCoinData['market_cap'] ?? 0,
                'market_cap_rank' => $existingCoinData['market_cap_rank'] ?? null,
                'fully_diluted_valuation' => $existingCoinData['fully_diluted_valuation'] ?? null,
                'total_volume' => $existingCoinData['total_volume'] ?? 0,
                'high_24h' => $existingCoinData['high_24h'] ?? 0,
                'low_24h' => $existingCoinData['low_24h'] ?? 0,
                'price_change_24h' => $existingCoinData['price_change_24h'] ?? 0,
                'price_change_percentage_24h' => $existingCoinData['price_change_percentage_24h'] ?? 0,
                'market_cap_change_24h' => $existingCoinData['market_cap_change_24h'] ?? 0,
                'market_cap_change_percentage_24h' => $existingCoinData['market_cap_change_percentage_24h'] ?? 0,
                'circulating_supply' => $existingCoinData['circulating_supply'] ?? null,
                'total_supply' => $existingCoinData['total_supply'] ?? null,
                'max_supply' => null,
                'ath' => 0,
                'ath_change_percentage' => 0,
                'ath_date' => null,
                'atl' => 0,
                'atl_change_percentage' => 0,
                'atl_date' => null,
                'roi' => null,
                'last_updated' => now()->toIso8601String(),
                'price_change_percentage_24h_in_currency' => 0,
                'price_change_percentage_30d_in_currency' => 0,
                'price_change_percentage_7d_in_currency' => 0
            ]];
            
            // Store placeholder in cache
            $this->cacheService->storeWithMetadata($cacheKey, $placeholderData);
            $this->cacheIndividualCoin($placeholderData[0]);
            
            Log::info("Created placeholder data for {$coinId}", [
                'symbol' => $symbol,
                'name' => $name,
                'preserved_price' => $existingCoinData['current_price'] ?? 0,
                'had_existing_data' => !empty($existingCoinData)
            ]);
            
            return true;
        }
        
        return false;
    }

    /**
     * Search coins
     */
    public function searchCoins($query)
    {
        if (!$query || strlen($query) < 2) {
            return ['data' => [], 'metadata' => ['lastUpdated' => now()->toIso8601String(), 'cacheAge' => 0, 'source' => 'none']];
        }

        $cacheKey = 'search_' . strtolower($query);
        
        return $this->cacheService->remember($cacheKey, 60, function () use ($query) {
            $response = Http::timeout(30)->get("{$this->baseUrl}/search", [
                'query' => $query
            ]);

            if ($response->successful()) {
                $data = $response->json();
                return $data['coins'] ?? [];
            }

            throw new \Exception('CoinGecko search API failed');
        });
    }
    
    /**
     * Get market chart data with intelligent historical caching (cached forever)
     */
    public function getMarketChartHistorical($id, $vsCurrency = 'usd', $days = 'max')
    {
        $cacheKey = "historical_chart_{$id}_{$vsCurrency}_{$days}";
        
        return $this->cacheService->rememberHistoricalForever($cacheKey, function($fromDate, $toDate) use ($id, $vsCurrency, $days) {
            // If we have a specific date range, calculate the days
            if ($fromDate && $toDate) {
                $from = \Carbon\Carbon::parse($fromDate);
                $to = \Carbon\Carbon::parse($toDate);
                $daysToFetch = $from->diffInDays($to) + 1;
                
                // CoinGecko only allows fetching from current date backwards
                // So we fetch more data than needed and filter
                $daysFromNow = $to->diffInDays(now()) + $daysToFetch;
            } else {
                $daysFromNow = $days;
            }
            
            $params = [
                'vs_currency' => $vsCurrency,
                'days' => $daysFromNow,
            ];
            
            // For historical data, use daily interval
            if ($daysFromNow > 1) {
                $params['interval'] = 'daily';
            }
            
            $response = Http::timeout(30)->get("{$this->baseUrl}/coins/{$id}/market_chart", $params);

            if ($response->successful()) {
                $data = $response->json();
                
                if (isset($data['prices'])) {
                    // Transform to our standard format
                    $prices = [];
                    foreach ($data['prices'] as $pricePoint) {
                        $date = date('Y-m-d', $pricePoint[0] / 1000);
                        
                        // Filter by date range if specified
                        if ($fromDate && $date < $fromDate) continue;
                        if ($toDate && $date > $toDate) continue;
                        
                        $prices[] = [
                            'date' => $date,
                            'timestamp' => $pricePoint[0],
                            'price' => $pricePoint[1]
                        ];
                    }
                    
                    return $prices;
                }
            }

            if ($response->status() === 429) {
                Log::warning('CoinGecko rate limit exceeded for historical data');
                throw new \Exception('Rate limit exceeded. Using cached data.');
            }

            throw new \Exception('CoinGecko historical chart API failed');
        }, 'date');
    }
    
    /**
     * Cache individual coin data
     */
    private function cacheIndividualCoin($coinData)
    {
        if (!isset($coinData['id'])) {
            return;
        }
        
        $cacheKey = "coin_data_{$coinData['id']}";
        $metaKey = $cacheKey . '_meta';
        
        // Cache for 30 days (same as main cache duration)
        Cache::put($cacheKey, $coinData, 2592000);
        Cache::put($metaKey, [
            'timestamp' => now()->toIso8601String(),
            'source' => 'coingecko'
        ], 2592000);
        
        Log::debug("Cached individual coin data", ['coin' => $coinData['id']]);
    }
    
    /**
     * Build from properly cached market data (not from incomplete individual caches)
     */
    private function buildFromMarketDataCaches($ids)
    {
        $idArray = explode(',', $ids);
        $result = [];
        
        try {
            // Use Laravel's cache store to get all keys
            $cacheStore = Cache::store();
            
            // Get the Redis instance from the cache store
            if (method_exists($cacheStore, 'getRedis')) {
                $redis = $cacheStore->getRedis();
                $prefix = config('cache.prefix');
                
                // Look for market data cache keys
                $pattern = "{$prefix}coingecko_markets_usd_*";
                $marketKeys = $redis->keys($pattern);
                
                foreach ($marketKeys as $key) {
                    // Skip meta keys
                    if (strpos($key, '_meta') !== false) {
                        continue;
                    }
                    
                    // Remove prefix to get the actual cache key
                    $cacheKey = str_replace($prefix, '', $key);
                    
                    // Use Laravel's Cache facade to get the data
                    $data = Cache::get($cacheKey);
                    if (is_array($data)) {
                        foreach ($data as $coin) {
                            if (in_array($coin['id'], $idArray) && !isset($result[$coin['id']])) {
                                // Only use data that has complete market information
                                if (isset($coin['market_cap']) && $coin['market_cap'] !== null) {
                                    $result[$coin['id']] = $coin;
                                }
                            }
                        }
                    }
                    
                    // If we found all coins, stop searching
                    if (count($result) === count($idArray)) {
                        break;
                    }
                }
            } else {
                // Fallback: try known cache key patterns
                $possibleKeys = [
                    'coingecko_markets_usd_250',
                    'coingecko_markets_usd_100',
                    'coingecko_markets_usd_500'
                ];
                
                foreach ($possibleKeys as $cacheKey) {
                    $data = Cache::get($cacheKey);
                    if (is_array($data)) {
                        foreach ($data as $coin) {
                            if (in_array($coin['id'], $idArray) && !isset($result[$coin['id']])) {
                                if (isset($coin['market_cap']) && $coin['market_cap'] !== null) {
                                    $result[$coin['id']] = $coin;
                                }
                            }
                        }
                    }
                }
            }
        } catch (\Exception $e) {
            Log::error('Error in buildFromMarketDataCaches', [
                'error' => $e->getMessage()
            ]);
        }
        
        // Log only if some coins are missing
        $foundIds = array_keys($result);
        $missingIds = array_diff($idArray, $foundIds);
        if (!empty($missingIds)) {
            Log::debug('Some wallet coins not found in any cache', [
                'missing_ids' => $missingIds
            ]);
        }
        
        return array_values($result);
    }
    
    /**
     * Build market data from individual coin caches
     */
    private function buildFromIndividualCaches($ids)
    {
        $idArray = explode(',', $ids);
        $result = [];
        $missingCoins = [];
        
        foreach ($idArray as $coinId) {
            $coinId = trim($coinId);
            $cacheKey = "coin_data_{$coinId}";
            $cachedCoin = Cache::get($cacheKey);
            
            if ($cachedCoin) {
                $result[] = $cachedCoin;
                Log::debug("Retrieved coin from individual cache", ['coin' => $coinId]);
            } else {
                $missingCoins[] = $coinId;
            }
        }
        
        // If we have some missing coins, try alternative sources
        if (!empty($missingCoins)) {
            Log::info("Missing coins from cache", ['coins' => $missingCoins]);
            
            // Try to get missing coins from AlphaVantage for major cryptos
            $alphaVantageCoins = $this->tryAlphaVantageForCoins($missingCoins);
            if (!empty($alphaVantageCoins)) {
                $result = array_merge($result, $alphaVantageCoins);
            }
        }
        
        return $result;
    }
    
    /**
     * Try to get coin data from AlphaVantage as fallback
     * Can accept either coin IDs (will look up symbols) or arrays with coin data including symbols
     */
    private function tryAlphaVantageForCoins($coinIds)
    {
        $result = [];
        $alphaVantage = app(\App\Services\AlphaVantageService::class);
        
        foreach ($coinIds as $coinId) {
            try {
                // First try to get symbol from cached coin data
                $coinCacheKey = "coin_data_{$coinId}";
                $cachedCoin = Cache::get($coinCacheKey);
                
                $symbol = null;
                $name = null;
                
                if ($cachedCoin && isset($cachedCoin['symbol'])) {
                    $symbol = strtoupper($cachedCoin['symbol']);
                    $name = $cachedCoin['name'] ?? $coinId;
                } else {
                    // Try to get from any market cache that might have this coin
                    $marketCaches = Cache::get('coingecko_markets_*');
                    if ($marketCaches) {
                        foreach ($marketCaches as $cache) {
                            if (is_array($cache)) {
                                foreach ($cache as $coin) {
                                    if (isset($coin['id']) && $coin['id'] === $coinId) {
                                        $symbol = strtoupper($coin['symbol'] ?? '');
                                        $name = $coin['name'] ?? $coinId;
                                        break 2;
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Skip if we couldn't find a symbol
                if (!$symbol) {
                    Log::warning("No symbol found for coin {$coinId}, skipping AlphaVantage fallback");
                    continue;
                }
                
                // Try to get exchange rate from AlphaVantage
                $exchangeRate = $alphaVantage->getCryptoExchangeRate($symbol, 'USD');
                
                if ($exchangeRate && isset($exchangeRate['data'])) {
                    // Convert AlphaVantage format to CoinGecko format
                    $coinInfo = ['symbol' => $symbol, 'name' => $name];
                    $coinData = $this->convertAlphaVantageToCoinGecko($coinId, $coinInfo, $exchangeRate['data']);
                    if ($coinData) {
                        $result[] = $coinData;
                        // Cache this data for future use
                        $this->cacheIndividualCoin($coinData);
                    }
                }
            } catch (\Exception $e) {
                Log::warning("Failed to get {$coinId} from AlphaVantage", [
                    'error' => $e->getMessage(),
                    'symbol' => $symbol ?? 'unknown'
                ]);
            }
        }
        
        return $result;
    }
    
    /**
     * Convert AlphaVantage data to CoinGecko format
     */
    private function convertAlphaVantageToCoinGecko($coinId, $coinInfo, $alphaData)
    {
        if (!isset($alphaData['Realtime Currency Exchange Rate'])) {
            return null;
        }
        
        $data = $alphaData['Realtime Currency Exchange Rate'];
        $price = floatval($data['5. Exchange Rate'] ?? 0);
        
        if ($price <= 0) {
            return null;
        }
        
        // Build CoinGecko-compatible structure with available data
        return [
            'id' => $coinId,
            'symbol' => strtolower($coinInfo['symbol']),
            'name' => $coinInfo['name'],
            'image' => $this->getCoinImage($coinId),
            'current_price' => $price,
            'market_cap' => null, // Not available from AlphaVantage
            'market_cap_rank' => null,
            'fully_diluted_valuation' => null,
            'total_volume' => null,
            'high_24h' => null,
            'low_24h' => null,
            'price_change_24h' => null,
            'price_change_percentage_24h' => 0, // Default to 0 if not available
            'price_change_percentage_7d' => 0,
            'price_change_percentage_30d' => 0,
            'price_change_percentage_90d' => 0,
            'circulating_supply' => null,
            'total_supply' => null,
            'max_supply' => null,
            'last_updated' => $data['6. Last Refreshed'] ?? now()->toIso8601String()
        ];
    }
    
    /**
     * Get coin image URL
     */
    private function getCoinImage($coinId)
    {
        $images = [
            'bitcoin' => 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
            'ethereum' => 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
            'litecoin' => 'https://assets.coingecko.com/coins/images/2/large/litecoin.png',
            'ripple' => 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
            'bitcoin-cash' => 'https://assets.coingecko.com/coins/images/780/large/bitcoin-cash-circle.png'
        ];
        
        return $images[$coinId] ?? 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png';
    }


    /**
     * Get global data directly from API (bypasses cache - for cache updates)
     */
    public function getGlobalDataDirect()
    {
        $cacheKey = "global";
        
        $response = Http::timeout(30)->get("{$this->baseUrl}/global");

        if ($response->successful()) {
            $data = $response->json();
            
            // Store fresh data in cache
            $this->cacheService->storeWithMetadata($cacheKey, $data);
            
            // Return in same format as cached version
            return $this->cacheService->formatResponsePublic($data, now(), 0, "primary");
        }

        throw new \Exception("CoinGecko global data request failed");
    }


    /**
     * Get trending coins directly from API (bypasses cache - for cache updates)
     */
    public function getTrendingDirect()
    {
        $cacheKey = "trending";
        
        $response = Http::timeout(30)->get("{$this->baseUrl}/search/trending");

        if ($response->successful()) {
            $data = $response->json();
            
            // Store fresh data in cache
            $this->cacheService->storeWithMetadata($cacheKey, $data);
            
            // Return in same format as cached version
            return $this->cacheService->formatResponsePublic($data, now(), 0, "primary");
        }

        throw new \Exception("CoinGecko trending request failed");
    }
    
    /**
     * Get full market data for specific coins directly from API (for cache updates)
     * This fetches complete market data for any coins, not limited to top 250
     */
    public function getSpecificCoinsMarketData($coinIds, $vsCurrency = 'usd')
    {
        $ids = is_array($coinIds) ? implode(',', $coinIds) : $coinIds;
        $requestedIds = is_array($coinIds) ? $coinIds : explode(',', $ids);
        
        Log::info('getSpecificCoinsMarketData called', [
            'requested_ids' => $requestedIds,
            'count' => count($requestedIds)
        ]);
        
        try {
            // Use the markets endpoint with specific IDs to get full data
            $response = Http::timeout(30)->get("{$this->baseUrl}/coins/markets", [
                'vs_currency' => $vsCurrency,
                'ids' => $ids,
                'order' => 'market_cap_desc',
                'per_page' => 250, // Max allowed
                'page' => 1,
                'sparkline' => false,
                'price_change_percentage' => '24h,7d,30d,90d,200d'
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $foundIds = [];
                
                // Store each coin individually in cache
                foreach ($data as $coin) {
                    if (isset($coin['id'])) {
                        $foundIds[] = $coin['id'];
                        $coinCacheKey = "coin_data_{$coin['id']}";
                        // Cache for 30 days - same as other market data
                        Cache::put($coinCacheKey, $coin, 2592000); // 30 days
                        Cache::put("{$coinCacheKey}_meta", ['timestamp' => now()->timestamp], 2592000);
                    }
                }
                
                // Check for missing coins (not in top 250)
                $missingIds = array_diff($requestedIds, $foundIds);
                
                Log::info('API response analysis', [
                    'requested' => $requestedIds,
                    'found' => $foundIds,
                    'missing' => $missingIds
                ]);
                
                // For missing coins, preserve existing cache data if available
                foreach ($missingIds as $missingId) {
                    $existingData = Cache::get("coin_data_{$missingId}");
                    if ($existingData) {
                        $data[] = $existingData;
                        Log::info("Preserved existing cache data for {$missingId} (not in top 250)", [
                            'has_price' => isset($existingData['current_price']) ? $existingData['current_price'] : 'no'
                        ]);
                    } else {
                        Log::warning("No data found for {$missingId} - not in top 250 and no cache");
                    }
                }
                
                return [
                    'success' => true,
                    'data' => $data,
                    'metadata' => [
                        'source' => 'primary',
                        'lastUpdated' => now()->toIso8601String(),
                        'cacheAge' => 0
                    ]
                ];
            }
            
            // Check if rate limited
            if ($response->status() === 429) {
                Log::warning('CoinGecko rate limit hit for specific coins, trying fallback APIs');
                
                // Try Alpha Vantage as fallback
                $fallbackData = $this->tryAlphaVantageForCoins(is_array($coinIds) ? $coinIds : explode(',', $ids));
                $foundIds = [];
                
                if (!empty($fallbackData)) {
                    // Store each coin individually in cache
                    foreach ($fallbackData as $coin) {
                        if (isset($coin['id'])) {
                            $foundIds[] = $coin['id'];
                            $coinCacheKey = "coin_data_{$coin['id']}";
                            Cache::put($coinCacheKey, $coin, 2592000); // 30 days
                            Cache::put("{$coinCacheKey}_meta", ['timestamp' => now()->timestamp], 2592000);
                        }
                    }
                }
                
                // Check for missing coins even after fallback
                $missingIds = array_diff($requestedIds, $foundIds);
                
                // For missing coins, preserve existing cache data if available
                foreach ($missingIds as $missingId) {
                    $existingData = Cache::get("coin_data_{$missingId}");
                    if ($existingData) {
                        $fallbackData[] = $existingData;
                        Log::info("Preserved existing cache data for {$missingId} after rate limit");
                    }
                }
                
                if (!empty($fallbackData)) {
                    return [
                        'success' => true,
                        'data' => $fallbackData,
                        'metadata' => [
                            'source' => 'fallback',
                            'lastUpdated' => now()->toIso8601String(),
                            'cacheAge' => 0
                        ]
                    ];
                }
            }
            
            throw new \Exception("Failed to fetch market data for coins: {$ids}");
            
        } catch (\Exception $e) {
            Log::error('Failed to fetch specific coins market data', [
                'error' => $e->getMessage(),
                'coins' => $ids
            ]);
            
            // Even on failure, try to return existing cached data
            $cachedData = [];
            foreach ($requestedIds as $coinId) {
                $existingData = Cache::get("coin_data_{$coinId}");
                if ($existingData) {
                    $cachedData[] = $existingData;
                    Log::info("Returning cached data for {$coinId} after API failure");
                }
            }
            
            if (!empty($cachedData)) {
                return [
                    'success' => true,
                    'data' => $cachedData,
                    'metadata' => [
                        'source' => 'cache',
                        'lastUpdated' => now()->toIso8601String(),
                        'cacheAge' => 0,
                        'note' => 'API failed, returning cached data'
                    ]
                ];
            }
            
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'data' => []
            ];
        }
    }
    
    /**
     * Calculate 90-day performance for top 50 coins using market chart data
     */
    public function getTop50With90DayPerformance()
    {
        $cacheKey = "coingecko_top50_90d_performance";
        
        return $this->cacheService->rememberWithoutFreshness($cacheKey, function () {
            // First get top 50 coins
            $marketsResponse = $this->getMarkets('usd', null, 50);
            $markets = $marketsResponse['data'] ?? [];
            
            if (empty($markets)) {
                throw new \Exception('No market data available');
            }
            
            // For each coin, calculate 90-day performance using market chart
            $enrichedMarkets = [];
            
            foreach ($markets as $coin) {
                try {
                    // Get 91 days of data to ensure we have exactly 90 days ago
                    $chartResponse = Http::timeout(10)->get("{$this->baseUrl}/coins/{$coin['id']}/market_chart", [
                        'vs_currency' => 'usd',
                        'days' => 91,
                        'interval' => 'daily'
                    ]);
                    
                    if ($chartResponse->successful()) {
                        $chartData = $chartResponse->json();
                        
                        if (isset($chartData['prices']) && count($chartData['prices']) > 90) {
                            $prices = $chartData['prices'];
                            
                            // Get price from 90 days ago (index should be around 1)
                            $price90DaysAgo = $prices[0][1] ?? null;
                            
                            // Get current price (last price)
                            $currentPrice = $prices[count($prices) - 1][1] ?? null;
                            
                            if ($price90DaysAgo && $currentPrice && $price90DaysAgo > 0) {
                                // Calculate percentage change
                                $change90d = (($currentPrice - $price90DaysAgo) / $price90DaysAgo) * 100;
                                $coin['price_change_percentage_90d_in_currency'] = round($change90d, 2);
                                $enrichedMarkets[] = $coin;
                            }
                        }
                    }
                } catch (\Exception $e) {
                    Log::warning("Failed to get 90-day data for {$coin['id']}", ['error' => $e->getMessage()]);
                    // Skip this coin if we can't get its 90-day data
                }
                
                // Rate limit protection - sleep between requests
                usleep(100000); // 100ms delay
            }
            
            return $enrichedMarkets;
        });
    }
}