const express = require('express');
const app = express();
const fs = require('fs'); // เพิ่มบรรทัดนี้
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

const caseroutes = require('./routes/case.routes.js'); // ✅ ใช้ relative path

const port = 4000;

// โหลด Swagger
const swaggerPath = path.resolve(__dirname, 'config', 'swagger.yaml');
const swaggerDocument = YAML.parse(fs.readFileSync(swaggerPath, 'utf8'));


app.use(express.json()); // อย่าลืม Middleware สำหรับอ่าน req.body
app.use('/', caseroutes);

// เสิร์ฟ Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(port, () => {
    console.log(`✅ REST & Swagger at http://localhost:${port}/api-docs`);
});
