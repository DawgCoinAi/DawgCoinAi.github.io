import {MazeGame,DIRS,FEAT_IDS,RUN_KEYS} from './engine.js';
import {dailyChallenge,seededRandom,localDay} from './mobile-core.js';
const fields=['mode','level','time','score','lives','stats','player','ghosts','loot','lootSpawns','invincible','power','dashCooldown','dashTime','combo','wanted','worldSeed'];
// Added with the district twists; older saves do not carry them, so each is optional on restore.
const extras=['chain','chainTime','bestChain','mult','moveTime','idleTime','escapeCool','corner','twistClock','shutterState','chests','bossHp','feats','run'];
export function snapshotMaze(game,challenge){
 if(!['playing','paused','level'].includes(game.status))return null;
 const out={version:3,status:game.status==='level'?'level':'paused',pellets:[...game.pellets],challenge:game.mode==='daily'?challenge:null,randomState:game.random.getState?.()};
 for(const field of [...fields,...extras])if(game[field]!==undefined)out[field]=game[field];return JSON.parse(JSON.stringify(out));
}
export function restoreMaze(s,today=localDay()){
 try{
  if(!s||s.version!==3||!['classic','rush','daily'].includes(s.mode)||!['paused','level'].includes(s.status))return null;
  const finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
  if(!Number.isInteger(s.level)||!finite(s.level,1,1000)||!finite(s.score,0,1e10)||!Number.isInteger(s.lives)||!finite(s.lives,1,3)||!finite(s.time,0,120))return null;
  if(s.mode==='daily'&&s.challenge?.day!==today)return null;
  const challenge=s.mode==='daily'?dailyChallenge(s.challenge.day):null;
  if(s.worldSeed!==undefined&&(!Number.isInteger(s.worldSeed)||s.worldSeed<0||s.worldSeed>0xffffffff))return null;
  const random=challenge?seededRandom(challenge.seed):s.worldSeed?seededRandom(s.worldSeed):Math.random;
  if(challenge||s.worldSeed){if(!Number.isInteger(s.randomState))return null;random.setState(s.randomState);}
  const g=new MazeGame(s.mode,random,{...challenge,worldSeed:s.worldSeed||0});g.level=s.level;g.loadLevel();
  const validActor=a=>a&&[a.x,a.y,a.tx,a.ty].every(Number.isInteger)&&!g.wall(a.x,a.y)&&!g.wall(a.tx,a.ty)&&Math.abs(a.tx-a.x)+Math.abs(a.ty-a.y)<=1&&finite(a.progress,0,1)&&typeof a.moving==='boolean'&&Object.hasOwn(DIRS,a.dir)&&finite(a.cooldown,-.1,30);
  // Shutter doors and the boss's health come first: they decide which tiles are open and who is on the street.
  if(s.shutterState!==undefined){if(!Array.isArray(s.shutterState)||s.shutterState.length!==g.shutters.length||!s.shutterState.every(v=>v===0||v===1))return null;g.shutterState=[...s.shutterState];}
  if(s.twistClock!==undefined){if(!finite(s.twistClock,0,1e7))return null;g.twistClock=s.twistClock;}
  if(s.bossHp!==undefined&&s.bossHp!==null){if(!Number.isInteger(s.bossHp)||!finite(s.bossHp,0,3))return null;g.bossHp=s.bossHp;}
  if(s.chests!==undefined){const spots=new Set(g.chests.map(c=>c.x+','+c.y));if(!Array.isArray(s.chests)||s.chests.length>g.chests.length||!s.chests.every(c=>c&&spots.has(c.x+','+c.y))||new Set(s.chests.map(c=>c.x+','+c.y)).size!==s.chests.length)return null;g.chests=s.chests.map(c=>({x:c.x,y:c.y}));}
  if(!validActor(s.player)||!Array.isArray(s.ghosts)||s.ghosts.length!==g.ghosts.length||!s.ghosts.every((a,i)=>validActor(a)&&a.type===i&&(a.wp===undefined||Number.isInteger(a.wp)&&finite(a.wp,0,3))&&(a.hp===undefined||Number.isInteger(a.hp)&&finite(a.hp,0,3))))return null;
  if(!Array.isArray(s.pellets)||s.pellets.length>g.total||!s.pellets.every(([k,v])=>g.pellets.get(k)===v)||new Set(s.pellets.map(([k])=>k)).size!==s.pellets.length)return null;
  if(!s.stats||!['dots','caught','dashes','loot','clears'].every(k=>Number.isInteger(s.stats[k])&&finite(s.stats[k],0,1e7)))return null;
  if(!['invincible','power','dashCooldown','dashTime','combo','lootSpawns'].every(k=>finite(s[k],0,k==='combo'?1e6:30))||!Object.hasOwn(DIRS,s.wanted))return null;
  if(s.loot&&(!Number.isInteger(s.loot.x)||!Number.isInteger(s.loot.y)||g.wall(s.loot.x,s.loot.y)||!finite(s.loot.time,0,12)||!finite(s.loot.value,0,1e7)))return null;
  for(const k of ['chain','chainTime','bestChain','mult','moveTime','idleTime','escapeCool','corner'])if(s[k]!==undefined){if(!finite(s[k],0,k==='mult'?5:1e6))return null;g[k]=s[k];}
  if(s.feats!==undefined){if(!Array.isArray(s.feats)||new Set(s.feats).size!==s.feats.length||!s.feats.every(id=>FEAT_IDS.includes(id)&&id.startsWith(s.mode+'.')))return null;g.feats=[...s.feats];}
  if(s.run!==undefined){if(!s.run||typeof s.run!=='object'||Array.isArray(s.run)||!Object.entries(s.run).every(([k,v])=>RUN_KEYS.includes(k)&&finite(v,0,1e7)))return null;Object.assign(g.run,s.run);}
  const fresh=g.ghosts;for(const f of fields)g[f]=s[f];g.ghosts.forEach((a,i)=>{if(fresh[i].boss){a.boss=true;a.hp??=fresh[i].hp;}else{delete a.boss;delete a.hp;}a.wp??=fresh[i].wp;a.mood=typeof a.mood==='string'?a.mood:'idle';if(a.aim&&!(Number.isInteger(a.aim.x)&&Number.isInteger(a.aim.y)))delete a.aim;});g.pellets=new Map(s.pellets);g.status=s.status;g.events=[];
  if(g.status==='level'&&g.pellets.size!==0)return null;
  return{game:g,challenge};
 }catch{return null;}
}
