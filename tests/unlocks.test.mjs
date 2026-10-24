import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LADDER,freshArcade,validArcade,wallFor,settleUnlocks,addRun,mergeServer,levelOf,xpForLevel,runXp,streakOf,localDay} from '../dist/unlocks.js';
import {GAME_IDS} from '../dist/games.js';
import {plan,validSection} from '../dist/cloud.js';
import {parseBackup,SAVE_KEYS} from '../dist/progress-backup.js';

test('Every game has a play-wall rule and three games are open from the start',()=>{
 assert.deepEqual(Object.keys(LADDER).sort(),[...GAME_IDS].sort());const a=freshArcade();
 assert.deepEqual(GAME_IDS.filter(id=>wallFor(id,a).open).sort(),['classic','flappy','runner']);
 assert.ok(validArcade(a));assert.ok(SAVE_KEYS.includes('arcade'));assert.ok(parseBackup(JSON.stringify({format:'dawg-arcade-backup',version:1,saves:{arcade:a}})));
});
test('Levels, XP and streaks follow the published curve',()=>{
 assert.equal(levelOf(0),1);for(let n=2;n<30;n++){assert.equal(levelOf(xpForLevel(n)),n);assert.equal(levelOf(xpForLevel(n)-1),n-1);}
 assert.equal(runXp(0,1000,0),10,'showing up earns the 10 XP floor');assert.ok(runXp(5000,5000,600)<=400);assert.ok(runXp(100,1000,60)<=70,'XP never exceeds 10 + seconds');
 assert.equal(streakOf([]),0);assert.equal(streakOf(['2026-10-01','2026-10-02','2026-10-03','2026-10-07']),3);assert.equal(streakOf(['2026-10-31','2026-11-01']),2,'month boundary');
 assert.equal(localDay(new Date(2026,0,5,23,59)),'2026-01-05');
});
test('Snake opens by time, level or streak, and stays open',()=>{
 const time=freshArcade();time.seconds=20*60;assert.equal(wallFor('snake',time).open,true);
 const lvl=freshArcade();lvl.xp=xpForLevel(3);assert.equal(wallFor('snake',lvl).reason,'level');
 const streak=freshArcade();streak.days=['2026-10-10','2026-10-11'];assert.equal(wallFor('snake',streak).reason,'streak');
 const a=freshArcade();assert.equal(wallFor('snake',a).open,false);assert.equal(wallFor('snake',a).routes.length,3);
 a.seconds=20*60;assert.deepEqual(settleUnlocks(a),['snake']);a.seconds=0;assert.equal(wallFor('snake',a).open,true,'sticky');
});
test('Runs add XP, time, the day and challenges; existing players keep games they played',()=>{
 const a=freshArcade(),now=new Date(2026,9,24,12);addRun(a,{game:'runner',score:900,target:2500,seconds:120,gold:120},now);
 assert.ok(a.xp>0);assert.equal(a.seconds,120);assert.deepEqual(a.days,['2026-10-24']);assert.equal(a.challenges.dash100,true);
 assert.equal(wallFor('trade',a).reason,'challenge');
 const old=freshArcade();assert.equal(wallFor('story',old,{story:1200}).reason,'played');assert.deepEqual(settleUnlocks(old,{story:1200}),[],'grandfathered games are not announced');
 const s=freshArcade();mergeServer(s,{unlocked:{cross:'level',bogus:'x'}});assert.equal(s.unlocked.cross,'server');assert.equal('bogus'in s.unlocked,false);assert.ok(validArcade(s));
});
test('Corrupted arcade saves are rejected',()=>{
 for(const patch of [{xp:-1},{seconds:1.5},{days:['yesterday']},{challenges:{cheat:true}},{unlocked:{snake:'because'}},{version:2}])assert.equal(validArcade({...freshArcade(),...patch}),false);
});
test('Cloud sync keeps the newest copy of each save section',()=>{
 const meta={records:{synced:'2026-10-20T00:00:00Z',local:'2026-10-20T00:00:00Z'},kennel:{synced:'2026-10-20T00:00:00Z',local:'2026-10-23T00:00:00Z'}};
 const remote=[{key:'records',updated_at:'2026-10-22T00:00:00Z',data:{}},{key:'kennel',updated_at:'2026-10-21T00:00:00Z',data:{}},{key:'profile',updated_at:'2026-10-19T00:00:00Z',data:{}}];
 const {pull,push}=plan(meta,remote,['records','kennel','settings']);
 assert.deepEqual(pull.map(r=>r.key).sort(),['profile','records']);assert.deepEqual(push.sort(),['kennel','settings']);
 assert.equal(validSection('records',{classic:10}),true);assert.equal(validSection('records',{classic:-1}),false);
});
test('The database unlock ladder matches the game’s rules',()=>{
 const sql=fs.readFileSync(new URL('../supabase/migrations/20261024000000_arcade.sql',import.meta.url),'utf8');
 const rows=[...sql.matchAll(/\('([a-z]+)', (\d+), (\d+), (null::int|\d+), (null::text|'[a-z0-9]+')\)/g)].map(m=>[m[1],{level:+m[2],minutes:+m[3],streak:m[4].startsWith('null')?undefined:+m[4],challenge:m[5].startsWith('null')?undefined:m[5].slice(1,-1)}]);
 const locked=Object.entries(LADDER).filter(([,r])=>r).map(([id,r])=>[id,{level:r.level,minutes:r.minutes,streak:r.streak,challenge:r.challenge}]);
 assert.deepEqual(Object.fromEntries(rows),Object.fromEntries(locked));
 assert.match(sql,/round\(150 \* power\(greatest\(n - 1, 0\), 1\.6\)\)/,'level curve matches xpForLevel');assert.match(sql,/least\(greatest\(p_xp, 0\), 400, 10 \+ span\)/,'XP caps match runXp');
 assert.match(sql,/enable row level security/);assert.doesNotMatch(sql,/sb_secret|service_role/);
});
test('No secret key or password ships in the web build',()=>{
 for(const file of fs.readdirSync(new URL('../dist/',import.meta.url)).filter(f=>f.endsWith('.js')))assert.doesNotMatch(fs.readFileSync(new URL('../dist/'+file,import.meta.url),'utf8'),/sb_secret_|service_role/,file);
});
