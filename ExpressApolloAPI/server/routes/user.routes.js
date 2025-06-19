const express = require("express");
const router = express.Router();
const { request } = require("graphql-request");
const { USERS_QUERY } = require("../graphql/queries");
const { UPDATE_USER_STATUS } = require("../graphql/mutation.js");
const { GRAPHQL_ENDPOINT, TOKEN } = require("../config/apollo.config.js");
const { requireUserEmail } = require("../middleware/authMiddleware");
const { appendHistory } = require("../utils/history");

// ===================
// GET: รายชื่อผู้ใช้ทั้งหมด
// ===================
router.get("/users", requireUserEmail, async (req, res) => {
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
  };

  try {
    const data = await request({
      url: GRAPHQL_ENDPOINT,
      document: USERS_QUERY,
      variables: {},
      requestHeaders: headers,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ===================
// PUT: ปลดล็อกบัญชีผู้ใช้ตาม user_email
// ===================
router.put("/unlock", requireUserEmail, async (req, res) => {
  const { user_email } = req.body;
  const context = {
    user_email: req.user_email, // แก้จาก req.userEmail เป็น req.user_email
    user_agent: req.userAgent,
    ip_address: req.userIP,
  };

  if (
    !user_email ||
    typeof user_email !== "string" ||
    user_email.trim() === ""
  ) {
    return res.status(400).json({ error: "Missing or invalid 'user_email'" });
  }

  const headers = {
    Authorization: `Bearer ${TOKEN}`,
  };

  try {
    // 1. ดึง users ทั้งหมด
    const usersData = await request({
      url: GRAPHQL_ENDPOINT,
      document: USERS_QUERY,
      variables: {},
      requestHeaders: headers,
    });

    // 2. หา user ที่ตรงกับ email
    const users = usersData?.users?.edges || [];
    const matchedUser = users
      .map((u) => u.node)
      .find((u) => u.user_email.toLowerCase() === user_email.toLowerCase());

    if (!matchedUser) {
      return res.status(404).json({ error: "User not found with given email" });
    }

    const { id, name, account_status } = matchedUser;

    // 3. ปลดล็อกบัญชี
    const unlockData = await request({
      url: GRAPHQL_ENDPOINT,
      document: UPDATE_USER_STATUS,
      variables: { id },
      requestHeaders: headers,
    });

    const unlockedUser = unlockData?.unlockAccount;

    if (!unlockedUser) {
      return res.status(404).json({ error: "Unlock failed or user not found" });
    }

    // 4. บันทึกประวัติ
    appendHistory(
      "unlockUser",
      [
        {
          id: unlockedUser.id,
          name: unlockedUser.name,
          user_email: unlockedUser.user_email,
          status_before: account_status,
          status_after: unlockedUser.account_status,
        },
      ],
      context
    );

    res.json(unlockedUser);
  } catch (error) {
    console.error("❌ Failed to unlock account:", error);
    res.status(500).json({ error: "Failed to unlock account" });
  }
});

module.exports = router;
