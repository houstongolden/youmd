import chalk from "chalk";
import {
  getYouStackCapabilities,
  loadYouStackManifest,
  routeYouStackRequest,
  runYouStackSmoke,
  YouStackCapability,
  YouStackValidationResult,
} from "../lib/youstack";

const ACCENT = chalk.hex("#C46A3A");
const DIM = chalk.dim;

interface StackCommandOptions {
  path?: string;
  json?: boolean;
}

function printHelp(): void {
  console.log("");
  console.log("  " + chalk.bold("youmd stack") + DIM(" -- local YouStack manifest tools"));
  console.log("");
  console.log("  " + ACCENT("Commands"));
  console.log("    " + chalk.cyan("inspect") + DIM("       Show the local stack manifest summary"));
  console.log("    " + chalk.cyan("smoke") + DIM("         Run read-only local manifest/file checks"));
  console.log("    " + chalk.cyan("capabilities") + DIM("  List declared local capabilities"));
  console.log("    " + chalk.cyan("route \"...\"") + DIM("   Pick the best local capability for a request"));
  console.log("");
  console.log("  " + DIM("Options: ") + chalk.cyan("--path <manifest-or-dir>") + DIM(", ") + chalk.cyan("--json"));
  console.log("");
}

function printValidation(validation: YouStackValidationResult): void {
  for (const warning of validation.warnings) {
    console.log("  " + chalk.yellow("WARN") + " " + warning);
  }
  for (const error of validation.errors) {
    console.log("  " + chalk.red("FAIL") + " " + error);
  }
}

function capabilityLabel(capability: YouStackCapability): string {
  const mode = capability.localOnly ? "local" : capability.mcpTool || capability.apiEndpoint ? "api/mcp" : "mixed";
  const policy = capability.mutationPolicy || "unspecified";
  return `${capability.id} ${DIM(`[${mode}; ${policy}]`)}`;
}

export async function stackCommand(
  subcommand?: string,
  args: string[] = [],
  options: StackCommandOptions = {}
): Promise<void> {
  const cmd = subcommand || "help";

  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }

  let loaded;
  try {
    loaded = loadYouStackManifest(options.path);
  } catch (error) {
    console.log("");
    console.log(chalk.red("  youmd stack: ") + (error instanceof Error ? error.message : String(error)));
    console.log("");
    process.exitCode = 1;
    return;
  }

  if (cmd === "inspect") {
    if (options.json) {
      console.log(JSON.stringify(loaded, null, 2));
      return;
    }

    const manifest = loaded.manifest;
    console.log("");
    console.log("  " + ACCENT("youstack") + " " + chalk.bold(manifest.name));
    console.log("  " + DIM("slug: ") + chalk.cyan(manifest.slug));
    console.log("  " + DIM("version: ") + manifest.version);
    console.log("  " + DIM("visibility: ") + manifest.visibility);
    console.log("  " + DIM("manifest: ") + loaded.manifestPath);
    console.log("");
    console.log("  " + DIM("files: ") + String(manifest.files?.length || 0));
    console.log("  " + DIM("brain scopes: ") + String(manifest.brainScopes?.length || 0));
    console.log("  " + DIM("capabilities: ") + String(getYouStackCapabilities(manifest).length));
    console.log("  " + DIM("adapters: ") + Object.keys(manifest.adapters || {}).join(", "));
    console.log("");
    printValidation(loaded.validation);
    if (loaded.validation.ok) {
      console.log("  " + chalk.green("OK") + " manifest schema is valid");
    }
    console.log("");
    return;
  }

  if (cmd === "capabilities") {
    const capabilities = getYouStackCapabilities(loaded.manifest);
    if (options.json) {
      console.log(JSON.stringify({ capabilities }, null, 2));
      return;
    }

    console.log("");
    console.log("  " + ACCENT("youstack capabilities") + DIM(` (${capabilities.length})`));
    console.log("");
    for (const capability of capabilities) {
      console.log("  " + chalk.cyan(capabilityLabel(capability)));
      if (capability.intent) console.log("    " + DIM(capability.intent));
      if (capability.requiredScopes?.length) {
        console.log("    " + DIM("scopes: ") + capability.requiredScopes.join(", "));
      }
    }
    console.log("");
    return;
  }

  if (cmd === "route") {
    const request = args.join(" ").trim();
    if (!request) {
      console.log("");
      console.log(chalk.yellow("  usage: youmd stack route \"start this repo with my preferences\""));
      console.log("");
      process.exitCode = 1;
      return;
    }

    const route = routeYouStackRequest(loaded.manifest, request);
    if (options.json) {
      console.log(JSON.stringify(route, null, 2));
      return;
    }

    console.log("");
    console.log("  " + ACCENT("route") + " " + chalk.cyan(route.capability.id));
    console.log("  " + DIM("request: ") + request);
    if (route.capability.intent) {
      console.log("  " + DIM("intent: ") + route.capability.intent);
    }
    console.log("  " + DIM("policy: ") + (route.capability.mutationPolicy || "unspecified"));
    if (route.capability.skill) console.log("  " + DIM("skill: ") + route.capability.skill);
    if (route.capability.mcpTool) console.log("  " + DIM("mcp: ") + route.capability.mcpTool);
    if (route.capability.apiEndpoint) console.log("  " + DIM("api: ") + route.capability.apiEndpoint);
    console.log("");
    return;
  }

  if (cmd === "smoke") {
    const result = runYouStackSmoke(loaded);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exitCode = 1;
      return;
    }

    console.log("");
    console.log("  " + ACCENT("youstack smoke") + DIM(" -- read-only"));
    console.log("");
    for (const check of result.checks) {
      console.log("  " + chalk.green("OK") + " " + check);
    }
    printValidation(result);
    console.log("");
    if (result.ok) {
      console.log("  " + chalk.green("Smoke passed.") + " " + DIM("No brain data was modified, no connected tools were invoked, and no files were changed."));
    } else {
      console.log("  " + chalk.red("Smoke failed.") + " " + DIM("Fix the manifest errors above and rerun."));
      process.exitCode = 1;
    }
    console.log("");
    return;
  }

  console.log("");
  console.log(chalk.yellow(`  unknown stack command: ${cmd}`));
  printHelp();
  process.exitCode = 1;
}
