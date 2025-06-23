// 📁 CaseForm.jsx (เวอร์ชันตกแต่ง UI/UX + แก้การแสดงผล INCIDENT & USER)
import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./CaseForm.css"; // 🎨 import ไฟล์ CSS ที่ตกแต่ง UI

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

// 🧹 ฟังก์ชันแปลง input string เป็น array
function parseCSV(input) {
  return input
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export default function CaseForm() {
  // =================== 🔐 LOGIN STATE ===================
  const [loginEmail, setLoginEmail] = useState("");
  const [userEmail, setUserEmail] = useState(localStorage.getItem("user_email") || "");
  const [isLoggedIn, setIsLoggedIn] = useState(!!userEmail);

  // =================== ⚙️ FORM STATE ===================
  const [incidentInput, setIncidentInput] = useState("");
  const [userEmailInput, setUserEmailInput] = useState("");
  const [alertStatus, setAlertStatus] = useState("ไม่เปลี่ยนแปลง");
  const [caseResult, setCaseResult] = useState("ไม่เปลี่ยนแปลง");
  const [reason, setReason] = useState("");
  const [mappedIncidents, setMappedIncidents] = useState([]);
  const [mappedUsers, setMappedUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // =================== 🔓 LOGOUT ===================
  function handleLogout() {
    localStorage.removeItem("user_email");
    setUserEmail("");
    setIsLoggedIn(false);
    toast.info("Logged out successfully");
  }

  // =================== 🔐 LOGIN ===================
  async function handleLogin(e) {
    e.preventDefault();
    if (!loginEmail.trim()) return toast.error("Enter your email");
    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_email: loginEmail.trim() }),
      });

      if (!res.ok) throw new Error((await res.json()).error || "Login failed");

      localStorage.setItem("user_email", loginEmail.trim());
      setUserEmail(loginEmail.trim());
      setIsLoggedIn(true);
      toast.success("Login successful");
    } catch (err) {
      toast.error(err.message);
    }
  }

  // =================== 🔍 INCIDENT LOOKUP ===================
  useEffect(() => {
    if (!isLoggedIn) return;
    const ids = parseCSV(incidentInput);
    if (ids.length === 0) return setMappedIncidents([]);

    setLoading(true);
    fetch(`${API_BASE_URL}/lookup/incidents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        user_email: userEmail,
      },
      body: JSON.stringify({ incident_ids: ids }),
    })
      .then((res) => res.json())
      .then((data) => setMappedIncidents(data.incidents || []))
      .catch(() => toast.error("Incident lookup failed"))
      .finally(() => setLoading(false));
  }, [incidentInput, userEmail]);

  // =================== 🔍 USER LOOKUP ===================
  useEffect(() => {
    if (!isLoggedIn) return;
    const emails = parseCSV(userEmailInput);
    if (emails.length === 0) return setMappedUsers([]);

    fetch(`${API_BASE_URL}/lookup/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        user_email: userEmail,
      },
      body: JSON.stringify({ user_emails: emails }),
    })
      .then((res) => res.json())
      .then((data) => setMappedUsers(data.users || []))
      .catch(() => toast.error("User lookup failed"));
  }, [userEmailInput, userEmail]);

  // =================== 🔄 UPDATE ALERT ===================
  async function updateAlertStatusBatch() {
    const payload = mappedIncidents
      .filter((inc) => !inc.error)
      .map(({ id }) => ({ id, alert_status: alertStatus }));

    const res = await fetch(`${API_BASE_URL}/closedAlertStatus`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        user_email: userEmail,
      },
      body: JSON.stringify({ incidents: payload }),
    });
    return res.json();
  }

  // =================== 🔄 UPDATE CASE RESULT ===================
  async function updateCaseResultBatch() {
    const payload = mappedIncidents
      .filter((inc) => !inc.error)
      .map(({ id }) => ({ id, case_result: caseResult, reason }));

    const res = await fetch(`${API_BASE_URL}/updateCaseResult`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        user_email: userEmail,
      },
      body: JSON.stringify({ incidents: payload }),
    });
    return res.json();
  }

  // =================== 🧠 MAIN UPDATE HANDLER ===================
  async function handleUpdate() {
    const valid = mappedIncidents.filter((i) => !i.error);
    if (valid.length === 0) return toast.error("No valid incidents");
    if (alertStatus === "ไม่เปลี่ยนแปลง" && caseResult === "ไม่เปลี่ยนแปลง") {
      return toast.info("Nothing selected to update");
    }
    if (caseResult !== "ไม่เปลี่ยนแปลง" && reason.trim() === "") {
      return toast.error("Reason required for case result");
    }

    try {
      setLoading(true);
      const [aRes, cRes] = await Promise.all([
        alertStatus !== "ไม่เปลี่ยนแปลง" ? updateAlertStatusBatch() : { results: [] },
        caseResult !== "ไม่เปลี่ยนแปลง" ? updateCaseResultBatch() : { results: [] },
      ]);

      [...aRes.results, ...cRes.results].forEach((r) => {
        if (r.error) toast.error(`❌ ${r.id}: ${r.error}`);
        else toast.success(`✅ ${r.id} updated`);
      });
    } catch (err) {
      toast.error("Update failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // =================== 🔓 UNLOCK USERS ===================
  async function handleUnlockUsers() {
    const valid = mappedUsers.filter((u) => !u.error);
    if (valid.length === 0) return toast.error("No valid users");

    try {
      const res = await fetch(`${API_BASE_URL}/accounts/unlock`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          user_email: userEmail,
        },
        body: JSON.stringify({ users: valid }),
      });
      const data = await res.json();

      data.results.forEach((r) => {
        if (r.error) toast.error(`❌ ${r.user_email}: ${r.error}`);
        else toast.success(`✅ Unlocked ${r.user_email}`);
      });
    } catch (err) {
      toast.error("Unlock failed: " + err.message);
    }
  }

  // =================== 🧩 RENDERING ===================
  return (
    <div className="centered-container">
      {!isLoggedIn ? (
        <div className="card">
          <h2>🔐 Login</h2>
          <form onSubmit={handleLogin}>
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="username"
            />
            <button type="submit">Login</button>
          </form>
        </div>
      ) : (
        <div className="main-container">
          <header className="header">
            <h2>🛠️ Manage Incidents</h2>
            <button onClick={handleLogout} className="logout-button">Logout</button>
          </header>

          {/* 🔍 INCIDENT LOOKUP UI */}
          <section>
            <label>Incident IDs (comma separated)</label>
            <input
              type="text"
              value={incidentInput}
              onChange={(e) => setIncidentInput(e.target.value)}
              placeholder="e.g. INC123, INC456"
            />
            <div className="status-list">
              {mappedIncidents.map((i) => (
                <div key={i.id || i.error} className={`status-item ${i.error ? "error" : "success"}`}>
                  {i.error ? (
                    <>
                      <strong>ID:</strong> {i.id} <br />
                      <strong>Error:</strong> {i.error}
                    </>
                  ) : (
                    <>
                      <strong>ID:</strong> {i.id} <br />
                      <strong>Name:</strong> {i.alert_name} <br />
                      <strong>Status:</strong> {i.alert_status} <br />
                      <strong>Result:</strong> {i.case_result} <br />
                      {i.source_ip && <><strong>Source IP:</strong> {i.source_ip} <br /></>}
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ⚙️ FORM SECTION */}
          <section className="grid-2">
            <div>
              <label>Alert Status</label>
              <select value={alertStatus} onChange={(e) => setAlertStatus(e.target.value)}>
                <option>ไม่เปลี่ยนแปลง</option>
                <option>Closed</option>
              </select>
            </div>
            <div>
              <label>Case Result</label>
              <select value={caseResult} onChange={(e) => setCaseResult(e.target.value)}>
                <option>ไม่เปลี่ยนแปลง</option>
                <option>WaitingAnalysis</option>
                <option>TruePositives</option>
                <option>FalsePositives</option>
              </select>
            </div>
          </section>

          {/* ✍️ เหตุผลเมื่อเปลี่ยน Case Result */}
          {caseResult !== "ไม่เปลี่ยนแปลง" && (
            <section>
              <label>Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for case result change"
              />
            </section>
          )}

          <button onClick={handleUpdate} disabled={loading}>
            {loading ? "Updating..." : "Update Selected Incidents"}
          </button>

          <hr />

          {/* 🔓 USER LOOKUP */}
          <section>
            <h3>🔓 Unlock Users</h3>
            <label>User Emails (comma separated)</label>
            <input
              type="text"
              value={userEmailInput}
              onChange={(e) => setUserEmailInput(e.target.value)}
              placeholder="e.g. user1@example.com, user2@example.com"
            />
            <div className="status-list">
              {mappedUsers.map((u) => (
                <div key={u.user_email} className={`status-item ${u.error ? "error" : "success"}`}>
                  {u.error ? (
                    <>
                      <strong>Email:</strong> {u.user_email} <br />
                      <strong>Error:</strong> {u.error}
                    </>
                  ) : (
                    <>
                      <strong>Email:</strong> {u.user_email} <br />
                      <strong>Status:</strong> {u.account_status}
                    </>
                  )}
                </div>
              ))}
            </div>

            <button onClick={handleUnlockUsers} style={{ marginTop: "20px" }}>
              Unlock Users
            </button>
          </section>
        </div>
      )}

      <ToastContainer position="top-center" autoClose={3000} />
    </div>
  );
}
