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

const VALID_RESULTS = ["WaitingAnalysis", "TruePositives", "FalsePositives"];
const HISTORY_FILE_PATH = path.join(__dirname, "../data/history.json");

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
      historyData.push({ action, case: c });
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
router.get("/incidents", async (req, res) => {
  const headers = { Authorization: `Bearer ${TOKEN}` };
  try {
    const data = await request({
      url: GRAPHQL_ENDPOINT,
      document: GET_INCIDENTS,
      variables: {},
      requestHeaders: headers,
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch INCIDENTS" });
  }
});

// ✅ GET: เคสตาม ID
router.put("/incident", async (req, res) => {
  const { id } = req.body;
  if (!id || typeof id !== "string" || id.trim() === "") {
    return res
      .status(400)
      .json({ error: "Invalid or missing 'id' in request body" });
  }

  const headers = { Authorization: `Bearer ${TOKEN}` };
  try {
    const data = await request({
      url: GRAPHQL_ENDPOINT,
      document: GET_INCIDENT_BY_ID,
      variables: { id },
      requestHeaders: headers,
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch incident by ID" });
  }
});

router.put("/closedAlertStatus", async (req, res) => {
  const { id, alert_status } = req.body;

  if (!id || typeof id !== "string" || id.trim() === "") {
    return res.status(400).json({ error: "Invalid or missing 'id'" });
  }

  if (alert_status !== "Closed") {
    return res.status(400).json({ error: "This endpoint only accepts 'Closed' alert_status" });
  }

  try {
    const headers = { Authorization: `Bearer ${TOKEN}` };

    // ✅ Update alert_status to "Closed"
    const updateVars = {
      id,
      input: [
        { key: "alert_status", value: ["Closed"], operation: "replace" },
      ],
    };

    const updateResponse = await request({
      url: GRAPHQL_ENDPOINT,
      document: INCIDENT_EDIT_MUTATION,
      variables: updateVars,
      requestHeaders: headers,
    });

    appendHistory("updateAlertStatus", [
      updateResponse.incidentEdit.fieldPatch,
    ]);

    // ✅ Add note with NOTE_ADD_MUTATION
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

    appendHistory("addNote", [noteResponse.noteAdd]);

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
    res.status(500).json({ error: "Failed to update alert_status or add note" });
  }
});


router.put("/updateCaseResult", async (req, res) => {
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

    // ✅ Update case_result
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

    const updatedCase = {
      ...updateResponse.incidentEdit.fieldPatch,
      reason,
    };
    appendHistory("updateCaseResult", [updatedCase]);

    // ✅ Add note with NOTE_ADD_MUTATION
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

    appendHistory("addNote", [noteResponse.noteAdd]);

    res.json({ ...updatedCase, note: noteResponse.noteAdd });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update case_result or add note" });
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

module.exports = router;
