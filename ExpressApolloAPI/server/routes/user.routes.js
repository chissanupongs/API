// server/routes/user.routes.js
const express = require("express");
const router = express.Router();
const { request, gql } = require("graphql-request");
const { USERS_QUERY } = require("../graphql/queries");

const GRAPHQL_ENDPOINT = "http://192.168.150.236:32002/graphql";
const TOKEN = "36e4b886-ebd7-45b0-93a2-840214c71a22";


// 🔁 Mutation สำหรับเปลี่ยนสถานะ account
const UPDATE_USER_STATUS = gql`
  mutation unlockAccount($id: ID!) {
    unlockAccount(id: $id) {
      id
      user_email
      account_status
    }
  }
`;

router.get("/users", async (req, res) => {
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
  };

  try {
    const data = await request(GRAPHQL_ENDPOINT, USERS_QUERY, {}, headers);
    // ดึงข้อมูลสำเร็จ
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.put("/unlock", async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Missing user ID" });
  }

  const headers = {
    Authorization: `Bearer ${TOKEN}`,
  };

  try {
    const data = await request(
      GRAPHQL_ENDPOINT,
      UPDATE_USER_STATUS,
      { id },
      headers
    );
    const user = data?.unlockAccount;
    if (!user) {
      return res.status(404).json({ error: "User not found or unlock failed" });
    }
    res.json(user);
  } catch (error) {
    console.error(
      "❌ Failed to unlock account:",
      error.response || error.message
    );
    res.status(500).json({ error: "Failed to unlock account" });
  }
});

module.exports = router;
