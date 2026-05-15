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
  const viewTabs = document.querySelectorAll("[data-view]");
  const dateSelect = document.getElementById("date-select");
  const weekSelect = document.getElementById("week-select");
  const scopeRow = document.getElementById("scope-row");
  const dateField = document.getElementById("date-field");
  const weekField = document.getElementById("week-field");

  let currentView = VIEW.DAILY;
  let currentDate = "";
  let currentWeekSunday = "";
  let sortKey = null;
  let sortDir = "asc";

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

  /** Sunday (UTC) of the Sunday–Saturday week containing `iso` (ISO YYYY-MM-DD). */
  function sundayOfWeekUTC(iso) {
    const dt = parseISOUTC(iso);
    const dow = dt.getUTCDay();
    dt.setUTCDate(dt.getUTCDate() - dow);
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

  function formatWeekRangeLabel(sundayIso) {
    const saturday = addDaysUTC(sundayIso, 6);
    return `${formatShortDate(sundayIso)} – ${formatShortDate(saturday)}`;
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

  function datesInWeek(data, sundayIso) {
    return sortedDateKeys(data).filter((d) => sundayOfWeekUTC(d) === sundayIso);
  }

  function uniqueWeekStarts(data) {
    const keys = sortedDateKeys(data);
    const set = new Map();
    for (const d of keys) {
      const sun = sundayOfWeekUTC(d);
      if (!set.has(sun)) set.set(sun, []);
      set.get(sun).push(d);
    }
    return Array.from(set.entries())
      .map(([sunday, dates]) => ({ sunday, dates }))
      .sort((a, b) => b.sunday.localeCompare(a.sunday));
  }

  function resetSort() {
    sortKey = null;
    sortDir = "asc";
  }

  function colDefByKey(key) {
    return COLS.find((c) => c.key === key);
  }

  function cellSortValue(row, colDef) {
    const v = row[colDef.key];
    switch (colDef.key) {
      case "familyName":
        return String(v || "").toLowerCase();
      case "timeDead":
      case "timeSurvived":
        return parseTimeToSeconds(v);
      default:
        if (colDef.type === "num") return Number(v) || 0;
        if (colDef.type === "str") return parseGameNumber(v);
        return String(v || "");
    }
  }

  function compareSortValues(va, vb) {
    if (typeof va === "number" && typeof vb === "number") {
      if (va < vb) return -1;
      if (va > vb) return 1;
      return 0;
    }
    return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: "base" });
  }

  function sortRowsInPlace(rows) {
    if (!sortKey) return rows;
    const col = colDefByKey(sortKey);
    if (!col) return rows;
    const nameCol = colDefByKey("familyName");
    const mult = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = cellSortValue(a, col);
      const vb = cellSortValue(b, col);
      let cmp = compareSortValues(va, vb);
      if (cmp !== 0) return mult * cmp;
      return compareSortValues(cellSortValue(a, nameCol), cellSortValue(b, nameCol));
    });
  }

  function applyHeaderSortIndicators() {
    thead.querySelectorAll(".th-sort-btn").forEach((btn) => {
      const key = btn.getAttribute("data-sort-key");
      const th = btn.closest("th");
      const ind = btn.querySelector(".sort-ind");
      if (!th || !ind) return;
      th.removeAttribute("aria-sort");
      ind.textContent = "";
      if (sortKey === key) {
        th.setAttribute("aria-sort", sortDir === "asc" ? "ascending" : "descending");
        ind.textContent = sortDir === "asc" ? "▲" : "▼";
      }
    });
  }

  function renderHead() {
    thead.innerHTML = COLS.map((c) => {
      const align = c.type === "text" ? "th--text" : "th--num";
      const num = c.type === "text" ? "" : c.type;
      return `<th class="th-sortable ${align}${num ? " " + num : ""}" scope="col">
        <button type="button" class="th-sort-btn" data-sort-key="${escapeHtml(c.key)}" aria-label="Sort by ${escapeHtml(c.label)}">
          <span class="th-sort-label">${escapeHtml(c.label)}</span>
          <span class="sort-ind" aria-hidden="true"></span>
        </button>
      </th>`;
    }).join("");
  }

  function getRowsForView() {
    const data = getWarData();
    const keys = sortedDateKeys(data);
    if (!keys.length) return { rows: [], meta: "No data in NODE_WAR_DATA" };

    if (currentView === VIEW.DAILY) {
      const dk = currentDate && data[currentDate] ? currentDate : keys[keys.length - 1];
      const day = data[dk];
      const rows = (day.rows || []).slice();
      return {
        rows,
        meta: `${formatShortDate(dk)} · Node war result`,
      };
    }

    if (currentView === VIEW.WEEKLY) {
      const weeks = uniqueWeekStarts(data);
      const sun =
        currentWeekSunday && weeks.some((w) => w.sunday === currentWeekSunday)
          ? currentWeekSunday
          : weeks[0].sunday;
      const inWeek = datesInWeek(data, sun);
      const rows = aggregateByFamily(data, inWeek);
      const meta = `Week ${formatWeekRangeLabel(sun)} · ${inWeek.length} war${
        inWeek.length === 1 ? "" : "s"
      } logged`;
      return { rows, meta };
    }

    const rows = aggregateByFamily(data, keys);
    return {
      rows,
      meta: `Lifetime · ${keys.length} day${keys.length === 1 ? "" : "s"} recorded`,
    };
  }

  function renderBody() {
    const { rows, meta } = getRowsForView();
    metaEl.textContent = meta;

    const q = (search.value || "").trim().toLowerCase();
    const total = rows.length;
    let filtered = q
      ? rows.filter((r) => String(r.familyName).toLowerCase().includes(q))
      : rows.slice();
    filtered = sortRowsInPlace(filtered);

    countEl.textContent =
      filtered.length === total
        ? `${total} players`
        : `${filtered.length} of ${total} players`;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="${COLS.length}" class="empty">No matching family names.</td></tr>`;
      applyHeaderSortIndicators();
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

    applyHeaderSortIndicators();
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
      .map(({ sunday, dates }) => {
        const label = `${formatWeekRangeLabel(sunday)} (${dates.length} day${dates.length === 1 ? "" : "s"})`;
        return `<option value="${escapeHtml(sunday)}">${escapeHtml(label)}</option>`;
      })
      .join("");
    if (weeks.length) {
      const sundays = weeks.map((w) => w.sunday);
      currentWeekSunday = sundays.includes(currentWeekSunday)
        ? currentWeekSunday
        : sundays[0];
      weekSelect.value = currentWeekSunday;
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
    resetSort();
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
        currentWeekSunday = sundayOfWeekUTC(currentDate);
        if (!w.some((x) => x.sunday === currentWeekSunday)) currentWeekSunday = w[0].sunday;
        weekSelect.value = currentWeekSunday;
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
      currentWeekSunday = this.value;
      renderBody();
    });

    search.addEventListener("input", renderBody);

    const tableEl = thead.closest("table");
    tableEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".th-sort-btn");
      if (!btn || !thead.contains(btn)) return;
      const key = btn.getAttribute("data-sort-key");
      if (!key) return;
      if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
      else {
        sortKey = key;
        sortDir = "asc";
      }
      renderBody();
    });

    setView(VIEW.DAILY);
  }

  init();
})();
