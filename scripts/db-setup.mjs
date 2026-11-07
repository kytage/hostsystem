#!/usr/bin/env node
/**
 * HOST — cria o banco do zero num projeto Supabase novo.
 *
 *   node scripts/db-setup.mjs
 *
 * Lê do .env:
 *   SUPABASE_DB_URL            connection string (Session pooler) com a senha
 *   SUPABASE_URL               https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  chave service_role (só servidor)
 *
 *   node scripts/db-setup.mjs --reset   (primeira vez: zera dados e outros logins)
 *
 * Etapas (sem --reset é seguro rodar de novo; só aplica migrations novas):
 *   1. Aplica supabase/migrations/*.sql e depois drizzle/migrations/*.sql, em ordem,
 *      registrando cada uma em host_meta.migrations.
 *   2. Zera TODOS os dados das tabelas de negócio (mantém só a configuração:
 *      permissões por cargo/área, áreas e modelos de proposta).
 *   3. Cria os buckets de Storage usados pelo app.
 *   4. Garante o único login: "henrique" (FOUNDER). Se ele ainda não existir, cria com um
 *      código de primeiro acesso aleatório e grava em .henrique-primeiro-acesso.txt
 *      (fora do git). No primeiro login o app pede para definir a senha definitiva.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- .env loader (sem dependência extra) ---
const envPath = join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const need = ["SUPABASE_DB_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Faltando no .env: ${missing.join(", ")}`);
  process.exit(1);
}

const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1, onnotice: () => {}, prepare: false });

/** Tabelas de configuração que mantêm os valores padrão das migrations. */
const KEEP = new Set(["role_permissions", "area_permissions", "areas", "captacoes_modelos"]);

const BUCKETS = [
  { id: "host-update-files", public: false },
  { id: "avatars", public: true },
  { id: "eventos-banners", public: true },
];

function migrationFiles() {
  const list = [];
  for (const dir of ["supabase/migrations", "drizzle/migrations"]) {
    const abs = join(root, dir);
    for (const f of readdirSync(abs).filter((f) => f.endsWith(".sql")).sort()) {
      list.push({ id: `${dir}/${f}`, path: join(abs, f) });
    }
  }
  return list;
}

async function applyMigrations() {
  await sql`create schema if not exists host_meta`;
  await sql`create table if not exists host_meta.migrations (id text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select id from host_meta.migrations`).map((r) => r.id));

  for (const m of migrationFiles()) {
    if (done.has(m.id)) continue;
    let body = readFileSync(m.path, "utf8").replace(/--> statement-breakpoint/g, "");

    // ALTER TYPE ... ADD VALUE precisa comitar antes do valor ser usado.
    const addValue = body.match(/^\s*ALTER TYPE[^;]*ADD VALUE[^;]*;/gim) ?? [];
    for (const stmt of addValue) {
      await sql.unsafe(stmt);
      body = body.replace(stmt, "");
    }

    process.stdout.write(`  • ${m.id} ... `);
    try {
      await sql.begin(async (tx) => {
        if (body.trim()) await tx.unsafe(body);
        await tx`insert into host_meta.migrations (id) values (${m.id})`;
      });
      console.log("ok");
    } catch (err) {
      console.log("ERRO");
      throw new Error(`${m.id}: ${err.message}`);
    }
  }
}

async function wipeData() {
  const tables = (
    await sql`select tablename from pg_tables where schemaname = 'public' order by tablename`
  )
    .map((r) => r.tablename)
    .filter((t) => !KEEP.has(t));
  if (tables.length) {
    await sql.unsafe(
      `truncate ${tables.map((t) => `public."${t}"`).join(", ")} restart identity cascade`,
    );
  }
  console.log(`  • ${tables.length} tabelas zeradas (mantidas: ${[...KEEP].join(", ")})`);
}

async function createBuckets() {
  for (const b of BUCKETS) {
    await sql`
      insert into storage.buckets (id, name, public)
      values (${b.id}, ${b.id}, ${b.public})
      on conflict (id) do update set public = excluded.public`;
  }
  console.log(`  • buckets: ${BUCKETS.map((b) => b.id).join(", ")}`);
}

async function ensureHenrique() {
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = "henrique@host.local";

  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;
  // Com --reset o sistema começa só com o henrique: remove qualquer outro login.
  if (RESET) {
    for (const u of list.users) {
      if (u.email !== email) await admin.auth.admin.deleteUser(u.id);
    }
  }

  let user = list.users.find((u) => u.email === email);
  let token = null;
  if (!user) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    token = Array.from(randomBytes(16), (b) => alphabet[b % alphabet.length]).join("");
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: token,
      email_confirm: true,
      user_metadata: { username: "henrique" },
    });
    if (error) throw error;
    user = data.user;
  }

  await sql`insert into public.profiles (id, username) values (${user.id}, 'henrique')
            on conflict (id) do update set username = 'henrique'`;
  await sql`delete from public.user_roles where user_id = ${user.id}`;
  await sql`insert into public.user_roles (user_id, role) values (${user.id}, 'founder')`;
  if (token) {
    await sql`update public.profiles set deve_trocar_senha = true where id = ${user.id}`;
    const file = join(root, ".henrique-primeiro-acesso.txt");
    writeFileSync(
      file,
      `Usuário: henrique\nCódigo de primeiro acesso: ${token}\n\nEntre com esse código como senha; o app vai pedir a senha definitiva.\nApague este arquivo depois.\n`,
    );
    console.log(`  • henrique criado como FOUNDER — código de primeiro acesso em .henrique-primeiro-acesso.txt`);
  } else {
    console.log("  • henrique já existe — mantido como FOUNDER (senha inalterada)");
  }
}

const RESET = process.argv.includes("--reset");

try {
  console.log("1/4 Migrations");
  await applyMigrations();
  if (RESET) {
    console.log("2/4 Zerando dados (--reset)");
    await wipeData();
  } else {
    console.log("2/4 Dados mantidos (use --reset para zerar tudo)");
  }
  console.log("3/4 Storage");
  await createBuckets();
  console.log("4/4 Login henrique");
  await ensureHenrique();
  console.log("\nBanco pronto.");
} catch (err) {
  console.error(`\nFalhou: ${err.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
