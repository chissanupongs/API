import express from "express";
import { request } from "graphql-request";
import { GET_INCIDENT_BY_ID, USERS_QUERY } from "../graphql/queries.js";
import { GRAPHQL_ENDPOINT, TOKEN } from "../config/apollo.config.js";
import { requireUserEmail } from "../middleware/authMiddleware.js";

const router = express.Router();
const headers = { Authorization: `Bearer ${TOKEN}` };

/**
 * POST /lookup/incidents
 * รับ incident_ids (array) เพื่อดึงข้อมูล incident ทีละตัว
 * Response: { incidents: [ { id, alert_name, source_ip, alert_status, case_result }, ... ] }
 */
router.post("/lookup/incidents", requireUserEmail, async (req, res) => {
  const { incident_ids } = req.body;

  if (!Array.isArray(incident_ids) || incident_ids.length === 0) {
    res.setHeader("Content-Type", "application/json");
    return res.status(400).json({ error: "Missing or invalid 'incident_ids'" });
  }

  const results = [];

  for (const id of incident_ids) {
    try {
      // ดึงข้อมูล incident จาก GraphQL
      const data = await request({
        url: GRAPHQL_ENDPOINT,
        document: GET_INCIDENT_BY_ID,
        variables: { id },
        requestHeaders: headers,
      });

      if (data?.incident) {
        // ตัวอย่างสมมติว่ามี source_ip ในข้อมูล incident
        // หากไม่มี ให้แก้ตามข้อมูลจริงที่มี หรือเพิ่มใน GraphQL query
        const { id, alert_name, alert_status, case_result } = data.incident;
        const source_ip = data.incident.source_ip || null;

        results.push({
          id,
          alert_name,
          source_ip,
          alert_status,
          case_result,
        });
      } else {
        // กรณีไม่พบ incident
        results.push({ id, error: "Incident not found" });
      }
    } catch (err) {
      console.error(`Error fetching incident ID ${id}:`, err.message || err);
      results.push({ id, error: "Error fetching incident" });
    }
  }

  res.setHeader("Content-Type", "application/json");
  res.json({ incidents: results });
});

/**
 * POST /lookup/users
 * รับ user_emails (array) เพื่อค้นหาผู้ใช้ทีละตัว
 * Response: { users: [ { user_email, account_status } | { user_email, error }, ... ] }
 */
router.post("/lookup/users", requireUserEmail, async (req, res) => {
  const { user_emails } = req.body;

  if (!Array.isArray(user_emails) || user_emails.length === 0) {
    res.setHeader("Content-Type", "application/json");
    return res.status(400).json({ error: "Missing or invalid 'user_emails'" });
  }

  try {
    // ดึงผู้ใช้ทั้งหมดจาก GraphQL
    const data = await request({
      url: GRAPHQL_ENDPOINT,
      document: USERS_QUERY,
      variables: {},
      requestHeaders: headers,
    });

    const users = data?.users?.edges?.map((e) => e.node) || [];

    // แมป user_emails ที่ส่งมาให้ match กับผู้ใช้ที่ดึงมา
    const result = user_emails.map((email) => {
      const found = users.find(
        (u) => u.user_email && u.user_email.toLowerCase() === email.toLowerCase()
      );

      if (found) {
        return {
          user_email: found.user_email,
          account_status: found.account_status || "Unknown",
          name: found.name || null, // เพิ่มชื่อผู้ใช้ให้ด้วย เผื่อใช้แสดง
          id: found.id || null,
        };
      } else {
        return { user_email: email, error: "User not found" };
      }
    });

    res.setHeader("Content-Type", "application/json");
    res.json({ users: result });
  } catch (err) {
    console.error("Error fetching user data:", err.message || err);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

export default router;
