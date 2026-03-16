#!/usr/bin/env tsx
/**
 * Auto-generate server.json from package.json and tool registrations.
 * Run: npx tsx scripts/update-server-json.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const rootDir = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf-8"));

// Count tools by searching for tool name patterns in source files
const toolDirs = ["search", "analyze", "repository", "health", "meta", "diff", "format"];
let toolCount = 0;
for (const dir of toolDirs) {
  const content = readFileSync(resolve(rootDir, `src/tools/${dir}/tools.ts`), "utf-8");
  toolCount += (content.match(/name: "midnight-/g) || []).length;
}

const serverJson = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  author: pkg.author,
  license: pkg.license,
  repository:
    typeof pkg.repository === "string"
      ? pkg.repository
      : pkg.repository?.url?.replace(/\.git$/, ""),
  homepage: pkg.homepage,
  transport: ["stdio", "http"],
  tools: toolCount,
  resources: 5,
  prompts: 0,
  keywords: pkg.keywords,
  categories: ["blockchain", "developer-tools"],
};

writeFileSync(resolve(rootDir, "server.json"), JSON.stringify(serverJson, null, 2) + "\n");
console.log(`server.json updated: v${serverJson.version}, ${serverJson.tools} tools`);
