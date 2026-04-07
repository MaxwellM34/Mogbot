export interface MemoryEntry {
  timestamp: number;
  type: "action" | "result" | "error" | "observation";
  content: string;
}

export class Memory {
  private entries: MemoryEntry[] = [];
  private maxEntries = 200;

  add(type: MemoryEntry["type"], content: string) {
    this.entries.push({ timestamp: Date.now(), type, content });
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  getRecent(count = 20): MemoryEntry[] {
    return this.entries.slice(-count);
  }

  search(query: string): MemoryEntry[] {
    const lower = query.toLowerCase();
    return this.entries.filter((e) =>
      e.content.toLowerCase().includes(lower)
    );
  }

  summarize(): string {
    const recent = this.getRecent(10);
    return recent.map((e) => `[${e.type}] ${e.content}`).join("\n");
  }

  clear() {
    this.entries = [];
  }
}
