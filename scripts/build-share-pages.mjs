// Share pages: one small static page per game (play/<id>/) and one for invites (invite/), each
// with its own title, description and 1200 × 630 preview image, so a link pasted into a chat
// or social app shows that game rather than the generic arcade card. Link-preview crawlers
// don't run JavaScript, so the tags must be in the HTML. The page forwards players straight
// into the app, keeping any challenge or player code from the link.
//   node scripts/build-share-pages.mjs        (writes dist/play/*/index.html and dist/invite/)
import {mkdir,writeFile} from 'node:fs/promises';
import {GAMES} from '../dist/games.js';
import {BLURBS} from '../dist/shell.js';

export const SITE='https://dawgcoinai.github.io/';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// page: {path, title, ogTitle, description, image, imageAlt, game?}
export function sharePage({path,title,ogTitle,description,image,imageAlt,game=null}){
 const url=SITE+path,up='../'.repeat(path.split('/').filter(Boolean).length),fallback=up+(game?'?play='+game:''),tags=[
  ['name','description',description],['property','og:type','website'],['property','og:site_name','DAWG Arcade'],['property','og:title',ogTitle],['property','og:description',description],['property','og:url',url],
  ['property','og:image',SITE+image],['property','og:image:type','image/jpeg'],['property','og:image:width','1200'],['property','og:image:height','630'],['property','og:image:alt',imageAlt],
  ['name','twitter:card','summary_large_image'],['name','twitter:title',ogTitle],['name','twitter:description',description],['name','twitter:image',SITE+image],['name','theme-color','#090d1a']];
 // Keep ?challenge= and ?player= from the link; otherwise open this page's game.
 const forward=`(function(){var p=new URLSearchParams(location.search);${game?`if(!p.has('challenge')&&!p.has('player'))p.set('play','${game}');`:''}var q=p.toString();location.replace('${up}'+(q?'?'+q:'')+location.hash);})();`;
 return `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><link rel="canonical" href="${url}">
${tags.map(([k,n,v])=>`<meta ${k}="${n}" content="${esc(v)}">`).join('')}
<script>${forward}</script><noscript><meta http-equiv="refresh" content="0;url=${fallback}"></noscript>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07070f;color:#f4f1ff;font:16px system-ui,sans-serif}a{color:#b9ff5e}</style></head>
<body><p>Opening the DAWG Arcade… <a href="${fallback}">Tap here if nothing happens</a>.</p></body></html>
`;}
export const PAGES=[...GAMES.map(g=>({path:`play/${g.id}/`,game:g.id,title:`${g.title} — DAWG Arcade`,ogTitle:`${g.title} · play free on DAWG Arcade`,description:BLURBS[g.id],image:`assets/og/${g.id}.jpg`,imageAlt:`${g.title} on DAWG Arcade`})),
 {path:'invite/',title:'You’re invited — DAWG Arcade',ogTitle:'You’re invited to the DAWG Arcade',description:'Fifteen free neon games, global rankings and friend challenges. Add me and race me.',image:'assets/og/invite.jpg',imageAlt:'You’re invited to the DAWG Arcade'}];

if(process.argv[1]?.endsWith('build-share-pages.mjs')){
 for(const p of PAGES){const dir=new URL(`../dist/${p.path}`,import.meta.url);await mkdir(dir,{recursive:true});await writeFile(new URL('index.html',dir),sharePage(p));}
 console.log('wrote',PAGES.length,'share pages');}
