#!/usr/bin/env node
// Usage: node scripts/export-dawg.mjs character.json DAWG.glb [--legacy]
import fs from 'node:fs/promises';import {parseCharacter} from '../dist/dawg-career.js';import {installFileReader} from './node-file-reader.mjs';
const [source,destination,option]=process.argv.slice(2);
if(!source||!destination){console.error('Usage: node scripts/export-dawg.mjs character.json DAWG.glb [--legacy]');process.exitCode=1;}else{try{const d=parseCharacter(await fs.readFile(source,'utf8'));installFileReader();const bytes=option==='--legacy'?(await import('../dist/dawg-model.js')).exportGLB(d):await(await import('../dist/dawg-graphics-model.js')).exportModernGLB(d);await fs.writeFile(destination,bytes);console.log('Exported '+d.name+' to '+destination);}catch(e){console.error(e.message);process.exitCode=1;}}
