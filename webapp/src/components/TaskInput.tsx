import { useState, type FormEvent, type KeyboardEvent } from "react";

interface TaskInputProps {
  onSubmit: (task: string, budgetCad: number, model?: string) => void;
  disabled: boolean;
  connected: boolean;
}

const MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Sonnet 4" },
  { value: "claude-opus-4-20250514", label: "Opus 4" },
];

export default function TaskInput({
  onSubmit,
  disabled,
  connected,
}: TaskInputProps) {
  const [task, setTask] = useState("");
  const [budgetCad, setBudgetCad] = useState(1.0);
  const [model, setModel] = useState(MODELS[0].value);

  const canSubmit = connected && !disabled && task.trim().length > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(task.trim(), budgetCad, model);
    setTask("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) {
        onSubmit(task.trim(), budgetCad, model);
        setTask("");
      }
    }
  }

  return (
    <div className="task-input-container">
      <form className="task-input-form" onSubmit={handleSubmit}>
        <div className="task-input-field">
          <label htmlFor="task-input">Task</label>
          <input
            id="task-input"
            type="text"
            placeholder="Drop a task to mog..."
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || !connected}
            autoFocus
          />
        </div>
        <div className="budget-input-group">
          <div className="budget-field">
            <label htmlFor="budget-input">Budget (CAD)</label>
            <input
              id="budget-input"
              type="number"
              step="0.10"
              min="0.01"
              value={budgetCad}
              onChange={(e) => setBudgetCad(parseFloat(e.target.value) || 0.01)}
              disabled={disabled || !connected}
            />
          </div>
          <div className="model-field">
            <label htmlFor="model-select">Model</label>
            <select
              id="model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={disabled || !connected}
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="mog-button" disabled={!canSubmit}>
            Mog It
          </button>
        </div>
      </form>
    </div>
  );
}
