import React from "react";
import CaseForm from "./components/CaseForm";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function App() {
  return (
    <>
      {/* แสดงฟอร์มจัดการ Incident และ User */}
      <CaseForm />

      {/* ตัวจัดการ toast แจ้งเตือนจาก react-toastify */}
      <ToastContainer
        position="top-right"       // ตำแหน่งมุมบนขวาของหน้าจอ
        autoClose={3000}           // ปิดแจ้งเตือนอัตโนมัติหลัง 3 วินาที
        hideProgressBar={false}    // แสดงแถบสถานะเวลาการแจ้งเตือน
        newestOnTop={false}        // แจ้งเตือนเก่าจะแสดงก่อน
        closeOnClick               // ปิดแจ้งเตือนได้เมื่อคลิก
        pauseOnHover               // หยุดนับเวลา autoClose เมื่อเอาเมาส์ชี้
        draggable                  // ลากเพื่อปิดแจ้งเตือนได้
        theme="colored"            // ธีมสีของ toast
      />
    </>
  );
}
