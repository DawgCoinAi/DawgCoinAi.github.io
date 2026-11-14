import {RunnerGame,validRunnerSnapshot,RUNNER_FIELDS} from './runner-engine.js';
import {freshSeed,snakeGarden} from './world.js';
import {FlappyGame,CrossGame,FLAPPY_FEATS} from './pack-engine.js';
import {SnakeGame,SNAKE_COLS,SNAKE_ROWS,SNAKE_EXTRA,validSnakeExtra} from './snake-engine.js';
import {TurboGame,validTurboSnapshot,TURBO_FIELDS} from './turbo-engine.js';
import {PinballGame,validPinballSnapshot,PINBALL_FIELDS} from './pinball-engine.js';
import {KartGame,validKartSnapshot,KART_FIELDS} from './kart-engine.js';
import {ClimbGame,validClimbSnapshot,CLIMB_FIELDS} from './climb-engine.js';
import {HeistGame,validHeistSnapshot,resumeHeist,HEIST_FIELDS} from './heist-engine.js';
import {DominoGame,validDominoSnapshot,DOMINO_FIELDS} from './domino-engine.js';
import {PaintGame,validPaintSnapshot,resumePaint,PAINT_FIELDS} from './paint-engine.js';
import {BarkGame,validBarkSnapshot,BARK_FIELDS} from './bark-engine.js';
import {NemesisGame,validNemesisSnapshot,NEMESIS_FIELDS} from './nemesis-engine.js';
import {seededRandom} from './mobile-core.js';
export const QUICK_MODES=['flappy','cross','snake','runner','turbo','pinball','kart','climb','heist','domino','paint','bark','nemesis'];
export function createQuickGame(kind,seed=freshSeed()){return kind==='nemesis'?new NemesisGame(seededRandom(seed),seed):kind==='bark'?new BarkGame(seededRandom(seed),seed):kind==='paint'?new PaintGame(seededRandom(seed),seed):kind==='domino'?new DominoGame(seededRandom(seed),seed):kind==='heist'?new HeistGame(seededRandom(seed),seed):kind==='climb'?new ClimbGame(seededRandom(seed),seed):kind==='kart'?new KartGame(seededRandom(seed),seed):kind==='pinball'?new PinballGame(seededRandom(seed),seed):kind==='turbo'?new TurboGame(seededRandom(seed),seed):kind==='runner'?new RunnerGame(seededRandom(seed),seed):kind==='flappy'?new FlappyGame(seededRandom(seed),seed):kind==='snake'?new SnakeGame(seededRandom(seed),seed):new CrossGame(seed);}
const finite=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
const int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
const point=p=>p&&int(p.x,0,SNAKE_COLS-1)&&int(p.y,0,SNAKE_ROWS-1);
const dirs=['up','down','left','right'];
// Fields added after version 1 shipped: absent in old saves, checked when present.
const opt=(n,a,b)=>n===undefined||int(n,a,b);
// A saved feat list: absent in old saves, otherwise known ids with no repeats.
const featList=(list,known)=>list===undefined||Array.isArray(list)&&list.length<=known.length&&new Set(list).size===list.length&&list.every(id=>known.some(f=>f.id===id));
export function snapshotQuick(game,kind){if(!QUICK_MODES.includes(kind)||!['playing','paused'].includes(game?.status))return null;const base={version:1,worldSeed:game.worldSeed||0,kind,score:game.score,time:game.time,randomState:game.random?.getState?.()??0};
 if(kind==='runner')return {...base,...Object.fromEntries(RUNNER_FIELDS.map(k=>[k,JSON.parse(JSON.stringify(game[k]))]))};
 if(kind==='kart')return {...base,...Object.fromEntries(KART_FIELDS.map(k=>[k,JSON.parse(JSON.stringify(game[k]))]))};
 if(kind==='pinball')return {...base,...Object.fromEntries(PINBALL_FIELDS.map(k=>[k,JSON.parse(JSON.stringify(game[k]))]))};
 if(kind==='nemesis')return {...base,...Object.fromEntries(NEMESIS_FIELDS.map(k=>[k,JSON.parse(JSON.stringify(game[k]))]))};
 if(kind==='bark')return {...base,...Object.fromEntries(BARK_FIELDS.map(k=>[k,JSON.parse(JSON.stringify(game[k]))]))};
 if(kind==='paint')return {...base,...Object.fromEntries(PAINT_FIELDS.map(k=>[k,JSON.parse(JSON.stringify(game[k]))]))};
 if(kind==='domino')return {...base,...Object.fromEntries(DOMINO_FIELDS.map(k=>[k,JSON.parse(JSON.stringify(game[k]))]))};
 if(kind==='heist')return {...base,...Object.fromEntries(HEIST_FIELDS.map(k=>[k,JSON.parse(JSON.stringify(game[k]))]))};
 if(kind==='climb')return {...base,...Object.fromEntries(CLIMB_FIELDS.map(k=>[k,JSON.parse(JSON.stringify(game[k]))]))};
 if(kind==='turbo')return {...base,...Object.fromEntries(TURBO_FIELDS.map(k=>[k,JSON.parse(JSON.stringify(game[k]))]))};
 if(kind==='flappy')return {...base,y:game.y,vy:game.vy,gates:game.gates,perfect:game.perfect,streak:game.streak||0,bestStreak:game.bestStreak||0,shield:!!game.shield,ghost:game.ghost||0,obstacles:game.obstacles.map(o=>({...o})),coins:(game.coins||[]).map(c=>({...c})),winds:(game.winds||[]).map(w=>({...w})),gold:game.gold||0,lines:game.lines||0,lineSeq:game.lineSeq||0,boost:game.boost||0,diveCd:game.diveCd||0,threads:game.threads||0,fp:!!game.fp,daily:!!game.daily,feats:[...(game.feats||[])],perfectThreads:game.perfectThreads||0,rushGold:game.rushGold||0,saved:game.saved||0,hurt:!!game.hurt,fpGates:game.fpGates||0};
 if(kind==='cross')return {...base,x:game.x,row:game.row,furthest:game.furthest,coins:game.coins,idle:game.idle,hop:game.hop,from:{...game.from},collected:[...game.collected],close:game.close||0,sweep:game.sweep??-6};
 return {...base,body:game.body.map(p=>({...p})),food:game.food?{...game.food}:null,dir:game.dir,queued:game.queued,queued2:game.queued2??null,steps:game.steps||0,par:game.par||0,streak:game.streak||0,bestStreak:game.bestStreak||0,charged:!!game.charged,smashed:[...(game.smashed||[])],elapsed:game.elapsed,coins:game.coins,...Object.fromEntries(SNAKE_EXTRA.map(k=>[k,JSON.parse(JSON.stringify(game[k]))]))};
}
export function restoreQuick(s){
 if(s?.worldSeed!==undefined&&!int(s.worldSeed,0,0xffffffff))return null;
 if(!s||s.version!==1||!QUICK_MODES.includes(s.kind)||!int(s.score,0,1e9)||!finite(s.time,0,1e7)||!int(s.randomState,0,0xffffffff))return null;
 let valid=false;
 if(s.kind==='runner')valid=validRunnerSnapshot(s);
 if(s.kind==='turbo')valid=validTurboSnapshot(s);
 if(s.kind==='climb')valid=validClimbSnapshot(s);
 if(s.kind==='heist')valid=validHeistSnapshot(s);
 if(s.kind==='domino')valid=validDominoSnapshot(s);
 if(s.kind==='paint')valid=validPaintSnapshot(s);
 if(s.kind==='bark')valid=validBarkSnapshot(s);
 if(s.kind==='nemesis')valid=validNemesisSnapshot(s);
 if(s.kind==='pinball')valid=validPinballSnapshot(s);
 if(s.kind==='kart')valid=validKartSnapshot(s);
 if(s.kind==='flappy')valid=finite(s.y,14,506)&&finite(s.vy,-1000,3000)&&int(s.gates,0,1e7)&&int(s.perfect,0,s.gates)&&opt(s.streak,0,s.perfect)&&opt(s.bestStreak,s.streak||0,s.perfect)&&(s.shield===undefined||typeof s.shield==='boolean')&&(s.ghost===undefined||finite(s.ghost,0,.9))&&Array.isArray(s.obstacles)&&s.obstacles.length>=1&&s.obstacles.length<=5&&s.obstacles.every(o=>o&&finite(o.x,-100,1000)&&finite(o.center,150,395)&&finite(o.gap,154,202)&&o.width===66&&typeof o.passed==='boolean'&&(o.baseCenter===undefined||finite(o.baseCenter,150,395)&&finite(o.amplitude,0,32)&&finite(o.phase,0,6.29)))
  // Added with the jetpack rebuild (gold lines, winds, the dive): absent in older saves, checked when present.
  &&(s.coins===undefined||Array.isArray(s.coins)&&s.coins.length<=60&&s.coins.every(c=>c&&finite(c.x,-100,1200)&&finite(c.y,40,486)&&int(c.line,1,1e7)&&int(c.size,1,6)&&typeof c.got==='boolean'))&&(s.winds===undefined||Array.isArray(s.winds)&&s.winds.length<=8&&s.winds.every(w=>w&&finite(w.x,-100,1200)&&w.w===70&&(w.f===1||w.f===-1)))&&opt(s.gold,0,1e7)&&opt(s.lines,0,1e7)&&opt(s.lineSeq,0,1e7)&&(s.boost===undefined||finite(s.boost,0,.8))&&(s.diveCd===undefined||finite(s.diveCd,0,1.4))&&opt(s.threads,0,s.gates)&&(s.fp===undefined||typeof s.fp==='boolean')&&(s.daily===undefined||typeof s.daily==='boolean')&&(s.hurt===undefined||typeof s.hurt==='boolean')&&featList(s.feats,FLAPPY_FEATS)&&opt(s.perfectThreads,0,s.threads||0)&&opt(s.rushGold,0,s.gold||0)&&opt(s.saved,0,s.gates)&&opt(s.fpGates,0,s.gates);
 if(s.kind==='cross')valid=finite(s.x,-.4,8.4)&&int(s.row,0,1e6)&&int(s.furthest,s.row,1e6)&&s.furthest-s.row<=7&&int(s.coins,0,1e6)&&finite(s.idle,0,20)&&finite(s.hop,0,.13)&&s.from&&finite(s.from.x,-.4,8.4)&&int(s.from.row,0,1e6)&&Array.isArray(s.collected)&&s.collected.length<=s.furthest/5+1&&s.collected.every(r=>int(r,5,s.furthest)&&r%5===0)&&opt(s.close,0,s.furthest)&&(s.sweep===undefined||finite(s.sweep,-6,s.furthest));
 if(s.kind==='snake')valid=Array.isArray(s.body)&&s.body.length>=3&&s.body.length<SNAKE_COLS*SNAKE_ROWS&&s.body.every(point)&&s.body.every((p,i)=>{if(!i)return true;const dx=Math.abs(p.x-s.body[i-1].x),dy=Math.abs(p.y-s.body[i-1].y);return dx+dy===1||dy===0&&dx===SNAKE_COLS-1||dx===0&&dy===SNAKE_ROWS-1;})&&validSnakeExtra(s)&&point(s.food)&&!s.body.some(p=>p.x===s.food.x&&p.y===s.food.y)&&dirs.includes(s.dir)&&(s.queued===null||dirs.includes(s.queued))&&(s.queued2==null||s.queued!==null&&dirs.includes(s.queued2))&&opt(s.steps,0,1e7)&&opt(s.par,0,SNAKE_COLS+SNAKE_ROWS)&&opt(s.streak,0,s.coins)&&opt(s.bestStreak,s.streak||0,s.coins)&&(s.charged===undefined||typeof s.charged==='boolean')&&(s.smashed===undefined||Array.isArray(s.smashed)&&s.smashed.length<=24&&s.smashed.every(i=>int(i,0,23))&&new Set(s.smashed).size===s.smashed.length)&&finite(s.elapsed,0,.5)&&int(s.coins,0,267);
 if(!valid)return null;const rocks=snakeGarden(s.worldSeed||0).filter((_,i)=>!(s.kind==='snake'&&s.smashed?.includes(i)));if(s.kind==='snake'&&(s.smashed||[]).some(i=>i>=snakeGarden(s.worldSeed||0).length))return null;if(s.kind==='snake'&&rocks.some(r=>[...s.body,s.food].some(p=>p.x===r.x&&p.y===r.y)))return null;const g=createQuickGame(s.kind,s.worldSeed||0);g.status='paused';g.score=s.score;g.time=s.time;if(g.random?.setState)g.random.setState(s.randomState);
 if(s.kind==='runner')for(const k of RUNNER_FIELDS)g[k]=JSON.parse(JSON.stringify(s[k]));
 if(s.kind==='kart')for(const k of KART_FIELDS)g[k]=JSON.parse(JSON.stringify(s[k]));
 if(s.kind==='pinball')for(const k of PINBALL_FIELDS)g[k]=JSON.parse(JSON.stringify(s[k]));
 if(s.kind==='nemesis')for(const k of NEMESIS_FIELDS)g[k]=JSON.parse(JSON.stringify(s[k]));
 if(s.kind==='bark')for(const k of BARK_FIELDS)g[k]=JSON.parse(JSON.stringify(s[k]));
 if(s.kind==='paint'){for(const k of PAINT_FIELDS)g[k]=JSON.parse(JSON.stringify(s[k]));resumePaint(g);}
 if(s.kind==='domino'){for(const k of DOMINO_FIELDS)g[k]=JSON.parse(JSON.stringify(s[k]));g.events=[];}
 if(s.kind==='heist'){for(const k of HEIST_FIELDS)g[k]=JSON.parse(JSON.stringify(s[k]));resumeHeist(g);}
 if(s.kind==='climb')for(const k of CLIMB_FIELDS)g[k]=JSON.parse(JSON.stringify(s[k]));
 if(s.kind==='turbo')for(const k of TURBO_FIELDS)g[k]=JSON.parse(JSON.stringify(s[k]));
 if(s.kind==='flappy'){for(const k of ['y','vy','gates','perfect'])g[k]=s[k];g.streak=s.streak||0;g.bestStreak=s.bestStreak||0;g.shield=!!s.shield;g.ghost=s.ghost||0;g.obstacles=s.obstacles.map(o=>({...o}));g.coins=(s.coins||[]).map(c=>({...c}));g.winds=(s.winds||[]).map(w=>({...w}));for(const k of ['gold','lines','lineSeq','boost','diveCd','threads','perfectThreads','rushGold','saved','fpGates'])g[k]=s[k]||0;g.fp=!!s.fp;g.daily=!!s.daily;g.hurt=!!s.hurt;g.feats=[...(s.feats||[])];}
 if(s.kind==='cross'){for(const k of ['x','row','furthest','coins','idle','hop'])g[k]=s[k];g.from={...s.from};g.collected=new Set(s.collected);g.close=s.close||0;g.sweep=s.sweep??Math.max(-6,s.furthest-4);}
 if(s.kind==='snake'){for(const k of ['dir','queued','elapsed','coins'])g[k]=s[k];g.body=s.body.map(p=>({...p}));g.food={...s.food};g.queued2=s.queued2??null;g.steps=s.steps||0;g.par=s.par??0;g.streak=s.streak||0;g.bestStreak=s.bestStreak||0;g.charged=!!s.charged;g.smashed=[...(s.smashed||[])];g.rocks=g.garden.filter((_,i)=>!g.smashed.includes(i));for(const k of SNAKE_EXTRA)if(s[k]!==undefined)g[k]=JSON.parse(JSON.stringify(s[k]));}
 return g;
}
