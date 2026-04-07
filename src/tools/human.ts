import * as readline from "readline";

export class HumanInteraction {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async ask(
    question: string,
    type: string,
    context?: string
  ): Promise<string> {
    console.log("\n" + "=".repeat(60));
    console.log("MOGBOT NEEDS A SPOTTER");
    console.log("=".repeat(60));
    console.log(`Type: ${type.toUpperCase()}`);
    if (context) console.log(`Context: ${context}`);
    console.log(`\n${question}`);

    if (type === "captcha") {
      console.log(
        "\n-> The browser window is visible. Please solve the CAPTCHA."
      );
      console.log("-> Type 'done' when you've completed it.");
    } else if (type === "login") {
      console.log("\n-> The browser window is visible. Please log in.");
      console.log("-> Type 'done' when you've logged in.");
    } else if (type === "2fa") {
      console.log(
        "\n-> Enter the 2FA code, or complete it in the browser and type 'done'."
      );
    }

    console.log("=".repeat(60));

    return new Promise((resolve) => {
      this.rl.question("\nYour response: ", (answer) => {
        resolve(answer.trim());
      });
    });
  }

  close() {
    this.rl.close();
  }
}
