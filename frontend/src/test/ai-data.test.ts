import { expect, it } from "vitest";
import { aiTools } from "@/components/cp/ai-data";
it("marks write-class tools as requiring confirmation", () => {
  for (const name of ["Run Command", "Write File", "Search Replace", "Delete File", "MysqlExecute", "MysqlExecuteDdl", "Restart Service", "Send Notification"]) {
    expect(aiTools.find(tool => tool.name === name)?.write).toBe(true);
  }
});
it("keeps diagnostic sub-agent and SQL query tools read-only", () => {
  for (const name of ["Task Sub-agent", "Read Only Command", "MysqlQuery", "Security Baseline Scan"]) {
    expect(aiTools.find(tool => tool.name === name)?.write).toBe(false);
  }
});