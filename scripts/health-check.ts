#!/usr/bin/env bun
/**
 * Health check script for claude-code-leaked
 * Verifies the build output and basic functionality
 */

import { existsSync } from "fs";
import path from "path";

const DIST_DIR = path.join(process.cwd(), "dist");

interface HealthCheck {
  name: string;
  check: () => boolean | Promise<boolean>;
}

const healthChecks: HealthCheck[] = [
  {
    name: "Dist directory exists",
    check: () => existsSync(DIST_DIR),
  },
  {
    name: "cli.js exists",
    check: () => existsSync(path.join(DIST_DIR, "cli.js")),
  },
  {
    name: "cli.js is not empty",
    check: () => {
      const cliPath = path.join(DIST_DIR, "cli.js");
      if (!existsSync(cliPath)) return false;
      const stats = Bun.file(cliPath).size;
      return stats > 0;
    },
  },
  {
    name: "Package.json exists in dist",
    check: () => existsSync(path.join(DIST_DIR, "package.json")),
  },
];

async function runHealthChecks() {
  console.log("Running health checks...\n");

  let allPassed = true;

  for (const { name, check } of healthChecks) {
    try {
      const result = await check();
      const status = result ? "✓" : "✗";
      console.log(`${status} ${name}`);
      if (!result) {
        allPassed = false;
      }
    } catch (error) {
      console.log(`✗ ${name} - Error: ${error}`);
      allPassed = false;
    }
  }

  console.log("");
  if (allPassed) {
    console.log("All health checks passed!");
    process.exit(0);
  } else {
    console.log("Some health checks failed!");
    process.exit(1);
  }
}

runHealthChecks().catch((err) => {
  console.error("Health check failed:", err);
  process.exit(1);
});
