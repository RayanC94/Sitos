-- 0006 — Leads du site vitrine (learningtrip.fr)
-- Table isolée du reste du schéma voyage : aucune jointure, aucune PII étudiante.
-- Sécurité : RLS activée, le rôle anon peut UNIQUEMENT insérer (jamais lire,
-- modifier ou supprimer), consentement obligatoire, garde-fous par contraintes.

create table if not exists public.site_leads (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  nom          text not null check (char_length(nom) between 2 and 120),
  organisation text          check (char_length(organisation) <= 160),
  email        text not null check (
                 email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
                 and char_length(email) <= 160
               ),
  telephone    text          check (char_length(telephone) <= 30),
  source       text not null check (source in ('brochure', 'conseiller', 'programme')),
  destination  text          check (char_length(destination) <= 60),
  budget       integer       check (budget between 0 and 100000),
  message      text          check (char_length(message) <= 2000),
  consent      boolean not null,
  user_agent   text          check (char_length(user_agent) <= 400),
  traite       boolean not null default false   -- suivi interne : lead traité ?
);

comment on table public.site_leads is
  'Demandes entrantes du site vitrine (brochure, rappel conseiller, programme). Insert-only pour anon.';

alter table public.site_leads enable row level security;

-- anon : INSERT uniquement, et seulement avec consentement explicite.
create policy site_leads_insert_anon on public.site_leads
  for insert to anon
  with check (consent = true);

-- Aucune policy SELECT/UPDATE/DELETE : la table est invisible pour anon et
-- authenticated. Lecture uniquement via service_role (dashboard / scripts).

-- Index pour le suivi commercial.
create index if not exists site_leads_created_idx on public.site_leads (created_at desc);
create index if not exists site_leads_traite_idx  on public.site_leads (traite) where not traite;
