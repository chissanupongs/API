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

// ===================
// PUT: ปิด alert_status ของ incident พร้อมเพิ่ม note อัตโนมัติ
// ===================
router.put("/closedAlertStatus", requireUserEmail, async (req, res) => {
  const { id, alert_status } = req.body;

  if (!id || typeof id !== "string" || id.trim() === "") {
    return res.status(400).json({ error: "Invalid or missing 'id'" });
  }

  if (alert_status !== "Closed") {
    return res
      .status(400)
      .json({ error: "This endpoint only accepts 'Closed' alert_status" });
  }

  try {
    const headers = { Authorization: `Bearer ${TOKEN}` };

    // ดึงข้อมูล incident เดิม
    const existingIncidentData = await request({
      url: GRAPHQL_ENDPOINT,
      document: GET_INCIDENT_BY_ID,
      variables: { id },
      requestHeaders: headers,
    });

    const oldStatus = existingIncidentData.incident?.alert_status || "unknown";
    const name = existingIncidentData.incident?.alert_name || "unknown";

    // อัพเดต alert_status เป็น "Closed"
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

    // บันทึกประวัติ update alert_status โดยใช้ข้อมูลจาก req.user
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

    // เพิ่มโน้ตแจ้งว่าเคสถูกปิด
    const noteVars = {
      input: {
        action: "Closed",
        content: "Incident was Closed",
        objects: [id],
      },
    };

    const noteResponse = await request({
      url: GRAPHQL_ENDPOINT,
      document: NOTE_ADD_MUTATION,
      variables: noteVars,
      requestHeaders: headers,
    });

    // บันทึกประวัติการเพิ่มโน้ต
    appendHistory(
      "addNote",
      [
        {
          ...noteResponse.noteAdd,
        },
      ],
      req.user
    );

    res.json({
      ...updateResponse.incidentEdit.fieldPatch,
      note: noteResponse.noteAdd,
    });
  } catch (error) {
    console.error("❌ Error updating alert_status or adding note:");
    if (error.response?.errors) {
      console.error("GraphQL Errors:", error.response.errors);
    } else {
      console.error("Raw Error:", error.message || error);
    }
    res
      .status(500)
      .json({ error: "Failed to update alert_status or add note" });
  }
});

// ===================
// PUT: เปลี่ยน CaseResult ของ incident พร้อมเพิ่ม note อัตโนมัติ (เก็บ old result)
// ===================
router.put("/updateCaseResult", requireUserEmail, async (req, res) => {
  const { id, case_result, reason } = req.body;

  if (!id || typeof id !== "string" || id.trim() === "") {
    return res.status(400).json({ error: "Invalid or missing 'id'" });
  }

  if (!case_result || !VALID_RESULTS.includes(case_result)) {
    return res.status(400).json({ error: "Invalid 'case_result'" });
  }

  if (!reason || typeof reason !== "string" || reason.trim() === "") {
    return res.status(400).json({ error: "Missing or invalid 'reason'" });
  }

  try {
    const headers = { Authorization: `Bearer ${TOKEN}` };

    // ดึงข้อมูล incident เดิม
    const existingIncidentData = await request({
      url: GRAPHQL_ENDPOINT,
      document: GET_INCIDENT_BY_ID,
      variables: { id },
      requestHeaders: headers,
    });

    const oldResult = existingIncidentData.incident?.case_result || "unknown";
    const name = existingIncidentData.incident?.alert_name || "unknown";

    // อัพเดต case_result
    const updateVars = {
      id,
      input: [
        { key: "case_result", value: [case_result], operation: "replace" },
      ],
    };
    const updateResponse = await request({
      url: GRAPHQL_ENDPOINT,
      document: INCIDENT_EDIT_MUTATION,
      variables: updateVars,
      requestHeaders: headers,
    });

    // บันทึกประวัติการเปลี่ยนแปลง case_result
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

    // เพิ่มโน้ตแจ้งการแก้ไข
    const noteVars = {
      input: {
        action: "Re-Investigated",
        content: reason,
        objects: [id],
      },
    };

    const noteResponse = await request({
      url: GRAPHQL_ENDPOINT,
      document: NOTE_ADD_MUTATION,
      variables: noteVars,
      requestHeaders: headers,
    });

    // บันทึกประวัติการเพิ่มโน้ต
    appendHistory(
      "addNote",
      [
        {
          ...noteResponse.noteAdd,
        },
      ],
      req.user
    );

    res.json({
      ...updateResponse.incidentEdit.fieldPatch,
      note: noteResponse.noteAdd,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update case_result or add note" });
  }
});

// ===================
// GET: ประวัติทั้งหมด (อ่านจาก history.json)
// ===================
router.get("/history", requireUserEmail, (req, res) => {
  try {
    if (fs.existsSync(HISTORY_FILE_PATH)) {
      const fileContent = fs.readFileSync(HISTORY_FILE_PATH, "utf-8");
      res.json(fileContent ? JSON.parse(fileContent) : []);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error("Error reading history file:", err);
    res.status(500).json({ error: "Failed to read history file" });
  }
});

module.exports = router;
