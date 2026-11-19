import { createFileRoute } from "@tanstack/react-router";
import { CronWorkspace } from "@/components/cp/CronWorkspace";
import { meta } from "@/components/cp/meta";

export const Route = createFileRoute("/cron")({ head: () => meta("Cron Job", "Preview CrossPanel task scheduling, multiple execution times, shell script library and task import or export."), component: CronWorkspace });