#!/usr/bin/env node
// Development check: npm ci, then npm run validate:assets.
import validator from 'gltf-validator';
import {makeDawg,xpAtLevel} from '../dist/dawg-career.js';
import {birthLook,previewDawg} from '../dist/dawg-fashion.js';
import {exportModernGLB} from '../dist/dawg-graphics-model.js';
import {installFileReader} from './node-file-reader.mjs';
installFileReader();let errors=0,warnings=0;const messages=new Map();
for(let i=0;i<12;i++){const d=makeDawg(i.toString(16).padStart(32,'0'),1700000000000);d.xp=xpAtLevel(30);const look={...birthLook(d),outfit:i,hat:i%11,glasses:i%8,neck:i%8,shoes:i%6,back:i%6,aura:i%5,finish:i%3};const bytes=await exportModernGLB(previewDawg(d,look)),report=await validator.validateBytes(bytes,{maxIssues:1000});errors+=report.issues.numErrors;warnings+=report.issues.numWarnings;for(const m of report.issues.messages)if(m.severity<=1)messages.set(m.code,{code:m.code,severity:m.severity,message:m.message,pointer:m.pointer});}
console.log(JSON.stringify({models:12,errors,warnings,issues:[...messages.values()]},null,2));if(errors)process.exitCode=1;
