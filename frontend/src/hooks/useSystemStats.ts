import { useEffect, useState, useRef } from "react";
import { systemApi } from "@/api/system.api";
import { SystemStatus } from "@/types/system.types";

export interface SystemMetricPoint {
  t: number;
  cpu: number;
  ram: number;
  disk: number;
}

const INITIAL_HISTORY: SystemMetricPoint[] = Array.from({ length: 20 }, (_, i) => ({
  t: i,
  cpu: 15 + ((i * 5) % 25),
  ram: 40 + ((i * 3) % 15),
  disk: 30,
}));

export function useSystemStats(pollingIntervalMs: number = 2500) {
  const [stats, setStats] = useState<SystemStatus | null>(null);
  const [history, setHistory] = useState<SystemMetricPoint[]>(INITIAL_HISTORY);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const tickRef = useRef<number>(20);

  const fetchTelemetry = async () => {
    try {
      const data = await systemApi.getStatus();
      setStats(data);
      setIsLive(true);
      setIsError(false);

      tickRef.current += 1;
      setHistory((prev) => [
        ...prev.slice(1),
        {
          t: tickRef.current,
          cpu: Math.round(data.cpu_percent),
          ram: Math.round(data.ram_percent),
          disk: Math.round(data.disk_percent),
        },
      ]);
    } catch {
      setIsLive(false);
      setIsError(true);

      // Simulation fallback when offline
      tickRef.current += 1;
      setHistory((prev) => {
        const last = prev[prev.length - 1];
        return [
          ...prev.slice(1),
          {
            t: tickRef.current,
            cpu: Math.min(100, Math.max(5, (last?.cpu ?? 25) + (Math.random() * 10 - 5))),
            ram: Math.min(100, Math.max(10, (last?.ram ?? 45) + (Math.random() * 4 - 2))),
            disk: last?.disk ?? 30,
          },
        ];
      });
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, pollingIntervalMs);
    return () => clearInterval(interval);
  }, [pollingIntervalMs]);

  return {
    stats,
    history,
    isLive,
    isError,
    refetch: fetchTelemetry,
  };
}
