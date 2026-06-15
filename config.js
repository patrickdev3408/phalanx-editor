// Phalanx Data Editor — connection + per-table config.
//
// The PUBLISHABLE (anon) key is PUBLIC BY DESIGN — safe to commit and ship in
// the browser. Write access is gated by Supabase Auth + Row-Level Security
// (tools/supabase/schema.sql): anyone may READ, only signed-in users may WRITE.
// (The service key — which bypasses RLS — lives only in tools/supabase/.env and
// is NEVER used here.)
const SUPABASE_URL = "https://tnmdusfxtzgfiehclxcv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_S4wKvpWCvkj-4Bres2UZvg_1SAtb8gV";

// Per-table editing config. Each `hasData` table keeps the FULL record in a
// `data` jsonb column (a faithful round-trip to data/*.json); the extracted
// columns are re-derived FROM that data on save so the grid + filters stay
// correct. This MUST mirror tools/supabase/load_supabase.py exactly:
//   pkFromData  { column : dataKey }  — primary-key column(s), value pulled from data
//   extracted   { column : dataKey }  — denormalised columns, re-derived on save
//   list        [columns]             — shown in the row list (+ searched)
// type_matrix is flat (no jsonb): edit attacker/defender/multiplier directly.
const TABLES = {
  characters:   { label: "Characters",  hasData: true,
                  pkFromData: { id: "id" },
                  extracted:  { name: "name", class: "class_name_char", type_1: "type_1", type_2: "type_2" },
                  list: ["id", "name", "class", "type_1", "type_2"] },
  actions:      { label: "Actions",     hasData: true,
                  pkFromData: { id: "id" },
                  extracted:  { name: "name", damage_type: "damage_type", energy_cost: "energy_cost" },
                  list: ["id", "name", "damage_type", "energy_cost"] },
  classes:      { label: "Classes",     hasData: true,
                  pkFromData: { class_name: "class_name" }, extracted: {},
                  list: ["class_name"] },
  effects:      { label: "Effects",     hasData: true,
                  pkFromData: { name: "name" }, extracted: { category: "category" },
                  list: ["name", "category"] },
  types:        { label: "Types",       hasData: true,
                  pkFromData: { type_name: "type_name" }, extracted: {},
                  list: ["type_name"] },
  aoe_patterns: { label: "AoE Patterns", hasData: true,
                  pkFromData: { name: "name" }, extracted: { category: "category" },
                  list: ["name", "category"] },
  type_matrix:  { label: "Type Matrix", hasData: false,
                  pk: ["attacker", "defender"],
                  flat: ["attacker", "defender", "multiplier"],
                  list: ["attacker", "defender", "multiplier"] },
};
