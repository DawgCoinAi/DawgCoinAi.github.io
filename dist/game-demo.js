// Attract-mode demos: each game plays itself in the game sheet, on the real engine and renderer,
// steered by a small autopilot. When a demo run ends, a fresh one starts. Nothing here is saved
// or scored; the demos only read the engines and press their buttons.
import {createQuickGame,snapshotQuick,restoreQuick,QUICK_MODES} from './pack-checkpoint.js';
import {stepPack} from './pack-engine.js';
import {PackRenderer} from './pack-renderer.js';
import {ArcadeRenderer} from './renderer.js';
import {MazeGame} from './engine.js';
import {seededRandom,advanceGame} from './mobile-core.js';
import {trackAt} from './kart-engine.js';
import {CLIMB,tower,hookPos} from './climb-engine.js';

const LOOKAHEAD={runner:[null,'left','right','up','down'],turbo:[null,'up','right','down'],snake:[null,'up','down','left','right'],cross:[null,'up','left','right']};
// How a move plays out if nothing else is pressed: seconds survived, plus points, plus progress.
function rollout(kind,g,action,horizon){const s=snapshotQuick(g,kind),c=s&&restoreQuick(s);if(!c)return -1;c.status='playing';c.events=[];if(action)c.move(action);const s0=c.score;let t=0;while(t<horizon&&c.status==='playing'){c.tick(1/60);t+=1/60;}
 return t*100+(c.score-s0)*(kind==='cross'?4:2)+(kind==='cross'&&action==='up'?30:0)+(kind==='turbo'&&action==='right'?8:0);}
function lookahead(kind,g,mem,dt){mem.wait=(mem.wait||0)-dt;if(mem.wait>0||kind==='cross'&&g.hop>0)return;mem.wait=kind==='cross'?.12:kind==='snake'?.09:.18;
 let best=null,score=-Infinity;for(const a of LOOKAHEAD[kind]){const v=rollout(kind,g,a,kind==='cross'?1.1:kind==='snake'?1.6:1.4)+Math.random()*3;if(v>score){score=v;best=a;}}if(best)g.move(best);}
// Flappy: flap when sinking below the middle of the next gap.
function flappy(g){const o=g.obstacles.find(o=>o.x+o.width>g.x-g.radius);const target=o?o.center+o.gap*.12:280;if(g.y>target&&g.vy>-40)g.flap();}
// Pinball: flip when a ball drops into reach of a flipper; launch whenever a ball waits.
function pinball(g,mem,dt){mem.hold=Math.max(0,(mem.hold||0)-dt);for(const side of ['left','right']){const near=g.balls?.some(b=>b.state==='play'&&b.y<3.6&&b.vy<2&&(side==='left'?b.x<4.6:b.x>4.4));if(near&&!mem[side]){g.press(side,true);mem[side]=.18;}if(mem[side]){mem[side]-=dt;if(mem[side]<=0){g.press(side,false);mem[side]=0;}}}
 if(g.balls?.some(b=>b.state==='lane'))g.move('down');}
// Drift Dawgs: the inside line through corners, items as soon as they land.
function kart(g){const t=g.track,k=g.you;if(!t||!k)return;const look=trackAt(t,k.p+14+k.v*.4),line=Math.max(-3.5,Math.min(3.5,look.curve*260)),err=Math.max(-.45,Math.min(.45,(line-k.d)*.35)),st=(err-k.a)*3.2;g.press('left',st>.25);g.press('right',st<-.25);if(k.item)g.move('up');}
// Don't Look Down: reel in and pump the swing, let go once the next hook is in reach (or on a good upswing), then grab.
function climb(g,mem,dt){if(g.hook>=0){mem.t=(mem.t||0)+dt;g.input.up=true;const lr=g.vx>=0?1:-1;g.input.left=lr<0;g.input.right=lr>0;const next=tower().hooks[g.hook+1];if(next){const p=hookPos(next,g.time);if(Math.hypot(p.x-g.x,p.y-g.y)<CLIMB.reach-.6||mem.t>1.4&&g.vy>5){mem.from=g.hook;mem.t=0;g.press('up',false);}}return;}
 g.input.left=g.input.right=false;const {hook}=g.target();if(g.grounded||hook&&hook.id>(mem.from??-1)&&g.vy<6)g.press('up',true);}
// The maze: head for the nearest pellet, steering clear of rivals unless powered up.
function maze(g,mem){const p=g.player;if(p.moving&&p.progress<.85)return;const sx=p.moving?p.tx:p.x,sy=p.moving?p.ty:p.y,danger=new Set();
 if(!(g.power>0))for(const gh of g.ghosts){const q=g.position(gh);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)danger.add(Math.round(q.x)+dx+','+(Math.round(q.y)+dy));}
 const DIRS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]},seen=new Set([sx+','+sy]),queue=[[sx,sy,null]];
 while(queue.length){const [x,y,first]=queue.shift();if(first&&g.pellets.has(x+','+y)){g.direction(first);return;}for(const [d,[dx,dy]] of Object.entries(DIRS)){const nx=x+dx,ny=y+dy,k=nx+','+ny;if(seen.has(k)||g.wall(nx,ny)||danger.has(k)&&queue.length<400)continue;seen.add(k);queue.push([nx,ny,first||d]);}}
 const opts=g.options({x:sx,y:sy});if(opts.length)g.direction(opts[Math.floor(Math.random()*opts.length)]);}

// A quiet PackRenderer: no status line, and it can let go of its GPU scenes.
class DemoRenderer extends PackRenderer {status(){}dispose(){for(const k of Object.keys(this.gpus)){try{this.gpus[k]?.dispose();}catch{}}this.gpus={};}}

export class GameDemo {
 constructor(host,kind,{face,character,view}={}){this.host=host;this.kind=kind;this.mem={};this.raf=0;this.last=0;this.dead=false;
  const c=this.canvas=document.createElement('canvas');c.className='demo-canvas';host.replaceChildren(c);
  if(QUICK_MODES.includes(kind)){c.width=420;c.height=560;this.renderer=new DemoRenderer(c,face);this.renderer.character=character;this.renderer.views={[kind]:view};}
  else{c.width=1008;c.height=1104;this.renderer=new ArcadeRenderer(c,face);this.renderer.character=character;}
  this.fresh();this.frame=this.frame.bind(this);this.raf=requestAnimationFrame(this.frame);}
 fresh(){const seed=(Math.random()*2**31)>>>0;this.mem={};this.overAt=0;
  if(QUICK_MODES.includes(this.kind)){this.game=createQuickGame(this.kind,seed);}else{this.game=new MazeGame(this.kind==='rush'?'rush':'classic',seededRandom(seed),{worldSeed:seed});}
  this.game.start?.();}
 frame(now){if(this.dead)return;const dt=this.last?Math.min(.05,(now-this.last)/1000):0;this.last=now;const g=this.game,k=this.kind;
  if(g.status==='playing'){try{if(LOOKAHEAD[k])lookahead(k,g,this.mem,dt);else if(k==='flappy')flappy(g);else if(k==='pinball')pinball(g,this.mem,dt);else if(k==='kart')kart(g);else if(k==='climb')climb(g,this.mem,dt);else maze(g,this.mem);}catch{}
   if(QUICK_MODES.includes(k))stepPack(g,dt);else advanceGame(g,dt);}
  else if(g.status==='over'||g.status==='won'){this.overAt||=now;if(now-this.overAt>1600)this.fresh();}
  else g.start?.();
  if(g.events)g.events.length=0;try{if(QUICK_MODES.includes(k))this.renderer.draw(g,k,now);else this.renderer.draw(g,now);}catch{}
  this.raf=requestAnimationFrame(this.frame);}
 dispose(){this.dead=true;cancelAnimationFrame(this.raf);this.renderer.dispose?.();this.host.replaceChildren();}
}
