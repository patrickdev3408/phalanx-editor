/* Phalanx Data Editor — static SPA over Supabase.
 * Auth (email/password) → pick a table → search/edit rows → upsert.
 * hasData tables edit the `data` jsonb (scalars as inputs, nested as JSON
 * fields, or a whole-record Raw JSON toggle); type_matrix edits flat columns.
 * Column derivation mirrors tools/supabase/load_supabase.py exactly. */

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let CURRENT = null;   // current table name
let ROWS = [];        // rows loaded for CURRENT
let SELECTED = null;  // selected row object (or {__new:true,...})
let RAW = false;      // raw-JSON editor mode (hasData only)

const $ = (id) => document.getElementById(id);
const pkCols = (cfg) => cfg.pk || Object.keys(cfg.pkFromData || {});

function status(msg, isErr) {
  const s = $("status");
  s.textContent = msg || "";
  s.className = "status" + (isErr ? " err" : "") + (msg ? " show" : "");
  if (msg && !isErr) setTimeout(() => { if (s.textContent === msg) s.classList.remove("show"); }, 3500);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/* ---------------- auth ---------------- */
async function refreshAuth() {
  const { data: { session } } = await sb.auth.getSession();
  const inOK = !!session;
  $("login").classList.toggle("hidden", inOK);
  $("editor").classList.toggle("hidden", !inOK);
  $("authbar").innerHTML = inOK
    ? `<span class="who">${escapeHtml(session.user.email)}</span><button id="signout" class="ghost">Sign out</button>`
    : "";
  if (inOK) {
    $("signout").onclick = () => sb.auth.signOut();
    if (!CURRENT) selectTable(Object.keys(TABLES)[0]);
  }
}
sb.auth.onAuthStateChange(() => refreshAuth());

$("loginBtn").onclick = async () => {
  $("loginMsg").textContent = "Signing in…";
  const { error } = await sb.auth.signInWithPassword({
    email: $("email").value.trim(), password: $("password").value,
  });
  $("loginMsg").textContent = error ? error.message : "";
};

/* ---------------- tabs ---------------- */
function buildTabs() {
  $("tabs").innerHTML = "";
  for (const [name, cfg] of Object.entries(TABLES)) {
    const b = document.createElement("button");
    b.textContent = cfg.label;
    b.className = "tab" + (name === CURRENT ? " active" : "");
    b.onclick = () => selectTable(name);
    $("tabs").appendChild(b);
  }
}

async function selectTable(name) {
  CURRENT = name; SELECTED = null; RAW = false;
  buildTabs(); clearEditor();
  status("Loading " + name + "…");
  const { data, error } = await sb.from(name).select("*").limit(5000);
  if (error) {
    ROWS = []; $("rowlist").innerHTML = "";
    const missing = error.code === "42P01" || /does not exist|not find the table/i.test(error.message || "");
    $("rowcount").innerHTML = missing
      ? `Table <code>${name}</code> not created yet.<br>Run <code>tools/supabase/schema.sql</code> in the dashboard, then <code>load_supabase.py</code>.`
      : "Error: " + escapeHtml(error.message);
    status(error.message, true);
    return;
  }
  ROWS = data || [];
  const k = pkCols(TABLES[name])[0];
  ROWS.sort((a, b) => String(a[k]).localeCompare(String(b[k]), undefined, { numeric: true }));
  renderList();
  status(ROWS.length + " rows loaded");
}

/* ---------------- row list ---------------- */
function renderList() {
  const cfg = TABLES[CURRENT];
  const q = $("search").value.trim().toLowerCase();
  const cols = cfg.list;
  const rows = q ? ROWS.filter((r) => cols.some((c) => String(r[c] ?? "").toLowerCase().includes(q))) : ROWS;
  $("rowcount").textContent = `${rows.length} / ${ROWS.length} rows`;
  const ul = $("rowlist"); ul.innerHTML = "";
  for (const r of rows) {
    const li = document.createElement("li");
    li.className = "rowitem" + (r === SELECTED ? " sel" : "");
    li.innerHTML = cols.map((c) => `<span class="cell">${escapeHtml(r[c] ?? "")}</span>`).join("");
    li.onclick = () => selectRow(r);
    ul.appendChild(li);
  }
}
$("search").oninput = renderList;

/* ---------------- editor ---------------- */
function clearEditor() {
  $("editHead").className = "hint"; $("editHead").textContent = "Pick a row to edit.";
  $("formArea").innerHTML = ""; $("editActions").classList.add("hidden");
}
function selectRow(r) { SELECTED = r; RAW = false; renderList(); renderEditor(); }

$("newBtn").onclick = () => {
  const cfg = TABLES[CURRENT];
  SELECTED = cfg.hasData ? { __new: true, data: {} } : { __new: true };
  RAW = cfg.hasData;            // new jsonb records are easiest to paste as raw JSON
  renderList(); renderEditor();
};

function renderEditor() {
  const cfg = TABLES[CURRENT];
  if (!SELECTED) { clearEditor(); return; }
  $("editActions").classList.remove("hidden");
  const isNew = !!SELECTED.__new;
  const title = isNew ? "new row" : escapeHtml(pkCols(cfg).map((c) => SELECTED[c]).join(" · ") || "(record)");
  $("editHead").className = "editHead";
  $("editHead").innerHTML = `<h2>${cfg.label}</h2><span class="pk">${title}</span>`;
  const area = $("formArea"); area.innerHTML = "";

  if (!cfg.hasData) {                       // flat table (type_matrix)
    $("rawToggle").classList.add("hidden");
    for (const c of cfg.flat) area.appendChild(field(c, SELECTED[c] ?? "", pkCols(cfg).includes(c) && !isNew));
    return;
  }

  $("rawToggle").classList.remove("hidden");
  $("rawToggle").textContent = RAW ? "Form view" : "Raw JSON";
  const data = SELECTED.data || {};
  if (RAW) {
    const ta = document.createElement("textarea");
    ta.id = "rawjson"; ta.className = "raw"; ta.spellcheck = false;
    ta.value = JSON.stringify(data, null, 2);
    area.appendChild(ta);
  } else if (Object.keys(data).length === 0) {
    area.innerHTML = `<p class="hint">Empty record — switch to <b>Raw JSON</b> to paste a full record.</p>`;
  } else {
    // Scalars go in a dense responsive grid; nested objects/arrays (edited as
    // JSON) stack full-width below a divider — so a 100-field record isn't one
    // giant single column.
    const grid = document.createElement("div"); grid.className = "field-grid";
    const stack = document.createElement("div"); stack.className = "field-stack";
    let nJson = 0;
    for (const [k, v] of Object.entries(data)) {
      if (v === null || typeof v === "object") { stack.appendChild(field(k, v, false)); nJson++; }
      else grid.appendChild(field(k, v, false));
    }
    if (grid.children.length) area.appendChild(grid);
    if (nJson) {
      const h = document.createElement("div"); h.className = "section-head";
      h.textContent = `Nested fields · ${nJson}`;
      area.appendChild(h); area.appendChild(stack);
    }
  }
}

$("rawToggle").onclick = () => {
  if (!TABLES[CURRENT].hasData) return;
  let c; try { c = collect(); } catch (e) { return; }
  if (c === undefined) return;
  SELECTED.data = c; RAW = !RAW; renderEditor();
};

// One labelled input. Scalars get typed inputs; null/objects/arrays get a JSON field.
function field(key, val, readonly) {
  const t = (val === null || typeof val === "object") ? "json" : typeof val;
  const wrap = document.createElement("label"); wrap.className = "field" + (t === "json" ? " field-json" : "");
  wrap.innerHTML = `<span class="flabel">${escapeHtml(key)}</span>`;
  let inp;
  if (t === "json") {
    inp = document.createElement("textarea"); inp.className = "jsonfield"; inp.spellcheck = false;
    inp.value = JSON.stringify(val, null, 1);
  } else if (t === "boolean") {
    inp = document.createElement("input"); inp.type = "checkbox"; inp.checked = val;
  } else if (t === "number") {
    inp = document.createElement("input"); inp.type = "number"; inp.step = "any"; inp.value = val;
  } else {
    inp = document.createElement("input"); inp.type = "text"; inp.value = val ?? "";
  }
  inp.dataset.key = key; inp.dataset.vtype = t;
  if (readonly) inp.disabled = true;
  wrap.appendChild(inp);
  return wrap;
}

// Rebuild the data object (hasData) or flat row from the visible form / raw box.
// Throws (and flags status) on invalid JSON; returns undefined if nothing usable.
function collect() {
  if (RAW) {
    try { return JSON.parse($("rawjson").value); }
    catch (e) { status("Invalid JSON: " + e.message, true); return undefined; }
  }
  const obj = {};
  for (const inp of $("formArea").querySelectorAll("[data-key]")) {
    const k = inp.dataset.key, vt = inp.dataset.vtype;
    if (vt === "boolean") obj[k] = inp.checked;
    else if (vt === "number") obj[k] = inp.value === "" ? null : Number(inp.value);
    else if (vt === "json") {
      try { obj[k] = JSON.parse(inp.value); }
      catch (e) { status(`Invalid JSON in "${k}": ${e.message}`, true); throw e; }
    } else obj[k] = inp.value;
  }
  return obj;
}

$("saveBtn").onclick = async () => {
  const cfg = TABLES[CURRENT];
  let row;
  try {
    if (cfg.hasData) {
      const data = collect(); if (data === undefined) return;
      row = { data };
      for (const [col, dk] of Object.entries(cfg.pkFromData)) row[col] = String(data[dk] ?? "");
      for (const [col, dk] of Object.entries(cfg.extracted || {})) row[col] = data[dk] ?? null;
      const pk0 = pkCols(cfg)[0];
      if (!row[pk0]) { status(`Record is missing its key field "${cfg.pkFromData[pk0]}"`, true); return; }
    } else {
      row = collect(); if (row === undefined) return;
      for (const c of pkCols(cfg)) if (row[c] === "" || row[c] == null) { status(`Missing ${c}`, true); return; }
    }
  } catch (e) { return; }            // invalid JSON already surfaced
  status("Saving…");
  const { error } = await sb.from(CURRENT).upsert(row, { onConflict: pkCols(cfg).join(",") });
  if (error) { status("Save failed: " + error.message, true); return; }
  status("Saved ✓");
  await selectTable(CURRENT);
};

$("deleteBtn").onclick = async () => {
  const cfg = TABLES[CURRENT];
  if (!SELECTED || SELECTED.__new) { SELECTED = null; clearEditor(); renderList(); return; }
  if (!confirm("Delete this row? This can't be undone (until you re-publish from JSON).")) return;
  const match = {}; for (const c of pkCols(cfg)) match[c] = SELECTED[c];
  const { error } = await sb.from(CURRENT).delete().match(match);
  if (error) { status("Delete failed: " + error.message, true); return; }
  status("Deleted");
  SELECTED = null; await selectTable(CURRENT);
};

/* ---------------- boot ---------------- */
buildTabs();
refreshAuth();
