import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const useApi = (endpoint, options = {}) => {
  // Handle backward compatibility - if options is a number, treat it as refetchInterval
  const normalizedOptions = typeof options === 'number' ? { refetchInterval: options } : options;
  const { params = {}, refetchInterval = 30000 } = normalizedOptions;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [cacheAge, setCacheAge] = useState(null);
  const [dataSource, setDataSource] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get CSRF token first
        const csrfResponse = await axios.get('/api/csrf-token');
        axios.defaults.headers.common['X-CSRF-TOKEN'] = csrfResponse.data.csrf_token;
        
        // Just use the endpoint as provided
        const response = await axios.get(endpoint, { params });
        setData(response.data);
        
        // Extract cache metadata from headers
        const cacheAgeHeader = response.headers['x-cache-age'];
        const dataSourceHeader = response.headers['x-data-source'];
        const lastUpdatedHeader = response.headers['x-last-updated'];
        
        if (cacheAgeHeader) {
          setCacheAge(parseInt(cacheAgeHeader));
        }
        
        if (dataSourceHeader) {
          setDataSource(dataSourceHeader);
        }
        
        if (lastUpdatedHeader) {
          setLastFetch(new Date(lastUpdatedHeader));
        } else {
          setLastFetch(new Date());
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch data');
        console.error('API Error:', err);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchData();

    // Set up interval if provided
    if (refetchInterval) {
      intervalRef.current = setInterval(fetchData, refetchInterval);
    }

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [endpoint, refetchInterval, JSON.stringify(params)]);

  return { data, loading, error, lastFetch, lastUpdated: lastFetch, cacheAge, dataSource };
};

export default useApi;
