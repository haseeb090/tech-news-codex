import fs from "node:fs/promises";
import path from "node:path";

import { hash } from "@node-rs/argon2";
import { loadEnvConfig } from "@next/env";

import { clearAdminRateLimits, closeDb } from "@/lib/db";

loadEnvConfig(process.cwd());

const envPath = path.resolve(process.cwd(), ".env.local");

const escapeEnvValue = (value: string): string => value.replace(/\$/g, "\\$");

const updateEnvLine = (source: string, key: string, value: string): string => {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");

  if (pattern.test(source)) {
    return source.replace(pattern, line);
  }

  return source.endsWith("\n") ? `${source}${line}\n` : `${source}\n${line}\n`;
};

const main = async () => {
  const password = process.argv[2];
  const usernameArg = process.argv.find((arg) => arg.startsWith("--username="));
  const username = usernameArg?.split("=")[1]?.trim() || process.env.ADMIN_USERNAME || "admin";

  if (!password) {
    console.error("Usage: npm run admin:set-password -- <new-password> [--username=haseeb090]");
    process.exit(1);
  }

  const envSource = await fs.readFile(envPath, "utf-8");
  const passwordHash = await hash(password);
  let nextEnv = updateEnvLine(envSource, "ADMIN_USERNAME", username);
  nextEnv = updateEnvLine(nextEnv, "ADMIN_PASSWORD_HASH", escapeEnvValue(passwordHash));
  await fs.writeFile(envPath, nextEnv, "utf-8");
  let clearedRateLimitKeys = 0;

  try {
    clearedRateLimitKeys = await clearAdminRateLimits(username);
  } catch (error) {
    console.warn("Updated .env.local, but could not clear admin rate limits from the database.");
    console.warn(error);
  } finally {
    await closeDb();
  }

  console.log(`Updated .env.local for ADMIN_USERNAME=${username}`);
  console.log(`Cleared ${clearedRateLimitKeys} admin rate-limit entr${clearedRateLimitKeys === 1 ? "y" : "ies"} for ${username}.`);
  console.log("Restart your local app or docker compose stack so the new admin password hash is loaded.");
};

void main();
