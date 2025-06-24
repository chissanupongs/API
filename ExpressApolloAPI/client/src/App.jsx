// 📁 App.jsx
import React from "react";
import CaseForm from "./components/CaseForm"; // 👈 นำเข้า component หลัก
import { ToastContainer } from "react-toastify"; // 👈 ตัวแสดงแจ้งเตือน
import "react-toastify/dist/ReactToastify.css"; // 👈 CSS สำหรับ toast

export default function App() {
  return (
    <>
      {/* 📌 แสดงแบบฟอร์มหลักของระบบ */}
      <CaseForm />

      {/* 📢 ตัวจัดการ toast แจ้งเตือนจาก react-toastify */}
      <ToastContainer
        position="top-right"       // 🧭 ตำแหน่งมุมบนขวาของหน้าจอ
        autoClose={3000}           // ⏱️ ปิดอัตโนมัติใน 3 วินาที
        hideProgressBar={false}    // 📊 แสดงแถบเวลา
        newestOnTop={false}        // 🔽 แสดง toast เรียงจากเก่าก่อน
        closeOnClick               // 🖱️ คลิกเพื่อปิดได้
        pauseOnHover               // ⏸️ หยุดนับเวลาถ้าเอาเมาส์ชี้
        draggable                  // 🖐️ ลากเพื่อย้ายหรือปิด toast ได้
        theme="colored"            // 🎨 ใช้ธีมแบบมีสี
      />
    </>
  );
}
