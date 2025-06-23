const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { request } = require("graphql-request");
const { GRAPHQL_ENDPOINT, TOKEN } = require("../config/apollo.config.js");
const { GET_INCIDENTS, GET_INCIDENT_BY_ID } = require("../graphql/queries");
const {
  INCIDENT_EDIT_MUTATION,
  NOTE_ADD_MUTATION,
} = require("../graphql/mutation.js");
const { appendHistory } = require("../utils/history");
const { requireUserEmail } = require("../middleware/authMiddleware");

const VALID_RESULTS = ["WaitingAnalysis", "TruePositives", "FalsePositives"];
const HISTORY_FILE_PATH = path.join(__dirname, "../data/history.json");
const headers = { Authorization: `Bearer ${TOKEN}` };

// ===================
// GET: รายชื่อเคสทั้งหมด
// ===================
// router.get("/incidents", requireUserEmail, async (req, res) => {
//   const headers = { Authorization: `Bearer ${TOKEN}` };
//   try {
//     const data = await request({
//       url: GRAPHQL_ENDPOINT,
//       document: GET_INCIDENTS,
//       variables: {},
//       requestHeaders: headers,
//     });
//     res.json(data);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Failed to fetch INCIDENTS" });
//   }
// });

// ===================
// PUT: ดึง incident ตาม ID
// ===================
// router.put("/incident", requireUserEmail, async (req, res) => {
//   const { id } = req.body;
//   if (!id || typeof id !== "string" || id.trim() === "") {
//     return res
//       .status(400)
//       .json({ error: "Invalid or missing 'id' in request body" });
//   }

//   const headers = { Authorization: `Bearer ${TOKEN}` };
//   try {
//     const data = await request({
//       url: GRAPHQL_ENDPOINT,
//       document: GET_INCIDENT_BY_ID,
//       variables: { id },
//       requestHeaders: headers,
//     });
//     res.json(data);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Failed to fetch incident by ID" });
//   }
// });

// ==========================
// PUT /closedAlertStatus
// ==========================
router.put("/closedAlertStatus", requireUserEmail, async (req, res) => {
  let incidents = req.body.incidents;

  // รองรับ single object
  if (!Array.isArray(incidents)) {
    const { id, alert_status } = req.body;
    if (id && alert_status) {
      incidents = [{ id, alert_status }];
    } else {
      return res.status(400).json({ error: "Missing 'id' or 'alert_status'" });
    }
  }

  if (incidents.length === 0) {
    return res.status(400).json({ error: "No incident data provided" });
  }

  const results = [];

  for (const { id, alert_status } of incidents) {
    if (!id || typeof id !== "string" || alert_status !== "Closed") {
      results.push({ id, error: "Invalid id or alert_status" });
      continue;
    }

    try {
      const existingIncidentData = await request({
        url: GRAPHQL_ENDPOINT,
        document: GET_INCIDENT_BY_ID,
        variables: { id },
        requestHeaders: headers,
      });

      const oldStatus = existingIncidentData.incident?.alert_status || "unknown";
      const name = existingIncidentData.incident?.alert_name || "unknown";

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

      appendHistory(
        "updateAlertStatus",
        [
          {
            id,
            name,
            status_before: oldStatus,
            status_after: updateResponse.incidentEdit.fieldPatch.alert_status,
          },
        ],
        req.user
      );

      const noteVars = {
        input: {
          action: "Closed",
          content: "Incident was Closed",
          objects: id,
        },
      };

      const noteResponse = await request({
        url: GRAPHQL_ENDPOINT,
        document: NOTE_ADD_MUTATION,
        variables: noteVars,
        requestHeaders: headers,
      });

      appendHistory("addNote", [{ ...noteResponse.noteAdd }], req.user);

      results.push({
        id,
        updated: true,
        alert_status: updateResponse.incidentEdit.fieldPatch.alert_status,
        note: noteResponse.noteAdd,
      });
    } catch (err) {
      console.error(`❌ Failed for incident ID: ${id}`, err);
      results.push({ id, error: "Failed to update" });
    }
  }

  res.json({ results });
});

// ==========================
// PUT /updateCaseResult
// ==========================
router.put("/updateCaseResult", requireUserEmail, async (req, res) => {
  let incidents = req.body.incidents;

  // รองรับ single object
  if (!Array.isArray(incidents)) {
    const { id, case_result, reason } = req.body;
    if (id && case_result && reason) {
      incidents = [{ id, case_result, reason }];
    } else {
      return res.status(400).json({ error: "Missing 'id', 'case_result' or 'reason'" });
    }
  }

  if (incidents.length === 0) {
    return res.status(400).json({ error: "No incident data provided" });
  }

  const results = [];

  for (const { id, case_result, reason } of incidents) {
    if (!id || typeof id !== "string") {
      results.push({ id, error: "Invalid or missing 'id'" });
      continue;
    }

    if (!VALID_RESULTS.includes(case_result)) {
      results.push({ id, error: "Invalid 'case_result'" });
      continue;
    }

    if (!reason || typeof reason !== "string" || reason.trim() === "") {
      results.push({ id, error: "Missing or invalid 'reason'" });
      continue;
    }

    try {
      const existingIncidentData = await request({
        url: GRAPHQL_ENDPOINT,
        document: GET_INCIDENT_BY_ID,
        variables: { id },
        requestHeaders: headers,
      });

      const oldResult = existingIncidentData.incident?.case_result || "unknown";
      const name = existingIncidentData.incident?.alert_name || "unknown";

      const updateVars = {
        id,
        input: [{ key: "case_result", value: [case_result], operation: "replace" }],
      };

      const updateResponse = await request({
        url: GRAPHQL_ENDPOINT,
        document: INCIDENT_EDIT_MUTATION,
        variables: updateVars,
        requestHeaders: headers,
      });

      appendHistory(
        "updateCaseResult",
        [
          {
            id,
            name,
            result_before: oldResult,
            result_after: updateResponse.incidentEdit.fieldPatch.case_result,
            reason,
          },
        ],
        req.user
      );

      const noteVars = {
        input: {
          action: "Re-Investigated",
          content: reason,
          objects: id,
        },
      };

      const noteResponse = await request({
        url: GRAPHQL_ENDPOINT,
        document: NOTE_ADD_MUTATION,
        variables: noteVars,
        requestHeaders: headers,
      });

      appendHistory("addNote", [{ ...noteResponse.noteAdd }], req.user);

      results.push({
        id,
        updated: true,
        case_result: updateResponse.incidentEdit.fieldPatch.case_result,
        note: noteResponse.noteAdd,
      });
    } catch (err) {
      console.error(`❌ Failed for incident ID: ${id}`, err);
      results.push({ id, error: "Failed to update" });
    }
  }

  res.json({ results });
});

// ===================
// GET: ประวัติทั้งหมด (อ่านจาก history.json)
// ===================
const fsPromises = require("fs").promises;

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

module.exports = router;
