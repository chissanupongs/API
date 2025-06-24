require("dotenv").config();
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import fs from "fs";
import path from "path";
import YAML from "yamljs";
import swaggerUi from "swagger-ui-express";

import lookupRoutes from "./routes/lookup.routes.js";
import caseRoutes from "./routes/case.routes.js";
import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.routes.js";

const app = express();
const port = process.env.PORT || 4000;
const host = process.env.HOST || "0.0.0.0";
const displayHost = process.env.DISPLAY_HOST || "localhost";


// 🧾 Logger
app.use(
  morgan("dev", {
    skip: (req, res) => req.url === "/favicon.ico",
  })
);

// 🛡️ Middleware
app.use(cors());
app.use(express.json());

// 📄 Swagger Config
const swaggerPath = path.resolve(__dirname, "config", "swagger.yaml");
const swaggerDocument = YAML.parse(fs.readFileSync(swaggerPath, "utf8"));

// 🔁 Inject runtime IP address into Swagger `servers`
swaggerDocument.servers = [
  {
    url: `http://${displayHost}:${port}`,
    description: "Swagger UI with HTTP",
  },
];

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get("/swagger.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerDocument);
});

// 🧩 Routes
app.use("/", caseRoutes);
app.use("/accounts", userRoutes);
app.use("/", lookupRoutes);
app.use("/", authRoutes);

// 🌐 Root Route
app.get("/", (req, res) => {
  res.send("🚀 Server is running!");
});

// ❌ 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// ❗ Global Error Handler
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

// 🚀 Start Server
app.listen(port, host, () => {
  console.log("===================================");
  console.log(`✅ API Ready:       http://${displayHost}:${port}`);
  console.log(`📚 Swagger UI:      http://${displayHost}:${port}/api-docs`);
  console.log(`🔍 Client Ready:    http://${displayHost}:3000`);
  console.log("===================================");
});