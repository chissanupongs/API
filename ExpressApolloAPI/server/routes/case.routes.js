const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { request, gql } = require("graphql-request");

let caselist = [];
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
        const now = new Date().toISOString();
        let historyData = [];

        if (fs.existsSync(HISTORY_FILE_PATH)) {
            const fileContent = fs.readFileSync(HISTORY_FILE_PATH, "utf-8");
            historyData = fileContent ? JSON.parse(fileContent) : [];
        }

        cases.forEach((c) => {
            historyData.push({
                timestamp: now,
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
router.get("/caselist", (req, res) => {
    res.json(caselist);
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

// ✅ PUT: อัปเดต case_status
router.put("/updateCaseStatus", (req, res) => {
    const { token, case_id, case_status } = req.body;

    if (!token || !Array.isArray(case_id) || !case_status) {
        return res
            .status(400)
            .json({ error: "token, case_id array and case_status required" });
    }

    if (!VALID_STATUSES.includes(case_status)) {
        return res.status(400).json({
            error: `Invalid 'case_status'. Allowed: ${VALID_STATUSES.join(", ")}`,
        });
    }

    let updatedCases = [];

    for (const singleCaseId of case_id) {
        const index = caselist.findIndex(
            (item) => item.token === token && item.case_id.includes(singleCaseId)
        );

        if (index !== -1) {
            caselist[index].case_status = case_status;
            caselist[index].timestamp = new Date().toISOString();
            if (!caselist[index].case_id.includes(singleCaseId)) {
                caselist[index].case_id.push(singleCaseId);
            }
            updatedCases.push(caselist[index]);
        } else {
            const newCase = {
                token,
                case_id: [singleCaseId],
                case_status,
                case_result: null,
                timestamp: new Date().toISOString(),
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
            caselist[index].timestamp = new Date().toISOString();
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
                case_status: null,
                case_result,
                timestamp: new Date().toISOString(),
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
