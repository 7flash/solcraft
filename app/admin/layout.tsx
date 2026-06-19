export default function AdminLayout({ children }: { children: any }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        html, body {
          min-height: 100% !important;
          height: auto !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          overscroll-behavior: auto !important;
        }
        body {
          touch-action: auto !important;
        }
        #melina-page-content {
          min-height: 100dvh !important;
          height: auto !important;
          overflow: visible !important;
        }
        [data-admin-page],
        .admin-page,
        .admin-shell,
        .admin-screen,
        .admin-layout,
        .economy-admin,
        .economy-page,
        .economy-shell {
          min-height: 100dvh !important;
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
        }
        .admin-scroll,
        .economy-scroll,
        .admin-panel,
        .economy-panel,
        .admin-card,
        .economy-card {
          max-height: none !important;
        }
        @media (max-width: 900px) {
          [data-admin-page],
          .admin-page,
          .admin-shell,
          .economy-admin,
          .economy-page,
          .economy-shell {
            width: 100% !important;
            max-width: none !important;
          }
        }
      ` }} />
      {children}
    </>
  );
}
