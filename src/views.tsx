// Secondary views for the Terminus console. Each renders in the spec-sheet
// language: a page head, a hazard divider, then content cards. Live data
// (objectives, authorizations, log) is passed in from the app; the rest is
// representative sample data for the V1 operational picture.

import { useState } from "react";
import { Barcode, HazardBar, RegMarks } from "./components/insignia";
import type { LiveMission, LiveSignal } from "./lib/data";

type ObjectiveLike = {
  id: string;
  title: string;
  mission: string;
  status: string;
  priority: string;
  assignee: string;
  dueLabel: string;
  overdue?: boolean;
  progress: number;
};

type AuthorizationLike = {
  id: string;
  actor: string;
  title: string;
  detail: string;
  risk: string;
  system: string;
  state: string;
};

const statusText: Record<string, string> = {
  active: "Active",
  review: "In review",
  blocked: "Blocked",
  queued: "Queued",
  done: "Complete",
};

/** Case-insensitive match of a query against any of the given fields. */
function hit(query: string | undefined, ...fields: (string | number)[]) {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => String(f).toLowerCase().includes(q));
}

function EmptyState({ label }: { label: string }) {
  return <div className="empty-state">No {label} match this search.</div>;
}

type Readout = [label: string, value: string];

export function PageHead({
  eyebrow,
  title,
  desc,
  code,
  readouts = [],
}: {
  eyebrow: string;
  title: string;
  desc: string;
  code: string;
  readouts?: Readout[];
}) {
  return (
    <section className="command-heading view-head">
      <div className="heading-copy">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      <div className="heading-telemetry">
        <div className="spectrum" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="view-head-side">
          <div className="view-head-top">
            <span className="micro">{code}</span>
            <RegMarks />
          </div>
          {readouts.length > 0 && (
            <div className="view-readouts">
              {readouts.map(([label, value]) => (
                <div key={label}>
                  <span className="micro">{label}</span>
                  <span className="telemetry-value">{value}</span>
                </div>
              ))}
            </div>
          )}
          <Barcode value={code.replace(/[^A-Z0-9]/g, "").slice(0, 10)} bars={40} height={18} />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Missions */

type Mission = {
  id: string;
  name: string;
  brief: string;
  status: "active" | "blocked" | "planning" | "complete";
  progress: number;
  objectives: number;
  open: number;
  lead: string;
  agents: string[];
  due: string;
};

const sampleMissions: Mission[] = [
  {
    id: "MIS-001",
    name: "Terminus Core",
    brief: "Foundational platform — domain schema, authorization, immutable events, retrieval.",
    status: "active",
    progress: 68,
    objectives: 12,
    open: 5,
    lead: "ED",
    agents: ["ODIN", "MUNINN"],
    due: "12 AUG",
  },
  {
    id: "MIS-002",
    name: "Module Array",
    brief: "Integration adapters against the standard trigger / action / health contract.",
    status: "active",
    progress: 34,
    objectives: 9,
    open: 6,
    lead: "OD",
    agents: ["ODIN"],
    due: "28 AUG",
  },
  {
    id: "MIS-003",
    name: "Pantheon Link",
    brief: "Agent mesh coordination and remote execution safeguards for gated actions.",
    status: "blocked",
    progress: 41,
    objectives: 6,
    open: 4,
    lead: "HM",
    agents: ["LOKI", "HEIMDALL"],
    due: "04 SEP",
  },
  {
    id: "MIS-004",
    name: "Archive Index",
    brief: "Knowledge base capture with semantic retrieval through Terminus Core.",
    status: "active",
    progress: 56,
    objectives: 7,
    open: 3,
    lead: "MN",
    agents: ["MUNINN"],
    due: "19 AUG",
  },
  {
    id: "MIS-005",
    name: "Signal Grid",
    brief: "Monitoring, SLA watch, and anomaly signalling across missions and modules.",
    status: "planning",
    progress: 12,
    objectives: 5,
    open: 5,
    lead: "HM",
    agents: ["HEIMDALL"],
    due: "11 SEP",
  },
  {
    id: "MIS-000",
    name: "Foundation Survey",
    brief: "Initial architecture study and platform direction. Closed and archived.",
    status: "complete",
    progress: 100,
    objectives: 8,
    open: 0,
    lead: "ED",
    agents: ["ODIN"],
    due: "30 JUN",
  },
];

export function MissionsView({
  query,
  missions,
}: {
  query?: string;
  missions?: LiveMission[];
}) {
  const source = missions ?? sampleMissions;
  const rows = source.filter((m) =>
    hit(query, m.id, m.name, m.brief, m.status, m.lead, ...m.agents),
  );
  return (
    <>
      <PageHead
        eyebrow="Mission control // active theatre"
        title="Missions"
        desc="Every operational theatre under Terminus command, with readiness, ownership, and assigned agent mesh."
        code="MIS // 006"
        readouts={[
          [
            "Active",
            String(source.filter((m) => m.status === "active").length).padStart(2, "0"),
          ],
          [
            "Blocked",
            String(source.filter((m) => m.status === "blocked").length).padStart(2, "0"),
          ],
          [
            "Complete",
            String(source.filter((m) => m.status === "complete").length).padStart(2, "0"),
          ],
        ]}
      />
      <HazardBar label="Theatre" />
      {rows.length === 0 && <EmptyState label="missions" />}
      <div className="mission-grid">
        {rows.map((m) => (
          <article className={`mission-card ${m.status}`} key={m.id}>
            <div className="mission-top">
              <span className="micro">{m.id}</span>
              <span className={`badge ${m.status}`}>{m.status}</span>
            </div>
            <h3 className="display-face">{m.name}</h3>
            <p>{m.brief}</p>
            <div className="mission-meta">
              <div>
                <span className="micro">Objectives</span>
                <span className="telemetry-value">
                  {String(m.open).padStart(2, "0")} open // {m.objectives}
                </span>
              </div>
              <div>
                <span className="micro">Lead</span>
                <span className="telemetry-value">{m.lead}</span>
              </div>
              <div>
                <span className="micro">Due</span>
                <span className="telemetry-value">{m.due}</span>
              </div>
            </div>
            <div className="mission-progress">
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${m.progress}%` }}
                />
              </div>
              <span className="micro">{m.progress}%</span>
            </div>
            <div className="mission-agents">
              <span className="micro">Agent mesh</span>
              <div className="agent-chips">
                {m.agents.map((a) => (
                  <span className="agent-chip" key={a}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ Signals */

type Signal = {
  id: string;
  severity: "critical" | "warning" | "info" | "nominal";
  source: string;
  title: string;
  detail: string;
  time: string;
};

const sampleSignals: Signal[] = [
  {
    id: "SIG-4471",
    severity: "critical",
    source: "HEIMDALL",
    title: "Objective OBJ-003.02 breached SLA",
    detail: "Remote execution safeguards overdue since 22 JUL. Blocked on command allowlist decision.",
    time: "06:14:22",
  },
  {
    id: "SIG-4470",
    severity: "warning",
    source: "AUTH",
    title: "High-risk authorization pending",
    detail: "AUTH-020 remote health probe on the Terminus host awaits operator decision.",
    time: "05:59:10",
  },
  {
    id: "SIG-4468",
    severity: "warning",
    source: "MODULE",
    title: "Ollama inference degraded",
    detail: "Local inference host on standby at 63% capacity. Non-blocking for current cycle.",
    time: "05:41:03",
  },
  {
    id: "SIG-4465",
    severity: "nominal",
    source: "PROTOCOL",
    title: "Nightly health sweep passed",
    detail: "PRT-006 completed across 5 modules. 0 failed checks. Next run 06:00 UTC.",
    time: "06:13:31",
  },
  {
    id: "SIG-4462",
    severity: "info",
    source: "ODIN",
    title: "Objective recommendation logged",
    detail: "Delivery key strategy proposed on OBJ-001.04. Awaiting operator confirmation.",
    time: "05:42:31",
  },
];

export function SignalsView({
  query,
  signals,
  onAck,
}: {
  query?: string;
  signals?: LiveSignal[];
  onAck?: (id: string) => void;
}) {
  const [acked, setAcked] = useState<string[]>([]);
  const source = signals ?? sampleSignals;
  const live = source.filter((s) => !acked.includes(s.id));
  const rows = live.filter((s) =>
    hit(query, s.id, s.source, s.title, s.detail, s.severity),
  );
  const count = (sev: string) =>
    String(live.filter((s) => s.severity === sev).length).padStart(2, "0");
  return (
    <>
      <PageHead
        eyebrow="Signal grid // live feed"
        title="Signals"
        desc="Prioritised operational signals from agents, modules, and protocols requiring attention or acknowledgement."
        code="SIG // 003"
        readouts={[
          ["Critical", count("critical")],
          ["Warning", count("warning")],
          ["Open", String(live.length).padStart(2, "0")],
        ]}
      />
      <HazardBar label="Intercept" />
      {rows.length === 0 && (
        <EmptyState label={acked.length ? "open signals" : "signals"} />
      )}
      <div className="panel">
        <div className="signal-list">
          {rows.map((s) => (
            <div className={`signal-row ${s.severity}`} key={s.id}>
              <div className="signal-sev" aria-hidden="true" />
              <div className="signal-body">
                <div className="signal-head">
                  <span className={`risk ${s.severity}`}>{s.severity}</span>
                  <span className="micro">
                    {s.source} // {s.id}
                  </span>
                  <span className="micro signal-time">{s.time}</span>
                </div>
                <h4>{s.title}</h4>
                <p>{s.detail}</p>
              </div>
              <button
                className="tiny-button signal-ack"
                type="button"
                onClick={() => {
                  setAcked((prev) => [...prev, s.id]);
                  onAck?.(s.id);
                }}
              >
                Ack
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------- Mission Log */

type LogEntry = { time: string; actor: string; copy: string; type: string };

export function MissionLogView({
  log,
  query,
}: {
  log: LogEntry[];
  query?: string;
}) {
  const base: LogEntry[] = [
    ...log,
    {
      time: "05:12:44",
      actor: "SYS",
      copy: "Event outbox drained <strong>PRT-002</strong>: 148 events delivered.",
      type: "PROTOCOL",
    },
    {
      time: "04:58:20",
      actor: "MN",
      copy: "MUNINN embedded <strong>ADR-004</strong> into the archive index.",
      type: "AGENT",
    },
    {
      time: "04:33:09",
      actor: "OD",
      copy: "ODIN opened <strong>OBJ-002.01</strong> for the GitHub module adapter.",
      type: "AGENT",
    },
    {
      time: "03:47:51",
      actor: "ED",
      copy: "Eli approved authorization <strong>AUTH-018</strong>.",
      type: "USER",
    },
  ];
  const extended = base.filter((e) =>
    hit(query, e.time, e.actor, e.copy.replace(/<[^>]+>/g, ""), e.type),
  );
  return (
    <>
      <PageHead
        eyebrow="Immutable record // append-only"
        title="Mission Log"
        desc="The append-only event stream across operators, agents, protocols, and systems. Every action is recorded and auditable."
        code="LOG // 472"
        readouts={[
          ["Events today", "1.2K"],
          ["Retention", "∞"],
          ["Integrity", "OK"],
        ]}
      />
      <HazardBar label="Audit" />
      <div className="panel">
        <div className="panel-header">
          <div className="panel-heading">
            <h2>Event stream</h2>
            <p>Chronological, newest first</p>
          </div>
          <span className="panel-code">EVT // LIVE</span>
        </div>
        <div className="logfeed">
          {extended.map((entry, index) => (
            <div className="log-item" key={index}>
              <span className="log-time">{entry.time}</span>
              <span className={`badge ${entry.type.toLowerCase()}`}>
                {entry.type}
              </span>
              <span
                className="log-copy"
                dangerouslySetInnerHTML={{ __html: entry.copy }}
              />
            </div>
          ))}
        </div>
        <div className="panel-footer">
          <span>{extended.length} events shown // 1,204 today</span>
          <Barcode value="LOG-STREAM-472" bars={54} height={16} />
        </div>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- Archives */

type Doc = {
  id: string;
  type: "ADR" | "POLICY" | "PROCEDURE" | "SPEC";
  title: string;
  summary: string;
  version: string;
  updated: string;
};

const docs: Doc[] = [
  {
    id: "ADR-004",
    type: "ADR",
    title: "Immutable event model",
    summary: "Domain event envelope, transactional outbox, and replay semantics.",
    version: "v3",
    updated: "22 JUL",
  },
  {
    id: "POL-002",
    type: "POLICY",
    title: "Authorization boundary",
    summary: "Human and agent permission grants, escalation, and gated actions.",
    version: "v2",
    updated: "20 JUL",
  },
  {
    id: "ADR-002",
    type: "ADR",
    title: "Module contract",
    summary: "Standard trigger, action, health, authentication, and audit interface.",
    version: "v4",
    updated: "18 JUL",
  },
  {
    id: "PROC-011",
    type: "PROCEDURE",
    title: "Incident response runbook",
    summary: "Detection, containment, operator escalation, and reversal steps.",
    version: "v1",
    updated: "15 JUL",
  },
  {
    id: "POL-001",
    type: "POLICY",
    title: "Data retention & PII",
    summary: "Audit retention windows, PII handling, and archival policy.",
    version: "v1",
    updated: "11 JUL",
  },
  {
    id: "SPEC-007",
    type: "SPEC",
    title: "Retrieval interface",
    summary: "Chunking, embedding, and semantic query contract for Terminus Core.",
    version: "v2",
    updated: "09 JUL",
  },
];

export function ArchivesView({ query }: { query?: string }) {
  const rows = docs.filter((d) =>
    hit(query, d.id, d.type, d.title, d.summary, d.version),
  );
  return (
    <>
      <PageHead
        eyebrow="Knowledge base // indexed"
        title="Archives"
        desc="Decision records, policies, procedures, and specifications — versioned and embedded for retrieval."
        code="ARC // 048"
        readouts={[
          ["Documents", "48"],
          ["Indexed", "48"],
          ["Drafts", "03"],
        ]}
      />
      <HazardBar label="Records" />
      {rows.length === 0 && <EmptyState label="documents" />}
      <div className="doc-grid">
        {rows.map((d) => (
          <article className="doc-card" key={d.id}>
            <div className="doc-top">
              <span className={`doc-type ${d.type.toLowerCase()}`}>{d.type}</span>
              <span className="micro">{d.id}</span>
            </div>
            <h3>{d.title}</h3>
            <p>{d.summary}</p>
            <div className="doc-foot">
              <span className="micro">{d.version}</span>
              <span className="micro">Updated {d.updated}</span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ Modules */

type Module = {
  name: string;
  category: string;
  state: "nominal" | "standby" | "offline";
  signal: number;
  detail: string;
  caps: string[];
};

const modules: Module[] = [
  {
    name: "Supabase",
    category: "DATA",
    state: "nominal",
    signal: 98,
    detail: "Postgres, authentication, row-level security, and pgvector store.",
    caps: ["QUERY", "AUTH", "VECTOR"],
  },
  {
    name: "Redis queue",
    category: "QUEUE",
    state: "nominal",
    signal: 94,
    detail: "Job transport and rate-limited action dispatch for protocols.",
    caps: ["ENQUEUE", "DISPATCH"],
  },
  {
    name: "n8n protocols",
    category: "AUTOMATION",
    state: "nominal",
    signal: 91,
    detail: "Workflow automation runner for scheduled and triggered protocols.",
    caps: ["TRIGGER", "RUN", "WEBHOOK"],
  },
  {
    name: "Ollama inference",
    category: "INFERENCE",
    state: "standby",
    signal: 63,
    detail: "Local model host for private inference. On standby at reduced capacity.",
    caps: ["GENERATE", "EMBED"],
  },
  {
    name: "GitHub module",
    category: "SCM",
    state: "standby",
    signal: 38,
    detail: "Repository health, issue reads, and gated draft issue creation.",
    caps: ["HEALTH", "ISSUE.READ", "ISSUE.DRAFT"],
  },
  {
    name: "pgvector",
    category: "MEMORY",
    state: "nominal",
    signal: 90,
    detail: "Embedding store backing archive retrieval and agent memory.",
    caps: ["UPSERT", "SEARCH"],
  },
];

export function ModulesView({ query }: { query?: string }) {
  const rows = modules.filter((m) =>
    hit(query, m.name, m.category, m.state, m.detail, ...m.caps),
  );
  return (
    <>
      <PageHead
        eyebrow="Connected systems // mesh"
        title="Modules"
        desc="Every connected system exposed through the standard module contract, with live health and capability surface."
        code="MOD // 006"
        readouts={[
          ["Nominal", "04"],
          ["Standby", "02"],
          ["Offline", "00"],
        ]}
      />
      <HazardBar label="Interface" />
      {rows.length === 0 && <EmptyState label="modules" />}
      <div className="module-grid">
        {rows.map((m) => (
          <article className={`module-card ${m.state}`} key={m.name}>
            <div className="module-top">
              <div>
                <span className="micro">{m.category}</span>
                <h3 className="display-face">{m.name}</h3>
              </div>
              <span className={`system-state ${m.state}`}>{m.state}</span>
            </div>
            <p>{m.detail}</p>
            <div className="signal-line" aria-hidden="true">
              {Array.from({ length: 20 }, (_, i) => (
                <span
                  key={i}
                  style={{ opacity: i < Math.round(m.signal / 5) ? 1 : 0.16 }}
                />
              ))}
            </div>
            <div className="module-foot">
              <span className="micro">Signal {m.signal}%</span>
              <div className="cap-chips">
                {m.caps.map((c) => (
                  <span className="cap-chip" key={c}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Protocols */

type Protocol = {
  id: string;
  name: string;
  trigger: string;
  schedule: string;
  lastRun: string;
  state: "ok" | "flagged" | "running" | "pending";
  runs: number;
};

const protocols: Protocol[] = [
  {
    id: "PRT-006",
    name: "Nightly health sweep",
    trigger: "SCHEDULE",
    schedule: "06:00 UTC · daily",
    lastRun: "06:13 · passed",
    state: "ok",
    runs: 214,
  },
  {
    id: "PRT-004",
    name: "Objective SLA watch",
    trigger: "EVENT",
    schedule: "on overdue",
    lastRun: "06:14 · flagged OBJ-003.02",
    state: "flagged",
    runs: 1809,
  },
  {
    id: "PRT-002",
    name: "Event outbox drain",
    trigger: "CONTINUOUS",
    schedule: "streaming",
    lastRun: "live · 148 events",
    state: "running",
    runs: 44210,
  },
  {
    id: "PRT-009",
    name: "Operator digest compile",
    trigger: "SCHEDULE",
    schedule: "18:00 UTC · daily",
    lastRun: "18:00 · passed",
    state: "ok",
    runs: 96,
  },
  {
    id: "PRT-011",
    name: "Archive reindex",
    trigger: "SCHEDULE",
    schedule: "SUN 03:00 UTC · weekly",
    lastRun: "queued for next window",
    state: "pending",
    runs: 12,
  },
];

export function ProtocolsView({ query }: { query?: string }) {
  const rows = protocols.filter((p) =>
    hit(query, p.id, p.name, p.trigger, p.schedule, p.lastRun, p.state),
  );
  return (
    <>
      <PageHead
        eyebrow="Automation runner // protocols"
        title="Protocols"
        desc="Scheduled and triggered automations executed against modules under audit and authorization control."
        code="PRT // 008"
        readouts={[
          ["Active", "08"],
          ["Running", "01"],
          ["Failed", "00"],
        ]}
      />
      <HazardBar label="Runner" />
      <div className="panel">
        <table className="objective-table protocol-table">
          <thead>
            <tr>
              <th>Protocol</th>
              <th>Trigger</th>
              <th>Schedule</th>
              <th>Last run</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={`protocol-row ${p.state}`}>
                <td>
                  <div className="protocol-name">{p.name}</div>
                  <div className="micro">
                    {p.id} // {p.runs.toLocaleString()} runs
                  </div>
                </td>
                <td>
                  <span className="badge">{p.trigger}</span>
                </td>
                <td className="micro">{p.schedule}</td>
                <td className="micro">{p.lastRun}</td>
                <td>
                  <span className={`system-state ${p.state === "flagged" ? "standby" : p.state === "ok" ? "" : "standby"}`}>
                    {p.state}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="panel-footer">
          <span>{protocols.length} protocols // 8 active</span>
          <Barcode value="PRT-RUNNER-08" bars={50} height={16} />
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------- Terminus Core */

type Agent = {
  name: string;
  role: string;
  fn: string;
  state: "ready" | "held";
  clearance: string;
};

const agents: Agent[] = [
  {
    name: "ODIN",
    role: "Coordinator",
    fn: "Objective planning, decomposition, and issue authoring across missions.",
    state: "ready",
    clearance: "OPERATOR",
  },
  {
    name: "LOKI",
    role: "Executor",
    fn: "Remote and module actions. High-impact execution gated behind authorization.",
    state: "held",
    clearance: "RESTRICTED",
  },
  {
    name: "HEIMDALL",
    role: "Sentinel",
    fn: "Monitoring, SLA watch, and anomaly signalling across the operational grid.",
    state: "ready",
    clearance: "OBSERVER",
  },
  {
    name: "MUNINN",
    role: "Memory",
    fn: "Retrieval, archive embedding, and context assembly for Terminus Core.",
    state: "ready",
    clearance: "OPERATOR",
  },
];

export function CoreView({ query }: { query?: string }) {
  const roster = agents.filter((a) =>
    hit(query, a.name, a.role, a.fn, a.state, a.clearance),
  );
  return (
    <>
      <PageHead
        eyebrow="Terminus core // intelligence"
        title="Terminus Core"
        desc="The reasoning core and Pantheon agent mesh. Configuration, clearances, and memory backing the operational picture."
        code="CORE // 001"
        readouts={[
          ["Mesh", "6 / 7"],
          ["Node", "TERM-01"],
          ["Clearance", "ADMIN"],
        ]}
      />
      <HazardBar label="Pantheon" />
      <div className="agent-grid">
        {roster.map((a) => (
          <article className={`agent-card ${a.state}`} key={a.name}>
            <div className="agent-top">
              <span className="display-face agent-name">{a.name}</span>
              <span className={`system-state ${a.state === "held" ? "standby" : ""}`}>
                {a.state}
              </span>
            </div>
            <div className="micro agent-role">{a.role}</div>
            <p>{a.fn}</p>
            <div className="agent-foot">
              <span className="micro">Clearance</span>
              <span className="badge">{a.clearance}</span>
            </div>
          </article>
        ))}
      </div>
      <HazardBar label="Configuration" />
      <div className="core-config panel">
        <div className="config-row">
          <span className="micro">Reasoning model</span>
          <span className="telemetry-value">CLAUDE OPUS // OPERATIONS</span>
        </div>
        <div className="config-row">
          <span className="micro">Memory store</span>
          <span className="telemetry-value">PGVECTOR // 12,480 VECTORS</span>
        </div>
        <div className="config-row">
          <span className="micro">Operating node</span>
          <span className="telemetry-value">TERM-01 // US-EAST-1</span>
        </div>
        <div className="config-row">
          <span className="micro">Event integrity</span>
          <span className="telemetry-value">APPEND-ONLY // VERIFIED</span>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Objectives */

const OBJ_LANES: [string, string][] = [
  ["queued", "Queued"],
  ["active", "Active"],
  ["review", "In review"],
  ["blocked", "Blocked"],
  ["done", "Complete"],
];

export function ObjectivesView({
  objectives,
  onSelect,
  selectedId,
  query,
  onStatusChange,
}: {
  objectives: ObjectiveLike[];
  onSelect: (id: string) => void;
  selectedId: string | null;
  query?: string;
  onStatusChange?: (id: string, status: string) => void;
}) {
  const [status, setStatus] = useState<string>("all");
  const [mode, setMode] = useState<"table" | "board">("table");
  const [dragLane, setDragLane] = useState<string | null>(null);
  const open = objectives.filter((o) => o.status !== "done").length;
  const overdue = objectives.filter((o) => o.overdue).length;
  const matches = objectives.filter((o) =>
    hit(query, o.id, o.title, o.mission, o.status, o.priority, o.assignee),
  );
  const rows = matches.filter((o) => status === "all" || o.status === status);
  const filters: [string, string][] = [
    ["all", "All"],
    ...(OBJ_LANES.filter(([v]) => v !== "queued") as [string, string][]),
    ["queued", "Queued"],
  ];
  return (
    <>
      <PageHead
        eyebrow="Execution queue // all records"
        title="Objectives"
        desc="Every objective across all missions with readiness, ownership, and progress. Drag cards between lanes on the board to change status."
        code="OBJ // 012"
        readouts={[
          ["Open", String(open).padStart(2, "0")],
          ["Overdue", String(overdue).padStart(2, "0")],
          ["Total", String(objectives.length).padStart(2, "0")],
        ]}
      />
      <HazardBar label="Queue" />
      <div className="panel">
        <div className="filters">
          {mode === "table" &&
            filters.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`filter-button ${status === value ? "active" : ""}`}
                onClick={() => setStatus(value)}
              >
                {label}
              </button>
            ))}
          <div className="view-mode">
            <button
              type="button"
              className={`filter-button ${mode === "table" ? "active" : ""}`}
              onClick={() => setMode("table")}
            >
              Table
            </button>
            <button
              type="button"
              className={`filter-button ${mode === "board" ? "active" : ""}`}
              onClick={() => setMode("board")}
            >
              Board
            </button>
          </div>
        </div>

        {mode === "board" ? (
          <div className="board">
            {OBJ_LANES.map(([laneStatus, label]) => {
              const cards = matches.filter((o) => o.status === laneStatus);
              return (
                <div
                  key={laneStatus}
                  className={`board-lane ${dragLane === laneStatus ? "over" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragLane(laneStatus);
                  }}
                  onDragLeave={() => setDragLane((l) => (l === laneStatus ? null : l))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) onStatusChange?.(id, laneStatus);
                    setDragLane(null);
                  }}
                >
                  <div className="board-lane-head">
                    <span className={`badge ${laneStatus}`}>{label}</span>
                    <span className="lane-count">{cards.length}</span>
                  </div>
                  <div className="board-lane-body">
                    {cards.map((o) => (
                      <article
                        key={o.id}
                        className={`board-card ${o.id === selectedId ? "selected" : ""}`}
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData("text/plain", o.id)
                        }
                        onClick={() => onSelect(o.id)}
                      >
                        <div className="board-card-top">
                          <span className="objective-id">{o.id}</span>
                          <span className={`priority ${o.priority.toLowerCase()}`}>
                            {o.priority}
                          </span>
                        </div>
                        <div className="board-card-title">{o.title}</div>
                        <div className="board-card-foot">
                          <span className="assignee">{o.assignee}</span>
                          <span className={`due ${o.overdue ? "overdue" : ""}`}>
                            {o.dueLabel}
                          </span>
                        </div>
                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{ width: `${o.progress}%` }}
                          />
                        </div>
                      </article>
                    ))}
                    {cards.length === 0 && (
                      <div className="board-lane-empty">Drop here</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
        <table className="objective-table">
          <thead>
            <tr>
              <th style={{ width: "42%" }}>Objective</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assigned</th>
              <th>Due</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr
                key={o.id}
                className={`objective-row ${o.id === selectedId ? "selected" : ""}`}
                onClick={() => onSelect(o.id)}
              >
                <td>
                  <div className="objective-main">
                    <span className="objective-marker">
                      {o.status === "done" ? "✓" : "□"}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="objective-title">{o.title}</div>
                      <span className="objective-id">
                        {o.id} // {o.mission}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`badge ${o.status}`}>
                    {statusText[o.status] ?? o.status}
                  </span>
                </td>
                <td>
                  <span className={`priority ${o.priority.toLowerCase()}`}>
                    {o.priority}
                  </span>
                </td>
                <td>
                  <span className="assignee">{o.assignee}</span>
                </td>
                <td>
                  <span className={`due ${o.overdue ? "overdue" : ""}`}>
                    {o.dueLabel}
                  </span>
                </td>
                <td>
                  <span>{o.progress}%</span>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${o.progress}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
        {mode === "table" && rows.length === 0 && (
          <EmptyState label="objectives" />
        )}
        <div className="panel-footer">
          <span>
            {mode === "board" ? matches.length : rows.length} records visible
          </span>
          <Barcode value="OBJ-REGISTER-12" bars={56} height={16} />
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- Authorization */

export function AuthorizationView({
  authorizations,
  onResolve,
  query,
}: {
  authorizations: AuthorizationLike[];
  onResolve: (id: string, decision: "approved" | "held") => void;
  query?: string;
}) {
  const pending = authorizations.filter((a) => a.state === "pending").length;
  const rows = authorizations.filter((a) =>
    hit(query, a.id, a.actor, a.title, a.detail, a.risk, a.system, a.state),
  );
  return (
    <>
      <PageHead
        eyebrow="Command authorization // gate"
        title="Authorization"
        desc="Sensitive and high-impact actions proposed by agents, held for operator decision before execution."
        code="AUTH // 002"
        readouts={[
          ["Pending", String(pending).padStart(2, "0")],
          ["High risk", "01"],
          ["Auto-deny", "ON"],
        ]}
      />
      <HazardBar label="Gate" />
      {rows.length === 0 && <EmptyState label="authorizations" />}
      <div className="auth-grid">
        {rows.map((a) => (
          <div className={`authorization-card ${a.risk}`} key={a.id}>
            <div className="auth-top">
              <span className={`risk ${a.risk}`}>{a.risk} risk</span>
              <span className="micro">{a.id}</span>
            </div>
            <h3>{a.title}</h3>
            <p>{a.detail}</p>
            <div className="micro" style={{ marginTop: 9 }}>
              {a.actor} → {a.system}
            </div>
            {a.state === "pending" ? (
              <div className="auth-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => onResolve(a.id, "approved")}
                >
                  Approve
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => onResolve(a.id, "held")}
                >
                  Hold
                </button>
              </div>
            ) : (
              <div
                className="auth-approved"
                style={
                  a.state === "held"
                    ? { borderColor: "var(--warning)", color: "var(--warning)" }
                    : { borderColor: "var(--sage)", color: "var(--sage)" }
                }
              >
                {a.state === "held" ? "Held by operator" : "Approved"}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
