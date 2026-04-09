import chalk from "chalk";
import { localBundleExists, readLocalConfig, writeLocalConfig } from "../lib/config";

const VALID_SOURCES = ["website", "linkedin", "x", "blog", "youtube", "github"];

export function addCommand(source: string, url: string): void {
  console.log("");

  if (!localBundleExists()) {
    console.log(chalk.yellow("no .youmd/ directory found"));
    console.log("");
    console.log("Run " + chalk.cyan("youmd init") + " to create one.");
    console.log("");
    return;
  }

  if (!VALID_SOURCES.includes(source.toLowerCase())) {
    console.log(chalk.yellow("unknown source type: ") + source);
    console.log("");
    console.log("Valid source types:");
    for (const s of VALID_SOURCES) {
      console.log("  - " + s);
    }
    console.log("");
    return;
  }

  // Basic URL validation — HTTPS only.
  // Cycle 53: previously accepted http:// as well. Sources get fetched by
  // the pipeline and feed into the user's identity bundle, so insecure
  // fetches are an injection vector. HTTPS-only.
  if (!url.startsWith("https://")) {
    console.log(chalk.yellow("URL must start with https:// (insecure http:// not allowed)"));
    console.log("");
    return;
  }

  const localConfig = readLocalConfig();
  if (!localConfig) {
    console.log(chalk.yellow("local config not found -- run ") + chalk.cyan("youmd init"));
    console.log("");
    return;
  }

  // Check for duplicates
  const exists = localConfig.sources.some(
    (s) => s.type === source.toLowerCase() && s.url === url
  );
  if (exists) {
    console.log(chalk.yellow("source already exists: ") + source + " " + chalk.cyan(url));
    console.log("");
    return;
  }

  localConfig.sources.push({
    type: source.toLowerCase(),
    url,
    addedAt: new Date().toISOString(),
  });

  writeLocalConfig(localConfig);

  console.log(chalk.green("added") + " " + source + " source: " + chalk.cyan(url));
  console.log("");

  if (localConfig.sources.length > 1) {
    console.log("Current sources:");
    for (let i = 0; i < localConfig.sources.length; i++) {
      const s = localConfig.sources[i];
      const connector = i === localConfig.sources.length - 1 ? "\u2514\u2500\u2500" : "\u251C\u2500\u2500";
      console.log(`  ${connector} ${s.type}: ${chalk.cyan(s.url)}`);
    }
    console.log("");
  }
}
