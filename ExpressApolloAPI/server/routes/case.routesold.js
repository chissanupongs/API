const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { request, gql } = require("graphql-request");
const { GRAPHQL_ENDPOINT, TOKEN } = require('../config/apollo.config.js');
const { GET_INCIDENTS } = require("../graphql/queries.js");
const { GET_INCIDENT_BY_ID } = require("../graphql/queries.js");
const { INCIDENT_EDIT_MUTATION } = require("../graphql/mutation.js");
const { NOTE_ADD_MUTATION } = require("../graphql/mutation.js");


const VALID_STATUSES = ["Opened", "Closed"];
const VALID_RESULTS = ["WaitingAnalysis", "TruePositives", "FalsePositives"];
const HISTORY_FILE_PATH = path.join(__dirname, "../data/history.json");


// เคลียร์ history เมื่อเริ่มต้น
try {
    fs.writeFileSync(HISTORY_FILE_PATH, "[]", "utf-8");
    console.log("✅ Cleared history.json on startup");
} catch (err) {
    console.error("❌ Failed to clear history.json:", err);
}

function appendHistory(action, cases) {
    try {
        let historyData = [];

        if (fs.existsSync(HISTORY_FILE_PATH)) {
            const fileContent = fs.readFileSync(HISTORY_FILE_PATH, "utf-8");
            historyData = fileContent ? JSON.parse(fileContent) : [];
        }

        cases.forEach((c) => {
            historyData.push({
                action,
                case: c,
            });
        });

        fs.writeFileSync(
            HISTORY_FILE_PATH,
            JSON.stringify(historyData, null, 2),
            "utf-8"
        );
    } catch (err) {
        console.error("Error writing history file:", err);
    }
}

// ✅ GET: รายชื่อเคสทั้งหมด
router.get("/caselist", async (req, res) => {
    const headers = {
    Authorization: `Bearer ${TOKEN}`,
  };

  try {
    const data = await request({
      url: GRAPHQL_ENDPOINT,
      document: GET_INCIDENTS,
      variables: {},
      requestHeaders: headers,
    });
    res.json(data);
  } catch (error) {
    // console.error("❌ Error fetching INCIDENTS:", error.response?.errors || error.message);
    res.status(500).json({ error: "Failed to fetch INCIDENTS" });
  }
});

// ✅ GET: ประวัติทั้งหมด
router.get("/history", (req, res) => {
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

// ✅ PUT: อัปเดต alert_status
router.put("/updateCaseStatus", async (req, res) => {
    const { token, case_id, alert_status } = req.body;

    if (!token || !Array.isArray(case_id) || !alert_status) {
        return res
            .status(400)
            .json({ error: "token, case_id array and alert_status required" });
    }

    if (!VALID_STATUSES.includes(alert_status)) {
        return res.status(400).json({
            error: `Invalid 'alert_status'. Allowed: ${VALID_STATUSES.join(", ")}`,
        });
    }

    let updatedCases = [];

    for (const singleCaseId of case_id) {
        const index = caselist.findIndex(
            (item) => item.token === token && item.case_id.includes(singleCaseId)
        );

        if (index !== -1) {
            caselist[index].alert_status = alert_status;
            if (!caselist[index].case_id.includes(singleCaseId)) {
                caselist[index].case_id.push(singleCaseId);
            }
            updatedCases.push(caselist[index]);
        } else {
            const newCase = {
                token,
                case_id: [singleCaseId],
                alert_status,
                case_result: null,
            };
            caselist.push(newCase);
            updatedCases.push(newCase);
        }
    }

    appendHistory("updateCaseStatus", updatedCases);
    res.json(updatedCases);
});

// ✅ PUT: อัปเดต case_result
router.put("/updateCaseResult", (req, res) => {
    const { token, case_id, case_result, reason } = req.body;

    if (!token || !Array.isArray(case_id) || !case_result) {
        return res.status(400).json({
            error: "token, case_id array and case_result required",
        });
    }

    if (!VALID_RESULTS.includes(case_result)) {
        return res.status(400).json({
            error: `Invalid 'case_result'. Allowed: ${VALID_RESULTS.join(", ")}`,
        });
    }

    if (!reason || typeof reason !== "string" || reason.trim() === "") {
        return res.status(400).json({
            error: "A valid reason for updating case_result is required",
        });
    }

    let updatedCases = [];

    for (const singleCaseId of case_id) {
        const index = caselist.findIndex(
            (item) => item.token === token && item.case_id.includes(singleCaseId)
        );

        if (index !== -1) {
            caselist[index].case_result = case_result;
            if (!caselist[index].case_id.includes(singleCaseId)) {
                caselist[index].case_id.push(singleCaseId);
            }
            updatedCases.push({
                ...caselist[index],
                reason,
            });
        } else {
            const newCase = {
                token,
                case_id: [singleCaseId],
                alert_status: null,
                case_result,
                reason,
            };
            caselist.push(newCase);
            updatedCases.push(newCase);
        }
    }

    appendHistory("updateCaseResult", updatedCases);
    res.json(updatedCases);
});


// ✅ DELETE: ลบเคส
router.delete("/deleteCase", (req, res) => {
    const { token, case_id } = req.body;

    if (!token || !Array.isArray(case_id)) {
        return res.status(400).json({ error: "token and case_id array required" });
    }

    let deletedCases = [];

    for (const singleCaseId of case_id) {
        const index = caselist.findIndex(
            (item) => item.token === token && item.case_id.includes(singleCaseId)
        );

        if (index !== -1) {
            const [deleted] = caselist.splice(index, 1);
            deletedCases.push(deleted);
        }
    }

    if (deletedCases.length === 0) {
        return res
            .status(404)
            .json({ error: "No matching cases found to delete." });
    }

    appendHistory("deleteCase", deletedCases);
    res.json(deletedCases);
});

module.exports = router;
