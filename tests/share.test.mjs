import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {SITE,shareBase,playLink,profileLink,readPlayLink,readPlayerLink,socialTargets,fmt} from '../dist/share.js';

test('Share links always point at the public site and round-trip',()=>{
 assert.equal(shareBase({hostname:'localhost',origin:'http://localhost:8802',pathname:'/'}),SITE,'local testing still shares public links');
 assert.equal(shareBase({hostname:'dawgcoinai.github.io',origin:'https://dawgcoinai.github.io',pathname:'/'}),'https://dawgcoinai.github.io/');
 assert.equal(playLink('kart'),'https://dawgcoinai.github.io/play/kart/');assert.equal(readPlayLink('?play=pinball'),'pinball');
 assert.equal(readPlayLink('?play=nope'),null);assert.equal(readPlayLink('?play=__proto__'),null);
 assert.equal(profileLink('9935FD73'),'https://dawgcoinai.github.io/invite/?player=9935FD73');assert.equal(readPlayerLink('?player=9935fd73'),'9935FD73');
 for(const bad of ['?player=XYZ','?player=9935FD7','?player=9935FD733','?player=<script>',''])assert.equal(readPlayerLink(bad),null);
});
test('Social targets encode the text and link, and only use known hosts',()=>{
 const t=socialTargets('I scored 1,000 & more 🐶','https://dawgcoinai.github.io/?play=kart');
 assert.deepEqual(t.map(x=>x.name),['X','Facebook','WhatsApp','Telegram','Reddit']);
 for(const {href}of t){const u=new URL(href);assert.ok(['twitter.com','www.facebook.com','wa.me','t.me','www.reddit.com'].includes(u.hostname));assert.ok(!href.includes(' ')&&!href.includes('&more'),'text is encoded');}
 assert.equal(fmt(12340.7),'12,340');assert.equal(fmt(-5),'0');assert.equal(fmt('x'),'0');
});
test('The page has share UI, player cards and link-preview tags with a real image',()=>{
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 for(const id of ['shareDialog','shareImage','shareNative','shareDownload','shareCopy','shareSocials','shareLink','packShare','mazeShare','storyShare','rankProfile','profileDialog','profileFollow','profilePlay','profileBests'])assert.ok(html.includes(`id="${id}"`),id);
 const meta=(attr,name)=>html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]+)"`))?.[1];
 for(const p of ['og:title','og:description','og:url','og:image','og:type'])assert.ok(meta('property',p),p);
 for(const n of ['twitter:card','twitter:title','twitter:image'])assert.ok(meta('name',n),n);
 assert.equal(meta('name','twitter:card'),'summary_large_image');const img=meta('property','og:image');assert.match(img,/^https:\/\/dawgcoinai\.github\.io\//);
 const file=new URL('../dist/'+img.replace('https://dawgcoinai.github.io/',''),import.meta.url);assert.ok(existsSync(file),'preview image ships');const size=statSync(file).size;assert.ok(size>20000&&size<600000,`preview image is ${size} bytes`);
 const buf=readFileSync(file);assert.ok(buf[0]===0xff&&buf[1]===0xd8,'preview image is a JPEG, as og:image:type says');assert.equal(meta('property','og:image:type'),'image/jpeg');
});
