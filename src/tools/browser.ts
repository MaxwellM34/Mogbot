import { chromium, Browser, Page, BrowserContext } from "playwright";

export class BrowserTool {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async init() {
    this.browser = await chromium.launch({
      headless: false,
      args: ["--window-size=1280,900"]
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    });
    this.page = await this.context.newPage();
  }

  async navigate(url: string) {
    if (!this.page) await this.init();
    await this.page!.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });
    await this.page!.waitForTimeout(1000);
    return { url: this.page!.url(), title: await this.page!.title() };
  }

  async click(selector: string, method: "css" | "text" = "css") {
    if (method === "text") {
      await this.page!.getByText(selector, { exact: false }).first().click();
    } else {
      await this.page!.click(selector, { timeout: 5000 });
    }
    await this.page!.waitForTimeout(1000);
    return { clicked: selector };
  }

  async type(selector: string, text: string, pressEnter = false) {
    await this.page!.fill(selector, text);
    if (pressEnter) await this.page!.press(selector, "Enter");
    return { typed: text, into: selector };
  }

  async scroll(direction: "up" | "down", amount = 500) {
    const delta = direction === "down" ? amount : -amount;
    await this.page!.mouse.wheel(0, delta);
    await this.page!.waitForTimeout(500);
    return { scrolled: direction, pixels: amount };
  }

  async screenshot(fullPage = false): Promise<string> {
    const buffer = await this.page!.screenshot({
      fullPage,
      type: "jpeg",
      quality: 75
    });
    return buffer.toString("base64");
  }

  async readPage(includeLinks = true, includeInputs = true) {
    const content = await this.page!.evaluate(
      ({
        includeLinks,
        includeInputs
      }: {
        includeLinks: boolean;
        includeInputs: boolean;
      }) => {
        const text = document.body.innerText.slice(0, 15000);
        const links: string[] = [];
        const inputs: string[] = [];

        if (includeLinks) {
          document.querySelectorAll("a[href]").forEach((a, i) => {
            if (i < 50) {
              const el = a as HTMLAnchorElement;
              links.push(
                `[${el.textContent?.trim().slice(0, 60)}](${el.href})`
              );
            }
          });
        }

        if (includeInputs) {
          document
            .querySelectorAll("input, textarea, select, button")
            .forEach((el, i) => {
              if (i < 30) {
                const tag = el.tagName.toLowerCase();
                const type = el.getAttribute("type") || "";
                const name =
                  el.getAttribute("name") || el.getAttribute("id") || "";
                const placeholder = el.getAttribute("placeholder") || "";
                const label = el.getAttribute("aria-label") || "";
                const selector = el.id
                  ? `#${el.id}`
                  : el.getAttribute("name")
                    ? `${tag}[name="${el.getAttribute("name")}"]`
                    : `${tag}:nth-of-type(${i + 1})`;
                inputs.push(
                  `${tag}[type=${type}] name="${name}" placeholder="${placeholder}" ` +
                    `label="${label}" -> selector: ${selector}`
                );
              }
            });
        }

        return {
          url: window.location.href,
          title: document.title,
          text,
          links,
          inputs
        };
      },
      { includeLinks, includeInputs }
    );
    return content;
  }

  async select(selector: string, value: string) {
    await this.page!.selectOption(selector, value);
    return { selected: value };
  }

  async back() {
    await this.page!.goBack();
    return { navigated: "back" };
  }

  getPage() {
    return this.page;
  }

  async close() {
    await this.browser?.close();
  }
}
