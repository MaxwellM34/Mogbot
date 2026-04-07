import type { BudgetInfo } from "../hooks/useWebSocket";

interface BudgetBarProps {
  budgetInfo: BudgetInfo | null;
  totalBudget: number;
}

export default function BudgetBar({ budgetInfo, totalBudget }: BudgetBarProps) {
  if (!budgetInfo && totalBudget <= 0) return null;

  const spent = budgetInfo?.spent_cad ?? 0;
  const budget = budgetInfo?.budget_cad ?? totalBudget;
  const inputTokens = budgetInfo?.input_tokens ?? 0;
  const outputTokens = budgetInfo?.output_tokens ?? 0;

  const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

  let colorClass = "green";
  if (percentage >= 80) {
    colorClass = "red";
  } else if (percentage >= 50) {
    colorClass = "yellow";
  }

  return (
    <div className="budget-bar-container">
      <div className="budget-bar-track">
        <div
          className={`budget-bar-fill ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="budget-bar-labels">
        <span className="budget-amount">
          ${spent.toFixed(4)} / ${budget.toFixed(2)} CAD ({percentage.toFixed(1)}
          %)
        </span>
        <span className="token-count">
          Tokens: {inputTokens.toLocaleString()} in /{" "}
          {outputTokens.toLocaleString()} out
        </span>
      </div>
    </div>
  );
}
