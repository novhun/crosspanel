import { createFileRoute } from "@tanstack/react-router";
import { FtpWorkspace } from "@/components/cp/FtpWorkspace";
import { meta } from "@/components/cp/meta";

export const Route = createFileRoute("/ftp")({
  head: () =>
    meta(
      "FTP / SFTP Manager",
      "Connect to FTP, FTPS, and SFTP servers, transfer files, and host local CrossPanel FTP user accounts."
    ),
  component: FtpWorkspace,
});
