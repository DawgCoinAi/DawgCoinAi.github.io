import {baseTraits,COATS,OUTFITS,HATS,GLASSES,NECKS,PATTERNS,statsOf} from './dawg-career.js';
import {domainBytes,sha256,genomeReceipt} from './dawg-genome.js';
import {LOOK_RANGES,ITEM_LEVELS,validLook,lookRequirement,validFashion} from './dawg-fashion-schema.js';
export {validLook,lookRequirement,validFashion};
export const CATALOG={
 coat:{name:'Coat',items:COATS.map(c=>c[0])},pattern:{name:'Markings',items:PATTERNS},
 outfit:{name:'Outfit',items:[...OUTFITS,'Holo trench','Royal cape coat','Circuit racer','Armored bomber']},
 hat:{name:'Headwear',items:[...HATS,'Orbit halo','Cyber horns','Shock crown']},
 glasses:{name:'Eyewear',items:[...GLASSES,'Holo shield','Cyber monocle','Legend frames']},
 neck:{name:'Neckwear',items:[...NECKS,'Platinum pendant','DAWG medallion','Nebula collar']},
 shoes:{name:'Footwear',items:['Classic trainers','High tops','Chunky runners','Combat boots','Chrome kicks','Hover boots']},
 back:{name:'Back accessory',items:['None','Crossbody bag','Jetpack','Royal cape','Neon wings','Holo array']},
 aura:{name:'Aura',items:['None','Orbit','Stardust','Ember','Royal energy']},
 finish:{name:'Material',items:['Matte','Satin','Chrome']},
 build:{name:'Build',items:['Compact','Classic','Tall']},ears:{name:'Ears',items:['Floppy','Long','Folded']},tail:{name:'Tail',items:['Curled','Loose','High curl']},
 pose:{name:'Showroom pose',items:['At ease','Hero stance','Strut','Arms out']}
};
export function birthLook(d){const t=baseTraits(d);return {coat:t.coat,pattern:t.pattern,outfit:t.outfit,hat:t.hat,glasses:t.glasses,neck:t.neck,hue:t.hue,accentHue:(t.hue+30)%360,shoeHue:t.shoeHue,build:t.build,ears:t.ears,tail:t.tail,shoes:0,back:0,aura:0,finish:0,pose:0};}
export function lookOf(d){return d.fashion?.equipped||birthLook(d);}
export function visualTraits(d){return {...baseTraits(d),...lookOf(d)};}
export function ensureFashion(d){return d.fashion??= {version:1,equipped:birthLook(d),looks:[],roll:0};}
export function appearanceOf(d){return statsOf(d).appearance;}
export function canWear(d,look){return validLook(look)&&lookRequirement(look)<=appearanceOf(d);}
export function equipLook(d,look){if(!canWear(d,look))return false;ensureFashion(d).equipped={...look};return true;}
export function lookHash(d,look=lookOf(d)){const canonical=Object.keys(LOOK_RANGES).map(k=>k+'='+look[k]).join(';');return sha256('DAWG/LOOK/v1/'+d.id+'/'+canonical);}
export function shuffleLook(d){const f=ensureFashion(d);if(f.roll>=1e9)throw new Error('This character has reached the wardrobe roll limit.');const bytes=domainBytes(d.id,'fashion',++f.roll),look=birthLook(d),appearance=appearanceOf(d);for(const [i,[slot,{items}]]of Object.entries(CATALOG).entries()){const allowed=items.map((_,j)=>j).filter(j=>(ITEM_LEVELS[slot]?.[j]||0)<=appearance);look[slot]=allowed[bytes[i]%allowed.length];}look.hue=(bytes[18]*256+bytes[19])%360;look.accentHue=(look.hue+[0,30,180][bytes[20]%3])%360;look.shoeHue=(bytes[21]*256+bytes[22])%360;return look;}
export function saveLook(d,slot,name,look){if(!Number.isInteger(slot)||slot<0||slot>2||!canWear(d,look)||typeof name!=='string'||!name.trim()||name.length>24||/[\u0000-\u001f<>]/.test(name))return false;const looks=ensureFashion(d).looks;const next={name:name.trim(),look:{...look}};if(slot<looks.length)looks[slot]=next;else if(slot===looks.length)looks.push(next);else return false;return true;}
export function paletteHarmony(look){const delta=Math.abs(look.hue-look.accentHue),angle=Math.min(delta,360-delta);return Math.round(100-Math.min(angle,Math.abs(angle-30),Math.abs(angle-180))/75*100);}
export function flexRating(d){const look=lookOf(d),tiers=Object.entries(ITEM_LEVELS).reduce((sum,[s,v])=>sum+v[look[s]],0);return Math.min(1000,Math.max(0,Math.round(appearanceOf(d)*10+tiers*3+paletteHarmony(look)*1.5+d.medals.length*5+(d.fashion?.looks.length||0)*10)));}
export function fashionReceipt(d,look=lookOf(d)){return {...genomeReceipt(d),lookHash:lookHash(d,look),look:{...look},fashionVersion:1};}
export function previewDawg(d,look){return {...d,fashion:{version:1,equipped:{...look},looks:d.fashion?.looks||[],roll:d.fashion?.roll||0}};}
