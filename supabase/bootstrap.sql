-- Terminus bootstrap — run ONCE, in the Supabase SQL Editor, after:
--   1. the core migration (0001_core_domain.sql) has been applied, and
--   2. you have signed up in the app (so your auth user exists).
--
-- It creates your organization (a trigger auto-makes you administrator),
-- the Pantheon agents, and a starter set of missions / objectives /
-- authorizations / signals so the app shows real records immediately.
--
-- EDIT THIS EMAIL if you signed up with a different address:
--   set the value in v_email below.

do $$
declare
  v_email      text := 'tockrellman@gmail.com';
  v_user_id    uuid;
  v_org_id     uuid;
  v_agent_role uuid;
  v_odin       uuid;
  v_loki       uuid;
  v_heimdall   uuid;
  v_muninn     uuid;
  v_m_core     uuid;
  v_m_mod      uuid;
  v_m_pan      uuid;
  v_m_arc      uuid;
begin
  select id into v_user_id from auth.users where email = v_email limit 1;
  if v_user_id is null then
    raise exception 'No auth user found for %. Sign up in the app first, then re-run.', v_email;
  end if;

  -- Skip if this account already bootstrapped an organization.
  if exists (select 1 from public.organizations where created_by = v_user_id) then
    raise notice 'Organization already exists for %, nothing to do.', v_email;
    return;
  end if;

  insert into public.organizations (code, name, description, created_by)
  values ('NORTHFIRN', 'Northfirn Command',
          'Primary Terminus operations organization.', v_user_id)
  returning id into v_org_id;
  -- trigger organizations_bootstrap_admin makes v_user_id an administrator

  select id into v_agent_role from public.roles where code = 'agent';

  insert into public.agents (organization_id, code, name, role_id, state, maximum_autonomous_risk, description)
  values
    (v_org_id, 'ODIN', 'Odin', v_agent_role, 'active', 'medium', 'Coordinator — planning and issue authoring.'),
    (v_org_id, 'LOKI', 'Loki', v_agent_role, 'standby', 'low', 'Executor — gated remote and module actions.'),
    (v_org_id, 'HEIMDALL', 'Heimdall', v_agent_role, 'active', 'low', 'Sentinel — monitoring and SLA watch.'),
    (v_org_id, 'MUNINN', 'Muninn', v_agent_role, 'active', 'medium', 'Memory — retrieval and archive embedding.');
  select id into v_odin     from public.agents where organization_id = v_org_id and code = 'ODIN';
  select id into v_loki     from public.agents where organization_id = v_org_id and code = 'LOKI';
  select id into v_heimdall from public.agents where organization_id = v_org_id and code = 'HEIMDALL';
  select id into v_muninn   from public.agents where organization_id = v_org_id and code = 'MUNINN';

  -- Missions (codes auto-assign as MIS-000x)
  insert into public.missions (organization_id, name, description, status, priority, due_at, owner_user_id, created_by)
  values (v_org_id, 'Terminus Core',
          'Foundational platform — domain schema, authorization, immutable events, retrieval.',
          'active', 'P0', now() + interval '18 days', v_user_id, v_user_id)
  returning id into v_m_core;

  insert into public.missions (organization_id, name, description, status, priority, due_at, owner_agent_id, created_by)
  values (v_org_id, 'Module Array',
          'Integration adapters against the standard trigger / action / health contract.',
          'active', 'P1', now() + interval '34 days', v_odin, v_user_id)
  returning id into v_m_mod;

  insert into public.missions (organization_id, name, description, status, priority, due_at, owner_agent_id, created_by)
  values (v_org_id, 'Pantheon Link',
          'Agent mesh coordination and remote execution safeguards for gated actions.',
          'blocked', 'P0', now() + interval '41 days', v_heimdall, v_user_id)
  returning id into v_m_pan;

  insert into public.missions (organization_id, name, description, status, priority, due_at, owner_agent_id, created_by)
  values (v_org_id, 'Archive Index',
          'Knowledge base capture with semantic retrieval through Terminus Core.',
          'active', 'P2', now() + interval '25 days', v_muninn, v_user_id)
  returning id into v_m_arc;

  insert into public.missions (organization_id, name, description, status, priority, due_at, owner_agent_id, created_by)
  values (v_org_id, 'Signal Grid',
          'Monitoring, SLA watch, and anomaly signalling across missions and modules.',
          'planned', 'P2', now() + interval '48 days', v_heimdall, v_user_id);

  -- Objectives (codes auto-assign as OBJ-0000x)
  insert into public.objectives
    (organization_id, mission_id, title, description, status, priority, due_at, progress, ai_summary, owner_user_id, created_by)
  values
    (v_org_id, v_m_core, 'Finalize immutable event pipeline',
     'Define the domain event envelope, transactional outbox, retry behavior, and append-only audit controls for operational actions.',
     'active', 'P0', now() + interval '2 days', 72,
     'Core envelope is stable. The remaining risk is replay idempotency across module actions.',
     v_user_id, v_user_id);

  insert into public.objectives
    (organization_id, mission_id, title, description, status, priority, due_at, progress, ai_summary, owner_agent_id, created_by)
  values
    (v_org_id, v_m_core, 'Map Supabase RLS to explicit roles',
     'Implement organization membership, role assignment, permission checks, and row policies for people and non-human agents.',
     'review', 'P0', now() + interval '3 days', 88,
     'Administrator and Operator paths are covered. Agent permissions need separate grants.',
     v_heimdall, v_user_id),
    (v_org_id, v_m_mod, 'Build GitHub module adapter',
     'Create the first module implementation using the standard trigger, action, health, authentication, and audit interfaces.',
     'queued', 'P1', now() + interval '6 days', 18,
     'The adapter can begin after the plugin contract is frozen.',
     v_odin, v_user_id),
    (v_org_id, v_m_pan, 'Define remote execution safeguards',
     'Document and enforce the approval, scope, timeout, credential, and reversal requirements for LOKI remote operations.',
     'blocked', 'P0', now() - interval '2 days', 41,
     'Blocked pending a decision on command allowlists.',
     v_heimdall, v_user_id),
    (v_org_id, v_m_arc, 'Index operating procedures',
     'Chunk, embed, and index internal procedures for semantic retrieval through Terminus Core.',
     'active', 'P2', now() + interval '8 days', 56,
     'Document extraction is ready. Add source version metadata before embeddings are generated.',
     v_muninn, v_user_id);

  -- Command authorizations
  insert into public.approval_requests
    (organization_id, code, action_type, requested_by_type, requested_by_id, reason, systems_affected, expected_result, risk, state)
  values
    (v_org_id, 'AUTH-019', 'Create GitHub issue set', 'agent', v_odin,
     'Create four implementation issues in elifrombitlink/terminus from approved objective definitions.',
     array['GITHUB'], 'Four tracked issues created and linked to objectives.', 'medium', 'pending'),
    (v_org_id, 'AUTH-020', 'Run remote health probe', 'agent', v_loki,
     'Execute a read-only Docker service health inspection on the Terminus host.',
     array['REMOTE HOST'], 'Health report returned with no state change.', 'high', 'pending');

  -- Signals
  insert into public.signals (organization_id, type, severity, title, body, source_type)
  values
    (v_org_id, 'sla', 'critical', 'Objective breached SLA',
     'Remote execution safeguards overdue. Blocked on command allowlist decision.', 'HEIMDALL'),
    (v_org_id, 'approval', 'warning', 'High-risk authorization pending',
     'AUTH-020 remote health probe on the Terminus host awaits operator decision.', 'AUTH'),
    (v_org_id, 'module', 'warning', 'Ollama inference degraded',
     'Local inference host on standby at 63% capacity. Non-blocking for current cycle.', 'MODULE'),
    (v_org_id, 'protocol', 'info', 'Nightly health sweep passed',
     'PRT-006 completed across 5 modules. 0 failed checks.', 'PROTOCOL');

  -- Connected modules (global table; manifest carries console display fields)
  insert into public.modules (code, name, provider, version, enabled, manifest) values
    ('supabase', 'Supabase', 'Supabase', '2.x', true,
      jsonb_build_object('category','DATA','state','nominal','signal',98,
        'detail','Postgres, authentication, row-level security, and pgvector store.',
        'caps', jsonb_build_array('QUERY','AUTH','VECTOR'))),
    ('redis-queue', 'Redis queue', 'Redis', '7.x', true,
      jsonb_build_object('category','QUEUE','state','nominal','signal',94,
        'detail','Job transport and rate-limited action dispatch for protocols.',
        'caps', jsonb_build_array('ENQUEUE','DISPATCH'))),
    ('n8n-protocols', 'n8n protocols', 'n8n', '1.x', true,
      jsonb_build_object('category','AUTOMATION','state','nominal','signal',91,
        'detail','Workflow automation runner for scheduled and triggered protocols.',
        'caps', jsonb_build_array('TRIGGER','RUN','WEBHOOK'))),
    ('ollama-inference', 'Ollama inference', 'Ollama', '0.x', true,
      jsonb_build_object('category','INFERENCE','state','standby','signal',63,
        'detail','Local model host for private inference. On standby at reduced capacity.',
        'caps', jsonb_build_array('GENERATE','EMBED'))),
    ('github', 'GitHub module', 'GitHub', '1.x', true,
      jsonb_build_object('category','SCM','state','standby','signal',38,
        'detail','Repository health, issue reads, and gated draft issue creation.',
        'caps', jsonb_build_array('HEALTH','ISSUE.READ','ISSUE.DRAFT'))),
    ('pgvector', 'pgvector', 'Supabase', '0.7', true,
      jsonb_build_object('category','MEMORY','state','nominal','signal',90,
        'detail','Embedding store backing archive retrieval and agent memory.',
        'caps', jsonb_build_array('UPSERT','SEARCH')))
  on conflict (code) do nothing;

  -- Protocols (org-scoped; definition carries runner display fields)
  insert into public.protocols (organization_id, code, name, description, enabled, risk, definition) values
    (v_org_id, 'PRT-006', 'Nightly health sweep', 'Scheduled module health inspection across the mesh.', true, 'low',
      jsonb_build_object('trigger','SCHEDULE','schedule','06:00 UTC · daily','lastRun','06:13 · passed','state','ok','runs',214)),
    (v_org_id, 'PRT-004', 'Objective SLA watch', 'Flags objectives that breach their SLA window.', true, 'medium',
      jsonb_build_object('trigger','EVENT','schedule','on overdue','lastRun','06:14 · flagged OBJ-003.02','state','flagged','runs',1809)),
    (v_org_id, 'PRT-002', 'Event outbox drain', 'Streams domain events from the transactional outbox.', true, 'low',
      jsonb_build_object('trigger','CONTINUOUS','schedule','streaming','lastRun','live · 148 events','state','running','runs',44210)),
    (v_org_id, 'PRT-009', 'Operator digest compile', 'Compiles the daily operator digest.', true, 'low',
      jsonb_build_object('trigger','SCHEDULE','schedule','18:00 UTC · daily','lastRun','18:00 · passed','state','ok','runs',96)),
    (v_org_id, 'PRT-011', 'Archive reindex', 'Rebuilds the archive embedding index.', false, 'low',
      jsonb_build_object('trigger','SCHEDULE','schedule','SUN 03:00 UTC · weekly','lastRun','queued for next window','state','pending','runs',12))
  on conflict (organization_id, code) do nothing;

  raise notice 'Terminus bootstrap complete for %.', v_email;
end $$;
