import { useState, useEffect, useCallback } from "react";
import { fetchTasks, fetchTaskLogs, type Task, type TaskLog } from "../lib/api";

interface TaskHistoryProps {
  refreshTrigger: number;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

function StatusBadge({ status }: { status: Task["status"] }) {
  return <span className={`task-status-badge ${status}`}>{status}</span>;
}

function TaskLogEntry({ log }: { log: TaskLog }) {
  const time = new Date(log.timestamp);
  const h = String(time.getHours()).padStart(2, "0");
  const m = String(time.getMinutes()).padStart(2, "0");
  const s = String(time.getSeconds()).padStart(2, "0");

  return (
    <div className={`log-entry type-${log.type}`}>
      <span className="timestamp">{`${h}:${m}:${s}`}</span>
      <span className="log-content">{log.data}</span>
    </div>
  );
}

export default function TaskHistory({ refreshTrigger }: TaskHistoryProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchTasks(50);
      setTasks(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load task history"
      );
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks, refreshTrigger]);

  async function handleSelectTask(task: Task) {
    setSelectedTask(task);
    setLoading(true);
    try {
      const logs = await fetchTaskLogs(task.id);
      setTaskLogs(logs);
    } catch {
      setTaskLogs([]);
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setSelectedTask(null);
    setTaskLogs([]);
  }

  // Detail view
  if (selectedTask) {
    return (
      <div className="task-history">
        <div className="task-history-detail-header">
          <button className="task-history-back" onClick={handleBack}>
            &larr; Back
          </button>
          <StatusBadge status={selectedTask.status} />
        </div>
        <div className="task-history-detail">
          <div className="task-detail-prompt">{selectedTask.prompt}</div>
          {loading ? (
            <div className="task-history-empty">Loading logs...</div>
          ) : taskLogs.length === 0 ? (
            <div className="task-history-empty">No logs available</div>
          ) : (
            <div className="task-detail-logs">
              {taskLogs.map((log) => (
                <TaskLogEntry key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="task-history">
      <div className="task-history-header">Task History</div>
      <div className="task-history-list">
        {error ? (
          <div className="task-history-empty">{error}</div>
        ) : tasks.length === 0 ? (
          <div className="task-history-empty">
            No tasks yet. Submit your first task to get started.
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="task-history-item"
              onClick={() => handleSelectTask(task)}
            >
              <div className="task-prompt">{truncate(task.prompt, 60)}</div>
              <div className="task-meta">
                <StatusBadge status={task.status} />
                <span>${task.spent_cad.toFixed(4)}</span>
                <span>{formatTimestamp(task.created_at)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
