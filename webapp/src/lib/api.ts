const API_BASE = "/api";

export interface Task {
  id: string;
  prompt: string;
  status: "pending" | "running" | "completed" | "failed" | "budget_exceeded";
  model: string;
  budget_cad: number;
  spent_cad: number;
  input_tokens: number;
  output_tokens: number;
  result: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface TaskLog {
  id: string;
  task_id: string;
  type: string;
  data: string;
  timestamp: string;
}

export async function fetchTasks(limit?: number): Promise<Task[]> {
  const params = new URLSearchParams();
  if (limit !== undefined) {
    params.set("limit", String(limit));
  }
  const query = params.toString();
  const url = `${API_BASE}/tasks${query ? `?${query}` : ""}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch tasks: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchTask(id: string): Promise<Task> {
  const response = await fetch(`${API_BASE}/tasks/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch task: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchTaskLogs(id: string): Promise<TaskLog[]> {
  const response = await fetch(`${API_BASE}/tasks/${id}/logs`);
  if (!response.ok) {
    throw new Error(`Failed to fetch task logs: ${response.statusText}`);
  }
  return response.json();
}
