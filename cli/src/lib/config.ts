import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), ".youmd");
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, "config.json");
const LOCAL_BUNDLE_DIR = ".youmd";

export interface GlobalConfig {
  token?: string;
  username?: string;
  email?: string;
  apiUrl?: string;
}

export interface LocalConfig {
  version: number;
  sources: Array<{ type: string; url: string; addedAt: string }>;
  lastPublished?: string;
}

export function getGlobalConfigDir(): string {
  return GLOBAL_CONFIG_DIR;
}

export function getGlobalConfigPath(): string {
  return GLOBAL_CONFIG_FILE;
}

export function getLocalBundleDir(): string {
  return path.resolve(process.cwd(), LOCAL_BUNDLE_DIR);
}

export function readGlobalConfig(): GlobalConfig {
  if (!fs.existsSync(GLOBAL_CONFIG_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(GLOBAL_CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function writeGlobalConfig(config: GlobalConfig): void {
  if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
    fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
}

export function readLocalConfig(): LocalConfig | null {
  const configPath = path.join(getLocalBundleDir(), "config.json");
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeLocalConfig(config: LocalConfig): void {
  const configPath = path.join(getLocalBundleDir(), "config.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

export function localBundleExists(): boolean {
  return fs.existsSync(getLocalBundleDir());
}

export function isAuthenticated(): boolean {
  const config = readGlobalConfig();
  return !!config.token;
}
