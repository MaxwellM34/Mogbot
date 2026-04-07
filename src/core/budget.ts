import * as readline from "readline";

// Pricing per million tokens (USD) — update as Anthropic changes pricing
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-opus-4-20250514": { input: 15.0, output: 75.0 },
};

// Fallback pricing if model not found
const DEFAULT_PRICING = { input: 3.0, output: 15.0 };

export class BudgetTracker {
  private spentUSD = 0;
  private budgetCAD = 0;
  private usdToCad: number;
  private inputTokens = 0;
  private outputTokens = 0;

  constructor(usdToCadRate = 1.36) {
    this.usdToCad = usdToCadRate;
  }

  setBudgetCAD(amount: number) {
    this.budgetCAD = amount;
  }

  getBudgetCAD(): number {
    return this.budgetCAD;
  }

  getSpentCAD(): number {
    return this.spentUSD * this.usdToCad;
  }

  getRemainingCAD(): number {
    return this.budgetCAD - this.getSpentCAD();
  }

  getTotalInputTokens(): number {
    return this.inputTokens;
  }

  getTotalOutputTokens(): number {
    return this.outputTokens;
  }

  /**
   * Record token usage from an API response and return the cost for this call.
   */
  recordUsage(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): { callCostUSD: number; callCostCAD: number } {
    const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;
    const callCostUSD =
      (inputTokens * pricing.input) / 1_000_000 +
      (outputTokens * pricing.output) / 1_000_000;

    this.spentUSD += callCostUSD;
    this.inputTokens += inputTokens;
    this.outputTokens += outputTokens;

    return {
      callCostUSD,
      callCostCAD: callCostUSD * this.usdToCad
    };
  }

  /**
   * Check if the next call would exceed the budget.
   * Returns true if we're still within budget.
   */
  canAfford(): boolean {
    return this.getSpentCAD() < this.budgetCAD;
  }

  /**
   * Get a summary string of current spending.
   */
  summary(): string {
    const spent = this.getSpentCAD().toFixed(4);
    const budget = this.budgetCAD.toFixed(2);
    const remaining = this.getRemainingCAD().toFixed(4);
    return (
      `Budget: $${budget} CAD | Spent: $${spent} CAD | Remaining: $${remaining} CAD | ` +
      `Tokens: ${this.inputTokens} in / ${this.outputTokens} out`
    );
  }

  reset() {
    this.spentUSD = 0;
    this.inputTokens = 0;
    this.outputTokens = 0;
  }

  /**
   * Prompt the user for a budget limit in CAD via readline.
   */
  static async promptBudget(
    rl: readline.Interface
  ): Promise<number> {
    return new Promise((resolve) => {
      const ask = () => {
        rl.question(
          "\nMax budget for this task (CAD $)? ",
          (answer) => {
            const parsed = parseFloat(answer.trim().replace(/^\$/, ""));
            if (isNaN(parsed) || parsed <= 0) {
              console.log("Enter a positive number (e.g. 0.50, 2, 10).");
              ask();
            } else {
              resolve(parsed);
            }
          }
        );
      };
      ask();
    });
  }
}
