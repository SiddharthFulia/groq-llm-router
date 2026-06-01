import express from "express";
import { groqRouter } from "../src/middleware/express.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.post("/chat", groqRouter({ defaultKind: "balanced" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`groq-router listening on http://localhost:${port}`);
});
