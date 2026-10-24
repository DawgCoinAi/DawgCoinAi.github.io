import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Adventure,parse,clock,validState,VERBS,DOG_WORDS} from '../dist/adventure.js';
import {CONTENT,LOCATIONS,ENDINGS,DEATHS,AWARDS,MAX_SCORE} from '../dist/after-hours.js';

const fresh=(seed=7)=>{const g=new Adventure(CONTENT,null,{seed});g.start();return g;};
// Run commands; an array is [command, dialog answer].
const play=(g,steps)=>{const out=[];for(const st of steps){const [cmd,ans]=Array.isArray(st)?st:[st];out.push(...g.command(cmd));if(ans){assert.ok(g.state.choice,`"${cmd}" should open a conversation`);out.push(...g.answer(ans));}if(g.over)break;}return out;};
const text=lines=>lines.map(l=>l.text).join('\n');

const BAR=['take flyer from jukebox','press coin return','use quarter on jukebox','use phone','use comb on mirror','play pool','talk to rufus',['talk mugsy','whiskey'],'give whiskey to rufus'];
const STORE=['go kwik-sit','buy mints','eat mints','buy hot dog','buy pickup book','buy ticket','scratch ticket'];
const NOVA=['go diner',['talk nova','honest'],'use book on nova','go casino','talk lady luck','play slots',['talk dealer','notebook'],'go diner','give notebook to nova',['talk bean','espresso'],'take umbrella'];
const DJ=['go hotel','press fountain','use key on elevator','use espresso on dj','take robe','wear robe','take sunglasses','press elevator'];
const ROOF=['go bar','go alley','give hot dog to cats','use umbrella on ladder','go bar','go club',['talk brick','moon'],'dance on floor','push lift'];
const BEST=[...BAR,...STORE,...NOVA,'go chapel','take rose',...DJ,...ROOF,'give rose to nova',['talk velma','perform']];

test('The parser understands verbs, phrases, two-noun commands and dog words',()=>{
 assert.deepEqual(parse('give the whiskey to rufus'),{verb:'give',item:'whiskey',target:'rufus',word:'give'});
 assert.deepEqual(parse('Use comb on mirror!'),{verb:'use',item:'comb',target:'mirror',word:'use'});
 assert.equal(parse('pick up the umbrella').verb,'take');assert.equal(parse('pick up the umbrella').target,'umbrella');
 assert.equal(parse('talk to nova').target,'nova');assert.equal(parse('x jukebox').verb,'look');assert.equal(parse('taxi to casino').verb,'go');
 assert.equal(parse('i').verb,'inventory');assert.equal(parse('hint').verb,'hint');assert.equal(parse('look').verb,'look');
 assert.deepEqual(parse('howl at the moon'),{verb:'dog',word:'howl',target:'moon'});assert.equal(parse('roll over').word,'roll over');
 assert.equal(parse('jump off balcony').verb,'push');assert.equal(parse('xyzzy').verb,'unknown');assert.equal(parse('   '),null);
 assert.equal(clock(0),'10:00 PM');assert.equal(clock(120),'12:00 AM');assert.equal(clock(480),'6:00 AM');assert.equal(clock(75),'11:15 PM');
});

test('The best path reaches the Legend ending with a perfect score',()=>{
 const g=fresh();const out=play(g,BEST);
 assert.equal(g.state.ending,'legend',text(out.slice(-6)));assert.equal(g.state.dead,null);
 assert.equal(g.state.score,MAX_SCORE);assert.equal(MAX_SCORE,250);
 const missing=Object.keys(AWARDS).filter(a=>!g.state.awards.includes(a)&&!a.startsWith('ending_'));assert.deepEqual(missing,[],'every non-ending award is reachable in one night');
 assert.ok(g.state.minute<CONTENT.sunrise,'with time to spare');assert.ok(validState(CONTENT,g.save()));
 // The run is deterministic for a seed.
 const h=fresh();play(h,BEST);assert.deepEqual(h.state.awards,g.state.awards);assert.equal(h.state.money,g.state.money);
});

test('Every other ending is reachable',()=>{
 let g=fresh();play(g,[...BAR,...STORE,...NOVA,...DJ,...ROOF,['talk velma','perform']]);assert.equal(g.state.ending,'headliner');
 g=fresh();play(g,[...BAR,...STORE,...NOVA,'go chapel','take rose',...DJ,...ROOF,'give rose to nova',['talk nova','breakfast']]);assert.equal(g.state.ending,'breakfast');
 g=fresh();play(g,['use comb on mirror','go kwik-sit','buy mints','eat mints','go casino','talk lady luck','go chapel','buy license',['talk reverend','how'],['give license to reverend','luck']]);assert.equal(g.state.ending,'luck');
 g=fresh();play(g,['take flyer from jukebox','use comb on mirror','go kwik-sit','buy mints','eat mints','go club',['talk brick','moon'],'push lift',['talk velma','wing']]);assert.equal(g.state.ending,'flop');
 g=fresh();for(let i=0;i<300&&!g.over;i++)g.command('look jukebox');assert.equal(g.state.ending,'alone','sunrise ends the night');assert.ok(g.state.minute>=CONTENT.sunrise);
 assert.match(text(g.command('look')),/night is over/);
 for(const id of Object.keys(ENDINGS))if(ENDINGS[id].bonus)assert.ok(AWARDS['ending_'+id],id);
});

test('Every death is reachable, and Try again rewinds to the last arrival',()=>{
 const cases={hotdog:['go kwik-sit','buy hot dog','eat hot dog'],rocket:[['talk mugsy','rocket'],['talk mugsy','rocket']],cats:['go alley','open dumpster'],
  brick:['go club',['talk brick','collar']],elevator:['go hotel','press elevator',],balcony:[...BAR,'go hotel','use key on elevator','jump off balcony']};
 for(const [id,steps] of Object.entries(cases)){const g=fresh();if(id==='elevator'){play(g,steps);g.answer('red');}else play(g,steps);
  assert.equal(g.state.dead,id,`${id}: ${text(g.lines)}`);assert.ok(DEATHS[id].text.length>40);
  const loc=g.state.loc,money=g.state.money;assert.ok(g.retry());assert.equal(g.state.dead,null);assert.equal(g.state.loc,loc);assert.equal(g.state.deaths,1);assert.ok(g.state.money>=money||id==='hotdog');
  assert.ok(validState(CONTENT,g.save()));}
 assert.equal(fresh().retry(),false,'nothing to retry when alive');
});

test('Gates hold: password, hair, breath, money, keys and the clock',()=>{
 let g=fresh();let out=play(g,['go club',['talk brick','please']]);assert.ok(!g.has('wristband'));assert.match(text(out),/Nope/);
 g=fresh();out=play(g,['take flyer from jukebox','go club',['talk brick','moon']]);assert.match(text(out),/Hair’s wrong/);
 g=fresh();out=play(g,['take flyer from jukebox','use comb on mirror','go club',['talk brick','moon']]);assert.match(text(out),/Mints/);
 g=fresh();out=play(g,['go diner','take umbrella']);assert.ok(!g.has('umbrella'),'umbrella waits until midnight');
 g=fresh();out=play(g,['go hotel','go penthouse']);assert.equal(g.state.loc,'hotel');assert.match(text(out),/key card/);
 g=fresh();out=play(g,['go rooftop']);assert.equal(g.state.loc,'bar');
 g=fresh();g.state.money=3;out=play(g,['go casino']);assert.equal(g.state.loc,'casino');assert.match(text(out),/walk/);assert.equal(g.state.money,3);
 g=fresh();out=play(g,[['talk mugsy','whiskey'],['talk mugsy','whiskey'],['talk mugsy','whiskey']]);assert.equal(g.state.money,32,'one Whiskey Biscuit at a time');
 g=fresh();out=play(g,['go casino',['talk dealer','notebook']]);assert.ok(!g.has('notebook'),'Dice only hands it over once you know whose it is');
});

test('Every hotspot answers every verb, and every dialog option runs, without crashing',()=>{
 for(const [loc,l] of Object.entries(LOCATIONS))for(const [hid,h] of Object.entries(l.hotspots))for(const verb of VERBS.filter(v=>v!=='go')){
  const g=fresh(3);g.state.loc=loc;g.state.minute=250;g.state.flags={novaDate:true};const lines=g.act(verb,hid);
  if(g.state.choice){const o=g.options();assert.ok(o.options.length>0,`${loc}.${hid} ${verb}`);for(const opt of o.options){const k=new Adventure(CONTENT,g.save());k.answer(opt.id);assert.ok(validState(CONTENT,k.save()),`${loc}.${hid} ${verb} ${opt.id}`);}}
  else if(!g.over)assert.ok(lines.length>0,`${loc}.${hid} ${verb} says something`);
  assert.ok(lines.every(x=>typeof x.text==='string'&&x.text.length&&!/undefined|\[object/.test(x.text)),`${loc}.${hid} ${verb}: ${text(lines)}`);}
 const g=fresh();for(const w of DOG_WORDS){const lines=g.command(w);assert.ok(lines.length>1&&!/undefined/.test(text(lines)),w);if(g.over)break;}
 for(const raw of ['xyzzy','look unicorn','take the moon','use spoon on cat','give love to world','go narnia','','hint','score','time','wallet','taxi','i'])assert.ok(fresh().command(raw).every(x=>!/undefined/.test(x.text)),raw);
});

test('Typed nouns prefer what makes sense: your drink over the bartender, the room over your pockets',()=>{
 const g=fresh();play(g,[['talk mugsy','whiskey']]);assert.equal(g.find('whiskey',true).kind,'item');assert.equal(g.find('whiskey').kind,'hotspot');
 play(g,['drink whiskey']);assert.ok(!g.has('whiskey'));
 assert.equal(fresh().find('mirror').id,'mirror');
});

test('Saves round-trip and reject tampering',()=>{
 const g=fresh();play(g,BAR);const s=JSON.parse(JSON.stringify(g.save()));assert.ok(validState(CONTENT,s));
 const k=new Adventure(CONTENT,s);assert.equal(k.state.score,g.state.score);assert.deepEqual(k.state.inv,g.state.inv);
 const bad=[{...s,score:s.score+50},{...s,inv:[...s.inv,'unicorn']},{...s,loc:'moon'},{...s,flags:{hacked:true}},{...s,money:-5},{...s,awards:[...s.awards,'dj']},{...s,v:2},{...s,ending:'secret'},{...s,inv:['comb','comb']},null,'save'];
 for(const b of bad)assert.equal(validState(CONTENT,b),false,JSON.stringify(b)?.slice(0,80));
 assert.notEqual(new Adventure(CONTENT,{...s,score:999}).state.score,999,'a broken save starts a fresh night');
});

test('Story content is well formed and its 3D sets point at real CC0 models',()=>{
 const used=new Set();for(const [loc,l] of Object.entries(LOCATIONS)){assert.ok(l.name&&l.set&&l.label,loc);for(const p of l.set.props)used.add(p[0]);
  for(const [hid,h] of Object.entries(l.hotspots)){assert.ok(h.name&&Array.isArray(h.at)&&h.at.length===2,`${loc}.${hid}`);if(h.prop)used.add(h.prop);}}
 for(const p of used)assert.ok(fs.existsSync(new URL('../dist/assets/models/'+p,import.meta.url)),p);
 assert.equal(Object.keys(LOCATIONS).length,10);assert.ok(Object.keys(CONTENT.items).length>=18);assert.ok(Object.keys(DEATHS).length>=6);assert.ok(Object.keys(ENDINGS).length>=6);
 const flagsUsed=[...fs.readFileSync(new URL('../dist/after-hours.js',import.meta.url),'utf8').matchAll(/flag\('([a-zA-Z]+)'/g)].map(m=>m[1]);for(const f of new Set(flagsUsed))assert.ok(CONTENT.flags.includes(f),f);
});
