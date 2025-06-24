import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// รองรับ __dirname ใน ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// โหลด .env ที่อยู่ใน server/.env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT;
export const TOKEN = process.env.TOKEN;

if (!GRAPHQL_ENDPOINT || !TOKEN) {
  console.warn("[apollo.config.js] Missing environment variables");
}
