/* eslint-disable @typescript-eslint/ban-ts-comment -- legacy untyped props from Vite migration */
// @ts-nocheck — migrated from Vite; props are untyped inline components
"use client";

import { useState, useEffect, useRef } from "react";

const CORAL = "#F26D6D";
const BLUE = "#4C6EF5";
const NAVY = "#0A0D2E";
const CARD = "#0F1340";
const CARD2 = "#141852";
const GREEN = "#22C55E";
const AMBER = "#F59E0B";
const MUTED = "#8892b0";
const BORDER = "rgba(76,110,245,0.18)";

function useCountdown() {
  const target = new Date("2026-06-06T09:00:00Z").getTime();
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setTime({ d: Math.floor(diff/86400000), h: Math.floor((diff%86400000)/3600000), m: Math.floor((diff%3600000)/60000), s: Math.floor((diff%60000)/1000) });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return time;
}

function CountdownBox({ val, label }) {
  return (
    <div style={{ textAlign: "center", minWidth: 60 }}>
      <div style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 16px", fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: -1, marginBottom: 6 }}>
        {String(val).padStart(2, "0")}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
    </div>
  );
}

// ── Brand SVG Icons ──
function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" stroke={BLUE} strokeWidth="1.8" fill={`${BLUE}22`}/>
      <path d="M9 12l2 2 4-4" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconBolt() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke={CORAL} strokeWidth="1.8" fill={`${CORAL}22`} strokeLinejoin="round"/>
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="12" width="4" height="9" rx="1" fill={`${GREEN}33`} stroke={GREEN} strokeWidth="1.5"/>
      <rect x="10" y="7" width="4" height="14" rx="1" fill={`${GREEN}33`} stroke={GREEN} strokeWidth="1.5"/>
      <rect x="17" y="3" width="4" height="18" rx="1" fill={`${GREEN}33`} stroke={GREEN} strokeWidth="1.5"/>
    </svg>
  );
}
function IconCalc() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="2" width="16" height="20" rx="3" stroke={BLUE} strokeWidth="1.8" fill={`${BLUE}15`}/>
      <rect x="7" y="5" width="10" height="4" rx="1" fill={`${BLUE}44`}/>
      <circle cx="8" cy="14" r="1.2" fill={BLUE}/><circle cx="12" cy="14" r="1.2" fill={BLUE}/><circle cx="16" cy="14" r="1.2" fill={BLUE}/>
      <circle cx="8" cy="18" r="1.2" fill={BLUE}/><circle cx="12" cy="18" r="1.2" fill={BLUE}/><circle cx="16" cy="18" r="1.2" fill={CORAL}/>
    </svg>
  );
}
function IconVerify() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke={CORAL} strokeWidth="1.8" fill={`${CORAL}15`}/>
      <path d="M16.5 16.5L21 21" stroke={CORAL} strokeWidth="2" strokeLinecap="round"/>
      <path d="M8.5 11l2 2 3-3" stroke={CORAL} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconBriefing() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke={CORAL} strokeWidth="1.8" fill={`${CORAL}15`}/>
      <path d="M7 9h10M7 13h7" stroke={CORAL} strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="17" cy="7" r="3" fill={GREEN} stroke={NAVY} strokeWidth="1.5"/>
    </svg>
  );
}

function ChatMockup() {
  const msgs = [
    { u: true, t: "Is Pepperstone safe?" },
    { u: false, t: "Pepperstone ✓ LEGITIMATE — Trust Score 8.9", green: true },
    { u: true, t: "Brief me on Gold before London open" },
    { u: false, t: "Gold 3,124 ▲ 0.72% — NFP in 89 mins ⚠️", blue: true },
    { u: true, t: "What lot size on 1% risk £10k account?" },
    { u: false, t: "0.25 lots — risking exactly £100.00" },
    { u: false, warn: true, t: "⚠️ WARNING — Trust Score 1.4 ~ Avoid" },
  ];
  return (
    <div style={{ background: NAVY, border: `1px solid ${BORDER}`, borderRadius: 20, overflow: "hidden", boxShadow: `0 0 60px rgba(76,110,245,0.2), 0 0 120px rgba(76,110,245,0.08)`, maxWidth: 420, width: "100%" }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative", width: 26, height: 26, flexShrink: 0 }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `conic-gradient(from 200deg,${BLUE},#6B21A8,#BE185D,${BLUE})` }} />
          <div style={{ position: "absolute", inset: 2, borderRadius: "50%", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 7, fontWeight: 900, color: "#fff" }}>v</span>
          </div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>verify<span style={{ color: CORAL }}>.</span>trading</span>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: CORAL, marginLeft: "auto", boxShadow: `0 0 8px ${CORAL}` }} />
      </div>
      <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.u ? "flex-end" : "flex-start" }}>
            <div style={{ padding: "9px 14px", borderRadius: m.u ? "16px 16px 4px 16px" : "4px 16px 16px 16px", fontSize: 13, fontWeight: m.u ? 500 : 600, maxWidth: "85%", background: m.u ? CORAL : m.warn ? "rgba(242,109,109,0.12)" : "rgba(255,255,255,0.06)", color: m.u ? "#fff" : m.green ? GREEN : m.blue ? BLUE : m.warn ? CORAL : "#e2e8f0", border: m.warn ? `1px solid rgba(242,109,109,0.3)` : m.u ? "none" : `1px solid ${BORDER}` }}>{m.t}</div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 4, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "10px 14px" }}>
          <span style={{ flex: 1, fontSize: 12, color: MUTED }}>Ask anything about any broker, market or trade...</span>
          <div style={{ background: CORAL, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, sub, detail, color }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${color}33`, borderRadius: 18, padding: "24px 22px", flex: 1, minWidth: 220 }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: `${color}15`, border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginBottom: 12 }}>{sub}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color, background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 8, padding: "7px 12px", display: "inline-block" }}>{detail}</div>
    </div>
  );
}

function SignupForm({ label }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.includes("@")) return;
    setLoading(true);
    try {
      await fetch("https://formspree.io/f/xbdpjken", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ email }),
      });
      setDone(true);
    } catch {
      setDone(true);
    }
    setLoading(false);
  };

  return done ? (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ width: 50, height: 50, borderRadius: "50%", background: `${GREEN}20`, border: `1px solid ${GREEN}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: GREEN }}>{"You're on the list."}</div>
      <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{"We'll DM you personally on launch day."}</div>
    </div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 420 }}>
      <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="Your email address"
        style={{ background: "rgba(255,255,255,0.05)", border: `2px solid ${BORDER}`, borderRadius: 14, padding: "16px 20px", color: "#fff", fontSize: 15, fontFamily: "inherit", outline: "none", width: "100%", transition: "border-color .2s" }}
        onFocus={e => e.target.style.borderColor = CORAL}
        onBlur={e => e.target.style.borderColor = BORDER}
      />
      <button onClick={submit} disabled={loading}
        style={{ background: loading ? "#c45555" : CORAL, color: "#fff", border: "none", borderRadius: 14, padding: "16px 24px", fontSize: 16, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: "inherit", boxShadow: `0 8px 32px rgba(242,109,109,0.35)` }}>
        {loading ? "Joining..." : (label || "Join Free — Launching 6.6.26")}
        {!loading && <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M5 12h14M13 6l6 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
      </button>
      <div style={{ textAlign: "center", fontSize: 12, color: MUTED }}>Free forever for early members &nbsp;·&nbsp; No credit card &nbsp;·&nbsp; No catch</div>
    </div>
  );
}

// ── DEMO PAGE ──
function Logo({ size = "nav" }) {
  const big = size === "big";
  const rs = big ? 90 : 36;
  return (
    <div style={{ display: "flex", flexDirection: big ? "column" : "row", alignItems: "center", gap: big ? 12 : 10 }}>
      <div style={{ position: "relative", width: rs, height: rs, flexShrink: 0 }}>
        <div style={{ position: "absolute", inset: -5, borderRadius: "50%", background: `conic-gradient(from 200deg,${BLUE},#6B21A8,#BE185D,${BLUE})`, filter: "blur(8px)", opacity: 0.45 }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `conic-gradient(from 200deg,${BLUE},#6B21A8,#BE185D,${BLUE})` }} />
        <div style={{ position: "absolute", inset: 3, borderRadius: "50%", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {big
            ? <div style={{ textAlign: "center", lineHeight: 1.2 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: -1 }}>verify<span style={{ color: CORAL }}>.</span></div>
                <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: -1 }}>trading</div>
              </div>
            : <span style={{ fontSize: 11, fontWeight: 900, color: "#fff" }}>v</span>}
        </div>
      </div>
      {!big && <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>verify<span style={{ color: CORAL }}>.</span>trading</span>}
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "13px 17px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: "4px 18px 18px 18px", width: "fit-content" }}>
      {[0, 200, 400].map(d => <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: MUTED, animation: `bounce 1.2s ${d}ms infinite` }} />)}
    </div>
  );
}

function BrokerCard({ name, score, status, fca, complaints, verdict, color }) {
  const legit = color === "green";
  const sc = legit ? GREEN : CORAL;
  const pct = (parseFloat(score) / 10) * 100;
  return (
    <div style={{ background: CARD, border: `1px solid ${legit ? "rgba(34,197,94,0.3)" : "rgba(242,109,109,0.3)"}`, borderRadius: "4px 18px 18px 18px", overflow: "hidden", maxWidth: 360 }}>
      <div style={{ padding: "10px 16px", background: legit ? "rgba(34,197,94,0.08)" : "rgba(242,109,109,0.08)", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, textTransform: "uppercase", letterSpacing: ".8px" }}>🔍 Broker Check</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: sc }}>{status}</div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 12 }}>{name}</div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: MUTED }}>Trust Score</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: sc }}>{score} / 10</div>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: sc, borderRadius: 3, transition: "width 1s ease" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, background: CARD2, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>FCA</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: fca === "Yes" ? GREEN : CORAL }}>{fca === "Yes" ? "✓ Authorised" : "✗ Not registered"}</div>
          </div>
          <div style={{ flex: 1, background: CARD2, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>Complaints</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: complaints === "Low" ? GREEN : complaints === "Medium" ? AMBER : CORAL }}>{complaints}</div>
          </div>
        </div>
        <div style={{ background: `${sc}15`, border: `1px solid ${sc}33`, borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, color: sc }}>
          {legit ? "✓" : "⚠️"} {verdict}
        </div>
      </div>
    </div>
  );
}

function BriefingCard({ asset, price, change, direction, level1, level2, event, verdict }) {
  const up = direction === "up";
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "4px 18px 18px 18px", overflow: "hidden", maxWidth: 360 }}>
      <div style={{ padding: "10px 16px", background: "rgba(76,110,245,0.1)", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, textTransform: "uppercase", letterSpacing: ".8px" }}>📊 Market Briefing</div>
        <div style={{ fontSize: 11, color: GREEN, fontWeight: 600 }}>● Live</div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: MUTED }}>{asset}</div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1 }}>{price}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: up ? GREEN : CORAL }}>{up ? "▲" : "▼"} {change}</div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, background: CARD2, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>Resistance</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: CORAL }}>{level1}</div>
          </div>
          <div style={{ flex: 1, background: CARD2, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>Support</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{level2}</div>
          </div>
        </div>
        {event && <div style={{ background: "rgba(242,109,109,0.08)", border: "1px solid rgba(242,109,109,0.2)", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: CORAL, marginBottom: 12 }}>⚠️ {event}</div>}
        <div style={{ background: "rgba(76,110,245,0.08)", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, color: BLUE }}>→ {verdict}</div>
      </div>
    </div>
  );
}

function CalcCard({ lots, risk_amount, account, risk_pct, sl_pips }) {
  return (
    <div style={{ background: CARD, border: `1px solid rgba(76,110,245,0.3)`, borderRadius: "4px 18px 18px 18px", overflow: "hidden", maxWidth: 360 }}>
      <div style={{ padding: "10px 16px", background: "rgba(76,110,245,0.1)", borderBottom: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 700, color: BLUE, textTransform: "uppercase", letterSpacing: ".8px" }}>🧮 Position Size</div>
      <div style={{ padding: 16 }}>
        <div style={{ background: CORAL, borderRadius: 12, padding: 18, textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 42, fontWeight: 900, color: "#fff", letterSpacing: -2 }}>{lots}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>lots</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[["Account", account], ["Risk", risk_pct], ["SL", `${sl_pips} pips`]].map(([l, v]) => (
            <div key={l} style={{ background: CARD2, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: MUTED, marginBottom: 3, textTransform: "uppercase" }}>{l}</div>
              <div style={{ fontSize: 11, fontWeight: 700 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, color: GREEN }}>✓ Risking exactly {risk_amount}</div>
      </div>
    </div>
  );
}

function GuruCard({ name, score, status, verdict }) {
  const sc = CORAL;
  const pct = (parseFloat(score) / 10) * 100;
  return (
    <div style={{ background: CARD, border: "1px solid rgba(242,109,109,0.3)", borderRadius: "4px 18px 18px 18px", overflow: "hidden", maxWidth: 360 }}>
      <div style={{ padding: "10px 16px", background: "rgba(242,109,109,0.08)", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, textTransform: "uppercase", letterSpacing: ".8px" }}>⚠️ Guru Check</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: CORAL }}>{status}</div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>{name}</div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: MUTED }}>Trust Score</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: sc }}>{score} / 10</div>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: sc, borderRadius: 3 }} />
          </div>
        </div>
        <div style={{ background: CARD2, borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: MUTED }}>Verified track record</span>
          <span style={{ fontWeight: 700, color: CORAL }}>✗ None</span>
        </div>
        <div style={{ background: "rgba(242,109,109,0.12)", border: "1px solid rgba(242,109,109,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, color: CORAL }}>⚠️ {verdict}</div>
      </div>
    </div>
  );
}

function InsightCard({ headline, body, verdict }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "4px 18px 18px 18px", overflow: "hidden", maxWidth: 360 }}>
      <div style={{ padding: "10px 16px", background: "rgba(76,110,245,0.1)", borderBottom: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 700, color: BLUE, textTransform: "uppercase", letterSpacing: ".8px" }}>💡 Trading Intelligence</div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 10, lineHeight: 1.3 }}>{headline}</div>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: "#c8d0e7", marginBottom: 14 }}>{body}</div>
        <div style={{ background: "rgba(76,110,245,0.08)", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, color: BLUE }}>→ {verdict}</div>
      </div>
    </div>
  );
}

// ── SMART RESPONSE ENGINE ──
function getResponse(q) {
  const lq = q.toLowerCase();

  // ── BROKERS — LEGITIMATE ──
  if (lq.includes("ftmo")) return { type: "broker", name: "FTMO", score: "9.1", status: "LEGITIMATE", fca: "Yes", complaints: "Low", verdict: "One of the most trusted prop firms globally. Safe to deposit.", color: "green" };
  if (lq.includes("exness")) return { type: "broker", name: "Exness", score: "8.4", status: "LEGITIMATE", fca: "Yes", complaints: "Low", verdict: "FCA authorised. Clean withdrawal record. Safe to deposit.", color: "green" };
  if (lq.includes("pepperstone")) return { type: "broker", name: "Pepperstone", score: "8.9", status: "LEGITIMATE", fca: "Yes", complaints: "Low", verdict: "Top tier broker. FCA regulated. Highly recommended.", color: "green" };
  if (lq.includes("ic market")) return { type: "broker", name: "IC Markets", score: "8.7", status: "LEGITIMATE", fca: "Yes", complaints: "Low", verdict: "Highly regulated. Strong global reputation. Safe.", color: "green" };
  if (lq.includes("etoro")) return { type: "broker", name: "eToro", score: "8.2", status: "LEGITIMATE", fca: "Yes", complaints: "Medium", verdict: "FCA regulated. Large platform. Some spread complaints but safe.", color: "green" };
  if (lq.includes("trading212") || lq.includes("trading 212")) return { type: "broker", name: "Trading212", score: "8.0", status: "LEGITIMATE", fca: "Yes", complaints: "Low", verdict: "FCA authorised. Popular UK broker. Safe to use.", color: "green" };
  if (lq.includes("plus500")) return { type: "broker", name: "Plus500", score: "7.8", status: "LEGITIMATE", fca: "Yes", complaints: "Medium", verdict: "FCA regulated. Listed on LSE. High spreads but legitimate.", color: "green" };
  if (lq.includes("cmc market")) return { type: "broker", name: "CMC Markets", score: "8.5", status: "LEGITIMATE", fca: "Yes", complaints: "Low", verdict: "FCA authorised since 1989. One of the most established UK brokers.", color: "green" };
  if (lq.includes("ig group") || lq.includes("ig broker")) return { type: "broker", name: "IG Group", score: "8.8", status: "LEGITIMATE", fca: "Yes", complaints: "Low", verdict: "FCA regulated. FTSE 250 company. Highly trusted.", color: "green" };
  if (lq.includes("blackbull")) return { type: "broker", name: "BlackBull Markets", score: "7.9", status: "LEGITIMATE", fca: "Yes", complaints: "Low", verdict: "Regulated. Good execution. Safe to deposit.", color: "green" };
  if (lq.includes("hantec")) return { type: "broker", name: "Hantec Markets", score: "8.1", status: "LEGITIMATE", fca: "Yes", complaints: "Low", verdict: "FCA regulated UK broker. Clean record. Safe.", color: "green" };
  if (lq.includes("tickmill")) return { type: "broker", name: "Tickmill", score: "8.3", status: "LEGITIMATE", fca: "Yes", complaints: "Low", verdict: "FCA regulated. Competitive spreads. Trusted.", color: "green" };

  // ── PROP FIRMS — LEGITIMATE ──
  if (lq.includes("the5er") || lq.includes("5ers")) return { type: "broker", name: "The5ers", score: "8.6", status: "LEGITIMATE", fca: "No", complaints: "Low", verdict: "Not FCA but well established. Consistent payouts confirmed.", color: "green" };
  if (lq.includes("funded trader")) return { type: "broker", name: "The Funded Trader", score: "6.8", status: "WARNING", fca: "No", complaints: "Medium", verdict: "Payout complaints reported. Proceed with caution. Verify terms.", color: "red" };
  if (lq.includes("myforexfunds") || lq.includes("mff")) return { type: "broker", name: "MyForexFunds", score: "1.0", status: "AVOID", fca: "No", complaints: "High", verdict: "Shut down by regulators. Do not deposit. Funds at risk.", color: "red" };

  // ── BROKERS — WARNING ──
  if (lq.includes("vortex")) return { type: "broker", name: "Vortex FX", score: "1.8", status: "WARNING", fca: "No", complaints: "High", verdict: "Multiple payout denials reported. Offshore entity. Avoid.", color: "red" };
  if (lq.includes("switzyman") || lq.includes("switzy")) return { type: "broker", name: "SwitzyMan", score: "1.2", status: "AVOID", fca: "No", complaints: "High", verdict: "FCA warning issued October 2024. Unauthorised firm. Do not engage.", color: "red" };
  if (lq.includes("primecfd") || lq.includes("prime cfd")) return { type: "broker", name: "PrimeCFDs", score: "1.1", status: "AVOID", fca: "No", complaints: "High", verdict: "FCA blacklisted. Targets UK traders. Do not deposit.", color: "red" };
  if (lq.includes("broker") || lq.includes("deposit") || lq.includes("safe") || lq.includes("legit") || lq.includes("trust") || lq.includes("regulated")) return { type: "broker", name: "Unverified Broker", score: "2.1", status: "WARNING", fca: "No", complaints: "High", verdict: "Not FCA registered. Offshore entity. Do not deposit.", color: "red" };

  // ── MARKETS ──
  if (lq.includes("gold") || lq.includes("xau")) return { type: "briefing", asset: "GOLD / XAUUSD", price: "4,493.20", change: "1.1%", direction: "up", level1: "4,550", level2: "4,150", event: "NFP this week — HIGH IMPACT. Reduce size now.", verdict: "Bullish bias above 4,150. Wait for NFP close before entry." };
  if (lq.includes("bitcoin") || lq.includes("btc")) return { type: "briefing", asset: "BITCOIN / USD", price: "66,194", change: "3.3%", direction: "down", level1: "68,500", level2: "63,000", event: "Quarterly options expiry — HIGH VOLATILITY", verdict: "Bearish pressure. Wait for 63,000 support hold before long." };
  if (lq.includes("oil") || lq.includes("wti") || lq.includes("crude")) return { type: "briefing", asset: "OIL / WTI", price: "99.64", change: "5.46%", direction: "up", level1: "103.00", level2: "96.00", event: "Strait of Hormuz tensions — EXTREME VOLATILITY", verdict: "Bullish momentum. Reduce size — geopolitical risk elevated." };
  if (lq.includes("gbp") || lq.includes("pound") || lq.includes("cable")) return { type: "briefing", asset: "GBP/USD", price: "1.2940", change: "0.18%", direction: "down", level1: "1.3000", level2: "1.2870", event: null, verdict: "Range bound. Wait for 1.3000 rejection or 1.2870 support hold." };
  if (lq.includes("eur")) return { type: "briefing", asset: "EUR/USD", price: "1.1510", change: "0.25%", direction: "down", level1: "1.1600", level2: "1.1420", event: null, verdict: "Dollar strength weighing. Short bias below 1.1510." };
  if (lq.includes("nasdaq") || lq.includes("nas") || lq.includes("tech")) return { type: "briefing", asset: "NASDAQ / NAS100", price: "20,948", change: "2.15%", direction: "down", level1: "21,500", level2: "20,200", event: "Fed Chair speech 15:00 GMT — HIGH IMPACT", verdict: "In correction territory. Caution on longs until Fed clarity." };
  if (lq.includes("dow") || lq.includes("us30")) return { type: "briefing", asset: "DOW JONES / US30", price: "45,166", change: "1.73%", direction: "down", level1: "46,000", level2: "44,500", event: "NFP data this week — HIGH IMPACT", verdict: "Entered correction. Reduce exposure before NFP." };
  if (lq.includes("ethereum") || lq.includes("eth")) return { type: "briefing", asset: "ETHEREUM / USD", price: "1,996", change: "2.2%", direction: "down", level1: "2,100", level2: "1,900", event: null, verdict: "Below key 2,000 level. Bearish below this. Watch 1,900 support." };

  // ── POSITION SIZING ──
  if (lq.includes("lot") || lq.includes("size") || lq.includes("position") || lq.includes("how much") || lq.includes("pip value")) {
    return { type: "calc", lots: "0.25", risk_amount: "£100.00", account: "£10,000", risk_pct: "1%", sl_pips: "20", verdict: "Risk controlled. Never exceed 1-2% per trade." };
  }
  if (lq.includes("risk") || lq.includes("1%") || lq.includes("2%")) {
    return { type: "calc", lots: "0.50", risk_amount: "£200.00", account: "£10,000", risk_pct: "2%", sl_pips: "20", verdict: "2% risk. Maximum recommended for most traders." };
  }

  // ── MORNING BRIEFINGS ──
  if (lq.includes("morning") || lq.includes("brief") || lq.includes("session") || lq.includes("today") || lq.includes("london open") || lq.includes("news")) {
    return { type: "briefing", asset: "GOLD / XAUUSD", price: "4,493.20", change: "1.1%", direction: "up", level1: "4,550", level2: "4,150", event: "NFP this week — HIGH IMPACT. Reduce size now.", verdict: "Reduce exposure before NFP. Re-enter after candle close." };
  }

  // ── GURUS AND SIGNALS ──
  if (lq.includes("switzyman") || lq.includes("switzy")) return { type: "guru", name: "SwitzyMan", score: "1.2", status: "AVOID", verified: "No", verdict: "FCA warning issued October 2024. Unauthorised. Do not follow." };
  if (lq.includes("guru") || lq.includes("signal") || lq.includes("course") || lq.includes("influencer") || lq.includes("telegram group")) return { type: "guru", name: "Trading Influencer", score: "1.4", status: "AVOID", verified: "No", verdict: "No verified track record. Company registered 18 days ago. Avoid." };
  if (lq.includes("scam") || lq.includes("fake") || lq.includes("paid promotion") || lq.includes("trust")) return { type: "guru", name: "Unverified Account", score: "1.6", status: "WARNING", verified: "No", verdict: "No verified P&L. Possible paid broker promotion. Research first." };

  // ── PROP FIRM INSIGHTS ──
  if (lq.includes("prop") || lq.includes("funded") || lq.includes("challenge") || lq.includes("payout")) return { type: "insight", headline: "Prop Firm Truth", body: "Most traders fail prop challenges from overtrading not bad strategy. The rules filter emotional decisions. 76% of traders who fail do so in the first week.", verdict: "Trade minimum size. Consistency beats big days every time." };

  // ── PSYCHOLOGY ──
  if (lq.includes("revenge") || lq.includes("emotion") || lq.includes("anxiety") || lq.includes("losing") || lq.includes("discipline")) return { type: "insight", headline: "Trading Psychology", body: "Revenge trading is the single biggest account killer. After a loss your judgment is compromised for 20-30 minutes. Walk away. The market will be there tomorrow.", verdict: "Log off after 2 consecutive losses. Come back tomorrow." };
  if (lq.includes("stop loss") || lq.includes("stop hunt") || lq.includes("sl")) return { type: "insight", headline: "Stop Loss Placement", body: "Brokers do not manually hunt your stops. Algorithms target liquidity pools where retail stops cluster — typically at round numbers and recent highs and lows.", verdict: "Place stops beyond structure. Never at round numbers." };
  if (lq.includes("overtrad") || lq.includes("too many trades") || lq.includes("frequency")) return { type: "insight", headline: "Overtrading Reality", body: "The broker earns on every trade you open. More trades equals more spread paid. Professional traders average 2-5 quality setups per week not per day.", verdict: "Quality over quantity. Wait for A-grade setups only." };

  // ── MARKET CONCEPTS ──
  if (lq.includes("b-book") || lq.includes("b book") || lq.includes("conflict of interest")) return { type: "insight", headline: "B-Book Reality", body: "Most retail brokers B-Book accounts under £10,000. They take the opposite side of your trade. Your loss is their profit. This is legal and disclosed in the small print.", verdict: "Use FCA regulated brokers. Verify before you deposit." };
  if (lq.includes("spread") || lq.includes("commission") || lq.includes("fee")) return { type: "insight", headline: "True Cost of Trading", body: "A 1.5 pip spread on Gold costs you £15 per standard lot round trip. At 10 trades per day that is £150 in fees daily before you make a single penny of profit.", verdict: "Factor spread into your risk before every trade." };
  if (lq.includes("leverage") || lq.includes("margin call")) return { type: "insight", headline: "Leverage Warning", body: "1:500 leverage means a 0.2% move against you wipes your account. Most retail traders use too much leverage. Professional traders rarely exceed 1:10 effective leverage.", verdict: "Use leverage of 1:10 or less. Protect the account first." };

  // ── DEFAULT ──
  return { type: "insight", headline: "Think Like a Trader", body: "The edge in trading is consistency in execution, strict risk management, and the discipline to wait for your setup. Most traders fail not from bad strategy but from bad process.", verdict: "Verify your broker first. Then focus on the process." };
}


function PriceChart({ data, up }) {
  const [tf, setTf] = useState("1W");
  const tfs = ["1D","1W","1M","3M","ALL"];
  const slices = { "1D": 8, "1W": 14, "1M": 22, "3M": Math.floor(data.length * 0.7), "ALL": data.length };
  const pts = data.slice(-slices[tf]);
  const W = 260, H = 80;
  const pad = { t: 8, b: 6, l: 0, r: 0 };
  const iW = W - pad.l - pad.r;
  const iH = H - pad.t - pad.b;
  const vMin = Math.min(...pts), vMax = Math.max(...pts);
  const vRange = vMax - vMin || 1;
  const sx = i => pad.l + (i / (pts.length - 1)) * iW;
  const sy = v => pad.t + iH - ((v - vMin) / vRange) * iH;
  const color = up ? "#22C55E" : "#F26D6D";
  const id = `grad_${up ? "up" : "dn"}`;
  const pathD = pts.map((v, i) => `${i===0?"M":"L"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
  const areaD = pathD + ` L${sx(pts.length-1).toFixed(1)},${(pad.t+iH).toFixed(1)} L${pad.l},${(pad.t+iH).toFixed(1)} Z`;
  const pctChange = (((pts[pts.length-1]-pts[0])/pts[0])*100).toFixed(2);
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: up ? "#22C55E" : "#F26D6D" }}>
          {up ? "▲" : "▼"} {Math.abs(pctChange)}%
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {tfs.map(t => (
            <button key={t} onClick={e => { e.stopPropagation(); setTf(t); }} style={{ padding: "2px 7px", borderRadius: 5, fontSize: 9, fontWeight: tf===t ? 700 : 400, background: tf===t ? color : "rgba(255,255,255,0.05)", color: tf===t ? "#fff" : "#8892b0", border: "none", cursor: "pointer", fontFamily: "inherit" }}>{t}</button>
          ))}
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
            <stop offset="100%" stopColor={color} stopOpacity="0.01"/>
          </linearGradient>
        </defs>
        {[0.25,0.5,0.75].map((v,i) => (
          <line key={i} x1={0} y1={pad.t+iH*v} x2={W} y2={pad.t+iH*v} stroke="rgba(136,146,176,0.07)" strokeWidth={0.5}/>
        ))}
        <path d={areaD} fill={`url(#${id})`}/>
        <path d={pathD} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={sx(pts.length-1)} cy={sy(pts[pts.length-1])} r={2.5} fill={color}/>
      </svg>
    </div>
  );
}

const assets = [
  { n:"GOLD", t:"XAUUSD", p:"4,493.20", c:"+1.1%", up:true, series:[3820,3870,3910,3880,3950,4010,3980,4060,4110,4090,4160,4210,4190,4260,4310,4290,4360,4330,4410,4390,4450,4470,4493] },
  { n:"EUR/USD", t:"EURUSD", p:"1.1510", c:"-0.25%", up:false, series:[1.175,1.172,1.170,1.168,1.171,1.169,1.167,1.165,1.168,1.163,1.161,1.164,1.162,1.160,1.158,1.161,1.159,1.157,1.155,1.158,1.155,1.153,1.151] },
  { n:"GBP/USD", t:"GBPUSD", p:"1.2940", c:"-0.18%", up:false, series:[1.315,1.312,1.310,1.308,1.311,1.309,1.307,1.305,1.308,1.303,1.301,1.304,1.302,1.300,1.298,1.301,1.299,1.297,1.295,1.298,1.296,1.295,1.294] },
  { n:"BITCOIN", t:"BTC/USD", p:"66,194", c:"-3.3%", up:false, series:[90000,87000,84000,82000,80000,83000,81000,78000,76000,74000,72000,70000,73000,71000,69000,71000,69000,67800,67000,68000,66500,66300,66194] },
  { n:"ETHEREUM", t:"ETH/USD", p:"1,996", c:"-2.2%", up:false, series:[2800,2750,2700,2720,2680,2640,2600,2580,2550,2520,2490,2460,2430,2400,2380,2350,2320,2290,2260,2230,2200,2100,1996] },
  { n:"DOW JONES", t:"US30", p:"45,166", c:"-1.73%", up:false, series:[48500,48200,47900,48100,47800,47500,47200,47400,47100,46800,46500,46700,46400,46100,45800,46000,45700,45400,45960,46200,45960,45500,45166] },
  { n:"NASDAQ", t:"NAS100", p:"20,948", c:"-2.15%", up:false, series:[24000,23700,23400,23600,23300,23000,22700,22900,22600,22300,22000,22200,21900,21600,21300,21500,21200,21408,21600,21200,21408,21300,20948] },
  { n:"OIL", t:"WTI", p:"99.64", c:"+5.46%", up:true, series:[62,63,65,64,66,68,67,70,72,71,74,76,75,78,80,79,82,84,83,86,90,94,99.64] },
];

function AIResponse({ data }) {
  if (data.type === "broker") return <BrokerCard {...data} />;
  if (data.type === "briefing") return <BriefingCard {...data} />;
  if (data.type === "calc") return <CalcCard {...data} />;
  if (data.type === "guru") return <GuruCard {...data} />;
  return <InsightCard {...data} />;
}

function DemoPage({ onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [tab, setTab] = useState("ask");
  const [ls, setLs] = useState({ ac: 10000, rk: 1, sl: 20 });
  const [rr, setRr] = useState({ rre: 1.2050, rrs: 1.2020, rrt: 1.2140 });
  const [pv, setPv] = useState({ pvl: 0.1, pvp: 20 });
  const [mg, setMg] = useState({ mgl: 1, mgv: 100, mgp: 1.205 });
  const [pf, setPf] = useState({ pfl: 0.1, pfp: 50 });
  const [cg, setCg] = useState({ cgs: 10000, cgr: 5, cgm: 12 });
  const endRef = useRef(null);
  const lsResult = (ls.ac * ls.rk / 100) / (ls.sl * 10);
  const lsAmt = ls.ac * ls.rk / 100;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  const send = (text) => {
    const t = text || input.trim();
    if (!t || typing) return;
    setInput("");
    setMessages(m => [...m, { role: "user", content: t }]);
    setTyping(true);
    const replyDelayMs = 1700;
    setTimeout(() => {
      setTyping(false);
      setMessages(m => [...m, { role: "ai", data: getResponse(t) }]);
    }, replyDelayMs);
  };

  const suggests = [
    "Is FTMO legitimate?",
    "Brief me on Gold",
    "Is SwitzyMan FCA regulated?",
    "Lot size 1% risk £10k 20 pip SL",
    "Why do I keep revenge trading?",
  ];

  return (
    <div style={{ background: NAVY, color: "#fff", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-6px);opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:${BORDER};border-radius:2px}
        ::placeholder{color:${MUTED}}
        button:hover{opacity:0.9}
      `}</style>

      {/* NAV */}
      <nav style={{ height: 58, background: "rgba(10,13,46,0.97)", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0 }}>
        <Logo />
        <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 4 }}>
          {[["ask", "Ask"], ["markets", "Markets"], ["tools", "Tools"]].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} style={{ padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer", color: tab === id ? "#fff" : MUTED, border: "none", background: tab === id ? CARD : "none", fontFamily: "inherit" }}>{lbl}</button>
          ))}
        </div>
        <button onClick={onBack} style={{ background: CORAL, color: "#fff", border: "none", padding: "8px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Home
        </button>
      </nav>

      {/* ASK */}
      {tab === "ask" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 760, margin: "0 auto", width: "100%", padding: "0 20px", overflow: "hidden" }}>
          {messages.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
              <Logo size="big" />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>verify<span style={{ color: CORAL }}>.</span>trading</div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 5 }}>The AI that thinks like a trader.</div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 560 }}>
                {suggests.map(s => (
                  <button key={s} onClick={() => send(s)} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "11px 16px", fontSize: 13, color: MUTED, cursor: "pointer", fontFamily: "inherit" }}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 0", display: "flex", flexDirection: "column", gap: 14 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", animation: "fadeIn .3s ease" }}>
                  {m.role === "user"
                    ? <div style={{ background: CORAL, color: "#fff", padding: "12px 16px", borderRadius: "18px 18px 4px 18px", maxWidth: 280, fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>{m.content}</div>
                    : <AIResponse data={m.data} />}
                </div>
              ))}
              {typing && <TypingDots />}
              <div ref={endRef} />
            </div>
          )}
          <div style={{ padding: "14px 0 20px", borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 10, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "11px 14px" }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Verify a broker, brief me on Gold, check a guru..." style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontSize: 14, fontFamily: "inherit" }} />
              <button onClick={() => send()} style={{ background: CORAL, border: "none", borderRadius: 10, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
              </button>
            </div>
            <div style={{ textAlign: "center", fontSize: 11, color: MUTED, marginTop: 8 }}>verify.trading AI · Not financial advice · Launching 6.6.26</div>
          </div>
        </div>
      )}

      {/* MARKETS */}
      {tab === "markets" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", maxWidth: 1080, margin: "0 auto", width: "100%" }}>
          <div style={{ background: CORAL, borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 700, textAlign: "center", marginBottom: 18, animation: "pulse 2s infinite" }}>⚠️ NFP IN 89 MINUTES — HIGH IMPACT EVENT</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
            {[["LONDON", true], ["NEW YORK", false], ["ASIA", false]].map(([n, on]) => (
              <div key={n} style={{ padding: "6px 15px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1px solid ${on ? "rgba(34,197,94,0.4)" : BORDER}`, background: on ? "rgba(34,197,94,0.07)" : CARD, color: on ? "#fff" : MUTED, display: "flex", alignItems: "center", gap: 5 }}>
                {on && <span style={{ width: 7, height: 7, borderRadius: "50%", background: GREEN, display: "inline-block", animation: "pulse 1.5s infinite" }} />}{n}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12, marginBottom: 28 }}>
            {assets.map(a => (
              <div key={a.n} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 14px 10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: ".8px" }}>{a.n}</div>
                    <div style={{ fontSize: 9, color: MUTED, marginTop: 1 }}>{a.t}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-.5px" }}>{a.p}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: a.up ? GREEN : CORAL }}>{a.up ? "▲" : "▼"} {a.c}</div>
                  </div>
                </div>
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
                  <PriceChart data={a.series} up={a.up} />
                </div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 10 }}>{"Today's Events"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[["13:30 GMT", "Non Farm Payrolls", "HIGH", CORAL, "rgba(242,109,109,.3)"], ["15:00 GMT", "Fed Chair Speech", "MED", AMBER, "rgba(245,158,11,.3)"], ["17:30 GMT", "Oil Inventories", "LOW", MUTED, "rgba(136,146,176,.2)"]].map(([t, n, im, c, bc]) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "11px 15px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, whiteSpace: "nowrap" }}>{t}</div>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{n}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6, color: c, border: `1px solid ${bc}`, background: bc.replace(",.3)", ",0.1)") }}>{im}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TOOLS */}
      {tab === "tools" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>

            {/* LOT SIZE */}
            <div style={{ background: CARD, border: `1px solid ${BLUE}`, borderRadius: 16, overflow: "hidden", boxShadow: `0 0 20px rgba(76,110,245,.1)`, gridColumn: "1/-1" }}>
              <div style={{ padding: "13px 18px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>🧮 Lot Size Calculator</div>
                <div style={{ background: CORAL, color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 9 }}>Most used</div>
              </div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {[["Account (£)", "ac", 10000], ["Risk %", "rk", 1], ["Stop Loss (pips)", "sl", 20]].map(([lbl, key, def]) => (
                  <div key={key} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".6px" }}>{lbl}</label>
                    <input type="number" defaultValue={def} onChange={e => setLs(l => ({ ...l, [key]: +e.target.value || 0 }))} style={{ background: NAVY, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "inherit", outline: "none", width: "100%" }} />
                  </div>
                ))}
                <div style={{ background: CORAL, borderRadius: 12, padding: "12px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: -1 }}>{lsResult.toFixed(2)}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,.8)", marginTop: 1 }}>£{lsAmt.toLocaleString("en-GB",{minimumFractionDigits:2})} at risk</div>
                </div>
              </div>
            </div>

            {/* RISK REWARD */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "13px 18px", borderBottom: `1px solid ${BORDER}`, fontSize: 14, fontWeight: 700 }}>📈 Risk Reward</div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {[["Entry", "rre", 1.2050], ["Stop Loss", "rrs", 1.2020], ["Take Profit", "rrt", 1.2140]].map(([lbl, key, def]) => (
                  <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".6px" }}>{lbl}</label>
                    <input type="number" defaultValue={def} step="0.0001" onChange={e => setRr(r => ({ ...r, [key]: +e.target.value || 0 }))} style={{ background: NAVY, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%" }} />
                  </div>
                ))}
                <div style={{ background: "rgba(76,110,245,0.08)", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px", textAlign: "center", marginTop: 4 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: BLUE }}>1 : {Math.abs(rr.rre - rr.rrs) > 0 ? (Math.abs(rr.rrt - rr.rre) / Math.abs(rr.rre - rr.rrs)).toFixed(1) : "0.0"}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Risk to Reward Ratio</div>
                </div>
              </div>
            </div>

            {/* PIP VALUE */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "13px 18px", borderBottom: `1px solid ${BORDER}`, fontSize: 14, fontWeight: 700 }}>💹 Pip Value</div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {[["Lot Size", "pvl", 0.1], ["Number of Pips", "pvp", 20]].map(([lbl, key, def]) => (
                  <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".6px" }}>{lbl}</label>
                    <input type="number" defaultValue={def} step="0.01" onChange={e => setPv(v => ({ ...v, [key]: +e.target.value || 0 }))} style={{ background: NAVY, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%" }} />
                  </div>
                ))}
                <div style={{ background: "rgba(76,110,245,0.08)", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px", textAlign: "center", marginTop: 4 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: BLUE }}>£{(pv.pvl * pv.pvp * 10).toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Total Pip Value</div>
                </div>
              </div>
            </div>

            {/* MARGIN */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "13px 18px", borderBottom: `1px solid ${BORDER}`, fontSize: 14, fontWeight: 700 }}>🏦 Margin Calculator</div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {[["Lots", "mgl", 1], ["Leverage 1:X", "mgv", 100], ["Asset Price", "mgp", 1.205]].map(([lbl, key, def]) => (
                  <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".6px" }}>{lbl}</label>
                    <input type="number" defaultValue={def} step="0.0001" onChange={e => setMg(m => ({ ...m, [key]: +e.target.value || 0 }))} style={{ background: NAVY, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%" }} />
                  </div>
                ))}
                <div style={{ background: "rgba(76,110,245,0.08)", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px", textAlign: "center", marginTop: 4 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: BLUE }}>£{Math.round(mg.mgl * 100000 * mg.mgp / mg.mgv).toLocaleString("en-GB")}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Required Margin</div>
                </div>
              </div>
            </div>

            {/* PROFIT */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "13px 18px", borderBottom: `1px solid ${BORDER}`, fontSize: 14, fontWeight: 700 }}>💰 Profit Calculator</div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {[["Lot Size", "pfl", 0.1], ["Pips Gained", "pfp", 50]].map(([lbl, key, def]) => (
                  <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".6px" }}>{lbl}</label>
                    <input type="number" defaultValue={def} step="0.01" onChange={e => setPf(v => ({ ...v, [key]: +e.target.value || 0 }))} style={{ background: NAVY, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%" }} />
                  </div>
                ))}
                <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "12px", textAlign: "center", marginTop: 4 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: GREEN }}>£{(pf.pfl * pf.pfp * 10).toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Estimated Profit</div>
                </div>
              </div>
            </div>

            {/* COMPOUND */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "13px 18px", borderBottom: `1px solid ${BORDER}`, fontSize: 14, fontWeight: 700 }}>📊 Compound Growth</div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {[["Start Balance (£)", "cgs", 10000], ["Monthly % Gain", "cgr", 5], ["Months", "cgm", 12]].map(([lbl, key, def]) => (
                  <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".6px" }}>{lbl}</label>
                    <input type="number" defaultValue={def} step="0.5" onChange={e => setCg(c => ({ ...c, [key]: +e.target.value || 0 }))} style={{ background: NAVY, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%" }} />
                  </div>
                ))}
                <div style={{ background: "rgba(76,110,245,0.08)", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px", textAlign: "center", marginTop: 4 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: BLUE }}>£{Math.round(cg.cgs * Math.pow(1 + cg.cgr/100, cg.cgm)).toLocaleString("en-GB")}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Final Balance after {cg.cgm} months</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}


// ── MAIN APP ──
export default function VerifyTradingApp() {
  const [showDemo, setShowDemo] = useState(false);
  const { d, h, m, s } = useCountdown();

  if (showDemo) return <DemoPage onBack={() => setShowDemo(false)} />;

  return (
    <div style={{ background: NAVY, color: "#fff", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
        ::placeholder{color:${MUTED}}
      `}</style>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(10,13,46,0.9)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${BORDER}` }}>
        <Logo />
        <button onClick={() => setShowDemo(true)} style={{ background: CORAL, color: "#fff", border: "none", padding: "9px 20px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Try our demo</button>
      </nav>

      {/* HERO */}
      <section style={{ paddingTop: 100, paddingBottom: 80, padding: "100px 24px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24, animation: "fadeUp .6s ease both" }}>
          <div style={{ display: "inline-block", background: "rgba(242,109,109,0.1)", border: `1px solid rgba(242,109,109,0.3)`, borderRadius: 20, padding: "8px 18px", fontSize: 13, fontWeight: 600, color: CORAL }}>
            {"Tired of depositing with brokers you can't verify?"}
          </div>
        </div>
        <h1 style={{ textAlign: "center", fontSize: "clamp(36px,6vw,64px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: -2, marginBottom: 20, color: "#fff", animation: "fadeUp .6s .1s ease both", animationFillMode: "both", opacity: 0 }}>
          The ChatGPT<br />built for <span style={{ color: CORAL }}>traders.</span>
        </h1>
        <p style={{ textAlign: "center", fontSize: "clamp(15px,2.5vw,19px)", color: MUTED, maxWidth: 500, margin: "0 auto 40px", lineHeight: 1.6, animation: "fadeUp .6s .2s ease both", animationFillMode: "both", opacity: 0 }}>
          Verify any broker in 2 seconds. Get briefed before the market opens. Calculate your exact risk. Every trade.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 48, animation: "fadeUp .6s .3s ease both", animationFillMode: "both", opacity: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 1, alignSelf: "center" }}>Launching</div>
          {[["D",d],["H",h],["M",m],["S",s]].map(([l,v]) => <CountdownBox key={l} val={v} label={l} />)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, animation: "fadeUp .6s .4s ease both", animationFillMode: "both", opacity: 0 }}>
          <SignupForm />
          <button onClick={() => setShowDemo(true)} style={{ background: "transparent", color: MUTED, border: `1px solid ${BORDER}`, padding: "12px 24px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={MUTED} strokeWidth="1.8"/><path d="M10 8l6 4-6 4V8z" fill={MUTED}/></svg>
            Try the demo first →
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 64, animation: "float 4s ease-in-out infinite" }}>
          <ChatMockup />
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <div style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: "20px 24px", background: "rgba(76,110,245,0.04)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "center", gap: "clamp(24px,6vw,80px)", flexWrap: "wrap" }}>
          {[
            { Icon: IconShield, a: "FCA Verified", b: "Data" },
            { Icon: IconBolt, a: "2 Second", b: "Broker Check" },
            { Icon: IconChart, a: "Live", b: "Market Data" },
            { Icon: IconCalc, a: "6 Professional", b: "Calculators" },
          ].map(({ Icon, a, b }, i) => (
            <div key={i} style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(76,110,245,0.08)", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}><Icon /></div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{a}</div>
              <div style={{ fontSize: 12, color: MUTED }}>{b}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section style={{ padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 900, letterSpacing: -1 }}>ONE QUESTION.<br /><span style={{ color: CORAL }}>EVERY ANSWER.</span></div>
          <div style={{ fontSize: 15, color: MUTED, marginTop: 12 }}>Broker verified. Market briefed. In 2 seconds.</div>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <FeatureCard icon={<IconVerify/>} color={BLUE} title="Verify Any Broker in 2 Seconds." sub="FCA status. Complaint history. Trust score. Full verdict before you deposit." detail="CFI UK — Trust Score 9.1 — LEGITIMATE ✓" />
          <FeatureCard icon={<IconBriefing/>} color={CORAL} title="Daily AI Morning Briefing." sub="Gold price. News events. Key levels. Delivered before the session opens." detail="Gold 4,524 ▲ 0.72% — NFP in 35 mins ⚠️" />
          <FeatureCard icon={<IconCalc/>} color={GREEN} title="6 Professional Calculators." sub="Lot size. Risk reward. Pip value. Exact numbers. Every trade." detail="0.25 lots — Risking exactly £100" />
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section style={{ padding: "20px 24px 80px", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: "32px 28px" }}>
          <div style={{ display: "flex", gap: 2, justifyContent: "center", marginBottom: 20 }}>
            {[...Array(5)].map((_,i) => <svg key={i} width="18" height="18" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={CORAL}/></svg>)}
          </div>
          <div style={{ fontSize: 17, lineHeight: 1.7, color: "#e2e8f0", marginBottom: 20 }}>I deposited £3,000 with a broker that turned out to be a scam. I wish verify.trading existed then. Two seconds and I would have known.</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: `conic-gradient(from 200deg,${BLUE},#6B21A8,#BE185D,${BLUE})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>J</span>
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Jordan Williams</div>
              <div style={{ fontSize: 12, color: MUTED }}>Early access member · Telegram community</div>
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section style={{ padding: "80px 24px 100px", background: "rgba(76,110,245,0.04)", borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <Logo size="big" />
          <div style={{ fontSize: "clamp(28px,4vw,40px)", fontWeight: 900, letterSpacing: -1, lineHeight: 1.1 }}>
            The AI that thinks<br />like a <span style={{ color: CORAL }}>trader.</span>
          </div>
          <div style={{ fontSize: 15, color: MUTED }}>Free to join. Free forever for early members.<br />Launching 6 June 2026.</div>
          <SignupForm label="Join Free Now" />
          <button onClick={() => setShowDemo(true)} style={{ background: "transparent", color: MUTED, border: `1px solid ${BORDER}`, padding: "12px 24px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Try the demo first →</button>
        </div>
      </section>

      <footer style={{ padding: "24px", borderTop: `1px solid ${BORDER}`, textAlign: "center" }}>
        <div style={{ fontSize: 12, color: MUTED }}>© 2026 verify.trading &nbsp;·&nbsp; Built for retail traders &nbsp;·&nbsp; Launching 6.6.26</div>
      </footer>
    </div>
  );
}