const CHARACTER_LAB_CSS = String.raw`
:root {
  --wos-bg:#050911;
  --wos-panel:rgba(8,13,23,.88);
  --wos-panel2:rgba(12,22,34,.94);
  --wos-paper:#f3ead7;
  --wos-muted:#b9af9d;
  --wos-line:rgba(243,234,215,.16);
  --wos-mint:#14f195;
  --wos-gold:#c79337;
}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:var(--wos-bg);}
#world-character-lab{width:100vw;height:100vh;}
.character-lab{position:relative;width:100vw;height:100vh;overflow:hidden;color:var(--wos-paper);background:radial-gradient(circle at 30% 18%, rgba(20,241,149,.08), transparent 28rem),linear-gradient(180deg,#07101a,#03060b 80%);font-family:Outfit,Geist,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
.character-lab *{box-sizing:border-box;}
.character-world{position:absolute;inset:0;}
.character-world canvas{display:block;width:100%;height:100%;}
.character-ui{position:absolute;top:12px;right:12px;bottom:12px;width:min(430px,calc(100vw - 24px));overflow:auto;padding:14px;border-radius:22px;border:1px solid var(--wos-line);background:linear-gradient(180deg,rgba(12,22,34,.94),rgba(5,10,18,.94));box-shadow:0 20px 56px rgba(0,0,0,.36), inset 0 1px 0 rgba(255,255,255,.05);backdrop-filter:blur(14px);}
.character-ui h1,.character-ui h2{margin:0;font-family:Fraunces,Georgia,serif;letter-spacing:-.035em;color:var(--wos-paper);}
.character-ui h1{font-size:clamp(34px,5vw,52px);line-height:.9;}
.character-ui h2{font-size:24px;margin-top:16px;}
.character-ui p{margin:8px 0 14px;color:#d8cfb7;line-height:1.4;font-size:13px;}
.kicker{margin:0 0 6px;color:var(--wos-gold);font:900 10px/1 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;}
.row{display:grid;grid-template-columns:86px minmax(0,1fr) 34px;gap:8px;align-items:center;margin:9px 0;}
.row label,.check label,.swatch-row label{font-weight:850;color:#d8cfb7;font-size:12px;text-transform:capitalize;}
.row b{font:900 12px/1 ui-monospace,monospace;text-align:right;color:#fff0c8;}
input,select,button{font:inherit;border-radius:12px;border:1px solid var(--wos-line);background:rgba(255,255,255,.08);color:var(--wos-paper);min-height:36px;padding:7px 10px;outline:none;}
input[type=range]{padding:0;min-height:24px;}
button{cursor:pointer;font-weight:900;}
button:hover{background:rgba(255,255,255,.12);}
button.primary{background:var(--wos-mint);border-color:var(--wos-mint);color:#06120d;}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;}
.preset-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:8px 0 4px;}
.preset-card{position:relative;min-height:64px;border-radius:15px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(135deg,var(--p1,#31507d),var(--p2,#14f195));box-shadow:inset 0 1px 0 rgba(255,255,255,.24),0 8px 18px rgba(0,0,0,.28);overflow:hidden;text-align:left;color:#fff;display:grid;align-content:end;gap:5px;padding:8px;}
.preset-card:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.56));}.preset-card>*{position:relative;}.preset-card b{font:900 12px/1 ui-sans-serif;text-shadow:0 1px 3px rgba(0,0,0,.6);}.preset-card.on{border-color:#fff;outline:3px solid rgba(20,241,149,.34);}.preset-card.on:after{content:"✓";position:absolute;right:6px;top:6px;width:18px;height:18px;border-radius:99px;background:rgba(0,0,0,.62);display:grid;place-items:center;font:900 11px/1 ui-sans-serif;}.preset-dots{display:flex;gap:4px;flex-wrap:wrap;}.preset-dots i{width:13px;height:13px;border-radius:99px;border:1px solid rgba(255,255,255,.65);box-shadow:0 1px 4px rgba(0,0,0,.42);}
.swatch-stack{display:grid;gap:8px;margin-top:8px;}
.swatch-row{display:grid;grid-template-columns:96px minmax(0,1fr);gap:8px;align-items:center;padding:8px;border:1px solid rgba(243,234,215,.12);border-radius:15px;background:rgba(243,234,215,.045);}
.swatches{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px;}
.color-swatch{position:relative;min-height:32px;height:32px;border-radius:11px;border:2px solid rgba(255,255,255,.16);padding:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.26),0 6px 14px rgba(0,0,0,.24);}
.color-swatch:hover{filter:brightness(1.1) saturate(1.08);transform:translateY(-1px);}
.color-swatch.on{border-color:#fff;outline:3px solid rgba(20,241,149,.36);box-shadow:inset 0 1px 0 rgba(255,255,255,.34),0 0 0 1px rgba(0,0,0,.5),0 0 18px rgba(20,241,149,.22);}
.color-swatch.on:after{content:"✓";position:absolute;right:4px;top:4px;width:15px;height:15px;border-radius:99px;background:rgba(0,0,0,.64);color:#fff;display:grid;place-items:center;font:900 10px/1 ui-sans-serif;}
.check{display:flex;gap:10px;align-items:center;margin:8px 0;}
.check input{min-height:auto;}
.status{margin-top:10px;color:#9bffd9;font:800 11px/1.35 ui-monospace,monospace;}
.help{margin-top:12px;padding:10px;border-radius:14px;border:1px solid var(--wos-line);background:rgba(0,0,0,.18);color:#fff0c8;font:800 11px/1.4 ui-monospace,monospace;white-space:pre-wrap;}
@media(max-width:820px){.character-ui{left:12px;right:12px;top:auto;height:50vh;width:auto;}.swatch-row{grid-template-columns:1fr}.swatches{grid-template-columns:repeat(8,minmax(26px,1fr));}.preset-grid{grid-template-columns:1fr;}}
`;

export default function CharacterLabPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CHARACTER_LAB_CSS }} />
      <div id="world-character-lab" />
    </>
  );
}