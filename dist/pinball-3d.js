// Three.js presentation for Neon Pinball's one table, "Dawg City Nights". PinballGame owns every
// rule and every bounce; this module builds the cabinet and plays the light show.
//
// The cabinet: a lacquered playfield under glass, chrome rails, plastics over the slingshots and
// ramp blocks, two clear ramps that turn into wireforms, pop bumpers, drop targets that sink, a
// spinner, the Dawg House scoop, an apron with instruction cards, a plunger you can see pull back
// and a backbox with lit art and a dot-matrix display. Every insert on the playfield is driven by
// game.lights(), so the arrows always say what to shoot. The same dot-matrix display is shown at
// the top of the screen, where a phone can read it.
//
// Views: 'third' is the player's view of the whole table, fitted to the screen (it is a portrait
// game: a phone shows it edge to edge). 'first' is the player's eye: standing at the lockdown bar
// with the flippers large in the foreground, the head following the ball up the table.
// World units: one table unit is one metre here. Table (x, y) sits at world (x - 5, h, 10 - y).
import {T,quality,smooth,fitFov,texture,radial,glowStops,merge,pbr,Stage,Particles,Hud,AmbientLoop} from './three-kit.js';
import {TABLE,ARC,FLIPPERS,SEGS,POSTS,BUMPERS,DROPS,STANDUPS,LANES,LANE_Y,SCOOP,SPINNER,SLINGS,RAMPS,ROLLOVERS,SHOT_AT,MODES,PLUNGER,STAGES,flipperAngle} from './pinball-engine.js';

const FW=TABLE.field,BR=TABLE.ball,wx=x=>x-5,wz=y=>10-y,P=(x,y,h=0)=>new T.Vector3(wx(x),h,wz(y));
const PINK=0xff4fc0,CYAN=0x48e6ff,GOLD=0xffc23d,LIME=0xb9ff5e,ORANGE=0xff8a3d,VIOLET=0x9f6bff,WHITE=0xffffff;
const SHOT_COLOR=[CYAN,PINK,GOLD,LIME,PINK,CYAN];
// Where the round inserts sit on the playfield (table units). The art prints their rings and labels.
const MODE_AT=MODES.map((m,i)=>{const a=Math.PI*(.5+(i-2)*.2);return {x:4.55+Math.cos(a)*-2.05,y:5.35+Math.sin(a)*1.75};});
const WIZ_AT={x:4.55,y:5.75},SAVE_AT={x:4.55,y:2.75},KICK_AT={x:.45,y:4.1},LOCK_AT=[0,1,2].map(i=>({x:4.85+i*.36,y:9.25})),BONUS_AT=[2,3,4,5,6].map((n,i)=>({x:3.55+i*.5,y:4.15,n}));
const DROP_LAMP=DROPS.map(d=>({x:d.x,y:d.y-.55})),STAND_LAMP=STANDUPS.map(s=>({x:s.x,y:s.y-.5}));
const CSS=`.pinball3d .pb-dmd{position:absolute;left:50%;top:var(--d3-top,12px);transform:translateX(-50%);width:min(calc(100% - 20px),480px);aspect-ratio:4/1;border-radius:9px;background:#120703;border:2px solid #2c2622;box-shadow:0 0 0 1px #000,0 8px 30px #000c,0 0 34px #ff7a1a2e,inset 0 0 18px #000;overflow:hidden;pointer-events:none}
.pinball3d .pb-dmd canvas{position:absolute;inset:3px;width:calc(100% - 6px);height:calc(100% - 6px);image-rendering:pixelated;border-radius:5px}
.pinball3d .pb-dmd:after{content:"";position:absolute;inset:0;background:linear-gradient(168deg,#ffffff1c 0%,#ffffff05 34%,#0000 36%);border-radius:7px}
.pinball3d .pb-toast{position:absolute;left:50%;top:calc(var(--d3-top,12px) + min(calc(25vw - 5px),120px) + 12px);transform:translateX(-50%);display:grid;justify-items:center;gap:2px;max-width:calc(100% - 24px);padding:7px 14px;border-radius:11px;background:#0b0816e6;border:1px solid #b9ff5e99;box-shadow:0 0 22px #b9ff5e44;pointer-events:none;text-align:center}
.pinball3d .pb-toast[hidden]{display:none}.pinball3d .pb-toast b{font:900 12px var(--ui-mono,var(--mono));letter-spacing:1.5px;color:#d8ff9a}.pinball3d .pb-toast span{font:700 10px var(--ui-mono,var(--mono));letter-spacing:.6px;color:#ffffffcc}
.pinball3d .pb-in{animation:pbtoast 3.2s ease forwards}@keyframes pbtoast{0%{opacity:0;transform:translate(-50%,-8px)}8%,86%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-6px)}}
.pinball3d .pb-plunge{position:absolute;right:max(14px,env(safe-area-inset-right));bottom:calc(env(safe-area-inset-bottom) + var(--d3-bottom,22px) + 8px);display:grid;justify-items:center;gap:6px;pointer-events:none;transition:opacity .2s}
.pinball3d .pb-plunge[hidden]{display:none}
.pinball3d .pb-plunge b{font:900 10px var(--ui-mono,var(--mono));letter-spacing:1.5px;color:#ffe9c4;text-shadow:0 1px 6px #000;text-align:center;line-height:1.35;background:#0b0816cc;border:1px solid #ffc23d66;border-radius:9px;padding:6px 9px}
.pinball3d .pb-bar{width:16px;height:96px;border-radius:9px;background:#0b0816cc;border:1px solid #ffffff3a;overflow:hidden;display:flex;align-items:flex-end;box-shadow:0 0 18px #ffc23d33}
.pinball3d .pb-bar i{display:block;width:100%;height:100%;transform-origin:bottom;transform:scaleY(0);background:linear-gradient(0deg,#48e6ff,#b9ff5e 45%,#ffc23d 75%,#ff4f6e)}
.pinball3d .pb-pop{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font:900 14px/1 var(--display);color:#ffe9a6;text-shadow:0 0 12px currentColor,0 2px 0 #000c;pointer-events:none;animation:pbpop .9s cubic-bezier(.2,.8,.3,1) forwards}
.pinball3d .pb-pop.pb-big{font-size:clamp(18px,4.6vw,30px);color:#fff}.pinball3d .pb-pop.pb-cyan{color:#8ff2ff}.pinball3d .pb-pop.pb-pink{color:#ff9ade}.pinball3d .pb-pop.pb-green{color:#d2ff8a}
@keyframes pbpop{0%{opacity:0;transform:translate(-50%,-20%) scale(.5)}18%{opacity:1;transform:translate(-50%,-70%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-230%) scale(1)}}
.pinball3d .d3-banner{top:34%;font-size:clamp(22px,6vw,46px);text-shadow:0 0 26px #ff5fc8,0 0 4px #fff,0 3px 0 #000a}
@media (prefers-reduced-motion:reduce){.pinball3d .pb-pop{animation-duration:.01s}}`;
function styles(){if(document.getElementById('pinball3d-css'))return;const s=document.createElement('style');s.id='pinball3d-css';s.textContent=CSS;document.head.append(s);}
const hex=n=>'#'+n.toString(16).padStart(6,'0');

// ── Art ──────────────────────────────────────────────────────────────────────────────────────
// The printed playfield. Everything that lights up is a ring here with its label; the lamps are
// separate meshes laid over the rings.
function playfieldArt(c,w,h){
 const u=w/10,at=(x,y)=>[x*u,h-y*u],TAU=Math.PI*2;c.lineCap='round';c.lineJoin='round';c.textAlign='center';c.textBaseline='middle';
 const base=c.createLinearGradient(0,0,0,h);base.addColorStop(0,'#3a1166');base.addColorStop(.3,'#1d0f4a');base.addColorStop(.62,'#0f1238');base.addColorStop(1,'#06182c');c.fillStyle=base;c.fillRect(0,0,w,h);
 let seed=9;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 // Night sky over the top half, with a low moon behind the bumpers.
 for(let i=0;i<420;i++){const x=rnd()*w,y=rnd()*h*.62,r=rnd()*u*.03+.5;c.fillStyle=`rgba(${200+rnd()*55|0},${205+rnd()*50|0},255,${(.1+rnd()*.45).toFixed(2)})`;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();}
 const [mx,my]=at(4.55,14.9),moon=c.createRadialGradient(mx,my,0,mx,my,u*4.4);moon.addColorStop(0,'#ff8ad866');moon.addColorStop(.35,'#c13fd03a');moon.addColorStop(1,'#3a116600');c.fillStyle=moon;c.fillRect(0,my-u*5,w,u*10);
 for(let i=0;i<32;i++){c.fillStyle=i%2?'#ff5fc81e':'#5ee7ff14';c.beginPath();c.moveTo(mx,my);c.arc(mx,my,u*4.3,i/32*TAU,(i+1)/32*TAU);c.fill();}
 for(const [r,col] of [[3.1,'#ff5fc855'],[2.2,'#5ee7ff55'],[1.25,'#ffe45e55']]){c.strokeStyle=col;c.lineWidth=u*.05;c.setLineDash([u*.22,u*.16]);c.beginPath();c.arc(mx,my,u*r,0,TAU);c.stroke();}c.setLineDash([]);
 c.font=`900 ${u*.34}px system-ui,sans-serif`;c.fillStyle='#ffd0f0';c.shadowColor='#ff5fc8';c.shadowBlur=u*.3;c.fillText('BARK PARTY',...at(4.55,16.55));c.shadowBlur=0;
 // The city skyline across the middle of the table.
 let x=0,i=0;while(x<w){const bw=u*(.28+rnd()*.5),bh=u*(.7+rnd()*1.9),[,by]=at(0,7.35);c.fillStyle=i%3?'#0a0c24':'#0d1030';c.fillRect(x,by-bh,bw,bh);for(let yy=by-bh+u*.12;yy<by-u*.1;yy+=u*.17)for(let xx=x+u*.07;xx<x+bw-u*.08;xx+=u*.13)if(rnd()>.62){c.fillStyle=rnd()>.5?'#ffcf9670':'#8eeaff60';c.fillRect(xx,yy,u*.06,u*.09);}x+=bw+u*.03;i++;}
 const street=c.createLinearGradient(0,at(0,7.4)[1],0,at(0,2)[1]);street.addColorStop(0,'#0a0c24');street.addColorStop(1,'#07182c00');c.fillStyle=street;c.fillRect(0,at(0,7.4)[1],w,u*5.4);
 // Beams of light from the flippers to each shot, in the shot's colour.
 const [fx,fy]=at(4.55,3.1);SHOT_AT.forEach((s,k)=>{const [sx,sy]=at(s.x,s.y-.6),col=hex(SHOT_COLOR[k]),g=c.createLinearGradient(fx,fy,sx,sy);g.addColorStop(0,col+'00');g.addColorStop(.55,col+'30');g.addColorStop(1,col+'66');c.fillStyle=g;c.beginPath();c.moveTo(fx-u*.12,fy);c.lineTo(sx-u*.42,sy);c.lineTo(sx+u*.42,sy);c.lineTo(fx+u*.12,fy);c.fill();});
 // The collar: a neon DAWG head ringed by the five mode inserts.
 const [hx,hy]=at(4.55,5.5),r=u*1.05;c.strokeStyle='#b9ff5e';c.lineWidth=u*.07;c.shadowColor='#b9ff5e';c.shadowBlur=u*.35;c.globalAlpha=.8;
 c.beginPath();c.ellipse(hx,hy,r,r*.9,0,0,TAU);c.stroke();for(const s of [-1,1]){c.beginPath();c.ellipse(hx+s*r*.98,hy-r*.3,r*.34,r*.62,s*.5,0,TAU);c.stroke();}
 c.globalAlpha=1;c.shadowBlur=0;
 // Insert rings and labels.
 const ring=(p,rr,col,label,size=.15,dy=0)=>{const [px,py]=at(p.x,p.y);c.fillStyle='#04030ae0';c.beginPath();c.arc(px,py,rr*u,0,TAU);c.fill();c.strokeStyle=col;c.lineWidth=u*.03;c.beginPath();c.arc(px,py,rr*u,0,TAU);c.stroke();if(label){c.font=`900 ${u*size}px system-ui,sans-serif`;c.fillStyle='#ffffffb8';String(label).split('\n').forEach((t,k,a)=>c.fillText(t,px,py+dy*u+(k-(a.length-1)/2)*u*size*1.05));}};
 MODES.forEach((m,k)=>ring(MODE_AT[k],.4,'#ff5fc8aa',m.name.replace(' ','\n'),.125));ring(WIZ_AT,.56,'#ffe45ecc','TOP\nDAWG',.2);
 ring(SAVE_AT,.44,'#7ff3ffaa','SHOOT\nAGAIN',.13);ring(KICK_AT,.3,'#b9ff5eaa','KICK\nBACK',.09);LOCK_AT.forEach((p,k)=>ring(p,.15,'#b9ff5eaa',k+1,.13));BONUS_AT.forEach(p=>ring(p,.2,'#ffc23daa',p.n+'X',.14));
 LANES.forEach(l=>ring({x:l.x,y:LANE_Y},.34,'#b9ff5eaa',l.label,.34));DROP_LAMP.forEach((p,k)=>ring(p,.17,'#ffe45eaa',DROPS[k].label,.16));STAND_LAMP.forEach(p=>ring(p,.17,'#b9ff5eaa','',0));
 ROLLOVERS.forEach(p=>ring(p,.2,p.kind==='out'?'#ff5f7aaa':'#5ee7ffaa','',0));
 SHOT_AT.forEach((s,k)=>{const [px,py]=at(s.x,s.y);c.fillStyle='#04030ae0';c.strokeStyle=hex(SHOT_COLOR[k])+'cc';c.lineWidth=u*.035;c.beginPath();c.moveTo(px,py-u*.52);c.lineTo(px+u*.4,py+u*.3);c.lineTo(px-u*.4,py+u*.3);c.closePath();c.fill();c.stroke();});
 // Lettering.
 c.shadowBlur=u*.25;c.font=`900 ${u*.44}px system-ui,sans-serif`;c.fillStyle='#5ee7ff';c.shadowColor='#5ee7ff';c.fillText('DAWG CITY NIGHTS',...at(4.55,7.75));
 c.font=`900 ${u*.2}px system-ui,sans-serif`;c.fillStyle='#ff9ade';c.shadowColor='#ff5fc8';c.fillText('LOCK',...at(5.21,8.95));c.fillText('DAWG HOUSE',...at(5.2,9.62));c.fillStyle='#ffe9a6';c.shadowColor='#ffc23d';c.fillText('LIGHT LOCK',...at(4.05,9.75));c.fillText('BONUS',...at(4.55,3.75));
 c.shadowBlur=0;c.font=`900 ${u*.17}px system-ui,sans-serif`;for(const [tx,label,col] of [[.48,'ORBIT','#8ff2ff'],[8.62,'ORBIT','#8ff2ff'],[1.9,'RAMP','#ff9ade'],[7.2,'RAMP','#ff9ade']]){const [px,py]=at(tx,8.75);c.fillStyle=col;c.fillText(label,px,py);}
 // Chevrons up the orbit lanes and the shooter lane, down the inlanes.
 c.lineWidth=u*.06;const chev=(cx,cy,dir,col)=>{const [px,py]=at(cx,cy);c.strokeStyle=col;c.beginPath();c.moveTo(px-u*.18,py+dir*u*.1);c.lineTo(px,py-dir*u*.1);c.lineTo(px+u*.18,py+dir*u*.1);c.stroke();};
 for(let y=11;y<15.8;y+=.7){chev(.48,y,1,'#5ee7ff88');chev(8.62,y,1,'#5ee7ff88');}for(let y=2;y<14;y+=.9)chev(9.55,y,1,'#ffe45e77');for(let y=4.2;y<6.2;y+=.6){chev(1.35,y,-1,'#5ee7ff66');chev(FW-1.35,y,-1,'#5ee7ff66');}
 c.fillStyle='#ffffff0c';c.fillRect(FW*u,0,u*.9,h);
 // The scoop mouth.
 const [ox,oy]=at(SCOOP.x,SCOOP.y),hole=c.createRadialGradient(ox,oy,0,ox,oy,u*.46);hole.addColorStop(0,'#000');hole.addColorStop(.8,'#000');hole.addColorStop(1,'#00000000');c.fillStyle=hole;c.beginPath();c.arc(ox,oy,u*.46,0,TAU);c.fill();
}
function backglassArt(c,w,h){
 const TAU=Math.PI*2,g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#150633');g.addColorStop(.55,'#4a1272');g.addColorStop(.8,'#ff5f8a');g.addColorStop(1,'#ffb45e');c.fillStyle=g;c.fillRect(0,0,w,h);
 let seed=5;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;for(let i=0;i<160;i++){c.fillStyle=`rgba(255,255,255,${(.2+rnd()*.6).toFixed(2)})`;c.fillRect(rnd()*w,rnd()*h*.5,2,2);}
 // A huge striped sun and the skyline in front of it.
 const sx=w/2,sy=h*.6,sr=h*.42,sun=c.createLinearGradient(0,sy-sr,0,sy+sr);sun.addColorStop(0,'#ffe45e');sun.addColorStop(.55,'#ff7a3d');sun.addColorStop(1,'#ff2f92');c.fillStyle=sun;c.beginPath();c.arc(sx,sy,sr,0,TAU);c.fill();
 c.fillStyle='#4a1272';for(let i=0;i<7;i++){const y=sy+sr*(.08+i*.13);c.fillRect(sx-sr,y,sr*2,2+i*2.2);}
 for(let x=0;x<w;){const bw=26+rnd()*54,bh=h*(.16+rnd()*.34);c.fillStyle='#0b0620';c.fillRect(x,h-bh,bw,bh);c.fillStyle='#ffe45e88';for(let k=0;k<7;k++)c.fillRect(x+5+rnd()*(bw-12),h-bh+8+rnd()*(bh-16),4,5);x+=bw+2;}
 // The DAWG in shades.
 const hx=w*.5,hy=h*.63,r=h*.2;c.fillStyle='#0b0620';c.beginPath();c.ellipse(hx,hy,r,r*.92,0,0,TAU);c.fill();for(const s of [-1,1]){c.beginPath();c.ellipse(hx+s*r*.95,hy-r*.45,r*.36,r*.66,s*.45,0,TAU);c.fill();}c.beginPath();c.ellipse(hx,hy+r*.42,r*.5,r*.36,0,0,TAU);c.fill();
 c.strokeStyle='#b9ff5e';c.lineWidth=5;c.shadowColor='#b9ff5e';c.shadowBlur=18;c.beginPath();c.ellipse(hx,hy,r,r*.92,0,0,TAU);c.stroke();
 const lens=c.createLinearGradient(hx-r,hy-r*.3,hx+r,hy+r*.1);lens.addColorStop(0,'#48e6ff');lens.addColorStop(1,'#ff4fc0');c.fillStyle=lens;c.shadowColor='#48e6ff';for(const s of [-1,1]){c.beginPath();c.roundRect(hx+s*r*.46-r*.36,hy-r*.3,r*.72,r*.4,r*.12);c.fill();}c.fillRect(hx-r*.2,hy-r*.22,r*.4,r*.07);
 c.shadowBlur=0;c.fillStyle='#ff9ade';c.beginPath();c.ellipse(hx,hy+r*.34,r*.14,r*.09,0,0,TAU);c.fill();
 c.textAlign='center';c.font=`900 ${h*.2}px system-ui,sans-serif`;c.lineWidth=8;c.strokeStyle='#ff4fc0';c.shadowColor='#ff4fc0';c.shadowBlur=36;c.strokeText('NEON PINBALL',w/2,h*.22);c.shadowBlur=8;c.fillStyle='#fff6fb';c.fillText('NEON PINBALL',w/2,h*.22);
 c.font=`900 ${h*.075}px system-ui,sans-serif`;c.fillStyle='#b9ff5e';c.shadowColor='#b9ff5e';c.shadowBlur=20;c.fillText('★  DAWG CITY NIGHTS  ★',w/2,h*.33);
}
function cardArt(title,lines,color){return texture(512,360,(c,w,h)=>{c.fillStyle='#f4ecd8';c.fillRect(0,0,w,h);c.strokeStyle='#1a1030';c.lineWidth=8;c.strokeRect(8,8,w-16,h-16);c.fillStyle=color;c.fillRect(16,16,w-32,62);c.fillStyle='#fff';c.textAlign='center';c.font='900 38px system-ui,sans-serif';c.fillText(title,w/2,61);c.fillStyle='#1a1030';c.textAlign='left';c.font='800 24px system-ui,sans-serif';lines.forEach((t,i)=>c.fillText('• '+t,30,118+i*40));});}
function plasticArt(color,label){return texture(256,256,(c,w,h)=>{const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,color);g.addColorStop(1,'#1a0b3a');c.fillStyle=g;c.fillRect(0,0,w,h);c.strokeStyle='#ffffffaa';c.lineWidth=5;for(let i=-4;i<8;i++){c.beginPath();c.moveTo(i*44,0);c.lineTo(i*44+120,h);c.stroke();}c.fillStyle='#fff';c.font='900 54px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.save();c.translate(w/2,h/2);c.rotate(-.5);c.fillText(label,0,0);c.restore();});}
function glyph(text,color='#ffffff'){return texture(128,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle='#16102b';c.fillRect(0,0,w,h);c.font='900 96px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(text,w/2,h/2+6);});}
function arrowTex(){return texture(128,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle='#fff';c.shadowColor='#fff';c.shadowBlur=14;c.beginPath();c.moveTo(w/2,14);c.lineTo(w-18,h-22);c.lineTo(18,h-22);c.closePath();c.fill();});}
function streakTex(){return texture(32,128,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#ffffffcc');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.beginPath();c.moveTo(2,0);c.lineTo(w-2,0);c.lineTo(w/2,h);c.closePath();c.fill();});}
function glassTex(){return texture(256,512,(c,w,h)=>{c.clearRect(0,0,w,h);for(const [x,wd,a] of [[.18,.1,.5],[.36,.035,.3],[.7,.16,.34]]){const g=c.createLinearGradient(w*(x-wd),0,w*(x+wd),0);g.addColorStop(0,'#ffffff00');g.addColorStop(.5,`rgba(210,230,255,${a})`);g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.save();c.transform(1,0,-.35,1,60,0);c.fillRect(w*(x-wd),0,w*wd*2,h);c.restore();}const f=c.createLinearGradient(0,0,0,h);f.addColorStop(0,'#000000ff');f.addColorStop(.5,'#00000055');f.addColorStop(1,'#000000d0');c.globalCompositeOperation='destination-out';c.fillStyle=f;c.fillRect(0,0,w,h);});}

// ── The dot-matrix display ───────────────────────────────────────────────────────────────────
// Drawn at 160 × 40 dots, then scaled up through a dot mask. Idle it shows the score and the
// current goal; events push short animations over it.
const DW=160,DH=40,DS=4;
class Dmd {
 constructor(){this.lo=document.createElement('canvas');this.lo.width=DW;this.lo.height=DH;this.c=this.lo.getContext('2d',{willReadFrequently:false});this.out=document.createElement('canvas');this.out.width=DW*DS;this.out.height=DH*DS;this.o=this.out.getContext('2d');
  this.mask=document.createElement('canvas');this.mask.width=DW*DS;this.mask.height=DH*DS;const m=this.mask.getContext('2d');m.fillStyle='#000';m.fillRect(0,0,DW*DS,DH*DS);m.globalCompositeOperation='destination-out';for(let y=0;y<DH;y++)for(let x=0;x<DW;x++){m.beginPath();m.arc(x*DS+DS/2,y*DS+DS/2,DS*.43,0,7);m.fill();}
  this.queue=[];this.now=null;this.t=0;this.last=0;this.scroll=0;}
 // kind picks the animation; a higher priority replaces what is showing.
 show(kind,title,sub='',secs=1.8,pri=1){const item={kind,title,sub,secs,pri};if(this.now&&pri>this.now.pri){this.now=item;this.t=0;this.queue=this.queue.filter(q=>q.pri>=pri);}else if(this.queue.length<3)this.queue.push(item);}
 text(s,x,y,size,align='center',col='#fff'){const c=this.c;c.font=`900 ${size}px system-ui,"Arial Black",sans-serif`;c.textAlign=align;c.textBaseline='middle';c.fillStyle=col;c.fillText(s,x,y);}
 draw(dt,real,info){
  if(!this.now&&this.queue.length){this.now=this.queue.shift();this.t=0;}
  if(this.now&&(this.t+=dt)>this.now.secs){this.now=null;}
  const c=this.c;c.fillStyle='#000';c.fillRect(0,0,DW,DH);
  const n=this.now;if(n){const p=this.t/n.secs,blink=Math.sin(this.t*26)>0;
   if(n.kind==='burst'){// Rays, then the words slam in.
    c.strokeStyle='#777';c.lineWidth=1;for(let i=0;i<18;i++){const a=i/18*6.283+this.t*2,r1=10+((this.t*60+i*7)%40);c.beginPath();c.moveTo(DW/2+Math.cos(a)*r1,DH/2+Math.sin(a)*r1*.5);c.lineTo(DW/2+Math.cos(a)*(r1+14),DH/2+Math.sin(a)*(r1+14)*.5);c.stroke();}
    const s=Math.max(1,2.6-this.t*9);c.save();c.translate(DW/2,n.sub?15:20);c.scale(s,s);this.text(n.title,0,0,n.title.length>12?15:19,'center',blink||p>.5?'#fff':'#999');c.restore();if(n.sub)this.text(n.sub,DW/2,32,10,'center','#ccc');}
   else if(n.kind==='wipe'){const wdt=Math.min(1,this.t*3.2);c.save();c.beginPath();c.rect(0,0,DW*wdt,DH);c.clip();this.text(n.title,DW/2,n.sub?13:20,n.title.length>12?14:18);if(n.sub)this.text(n.sub,DW/2,30,9,'center','#bbb');c.restore();c.fillStyle='#fff';c.fillRect(DW*wdt-2,0,2,DH);
    for(let x=0;x<DW;x+=4){c.fillStyle=(x/4+Math.floor(this.t*12))%3?'#000':'#888';c.fillRect(x,0,3,1);c.fillRect(x,DH-1,3,1);}}
   else if(n.kind==='balls'){for(let i=0;i<3;i++){const bx=((this.t*70+i*55)%(DW+20))-10,by=30-Math.abs(Math.sin(this.t*7+i*1.3))*20;c.fillStyle='#aaa';c.beginPath();c.arc(bx,by,4,0,7);c.fill();c.fillStyle='#fff';c.fillRect(bx-2,by-2,2,2);}this.text(n.title,DW/2,14,n.title.length>10?15:18,'center',blink?'#fff':'#bbb');if(n.sub)this.text(n.sub,DW/2,32,9,'center','#ccc');}
   else if(n.kind==='tilt'){const j=Math.sin(this.t*60)*3*(1-p);c.save();c.translate(DW/2+j,DH/2);c.rotate(-.12+j*.01);this.text(n.title,0,0,28,'center',blink?'#fff':'#777');c.restore();}
   else if(n.kind==='count'){this.text(n.title,6,12,10,'left','#bbb');this.text(n.sub,DW-6,12,10,'right','#fff');c.fillStyle='#555';c.fillRect(6,20,DW-12,1);this.text(n.total,DW/2,30,14);}
   else{this.text(n.title,DW/2,n.sub?14:20,n.title.length>14?12:16,'center',blink||p>.35?'#fff':'#888');if(n.sub)this.text(n.sub,DW/2,31,9,'center','#ccc');}}
  else{// Idle: status row, the score, and what to shoot.
   const g=info;this.text(g.left,3,5,8,'left','#ccc');this.text(g.right,DW-3,5,8,'right','#ccc');
   if(g.of>0){c.fillStyle='#444';c.fillRect(3,11,DW-6,3);c.fillStyle='#fff';c.fillRect(3,11,(DW-6)*Math.min(1,g.n/g.of),3);}
   this.text(g.score,DW/2,g.of>0?23:21,g.score.length>9?15:18);
   const tw=(c.font='900 8px system-ui,"Arial Black",sans-serif',c.measureText(g.text).width);if(tw>DW-8){this.scroll=(this.scroll+dt*28)%(tw+40);this.text(g.text,DW-this.scroll+20,35.5,8,'left','#ddd');this.text(g.text,DW-this.scroll+60+tw,35.5,8,'left','#ddd');}else this.text(g.text,DW/2,35.5,8,'center',g.flash&&Math.sin(real*8)<0?'#777':'#ddd');}
  // Up through the dot mask, then tinted amber.
  const o=this.o;o.globalCompositeOperation='source-over';o.imageSmoothingEnabled=false;o.drawImage(this.lo,0,0,DW*DS,DH*DS);o.globalCompositeOperation='multiply';o.fillStyle='#ff9a2e';o.fillRect(0,0,DW*DS,DH*DS);o.globalCompositeOperation='lighter';o.fillStyle='#200c02';o.fillRect(0,0,DW*DS,DH*DS);o.globalCompositeOperation='source-over';o.drawImage(this.mask,0,0);
 }
}

// ── Geometry helpers ─────────────────────────────────────────────────────────────────────────
// A wall along a table segment: a box of the given height standing on the playfield.
function wallBox(ax,ay,bx,by,th,h,y0=0){const len=Math.hypot(bx-ax,by-ay),g=new T.BoxGeometry(len+th,h,th);g.rotateY(Math.atan2(by-ay,bx-ax));g.translate(wx((ax+bx)/2),y0+h/2,wz((ay+by)/2));return g;}
// A flat plate over a table-space polygon.
function plate(points,h,depth=.05,holes=[]){const s=new T.Shape(points.map(([x,y])=>new T.Vector2(x,y)));for(const hole of holes)s.holes.push(new T.Path(hole.map(([x,y])=>new T.Vector2(x,y))));const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:24});g.rotateX(-Math.PI/2);g.translate(-5,h,10);return g;}
// uv from table position, so one texture can be stretched over a plate.
function planarUv(g,x0,y0,w,h){const p=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+5-x0)/w,(10-p.getZ(i)-y0)/h);return g;}
// A ribbon swept along world-space points: `off` sideways, `lift` up, for ramp floors and walls.
function ribbon(pts,a,b){const n=pts.length,pos=new Float32Array(n*6),uv=new Float32Array(n*4),idx=[];for(let i=0;i<n;i++){const p=pts[i],q=pts[Math.min(n-1,i+1)],o=pts[Math.max(0,i-1)],tx=q.x-o.x,tz=q.z-o.z,l=Math.hypot(tx,tz)||1,sx=tz/l,sz=-tx/l;
  pos.set([p.x+sx*a[0],p.y+a[1],p.z+sz*a[0],p.x+sx*b[0],p.y+b[1],p.z+sz*b[0]],i*6);uv.set([0,i/n,1,i/n],i*4);if(i<n-1)idx.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g.toNonIndexed();}
function offsetCurve(pts,off,lift){return new T.CatmullRomCurve3(pts.map((p,i)=>{const q=pts[Math.min(pts.length-1,i+1)],o=pts[Math.max(0,i-1)],tx=q.x-o.x,tz=q.z-o.z,l=Math.hypot(tx,tz)||1;return new T.Vector3(p.x+tz/l*off,p.y+lift,p.z-tx/l*off);}));}

export class ThreePinball {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.cameraMode='third';this.clock=performance.now();this.status='';this.statusSince=performance.now();
  this.fx={bumpers:BUMPERS.map(()=>0),slings:[0,0],flash:[0,0,0,0,0],gi:1,giTo:1,show:0,showKind:'',stand:[0,0],drops:[0,0,0],shake:0,scoop:0};this.focus=new T.Vector3(0,0,0);this.zoom=1;this.fitKey='';this.dmdClock=0;this.spinAngle=0;}
 async init(){
  styles();this.stage=new Stage({quality:this.quality,className:'dash3d pinball3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;
  this.dmd=new Dmd();
  this.hud=new Hud('<div class="pb-dmd"></div><div class="pb-toast" hidden></div><div class="pb-plunge" hidden><div class="pb-bar"><i></i></div><b></b></div>');this.view.append(this.hud.root);this.hud.q('.pb-dmd').append(this.dmd.out);
  this.ui={toast:this.hud.q('.pb-toast'),plunge:this.hud.q('.pb-plunge'),bar:this.hud.q('.pb-bar i'),tip:this.hud.q('.pb-plunge b')};
  this.ambient=new AmbientLoop(now=>this.render(this.lastGame,now));
  this.stage.bloomBase=this.stage.quality==='high'?.5:.45;this.build();this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D TABLE · LIVE');return this;
 }
 setCamera(mode){this.cameraMode=mode==='first'?'first':'third';}

 // ── Building the cabinet ───────────────────────────────────────────────────────────────────
 build(){
  const s=this.scene,q=this.stage.quality,high=q==='high';this.stage.neonEnvironment(.9);this.stage.hdrEnvironment(undefined,.75);s.background=new T.Color(0x04040a);s.fog=new T.Fog(0x04040a,46,90);
  this.hemi=new T.HemisphereLight(0xc9c2ff,0x1a1030,.75);s.add(this.hemi);
  const key=this.key=new T.DirectionalLight(0xfff1e0,1.5);key.position.set(-5,16,7);s.add(key,key.target);this.stage.sunShadow(key,{size:12.5,far:44,map:2048,radius:3,bias:-.0002,normalBias:.02});
  // General illumination: two coloured strings of lamps, faked with a pair of point lights on high.
  this.gi=high?[[0,2.2,-5,PINK],[0,2.2,5,CYAN]].map(([x,y,z,col])=>{const l=new T.PointLight(col,30,17,1.6);l.position.set(x,y,z);s.add(l);return l;}):[];
  this.hitLight=new T.PointLight(0xffffff,0,7,1.6);this.hitLight.position.set(0,1.2,0);s.add(this.hitLight);
  this.glowTex=radial(glowStops);const tex=this.tex={arrow:arrowTex(),streak:streakTex()};
  const chrome=this.chrome=new T.MeshStandardMaterial({color:0xdfe6f2,metalness:1,roughness:.2,envMapIntensity:1.25}),steel=new T.MeshStandardMaterial({color:0x9aa3b8,metalness:.9,roughness:.38}),black=pbr({color:0x0b0a12,roughness:.45,metalness:.3,clearcoat:.6,clearcoatRoughness:.3},q),rubber=new T.MeshStandardMaterial({color:0xff2f92,roughness:.55,emissive:0xff2f92,emissiveIntensity:.35});
  const add=(geo,mat,shadow=true)=>{const m=new T.Mesh(geo,mat);if(high&&shadow){m.castShadow=true;m.receiveShadow=true;}s.add(m);return m;};

  // Playfield.
  const res=high?2048:1024,art=texture(res,res*2,playfieldArt);art.anisotropy=high?8:4;
  this.fieldMat=pbr({map:art,emissiveMap:art,emissive:0xffffff,emissiveIntensity:.5,roughness:.32,metalness:.05,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:.55},q);
  const field=add(new T.PlaneGeometry(10,20).rotateX(-Math.PI/2),this.fieldMat,false);field.receiveShadow=high;
  // Cabinet: the surround that makes the arch, the side rails, the lockdown bar, the body and legs.
  const arch=[];for(let i=0;i<=40;i++){const a=Math.PI*i/40;arch.push([ARC.x+Math.cos(a)*ARC.r,ARC.y+Math.sin(a)*ARC.r]);}
  const inner=[[10,-1.6],...arch,[0,-1.6]],surround=plate([[-.5,-1.6],[10.5,-1.6],[10.5,20.5],[-.5,20.5]],0,.62,[inner]);add(surround,black);
  add(merge([wallBox(-.5,-1.9,-.5,20.5,.16,.14,.62),wallBox(10.5,-1.9,10.5,20.5,.16,.14,.62),new T.BoxGeometry(11.4,.5,.6).translate(0,.5,wz(-1.95)),wallBox(FW,0,FW,14.6,.1,.5),wallBox(-.02,-1.6,-.02,15,.05,.5),wallBox(10.02,-1.6,10.02,15,.05,.5)]),chrome);
  const side=texture(512,256,(c,w,h)=>{const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'#2a0d55');g.addColorStop(1,'#0a1b3c');c.fillStyle=g;c.fillRect(0,0,w,h);for(let i=0;i<9;i++){c.fillStyle=i%2?'#ff4fc0':'#48e6ff';c.globalAlpha=.55;c.beginPath();c.moveTo(i*70-40,h);c.lineTo(i*70+60,0);c.lineTo(i*70+84,0);c.lineTo(i*70-16,h);c.fill();}c.globalAlpha=1;});
  add(new T.BoxGeometry(11,3.2,22.6).translate(0,-1.68,.55),new T.MeshStandardMaterial({map:side,roughness:.5,metalness:.2,emissiveMap:side,emissive:0xffffff,emissiveIntensity:.18}));
  add(merge([[-5.1,-4.2,11.4],[5.1,-4.2,11.4],[-5.1,-4.2,-10.3],[5.1,-4.2,-10.3]].map(([x,y,z])=>new T.BoxGeometry(.4,2.4,.4).translate(x,y,z))),chrome);
  const floor=new T.Mesh(new T.PlaneGeometry(120,120).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x0b0c18,roughness:.5,metalness:.4,envMapIntensity:.12}));floor.position.y=-5.4;s.add(floor);
  // Distant neon: a few big soft lights in the dark behind the machine.
  const bokeh=new T.BufferGeometry(),bp=[],bc=[];let sd=3;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;for(let i=0;i<46;i++){bp.push((rnd()-.5)*90,rnd()*22-4,-34-rnd()*30);const col=new T.Color([PINK,CYAN,GOLD,VIOLET,LIME][i%5]).multiplyScalar(.5+rnd()*.5);bc.push(col.r,col.g,col.b);}
  bokeh.setAttribute('position',new T.Float32BufferAttribute(bp,3));bokeh.setAttribute('color',new T.Float32BufferAttribute(bc,3));const bk=new T.Points(bokeh,new T.PointsMaterial({size:5,map:this.glowTex,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:.5,fog:false}));s.add(bk);

  // Rails: every static wall as a chrome strip, wire gates as thin wire.
  const rails=[],wires=[];for(const g of SEGS){if(g.kind==='drop'||g.kind==='standup')continue;if(g.kind==='oneway'||g.kind==='post')wires.push(wallBox(g.ax,g.ay,g.bx,g.by,.07,.07,.3),new T.CylinderGeometry(.035,.035,.34,6).translate(wx(g.ax),.17,wz(g.ay)),new T.CylinderGeometry(.035,.035,.34,6).translate(wx(g.bx),.17,wz(g.by)));else if(g.ax===0&&g.bx===0||g.ax===10||g.ax===FW&&g.bx===FW&&g.ay===0)continue;else rails.push(wallBox(g.ax,g.ay,g.bx,g.by,g.kind==='sling'?.05:.1,g.kind==='sling'?.2:.46,g.kind==='sling'?.12:0));}
  add(merge(rails),steel);add(merge(wires),chrome);
  // Posts with rubber rings.
  add(merge(POSTS.map(p=>new T.CylinderGeometry(.07,.07,.56,10).translate(wx(p.x),.28,wz(p.y)))),chrome);add(merge(POSTS.map(p=>new T.TorusGeometry(.105,.045,8,16).rotateX(Math.PI/2).translate(wx(p.x),.24,wz(p.y)))),rubber);
  // Plastics: lit acrylic over the slingshots, the ramp blocks and the Dawg House roof.
  const plastic=(pts,h,color,label,box)=>{const t=plasticArt(hex(color),label),m=new T.MeshStandardMaterial({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.7,roughness:.25,metalness:.1,transparent:true,opacity:.92});const mesh=add(planarUv(plate(pts,h,.05),...box),m);return m;};
  this.plastics=[plastic([SLINGS[0].a,SLINGS[0].b,SLINGS[0].c],.52,PINK,'★',[1.6,3.3,1.5,3.2]),plastic([SLINGS[1].a,SLINGS[1].c,SLINGS[1].b],.52,CYAN,'★',[6.2,3.3,1.5,3.2]),
   plastic([[.9,10.35],[1.4,10.35],[1.4,15.3],[.9,16.2]],.5,CYAN,'',[.9,10.3,.6,6]),plastic([[FW-1.4,10.35],[FW-.9,10.35],[FW-.9,16.2],[FW-1.4,15.3]],.5,PINK,'',[FW-1.4,10.3,.6,6]),
   plastic([[3.25,11.7],[3.25,12.05],[4.5,12.78],[5.7,12.05],[5.7,10.85],[4.7,10.85],[4.7,11.7]],.78,VIOLET,'',[3.2,10.8,2.6,2])];
  // The Dawg House: a neon sign standing on the roof, facing the player, and a light in the mouth.
  const sign=texture(512,160,(c,w,h)=>{c.fillStyle='#0a0618';c.fillRect(0,0,w,h);c.strokeStyle='#ff4fc0';c.lineWidth=8;c.shadowColor='#ff4fc0';c.shadowBlur=22;c.strokeRect(12,12,w-24,h-24);c.font='900 74px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.lineWidth=6;c.strokeStyle='#b9ff5e';c.shadowColor='#b9ff5e';c.strokeText('DAWG HOUSE',w/2,h/2+4);c.shadowBlur=4;c.fillStyle='#f4ffe0';c.fillText('DAWG HOUSE',w/2,h/2+4);});
  this.signMat=new T.MeshBasicMaterial({map:sign,toneMapped:false,color:new T.Color(1.5,1.5,1.5)});const sg=new T.Mesh(new T.PlaneGeometry(2.3,.72),this.signMat);sg.position.copy(P(4.5,11.95,1.3));sg.rotation.x=-.5;s.add(sg);
  add(new T.BoxGeometry(2.3,.5,.08).translate(wx(4.5),.9,wz(12)),black);
  this.scoopGlow=new T.Mesh(new T.PlaneGeometry(1.5,1.5).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:this.glowTex,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,color:LIME}));this.scoopGlow.position.copy(P(SCOOP.x,SCOOP.y,.03));s.add(this.scoopGlow);

  // Apron with the instruction cards, and the shooter lane hardware.
  const apronPts=[[0,-1.6],[FW,-1.6],[FW,1.15],[6.55,1.15],[5.3,.55],[3.8,.55],[2.55,1.15],[0,1.15]];add(plate(apronPts,.42,.1),pbr({color:0x15102c,roughness:.3,metalness:.6,clearcoat:.8},q));
  const card=(t,x)=>{const m=new T.Mesh(new T.PlaneGeometry(2.3,1.55).rotateX(-Math.PI/2),new T.MeshStandardMaterial({map:t,color:0x9c958c,roughness:.7}));m.position.copy(P(x,-.45,.53));s.add(m);};
  card(cardArt('HOW TO PLAY',['Scoop starts a MODE','Drop targets light LOCK','3 locks = MULTIBALL','Beat 5 modes: TOP DAWG'],'#ff2f92'),1.55);card(cardArt('SCORING',['Ramps & orbits COMBO ×5','D-A-W-G lanes: bonus ×','Jackpots on lit arrows','Skill shot: flashing lane'],'#1f9dd6'),7.55);
  const logo=texture(512,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.font='900 70px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.strokeStyle='#48e6ff';c.lineWidth=5;c.shadowColor='#48e6ff';c.shadowBlur=18;c.strokeText('NEON PINBALL',w/2,h/2);c.fillStyle='#fff';c.shadowBlur=3;c.fillText('NEON PINBALL',w/2,h/2);});
  const lg=new T.Mesh(new T.PlaneGeometry(2.6,.65).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:logo,transparent:true,toneMapped:false,color:new T.Color(1.3,1.3,1.3)}));lg.position.copy(P(4.55,-.6,.53));s.add(lg);
  this.plungerRod=add(merge([new T.CylinderGeometry(.09,.09,2.6,10).rotateX(Math.PI/2).translate(0,0,1.3),new T.CylinderGeometry(.2,.2,.14,12).rotateX(Math.PI/2),new T.SphereGeometry(.26,14,10).translate(0,0,2.75)]),chrome);this.plungerRod.position.copy(P(PLUNGER.x,PLUNGER.y-.42,.26));

  // Bumpers: a skirt, a body, a lit cap and the ring that slams down.
  const star=texture(128,128,(c,w)=>{c.fillStyle='#fff';c.fillRect(0,0,w,w);c.fillStyle='#10081f';c.beginPath();for(let i=0;i<10;i++){const a=i/10*Math.PI*2-Math.PI/2,r=i%2?w*.17:w*.4;c.lineTo(w/2+Math.cos(a)*r,w/2+Math.sin(a)*r);}c.fill();});
  add(merge(BUMPERS.map(b=>new T.CylinderGeometry(b.r*.72,b.r*.85,.42,20).translate(wx(b.x),.21,wz(b.y)))),pbr({color:0xf4f0ff,roughness:.25,metalness:.2,clearcoat:1},q));
  this.bumpers=BUMPERS.map((b,i)=>{const col=[PINK,CYAN,GOLD][i],mat=new T.MeshStandardMaterial({color:col,emissive:col,emissiveMap:star,emissiveIntensity:.9,roughness:.2,metalness:.1}),cap=add(new T.CylinderGeometry(b.r+.06,b.r+.06,.1,24),mat);cap.position.copy(P(b.x,b.y,.5));
   const ring=add(new T.TorusGeometry(b.r+.02,.04,8,24).rotateX(Math.PI/2),chrome);ring.position.copy(P(b.x,b.y,.36));
   const halo=new T.Mesh(new T.PlaneGeometry(2.6,2.6).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:this.glowTex,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,color:col,opacity:.25}));halo.position.copy(P(b.x,b.y,.025));s.add(halo);return {cap,mat,ring,halo,col:new T.Color(col)};});
  // Slingshot rubbers that kick out.
  this.slingBands=SLINGS.map((sl,i)=>{const len=Math.hypot(sl.c[0]-sl.a[0],sl.c[1]-sl.a[1]),m=add(new T.BoxGeometry(len,.12,.07),rubber);m.rotation.y=Math.atan2(sl.c[1]-sl.a[1],sl.c[0]-sl.a[0]);m.userData={x:(sl.a[0]+sl.c[0])/2,y:(sl.a[1]+sl.c[1])/2,nx:(i?-1:1)*(sl.a[1]-sl.c[1])/len,ny:(i?-1:1)*(sl.c[0]-sl.a[0])/len};m.position.copy(P(m.userData.x,m.userData.y,.24));return m;});
  // Drop targets and standups.
  this.dropMeshes=DROPS.map(d=>{const t=glyph(d.label,'#ffe45e'),m=add(new T.BoxGeometry(d.w*2-.03,.52,.09),[black,black,black,black,new T.MeshStandardMaterial({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.8,roughness:.4}),black]);m.position.copy(P(d.x,d.y,.26));return m;});
  this.standMats=STANDUPS.map(()=>new T.MeshStandardMaterial({color:0xffe45e,emissive:0xffe45e,emissiveIntensity:.5,roughness:.35}));STANDUPS.forEach((t,i)=>{const m=add(new T.BoxGeometry(t.w*2-.04,.42,.1),this.standMats[i]);m.position.copy(P(t.x,t.y-.04,.21));});
  // Spinner.
  this.spinner=add(new T.BoxGeometry(.62,.36,.03),new T.MeshStandardMaterial({color:0xffe45e,emissive:0xff8a1a,emissiveIntensity:.5,metalness:.6,roughness:.3}));this.spinner.position.copy(P(SPINNER.x,SPINNER.y,.36));
  add(merge([new T.CylinderGeometry(.025,.025,.62,6).translate(wx(.1),.31,wz(SPINNER.y)),new T.CylinderGeometry(.025,.025,.62,6).translate(wx(.86),.31,wz(SPINNER.y)),new T.CylinderGeometry(.02,.02,.76,6).rotateZ(Math.PI/2).translate(wx(.48),.6,wz(SPINNER.y))]),chrome);
  // Flippers.
  this.flippers=FLIPPERS.map(f=>{const shape=(grow,r0=f.rb+grow,r1=f.rt+grow)=>{const sh=new T.Shape(),a=Math.acos((r0-r1)/f.len);sh.absarc(0,0,r0,a,-a,false);sh.absarc(f.len,0,r1,-a,a,false);sh.closePath();return sh;};
   const g=new T.Group(),body=new T.Mesh(new T.ExtrudeGeometry(shape(0),{depth:.2,bevelEnabled:false,curveSegments:12}).rotateX(-Math.PI/2),rubber),top=new T.Mesh(new T.ExtrudeGeometry(shape(-.06),{depth:.1,bevelEnabled:true,bevelSize:.02,bevelThickness:.03,bevelSegments:2,curveSegments:12}).rotateX(-Math.PI/2).translate(0,.2,0),pbr({color:0xfdf7ff,roughness:.2,metalness:.1,clearcoat:1,emissive:0xffe9ff,emissiveIntensity:.12},q));
   if(high){body.castShadow=top.castShadow=true;}g.add(body,top);g.position.copy(P(f.px,f.py,.06));s.add(g);return g;});
  // Ramps: clear plastic up to the turn, then a chrome wireform down to the inlane.
  this.rampMats=[];RAMPS.forEach((r,i)=>{const col=i?CYAN:PINK,all=r.pts.map(p=>P(p[0],p[1],p[2]+.06)),cut=r.s.findIndex(d=>d>=r.crest+2.9),a=all.slice(0,cut+1),b=all.slice(cut-1);
   const mat=new T.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.1,transparent:true,opacity:.2,roughness:.1,metalness:0,side:T.DoubleSide,depthWrite:false});this.rampMats.push(mat);
   const shell=new T.Mesh(merge([ribbon(a,[-.5,0],[.5,0]),ribbon(a,[-.5,0],[-.5,.42]),ribbon(a,[.5,0],[.5,.42])]),mat);shell.renderOrder=3;s.add(shell);
   const edge=new T.MeshBasicMaterial({color:new T.Color(col).multiplyScalar(1.6),toneMapped:false});this.rampMats.push(edge);const ca=new T.CatmullRomCurve3(a);
   s.add(new T.Mesh(merge([new T.TubeGeometry(offsetCurve(a,-.5,.42),48,.025,5),new T.TubeGeometry(offsetCurve(a,.5,.42),48,.025,5)]),edge));
   const wire=[new T.TubeGeometry(offsetCurve(b,-.2,-.06),60,.03,6),new T.TubeGeometry(offsetCurve(b,.2,-.06),60,.03,6),new T.TubeGeometry(offsetCurve(b,-.3,.2),60,.03,6),new T.TubeGeometry(offsetCurve(b,.3,.2),60,.03,6)];
   const cb=new T.CatmullRomCurve3(b);for(let k=1;k<9;k++){const p=cb.getPointAt(k/9),t=cb.getTangentAt(k/9),hoop=new T.TorusGeometry(.33,.024,6,14,Math.PI*1.25).rotateZ(-Math.PI*.625-Math.PI/2);hoop.lookAt(t);hoop.translate(p.x,p.y+.07,p.z);wire.push(hoop);if(k%2)wire.push(new T.CylinderGeometry(.03,.03,p.y,6).translate(p.x,p.y/2-.04,p.z));}
   for(const k of [.3,.62,.95]){const p=ca.getPointAt(k);wire.push(new T.CylinderGeometry(.035,.035,p.y,6).translate(p.x+(i?-.56:.56),p.y/2,p.z));}
   add(merge(wire),chrome);
   // The metal flap at the mouth.
   add(new T.BoxGeometry(1,.02,.5).rotateX(.12).translate(wx(r.pts[0][0]),.035,wz(r.mouth.y-.2)),steel);});
  // Lamps: every round insert is one instance, every arrow another.
  const lampMat=tex=>new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending});
  this.rounds=[];const round=(p,r)=>{this.rounds.push({x:p.x,y:p.y,r});return this.rounds.length-1;};
  this.L={modes:MODE_AT.map(p=>round(p,.52)),wiz:round(WIZ_AT,.74),save:round(SAVE_AT,.6),kick:round(KICK_AT,.42),locks:LOCK_AT.map(p=>round(p,.24)),bonus:BONUS_AT.map(p=>round(p,.3)),lanes:LANES.map(l=>round({x:l.x,y:LANE_Y},.46)),drops:DROP_LAMP.map(p=>round(p,.26)),stand:STAND_LAMP.map(p=>round(p,.26)),roll:ROLLOVERS.map(p=>round(p,.3))};
  const im=this.roundMesh=new T.InstancedMesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),lampMat(this.glowTex),this.rounds.length),mtx=new T.Matrix4();this.rounds.forEach((l,i)=>{mtx.makeScale(l.r*2.1,1,l.r*2.1).setPosition(wx(l.x),.012,wz(l.y));im.setMatrixAt(i,mtx);im.setColorAt(i,new T.Color(0,0,0));});im.renderOrder=2;im.frustumCulled=false;s.add(im);
  const am=this.arrowMesh=new T.InstancedMesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),lampMat(tex.arrow),SHOT_AT.length*2);SHOT_AT.forEach((p,i)=>{mtx.makeScale(.95,1,.95).setPosition(wx(p.x),.014,wz(p.y));am.setMatrixAt(i,mtx);mtx.makeScale(2.2,1,2.2).setPosition(wx(p.x),.013,wz(p.y));am.setMatrixAt(i+6,mtx);am.setColorAt(i,new T.Color(0,0,0));am.setColorAt(i+6,new T.Color(0,0,0));});am.renderOrder=2;am.frustumCulled=false;s.add(am);
  // Flashers: domes on the slingshots, by the scoop and in the back corners.
  this.flashers=[[1.95,6.1,WHITE],[FW-1.95,6.1,WHITE],[1.15,15.6,PINK],[FW-1.15,15.6,CYAN],[4.5,12.2,GOLD]].map(([x,y,col])=>{const dome=add(new T.SphereGeometry(.2,12,8,0,Math.PI*2,0,Math.PI/2),new T.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.05,roughness:.2,transparent:true,opacity:.9}),false);dome.position.copy(P(x,y,x>3&&x<6?.86:.58));
   const glow=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:col,transparent:true,depthWrite:false,depthTest:false,blending:T.AdditiveBlending,opacity:0}));glow.position.copy(dome.position);glow.scale.setScalar(6);s.add(glow);return {dome,glow};});
  // Balls: chrome, each with a soft shadow and a streak that grows with speed.
  const ballGeo=new T.SphereGeometry(BR,high?40:24,high?28:16),ballMat=new T.MeshStandardMaterial({color:0xffffff,metalness:1,roughness:.045,envMapIntensity:1.7});
  const shadowTex=radial([[0,'#000000ee'],[.45,'#000000aa'],[1,'#00000000']]);
  this.balls=Array.from({length:6},()=>{const m=add(ballGeo,ballMat);m.receiveShadow=false;const sh=new T.Mesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false,opacity:.75}));sh.renderOrder=1;s.add(sh);
   const st=new T.Mesh(new T.PlaneGeometry(.42,1).translate(0,-.5,0).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:tex.streak,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,color:0x9fd8ff,opacity:0}));st.renderOrder=2;s.add(st);m.visible=sh.visible=st.visible=false;return {m,sh,st,px:0,py:0};});
  // Glass and backbox.
  this.glass=new T.Mesh(new T.PlaneGeometry(10.9,21.6).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:glassTex(),transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:.04,toneMapped:false}));this.glass.position.set(0,2.15,.3);this.glass.renderOrder=6;s.add(this.glass);
  add(new T.BoxGeometry(11.6,8.6,1.4).translate(0,4.6,-11.6),black);
  const bg=texture(1024,640,backglassArt);this.backMat=new T.MeshBasicMaterial({map:bg,toneMapped:false,color:new T.Color(1.15,1.15,1.15)});const back=new T.Mesh(new T.PlaneGeometry(10.6,5.6),this.backMat);back.position.set(0,5.7,-10.88);s.add(back);
  this.dmdTex=new T.CanvasTexture(this.dmd.out);this.dmdTex.colorSpace=T.SRGBColorSpace;const panel=new T.Mesh(new T.PlaneGeometry(6.4,1.6),new T.MeshBasicMaterial({map:this.dmdTex,toneMapped:false,color:new T.Color(1.5,1.5,1.5)}));panel.position.set(0,1.75,-10.88);s.add(panel);
  add(merge([-4.2,4.2].map(x=>new T.CylinderGeometry(.62,.62,.06,24).rotateX(Math.PI/2).translate(x,1.75,-10.87))),steel,false);
  this.particles=new Particles(s,high?320:140,this.glowTex);this.particles.points.material.size=.3;
 }

 // ── Helpers ────────────────────────────────────────────────────────────────────────────────
 lead(g){let best=null;for(const b of g.balls){if(b.state==='lane'&&g.balls.length>1)continue;if(!best||b.y<best.y)best=b;}return best||g.balls[0];}
 popAt(text,x,y,kind='',h=.6){if(this.reduced&&kind!=='pb-big')return;const v=P(x,y,h).project(this.camera),root=this.hud.root,p=document.createElement('span');p.className='pb-pop '+kind;p.textContent=text;p.style.left=((v.x*.5+.5)*100).toFixed(1)+'%';p.style.top=((-v.y*.5+.5)*100).toFixed(1)+'%';root.append(p);setTimeout(()=>p.remove(),950);if(++this.popCount>10){root.querySelector('.pb-pop')?.remove();}this.popCount=root.querySelectorAll('.pb-pop').length;}
 toast(title,text){const el=this.ui.toast;el.innerHTML='';const b=document.createElement('b');b.textContent=title;const sp=document.createElement('span');sp.textContent=text;el.append(b,sp);el.hidden=false;el.classList.remove('pb-in');void el.offsetWidth;el.classList.add('pb-in');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>{el.hidden=true;},3200);}
 spark(x,y,color,n=10,o={}){if(!this.reduced||n>12)this.particles.burst(wx(x),o.h??.4,wz(y),n,color,{speed:4,life:.5,gravity:-9,up:1.6,...o});}
 light(x,y,color,power=10){this.hitLight.color.set(color);this.hitLight.position.set(wx(x),1.1,wz(y));this.hitLight.intensity=power;}
 flash(i,v=1){this.fx.flash[i]=Math.max(this.fx.flash[i],v);}
 show(kind,secs){this.fx.showKind=kind;this.fx.show=secs;}
 // Every engine event gets a light, a move or a line on the display.
 event(e,g){if(!this.ready)return;const st=this.stage,d=this.dmd,fx=this.fx,r=this.reduced,pts=e.points?e.points.toLocaleString():'';
  switch(e.type){
   case 'launch':st.shake(.1);this.spark(PLUNGER.x,2,GOLD,8);break;
   case 'flip':break;
   case 'shot':this.spark(e.x,e.y,WHITE,3,{speed:2,life:.2});break;
   case 'bumper':fx.bumpers[e.index]=1;st.shake(.16);this.spark(e.x,e.y,this.bumpers[e.index].col,12,{h:.5});this.light(e.x,e.y,this.bumpers[e.index].col,12);this.popAt(pts,e.x,e.y+.5,'pb-cyan');break;
   case 'sling':fx.slings[e.index]=1;this.flash(e.index,.8);st.shake(.14);this.spark(e.x,e.y,WHITE,7);break;
   case 'knock':if(e.power>18)st.shake(.06);break;
   case 'clack':this.spark(e.x,e.y,WHITE,5,{speed:2});break;
   case 'spin':this.flash(2,.25);break;
   case 'lane':if(e.lit)this.spark(LANES[e.index].x,LANE_Y,LIME,8);break;
   case 'lanes':d.show('wipe','BONUS '+e.bonusX+'X','D-A-W-G COMPLETE',1.6,2);this.show('sweep',1.2);this.popAt('BONUS ×'+e.bonusX,4.55,17,'pb-green');break;
   case 'skill':d.show('burst','SKILL SHOT',pts,1.8,3);this.show('strobe',1);this.flash(2);this.flash(3);st.flashOnce(0xb9ff5e,.25,r);this.popAt('SKILL SHOT '+pts,4.55,16.6,'pb-big');break;
   case 'drop':fx.drops[e.index]=1;this.spark(e.x,e.y-.2,GOLD,9);this.light(e.x,e.y-.4,GOLD,8);break;
   case 'bank':d.show('wipe','LOCK IS LIT','SHOOT THE DAWG HOUSE',1.6,2);this.flash(4);this.popAt('BANK '+pts,4.05,10.6,'pb-big');break;
   case 'standup':fx.stand[e.index]=1;this.spark(e.x,e.y-.2,LIME,7);break;
   case 'standups':d.show('wipe','KICKBACK LIT','',1.3,1);break;
   case 'kickback':d.show('burst','KICKBACK','',1.2,2);st.shake(.3);this.flash(0);break;
   case 'kickfire':this.spark(.4,2.8,LIME,16,{up:5});st.shake(.35);break;
   case 'rollover':this.spark(e.x,e.y,e.kind==='out'?0xff5f7a:CYAN,5);break;
   case 'ramp':case 'orbit':this.flash(e.index<3?2:3);this.light(e.x,e.y+2,SHOT_COLOR[e.index],9);this.popAt((e.combo>1?e.combo+'× COMBO ':'')+pts,e.x,e.y+1.2,e.index===1||e.index===4?'pb-pink':'pb-cyan');if(e.combo>1){d.show('burst',e.combo+'X COMBO',pts,1.1,1);this.show('sweep',.7);}break;
   case 'rampenter':this.spark(RAMPS[e.index].pts[0][0],11.4,e.index?CYAN:PINK,8,{up:3});break;
   case 'rampexit':this.spark(e.x,e.y,WHITE,5);break;
   case 'scoop':fx.scoop=1;this.flash(4);this.spark(SCOOP.x,SCOOP.y,LIME,12);break;
   case 'eject':st.shake(.2);this.spark(e.x,e.y,LIME,10,{up:3});this.flash(4,.7);break;
   case 'modestart':d.show('wipe',e.name,e.text,2.2,4);this.show('sweep',1.6);st.flashOnce(0xff4fc0,.3,r);this.hud.banner(e.name);break;
   case 'modeshot':this.popAt('+'+pts,SHOT_AT[e.index].x,SHOT_AT[e.index].y+.8,'pb-pink');break;
   case 'modestep':if(e.n<e.goal&&MODES[e.id].id!=='bumpers')d.show('plain',MODES[e.id].name,e.n+' OF '+e.goal,1,1);break;
   case 'modedone':d.show('burst',e.name+' DONE',pts,2.4,5);this.show('strobe',2);for(let i=0;i<5;i++)this.flash(i);st.flashOnce(0xffffff,.4,r);st.shake(.5);this.hud.banner(e.name+' COMPLETE');this.spark(4.55,6,GOLD,40,{speed:9,up:5,life:1});break;
   case 'modefail':d.show('plain',e.name,'TIME UP · SHOOT THE SCOOP',1.6,2);break;
   case 'fetch':this.light(SHOT_AT[e.index].x,SHOT_AT[e.index].y,PINK,7);break;
   case 'locklit':break;
   case 'lock':d.show('wipe','BALL '+e.count+' LOCKED',(3-e.count)+' MORE FOR MULTIBALL',2,3);this.show('sweep',1.2);break;
   case 'multiball':d.show('balls','MULTIBALL','JACKPOTS ARE LIT',2.6,6);this.show('strobe',2.6);for(let i=0;i<5;i++)this.flash(i);st.flashOnce(0xff4fc0,.45,r);st.shake(.6);this.hud.banner('MULTIBALL');break;
   case 'wizard':d.show('balls','TOP DAWG','EVERY SHOT IS A JACKPOT',3,7);this.show('strobe',3.2);for(let i=0;i<5;i++)this.flash(i);st.flashOnce(0xffe45e,.5,r);st.shake(.7);this.hud.banner('TOP DAWG');break;
   case 'wizardlit':d.show('burst','TOP DAWG IS LIT','SHOOT THE DAWG HOUSE',2.4,5);break;
   case 'jackpot':d.show('burst','JACKPOT',pts,1.7,5);this.show('strobe',1.4);for(let i=0;i<5;i++)this.flash(i);st.flashOnce(0xffc23d,.35,r);st.shake(.45);this.popAt('JACKPOT '+pts,SHOT_AT[e.index].x,SHOT_AT[e.index].y+1,'pb-big');this.spark(SHOT_AT[e.index].x,SHOT_AT[e.index].y+1,GOLD,30,{speed:8,up:5,life:.9});break;
   case 'superlit':d.show('wipe','SUPER JACKPOT LIT','SHOOT THE DAWG HOUSE',1.8,4);break;
   case 'super':d.show('burst','SUPER JACKPOT',pts,2.6,7);this.show('strobe',2.6);for(let i=0;i<5;i++)this.flash(i);st.flashOnce(0xffffff,.55,r);st.shake(.8);this.hud.banner('SUPER JACKPOT');this.spark(SCOOP.x,SCOOP.y,GOLD,50,{speed:10,up:6,life:1.1});break;
   case 'multiballend':d.show('plain',e.wizard?'TOP DAWG OVER':'MULTIBALL OVER','',1.4,2);break;
   case 'extralit':d.show('wipe','EXTRA BALL IS LIT','SHOOT THE DAWG HOUSE',2,3);break;
   case 'extraball':d.show('burst','EXTRA BALL','',2,5);this.show('strobe',1.5);st.flashOnce(0xff8a3d,.3,r);break;
   case 'ballsave':d.show('burst','BALL SAVED','',1.5,4);this.flash(0);this.flash(1);break;
   case 'drain':this.fx.giTo=.25;st.shake(.25);break;
   case 'ballend':d.show('plain','BALL '+e.ball+' OVER','',.7,6);break;
   case 'bonusline':{const it={kind:'count',title:e.label,sub:e.value.toLocaleString(),total:e.total.toLocaleString(),secs:.5,pri:6};d.now=it;d.t=0;d.queue.length=0;break;}
   case 'bonus':{const it={kind:'burst',title:'BONUS '+pts,sub:e.mult>1?e.base.toLocaleString()+' × '+e.mult:'',secs:1.4,pri:6};d.now=it;d.t=0;d.queue.length=0;this.show('sweep',1.2);break;}
   case 'nextball':this.fx.giTo=1;d.show('wipe','BALL '+e.ball,'',1.1,3);break;
   case 'shootagain':this.fx.giTo=1;d.show('burst','SHOOT AGAIN','',1.6,5);break;
   case 'tiltwarn':d.show('tilt','DANGER','',.9,6);st.shake(.5);st.flashOnce(0xff3040,.25,r);break;
   case 'tilt':{d.queue.length=0;d.now={kind:'tilt',title:'TILT',sub:'',secs:3,pri:9};d.t=0;this.fx.giTo=.08;st.shake(.9);st.flashOnce(0xff3040,.5,r);break;}
   case 'nudge':st.shake(.42);break;
   case 'over':d.show('plain','GAME OVER','',3,8);this.fx.giTo=.4;break;
   case 'feat':this.toast('FEAT · '+e.name,e.text);d.show('burst','FEAT: '+e.name,'',1.6,3);break;
   case 'rank':this.toast('RANK UP · '+e.name,e.next?'NEXT: '+e.next:'TOP OF THE LADDER');break;
   case 'tip':this.toast('TIP',e.text);break;
  }}
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.lastGame=g;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:t-this.statusSince<4000));return true;}

 // The player's view, solved so the whole table sits inside the free part of the screen (below
 // the display, above the touch controls) at any aspect.
 fit(){const st=this.stage,w=st.w,h=st.h,coarse=globalThis.matchMedia?.('(pointer: coarse)').matches,key=w+'x'+h+coarse;if(key===this.fitKey)return;this.fitKey=key;
  const hudTop=parseFloat(getComputedStyle(this.hud.root).getPropertyValue('--d3-top'))||14,dmdH=Math.min(w-20,480)/4,top=(hudTop+dmdH+10)/h,bottom=(coarse?112:18)/h,sidePad=10/w,cam=this.camera,aspect=w/h;
  const tall=Math.max(0,Math.min(1,(1.15-aspect)/.6)),pitch=(40+17*tall)*Math.PI/180;cam.fov=36+2*tall;cam.aspect=aspect;cam.updateProjectionMatrix();
  // Points that must be in frame: the playfield corners, the lockdown bar, and on wide screens the backbox.
  const pts=[P(-.4,-2.1,.7),P(10.4,-2.1,.7),P(-.4,20.4,.7),P(10.4,20.4,.7),P(0,20,1.6),P(10,20,1.6)];
  const dir=new T.Vector3(0,Math.sin(pitch),Math.cos(pitch)),aim=new T.Vector3(0,0,0),v=new T.Vector3();let dist=30,cy=0;
  for(let it=0;it<28;it++){cam.position.copy(aim).addScaledVector(dir,dist);cam.lookAt(aim);cam.updateMatrixWorld();let x0=9,x1=-9,y0=9,y1=-9;for(const p of pts){v.copy(p).project(cam);x0=Math.min(x0,v.x);x1=Math.max(x1,v.x);y0=Math.min(y0,v.y);y1=Math.max(y1,v.y);}
   const needX=Math.max(-x0,x1)/(1-2*sidePad),needY=(y1-y0)/(2-2*top-2*bottom),need=Math.max(needX,needY);dist*=1+(need-1)*.7;
   // Slide the aim along the table so the framed points centre in the free band.
   const mid=(y0+y1)/2,want=bottom-top;aim.z-=(mid-want)*dist*.16;}
  this.base={dist,aim:aim.clone(),dir,pitch,fov:cam.fov};}
 render(g,now){
  if(!g)return;const st=this.stage;st.resize();this.fit();const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=now/1000,reduced=this.reduced,fx=this.fx,L=g.lights(),playing=g.status==='playing';this.particles.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;if(g.status!=='over')fx.giTo=1;}
  const fade=Math.exp(-dt*(reduced?30:8)),blink=reduced?1:Math.sin(real*10)>0?1:.12,pulse=reduced?1:.6+.4*Math.sin(real*5),fast=reduced?1:Math.sin(real*22)>0?1:0;
  fx.show=Math.max(0,fx.show-dt);const strobe=fx.show>0&&fx.showKind==='strobe'&&!reduced,sweep=fx.show>0&&fx.showKind==='sweep'&&!reduced;
  // General illumination: steady, dimmed on a drain, out on a tilt, strobing through a light show.
  fx.gi+=(fx.giTo-fx.gi)*Math.min(1,dt*5);const gi=fx.gi*(strobe?(fast?1.5:.35):1);
  this.fieldMat.emissiveIntensity=.16+.4*gi;this.hemi.intensity=.3+.5*gi;this.key.intensity=.5+1.1*gi;this.gi.forEach(l=>l.intensity=16*gi);this.hitLight.intensity*=fade;
  this.plastics.forEach((m,i)=>m.emissiveIntensity=(.25+.6*gi)*(sweep?.6+.8*Math.max(0,Math.sin(real*14-i*1.3)):1));this.backMat.color.setScalar((.75+.45*gi)*(strobe&&fast?1.5:1));this.signMat.color.setScalar(L.shots[3].start||L.shots[3].lock||L.shots[3].super||L.shots[3].extra?1.1+.9*pulse:.8);
  this.rampMats.forEach((m,i)=>{if(m.isMeshStandardMaterial)m.emissiveIntensity=.05+.08*gi+(sweep?.4*Math.max(0,Math.sin(real*14)):0);});
  // Flashers.
  this.flashers.forEach((f,i)=>{const v=fx.flash[i]=Math.max(fx.flash[i]*Math.exp(-dt*(reduced?40:6)),strobe&&(Math.floor(real*14)+i)%3===0?1:0);f.glow.material.opacity=v*(reduced?.25:.7);f.dome.material.emissiveIntensity=.04+v*5;});
  // Inserts.
  const col=new T.Color(),dim=.045,setR=(i,c,k)=>{col.set(c).multiplyScalar(Math.max(dim,k));this.roundMesh.setColorAt(i,col);},Lm=this.L,wave=(x,y)=>sweep?.4+1.4*Math.max(0,Math.sin(real*13-y*.9)):strobe?(fast?1.8:.2):0;
  L.modes.forEach((m,i)=>setR(Lm.modes[i],m==='done'?LIME:PINK,m==='done'?1.5:m==='live'?1.9*blink:Math.max(0,wave(0,MODE_AT[i].y)*.6)));
  setR(Lm.wiz,GOLD,L.wizard?2.2*blink:wave(0,5)*.5);setR(Lm.save,CYAN,L.save?(g.save>0&&g.save<4?2*blink:1.7):0);setR(Lm.kick,LIME,L.kickback?1.3+.4*pulse:0);
  Lm.locks.forEach((id,i)=>setR(id,LIME,i<L.locks?1.8:L.lockLit&&i===L.locks?1.8*blink:0));Lm.bonus.forEach((id,i)=>setR(id,GOLD,L.bonusX>=BONUS_AT[i].n?1.7:wave(0,4)*.4));
  Lm.lanes.forEach((id,i)=>setR(id,L.skill===i?GOLD:LIME,L.skill===i?2.4*blink:L.lanes[i]?1.7:wave(0,17)*.5));Lm.drops.forEach((id,i)=>setR(id,GOLD,L.drops[i]?.0:1.1+.5*pulse));Lm.stand.forEach((id,i)=>setR(id,LIME,L.stand[i]?1.8:.5*pulse));
  Lm.roll.forEach((id,i)=>setR(id,ROLLOVERS[i].kind==='out'?0xff5f7a:CYAN,i===0&&L.kickback?1.2:.35+wave(0,5)*.4));this.roundMesh.instanceColor.needsUpdate=true;
  // Shot arrows: the colour says why the shot is lit; several reasons take turns.
  L.shots.forEach((s,i)=>{const why=[];if(s.super)why.push(WHITE);if(s.jackpot)why.push(GOLD);if(s.mode||s.start)why.push(PINK);if(s.wizard)why.push(GOLD);if(s.lock)why.push(LIME);if(s.extra)why.push(ORANGE);if(s.combo&&!why.length)why.push(CYAN);
   let c=SHOT_COLOR[i],k=s.lightLock?.55+.3*pulse:.0;if(why.length){c=why[Math.floor(real*2.2)%why.length];k=(c===CYAN?1.5:2.3)*(reduced?1:.35+.65*Math.max(0,Math.sin(real*9-i*.9)));}else if(sweep||strobe)k=wave(0,i*2);
   col.set(c).multiplyScalar(Math.max(dim,k));this.arrowMesh.setColorAt(i,col);col.set(c).multiplyScalar(why.length?k*.16:0);this.arrowMesh.setColorAt(i+6,col);});this.arrowMesh.instanceColor.needsUpdate=true;
  this.scoopGlow.material.opacity=(L.shots[3].start||L.shots[3].lock||L.shots[3].super||L.shots[3].extra?.5+.4*pulse:.12)+(fx.scoop*=fade)*.6;
  // Mechanisms.
  this.bumpers.forEach((b,i)=>{const f=fx.bumpers[i]*=fade,party=L.bumpers?.6*blink:0;b.mat.emissiveIntensity=(.3+.3*gi)+f*4+party;b.ring.position.y=.36-f*.2;b.halo.material.opacity=.05*gi+f*.6+party*.25;b.cap.scale.setScalar(1+f*.06);});
  this.slingBands.forEach((m,i)=>{const f=fx.slings[i]*=Math.exp(-dt*18),u=m.userData;m.position.set(wx(u.x+u.nx*f*.16),.24,wz(u.y+u.ny*f*.16));});
  this.dropMeshes.forEach((m,i)=>{const down=L.drops[i];m.position.y+=((down?-.3:.26)-m.position.y)*Math.min(1,dt*(down?26:9));});
  this.standMats.forEach((m,i)=>{const f=fx.stand[i]*=fade;m.color.set(L.stand[i]?LIME:0xffe45e);m.emissive.copy(m.color);m.emissiveIntensity=.4+f*3+(L.stand[i]?.5:0);});
  FLIPPERS.forEach((f,i)=>{this.flippers[i].rotation.y=flipperAngle(f,g.flips[i].angle);});
  this.spinAngle+=g.spin.v*dt;this.spinner.rotation.x=g.spin.v>0?this.spinAngle:this.spinner.rotation.x*(1-Math.min(1,dt*6));if(g.spin.v<=0)this.spinAngle=this.spinner.rotation.x;
  const waiting=g.waiting;this.plungerRod.position.z=wz(PLUNGER.y-.42)+g.plunge*.75+(fx.plunge=(fx.plunge||0)*Math.exp(-dt*14))*-.3;
  // Balls.
  let moving=0;this.balls.forEach((o,i)=>{const b=g.balls[i],vis=!!b&&b.state!=='scoop'&&b.state!=='kick';o.m.visible=o.sh.visible=vis;o.st.visible=false;if(!vis)return;const z=(b.z||0)+(b.state==='ramp'?.06:0),p=P(b.x,b.y,BR+z);o.m.position.copy(p);o.sh.position.set(p.x+.05+z*.12,.02,p.z-.03);o.sh.scale.setScalar(.72+z*.25);o.sh.material.opacity=.7/(1+z*1.2);
   const vx=b.vx,vy=b.vy,sp=b.state==='lane'?0:Math.hypot(vx,vy);o.m.rotation.x-=vy*dt/BR*.5;o.m.rotation.z-=vx*dt/BR*.5;moving=Math.max(moving,sp);
   if(sp>9&&!reduced&&playing){o.st.visible=true;o.st.position.copy(p);o.st.rotation.y=Math.atan2(vx,vy)+Math.PI;o.st.scale.set(1,1,Math.min(2.6,sp*.06));o.st.material.opacity=Math.min(.55,(sp-9)*.03);}});
  // Camera: the fitted player view, leaning a little toward the ball; the close-up rides in on it.
  const lead=this.lead(g),b=this.base,cam=this.camera,multi=g.multiball||g.balls.length>1,eye=this.cameraMode==='first';
  const tx=lead?wx(lead.x):0,tz=lead?wz(lead.y):0,ly=lead?lead.y:5,zoomTo=multi||reduced?1:.955,lean=multi||reduced?0:.11;
  this.zoom+=(zoomTo-this.zoom)*Math.min(1,dt*1.6);const fk=Math.min(1,dt*2.2);this.focus.x+=((tx-b.aim.x)*lean*.4-this.focus.x)*fk;this.focus.z+=((tz-b.aim.z)*lean-this.focus.z)*fk;
  const at=new T.Vector3(b.aim.x+this.focus.x,0,b.aim.z+this.focus.z),pos=at.clone().addScaledVector(b.dir,b.dist*this.zoom);
  // Player's eye: standing at the lockdown bar, flippers big in the foreground, the head turning
  // gently to follow the ball up the table. The flippers never leave the frame.
  this.eyeMix=(this.eyeMix||0)+((eye?1:0)-(this.eyeMix||0))*Math.min(1,dt*4);const m=smooth(this.eyeMix);
  if(m>.001){const tall=Math.max(0,Math.min(1,(1.15-cam.aspect)/.6)),look=multi?4.8+2.7*tall:Math.max(4.2+.4*tall,Math.min(7.6+3.4*tall,2.4+ly*.5));this.eyeLook=(this.eyeLook??look)+(look-(this.eyeLook??look))*Math.min(1,dt*2.5);this.eyeX=(this.eyeX||0)+((multi?0:tx*.28)-(this.eyeX||0))*Math.min(1,dt*3);
   const ePos=new T.Vector3(this.eyeX*.35,8.4+.8*tall,wz(-6.6+2*tall)),eAt=new T.Vector3(this.eyeX,0,wz(this.eyeLook));pos.lerp(ePos,m);at.lerp(eAt,m);cam.fov=b.fov+(fitFov(46,cam.aspect,58)-b.fov)*m;}else cam.fov=b.fov;
  cam.updateProjectionMatrix();cam.position.copy(pos);st.applyShake(real,reduced);cam.up.set(0,1,0);cam.lookAt(at);
  // Display and HUD.
  this.dmdClock+=dt;if(this.dmdClock>.05){const goal=g.goal(),info={left:g.status==='over'?'GAME OVER':'BALL '+g.ball+(L.extraBalls?' +'+L.extraBalls:'')+' · '+STAGES[g.stage],right:(goal.t>0?Math.ceil(goal.t)+'s  ':g.save>0&&playing?'SAVE '+Math.ceil(g.save)+'  ':'')+'BONUS '+g.bonusX+'X',score:g.score.toLocaleString(),text:g.status==='ready'?'PRESS START':(goal.of?goal.title+' '+goal.n+'/'+goal.of+' · ':goal.title+' · ')+goal.text,n:goal.n,of:goal.of,flash:!!waiting};
   this.dmd.draw(this.dmdClock,real,info);this.dmdTex.needsUpdate=true;this.dmdClock=0;}
  const showPl=playing&&!!waiting,ui=this.ui;if(this.hud.cache.pl!==showPl){this.hud.cache.pl=showPl;ui.plunge.hidden=!showPl;}
  if(showPl){ui.bar.style.transform='scaleY('+g.plunge.toFixed(3)+')';this.hud.set(ui.tip,'tip',g.plunge>0?'RELEASE!':'HOLD ↓ OR\nRIGHT SIDE');}
  this.glass.material.opacity=.03+.02*gi;this.particles.update(dt);this.hud.live(g.status!=='ready'||true);
  st.render(dt,real,{reduced,aberration:.0009});
 }
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;clearTimeout(this.toastTimer);this.ready=false;this.ambient?.stop();this.hud?.dispose();this.stage?.dispose();}
}
