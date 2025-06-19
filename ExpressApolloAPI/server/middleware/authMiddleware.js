const { request, gql } = require("graphql-request");
const { GRAPHQL_ENDPOINT, TOKEN } = require("../config/apollo.config.js");

// GraphQL query สำหรับดึงรายชื่อ user ทั้งหมด
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

/**
 * Middleware ตรวจสอบ user_email จาก header ว่ามีในระบบหรือไม่
 * ถ้าไม่ผ่านจะตอบ 401 หรือ 403
 * ถ้าผ่านจะเก็บ user_email, userAgent, userIP ไว้ที่ req เพื่อใช้ใน route ต่อไป
 */
const requireUserEmail = async (req, res, next) => {
  // ดึง user_email จาก header (สมมติชื่อ header เป็น 'user_email')
  const user_email = req.headers.user_email;

  if (!user_email || typeof user_email !== "string") {
    return res
      .status(401)
      .json({ error: "Missing or invalid user_email in header" });
  }

  try {
    // เรียก GraphQL API ดึงรายชื่อ users
    const data = await request({
      url: GRAPHQL_ENDPOINT,
      document: USERS_QUERY,
      requestHeaders: { Authorization: `Bearer ${TOKEN}` },
    });

    // แปลงข้อมูลให้เป็น array ของ user node
    const users = data?.users?.edges?.map((edge) => edge.node) || [];

    // ตรวจสอบว่ามี user_email นี้ในระบบหรือไม่
    const userExists = users.some((user) => user.user_email === user_email);

    if (!userExists) {
      return res.status(403).json({ error: "Unauthorized user_email" });
    }

    // ถ้าผ่านให้เก็บข้อมูลไว้ใน req เพื่อใช้ใน controller ต่อไป
    req.user_email = user_email;
    req.userAgent = req.headers["user-agent"] || "unknown";
    // ดึง IP address แบบรองรับ proxy ด้วย x-forwarded-for
    req.userIP =
      (req.headers["x-forwarded-for"] || "")
        .split(",")
        .map(ip => ip.trim())
        .find(ip => ip.length > 0) ||
      req.socket.remoteAddress ||
      req.connection?.remoteAddress ||
      "unknown";

    next();
  } catch (err) {
    console.error("❌ Authentication error:", err.message);
    res.status(500).json({ error: "Failed to authenticate user_email" });
  }
};

module.exports = { requireUserEmail };
