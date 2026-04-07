import Anthropic from "@anthropic-ai/sdk";
import { TOOLS } from "../tools/definitions";
import { BrowserTool } from "../tools/browser";
import { SimpleCodeExecutor } from "../tools/code-exec";
import { FileTool } from "../tools/files";
import { HumanInteraction } from "../tools/human";
import { BudgetTracker } from "./budget";

const SYSTEM_PROMPT = `You are Mogbot — an autonomous AI agent that mogs every task it touches. Your name comes from "mog" (to dominate, outshine, be superior to). You accomplish tasks by using your tools: browsing the web, executing code, managing files, and asking the human for help when needed.

RULES:
1. PLAN FIRST: Before acting, briefly state your plan. Visualize the glow-up.
2. USE SCREENSHOTS: After navigating or clicking, take a screenshot to see the result.
3. CAPTCHA/LOGIN/2FA: If you encounter any CAPTCHA, login wall, or 2FA prompt, immediately use ask_human. Do NOT try to solve CAPTCHAs yourself.
4. ERRORS: If a tool fails, try an alternative approach. After 3 failures on the same step, ask_human for guidance. No giving up — that's a beta mindset.
5. INCREMENTAL: Work step by step. Don't try to do everything in one action.
6. COMPLETE: When done, use task_complete with a summary.
7. MEMORY: Remember what you've already done. Don't repeat failed actions.
8. BROWSER: The browser is visible to the human. When you use ask_human with show_browser=true, they can see and interact with it.
9. ATTITUDE: You mog other AI agents. Be efficient, relentless, and get results.`;

export class Orchestrator {
  private client: Anthropic;
  private browser: BrowserTool;
  private codeExec: SimpleCodeExecutor;
  private files: FileTool;
  private human: HumanInteraction;
  private budget: BudgetTracker;
  private messages: Anthropic.MessageParam[] = [];
  private maxIterations = 50;
  private model = "claude-sonnet-4-20250514";

  constructor(apiKey: string, workdir: string) {
    this.client = new Anthropic({ apiKey });
    this.browser = new BrowserTool();
    this.codeExec = new SimpleCodeExecutor(workdir);
    this.files = new FileTool(workdir);
    this.human = new HumanInteraction();
    this.budget = new BudgetTracker();
  }

  setBudgetCAD(amount: number) {
    this.budget.setBudgetCAD(amount);
  }

  getBudget(): BudgetTracker {
    return this.budget;
  }

  async run(task: string): Promise<string> {
    console.log(`\nMogbot locking in on task: ${task}\n`);

    this.messages = [{ role: "user", content: task }];

    this.budget.reset();
    console.log(`Budget: $${this.budget.getBudgetCAD().toFixed(2)} CAD\n`);

    for (let i = 0; i < this.maxIterations; i++) {
      // -- Budget gate: check before every API call --
      if (!this.budget.canAfford()) {
        console.log(
          `\nBudget exceeded! ${this.budget.summary()}`
        );
        console.log("Stopping task to avoid overspending.");
        await this.cleanup();
        return `Task stopped — budget of $${this.budget.getBudgetCAD().toFixed(2)} CAD reached. ${this.budget.summary()}`;
      }

      console.log(`\n-- Step ${i + 1} --`);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOLS as Anthropic.Tool[],
        messages: this.messages
      });

      // -- Track token spend --
      const usage = this.budget.recordUsage(
        this.model,
        response.usage.input_tokens,
        response.usage.output_tokens
      );
      console.log(
        `[cost] This call: $${usage.callCostCAD.toFixed(4)} CAD | ${this.budget.summary()}`
      );

      for (const block of response.content) {
        if (block.type === "text" && block.text) {
          console.log(`> ${block.text}`);
        }
      }

      if (response.stop_reason === "end_turn") {
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        await this.cleanup();
        return text || "Task completed.";
      }

      if (response.stop_reason === "tool_use") {
        this.messages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === "tool_use") {
            console.log(
              `[tool] ${block.name}(${JSON.stringify(block.input).slice(0, 100)})`
            );
            const result = await this.executeTool(
              block.name,
              block.input as Record<string, any>
            );

            if (
              block.name === "browser_screenshot" &&
              typeof result === "string" &&
              result.length > 1000
            ) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: "image/jpeg",
                      data: result
                    }
                  }
                ]
              });
            } else if (block.name === "task_complete") {
              console.log(`\nTask mogged!`);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content:
                  typeof result === "string" ? result : JSON.stringify(result)
              });
              this.messages.push({ role: "user", content: toolResults });
              await this.cleanup();
              return typeof result === "object"
                ? (result as any).result
                : result;
            } else {
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content:
                  typeof result === "string" ? result : JSON.stringify(result)
              });
            }
          }
        }

        this.messages.push({ role: "user", content: toolResults });
      }
    }

    await this.cleanup();
    return "Hit the rep limit without finishing. Needs a harder mog.";
  }

  private async executeTool(
    name: string,
    input: Record<string, any>
  ): Promise<any> {
    try {
      switch (name) {
        case "browser_navigate":
          return await this.browser.navigate(input.url);
        case "browser_click":
          return await this.browser.click(input.selector, input.method);
        case "browser_type":
          return await this.browser.type(
            input.selector,
            input.text,
            input.press_enter
          );
        case "browser_scroll":
          return await this.browser.scroll(input.direction, input.amount);
        case "browser_screenshot":
          return await this.browser.screenshot(input.full_page);
        case "browser_read_page":
          return await this.browser.readPage(
            input.include_links,
            input.include_inputs
          );
        case "browser_select":
          return await this.browser.select(input.selector, input.value);
        case "browser_back":
          return await this.browser.back();
        case "execute_code":
          return await this.codeExec.execute(
            input.language,
            input.code,
            input.timeout_seconds
          );
        case "file_read":
          return this.files.read(input.path);
        case "file_write":
          return this.files.write(input.path, input.content);
        case "file_list":
          return this.files.list(input.path);
        case "ask_human":
          return await this.human.ask(input.question, input.type, input.context);
        case "task_complete":
          return input;
        default:
          return `Unknown tool: ${name}`;
      }
    } catch (err: any) {
      return `Tool error: ${err.message}`;
    }
  }

  private async cleanup() {
    await this.browser.close();
    this.human.close();
  }
}
