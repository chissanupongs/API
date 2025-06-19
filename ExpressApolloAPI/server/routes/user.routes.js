const express = require("express");
const router = express.Router();
const { request, gql } = require("graphql-request");
const { USERS_QUERY } = require("../graphql/queries");
const { UPDATE_USER_STATUS } = require("../graphql/mutation.js");
const { GRAPHQL_ENDPOINT, TOKEN } = require("../config/apollo.config.js");

router.get("/users", async (req, res) => {
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
    // console.error("❌ Error fetching users:", error.response?.errors || error.message);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.put("/unlock", async (req, res) => {
  const { user_email } = req.body;

  if (!user_email || typeof user_email !== "string" || user_email.trim() === "") {
    return res.status(400).json({ error: "Missing or invalid 'user_email'" });
  }

  const headers = {
    Authorization: `Bearer ${TOKEN}`,
  };

  try {
    // ✅ 1. ดึง users ทั้งหมด
    const usersData = await request({
      url: GRAPHQL_ENDPOINT,
      document: USERS_QUERY,
      variables: {},
      requestHeaders: headers,
    });

    // ✅ 2. หา user ที่ตรงกับ email
    const users = usersData?.users?.edges || [];
    const matchedUser = users
      .map((u) => u.node)
      .find((u) => u.user_email.toLowerCase() === user_email.toLowerCase());

    if (!matchedUser) {
      return res.status(404).json({ error: "User not found with given email" });
    }

    const { id } = matchedUser;

    // ✅ 3. ทำการปลดล็อกด้วย ID ที่หาได้
    const unlockData = await request({
      url: GRAPHQL_ENDPOINT,
      document: UPDATE_USER_STATUS,
      variables: { id },
      requestHeaders: headers,
    });

    const user = unlockData?.unlockAccount;

    if (!user) {
      return res.status(404).json({ error: "Unlock failed or user not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("❌ Failed to unlock account:", error);
    res.status(500).json({ error: "Failed to unlock account" });
  }
});


module.exports = router;
