#!/usr/bin/env bun
/**
 * Build script for claude-code-leaked
 * Uses Bun's built-in build API to compile TypeScript to JavaScript
 */

import { $ } from "bun";
import { rm, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const DIST_DIR = path.join(process.cwd(), "dist");
const SRC_DIR = path.join(process.cwd(), "src");

async function main() {
  console.log("Building claude-code-leaked...");

  // Clean dist directory
  if (existsSync(DIST_DIR)) {
    console.log("Cleaning dist directory...");
    await rm(DIST_DIR, { recursive: true, force: true });
  }

  // Create dist directory
  await mkdir(DIST_DIR, { recursive: true });

  // Build main entry point (CLI)
  console.log("Building main entry point...");
  await Bun.build({
    entrypoints: [path.join(SRC_DIR, "main.tsx")],
    outdir: DIST_DIR,
    naming: "cli.js",
    target: "bun",
    format: "esm",
    sourcemap: "inline",
    minify: false,
    splitting: false,
    external: ["*.node"],
    define: {
      "MACRO.VERSION": JSON.stringify("1.0.3-leaked"),
      "MACRO.BUILD_TIME": JSON.stringify(new Date().toISOString()),
      "MACRO.FEEDBACK_CHANNEL": JSON.stringify("#claude-code-feedback"),
      "MACRO.ISSUES_EXPLAINER": JSON.stringify("report issues at https://github.com/claude-code-best/claude-code/issues"),
      "MACRO.PACKAGE_URL": JSON.stringify("@anthropic-ai/claude-code"),
      "process.env.USER_TYPE": JSON.stringify("external"),
    },
  });

  // Copy package.json to dist for reference
  const pkg = JSON.parse(await Bun.file("package.json").text());
  // Remove workspace dependencies from bin target
  delete pkg.workspaces;
  delete pkg.scripts;
  delete pkg.devDependencies;

  await Bun.write(
    path.join(DIST_DIR, "package.json"),
    JSON.stringify(pkg, null, 2)
  );

  console.log("Build complete!");
  console.log(`Output directory: ${DIST_DIR}`);

  // Verify build output
  const cliJs = path.join(DIST_DIR, "cli.js");
  if (existsSync(cliJs)) {
    const stats = await Bun.file(cliJs).size;
    console.log(`cli.js size: ${(stats / 1024).toFixed(2)} KB`);
  } else {
    console.error("ERROR: cli.js was not created");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
