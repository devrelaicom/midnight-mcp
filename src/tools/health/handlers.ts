/**
 * Health handler functions
 * Business logic for health-related MCP tools
 */

import {
  getHealthStatus,
  getQuickHealthStatus,
  getRateLimitStatus,
  formatRateLimitStatus,
} from "../../utils/index.js";
import { searchCache, fileCache, metadataCache } from "../../utils/cache.js";
import { listVersions, listLibraries } from "../../services/playground.js";
import type {
  HealthCheckInput,
  GetStatusInput,
  CheckVersionInput,
  GetUpdateInstructionsInput,
  ListCompilerVersionsInput,
  ListLibrariesInput,
} from "./schemas.js";

import { z } from "zod";
import { CURRENT_VERSION } from "../../utils/version.js";

const NpmVersionSchema = z.object({ version: z.string() });

/**
 * Perform health check on the MCP server
 */
export async function healthCheck(input: HealthCheckInput) {
  if (input.detailed) {
    const status = await getHealthStatus();
    return {
      ...status,
      rateLimit: formatRateLimitStatus(),
      cacheStats: {
        search: searchCache.getStats(),
        file: fileCache.getStats(),
        metadata: metadataCache.getStats(),
      },
    };
  }

  return {
    ...getQuickHealthStatus(),
    rateLimit: formatRateLimitStatus(),
  };
}

/**
 * Get current server status and statistics
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function getStatus(_input: GetStatusInput) {
  const rateLimitStatus = getRateLimitStatus();

  return {
    server: "midnight-mcp",
    status: "running",
    timestamp: new Date().toISOString(),
    rateLimit: {
      remaining: rateLimitStatus.remaining,
      limit: rateLimitStatus.limit,
      percentUsed: rateLimitStatus.percentUsed,
      status: rateLimitStatus.isLimited ? "limited" : rateLimitStatus.isWarning ? "warning" : "ok",
      message: rateLimitStatus.message,
    },
    cache: {
      search: searchCache.getStats(),
      file: fileCache.getStats(),
      metadata: metadataCache.getStats(),
    },
  };
}

/**
 * Check if current version is up to date with npm
 */
export async function checkVersion(_input: CheckVersionInput) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 5000);

    const response = await fetch("https://registry.npmjs.org/midnight-mcp/latest", {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        currentVersion: CURRENT_VERSION,
        latestVersion: "unknown",
        isUpToDate: true, // Assume up to date if we can't check
        error: "Could not fetch latest version from npm",
      };
    }

    const raw: unknown = await response.json();
    const parsed = NpmVersionSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        currentVersion: CURRENT_VERSION,
        latestVersion: "unknown",
        isUpToDate: true,
        error: "Invalid response from npm registry",
      };
    }
    const latestVersion = parsed.data.version;
    const isUpToDate = CURRENT_VERSION === latestVersion;

    return {
      currentVersion: CURRENT_VERSION,
      latestVersion,
      isUpToDate,
      message: isUpToDate
        ? "✅ You are running the latest version!"
        : `⚠️ UPDATE AVAILABLE: v${latestVersion} (you have v${CURRENT_VERSION})`,
      updateInstructions: isUpToDate
        ? null
        : {
            step1:
              "Clear npx cache: rm -rf ~/.npm/_npx (macOS/Linux) or del /s /q %LocalAppData%\\npm-cache\\_npx (Windows)",
            step2: "Restart Claude Desktop completely (Cmd+Q / Alt+F4, then reopen)",
            step3: "Or update config to use: npx -y midnight-mcp@latest (forces latest)",
            alternative: "You can also install globally: npm install -g midnight-mcp@latest",
          },
      newFeatures: isUpToDate
        ? null
        : [
            "Auto-update config tool - AI agents update your config automatically",
            "midnight-analyze-contract - Static analysis with 10 pre-compilation checks",
            "MCP Logging, Progress, Completions capabilities",
          ],
    };
  } catch (error: unknown) {
    return {
      currentVersion: CURRENT_VERSION,
      latestVersion: "unknown",
      isUpToDate: true,
      error: `Failed to check version: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Supported editors list
 */
const SUPPORTED_EDITORS = ["claude-desktop", "cursor", "vscode", "windsurf"] as const;

/**
 * Get platform-specific npm cache clear command
 */
function getNpmCacheClearCommand(platform: string): string {
  if (platform === "windows") {
    return 'Remove-Item -Recurse -Force "$env:USERPROFILE\\.npm\\_npx" -ErrorAction SilentlyContinue';
  }
  return "rm -rf ~/.npm/_npx";
}

/**
 * Get detailed, platform-specific update instructions
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function getUpdateInstructions(input: GetUpdateInstructionsInput): Promise<object> {
  const platform = input.platform === "auto" ? detectPlatform() : input.platform;

  // If editor is "auto", return instructions for ALL supported editors
  if (input.editor === "auto") {
    return getMultiEditorInstructions(platform);
  }

  // Single editor mode
  const editor = input.editor;
  const configPaths = getConfigPaths(platform, editor);
  const restartCommand = getRestartCommand(platform, editor);
  const cacheCommand = getNpmCacheClearCommand(platform);

  return {
    title: "🔄 How to Update Midnight MCP",
    currentSetup: {
      detectedPlatform: platform,
      targetEditor: editor,
    },
    steps: [
      {
        step: 1,
        title: "Clear npm cache",
        command: cacheCommand,
        windowsNote:
          platform === "windows"
            ? "Run in PowerShell. For cmd.exe use: rd /s /q %USERPROFILE%\\.npm\\_npx"
            : undefined,
        explanation: "This removes cached npx packages so the latest version will be downloaded",
        required: true,
      },
      {
        step: 2,
        title: "Restart your editor completely",
        action: restartCommand,
        explanation: "A full restart is needed - just reloading the window is not enough",
        required: true,
      },
      {
        step: 3,
        title: "If still outdated, update config file",
        configPath: configPaths.primary,
        alternativePaths: configPaths.alternatives,
        change: {
          find: '"midnight-mcp"',
          replaceWith: '"midnight-mcp@latest"',
          location: 'In the "args" array for the midnight server',
        },
        explanation: "Adding @latest ensures you always get the newest version",
        required: false,
      },
    ],
    troubleshooting: getTroubleshootingSection(platform, configPaths),
    exampleConfig: generateExampleConfig(editor),
    helpfulLinks: {
      documentation: "https://github.com/Olanetsoft/midnight-mcp#readme",
      issues: "https://github.com/Olanetsoft/midnight-mcp/issues",
    },
  };
}

/**
 * Get instructions for all supported editors
 */
function getMultiEditorInstructions(platform: string): object {
  const cacheCommand = getNpmCacheClearCommand(platform);

  const editorConfigs = SUPPORTED_EDITORS.map((editor) => {
    const paths = getConfigPaths(platform, editor);
    const restart = getRestartCommand(platform, editor);
    return {
      editor,
      displayName: getEditorDisplayName(editor),
      configPath: paths.primary,
      alternativePaths: paths.alternatives,
      restartCommand: restart,
    };
  });

  return {
    title: "🔄 How to Update Midnight MCP",
    currentSetup: {
      detectedPlatform: platform,
      targetEditor: "all (auto mode)",
    },
    commonSteps: [
      {
        step: 1,
        title: "Clear npm cache",
        command: cacheCommand,
        windowsNote:
          platform === "windows"
            ? "Run in PowerShell. For cmd.exe use: rd /s /q %USERPROFILE%\\.npm\\_npx"
            : undefined,
        explanation: "This removes cached npx packages so the latest version will be downloaded",
        required: true,
      },
      {
        step: 2,
        title: "Restart your editor completely",
        explanation: "A full restart is needed - just reloading the window is not enough",
        required: true,
      },
    ],
    editorSpecificPaths: editorConfigs,
    configChange: {
      find: '"midnight-mcp"',
      replaceWith: '"midnight-mcp@latest"',
      location: 'In the "args" array for the midnight server',
    },
    troubleshooting: [
      {
        issue: "Still seeing old version after restart",
        solutions: [
          platform === "mac"
            ? "Make sure you quit the editor completely (Cmd+Q)"
            : platform === "windows"
              ? "Make sure you quit the editor completely (Alt+F4)"
              : "Make sure you quit the editor completely",
          "Check if multiple editor instances are running",
          platform === "windows"
            ? 'Try: Remove-Item -Recurse -Force "$env:USERPROFILE\\.npm\\_npx", "$env:LOCALAPPDATA\\midnight-mcp"'
            : "Try: rm -rf ~/.npm/_npx && rm -rf ~/.cache/midnight-mcp",
        ],
      },
      {
        issue: "Config file not found",
        solutions: [
          "Check the editor-specific paths listed above",
          "Create the config file if it doesn't exist",
          "See docs: https://github.com/Olanetsoft/midnight-mcp",
        ],
      },
    ],
    exampleConfig: {
      mcpServers: {
        midnight: {
          command: "npx",
          args: ["-y", "midnight-mcp@latest"],
        },
      },
    },
    helpfulLinks: {
      documentation: "https://github.com/Olanetsoft/midnight-mcp#readme",
      issues: "https://github.com/Olanetsoft/midnight-mcp/issues",
    },
  };
}

function getEditorDisplayName(editor: string): string {
  const names: Record<string, string> = {
    "claude-desktop": "Claude Desktop",
    cursor: "Cursor",
    vscode: "VS Code",
    windsurf: "Windsurf",
  };
  return names[editor] || editor;
}

function getTroubleshootingSection(
  platform: string,
  configPaths: { primary: string; alternatives: string[] },
): object[] {
  const quitCommand =
    platform === "mac" ? "Cmd+Q" : platform === "windows" ? "Alt+F4" : "close completely";
  const cacheCleanup =
    platform === "windows"
      ? 'Remove-Item -Recurse -Force "$env:USERPROFILE\\.npm\\_npx", "$env:LOCALAPPDATA\\midnight-mcp"'
      : "rm -rf ~/.npm/_npx && rm -rf ~/.cache/midnight-mcp";

  return [
    {
      issue: "Still seeing old version after restart",
      solutions: [
        `Make sure you quit the editor completely (${quitCommand})`,
        "Check if multiple editor instances are running",
        `Try: ${cacheCleanup}`,
      ],
    },
    {
      issue: "Config file not found",
      solutions: [
        `Primary location: ${configPaths.primary}`,
        "Create it if it doesn't exist",
        "See docs: https://github.com/Olanetsoft/midnight-mcp",
      ],
    },
    {
      issue: "Permission denied errors",
      solutions:
        platform === "windows"
          ? ["Run editor as administrator", "Check file permissions in Windows Security settings"]
          : ["Check file permissions with ls -la", "Ensure your user owns the config file"],
    },
  ];
}

function detectPlatform(): "mac" | "windows" | "linux" {
  const p = process.platform;
  if (p === "darwin") return "mac";
  if (p === "win32") return "windows";
  return "linux";
}

function getConfigPaths(
  platform: string,
  editor: string,
): { primary: string; alternatives: string[] } {
  const home = process.env.HOME || process.env.USERPROFILE || "~";

  const paths: Record<string, Record<string, { primary: string; alternatives: string[] }>> = {
    mac: {
      "claude-desktop": {
        primary: `${home}/Library/Application Support/Claude/claude_desktop_config.json`,
        alternatives: [],
      },
      cursor: {
        primary: `${home}/.cursor/mcp.json`,
        alternatives: [`${home}/Library/Application Support/Cursor/mcp.json`],
      },
      vscode: {
        primary: `${home}/.vscode/mcp.json`,
        alternatives: [`${home}/Library/Application Support/Code/User/settings.json`],
      },
      windsurf: {
        primary: `${home}/.codeium/windsurf/mcp_config.json`,
        alternatives: [],
      },
    },
    windows: {
      "claude-desktop": {
        primary: `%APPDATA%\\Claude\\claude_desktop_config.json`,
        alternatives: [],
      },
      cursor: {
        primary: `%USERPROFILE%\\.cursor\\mcp.json`,
        alternatives: [`%APPDATA%\\Cursor\\mcp.json`],
      },
      vscode: {
        primary: `%USERPROFILE%\\.vscode\\mcp.json`,
        alternatives: [`%APPDATA%\\Code\\User\\settings.json`],
      },
      windsurf: {
        primary: `%USERPROFILE%\\.codeium\\windsurf\\mcp_config.json`,
        alternatives: [],
      },
    },
    linux: {
      "claude-desktop": {
        primary: `${home}/.config/Claude/claude_desktop_config.json`,
        alternatives: [],
      },
      cursor: {
        primary: `${home}/.cursor/mcp.json`,
        alternatives: [`${home}/.config/Cursor/mcp.json`],
      },
      vscode: {
        primary: `${home}/.vscode/mcp.json`,
        alternatives: [`${home}/.config/Code/User/settings.json`],
      },
      windsurf: {
        primary: `${home}/.codeium/windsurf/mcp_config.json`,
        alternatives: [],
      },
    },
  };

  const fallback = paths.mac?.["claude-desktop"] ?? { primary: "", alternatives: [] };
  return paths[platform]?.[editor] ?? fallback;
}

function getRestartCommand(platform: string, editor: string): string {
  const editorNames: Record<string, string> = {
    "claude-desktop": "Claude Desktop",
    cursor: "Cursor",
    vscode: "VS Code",
    windsurf: "Windsurf",
  };

  const name = editorNames[editor] || editor;

  if (platform === "mac") {
    return `Quit ${name} completely (Cmd+Q), then reopen`;
  } else if (platform === "windows") {
    return `Close ${name} completely (Alt+F4 or File > Exit), then reopen`;
  } else {
    return `Close ${name} completely, then reopen`;
  }
}

function generateExampleConfig(editor: string): object {
  const baseConfig = {
    mcpServers: {
      midnight: {
        command: "npx",
        args: ["-y", "midnight-mcp@latest"],
      },
    },
  };

  if (editor === "vscode") {
    return {
      note: "For VS Code, add to settings.json or mcp.json",
      config: baseConfig,
    };
  }

  return baseConfig;
}

export async function handleListCompilerVersions(_input: ListCompilerVersionsInput) {
  return listVersions();
}

export async function handleListLibraries(_input: ListLibrariesInput) {
  return listLibraries();
}
