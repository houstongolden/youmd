import * as os from "os";
import chalk from "chalk";
import {
  apiErrorMessage,
  listAgentBusMessages,
  sendAgentBusMessage,
  type AgentBusMessage,
} from "../lib/api";
import { isAuthenticated } from "../lib/config";
import { readRealtimeSyncStatusFile, REALTIME_AGENT_INBOX_PATH } from "../lib/realtime-sync";

const DIM = chalk.dim;
const ACCENT = chalk.hex("#C46A3A");

type AgentCommandOptions = {
  channel?: string;
  kind?: string;
  targetHost?: string;
  targetAgent?: string;
  agent?: string;
  limit?: string;
  tail?: boolean;
  json?: boolean;
};

function sourceAgentName(options: AgentCommandOptions): string {
  return (
    options.agent ||
    process.env.YOUMD_AGENT_NAME ||
    process.env.CLAUDECODE_AGENT_NAME ||
    process.env.CODEX_AGENT_NAME ||
    "local-agent"
  );
}

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function printMessage(message: AgentBusMessage): void {
  const from = [message.sourceAgent, message.sourceHost].filter(Boolean).join("@") || "agent";
  const target = message.targetHost || message.targetAgent
    ? DIM(` -> ${[message.targetAgent, message.targetHost].filter(Boolean).join("@")}`)
    : "";
  const when = DIM(relativeTime(message.createdAt).padStart(7));
  const channel = DIM(`[${message.channel}]`);
  console.log(`  ${when}  ${chalk.cyan(from)}${target}  ${channel}`);
  console.log(`         ${message.body}`);
}

function usage(): void {
  console.log("");
  console.log("  " + chalk.bold("youmd agent") + DIM(" -- trusted-device realtime agent bus"));
  console.log("");
  console.log("  " + DIM("send:   ") + chalk.cyan('youmd agent send "hello from my Mac mini"'));
  console.log("  " + DIM("inbox:  ") + chalk.cyan("youmd agent inbox --tail"));
  console.log("  " + DIM("status: ") + chalk.cyan("youmd agent status"));
  console.log("");
}

export async function agentCommand(
  subcommand: string | undefined,
  messageArgs: string[],
  options: AgentCommandOptions,
): Promise<void> {
  const command = subcommand || "status";

  if (command === "help" || command === "--help" || command === "-h") {
    usage();
    return;
  }

  if (!isAuthenticated()) {
    console.log("");
    console.log(chalk.yellow("  not authenticated"));
    console.log("  run " + chalk.cyan("youmd login") + " before using the agent bus.");
    console.log("");
    return;
  }

  if (command === "send") {
    await sendCommand(messageArgs, options);
    return;
  }

  if (command === "inbox" || command === "messages") {
    await inboxCommand(options);
    return;
  }

  if (command === "status") {
    statusCommand(options);
    return;
  }

  await sendCommand([command, ...messageArgs], options);
}

async function sendCommand(messageArgs: string[], options: AgentCommandOptions): Promise<void> {
  const body = messageArgs.join(" ").trim();
  if (!body) {
    console.log("");
    console.log(chalk.yellow("  nothing to send"));
    console.log("  try " + chalk.cyan('youmd agent send "mini is online"'));
    console.log("");
    return;
  }

  const res = await sendAgentBusMessage({
    body,
    channel: options.channel || "machine-sync",
    kind: options.kind || "message",
    sourceHost: os.hostname(),
    sourceAgent: sourceAgentName(options),
    sourceRuntime: `youmd-cli/${process.version}`,
    targetHost: options.targetHost,
    targetAgent: options.targetAgent,
    metadata: {
      cwd: process.cwd(),
      pid: process.pid,
      secretValuesExposed: false,
    },
  });

  if (!res.ok) {
    const msg = apiErrorMessage(res.data) ?? `HTTP ${res.status}`;
    console.log("");
    console.log(chalk.yellow(`  agent bus send failed: ${msg}`));
    console.log("");
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(res.data, null, 2));
    return;
  }

  console.log("");
  console.log(chalk.green("  sent ") + DIM(`agent bus message ${res.data.message.messageId}`));
  printMessage(res.data.message);
  console.log("");
}

async function inboxCommand(options: AgentCommandOptions): Promise<void> {
  const limit = Math.max(1, Math.min(100, Number.parseInt(options.limit || "20", 10) || 20));

  if (options.tail) {
    console.log("");
    console.log(DIM("  --- agent bus inbox (live, ctrl-c to stop) ---"));
    console.log("");
    let lastSeen = 0;
    while (true) {
      const res = await listAgentBusMessages({
        channel: options.channel,
        limit: 50,
        since: lastSeen || undefined,
      });
      if (res.ok) {
        const messages = res.data.messages;
        for (const message of messages) printMessage(message);
        if (messages.length > 0) {
          lastSeen = Math.max(lastSeen, ...messages.map((message) => message.createdAt));
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }

  const res = await listAgentBusMessages({ channel: options.channel, limit });
  if (!res.ok) {
    const msg = apiErrorMessage(res.data) ?? `HTTP ${res.status}`;
    console.log("");
    console.log(chalk.yellow(`  agent bus inbox failed: ${msg}`));
    console.log("");
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(res.data, null, 2));
    return;
  }

  console.log("");
  console.log(DIM("  --- agent bus inbox ---"));
  console.log("");
  if (res.data.messages.length === 0) {
    console.log("  " + DIM("no messages yet -- run ") + chalk.cyan('youmd agent send "hello"'));
  } else {
    for (const message of res.data.messages) printMessage(message);
  }
  console.log("");
  console.log("  " + DIM(`local realtime inbox: ${REALTIME_AGENT_INBOX_PATH}`));
  console.log("");
}

function statusCommand(options: AgentCommandOptions): void {
  const status = readRealtimeSyncStatusFile();
  const agentBus = status?.agentBus;

  if (options.json) {
    console.log(JSON.stringify(agentBus ?? null, null, 2));
    return;
  }

  console.log("");
  console.log(DIM("  --- agent bus status ---"));
  console.log("");
  if (!agentBus) {
    console.log("  " + chalk.yellow("realtime daemon has not written agent bus status yet"));
    console.log("  " + DIM("start it with ") + chalk.cyan("youmd sync --live --daemon"));
    console.log("");
    return;
  }

  const state = agentBus.state === "active" ? chalk.green(agentBus.state) : ACCENT(agentBus.state);
  console.log("  " + DIM("state:    ") + state);
  console.log("  " + DIM("summary:  ") + agentBus.summary);
  console.log("  " + DIM("inbox:    ") + agentBus.inboxPath);
  console.log("  " + DIM("send:     ") + chalk.cyan(agentBus.sendCommand));
  if (agentBus.messages.length > 0) {
    console.log("");
    for (const message of agentBus.messages.slice(-5)) printMessage(message);
  }
  console.log("");
}
