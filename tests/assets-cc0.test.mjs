import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {KARTS,BUILDINGS,PROPS} from '../dist/kart-art.js';
import {MODELS,ENV_HDR} from '../dist/three-kit.js';

const dist=p=>new URL('../dist/'+p,import.meta.url);
// The texture a GLB points at (Kenney models share one palette texture per kit).
function glbImages(file){const b=fs.readFileSync(file);assert.equal(b.toString('ascii',0,4),'glTF');const len=b.readUInt32LE(12),json=JSON.parse(b.slice(20,20+len).toString('utf8'));return (json.images||[]).map(i=>i.uri).filter(Boolean);}

test('Every model the games load ships, with its texture and its CC0 license',()=>{
 for(const p of [...KARTS,...BUILDINGS,...Object.values(PROPS)]){const file=dist(MODELS+p);assert.ok(fs.existsSync(file),p);
  for(const uri of glbImages(file))assert.ok(fs.existsSync(new URL(uri,file)),p+' needs '+uri);
  const kit=p.split('/')[0];assert.match(fs.readFileSync(dist(MODELS+kit+'/LICENSE.txt'),'utf8'),/Creative Commons Zero, CC0/,kit+' license');}
 const hdr=fs.readFileSync(dist(ENV_HDR));assert.equal(hdr.toString('ascii',0,10),'#?RADIANCE');
 const credits=fs.readFileSync(dist('assets/CREDITS.md'),'utf8');for(const kit of ['car-kit','racing-kit','city-kit-commercial','city-kit-roads','furniture-kit','mini-market','shanghai_bund'])assert.ok(credits.includes(kit),kit+' credited');
});
test('Every After Hours set model ships with its texture and license',async()=>{
 const {LOCATIONS}=await import('../dist/after-hours.js');const used=new Set();for(const l of Object.values(LOCATIONS)){for(const p of l.set.props)used.add(p[0]);for(const h of Object.values(l.hotspots))if(h.prop)used.add(h.prop);}
 for(const p of used){const file=dist(MODELS+p);assert.ok(fs.existsSync(file),p);for(const uri of glbImages(file))assert.ok(fs.existsSync(new URL(uri,file)),p+' needs '+uri);assert.match(fs.readFileSync(dist(MODELS+p.split('/')[0]+'/LICENSE.txt'),'utf8'),/Creative Commons Zero, CC0/);}
});
test('Shipped art stays within its size budget',()=>{
 const dir=fileURLToPath(dist('assets/models/')),total=fs.readdirSync(dir,{recursive:true}).map(f=>path.join(dir,f)).filter(f=>fs.statSync(f).isFile()).reduce((s,f)=>s+fs.statSync(f).size,0)+fs.statSync(dist(ENV_HDR)).size;assert.ok(total<9e6,`models and environment are ${(total/1e6).toFixed(1)} MB`);
});
