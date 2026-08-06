// Live data layer. Reads the Terminus schema through the publishable client
// (RLS enforces per-organization access) and maps rows to the shapes the
// views already consume, so wiring live data doesn't disturb the UI.
//
// Everything is defensive: any failure resolves to null/empty and the caller
// falls back to sample data, so the app never shows a broken screen.

import { supabase } from "./supabase";

/* ------------------------------------------------------------------ shapes */

export type LiveObjective = {
  id: string;
  uuid: string;
  title: string;
  description: string;
  mission: string;
  status: string;
  priority: string;
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

export type LiveMission = {
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

export type LiveApproval = {
  id: string;
  uuid: string;
  actor: string;
  title: string;
  detail: string;
  risk: string;
  system: string;
  state: string;
};

export type LiveLogEntry = {
  time: string;
  actor: string;
  copy: string;
  type: string;
};

export type LiveSignal = {
  id: string;
  severity: string;
  source: string;
  title: string;
  detail: string;
  time: string;
};

export type LiveModule = {
  name: string;
  category: string;
  state: "nominal" | "standby" | "offline";
  signal: number;
  detail: string;
  caps: string[];
};

export type LiveProtocol = {
  id: string;
  name: string;
  trigger: string;
  schedule: string;
  lastRun: string;
  state: "ok" | "flagged" | "running" | "pending";
  runs: number;
};

export type LiveAgent = {
  name: string;
  role: string;
  fn: string;
  state: "ready" | "held";
  clearance: string;
};

export type Workspace = {
  orgId: string;
  objectives: LiveObjective[];
  missions: LiveMission[];
  approvals: LiveApproval[];
  log: LiveLogEntry[];
  signals: LiveSignal[];
  modules: LiveModule[];
  protocols: LiveProtocol[];
  agents: LiveAgent[];
};

/* ------------------------------------------------------------- formatters */

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function dueLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`;
}

function hhmmss(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour12: false,
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function hhmm(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour12: false,
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(code: string | null | undefined, fallback = "—"): string {
  if (!code) return fallback;
  const trimmed = code.replace(/[^A-Za-z]/g, "");
  return (trimmed.slice(0, 2) || fallback).toUpperCase();
}

function isOverdue(iso: string | null, status: string): boolean {
  if (!iso || status === "done" || status === "cancelled") return false;
  return new Date(iso).getTime() < Date.now();
}

/* --------------------------------------------------------------- org lookup */

/** The current user's first active organization, or null if none. */
export async function resolveOrg(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("state", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.organization_id as string;
}

/* ------------------------------------------------------------------- reads */

async function loadObjectives(orgId: string): Promise<LiveObjective[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("objectives")
    .select(
      `id, code, title, description, status, priority, due_at, progress, position, ai_summary,
       owner_agent:agents!objectives_owner_agent_id_fkey(code),
       owner_user_id,
       mission:missions!objectives_mission_id_fkey(code, name),
       comments(body, created_at, author_user_id, author_agent:agents!comments_author_agent_id_fkey(code)),
       record_links(link_type, label)`,
    )
    .eq("organization_id", orgId)
    .order("position", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false });
  if (error || !data) return [];
  return data.map((row: Record<string, any>) => ({
    id: row.code,
    uuid: row.id,
    title: row.title,
    description: row.description ?? "",
    mission: row.mission?.name ?? row.mission?.code ?? "UNASSIGNED",
    status: row.status,
    priority: row.priority,
    assignee: initials(row.owner_agent?.code, row.owner_user_id ? "OP" : "—"),
    due: row.due_at ?? "",
    dueLabel: dueLabel(row.due_at),
    overdue: isOverdue(row.due_at, row.status),
    progress: row.progress ?? 0,
    position: row.position ?? undefined,
    aiSummary: row.ai_summary ?? "",
    comments: (row.comments ?? [])
      .sort((a: any, b: any) => (a.created_at < b.created_at ? -1 : 1))
      .map((c: any) => ({
        author: c.author_agent?.code ?? (c.author_user_id ? "OPERATOR" : "SYSTEM"),
        body: c.body,
        time: hhmm(c.created_at),
      })),
    links: (row.record_links ?? []).map((l: any) => ({
      type: (l.link_type ?? "LINK").toUpperCase(),
      label: l.label,
    })),
  }));
}

async function loadMissions(
  orgId: string,
  objectives: LiveObjective[],
): Promise<LiveMission[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("missions")
    .select(
      `code, name, description, status, due_at,
       owner_agent:agents!missions_owner_agent_id_fkey(code), owner_user_id`,
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];

  const statusMap: Record<string, LiveMission["status"]> = {
    planned: "planning",
    active: "active",
    paused: "planning",
    blocked: "blocked",
    complete: "complete",
    archived: "complete",
  };

  return data.map((row: Record<string, any>) => {
    const own = objectives.filter((o) => o.mission === (row.name ?? row.code));
    const open = own.filter((o) => o.status !== "done").length;
    const progress = own.length
      ? Math.round(own.reduce((s, o) => s + o.progress, 0) / own.length)
      : 0;
    const agents = [
      ...new Set(
        own
          .map((o) => o.assignee)
          .filter((a) => a && a !== "—" && a !== "OP"),
      ),
    ];
    return {
      id: row.code,
      name: row.name,
      brief: row.description ?? "",
      status: statusMap[row.status] ?? "planning",
      progress,
      objectives: own.length,
      open,
      lead: initials(row.owner_agent?.code, row.owner_user_id ? "OP" : "—"),
      agents,
      due: dueLabel(row.due_at),
    };
  });
}

async function loadApprovals(orgId: string): Promise<LiveApproval[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("approval_requests")
    .select(
      `id, code, action_type, reason, systems_affected, risk, state, requested_by_type`,
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  const riskMap: Record<string, string> = {
    low: "medium",
    medium: "medium",
    high: "high",
    critical: "high",
  };
  const stateMap: Record<string, string> = {
    pending: "pending",
    approved: "approved",
    executed: "approved",
    held: "held",
    rejected: "held",
    expired: "held",
    failed: "held",
  };

  return data.map((row: Record<string, any>) => ({
    id: row.code,
    uuid: row.id,
    actor: String(row.requested_by_type ?? "SYSTEM").toUpperCase(),
    title: row.action_type,
    detail: row.reason ?? "",
    risk: riskMap[row.risk] ?? "medium",
    system: (row.systems_affected?.[0] as string) ?? "TERMINUS",
    state: stateMap[row.state] ?? "pending",
  }));
}

async function loadLog(orgId: string): Promise<LiveLogEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("mission_log")
    .select("event_type, actor_type, occurred_at, message")
    .eq("organization_id", orgId)
    .order("occurred_at", { ascending: false })
    .limit(40);
  if (error || !data) return [];
  return data.map((row: Record<string, any>) => ({
    time: hhmmss(row.occurred_at),
    actor: String(row.actor_type ?? "SYS").slice(0, 3).toUpperCase(),
    copy: escapeHtml(row.message ?? row.event_type ?? ""),
    type: String(row.actor_type ?? "system").toUpperCase(),
  }));
}

async function loadSignals(orgId: string): Promise<LiveSignal[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("signals")
    .select("id, type, severity, title, body, source_type, created_at")
    .eq("organization_id", orgId)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error || !data) return [];
  const sevMap: Record<string, string> = {
    critical: "critical",
    error: "warning",
    warning: "warning",
    info: "info",
  };
  return data.map((row: Record<string, any>) => ({
    id: row.id,
    severity: sevMap[row.severity] ?? "info",
    source: String(row.source_type ?? row.type ?? "SYSTEM").toUpperCase(),
    title: row.title,
    detail: row.body ?? "",
    time: hhmmss(row.created_at),
  }));
}

async function loadModules(): Promise<LiveModule[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("modules")
    .select("name, manifest, enabled")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  const states = new Set(["nominal", "standby", "offline"]);
  return data.map((row: Record<string, any>) => {
    const m = row.manifest ?? {};
    const state = states.has(m.state) ? m.state : row.enabled ? "nominal" : "offline";
    return {
      name: row.name,
      category: String(m.category ?? "MODULE").toUpperCase(),
      state: state as LiveModule["state"],
      signal: typeof m.signal === "number" ? m.signal : 0,
      detail: m.detail ?? "",
      caps: Array.isArray(m.caps) ? m.caps.map((c: any) => String(c)) : [],
    };
  });
}

async function loadProtocols(orgId: string): Promise<LiveProtocol[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("protocols")
    .select("code, name, definition, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  const states = new Set(["ok", "flagged", "running", "pending"]);
  return data.map((row: Record<string, any>) => {
    const d = row.definition ?? {};
    return {
      id: row.code,
      name: row.name,
      trigger: String(d.trigger ?? "MANUAL").toUpperCase(),
      schedule: d.schedule ?? "—",
      lastRun: d.lastRun ?? "—",
      state: (states.has(d.state) ? d.state : "pending") as LiveProtocol["state"],
      runs: typeof d.runs === "number" ? d.runs : 0,
    };
  });
}

async function loadAgents(orgId: string): Promise<LiveAgent[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("agents")
    .select("code, name, description, state, maximum_autonomous_risk, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  const clearanceMap: Record<string, string> = {
    critical: "RESTRICTED",
    high: "RESTRICTED",
    medium: "OPERATOR",
    low: "OBSERVER",
  };
  return data.map((row: Record<string, any>) => {
    const desc = String(row.description ?? "");
    const [rolePart, ...rest] = desc.split(/\s[—-]\s/);
    const role = rest.length ? rolePart.trim() : "Agent";
    const fn = rest.length ? rest.join(" — ").trim() : desc;
    return {
      name: String(row.code ?? row.name).toUpperCase(),
      role,
      fn,
      state: row.state === "active" ? "ready" : "held",
      clearance: clearanceMap[row.maximum_autonomous_risk] ?? "OBSERVER",
    };
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

/** Load the whole workspace for the current org, or null if unavailable. */
export async function loadWorkspace(): Promise<Workspace | null> {
  if (!supabase) return null;
  const orgId = await resolveOrg();
  if (!orgId) return null;
  try {
    const objectives = await loadObjectives(orgId);
    const [missions, approvals, log, signals, modules, protocols, agents] =
      await Promise.all([
        loadMissions(orgId, objectives),
        loadApprovals(orgId),
        loadLog(orgId),
        loadSignals(orgId),
        loadModules(),
        loadProtocols(orgId),
        loadAgents(orgId),
      ]);
    return {
      orgId,
      objectives,
      missions,
      approvals,
      log,
      signals,
      modules,
      protocols,
      agents,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ writes */

export async function dbCreateObjective(input: {
  orgId: string;
  title: string;
  description: string;
  priority: string;
  due: string | null;
  missionName: string;
}): Promise<LiveObjective | null> {
  if (!supabase) return null;
  // Resolve the mission by name within the org (optional).
  let missionId: string | null = null;
  const { data: mission } = await supabase
    .from("missions")
    .select("id")
    .eq("organization_id", input.orgId)
    .eq("name", input.missionName)
    .maybeSingle();
  missionId = mission?.id ?? null;

  const { data, error } = await supabase
    .from("objectives")
    .insert({
      organization_id: input.orgId,
      mission_id: missionId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      due_at: input.due,
      owner_user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
    })
    .select("id, code")
    .single();
  if (error || !data) return null;
  return {
    id: data.code,
    uuid: data.id,
    title: input.title,
    description: input.description,
    mission: input.missionName,
    status: "queued",
    priority: input.priority,
    assignee: "OP",
    due: input.due ?? "",
    dueLabel: dueLabel(input.due),
    overdue: false,
    progress: 0,
    aiSummary: "",
    comments: [],
    links: [],
  };
}

export async function dbUpdateObjective(
  uuid: string,
  patch: { status?: string; priority?: string; due_at?: string | null },
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("objectives").update(patch).eq("id", uuid);
  return !error;
}

export async function dbSetObjectivePosition(
  uuid: string,
  position: number,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("objectives")
    .update({ position })
    .eq("id", uuid);
  return !error;
}

export async function dbResolveApproval(
  uuid: string,
  decision: "approved" | "held",
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("approval_requests")
    .update({
      state: decision,
      decided_at: new Date().toISOString(),
      decided_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    })
    .eq("id", uuid);
  return !error;
}

export async function dbAddComment(input: {
  orgId: string;
  objectiveUuid: string;
  body: string;
}): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("comments").insert({
    organization_id: input.orgId,
    objective_id: input.objectiveUuid,
    author_user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
    body: input.body,
  });
  return !error;
}

export async function dbAckSignal(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("signals")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}
