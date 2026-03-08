import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type ConfigMap = Record<string, string>;

interface UseSiteConfigResult {
  get: (key: string, fallback?: string) => string;
  loading: boolean;
  reload: () => void;
}

let cache: ConfigMap | null = null;

export function useSiteConfig(): UseSiteConfigResult {
  const [config, setConfig] = useState<ConfigMap>(cache ?? {});
  const [loading, setLoading] = useState(false);

  const fetchWithRetry = async (attempt = 0): Promise<void> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('site_config').select('key, value');
      if (error) throw error;
      if (data) {
        const map: ConfigMap = {};
        data.forEach(row => { map[row.key] = row.value; });
        cache = map;
        setConfig(map);
      }
    } catch (e) {
      console.error(`[useSiteConfig] fetch failed (attempt ${attempt + 1}):`, e);
      if (attempt < 1) {
        // single retry after 2s — covers cold-start network blips
        setTimeout(() => fetchWithRetry(attempt + 1), 2000);
        return;
      }
      // After retry: silently use fallbacks — non-blocking
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!cache) {
      fetchWithRetry(0);
    }
  }, []);

  const get = (key: string, fallback = '') => config[key] ?? fallback;

  return { get, loading, reload: () => fetchWithRetry(0) };
}
