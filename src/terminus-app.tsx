"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { useTheme } from "./lib/theme";
import { useSession } from "./lib/session";
import {
  loadWorkspace,
  dbCreateObjective,
  dbUpdateObjective,
  dbSetObjectivePosition,
  dbResolveApproval,
  dbAddComment,
  dbAckSignal,
  type LiveMission,
  type LiveSignal,
} from "./lib/data";

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      className="icon-button theme-toggle"
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Dark // switch to light" : "Light // switch to dark"}
    >
      {dark ? (
        // moon
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        // sun
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <circle
            cx="12"
            cy="12"
            r="4.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9" />
          </g>
        </svg>
      )}
    </button>
  );
}

type ObjectiveStatus = "active" | "review" | "blocked" | "queued" | "done";
type Priority = "P0" | "P1" | "P2";

type Objective = {
  id: string;
  uuid?: string;
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
  position?: number;
  aiSummary: string;
  comments: { author: string; body: string; time: string }[];
  links: { type: string; label: string }[];
};

type Authorization = {
  id: string;
  uuid?: string;
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

export function TerminusApp({ onSignOut }: { onSignOut?: () => void } = {}) {
  const { demo, session } = useSession();
  const [view, setView] = useState("Command");
  const [navOpen, setNavOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [missions, setMissions] = useState<LiveMission[] | undefined>(undefined);
  const [signals, setSignals] = useState<LiveSignal[] | undefined>(undefined);
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
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(utcClock()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  // Load live workspace data when a Supabase session and organization exist.
  // On any failure or missing org, the app keeps its sample data.
  useEffect(() => {
    if (demo || !session) return;
    let active = true;
    loadWorkspace().then((ws) => {
      if (!active || !ws) return;
      setLive(true);
      setOrgId(ws.orgId);
      setObjectives(ws.objectives as unknown as typeof initialObjectives);
      setAuthorizations(ws.approvals as unknown as typeof initialAuthorizations);
      setLog(ws.log);
      setMissions(ws.missions);
      setSignals(ws.signals);
    });
    return () => {
      active = false;
    };
  }, [demo, session]);

  // ⌘K / Ctrl-K focuses the command search; Escape clears an open overlay.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (event.key === "Escape") {
        setNewOpen(false);
        setSelectedId(null);
        setNavOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
    const target = objectives.find((objective) => objective.id === id);
    if (target && patch.status && target.status === patch.status) return;
    setObjectives((current) =>
      current.map((objective) =>
        objective.id === id ? { ...objective, ...patch } : objective,
      ),
    );
    if (live && target?.uuid) {
      void dbUpdateObjective(target.uuid, {
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.priority ? { priority: patch.priority } : {}),
        ...(patch.due ? { due_at: patch.due } : {}),
      });
    }
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

  // Manual reorder: move dragId to sit before targetId in the queue, and
  // persist a fractional position between its new neighbours when live.
  function reorderObjective(dragId: string, targetId: string) {
    if (dragId === targetId) return;
    setObjectives((current) => {
      const from = current.findIndex((o) => o.id === dragId);
      const to = current.findIndex((o) => o.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      const insertAt = next.findIndex((o) => o.id === targetId);
      next.splice(insertAt, 0, moved);

      const idx = next.findIndex((o) => o.id === dragId);
      const prev = next[idx - 1]?.position;
      const following = next[idx + 1]?.position;
      let position: number;
      if (prev != null && following != null) position = (prev + following) / 2;
      else if (prev != null) position = prev + 1;
      else if (following != null) position = following - 1;
      else position = idx;
      moved.position = position;

      if (live && moved.uuid) void dbSetObjectivePosition(moved.uuid, position);
      return next;
    });
  }

  async function addObjective(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    if (!title) return;
    const due = String(data.get("due") ?? "2026-08-01");
    const mission = String(data.get("mission") ?? "TERMINUS CORE");
    const priority = String(data.get("priority") ?? "P1") as Priority;
    const description =
      String(data.get("description") ?? "").trim() ||
      "Objective briefing awaiting operator detail.";

    // Live path: persist to Supabase, then use the server-assigned record.
    if (live && orgId) {
      const created = await dbCreateObjective({
        orgId,
        title,
        description,
        priority,
        due: due || null,
        missionName: mission,
      });
      if (created) {
        setObjectives((current) => [created as unknown as Objective, ...current]);
        setSelectedId(created.id);
        setNewOpen(false);
        return;
      }
    }

    const nextNumber = String(objectives.length + 1).padStart(2, "0");
    const id = `OBJ-005.${nextNumber}`;
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
      description,
      mission,
      status: "queued",
      priority,
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
    if (live && request?.uuid) void dbResolveApproval(request.uuid, decision);
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
    if (live && orgId && selected.uuid)
      void dbAddComment({ orgId, objectiveUuid: selected.uuid, body });
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
            {onSignOut ? (
              <button
                className="operator-signout"
                type="button"
                onClick={onSignOut}
                title="Sign out"
                aria-label="Sign out"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                  <path
                    d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2M9 12h11m0 0-3-3m3 3-3 3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : (
              <span className="status-dot" title="Online" />
            )}
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
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search missions, objectives, archives..."
              aria-label="Search Terminus"
            />
            <span className="keycap">⌘ K</span>
          </label>
          <div className="topbar-actions">
            <ThemeToggle />
            <button
              className="icon-button signal-button"
              type="button"
              title="Signals"
              aria-label="Signals"
              onClick={() => {
                setView("Signals");
                setSelectedId(null);
                setNavOpen(false);
              }}
            >
              ◌
              {signals && signals.length > 0 && (
                <span className="icon-badge">{signals.length}</span>
              )}
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

          {view === "Missions" && (
            <MissionsView query={query} missions={missions} />
          )}
          {view === "Objectives" && (
            <ObjectivesView
              objectives={objectives}
              selectedId={selectedId}
              query={query}
              onSelect={(id) => {
                setSelectedId(id);
                setActiveTab("overview");
              }}
              onStatusChange={(id, status) =>
                updateObjective(id, { status: status as ObjectiveStatus })
              }
              onPriorityChange={(id, priority) =>
                updateObjective(id, { priority: priority as Priority })
              }
              onReorder={reorderObjective}
            />
          )}
          {view === "Signals" && (
            <SignalsView
              query={query}
              signals={signals}
              onAck={live ? (id) => void dbAckSignal(id) : undefined}
            />
          )}
          {view === "Mission Log" && <MissionLogView log={log} query={query} />}
          {view === "Archives" && <ArchivesView query={query} />}
          {view === "Modules" && <ModulesView query={query} />}
          {view === "Protocols" && <ProtocolsView query={query} />}
          {view === "Authorization" && (
            <AuthorizationView
              authorizations={authorizations}
              onResolve={resolveAuthorization}
              query={query}
            />
          )}
          {view === "Terminus Core" && <CoreView query={query} />}
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
                <Barcode value={selected.id} bars={16} height={14} code={false} />
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
