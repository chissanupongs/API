const express = require('express');
const app = express();
const cors = require('cors');
const fs = require('fs'); 
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

const caseroutes = require('./routes/case.routes.js');
const userRoutes = require('./routes/user.routes.js');


const port = 4000;


app.use(cors());

// โหลด Swagger
const swaggerPath = path.resolve(__dirname, 'config', 'swagger.yaml');
const swaggerDocument = YAML.parse(fs.readFileSync(swaggerPath, 'utf8'));


app.use(express.json()); 
app.use('/', caseroutes);
app.use('/accounts', userRoutes);

// เสิร์ฟ Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(port, () => {
    console.log(`✅ REST & Swagger at http://localhost:${port}/api-docs`);
});
