import test from 'node:test';
import assert from 'node:assert/strict';
import {Curveballs,CURVEBALLS,WARN_SECONDS,ACTIVE_SECONDS,FIRST_AFTER,mirrorDir,pickCurveball} from '../dist/curveballs.js';
import {parseBackup} from '../dist/progress-backup.js';

const run=(c,seconds,playing=true)=>{for(let t=0;t<seconds;t+=.1)c.tick(.1,playing);};
test('A curveball is always announced before it changes anything, then wears off',()=>{
 const cues=[],c=new Curveballs({random:()=>0,cue:(k,m)=>cues.push(k+':'+m.id)});
 run(c,FIRST_AFTER-.5);assert.equal(c.phase,'idle');assert.equal(c.timeScale,1);
 run(c,1);assert.equal(c.phase,'warn','warning first');assert.equal(c.active,null,'nothing changes during the warning');
 run(c,WARN_SECONDS);assert.equal(c.phase,'active');assert.ok(c.active);
 run(c,ACTIVE_SECONDS);assert.equal(c.phase,'idle');assert.equal(c.timeScale,1);
 assert.deepEqual(cues.map(s=>s.split(':')[0]),['warn','start','end']);
});
test('Pausing freezes the countdown, and the setting turns curveballs off at once',()=>{
 let on=true;const c=new Curveballs({random:()=>0,enabled:()=>on});run(c,FIRST_AFTER-1);run(c,120,false);assert.equal(c.phase,'idle','paused time never counts');
 run(c,2+WARN_SECONDS);assert.equal(c.phase,'active');on=false;c.tick(.1,true);assert.equal(c.phase,'idle');assert.equal(c.active,null);
});
test('Speed modes scale the clock; trippy mirrors left and right',()=>{
 for(const m of CURVEBALLS){const c=new Curveballs();c.phase='active';c.mode=m;assert.equal(c.timeScale,m.time||1);
  const sent=[];c.route('left',d=>sent.push(d));if(!m.delay)assert.deepEqual(sent,[m.mirror?'right':'left']);}
 assert.equal(mirrorDir('up'),'up');assert.equal(mirrorDir('right'),'left');
});
test('Reduced motion only ever picks calm modes, and the same twist never repeats back to back',()=>{
 for(let i=0;i<40;i++){const r=()=>i/40;assert.ok(pickCurveball(r,null,true).calm);const a=pickCurveball(r,'zoomies',false);assert.notEqual(a.id,'zoomies');}
});
test('The curveball setting is saved and validated',()=>{
 const backup=v=>JSON.stringify({format:'dawg-arcade-backup',version:1,saves:{settings:{curveballs:v}}});
 assert.ok(parseBackup(backup('off')));assert.throws(()=>parseBackup(backup('sometimes')),/invalid settings/);
});
