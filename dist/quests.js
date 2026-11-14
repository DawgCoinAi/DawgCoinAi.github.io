// Quests: three things to do today and three this week, the same picks for every player (so
// friends can compare), with targets scaled to each player's own bests. Finishing all three daily
// quests keeps a quest streak going. Feats earned inside games are collected here too. Everything
// is a pure function of the saved state, the day and what the player just did; the page only
// calls these and renders the result. Rewards are street rep.
const hash=s=>{let h=0x811c9dc5;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,0x01000193)>>>0;}return h;};
const pick=(list,seed)=>list[seed%list.length];
export const dayKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
// Monday-based week key, local time.
export function weekKey(d=new Date()){const t=new Date(d.getFullYear(),d.getMonth(),d.getDate());t.setDate(t.getDate()-((t.getDay()+6)%7));return 'W'+dayKey(t);}
export const REWARD={featured:40,score:80,third:60,allDaily:100,weekRuns:150,weekBests:200,weekSocial:200,feat:25};
const THIRD=['variety','feat','runs'];
// Today's three. `open` is the list of game ids this player can play; `info(id)` gives {title, best, par}.
export function dailyQuests(day,open,info){const ids=[...open].sort(),s=hash('d'+day),featured=pick(ids,s),rest=ids.filter(id=>id!==featured),scoreGame=rest.length?pick(rest,hash('s'+day)):featured,i=info(scoreGame),
  target=Math.max(50,roundNice(i.best>0?i.best*.7:i.par*.2)),third=pick(THIRD,hash('t'+day));
 return [
  {id:'featured',game:featured,text:`Play today’s featured game: ${info(featured).title}`,reward:REWARD.featured,need:1},
  {id:'score',game:scoreGame,target,text:`Score ${target.toLocaleString('en-US')} or more in ${i.title}`,reward:REWARD.score,need:1},
  third==='variety'?{id:'variety',text:'Play 3 different games',reward:REWARD.third,need:3}:third==='feat'?{id:'feat',text:'Earn a feat in any game',reward:REWARD.third,need:1}:{id:'runs',text:'Finish 5 runs',reward:REWARD.third,need:5}];}
export const weeklyQuests=()=>[
 {id:'weekRuns',text:'Finish 20 runs this week',reward:REWARD.weekRuns,need:20},
 {id:'weekBests',text:'Set a new personal best in 3 different games',reward:REWARD.weekBests,need:3},
 {id:'weekSocial',text:'Challenge, race or share with a friend 3 times',reward:REWARD.weekSocial,need:3}];
const roundNice=n=>{const p=Math.pow(10,Math.max(0,Math.floor(Math.log10(Math.max(1,n)))-1));return Math.round(n/p)*p;};
export const freshQuests=()=>({v:1,day:'',games:[],runs:0,scored:false,feat:false,done:[],week:'',weekRuns:0,weekBests:[],weekSocial:0,weekDone:[],streak:0,lastAll:'',feats:[],rep:0});
// Rolls the state over to a new day or week. A missed day (no "all three" yesterday) ends the streak.
export function rollover(state,now=new Date()){const s={...freshQuests(),...state},day=dayKey(now),week=weekKey(now);
 if(s.day!==day){const y=new Date(now.getFullYear(),now.getMonth(),now.getDate()-1);if(s.lastAll!==dayKey(y)&&s.lastAll!==day)s.streak=0;Object.assign(s,{day,games:[],runs:0,scored:false,feat:false,done:[]});}
 if(s.week!==week)Object.assign(s,{week,weekRuns:0,weekBests:[],weekSocial:0,weekDone:[]});return s;}
// How far along each quest is, for the board: [{...quest, have, done}].
export function progress(state,quests,weekly=weeklyQuests()){const have={featured:q=>state.games.includes(q.game)?1:0,score:()=>state.scored?1:0,variety:()=>state.games.length,feat:()=>state.feat?1:0,runs:()=>state.runs,weekRuns:()=>state.weekRuns,weekBests:()=>state.weekBests.length,weekSocial:()=>state.weekSocial};
 const row=(q,done)=>({...q,have:Math.min(q.need,have[q.id](q)),done:done.includes(q.id)});return {daily:quests.map(q=>row(q,state.done)),weekly:weekly.map(q=>row(q,state.weekDone))};}
// Settles newly finished quests: returns the new state and what was just completed (with rewards).
function settle(s,quests){const out=[],p=progress(s,quests);
 for(const q of p.daily)if(!q.done&&q.have>=q.need){s.done=[...s.done,q.id];s.rep+=q.reward;out.push({id:q.id,text:q.text,reward:q.reward});}
 for(const q of p.weekly)if(!q.done&&q.have>=q.need){s.weekDone=[...s.weekDone,q.id];s.rep+=q.reward;out.push({id:q.id,text:q.text,reward:q.reward,weekly:true});}
 if(quests.length&&quests.every(q=>s.done.includes(q.id))&&s.lastAll!==s.day){s.lastAll=s.day;s.streak+=1;s.rep+=REWARD.allDaily;out.push({id:'all',text:`All three done · quest streak ${s.streak}`,reward:REWARD.allDaily,all:true});}
 return out;}
// A finished run: {game, score, best (a new personal best), feats: [ids earned in the run]}.
export function applyRun(state,run,quests,now=new Date()){const s=rollover(state,now),score=quests.find(q=>q.id==='score'),completed=[];
 s.runs+=1;s.weekRuns+=1;if(!s.games.includes(run.game))s.games=[...s.games,run.game];if(score&&run.game===score.game&&run.score>=score.target)s.scored=true;
 if(run.best&&!s.weekBests.includes(run.game))s.weekBests=[...s.weekBests,run.game];
 for(const id of run.feats||[])completed.push(...applyFeat(s,id));
 completed.push(...settle(s,quests));return {state:s,completed};}
// A feat earned in a game: counted once ever, and it satisfies today's "earn a feat" quest.
function applyFeat(s,id){if(typeof id!=='string'||!/^[a-z]{2,12}\.[a-z0-9_]{1,24}$/.test(id))return [];s.feat=true;if(s.feats.includes(id)||s.feats.length>=2000)return [];s.feats=[...s.feats,id];s.rep+=REWARD.feat;return [{id:'feat:'+id,feat:id,text:'New feat',reward:REWARD.feat}];}
export function applyFeatNow(state,id,quests,now=new Date()){const s=rollover(state,now),completed=applyFeat(s,id);completed.push(...settle(s,quests));return {state:s,completed};}
// Something done with a friend: a challenge sent, a match played, a run shared, a friend added.
export function applySocial(state,quests,now=new Date()){const s=rollover(state,now);s.weekSocial+=1;return {state:s,completed:settle(s,quests)};}
const int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b,strs=(a,max,re)=>Array.isArray(a)&&a.length<=max&&a.every(x=>typeof x==='string'&&re.test(x))&&new Set(a).size===a.length;
export function validQuests(s){return !!s&&s.v===1&&(s.day===''||/^\d{4}-\d\d-\d\d$/.test(s.day))&&strs(s.games,40,/^[a-z]{2,16}$/)&&int(s.runs,0,1e6)&&typeof s.scored==='boolean'&&typeof s.feat==='boolean'&&strs(s.done,5,/^[a-zA-Z]{2,12}$/)
 &&(s.week===''||/^W\d{4}-\d\d-\d\d$/.test(s.week))&&int(s.weekRuns,0,1e6)&&strs(s.weekBests,40,/^[a-z]{2,16}$/)&&int(s.weekSocial,0,1e6)&&strs(s.weekDone,5,/^[a-zA-Z]{2,12}$/)&&int(s.streak,0,1e5)&&(s.lastAll===''||/^\d{4}-\d\d-\d\d$/.test(s.lastAll))&&strs(s.feats,2000,/^[a-z]{2,12}\.[a-z0-9_]{1,24}$/)&&int(s.rep,0,1e9);}
