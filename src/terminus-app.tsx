"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Scanner } from "./components/scanner";
import { Barcode, HazardBar } from "./components/insignia";
import {
  MissionsView,
  ObjectivesView,
  SignalsView,
  MissionLogView,
  ArchivesView,
  ModulesView,
  ProtocolsView,
  AuthorizationView,
  CoreView,
} from "./views";

type ObjectiveStatus = "active" | "review" | "blocked" | "queued" | "done";
type Priority = "P0" | "P1" | "P2";

type Objective = {
  id: string;
  title: string;
  description: string;
  mission: string;
  status: ObjectiveStatus;
  priority: Priority;
  assignee: string;
  due: string;
  dueLabel: string;
  overdue?: boolean;
  progress: number;
  aiSummary: string;
  comments: { author: string; body: string; time: string }[];
  links: { type: string; label: string }[];
};

type Authorization = {
  id: string;
  actor: string;
  title: string;
  detail: string;
  risk: "high" | "medium";
  system: string;
  state: "pending" | "approved" | "held";
};

const initialObjectives: Objective[] = [
  {
    id: "OBJ-001.04",
    title: "Finalize immutable event pipeline",
    description:
      "Define the domain event envelope, transactional outbox, retry behavior, and append-only audit controls for operational actions.",
    mission: "TERMINUS CORE",
    status: "active",
    priority: "P0",
    assignee: "ED",
    due: "2026-07-24",
    dueLabel: "24 JUL",
    progress: 72,
    aiSummary:
      "Core envelope is stable. The remaining risk is replay idempotency across module actions. Resolve delivery keys before enabling external execution.",
    comments: [
      {
        author: "ODIN",
        body: "Recommend using event ID plus action revision as the delivery key.",
        time: "05:42",
      },
    ],
    links: [
      { type: "ARCHIVE", label: "ADR-004 // Event model" },
      { type: "DEPENDENCY", label: "OBJ-001.03 // Permission matrix" },
    ],
  },
  {
    id: "OBJ-001.05",
    title: "Map Supabase RLS to explicit roles",
    description:
      "Implement organization membership, role assignment, permission checks, and row policies for people and non-human agents.",
    mission: "TERMINUS CORE",
    status: "review",
    priority: "P0",
    assignee: "HM",
    due: "2026-07-25",
    dueLabel: "25 JUL",
    progress: 88,
    aiSummary:
      "Administrator and Operator paths are covered. Agent permissions need separate grants for proposal creation and approved execution.",
    comments: [],
    links: [
      { type: "ARCHIVE", label: "POL-002 // Authorization boundary" },
      { type: "MODULE", label: "SUPABASE // LOCAL" },
    ],
  },
  {
    id: "OBJ-002.01",
    title: "Build GitHub module adapter",
    description:
      "Create the first module implementation using the standard trigger, action, health, authentication, and audit interfaces.",
    mission: "MODULE ARRAY",
    status: "queued",
    priority: "P1",
    assignee: "OD",
    due: "2026-07-28",
    dueLabel: "28 JUL",
    progress: 18,
    aiSummary:
      "The adapter can begin after the plugin contract is frozen. Start with repository health, issue reads, and draft issue creation.",
    comments: [],
    links: [{ type: "DEPENDENCY", label: "OBJ-001.04 // Event pipeline" }],
  },
  {
    id: "OBJ-003.02",
    title: "Define remote execution safeguards",
    description:
      "Document and enforce the approval, scope, timeout, credential, and reversal requirements for LOKI remote operations.",
    mission: "PANTHEON LINK",
    status: "blocked",
    priority: "P0",
    assignee: "HM",
    due: "2026-07-22",
    dueLabel: "22 JUL",
    overdue: true,
    progress: 41,
    aiSummary:
      "Blocked pending a decision on command allowlists. High-impact remote execution should remain unavailable in V1.",
    comments: [],
    links: [{ type: "AGENT", label: "LOKI // REMOTE EXECUTION" }],
  },
  {
    id: "OBJ-004.03",
    title: "Index operating procedures",
    description:
      "Chunk, embed, and index internal procedures for semantic retrieval through Terminus Core.",
    mission: "ARCHIVES",
    status: "active",
    priority: "P2",
    assignee: "MN",
    due: "2026-07-30",
    dueLabel: "30 JUL",
    progress: 56,
    aiSummary:
      "Document extraction is ready. Add source version metadata before embeddings are generated.",
    comments: [],
    links: [
      { type: "MODULE", label: "PGVECTOR // READY" },
      { type: "AGENT", label: "MUNINN // MEMORY" },
    ],
  },
];

const initialAuthorizations: Authorization[] = [
  {
    id: "AUTH-019",
    actor: "ODIN",
    title: "Create GitHub issue set",
    detail:
      "Create four implementation issues in elifrombitlink/terminus from approved objective definitions.",
    risk: "medium",
    system: "GITHUB",
    state: "pending",
  },
  {
    id: "AUTH-020",
    actor: "LOKI",
    title: "Run remote health probe",
    detail:
      "Execute a read-only Docker service health inspection on the Terminus host.",
    risk: "high",
    system: "REMOTE HOST",
    state: "pending",
  },
];

const initialLog = [
  {
    time: "06:14:22",
    actor: "HM",
    copy: "HEIMDALL flagged <strong>OBJ-003.02</strong> as overdue.",
    type: "AGENT",
  },
  {
    time: "05:58:09",
    actor: "ED",
    copy: "Eli moved <strong>OBJ-001.05</strong> into review.",
    type: "USER",
  },
  {
    time: "05:42:31",
    actor: "OD",
    copy: "ODIN added a recommendation to <strong>OBJ-001.04</strong>.",
    type: "AGENT",
  },
  {
    time: "05:31:04",
    actor: "SYS",
    copy: "Protocol runner completed <strong>PRT-006</strong> successfully.",
    type: "PROTOCOL",
  },
];

const navGroups = [
  {
    label: "Operations",
    items: [
      ["◎", "Command", ""] as const,
      ["◈", "Missions", "4"] as const,
      ["□", "Objectives", "12"] as const,
      ["⌁", "Signals", "3"] as const,
      ["▤", "Mission Log", ""] as const,
    ],
  },
  {
    label: "Systems",
    items: [
      ["▧", "Archives", ""] as const,
      ["⌘", "Modules", "6"] as const,
      ["⤨", "Protocols", "8"] as const,
      ["△", "Authorization", "2"] as const,
      ["⊙", "Terminus Core", ""] as const,
    ],
  },
];

const viewCodes: Record<string, string> = {
  Command: "SYS.COM // 001",
  Missions: "SYS.MIS // 006",
  Objectives: "SYS.OBJ // 012",
  Signals: "SYS.SIG // 003",
  "Mission Log": "SYS.LOG // 472",
  Archives: "SYS.ARC // 048",
  Modules: "SYS.MOD // 006",
  Protocols: "SYS.PRT // 008",
  Authorization: "SYS.AUTH // 002",
  "Terminus Core": "SYS.CORE // 001",
};

const statusLabels: Record<ObjectiveStatus, string> = {
  active: "Active",
  review: "In review",
  blocked: "Blocked",
  queued: "Queued",
  done: "Complete",
};

function utcClock() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date());
}

export function TerminusApp() {
  const [view, setView] = useState("Command");
  const [navOpen, setNavOpen] = useState(false);
  const [objectives, setObjectives] = useState(initialObjectives);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | ObjectiveStatus>("all");
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [authorizations, setAuthorizations] = useState(initialAuthorizations);
  const [log, setLog] = useState(initialLog);
  const [activeTab, setActiveTab] = useState("overview");
  const [comment, setComment] = useState("");
  const [clock, setClock] = useState(() => utcClock());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(utcClock()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const selected = objectives.find((objective) => objective.id === selectedId);

  const filteredObjectives = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return objectives.filter((objective) => {
      const matchesFilter = filter === "all" || objective.status === filter;
      const matchesQuery =
        !needle ||
        objective.title.toLowerCase().includes(needle) ||
        objective.id.toLowerCase().includes(needle) ||
        objective.mission.toLowerCase().includes(needle);
      return matchesFilter && matchesQuery;
    });
  }, [filter, objectives, query]);

  const pendingAuth = authorizations.filter((item) => item.state === "pending");

  function updateObjective(
    id: string,
    patch: Partial<Pick<Objective, "status" | "priority" | "due">>,
  ) {
    setObjectives((current) =>
      current.map((objective) =>
        objective.id === id ? { ...objective, ...patch } : objective,
      ),
    );
    const property = Object.keys(patch)[0] ?? "objective";
    setLog((current) => [
      {
        time: utcClock(),
        actor: "ED",
        copy: `Eli updated <strong>${id}</strong> ${property}.`,
        type: "USER",
      },
      ...current,
    ]);
  }

  function addObjective(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    if (!title) return;
    const nextNumber = String(objectives.length + 1).padStart(2, "0");
    const id = `OBJ-005.${nextNumber}`;
    const due = String(data.get("due") ?? "2026-08-01");
    const date = new Date(`${due}T12:00:00`);
    const dueLabel = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
    })
      .format(date)
      .toUpperCase();
    const objective: Objective = {
      id,
      title,
      description:
        String(data.get("description") ?? "").trim() ||
        "Objective briefing awaiting operator detail.",
      mission: String(data.get("mission") ?? "TERMINUS CORE"),
      status: "queued",
      priority: String(data.get("priority") ?? "P1") as Priority,
      assignee: "ED",
      due,
      dueLabel,
      progress: 0,
      aiSummary:
        "Terminus Core will prepare a summary after the first activity event is recorded.",
      comments: [],
      links: [],
    };
    setObjectives((current) => [objective, ...current]);
    setLog((current) => [
      {
        time: utcClock(),
        actor: "ED",
        copy: `Eli created <strong>${id}</strong> from Command.`,
        type: "USER",
      },
      ...current,
    ]);
    setSelectedId(id);
    setNewOpen(false);
  }

  function resolveAuthorization(
    id: string,
    decision: "approved" | "held",
  ) {
    const request = authorizations.find((item) => item.id === id);
    setAuthorizations((current) =>
      current.map((item) =>
        item.id === id ? { ...item, state: decision } : item,
      ),
    );
    if (request) {
      setLog((current) => [
        {
          time: utcClock(),
          actor: "ED",
          copy: `Eli ${decision} <strong>${id}</strong> for ${request.system}.`,
          type: "AUTH",
        },
        ...current,
      ]);
    }
  }

  function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = comment.trim();
    if (!body || !selected) return;
    setObjectives((current) =>
      current.map((objective) =>
        objective.id === selected.id
          ? {
              ...objective,
              comments: [
                ...objective.comments,
                { author: "ELI", body, time: utcClock() },
              ],
            }
          : objective,
      ),
    );
    setComment("");
    setLog((current) => [
      {
        time: utcClock(),
        actor: "ED",
        copy: `Eli commented on <strong>${selected.id}</strong>.`,
        type: "USER",
      },
      ...current,
    ]);
  }

  return (
    <div className={`terminus-shell ${navOpen ? "nav-open" : ""}`}>
      <button
        className="sidebar-scrim"
        type="button"
        aria-label="Close navigation"
        onClick={() => setNavOpen(false)}
      />
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <div className="brand-copy">
            <div className="brand-name">Terminus</div>
            <div className="micro">Operations system // V1</div>
          </div>
        </div>

        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="nav-label">{group.label}</div>
            <nav className="nav">
              {group.items.map(([glyph, label, count]) => (
                <button
                  className={`nav-item ${label === view ? "active" : ""}`}
                  key={label}
                  type="button"
                  title={label}
                  onClick={() => {
                    setView(label);
                    setSelectedId(null);
                    setNavOpen(false);
                  }}
                >
                  <span className="nav-glyph" aria-hidden="true">
                    {glyph}
                  </span>
                  <span>{label}</span>
                  {count && <span className="nav-count">{count}</span>}
                </button>
              ))}
            </nav>
          </div>
        ))}

        <div className="operator-card">
          <div className="operator-stripes">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="operator-body">
            <div className="avatar">ED</div>
            <div>
              <div className="micro">Administrator</div>
              <div className="display-face">Eli Dean</div>
            </div>
            <span className="status-dot" title="Online" />
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            type="button"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
          >
            ≡
          </button>
          <div className="topbar-title">
            <strong>{view}</strong>
            <span className="micro">{viewCodes[view] ?? "SYS // 000"}</span>
          </div>
          <label className="command-search">
            <span className="search-token" aria-hidden="true">
              ⌕
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search missions, objectives, archives..."
              aria-label="Search Terminus"
            />
            <span className="keycap">⌘ K</span>
          </label>
          <div className="topbar-actions">
            <button className="icon-button" type="button" title="Signals">
              ◌
            </button>
            <button
              className="primary-button new-objective"
              type="button"
              onClick={() => setNewOpen(true)}
            >
              <span aria-hidden="true">+</span>
              <span className="btn-label">New objective</span>
            </button>
          </div>
        </header>

        <main className="content">
          {view === "Command" && (
          <>
          <section className="command-heading">
            <div className="heading-copy">
              <div className="eyebrow">Operational control // online</div>
              <h1>Command</h1>
              <p>
                Current operational picture across missions, objectives,
                protocols, connected modules, and Pantheon agent activity.
              </p>
            </div>
            <div className="heading-telemetry">
              <div className="spectrum" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="telemetry-body">
                <div>
                  <div className="micro">Coordinated universal time</div>
                  <div className="timestamp" suppressHydrationWarning>
                    {clock} UTC
                  </div>
                  <div className="telemetry-grid">
                    <div>
                      <span className="micro">Cycle</span>
                      <span className="telemetry-value">2026.205</span>
                    </div>
                    <div>
                      <span className="micro">Node</span>
                      <span className="telemetry-value">TERM-01</span>
                    </div>
                    <div>
                      <span className="micro">Clearance</span>
                      <span className="telemetry-value">ADMIN</span>
                    </div>
                    <div>
                      <span className="micro">Agent mesh</span>
                      <span className="telemetry-value">6 / 7 READY</span>
                    </div>
                  </div>
                </div>
                <Scanner node="TERM-01" left="RDY" right="HOLD" />
              </div>
            </div>
          </section>

          <HazardBar label="Operations" />

          <section className="stats" aria-label="Operational summary">
            <Stat
              label="Active missions"
              value="04"
              note="+1 this cycle"
              code="MIS.ACT"
              dot="blue"
            />
            <Stat
              label="Open objectives"
              value={String(
                objectives.filter((item) => item.status !== "done").length,
              ).padStart(2, "0")}
              note="5 due this week"
              code="OBJ.OPN"
            />
            <Stat
              label="Overdue"
              value={String(
                objectives.filter((item) => item.overdue).length,
              ).padStart(2, "0")}
              note="Operator action"
              code="OBJ.OVR"
              dot="danger"
            />
            <Stat
              label="Authorization"
              value={String(pendingAuth.length).padStart(2, "0")}
              note="Awaiting review"
              code="AUTH.PND"
              dot="warning"
            />
            <Stat
              label="Protocol health"
              value="96%"
              note="8 active // 0 failed"
              code="PRT.HLT"
            />
          </section>

          <section className="workspace-grid">
            <div className="panel">
              <div className="panel-header">
                <div className="panel-heading">
                  <h2>Priority objectives</h2>
                  <p>Current execution queue and readiness state</p>
                </div>
                <span className="panel-code">OBJ // LIVE</span>
                <button
                  className="tiny-button"
                  type="button"
                  onClick={() => setNewOpen(true)}
                >
                  Add
                </button>
              </div>
              <div className="filters">
                {(
                  [
                    ["all", "All objectives"],
                    ["active", "Active"],
                    ["review", "In review"],
                    ["blocked", "Blocked"],
                    ["queued", "Queued"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    className={`filter-button ${filter === value ? "active" : ""}`}
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {filteredObjectives.length ? (
                <table className="objective-table">
                  <thead>
                    <tr>
                      <th style={{ width: "39%" }}>Objective</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Assigned</th>
                      <th>Due</th>
                      <th>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredObjectives.map((objective) => (
                      <tr
                        className={`objective-row ${
                          selectedId === objective.id ? "selected" : ""
                        }`}
                        key={objective.id}
                        onClick={() => {
                          setSelectedId(objective.id);
                          setActiveTab("overview");
                        }}
                      >
                        <td>
                          <div className="objective-main">
                            <span className="objective-marker">
                              {objective.status === "done" ? "✓" : "□"}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div className="objective-title">
                                {objective.title}
                              </div>
                              <span className="objective-id">
                                {objective.id}
                                {" // "}
                                {objective.mission}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${objective.status}`}>
                            {statusLabels[objective.status]}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`priority ${objective.priority.toLowerCase()}`}
                          >
                            {objective.priority}
                          </span>
                        </td>
                        <td>
                          <span className="assignee">{objective.assignee}</span>
                        </td>
                        <td>
                          <span
                            className={`due ${
                              objective.overdue ? "overdue" : ""
                            }`}
                          >
                            {objective.dueLabel}
                          </span>
                        </td>
                        <td>
                          <span>{objective.progress}%</span>
                          <div className="progress-track">
                            <div
                              className="progress-fill"
                              style={{ width: `${objective.progress}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  No objectives match this filter.
                </div>
              )}
              <div className="panel-footer">
                <span>{filteredObjectives.length} records visible</span>
                <Barcode value="OBJ-REG-2026" bars={58} height={16} />
              </div>
            </div>

            <aside className="panel">
              <div className="panel-header">
                <div className="panel-heading">
                  <h2>Command authorization</h2>
                  <p>Sensitive actions awaiting operator decision</p>
                </div>
                <span className="panel-code">AUTH // {pendingAuth.length}</span>
              </div>
              <div className="authorization-list">
                {authorizations.map((request) => (
                  <div
                    className={`authorization-card ${request.risk}`}
                    key={request.id}
                  >
                    <div className="auth-top">
                      <span className={`risk ${request.risk}`}>
                        {request.risk} risk
                      </span>
                      <span className="micro">{request.id}</span>
                    </div>
                    <h3>{request.title}</h3>
                    <p>{request.detail}</p>
                    <div className="micro" style={{ marginTop: 9 }}>
                      {request.actor} → {request.system}
                    </div>
                    {request.state === "pending" ? (
                      <div className="auth-actions">
                        <button
                          className="primary-button"
                          type="button"
                          onClick={() =>
                            resolveAuthorization(request.id, "approved")
                          }
                        >
                          Approve
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() =>
                            resolveAuthorization(request.id, "held")
                          }
                        >
                          Hold
                        </button>
                      </div>
                    ) : (
                      <div
                        className="auth-approved"
                        style={
                          request.state === "held"
                            ? {
                                borderColor: "var(--warning)",
                                color: "var(--warning)",
                              }
                            : undefined
                        }
                      >
                        {request.state}
                        {" // decision logged"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </aside>
          </section>

          <section className="lower-grid">
            <div className="panel">
              <div className="panel-header">
                <div className="panel-heading">
                  <h2>Mission log</h2>
                  <p>Immutable operational event stream</p>
                </div>
                <span className="panel-code">EVT // APPEND</span>
              </div>
              <div className="log-list">
                {log.map((item, index) => (
                  <div className="log-item" key={`${item.time}-${index}`}>
                    <span className="log-time">{item.time}</span>
                    <span className="log-actor">{item.actor}</span>
                    <span
                      className="log-copy"
                      dangerouslySetInnerHTML={{ __html: item.copy }}
                    />
                    <span className="badge">{item.type}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel">
              <div className="panel-header">
                <div className="panel-heading">
                  <h2>System array</h2>
                  <p>Core infrastructure and module telemetry</p>
                </div>
                <span className="panel-code">SYS // NOMINAL</span>
              </div>
              <div className="systems">
                <System name="Supabase" state="Nominal" signal={98} />
                <System name="Redis queue" state="Nominal" signal={94} />
                <System name="n8n protocols" state="Nominal" signal={91} />
                <System name="Ollama inference" state="Standby" signal={63} />
                <System name="GitHub module" state="Standby" signal={38} />
              </div>
              <div className="panel-footer">
                <span>Last health sweep // 06:13 UTC</span>
                <Barcode value="SYS-HLTH-06" bars={52} height={16} />
              </div>
            </div>
          </section>
          </>
          )}

          {view === "Missions" && <MissionsView />}
          {view === "Objectives" && (
            <ObjectivesView
              objectives={objectives}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setActiveTab("overview");
              }}
            />
          )}
          {view === "Signals" && <SignalsView />}
          {view === "Mission Log" && <MissionLogView log={log} />}
          {view === "Archives" && <ArchivesView />}
          {view === "Modules" && <ModulesView />}
          {view === "Protocols" && <ProtocolsView />}
          {view === "Authorization" && (
            <AuthorizationView
              authorizations={authorizations}
              onResolve={resolveAuthorization}
            />
          )}
          {view === "Terminus Core" && <CoreView />}
        </main>
      </div>

      {selected && (
        <>
          <button
            className="inspector-backdrop"
            aria-label="Close objective inspector"
            onClick={() => setSelectedId(null)}
          />
          <aside className="inspector" aria-label="Objective inspector">
            <div className="inspector-label">
              <div className="inspector-label-band" />
              <div className="inspector-label-copy">
                <div className="micro">
                  Objective record // {selected.mission}
                </div>
                <h2>{selected.title}</h2>
              </div>
              <div className="label-code">
                <button
                  className="inspector-close"
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label="Close inspector"
                >
                  ×
                </button>
                <strong>{selected.id.replace("OBJ-", "")}</strong>
                <Barcode value={selected.id} bars={32} height={14} code={false} />
              </div>
            </div>
            <div className="inspector-body">
              <div className="inspector-tabs">
                {["overview", "activity", "comments", "links"].map((tab) => (
                  <button
                    type="button"
                    className={activeTab === tab ? "active" : ""}
                    onClick={() => setActiveTab(tab)}
                    key={tab}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === "overview" && (
                <>
                  <div className="property-grid">
                    <div className="property">
                      <label htmlFor="objective-status">Status</label>
                      <select
                        id="objective-status"
                        value={selected.status}
                        onChange={(event) =>
                          updateObjective(selected.id, {
                            status: event.target.value as ObjectiveStatus,
                          })
                        }
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="property">
                      <label htmlFor="objective-priority">Priority</label>
                      <select
                        id="objective-priority"
                        value={selected.priority}
                        onChange={(event) =>
                          updateObjective(selected.id, {
                            priority: event.target.value as Priority,
                          })
                        }
                      >
                        <option>P0</option>
                        <option>P1</option>
                        <option>P2</option>
                      </select>
                    </div>
                    <div className="property">
                      <label>Assigned entity</label>
                      <div>
                        {selected.assignee}
                        {" // AUTHENTICATED"}
                      </div>
                    </div>
                    <div className="property">
                      <label htmlFor="objective-due">Due date</label>
                      <input
                        id="objective-due"
                        type="date"
                        value={selected.due}
                        onChange={(event) =>
                          updateObjective(selected.id, {
                            due: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="objective-description">
                    <div className="micro">Objective brief</div>
                    <p>{selected.description}</p>
                  </div>
                  <div className="ai-brief">
                    <div className="micro">
                      Terminus Core // current assessment
                    </div>
                    <p>{selected.aiSummary}</p>
                  </div>
                </>
              )}

              {activeTab === "activity" && (
                <div className="comment-stream">
                  {log.slice(0, 5).map((item, index) => (
                    <div className="comment-item" key={`${item.time}-${index}`}>
                      <strong>{item.time}</strong>{" "}
                      <span
                        dangerouslySetInnerHTML={{ __html: item.copy }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "comments" && (
                <>
                  <div className="comment-stream">
                    {selected.comments.length ? (
                      selected.comments.map((item, index) => (
                        <div className="comment-item" key={`${item.time}-${index}`}>
                          <strong>{item.author}</strong>
                          {" // "}
                          {item.time}
                          <br />
                          {item.body}
                        </div>
                      ))
                    ) : (
                      <div className="comment-item">No comments recorded.</div>
                    )}
                  </div>
                  <form className="comment-form" onSubmit={addComment}>
                    <input
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder="Add operational note..."
                      aria-label="Comment"
                    />
                    <button className="primary-button" type="submit">
                      Log
                    </button>
                  </form>
                </>
              )}

              {activeTab === "links" && (
                <div className="link-stream">
                  {selected.links.length ? (
                    selected.links.map((item) => (
                      <div className="link-item" key={item.label}>
                        <span className="micro">{item.type}</span>
                        <br />
                        <strong>{item.label}</strong>
                      </div>
                    ))
                  ) : (
                    <div className="link-item">No linked records.</div>
                  )}
                  <div className="link-item">
                    <span className="micro">Attachment interface</span>
                    <br />
                    File and archive linking prepared for Supabase Storage.
                  </div>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {newOpen && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={addObjective}>
            <div className="modal-label">
              <div>
                <div className="micro" style={{ color: "#2c3335" }}>
                  Record generation // manual
                </div>
                <h2>New objective</h2>
              </div>
              <div className="barcode" style={{ backgroundColor: "transparent" }} />
            </div>
            <div className="modal-body">
              <div className="field">
                <label htmlFor="new-title">Objective title</label>
                <input
                  id="new-title"
                  name="title"
                  autoFocus
                  required
                  placeholder="Define the desired outcome"
                />
              </div>
              <div className="field">
                <label htmlFor="new-description">Brief</label>
                <textarea
                  id="new-description"
                  name="description"
                  placeholder="Scope, constraints, and expected result"
                />
              </div>
              <div className="modal-grid">
                <div className="field">
                  <label htmlFor="new-mission">Mission</label>
                  <select id="new-mission" name="mission">
                    <option>TERMINUS CORE</option>
                    <option>MODULE ARRAY</option>
                    <option>PANTHEON LINK</option>
                    <option>ARCHIVES</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="new-priority">Priority</label>
                  <select id="new-priority" name="priority" defaultValue="P1">
                    <option>P0</option>
                    <option>P1</option>
                    <option>P2</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="new-due">Due date</label>
                  <input
                    id="new-due"
                    name="due"
                    type="date"
                    defaultValue="2026-08-01"
                  />
                </div>
                <div className="field">
                  <label>Assignment</label>
                  <input value="ELI DEAN // ED" readOnly />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setNewOpen(false)}
              >
                Cancel
              </button>
              <button className="primary-button" type="submit">
                Create objective
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  code,
  dot = "",
}: {
  label: string;
  value: string;
  note: string;
  code: string;
  dot?: string;
}) {
  return (
    <div className="stat-card" data-code={code}>
      <div className="stat-top">
        <span>{label}</span>
        <span className={`status-dot ${dot}`} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </div>
  );
}

function System({
  name,
  state,
  signal,
}: {
  name: string;
  state: string;
  signal: number;
}) {
  return (
    <div className="system-row">
      <span className="system-name">{name}</span>
      <span className={`system-state ${state.toLowerCase()}`}>{state}</span>
      <span className="signal-line">
        <span style={{ width: `${signal}%` }} />
      </span>
    </div>
  );
}
