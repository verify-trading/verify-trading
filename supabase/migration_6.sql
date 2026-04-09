create table if not exists public.analysis_rules (
  rule_number integer primary key,
  category text not null,
  rule_name text not null,
  content text not null,
  priority integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists analysis_rules_active_rule_number_idx
  on public.analysis_rules (active, rule_number);

alter table public.analysis_rules enable row level security;
