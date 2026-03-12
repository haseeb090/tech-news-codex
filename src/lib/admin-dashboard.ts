import { getActiveRun, getFailedLinks, getLastRun, getRecentAttempts } from "@/lib/db";

export const getAdminDashboardData = () => {
  const activeRun = getActiveRun();
  const lastRun = getLastRun();
  const failedLinks = getFailedLinks(50);
  const recentAttempts = getRecentAttempts(20);

  return {
    activeRun,
    lastRun,
    failedLinks,
    recentAttempts,
  };
};
