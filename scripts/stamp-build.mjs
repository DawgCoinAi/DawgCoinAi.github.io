// Deploy-time cache busting. GitHub Pages lets browsers keep every file for 10 minutes, which
// can show players an old build or mix old and new modules. This rewrites every relative
// module import, the entry script and the stylesheets to carry ?v=<build>, so each deploy
// is fetched fresh as one consistent set. Run on the deploy copy only, never on the repo:
//   node scripts/stamp-build.mjs dist <build-id>
import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const MODULE=/(\bfrom\s*|\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"?#]+\.js)\2/g;
const HTML=/(<script\b[^>]*\bsrc=|<link\b[^>]*\bhref=)(["'])((?!https?:|\/\/|data:)[^"'?#]+\.(?:js|css))\2/g;
export const stampJs=(source,v)=>source.replace(MODULE,(_,head,q,url)=>`${head}${q}${url}?v=${v}${q}`);
export const stampHtml=(source,v)=>source.replace(HTML,(_,head,q,url)=>`${head}${q}${url}?v=${v}${q}`);

export async function stampBuild(dir,version){
 const v=encodeURIComponent(String(version).slice(0,12));let files=0;
 for(const entry of await readdir(dir,{recursive:true,withFileTypes:true})){
  if(!entry.isFile())continue;const file=path.join(entry.parentPath??entry.path,entry.name),ext=path.extname(file);
  // Bundled libraries are self-contained; only our own modules and pages are rewritten.
  if(path.relative(dir,file).split(path.sep)[0]==='vendor')continue;
  if(ext!=='.js'&&ext!=='.html')continue;const before=await readFile(file,'utf8'),after=ext==='.js'?stampJs(before,v):stampHtml(before,v);
  if(after!==before){await writeFile(file,after);files++;}
 }
 return files;
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'))){
 const [dir='dist',version=Date.now().toString(36)]=process.argv.slice(2);
 console.log(`Stamped ${await stampBuild(dir,version)} files with build ${version}.`);
}
