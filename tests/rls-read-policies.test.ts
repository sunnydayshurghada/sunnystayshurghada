/**
 * Regression tests for the seven read policies tightened in migration
 * 0014_tighten_permissive_read_policies (amenities, daily_prices,
 * property_images, property_pricing_settings, service_catalog,
 * exchange_rates, task_types).
 *
 * Layers:
 *  1. Policy definitions: exact roles + predicates, old "USING (true)" rules gone.
 *  2. Helper functions: decisions for admin, active staff, assigned owner,
 *     unrelated signed-in user, active and inactive apartments.
 *  3. Live public access through the Data API with the publishable key.
 *
 * Requires PG* env vars (database) and VITE_SUPABASE_URL /
 * VITE_SUPABASE_PUBLISHABLE_KEY. Run: bunx vitest run tests/rls-read-policies.test.ts
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function sql(query: string): string[][] {
  const out = execFileSync("psql", ["-AtX", "-F", "\t", "-R", "\x1e", "-v", "ON_ERROR_STOP=1", "-c", query], {
    encoding: "utf8",
  });
  return out.trim() ? out.trim().split("\x1e").map((l) => l.split("\t")) : [];
}
const one = (q: string) => sql(q)[0]?.[0] ?? null;

function env(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const m = readFileSync(".env", "utf8").match(new RegExp(`^${name}="?([^"\\n]+)"?`, "m"));
    return m?.[1];
  } catch {
    return undefined;
  }
}

const PUBLIC_TABLES = ["amenities", "daily_prices", "property_images", "property_pricing_settings"];
const PORTAL_TABLES = ["service_catalog", "exchange_rates"];

describe("policy definitions", () => {
  const rows = sql(
    `select tablename, policyname, array_to_string(roles, ','), cmd, qual
       from pg_policies where schemaname='public'
        and tablename in ('amenities','daily_prices','property_images','property_pricing_settings',
                          'service_catalog','exchange_rates','task_types')
        and cmd = 'SELECT'`,
  );
  const byTable = (t: string) => rows.filter((r) => r[0] === t);

  it("no SELECT policy on these tables lets every row through", () => {
    for (const r of rows) expect(r[4], `${r[0]}.${r[1]}`).not.toBe("true");
  });

  it.each(PUBLIC_TABLES)("%s: public read limited to active apartments", (t) => {
    const p = byTable(t);
    expect(p).toHaveLength(1);
    expect(p[0][2].split(",").sort()).toEqual(["anon", "authenticated"]);
    expect(p[0][4]).toBe("is_active_property(property_id)");
  });

  it.each(PORTAL_TABLES)("%s: only portal users, never anon", (t) => {
    const p = byTable(t);
    expect(p).toHaveLength(1);
    expect(p[0][2]).toBe("authenticated");
    expect(p[0][4]).toBe("is_portal_user(auth.uid())");
  });

  it("task_types: only admins/managers and active staff, never anon", () => {
    const p = byTable("task_types");
    expect(p).toHaveLength(1);
    expect(p[0][2]).toBe("authenticated");
    expect(p[0][4]).toContain("is_staff(auth.uid())");
    expect(p[0][4]).toMatch(/staff_profiles[\s\S]*user_id = auth\.uid\(\)[\s\S]*active/);
  });

  it("anon has no table grant path to portal/staff tables beyond policies", () => {
    for (const t of [...PORTAL_TABLES, "task_types"]) {
      const anonPolicies = rows.filter((r) => r[0] === t && r[2].includes("anon"));
      expect(anonPolicies, t).toHaveLength(0);
    }
  });
});

describe("helper decisions", () => {
  const fn = (name: string) =>
    execFileSync("psql", ["-AtX", "-c", `select pg_get_functiondef('public.${name}'::regproc)`], {
      encoding: "utf8",
    });

  it("is_active_property: true only for status 'active'", () => {
    expect(fn("is_active_property")).toMatch(/status = 'active'/);
    const active = one(`select id from properties where status='active' limit 1`);
    if (active) expect(one(`select public.is_active_property('${active}')`)).toBe("t");
    const inactive = one(`select id from properties where status <> 'active' limit 1`);
    if (inactive) expect(one(`select public.is_active_property('${inactive}')`)).toBe("f");
    expect(one(`select public.is_active_property(gen_random_uuid())`)).toBe("f");
  });

  it("is_portal_user covers admins, active staff and active owner assignments", () => {
    const def = fn("is_portal_user");
    expect(def).toContain("is_staff(_uid)");
    expect(def).toMatch(/staff_profiles WHERE user_id = _uid AND active/);
    expect(def).toMatch(/property_user_assignments WHERE user_id = _uid AND active/);
  });

  it("unrelated signed-in user is rejected", () => {
    expect(one(`select public.is_portal_user(gen_random_uuid())`)).toBe("f");
  });

  it("admin is accepted", () => {
    const admin = one(`select user_id from user_roles where role='admin' limit 1`);
    if (!admin) return;
    expect(one(`select public.is_portal_user('${admin}')`)).toBe("t");
  });

  it("every active staff member is accepted, inactive ones are not", () => {
    for (const [uid, active] of sql(`select user_id, active from staff_profiles where user_id is not null`)) {
      const staffRole = one(`select public.is_staff('${uid}')`) === "t";
      const owner = one(`select exists(select 1 from property_user_assignments where user_id='${uid}' and active)`) === "t";
      const expected = active === "t" || staffRole || owner ? "t" : "f";
      expect(one(`select public.is_portal_user('${uid}')`), uid).toBe(expected);
    }
  });

  it("every actively assigned owner is accepted", () => {
    for (const [uid] of sql(`select distinct user_id from property_user_assignments where active`)) {
      expect(one(`select public.is_portal_user('${uid}')`), uid).toBe("t");
    }
  });
});

describe("live public access (anon key)", () => {
  const url = env("VITE_SUPABASE_URL");
  const key = env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const get = async (path: string) => {
    const r = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key! } });
    return { status: r.status, body: (await r.json()) as unknown };
  };
  const activeIds = new Set(sql(`select id from properties where status='active'`).map((r) => r[0]));

  it.skipIf(!url || !key).each(PUBLIC_TABLES)(
    "%s: anon only receives rows of active apartments",
    async (t) => {
      const { status, body } = await get(`${t}?select=property_id&limit=1000`);
      expect(status).toBe(200);
      for (const row of body as { property_id: string }[]) expect(activeIds.has(row.property_id)).toBe(true);
      const inactive = sql(`select id from properties where status <> 'active'`).map((r) => r[0]);
      if (inactive.length) {
        const res = await get(`${t}?select=property_id&property_id=in.(${inactive.join(",")})`);
        expect(res.body).toEqual([]);
      }
    },
  );

  it.skipIf(!url || !key).each([...PORTAL_TABLES, "task_types"])(
    "%s: anon receives nothing",
    async (t) => {
      const { status, body } = await get(`${t}?select=*&limit=5`);
      if (status === 200) expect(body).toEqual([]);
      else expect([401, 403]).toContain(status);
    },
  );
});
