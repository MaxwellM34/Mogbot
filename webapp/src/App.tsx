import { useState, useCallback, useRef, useEffect } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import TaskInput from "./components/TaskInput";
import LogStream from "./components/LogStream";
import BudgetBar from "./components/BudgetBar";
import TaskHistory from "./components/TaskHistory";
import BrowserView from "./components/BrowserView";
import "./App.css";

export default function App() {
  const {
    connected,
    logs,
    budgetInfo,
    isRunning,
    humanNeeded,
    browserFrame,
    browserStreaming,
    sendTask,
    sendHumanResponse,
    sendBrowserClick,
    sendBrowserType,
    sendBrowserKey,
  } = useWebSocket();

  const [currentBudget, setCurrentBudget] = useState(0);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const prevIsRunningRef = useRef(isRunning);

  const handleSubmitTask = useCallback(
    (task: string, budgetCad: number, model?: string) => {
      setCurrentBudget(budgetCad);
      sendTask(task, budgetCad, model);
    },
    [sendTask]
  );

  const handleBrowserDone = useCallback(() => {
    sendHumanResponse("done");
  }, [sendHumanResponse]);

  // Refresh history when task completes
  useEffect(() => {
    if (prevIsRunningRef.current && !isRunning) {
      // Task just finished; trigger history refresh
      const timer = setTimeout(() => setHistoryRefresh((n) => n + 1), 500);
      return () => clearTimeout(timer);
    }
    prevIsRunningRef.current = isRunning;
  }, [isRunning]);

  return (
    <div className="app">
      <header className="header">
        <div className="header-title">
          <h1>Mogbot</h1>
          <span className="subtitle">mogging tasks so you don't have to</span>
        </div>
        <div className="connection-status">
          <span
            className={`connection-dot ${connected ? "connected" : ""}`}
          />
          <span>{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </header>

      <div className="main-content">
        <div className="primary-panel">
          <TaskInput
            onSubmit={handleSubmitTask}
            disabled={isRunning}
            connected={connected}
          />
          <BudgetBar budgetInfo={budgetInfo} totalBudget={currentBudget} />
          <LogStream
            logs={logs}
            humanNeeded={humanNeeded}
            onHumanResponse={sendHumanResponse}
            browserStreaming={browserStreaming}
          />
        </div>

        <div
          className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <TaskHistory refreshTrigger={historyRefresh} />
        </aside>
      </div>

      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle task history"
      >
        {sidebarOpen ? "\u2715" : "\u2630"}
      </button>

      <BrowserView
        frame={browserFrame}
        streaming={browserStreaming}
        onClose={handleBrowserDone}
        onBrowserClick={sendBrowserClick}
        onBrowserType={sendBrowserType}
        onBrowserKey={sendBrowserKey}
      />
    </div>
  );
}
