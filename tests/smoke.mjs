import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CAMPAIGN_SHIFTS, CAMPAIGN_SHIFT_COUNT, EVENT_TYPES, PLAY_MODE, getShiftConfig } from '../src/content/shifts.js';
import { SAVE_VERSION, migrateProgress } from '../src/content/progress.js';
const required=['index.html','src/main.js','src/gamepush.js','src/content/shifts.js','src/content/progress.js','public/models/station.glb','public/models/second_floor.glb','public/models/pump.glb','public/models/car.glb','public/models/mystery_van.glb','public/models/worker.glb','public/models/bag.glb','public/models/cleaning_kit.glb'];
for(const file of required){const p=resolve(file),s=await stat(p);if(!s.size)throw new Error(`${file} is empty`);if(file.endsWith('.glb')){const b=await readFile(p);if(b.toString('ascii',0,4)!=='glTF')throw new Error(`${file} is not a GLB`)}}
const html=await readFile(resolve('index.html'),'utf8');if(!html.includes('GAMEPUSH_CONFIG'))throw new Error('GamePush config is missing');
const durations=[210,225,240,240,255,255,300];
if(CAMPAIGN_SHIFT_COUNT!==7||CAMPAIGN_SHIFTS.some((shift,index)=>shift.duration!==durations[index]))throw new Error('Campaign shift durations are invalid');
for(const shift of CAMPAIGN_SHIFTS){
  if(!(shift.carSpawn.interval[0]>0&&shift.carSpawn.interval[1]>=shift.carSpawn.interval[0]))throw new Error(`Shift ${shift.number} spawn rate is invalid`);
  if(!(shift.queueSize>=1&&shift.customerPatience>0&&shift.orderIntensity>=0&&shift.orderIntensity<=1))throw new Error(`Shift ${shift.number} pressure config is invalid`);
  if(!shift.allowedEvents.length||shift.allowedEvents.some(type=>!EVENT_TYPES.includes(type)))throw new Error(`Shift ${shift.number} event pool is invalid`);
}
const legacy=migrateProgress({money:321,shift:9,rep:4.2,upgrades:{speed:2},tutorial:true,sound:false,best:99});
if(legacy.saveVersion!==SAVE_VERSION||legacy.shift!==7||!legacy.campaignComplete||legacy.money!==321||legacy.upgrades.speed!==2||legacy.sound!==false)throw new Error('Legacy save migration failed');
const endless=migrateProgress({shift:12,playMode:PLAY_MODE.ENDLESS,campaignComplete:true});
if(endless.shift!==12||endless.campaignComplete||getShiftConfig(endless.shift,endless.playMode).mode!==PLAY_MODE.ENDLESS)throw new Error('Endless mode preparation failed');
console.log(`Smoke test passed: ${required.length} required files are valid.`);
