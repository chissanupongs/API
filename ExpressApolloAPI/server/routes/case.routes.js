import express from "express";
import path from "path";
import fs from "fs";
import { request } from "graphql-request";
import { GRAPHQL_ENDPOINT, TOKEN } from "../config/apollo.config.js";
import { GET_INCIDENTS, GET_INCIDENT_BY_ID } from "../graphql/queries.js";
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

const HISTORY_FILE_PATH = path.join(__dirname, "../data/history.json");
const headers = { Authorization: `Bearer ${TOKEN}` };


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


// ==========================
// PUT /closedAlertStatus
// ==========================
router.put("/closedAlertStatus", requireUserEmail, async (req, res) => {
  let incidents = req.body.incidents;

  if (!Array.isArray(incidents)) {
    const { alert_id, alert_status } = req.body;
    if (alert_id && alert_status) {
      incidents = [{ alert_id, alert_status }];
    } else {
      return res.status(400).json({ error: "Missing 'alert_id' or 'alert_status'" });
    }
  }

  if (incidents.length === 0) {
    return res.status(400).json({ error: "No incident data provided" });
  }

  const results = [];

  for (const { alert_id, alert_status } of incidents) {
    if (!alert_id || typeof alert_id !== "string" || alert_status !== "Closed") {
      results.push({ alert_id, error: "Invalid alert_id or alert_status" });
      continue;
    }

    try {
      const { id, node } = await findIncidentByAlertId(alert_id);

      const updateVars = {
        id,
        input: [{ key: "alert_status", value: ["Closed"], operation: "replace" }],
      };

      const updateResponse = await request({
        url: GRAPHQL_ENDPOINT,
        document: INCIDENT_EDIT_MUTATION,
        variables: updateVars,
        requestHeaders: headers,
      });

      // ✅ เพิ่มประวัติการอัปเดต
      appendHistory(
        "updateAlertStatus",
        [
          {
            id,
            alert_id,
            name: node.alert_name || "unknown",
            status_before: node.alert_status || "unknown",
            status_after: updateResponse?.incidentEdit?.fieldPatch?.alert_status || "unknown",
          },
        ],
        req.user
      );

      // ✅ เพิ่ม note
      const noteResponse = await request({
        url: GRAPHQL_ENDPOINT,
        document: NOTE_ADD_MUTATION,
        variables: {
          input: {
            action: "Closed",
            content: "Incident was Closed",
            objects: id,
          },
        },
        requestHeaders: headers,
      });

      appendHistory("addNote", [{ ...noteResponse.noteAdd }], req.user);

      results.push({
        alert_id,
        updated: true,
        alert_status: updateResponse.incidentEdit.fieldPatch.alert_status,
        note: noteResponse.noteAdd,
      });
    } catch (err) {
      console.error(`❌ Failed for alert_id: ${alert_id} – ${err.message}`);

      let status = 500;
      let message = "Unknown error";

      if (err.message === "Notfound") {
        status = 404;
        message = `No incident found for alert_id: ${alert_id}`;
      } else if (err.message === "Please contact the admin") {
        status = 409;
        message = `Multiple incidents found for alert_id: ${alert_id}`;
      }

      results.push({ alert_id, error: message });
    }
  }

  // 🔍 สรุปสถานะ
  const hasErrors = results.some(r => r.error);
  const hasSuccess = results.some(r => r.updated);

  if (hasSuccess && hasErrors) {
    res.status(207).json({ results }); // Multi-Status: บางส่วนสำเร็จ
  } else if (hasErrors) {
    res.status(400).json({ results }); // ผิดทั้งหมด
  } else {
    res.status(200).json({ results }); // สำเร็จทั้งหมด
  }
});


// ==========================
// PUT /updateCaseResult
// ==========================
router.put("/updateCaseResult", requireUserEmail, async (req, res) => {
  let incidents = req.body.incidents;

  if (!Array.isArray(incidents)) {
    const { alert_id, case_result, reason } = req.body;
    if (alert_id && case_result && reason) {
      incidents = [{ alert_id, case_result, reason }];
    } else {
      return res.status(400).json({ error: "Missing 'alert_id', 'case_result' or 'reason'" });
    }
  }

  if (incidents.length === 0) {
    return res.status(400).json({ error: "No incident data provided" });
  }

  const results = [];

  for (const { alert_id, case_result, reason } of incidents) {
    if (!alert_id || typeof alert_id !== "string") {
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
      const { id, node } = await findIncidentByAlertId(alert_id);

      const updateResponse = await request({
        url: GRAPHQL_ENDPOINT,
        document: INCIDENT_EDIT_MUTATION,
        variables: {
          id,
          input: [{ key: "case_result", value: [case_result], operation: "replace" }],
        },
        requestHeaders: headers,
      });

      appendHistory(
        "updateCaseResult",
        [
          {
            id,
            alert_id,
            name: node.alert_name || "unknown",
            result_before: node.case_result || "unknown",
            result_after: updateResponse.incidentEdit.fieldPatch.case_result,
            reason,
          },
        ],
        req.user
      );

      const noteResponse = await request({
        url: GRAPHQL_ENDPOINT,
        document: NOTE_ADD_MUTATION,
        variables: {
          input: {
            action: "Re-Investigated",
            content: reason,
            objects: id,
          },
        },
        requestHeaders: headers,
      });

      appendHistory("addNote", [{ ...noteResponse.noteAdd }], req.user);

      results.push({
        alert_id,
        updated: true,
        case_result: updateResponse.incidentEdit.fieldPatch.case_result,
        note: noteResponse.noteAdd,
      });
    } catch (err) {
      console.error(`❌ Failed for alert_id: ${alert_id} – ${err.message}`);

      let status = 500;
      let message = "Unknown error";

      if (err.message === "Notfound") {
        status = 404;
        message = `No incident found for alert_id: ${alert_id}`;
      } else if (err.message === "Please contact the admin") {
        status = 409;
        message = `Multiple incidents found for alert_id: ${alert_id}`;
      }

      results.push({ alert_id, error: message });
    }
  }

  const hasErrors = results.some(r => r.error);
  const hasSuccess = results.some(r => r.updated);

  if (hasSuccess && hasErrors) {
    res.status(207).json({ results });
  } else if (hasErrors) {
    res.status(400).json({ results });
  } else {
    res.status(200).json({ results });
  }
});

// ===================
// GET: ประวัติทั้งหมด (อ่านจาก history.json)
// ===================
const fsPromises = fs.promises;

router.get("/history", requireUserEmail, async (req, res) => {
  const historyDir = path.join(__dirname, "../data");

  try {
    // อ่านชื่อไฟล์ในโฟลเดอร์ data
    const files = await fsPromises.readdir(historyDir);

    // กรองเฉพาะไฟล์ที่ขึ้นต้นด้วย 'history-' และลงท้ายด้วย .json
    const historyFiles = files.filter(f => f.startsWith("history-") && f.endsWith(".json"));

    let allEntries = [];

    // อ่านข้อมูลจากไฟล์ history แต่ละไฟล์
    for (const file of historyFiles) {
      try {
        const content = await fsPromises.readFile(path.join(historyDir, file), "utf-8");
        if (content) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            allEntries = allEntries.concat(parsed);
          } else {
            console.warn(`File ${file} does not contain an array, skipping`);
          }
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