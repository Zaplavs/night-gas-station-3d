import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const required=['index.html','src/main.js','src/gamepush.js','public/models/station.glb','public/models/pump.glb','public/models/car.glb','public/models/mystery_van.glb','public/models/worker.glb','public/models/bag.glb','public/models/cleaning_kit.glb'];
for(const file of required){const p=resolve(file),s=await stat(p);if(!s.size)throw new Error(`${file} is empty`);if(file.endsWith('.glb')){const b=await readFile(p);if(b.toString('ascii',0,4)!=='glTF')throw new Error(`${file} is not a GLB`)}}
const html=await readFile(resolve('index.html'),'utf8');if(!html.includes('GAMEPUSH_CONFIG'))throw new Error('GamePush config is missing');
console.log(`Smoke test passed: ${required.length} required files are valid.`);
