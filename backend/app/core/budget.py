"""Budget tracking for Mogbot API calls."""

# Pricing per million tokens (USD) - update as Anthropic changes pricing
MODEL_PRICING: dict[str, dict[str, float]] = {
    "claude-sonnet-4-20250514": {"input": 3.0, "output": 15.0},
    "claude-opus-4-20250514": {"input": 15.0, "output": 75.0},
}

DEFAULT_PRICING: dict[str, float] = {"input": 3.0, "output": 15.0}


class BudgetTracker:
    """Tracks API spending against a CAD budget limit."""

    def __init__(self, usd_to_cad: float = 1.36) -> None:
        self.spent_usd: float = 0.0
        self.budget_cad: float = 0.0
        self.usd_to_cad: float = usd_to_cad
        self.input_tokens: int = 0
        self.output_tokens: int = 0

    def set_budget_cad(self, amount: float) -> None:
        """Set the maximum budget in CAD."""
        self.budget_cad = amount

    def get_spent_cad(self) -> float:
        """Return total spent converted to CAD."""
        return self.spent_usd * self.usd_to_cad

    def get_remaining_cad(self) -> float:
        """Return remaining budget in CAD."""
        return self.budget_cad - self.get_spent_cad()

    def record_usage(
        self, model: str, input_tokens: int, output_tokens: int
    ) -> dict[str, float]:
        """Record token usage and return the cost for this call.

        Returns:
            Dict with call_cost_usd and call_cost_cad.
        """
        pricing = MODEL_PRICING.get(model, DEFAULT_PRICING)
        call_cost_usd = (
            (input_tokens * pricing["input"]) / 1_000_000
            + (output_tokens * pricing["output"]) / 1_000_000
        )

        self.spent_usd += call_cost_usd
        self.input_tokens += input_tokens
        self.output_tokens += output_tokens

        return {
            "call_cost_usd": call_cost_usd,
            "call_cost_cad": call_cost_usd * self.usd_to_cad,
        }

    def can_afford(self) -> bool:
        """Check if we're still within budget."""
        return self.get_spent_cad() < self.budget_cad

    def summary(self) -> str:
        """Human-readable budget summary."""
        spent = f"{self.get_spent_cad():.4f}"
        budget = f"{self.budget_cad:.2f}"
        remaining = f"{self.get_remaining_cad():.4f}"
        return (
            f"Budget: ${budget} CAD | Spent: ${spent} CAD | "
            f"Remaining: ${remaining} CAD | "
            f"Tokens: {self.input_tokens} in / {self.output_tokens} out"
        )

    def reset(self) -> None:
        """Reset spending counters (not the budget limit)."""
        self.spent_usd = 0.0
        self.input_tokens = 0
        self.output_tokens = 0
