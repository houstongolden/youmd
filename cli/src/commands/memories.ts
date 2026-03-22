import chalk from "chalk";
import { isAuthenticated } from "../lib/config";
import { listMemories, saveMemories } from "../lib/api";

const CATEGORIES = ["fact", "insight", "decision", "preference", "context", "goal", "relationship"];

export async function memoriesCommand(subcommand?: string, ...args: string[]) {
  if (!isAuthenticated()) {
    console.log(chalk.red("not authenticated. run `youmd login` first."));
    process.exit(1);
  }

  const cmd = subcommand || "list";

  switch (cmd) {
    case "list":
    case "ls": {
      const categoryArg = args.find((a) => CATEGORIES.includes(a));
      const limitArg = args.find((a) => /^\d+$/.test(a));

      const res = await listMemories({
        category: categoryArg,
        limit: limitArg ? parseInt(limitArg) : 50,
      });

      if (!res.ok) {
        console.log(chalk.red(`failed to fetch memories: ${JSON.stringify(res.data)}`));
        process.exit(1);
      }

      const { memories, count } = res.data;

      if (count === 0) {
        console.log(chalk.gray("no memories yet. chat with the agent to start building context."));
        return;
      }

      console.log(chalk.gray(`${count} memories${categoryArg ? ` (${categoryArg})` : ""}\n`));

      // Group by category
      const grouped = new Map<string, typeof memories>();
      for (const m of memories) {
        if (!grouped.has(m.category)) grouped.set(m.category, []);
        grouped.get(m.category)!.push(m);
      }

      for (const [cat, mems] of grouped) {
        console.log(chalk.hex("#C46A3A")(`  ${cat}s (${mems.length})`));
        for (const m of mems.slice(0, 10)) {
          const date = new Date(m.createdAt).toISOString().split("T")[0];
          const source = m.source !== "you-agent" ? chalk.gray(` via ${m.sourceAgent || m.source}`) : "";
          const tags = m.tags?.length ? chalk.gray(` [${m.tags.join(", ")}]`) : "";
          console.log(`    ${chalk.white(m.content)}${tags}${source} ${chalk.gray(date)}`);
        }
        console.log();
      }
      break;
    }

    case "add": {
      // youmd memories add <category> <content> [--tags tag1,tag2]
      const category = args[0];
      if (!category || !CATEGORIES.includes(category)) {
        console.log(chalk.red(`category must be one of: ${CATEGORIES.join(", ")}`));
        process.exit(1);
      }

      const tagsIdx = args.indexOf("--tags");
      let tags: string[] | undefined;
      let contentArgs: string[];

      if (tagsIdx > 0) {
        tags = args[tagsIdx + 1]?.split(",").map((t) => t.trim());
        contentArgs = args.slice(1, tagsIdx);
      } else {
        contentArgs = args.slice(1);
      }

      const content = contentArgs.join(" ");
      if (!content) {
        console.log(chalk.red("usage: youmd memories add <category> <content> [--tags tag1,tag2]"));
        process.exit(1);
      }

      const res = await saveMemories([{ category, content, tags }], "cli");

      if (!res.ok) {
        console.log(chalk.red(`failed to save memory: ${JSON.stringify(res.data)}`));
        process.exit(1);
      }

      console.log(chalk.hex("#C46A3A")(`saved [${category}] ${content}`));
      break;
    }

    case "stats": {
      const res = await listMemories();
      if (!res.ok) {
        console.log(chalk.red("failed to fetch memories"));
        process.exit(1);
      }

      const { memories, count } = res.data;
      const byCategory = new Map<string, number>();
      for (const m of memories) {
        byCategory.set(m.category, (byCategory.get(m.category) || 0) + 1);
      }

      console.log(chalk.gray(`memory stats: ${count} total\n`));
      for (const cat of CATEGORIES) {
        const c = byCategory.get(cat) || 0;
        if (c > 0) console.log(`  ${chalk.hex("#C46A3A")(cat + "s")}: ${c}`);
      }
      break;
    }

    default:
      console.log(chalk.gray("usage:"));
      console.log("  youmd memories list [category] [limit]");
      console.log("  youmd memories add <category> <content> [--tags tag1,tag2]");
      console.log("  youmd memories stats");
      console.log(chalk.gray(`\ncategories: ${CATEGORIES.join(", ")}`));
      break;
  }
}
