// Attract-mode demos: each game plays itself in the game sheet, on the real engine and renderer,
// steered by a small autopilot. When a demo run ends, a fresh one starts. Nothing here is saved
// or scored; the demos only read the engines and press their buttons.
import {createQuickGame,snapshotQuick,restoreQuick,QUICK_MODES} from './pack-checkpoint.js';
import {stepPack} from './pack-engine.js';
import {pinballAutopilot} from './pinball-engine.js';
import {PackRenderer} from './pack-renderer.js';
import {ArcadeRenderer} from './renderer.js';
import {MazeGame} from './engine.js';
import {seededRandom,advanceGame} from './mobile-core.js';
import {trackAt} from './kart-engine.js';
import {CLIMB,tower,hookPos} from './climb-engine.js';
import {HEIST_PLANS,planFrames} from './heist-engine.js';
import {DOMINO_SOLUTIONS} from './domino-engine.js';
import {turboPilot} from './turbo-engine.js';

const LOOKAHEAD={runner:[null,'left','right','up','down'],snake:[null,'up','down','left','right'],cross:[null,'up','left','right']};
// How a move plays out if nothing else is pressed: seconds survived, plus points, plus progress.
function rollout(kind,g,action,horizon){const s=snapshotQuick(g,kind),c=s&&restoreQuick(s);if(!c)return -1;c.status='playing';c.events=[];if(action)c.move(action);const s0=c.score;let t=0;while(t<horizon&&c.status==='playing'){c.tick(1/60);t+=1/60;}
 return t*100+(c.score-s0)*(kind==='cross'?4:2)+(kind==='cross'&&action==='up'?30:0);}
function lookahead(kind,g,mem,dt){mem.wait=(mem.wait||0)-dt;if(mem.wait>0||kind==='cross'&&g.hop>0)return;mem.wait=kind==='cross'?.12:kind==='snake'?.09:.18;
 let best=null,score=-Infinity;for(const a of LOOKAHEAD[kind]){const v=rollout(kind,g,a,kind==='cross'?1.1:kind==='snake'?1.6:1.4)+Math.random()*3;if(v>score){score=v;best=a;}}if(best)g.move(best);}
// Flappy: flap when sinking below the middle of the next gap.
function flappy(g){const o=g.obstacles.find(o=>o.x+o.width>g.x-g.radius);const target=o?o.center+o.gap*.12:280;if(g.y>target&&g.vy>-40)g.flap();}
// Pinball: the engine's own attract-mode player, which looks ahead to find flips that make ramps.
const pinball=pinballAutopilot;
// Drift Dawgs: the inside line, a held slide through every real corner (the touch way) and a
// mini-turbo out of it; items as soon as they land.
function kart(g){const t=g.track,k=g.you;if(!t||!k)return;if(g.go>0){if(g.go<.3&&!g.rev)g.press('up',true);return;}g.autoDrift=true;const look=trackAt(t,k.p+14+k.v*.4),here=trackAt(t,k.p+4),line=Math.max(-3.5,Math.min(3.5,look.curve*260)),err=Math.max(-.45,Math.min(.45,(line-k.d)*.35)),st=(err-k.a)*3.2;
 if(k.drift){const hold=Math.sign(here.curve)===k.drift&&Math.abs(here.curve)>.008&&k.charge<2.2;g.press(k.drift>0?'left':'right',hold);g.press(k.drift>0?'right':'left',false);}else{g.press('left',st>.25);g.press('right',st<-.25);}if(k.item)g.move('up');}
// Don't Look Down: reel in and pump the swing, let go once the next hook is in reach (or on a good upswing), then grab.
function climb(g,mem,dt){if(g.hook>=0){mem.t=(mem.t||0)+dt;g.input.up=true;const lr=g.vx>=0?1:-1;g.input.left=lr<0;g.input.right=lr>0;const next=tower().hooks[g.hook+1];if(next){const p=hookPos(next,g.time);if(Math.hypot(p.x-g.x,p.y-g.y)<CLIMB.reach-.6||mem.t>1.4&&g.vy>5){mem.from=g.hook;mem.t=0;g.press('up',false);}}return;}
 g.input.left=g.input.right=false;const {hook}=g.target();if(g.grounded||hook&&hook.id>(mem.from??-1)&&g.vy<6)g.press('up',true);}
// IT LEARNS: steps off marked tiles in a fixed order of preference, so the House soon reads the demo and predicts it.
function nemesis(g,mem){if(g.moved||mem.beat===g.beat||g.t<g.beatLen*.35)return;mem.beat=g.beat;const o=g.options().filter(([m,t])=>!g.marks.includes(t)),order=[3,4,1,2,0];o.sort((a,b)=>order.indexOf(a[0])-order.indexOf(b[0]));const m=o[0]?.[0]??0;if(m)g.move(['stay','up','down','left','right'][m]);}
// Last Bark Standing: stay central, square up to the nearest rival, bark when they're close.
function bark(g){const you=g.you,n=g.nearest(you),I=g.input;I.left=you.x>.5;I.right=you.x<-.5;I.up=you.y>.5;I.down=you.y<-.5;if(n){const dx=n.x-you.x,dy=n.y-you.y,d=Math.hypot(dx,dy);if(d<3){I.left=dx<0;I.right=dx>0;I.up=dy<0;I.down=dy>0;}I.bark=d<3.2&&you.charge<.9;}else I.bark=false;}
// Echo Heist: plays the proven plan for the current heist, one crew member per loop.
function heist(g,mem){const plan=HEIST_PLANS[g.level]?.[g.recs.length];if(!plan){g.input={up:false,down:false,left:false,right:false};return;}const key=g.level+':'+g.recs.length;if(mem.key!==key){mem.key=key;mem.fr=planFrames(plan);}const b=mem.fr[g.frame]??0;g.input={up:!!(b&1),down:!!(b&2),left:!!(b&4),right:!!(b&8)};}
// Paint the Town: the engine's own autopilot drives your DAWG (small safe loops, bolting home when a rival is close).
function paint(g){g.auto=true;}
// Domino Dynasty: drops the stored solution for the room, pauses to show it, then holds GO.
function domino(g,mem,dt){mem.t=(mem.t||0)+dt;if(g.phase!=='place'){mem.t=0;return;}if(!g.placed.length){if(mem.t>1.2){g.setPlaced(DOMINO_SOLUTIONS[g.level]||[]);mem.t=0;}}else if(mem.t>1)g.go();}
// The maze: head for the nearest pellet, steering clear of rivals unless powered up.
function maze(g,mem){const p=g.player;if(p.moving&&p.progress<.85)return;const sx=p.moving?p.tx:p.x,sy=p.moving?p.ty:p.y,danger=new Set();
 if(!(g.power>0))for(const gh of g.ghosts){const q=g.position(gh);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)danger.add(Math.round(q.x)+dx+','+(Math.round(q.y)+dy));}
 const DIRS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]},seen=new Set([sx+','+sy]),queue=[[sx,sy,null]];
 while(queue.length){const [x,y,first]=queue.shift();if(first&&g.pellets.has(x+','+y)){g.direction(first);return;}for(const [d,[dx,dy]] of Object.entries(DIRS)){const nx=x+dx,ny=y+dy,k=nx+','+ny;if(seen.has(k)||g.wall(nx,ny)||danger.has(k)&&queue.length<400)continue;seen.add(k);queue.push([nx,ny,first||d]);}}
 const opts=g.options({x:sx,y:sy});if(opts.length)g.direction(opts[Math.floor(Math.random()*opts.length)]);}

// A quiet PackRenderer: no status line, and it can let go of its GPU scenes.
class DemoRenderer extends PackRenderer {status(){}dispose(){for(const k of Object.keys(this.gpus)){try{this.gpus[k]?.dispose();}catch{}}this.gpus={};}}

export class GameDemo {
 constructor(host,kind,{face,character,view}={}){this.host=host;this.kind=kind;this.mem={};this.raf=0;this.last=0;this.dead=false;if(kind==='fight'){this.fightDemo(host);return;}
  const c=this.canvas=document.createElement('canvas');c.className='demo-canvas';host.replaceChildren(c);
  if(QUICK_MODES.includes(kind)){c.width=420;c.height=560;this.renderer=new DemoRenderer(c,face);this.renderer.character=character;this.renderer.views={[kind]:view};}
  else{c.width=1008;c.height=1104;this.renderer=new ArcadeRenderer(c,face);this.renderer.character=character;}
  this.fresh();this.frame=this.frame.bind(this);this.raf=requestAnimationFrame(this.frame);}
 fightDemo(host){const box=document.createElement('div');box.className='demo-canvas fight-moment';box.style.cssText='position:relative;width:100%;height:100%;min-height:160px;overflow:hidden';host.replaceChildren(box);
  Promise.all([import('./fight-3d.js'),import('./fight-engine.js'),import('./fight-roster.js')]).then(([{FightScene},E,R])=>{if(this.dead)return;const sc=this.fightScene=new FightScene(box,{quality:'low',viewer:true});sc.init();let g=null,acc=0;
   const fresh=()=>{const seed=(Math.random()*2**31)>>>0,ids=R.STARTERS.filter(x=>x!=='you'),i=seed%ids.length,j=(i+1+(seed>>>8)%(ids.length-1))%ids.length,st=R.STAGE_IDS[(seed>>>4)%R.STAGE_IDS.length];sc.setStage(st);sc.setFighters(ids[i],ids[j]);g=E.createMatch({seed,p:[ids[i],ids[j]],stage:st,cpu:[4,4]});};fresh();
   const loop=now=>{if(this.dead)return;const dt=this.last?Math.min(.05,(now-this.last)/1000):0;this.last=now;let ev=[],n=0;acc+=dt;while(acc>=1/60&&n<4){acc-=1/60;n++;ev=ev.concat(E.stepAuto(g));}if(g.phase==='over'){this.overAt||=now;if(now-this.overAt>1800){this.overAt=0;fresh();}}try{sc.frame(g,ev,dt);}catch{}this.raf=requestAnimationFrame(loop);};this.raf=requestAnimationFrame(loop);}).catch(()=>{});}
 fresh(){const seed=(Math.random()*2**31)>>>0;this.mem={};this.overAt=0;
  if(QUICK_MODES.includes(this.kind)){this.game=createQuickGame(this.kind,seed);}else{this.game=new MazeGame(this.kind==='rush'?'rush':'classic',seededRandom(seed),{worldSeed:seed});}
  this.game.start?.();}
 frame(now){if(this.dead)return;const dt=this.last?Math.min(.05,(now-this.last)/1000):0;this.last=now;const g=this.game,k=this.kind;
  if(g.status==='playing'){try{if(LOOKAHEAD[k])lookahead(k,g,this.mem,dt);else if(k==='flappy')flappy(g);else if(k==='turbo')turboPilot(g);else if(k==='pinball')pinball(g,this.mem,dt);else if(k==='kart')kart(g);else if(k==='climb')climb(g,this.mem,dt);else if(k==='heist')heist(g,this.mem);else if(k==='domino')domino(g,this.mem,dt);else if(k==='paint')paint(g);else if(k==='bark')bark(g);else if(k==='nemesis')nemesis(g,this.mem);else maze(g,this.mem);}catch{}
   if(QUICK_MODES.includes(k))stepPack(g,dt);else advanceGame(g,dt);}
  else if(g.status==='over'||g.status==='won'){this.overAt||=now;if(now-this.overAt>1600)this.fresh();}
  else g.start?.();
  if(g.events)g.events.length=0;try{if(QUICK_MODES.includes(k))this.renderer.draw(g,k,now);else this.renderer.draw(g,now);}catch{}
  this.raf=requestAnimationFrame(this.frame);}
 dispose(){this.dead=true;cancelAnimationFrame(this.raf);try{this.fightScene?.dispose();}catch{}this.renderer?.dispose?.();this.host.replaceChildren();}
}
