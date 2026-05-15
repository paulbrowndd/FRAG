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

  const rows = window.NODE_WAR_ROWS || [];
  const thead = document.getElementById("thead");
  const tbody = document.getElementById("tbody");
  const search = document.getElementById("search");
  const countEl = document.getElementById("count");

  function renderHead() {
    thead.innerHTML = COLS.map(
      (c) =>
        `<th class="${c.type === "text" ? "" : c.type}">${escapeHtml(c.label)}</th>`
    ).join("");
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function renderBody(filter) {
    const q = (filter || "").trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => r.familyName.toLowerCase().includes(q))
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

  renderHead();
  renderBody("");

  search.addEventListener("input", function () {
    renderBody(this.value);
  });
})();
