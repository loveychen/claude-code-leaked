#!/usr/bin/env bun
/**
 * Development script for claude-code-leaked
 * Watches for changes and rebuilds automatically
 */

import { watch } from "fs";
import path from "path";

const SRC_DIR = path.join(process.cwd(), "src");

console.log("Starting development mode...");
console.log(`Watching ${SRC_DIR} for changes...`);

// Simple debounce implementation
let rebuildTimeout: NodeJS.Timeout | null = null;
function debouncedBuild() {
  if (rebuildTimeout) {
    clearTimeout(rebuildTimeout);
  }
  rebuildTimeout = setTimeout(async () => {
    console.log("\nChanges detected, rebuilding...");
    try {
      await $`bun run build.ts`;
      console.log("Build completed successfully!");
    } catch (error) {
      console.error("Build failed:", error);
    }
  }, 300);
}

// Watch source directory
const watcher = watch(
  SRC_DIR,
  { recursive: true },
  (eventType, filename) => {
    if (filename && (filename.endsWith(".ts") || filename.endsWith(".tsx"))) {
      console.log(`File ${eventType}: ${filename}`);
      debouncedBuild();
    }
  }
);

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nStopping development watcher...");
  watcher.close();
  process.exit(0);
});

console.log("Development mode running. Press Ctrl+C to stop.");
