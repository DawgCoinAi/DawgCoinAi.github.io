import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {stampJs,stampHtml,stampBuild} from '../scripts/stamp-build.mjs';

test('Deploys version every relative module import, entry script and stylesheet',()=>{
 assert.equal(stampJs(`import {a} from './a.js';import b from "../b.js";const c=await import('./vendor/c.js');`,'v1'),`import {a} from './a.js?v=v1';import b from "../b.js?v=v1";const c=await import('./vendor/c.js?v=v1');`);
 assert.equal(stampJs(`import x from 'three';fetch('./data.json');const s='./not-an-import.js';`,'v1'),`import x from 'three';fetch('./data.json');const s='./not-an-import.js';`);
 assert.equal(stampHtml(`<link rel="stylesheet" href="style.css"><script type="module" src="app.js"></script><link rel="icon" href="assets/dawg.webp"><link href="https://fonts.example/x.css">`,'v1'),
  `<link rel="stylesheet" href="style.css?v=v1"><script type="module" src="app.js?v=v1"></script><link rel="icon" href="assets/dawg.webp"><link href="https://fonts.example/x.css">`);
 assert.equal(stampJs(`from './a.js?v=old'`,'v1'),`from './a.js?v=old'`,'already versioned imports are left alone');
});
test('The real build gets stamped without touching bundled libraries',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dawg-stamp-'));fs.cpSync(new URL('../dist/',import.meta.url),dir,{recursive:true});
 const vendor=fs.readFileSync(path.join(dir,'vendor/three.js'),'utf8');assert.ok(await stampBuild(dir,'abc123')>20);
 assert.equal(fs.readFileSync(path.join(dir,'vendor/three.js'),'utf8'),vendor);assert.match(fs.readFileSync(path.join(dir,'index.html'),'utf8'),/src="app\.js\?v=abc123"/);
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.js')))assert.doesNotMatch(fs.readFileSync(path.join(dir,f),'utf8'),/(from\s*|import\s*\(\s*)['"]\.{1,2}\/[^'"?]+\.js['"]/,f);
 fs.rmSync(dir,{recursive:true,force:true});
});
