import {validKennel} from './dawg-career.js';
import {validPassport} from './passport.js';
import {validLivingTrade} from './living-trade.js';
import {validStorySave} from './living-story.js';
import {restoreMaze} from './checkpoint.js';
import {restoreQuick,QUICK_MODES} from './pack-checkpoint.js';
import {validEndings,validAfterHours} from './after-hours-play.js';
import {validChessSave} from './chess-play.js';
import {GAME_IDS,VIEWS,canSwitchView} from './games.js';
import {validArcade} from './unlocks.js';
export const SAVE_PREFIX='dawg-v1-';
export const SAVE_KEYS=['records','profile','settings','sound','daily','trade','mazeRun','packRuns','story','storyEndings','afterHours','chess','passport','kennel','arcade'];
const object=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const count=(n,max=1e12)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
function validValue(key,v){
 if(key==='kennel')return validKennel(v);
 if(key==='passport')return validPassport(v);
 if(key==='sound')return typeof v==='boolean';
 if(key==='records')return object(v)&&Object.entries(v).every(([k,n])=>[...GAME_IDS,'runs'].includes(k)&&(k==='trade'?(n===null||Number.isSafeInteger(n)&&Math.abs(n)<=1e12):count(n)));
 if(key==='profile')return object(v)&&Object.entries(v).every(([k,n])=>k==='theme'?['district','mint','sunset','ice'].includes(n):['rep','dots','caught','loot','clears','dashes','profitable'].includes(k)&&count(n));
 if(key==='settings')return object(v)&&Object.entries(v).every(([k,n])=>k==='controls'?['stick','pad'].includes(n):k==='controlsChosen'?typeof n==='boolean':k==='hand'?['left','right'].includes(n):k==='haptics'?typeof n==='boolean':k==='fx'?['auto','low'].includes(n):k==='curveballs'?['on','off'].includes(n):k==='volume'?typeof n==='number'&&n>=0&&n<=1:k==='cameras'?object(n)&&Object.entries(n).every(([id,view])=>canSwitchView(id)&&VIEWS.includes(view)):false);
 if(key==='daily')return object(v)&&Object.keys(v).length<=100&&Object.entries(v).every(([day,r])=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&object(r)&&count(r.best)&&count(r.medal,3)&&count(r.claimed,3)&&count(r.runs));
 if(key==='trade')return v===null||v?.version===1&&validLivingTrade(v.state);
 if(key==='mazeRun')return v===null||!!restoreMaze(v,v?.challenge?.day);
 if(key==='packRuns')return object(v)&&Object.entries(v).every(([kind,s])=>QUICK_MODES.includes(kind)&&s?.kind===kind&&!!restoreQuick(s));
 if(key==='story')return v===null||validStorySave(v);
 if(key==='arcade')return validArcade(v);
 if(key==='storyEndings')return validEndings(v);
 if(key==='afterHours')return validAfterHours(v);
 if(key==='chess')return validChessSave(v);
 return false;
}
export function parseBackup(text){
 if(typeof text!=='string'||text.length>1_000_000)throw new Error('Choose a DAWG backup smaller than 1 MB.');
 let backup;try{backup=JSON.parse(text);}catch{throw new Error('That file is not valid JSON. Choose an exported DAWG save.');}
 if(backup?.format!=='dawg-arcade-backup'||backup.version!==1||!object(backup.saves)||!Object.keys(backup.saves).length)throw new Error('This is not a supported DAWG backup.');
 for(const [key,value]of Object.entries(backup.saves))if(!SAVE_KEYS.includes(key)||!validValue(key,value))throw new Error('The backup contains invalid '+key+' data. Nothing was imported.');
 return backup;
}
export function makeBackup(storage,date=new Date()){
 // Damaged sections are left out and listed, so one bad key cannot block exporting everything else.
 const saves={},skipped=[];for(const key of SAVE_KEYS){const raw=storage.getItem(SAVE_PREFIX+key);if(raw!==null){let value;try{value=JSON.parse(raw);}catch{skipped.push(key);continue;}if(!validValue(key,value)){skipped.push(key);continue;}saves[key]=value;}}
 if(!Object.keys(saves).length)throw new Error('There is no valid progress to export yet.');
 return {format:'dawg-arcade-backup',version:1,createdAt:date.toISOString(),saves,...(skipped.length?{skipped}:{})};
}
export function applyBackup(storage,backup){
 // Validate before touching storage; roll back a partially completed write on quota errors.
 const safe=parseBackup(JSON.stringify(backup));const before=new Map(SAVE_KEYS.map(k=>[k,storage.getItem(SAVE_PREFIX+k)]));
 try{for(const key of SAVE_KEYS){if(Object.hasOwn(safe.saves,key))storage.setItem(SAVE_PREFIX+key,JSON.stringify(safe.saves[key]));else storage.removeItem(SAVE_PREFIX+key);}}
 catch(error){let restored=true;for(const [key,value]of before){try{if(value===null)storage.removeItem(SAVE_PREFIX+key);else storage.setItem(SAVE_PREFIX+key,value);}catch{restored=false;}}throw new Error(restored?'Import could not be saved. Your previous progress was restored.':'Import failed and storage could not fully roll back. Keep your backup file.');}
 return Object.keys(safe.saves).length;
}
