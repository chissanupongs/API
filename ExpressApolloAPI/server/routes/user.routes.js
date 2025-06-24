// routes/user.routes.js
import express from "express";
import { request } from "graphql-request";
import { USERS_QUERY } from "../graphql/queries.js";
import { UPDATE_USER_STATUS, NOTE_ADD_MUTATION } from "../graphql/mutation.js";
import { GRAPHQL_ENDPOINT, TOKEN } from "../config/apollo.config.js";
import { requireUserEmail } from "../middleware/authMiddleware.js";
import { appendHistory } from "../utils/history.js";

const router = express.Router();

// ===================
// PUT: ปลดล็อกบัญชีผู้ใช้ตาม user_email
// ===================
router.put("/unlock", requireUserEmail, async (req, res) => {
  let users = req.body.users;

  if (!Array.isArray(users)) {
    const { user_email } = req.body;
    if (user_email) {
      users = [{ user_email }];
    } else {
      return res.status(400).json({ error: "Missing or invalid 'user_email'" });
    }
  }

  if (users.length === 0) {
    return res.status(400).json({ error: "No user data provided" });
  }

  const headers = { Authorization: `Bearer ${TOKEN}` };
  const results = [];

  try {
    // ดึง users ทั้งหมดครั้งเดียว
    const usersData = await request({
      url: GRAPHQL_ENDPOINT,
      document: USERS_QUERY,
      requestHeaders: headers,
    });

    const allUsers = usersData?.users?.edges?.map((e) => e.node) || [];

    for (const { user_email } of users) {
      if (!user_email || typeof user_email !== "string" || user_email.trim() === "") {
        results.push({ user_email, error: "Missing or invalid 'user_email'" });
        continue;
      }

      const matchedUser = allUsers.find(
        (u) => u.user_email.toLowerCase() === user_email.toLowerCase()
      );

      if (!matchedUser) {
        results.push({ user_email, error: "User not found with given email" });
        continue;
      }

      const { id, name, account_status } = matchedUser;

      try {
        const unlockData = await request({
          url: GRAPHQL_ENDPOINT,
          document: UPDATE_USER_STATUS,
          variables: { id },
          requestHeaders: headers,
        });

        const unlockedUser = unlockData?.unlockAccount;

        if (!unlockedUser) {
          results.push({ user_email, error: "Failed to unlock user account" });
          continue;
        }

        // บันทึกประวัติการเปลี่ยนแปลง
        appendHistory(
          "unlockUser",
          [
            {
              id: String(id),
              name: String(name),
              user_email: String(user_email),
              status_before: account_status,
              status_after: unlockedUser.account_status,
            },
          ],
          req.user
        );

        // เพิ่มโน้ตแจ้งปลดล็อก
        const noteVars = {
          input: {
            action: "Unlocked",
            content: `Account unlocked by ${req.user.name} (${req.user.user_email})`,
            objects: id,
          },
        };

        const noteResponse = await request({
          url: GRAPHQL_ENDPOINT,
          document: NOTE_ADD_MUTATION,
          variables: noteVars,
          requestHeaders: headers,
        });

        if (noteResponse?.noteAdd) {
          appendHistory("addNote", [noteResponse.noteAdd], req.user);
        }

        results.push({
          user_email,
          ...unlockedUser,
          note: noteResponse.noteAdd,
        });
      } catch (err) {
        console.error(`❌ Unlock failed for ${user_email}:`, err);
        results.push({ user_email, error: "Failed to unlock user account" });
      }
    }

    res.json({ results });
  } catch (err) {
    console.error("❌ Global unlock error:", err);
    res.status(500).json({ error: "Failed to unlock one or more accounts" });
  }
});

export default router;
