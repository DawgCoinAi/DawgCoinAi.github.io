import {build} from 'esbuild';
import {mkdir,copyFile,writeFile,readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
await mkdir('dist/vendor',{recursive:true});
// Each vendor is self-contained; app sources remain readable native ESM.
await build({stdin:{contents:"export * from 'three'; export {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'; export {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js'; export {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';",resolveDir:process.cwd()},bundle:true,format:'esm',minify:true,outfile:'dist/vendor/three.js',legalComments:'linked',target:'es2022'});
await build({stdin:{contents:"export {Application,Container,Graphics,Sprite,Texture,Rectangle,Text,BlurFilter} from 'pixi.js';",resolveDir:process.cwd()},bundle:true,format:'esm',minify:true,outfile:'dist/vendor/pixi.js',legalComments:'linked',target:'es2022'});
await copyFile(require.resolve('three').replace(/build\/three\.cjs$/,'LICENSE'),'dist/vendor/THREE-LICENSE.txt');
await copyFile(require.resolve('pixi.js').replace(/lib\/index\.js$/,'LICENSE'),'dist/vendor/PIXI-LICENSE.txt');
await writeFile('dist/vendor/versions.json',JSON.stringify({three:'0.186.1','pixi.js':'8.22.0',esbuild:'0.28.2',generatedBy:'npm run build:graphics'},null,2)+'\n');
const lock=JSON.parse(await readFile('package-lock.json','utf8')),notices=[];
for(const [directory,entry]of Object.entries(lock.packages)){if(!directory||entry.dev||entry.optional)continue;const names=(await readdir(directory)).filter(n=>/^(licen[cs]e|copying|notice)(\.|$)/i.test(n));for(const name of names){try{notices.push('=== '+directory.replace('node_modules/','')+' '+entry.version+' / '+name+' ===\n'+await readFile(directory+'/'+name,'utf8'));}catch{}}}
await writeFile('dist/vendor/THIRD-PARTY-NOTICES.txt',notices.join('\n\n')+'\n');
console.log('Bundled Three.js and PixiJS for offline use.');
