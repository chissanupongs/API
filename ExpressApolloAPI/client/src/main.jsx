import React from "react";
import ReactDOM from "react-dom/client";
// นำเข้า Component หลัก App
import App from "./App";
// นำเข้า styles ของ react-toastify (จำเป็นสำหรับแสดง toast ให้สวยงาม)
import "react-toastify/dist/ReactToastify.css";


// สร้าง root element สำหรับ render React app ลงใน <div id="root"></div> ใน index.html
const root = ReactDOM.createRoot(document.getElementById("root"));

// render App ภายใน StrictMode เพื่อช่วยตรวจจับปัญหาและพฤติกรรมที่ไม่ปลอดภัยใน React
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

