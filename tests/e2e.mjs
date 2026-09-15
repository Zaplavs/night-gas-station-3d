import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--use-angle=swiftshader','--enable-webgl']});
const baseUrl=process.env.TEST_URL||'http://127.0.0.1:4173';
const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!/favicon|fonts\.google/i.test(r.url()))errors.push(`${r.status()} ${r.url()}`)});
await page.goto(baseUrl,{waitUntil:'networkidle'});
await page.locator('#menu:not(.hidden)').waitFor({timeout:30000});
await page.click('#new-btn');await page.locator('#tutorial:not(.hidden)').waitFor();await page.click('#tutorial-start');
await page.locator('#hud:not(.hidden)').waitFor();
await page.waitForFunction(()=>window.__nightStation?.cars?.some(c=>c.status==='waiting'),null,{timeout:45000});
// Старые сценарии написаны про легковые без магазина: пока тест не попросит другого,
// поток состоит из них — иначе фура уедет мимо очереди, а машина не уедет без покупателя.
await page.evaluate(()=>{const g=window.__nightStation,start=g.startShift.bind(g);
  g.startShift=(...args)=>{start(...args);g.shiftConfig={...g.shiftConfig,fleet:g.testFleet||{car:1},orderIntensity:g.testOrders??0}};
  g.shiftConfig={...g.shiftConfig,fleet:{car:1},orderIntensity:0}});
const debug=await page.evaluate(()=>({mode:window.__nightStation?.mode,elapsed:window.__nightStation?.elapsed,spawn:window.__nightStation?.spawnTimer,cars:window.__nightStation?.cars?.map(c=>({status:c.status,t:c.t,z:c.group.position.z})),jobs:window.__nightStation?.jobs?.map(j=>window.__nightStation.jobLabel(j))}));
const canvas=await page.locator('#scene').boundingBox();if(!canvas||canvas.width<1000)throw new Error('WebGL canvas was not rendered');
const checks=await page.evaluate(()=>{const g=window.__nightStation,before=g.player.position.z;g.keys.KeyW=true;g.updatePlayer(.1);g.keys.KeyW=false;const carNames=[],vanNames=[],canopyCaps=[],shelves=[];g.assets.car.traverse(o=>carNames.push(o.name));g.assets.mystery_van.traverse(o=>vanNames.push(o.name));g.station.traverse(o=>{if(o.isMesh&&o.name.startsWith('CanopyLight')&&o.visible)canopyCaps.push(o.name);if(o.isMesh&&o.name.startsWith('ShelfFrame'))shelves.push(o)});const glass=g.assets.car.getObjectByName('FrontWindow'),trash=g.station.getObjectByName('TrashBin'),landmarks=['CoffeeMachine','FoodStation','GrillBase','FridgeBack','FuseFrame','LostAndFound'].map(name=>g.station.getObjectByName(name)),reachable=o=>{if(!o)return false;const p=o.position;for(let r=.7;r<2;r+=.2)for(let i=0;i<20;i++){const a=i/20*Math.PI*2;if(!g.isBlocked(p.x+Math.cos(a)*r,p.z+Math.sin(a)*r))return true}return false};return{firstPerson:!g.player.visible&&Math.abs(g.camera.position.x-g.player.position.x)<.01&&Math.abs(g.camera.position.z-g.player.position.z)<.01,forward:g.player.position.z<before,counter:g.isBlocked(0,1.15)&&!g.isBlocked(0,-1),hall:!g.isBlocked(-1.85,-.28)&&!g.isBlocked(1.85,-1.24),shopStations:g.isBlocked(-3.95,4.45)&&g.isBlocked(4.05,4.45),pump:g.isBlocked(-2.55,-7.4),entrance:!g.isBlocked(0,-2.2)&&!g.isBlocked(0,-3),binInside:!!trash&&trash.position.x+.43<4.44&&trash.position.z-.43>-2.5,carSolid:g.cars.length>0&&g.isBlocked(g.cars[0].group.position.x,g.cars[0].group.position.z),carLane:g.cars.length>0&&Math.abs(g.cars[0].target.x-g.cars[0].pump.x)>1.5,driverVisible:carNames.includes('DriverHead')&&!!glass?.material?.transparent&&glass.material.opacity<.8,vanEmpty:vanNames.includes('VanEmptySeat')&&!vanNames.some(n=>n.startsWith('Driver')),allCanopyCaps:canopyCaps.length===3,thirdBay:g.pumps.length===3&&g.isBlocked(-6.6,-7.4)&&!g.isBlocked(-8.9,-7.4),clearInterior:shelves.length===2&&shelves.every(o=>o.position.z>4)&&landmarks.every(Boolean),landmarksLabeled:g.landmarkLabels.length>=7&&g.landmarkLabels.every(o=>o.visible),landmarksReachable:landmarks.every(reachable),secondFloor:!!g.secondFloor&&!!g.secondFloor.getObjectByName('UpperFloor')&&!!g.secondFloor.getObjectByName('StairStep14')&&g.upperDoorParts.length===3}});if(Object.values(checks).some(v=>!v))throw new Error(`First-person/collision/model checks failed: ${JSON.stringify(checks)}; ${JSON.stringify(debug)}`);
const music=await page.evaluate(async()=>{const {AudioSystem}=await import('/src/audio.js'),a=new AudioSystem();a.ensure();const result={procedural:!!a.music&&a.music.voices.length===5&&a.music.chords.length===4,melodic:a.music?.melodies.every(notes=>notes.length===3),soundscape:!!a.ambience?.wind&&!!a.music?.reverb&&!!a.music?.filterLfo&&!!a.music?.delay,louder:a.music?.bus.gain.value>.25,noExternalTrack:!a.music?.audioElement,muteWorks:false,volumeWorks:false};a.setMusicVolume(.35);result.volumeWorks=a.musicVolume===.35&&!!a.music.lfoGain;a.setMuted(true);result.muteWorks=a.muted===true;clearInterval(a.musicTimer);await a.ctx?.close();return result});
if(Object.values(music).some(v=>!v))throw new Error(`Procedural ambient music failed: ${JSON.stringify(music)}`);
const musicControl=await page.evaluate(()=>{const g=window.__nightStation,slider=document.querySelector('#music-volume'),label=document.querySelector('#music-volume-value');slider.value='65';slider.dispatchEvent(new Event('input'));const changed=g.state.musicVolume===65&&label.textContent==='65%';slider.value='80';slider.dispatchEvent(new Event('input'));return{present:slider.type==='range',changed,restored:g.state.musicVolume===80}});
if(Object.values(musicControl).some(v=>!v))throw new Error(`Music volume control failed: ${JSON.stringify(musicControl)}`);
const doors=await page.evaluate(()=>{const g=window.__nightStation;
  g.player.position.set(3,.26,1.5);for(let i=0;i<30;i++)g.updateDoors(.05);
  const closed=g.doorOpen===0&&g.isBlocked(0,-2.65),closedCenters=g.doorGlass.map(o=>o.position.x);
  g.player.position.set(0,.26,-4.1);for(let i=0;i<30;i++)g.updateDoors(.05);
  const opensOutside=g.doorOpen===1&&!g.isBlocked(0,-2.65),openCenters=g.doorGlass.map(o=>o.position.x);
  g.player.position.set(0,.26,-1.5);for(let i=0;i<10;i++)g.updateDoors(.05);const staysOpenInside=g.doorOpen===1;
  return{twoLeaves:g.doorGlass.length===2&&g.doorParts.left.length>=5&&g.doorParts.right.length>=5,closed,opensOutside,staysOpenInside,slidesApart:Math.abs(openCenters[0]-openCenters[1])>Math.abs(closedCenters[0]-closedCenters[1])+2};});
if(Object.values(doors).some(v=>!v))throw new Error(`Automatic sliding doors failed: ${JSON.stringify(doors)}`);
const shopAccess=await page.evaluate(()=>{const g=window.__nightStation;g.doorOpen=1;g.applyDoorOpen();const clearSegment=(a,b)=>{const steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.08);for(let i=0;i<=steps;i++){const t=i/steps;if(g.isBlocked(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t))return false}return true},clearRoute=points=>points.slice(1).every((point,i)=>clearSegment(points[i],point));return{
  rightRoute:clearRoute([[0,-1.9],[2.6,-1.9],[2.6,-.35],[3.8,-.35],[3.8,2.9],[1.2,2.9]]),
  leftRoute:clearRoute([[0,-1.9],[-2.6,-1.9],[-2.6,-.35],[-3.8,-.35],[-3.8,2.9],[-2.6,2.9]]),
  toGrill:clearRoute([[-2.6,2.9],[-2.9,3.6],[-2.9,4.45]]),
  toFridge:clearRoute([[1.2,2.9],[2.8,3.4],[2.8,4.45]]),
  hallRoute:clearRoute([[-3,-1.9],[3,-1.9]]),
  // Убранный из зала инвентарь не должен оставлять за собой невидимых препятствий.
  crossAisle:clearRoute([[-2.6,2.9],[2.6,2.9]]),
  backAisle:clearRoute([[0,2.9],[0,4.9]]),
  binInHall:g.station.getObjectByName('TrashBin').position.z<0,
  mopUpstairs:g.kit.position.y>3.4&&g.kit.position.x<4.36}});
if(Object.values(shopAccess).some(v=>!v))throw new Error(`Routes behind counter are blocked: ${JSON.stringify(shopAccess)}`);
const upperStock=await page.evaluate(()=>{const g=window.__nightStation,out={};
  const hold=(check,max=200)=>{g.actionLatched=false;g.actionHeld=true;for(let i=0;i<max&&!check();i++)g.updateInteraction(.05);g.actionHeld=false;g.actionLatched=false;return check()};
  const findSpot=(job,y)=>{const p=job.pos();for(let r=.2;r<=1.7;r+=.12)for(let i=0;i<28;i++){const a=i/28*Math.PI*2,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(g.isBlocked(x,z,null,y))continue;g.player.position.set(x,y,z);g.yaw=Math.atan2(-(p.x-x),-(p.z-z));g.updateInteraction(0);if(g.nearest===job)return{x,z}}return null};
  g.jobs=g.jobs.filter(j=>j.hidden);g.carry=null;g.updateCarry();g.stock={coffee:0,snack:0,hotdog:0,soda:0};g.updateHud();g.createRestockJob('coffee');g.createRestockJob('snack');
  const heights=[];for(let i=0;i<=14;i++)heights.push(g.floorHeight(5.82,-2.37+i*(5.45/14),heights.at(-1)??.26));
  out.stairsRise=heights.every((h,i)=>i===0||h>heights[i-1])&&heights.at(-1)>3.5;
  out.stairsWalkable=heights.every((h,i)=>!g.isBlocked(5.82,-2.37+i*(5.45/14),null,h));
  out.upperWallsSolid=g.isBlocked(0,-2.45,null,3.68)&&g.isBlocked(-4.55,1,null,3.68)&&g.isBlocked(0,6.5,null,3.68)&&!g.isBlocked(0,5,null,3.68);
  const coffeePick=g.jobs.find(j=>j.tag==='restock-coffee-pick'),snackPick=g.jobs.find(j=>j.tag==='restock-snack-pick');
  g.player.position.set(coffeePick.pos().x,.26,coffeePick.pos().z);g.updateInteraction(0);out.noThroughFloor=g.nearest!==coffeePick;
  g.player.position.set(5.25,3.68,3.15);for(let i=0;i<30;i++)g.updateDoors(.05);out.upperDoorOpens=g.upperDoorOpen===1&&!g.isBlocked(4.22,3.15,null,3.68);
  const coffeeAt=findSpot(coffeePick,3.68);out.coffeeReachable=!!coffeeAt;if(coffeeAt)g.player.position.set(coffeeAt.x,3.68,coffeeAt.z);out.tookCoffee=out.coffeeReachable&&hold(()=>g.carry==='coffeeBox')&&g.hands.current==='coffeeBox'&&g.stockBoxesOf('coffee').filter(box=>!box[0].visible).length===1;
  const coffeePut=g.jobs.find(j=>j.tag==='restock-coffee-put'),coffeeDown=coffeePut&&findSpot(coffeePut,.26);out.coffeeDownstairs=!!coffeeDown;if(coffeeDown)g.player.position.set(coffeeDown.x,.26,coffeeDown.z);out.filledCoffee=out.coffeeDownstairs&&hold(()=>g.stock.coffee===5)&&g.stockVisuals.coffee.every(o=>o.visible);
  const snackAt=findSpot(snackPick,3.68);out.snackReachable=!!snackAt;if(snackAt)g.player.position.set(snackAt.x,3.68,snackAt.z);out.tookSnack=out.snackReachable&&hold(()=>g.carry==='snackBox')&&g.hands.current==='snackBox'&&g.stockBoxesOf('snack').filter(box=>!box[0].visible).length===1&&g.stockVisuals.snack.some(o=>o.visible);
  const snackPut=g.jobs.find(j=>j.tag==='restock-snack-put'),snackDown=snackPut&&findSpot(snackPut,.26);out.snackDownstairs=!!snackDown;if(snackDown)g.player.position.set(snackDown.x,.26,snackDown.z);out.filledSnack=out.snackDownstairs&&hold(()=>g.stock.snack===5)&&g.stockVisuals.snack.every(o=>o.visible);
  out.independentCapacity=g.stock.coffee===5&&g.stock.snack===5&&document.querySelector('#stock-coffee').textContent==='5/5'&&document.querySelector('#stock-snack').textContent==='5/5';
  g.player.position.set(0,.26,-3);g.updatePlayer(0);return out;});
if(Object.values(upperStock).some(v=>!v))throw new Error(`Second-floor stock loop failed: ${JSON.stringify(upperStock)}`);
const stairAccess=await page.evaluate(()=>{const g=window.__nightStation,out={};
  // Проход по лестнице должен быть шириной со ступени, а не узкой полоской посередине.
  const widthAt=z=>{let min=null,max=null;for(let x=4.9;x<=6.9;x+=.02){const y=g.floorHeight(x,z,3.2);if(g.isBlocked(x,z,null,y))continue;if(min===null)min=x;max=x}return min===null?0:max-min};
  out.mouthWide=widthAt(-2.1)>1.2;out.middleWide=widthAt(.4)>1.2;out.topWide=widthAt(2.6)>1.2;
  // Перила стоят снаружи прохода, а не поперёк него.
  const rails=[];g.scene.traverse(o=>{if(o.isMesh&&/Rail|Handrail/i.test(o.name))rails.push(o.getWorldPosition(new g.player.position.constructor()))});
  out.railsFound=rails.length>=7;
  out.doorwayClear=!rails.some(r=>r.x>4.2&&r.x<6.4&&r.z<3.95);
  // Снизу и до самого склада — пешком, без прыжков.
  const climb=startX=>{g.player.position.set(startX,.26,-3.4);g.yaw=Math.PI;g.pitch=0;g.resetJump();g.keys.KeyW=true;for(let i=0;i<300;i++){g.updateDoors(1/60);g.updatePlayer(1/60)}g.keys.KeyW=false;return g.player.position.y};
  out.climbsNearWall=climb(5.45)>3.5;out.climbsNearRail=climb(6.35)>3.5;
  g.player.position.set(5.9,3.68,3.3);g.yaw=Math.PI/2;g.resetJump();
  for(let i=0;i<40;i++)g.updateDoors(1/60);
  g.keys.KeyW=true;for(let i=0;i<160;i++){g.updateDoors(1/60);g.updatePlayer(1/60)}g.keys.KeyW=false;
  out.walksIntoStockRoom=g.player.position.x<3.6&&g.player.position.y>3.5;
  out.neverJumped=g.grounded&&g.jumpHeight===0;
  // С площадки не свалиться: задний край огорожен.
  g.player.position.set(5.9,3.68,3.3);g.yaw=0;g.keys.KeyS=true;for(let i=0;i<90;i++)g.updatePlayer(1/60);g.keys.KeyS=false;
  out.railHoldsAtEdge=g.player.position.z<3.95&&g.player.position.y>3.5;
  g.player.position.set(0,.26,-3.35);g.yaw=0;g.resetJump();g.updatePlayer(0);return out;});
if(Object.values(stairAccess).some(v=>!v))throw new Error(`Stock room access failed: ${JSON.stringify(stairAccess)}`);
const freeRestock=await page.evaluate(()=>{const g=window.__nightStation,out={};
  const hold=(check,max=120)=>{g.actionLatched=false;g.actionHeld=true;for(let i=0;i<max&&!check();i++)g.updateInteraction(.05);g.actionHeld=false;g.actionLatched=false;return check()};
  const stand=g.jobs.find(j=>j.tag==='supply-coffee');
  out.standHidden=!!stand&&stand.hidden===true;
  g.jobs=g.jobs.filter(j=>j.hidden);g.carry=null;g.updateCarry();g.stock={coffee:5,snack:5,hotdog:5,soda:5};g.updateHud();
  g.player.position.set(stand.pos().x,3.68,stand.pos().z-.55);g.updateInteraction(0);
  out.standReachable=g.nearest===stand;
  out.fullShelfRefused=!hold(()=>g.carry==='coffeeBox',40)&&g.stockVisuals.coffee.every(o=>o.visible);
  // Запас не полон — идём за коробкой сами, до того как смена попросит.
  g.stock.coffee=2;g.updateHud();
  out.takenWithoutJob=hold(()=>g.carry==='coffeeBox')&&!g.jobs.some(j=>j.tag==='restock-coffee-pick');
  out.deliveryQueued=g.jobs.some(j=>j.tag==='restock-coffee-put');
  // Унесли одну коробку — со стеллажа пропала ровно одна.
  out.oneBoxGone=g.stockBoxesOf('coffee').filter(box=>!box[0].visible).length===1&&g.stockVisuals.coffee.some(o=>o.visible);
  g.updateInteraction(0);out.standOffersReturn=g.nearest===stand&&g.jobLabel(stand).startsWith('Верните');
  out.boxGoesBack=hold(()=>g.carry===null)&&g.stockVisuals.coffee.every(o=>o.visible)&&!g.jobs.some(j=>j.tag==='restock-coffee-put');
  g.stock={coffee:5,snack:5,hotdog:5,soda:5};g.updateHud();g.player.position.set(0,.26,-3.35);g.updatePlayer(0);return out;});
if(Object.values(freeRestock).some(v=>!v))throw new Error(`Free restocking failed: ${JSON.stringify(freeRestock)}`);
await mkdir('artifacts',{recursive:true});
await page.evaluate(()=>{const g=window.__nightStation;g.player.position.set(8,.26,-8);g.yaw=2.28;g.pitch=.19;g.updatePlayer(0)});await page.waitForTimeout(350);await page.screenshot({path:'artifacts/second-floor.png'});await page.evaluate(()=>{const g=window.__nightStation;g.player.position.set(0,.26,-3);g.yaw=0;g.pitch=-.04;g.updatePlayer(0)});
const service=await page.evaluate(()=>{const g=window.__nightStation,out=[];
  const findSpot=job=>{const p=job.pos();for(let r=.65;r<=2;r+=.15)for(let i=0;i<24;i++){const a=i/24*Math.PI*2,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(g.isBlocked(x,z))continue;g.player.position.set(x,.26,z);g.yaw=Math.atan2(-(p.x-x),-(p.z-z));g.updateInteraction(0);if(g.nearest===job)return{x,z}}return null};
  const hold=(done,max=200)=>{g.actionLatched=false;g.actionHeld=true;for(let i=0;i<max&&!done();i++)g.updateInteraction(.05);g.actionHeld=false;g.actionLatched=false;return done()};
  for(const index of [0,1,2]){
    g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.traffic.slice().forEach(t=>g.despawn(t,g.traffic));g.jobs=g.jobs.filter(j=>j.hidden);
    g.pumps.forEach((p,i)=>{p.car=i===index?null:{};p.broken=false;p.reserved=false});
    g.spawnCar();const car=g.cars[0];
    if(!car){out.push({index,parked:false});continue}
    for(let i=0;i<1400&&car.status!=='waiting';i++)g.updateCars(.05);
    const pickup=g.jobs.find(j=>j.car===car&&j.kind==='hose-pickup'),pickupSpot=pickup&&findSpot(pickup);let tookHose=false,hoseShown=false,hoseCheck=null,fuelSpot=null,fuelFlow=false,flowStops=false,paid=0,fuelingSeen=false,hoseReturned=false;
    if(pickupSpot){g.player.position.set(pickupSpot.x,.26,pickupSpot.z);g.updatePlayer(0);g.updateInteraction(0);tookHose=hold(()=>g.carry==='hose');g.hands.update(.05,{moving:true,acting:true,yawDelta:.04,pitchDelta:-.02});g.updateFuelHoseVisual();const socket=g.hands.getHoseSocketNDC(g.hoseSocketNdc,g.camera.aspect),end=g.hosePoints.at(-1).clone().project(g.camera),screenGap=socket&&Math.hypot(socket.x-end.x,socket.y-end.y);hoseCheck={tookHose,attached:screenGap<.0001,inHand:g.hands.current==='hose',worldVisible:g.hoseWorld.visible,aboveFloor:g.hoseWorld.userData.minHeight>.8,segments:g.hoseSegments.length===6&&g.hoseSegments.every(s=>Number.isFinite(s.scale.y)&&s.scale.y>.01),pumpHidden:car.pump.hoseParts.length>0&&car.pump.hoseParts.every(o=>!o.visible)};hoseShown=Object.values(hoseCheck).every(Boolean)}
    const fuel=g.jobs.find(j=>j.car===car&&j.kind==='fuel');fuelSpot=fuel&&findSpot(fuel);
    if(fuelSpot){const before=g.state.money;g.player.position.set(fuelSpot.x,.26,fuelSpot.z);g.updateInteraction(0);g.actionLatched=false;g.actionHeld=true;g.updateInteraction(.08);g.hands.update(.08,{moving:false,acting:true,fueling:car.status==='fueling',yawDelta:0,pitchDelta:0});const fx=g.hands.items.hose.userData.fuelFx;fuelFlow=car.status==='fueling'&&fx.flow.visible&&fx.drops.every(d=>d.visible);g.actionHeld=false;g.updateInteraction(0);g.hands.update(.08,{moving:false,acting:false,fueling:false,yawDelta:0,pitchDelta:0});flowStops=!fx.flow.visible&&fx.drops.every(d=>!d.visible);hold(()=>{fuelingSeen||=car.status==='fueling';paid=g.state.money-before;return paid>0});hoseReturned=g.carry===null&&!g.fuelHose&&car.pump.hoseParts.every(o=>o.visible)}
    const probes=[-6.2,-6.1,-8.6,-8.7].map(z=>({z,blocked:g.isBlocked(car.pump.x,z),distance:Math.hypot(car.spot.x-car.pump.x,car.spot.z-z)}));
    out.push({index,state:car.status,phase:car.phase,parked:car.status==='waiting'||car.status==='fueling',pickupReachable:!!pickupSpot,tookHose,hoseShown,hoseCheck,fuelReachable:!!fuelSpot,fuelFlow,flowStops,fuelingSeen,paid:paid>0,hoseReturned,spot:{x:car.spot.x,z:car.spot.z},carAt:{x:car.group.position.x,z:car.group.position.z,yaw:car.group.rotation.y},probes});
  }
  g.pumps.forEach(p=>{p.car=null});return out;});
if(service.some(r=>!r.parked||!r.pickupReachable||!r.tookHose||!r.hoseShown||!r.fuelReachable||!r.fuelFlow||!r.flowStops||!r.fuelingSeen||!r.paid||!r.hoseReturned))throw new Error(`Two-step refuelling failed: ${JSON.stringify(service)}`);
// Полосы задаёт traffic.js: тест проверяет, что машина уходит именно на них.
const lanes=await page.evaluate(async()=>{const {ROAD}=await import('/src/traffic.js');return {near:ROAD.near,far:ROAD.far}});
const fuelAim=await page.evaluate(()=>{const g=window.__nightStation,out={};
  const faceTo=point=>{g.yaw=Math.atan2(-(point.x-g.player.position.x),-(point.z-g.player.position.z))};
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];g.jobs=g.jobs.filter(j=>j.hidden);
  g.traffic.slice().forEach(t=>g.despawn(t,g.traffic));g.traffic=[];
  g.pumps.forEach((p,i)=>{p.car=i?{}:null;p.broken=false;p.reserved=false});
  g.shiftConfig={...g.shiftConfig,fleet:{car:1},orderIntensity:0};
  g.spawnCar();const car=g.cars[0];
  for(let i=0;i<2200&&car.status!=='waiting';i++)g.updateCars(.05);
  out.parked=car.status==='waiting';
  const pickup=g.jobs.find(j=>j.car===car&&j.kind==='hose-pickup');
  g.removeJob(pickup);pickup.onComplete();
  const fuel=g.jobs.find(j=>j.car===car&&j.kind==='fuel');
  out.fuelNeedsCloseRange=!!fuel&&fuel.range<1.8&&fuel.aim===true&&g.carry==='hose';
  const spot=fuel.pos();
  // Издалека заправку даже не предлагают.
  g.player.position.set(spot.x+2.7,.26,spot.z);faceTo(spot);g.updateInteraction(0);
  out.farAwayIgnored=g.nearest!==fuel;
  // Вплотную, но спиной к машине: задача видна, бензин не идёт.
  g.player.position.set(spot.x+1.15,.26,spot.z);faceTo(spot);g.updateInteraction(0);
  const near=g.nearest===fuel;
  g.yaw+=Math.PI;g.updateInteraction(0);
  const before=g.state.money;
  g.actionLatched=false;g.actionHeld=true;for(let i=0;i<120;i++)g.updateInteraction(.05);g.actionHeld=false;g.actionLatched=false;
  out.lookingAwayBlocked=near&&g.state.money===before&&car.status!=='fueling';
  out.promptExplains=document.querySelector('#prompt-subtitle').textContent.includes('Направьте');
  // Повернулись к лючку — заправка пошла.
  faceTo(spot);g.updateInteraction(0);
  g.actionLatched=false;g.actionHeld=true;
  let fueled=false;
  for(let i=0;i<300&&g.state.money===before;i++){g.updateInteraction(.05);fueled||=car.status==='fueling'}
  g.actionHeld=false;g.actionLatched=false;
  out.facingTheCarWorks=fueled&&g.state.money>before;
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];g.jobs=g.jobs.filter(j=>j.hidden);
  g.pumps.forEach(p=>{p.car=null;p.departingCar=null});g.carry=null;g.updateCarry();
  g.player.position.set(0,.26,-3);g.yaw=0;
  return out;});
if(Object.values(fuelAim).some(v=>!v))throw new Error(`Fuelling range and aim failed: ${JSON.stringify(fuelAim)}`);
const onRoad=p=>Math.abs(p.x)>40&&p.z<lanes.near+2.5&&p.z>lanes.far-2.5;
const road=await page.evaluate(()=>{const g=window.__nightStation;
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.carQueue=[];g.pumps.forEach(p=>{p.car=null;p.broken=false});g.spawnCar();const c=g.cars[0],start=c.path.curve.getPointAt(0);
  for(let i=0;i<1400&&c.status!=='waiting';i++)g.updateCars(.05);
  const end=c.group.position.clone(),parkedYaw=c.group.rotation.y;
  c.status='waiting';g.leaveCar(c);let reversedFirst=c.status==='leaving'&&c.phase==='reversing',left=false;
  for(let i=0;i<500&&!left;i++){g.updateCars(.05);left=c.phase==='exiting'}
  const exit=left?c.path.curve.getPointAt(1):null;
  return {start:{x:start.x,z:start.z},parked:{x:end.x,z:end.z},slot:{x:c.target.x,z:c.target.z},yaw:parkedYaw,reversedFirst,left,exit:exit&&{x:exit.x,z:exit.z}};});
const roadChecks={arrivesFromRoad:onRoad(road.start),parksAtPump:Math.hypot(road.parked.x-road.slot.x,road.parked.z-road.slot.z)<.1,parksStraight:Math.abs(Math.sin(road.yaw))<.015,
  reversesOut:road.reversedFirst,leavesOnRoad:road.left&&onRoad(road.exit)};
if(Object.values(roadChecks).some(v=>!v))throw new Error(`Car road routing failed: ${JSON.stringify(roadChecks)} ${JSON.stringify(road)}`);
const safety=await page.evaluate(()=>{const g=window.__nightStation;
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.carQueue=[];g.jobs=g.jobs.filter(j=>j.hidden);g.pumps.forEach((p,i)=>{p.car=i?{}:null;p.broken=false});
  g.spawnCar();const c=g.cars[0];for(let i=0;i<1000&&c.status!=='approachingPump';i++)g.updateCars(.05);if(!c.safeZone)return{assigned:false};g.player.position.set(c.safeZone.x,.26,c.safeZone.z);
  for(let i=0;i<900&&!c.blockedByPlayer;i++)g.updateCars(.05);
  const heldAt=c.dist;for(let i=0;i<80;i++)g.updateCars(.05);
  const stopped=c.status==='approachingPump'&&c.blockedByPlayer&&Math.abs(c.dist-heldAt)<.001;
  const playerFree=!g.isBlocked(g.player.position.x,g.player.position.z);
  g.player.position.set(0,.26,-3);for(let i=0;i<900&&c.status!=='waiting';i++)g.updateCars(.05);
  const resumed=c.status==='waiting'&&c.phase==='parked';
  g.player.position.copy(c.group.position);for(let i=0;i<120&&g.pointInVehicle(g.player.position.x,g.player.position.z,c,.36);i++)g.resolvePlayerOverlap(c,.05);
  const pushedClear=!g.pointInVehicle(g.player.position.x,g.player.position.z,c,.36)&&!g.isBlocked(g.player.position.x,g.player.position.z);
  g.leaveCar(c);const leaving=c.status==='leaving'&&c.phase==='reversing';
  return {stopped,playerFree,resumed,pushedClear,leaving};});
if(Object.values(safety).some(v=>!v))throw new Error(`Vehicle/player safety failed: ${JSON.stringify(safety)}`);
const vehicleCollision=await page.evaluate(()=>{const g=window.__nightStation;
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.traffic.slice().forEach(c=>g.despawn(c,g.traffic));g.jobs=g.jobs.filter(j=>j.hidden);g.pumps.forEach(p=>{p.car=null;p.broken=false});g.player.position.set(0,.26,-3);
  g.shiftConfig={...g.shiftConfig,queueSize:2};
  g.spawnCar();for(let i=0;i<40;i++)g.updateCars(.05);g.spawnCar();if(g.cars.length!==2)return {spawned:false};
  const mover=g.cars[0],blocker=g.cars[1],ahead=Math.min(mover.path.len,mover.dist+5),u=ahead/mover.path.len,tangent=mover.path.curve.getTangentAt(u);
  g.carQueue=[];
  mover.path.curve.getPointAt(u,blocker.group.position);blocker.group.rotation.y=Math.atan2(-tangent.x,-tangent.z);blocker.status='waiting';blocker.speed=0;
  for(let i=0;i<160&&!mover.blockedByVehicle;i++)g.updateCars(.05);
  const heldAt=mover.dist,blocked=mover.blockedByVehicle===blocker&&!g.vehiclesOverlap(mover,mover.group.position,mover.group.rotation.y,blocker,0);
  for(let i=0;i<60;i++)g.updateCars(.05);const stayed=Math.abs(mover.dist-heldAt)<.001;
  blocker.group.position.set(8,0,3);for(let i=0;i<80&&mover.dist<=heldAt+.05;i++)g.updateCars(.05);const resumed=mover.dist>heldAt+.05;
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.pumps.forEach(p=>p.car=null);return {spawned:true,blocked,stayed,resumed};});
if(Object.values(vehicleCollision).some(v=>!v))throw new Error(`Vehicle collision avoidance failed: ${JSON.stringify(vehicleCollision)}`);
const fifoQueue=await page.evaluate(()=>{const g=window.__nightStation;
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.carQueue=[];g.traffic.slice().forEach(c=>g.despawn(c,g.traffic));g.jobs=g.jobs.filter(j=>j.hidden);g.pumps.forEach(p=>{p.car=null;p.broken=false});g.player.position.set(0,.26,-3);g.shiftConfig={...g.shiftConfig,queueSize:2};
  g.pumps.forEach((p,i)=>{p.closed=i>1;p.broken=i>1});
  let overlapDetected=false,firstOverlap=null;const overlappingPair=()=>{for(let index=0;index<g.cars.length;index++)for(const other of g.cars.slice(index+1)){const car=g.cars[index];if(g.vehiclesOverlap(car,car.group.position,car.group.rotation.y,other,0))return[car,other]}return null},carsOverlap=()=>!!overlappingPair(),step=()=>{g.updateCars(.05);const pair=overlappingPair();if(pair&&!overlapDetected){overlapDetected=true;firstOverlap=pair.map(car=>({id:car.id,status:car.status,phase:car.phase,x:car.group.position.x,z:car.group.position.z}))}};
  const parkNext=()=>{if(!g.spawnCar())return null;const car=g.cars.at(-1);for(let i=0;i<1800&&car.status!=='waiting';i++)step();return car};
  const first=parkNext(),second=parkNext();if(!first||!second||first.status!=='waiting'||second.status!=='waiting')return{twoPumpsOccupied:false};
  const occupiedBefore=g.pumps.slice(0,2).every(p=>!!p.car),spawnedThird=g.spawnCar(),third=g.cars.at(-1);
  for(let i=0;i<1400&&third.status!=='queueing';i++)step();
  const waitsInQueue=spawnedThird&&third.status==='queueing'&&third.phase==='queued'&&g.carQueue.length===1&&g.carQueue[0]===third&&third.pump===null;
  const noOverlapWhileQueued=!overlapDetected&&!carsOverlap();
  const freedPump=first.pump;g.leaveCar(first);for(let i=0;i<700&&third.status==='queueing';i++)step();const assignedInOrder=third.status==='approachingPump'&&third.pump===freedPump&&g.carQueue.length===0;
  for(let i=0;i<1800&&third.status!=='waiting';i++)step();
  const parkedAfterRelease=third.status==='waiting'&&third.phase==='parked'&&freedPump.car===third;
  const noOverlapAtPump=!overlapDetected&&!carsOverlap();
  const diagnostic={firstOverlap,thirdStatus:third.status,thirdPhase:third.phase,thirdBlockedBy:third.blockedByVehicle?.id||null,thirdAt:{x:third.group.position.x,z:third.group.position.z},firstStatus:first.status,firstPhase:first.phase,firstAt:{x:first.group.position.x,z:first.group.position.z}};
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.carQueue=[];g.pumps.forEach(p=>{p.car=null;p.closed=false;p.broken=false});return{twoPumpsOccupied:occupiedBefore,spawnedThird,waitsInQueue,noOverlapWhileQueued,assignedInOrder,parkedAfterRelease,noOverlapAtPump,diagnostic};});
if(Object.entries(fifoQueue).some(([key,value])=>key!=='diagnostic'&&!value))throw new Error(`FIFO service queue failed: ${JSON.stringify(fifoQueue)}`);
const mergeQueue=await page.evaluate(async()=>{const g=window.__nightStation;
  const {ROAD,REVERSE_REACH}=await import('/src/traffic.js');
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.carQueue=[];g.traffic.slice().forEach(c=>g.despawn(c,g.traffic));g.jobs=g.jobs.filter(j=>j.hidden);g.pumps.forEach((p,i)=>{p.car=i?{}:null;p.broken=false});g.player.position.set(0,.26,-3);
  g.spawnCar();const c=g.cars[0];for(let i=0;i<1400&&c.status!=='waiting';i++)g.updateCars(.05);g.leaveCar(c);
  for(let i=0;i<500&&c.phase==='reversing';i++)g.updateCars(.05);
  const away=-c.side,lane=away>0?ROAD.near:ROAD.far,start=c.slotX+c.side*(c.reach||REVERSE_REACH),mergeX=start+away*22;
  const addTrafficAt=targetX=>{for(let tries=0;tries<12;tries++){g.trafficTimer=-1;g.updateTraffic(0);const t=g.traffic.at(-1);if(!t)return null;const z=t.path.curve.getPointAt(0).z;if(Math.abs(z-lane)>.2){g.despawn(t,g.traffic);continue}let best=0,error=Infinity;for(let i=0;i<=300;i++){const u=i/300,d=Math.abs(t.path.curve.getPointAt(u).x-targetX);if(d<error){error=d;best=u}}t.dist=t.path.len*best;t.t=best;t.path.curve.getPointAt(best,t.group.position);const tangent=t.path.curve.getTangentAt(best);t.group.rotation.y=Math.atan2(-tangent.x,-tangent.z);return t}return null};
  const convoy=[addTrafficAt(mergeX-away*4),addTrafficAt(mergeX-away*14)].filter(Boolean),before=convoy.map(t=>t.dist);
  g.updateCars(.05);const yielded=c.phase==='yielding'&&convoy.length===2;
  let released=false;for(let i=0;i<1200&&!released;i++){g.updateCars(.05);released=c.phase==='exiting'||!g.cars.includes(c)}
  const trafficAdvanced=convoy.every((t,i)=>!g.traffic.includes(t)||t.dist>before[i]+5);
  g.cars.slice().forEach(v=>g.despawn(v,g.cars));g.traffic.slice().forEach(v=>g.despawn(v,g.traffic));g.pumps.forEach(p=>p.car=null);return {yielded,released,trafficAdvanced};});
if(Object.values(mergeQueue).some(v=>!v))throw new Error(`Road merge queue deadlocked: ${JSON.stringify(mergeQueue)}`);
const handChecks=await page.evaluate(()=>{const g=window.__nightStation,seen={};
  for(const item of ['coffee','box','coffeeBox','snackBox','sodaBox','mop','tools','hose','snack','hotdog','soda','bag']){g.carry=item;g.updateCarry();seen[item]=g.hands.current===item&&g.hands.rig.visible}
  g.carry=null;g.updateCarry();seen.emptyHidden=!g.hands.rig.visible;
  g.carry='coffee';g.updateCarry();g.hands.update(.016,{moving:true,acting:true,yawDelta:.01,pitchDelta:0});
  seen.animates=Number.isFinite(g.hands.items.coffee.position.z);return seen;});
if(Object.values(handChecks).some(v=>!v))throw new Error(`Hand item checks failed: ${JSON.stringify(handChecks)}`);
const chores=await page.evaluate(()=>{const g=window.__nightStation;
  const hold=(check,max=200)=>{g.actionLatched=false;g.actionHeld=true;for(let i=0;i<max&&!check();i++){g.updateInteraction(.05)}g.actionHeld=false;g.actionLatched=false;return check()};
  const goTo=p=>{const floor=(p.y??.26)>3?3.68:.26;g.player.position.set(p.x,floor,p.z+.9);g.updateInteraction(0)};
  const findSpot=job=>{const p=job.pos(),floor=(p.y??.26)>3?3.68:.26;for(let r=.35;r<=1.3;r+=.1)for(let i=0;i<28;i++){const a=i/28*Math.PI*2,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(g.isBlocked(x,z,null,floor))continue;g.player.position.set(x,floor,z);g.yaw=Math.atan2(-(p.x-x),-(p.z-z));g.updateInteraction(0);if(g.nearest===job)return{x,y:floor,z}}return null};
  const out={};
  g.carry=null;g.updateCarry();
  g.spawnSpill();
  const spill=g.jobs.find(j=>j.tag==='spill');
  out.spillNeedsMop=!!spill&&spill.need==='mop';
  out.spillVisible=spill.visual?.children.length===5&&spill.visual.position.y>.24&&spill.visual.children.every(m=>m.visible&&m.material.opacity>.6);
  goTo(spill.pos());
  out.blockedWithoutMop=!hold(()=>!g.jobs.includes(spill),40);
  out.mopInStockRoom=g.kit.position.y>3.4&&g.kit.position.z<0;
  {const mopJob=g.jobs.find(j=>j.tag==='stand-mop'),mop=findSpot(mopJob);out.mopReachable=!!mop;if(mop)g.player.position.set(mop.x,mop.y,mop.z)}
  out.tookMop=out.mopReachable&&hold(()=>g.carry==='mop');
  out.mopLeftTheStand=g.kitMop.every(m=>!m.visible);
  goTo(spill.pos());
  const fullSize=spill.visual.scale.x;g.actionLatched=false;g.actionHeld=true;for(let i=0;i<14;i++)g.updateInteraction(.05);g.actionHeld=false;
  out.spillShrinks=spill.visual.scale.x<fullSize*.9&&spill.visual.scale.x>.15;
  for(let i=0;i<20;i++)g.updateInteraction(.05);
  out.spillReturnsAfterPause=Math.abs(spill.visual.scale.x-fullSize)<.01;
  out.cleaned=hold(()=>!g.jobs.includes(spill));
  out.mopIsBack=g.carry===null&&g.kitMop.every(m=>m.visible);
  let poweredCompleted=false;const powered=g.addJob({tag:'test-powered',title:'Приготовьте тестовый кофе',sub:'Проверка питания',pos:()=>({x:0,z:-4.4}),duration:.5,patience:12,onComplete:()=>{poweredCompleted=true}});
  g.carry='coffee';g.updateCarry();
  g.eventBlackout();
  const panel=g.jobs.find(j=>j.tag==='blackout');
  out.panelNeedsTools=!!panel&&panel.need==='tools';
  out.blackoutFirst=g.jobs.filter(j=>!j.hidden).sort((a,b)=>(b.priority||0)-(a.priority||0))[0]===panel;
  out.appliancesDark=g.powerVisuals.length>=6&&g.powerVisuals.every(o=>!o.visible);
  out.emergencyDoorOpen=g.doorOpen===1&&!g.isBlocked(0,-2.65);
  out.carryStored=g.carry===null&&g.blackoutCarry==='coffee';
  const patience=powered.patience,spawnTimer=g.spawnTimer,eventTimer=g.eventTimer;g.updateJobs(1);g.updatePlay(.1);
  out.timersPaused=g.spawnTimer===spawnTimer&&g.eventTimer===eventTimer&&powered.patience===patience;
  out.fuelAndCoffeeDisabled=!g.worksDuringBlackout({kind:'fuel'})&&!g.worksDuringBlackout({tag:'coffee'});
  goTo(powered.pos());out.poweredActionBlocked=!hold(()=>poweredCompleted,40)&&document.querySelector('#prompt-subtitle').textContent.includes('Нет электричества');
  goTo(panel.pos());
  out.panelBlockedWithoutTools=!hold(()=>!g.jobs.includes(panel),40)&&g.blackout;
  goTo(g.jobs.find(j=>j.tag==='stand-tools').pos());
  out.tookToolsForPanel=hold(()=>g.carry==='tools');
  goTo(panel.pos());
  out.panelRepaired=hold(()=>!g.jobs.includes(panel))&&!g.blackout;
  out.appliancesRestored=g.powerVisuals.every(o=>o.visible);
  out.previousItemRestored=g.carry==='coffee'&&g.blackoutCarry===null;
  g.removeJob(powered);g.carry=null;g.updateCarry();
  out.panelToolsReturned=g.carry===null;
  g.pumps.forEach(p=>{p.car=null;p.broken=false});
  g.eventBrokenPump();
  const repair=g.jobs.find(j=>j.tag==='broken');
  out.pumpNeedsTools=!!repair&&repair.need==='tools';
  goTo(g.jobs.find(j=>j.tag==='stand-tools').pos());
  out.tookTools=hold(()=>g.carry==='tools');
  goTo(repair.pos());
  out.repaired=hold(()=>!g.jobs.includes(repair))&&g.pumps.every(p=>!p.broken);
  out.toolsAreBack=g.carry===null;
  out.standsStayHidden=g.jobs.filter(j=>j.hidden).length===6&&g.jobs.every(j=>!j.hidden||/^(stand|supply)-/.test(j.tag));
  return out;});
if(Object.values(chores).some(v=>!v))throw new Error(`Mop/tool chores failed: ${JSON.stringify(chores)}`);
const van=await page.evaluate(async()=>{const g=window.__nightStation;const {ROAD}=await import('/src/traffic.js');g.eventVan();
  const start=g.specialVan.path.curve.getPointAt(0);
  for(let i=0;i<600&&g.specialVan.status==='entering';i++)g.updateCars(.05);
  const parked=g.specialVan.status==='waiting'&&!!g.jobs.find(j=>j.title==='Проверьте странный фургон');
  g.leaveSpecialVan();
  for(let i=0;i<900&&g.specialVan;i++)g.updateCars(.05);
  return {fromRoad:Math.abs(start.x)>40&&start.z<ROAD.near+2.5&&start.z>ROAD.far-2.5,parked,gone:!g.specialVan};});
if(Object.values(van).some(v=>!v))throw new Error(`Mystery van routing failed: ${JSON.stringify(van)}`);
await page.evaluate(()=>{const g=window.__nightStation;g.carry='coffee';g.updateCarry()});
const sky=await page.evaluate(()=>{const g=window.__nightStation,sky=g.sky,out={};
  const layers=[];let foggy=0;
  sky.group.traverse(o=>{if(o.isPoints)layers.push(o.geometry.getAttribute('position').count);if(o.material&&o.material.fog)foggy++});
  out.starLayers=layers.length>=4;
  out.starCount=layers.reduce((a,b)=>a+b,0)>1200;
  out.aboveHorizon=sky.group.children.every(o=>!o.isPoints||o.geometry.getAttribute('position').array.filter((_,i)=>i%3===1).every(y=>y>0));
  out.skyIgnoresFog=foggy===0;
  const moon=sky.group.children.find(o=>o.isGroup);
  out.moonPlaced=!!moon&&moon.position.length()>50&&moon.position.y>20;
  out.moonHasHalo=!!moon&&moon.children.some(o=>o.isSprite);
  const light=g.scene.children.find(o=>o.isDirectionalLight);
  out.moonlightFromMoon=!!light&&light.position.clone().normalize().distanceTo(sky.moonDirection)<.01;
  g.camera.position.set(3.5,1.6,-6);sky.update(.016,g.camera.position);
  out.followsCamera=sky.group.position.distanceTo(g.camera.position)<.001;
  return out;});
if(Object.values(sky).some(v=>!v))throw new Error(`Night sky failed: ${JSON.stringify(sky)}`);
const jump=await page.evaluate(()=>{const g=window.__nightStation;
  g.player.position.set(0,.26,-4);g.yaw=0;g.resetJump();g.updatePlayer(1/60);
  const ground=g.camera.position.y;
  g.keys.Space=true;g.updateJump(1/60);g.keys.Space=false;
  let peak=0,air=0;for(let i=0;i<240&&!g.grounded;i++){g.updateJump(1/60);peak=Math.max(peak,g.jumpHeight);air+=1/60}
  const landed=g.grounded&&g.jumpHeight===0;
  for(let i=0;i<40;i++)g.updateJump(1/60);
  const dipGone=g.landDip<.01;
  // в прыжке стены держат так же, как на земле
  g.player.position.set(0,.26,-.6);g.yaw=Math.PI;g.keys.Space=true;g.updateJump(1/60);g.keys.Space=false;
  g.keys.KeyW=true;for(let i=0;i<45;i++)g.updatePlayer(1/60);g.keys.KeyW=false;
  const throughCounter=g.player.position.z>.12;
  g.yaw=0;g.resetJump();g.updatePlayer(1/60);
  return {eyeHeight:Math.abs(ground-1.62)<.01,rises:peak>.5&&peak<1.1,airtime:air>.4&&air<.9,lands:landed,dipRecovers:dipGone,keepsWalls:!throughCounter,restsOnGround:Math.abs(g.camera.position.y-1.62)<.02};});
if(Object.values(jump).some(v=>!v))throw new Error(`Jump failed: ${JSON.stringify(jump)}`);
const jumpButton=await page.evaluate(()=>{const g=window.__nightStation,button=document.querySelector('#jump-btn');
  if(!button)return {present:false};
  button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:7}));
  const pressed=g.keys.Space===true;g.resetJump();g.updateJump(1/60);const jumped=!g.grounded;
  button.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:7}));
  const released=g.keys.Space===false;g.resetJump();
  return {present:true,pressed,jumped,released};});
if(Object.values(jumpButton).some(v=>!v))throw new Error(`Mobile jump button failed: ${JSON.stringify(jumpButton)}`);
await page.waitForTimeout(400);await page.screenshot({path:'artifacts/gameplay.png'});
await page.evaluate(()=>{const g=window.__nightStation;g.carry='mop';g.updateCarry()});await page.waitForTimeout(500);await page.screenshot({path:'artifacts/hands.png'});await page.evaluate(()=>{const g=window.__nightStation;g.carry=null;g.updateCarry()});
await page.evaluate(()=>document.exitPointerLock?.());await page.click('#guide-btn');await page.locator('#guide:not(.hidden)').waitFor();await page.screenshot({path:'artifacts/guide.png'});await page.click('#guide-next');if(await page.locator('#guide-step').innerText()!=='2 / 9')throw new Error('Guide navigation failed');await page.click('#guide-close');
const campaign=await page.evaluate(()=>{const g=window.__nightStation,out={};
  // Сейв семисменной кампании продолжается с восьмого уровня, а не считается пройденным.
  g.setState({saveVersion:2,money:321,shift:9,rep:4.2,upgrades:{speed:2},tutorial:true,sound:true,musicVolume:65,best:99,campaignComplete:true});
  // Старый сейв поднимается до станции: ботинки остаются, лишние прибавки возвращаются деньгами.
  out.legacyContinues=g.state.saveVersion===5&&g.state.shift===8&&!g.state.campaignComplete&&g.state.levelsCleared===7&&g.state.money===321+200&&g.state.upgrades.includes('boots');
  g.setState({saveVersion:3,money:500,shift:1,rep:3,tutorial:true,sound:true,musicVolume:80,best:0,levelsCleared:0,campaignComplete:false,campaignEarnings:0,campaignServed:0});
  g.startShift();
  out.levelFromData=g.shiftConfig.number===1&&g.shiftLength===170&&g.shiftConfig.orderMenu.join()==='coffee'&&g.shiftConfig.allowedEvents.length===0&&g.shiftConfig.queueSize===1;
  out.hudShowsLevel=document.querySelector('#shift-label').textContent==='УРОВЕНЬ 1 / 30'&&document.querySelector('#level-name').textContent.includes('Первая заправка');
  const target=g.shiftConfig.goal.served;
  out.hudShowsGoal=document.querySelector('#level-goal').textContent.includes(`0 / ${target}`);
  // Цель не выполнена: уровень не зачтён, причина названа, уровень остаётся прежним.
  g.served=1;g.finishShift();
  out.failKeepsLevel=g.state.shift===1&&g.state.levelsCleared===0&&g.levelResult.passed===false;
  out.failExplained=document.querySelector('#result-goal').textContent.includes(`1 из ${target}`)&&document.querySelector('#result-eyebrow').textContent.includes('НЕ ЗАЧТЁН');
  out.retryOffered=document.querySelector('#next-shift').textContent.includes('ПОВТОРИТЬ');
  // Цель выполнена: уровень зачтён и открывается следующий.
  g.startShift();g.served=target;g.state.money+=200;g.finishShift();
  out.passAdvances=g.state.shift===2&&g.state.levelsCleared===1&&g.levelResult.passed===true;
  out.passExplained=document.querySelector('#result-eyebrow').textContent.includes('ПРОЙДЕН')&&document.querySelector('#next-shift').textContent.includes('СЛЕДУЮЩИЙ');
  return out;});
if(Object.values(campaign).some(v=>!v))throw new Error(`Campaign level flow failed: ${JSON.stringify(campaign)}`);
const levelRules=await page.evaluate(()=>{const g=window.__nightStation,out={};
  const startLevel=number=>{g.setState({...g.state,shift:number,campaignComplete:false});g.startShift();g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[]};
  // Механики открываются данными уровня: на первом уровне заказов нет вообще.
  // Первая ночь учит заправке и кофе — и полки на ней всегда полные.
  startLevel(1);out.firstLevelSellsCoffeeOnly=g.shiftConfig.orderMenu.join()==='coffee'&&g.shiftConfig.startStock.coffee===5&&g.shiftConfig.allowedEvents.length===0;
  startLevel(3);out.coffeeOnly=g.shiftConfig.orderMenu.join()==='coffee';
  startLevel(6);out.foodUnlocked=g.shiftConfig.orderMenu.join()==='coffee,snack';
  // Пустой склад с порога ставит задачу пополнения, а не молчит.
  startLevel(30);
  out.emptyStockQueued=g.stock.coffee===0&&g.stock.snack===0&&g.jobs.some(j=>j.tag==='restock-coffee-pick')&&g.jobs.some(j=>j.tag==='restock-snack-pick');
  out.finalCombines=g.shiftConfig.rushes.length===3&&g.shiftConfig.scripted.length===6&&Object.keys(g.shiftConfig.goal).length===3&&g.pumps.filter(p=>!p.closed).length===3;
  // Закрытая колонка помечена табличкой и не берёт машины.
  startLevel(17);
  out.pumpClosed=g.pumps[1].closed===true&&g.pumps[2].closed===true&&g.pumps[1].broken===true&&g.closedSigns[1].visible===true&&g.closedSigns[0].visible===false;
  g.spawnCar();const queued=g.cars.at(-1);
  for(let i=0;i<1800&&queued.status!=='waiting';i++)g.updateCars(.05);
  out.onlyOpenPumpServes=queued.pump===g.pumps[0];
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];
  for(let i=0;i<12;i++)g.runEvent('broken');
  out.closedPumpNeverRepaired=g.pumps[1].closed===true&&!g.jobs.some(j=>j.tag==='broken'&&g.jobLabel(j).includes('2'));
  startLevel(1);
  // Наплыв: очередь длиннее и машины идут чаще, но только в своё окно.
  startLevel(5);
  const rush=g.shiftConfig.rushes[0],baseLimit=g.queueLimit();
  g.elapsed=rush.at+1;g.updateSchedule();
  out.rushStarts=g.currentRush===rush&&g.queueLimit()===baseLimit+rush.queueBoost&&rush.interval[0]<g.shiftConfig.carSpawn.interval[0];
  g.elapsed=rush.at+rush.duration+2;g.updateSchedule();
  out.rushEnds=g.currentRush===null&&g.queueLimit()===baseLimit;
  // Сценарное событие происходит гарантированно и ровно один раз.
  startLevel(21);
  const scripted=g.shiftConfig.scripted[0];
  g.elapsed=scripted.at-1;g.updateSchedule();
  out.scriptedWaits=!g.blackout&&g.scriptedFired.size===0;
  g.elapsed=scripted.at+.5;g.updateSchedule();
  out.scriptedFires=g.blackout===true&&g.scriptedFired.has(scripted.id);
  const panels=g.jobs.filter(j=>j.tag==='blackout').length;g.updateSchedule();
  out.scriptedOnce=g.jobs.filter(j=>j.tag==='blackout').length===panels;
  // Пока свет не починили, второй blackout не накладывается поверх первого.
  out.noDoubleBlackout=g.canRunEvent('blackout')===false;
  g.jobs.filter(j=>j.tag==='blackout').forEach(j=>{j.onComplete();g.removeJob(j)});
  out.lightRestored=!g.blackout&&g.canRunEvent('blackout')===true;
  startLevel(1);g.player.position.set(0,.26,-3.35);g.updatePlayer(0);
  return out;});
if(Object.values(levelRules).some(v=>!v))throw new Error(`Level rules failed: ${JSON.stringify(levelRules)}`);
const hardFail=await page.evaluate(()=>{const g=window.__nightStation,out={};
  g.setState({...g.state,shift:5,campaignComplete:false});g.startShift();
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];
  out.limitDeclared=g.shiftConfig.goal.maxLost===1;
  const parkOne=()=>{if(!g.spawnCar())return null;const car=g.cars.at(-1);for(let i=0;i<1800&&car.status!=='waiting';i++)g.updateCars(.05);return car};
  const expire=car=>{const job=g.jobs.find(j=>j.car===car&&j.patience!=null);if(!job)return false;job.patience=.001;g.updateJobs(.05);return true};
  const first=parkOne();out.firstParked=!!first&&first.status==='waiting';
  out.firstLost=expire(first)&&g.lost===1&&!g.levelResult;
  const second=parkOne();out.secondParked=!!second&&second.status==='waiting';
  out.limitBreached=expire(second)&&g.lost===2&&!!g.levelResult&&g.levelResult.passed===false&&g.levelResult.failures[0].includes('Упущено');
  g.updatePlay(.016);
  out.shiftClosedEarly=g.mode==='results'&&document.querySelector('#result-goal').textContent.includes('Упущено');
  return out;});
if(Object.values(hardFail).some(v=>!v))throw new Error(`Early failure failed: ${JSON.stringify(hardFail)}`);
const finalLevel=await page.evaluate(()=>{const g=window.__nightStation,out={};
  g.setState({...g.state,shift:30,campaignComplete:false,levelsCleared:29,campaignEarnings:900,campaignServed:12,money:500});
  g.startShift();g.served=2;g.finishShift();
  out.finalNeedsGoal=!g.state.campaignComplete&&g.state.shift===30;
  g.startShift();g.served=g.shiftConfig.goal.served;g.lost=0;g.state.rep=4;g.state.money+=999;g.finishShift();
  out.campaignDone=g.state.campaignComplete===true&&g.state.levelsCleared===30;
  out.finalButton=document.querySelector('#next-shift').textContent.includes('ЗАВЕРШИТЬ');
  out.totals=g.state.campaignServed===12+2+g.shiftConfig.goal.served&&g.state.campaignEarnings>=999;
  return out;});
if(Object.values(finalLevel).some(v=>!v))throw new Error(`Final level failed: ${JSON.stringify(finalLevel)}`);
await page.click('#next-shift');await page.locator('#campaign-complete:not(.hidden)').waitFor();
const finale=await page.evaluate(()=>({mode:window.__nightStation.mode,served:document.querySelector('#campaign-served').textContent,restart:!!document.querySelector('#campaign-restart'),endless:!!document.querySelector('#campaign-endless')}));
if(finale.mode!=='campaign-complete'||!finale.restart||!finale.endless)throw new Error(`Campaign completion screen failed: ${JSON.stringify(finale)}`);
await page.screenshot({path:'artifacts/campaign-complete.png'});
await page.click('#campaign-endless');
const endlessMode=await page.evaluate(()=>{const g=window.__nightStation;return{
  playing:g.mode==='playing',endless:g.state.playMode==='endless',round:g.shiftConfig.number===1,
  label:document.querySelector('#shift-label').textContent.includes('БЕСКОНЕЧНАЯ'),
  noGoal:document.querySelector('#level-goal').textContent.includes('Без цели'),
  keepsMoney:g.state.money>=500,unfailable:!g.levelResult};});
if(Object.values(endlessMode).some(v=>!v))throw new Error(`Endless mode failed: ${JSON.stringify(endlessMode)}`);
const levelMenu=await page.evaluate(()=>{const g=window.__nightStation,out={};
  g.setState({saveVersion:3,shift:1,levelsCleared:9,money:700,tutorial:true,sound:true,musicVolume:80,campaignComplete:false,best:0});
  g.showMenu();document.querySelector('#levels-btn').click();
  const screen=document.querySelector('#levels'),tiles=[...document.querySelectorAll('.level-tile')];
  out.opens=!screen.classList.contains('hidden')&&document.querySelector('#menu').classList.contains('hidden');
  out.allLevelsListed=tiles.length===30&&document.querySelectorAll('.level-chapter').length===6;
  out.progressShown=document.querySelector('#levels-progress').textContent.includes('9 из 30');
  out.clearedMarked=tiles.slice(0,9).every(tile=>tile.classList.contains('done')&&!tile.disabled);
  out.currentMarked=tiles[9].classList.contains('current')&&!tiles[9].disabled;
  out.restLocked=tiles.slice(10).every(tile=>tile.classList.contains('locked')&&tile.disabled);
  out.lockedHideGoals=tiles[14].textContent.includes('Откроется');
  out.goalsShown=tiles[4].textContent.includes('Обслужить')&&tiles[0].textContent.includes('Первая заправка');
  out.examsMarked=!!tiles[4].querySelector('.exam-mark')&&!tiles[3].querySelector('.exam-mark');
  out.endlessHidden=document.querySelector('#levels-endless').classList.contains('hidden');
  tiles[20].click();
  out.lockedDoesNothing=g.mode!=='playing'&&!screen.classList.contains('hidden');
  return out;});
if(Object.values(levelMenu).some(v=>!v))throw new Error(`Level menu failed: ${JSON.stringify(levelMenu)}`);
await page.screenshot({path:'artifacts/levels.png'});
const levelReplay=await page.evaluate(()=>{const g=window.__nightStation,out={};
  const tiles=[...document.querySelectorAll('.level-tile')];
  tiles[2].click();
  out.replayStarts=g.mode==='playing'&&g.shiftConfig.number===3&&document.querySelector('#levels').classList.contains('hidden');
  out.hudFollows=document.querySelector('#shift-label').textContent==='УРОВЕНЬ 3 / 30';
  g.served=g.shiftConfig.goal.served;g.state.money+=400;g.finishShift();
  out.replayKeepsProgress=g.state.levelsCleared===9;
  g.showMenu();document.querySelector('#continue-btn').click();
  out.continueGoesToCurrent=g.shiftConfig.number===10&&g.mode==='playing';
  // Закрыть экран выбора — вернуться туда, откуда его открыли.
  g.finishShift();g.openLevels('results');g.closeLevels();
  out.returnsToResults=!document.querySelector('#results').classList.contains('hidden')&&document.querySelector('#levels').classList.contains('hidden');
  g.openLevels('menu');g.closeLevels();
  out.returnsToMenu=!document.querySelector('#menu').classList.contains('hidden')&&g.mode==='menu';
  return out;});
if(Object.values(levelReplay).some(v=>!v))throw new Error(`Level replay failed: ${JSON.stringify(levelReplay)}`);
const levelMenuEndless=await page.evaluate(()=>{const g=window.__nightStation,out={};
  g.setState({...g.state,shift:30,levelsCleared:30,campaignComplete:true});
  g.openLevels('menu');
  out.everythingOpen=[...document.querySelectorAll('.level-tile')].every(tile=>!tile.disabled);
  out.endlessOffered=!document.querySelector('#levels-endless').classList.contains('hidden');
  document.querySelector('#levels-endless').click();
  out.endlessStarts=g.mode==='playing'&&g.state.playMode==='endless'&&document.querySelector('#levels').classList.contains('hidden');
  out.campaignRemembered=g.state.levelsCleared===30;
  g.setState({saveVersion:3,shift:1,levelsCleared:0,money:0,tutorial:true,sound:true,musicVolume:80,best:0});
  out.backToCampaign=g.state.playMode==='campaign';
  return out;});
if(Object.values(levelMenuEndless).some(v=>!v))throw new Error(`Level menu endless entry failed: ${JSON.stringify(levelMenuEndless)}`);
const trafficJams=await page.evaluate(async()=>{const g=window.__nightStation,out={};
  const {ROAD,REVERSE_REACH}=await import('/src/traffic.js');
  g.setState({...g.state,shift:12,campaignComplete:false});g.startShift();
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];g.traffic.slice().forEach(c=>g.despawn(c,g.traffic));g.traffic=[];
  g.pumps.forEach(p=>{p.car=null;p.broken=false;p.closed=false;p.departingCar=null});
  // Выезд ждёт только тех, кто действительно едет по его полосе.
  const leaver=(g.spawnCar(),g.cars.at(-1));leaver.side=-1;leaver.slotX=g.pumps[0].slotX;
  leaver.group.position.set(leaver.slotX-REVERSE_REACH,-.05,-10.5);
  const blocker=(g.spawnCar(),g.cars.at(-1));
  out.twoCars=!!leaver&&!!blocker&&leaver!==blocker;
  // Помеха стоит ровно в точке вливания на ближней полосе — той, куда выезжает leaver.
  const mergeX=leaver.slotX-REVERSE_REACH+22;
  blocker.group.position.set(mergeX,-.05,ROAD.near);blocker.stall=0;blocker.blockedByVehicle=null;
  out.busyLaneHolds=!g.mergeClear(leaver);
  blocker.stall=30;out.stalledLaneIgnored=g.mergeClear(leaver);
  blocker.stall=0;blocker.blockedByVehicle=leaver;out.mutualWaitIgnored=g.mergeClear(leaver);
  blocker.blockedByVehicle=null;blocker.group.position.set(mergeX+40,-.05,ROAD.near);
  out.farLaneIgnored=g.mergeClear(leaver);
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];
  // Голова очереди, застрявшая на въезде, не должна морозить всю очередь.
  g.spawnCar();g.spawnCar();
  const [head,second]=g.cars;
  if(head&&second){
    head.status='entering';head.phase='joiningQueue';head.stall=0;
    second.status='queueing';second.phase='queued';second.stall=0;
    out.waitsForHead=!g.dispatchQueuedCars()&&second.pump===null;
    head.stall=30;
    out.skipsStuckHead=g.dispatchQueuedCars()&&!!second.pump;
  }
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];g.pumps.forEach(p=>p.car=null);
  return out;});
if(Object.values(trafficJams).some(v=>!v))throw new Error(`Traffic jam rules failed: ${JSON.stringify(trafficJams)}`);
const shopCustomers=await page.evaluate(()=>{const g=window.__nightStation,out={};
  const hold=(check,max=400)=>{g.actionLatched=false;g.actionHeld=true;for(let i=0;i<max&&!check();i++)g.updateInteraction(.05);g.actionHeld=false;g.actionLatched=false;return check()};
  const reach=job=>{const p=job.pos();for(let r=.6;r<=2.1;r+=.12)for(let i=0;i<28;i++){const a=i/28*Math.PI*2,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(g.isBlocked(x,z))continue;g.player.position.set(x,.26,z);g.yaw=Math.atan2(-(p.x-x),-(p.z-z));g.updateInteraction(0);if(g.nearest===job)return true}return false};
  const walk=(steps=1500,done=()=>false)=>{for(let i=0;i<steps&&!done();i++)g.updateCustomers(.05);return done()};
  g.setState({...g.state,shift:14,campaignComplete:false});g.startShift();
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];g.traffic.slice().forEach(c=>g.despawn(c,g.traffic));g.traffic=[];
  g.stock={coffee:5,snack:5,hotdog:5,soda:5};g.updateHud();
  g.shiftConfig={...g.shiftConfig,orderIntensity:1};
  // Водитель выходит из машины сразу, не дожидаясь заправки.
  g.spawnCar();const car=g.cars[0];
  for(let i=0;i<2200&&car.status!=='waiting';i++)g.updateCars(.05);
  out.parked=car.status==='waiting';
  // Из легковой может выйти и спутник: этот сценарий про одного, лишних отправляем назад.
  g.customers.slice(1).forEach(extra=>g.despawnCustomer(extra));
  const rider=g.customers[0];
  out.customerSent=!!rider&&g.customers.length===1&&rider.state==='walkingIn'&&car.customers.includes(rider);
  // Уходит именно тот, кто сидел за рулём: салон остаётся пустым.
  out.seatEmpties=car.seats.length>0&&car.seats[0].meshes.every(mesh=>!mesh.visible);
  out.customerWearsTheSeat=rider.group.getObjectByName('Body')?.material.color.getHex()===car.seats[0].coat;
  // Сквозь покупателя не проходят, но из него всегда можно выйти.
  {const customer=rider,saved=customer.position.clone();
   customer.position.set(1.2,.26,-1.6);
   g.player.position.set(0,.26,-4);
   out.customerBlocks=g.isBlocked(1.2,-1.6)&&g.isBlocked(1.55,-1.6);
   g.player.position.set(1.2,.26,-1.6);
   out.customerLetsOut=!g.isBlocked(1.55,-1.6);
   customer.position.copy(saved);g.player.position.set(0,.26,-4)}
  out.fuelJobWaits=g.jobs.some(j=>j.car===car&&j.kind==='hose-pickup');
  out.walksIn=walk(1600,()=>g.customers[0]?.state==='waiting');
  const customer=g.customers[0];
  out.atCounter=!!customer&&customer.position.z>-2.3&&customer.position.z<0&&Math.abs(customer.position.x)<3;
  const prep=g.jobs.find(j=>j.tag==='order-prep');
  out.orderAppears=!!prep&&prep.kind==='order';
  out.prepReachable=!!prep&&reach(prep);
  const item=g.shiftConfig.orderMenu.includes(customer.order)&&customer.order;
  out.knownItem=!!item;
  const stockBefore=g.stock[customer.order];
  out.prepared=hold(()=>!!g.carry)&&g.hands.current===g.carry;
  out.stockSpent=g.stock[customer.order]===stockBefore-1;
  const give=g.jobs.find(j=>j.tag==='order-give');
  out.handoverAtCounter=!!give&&Math.abs(give.pos().z-.52)<.01&&give.need===g.carry;
  out.giveReachable=!!give&&reach(give);
  const money=g.state.money;
  out.handed=hold(()=>g.carry===null)&&g.state.money>money;
  out.customerLeaves=customer.state==='walkingOut';
  // Машина ждёт своего покупателя и уезжает только вместе с ним.
  car.fueled=true;g.releaseCar(car);
  out.waitsForCustomer=car.status==='waiting';
  out.customerReturns=walk(1600,()=>g.customers.length===0)&&car.customerDone===true;
  out.seatFilledAgain=car.seats[0].meshes.every(mesh=>mesh.visible);
  out.servedCounted=g.served===1;
  g.leaveCar(car);for(let i=0;i<60;i++)g.updateCars(.05);
  out.carLeaves=car.status==='leaving';
  // Пустая полка не даёт приготовить, но сразу ставит задачу пополнения.
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];g.clearCustomers();
  g.jobs=g.jobs.filter(j=>j.hidden);g.carry=null;g.updateCarry();
  g.stock={coffee:0,snack:5,hotdog:5,soda:5};g.updateHud();
  g.spawnCar();const thirsty=g.cars[0];thirsty.pump=g.pumps[0];thirsty.side=-1;thirsty.group.position.set(-4.85,-.05,-7.4);
  const guest=g.sendCustomer(thirsty,'coffee');
  out.secondCustomer=!!guest;
  walk(1600,()=>guest.state==='waiting');
  g.addCounterOrder(guest);
  const dry=g.jobs.find(j=>j.tag==='order-prep');
  out.emptyShelfBlocks=!!dry&&reach(dry)&&!hold(()=>!!g.carry,80)&&g.jobs.some(j=>j.tag==='restock-coffee-pick');
  // Покупатель уходит недовольным, если заказ не выдали.
  const lostBefore=g.lost;
  dry.onFail();
  out.lostCustomer=g.lost===lostBefore+1&&guest.state==='walkingOut';
  walk(1600,()=>g.customers.length===0);
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];g.clearCustomers();
  g.stock={coffee:5,snack:5,hotdog:5,soda:5};g.updateHud();
  return out;});
if(Object.values(shopCustomers).some(v=>!v))throw new Error(`Shop customers failed: ${JSON.stringify(shopCustomers)}`);
const messyShop=await page.evaluate(()=>{const g=window.__nightStation,out={};
  const hold=(check,max=400)=>{g.actionLatched=false;g.actionHeld=true;for(let i=0;i<max&&!check();i++)g.updateInteraction(.05);g.actionHeld=false;g.actionLatched=false;return check()};
  const reach=job=>{const p=job.pos(),floor=(p.y??.26)>3?3.68:.26;for(let r=.5;r<=2.1;r+=.12)for(let i=0;i<28;i++){const a=i/28*Math.PI*2,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(g.isBlocked(x,z,null,floor))continue;g.player.position.set(x,floor,z);g.yaw=Math.atan2(-(p.x-x),-(p.z-z));g.updateInteraction(0);if(g.nearest===job)return true}return false};
  g.setState({...g.state,shift:14,campaignComplete:false});g.startShift();
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];g.clearCustomers();
  g.traffic.slice().forEach(c=>g.despawn(c,g.traffic));g.traffic=[];g.jobs=g.jobs.filter(j=>j.hidden);
  g.stock={coffee:5,snack:5,hotdog:5,soda:5};g.carry=null;g.updateCarry();
  g.shiftConfig={...g.shiftConfig,orderIntensity:1,orderMenu:['coffee']};
  g.spawnCar();const car=g.cars.at(-1);
  for(let i=0;i<2600&&car.status!=='waiting';i++)g.updateCars(.05);
  g.customers.slice(1).forEach(extra=>g.despawnCustomer(extra));
  for(let i=0;i<1600&&g.customers[0]?.state!=='waiting';i++)g.updateCustomers(.05);
  const prep=g.jobs.find(j=>j.tag==='order-prep');
  out.orderWaiting=!!prep;
  // Пятно закрывает прилавок целиком: заказ не приготовить, пока пол липкий.
  g.spawnSpill();const spill=g.jobs.find(j=>j.tag==='spill');
  out.spillAppeared=!!spill&&spill.priority>1;
  out.orderBlocked=reach(prep)&&!hold(()=>!!g.carry,80)&&g.carry===null;
  out.promptExplains=document.querySelector('#prompt-subtitle').textContent.includes('пятно');
  // Терпение такого заказа стоит: клиент не виноват, что пол мокрый.
  const patienceBefore=prep.patience;
  for(let i=0;i<20;i++)g.updateJobs(.05);
  out.patiencePaused=Math.abs(prep.patience-patienceBefore)<1e-9;
  // Убрали — и прилавок снова работает.
  g.carry='mop';g.updateCarry();
  out.spillCleaned=reach(spill)&&hold(()=>!g.jobs.includes(spill));
  g.carry=null;g.updateCarry();
  out.orderWorksAgain=reach(prep)&&hold(()=>g.carry==='coffee');
  g.carry=null;g.updateCarry();g.jobs=g.jobs.filter(j=>j.hidden);
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];g.clearCustomers();
  return out;});
if(Object.values(messyShop).some(v=>!v))throw new Error(`Spill closing the shop failed: ${JSON.stringify(messyShop)}`);
const shopMenu=await page.evaluate(()=>{const g=window.__nightStation,out={};
  const hold=(check,max=400)=>{g.actionLatched=false;g.actionHeld=true;for(let i=0;i<max&&!check();i++)g.updateInteraction(.05);g.actionHeld=false;g.actionLatched=false;return check()};
  const reach=job=>{const p=job.pos();for(let r=.6;r<=2.1;r+=.12)for(let i=0;i<28;i++){const a=i/28*Math.PI*2,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(g.isBlocked(x,z))continue;g.player.position.set(x,.26,z);g.yaw=Math.atan2(-(p.x-x),-(p.z-z));g.updateInteraction(0);if(g.nearest===job)return true}return false};
  const reachUpstairs=job=>{const p=job.pos();for(let r=.6;r<=2.1;r+=.12)for(let i=0;i<28;i++){const a=i/28*Math.PI*2,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(g.isBlocked(x,z,null,3.68))continue;g.player.position.set(x,3.68,z);g.yaw=Math.atan2(-(p.x-x),-(p.z-z));g.updateInteraction(0);if(g.nearest===job)return true}return false};
  g.setState({...g.state,shift:30,campaignComplete:false});g.startShift();
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];g.clearCustomers();
  g.jobs=g.jobs.filter(j=>j.hidden);
  // Каждый товар готовится в своём месте и попадает в руки.
  out.items={};
  for(const id of ['coffee','snack','hotdog','soda']){
    g.stock={coffee:5,snack:5,hotdog:5,soda:5};g.carry=null;g.updateCarry();g.updateHud();
    const car={side:1,patience:60,group:{position:{x:-4.85,y:0,z:-7.4}}};
    const guest=g.sendCustomer(car,id);
    guest.state='waiting';guest.setPath([]);guest.position.copy(g.counterPoint(guest)).setY(.26);
    g.addCounterOrder(guest);
    const prep=g.jobs.find(j=>j.tag==='order-prep');
    const ok=!!prep&&reach(prep)&&hold(()=>!!g.carry);
    const give=g.jobs.find(j=>j.tag==='order-give');
    const handed=ok&&!!give&&reach(give)&&hold(()=>g.carry===null);
    out.items[id]=ok&&handed;
    g.clearCustomers();g.jobs=g.jobs.filter(j=>j.hidden);
  }
  out.fourItems=Object.values(out.items).every(Boolean)&&Object.keys(out.items).length===4;
  // Газировку пополняют из ящика в подсобке, а не со склада наверху.
  g.stock={coffee:5,snack:5,hotdog:5,soda:0};g.carry=null;g.updateCarry();g.updateHud();
  g.createRestockJob('soda');
  const pick=g.jobs.find(j=>j.tag==='restock-soda-pick');
  out.sodaFromStockRoom=!!pick&&pick.pos().y>3;
  out.sodaTaken=!!pick&&reachUpstairs(pick)&&hold(()=>g.carry==='sodaBox');
  const put=g.jobs.find(j=>j.tag==='restock-soda-put');
  out.sodaFilled=!!put&&reach(put)&&hold(()=>g.stock.soda===5)&&g.carry===null;
  // Хот-доги живут на своей полке и пополняются оттуда же.
  g.stock={coffee:5,snack:5,hotdog:0,soda:5};g.carry=null;g.updateCarry();g.updateHud();
  g.createRestockJob('hotdog');
  const grillPick=g.jobs.find(j=>j.tag==='restock-hotdog-pick');
  out.hotdogOwnStock=!!grillPick&&grillPick.pos().y>3&&reachUpstairs(grillPick)&&hold(()=>g.carry==='hotdogBox');
  const grillPut=g.jobs.find(j=>j.tag==='restock-hotdog-put');
  out.hotdogFilled=!!grillPut&&reach(grillPut)&&hold(()=>g.stock.hotdog===5)&&g.stock.snack===5;
  out.hudShowsSoda=document.querySelector('#stock-soda').textContent==='5/5'&&!document.querySelector('#soda-chip').classList.contains('hidden')&&!document.querySelector('#hotdog-chip').classList.contains('hidden');
  // Витрины пустеют вместе с запасом.
  const cans=g.shelfVisuals.soda.filter(o=>o.visible).length;
  g.stock.soda=1;g.renderShelves();
  out.shelvesDrain=g.shelfVisuals.soda.filter(o=>o.visible).length<cans&&g.shelfVisuals.soda.length>0;
  g.stock.soda=5;g.renderShelves();
  out.shelvesRefill=g.shelfVisuals.soda.filter(o=>o.visible).length===cans;
  return out;});
if(Object.entries(shopMenu).some(([key,value])=>key!=='items'&&!value))throw new Error(`Shop menu failed: ${JSON.stringify(shopMenu)}`);
const thirdBay=await page.evaluate(()=>{const g=window.__nightStation,out={};
  const startLevel=number=>{g.setState({...g.state,shift:number,campaignComplete:false});g.startShift();g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];g.traffic.slice().forEach(c=>g.despawn(c,g.traffic));g.traffic=[]};
  // Двенадцатый уровень открывает левый пост: три таблички «ЗАКРЫТО» гаснут все разом.
  startLevel(11);out.closedBeforeUnlock=g.pumps[2].closed===true&&g.closedSigns[2].visible===true;
  startLevel(12);out.openAfterUnlock=g.pumps.every(p=>!p.closed)&&g.closedSigns.every(sign=>!sign.visible);
  // Третий пост берёт машину только когда первые два заняты, и она реально доезжает.
  g.pumps[0].car={};g.pumps[1].car={};
  g.spawnCar();const car=g.cars.at(-1);
  for(let i=0;i<2400&&car.status!=='waiting';i++)g.updateCars(.05);
  out.servesQueue=car.pump===g.pumps[2]&&car.status==='waiting';
  out.parkedLeft=Math.abs(car.group.position.x-g.pumps[2].slotX)<.6&&Math.abs(car.group.position.z+7.4)<.6;
  out.jobNumbered=g.jobs.some(j=>j.car===car&&g.jobLabel(j).includes('3'));
  out.spotReachable=(()=>{for(let r=.6;r<=1.8;r+=.12)for(let i=0;i<24;i++){const a=i/24*Math.PI*2;if(!g.isBlocked(car.spot.x+Math.cos(a)*r,car.spot.z+Math.sin(a)*r))return true}return false})();
  g.pumps.forEach(p=>p.car=null);g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];
  return out;});
if(Object.values(thirdBay).some(v=>!v))throw new Error(`Third bay failed: ${JSON.stringify(thirdBay)}`);
const fuelDelivery=await page.evaluate(()=>{const g=window.__nightStation,out={};
  const hold=(check,max=400)=>{g.actionLatched=false;g.actionHeld=true;for(let i=0;i<max&&!check();i++)g.updateInteraction(.05);g.actionHeld=false;g.actionLatched=false;return check()};
  const reach=job=>{const p=job.pos();for(let r=.6;r<=2.1;r+=.12)for(let i=0;i<28;i++){const a=i/28*Math.PI*2,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(g.isBlocked(x,z))continue;g.player.position.set(x,.26,z);g.yaw=Math.atan2(-(p.x-x),-(p.z-z));g.updateInteraction(0);if(g.nearest===job)return true}return false};
  g.setState({...g.state,shift:19,campaignComplete:false});g.startShift();
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];g.traffic.slice().forEach(c=>g.despawn(c,g.traffic));g.traffic=[];
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  out.reserveCounted=g.fuelMax===19&&g.fuelLeft===19||g.fuelMax===g.shiftConfig.fuelReserve&&g.fuelLeft===g.fuelMax;
  out.hudShowsFuel=!document.querySelector('#fuel-chip').classList.contains('hidden')&&document.querySelector('#stock-fuel').textContent===`${g.fuelMax}/${g.fuelMax}`;
  // Пустой резервуар останавливает заправку и объясняет, почему.
  g.fuelLeft=0;g.pumps[1].car={};g.pumps[2].car={};g.spawnCar();const car=g.cars[0];
  for(let i=0;i<2000&&car.status!=='waiting';i++)g.updateCars(.05);
  const pickup=g.jobs.find(j=>j.car===car&&j.kind==='hose-pickup');
  out.dryJobReachable=!!pickup&&reach(pickup);
  out.dryBlocks=!hold(()=>g.carry==='hose',80)&&document.querySelector('#prompt-subtitle').textContent.includes('резервуаре пусто');
  g.leaveCar(car);g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];g.pumps.forEach(p=>p.car=null);
  // Бензовоз приезжает, занимает третий пост и отдаёт топливо в горловину.
  out.arrives=g.runEvent('tanker')&&!!g.tanker;
  for(let i=0;i<2600&&g.tanker&&g.tanker.status==='entering';i++)g.updateCars(.05);
  out.parks=!!g.tanker&&g.tanker.status==='waiting'&&Math.abs(g.tanker.group.position.x+12.4)<.7;
  out.bayHeld=g.pumps[2].closed===true&&g.closedSigns[2].visible===true;
  out.noSecondTanker=!g.canRunEvent('tanker')&&!g.canRunEvent('van');
  const hoseJob=g.jobs.find(j=>j.tag==='tanker-hose');
  out.hoseJobReachable=!!hoseJob&&reach(hoseJob);
  out.takesHose=hold(()=>g.carry==='tankerHose')&&g.hands.current==='tankerHose';
  const fillJob=g.jobs.find(j=>j.tag==='tanker-fill');
  out.fillNeedsHose=!!fillJob&&fillJob.need==='tankerHose';
  out.fillReachable=!!fillJob&&reach(fillJob);
  const money=g.state.money,tankers=g.state.stats.tankers||0;
  out.refills=hold(()=>g.fuelLeft===g.fuelMax)&&g.state.money>money&&g.carry===null;
  out.counted=g.state.stats.tankers===tankers+1;
  out.hudUpdated=document.querySelector('#stock-fuel').textContent===`${g.fuelMax}/${g.fuelMax}`;
  for(let i=0;i<4000&&g.tanker;i++)g.updateCars(.05);
  out.leaves=!g.tanker&&!g.jobs.some(j=>j.tag&&j.tag.startsWith('tanker'));
  out.bayReopened=g.pumps[2].closed===false&&g.closedSigns[2].visible===false;
  // Там, где топливо не считают, бензовозу делать нечего.
  g.setState({...g.state,shift:11,campaignComplete:false});g.startShift();
  out.noFuelNoTanker=g.fuelMax===null&&!g.canRunEvent('tanker')&&document.querySelector('#fuel-chip').classList.contains('hidden');
  out.unlimitedFuel=g.hasFuel();
  return out;});
if(Object.values(fuelDelivery).some(v=>!v))throw new Error(`Fuel delivery failed: ${JSON.stringify(fuelDelivery)}`);
const hurriedClients=await page.evaluate(()=>{const g=window.__nightStation,out={};
  g.setState({...g.state,shift:26,campaignComplete:false});g.startShift();
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];
  out.levelHasHurry=g.shiftConfig.hurryChance>0;
  g.shiftConfig={...g.shiftConfig,hurryChance:1};g.spawnCar();const car=g.cars.at(-1);
  out.marked=car.hurry===true&&car.patience<g.shiftConfig.customerPatience&&car.patience>15;
  const bodies=[];car.group.traverse(o=>{if(o.isMesh&&o.name.startsWith('CarBody'))bodies.push(o.material.color.getHex())});
  out.painted=bodies.length>0&&bodies.every(hex=>hex===0xe3a81c);
  out.paysMore=g.payout(100,car)>100&&g.payout(100,{})===100;
  const served=g.state.stats.hurried||0;g.countServed(car);
  out.counted=g.state.stats.hurried===served+1&&g.served===1;
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];
  g.shiftConfig={...g.shiftConfig,hurryChance:0};
  const spawnedCalm=g.spawnCar(),calm=g.cars.at(-1);
  out.calmUntouched=spawnedCalm&&calm.hurry===false&&calm.patience===g.shiftConfig.customerPatience&&g.payout(100,calm)===100;
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];
  return out;});
if(Object.values(hurriedClients).some(v=>!v))throw new Error(`Hurried clients failed: ${JSON.stringify(hurriedClients)}`);
const nightWeather=await page.evaluate(()=>{const g=window.__nightStation,out={};
  const startLevel=number=>{g.setState({...g.state,shift:number,campaignComplete:false});g.startShift()};
  startLevel(25);
  out.rain=g.weather==='rain'&&g.rain.points.visible&&g.scene.fog.density>.028&&g.sky.group.visible;
  // Часть капель каждый кадр уходит на новый круг, поэтому смотрим на большинство, а не на все.
  const heights=[...Array(40)].map((_,i)=>g.rain.positions[i*6+1]);g.updateRain(.05);
  const fell=heights.filter((y,i)=>g.rain.positions[i*6+1]<y).length;
  out.rainFalls=fell>=Math.ceil(heights.length*.8)&&Math.abs(g.rain.points.position.x-g.camera.position.x)<.001;
  out.wetGround=g.groundMats.every(material=>material.roughness<.5);
  startLevel(28);
  out.fog=g.weather==='fog'&&!g.rain.points.visible&&g.scene.fog.density>.05&&!g.sky.group.visible&&g.groundMats.every(m=>m.roughness>.9);
  startLevel(1);
  out.clear=g.weather==='clear'&&!g.rain.points.visible&&g.sky.group.visible&&Math.abs(g.scene.fog.density-.022)<1e-9;
  // Темнота гасит свет поверх любой погоды и возвращает именно её уровень.
  startLevel(25);const lit=g.hemi.intensity;g.eventBlackout();
  out.blackoutDims=g.hemi.intensity<lit;
  g.setBlackout(false);out.weatherRestored=Math.abs(g.hemi.intensity-lit)<1e-9;
  g.showMenu();out.menuIsClear=g.weather==='clear'&&!g.rain.points.visible;
  return out;});
if(Object.values(nightWeather).some(v=>!v))throw new Error(`Weather failed: ${JSON.stringify(nightWeather)}`);
const dawnSky=await page.evaluate(()=>{const g=window.__nightStation,out={};
  g.setState({...g.state,shift:5,levelsCleared:4,campaignComplete:false});g.startShift();
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];
  const stars=g.sky.starLayers,glow=g.sky.dawnParts;
  const nightFog=g.scene.fog.color.getHex(),nightDensity=g.scene.fog.density,nightHemi=g.hemi.intensity;
  const nightStars=stars.map(layer=>layer.material.opacity);
  out.startsAtNight=g.dawn===0&&g.sky.dawn===0&&nightStars.every(value=>value>.3);
  out.horizonDarkAtNight=glow.every(sprite=>!sprite.visible||sprite.material.opacity<.001);
  // Середина смены — всё ещё ночь: небо не меняется само по себе.
  g.elapsed=g.shiftLength-90;g.updatePlay(.05);
  out.middleIsNight=g.dawn===0&&g.scene.fog.color.getHex()===nightFog&&g.scene.fog.density===nightDensity;
  // Последняя минута: рассвет считается от остатка времени.
  g.elapsed=g.shiftLength-30;g.updatePlay(.05);
  out.dawnStarts=g.dawn>.45&&g.dawn<.55&&Math.abs(g.sky.dawn-g.dawn)<1e-9;
  out.starsDim=stars.every((layer,i)=>layer.material.opacity<nightStars[i]);
  out.horizonWarms=glow[0].visible&&glow[0].material.opacity>0;
  // Момент закрытия смены: звёзды погасли, горизонт горит, ночь отступила.
  g.elapsed=g.shiftLength-.1;g.updatePlay(.05);
  out.fullDawn=g.dawn>.99;
  out.starsOut=stars.every(layer=>layer.material.opacity<.02);
  out.moonPales=g.sky.group.children.some(child=>child.isGroup&&child.children.some(part=>part.isMesh&&part.material.opacity<.4));
  out.horizonBurns=glow.every(sprite=>sprite.visible&&sprite.material.opacity>.05);
  out.skyLightens=g.scene.fog.color.getHex()!==nightFog&&g.scene.fog.density<nightDensity&&g.hemi.intensity>nightHemi+.5;
  // Следующая смена начинается снова ночью.
  g.startShift();
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];
  out.nextNightResets=g.dawn===0&&g.sky.dawn===0&&g.scene.fog.color.getHex()===nightFog
    &&Math.abs(g.scene.fog.density-nightDensity)<1e-9&&Math.abs(g.hemi.intensity-nightHemi)<1e-9
    &&stars.every((layer,i)=>Math.abs(layer.material.opacity-nightStars[i])<.2);
  // Темнота сильнее рассвета: щиток гасит свет в любое время суток.
  g.elapsed=g.shiftLength-10;g.updatePlay(.05);
  const dawnHemi=g.hemi.intensity;
  g.eventBlackout();
  out.blackoutStillDark=g.hemi.intensity<dawnHemi;
  g.setBlackout(false);g.blackout=false;g.jobs=g.jobs.filter(j=>j.tag!=='blackout');
  g.setState({...g.state,shift:1,levelsCleared:0});g.startShift();
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];
  return out;});
if(Object.values(dawnSky).some(v=>!v))throw new Error(`Dawn failed: ${JSON.stringify(dawnSky)}`);
const levelTags=await page.evaluate(()=>{const g=window.__nightStation,out={};
  g.setState({...g.state,levelsCleared:30,campaignComplete:true});g.openLevels('menu');
  const tiles=[...document.querySelectorAll('.level-tile')];
  out.everyTileExplained=tiles.every(tile=>tile.querySelectorAll('.level-tags i').length>0);
  const tagsOf=number=>[...tiles[number-1].querySelectorAll('.level-tags i')].map(i=>i.textContent);
  out.thirdBayShown=tagsOf(12).includes('3 поста');
  out.rainShown=tagsOf(4).includes('дождь');
  out.tankerShown=tagsOf(18).includes('бензовоз');
  out.hurryShown=tagsOf(13).includes('спешат');
  out.tagsDiffer=new Set(tiles.map(tile=>tile.querySelector('.level-tags').textContent)).size>=12;
  g.closeLevels();
  return out;});
if(Object.values(levelTags).some(v=>!v))throw new Error(`Level tags failed: ${JSON.stringify(levelTags)}`);
const stationEconomy=await page.evaluate(async()=>{
  const g=window.__nightStation,out={};
  const {UPGRADES,UPGRADE_COUNT,getUpgrade}=await import('/src/content/upgrades.js');
  const wallet=(money,owned,cleared=20,shift=12)=>g.setState({...g.state,money,upgrades:owned,levelsCleared:cleared,shift});

  // Витрина: всё на месте, дорогое не купить, купленное не купить дважды.
  wallet(0,[]);
  g.openStation('menu');
  out.screenOpens=!document.querySelector('#station').classList.contains('hidden')
    &&document.querySelectorAll('#station-grid .upgrade').length===UPGRADE_COUNT;
  out.walletShown=document.querySelector('#station-money').textContent==='₽0';
  out.poorCannotBuy=!g.buyUpgrade('boots')&&g.state.upgrades.length===0;
  const boots=getUpgrade('boots');
  wallet(boots.cost+300,[]);g.renderStation();
  out.buys=g.buyUpgrade('boots')&&g.state.upgrades.includes('boots')&&g.state.money===300;
  out.boughtOnce=!g.buyUpgrade('boots')&&g.state.upgrades.filter(id=>id==='boots').length===1;
  out.savedToDisk=JSON.parse(localStorage.getItem('night-gas-station-save-v1')||'{}')?.upgrades?.includes('boots')===true;
  // До своей ночи улучшение не продают, даже если денег хватает.
  wallet(99999,[],0,1);
  out.lockedNotSold=!g.buyUpgrade('cart')&&!g.state.upgrades.includes('cart');
  g.closeStation();

  // Третий пост: выкупленный открывается, но не в ночь про аварию.
  wallet(0,[],20,11);g.startShift();
  out.bayClosedWithout=g.shiftConfig.pumpsOnline===2&&g.pumps[2].closed===true;
  wallet(0,['thirdBay'],20,11);g.startShift();
  out.bayOpenWith=g.shiftConfig.pumpsOnline===3&&g.pumps[2].closed===false;
  wallet(0,['thirdBay'],20,17);g.startShift();
  out.bayLockHolds=g.shiftConfig.pumpsOnline===1&&g.pumps[2].closed===true;

  // Прожекторы и щит видно на площадке, а не только в формуле.
  wallet(0,[],20,11);g.startShift();
  out.propsHiddenWithout=g.upgradeVisuals.floodlights.every(o=>!o.visible)
    &&g.upgradeVisuals.roadSign.every(o=>!o.visible)
    &&g.upgradeVisuals.coffeeBar.every(o=>!o.visible)
    &&g.upgradeVisuals.cart.every(o=>!o.visible)
    &&g.floodLights.every(light=>light.intensity===0);
  const plainPatience=g.shiftConfig.customerPatience,plainInterval=g.shiftConfig.carSpawn.interval[0];
  wallet(0,['floodlights','roadSign'],20,11);g.startShift();
  out.propsAppear=g.upgradeVisuals.floodlights.every(o=>o.visible)&&g.upgradeVisuals.roadSign.every(o=>o.visible);
  out.floodlightsLit=g.floodLights.every(light=>light.intensity>0)&&g.baseHemi>1.9;
  out.nightChanges=g.shiftConfig.customerPatience>plainPatience&&g.shiftConfig.carSpawn.interval[0]<plainInterval;

  // Вторая кофемашина и скоростные насосы меняют длительность работы.
  const orderDuration=()=>{
    g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];g.clearCustomers();
    g.jobs=g.jobs.filter(j=>j.hidden);g.stock={coffee:5,snack:5,hotdog:5,soda:5};
    g.shiftConfig={...g.shiftConfig,orderIntensity:1,orderMenu:['coffee']};
    const car={side:1,patience:60,type:{orders:1,groupChance:0},group:{position:{x:-4.85,y:0,z:-7.4}}};
    const guest=g.sendCustomer(car,'coffee',0);guest.state='waiting';g.addCounterOrder(guest);
    const job=g.jobs.find(j=>j.tag==='order-prep');const duration=job?.duration??0;
    g.jobs=g.jobs.filter(j=>j.hidden);g.clearCustomers();
    return duration;
  };
  wallet(0,[],20,14);g.startShift();const slowCoffee=orderDuration();
  wallet(0,['coffeeBar'],20,14);g.startShift();const fastCoffee=orderDuration();
  out.coffeeBarIsFaster=slowCoffee>0&&fastCoffee<slowCoffee*.75;
  out.secondMachineVisible=g.upgradeVisuals.coffeeBar.every(o=>o.visible);

  const fuelDuration=()=>{
    g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];g.jobs=g.jobs.filter(j=>j.hidden);
    g.pumps.forEach(p=>{p.car=null;p.departingCar=null});
    g.shiftConfig={...g.shiftConfig,fleet:{car:1},orderIntensity:0};
    g.spawnCar();const car=g.cars.at(-1);
    for(let i=0;i<3000&&car.status!=='waiting';i++)g.updateCars(.05);
    const pickup=g.jobs.find(j=>j.car===car&&j.kind==='hose-pickup');
    if(!pickup)return 0;
    g.removeJob(pickup);pickup.onComplete();
    const action=g.jobs.find(j=>j.car===car&&j.kind==='fuel');const duration=action?.duration??0;
    g.returnFuelHose(car);g.jobs=g.jobs.filter(j=>j.hidden);
    g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];g.pumps.forEach(p=>{p.car=null;p.departingCar=null});
    return duration;
  };
  wallet(0,[],20,14);g.startShift();const slowFuel=fuelDuration();
  wallet(0,['fastPumps'],20,14);g.startShift();const fastFuel=fuelDuration();
  out.fastPumpsAreFaster=slowFuel>0&&fastFuel>0&&fastFuel<slowFuel*.8;

  // Тележка: один подъём вместо четырёх.
  wallet(0,['cart'],20,14);g.startShift();
  g.jobs=g.jobs.filter(j=>j.hidden);g.carry=null;g.updateCarry();
  g.stock={coffee:0,snack:0,hotdog:2,soda:5};g.updateHud();
  out.cartVisible=g.upgradeVisuals.cart.every(o=>o.visible);
  g.createRestockJob('coffee');
  const pick=g.jobs.find(j=>j.tag==='restock-coffee-pick');
  out.cartPickExists=!!pick;
  g.removeJob(pick);pick.onComplete();
  out.cartLoaded=g.carry==='cart'&&g.cartLoad.length===3&&g.hands.current==='cart';
  const put=g.jobs.find(j=>j.tag==='restock-cart-put');
  out.cartHasOneTrip=!!put&&!g.jobs.some(j=>j.tag?.endsWith?.('-put')&&j!==put);
  g.removeJob(put);put.onComplete();
  out.cartFillsEverything=g.stock.coffee===5&&g.stock.snack===5&&g.stock.hotdog===5&&g.carry===null;
  // Без тележки всё как было: одна коробка — один запас.
  wallet(0,[],20,14);g.startShift();
  g.jobs=g.jobs.filter(j=>j.hidden);g.carry=null;g.updateCarry();g.stock={coffee:0,snack:0,hotdog:5,soda:5};
  g.createRestockJob('coffee');
  const single=g.jobs.find(j=>j.tag==='restock-coffee-pick');
  g.removeJob(single);single.onComplete();
  out.plainBoxStillWorks=g.carry==='coffeeBox';
  const singlePut=g.jobs.find(j=>j.tag==='restock-coffee-put');
  g.removeJob(singlePut);singlePut.onComplete();
  out.plainBoxFillsOne=g.stock.coffee===5&&g.stock.snack===0;

  g.carry=null;g.updateCarry();g.jobs=g.jobs.filter(j=>j.hidden);
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];g.clearCustomers();
  g.setState({...g.state,money:0,upgrades:[],levelsCleared:0,shift:1});
  return out;});
if(Object.values(stationEconomy).some(v=>!v))throw new Error(`Station economy failed: ${JSON.stringify(stationEconomy)}`);
const achievementScreen=await page.evaluate(()=>{const g=window.__nightStation,out={};
  g.setState({saveVersion:4,shift:1,levelsCleared:0,money:0,tutorial:true,sound:true,musicVolume:80,best:0,campaignComplete:false,achievements:[],stats:{}});
  g.showMenu();document.querySelector('#achievements-btn').click();
  const screen=document.querySelector('#achievements'),tiles=[...document.querySelectorAll('.achievement')];
  out.opens=!screen.classList.contains('hidden')&&document.querySelector('#menu').classList.contains('hidden');
  out.listsAll=tiles.length>=20;
  out.progressShown=document.querySelector('#achievements-progress').textContent.includes(`0 из ${tiles.length}`);
  out.allLocked=tiles.every(tile=>!tile.classList.contains('done'));
  out.showsTargets=tiles.some(tile=>tile.querySelector('.achievement-count').textContent.includes('/'));
  out.showsBars=tiles.every(tile=>!!tile.querySelector('.achievement-bar i'));
  document.querySelector('#achievements-close').click();
  out.closesToMenu=screen.classList.contains('hidden')&&!document.querySelector('#menu').classList.contains('hidden');
  return out;});
if(Object.values(achievementScreen).some(v=>!v))throw new Error(`Achievement screen failed: ${JSON.stringify(achievementScreen)}`);
const achievementUnlock=await page.evaluate(()=>{const g=window.__nightStation,out={};
  const hold=(check,max=200)=>{g.actionLatched=false;g.actionHeld=true;for(let i=0;i<max&&!check();i++)g.updateInteraction(.05);g.actionHeld=false;g.actionLatched=false;return check()};
  // Встать так, чтобы целью была именно нужная задача: пятно падает в случайное место.
  const reach=job=>{const p=job.pos(),floor=(p.y??.26)>3?3.68:.26;for(let r=.5;r<=1.3;r+=.1)for(let i=0;i<24;i++){const a=i/24*Math.PI*2,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(g.isBlocked(x,z,null,floor))continue;g.player.position.set(x,floor,z);g.yaw=Math.atan2(-(p.x-x),-(p.z-z));g.updateInteraction(0);if(g.nearest===job)return true}return false};
  g.setState({...g.state,shift:4,campaignComplete:false});g.startShift();
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  // Уборка десятого пятна закрывает «Чистый пол».
  g.state.stats.spills=9;g.carry=null;g.updateCarry();
  g.spawnSpill();const spill=g.jobs.find(j=>j.tag==='spill');
  out.tookMop=reach(g.jobs.find(j=>j.tag==='stand-mop'))&&hold(()=>g.carry==='mop');
  out.cleaned=reach(spill)&&hold(()=>!g.jobs.includes(spill))&&g.state.stats.spills===10;
  out.unlocked=g.state.achievements.includes('clean-floor');
  const toast=document.querySelector('.toast.achievement-toast');
  out.announced=!!toast&&toast.textContent.includes('Чистый пол');
  out.notRepeated=g.checkAchievements().length===0;
  // Сотый прыжок закрывает «Разминку».
  g.state.stats.jumps=99;g.resetJump();g.keys.Space=true;g.updateJump(1/60);g.keys.Space=false;
  for(let i=0;i<200&&!g.grounded;i++)g.updateJump(1/60);
  out.jumpCounted=g.state.stats.jumps===100&&g.state.achievements.includes('warm-up');
  // Итоги смены пополняют счётчики и отмечают ночь без потерь.
  const shifts=g.state.stats.shifts;g.served=g.shiftConfig.goal.served;g.lost=0;g.state.money+=300;g.finishShift();
  out.shiftCounted=g.state.stats.shifts===shifts+1&&g.state.stats.earned>=300&&g.state.stats.flawless>=1;
  out.flawlessUnlocked=g.state.achievements.includes('flawless');
  // Заслуженное в прошлых версиях выдаётся молча при загрузке сейва.
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  g.setState({saveVersion:3,shift:13,levelsCleared:12,best:900,money:500,tutorial:true,sound:true,musicVolume:80});
  out.retroGranted=g.state.achievements.includes('chapter-1')&&g.state.achievements.includes('chapter-2')&&g.state.achievements.includes('good-night');
  out.retroSilent=document.querySelectorAll('.toast.achievement-toast').length===0;
  g.openAchievements('menu');
  const done=[...document.querySelectorAll('.achievement.done')];
  out.screenMarksDone=done.length===g.state.achievements.length&&done.some(tile=>tile.dataset.achievement==='chapter-2');
  out.screenCounts=document.querySelector('#achievements-progress').textContent.startsWith(`${g.state.achievements.length} из`);
  g.closeAchievements();
  return out;});
if(Object.values(achievementUnlock).some(v=>!v))throw new Error(`Achievement unlocking failed: ${JSON.stringify(achievementUnlock)}`);
await page.evaluate(()=>{const g=window.__nightStation;g.setState({...g.state,stats:{refuels:60,coffee:30,snacks:12,spills:10,jumps:100,shifts:9,served:44,earned:5200,rushes:4},levelsCleared:12,best:900});g.openAchievements('menu')});
await page.screenshot({path:'artifacts/achievements.png'});
await page.evaluate(()=>window.__nightStation.closeAchievements());
if(errors.length)throw new Error(`Runtime errors: ${errors.join(' | ')}`);
const vehicleTypes=await page.evaluate(async()=>{
  const g=window.__nightStation,out={};
  const {VEHICLES,rollVehicle,queueOffsets}=await import('/src/content/vehicles.js');
  const {SERVICE_QUEUE}=await import('/src/traffic.js');
  const clear=()=>{g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];
    g.traffic.slice().forEach(c=>g.despawn(c,g.traffic));g.traffic=[];g.clearCustomers();
    g.pumps.forEach(p=>{p.car=null;p.departingCar=null;p.broken=false;p.closed=false;p.reserved=false});
    g.jobs=g.jobs.filter(j=>j.hidden);g.carry=null;g.updateCarry()};
  const park=vehicle=>{for(let i=0;i<4000&&vehicle.status!=='waiting';i++)g.updateCars(.05);return vehicle.status==='waiting'};
  const fuelThrough=car=>{
    const before=g.state.money;
    const pickup=g.jobs.find(j=>j.car===car&&j.kind==='hose-pickup');if(!pickup)return null;
    g.removeJob(pickup);pickup.onComplete();
    const action=g.jobs.find(j=>j.car===car&&j.kind==='fuel');if(!action)return null;
    const duration=action.duration;g.removeJob(action);action.onComplete();
    return {gain:g.state.money-before,duration};
  };
  g.setState({...g.state,shift:20,campaignComplete:false});g.startShift();

  // Фура: левый пост, долгая заправка, двойные деньги и нос, не упирающийся в столбики.
  clear();
  out.truckSpawns=g.spawnBigVehicle(VEHICLES.truck);
  const truck=g.cars.at(-1);
  out.truckSkipsQueue=g.carQueue.length===0;
  out.truckTakesLeftBay=truck.pump===g.pumps[2];
  out.truckIsLong=truck.halfLength>=VEHICLES.car.halfLength*1.6;
  out.truckParks=park(truck);
  out.truckNoseClearsTankPad=truck.group.position.z+truck.halfLength<-3.9;
  out.truckJobNamesIt=(g.jobs.find(j=>j.car===truck&&j.kind==='hose-pickup')?.sub||'').includes('фура');
  out.onlyOneBigAtOnce=!g.bigVehicleReady()&&rollVehicle({truck:1,bus:1},{allowBig:false})==='car';
  const truckRun=fuelThrough(truck);
  out.truckTakesLonger=!!truckRun&&truckRun.duration===VEHICLES.truck.fuelTime;

  // Легковая на том же уровне — мерка для денег и времени.
  clear();
  g.testFleet={car:1};g.shiftConfig={...g.shiftConfig,fleet:{car:1}};
  out.carSpawns=g.spawnCar();
  const car=g.cars.at(-1);
  out.carQueues=g.carQueue.includes(car);
  for(let i=0;i<600&&!car.pump;i++){g.updateCars(.05)}
  out.carParks=park(car);
  const carRun=fuelThrough(car);
  out.truckPaysMore=!!carRun&&!!truckRun&&truckRun.gain>carRun.gain*1.8;
  out.truckStandsLonger=!!carRun&&truckRun.duration>carRun.duration*1.5;

  // Мотоцикл: быстрее, дешевле, в магазин не заходит.
  clear();
  g.shiftConfig={...g.shiftConfig,fleet:{bike:1},orderIntensity:1};
  out.bikeSpawns=g.spawnCar();
  const bike=g.cars.at(-1);
  out.bikeIsSmall=bike.halfLength<VEHICLES.car.halfLength;
  out.bikeWaitsLess=bike.patience<Math.round(g.shiftConfig.customerPatience);
  for(let i=0;i<600&&!bike.pump;i++)g.updateCars(.05);
  out.bikeParks=park(bike);
  g.maybeSendCustomer(bike);
  out.bikeSkipsShop=g.customers.length===0;
  const bikeRun=fuelThrough(bike);
  out.bikeIsQuick=!!bikeRun&&!!carRun&&bikeRun.duration<carRun.duration&&bikeRun.gain<carRun.gain;

  // Автобус: три заказа сразу и отъезд только после последнего покупателя.
  clear();
  g.shiftConfig={...g.shiftConfig,orderIntensity:1,orderMenu:['coffee','snack','hotdog','soda']};
  g.stock={coffee:5,snack:5,hotdog:5,soda:5};
  out.busSpawns=g.spawnBigVehicle(VEHICLES.bus);
  const bus=g.cars.at(-1);
  out.busParks=park(bus);
  out.busBringsThree=g.customers.filter(c=>c.car===bus).length===3;
  out.busSeatsSpread=new Set(g.customers.map(c=>c.slot)).size===3;
  const busRun=fuelThrough(bus);
  out.busFueled=!!busRun&&bus.fueled===true;
  g.releaseCar(bus);
  out.busWaitsForItsPassengers=bus.status!=='leaving';
  g.customers.filter(c=>c.car===bus).forEach(c=>{c.served=true;g.despawnCustomer(c)});
  out.busLeavesWhenEmpty=bus.status==='leaving'||bus.leaveWhenReady===true||g.state.stats.busLoads>0;
  out.fullBusCounted=g.state.stats.busLoads>0;

  // Из легковой выходит и спутник: два заказа с одной машины.
  clear();
  g.shiftConfig={...g.shiftConfig,fleet:{car:1},orderIntensity:1,orderMenu:['coffee']};
  let together=0;
  for(let attempt=0;attempt<14&&together<2;attempt++){
    clear();
    if(!g.spawnCar())continue;
    const rider=g.cars.at(-1);
    for(let i=0;i<3000&&rider.status!=='waiting';i++)g.updateCars(.05);
    together=Math.max(together,g.customers.filter(one=>one.car===rider).length);
  }
  out.carCanBringTwo=together===2;
  out.carHasTwoSeats=VEHICLES.car.orders===2&&VEHICLES.car.groupChance>0;

  // Габариты в очереди: место считается по длине тех, кто уже стоит.
  clear();
  g.shiftConfig={...g.shiftConfig,fleet:{car:1},queueSize:3};
  g.pumps.forEach(p=>p.car={});
  g.spawnCar();const first=g.cars.at(-1);
  for(let i=0;i<90;i++)g.updateCars(.05);
  g.shiftConfig={...g.shiftConfig,fleet:{bike:1}};
  g.spawnCar();const second=g.cars.at(-1);
  out.bothStayInLine=g.carQueue.length===2&&second!==first;
  const expected=queueOffsets([first.halfLength,second.halfLength],SERVICE_QUEUE.gap)[1];
  out.queueUsesRealLengths=Math.abs(second.target.x-(SERVICE_QUEUE.headX+expected))<.001;
  out.shortVehiclePacksCloser=second.target.x-first.target.x<first.halfLength*2+SERVICE_QUEUE.gap+.01;
  g.pumps.forEach(p=>p.car=null);

  // Без третьего поста крупные не приезжают вовсе.
  clear();
  g.pumps[2].closed=true;g.pumps[2].broken=true;
  out.noBigBayNoBigClients=!g.bigVehicleReady()&&!g.spawnBigVehicle(VEHICLES.truck);
  g.pumps[2].closed=false;g.pumps[2].broken=false;
  clear();g.testFleet=null;
  return out;});
if(Object.values(vehicleTypes).some(v=>!v))throw new Error(`Vehicle types failed: ${JSON.stringify(vehicleTypes)}`);
// Очередь — это тоже ожидание: у каждого стоящего тикает свой таймер,
// и, не дождавшись, клиент уезжает сам.
const queueTimer=await page.evaluate(()=>{
  const g=window.__nightStation,out={};
  g.setState({...g.state,shift:12,campaignComplete:false});g.startShift();
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];
  g.traffic.slice().forEach(c=>g.despawn(c,g.traffic));g.traffic=[];
  g.spawnTimer=1e9;g.eventTimer=1e9;g.trafficTimer=1e9;
  g.testFleet={car:1};g.shiftConfig={...g.shiftConfig,fleet:{car:1},queueSize:3};
  const step=n=>{for(let i=0;i<n;i++){g.updateCars(.05);g.updateJobs(.05)}};
  // Посты заняты — приезжие встают в линию.
  g.pumps.forEach(p=>p.car={});
  g.spawnCar();step(220);g.spawnCar();step(220);
  out.lineBuilt=g.carQueue.length===2;
  const waiting=g.jobs.filter(j=>j.kind==='queue');
  out.everyoneHasTimer=waiting.length===g.carQueue.length;
  out.timerRuns=waiting.every(j=>j.patience>0&&j.maxPatience>0&&j.patience<j.maxPatience);
  out.moreRoomThanAtPump=waiting.every(j=>j.maxPatience>j.car.patience);
  out.listedWithBar=[...document.querySelectorAll('#task-list .task')].some(el=>el.textContent.includes('В очереди ждёт')&&el.querySelector('.patience'));
  const spot=g.carQueue[0].group.position,back=g.player.position.clone();
  g.player.position.set(spot.x,.26,spot.z+1.4);g.updateInteraction(0);
  out.nothingToDoWithIt=g.nearest?.kind!=='queue';
  g.player.position.copy(back);
  // Терпение кончилось: машина выезжает из линии вперёд и уходит на трассу.
  const first=g.carQueue[0],second=g.carQueue[1],lost=g.lost,secondTarget=second.target.x,secondJob=second.queueJob,lineZ=first.group.position.z;
  first.queueJob.patience=.04;step(30);
  out.givesUp=first.status==='leaving'&&first.phase==='exiting';
  out.countedAsLost=g.lost===lost+1;
  out.outOfLine=!g.carQueue.includes(first)&&!g.jobs.some(j=>j.car===first);
  out.lineMovesUp=second.target.x<secondTarget-.5;
  let sideways=0;for(let i=0;i<140;i++){step(1);sideways=Math.max(sideways,lineZ-first.group.position.z)}
  out.pullsOutOfTheLine=sideways>1.5;
  step(400);
  out.leavesTheMap=!g.cars.includes(first);
  // Позвали к колонке — таймер очереди снимается, дальше считает терпение у поста.
  g.pumps.forEach(p=>{p.car=null});
  for(let i=0;i<900&&second.status!=='waiting';i++)step(1);
  out.calledToPump=!!second.pump&&second.status==='waiting';
  out.timerHandedOver=!g.jobs.includes(secondJob)&&!second.queueJob&&g.jobs.some(j=>j.car===second&&j.kind!=='queue');
  g.cars.slice().forEach(c=>g.despawn(c,g.cars));g.cars=[];g.carQueue=[];
  g.jobs=g.jobs.filter(j=>j.hidden);g.testFleet=null;
  return out;});
if(Object.values(queueTimer).some(v=>!v))throw new Error(`Queue timer failed: ${JSON.stringify(queueTimer)}`);
// Площадка смотрит на это отдельно: уход со вкладки и рекламный ролик обязаны
// останавливать смену и звук, а кнопка «Продолжить» — возвращать в игру.
const storeBehaviour=await page.evaluate(async()=>{
  const g=window.__nightStation,out={};
  const {AD_COOLDOWN,adCooldownLeft,gameplayStart,gameplayStop,bindAdPause}=await import('/src/gamepush.js');
  g.setState({...g.state,shift:3,campaignComplete:false});g.startShift();
  out.playing=g.mode==='playing';
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
  g.visibility();
  out.pausesWhenHidden=g.mode==='paused';
  out.soundStops=!g.audio?.ctx||g.audio.ctx.state!=='running';
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});
  g.resume();
  out.resumes=g.mode==='playing';
  out.adPauseSafe=(()=>{try{bindAdPause(()=>{});return true}catch{return false}})();
  out.adGapIsThreeMinutes=AD_COOLDOWN>=180000&&adCooldownLeft()===0;
  out.gameplayHooksSafe=(()=>{try{gameplayStart();gameplayStop();return true}catch{return false}})();
  out.soundToggle=!!document.querySelector('#sound-btn');
  const before=g.state.sound;g.toggleSound();out.soundToggleWorks=g.state.sound!==before;g.toggleSound();
  out.noExternalLinks=[...document.querySelectorAll('a[href]')].every(a=>!/^https?:/.test(a.getAttribute('href')));
  out.titleMatchesCard=document.title==='Ночная заправка 3D';
  g.showMenu();
  return out;});
if(Object.values(storeBehaviour).some(v=>!v))throw new Error(`Store readiness failed: ${JSON.stringify(storeBehaviour)}`);
await page.close();
const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const mobile=await mobileContext.newPage();const mobileErrors=[];mobile.on('pageerror',e=>mobileErrors.push(e.message));
await mobile.goto(baseUrl,{waitUntil:'networkidle'});await mobile.locator('#menu:not(.hidden)').waitFor({timeout:30000});
// Вертикальный телефон просят повернуть: смена играется только горизонтально.
const portraitGuard=await mobile.evaluate(()=>({shown:getComputedStyle(document.querySelector('#rotate')).display!=='none',
  covers:!!document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest('#rotate')}));
if(Object.values(portraitGuard).some(v=>!v))throw new Error(`Portrait phones must be asked to rotate: ${JSON.stringify(portraitGuard)}`);
await mobile.screenshot({path:'artifacts/mobile-portrait.png'});
await mobile.setViewportSize({width:844,height:390});
if(await mobile.evaluate(()=>getComputedStyle(document.querySelector('#rotate')).display)!=='none')throw new Error('The rotate screen must disappear in landscape');
await mobile.click('#new-btn');await mobile.click('#tutorial-start');await mobile.locator('#mobile-controls:not(.hidden)').waitFor();
const mobileCanvas=await mobile.locator('#scene').boundingBox();if(!mobileCanvas||mobileCanvas.width!==844)throw new Error('Mobile canvas is not responsive');
await mobile.screenshot({path:'artifacts/mobile.png'});
// Телефон должен именно играться: стик везёт, свайп крутит, кнопка действия работает,
// а долгий тап не зовёт «копировать/вставить».
const mobilePlay=await mobile.evaluate(async()=>{
  const g=window.__nightStation,out={};
  const fire=(el,type,x,y,id=7)=>el.dispatchEvent(new PointerEvent(type,{pointerId:id,clientX:x,clientY:y,bubbles:true,cancelable:true}));
  out.noTextSelection=getComputedStyle(document.body).webkitUserSelect==='none'||getComputedStyle(document.body).userSelect==='none';
  out.contextMenuBlocked=!document.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}));
  out.controlsVisible=!document.querySelector('#mobile-controls').classList.contains('hidden');
  const joystick=document.querySelector('#joystick'),box=joystick.getBoundingClientRect();
  const center={x:box.left+box.width/2,y:box.top+box.height/2};
  const before=g.player.position.clone();
  fire(joystick,'pointerdown',center.x,center.y);
  fire(joystick,'pointermove',center.x,center.y-60);
  out.joystickReads=Math.abs(g.joy.y)>.5;
  for(let i=0;i<20;i++)g.updatePlayer(.05);
  out.joystickMoves=g.player.position.distanceTo(before)>.5;
  fire(joystick,'pointerup',center.x,center.y-60);
  out.joystickReleases=g.joy.x===0&&g.joy.y===0;
  // Свайп по правой половине экрана крутит камеру.
  const canvas=document.querySelector('#scene'),yaw=g.yaw;
  fire(canvas,'pointerdown',innerWidth*.72,innerHeight*.5,8);
  fire(canvas,'pointermove',innerWidth*.52,innerHeight*.5,8);
  fire(canvas,'pointerup',innerWidth*.52,innerHeight*.5,8);
  out.swipeTurns=Math.abs(g.yaw-yaw)>.2;
  // Кнопка действия доводит дело до конца: берём швабру на складе.
  g.player.position.set(3.1,3.68,-1.4);g.yaw=Math.atan2(-(3.7-3.1),-(-1.4+1.4));g.updateInteraction(0);
  const mop=g.jobs.find(job=>job.tag==='stand-mop');
  out.actionTargets=g.nearest===mop;
  const action=document.querySelector('#action-btn');
  fire(action,'pointerdown',innerWidth*.86,innerHeight*.78,9);
  for(let i=0;i<80&&g.carry!=='mop';i++)g.updateInteraction(.05);
  fire(action,'pointerup',innerWidth*.86,innerHeight*.78,9);
  out.actionButtonWorks=g.carry==='mop';
  out.actionReleases=g.actionHeld===false;
  g.carry=null;g.updateCarry();
  // Кнопка прыжка: держим, отрываемся от земли, отпускаем — приземляемся.
  const jump=document.querySelector('#jump-btn'),jumpBox=jump.getBoundingClientRect();
  g.player.position.set(0,.26,-3.4);g.resetJump();g.updatePlayer(0);
  fire(jump,'pointerdown',jumpBox.left+jumpBox.width/2,jumpBox.top+jumpBox.height/2,11);
  out.jumpPresses=g.keys.Space===true;
  let peak=0;for(let i=0;i<14;i++){g.updatePlayer(.05);peak=Math.max(peak,g.jumpHeight)}
  fire(jump,'pointerup',jumpBox.left+jumpBox.width/2,jumpBox.top+jumpBox.height/2,11);
  out.jumpLifts=peak>.4;
  out.jumpReleases=g.keys.Space===false;
  for(let i=0;i<80;i++)g.updatePlayer(.05);
  out.jumpLands=g.grounded===true&&g.jumpHeight===0;
  // Обе кнопки и стик — на экране, крупные, не наезжают друг на друга.
  const stickBox=document.querySelector('#joystick').getBoundingClientRect();
  const onScreen=r=>r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;
  const apart=(a,b)=>!(a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom);
  out.controlsOnScreen=[stickBox,jumpBox,action.getBoundingClientRect()].every(onScreen);
  out.controlsBigEnough=jumpBox.width>=44&&action.getBoundingClientRect().width>=44;
  out.controlsApart=apart(jumpBox,action.getBoundingClientRect())&&apart(stickBox,jumpBox);
  // Панель дел не уезжает за нижний край и не перехватывает касания у стика.
  g.jobs=g.jobs.filter(job=>job.hidden);
  for(let i=0;i<6;i++)g.addJob({title:`Дело ${i+1}`,sub:'Подпись задания на две строки текста',pos:()=>g.player.position,duration:3,patience:60});
  g.renderTasks();
  const panel=document.querySelector('#tasks').getBoundingClientRect();
  out.tasksFitTheScreen=panel.bottom<=innerHeight;
  out.tasksSayWhatIsHidden=!!document.querySelector('#task-list .task.more');
  out.stickTakesTouches=!!document.elementFromPoint(stickBox.left+stickBox.width/2,stickBox.top+6)?.closest('#joystick');
  g.jobs=g.jobs.filter(job=>job.hidden);g.renderTasks();
  // Экраны открываются и листаются без полосы прокрутки.
  g.openStation('menu');
  const station=document.querySelector('#station-grid'),card=document.querySelector('#station .levels-card');
  const tile=station.querySelector('.upgrade')?.getBoundingClientRect();
  out.stationFits=!!tile&&tile.width<=innerWidth&&tile.height>=44;
  out.noScrollbar=getComputedStyle(card).scrollbarWidth==='none'||card.offsetWidth===card.clientWidth;
  g.closeStation();
  out.backToGame=document.querySelector('#station').classList.contains('hidden');
  return out;});
if(Object.values(mobilePlay).some(v=>!v))throw new Error(`Mobile play failed: ${JSON.stringify(mobilePlay)}`);
await mobile.screenshot({path:'artifacts/mobile-play.png'});
await mobile.evaluate(()=>{const g=window.__nightStation;g.setState({...g.state,levelsCleared:12,tutorial:true});g.openLevels('menu')});
const mobileLevels=await mobile.evaluate(()=>{const card=document.querySelector('.levels-card'),tiles=[...document.querySelectorAll('.level-tile')];
  const box=tiles[0].getBoundingClientRect();
  return{fits:card.getBoundingClientRect().width<=innerWidth,tileWide:box.width>=110,tappable:box.height>=44,
    sideBySide:tiles[1].getBoundingClientRect().top===box.top,
    wraps:tiles.some(tile=>tile.getBoundingClientRect().top>box.top),
    scrolls:card.scrollHeight>card.clientHeight};});
if(Object.values(mobileLevels).some(v=>!v))throw new Error(`Level menu on phone failed: ${JSON.stringify(mobileLevels)}`);
await mobile.screenshot({path:'artifacts/mobile-levels.png'});
await mobile.tap('.level-tile');
const mobileStart=await mobile.evaluate(()=>({playing:window.__nightStation.mode==='playing',level:window.__nightStation.shiftConfig.number,controls:!document.querySelector('#mobile-controls').classList.contains('hidden')}));
if(!mobileStart.playing||mobileStart.level!==1||!mobileStart.controls)throw new Error(`Level tap on phone failed: ${JSON.stringify(mobileStart)}`);if(mobileErrors.length)throw new Error(`Mobile runtime errors: ${mobileErrors.join(' | ')}`);await mobileContext.close();
console.log('E2E passed: achievements, a station bought with night money, four vehicle types, walk-in customers, a four-item shop, three bays, fuel deliveries, weather, a dawn in the last minute, hurried clients, a 30-level campaign with a level menu, goals, rushes and scripted events, two-floor stock loop, FIFO queue with its own patience, safety, fuel flow and traffic are working.');await browser.close();
