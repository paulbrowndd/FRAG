(function () {
  const COLS = [
    { key: "familyName", label: "Family name", type: "text" },
    { key: "enemyKills", label: "Enemy kills", type: "num" },
    { key: "deaths", label: "Deaths", type: "num" },
    { key: "maxKillStreak", label: "Max kill streak", type: "num" },
    { key: "damageDealt", label: "Damage dealt", type: "str" },
    { key: "damageTaken", label: "Damage taken", type: "str" },
    { key: "ccHits", label: "CC hits", type: "num" },
    { key: "hpHealed", label: "HP healed", type: "str" },
    { key: "allyHp", label: "Ally HP", type: "str" },
    { key: "totalDamageToFort", label: "Total damage to fort", type: "str" },
    { key: "cannonHits", label: "Cannon hits", type: "num" },
    { key: "objectsDestroyedCannon", label: "Objects destroyed (cannon)", type: "num" },
    { key: "maxCannonHitDistance", label: "Max cannon hit distance", type: "num" },
    { key: "trapsTriggered", label: "Traps triggered", type: "num" },
    { key: "timeDead", label: "Time dead", type: "str" },
    { key: "timeSurvived", label: "Time survived", type: "str" },
  ];

  const VIEW = { DAILY: "daily", WEEKLY: "weekly", LIFETIME: "lifetime" };

  const thead = document.getElementById("thead");
  const tbody = document.getElementById("tbody");
  const search = document.getElementById("search");
  const countEl = document.getElementById("count");
  const metaEl = document.getElementById("header-meta");
  const badgeEl = document.getElementById("header-badge");
  const viewTabs = document.querySelectorAll("[data-view]");
  const dateSelect = document.getElementById("date-select");
  const weekSelect = document.getElementById("week-select");
  const scopeRow = document.getElementById("scope-row");
  const dateField = document.getElementById("date-field");
  const weekField = document.getElementById("week-field");

  let currentView = VIEW.DAILY;
  let currentDate = "";
  let currentWeekMonday = "";

  function getWarData() {
    return window.NODE_WAR_DATA && typeof window.NODE_WAR_DATA === "object"
      ? window.NODE_WAR_DATA
      : {};
  }

  function sortedDateKeys(data) {
    return Object.keys(data).filter((k) => data[k] && Array.isArray(data[k].rows)).sort();
  }

  function parseISOUTC(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  /** Monday (UTC) of the calendar week containing `iso` (ISO YYYY-MM-DD). */
  function mondayOfWeekUTC(iso) {
    const dt = parseISOUTC(iso);
    const dow = dt.getUTCDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    dt.setUTCDate(dt.getUTCDate() + diff);
    return dt.toISOString().slice(0, 10);
  }

  function addDaysUTC(iso, n) {
    const dt = parseISOUTC(iso);
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }

  function formatShortDate(iso) {
    const dt = parseISOUTC(iso);
    return dt.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  function formatWeekRangeLabel(mondayIso) {
    const sun = addDaysUTC(mondayIso, 6);
    return `${formatShortDate(mondayIso)} – ${formatShortDate(sun)}`;
  }

  function parseGameNumber(s) {
    if (s == null) return 0;
    const t = String(s).trim().toUpperCase().replace(/,/g, "");
    if (t === "" || t === "-") return 0;
    let m = t.match(/^([\d.]+)\s*M$/);
    if (m) return parseFloat(m[1]) * 1e6;
    m = t.match(/^([\d.]+)\s*K$/);
    if (m) return parseFloat(m[1]) * 1e3;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : 0;
  }

  function formatGameNumber(n) {
    if (!Number.isFinite(n) || n === 0) return "0";
    const abs = Math.abs(n);
    if (abs >= 1e6) {
      const v = n / 1e6;
      const s = v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "");
      return s + "M";
    }
    if (abs >= 1e3) {
      const v = n / 1e3;
      const s = v >= 100 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "");
      return s + "K";
    }
    return String(Math.round(n));
  }

  /** Treat values as minutes:seconds (node war UI). */
  function parseTimeToSeconds(s) {
    const parts = String(s || "")
      .trim()
      .split(":")
      .map((x) => parseInt(x, 10));
    if (parts.some((n) => !Number.isFinite(n))) return 0;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }

  function formatTimeFromSeconds(sec) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function emptyAccumulator() {
    return {
      enemyKills: 0,
      deaths: 0,
      maxKillStreak: 0,
      damageDealt: 0,
      damageTaken: 0,
      ccHits: 0,
      hpHealed: 0,
      allyHp: 0,
      totalDamageToFort: 0,
      cannonHits: 0,
      objectsDestroyedCannon: 0,
      maxCannonHitDistance: 0,
      trapsTriggered: 0,
      timeDeadSec: 0,
      timeSurvivedSec: 0,
    };
  }

  function mergeRowInto(acc, r) {
    acc.enemyKills += Number(r.enemyKills) || 0;
    acc.deaths += Number(r.deaths) || 0;
    acc.maxKillStreak = Math.max(acc.maxKillStreak, Number(r.maxKillStreak) || 0);
    acc.damageDealt += parseGameNumber(r.damageDealt);
    acc.damageTaken += parseGameNumber(r.damageTaken);
    acc.ccHits += Number(r.ccHits) || 0;
    acc.hpHealed += parseGameNumber(r.hpHealed);
    acc.allyHp += parseGameNumber(r.allyHp);
    acc.totalDamageToFort += parseGameNumber(r.totalDamageToFort);
    acc.cannonHits += Number(r.cannonHits) || 0;
    acc.objectsDestroyedCannon += Number(r.objectsDestroyedCannon) || 0;
    acc.maxCannonHitDistance = Math.max(
      acc.maxCannonHitDistance,
      Number(r.maxCannonHitDistance) || 0
    );
    acc.trapsTriggered += Number(r.trapsTriggered) || 0;
    acc.timeDeadSec += parseTimeToSeconds(r.timeDead);
    acc.timeSurvivedSec += parseTimeToSeconds(r.timeSurvived);
  }

  function accToDisplayRow(familyName, acc) {
    return {
      familyName,
      enemyKills: acc.enemyKills,
      deaths: acc.deaths,
      maxKillStreak: acc.maxKillStreak,
      damageDealt: formatGameNumber(acc.damageDealt),
      damageTaken: formatGameNumber(acc.damageTaken),
      ccHits: acc.ccHits,
      hpHealed: formatGameNumber(acc.hpHealed),
      allyHp: formatGameNumber(acc.allyHp),
      totalDamageToFort: formatGameNumber(acc.totalDamageToFort),
      cannonHits: acc.cannonHits,
      objectsDestroyedCannon: acc.objectsDestroyedCannon,
      maxCannonHitDistance: acc.maxCannonHitDistance,
      trapsTriggered: acc.trapsTriggered,
      timeDead: formatTimeFromSeconds(acc.timeDeadSec),
      timeSurvived: formatTimeFromSeconds(acc.timeSurvivedSec),
    };
  }

  function aggregateByFamily(data, dateKeys) {
    const map = new Map();
    for (const dk of dateKeys) {
      const entry = data[dk];
      if (!entry || !Array.isArray(entry.rows)) continue;
      for (const r of entry.rows) {
        const name = r.familyName;
        if (!map.has(name)) map.set(name, emptyAccumulator());
        mergeRowInto(map.get(name), r);
      }
    }
    return Array.from(map.entries())
      .map(([name, acc]) => accToDisplayRow(name, acc))
      .sort((a, b) => a.familyName.localeCompare(b.familyName, undefined, { sensitivity: "base" }));
  }

  function datesInWeek(data, mondayIso) {
    return sortedDateKeys(data).filter((d) => mondayOfWeekUTC(d) === mondayIso);
  }

  function uniqueWeekStarts(data) {
    const keys = sortedDateKeys(data);
    const set = new Map();
    for (const d of keys) {
      const m = mondayOfWeekUTC(d);
      if (!set.has(m)) set.set(m, []);
      set.get(m).push(d);
    }
    return Array.from(set.entries())
      .map(([monday, dates]) => ({ monday, dates }))
      .sort((a, b) => b.monday.localeCompare(a.monday));
  }

  function setBadge(outcome) {
    badgeEl.classList.remove("badge--defeat", "badge--victory", "badge--draw", "badge--mixed", "badge--hidden");
    const o = (outcome || "").toLowerCase();
    if (!o) {
      badgeEl.classList.add("badge--hidden");
      badgeEl.textContent = "";
      return;
    }
    if (o === "victory") {
      badgeEl.classList.add("badge--victory");
      badgeEl.textContent = "Victory";
      return;
    }
    if (o === "defeat") {
      badgeEl.classList.add("badge--defeat");
      badgeEl.textContent = "Defeat";
      return;
    }
    if (o === "draw") {
      badgeEl.classList.add("badge--draw");
      badgeEl.textContent = "Draw";
      return;
    }
    if (o === "mixed") {
      badgeEl.classList.add("badge--mixed");
      badgeEl.textContent = "Mixed week";
      return;
    }
    badgeEl.classList.add("badge--mixed");
    badgeEl.textContent = outcome;
  }

  function weekOutcomeLabel(data, dateKeys) {
    const outs = dateKeys.map((d) => (data[d].outcome || "").toLowerCase()).filter(Boolean);
    if (!outs.length) return "";
    const uniq = [...new Set(outs)];
    if (uniq.length === 1) return uniq[0];
    return "mixed";
  }

  function renderHead() {
    thead.innerHTML = COLS.map(
      (c) =>
        `<th class="${c.type === "text" ? "" : c.type}">${escapeHtml(c.label)}</th>`
    ).join("");
  }

  function getRowsForView() {
    const data = getWarData();
    const keys = sortedDateKeys(data);
    if (!keys.length) return { rows: [], meta: "No data in NODE_WAR_DATA", badge: "" };

    if (currentView === VIEW.DAILY) {
      const dk = currentDate && data[currentDate] ? currentDate : keys[keys.length - 1];
      const day = data[dk];
      const rows = (day.rows || []).slice();
      const outcome = day.outcome || "";
      return {
        rows,
        meta: `${formatShortDate(dk)} · Node war result`,
        badge: outcome,
      };
    }

    if (currentView === VIEW.WEEKLY) {
      const weeks = uniqueWeekStarts(data);
      const mon =
        currentWeekMonday && weeks.some((w) => w.monday === currentWeekMonday)
          ? currentWeekMonday
          : weeks[0].monday;
      const inWeek = datesInWeek(data, mon);
      const rows = aggregateByFamily(data, inWeek);
      const wk = weekOutcomeLabel(data, inWeek);
      const meta = `Week ${formatWeekRangeLabel(mon)} · ${inWeek.length} war${
        inWeek.length === 1 ? "" : "s"
      } logged`;
      return { rows, meta, badge: wk };
    }

    const rows = aggregateByFamily(data, keys);
    return {
      rows,
      meta: `Lifetime · ${keys.length} day${keys.length === 1 ? "" : "s"} recorded`,
      badge: "",
    };
  }

  function renderBody() {
    const { rows, meta, badge } = getRowsForView();
    metaEl.textContent = meta;
    setBadge(badge);

    const q = (search.value || "").trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => String(r.familyName).toLowerCase().includes(q))
      : rows;

    countEl.textContent =
      filtered.length === rows.length
        ? `${rows.length} players`
        : `${filtered.length} of ${rows.length} players`;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="${COLS.length}" class="empty">No matching family names.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map((r) => {
        const tds = COLS.map((c) => {
          const v = r[c.key];
          const cls = c.type === "text" ? "" : c.type;
          return `<td class="${cls}">${escapeHtml(String(v))}</td>`;
        }).join("");
        return `<tr>${tds}</tr>`;
      })
      .join("");
  }

  function populateDateSelect() {
    const data = getWarData();
    const keys = sortedDateKeys(data);
    dateSelect.innerHTML = keys
      .map((k) => `<option value="${escapeHtml(k)}">${escapeHtml(formatShortDate(k))}</option>`)
      .join("");
    if (keys.length) {
      currentDate = keys.includes(currentDate) ? currentDate : keys[keys.length - 1];
      dateSelect.value = currentDate;
    }
  }

  function populateWeekSelect() {
    const data = getWarData();
    const weeks = uniqueWeekStarts(data);
    weekSelect.innerHTML = weeks
      .map(({ monday, dates }) => {
        const label = `${formatWeekRangeLabel(monday)} (${dates.length} day${dates.length === 1 ? "" : "s"})`;
        return `<option value="${escapeHtml(monday)}">${escapeHtml(label)}</option>`;
      })
      .join("");
    if (weeks.length) {
      const mondays = weeks.map((w) => w.monday);
      currentWeekMonday = mondays.includes(currentWeekMonday)
        ? currentWeekMonday
        : mondays[0];
      weekSelect.value = currentWeekMonday;
    }
  }

  function updateScopeVisibility() {
    const daily = currentView === VIEW.DAILY;
    const weekly = currentView === VIEW.WEEKLY;
    dateField.hidden = !daily;
    weekField.hidden = !weekly;
    scopeRow.hidden = !daily && !weekly;
  }

  function setView(view) {
    currentView = view;
    viewTabs.forEach((btn) => {
      const on = btn.getAttribute("data-view") === view;
      btn.classList.toggle("tab--active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    updateScopeVisibility();
    renderBody();
  }

  function init() {
    renderHead();
    populateDateSelect();
    populateWeekSelect();
    updateScopeVisibility();

    const data = getWarData();
    const keys = sortedDateKeys(data);
    if (keys.length) {
      currentDate = keys[keys.length - 1];
      dateSelect.value = currentDate;
      const w = uniqueWeekStarts(data);
      if (w.length) {
        currentWeekMonday = mondayOfWeekUTC(currentDate);
        if (!w.some((x) => x.monday === currentWeekMonday)) currentWeekMonday = w[0].monday;
        weekSelect.value = currentWeekMonday;
      }
    }

    viewTabs.forEach((btn) => {
      btn.addEventListener("click", () => setView(btn.getAttribute("data-view")));
    });

    dateSelect.addEventListener("change", function () {
      currentDate = this.value;
      renderBody();
    });

    weekSelect.addEventListener("change", function () {
      currentWeekMonday = this.value;
      renderBody();
    });

    search.addEventListener("input", renderBody);

    setView(VIEW.DAILY);
  }

  init();
})();
