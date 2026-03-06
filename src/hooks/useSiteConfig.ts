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

  const fetch = async () => {
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
      console.error('[useSiteConfig] fetch failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!cache) {
      fetch();
    }
  }, []);

  const get = (key: string, fallback = '') => config[key] ?? fallback;

  return { get, loading, reload: fetch };
}
