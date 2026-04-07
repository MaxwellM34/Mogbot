import { useEffect, useRef, useState, type FormEvent } from "react";
import type { LogEntry, HumanRequest } from "../hooks/useWebSocket";

interface LogStreamProps {
  logs: LogEntry[];
  humanNeeded: HumanRequest | null;
  onHumanResponse: (response: string) => void;
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function LogEntryRow({ entry }: { entry: LogEntry }) {
  return (
    <div className={`log-entry type-${entry.type}`}>
      <span className="timestamp">{formatTime(entry.timestamp)}</span>
      <span className="log-content">
        {entry.type === "tool_call" && entry.toolName ? (
          <>
            <span className="tool-name">{entry.toolName}</span> {entry.data}
          </>
        ) : (
          entry.data
        )}
      </span>
    </div>
  );
}

function HumanNeededEntry({
  entry,
  humanNeeded,
  onHumanResponse,
}: {
  entry: LogEntry;
  humanNeeded: HumanRequest | null;
  onHumanResponse: (response: string) => void;
}) {
  const [response, setResponse] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (humanNeeded) {
      inputRef.current?.focus();
    }
  }, [humanNeeded]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!response.trim()) return;
    onHumanResponse(response.trim());
    setResponse("");
  }

  return (
    <div className={`log-entry type-${entry.type}`}>
      <div>
        <span className="timestamp">{formatTime(entry.timestamp)}</span>{" "}
        <span className="log-content">{entry.data}</span>
      </div>
      {humanNeeded && (
        <form className="human-response-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type your response..."
            value={response}
            onChange={(e) => setResponse(e.target.value)}
          />
          <button type="submit" disabled={!response.trim()}>
            Send
          </button>
        </form>
      )}
    </div>
  );
}

export default function LogStream({
  logs,
  humanNeeded,
  onHumanResponse,
}: LogStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleScroll() {
      if (!container) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Consider "at bottom" if within 60px of the bottom
      shouldAutoScrollRef.current =
        scrollHeight - scrollTop - clientHeight < 60;
    }

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (shouldAutoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div className="log-stream-container" ref={containerRef}>
        <div className="log-stream-empty">
          Waiting for a task... drop one above and hit Mog It.
        </div>
      </div>
    );
  }

  return (
    <div className="log-stream-container" ref={containerRef}>
      {logs.map((entry, index) => {
        // Show human response input only on the last human_needed entry
        const isLastHumanNeeded =
          entry.type === "human_needed" &&
          !logs.slice(index + 1).some((e) => e.type === "human_needed");

        if (entry.type === "human_needed") {
          return (
            <HumanNeededEntry
              key={entry.id}
              entry={entry}
              humanNeeded={isLastHumanNeeded ? humanNeeded : null}
              onHumanResponse={onHumanResponse}
            />
          );
        }
        return <LogEntryRow key={entry.id} entry={entry} />;
      })}
    </div>
  );
}
