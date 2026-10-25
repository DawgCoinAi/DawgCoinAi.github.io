// Stable characters for story scenes: a name always maps to the same DAWG, so Nova always looks
// like Nova and your Street Hustle contact looks the same every night.
import {makeDawg} from './dawg-career.js';

// A 32-hex DNA for a character name (FNV-1a over the name and a counter).
export function dnaFor(name){let h=0x811c9dc5;const out=[];for(let i=0;i<16;i++){for(const ch of name+'#'+i){h^=ch.charCodeAt(0);h=Math.imul(h,0x01000193)>>>0;}out.push((h>>>((i%4)*8))&255);}return out.map(x=>x.toString(16).padStart(2,'0')).join('');}
export const npcDawg=name=>{const d=makeDawg(dnaFor(name),0);d.name=name;return d;};
