const TERRAIN_LAB_CSS = String.raw`
:root{--tl-bg:#080a0d;--tl-panel:rgba(23,24,21,.88);--tl-paper:#f6ead6;--tl-muted:#cdbf9e;--tl-line:rgba(246,234,214,.16);--tl-mint:#68d6a1;--tl-gold:#d6a95b;}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:var(--tl-bg);}
#solcraft-terrain-lab{width:100vw;height:100vh;}
.terrain-lab{position:relative;width:100vw;height:100vh;overflow:hidden;color:var(--tl-paper);background:radial-gradient(circle at 28% 14%,rgba(214,169,91,.12),transparent 28rem),linear-gradient(180deg,#12140f,#07080a 78%);font-family:Outfit,Geist,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
.terrain-lab *{box-sizing:border-box;}
.terrain-world{position:absolute;inset:0;}
.terrain-world canvas{display:block;width:100%;height:100%;}
.terrain-ui{position:absolute;top:14px;right:14px;bottom:14px;width:min(420px,calc(100vw - 28px));overflow:auto;padding:16px;border:1px solid var(--tl-line);border-radius:24px;background:linear-gradient(180deg,rgba(30,31,25,.92),rgba(13,14,13,.9));box-shadow:0 24px 70px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.05);backdrop-filter:blur(14px);}
.kicker{margin:0 0 7px;color:var(--tl-gold);font:900 10px/1 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;}
h1,h2{margin:0;color:var(--tl-paper);font-family:Fraunces,Georgia,serif;letter-spacing:-.035em;}
h1{font-size:clamp(36px,5vw,58px);line-height:.9;}h2{font-size:24px;margin-bottom:8px;}
p{margin:9px 0 14px;color:#ddcfad;line-height:1.42;font-size:13px;}.tiny{font-size:12px;color:var(--tl-muted);}
.card{display:grid;gap:10px;margin-top:12px;padding:12px;border:1px solid var(--tl-line);border-radius:18px;background:rgba(246,234,214,.055);}
label{display:grid;gap:6px;color:#e9ddc3;font-weight:850;font-size:12px;}label b{float:right;color:#fff3ca;font:900 11px/1 ui-monospace,monospace;}input,button{font:inherit;border:1px solid var(--tl-line);border-radius:12px;background:rgba(255,255,255,.08);color:var(--tl-paper);min-height:36px;padding:7px 10px;outline:none;}input[type=range]{padding:0;min-height:26px;}button{cursor:pointer;font-weight:900;}button:hover{background:rgba(255,255,255,.12);}button.primary{background:var(--tl-mint);border-color:var(--tl-mint);color:#07130d;}.buttons{display:flex;flex-wrap:wrap;gap:8px;}.status{margin-top:12px;color:#afffd2;font:850 12px/1.35 ui-monospace,monospace;}
@media(max-width:820px){.terrain-ui{left:10px;right:10px;top:auto;bottom:10px;width:auto;max-height:48vh;padding:12px;border-radius:20px;}h1{font-size:34px;}.card{margin-top:9px;}}
`;

export default function TerrainLabPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TERRAIN_LAB_CSS }} />
      <div id="solcraft-terrain-lab" />
    </>
  );
}
