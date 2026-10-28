import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PAGES,sharePage,SITE} from '../scripts/build-share-pages.mjs';
import {GAME_IDS} from '../dist/games.js';
import {gamePage,profileLink} from '../dist/share.js';
import {challengeLink,readChallenge} from '../dist/rankings.js';

// Width and height from a baseline or progressive JPEG's frame header.
function jpegSize(buf){for(let i=2;i<buf.length;){if(buf[i]!==0xff)return null;const m=buf[i+1],len=buf.readUInt16BE(i+2);if(m>=0xc0&&m<=0xc2)return {h:buf.readUInt16BE(i+5),w:buf.readUInt16BE(i+7)};i+=2+len;}return null;}
const meta=(html,attr,name)=>html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1];

test('Every game and the invite link have an up-to-date share page with its own preview',()=>{
 assert.deepEqual(PAGES.filter(p=>p.game).map(p=>p.game),GAME_IDS);
 for(const p of PAGES){const file=new URL('../dist/'+p.path+'index.html',import.meta.url);assert.ok(fs.existsSync(file),p.path);const html=fs.readFileSync(file,'utf8');
  assert.equal(html,sharePage(p),p.path+' is stale: run node scripts/build-share-pages.mjs');
  assert.equal(meta(html,'property','og:url'),SITE+p.path);assert.ok(meta(html,'property','og:title').includes('DAWG Arcade'));assert.ok(meta(html,'name','description').length>30);
  assert.equal(meta(html,'name','twitter:card'),'summary_large_image');const img=meta(html,'property','og:image');assert.equal(meta(html,'name','twitter:image'),img);
  const buf=fs.readFileSync(new URL('../dist/'+img.slice(SITE.length),import.meta.url));assert.deepEqual(jpegSize(buf),{w:1200,h:630},img+' is 1200 × 630');assert.ok(buf.length<250000,img+' stays small');}
});
test('Share pages forward into the app, keeping challenge and player codes',()=>{
 const kart=fs.readFileSync(new URL('../dist/play/kart/index.html',import.meta.url),'utf8'),script=kart.match(/<script>([^<]+)<\/script>/)[1];
 const run=(href)=>{const loc=new URL(href);let to=null;new Function('location','URLSearchParams',script)({search:loc.search,hash:loc.hash,replace:u=>{to=new URL(u,loc).toString();}},URLSearchParams);return to;};
 assert.equal(run('https://dawgcoinai.github.io/play/kart/'),'https://dawgcoinai.github.io/?play=kart');
 const ch=challengeLink(gamePage('kart'),'kart',6412,'3FA9C210');assert.equal(ch,'https://dawgcoinai.github.io/play/kart/?challenge=kart&score=6412&from=3FA9C210');
 const landed=run(ch);assert.deepEqual(readChallenge(new URL(landed).search),{game:'kart',score:6412,from:'3FA9C210'});assert.ok(!landed.includes('play='),'a challenge opens through its own flow');
 const invite=fs.readFileSync(new URL('../dist/invite/index.html',import.meta.url),'utf8'),inv=invite.match(/<script>([^<]+)<\/script>/)[1];
 let to=null;const loc=new URL(profileLink('9935FD73'));new Function('location','URLSearchParams',inv)({search:loc.search,hash:'',replace:u=>{to=new URL(u,loc).toString();}},URLSearchParams);assert.equal(to,'https://dawgcoinai.github.io/?player=9935FD73');
});
test('The home page carries current, matching preview tags',()=>{
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.match(html,/<title>DAWG Arcade — 18 free neon games<\/title>/);assert.doesNotMatch(html,/Nine ways|Pocket Arcade<\/title>/);
 assert.equal(meta(html,'property','og:title'),meta(html,'name','twitter:title'));assert.equal(meta(html,'property','og:image'),meta(html,'name','twitter:image'));
 assert.match(html,new RegExp(`Eighteen neon games`));assert.equal(GAME_IDS.length,18,'update the copy if the game count changes');
});
