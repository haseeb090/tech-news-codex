import {
  getActiveRun,
  getAttemptsByRunId,
  getFailedLinks,
  getIngestEventsByRunId,
  getLastCompletedRun,
  getLastRun,
  getRecentAttempts,
  getReaderSignupCount,
  getRecentReaderSignups,
} from "@/lib/db";

export const getAdminDashboardData = async () => {
  const [activeRun, lastRun, lastCompletedRun, failedLinks, recentAttempts, totalReaderSignups, recentReaderSignups] = await Promise.all([
    getActiveRun(),
    getLastRun(),
    getLastCompletedRun(),
    getFailedLinks(75),
    getRecentAttempts(150),
    getReaderSignupCount(),
    getRecentReaderSignups(25),
  ]);

  const timelineRun = activeRun ?? lastCompletedRun ?? lastRun;
  const [timelineEvents, currentRunAttempts] = await Promise.all([
    timelineRun ? getIngestEventsByRunId(timelineRun.runId, 500) : Promise.resolve([]),
    activeRun ? getAttemptsByRunId(activeRun.runId, 200) : Promise.resolve([]),
  ]);

  return {
    activeRun,
    lastRun,
    lastCompletedRun,
    failedLinks,
    recentAttempts,
    currentRunAttempts,
    timelineRun,
    timelineEvents,
    totalReaderSignups,
    recentReaderSignups,
  };
};
