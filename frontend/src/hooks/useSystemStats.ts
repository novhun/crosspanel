import { useState, useEffect, useRef } from 'react';
import { systemApi } from '../services/api';
import { SystemStatus } from '../types/system.types';

export interface HistoryPoint {
  time: string;
  cpu: number;
  ram: number;
}

export function useSystemStats(intervalMs: number = 2500) {
  const [stats, setStats] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchStats = async () => {
      try {
        const data = await systemApi.getStatus();
        if (!isMounted) return;
        setStats(data);
        setError(null);
        setLoading(false);

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

        setHistory(prev => {
          const updated = [...prev, { time: timeStr, cpu: data.cpu_percent, ram: data.ram_percent }];
          if (updated.length > 20) updated.shift();
          return updated;
        });
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Failed to fetch system metrics');
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, intervalMs);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [intervalMs]);

  return { stats, history, loading, error };
}
