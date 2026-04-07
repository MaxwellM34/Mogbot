import { Orchestrator } from "./core/orchestrator";
import * as path from "path";
import * as readline from "readline";

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error("Set ANTHROPIC_API_KEY environment variable");
  process.exit(1);
}

const workdir = path.resolve("./workspace");
const mogbot = new Orchestrator(API_KEY, workdir);

async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    const result = await mogbot.run(args.join(" "));
    console.log("\nResult:", result);
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log(
      "Mogbot locked in. Drop a task or type 'quit' to ascend out.\n"
    );

    const askTask = () => {
      rl.question("Task> ", async (task) => {
        if (task.toLowerCase() === "quit") {
          rl.close();
          process.exit(0);
        }
        try {
          const result = await mogbot.run(task);
          console.log("\nResult:", result);
        } catch (err: any) {
          console.error("Error:", err.message);
        }
        askTask();
      });
    };
    askTask();
  }
}

main();
