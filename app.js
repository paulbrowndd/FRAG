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

  const VIEW = { DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly", LIFETIME: "lifetime" };

  const thead = document.getElementById("thead");
  const tbody = document.getElementById("tbody");
  const tfoot = document.getElementById("tfoot");
  const search = document.getElementById("search");
  const countEl = document.getElementById("count");
  const metaEl = document.getElementById("header-meta");
  const viewTabs = document.querySelectorAll("[data-view]");
  const dateSelect = document.getElementById("date-select");
  const weekSelect = document.getElementById("week-select");
  const monthSelect = document.getElementById("month-select");
  const scopeRow = document.getElementById("scope-row");
  const dateField = document.getElementById("date-field");
  const weekField = document.getElementById("week-field");
  const monthField = document.getElementById("month-field");
  const mvpSection = document.getElementById("mvp-section");
  const mvpWinner = document.getElementById("mvp-winner");
  const mvpBreakdown = document.getElementById("mvp-breakdown");
  const mvpLeaderboard = document.getElementById("mvp-leaderboard");
  const attendancePanel = document.getElementById("attendance-panel");

  const MVP_COMPONENTS = [
    { key: "enemyKills", label: "Enemy kills", weight: 0.2 },
    { key: "damageDealt", label: "Damage dealt", weight: 0.15 },
    { key: "ccHits", label: "CC hits", weight: 0.15 },
    { key: "totalDamageToFort", label: "Fort damage", weight: 0.2 },
    { key: "healing", label: "HP healed + ally HP", weight: 0.1 },
    { key: "timeSurvived", label: "Time survived", weight: 0.1 },
    { key: "damageTaken", label: "Damage taken", weight: 0.05 },
    { key: "deaths", label: "Low deaths", weight: 0.05 },
  ];

  let currentView = VIEW.DAILY;
  let currentDate = "";
  let currentWeekSunday = "";
  let currentMonth = "";
  let sortKey = null;
  let sortDir = "asc";

  let rosterIndex = null;

  function getGuildRoster() {
    return Array.isArray(window.GUILD_ROSTER) ? window.GUILD_ROSTER : [];
  }

  function getGuildAliases() {
    return window.GUILD_NAME_ALIASES && typeof window.GUILD_NAME_ALIASES === "object"
      ? window.GUILD_NAME_ALIASES
      : {};
  }

  function getMemberTeam(name) {
    const teams = window.GUILD_MEMBER_TEAMS;
    return teams && typeof teams === "object" ? teams[name] || null : null;
  }

  function formatFamilyNameCell(warName) {
    const name = String(warName || "");
    const canon = resolveGuildName(name) || name;
    const team = getMemberTeam(canon);
    if (!team) return escapeHtml(name);
    const teamClass = `player-team player-team--${team.toLowerCase()}`;
    return `<span class="player-name">${escapeHtml(name)}</span><span class="${teamClass}">${escapeHtml(team)}</span>`;
  }

  function buildRosterIndex() {
    const map = new Map();
    for (const name of getGuildRoster()) {
      map.set(name.toLowerCase(), name);
    }
    return map;
  }

  function rosterIndexMap() {
    if (!rosterIndex) rosterIndex = buildRosterIndex();
    return rosterIndex;
  }

  /** Canonical roster name if this war row is a guild member; otherwise null. */
  function resolveGuildName(warName) {
    const raw = String(warName || "").trim();
    if (!raw) return null;
    const idx = rosterIndexMap();
    const aliases = getGuildAliases();
    const alias = aliases[raw] || aliases[raw.toLowerCase()];
    const candidates = alias ? [alias, raw] : [raw];
    for (const c of candidates) {
      const hit = idx.get(c.toLowerCase());
      if (hit) return hit;
    }
    return null;
  }

  function isGuildMember(warName) {
    return resolveGuildName(warName) !== null;
  }

  function filterGuildRows(rows) {
    return rows.filter((r) => isGuildMember(r.familyName));
  }

  function getPeriodDateKeys(data) {
    const keys = sortedDateKeys(data);
    if (!keys.length) return [];

    if (currentView === VIEW.DAILY) {
      const dk = currentDate && data[currentDate] ? currentDate : keys[keys.length - 1];
      return [dk];
    }
    if (currentView === VIEW.WEEKLY) {
      const weeks = uniqueWeekStarts(data);
      const sun =
        currentWeekSunday && weeks.some((w) => w.sunday === currentWeekSunday)
          ? currentWeekSunday
          : weeks[0]?.sunday;
      return sun ? datesInWeek(data, sun) : [];
    }
    if (currentView === VIEW.MONTHLY) {
      const months = uniqueMonths(data);
      const mk =
        currentMonth && months.some((m) => m.month === currentMonth)
          ? currentMonth
          : months[0]?.month;
      return mk ? datesInMonth(data, mk) : [];
    }
    return keys;
  }

  function presentGuildCanonicalSet(data, dateKeys) {
    const present = new Set();
    for (const dk of dateKeys) {
      const day = data[dk];
      if (!day || !Array.isArray(day.rows)) continue;
      for (const r of day.rows) {
        const canon = resolveGuildName(r.familyName);
        if (canon) present.add(canon);
      }
    }
    return present;
  }

  function missingGuildMembers(data, dateKeys) {
    const present = presentGuildCanonicalSet(data, dateKeys);
    return getGuildRoster()
      .filter((name) => !present.has(name))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  function renderAttendancePanel(data, dateKeys) {
    if (!attendancePanel || !getGuildRoster().length) {
      if (attendancePanel) attendancePanel.hidden = true;
      return;
    }

    const rosterSize = getGuildRoster().length;
    const present = presentGuildCanonicalSet(data, dateKeys);
    const missing = missingGuildMembers(data, dateKeys);
    const wars = dateKeys.length;

    let periodLabel = "this period";
    if (currentView === VIEW.DAILY && dateKeys[0]) {
      periodLabel = formatShortDate(dateKeys[0]);
    } else if (currentView === VIEW.WEEKLY && dateKeys[0]) {
      periodLabel = `week of ${formatWeekRangeLabel(sundayOfWeekUTC(dateKeys[0]))}`;
    } else if (currentView === VIEW.MONTHLY && dateKeys[0]) {
      periodLabel = formatMonthLabel(monthKeyUTC(dateKeys[0]));
    } else if (currentView === VIEW.LIFETIME) {
      periodLabel = "all logged wars";
    }

    const warNote =
      wars === 1 ? "1 war" : wars > 1 ? `${wars} wars` : "no wars logged";

    const teamOrder = ["Ball", "Defense", "Sailor"];
    const teamStats = new Map();
    for (const name of getGuildRoster()) {
      const team = getMemberTeam(name) || "Unassigned";
      if (!teamStats.has(team)) teamStats.set(team, { roster: 0, present: 0, missing: [] });
      const stat = teamStats.get(team);
      stat.roster += 1;
      if (present.has(name)) stat.present += 1;
      else stat.missing.push(name);
    }

    const teamSummary = teamOrder
      .filter((team) => teamStats.has(team))
      .map((team) => {
        const stat = teamStats.get(team);
        return `<span class="attendance-team-stat"><strong>${escapeHtml(team)}</strong> ${stat.present}/${stat.roster}</span>`;
      })
      .join("");

    const missingByTeam = teamOrder
      .filter((team) => teamStats.get(team)?.missing.length)
      .map((team) => {
        const names = teamStats
          .get(team)
          .missing.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
          .map((n) => escapeHtml(n))
          .join(", ");
        return `<p class="attendance-missing-team"><strong>${escapeHtml(team)}</strong> (${teamStats.get(team).missing.length}): ${names}</p>`;
      })
      .join("");

    attendancePanel.hidden = false;
    attendancePanel.innerHTML = `
      <p class="attendance-summary">
        <strong>${present.size}</strong> of <strong>${rosterSize}</strong> guild members in ${escapeHtml(periodLabel)}
        (${escapeHtml(warNote)}).
      </p>
      ${teamSummary ? `<p class="attendance-teams">${teamSummary}</p>` : ""}
      ${
        missing.length
          ? `<details class="attendance-missing">
              <summary>Absent (${missing.length})</summary>
              <div class="attendance-missing-list">${missingByTeam || `<p>${missing.map((n) => escapeHtml(n)).join(", ")}</p>`}</div>
            </details>`
          : `<p class="attendance-all">Full guild attendance for ${escapeHtml(periodLabel)}.</p>`
      }
    `;
  }

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

  /** Calendar month key `YYYY-MM` (UTC) for an ISO date. */
  function monthKeyUTC(iso) {
    const dt = parseISOUTC(iso);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function formatMonthLabel(monthKey) {
    const [y, m] = monthKey.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
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

  function valueForAverage(row, colDef) {
    if (colDef.key === "timeDead" || colDef.key === "timeSurvived") {
      return parseTimeToSeconds(row[colDef.key]);
    }
    if (colDef.type === "num") return Number(row[colDef.key]) || 0;
    return parseGameNumber(row[colDef.key]);
  }

  function formatAvgNumber(mean) {
    if (!Number.isFinite(mean)) return "0";
    const rounded = Math.round(mean * 10) / 10;
    if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
    return rounded.toFixed(1);
  }

  /** Averages over the given rows (same list shown in the table, after search). */
  function computeAverageRow(rows) {
    const n = rows.length;
    if (!n) return null;
    const out = { familyName: `Average (${n})` };
    for (const c of COLS) {
      if (c.key === "familyName") continue;
      let sum = 0;
      for (const r of rows) sum += valueForAverage(r, c);
      const mean = sum / n;
      if (c.type === "num") out[c.key] = formatAvgNumber(mean);
      else if (c.key === "timeDead" || c.key === "timeSurvived") {
        out[c.key] = formatTimeFromSeconds(Math.round(mean));
      } else {
        out[c.key] = formatGameNumber(mean);
      }
    }
    return out;
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

  function safeRatio(value, highest) {
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (!Number.isFinite(highest) || highest <= 0) return 0;
    return value / highest;
  }

  function mvpMetricsFromRow(row) {
    return {
      enemyKills: Number(row.enemyKills) || 0,
      damageDealt: parseGameNumber(row.damageDealt),
      ccHits: Number(row.ccHits) || 0,
      totalDamageToFort: parseGameNumber(row.totalDamageToFort),
      healing: parseGameNumber(row.hpHealed) + parseGameNumber(row.allyHp),
      timeSurvived: parseTimeToSeconds(row.timeSurvived),
      damageTaken: parseGameNumber(row.damageTaken),
      deaths: Number(row.deaths) || 0,
    };
  }

  /** Monthly MVP: weighted score vs guild-high for each category. */
  function computeMvpScores(rows) {
    if (!rows.length) return [];
    const withMetrics = rows.map((row) => ({
      familyName: row.familyName,
      m: mvpMetricsFromRow(row),
    }));
    const max = {
      enemyKills: Math.max(...withMetrics.map((x) => x.m.enemyKills)),
      damageDealt: Math.max(...withMetrics.map((x) => x.m.damageDealt)),
      ccHits: Math.max(...withMetrics.map((x) => x.m.ccHits)),
      totalDamageToFort: Math.max(...withMetrics.map((x) => x.m.totalDamageToFort)),
      healing: Math.max(...withMetrics.map((x) => x.m.healing)),
      timeSurvived: Math.max(...withMetrics.map((x) => x.m.timeSurvived)),
      damageTaken: Math.max(...withMetrics.map((x) => x.m.damageTaken)),
      deaths: Math.max(...withMetrics.map((x) => x.m.deaths)),
    };

    return withMetrics
      .map(({ familyName, m }) => {
        const parts = {
          enemyKills: 0.2 * safeRatio(m.enemyKills, max.enemyKills),
          damageDealt: 0.15 * safeRatio(m.damageDealt, max.damageDealt),
          ccHits: 0.15 * safeRatio(m.ccHits, max.ccHits),
          totalDamageToFort: 0.2 * safeRatio(m.totalDamageToFort, max.totalDamageToFort),
          healing: 0.1 * safeRatio(m.healing, max.healing),
          timeSurvived: 0.1 * safeRatio(m.timeSurvived, max.timeSurvived),
          damageTaken: 0.05 * safeRatio(m.damageTaken, max.damageTaken),
          deaths: 0.05 * (max.deaths > 0 ? 1 - m.deaths / max.deaths : 1),
        };
        const score = Object.values(parts).reduce((sum, v) => sum + v, 0);
        return { familyName, score, parts };
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.familyName.localeCompare(b.familyName, undefined, { sensitivity: "base" })
      );
  }

  function formatMvpScore(score) {
    return `${(score * 100).toFixed(1)}%`;
  }

  function formatMvpWeight(weight) {
    const pct = weight * 100;
    return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
  }

  function renderMvpSection(rows) {
    if (!mvpSection) return;
    const guildRows = filterGuildRows(rows);
    const show = currentView === VIEW.MONTHLY && guildRows.length > 0;
    mvpSection.hidden = !show;
    if (!show) return;

    const ranked = computeMvpScores(guildRows);
    const winner = ranked[0];
    const topN = ranked.slice(0, 10);

    mvpWinner.innerHTML = `
      <p class="mvp-winner-label">MVP</p>
      <p class="mvp-winner-name">${formatFamilyNameCell(winner.familyName)}</p>
      <p class="mvp-winner-score">Overall score ${escapeHtml(formatMvpScore(winner.score))}</p>
    `;

    mvpBreakdown.innerHTML = MVP_COMPONENTS.map(
      (c) => `<div>
        <dt>${escapeHtml(c.label)}</dt>
        <dd class="mvp-weight">${escapeHtml(formatMvpWeight(c.weight))}</dd>
      </div>`
    ).join("");

    mvpLeaderboard.innerHTML = topN
      .map((entry, i) => {
        const first = i === 0 ? " mvp-rank-item--first" : "";
        return `<li class="mvp-rank-item${first}">
          <span class="mvp-rank-num">${i + 1}</span>
          <span class="mvp-rank-name">${formatFamilyNameCell(entry.familyName)}</span>
          <span class="mvp-rank-score">${escapeHtml(formatMvpScore(entry.score))}</span>
        </li>`;
      })
      .join("");
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

  function datesInMonth(data, monthKey) {
    return sortedDateKeys(data).filter((d) => monthKeyUTC(d) === monthKey);
  }

  function uniqueMonths(data) {
    const keys = sortedDateKeys(data);
    const set = new Map();
    for (const d of keys) {
      const mk = monthKeyUTC(d);
      if (!set.has(mk)) set.set(mk, []);
      set.get(mk).push(d);
    }
    return Array.from(set.entries())
      .map(([month, dates]) => ({ month, dates }))
      .sort((a, b) => b.month.localeCompare(a.month));
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

    if (currentView === VIEW.MONTHLY) {
      const months = uniqueMonths(data);
      const mk =
        currentMonth && months.some((m) => m.month === currentMonth)
          ? currentMonth
          : months[0].month;
      const inMonth = datesInMonth(data, mk);
      const rows = aggregateByFamily(data, inMonth);
      const meta = `${formatMonthLabel(mk)} · ${inMonth.length} war${
        inMonth.length === 1 ? "" : "s"
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
    const data = getWarData();
    const periodKeys = getPeriodDateKeys(data);
    const { rows, meta } = getRowsForView();
    metaEl.textContent = meta;
    renderAttendancePanel(data, periodKeys);

    const guildFiltered = filterGuildRows(rows);
    renderMvpSection(guildFiltered);

    const q = (search.value || "").trim().toLowerCase();
    const total = guildFiltered.length;
    let filtered = q
      ? guildFiltered.filter((r) => {
          const name = String(r.familyName).toLowerCase();
          const team = (getMemberTeam(resolveGuildName(r.familyName) || r.familyName) || "").toLowerCase();
          return name.includes(q) || team.includes(q);
        })
      : guildFiltered.slice();
    filtered = sortRowsInPlace(filtered);

    const countText =
      filtered.length === total
        ? `${total} players`
        : `${filtered.length} of ${total} players`;

    countEl.textContent = countText;

    if (!filtered.length) {
      const emptyMsg = "No matching family names.";
      tbody.innerHTML = `<tr><td colspan="${COLS.length}" class="empty">${escapeHtml(emptyMsg)}</td></tr>`;
      tfoot.innerHTML = "";
      applyHeaderSortIndicators();
      return;
    }

    tbody.innerHTML = filtered
      .map((r) => {
        const tds = COLS.map((c) => {
          const v = r[c.key];
          const cls = c.type === "text" ? "" : c.type;
          if (c.key === "familyName") {
            return `<td class="${cls}">${formatFamilyNameCell(v)}</td>`;
          }
          return `<td class="${cls}">${escapeHtml(String(v))}</td>`;
        }).join("");
        return `<tr>${tds}</tr>`;
      })
      .join("");

    const avgRow = computeAverageRow(filtered);
    tfoot.innerHTML = avgRow
      ? `<tr>${COLS.map((c) => {
          const v = avgRow[c.key];
          const cls = c.type === "text" ? "" : c.type;
          return `<td class="${cls}">${escapeHtml(String(v))}</td>`;
        }).join("")}</tr>`
      : "";

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

  function populateMonthSelect() {
    const data = getWarData();
    const months = uniqueMonths(data);
    monthSelect.innerHTML = months
      .map(({ month, dates }) => {
        const label = `${formatMonthLabel(month)} (${dates.length} day${dates.length === 1 ? "" : "s"})`;
        return `<option value="${escapeHtml(month)}">${escapeHtml(label)}</option>`;
      })
      .join("");
    if (months.length) {
      const monthKeys = months.map((m) => m.month);
      currentMonth = monthKeys.includes(currentMonth) ? currentMonth : monthKeys[0];
      monthSelect.value = currentMonth;
    }
  }

  function updateScopeVisibility() {
    const daily = currentView === VIEW.DAILY;
    const weekly = currentView === VIEW.WEEKLY;
    const monthly = currentView === VIEW.MONTHLY;
    dateField.hidden = !daily;
    weekField.hidden = !weekly;
    monthField.hidden = !monthly;
    scopeRow.hidden = !daily && !weekly && !monthly;
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
    populateMonthSelect();
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
      const mo = uniqueMonths(data);
      if (mo.length) {
        currentMonth = monthKeyUTC(currentDate);
        if (!mo.some((x) => x.month === currentMonth)) currentMonth = mo[0].month;
        monthSelect.value = currentMonth;
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

    monthSelect.addEventListener("change", function () {
      currentMonth = this.value;
      renderBody();
    });

    search.addEventListener("input", renderBody);

    const tableEl = thead.closest("table");
    tableEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".th-sort-btn");
      if (!btn || !thead.contains(btn)) return;
      const key = btn.getAttribute("data-sort-key");
      if (!key) return;
      if (sortKey === key) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortKey = key;
        // Name: A→Z first; stats: high→low first (then click again to flip).
        sortDir = key === "familyName" ? "asc" : "desc";
      }
      renderBody();
    });

    setView(VIEW.DAILY);
  }

  init();
})();
