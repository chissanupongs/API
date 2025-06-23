const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

// Queue สำหรับป้องกัน race condition
let writeQueue = Promise.resolve();

/**
 * แปลง IP ::1 เป็น 127.0.0.1
 * @param {string} ip 
 * @returns {string}
 */
const normalizeIP = (ip) => {
  if (!ip) return "unknown";
  return ip === "::1" ? "127.0.0.1" : ip;
};

/**
 * คืนชื่อไฟล์ตามวันที่ปัจจุบัน เช่น history-22-06-2568.json
 * @returns {string}
 */
const getHistoryFilePath = () => {
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
const appendHistory = (action, entries, context = {}) => {
  if (!Array.isArray(entries)) {
    console.error("appendHistory: entries is not an array");
    return;
  }

  writeQueue = writeQueue.then(async () => {
    const filePath = getHistoryFilePath();
    let history = [];

    // สร้างโฟลเดอร์ถ้ายังไม่มี
    try {
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
    } catch (mkdirErr) {
      console.error("❌ Failed to create history folder:", mkdirErr.message);
    }

    // อ่านข้อมูลเดิม
    try {
      const raw = await fsp.readFile(filePath, "utf-8");
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

    const timestamp = new Date().toISOString();

    const newEntries = entries.map((entry) => ({
      authentication: { user_email, name, id },
      user_agent,
      ip_address: normalizeIP(ip_address),
      action,
      case: entry,
      timestamp,
    }));

    history.push(...newEntries);

    // เขียนใหม่แบบ pretty JSON
    try {
      await fsp.writeFile(filePath, JSON.stringify(history, null, 2), "utf-8");
      console.log(`✅ History saved: ${filePath}`);
    } catch (writeErr) {
      console.error("❌ Error writing history file:", writeErr.message);
    }
  }).catch((queueErr) => {
    console.error("❌ appendHistory queue error:", queueErr.message);
  });
};

module.exports = {
  appendHistory,
  normalizeIP,
  getHistoryFilePath,
};
