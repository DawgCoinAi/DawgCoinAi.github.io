export const LOOK_RANGES={coat:9,pattern:5,outfit:11,hat:10,glasses:7,neck:7,hue:359,accentHue:359,shoeHue:359,build:2,ears:2,tail:2,shoes:5,back:5,aura:4,finish:2,pose:3};
export const ITEM_LEVELS={outfit:[0,0,0,0,0,0,0,0,5,10,15,20],hat:[0,0,0,0,0,0,0,0,10,15,25],glasses:[0,0,0,0,0,5,10,20],neck:[0,0,0,0,0,5,10,20],shoes:[0,0,5,10,15,25],back:[0,0,10,5,20,25],aura:[0,5,10,15,25],finish:[0,0,15]};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function validLook(l){return object(l)&&Object.keys(l).length===Object.keys(LOOK_RANGES).length&&Object.entries(LOOK_RANGES).every(([k,max])=>Number.isInteger(l[k])&&l[k]>=0&&l[k]<=max);}
export function lookRequirement(l){return Math.max(0,...Object.entries(ITEM_LEVELS).map(([slot,levels])=>levels[l[slot]]??99));}
export function validFashion(f,appearance=25){return object(f)&&f.version===1&&Number.isSafeInteger(f.roll)&&f.roll>=0&&f.roll<=1e9&&validLook(f.equipped)&&lookRequirement(f.equipped)<=appearance&&Array.isArray(f.looks)&&f.looks.length<=3&&f.looks.every(s=>object(s)&&typeof s.name==='string'&&s.name.trim().length>0&&s.name.length<=24&&!/[\u0000-\u001f<>]/.test(s.name)&&validLook(s.look));}
