import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceApi } from "@/api/service.api";
import { ServiceAction } from "@/types/service.types";
import { toast } from "sonner";

export function useServices() {
  const queryClient = useQueryClient();

  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: () => serviceApi.list(),
    refetchInterval: 5000,
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      name,
      action,
      mode,
    }: {
      name: string;
      action: ServiceAction;
      mode?: "native" | "docker";
    }) => {
      if (action === "start") return serviceApi.start(name, mode);
      if (action === "stop") return serviceApi.stop(name, mode);
      return serviceApi.restart(name, mode);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast.success(
        `Service ${variables.name} ${variables.action === "stop" ? "stopped" : variables.action === "start" ? "started" : "restarted"} successfully`
      );
    },
    onError: (error: unknown, variables) => {
      toast.error(`Failed to ${variables.action} service ${variables.name}: ${(error as Error)?.message || "Unknown error"}`);
    },
  });

  return {
    ...servicesQuery,
    performAction: actionMutation.mutateAsync,
    isActing: actionMutation.isPending,
  };
}
