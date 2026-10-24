import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dashPoint,slotZ,firstSlot,jumpLift,fitFov,dashQuality,LANE,DEPTH} from '../dist/dash-3d.js';
import {createQuickGame} from '../dist/pack-checkpoint.js';

test('3D Dash maps engine lanes and depth onto the street without touching game state',()=>{
 assert.deepEqual(dashPoint(1,0),{x:0,z:-0});assert.equal(dashPoint(0,0).x,-LANE);assert.equal(dashPoint(2,0).x,LANE);assert.equal(dashPoint(1,100).z,-100*DEPTH);
 const g=createQuickGame('runner',731);g.start();for(let i=0;i<200;i++){g.lane=g.rows[0].safe;g.tick(.02);for(const row of g.rows)assert.ok(dashPoint(row.safe,row.z).z<=0);}
});
test('Recycled scenery slots keep a stable position for the same world distance',()=>{
 for(const travelled of [0,12.5,99,1234.4]){const a=firstSlot(9,travelled,2);assert.ok(slotZ(a,9,travelled)>0,'first slot sits behind the camera');assert.ok(slotZ(a+3,9,travelled)<=0);
  // The same absolute slot moves toward the camera exactly as far as the run travels.
  assert.equal(slotZ(a,9,travelled+4)-slotZ(a,9,travelled),4);}
});
test('Jump height follows the engine timer and never dips below the street',()=>{
 assert.equal(jumpLift(0),0);for(let j=.85;j>0;j-=.01)assert.ok(jumpLift(j)>=0&&jumpLift(j)<=1.75);assert.ok(Math.abs(jumpLift(.425)-1.75)<1e-9);
});
test('Portrait screens widen the camera so all three lanes stay visible',()=>{
 assert.equal(fitFov(58,16/9),58);assert.ok(fitFov(58,.5)>58);assert.ok(fitFov(58,.1)<=84);
 const hfov=(v,a)=>2*Math.atan(Math.tan(v*Math.PI/360)*a)*180/Math.PI;assert.ok(hfov(fitFov(58,.9),.9)>=63.9);
});
test('Phones and low-memory devices get the light 3D profile',()=>{
 assert.equal(dashQuality({matchMedia:()=>({matches:true}),navigator:{hardwareConcurrency:8,deviceMemory:8}}),'low');
 assert.equal(dashQuality({matchMedia:()=>({matches:false}),navigator:{hardwareConcurrency:12,deviceMemory:16}}),'high');
 assert.equal(dashQuality({matchMedia:()=>({matches:false}),navigator:{hardwareConcurrency:4}}),'low');
});
test('Dash loads the 3D city first, keeps PixiJS and Canvas fallbacks, and ships its stylesheet',()=>{
 const renderer=fs.readFileSync(new URL('../dist/pack-renderer.js',import.meta.url),'utf8'),html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.ok(renderer.indexOf("import('./dash-3d.js')")<renderer.indexOf("import('./dash-presentation.js')"));assert.match(renderer,/failDash\(\)/);assert.match(html,/href="dash-3d.css"/);
});
