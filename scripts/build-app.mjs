// Deploy-time bundle: the ~40 app modules become one minified entry script plus lazily loaded
// chunks (each 3D renderer, three.js, Supabase), and the stylesheets become one minified file,
// so a first visit makes a handful of requests instead of fifty. Run on the deploy copy only,
// never on the repo (the repo keeps plain modules for development and tests):
//   node scripts/build-app.mjs dist
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const LINKS=/<link rel="stylesheet" href="([^"]+\.css)">\n?/g;
export const stylesheetsOf=html=>[...html.matchAll(LINKS)].map(m=>m[1]);
// Swap the page's stylesheets and entry module for the built files.
export function rewriteHtml(html){let first=true;const out=html.replace(LINKS,()=>{const tag=first?'<link rel="stylesheet" href="app.min.css">':'';first=false;return tag;}).replace('<script type="module" src="app.js">','<script type="module" src="bundle/app.js">');
 if(out===html||!out.includes('bundle/app.js'))throw new Error('index.html did not match the expected stylesheet and script tags');return out;}

export async function buildApp(dir){const {build,transform}=await import('esbuild');
 await build({entryPoints:[path.join(dir,'app.js')],bundle:true,splitting:true,format:'esm',minify:true,target:'es2022',outdir:path.join(dir,'bundle'),entryNames:'app',chunkNames:'chunk-[hash]',legalComments:'eof',logLevel:'warning'});
 const htmlFile=path.join(dir,'index.html'),html=await readFile(htmlFile,'utf8');
 // Stylesheets keep their order and sit at the site root, so their asset urls still resolve.
 const css=(await Promise.all(stylesheetsOf(html).map(f=>readFile(path.join(dir,f),'utf8')))).join('\n');
 const {code}=await transform(css,{loader:'css',minify:true,target:['chrome100','safari15','firefox100']});
 await writeFile(path.join(dir,'app.min.css'),code);await writeFile(htmlFile,rewriteHtml(html));
 return {css:code.length};}

if(import.meta.url===`file://${process.argv[1]?.replace(/\\/g,'/').replace(/^(?=[A-Za-z]:)/,'/')}`||process.argv[1]?.endsWith('build-app.mjs')){
 const dir=process.argv[2];if(!dir){console.error('usage: node scripts/build-app.mjs <site dir>');process.exit(1);}
 const r=await buildApp(dir);console.log('built app bundle and app.min.css ('+r.css+' bytes of CSS)');}
