import { getActiveRun, getFailedLinks, getLastRun, getRecentAttempts } from "@/lib/db";

export const getAdminDashboardData = async () => {
  const [activeRun, lastRun, failedLinks, recentAttempts] = await Promise.all([
    getActiveRun(),
    getLastRun(),
    getFailedLinks(50),
    getRecentAttempts(20),
  ]);

  return {
    activeRun,
    lastRun,
    failedLinks,
    recentAttempts,
  };
};
