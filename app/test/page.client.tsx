/** @jsxImportSource tradjs/client */
import { render } from "tradjs/client";

const root = document.getElementById("tradjs-repro")!;

let tab = "actions";
let claimed: Record<string, boolean> = {};

const rows = [
  { id: "open-character", category: "actions", title: "Open Character", done: true },
  { id: "build-house", category: "buildings", title: "Build House", done: true },
  { id: "build-warehouse", category: "buildings", title: "Build Warehouse", done: true },
];

function visibleRows() {
  return rows.filter((r) => r.category === tab);
}

function App() {
  return (
    <main>
      <div className="guide-tabs">
        <button data-tab="actions" className={tab === "actions" ? "on" : ""}>Actions</button>
        <button data-tab="buildings" className={tab === "buildings" ? "on" : ""}>Buildings</button>
      </div>

      <div className="guide-list">
        {visibleRows().map((row) => (
          <div className="guide-card">
            <b>{row.title}</b>
            <span data-row-id={row.id}>{claimed[row.id] ? "claimed" : "ready"}</span>
            {row.done && !claimed[row.id] ? (
              <button data-guide-claim={row.id}>Claim</button>
            ) : (
              <em>✓ reward</em>
            )}
          </div>
        ))}
      </div>

      <pre id="result" />
    </main>
  );
}

function paint() {
  render(<App />, root);
}

root.addEventListener("click", (ev) => {
  const target = ev.target as HTMLElement;

  const tabBtn = target.closest("[data-tab]") as HTMLElement | null;
  if (tabBtn) {
    tab = tabBtn.dataset.tab || "actions";
    paint();
    check();
    return;
  }

  const claimBtn = target.closest("[data-guide-claim]") as HTMLElement | null;
  if (claimBtn) {
    const id = claimBtn.dataset.guideClaim!;
    claimed[id] = true;
    paint();
    check();
  }
});

function check() {
  const visibleIds = [...root.querySelectorAll("[data-row-id]")].map((el) =>
    el.getAttribute("data-row-id")
  );

  const claimIds = [...root.querySelectorAll("[data-guide-claim]")].map((el) =>
    el.getAttribute("data-guide-claim")
  );

  document.getElementById("result")!.textContent = JSON.stringify({
    tab,
    visibleIds,
    claimIds,
    html: root.innerHTML,
  }, null, 2);
}

paint();
check();
