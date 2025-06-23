process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const fs = require("fs");
const path = require("path");
const YAML = require("yamljs");
const swaggerUi = require("swagger-ui-express");

const lookupRoutes = require("./routes/lookup.routes.js");
const caseRoutes = require("./routes/case.routes.js");
const userRoutes = require("./routes/user.routes.js");
const authRoutes = require("./routes/auth.routes.js");

const app = express();
const port = process.env.PORT || 4000;
const host = process.env.HOST || "0.0.0.0";
const displayHost = process.env.DISPLAY_HOST || "localhost";


// 🛡️ ใส่ header กัน browser force https
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "upgrade-insecure-requests");
  next();
});

// 🧾 Logger
app.use(
  morgan("dev", {
    skip: (req, res) => req.url === "/favicon.ico",
  })
);

// 🛡️ Middleware
app.use(cors(
  
));
app.use(helmet({
  crossOriginOpenerPolicy: false,  // ปิด COOP header
  originAgentCluster: false        // ปิด Origin-Agent-Cluster header
}));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(express.json());

// 📄 Swagger Config
const swaggerPath = path.resolve(__dirname, "config", "swagger.yaml");
const swaggerDocument = YAML.parse(fs.readFileSync(swaggerPath, "utf8"));

// 🔁 Inject runtime IP address into Swagger `servers`
swaggerDocument.servers = [
  {
    url: `http://${displayHost}:${port}`,  // ใช้ http:// แทน https://
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
  console.log("===================================");
});
