import test from 'node:test';
import assert from 'node:assert/strict';
import {ClimbGame,CLIMB,FLOORS,tower,hookPos,taunt,validClimbSnapshot,CLIMB_FIELDS} from '../dist/climb-engine.js';
import {createQuickGame,snapshotQuick,restoreQuick,QUICK_MODES} from '../dist/pack-checkpoint.js';
import {seededRandom} from '../dist/mobile-core.js';

const run=(g,s,input={})=>{Object.assign(g.input,input);for(let t=0;t<s;t+=1/120)g.tick(1/120);};
const hang=(i,L=3)=>{const g=new ClimbGame(seededRandom(1),1),h=tower().hooks[i];g.start();g.hook=i;g.rope=L;const p=hookPos(h,0);g.x=p.x;g.y=p.y-L;g.grounded=false;g.ledge=-1;g.maxY=g.y;g.peak=g.y;return g;};

test('The tower is the same for everyone, 500 m tall, inside the shaft, getting nastier with height',()=>{
 const t=tower();assert.equal(t,tower());assert.ok(t.hooks.length>80);assert.ok(t.hooks.at(-1).y>CLIMB.top-12);assert.ok(t.ledges.length>=FLOORS.length);
 for(const h of t.hooks)assert.ok(Math.abs(h.x)+(h.amp||0)<=CLIMB.half-.99,'hook '+h.id+' stays inside the shaft');
 const hazards=lo=>t.hooks.filter(h=>h.y>=lo&&h.y<lo+150&&h.type!=='hook').length/t.hooks.filter(h=>h.y>=lo&&h.y<lo+150).length;assert.ok(hazards(350)>hazards(0),'more traps up top');
 for(let i=1;i<t.hooks.length;i++){const a=t.hooks[i-1],b=t.hooks[i];assert.ok(b.y>a.y,'hooks climb');}
});

test('Holding grabs the nearest hook above and reels in; letting go keeps your swing',()=>{
 const g=new ClimbGame(seededRandom(3),3);g.start();assert.equal(g.grounded,true);g.press('up',true);assert.equal(g.hook,0,'first hook is in reach from the street');
 const r0=g.rope;run(g,.5,{up:true});assert.ok(g.rope<r0,'holding reels in');assert.equal(g.hook,0,'still holding: grabbing from the street lifts you');assert.ok(g.y>.5);run(g,1.2,{up:true,right:true});const vx=g.vx;g.press('up',false);assert.equal(g.hook,-1);assert.ok(Math.abs(g.vx-vx)<1e-9,'release keeps momentum');
});

test('Every ordinary hook can reach a higher one with a pumped swing',()=>{
 const t=tower();
 const attempt=(i,L,T,rel)=>{const g=hang(i,L);let released=false;for(let k=0;k<1200;k++){if(g.hook===i&&!released){const lr=g.time<T?(g.vx>=0?1:-1):0;g.input.left=lr<0;g.input.right=lr>0;if(g.time>=T&&g.vy>rel){g.input.left=g.input.right=false;g.press('up',false);released=true;}}
  else if(g.hook<0&&released){const {hook}=g.target();if(hook&&hook.id>i&&g.vy<4)g.press('up',true);}g.tick(1/120);if(g.hook>i||g.grounded&&g.y>t.hooks[i].y-CLIMB.reach-1&&g.ledge>0)return true;if(g.grounded)return false;}return false;};
 const stuck=t.hooks.slice(0,-1).filter(h=>h.type==='hook'||h.type==='swing').filter(h=>![2,3,4,5,6,7].some(L=>[0,.6,1.2,2,3].some(T=>[0,3,6,9].some(rel=>attempt(h.id,L,T,rel)))));
 assert.deepEqual(stuck.map(h=>h.id),[]);
});

test('Rusty hooks snap, slick hooks slide, springs launch',()=>{
 const t=tower(),find=type=>t.hooks.find(h=>h.type===type);
 const r=hang(find('rusty').id,2);r.events=[];run(r,CLIMB.rusty+.05);assert.equal(r.hook,-1);assert.ok(r.events.some(e=>e.type==='snap'));assert.ok(r.broken.includes(find('rusty').id),'a snapped hook stays gone this run');
 const s=hang(find('slick').id,2);s.events=[];run(s,CLIMB.slick+.05,{up:true});assert.equal(s.hook,-1);assert.ok(s.events.some(e=>e.type==='slip'));
 const sp=find('spring'),g=new ClimbGame(seededRandom(2),2);g.start();g.grounded=false;g.ledge=-1;g.x=sp.x;g.y=sp.y-2;g.vy=0;g.press('up',true);assert.equal(g.hook,-1,'springs never hold');assert.ok(g.vy>=CLIMB.spring);
});

test('Falls are measured, a ledge catches you, and the street ends the run with a verdict',()=>{
 const t=tower(),ledge=t.ledges.find(l=>l.id>0),g=new ClimbGame(seededRandom(4),4);g.start();g.grounded=false;g.ledge=-1;g.x=(ledge.x0+ledge.x1)/2;g.y=ledge.y+30;g.peak=g.y;g.maxY=g.y;g.events=[];run(g,3);
 assert.equal(g.grounded,true);assert.equal(g.ledge,ledge.id);const fall=g.events.find(e=>e.type==='fall');assert.ok(fall&&fall.meters>=29&&fall.meters<=30,'measured from where you let go');assert.ok(fall.line.length>5);assert.equal(g.status,'playing');
 const s=new ClimbGame(seededRandom(5),5);s.start();s.grounded=false;s.ledge=-1;s.x=8.4;s.y=40;s.peak=40;s.maxY=40;run(s,4);assert.equal(s.status,'over');assert.match(s.reason,/40 m up/);assert.equal(s.score,400+s.bonus);
 assert.notEqual(taunt(12,0),taunt(200,0));
});

test('Score is 10 a meter of your best height plus bones, and runs are deterministic',()=>{
 const a=new ClimbGame(seededRandom(9),9),b=new ClimbGame(seededRandom(9),9);for(const g of [a,b]){g.start();g.press('up',true);run(g,2,{up:true,right:true});g.press('up',false);run(g,1);}
 for(const k of CLIMB_FIELDS)assert.deepEqual(a[k],b[k],k);assert.equal(a.score,Math.floor(a.maxY)*10+a.bonus);
});

test('Climb runs save mid-swing and come back exactly, and bad saves are refused',()=>{
 assert.ok(QUICK_MODES.includes('climb'));const g=createQuickGame('climb',77);g.start();g.press('up',true);run(g,1.3,{up:true,left:true});
 const snap=JSON.parse(JSON.stringify(snapshotQuick(g,'climb')));assert.ok(validClimbSnapshot(snap));const back=restoreQuick(snap);assert.ok(back);assert.equal(back.status,'paused');for(const k of CLIMB_FIELDS)assert.deepEqual(back[k],g[k],k);
 back.start();run(back,.5,{up:true});run(g,.5,{up:true});assert.ok(Math.abs(back.x-g.x)<1e-9&&Math.abs(back.y-g.y)<1e-9,'restored run continues identically');
 for(const bad of [{...snap,score:snap.score+10},{...snap,hook:9999},{...snap,x:50},{...snap,input:{up:1}}])assert.equal(restoreQuick(bad),null);
});

test('Swing hooks move on their rails, deterministically',()=>{const h=tower().hooks.find(h=>h.type==='swing');assert.ok(h);const a=hookPos(h,0),b=hookPos(h,1.3);assert.notEqual(a.x,b.x);assert.equal(a.y,b.y);assert.deepEqual(hookPos(h,1.3),b);});
