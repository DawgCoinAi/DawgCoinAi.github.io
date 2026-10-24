import {validFashion} from './dawg-fashion-schema.js';
import {genomeRoot,domainBytes} from './dawg-genome.js';
// Portable character rules. DNA is identity, not a token or proof of ownership.
export const DAWG_LIMIT=24, DNA=/^[a-f0-9]{32}$/;
export const DISCIPLINES=[
 {id:'classic',name:'Maze Munch',target:5000,stat:'agility'}, {id:'rush',name:'60-Second Rush',target:3000,stat:'agility'},
 {id:'daily',name:'Daily Run',target:3000,stat:'focus'}, {id:'trade',name:'Street Hustle',target:20000,stat:'hustle'},
 {id:'flappy',name:'Flappy DAWG',target:300,stat:'agility'}, {id:'cross',name:'DAWG Cross',target:600,stat:'nerve'},
 {id:'snake',name:'Neon Snake',target:600,stat:'nerve'}, {id:'runner',name:'DAWG Dash',target:2500,stat:'focus'},{id:'turbo',name:'Turbo Pup',target:3500,stat:'agility'},{id:'pinball',name:'Neon Pinball',target:30000,stat:'focus'},{id:'kart',name:'Drift Dawgs',target:5000,stat:'nerve'},
 {id:'story',name:'After Hours',target:1200,stat:'charm'}
];
export const ATTRIBUTES=[
 {id:'agility',name:'Agility',icon:'ϟ',effect:'Up to 20% faster maze dash recharge and a 12px wider Flappy perfect zone.'},
 {id:'focus',name:'Focus',icon:'◎',effect:'Up to 2 extra seconds of maze beast mode and 4 extra seconds of Dash magnet.'},
 {id:'nerve',name:'Nerve',icon:'◇',effect:'Up to 5 extra seconds to move in Cross and 10% more thinking time in Snake.'},
 {id:'hustle',name:'Hustle',icon:'$',effect:'Up to $400 extra starting cash in each new Street Hustle campaign.'},
 {id:'charm',name:'Charm',icon:'✦',effect:'Up to 10% higher new Street Hustle order payouts and 20% more After Hours XP.'},
 {id:'appearance',name:'Appearance',icon:'♛',effect:'Unlock advanced fashion at 5, 10, 15, 20 and 25; build your Flex rating.'}
];
export const COATS=[['Fawn','#c89a60','#f3d8a8'],['Midnight','#414a60','#aeb8ca'],['Apricot','#de975d','#ffe0ac'],['Silver','#99a5b8','#e0e6ee'],['Cocoa','#805c54','#d1aaa0'],['Cream','#e5d4aa','#fff2cc'],['Rose','#bc738f','#f7c3d7'],['Mint','#6baca0','#c1efcf'],['Lilac','#9384bd','#d9cefb'],['Ember','#bf6858','#ffd4aa']];
export const OUTFITS=['Varsity jacket','Oversized hoodie','Night suit','Track jacket','Utility vest','Satin bomber','Festival tee','Street jersey'];
export const HATS=['Backwards cap','Bucket hat','Beanie','Headphones','Bandana','Crown','Visor','Bare ears'];
export const GLASSES=['Big frames','Round lenses','Visor shades','Star lenses','Clear eyes'];
export const NECKS=['Gold chain','Silver chain','Silk scarf','Headset','Lucky pendant'];
export const PATTERNS=['Solid','Freckles','Blaze','Tuxedo','Brindle','Socks'];
const FIRST=['Neon','Velvet','Turbo','Lunar','Lil','Disco','Cosmic','Mochi','Riff','Pixel','Honey','Afterparty','Lucky','Jade','Chai','Midnight'];
const LAST=['Bones','Biscuit','Bodega','Barkley','Noodle','Fuzz','Orbit','Paws','Ruckus','Goldie','Waffles','Boogie','Sprout','Nugget','Miso','Rascal'];
const copy=o=>JSON.parse(JSON.stringify(o));
const int=(n,a=0,b=1e12)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
const object=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
export function newDNA(){if(!globalThis.crypto?.getRandomValues)throw new Error('Secure character creation is unavailable in this browser. Try an up-to-date browser.');return [...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function dnaTraits(id,version=1){if(!DNA.test(id))throw new Error('Invalid DAWG DNA.');const b=version===2?domainBytes(id,'traits').slice(0,16):id.match(/../g).map(x=>parseInt(x,16)),rare=b[15],rarity=rare<3?'Mythic':rare<23?'Rare':rare<82?'Standout':'Streetborn';return {coat:b[0]%COATS.length,pattern:b[1]%PATTERNS.length,outfit:b[2]%OUTFITS.length,hat:b[3]%HATS.length,glasses:b[4]%GLASSES.length,neck:b[5]%NECKS.length,hue:(b[6]*256+b[7])%360,shoeHue:(b[8]*256+b[9])%360,build:b[10]%3,ears:b[11]%3,tail:b[12]%3,affinity:ATTRIBUTES[b[13]%5].id,crest:b[14],rarity,bytes:b};}
export const baseTraits=d=>dnaTraits(d.id,d.genome?.version||1);
export function makeDawg(id=newDNA(),now=Date.now(),genomeVersion=2){const t=dnaTraits(id,genomeVersion);return {version:1,...(genomeVersion===2?{genome:{version:2,algorithm:'SHA-256',root:genomeRoot(id)}}:{}),id,name:FIRST[t.bytes[6]%16]+' '+LAST[t.bytes[7]%16],born:now,xp:0,trained:Object.fromEntries(ATTRIBUTES.map(a=>[a.id,0])),records:{},runs:0,medals:[],history:[]};}
export const xpAtLevel=level=>120*(level-1)+30*(level-1)**2;
export function levelOf(d){let n=1;while(n<50&&d.xp>=xpAtLevel(n+1))n++;return n;}
export function statsOf(d){const affinity=baseTraits(d).affinity;return Object.fromEntries(ATTRIBUTES.map(a=>[a.id,1+(a.id===affinity?1:0)+(d.trained[a.id]||0)]));}
export function pointsOf(d){return 3+(levelOf(d)-1)*2-Object.values(d.trained).reduce((a,b)=>a+b,0);}
export function ratingOf(d){return DISCIPLINES.reduce((n,m)=>n+Math.min(1000,Math.floor(Math.max(0,d.records[m.id]||0)/m.target*1000)),0);}
export function rankOf(d){const rating=ratingOf(d);return rating>=8500?'Hall of Fame':rating>=6000?'Night Legend':rating>=3000?'Circuit Pro':rating>=1000?'Street Regular':'New Blood';}
export function league(dawgs,sort='rating'){return [...dawgs].sort((a,b)=>sort==='level'?(levelOf(b)-levelOf(a)||b.xp-a.xp||a.id.localeCompare(b.id)):(ratingOf(b)-ratingOf(a)||b.xp-a.xp||a.id.localeCompare(b.id)));}
export function validDawg(d){if(!object(d)||d.version!==1||(d.genome!==undefined&&(!object(d.genome)||d.genome.version!==2||d.genome.algorithm!=='SHA-256'||d.genome.root!==genomeRootSafe(d.id)))||typeof d.id!=='string'||!DNA.test(d.id)||typeof d.name!=='string'||d.name.trim().length<1||d.name.length>28||/[\u0000-\u001f<>]/.test(d.name)||!int(d.born,0,9e15)||!int(d.xp,0,xpAtLevel(50))||!int(d.runs)||!object(d.trained)||![5,6].includes(Object.keys(d.trained).length)||!Object.keys(d.trained).every(k=>ATTRIBUTES.some(a=>a.id===k))||!ATTRIBUTES.every(a=>a.id==='appearance'&&d.trained.appearance===undefined||int(d.trained[a.id],0,24))||!object(d.records)||!Object.entries(d.records).every(([id,n])=>DISCIPLINES.some(m=>m.id===id)&&int(n,id==='trade'?-1e12:0))||!Array.isArray(d.medals)||d.medals.length>DISCIPLINES.length||new Set(d.medals).size!==d.medals.length||!d.medals.every(id=>DISCIPLINES.some(m=>m.id===id))||!Array.isArray(d.history)||d.history.length>8||!d.history.every(h=>object(h)&&DISCIPLINES.some(m=>m.id===h.mode)&&int(h.score,h.mode==='trade'?-1e12:0)&&int(h.xp,0,1000)&&int(h.at,0,9e15)))return false;return pointsOf(d)>=0&&Object.values(statsOf(d)).every(n=>n<=25)&&(d.fashion===undefined||validFashion(d.fashion,statsOf(d).appearance));}
export function train(d,id){if(!ATTRIBUTES.some(a=>a.id===id)||pointsOf(d)<1||statsOf(d)[id]>=25)return false;d.trained[id]=(d.trained[id]||0)+1;return true;}
export function benefits(stats={},mode='classic'){const n=id=>Math.max(0,Math.min(1,((stats[id]||1)-1)/24));if(mode==='daily')return {dash:0,power:0,perfect:0,idle:0,thinking:0,magnet:0,cash:0,order:0,storyXP:0};return {dash:n('agility')*.2,power:n('focus')*2,perfect:n('agility')*12,idle:n('nerve')*5,thinking:n('nerve')*.1,magnet:n('focus')*4,cash:Math.floor(n('hustle')*400),order:n('charm')*.1,storyXP:n('charm')*.2};}
export function validSession(s,ids){return object(s)&&DNA.test(s.id)&&ids.includes(s.dawgId)&&typeof s.world==='string'&&s.world.length<=80&&object(s.stats)&&[5,6].includes(Object.keys(s.stats).length)&&Object.keys(s.stats).every(k=>ATTRIBUTES.some(a=>a.id===k))&&ATTRIBUTES.every(a=>a.id==='appearance'&&s.stats.appearance===undefined||int(s.stats[a.id],1,25))&&typeof s.claimed==='boolean';}
export function validKennel(k){if(!object(k)||k.version!==1||!Array.isArray(k.dawgs)||k.dawgs.length<1||k.dawgs.length>DAWG_LIMIT||!k.dawgs.every(validDawg))return false;const ids=k.dawgs.map(d=>d.id);return new Set(ids).size===ids.length&&ids.includes(k.activeId)&&object(k.sessions)&&Object.entries(k.sessions).every(([m,s])=>DISCIPLINES.some(d=>d.id===m)&&validSession(s,ids));}
export function makeKennel(d=makeDawg()){return {version:1,activeId:d.id,dawgs:[d],sessions:{}};}
export function adopt(k,d){if(!validDawg(d))throw new Error('This character file is invalid.');if(k.dawgs.some(x=>x.id===d.id))throw new Error('This DAWG is already in your kennel. Importing cannot duplicate its identity.');if(k.dawgs.length>=DAWG_LIMIT)throw new Error('Your 24 kennel slots are full. Keep extra character files for another save.');k.dawgs.push(copy(d));k.activeId=d.id;return k.dawgs.at(-1);}
export function worldKey(mode,g){return mode==='story'?'story-'+(g.episodeSeed??g.episode?.look?.code??'original'):mode==='trade'?'trade-'+g.world.seed:mode+'-'+(g.worldSeed||0);}
export function bindSession(k,mode,g,force=false){if(!DISCIPLINES.some(m=>m.id===mode))return null;const world=worldKey(mode,g);let s=k.sessions[mode];if(force||!s||s.world!==world){const d=k.dawgs.find(d=>d.id===k.activeId);s=k.sessions[mode]={id:newDNA(),dawgId:d.id,world,stats:statsOf(d),claimed:false};}g.dawgId=s.dawgId;g.career=benefits(s.stats,mode);if(['classic','rush'].includes(mode))g.dashRecharge=6*(1-g.career.dash);return s;}
export function finishSession(k,mode,score,meta={},now=Date.now()){const s=k.sessions[mode],m=DISCIPLINES.find(m=>m.id===mode);if(!s||!m||s.claimed||!int(score,mode==='trade'?-1e12:0))return null;const d=k.dawgs.find(d=>d.id===s.dawgId);if(!d)return null;s.claimed=true;const before=levelOf(d),prior=d.records[mode];d.records[mode]=prior===undefined?score:Math.max(prior,score);d.runs++;const eligible=score>0&&(mode!=='trade'||meta.day>=3);let xp=eligible?20+Math.floor(Math.min(1,score/m.target)*180):0;const medal=eligible&&score>=m.target*.25&&!d.medals.includes(mode);if(medal){d.medals.push(mode);xp+=75;}if(mode==='story')xp=Math.round(xp*(1+benefits(s.stats).storyXP));xp=Math.min(xp,xpAtLevel(50)-d.xp);d.xp+=xp;d.history.unshift({mode,score,xp,at:now});d.history=d.history.slice(0,8);return {dawg:d,xp,levels:levelOf(d)-before,medal,newBest:prior===undefined||score>prior};}
export function characterFile(d){if(!validDawg(d))throw new Error('Invalid character.');return {format:'dawg-character',version:1,character:copy(d)};}
export function parseCharacter(text){if(typeof text!=='string'||text.length>50000)throw new Error('Choose a character JSON file smaller than 50 KB.');let v;try{v=JSON.parse(text);}catch{throw new Error('That is not a valid character JSON file.');}if(v?.format!=='dawg-character'||v.version!==1||!validDawg(v.character))throw new Error('This is not a supported DAWG character file.');return copy(v.character);}

function genomeRootSafe(id){try{return genomeRoot(id);}catch{return null;}}
