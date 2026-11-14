// BITE NIGHT moments for DAWG Chat (see CHAT-CONTRACT): a posted finisher is a tiny flat recipe
// (who, which move, where, a seed) and this module re-stages it in a chat card from the same
// choreography the game uses. Light on load: only the pure roster is imported up front; the 3D
// scene and its assets are fetched when someone presses WATCH.
import {FIGHTER_IDS,STAGE_IDS,fighter,finisher,stageOf,TITLE} from './fight-roster.js';

export const MOMENT_KINDS=['finisher'];
const LOOK_KEYS=['coat','pattern','outfit','hat','glasses','neck','hue','accentHue','shoeHue','build','ears','tail','shoes','back','aura','finish','pose'];
const LOOK_MAX=[9,5,11,10,7,7,359,359,359,2,2,2,5,5,4,2,3];
const validLookArray=a=>Array.isArray(a)&&a.length===LOOK_KEYS.length&&a.every((n,i)=>Number.isInteger(n)&&n>=0&&n<=LOOK_MAX[i]);
const KEYS=['v','winner','loser','move','stage','seed','side','look'];
/** Strict check of a finisher recipe: every id must be real and the move must belong to the winner or the stage. */
export function validMoment(d){
 if(!d||typeof d!=='object'||Array.isArray(d)||d.v!==1)return false;
 if(Object.keys(d).some(k=>!KEYS.includes(k)))return false;
 if(!FIGHTER_IDS.includes(d.winner)||!FIGHTER_IDS.includes(d.loser)||!STAGE_IDS.includes(d.stage))return false;
 const f=typeof d.move==='string'?finisher(d.move):null;if(!f)return false;
 if(f.kind==='curtain'&&f.owner!==d.winner)return false;if(f.kind==='dive'&&f.stage!==d.stage)return false;
 if(!Number.isInteger(d.seed)||d.seed<0||d.seed>0xffffffff)return false;
 if(d.side!==undefined&&d.side!==0&&d.side!==1)return false;
 if(d.look!==undefined&&(!validLookArray(d.look)||(d.winner!=='you'&&d.loser!=='you')))return false;
 return true;}
/** The recipe for the finisher that just ended a match (flat JSON, well under the chat's limits). */
export function momentFor(g,dawg){const r=g.result;if(!r?.finisher)return null;const d={v:1,winner:g.f[r.winner].id,loser:g.f[r.loser].id,move:r.finisher,stage:g.stage,seed:g.seed>>>0,side:r.winner};
 const look=dawg?.fashion?.equipped;if((d.winner==='you'||d.loser==='you')&&look){const a=LOOK_KEYS.map(k=>look[k]|0);if(validLookArray(a))d.look=a;}return validMoment(d)?d:null;}
/** The card title and text for a moment (plain text, within the chat's lengths). */
export function momentText(d,{perfect=false,round=0}={}){const W=fighter(d.winner),L=fighter(d.loser),f=finisher(d.move);
 return {title:`${W.name} finished ${L.name}`.slice(0,60),text:[f.name,stageOf(d.stage).name,perfect?'untouched':'',round?'round '+round:''].filter(Boolean).join(' · ').slice(0,120)};}
/** A still for the card before it is played: both names, the move and the stage. */
export function momentPoster(d){if(!validMoment(d)||typeof document==='undefined')return null;const W=fighter(d.winner),L=fighter(d.loser),f=finisher(d.move),el=document.createElement('canvas');el.width=480;el.height=270;const c=el.getContext('2d');
 const g=c.createLinearGradient(0,0,480,270);g.addColorStop(0,'#0b0716');g.addColorStop(1,'#1a0a2e');c.fillStyle=g;c.fillRect(0,0,480,270);
 const glow=(x,col)=>{const r=c.createRadialGradient(x,150,10,x,150,190);r.addColorStop(0,col+'aa');r.addColorStop(1,col+'00');c.fillStyle=r;c.fillRect(0,0,480,270);};glow(110,W.color);glow(370,L.color);
 const head=(x,col,up)=>{c.fillStyle=col;c.beginPath();c.arc(x,150,46,0,7);c.fill();for(const s of [-1,1]){c.beginPath();c.ellipse(x+s*40,up?112:150,13,24,s*.4,0,7);c.fill();}c.fillStyle='#fff';for(const s of [-1,1]){c.beginPath();c.arc(x+s*17,142,12,0,7);c.fill();}c.fillStyle='#111';for(const s of [-1,1]){c.beginPath();if(up)c.arc(x+s*17,143,6,0,7);else{c.fillRect(x+s*17-8,140,16,3);}c.fill();}c.fillStyle='#222';c.beginPath();c.arc(x,164,8,0,7);c.fill();};
 head(110,W.color,true);c.save();c.translate(370,150);c.rotate(.5);c.translate(-370,-150);head(370,L.color,false);c.restore();
 c.textAlign='center';c.fillStyle='#fff';c.font='900 15px system-ui,sans-serif';c.fillText(W.name,110,222);c.fillText(L.name,370,222);c.font='900 30px system-ui,sans-serif';c.fillStyle='#ffe45e';c.shadowColor='#ff5fc8';c.shadowBlur=14;c.fillText(f.name.toUpperCase(),240,52);c.shadowBlur=0;
 c.font='800 12px system-ui,sans-serif';c.fillStyle='#ffffffb0';c.fillText(`${TITLE} · ${stageOf(d.stage).name}`.toUpperCase(),240,76);c.font='900 26px system-ui,sans-serif';c.fillStyle='#ffffff';c.fillText('▶',240,160);return el;}
/** Play a posted finisher inside `host` (about 16:9, from 280 px wide). Loops until stop(). */
export async function playMoment(host,d,{quality,reduced=false,sound=null}={}){
 if(!validMoment(d)||!host)return {stop(){}};
 if(typeof document!=='undefined'&&!document.querySelector('link[href*="fight.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href=new URL('./fight.css',import.meta.url).href;document.head.append(l);}
 const box=document.createElement('div');box.className='fight-moment';box.style.cssText='position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:inherit;background:#07050e';host.append(box);
 let stopped=false,raf=0,scene=null;const stop=()=>{stopped=true;cancelAnimationFrame(raf);try{scene?.dispose();}catch{}box.remove();};
 try{
  const [{FightScene},{npcDawg},{previewDawg}]=await Promise.all([import('./fight-3d.js'),import('./npc-dawg.js'),import('./dawg-fashion.js')]);if(stopped)return {stop(){}};
  let dawg=null;if(d.look){try{dawg=previewDawg(npcDawg('Contender'),Object.fromEntries(LOOK_KEYS.map((k,i)=>[k,d.look[i]])));}catch{dawg=null;}}
  scene=new FightScene(box,{quality:quality||'low',sound,viewer:true,onFailure:()=>stop()});scene.init();scene.reduced=reduced;scene.setStage(d.stage);
  const left=d.side===1?d.loser:d.winner,right=d.side===1?d.winner:d.loser,win=d.side===1?1:0;scene.setFighters(left,right,dawg);scene.rigs[0].holder.position.x=-1.1;scene.rigs[1].holder.position.x=1.1;
  scene.playCine(d.move,{winner:win,seed:d.seed||1,loop:true,ox:0});scene.resultLoop=true;
  let last=0;const loop=now=>{if(stopped)return;const dt=Math.min(.05,last?(now-last)/1000:0);last=now;try{scene.time+=dt;scene.director.update(dt);scene.common(dt,true);}catch{stop();return;}raf=requestAnimationFrame(loop);};raf=requestAnimationFrame(loop);
 }catch{stop();return {stop(){}};}
 return {stop};}
