import { useState, useRef, useCallback, useEffect } from "react";

export interface LogEntry {
  id: string;
  type:
    | "log"
    | "tool_call"
    | "tool_result"
    | "budget"
    | "result"
    | "error"
    | "human_needed"
    | "assistant_text"
    | "task_created";
  data: string;
  toolName?: string;
  timestamp: Date;
}

export interface BudgetInfo {
  spent_cad: number;
  budget_cad: number;
  input_tokens: number;
  output_tokens: number;
}

export interface HumanRequest {
  prompt: string;
  task_id: string;
  ask_type?: string;
}

export interface UseWebSocketReturn {
  connected: boolean;
  logs: LogEntry[];
  budgetInfo: BudgetInfo | null;
  taskResult: string | null;
  isRunning: boolean;
  humanNeeded: HumanRequest | null;
  currentTaskId: string | null;
  browserFrame: string | null;
  browserStreaming: boolean;
  sendTask: (task: string, budgetCad: number, model?: string) => void;
  sendHumanResponse: (response: string) => void;
  sendBrowserClick: (x: number, y: number) => void;
  sendBrowserType: (text: string) => void;
  sendBrowserKey: (key: string) => void;
  clearLogs: () => void;
}

let logIdCounter = 0;

function createLogEntry(
  type: LogEntry["type"],
  data: string,
  toolName?: string
): LogEntry {
  return {
    id: String(++logIdCounter),
    type,
    data,
    toolName,
    timestamp: new Date(),
  };
}

export function useWebSocket(): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [budgetInfo, setBudgetInfo] = useState<BudgetInfo | null>(null);
  const [taskResult, setTaskResult] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [humanNeeded, setHumanNeeded] = useState<HumanRequest | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [browserFrame, setBrowserFrame] = useState<string | null>(null);
  const [browserStreaming, setBrowserStreaming] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 20;
  const baseReconnectDelay = 1000;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/run`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      reconnectAttemptsRef.current = 0;
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;

      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(
          baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
          30000
        );
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror, so reconnect is handled there
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    wsRef.current = ws;
  }, []);

  const handleMessage = useCallback(
    (msg: { type: string; data?: unknown; [key: string]: unknown }) => {
      const data =
        typeof msg.data === "string" ? msg.data : JSON.stringify(msg.data);

      switch (msg.type) {
        case "log":
          setLogs((prev) => [...prev, createLogEntry("log", data)]);
          break;

        case "tool_call": {
          const tcData = typeof msg.data === "object" && msg.data ? (msg.data as Record<string, unknown>) : {};
          const toolName = typeof tcData.name === "string" ? tcData.name : undefined;
          setLogs((prev) => [
            ...prev,
            createLogEntry("tool_call", data, toolName),
          ]);
          break;
        }

        case "tool_result":
          setLogs((prev) => [...prev, createLogEntry("tool_result", data)]);
          break;

        case "budget":
          if (msg.data && typeof msg.data === "object") {
            const bd = msg.data as Record<string, unknown>;
            setBudgetInfo({
              spent_cad: Number(bd.spent ?? bd.spent_cad ?? 0),
              budget_cad: Number(bd.total ?? bd.budget_cad ?? 0),
              input_tokens: Number(bd.input_tokens ?? 0),
              output_tokens: Number(bd.output_tokens ?? 0),
            });
          }
          setLogs((prev) => [...prev, createLogEntry("budget", data)]);
          break;

        case "result":
          setTaskResult(data);
          setIsRunning(false);
          setLogs((prev) => [...prev, createLogEntry("result", data)]);
          break;

        case "error":
          setIsRunning(false);
          setLogs((prev) => [...prev, createLogEntry("error", data)]);
          break;

        case "human_needed":
        case "human_input_needed": {
          const hData = typeof msg.data === "object" && msg.data ? (msg.data as Record<string, unknown>) : {};
          const prompt = typeof hData.question === "string" ? hData.question : String(data);
          const askType = typeof hData.type === "string" ? hData.type : "other";
          const taskId = currentTaskId ?? "";
          setHumanNeeded({ prompt, task_id: taskId, ask_type: askType });
          setLogs((prev) => [...prev, createLogEntry("human_needed", prompt)]);

          // Start browser streaming for visual interaction types
          if (["captcha", "login", "2fa"].includes(askType)) {
            setBrowserStreaming(true);
          }
          break;
        }

        case "browser_frame": {
          const frameData = typeof msg.data === "object" && msg.data ? (msg.data as Record<string, unknown>) : {};
          const image = typeof frameData.image === "string" ? frameData.image : null;
          if (image) {
            setBrowserFrame(image);
          }
          break;
        }

        case "browser_stream_stop":
          setBrowserStreaming(false);
          setBrowserFrame(null);
          break;

        case "assistant_text":
          setLogs((prev) => [...prev, createLogEntry("log", data)]);
          break;

        case "task_created": {
          const taskId =
            typeof msg.task_id === "string" ? msg.task_id : (typeof msg.data === "string" ? msg.data : undefined);
          if (taskId) setCurrentTaskId(taskId);
          setLogs((prev) => [
            ...prev,
            createLogEntry(
              "log",
              `Task created${taskId ? `: ${taskId}` : ""}`
            ),
          ]);
          break;
        }

        default:
          setLogs((prev) => [...prev, createLogEntry("log", data)]);
      }
    },
    [currentTaskId]
  );

  const sendTask = useCallback(
    (task: string, budgetCad: number, model?: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      setTaskResult(null);
      setBudgetInfo(null);
      setHumanNeeded(null);
      setIsRunning(true);
      setLogs([]);
      setBrowserFrame(null);
      setBrowserStreaming(false);

      const payload: Record<string, unknown> = {
        type: "start",
        task,
        budget_cad: budgetCad,
      };
      if (model) payload.model = model;

      wsRef.current.send(JSON.stringify(payload));
    },
    []
  );

  const sendHumanResponse = useCallback(
    (response: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      wsRef.current.send(
        JSON.stringify({
          type: "human_response",
          content: response,
        })
      );

      setHumanNeeded(null);
      setBrowserStreaming(false);
      setBrowserFrame(null);
      setLogs((prev) => [
        ...prev,
        createLogEntry("log", `Human response: ${response}`),
      ]);
    },
    []
  );

  const sendBrowserClick = useCallback(
    (x: number, y: number) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      wsRef.current.send(
        JSON.stringify({
          type: "browser_click",
          x,
          y,
        })
      );
    },
    []
  );

  const sendBrowserType = useCallback(
    (text: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      wsRef.current.send(
        JSON.stringify({
          type: "browser_type",
          text,
        })
      );
    },
    []
  );

  const sendBrowserKey = useCallback(
    (key: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      wsRef.current.send(
        JSON.stringify({
          type: "browser_key",
          key,
        })
      );
    },
    []
  );

  const clearLogs = useCallback(() => {
    setLogs([]);
    setTaskResult(null);
    setBudgetInfo(null);
    setHumanNeeded(null);
    setCurrentTaskId(null);
    setBrowserFrame(null);
    setBrowserStreaming(false);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    connected,
    logs,
    budgetInfo,
    taskResult,
    isRunning,
    humanNeeded,
    currentTaskId,
    browserFrame,
    browserStreaming,
    sendTask,
    sendHumanResponse,
    sendBrowserClick,
    sendBrowserType,
    sendBrowserKey,
    clearLogs,
  };
}
