import Anthropic from "@anthropic-ai/sdk";

const PLANNING_PROMPT = `You are a task planner for Mogbot. Given a high-level task, break it down into concrete steps that the agent can execute using its tools (browser, code execution, file operations, human interaction).

Output a JSON array of steps, each with:
- "step": step number
- "action": what to do
- "tool": which tool to use
- "details": specifics for the tool
- "fallback": what to do if this step fails

Be specific and actionable. Think about edge cases.`;

export interface PlanStep {
  step: number;
  action: string;
  tool: string;
  details: string;
  fallback: string;
}

export class Planner {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async plan(task: string): Promise<PlanStep[]> {
    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: PLANNING_PROMPT,
      messages: [{ role: "user", content: task }]
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    try {
      return JSON.parse(jsonMatch[0]) as PlanStep[];
    } catch {
      return [];
    }
  }
}
