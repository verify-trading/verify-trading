import { useState, useEffect } from "react";

const CORAL = "#F26D6D";
const BLUE = "#4C6EF5";
const NAVY = "#0A0D2E";
const CARD = "#0F1340";
const GREEN = "#22C55E";
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
  }, []);
  return time;
}

// ── REAL LOGO matching the attached image ──
function Logo({ size = "nav" }) {
  const big = size === "big";
  const ringSize = big ? 120 : 38;
  const fontSize = big ? 28 : 13;
  const textSize = big ? 22 : 16;
  return (
    <div style={{ display: "flex", flexDirection: big ? "column" : "row", alignItems: "center", gap: big ? 16 : 10 }}>
      <div style={{ position: "relative", width: ringSize, height: ringSize, flexShrink: 0 }}>
        {/* Outer glow */}
        <div style={{ position: "absolute", inset: -6, borderRadius: "50%", background: `conic-gradient(from 200deg, ${BLUE}, #6B21A8, #BE185D, ${BLUE})`, filter: "blur(10px)", opacity: 0.5 }} />
        {/* Ring */}
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `conic-gradient(from 200deg, ${BLUE}, #6B21A8, #BE185D, ${BLUE})` }} />
        {/* Inner navy fill */}
        <div style={{ position: "absolute", inset: 3, borderRadius: "50%", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          {big ? (
            <div style={{ textAlign: "center", lineHeight: 1.15 }}>
              <div style={{ fontSize: fontSize, fontWeight: 900, color: "#fff", letterSpacing: -1 }}>verify<span style={{ color: CORAL }}>.</span></div>
              <div style={{ fontSize: fontSize, fontWeight: 900, color: "#fff", letterSpacing: -1 }}>trading</div>
            </div>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 900, color: "#fff" }}>v</span>
          )}
        </div>
      </div>
      {!big && <span style={{ fontSize: textSize, fontWeight: 800, color: "#fff", letterSpacing: -0.3 }}>verify<span style={{ color: CORAL }}>.</span>trading</span>}
    </div>
  );
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
      <div style={{ fontSize: 16, fontWeight: 700, color: GREEN }}>You're on the list.</div>
      <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>We'll DM you personally on launch day.</div>
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
function DemoPage({ onBack }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [tab, setTab] = useState("ask");
  const endRef = { current: null };

  const getType = q => {
    if (q.includes("ftmo")||q.includes("prop")||q.includes("funded")) return "legit";
    if (q.includes("broker")||q.includes("deposit")||q.includes("platform")||q.includes("safe")) return "warn";
    if (q.includes("gold")||q.includes("xau")||q.includes("oil")||q.includes("btc")||q.includes("brief")||q.includes("session")) return "gold";
    if (q.includes("guru")||q.includes("signal")||q.includes("scam")||q.includes("legit")||q.includes("course")) return "guru";
    return "gen";
  };

  const send = (txt) => {
    const text = txt || input.trim(); if (!text) return;
    setInput("");
    setMsgs(m => [...m, { role: "user", text }]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs(m => [...m, { role: "ai", type: getType(text.toLowerCase()), text: "The market rewards those who prepare." }]);
    }, 1100);
  };

  const assets = [
    { n:"GOLD", t:"XAUUSD", p:"3,124.50", c:"+0.72%", up:true },
    { n:"EUR/USD", t:"EURUSD", p:"1.0821", c:"-0.14%", up:false },
    { n:"GBP/USD", t:"GBPUSD", p:"1.2650", c:"+0.08%", up:true },
    { n:"BITCOIN", t:"BTC/USD", p:"84,320", c:"+2.3%", up:true },
    { n:"ETHEREUM", t:"ETH/USD", p:"3,210", c:"-0.9%", up:false },
    { n:"DOW JONES", t:"US30", p:"43,150", c:"+0.4%", up:true },
    { n:"NASDAQ", t:"NAS100", p:"18,920", c:"+0.6%", up:true },
    { n:"OIL", t:"WTI", p:"108.78", c:"+1.2%", up:true },
  ];

  const [ls, setLs] = useState({ ac:10000, rk:1, sl:20 });
  const lsResult = (ls.ac * ls.rk / 100) / (ls.sl * 10);
  const lsAmt = ls.ac * ls.rk / 100;

  return (
    <div style={{ background: NAVY, minHeight: "100vh", color: "#fff", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 100, padding: "0 12px", height: 58, display: "flex", alignItems: "center", gap: 8, background: "rgba(10,13,46,0.97)", borderBottom: `1px solid ${BORDER}` }}>
        <button onClick={onBack} style={{ background: CORAL, color: "#fff", border: "none", padding: "8px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Home
        </button>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 4 }}>
            {[["ask","Ask"],["markets","Markets"],["tools","Tools"]].map(([id,lbl]) => (
              <button key={id} onClick={() => setTab(id)} style={{ padding: "7px 12px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer", color: tab===id ? "#fff" : MUTED, border: "none", background: tab===id ? CARD : "none", fontFamily: "inherit" }}>{lbl}</button>
            ))}
          </div>
        </div>
        <Logo />
      </nav>

      {tab === "ask" && (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 58px)", maxWidth: 740, margin: "0 auto", padding: "0 20px" }}>
          {msgs.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
              <Logo size="big" />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>verify<span style={{ color: CORAL }}>.</span>trading</div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 5 }}>The AI that thinks like a trader.</div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                {[["🔍","Verify a broker","Is FTMO legitimate?"],["📊","Brief me on Gold","Brief me on Gold"],["⚠️","Check a guru","Is this guru legit?"]].map(([ic,lbl,q]) => (
                  <button key={lbl} onClick={() => send(q)} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 16px", fontSize: 13, color: MUTED, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
                    <span>{ic}</span><span>{lbl}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 0", display: "flex", flexDirection: "column", gap: 14 }}>
              {msgs.map((m, i) => (
                <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start" }}>
                  {m.role === "user" ? (
                    <div style={{ background: CORAL, color: "#fff", padding: "11px 16px", borderRadius: "18px 18px 4px 18px", maxWidth: 300, fontSize: 14 }}>{m.text}</div>
                  ) : m.type === "legit" ? (
                    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "4px 18px 18px 18px", overflow: "hidden", maxWidth: 360 }}>
                      <div style={{ padding: "10px 16px", background: "rgba(76,110,245,0.1)", borderBottom: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 700, color: BLUE, textTransform: "uppercase", letterSpacing: ".8px" }}>🔍 Broker Verification — FTMO</div>
                      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: 28, fontWeight: 900 }}>9.1 <span style={{ fontSize: 14, color: MUTED, fontWeight: 400 }}>/ 10</span></div>
                        {[["Status","LEGITIMATE ✓",GREEN],["FCA Authorised","Yes",GREEN],["Complaints","Very Low",GREEN],["Payouts","Confirmed by community","#fff"]].map(([l,v,c]) => (
                          <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: MUTED }}>{l}</span><span style={{ fontWeight: 600, color: c }}>{v}</span></div>
                        ))}
                      </div>
                      <div style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: GREEN, background: "rgba(34,197,94,0.07)", borderTop: "1px solid rgba(34,197,94,0.15)" }}>✓ Verdict: Safe to deposit.</div>
                    </div>
                  ) : m.type === "gold" ? (
                    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "4px 18px 18px 18px", overflow: "hidden", maxWidth: 360 }}>
                      <div style={{ padding: "10px 16px", background: "rgba(76,110,245,0.1)", borderBottom: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 700, color: BLUE, textTransform: "uppercase", letterSpacing: ".8px" }}>📊 Morning Briefing — GOLD</div>
                      <div style={{ padding: "14px 16px 8px", display: "flex", alignItems: "baseline", gap: 10 }}>
                        <span style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>XAU/USD</span>
                        <span style={{ fontSize: 26, fontWeight: 900 }}>3,124.50</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: GREEN }}>▲ 0.72%</span>
                      </div>
                      <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
                        <div style={{ background: "rgba(242,109,109,0.08)", border: "1px solid rgba(242,109,109,0.2)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: CORAL }}>⚠️ NFP in 89 minutes — HIGH IMPACT</div>
                        <div style={{ background: "rgba(76,110,245,0.06)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#c8d0e7" }}>🎯 Resistance: 3,130 &nbsp;|&nbsp; Support: 3,108</div>
                      </div>
                    </div>
                  ) : m.type === "warn" ? (
                    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "4px 18px 18px 18px", overflow: "hidden", maxWidth: 360 }}>
                      <div style={{ padding: "10px 16px", background: "rgba(76,110,245,0.1)", borderBottom: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 700, color: BLUE, textTransform: "uppercase", letterSpacing: ".8px" }}>🔍 Broker Verification</div>
                      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: CORAL }}>2.1 <span style={{ fontSize: 14, color: MUTED, fontWeight: 400 }}>/ 10</span></div>
                        {[["Status","WARNING ⚠️"],["FCA Authorised","No"],["Complaints","47 unresolved"],["Registered","Offshore — Vanuatu"]].map(([l,v]) => (
                          <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: MUTED }}>{l}</span><span style={{ fontWeight: 600, color: CORAL }}>{v}</span></div>
                        ))}
                      </div>
                      <div style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: CORAL, background: "rgba(242,109,109,0.07)", borderTop: "1px solid rgba(242,109,109,0.15)" }}>⚠️ Verdict: Avoid. High risk of fund loss.</div>
                    </div>
                  ) : (
                    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "4px 18px 18px 18px", padding: "14px 16px", fontSize: 14, lineHeight: 1.6, color: "#c8d0e7", maxWidth: 360 }}>The market rewards traders who prepare. verify.trading gives you the intelligence before the market opens.</div>
                  )}
                </div>
              ))}
              {typing && (
                <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "12px 16px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: "4px 18px 18px 18px", width: "fit-content" }}>
                  {[0,200,400].map(d => <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: MUTED, animation: `bounce 1.2s ${d}ms infinite` }} />)}
                </div>
              )}
            </div>
          )}
          <div style={{ padding: "14px 0 18px", borderTop: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", gap: 10, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "11px 14px" }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask anything — verify a broker, brief me on Gold, check a guru..." style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontSize: 14, fontFamily: "inherit" }} />
              <button onClick={() => send()} style={{ background: CORAL, border: "none", borderRadius: 10, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "markets" && (
        <div style={{ padding: "20px", maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ background: CORAL, borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 700, textAlign: "center", marginBottom: 18 }}>⚠️ NFP IN 89 MINUTES — HIGH IMPACT EVENT</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
            {[["LONDON",true],["NEW YORK",false],["ASIA",false]].map(([n,on]) => (
              <div key={n} style={{ padding: "6px 15px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1px solid ${on?"rgba(34,197,94,0.4)":BORDER}`, background: on?"rgba(34,197,94,0.07)":CARD, color: on?"#fff":MUTED, display: "flex", alignItems: "center", gap: 5 }}>
                {on && <span style={{ width: 7, height: 7, borderRadius: "50%", background: GREEN, display: "inline-block" }} />}{n}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 11, marginBottom: 28 }}>
            {assets.map(a => (
              <div key={a.n} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 13, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 2 }}>{a.n}</div>
                <div style={{ fontSize: 10, color: "rgba(136,146,176,.5)", marginBottom: 8 }}>{a.t}</div>
                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-.5px", marginBottom: 3 }}>{a.p}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: a.up ? GREEN : CORAL }}>{a.up?"▲":"▼"} {a.c}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 10 }}>Today's Events</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[["13:30 GMT","Non Farm Payrolls","HIGH",CORAL,"rgba(242,109,109,.3)"],["15:00 GMT","Fed Chair Speech","MED","#FBBF24","rgba(251,191,36,.3)"],["17:30 GMT","Oil Inventories","LOW",MUTED,"rgba(136,146,176,.2)"]].map(([t,n,im,c,bc]) => (
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

      {tab === "tools" && (
        <div style={{ padding: "20px", maxWidth: 600, margin: "0 auto" }}>
          <div style={{ background: CARD, border: `1px solid ${BLUE}`, borderRadius: 18, overflow: "hidden", boxShadow: `0 0 28px rgba(76,110,245,.1)` }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Lot Size Calculator</div>
              <div style={{ background: CORAL, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 9 }}>Most used</div>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 13 }}>
              {[["Account Size (£)","ac",10000],["Risk %","rk",1],["Stop Loss (pips)","sl",20]].map(([lbl,key,def]) => (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".6px" }}>{lbl}</label>
                  <input type="number" defaultValue={def} onChange={e => setLs(l => ({...l,[key]:+e.target.value||0}))} style={{ background: NAVY, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 13px", color: "#fff", fontSize: 15, fontFamily: "inherit", outline: "none", width: "100%" }} />
                </div>
              ))}
              <div style={{ background: CORAL, borderRadius: 12, padding: 18, textAlign: "center" }}>
                <div style={{ fontSize: 40, fontWeight: 900, color: "#fff", letterSpacing: -2 }}>{lsResult.toFixed(2)}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.8)", marginTop: 3 }}>Risking exactly £{lsAmt.toLocaleString("en-GB",{minimumFractionDigits:2})}</div>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-6px);opacity:1}}`}</style>
    </div>
  );
}

// ── MAIN APP ──
export default function App() {
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
            Tired of depositing with brokers you can't verify?
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
          {[[<IconShield/>,"FCA Verified","Data"],[<IconBolt/>,"2 Second","Broker Check"],[<IconChart/>,"Live","Market Data"],[<IconCalc/>,"6 Professional","Calculators"]].map(([icon,a,b],i) => (
            <div key={i} style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(76,110,245,0.08)", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>{icon}</div>
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