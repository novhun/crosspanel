import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tunnelApi } from "@/api/tunnel.api";
import { TunnelCreatePayload } from "@/types/tunnel.types";
import { toast } from "sonner";

export function useTunnels() {
  const queryClient = useQueryClient();

  const tunnelsQuery = useQuery({
    queryKey: ["tunnels"],
    queryFn: () => tunnelApi.list(),
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: TunnelCreatePayload) => tunnelApi.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tunnels"] });
      toast.success(`Tunnel created successfully: ${data.remote_url || data.name}`);
    },
    onError: (error: unknown) => {
      toast.error(`Failed to create tunnel: ${(error as Error)?.message || "Unknown error"}`);
    },
  });

  const stopMutation = useMutation({
    mutationFn: (name: string) => tunnelApi.stop(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tunnels"] });
      toast.success("Tunnel stopped successfully");
    },
  });

  return {
    ...tunnelsQuery,
    createTunnel: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    stopTunnel: stopMutation.mutateAsync,
    isStopping: stopMutation.isPending,
  };
}
