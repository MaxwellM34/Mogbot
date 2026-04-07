import { Orchestrator } from "./core/orchestrator";
import { BudgetTracker } from "./core/budget";
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

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  if (args.length > 0) {
    // Single task mode — still ask for budget
    const budget = await BudgetTracker.promptBudget(rl);
    mogbot.setBudgetCAD(budget);
    const result = await mogbot.run(args.join(" "));
    console.log("\nResult:", result);
    console.log(`\nFinal spend: ${mogbot.getBudget().summary()}`);
    rl.close();
  } else {
    // Interactive mode
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
          const budget = await BudgetTracker.promptBudget(rl);
          mogbot.setBudgetCAD(budget);
          const result = await mogbot.run(task);
          console.log("\nResult:", result);
          console.log(`\nFinal spend: ${mogbot.getBudget().summary()}`);
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
