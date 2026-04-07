import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export class CodeExecutor {
  private workdir: string;

  constructor(workdir: string) {
    this.workdir = workdir;
  }

  async execute(
    language: string,
    code: string,
    timeout = 30
  ): Promise<string> {
    const tmpFile = path.join(os.tmpdir(), `mogbot_${Date.now()}`);
    let cmd: string;

    switch (language) {
      case "python":
        fs.writeFileSync(`${tmpFile}.py`, code);
        cmd =
          `docker run --rm -v ${this.workdir}:/workspace -v ${tmpFile}.py:/tmp/script.py ` +
          `--network host python:3.11-slim python /tmp/script.py`;
        break;
      case "bash":
        fs.writeFileSync(`${tmpFile}.sh`, code);
        cmd =
          `docker run --rm -v ${this.workdir}:/workspace -v ${tmpFile}.sh:/tmp/script.sh ` +
          `--network host ubuntu:22.04 bash /tmp/script.sh`;
        break;
      case "javascript":
        fs.writeFileSync(`${tmpFile}.js`, code);
        cmd =
          `docker run --rm -v ${this.workdir}:/workspace -v ${tmpFile}.js:/tmp/script.js ` +
          `--network host node:20-slim node /tmp/script.js`;
        break;
      default:
        return `Unsupported language: ${language}`;
    }

    try {
      const output = execSync(cmd, {
        timeout: timeout * 1000,
        maxBuffer: 1024 * 1024,
        cwd: this.workdir
      });
      return output.toString().slice(0, 10000);
    } catch (err: any) {
      return `Error: ${err.stderr?.toString() || err.message}`.slice(0, 5000);
    }
  }
}

export class SimpleCodeExecutor {
  private workdir: string;

  constructor(workdir: string) {
    this.workdir = workdir;
  }

  async execute(
    language: string,
    code: string,
    timeout = 30
  ): Promise<string> {
    const cmds: Record<string, string[]> = {
      python: ["python3", "-c", code],
      bash: ["bash", "-c", code],
      javascript: ["node", "-e", code]
    };

    const args = cmds[language];
    if (!args) return `Unsupported: ${language}`;

    try {
      const output = execSync(args.join(" "), {
        timeout: timeout * 1000,
        cwd: this.workdir,
        maxBuffer: 1024 * 1024
      });
      return output.toString().slice(0, 10000);
    } catch (err: any) {
      return `Error: ${err.stderr?.toString() || err.message}`.slice(0, 5000);
    }
  }
}
