const DOLL_CREATOR_CSS = String.raw`
:root {
  --dc-bg:#05080e;
  --dc-panel:rgba(8,15,25,.96);
  --dc-panel2:rgba(17,28,43,.98);
  --dc-paper:#f3ead7;
  --dc-muted:#b9af9d;
  --dc-line:rgba(243,234,215,.16);
  --dc-mint:#14f195;
  --dc-gold:#c79337;
}
html,body{margin:0;min-height:100%;background:var(--dc-bg);}
#solcraft-doll-creator{min-height:100vh;}
.doll-creator{
  min-height:100vh;
  box-sizing:border-box;
  padding:14px;
  color:var(--dc-paper);
  background:
    radial-gradient(circle at 15% 0%, rgba(20,241,149,.10), transparent 30rem),
    linear-gradient(180deg,#07101a,#03060b 80%);
  font-family:Geist,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}
.doll-creator *{box-sizing:border-box;}
.story-panel{
  background:linear-gradient(180deg,rgba(12,22,34,.96),rgba(5,10,18,.96));
  border:1px solid var(--dc-line);
  border-radius:20px;
  box-shadow:0 18px 48px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.04);
}
.kicker{margin:0 0 5px;color:var(--dc-gold);font:900 10px/1 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;}
h1,h2,h3{margin:0;color:var(--dc-paper);font-family:Fraunces,Georgia,serif;letter-spacing:-.035em;}
h1{font-size:clamp(36px,5vw,64px);line-height:.92;}
h2{font-size:clamp(28px,3vw,42px);}
button{
  min-height:34px;
  padding:7px 13px;
  border:1px solid var(--dc-line);
  border-radius:999px;
  background:#111c2b;
  color:var(--dc-paper);
  font-weight:850;
  cursor:pointer;
}
button:hover{background:#172438;}
button.primary{background:var(--dc-mint);border-color:var(--dc-mint);color:#06120d;}
button:disabled{opacity:.5;cursor:not-allowed;}
.hero{padding:16px 18px;margin-bottom:12px;}
.hero p{max-width:920px;color:#d8cfb7;line-height:1.45;margin:10px 0 0;}
.layout{display:grid;grid-template-columns:minmax(260px,330px) minmax(0,1fr) minmax(300px,360px);gap:12px;align-items:start;}
.panel{padding:14px;}
.preview-panel{display:grid;gap:12px;justify-items:center;}
.preview{
  width:280px;max-width:100%;aspect-ratio:1/1;
  border-radius:24px;
  border:1px solid var(--dc-line);
  background:repeating-conic-gradient(rgba(255,255,255,.06) 0% 25%, rgba(0,0,0,.10) 0% 50%) 50%/16px 16px;
  display:grid;place-items:center;
}
.preview canvas{width:100%;height:100%;image-rendering:auto;}
.controls{display:grid;gap:12px;}
.control-row{display:grid;grid-template-columns:72px 1fr 44px;gap:8px;align-items:center;}
.control-row label{font-weight:900;color:#d8cfb7;}
.control-row input[type=range]{width:100%;}
.control-row output{font:900 12px/1 ui-monospace,monospace;color:var(--dc-paper);}
.checks{display:grid;gap:8px;margin-top:8px;}
.checks label{display:flex;gap:8px;align-items:center;color:#d8cfb7;font-weight:850;}
.sheet-panel{display:grid;gap:12px;overflow:hidden;}
.toolbar{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;}
.meta{color:var(--dc-muted);font:800 12px/1.3 ui-monospace,monospace;}
.sheet-scroll{overflow:auto;max-height:72vh;border-radius:16px;border:1px solid var(--dc-line);background:rgba(243,234,215,.03);}
.sheet-stage{position:relative;width:max-content;min-width:512px;background:repeating-conic-gradient(rgba(255,255,255,.06) 0% 25%, rgba(0,0,0,.10) 0% 50%) 50%/16px 16px;}
.sheet-stage img{display:block;max-width:none;}
.cell-button{
  position:absolute;
  border:1px solid rgba(20,241,149,.45);
  border-radius:0;
  background:rgba(0,0,0,.05);
  min-height:0;
  padding:0;
}
.cell-button:hover{background:rgba(20,241,149,.16);}
.cell-button.on{box-shadow:inset 0 0 0 3px var(--dc-mint);background:rgba(20,241,149,.18);}
.row-label{
  position:absolute;left:4px;padding:2px 6px;border-radius:8px;
  background:rgba(0,0,0,.5);color:#fff;font:900 11px/1 ui-monospace,monospace;pointer-events:none;
}
.help{display:grid;gap:10px;}
.help pre{margin:0;padding:12px;border:1px solid var(--dc-line);border-radius:14px;background:rgba(0,0,0,.24);color:#fff0c8;white-space:pre-wrap;font:800 12px/1.45 ui-monospace,monospace;}
.actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;}
@media(max-width:1200px){.layout{grid-template-columns:1fr 1fr}.sheet-panel{grid-column:1/-1;}.preview{width:220px;}}
@media(max-width:760px){.layout{grid-template-columns:1fr}.sheet-scroll{max-height:58vh}.control-row{grid-template-columns:68px 1fr 36px;}}
`;

export default function DollCreatorPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DOLL_CREATOR_CSS }} />
      <div id="solcraft-doll-creator" />
    </>
  );
}