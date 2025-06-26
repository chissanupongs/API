import express from "express";
import { request } from "graphql-request";
import { USERS_QUERY } from "../graphql/queries.js";
import { GRAPHQL_ENDPOINT, TOKEN } from "../config/apollo.config.js";
import { requireUserEmail } from "../middleware/authMiddleware.js";

const router = express.Router();
const headers = { Authorization: `Bearer ${TOKEN}` };

// Build a query string to fetch an incident by alert_id (no schema change)
const buildGetIncidentsQuery = (alertId) => `
  query {
    incidents(
      orderBy: created_at
      orderMode: desc
      first: 10
      filters: {
        mode: and
        filterGroups: []
        filters: { key: \"alert_id\", values: \"${alertId}\" }
      }
    ) {
      edges {
        node {
          id
          alert_id
          alert_name
          alert_status
          case_result
          source_ip
        }
      }
      pageInfo { globalCount }
    }
  }
`;

// POST /lookup/incidents  – expects { alert_ids: [...] }
router.post("/lookup/incidents", requireUserEmail, async (req, res) => {
  const { alert_ids } = req.body;
  if (!Array.isArray(alert_ids) || alert_ids.length === 0) {
    return res.status(400).json({ error: "Missing or invalid 'alert_ids'" });
  }

  const incidents = [];

  for (const alert_id of alert_ids) {
    try {
      const data = await request({
        url: GRAPHQL_ENDPOINT,
        document: buildGetIncidentsQuery(alert_id),
        requestHeaders: headers,
      });

      const count = data?.incidents?.pageInfo?.globalCount || 0;
      if (count === 0) {
        incidents.push({ alert_id, error: "Incident not found" });
      } else if (count > 1) {
        incidents.push({ alert_id, error: "Please contact the admin" });
      } else {
        const n = data.incidents.edges[0].node;
        incidents.push({
          alert_id: n.alert_id,
          id: n.id,
          alert_name: n.alert_name,
          source_ip: n.source_ip || null,
          alert_status: n.alert_status,
          case_result: n.case_result,
        });
      }
    } catch (err) {
      console.error(`lookup/incidents: ${alert_id}`, err.message || err);
      incidents.push({ alert_id, error: "Error fetching incident" });
    }
  }

  res.json({ incidents });
});

// POST /lookup/users  – expects { user_emails: [...] }
router.post("/lookup/users", requireUserEmail, async (req, res) => {
  const { user_emails } = req.body;
  if (!Array.isArray(user_emails) || user_emails.length === 0) {
    return res.status(400).json({ error: "Missing or invalid 'user_emails'" });
  }

  try {
    const data = await request({
      url: GRAPHQL_ENDPOINT,
      document: USERS_QUERY,
      variables: {},
      requestHeaders: headers,
    });

    const users = data?.users?.edges?.map((e) => e.node) || [];

    const result = user_emails.map((email) => {
      const u = users.find(
        (x) => x.user_email && x.user_email.toLowerCase() === email.toLowerCase()
      );
      return u
        ? {
            user_email: u.user_email,
            account_status: u.account_status || "Unknown",
            name: u.name || null,
            id: u.id || null,
          }
        : { user_email: email, error: "User not found" };
    });

    res.json({ users: result });
  } catch (err) {
    console.error("lookup/users", err.message || err);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

export default router;
