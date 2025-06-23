// routes/login.routes.js
const express = require("express");
const router = express.Router();
const { request, gql } = require("graphql-request");
const { GRAPHQL_ENDPOINT, TOKEN } = require("../config/apollo.config.js");

// GraphQL query สำหรับดึงรายชื่อ users ทั้งหมด
const USERS_QUERY = gql`
  query {
    users {
      edges {
        node {
          id
          name
          user_email
          account_status
        }
      }
    }
  }
`;

// ใช้ middleware สำหรับแปลง body เป็น JSON (แทน bodyParser.json())
router.use(express.json());

/**
 * POST /login
 * รับ user_email ผ่าน request body
 * ตรวจสอบว่ามี user_email นี้ในระบบหรือไม่
 * ตอบกลับผลการตรวจสอบ
 */
router.post("/login", async (req, res) => {
  const user_email = req.body.user_email;

  // เช็คว่ามี user_email ส่งมาหรือไม่ และเป็น string
  if (!user_email || typeof user_email !== "string") {
    return res.status(400).json({ error: "Missing or invalid user_email" });
  }

  try {
    // ดึงข้อมูล user ทั้งหมดจาก GraphQL
    const data = await request({
      url: GRAPHQL_ENDPOINT,
      document: USERS_QUERY,
      requestHeaders: { Authorization: `Bearer ${TOKEN}` },
    });

    // แปลงข้อมูลให้เป็น array ของ user objects
    const users = data?.users?.edges?.map((edge) => edge.node) || [];

    // หา user ที่ user_email ตรงกับที่ส่งมา (ไม่สนใจ case)
    const matchedUser = users.find(
      (user) => user.user_email.toLowerCase() === user_email.toLowerCase()
    );

    // ถ้าไม่เจอ user ตอบกลับ error
    if (!matchedUser) {
      return res.status(403).json({ error: "User email not found" });
    }

    // ถ้าเจอ user ตอบกลับว่า login สำเร็จ พร้อมข้อมูล user
    return res.json({ message: "Login success", user: matchedUser });
  } catch (err) {
    // กรณีเกิด error ขณะติดต่อ GraphQL
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
