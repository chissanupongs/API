ExpressApolloAPI/
├── server/                          # ฝั่ง Express API Server
│   ├── config/                      # config เช่น DB, env, Apollo setup
│   │   ├── apollo.config.js        # กำหนด schema/resolvers สำหรับ Apollo Server
│   │   └── swagger.yaml            # ไฟล์ Swagger API definition
│   ├── controllers/                # Logic การจัดการแต่ละ route
│   │   └── case.controller.js
│   ├── routes/                     # Routing สำหรับ REST API
│   │   └── case.routes.js
│   ├── graphql/                    # GraphQL typeDefs + resolvers
│   │   ├── schema.js
│   │   └── resolvers.js
│   ├── middleware/                 # middleware เช่น error handler, logger
│   ├── utils/                      # ฟังก์ชันช่วยเหลือทั่วไป
│   └── index.js                    # Entry point Express + Swagger + Apollo
├── client/                         # Optional: Apollo Client Frontend (เช่น React)
│   └── src/
├── .env
├── package.json
└── README.md


-----------------------------------------------------------------


| ตำแหน่ง                                 | ทำอะไร                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `server/index.js`                       | ตั้งค่า Express, Swagger UI, Apollo Server, และเชื่อมทุกระบบเข้าด้วยกัน |
| `server/routes/case.routes.js`          | สร้าง REST API เช่น `GET /cases`, `POST /cases`                         |
| `server/controllers/case.controller.js` | จัดการ logic ของ route เช่น ดึง/สร้าง/อัปเดตเคส                         |
| `server/graphql/schema.js`              | สร้าง GraphQL type definitions ด้วย gql (string)                        |
| `server/graphql/resolvers.js`           | เขียน resolver สำหรับ Query และ Mutation                                |
| `server/config/apollo.config.js`        | ตั้งค่าและส่งออก Apollo Server สำหรับใช้งานใน index.js                  |
| `server/config/swagger.yaml`            | เขียน spec ของ Swagger API สำหรับ Swagger UI                            |
| `server/middleware/`                    | เพิ่ม middleware เช่น ตรวจสอบ token, จัดการ error                       |
| `server/utils/`                         | เก็บ helper function เช่น logger, date formatter ฯลฯ                    |
