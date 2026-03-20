import { spawn } from "node:child_process";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type Mode = "app" | "worker";

const mode = process.argv[2] as Mode | undefined;

if (mode !== "app" && mode !== "worker") {
  console.error("Usage: npm run docker:app | npm run docker:worker");
  process.exit(1);
}

const runCommand = (command: string, args: string[], env: NodeJS.ProcessEnv) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
      shell: true,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });

    child.on("error", reject);
  });

const main = async () => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    PORT: process.env.PORT || "3000",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3000",
    ADMIN_ENABLED: process.env.ADMIN_ENABLED || "true",
    ADMIN_LOCAL_ONLY: process.env.ADMIN_LOCAL_ONLY || "true",
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434",
    WORKER_INTERVAL_MINUTES: process.env.WORKER_INTERVAL_MINUTES || "180",
    WORKER_ALIGN_TO_INTERVAL: process.env.WORKER_ALIGN_TO_INTERVAL || "true",
    WORKER_RUN_ON_START: process.env.WORKER_RUN_ON_START || "true",
  };

  console.log(`[docker-run] bootstrapping ${mode}`);
  console.log("[docker-run] env summary", {
    nodeEnv: env.NODE_ENV,
    nextauthUrl: env.NEXTAUTH_URL,
    adminEnabled: env.ADMIN_ENABLED,
    adminLocalOnly: env.ADMIN_LOCAL_ONLY,
    ollamaBaseUrl: env.OLLAMA_BASE_URL,
    workerIntervalMinutes: env.WORKER_INTERVAL_MINUTES,
    workerAlignToInterval: env.WORKER_ALIGN_TO_INTERVAL,
    workerRunOnStart: env.WORKER_RUN_ON_START,
  });

  await runCommand("npm", ["run", "db:push", "--", "--force"], env);
  await runCommand("npm", ["run", mode === "app" ? "start" : "worker"], env);
};

void main().catch((error) => {
  console.error("[docker-run] failed to start", error);
  process.exit(1);
});
