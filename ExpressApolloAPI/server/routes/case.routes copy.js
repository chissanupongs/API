// -----------------------------------------------------------------------------
// 📁 case.routes.js - Full version with comments
// -----------------------------------------------------------------------------

import express from "express";
import path from "path";
import fs from "fs";
import { request } from "graphql-request";
import { GRAPHQL_ENDPOINT, TOKEN } from "../config/apollo.config.js";
import { GET_INCIDENT_BY_ID } from "../graphql/queries.js";
import {
  INCIDENT_EDIT_MUTATION,
  NOTE_ADD_MUTATION,
} from "../graphql/mutation.js";
import { appendHistory } from "../utils/history.js";
import { requireUserEmail } from "../middleware/authMiddleware.js";
import { fileURLToPath } from "url";

const router = express.Router();

const VALID_RESULTS = ["WaitingAnalysis", "TruePositives", "FalsePositives"];

// รองรับ __dirname ใน ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const headers = { Authorization: `Bearer ${TOKEN}` };
const fsPromises = fs.promises;

// -----------------------------------------------------------------------------
// 🔧 Build GraphQL query dynamically to match incident by alert_id
// -----------------------------------------------------------------------------
const buildGetIncidentsQuery = (alertId) => `
  query {
    incidents(
      orderBy: created_at
      orderMode: desc
      first: 10
      filters: {
        mode: and
        filterGroups: []
        filters: {
          key: "alert_id"
          values: "${alertId}"
        }
      }
    ) {
      edges {
        node {
          id
          alert_id
          alert_name
          alert_status
          case_result
        }
      }
      pageInfo {
        globalCount
      }
    }
  }
`;

// -----------------------------------------------------------------------------
// 🔍 Find incident by alert_id (return internal id and node)
// -----------------------------------------------------------------------------
async function findIncidentByAlertId(alertId) {
  const data = await request({
    url: GRAPHQL_ENDPOINT,
    document: buildGetIncidentsQuery(alertId),
    requestHeaders: headers,
  });

  const count = data.incidents.pageInfo.globalCount;
  if (count === 0) throw new Error("Notfound");
  if (count > 1) throw new Error("Please contact the admin");

  const node = data.incidents.edges[0].node;
  return { id: node.id, node };
}

// -----------------------------------------------------------------------------
// ✅ PUT /closedAlertStatus - Change alert_status to Closed by alert_id
// -----------------------------------------------------------------------------
router.put("/closedAlertStatus", requireUserEmail, async (req, res) => {
  let incidents = req.body.incidents;

  // รองรับ single object ด้วย
  if (!Array.isArray(incidents)) {
    const { alert_id, alert_status } = req.body;
    if (alert_id && alert_status) {
      incidents = [{ alert_id, alert_status }];
    } else {
      return res.status(400).json({ error: "Missing 'alert_id' or 'alert_status'" });
    }
  }

  const results = [];

  for (const { alert_id, alert_status } of incidents) {
    // ตรวจสอบ input เบื้องต้น
    if (!alert_id || alert_status !== "Closed") {
      results.push({ alert_id, error: "Invalid alert_id or alert_status" });
      continue;
    }

    try {
      // หา internal incident id จาก alert_id
      const { id } = await findIncidentByAlertId(alert_id);

      // ดึงข้อมูล incident เก่าเพื่อเก็บ log
      const oldData = await request({
        url: GRAPHQL_ENDPOINT,
        document: GET_INCIDENT_BY_ID,
        variables: { id },
        requestHeaders: headers,
      });
      const oldStatus = oldData.incident?.alert_status || "unknown";
      const name = oldData.incident?.alert_name || "unknown";

      // เตรียมตัวแปรสำหรับอัปเดต alert_status
      const updateVars = {
        id,
        input: [{ key: "alert_status", value: ["Closed"], operation: "replace" }],
      };

      // ทำการอัปเดตผ่าน mutation
      const updateResponse = await request({
        url: GRAPHQL_ENDPOINT,
        document: INCIDENT_EDIT_MUTATION,
        variables: updateVars,
        requestHeaders: headers,
      });

      // บันทึกประวัติการอัปเดตสถานะ
      appendHistory(
        "updateAlertStatus",
        [{ id, name, status_before: oldStatus, status_after: updateResponse.incidentEdit.fieldPatch.alert_status }],
        req.user
      );

      // เตรียมตัวแปรสำหรับเพิ่มโน้ต
      const noteVars = {
        input: {
          action: "Closed",
          content: "Incident was Closed",
          objects: id,
        },
      };

      // เพิ่มโน้ตเหตุการณ์
      const noteResponse = await request({
        url: GRAPHQL_ENDPOINT,
        document: NOTE_ADD_MUTATION,
        variables: noteVars,
        requestHeaders: headers,
      });

      // บันทึกประวัติการเพิ่มโน้ต
      appendHistory("addNote", [{ ...noteResponse.noteAdd }], req.user);

      // ส่งผลลัพธ์กลับ
      results.push({
        alert_id,
        updated: true,
        alert_status: updateResponse.incidentEdit.fieldPatch.alert_status,
        note: noteResponse.noteAdd,
      });
    } catch (err) {
      console.error(`❌ ${alert_id} – ${err.message}`, err);
      results.push({ alert_id, error: err.message });
    }
  }

  res.json({ results });
});

// -----------------------------------------------------------------------------
// ✅ PUT /updateCaseResult - Update case_result & add note by alert_id
// -----------------------------------------------------------------------------
router.put("/updateCaseResult", requireUserEmail, async (req, res) => {
  let incidents = req.body.incidents;

  // รองรับ single object ด้วย
  if (!Array.isArray(incidents)) {
    const { alert_id, case_result, reason } = req.body;
    if (alert_id && case_result && reason) {
      incidents = [{ alert_id, case_result, reason }];
    } else {
      return res.status(400).json({ error: "Missing 'alert_id', 'case_result' or 'reason'" });
    }
  }

  const results = [];

  for (const { alert_id, case_result, reason } of incidents) {
    // ตรวจสอบ input เบื้องต้น
    if (!alert_id) {
      results.push({ alert_id, error: "Invalid or missing 'alert_id'" });
      continue;
    }
    if (!VALID_RESULTS.includes(case_result)) {
      results.push({ alert_id, error: "Invalid 'case_result'" });
      continue;
    }
    if (!reason || typeof reason !== "string" || reason.trim() === "") {
      results.push({ alert_id, error: "Missing or invalid 'reason'" });
      continue;
    }

    try {
      // หา internal incident id จาก alert_id
      const { id } = await findIncidentByAlertId(alert_id);

      // ดึงข้อมูล incident เก่าเพื่อเก็บ log
      const oldData = await request({
        url: GRAPHQL_ENDPOINT,
        document: GET_INCIDENT_BY_ID,
        variables: { id },
        requestHeaders: headers,
      });
      const oldResult = oldData.incident?.case_result || "unknown";
      const name = oldData.incident?.alert_name || "unknown";

      // เตรียมตัวแปรสำหรับอัปเดต case_result
      const updateVars = {
        id,
        input: [{ key: "case_result", value: [case_result], operation: "replace" }],
      };

      // ทำการอัปเดตผ่าน mutation
      const updateResponse = await request({
        url: GRAPHQL_ENDPOINT,
        document: INCIDENT_EDIT_MUTATION,
        variables: updateVars,
        requestHeaders: headers,
      });

      // บันทึกประวัติการอัปเดต case_result
      appendHistory(
        "updateCaseResult",
        [{ id, name, result_before: oldResult, result_after: updateResponse.incidentEdit.fieldPatch.case_result, reason }],
        req.user
      );

      // เตรียมตัวแปรสำหรับเพิ่มโน้ตเหตุผล
      const noteVars = {
        input: {
          action: "Re-Investigated",
          content: reason,
          objects: id,
        },
      };

      // เพิ่มโน้ตเหตุผล
      const noteResponse = await request({
        url: GRAPHQL_ENDPOINT,
        document: NOTE_ADD_MUTATION,
        variables: noteVars,
        requestHeaders: headers,
      });

      // บันทึกประวัติการเพิ่มโน้ต
      appendHistory("addNote", [{ ...noteResponse.noteAdd }], req.user);

      // ส่งผลลัพธ์กลับ
      results.push({
        alert_id,
        updated: true,
        case_result: updateResponse.incidentEdit.fieldPatch.case_result,
        note: noteResponse.noteAdd,
      });
    } catch (err) {
      console.error(`❌ ${alert_id} – ${err.message}`, err);
      results.push({ alert_id, error: err.message });
    }
  }

  res.json({ results });
});

// -----------------------------------------------------------------------------
// 🕘 GET /history - Read all history from /data/history-*.json
// -----------------------------------------------------------------------------
router.get("/history", requireUserEmail, async (req, res) => {
  const historyDir = path.join(__dirname, "../data");

  try {
    // อ่านชื่อไฟล์ในโฟลเดอร์ data
    const files = await fsPromises.readdir(historyDir);

    // กรองไฟล์ที่ขึ้นต้นด้วย 'history-' และลงท้ายด้วย .json
    const historyFiles = files.filter(f => f.startsWith("history-") && f.endsWith(".json"));

    let allEntries = [];

    // อ่านและรวมข้อมูลจากไฟล์ history ทุกไฟล์
    for (const file of historyFiles) {
      try {
        const content = await fsPromises.readFile(path.join(historyDir, file), "utf-8");
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          allEntries = allEntries.concat(parsed);
        } else {
          console.warn(`File ${file} does not contain an array, skipping`);
        }
      } catch (err) {
        console.error(`Error reading/parsing ${file}:`, err);
        // ถ้าไฟล์ใดอ่านไม่ได้ก็ข้าม ไม่ส่ง error กลับ client
      }
    }

    res.json(allEntries);
  } catch (err) {
    console.error("Failed to read history files:", err);
    res.status(500).json({ error: "Failed to read history files" });
  }
});

export default router;
