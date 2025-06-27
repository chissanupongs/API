import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Queue สำหรับป้องกัน race condition
let writeQueue = Promise.resolve();

// รองรับ __dirname ใน ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * แปลง IP ::1 เป็น 127.0.0.1
 * @param {string} ip 
 * @returns {string}
 */
export const normalizeIP = (ip) => {
  if (!ip) return "unknown";
  return ip === "::1" ? "127.0.0.1" : ip;
};

/**
 * คืนชื่อไฟล์ตามวันที่ปัจจุบัน เช่น history-22-06-2568.json
 * @returns {string}
 */
export const getHistoryFilePath = () => {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear() + 543; // แปลงเป็น พ.ศ.
  const fileName = `history-${dd}-${mm}-${yyyy}.json`;
  return path.join(__dirname, "../data", fileName);
};

/**
 * บันทึก log การกระทำต่างๆ พร้อม context ผู้ใช้งาน
 * @param {string} action 
 * @param {Array} entries 
 * @param {Object} context 
 */

// ✨ helper: ตัด id แล้วคืนแต่ alert_id (+ ฟิลด์อื่น)
const redactId = (entry) => {
  // ถ้ามี alert_id ให้ทิ้ง id (ไม่ให้โชว์)
  if (entry && typeof entry === "object" && "alert_id" in entry) {
    const { id: _omit, ...rest } = entry;
    return rest;          // ✅ เหลือ alert_id, field อื่น ๆ
  }
  return entry;           // กรณีอื่น ไม่เปลี่ยน
};

export const appendHistory = (action, entries, context = {}) => {
  if (!Array.isArray(entries)) {
    console.error("appendHistory: entries is not an array");
    return;
  }

  writeQueue = writeQueue.then(async () => {
    const filePath = getHistoryFilePath();
    let history = [];

    // สร้างโฟลเดอร์ถ้ายังไม่มี
    try {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    } catch (mkdirErr) {
      console.error("❌ Failed to create history folder:", mkdirErr.message);
    }

    // อ่านข้อมูลเดิม
    try {
      const raw = await fs.promises.readFile(filePath, "utf-8");
      try {
        history = raw ? JSON.parse(raw) : [];
      } catch (parseErr) {
        console.error("❌ Error parsing history file:", parseErr.message);
      }
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.error("❌ Error reading history file:", err.message);
      }
    }

    const {
      user_email = "unknown",
      name = "unknown",
      id = "unknown",
      user_agent = "unknown",
      ip_address = "unknown",
    } = context;

    const timestamp = new Date().toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });


    const newEntries = entries.map((entry) => ({
      authentication: { user_email, name },
      user_agent,
      ip_address: normalizeIP(ip_address),
      action,
      case: redactId(entry),
      timestamp,
    }));

    history.push(...newEntries);

    // เขียนใหม่แบบ pretty JSON
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(history, null, 2), "utf-8");
      console.log(`✅ History saved: ${filePath}`);
    } catch (writeErr) {
      console.error("❌ Error writing history file:", writeErr.message);
    }
  }).catch((queueErr) => {
    console.error("❌ appendHistory queue error:", queueErr.message);
  });
};
