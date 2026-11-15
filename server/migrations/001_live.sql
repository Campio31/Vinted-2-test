-- Live connecté : tables serveur (spécification « Max Live », section 3).
-- À APPLIQUER SUR UN PROJET DE TEST D'ABORD. Écrit d'après la spécification, jamais exécuté sur un vrai projet Supabase.
-- Hypothèse à vérifier : le « tenant » de Syno est l'identifiant de l'utilisateur Supabase (auth.uid()). Adapter les politiques sinon.
-- Les identifiants de plateforme sont stockés en TEXTE (ils ressemblent à des nombres mais n'en sont pas). Les montants sont en centimes entiers.

create table if not exists provider_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  provider text not null check (provider in ('tiktok_shop', 'whatnot')),
  external_shop_id text not null,
  market text not null default 'FR',
  status text not null default 'connected' check (status in ('connected', 'reconnect', 'revoked')),
  scopes text[] not null default '{}',
  caps jsonb not null default '{}'::jsonb,          -- { "orders": "verified", "finance": "authorized", ... } : documented | authorized | verified
  last_sync_at timestamptz,
  unique (tenant_id, provider, external_shop_id)
);
-- Une boutique ne peut pas être revendiquée dans deux espaces sans procédure de transfert (V1).
create unique index if not exists provider_accounts_one_owner on provider_accounts (provider, external_shop_id) where status <> 'revoked';

-- Jetons : table PRIVÉE. Aucune politique : seul le rôle service (fonctions serveur) y accède, jamais le front.
create table if not exists provider_credentials (
  account_id uuid primary key references provider_accounts(id) on delete cascade,
  token_secret_ref text not null,                    -- référence dans le coffre, pas le jeton lui-même
  refresh_secret_ref text,
  expires_at timestamptz
);

create table if not exists live_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  account_id uuid not null references provider_accounts(id) on delete cascade,
  external_live_id text not null,
  title text, starts_at timestamptz, ends_at timestamptz,
  state text not null default 'unknown' check (state in ('scheduled', 'live', 'ended', 'cancelled', 'unknown')),
  assignment_mode text not null default 'normal' check (assignment_mode in ('normal', 'exclusive_ballot')),
  unique (account_id, external_live_id)
);

create table if not exists ballots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  supplier_id uuid, label text not null, received_at date,
  landed_cost_minor bigint not null check (landed_cost_minor >= 0),
  currency text not null default 'EUR', known_units integer
);
create table if not exists ballot_cost_revisions (
  ballot_id uuid not null references ballots(id) on delete cascade, at timestamptz not null default now(), cost_minor bigint not null check (cost_minor >= 0)
);

create table if not exists live_ballot_rules (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_sessions(id) on delete cascade,
  ballot_id uuid not null references ballots(id) on delete cascade,
  external_subject_type text, external_subject_id text, is_default boolean not null default false
);
create unique index if not exists one_default_per_session on live_ballot_rules (session_id) where is_default;
create unique index if not exists one_target_per_subject on live_ballot_rules (session_id, external_subject_id) where not is_default;

create table if not exists provider_sku_links (
  account_id uuid not null references provider_accounts(id) on delete cascade,
  external_variant_id text not null,
  catalog_variant_id uuid not null,
  merchant_sku text, source text not null default 'manual', verified_at timestamptz,
  primary key (account_id, external_variant_id)
);

create table if not exists provider_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  account_id uuid not null references provider_accounts(id) on delete cascade,
  external_order_id text not null,
  provider_updated_at timestamptz,
  unique (account_id, external_order_id)
);
create table if not exists provider_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references provider_orders(id) on delete cascade,
  external_line_id text not null,
  variant_id text, listing_id text, merchant_sku text, external_live_id text,
  source text not null default 'unknown' check (source in ('live', 'non_live', 'unknown')),
  quantity integer not null check (quantity > 0),
  status text not null check (status in ('pending', 'confirmed', 'cancelled', 'unknown')), raw_status text not null,
  gross_minor bigint, currency text not null default 'EUR', provider_updated_at timestamptz,
  live_session_id uuid references live_sessions(id), origin_target jsonb, attribution_status text not null default 'to_match',
  unique (order_id, external_line_id)
);

-- Mouvements de stock : clé d'idempotence par effet métier. Jamais d'écrasement silencieux du solde.
create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  variant_id uuid not null, order_line_id uuid references provider_order_lines(id),
  delta_on_hand integer not null default 0, delta_reserved integer not null default 0,
  reason text not null, causation_key text not null unique, created_at timestamptz not null default now()
);
-- Effet DÉJÀ compté par ligne : le nouvel effet = effet cible moins cette valeur (même transaction, ligne verrouillée).
create table if not exists line_stock_effects (
  order_line_id uuid primary key references provider_order_lines(id) on delete cascade,
  variant_id uuid, on_hand integer not null default 0, reserved integer not null default 0
);

create table if not exists finance_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  account_id uuid not null references provider_accounts(id) on delete cascade,
  external_entry_key text not null,                  -- ledger_transaction_id (Whatnot), ID fiable ou clé composite validée (TikTok)
  order_id uuid references provider_orders(id), line_id uuid references provider_order_lines(id), session_id uuid references live_sessions(id),
  type text not null check (type in ('sale', 'fee', 'refund', 'adjustment')),
  signed_amount_minor bigint not null, currency text not null default 'EUR',
  financial_stage text not null check (financial_stage in ('provisional', 'settled')),
  unique (account_id, external_entry_key)
);

create table if not exists provider_events (
  id uuid primary key default gen_random_uuid(), account_id uuid references provider_accounts(id) on delete cascade,
  delivery_id text, fingerprint text, received_at timestamptz not null default now(), processed_at timestamptz, payload jsonb,
  unique (account_id, delivery_id)
);
create table if not exists sync_jobs (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references provider_accounts(id) on delete cascade,
  kind text not null, state text not null default 'queued' check (state in ('queued', 'running', 'done', 'failed')),
  attempts integer not null default 0, run_after timestamptz not null default now(), last_error text
);
create table if not exists sync_cursors (
  account_id uuid not null references provider_accounts(id) on delete cascade, stream text not null, cursor text, window_end timestamptz,
  primary key (account_id, stream)                   -- ne jamais avancer si une page échoue ; garder un chevauchement
);
create table if not exists attribution_overrides (
  id uuid primary key default gen_random_uuid(), order_line_id uuid not null references provider_order_lines(id) on delete cascade,
  old_target jsonb, new_target jsonb, actor_id uuid, reason text, created_at timestamptz not null default now()
);

-- Cloisonnement par espace : chaque vendeur ne voit que ses lignes. provider_credentials n'a volontairement AUCUNE politique.
do $$ declare t text; begin
  foreach t in array array['provider_accounts', 'live_sessions', 'ballots', 'provider_orders', 'inventory_movements', 'finance_entries'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format('create policy tenant_isolation on %I for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid())', t);
  end loop;
  alter table provider_credentials enable row level security;
end $$;
