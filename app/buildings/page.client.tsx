// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { render } from "tradjs/client";
import * as THREE from "three";
import { LIBRARY, COSTI, GOLD_MINE_KIND, BARB_CAMP_KIND } from "../../game/shared";
import { makeBuildingGroup } from "../../client/meshes";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=Outfit:wght@400;600;800&display=swap');
:root{--ink:#05080e;--glass:rgba(8,13,23,.86);--line:rgba(255,255,255,.12);--mint:#14f195;--gold:#ffd76e;--paper:#f3ead7;--muted:#9fb2bd;}
html,body{margin:0;min-height:100%;background:#05080e;color:var(--paper);font-family:Outfit,system-ui,sans-serif;}
.wosb{min-height:100vh;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(360px,.65fr);gap:14px;padding:14px;background:radial-gradient(900px 600px at 18% 4%,rgba(20,241,149,.12),transparent 58%),radial-gradient(900px 600px at 90% 94%,rgba(153,69,255,.12),transparent 58%),#05080e;box-sizing:border-box;}
.scene{position:relative;min-height:calc(100vh - 28px);border:1px solid var(--line);border-radius:22px;overflow:hidden;background:linear-gradient(180deg,#0d1b28,#07101a);box-shadow:0 24px 60px rgba(0,0,0,.42);}
.scene canvas{display:block;width:100%;height:100%;}
.hero{position:absolute;left:18px;top:18px;max-width:500px;padding:15px 16px;border:1px solid var(--line);border-radius:18px;background:rgba(5,8,14,.66);backdrop-filter:blur(12px);box-shadow:0 14px 34px rgba(0,0,0,.32);}
.hero p{margin:7px 0 0;color:var(--muted);line-height:1.45;font-size:13px}.hero h1{margin:0;font-family:'Chakra Petch';font-size:30px;letter-spacing:-.03em}.hero b{color:var(--mint)}
.side{min-height:calc(100vh - 28px);border:1px solid var(--line);border-radius:22px;background:var(--glass);backdrop-filter:blur(14px);box-shadow:0 24px 60px rgba(0,0,0,.38);overflow:hidden;display:flex;flex-direction:column;}
.side-head{padding:16px;border-bottom:1px solid rgba(255,255,255,.08)}.side-head h2{margin:0;font-family:'Chakra Petch';font-size:24px}.side-head p{margin:6px 0 0;color:var(--muted);font-size:12px;line-height:1.45}
.list{overflow:auto;padding:12px;display:grid;gap:8px}.card{border:1px solid rgba(255,255,255,.09);border-radius:15px;background:rgba(255,255,255,.045);padding:10px;display:grid;grid-template-columns:38px minmax(0,1fr);gap:10px;cursor:pointer}.card:hover,.card.on{border-color:rgba(20,241,149,.45);background:rgba(20,241,149,.08)}
.glyph{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.08);font-size:20px}.meta{min-width:0}.row{display:flex;justify-content:space-between;gap:8px;align-items:center}.name{font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cost{color:var(--gold);font:800 11px ui-monospace,Menlo,monospace;white-space:nowrap}.purpose{margin-top:4px;color:#d8e6dc;font-size:12px;line-height:1.35}.tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.tag{font:800 10px/1 ui-monospace,monospace;padding:4px 6px;border-radius:999px;background:rgba(255,255,255,.07);color:var(--muted);border:1px solid rgba(255,255,255,.07)}.tag.special{color:#07120d;background:var(--mint);border-color:var(--mint)}
@media(max-width:980px){.wosb{grid-template-columns:1fr}.scene{min-height:58vh}.side{min-height:40vh}}
`;

const SHOW = LIBRARY.filter((b:any)=>!b.weapon);
function costStr(cost:any){ const out = Object.entries(cost||{}).filter(([,v])=>Number(v)>0).map(([k,v])=>`${v}${COSTI[k]||k}`); return out.join(" ") || "Free"; }
function tagsFor(b:any){ const t=[]; if(b.compactPlacement)t.push("lineable"); else t.push("3×3 pad"); if(b.blocksMovement)t.push("blocks movement"); if(b.prod)t.push("produces"); if(b.storage)t.push("storage"); if(b.id===GOLD_MINE_KIND)t.push("gold source"); if(b.id===BARB_CAMP_KIND)t.push("world obstacle"); if(b.decor)t.push("decor"); return t; }

export default function mount(){
  const root=document.getElementById("solcraft-buildings-showcase"); if(!root) return; root.innerHTML="";
  const style=document.createElement("style"); style.textContent=CSS; document.head.appendChild(style);
  const sceneEl=document.createElement("div"); sceneEl.className="scene";
  const side=document.createElement("aside"); side.className="side";
  root.className="wosb"; root.append(sceneEl,side);
  const hero=document.createElement("div"); hero.className="hero"; hero.innerHTML=`<h1>Building Yard</h1><p>A fixed no-character map for checking silhouettes, costs, purpose text, and placement rules. <b>Walls and gates are lineable</b>; city buildings still need room.</p>`; sceneEl.appendChild(hero);

  let selected = SHOW[0]?.id || "";
  side.addEventListener("click", (ev) => {
    const el = (ev.target as HTMLElement | null)?.closest?.("[data-building-id]") as HTMLElement | null;
    if (!el || !side.contains(el)) return;
    selected = el.dataset.buildingId || selected;
    focusBuilding(selected);
    paint();
  }, true);

  function App(){ return <>
    <div className="side-head"><h2>All buildings</h2><p>Click a card to focus it. This page exists so broken models, vague purposes, and bad costs are obvious before players meet them.</p></div>
    <div className="list">{SHOW.map((b:any)=><div className={"card"+(selected===b.id?" on":"")} data-building-id={b.id}>
      <div className="glyph">{b.glyph}</div><div className="meta"><div className="row"><span className="name">{b.name}</span><span className="cost">{costStr(b.cost)}</span></div>
      <div className="purpose">{b.effect || b.blurb || "Decorative structure."}</div><div className="tags">{tagsFor(b).map((x:string)=><span className={"tag"+(x==="lineable"||x==="gold source"?" special":"")}>{x}</span>)}</div></div>
    </div>)}</div>
  </>; }
  function paint(){ render(App(),side); }

  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true}); renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5)); sceneEl.appendChild(renderer.domElement);
  const scene=new THREE.Scene(); scene.background=new THREE.Color(0x0b1622);
  const camera=new THREE.OrthographicCamera(-10,10,7,-7,0.1,200); camera.position.set(13,15,13); camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0xd8ecff,0x44553a,1.1)); const sun=new THREE.DirectionalLight(0xfff1d6,1.4); sun.position.set(8,14,5); scene.add(sun);
  const tileMat=new THREE.MeshStandardMaterial({color:0x1d3328,roughness:0.95}); const ownedMat=new THREE.MeshStandardMaterial({color:0x245f4e,roughness:0.9});
  const tileGeo=new THREE.BoxGeometry(.94,.1,.94); const groups=new Map();
  const cols=7;
  SHOW.forEach((b:any,i:number)=>{ const x=(i%cols)-Math.floor(cols/2), z=Math.floor(i/cols)-3; const tile=new THREE.Mesh(tileGeo,b.compactPlacement?ownedMat:tileMat); tile.position.set(x,.02,z); tile.receiveShadow=true; scene.add(tile); const {group}=makeBuildingGroup(b.id,{nm:null,cl:null,plinth:b.compactPlacement?0x14f195:0x577566}); group.position.set(x,.11,z); scene.add(group); groups.set(b.id,group); });
  // line of walls + gate at front to prove adjacency works visually
  [-2,-1,0,1,2].forEach((x)=>{ const id=x===0?'gate':'wall'; const {group}=makeBuildingGroup(id,{plinth:0x14f195}); group.position.set(x,.11,5); scene.add(group); });
  function resize(){ const w=sceneEl.clientWidth||600,h=sceneEl.clientHeight||400; renderer.setSize(w,h,false); const view=8.5,a=w/h; camera.left=-view*a;camera.right=view*a;camera.top=view;camera.bottom=-view;camera.updateProjectionMatrix(); }
  function focusBuilding(id:string){ const g=groups.get(id); if(!g)return; const p=g.position; camera.position.set(p.x+8,9,p.z+8); camera.lookAt(p.x,0,p.z); }
  let t=0; function loop(){ t+=0.016; for(const [id,g] of groups) g.rotation.y=Math.sin(t*0.6+g.position.x)*0.04; resize(); renderer.render(scene,camera); requestAnimationFrame(loop); }
  paint(); resize(); loop();
}