// Play walls: which games are open, and what it takes to open the rest. Pure functions over
// the `arcade` save so the UI, tests and the server (supabase/migrations, arcade_ladder and
// claim_unlocks) agree. A game opens when ANY of its conditions is met, and stays open.
import {GAME_IDS} from './games.js';

export const LADDER={
 classic:null,runner:null,flappy:null,
 snake:{level:3,minutes:20,streak:2},
 rush:{level:4,minutes:30},daily:{level:4,minutes:30},
 cross:{level:5,minutes:45,streak:3},
 trade:{level:6,minutes:60,challenge:'dash100'},
 turbo:{level:7,minutes:90,streak:4},
 pinball:{level:8,minutes:100,streak:3},
 kart:{level:9,minutes:110,streak:3},
 story:{level:10,minutes:120,streak:5}
};
export const CHALLENGES={dash100:{label:'Collect 100 gold in one DAWG Dash run',test:run=>run.game==='runner'&&run.gold>=100}};
export const xpForLevel=n=>n<=1?0:Math.round(150*Math.pow(n-1,1.6));
export function levelOf(xp){let n=1;while(n<99&&xp>=xpForLevel(n+1))n++;return n;}
// XP for one finished run: a little for showing up, more for scoring against the game's target
// and for time spent. The server applies the same caps (400, and 10 per second of run).
export function runXp(score,target,seconds){const span=Math.max(0,Math.floor(seconds));return Math.max(0,Math.min(400,10+span,Math.round(10+Math.min(150,Math.max(0,score)/Math.max(1,target)*150)+Math.min(90,span/2))));}
export const localDay=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
// Longest run of consecutive played days (a past streak still counts toward a wall).
export function streakOf(days){const sorted=[...new Set(days)].sort();let best=0,run=0,prev=null;for(const d of sorted){const t=Date.parse(d+'T00:00:00Z');run=prev!==null&&t-prev===864e5?run+1:1;best=Math.max(best,run);prev=t;}return best;}

export const freshArcade=()=>({version:1,xp:0,seconds:0,days:[],challenges:{},unlocked:{}});
const count=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
export function validArcade(a){
 return !!a&&typeof a==='object'&&a.version===1&&count(a.xp,1e9)&&count(a.seconds,1e9)&&Array.isArray(a.days)&&a.days.length<=400&&a.days.every(d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d))
  &&a.challenges&&typeof a.challenges==='object'&&!Array.isArray(a.challenges)&&Object.entries(a.challenges).every(([k,v])=>k in CHALLENGES&&v===true)
  &&a.unlocked&&typeof a.unlocked==='object'&&!Array.isArray(a.unlocked)&&Object.entries(a.unlocked).every(([k,v])=>GAME_IDS.includes(k)&&['level','time','streak','challenge','played','server'].includes(v));
}
export function statsOf(a){return {xp:a.xp,level:levelOf(a.xp),minutes:Math.floor(a.seconds/60),streak:streakOf(a.days),challenges:a.challenges};}

// Status for one game: open (and why) or what remains, with progress for each route.
export function wallFor(id,arcade,records={}){
 const rule=LADDER[id];if(rule===null||rule===undefined)return {open:true,reason:'start',routes:[]};
 if(arcade.unlocked[id])return {open:true,reason:arcade.unlocked[id],routes:[]};
 // Players from before play walls keep every game they have already played.
 if((records[id]||0)>0)return {open:true,reason:'played',routes:[]};
 const s=statsOf(arcade),routes=[];
 if(rule.level)routes.push({kind:'level',label:`Reach level ${rule.level}`,have:Math.min(arcade.xp,xpForLevel(rule.level)),need:xpForLevel(rule.level),done:s.level>=rule.level,left:Math.max(0,xpForLevel(rule.level)-arcade.xp)+' XP to go'});
 if(rule.minutes)routes.push({kind:'time',label:`Play for ${rule.minutes>=60?rule.minutes/60+' h':rule.minutes+' min'}`,have:s.minutes,need:rule.minutes,done:s.minutes>=rule.minutes,left:Math.max(0,rule.minutes-s.minutes)+' min to go'});
 if(rule.streak)routes.push({kind:'streak',label:`Play ${rule.streak} days in a row`,have:s.streak,need:rule.streak,done:s.streak>=rule.streak,left:Math.max(0,rule.streak-s.streak)+' more days'});
 if(rule.challenge)routes.push({kind:'challenge',label:CHALLENGES[rule.challenge].label,have:s.challenges[rule.challenge]?1:0,need:1,done:!!s.challenges[rule.challenge],left:'not yet'});
 const done=routes.find(r=>r.done);return done?{open:true,reason:done.kind,routes}:{open:false,reason:null,routes};
}
// Marks every newly opened game as unlocked so it stays open. Returns the ids that just opened.
export function settleUnlocks(arcade,records={}){const opened=[];for(const id of Object.keys(LADDER)){if(LADDER[id]===null||arcade.unlocked[id])continue;const w=wallFor(id,arcade,records);if(w.open){arcade.unlocked[id]=w.reason;if(w.reason!=='played')opened.push(id);}}return opened;}
// Folds a finished run into the arcade save. Returns the run's XP.
export function addRun(arcade,run,now=new Date()){
 const xp=runXp(run.score,run.target,run.seconds);arcade.xp=Math.min(1e9,arcade.xp+xp);arcade.seconds=Math.min(1e9,arcade.seconds+Math.max(0,Math.floor(run.seconds)));
 const day=localDay(now);if(!arcade.days.includes(day))arcade.days=[...arcade.days,day].slice(-400);
 for(const [id,c]of Object.entries(CHALLENGES))if(c.test(run))arcade.challenges[id]=true;
 return xp;
}
// Accepts what the server verified (it can only add unlocks, never remove them).
export function mergeServer(arcade,server){for(const [id,reason]of Object.entries(server?.unlocked||{}))if(id in LADDER&&!arcade.unlocked[id])arcade.unlocked[id]='server';return arcade;}
