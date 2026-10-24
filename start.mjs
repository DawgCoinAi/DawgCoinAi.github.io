#!/usr/bin/env node
// Alternative local launcher: Node.js 18+; no packages to install.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {networkInterfaces} from 'node:os';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
export function createGameServer(root=path.join(HERE,'dist')){
 root=path.resolve(root);
 return http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end('Method not allowed');return;}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname.includes('\0'))throw Error();}catch{res.writeHead(400);res.end('Bad path');return;}
  const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
  try{const info=await stat(file);if(!info.isFile())throw Error();const content=await readFile(file);res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Content-Length':content.length});res.end(req.method==='HEAD'?undefined:content);}
  catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('File not found');}
 });
}
async function main(){
 const args=process.argv.slice(2),i=args.indexOf('--port'),port=i>=0?Number(args[i+1]):8787,lan=args.includes('--lan');
 if(!Number.isInteger(port)||port<1||port>65535){console.error('--port must be between 1 and 65535');process.exitCode=1;return;}
 const server=createGameServer();server.on('error',e=>{console.error(`Cannot start on port ${port}: ${e.message}\nClose another DAWG launcher or use --port 8788.`);process.exitCode=1;});
 server.listen(port,lan?'0.0.0.0':'127.0.0.1',()=>{
  const url=`http://localhost:${port}/`;console.log(`\nDAWG POCKET ARCADE — LOCAL EDITION\n\nOpen ${url}\nKeep this window open while playing. Press Ctrl+C to stop.\n`);
  if(lan){console.log('LAN mode: other devices on your network can open the game.');for(const list of Object.values(networkInterfaces()))for(const a of list||[])if(a.family==='IPv4'&&!a.internal)console.log(`Phone/tablet: http://${a.address}:${port}/`);}
  if(!args.includes('--no-browser')){const command=process.platform==='win32'?['cmd',['/c','start','',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];try{const child=spawn(command[0],command[1],{stdio:'ignore',detached:true});child.on('error',()=>{});child.unref();}catch{}}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
