import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { databaseApi } from "@/api/database.api";
import { toast } from "sonner";

export function useDatabase() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["database-status"],
    queryFn: () => databaseApi.getStatus(),
    refetchInterval: 10000,
  });

  const launchPmaMutation = useMutation({
    mutationFn: () => databaseApi.launchPhpMyAdmin(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["database-status"] });
      toast.success(data.message || `phpMyAdmin ready on port ${data.port}!`);
      window.open(data.url, "_blank");
    },
    onError: (error: unknown) => {
      toast.error(`Failed to launch phpMyAdmin: ${(error as Error)?.message || "Unknown error"}`);
    },
  });

  return {
    ...statusQuery,
    launchPhpMyAdmin: launchPmaMutation.mutateAsync,
    isLaunchingPma: launchPmaMutation.isPending,
  };
}
