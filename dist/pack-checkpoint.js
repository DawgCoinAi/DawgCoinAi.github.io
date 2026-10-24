import {RunnerGame,validRunnerSnapshot,RUNNER_FIELDS} from './runner-engine.js';
import {freshSeed,snakeGarden} from './world.js';
import {FlappyGame,CrossGame} from './pack-engine.js';
import {SnakeGame,SNAKE_COLS,SNAKE_ROWS} from './snake-engine.js';
import {TurboGame,validTurboSnapshot,TURBO_FIELDS} from './turbo-engine.js';
import {PinballGame,validPinballSnapshot,PINBALL_FIELDS} from './pinball-engine.js';
import {KartGame,validKartSnapshot,KART_FIELDS} from './kart-engine.js';
import {seededRandom} from './mobile-core.js';
export const QUICK_MODES=['flappy','cross','snake','runner','turbo','pinball','kart'];
export function createQuickGame(kind,seed=freshSeed()){return kind==='kart'?new KartGame(seededRandom(seed),seed):kind==='pinball'?new PinballGame(seededRandom(seed),seed):kind==='turbo'?new TurboGame(seededRandom(seed),seed):kind==='runner'?new RunnerGame(seededRandom(seed),seed):kind==='flappy'?new FlappyGame(seededRandom(seed),seed):kind==='snake'?new SnakeGame(seededRandom(seed),seed):new CrossGame(seed);}
const finite=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
const int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
const point=p=>p&&int(p.x,0,SNAKE_COLS-1)&&int(p.y,0,SNAKE_ROWS-1);
const dirs=['up','down','left','right'];
export function snapshotQuick(game,kind){if(!QUICK_MODES.includes(kind)||!['playing','paused'].includes(game?.status))return null;const base={version:1,worldSeed:game.worldSeed||0,kind,score:game.score,time:game.time,randomState:game.random?.getState?.()??0};
 if(kind==='runner')return {...base,...Object.fromEntries(RUNNER_FIELDS.map(k=>[k,JSON.parse(JSON.stringify(game[k]))]))};
 if(kind==='kart')return {...base,...Object.fromEntries(KART_FIELDS.map(k=>[k,JSON.parse(JSON.stringify(game[k]))]))};
 if(kind==='pinball')return {...base,...Object.fromEntries(PINBALL_FIELDS.map(k=>[k,JSON.parse(JSON.stringify(game[k]))]))};
 if(kind==='turbo')return {...base,...Object.fromEntries(TURBO_FIELDS.map(k=>[k,JSON.parse(JSON.stringify(game[k]))]))};
 if(kind==='flappy')return {...base,y:game.y,vy:game.vy,gates:game.gates,perfect:game.perfect,obstacles:game.obstacles.map(o=>({...o}))};
 if(kind==='cross')return {...base,x:game.x,row:game.row,furthest:game.furthest,coins:game.coins,idle:game.idle,hop:game.hop,from:{...game.from},collected:[...game.collected]};
 return {...base,body:game.body.map(p=>({...p})),food:game.food?{...game.food}:null,dir:game.dir,queued:game.queued,elapsed:game.elapsed,coins:game.coins};
}
export function restoreQuick(s){
 if(s?.worldSeed!==undefined&&!int(s.worldSeed,0,0xffffffff))return null;
 if(!s||s.version!==1||!QUICK_MODES.includes(s.kind)||!int(s.score,0,1e9)||!finite(s.time,0,1e7)||!int(s.randomState,0,0xffffffff))return null;
 let valid=false;
 if(s.kind==='runner')valid=validRunnerSnapshot(s);
 if(s.kind==='turbo')valid=validTurboSnapshot(s);
 if(s.kind==='pinball')valid=validPinballSnapshot(s);
 if(s.kind==='kart')valid=validKartSnapshot(s);
 if(s.kind==='flappy')valid=finite(s.y,14,506)&&finite(s.vy,-1000,3000)&&int(s.gates,0,1e7)&&int(s.perfect,0,s.gates)&&Array.isArray(s.obstacles)&&s.obstacles.length>=1&&s.obstacles.length<=5&&s.obstacles.every(o=>o&&finite(o.x,-100,1000)&&finite(o.center,150,395)&&finite(o.gap,154,202)&&o.width===66&&typeof o.passed==='boolean'&&(o.baseCenter===undefined||finite(o.baseCenter,150,395)&&finite(o.amplitude,0,32)&&finite(o.phase,0,6.29)));
 if(s.kind==='cross')valid=finite(s.x,-.4,8.4)&&int(s.row,0,1e6)&&int(s.furthest,s.row,1e6)&&s.furthest-s.row<=7&&int(s.coins,0,1e6)&&finite(s.idle,0,20)&&finite(s.hop,0,.13)&&s.from&&finite(s.from.x,-.4,8.4)&&int(s.from.row,0,1e6)&&Array.isArray(s.collected)&&s.collected.length<=s.furthest/5+1&&s.collected.every(r=>int(r,5,s.furthest)&&r%5===0);
 if(s.kind==='snake')valid=Array.isArray(s.body)&&s.body.length>=3&&s.body.length<SNAKE_COLS*SNAKE_ROWS&&s.body.every(point)&&new Set(s.body.map(p=>p.x+','+p.y)).size===s.body.length&&s.body.every((p,i)=>!i||Math.abs(p.x-s.body[i-1].x)+Math.abs(p.y-s.body[i-1].y)===1)&&point(s.food)&&!s.body.some(p=>p.x===s.food.x&&p.y===s.food.y)&&dirs.includes(s.dir)&&(s.queued===null||dirs.includes(s.queued))&&finite(s.elapsed,0,.265)&&int(s.coins,0,267);
 if(!valid)return null;const rocks=snakeGarden(s.worldSeed||0);if(s.kind==='snake'&&rocks.some(r=>[...s.body,s.food].some(p=>p.x===r.x&&p.y===r.y)))return null;const g=createQuickGame(s.kind,s.worldSeed||0);g.status='paused';g.score=s.score;g.time=s.time;if(g.random?.setState)g.random.setState(s.randomState);
 if(s.kind==='runner')for(const k of RUNNER_FIELDS)g[k]=JSON.parse(JSON.stringify(s[k]));
 if(s.kind==='kart')for(const k of KART_FIELDS)g[k]=JSON.parse(JSON.stringify(s[k]));
 if(s.kind==='pinball')for(const k of PINBALL_FIELDS)g[k]=JSON.parse(JSON.stringify(s[k]));
 if(s.kind==='turbo')for(const k of TURBO_FIELDS)g[k]=JSON.parse(JSON.stringify(s[k]));
 if(s.kind==='flappy'){for(const k of ['y','vy','gates','perfect'])g[k]=s[k];g.obstacles=s.obstacles.map(o=>({...o}));}
 if(s.kind==='cross'){for(const k of ['x','row','furthest','coins','idle','hop'])g[k]=s[k];g.from={...s.from};g.collected=new Set(s.collected);}
 if(s.kind==='snake'){for(const k of ['dir','queued','elapsed','coins'])g[k]=s[k];g.body=s.body.map(p=>({...p}));g.food={...s.food};}
 return g;
}
