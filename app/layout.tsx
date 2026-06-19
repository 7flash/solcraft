export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <title>World of SolCrafts — player-shaped Solana MMORPG</title>
      </head>
      <body>
        <main id="melina-page-content">{children}</main>
      </body>
    </html>
  );
}