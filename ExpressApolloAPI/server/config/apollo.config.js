const path = require('path');
const dotenv = require('dotenv');

// โหลด .env ที่อยู่ใน server/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT;
const TOKEN = process.env.TOKEN;

if (!GRAPHQL_ENDPOINT || !TOKEN) {
  console.warn('[apollo.config.js] Missing environment variables');
}

module.exports = { GRAPHQL_ENDPOINT, TOKEN };
