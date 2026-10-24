import {MazeGame,DIRS} from './engine.js';
import {dailyChallenge,seededRandom,localDay} from './mobile-core.js';
const fields=['mode','level','time','score','lives','stats','player','ghosts','loot','lootSpawns','invincible','power','dashCooldown','dashTime','combo','wanted','worldSeed'];
export function snapshotMaze(game,challenge){
 if(!['playing','paused','level'].includes(game.status))return null;
 const out={version:3,status:game.status==='level'?'level':'paused',pellets:[...game.pellets],challenge:game.mode==='daily'?challenge:null,randomState:game.random.getState?.()};
 for(const field of fields)out[field]=game[field];return JSON.parse(JSON.stringify(out));
}
export function restoreMaze(s,today=localDay()){
 try{
  if(!s||s.version!==3||!['classic','rush','daily'].includes(s.mode)||!['paused','level'].includes(s.status))return null;
  const finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
  if(!Number.isInteger(s.level)||!finite(s.level,1,1000)||!finite(s.score,0,1e10)||!Number.isInteger(s.lives)||!finite(s.lives,1,3)||!finite(s.time,0,60))return null;
  if(s.mode==='daily'&&s.challenge?.day!==today)return null;
  const challenge=s.mode==='daily'?dailyChallenge(s.challenge.day):null;
  if(s.worldSeed!==undefined&&(!Number.isInteger(s.worldSeed)||s.worldSeed<0||s.worldSeed>0xffffffff))return null;
  const random=challenge?seededRandom(challenge.seed):s.worldSeed?seededRandom(s.worldSeed):Math.random;
  if(challenge||s.worldSeed){if(!Number.isInteger(s.randomState))return null;random.setState(s.randomState);}
  const g=new MazeGame(s.mode,random,{...challenge,worldSeed:s.worldSeed||0});g.level=s.level;g.loadLevel();
  const validActor=a=>a&&[a.x,a.y,a.tx,a.ty].every(Number.isInteger)&&!g.wall(a.x,a.y)&&!g.wall(a.tx,a.ty)&&Math.abs(a.tx-a.x)+Math.abs(a.ty-a.y)<=1&&finite(a.progress,0,1)&&typeof a.moving==='boolean'&&Object.hasOwn(DIRS,a.dir)&&finite(a.cooldown,-.1,30);
  if(!validActor(s.player)||!Array.isArray(s.ghosts)||s.ghosts.length!==4||!s.ghosts.every((a,i)=>validActor(a)&&a.type===i))return null;
  if(!Array.isArray(s.pellets)||s.pellets.length>g.total||!s.pellets.every(([k,v])=>g.pellets.get(k)===v)||new Set(s.pellets.map(([k])=>k)).size!==s.pellets.length)return null;
  if(!s.stats||!['dots','caught','dashes','loot','clears'].every(k=>Number.isInteger(s.stats[k])&&finite(s.stats[k],0,1e7)))return null;
  if(!['invincible','power','dashCooldown','dashTime','combo','lootSpawns'].every(k=>finite(s[k],0,k==='combo'?1e6:30))||!Object.hasOwn(DIRS,s.wanted))return null;
  if(s.loot&&(!Number.isInteger(s.loot.x)||!Number.isInteger(s.loot.y)||g.wall(s.loot.x,s.loot.y)||!finite(s.loot.time,0,12)||!finite(s.loot.value,0,1e7)))return null;
  for(const f of fields)g[f]=s[f];g.pellets=new Map(s.pellets);g.status=s.status;g.events=[];
  if(g.status==='level'&&g.pellets.size!==0)return null;
  return{game:g,challenge};
 }catch{return null;}
}
