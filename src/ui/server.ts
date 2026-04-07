import express from "express";
import { WebSocketServer } from "ws";
import { Orchestrator } from "../core/orchestrator";
import path from "path";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.static("public"));
app.use(express.json());

const server = app.listen(PORT, () => {
  console.log(`Mogbot UI: http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });
const workdir = path.resolve("./workspace");

wss.on("connection", (ws) => {
  ws.on("message", async (data) => {
    const { task, budgetCAD } = JSON.parse(data.toString());

    if (!budgetCAD || budgetCAD <= 0) {
      ws.send(
        JSON.stringify({
          type: "error",
          data: "Set a budget (CAD $) before running a task."
        })
      );
      return;
    }

    const mogbot = new Orchestrator(process.env.ANTHROPIC_API_KEY!, workdir);
    mogbot.setBudgetCAD(budgetCAD);

    const origLog = console.log;
    console.log = (...args: any[]) => {
      origLog(...args);
      ws.send(JSON.stringify({ type: "log", data: args.join(" ") }));
    };

    try {
      const result = await mogbot.run(task);
      ws.send(JSON.stringify({ type: "result", data: result }));
      ws.send(
        JSON.stringify({
          type: "budget",
          data: mogbot.getBudget().summary()
        })
      );
    } catch (err: any) {
      ws.send(JSON.stringify({ type: "error", data: err.message }));
    }

    console.log = origLog;
  });
});
