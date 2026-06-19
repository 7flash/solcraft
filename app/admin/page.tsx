import { ADMIN_DEBUG_ITEMS, ADMIN_SECTIONS, TOOL_ATLAS_ADMIN_SUMMARY } from "./adminNav";

function statusClass(status?: string) {
  return ["admin-badge", status ? `admin-badge-${status}` : ""].filter(Boolean).join(" ");
}

export default function AdminHomePage() {
  return (
    <main className="admin-home" data-admin-page="home">
      <section className="admin-hero">
        <p className="admin-kicker">SolCraft operator dashboard</p>
        <div className="admin-hero-grid">
          <div>
            <h1>Admin panel</h1>
            <p>
              Production-safe pages first: sync the world locally, impersonate real player states, verify atlases, then deploy and refresh clients.
            </p>
          </div>
          <aside className="admin-tool-plan" aria-label="Tool atlas plan">
            <span className="admin-badge">new art contract</span>
            <h2>{TOOL_ATLAS_ADMIN_SUMMARY.title}</h2>
            <p>
              Runtime file <code>{TOOL_ATLAS_ADMIN_SUMMARY.runtimeFile}</code> · {TOOL_ATLAS_ADMIN_SUMMARY.cols}×{TOOL_ATLAS_ADMIN_SUMMARY.rows}
            </p>
            <ol>
              {TOOL_ATLAS_ADMIN_SUMMARY.rowsPlan.map((row, index) => (
                <li key={row.id}><b>row {index}</b> {row.label}</li>
              ))}
            </ol>
          </aside>
        </div>
      </section>

      {ADMIN_SECTIONS.map((section) => (
        <section className="admin-section" key={section.id}>
          <div className="admin-section-head">
            <p className="admin-kicker">{section.eyebrow}</p>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
          </div>
          <div className="admin-card-grid">
            {section.items.map((item) => (
              <a className="admin-card" href={item.href} key={item.href} data-admin-status={item.status || "active"}>
                <span className={statusClass(item.status)}>{item.badge || item.status || "active"}</span>
                <b>{item.title}</b>
                <p>{item.description}</p>
              </a>
            ))}
          </div>
        </section>
      ))}

      <section className="admin-section admin-section-compact">
        <div className="admin-section-head">
          <p className="admin-kicker">Diagnostics</p>
          <h2>Debug pages</h2>
          <p>Kept accessible, but out of the main operator path.</p>
        </div>
        <div className="admin-debug-list">
          {ADMIN_DEBUG_ITEMS.map((item) => <a href={item.href} key={item.href}>{item.title}</a>)}
        </div>
      </section>
    </main>
  );
}
