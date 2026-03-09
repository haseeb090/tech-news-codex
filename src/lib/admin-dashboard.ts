import { getFailedLinks, getLastRun } from "@/lib/db";

export const getAdminDashboardData = () => {
  const lastRun = getLastRun();
  const failedLinks = getFailedLinks(50);

  return {
    lastRun,
    failedLinks,
  };
};