import * as fs from "fs";
import * as path from "path";

export class FileTool {
  private workdir: string;

  constructor(workdir: string) {
    this.workdir = workdir;
  }

  private resolve(filePath: string) {
    const resolved = path.resolve(this.workdir, filePath);
    if (!resolved.startsWith(this.workdir)) {
      throw new Error("Path traversal not allowed");
    }
    return resolved;
  }

  read(filePath: string): string {
    return fs.readFileSync(this.resolve(filePath), "utf-8").slice(0, 50000);
  }

  write(filePath: string, content: string): string {
    const resolved = this.resolve(filePath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content);
    return `Written ${content.length} bytes to ${filePath}`;
  }

  list(dirPath = "."): string[] {
    const resolved = this.resolve(dirPath);
    return fs.readdirSync(resolved, { withFileTypes: true }).map((d) => {
      const icon = d.isDirectory() ? "[dir]" : "[file]";
      return `${icon} ${d.name}`;
    });
  }
}
