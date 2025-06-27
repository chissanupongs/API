// 📁 CaseForm.jsx  (2025-06-27)
// --------------------------------------------------------------
// ✅ รองรับ server ที่ใช้ alert_id แทน id + แก้บั๊ก logout toast
// --------------------------------------------------------------
import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./CaseForm.css"; // 🎨 Custom CSS

// 🌐 Base URL จาก .env (fallback localhost)
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

// ⏱️ ระยะเวลา idle (ms) -– ใช้ VITE_IDLE_LOGOUT_MINUTES หรือ 10 นาที
const IDLE_LOGOUT_MS =
  Number(import.meta.env.VITE_IDLE_LOGOUT_MINUTES ?? 10) * 60 * 1000;

// 🧹 utility: แปลง comma-separated string → cleaned array
const parseCSV = (input) =>
  input
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

export default function CaseForm() {
  // ---------- 🔐 AUTH STATE ----------
  const [loginEmail, setLoginEmail] = useState("");
  const [userEmail, setUserEmail] = useState(""); // → header `user_email`
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // ---------- ⚙️ FORM STATE ----------
  const [alertInput, setAlertInput] = useState(""); // 👉 เปลี่ยนชื่อจาก incidentInput
  const [userEmailInput, setUserEmailInput] = useState("");
  const [alertStatus, setAlertStatus] = useState("ไม่เปลี่ยนแปลง");
  const [caseResult, setCaseResult] = useState("ไม่เปลี่ยนแปลง");
  const [reason, setReason] = useState("");
  const [mappedIncidents, setMappedIncidents] = useState([]);
  const [mappedUsers, setMappedUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🔄 trigger re-lookup หลังอัปเดต
  const [incidentRefreshCounter, setIncidentRefreshCounter] = useState(0);
  const [userRefreshCounter, setUserRefreshCounter] = useState(0);

  // ⏳ auto-logout timer ref
  const logoutTimerRef = useRef(null);

  // --------------------------------------------------------------
  // 🕒 (helper) reset idle timer
  // --------------------------------------------------------------
  const resetLogoutTimer = () => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    logoutTimerRef.current = setTimeout(() => {
      handleLogout();
      toast.info(
        `Logged out due to inactivity (${IDLE_LOGOUT_MS / 60000} minutes)`
      );
    }, IDLE_LOGOUT_MS);
  };

  // ⏮️ เคลียร์ข้อมูลเดิมทุกครั้งที่ refresh page
  useEffect(() => {
    localStorage.removeItem("user_email");
  }, []);

  // --------------------------------------------------------------
  // 🔓 LOGOUT handler
  // --------------------------------------------------------------
  const handleLogout = () => {
    localStorage.removeItem("user_email");
    setUserEmail("");
    setIsLoggedIn(false);
    setLoginEmail("");
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    toast.info("Logged out successfully");
  };

  // --------------------------------------------------------------
  // 🔐 LOGIN handler
  // --------------------------------------------------------------
  const handleLogin = async (e) => {
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
  };

  // --------------------------------------------------------------
  // 👀 attach activity listeners เมื่อ login
  // --------------------------------------------------------------
  useEffect(() => {
    if (!isLoggedIn) {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      return;
    }

    resetLogoutTimer();
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    const activityHandler = () => resetLogoutTimer();
    events.forEach((ev) => window.addEventListener(ev, activityHandler));

    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, activityHandler));
    };
  }, [isLoggedIn]);

  // --------------------------------------------------------------
  // 🔍 INCIDENT LOOKUP  (ใช้ alert_id)
  // --------------------------------------------------------------
  useEffect(() => {
    if (!isLoggedIn) return;

    const alertIds = parseCSV(alertInput);
    if (alertIds.length === 0) return setMappedIncidents([]);

    setLoading(true);
    fetch(`${API_BASE_URL}/lookup/incidents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        user_email: userEmail,
      },
      body: JSON.stringify({ alert_ids: alertIds }), // 🔄 เปลี่ยนชื่อ field
    })
      .then((res) => res.json())
      .then((data) => setMappedIncidents(data.incidents || []))
      .catch(() => toast.error("Incident lookup failed"))
      .finally(() => setLoading(false));
  }, [alertInput, userEmail, incidentRefreshCounter]);

  // --------------------------------------------------------------
  // 🔍 USER LOOKUP
  // --------------------------------------------------------------
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
  }, [userEmailInput, userEmail, userRefreshCounter]);

  // ✅ ลบ email จาก localStorage เมื่อ refresh / close
  useEffect(() => {
    const handleBeforeUnload = () => localStorage.removeItem("user_email");
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // --------------------------------------------------------------
  // 🛠️ UPDATE ALERT STATUS (batch)  – ใช้ alert_id
  // --------------------------------------------------------------
  const updateAlertStatusBatch = async () => {
    const payload = mappedIncidents
      .filter((inc) => !inc.error)
      .map(({ alert_id }) => ({ alert_id, alert_status: alertStatus }));

    const res = await fetch(`${API_BASE_URL}/closedAlertStatus`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        user_email: userEmail,
      },
      body: JSON.stringify({ incidents: payload }),
    });
    return res.json();
  };

  // --------------------------------------------------------------
  // 🛠️ UPDATE CASE RESULT (batch)  – ใช้ alert_id
  // --------------------------------------------------------------
  const updateCaseResultBatch = async () => {
    const payload = mappedIncidents
      .filter((inc) => !inc.error)
      .map(({ alert_id }) => ({ alert_id, case_result: caseResult, reason }));

    const res = await fetch(`${API_BASE_URL}/updateCaseResult`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        user_email: userEmail,
      },
      body: JSON.stringify({ incidents: payload }),
    });
    return res.json();
  };

  // --------------------------------------------------------------
  // 🧠 MAIN UPDATE HANDLER
  // --------------------------------------------------------------
  const handleUpdate = async () => {
    const valid = mappedIncidents.filter((i) => !i.error);
    if (valid.length === 0) return toast.error("No valid incidents");
    if (alertStatus === "ไม่เปลี่ยนแปลง" && caseResult === "ไม่เปลี่ยนแปลง")
      return toast.info("Nothing selected to update");
    if (caseResult !== "ไม่เปลี่ยนแปลง" && reason.trim() === "")
      return toast.error("Reason required for case result");

    try {
      setLoading(true);
      const [aRes, cRes] = await Promise.all([
        alertStatus !== "ไม่เปลี่ยนแปลง"
          ? updateAlertStatusBatch()
          : { results: [] },
        caseResult !== "ไม่เปลี่ยนแปลง"
          ? updateCaseResultBatch()
          : { results: [] },
      ]);

      [...aRes.results, ...cRes.results].forEach((r) => {
        if (r.error)
          toast.error(`❌ ${r.alert_id}: ${r.error}`); // 🔄 alert_id
        else toast.success(`✅ ${r.alert_id} updated`);
      });
    } catch (err) {
      toast.error("Update failed: " + err.message);
    } finally {
      setLoading(false);
      setIncidentRefreshCounter((prev) => prev + 1); // refresh lookup
    }
  };

  // --------------------------------------------------------------
  // 🔓 UNLOCK USERS
  // --------------------------------------------------------------
  const handleUnlockUsers = async () => {
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
    } finally {
      setUserRefreshCounter((prev) => prev + 1);
    }
  };

  // --------------------------------------------------------------
  // 🖼️ UI
  // --------------------------------------------------------------
  return (
    <div className="centered-container">
      {!isLoggedIn ? (
        // ----------------- LOGIN CARD -----------------
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
        // ----------------- MAIN CONTENT -----------------
        <div className="main-container">
          <header className="header">
            <h2>🛠️ Manage Incidents</h2>
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
          </header>

          {/* 🔍 INCIDENT LOOKUP */}
          <section>
            <label>Alert IDs (comma separated)</label>
            <input
              type="text"
              value={alertInput}
              onChange={(e) => setAlertInput(e.target.value)}
              placeholder="e.g. ALERT123, ALERT456"
            />
            <div className="status-list">
              {mappedIncidents.map((i) => (
                <div
                  key={i.alert_id || i.error || Math.random()}
                  className={`status-item ${i.error ? "error" : "success"}`}
                >
                  {i.error ? (
                    <>
                      <strong>Alert ID:</strong> {i.alert_id || "N/A"} <br />
                      <strong>Error:</strong> {i.error}
                    </>
                  ) : (
                    <>
                      <strong>Alert ID:</strong> {i.alert_id} <br />
                      <strong>Name:</strong> {i.alert_name} <br />
                      <strong>Status:</strong> {i.alert_status} <br />
                      <strong>Result:</strong> {i.case_result} <br />
                      {i.source_ip && (
                        <>
                          <strong>Source IP:</strong> {i.source_ip} <br />
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ⚙️ SELECTORS */}
          <section className="grid-2">
            <div>
              <label>Alert Status</label>
              <select
                value={alertStatus}
                onChange={(e) => setAlertStatus(e.target.value)}
              >
                <option>ไม่เปลี่ยนแปลง</option>
                <option>Closed</option>
              </select>
            </div>
            <div>
              <label>Case Result</label>
              <select
                value={caseResult}
                onChange={(e) => setCaseResult(e.target.value)}
              >
                <option>ไม่เปลี่ยนแปลง</option>
                <option>WaitingAnalysis</option>
                <option>TruePositives</option>
                <option>FalsePositives</option>
              </select>
            </div>
          </section>

          {/* ✍️ REASON (when case result changes) */}
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

          {/* 🔄 UPDATE BUTTON */}
          <button onClick={handleUpdate} disabled={loading}>
            {loading ? "Updating..." : "Update Selected Incidents"}
          </button>

          <hr />

          {/* 🔓 USER UNLOCK */}
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
                <div
                  key={u.user_email}
                  className={`status-item ${u.error ? "error" : "success"}`}
                >
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
    </div>
  );
}
