import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';
import { AudioSystem } from './audio.js';
import { initGamePush, loadLocal, saveProgress, showInterstitial, showRewarded, gpState, bindAdPause } from './gamepush.js';
import { HandView } from './hands.js';
import { ROAD, laneFor, entryPath, reversePath, exitPath, passPath, queuePoint, queueEntryPath, queueAdvancePath, queueToPumpPath, addLights, drive, setPath } from './traffic.js';
import { createSky, MOON_DIRECTION } from './sky.js';
import { CAMPAIGN_SHIFT_COUNT, PLAY_MODE, getShiftConfig, isFinalCampaignShift, randomFromRange } from './content/shifts.js';
import { DEFAULT_PROGRESS, migrateProgress } from './content/progress.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const ui={
  loading:$('#loading'),loadFill:$('#load-fill'),loadText:$('#loading-text'),menu:$('#menu'),hud:$('#hud'),tasks:$('#tasks'),taskList:$('#task-list'),stockCoffee:$('#stock-coffee'),stockSnack:$('#stock-snack'),
  money:$('#money'),rep:$('#reputation'),clock:$('#clock'),shift:$('#shift-label'),prompt:$('#prompt'),promptKey:$('#prompt-key'),promptTitle:$('#prompt-title'),promptSub:$('#prompt-subtitle'),
  progress:$('#progress'),progressFill:$('#progress i'),toasts:$('#toast-zone'),carrying:$('#carrying'),event:$('#event-card'),eventIcon:$('#event-icon'),eventTitle:$('#event-title'),eventText:$('#event-text'),
  tutorial:$('#tutorial'),guide:$('#guide'),pause:$('#pause'),results:$('#results'),campaignComplete:$('#campaign-complete'),mobile:$('#mobile-controls'),crosshair:$('#crosshair'),lookHint:$('#look-hint')
};
const audio=new AudioSystem();
const isTouch=matchMedia('(pointer:coarse)').matches;
const SLOT_Z=-7.4,SLOT_OFFSET=2.3,VAN_SLOT={x:7.6,z:-7.4};
const VEHICLE_STATE=Object.freeze({ENTERING:'entering',QUEUEING:'queueing',APPROACHING_PUMP:'approachingPump',WAITING:'waiting',FUELING:'fueling',LEAVING:'leaving'});
const PLAYER_RADIUS=.36,SAFE_MARGIN=.22,VEHICLE_MARGIN=.28,SAFE_APPROACH=12;
const GROUND_Y=.26,UPPER_FLOOR_Y=3.68,EYE_HEIGHT=1.62,JUMP_SPEED=4.9,GRAVITY=16.5,MAX_FOOD_STOCK=5;
const STAIR={minX:4.98,maxX:6.66,minZ:-2.38,maxZ:3.12},UPPER_LANDING={minX:4.16,maxX:7.1,minZ:2.54,maxZ:4.14},UPPER_ROOM={minX:-4.3,maxX:4.3,minZ:-2.16,maxZ:4.5};
const MOP_SPOT=new THREE.Vector3(0,.25,2.85),TOOL_SPOT=new THREE.Vector3(-4.28,.3,-.45);
const COFFEE_SPOT=new THREE.Vector3(-1.75,.2,-.7),FOOD_SPOT=new THREE.Vector3(1.75,.2,-.7),FUSE_SPOT=new THREE.Vector3(-4.2,.2,2.2),LOST_SPOT=new THREE.Vector3(3.75,.2,2);
const SUPPLY_SPOTS={coffee:new THREE.Vector3(-1.75,UPPER_FLOOR_Y,3.12),snack:new THREE.Vector3(1.75,UPPER_FLOOR_Y,3.12)};
const STOW_NOTE={mop:'Швабра вернулась на место',tools:'Инструменты вернулись в ящик'};
const NEED_HINT={mop:'Сначала возьмите швабру за прилавком',tools:'Сначала возьмите инструменты в магазине',hose:'Сначала снимите пистолет с нужной колонки'};
const CARRY_NAMES={coffee:'Кофе',snack:'Сэндвич',box:'Коробка товара',coffeeBox:'Запас кофе',snackBox:'Запас сэндвичей',bag:'Забытая сумка',mop:'Швабра',tools:'Инструменты',hose:'Заправочный пистолет'};
// Реклама на экране результатов даёт надбавку к заработку смены, поэтому кнопка подписывается точной суммой.
const REWARD_SHARE=.35,REWARD_MIN=50;
const GUIDE_SLIDES=[
  ['Как двигаться','Кликните по игре и осматривайтесь мышью. WASD — движение относительно взгляда, Shift — бег, Space — прыжок, E — действие. На телефоне: левый стик, свайп справа и кнопки «Прыжок» и «Действие».','tutorial/01-controls.png'],
  ['Колонки и машины','Когда машина остановится, сначала снимите пистолет с отмеченной колонки. Затем подойдите к лючку машины и удерживайте E для заправки. После неё шланг вернётся на место.','tutorial/02-pumps.png'],
  ['Кофе, еда и склад','На аппаратах у прилавка хранится по 5 порций кофе и сэндвичей. Запасы лежат на втором этаже: выйдите на улицу, поднимитесь по лестнице справа, войдите в дверь и принесите нужную коробку к аппарату.','tutorial/03-shop.png'],
  ['Ночные происшествия','При отключении света вся заправка остановится: сначала возьмите инструменты и почините щиток у левой стены. Входные двери аварийно останутся открыты. Для пятна нужна швабра, а жёлтый ящик «НАХОДКИ» стоит справа.','tutorial/04-events.png']
];

class NightStationGame{
  constructor(){
    this.canvas=$('#scene');this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x091820);this.scene.fog=new THREE.FogExp2(0x091820,.022);
    this.camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.08,120);this.camera.position.set(0,1.65,-2.8);this.camera.rotation.order='YXZ';
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.55));this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.28;
    this.clock=new THREE.Clock();this.assets={};this.mode='loading';this.player=null;this.jobs=[];this.cars=[];this.carQueue=[];this.traffic=[];this.pumps=[];this.nearest=null;this.actionHeld=false;this.actionLatched=false;this.actionProgress=0;this.keys={};this.joy={x:0,y:0};this.yaw=0;this.pitch=-.04;this.lookTouch=null;this.jobId=0;this.vehicleId=0;this.taskSignature='';this.guideIndex=0;this.resumeAfterGuide=false;this.elapsed=0;this.shiftConfig=getShiftConfig(1);this.shiftLength=this.shiftConfig.duration;this.spawnTimer=2;this.eventTimer=24;this.trafficTimer=4;this.stock={coffee:MAX_FOOD_STOCK,snack:MAX_FOOD_STOCK};this.carry=null;this.fuelHose=null;this.served=0;this.shiftStartMoney=0;this.shiftEarned=0;this.blackout=false;this.blackoutCarry=null;this.specialVan=null;this.doorOpen=0;this.doorParts={left:[],right:[]};this.doorGlass=[];this.upperDoorOpen=0;this.upperDoorParts=[];this.stockVisuals={coffee:[],snack:[]};this.powerVisuals=[];this.markerBaseY=.12;this.state=migrateProgress(DEFAULT_PROGRESS);
    this.audio=audio;this.hands=new HandView();this.moving=false;this.lastYaw=0;this.lastPitch=0;this.grounded=true;this.jumpHeight=0;this.jumpSpeed=0;this.landDip=0;
    this.setupWorld();this.setupInput();this.setupUI();window.addEventListener('resize',()=>this.resize());document.addEventListener('visibilitychange',()=>this.visibility());
  }
  setupWorld(){
    const hemi=new THREE.HemisphereLight(0x7faabb,0x0b1715,1.85);this.scene.add(hemi);this.hemi=hemi;
    this.stationLights=[];
    [[-2.5,6,-7.4],[2.5,6,-7.4],[0,4,-.5]].forEach(([x,y,z],i)=>{const intensity=i===2?22:28,l=new THREE.PointLight(i===2?0xffdfad:0xb9efff,intensity,15,1.5);l.position.set(x,y,z);l.userData.onIntensity=intensity;l.castShadow=i===2;l.shadow.mapSize.set(512,512);this.scene.add(l);this.stationLights.push(l)});
    const moon=new THREE.DirectionalLight(0x86a3c5,3.1);moon.position.copy(MOON_DIRECTION).multiplyScalar(24);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);moon.shadow.camera.left=-22;moon.shadow.camera.right=22;moon.shadow.camera.top=22;moon.shadow.camera.bottom=-22;this.scene.add(moon);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:0x182620,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;this.scene.add(ground);
    const forecourt=new THREE.Mesh(new THREE.PlaneGeometry(19,23),new THREE.MeshStandardMaterial({color:0x263239,roughness:.95}));forecourt.rotation.x=-Math.PI/2;forecourt.position.set(0,.012,-5);forecourt.receiveShadow=true;this.scene.add(forecourt);
    // Трасса тянется дальше, чем видит туман: машины успевают выехать и уехать по дороге.
    const road=new THREE.Mesh(new THREE.PlaneGeometry(144,9),new THREE.MeshStandardMaterial({color:0x070b0e,roughness:.97}));road.rotation.x=-Math.PI/2;road.position.set(0,.02,ROAD.center);road.receiveShadow=true;this.scene.add(road);
    const apron=new THREE.Mesh(new THREE.PlaneGeometry(21,5.4),new THREE.MeshStandardMaterial({color:0x1d272c,roughness:.96}));apron.rotation.x=-Math.PI/2;apron.position.set(0,.026,-13.2);apron.receiveShadow=true;this.scene.add(apron);
    const queueApron=new THREE.Mesh(new THREE.PlaneGeometry(16,4.2),apron.material);queueApron.rotation.x=-Math.PI/2;queueApron.position.set(14,.027,-12.5);queueApron.receiveShadow=true;this.scene.add(queueApron);
    const stripeMat=new THREE.MeshBasicMaterial({color:0xb7a55f}),edgeMat=new THREE.MeshBasicMaterial({color:0x6d7472}),postMat=new THREE.MeshStandardMaterial({color:0xdad3bc,roughness:.9}),reflectMat=new THREE.MeshBasicMaterial({color:0xff7a2f});
    for(let x=-66;x<67;x+=6){const s=new THREE.Mesh(new THREE.PlaneGeometry(3.2,.13),stripeMat);s.rotation.x=-Math.PI/2;s.position.set(x,.035,ROAD.center);this.scene.add(s)}
    for(let x=-66;x<67;x+=8){const e=new THREE.Mesh(new THREE.PlaneGeometry(7.4,.1),edgeMat);e.rotation.x=-Math.PI/2;e.position.set(x,.034,-21.2);this.scene.add(e)}
    for(let x=-60;x<61;x+=10){const p=new THREE.Mesh(new THREE.BoxGeometry(.1,1,.1),postMat);p.position.set(x,.5,-21.9);this.scene.add(p);const r=new THREE.Mesh(new THREE.PlaneGeometry(.09,.16),reflectMat);r.position.set(x,.8,-21.84);this.scene.add(r)}
    const gravelMat=new THREE.MeshStandardMaterial({color:0x18201d,roughness:1});for(let i=0;i<24;i++){const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.12+Math.random()*.2,0),gravelMat);const side=Math.random()<.5?-1:1;rock.position.set(side*(10+Math.random()*15),.13,-5+Math.random()*23);rock.scale.y=.45;this.scene.add(rock)}
    const trunkMat=new THREE.MeshStandardMaterial({color:0x20170d}),pineMat=new THREE.MeshStandardMaterial({color:0x071c15});for(let i=0;i<20;i++){const side=Math.random()<.5?-1:1,x=side*(13+Math.random()*20),z=-10+Math.random()*33;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,1.8,7),trunkMat);trunk.position.set(x,.9,z);const crown=new THREE.Mesh(new THREE.ConeGeometry(1.2+Math.random()*.8,3.7+Math.random()*2,7),pineMat);crown.position.set(x,3,z);this.scene.add(trunk,crown)}
    this.sky=createSky();this.scene.add(this.sky.group);
    // Ящик с инструментом у левой стены магазина: отсюда берут отвёртку и ключ.
    const toolbox=new THREE.Group();toolbox.position.set(TOOL_SPOT.x,.24,TOOL_SPOT.z);
    const boxMat=new THREE.MeshStandardMaterial({color:0xc2411f,roughness:.72}),steelMat=new THREE.MeshStandardMaterial({color:0x9aa5ab,roughness:.42,metalness:.55});
    const body=new THREE.Mesh(new THREE.BoxGeometry(.5,.27,.34),boxMat);body.position.y=.135;body.castShadow=true;toolbox.add(body);
    const lid=new THREE.Mesh(new THREE.BoxGeometry(.52,.06,.36),steelMat);lid.position.y=.3;toolbox.add(lid);
    const grip=new THREE.Mesh(new THREE.TorusGeometry(.07,.014,5,10,Math.PI),steelMat);grip.position.y=.33;grip.rotation.y=Math.PI/2;toolbox.add(grip);
    for(const s of[-1,1]){const clip=new THREE.Mesh(new THREE.BoxGeometry(.04,.08,.02),steelMat);clip.position.set(s*.16,.24,-.18);toolbox.add(clip)}
    this.toolbox=toolbox;this.scene.add(toolbox);
    this.marker=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(.68,.055,7,24),new THREE.MeshBasicMaterial({color:0xffad32,transparent:true,opacity:.9,depthWrite:false}));ring.rotation.x=Math.PI/2;this.marker.add(ring);const beam=new THREE.Mesh(new THREE.CylinderGeometry(.04,.45,1.6,8,1,true),new THREE.MeshBasicMaterial({color:0xffad32,transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false}));beam.position.y=.8;this.marker.add(beam);this.marker.visible=false;this.scene.add(this.marker);
    this.hoseWorld=new THREE.Group();const hoseGeo=new THREE.CylinderGeometry(.035,.035,1,7),hoseMat=new THREE.MeshStandardMaterial({color:0x101416,roughness:.96});this.hoseSegments=Array.from({length:6},()=>new THREE.Mesh(hoseGeo,hoseMat));this.hosePoints=Array.from({length:7},()=>new THREE.Vector3());this.hoseControl=new THREE.Vector3();this.hoseDirection=new THREE.Vector3();this.hoseUp=new THREE.Vector3(0,1,0);this.hoseSocketNdc=new THREE.Vector3();this.hoseRay=new THREE.Vector3();this.hoseSegments.forEach(s=>this.hoseWorld.add(s));this.hoseWorld.visible=false;this.scene.add(this.hoseWorld);
  }
  createLandmarkLabel(text,color,position,width=2,fontSize=43){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(5,13,17,.92)';ctx.fillRect(8,12,496,104);ctx.strokeStyle=color;ctx.lineWidth=8;ctx.strokeRect(8,12,496,104);ctx.fillStyle='#f7f3df';ctx.font=`900 ${fontSize}px Montserrat, Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,66);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false}));label.name=`Landmark-${text}`;label.position.copy(position);label.scale.set(width,.5,1);label.renderOrder=5;this.scene.add(label);return label
  }
  async load(){
    const loader=new GLTFLoader(),files=['station','second_floor','pump','car','mystery_van','worker','bag','cleaning_kit'];let done=0;
    await Promise.all(files.map(async name=>{const gltf=await loader.loadAsync(`models/${name}.glb`);this.assets[name]=gltf.scene;gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=name!=='station'||!o.name.includes('Floor');o.receiveShadow=true}});done++;ui.loadFill.style.width=`${12+done/files.length*82}%`;ui.loadText.textContent=['Проверяем кофемашину…','Расставляем товар…','Протираем колонку…','Включаем фонари…','Слушаем тишину…','Считаем сдачу…','Открываем смену…'][done-1]}));
    const station=this.assets.station.clone(true);station.position.set(0,0,0);station.traverse(o=>{
      if(o.isMesh&&['Canopy','CanopyStripe'].includes(o.name))o.visible=false;
      if(o.isMesh&&o.name.startsWith('CanopyLight'))o.visible=true;
      if(o.isMesh&&(['CoffeePanel','FoodPanel'].includes(o.name)||o.name.startsWith('CanopyLight')))this.powerVisuals.push(o);
      if(o.isMesh&&o.name.startsWith('DoorLeft'))this.doorParts.left.push({object:o,x:o.position.x});
      if(o.isMesh&&o.name.startsWith('DoorRight'))this.doorParts.right.push({object:o,x:o.position.x});
      if(o.isMesh&&(o.name==='DoorLeftGlass'||o.name==='DoorRightGlass'))this.doorGlass.push(o);
      if(o.isMesh&&o.name==='Roof'){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.28;o.material.depthWrite=false}
    });this.station=station;this.scene.add(station);
    const secondFloor=this.assets.second_floor.clone(true);secondFloor.traverse(o=>{
      if(o.isMesh&&['UpperDoor','UpperDoorWindow','UpperDoorHandle'].includes(o.name))this.upperDoorParts.push({object:o,z:o.position.z});
      if(o.isMesh&&(o.name.startsWith('CoffeeStockCarton')||o.name.startsWith('CoffeeStockBand')))this.stockVisuals.coffee.push(o);
      if(o.isMesh&&(o.name.startsWith('SnackStockCarton')||o.name.startsWith('SnackStockBand')))this.stockVisuals.snack.push(o);
    });this.secondFloor=secondFloor;this.scene.add(secondFloor);
    const upperLight=new THREE.PointLight(0xffd9a3,18,11,1.7);upperLight.position.set(0,5.45,1.1);upperLight.userData.onIntensity=18;upperLight.castShadow=false;this.scene.add(upperLight);this.stationLights.push(upperLight);
    this.landmarkLabels=[this.createLandmarkLabel('КОФЕ','#37d5ef',new THREE.Vector3(-1.75,2.62,-.72),1.65),this.createLandmarkLabel('ЕДА','#ffae35',new THREE.Vector3(1.75,2.62,-.72),1.65),this.createLandmarkLabel('ЩИТОК','#ffae35',new THREE.Vector3(-4.02,2.55,2.2),1.8),this.createLandmarkLabel('НАХОДКИ','#37d5ef',new THREE.Vector3(3.68,2.08,2),2.25),this.createLandmarkLabel('← ЩИТОК   НАХОДКИ →','#f4f2df',new THREE.Vector3(0,2.9,3.72),3.7,29),this.createLandmarkLabel('СКЛАД ↑','#ffae35',new THREE.Vector3(5.82,2.62,-2.98),1.8),this.createLandmarkLabel('ЗАПАС КОФЕ','#37d5ef',new THREE.Vector3(-1.75,5.25,3.55),2),this.createLandmarkLabel('ЗАПАС ЕДЫ','#ffae35',new THREE.Vector3(1.75,5.25,3.55),2)];
    for(const x of [-2.55,2.55]){const model=this.assets.pump.clone(true);model.position.set(x,.24,SLOT_Z);this.scene.add(model);const pump={x,z:SLOT_Z,model,car:null,broken:false,slotX:x+Math.sign(x)*SLOT_OFFSET,hoseSpot:new THREE.Vector3(x+.72,.25,SLOT_Z-.52),hoseParts:[]};model.traverse(o=>{if(o.name==='Hose'||o.name==='Nozzle')pump.hoseParts.push(o);if(o.isMesh&&o.name==='Display')this.powerVisuals.push(o)});this.pumps.push(pump)}
    this.player=this.assets.worker.clone(true);this.player.position.set(0,.26,-3.35);this.player.scale.setScalar(.92);this.scene.add(this.player);
    const kit=this.assets.cleaning_kit.clone(true);kit.position.copy(MOP_SPOT);kit.scale.setScalar(.8);this.scene.add(kit);
    this.kit=kit;this.kitMop=[];kit.traverse(o=>{if(o.isMesh&&o.name.startsWith('Mop'))this.kitMop.push(o)});
    this.hands.build(this.assets);
    this.camera.lookAt(0,0,-4);ui.loadFill.style.width='100%';
  }
  setupInput(){
    addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','KeyE','Space'].includes(e.code))e.preventDefault();this.keys[e.code]=true;if(e.code==='KeyE')this.actionHeld=true;if(e.code==='Escape'&&this.mode==='playing')this.pause()});
    addEventListener('keyup',e=>{this.keys[e.code]=false;if(e.code==='KeyE'){this.actionHeld=false;this.actionProgress=0;this.actionLatched=false}});addEventListener('blur',()=>{this.keys={};this.actionHeld=false;this.actionLatched=false;this.joy={x:0,y:0}});
    this.canvas.addEventListener('click',()=>this.lockPointer());
    addEventListener('mousemove',e=>{if(document.pointerLockElement!==this.canvas||this.mode!=='playing')return;this.yaw-=e.movementX*.0022;this.pitch=THREE.MathUtils.clamp(this.pitch-e.movementY*.0019,-1.35,1.25)});
    document.addEventListener('pointerlockchange',()=>{ui.lookHint.classList.toggle('hidden',isTouch||this.mode!=='playing'||document.pointerLockElement===this.canvas)});
    this.canvas.addEventListener('pointerdown',e=>{if(!isTouch||this.mode!=='playing'||e.clientX<innerWidth*.32)return;this.lookTouch={id:e.pointerId,x:e.clientX,y:e.clientY};this.canvas.setPointerCapture(e.pointerId)});
    this.canvas.addEventListener('pointermove',e=>{if(!this.lookTouch||e.pointerId!==this.lookTouch.id)return;const dx=e.clientX-this.lookTouch.x,dy=e.clientY-this.lookTouch.y;this.lookTouch.x=e.clientX;this.lookTouch.y=e.clientY;this.yaw-=dx*.006;this.pitch=THREE.MathUtils.clamp(this.pitch-dy*.005,-1.2,1.15)});
    const stopLook=e=>{if(this.lookTouch&&e.pointerId===this.lookTouch.id)this.lookTouch=null};this.canvas.addEventListener('pointerup',stopLook);this.canvas.addEventListener('pointercancel',stopLook);
    const joy=$('#joystick'),nub=$('#joystick i');let joyId=null;const update=e=>{const r=joy.getBoundingClientRect(),x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2),len=Math.hypot(x,y)||1,m=Math.min(38,len),nx=x/len,ny=y/len;this.joy={x:nx*m/38,y:ny*m/38};nub.style.transform=`translate(${nx*m}px,${ny*m}px)`};
    joy.addEventListener('pointerdown',e=>{joyId=e.pointerId;try{joy.setPointerCapture(joyId)}catch{}update(e)});joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)update(e)});const end=e=>{if(e.pointerId!==joyId)return;joyId=null;this.joy={x:0,y:0};nub.style.transform=''};joy.addEventListener('pointerup',end);joy.addEventListener('pointercancel',end);
    // Кнопка держится только своим пальцем: чужой pointerup её не отпускает, а свой — отпускает даже мимо кнопки.
    const holdButton=(element,press,release)=>{
      let active=null;
      element.addEventListener('pointerdown',e=>{e.preventDefault();active=e.pointerId;press();try{element.setPointerCapture(e.pointerId)}catch{}});
      const end=e=>{if(active===null||e.pointerId!==active)return;active=null;release()};
      for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,end);
      addEventListener('pointerup',end);addEventListener('pointercancel',end);
    };
    holdButton($('#action-btn'),()=>{this.actionHeld=true},()=>{this.actionHeld=false;this.actionProgress=0;this.actionLatched=false});
    holdButton($('#jump-btn'),()=>{this.keys.Space=true},()=>{this.keys.Space=false});
  }
  lockPointer(){if(isTouch||this.mode!=='playing'||document.pointerLockElement===this.canvas)return;try{const result=this.canvas.requestPointerLock?.();result?.catch?.(()=>{})}catch{}}
  setupUI(){
    $('#continue-btn').onclick=()=>this.prepareStart(false);$('#new-btn').onclick=()=>this.prepareStart(true);$('#tutorial-start').onclick=()=>{ui.tutorial.classList.add('hidden');this.state.tutorial=true;this.startShift();this.lockPointer()};
    $('#pause-btn').onclick=()=>this.pause();$('#resume-btn').onclick=()=>this.resume();$('#menu-btn').onclick=()=>{ui.pause.classList.add('hidden');this.showMenu()};$('#sound-btn').onclick=()=>this.toggleSound();
    const musicVolume=$('#music-volume'),musicValue=$('#music-volume-value');musicVolume.oninput=()=>{this.state.musicVolume=Number(musicVolume.value);musicValue.textContent=`${this.state.musicVolume}%`;audio.setMusicVolume(this.state.musicVolume/100)};musicVolume.onchange=()=>saveProgress(this.state);
    $('#guide-btn').onclick=()=>this.openGuide();$('#guide-close').onclick=()=>this.closeGuide();$('#guide-prev').onclick=()=>{this.guideIndex=Math.max(0,this.guideIndex-1);this.renderGuide()};$('#guide-next').onclick=()=>{if(this.guideIndex>=GUIDE_SLIDES.length-1)this.closeGuide();else{this.guideIndex++;this.renderGuide()}};
    $('#next-shift').onclick=async()=>{
      ui.results.classList.add('hidden');
      if(this.state.playMode===PLAY_MODE.CAMPAIGN&&this.state.campaignComplete){this.showCampaignComplete();return}
      await showInterstitial();this.startShift()
    };
    $('#campaign-menu').onclick=()=>this.showMenu();
    $('#campaign-restart').onclick=()=>{
      const preferences={tutorial:true,sound:this.state.sound,musicVolume:this.state.musicVolume};
      this.setState({...DEFAULT_PROGRESS,...preferences});
      ui.campaignComplete.classList.add('hidden');
      this.startShift()
    };
    $('#reward-btn').onclick=async e=>{const button=e.currentTarget,bonus=this.rewardBonus();button.disabled=true;const success=await showRewarded();if(!success){button.disabled=false;this.toast('Реклама не загрузилась — надбавка не начислена');return}this.state.money+=bonus;this.toast(`Надбавка за смену: <b>+₽${bonus}</b>`);this.updateHud();this.updateUpgradeButtons();saveProgress(this.state);button.classList.add('hidden')};
    $$('.upgrades button').forEach(b=>b.onclick=()=>this.buyUpgrade(b.dataset.upgrade));
  }
  setState(data){if(!data)return;this.state=migrateProgress(data);this.shiftConfig=getShiftConfig(this.state.shift,this.state.playMode);this.shiftLength=this.shiftConfig.duration;audio.setMuted(!this.state.sound);audio.setMusicVolume(this.state.musicVolume/100);const slider=$('#music-volume');if(slider){slider.value=this.state.musicVolume;$('#music-volume-value').textContent=`${this.state.musicVolume}%`}$('#sound-btn').textContent=`ЗВУК: ${this.state.sound?'ВКЛ':'ВЫКЛ'}`}
  showMenu(){this.mode='menu';document.exitPointerLock?.();this.camera.fov=43;this.camera.updateProjectionMatrix();this.camera.position.set(12,12,-16);this.camera.lookAt(0,1,-4);if(this.player)this.player.visible=true;ui.hud.classList.add('hidden');ui.tasks.classList.add('hidden');ui.mobile.classList.add('hidden');ui.prompt.classList.add('hidden');ui.crosshair.classList.add('hidden');ui.lookHint.classList.add('hidden');ui.results.classList.add('hidden');ui.campaignComplete.classList.add('hidden');ui.menu.classList.remove('hidden');$('#continue-btn').classList.toggle('hidden',!loadLocal()&&!cloudSave);}
  prepareStart(fresh){audio.ensure();if(fresh)this.setState(DEFAULT_PROGRESS);ui.menu.classList.add('hidden');if(this.state.playMode===PLAY_MODE.CAMPAIGN&&this.state.campaignComplete){this.showCampaignComplete();return}if(!this.state.tutorial)ui.tutorial.classList.remove('hidden');else this.startShift()}
  startShift(){
    if(this.state.playMode===PLAY_MODE.CAMPAIGN&&this.state.campaignComplete){this.showCampaignComplete();return}
    this.shiftConfig=getShiftConfig(this.state.shift,this.state.playMode);this.shiftLength=this.shiftConfig.duration;
    this.clearShift();this.addStandJobs();this.mode='playing';this.elapsed=0;this.spawnTimer=this.shiftConfig.carSpawn.initialDelay;this.eventTimer=randomFromRange(this.shiftConfig.eventSpawn.initial);this.trafficTimer=2.5;this.served=0;this.stock={coffee:MAX_FOOD_STOCK,snack:MAX_FOOD_STOCK};this.setStockVisual('coffee',true);this.setStockVisual('snack',true);this.shiftStartMoney=this.state.money;this.blackout=false;this.blackoutCarry=null;this.setBlackout(false);this.doorOpen=0;this.upperDoorOpen=0;this.applyDoorOpen();this.applyUpperDoorOpen();this.yaw=0;this.pitch=-.04;this.camera.fov=72;this.camera.updateProjectionMatrix();this.player.position.set(0,GROUND_Y,-3.35);this.player.visible=false;this.resetJump();ui.hud.classList.remove('hidden');ui.tasks.classList.remove('hidden');ui.crosshair.classList.remove('hidden');ui.lookHint.classList.toggle('hidden',isTouch||document.pointerLockElement===this.canvas);ui.mobile.classList.toggle('hidden',!isTouch);ui.results.classList.add('hidden');ui.campaignComplete.classList.add('hidden');const mins=Math.floor(this.shiftLength/60),secs=this.shiftLength%60;this.toast(`Смена ${this.state.shift} открыта. <b>До рассвета ${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}</b>`);this.updateHud();saveProgress(this.state);this.lockPointer()
  }
  clearShift(){this.returnFuelHose();for(const c of [...this.cars])this.despawn(c);this.cars=[];this.carQueue=[];for(const t of [...this.traffic])this.despawn(t);this.traffic=[];for(const j of this.jobs)if(j.visual)this.scene.remove(j.visual);this.jobs=[];this.pumps.forEach(p=>{p.car=null;p.departingCar=null;p.broken=false});if(this.specialVan){this.despawn(this.specialVan);this.specialVan=null}this.carry=null;this.blackoutCarry=null;this.kitMop?.forEach(m=>m.visible=true);this.updateCarry()}
  update(dt){
    if(this.mode==='playing')this.updatePlay(dt);else if(this.mode==='menu'||this.mode==='loading')this.updateMenu(dt);
    this.sky.update(dt,this.camera.position);
    this.marker.rotation.y+=dt*.8;if(this.marker.visible)this.marker.position.y=this.markerBaseY+Math.sin(performance.now()*.003)*.08;
    const playing=this.mode==='playing';
    if(playing){this.hands.update(dt,{moving:this.moving,acting:this.actionHeld&&!!this.nearest,fueling:this.cars.some(c=>c.status===VEHICLE_STATE.FUELING),vertical:this.grounded?0:this.jumpSpeed,landing:this.landDip,yawDelta:this.yaw-this.lastYaw,pitchDelta:this.pitch-this.lastPitch});this.updateFuelHoseVisual()}
    this.lastYaw=this.yaw;this.lastPitch=this.pitch;
    this.renderer.render(this.scene,this.camera);
    if(playing)this.hands.render(this.renderer,this.camera.aspect)
  }
  updateMenu(dt){const t=performance.now()*.00025;const target=new THREE.Vector3(12+Math.sin(t)*2,12,-16+Math.cos(t)*2);this.camera.position.lerp(target,dt*.6);this.camera.lookAt(0,1,-4)}
  openGuide(){if(this.mode!=='playing')return;this.resumeAfterGuide=true;this.mode='guide';this.actionHeld=false;document.exitPointerLock?.();audio.pause(true);this.guideIndex=0;this.renderGuide();ui.mobile.classList.add('hidden');ui.lookHint.classList.add('hidden');ui.guide.classList.remove('hidden')}
  renderGuide(){const slides=GUIDE_SLIDES,s=slides[this.guideIndex];$('#guide-title').textContent=s[0];$('#guide-text').textContent=s[1];$('#guide-image').src=s[2];$('#guide-step').textContent=`${this.guideIndex+1} / ${slides.length}`;$('#guide-dots').innerHTML=slides.map((_,i)=>`<i class="${i===this.guideIndex?'active':''}"></i>`).join('');$('#guide-prev').disabled=this.guideIndex===0;$('#guide-next').textContent=this.guideIndex===slides.length-1?'В ИГРУ →':'ДАЛЬШЕ →'}
  closeGuide(){ui.guide.classList.add('hidden');if(!this.resumeAfterGuide)return;this.resumeAfterGuide=false;this.mode='playing';audio.pause(false);ui.mobile.classList.toggle('hidden',!isTouch);ui.lookHint.classList.toggle('hidden',isTouch||document.pointerLockElement===this.canvas);this.lockPointer();this.clock.getDelta()}
  updatePlay(dt){
    this.elapsed+=dt;if(this.elapsed>=this.shiftLength){this.finishShift();return}
    if(!this.blackout){
      this.spawnTimer-=dt;this.eventTimer-=dt;
      if(this.spawnTimer<=0){const spawned=this.spawnCar();this.spawnTimer=spawned?randomFromRange(this.shiftConfig.carSpawn.interval):this.shiftConfig.carSpawn.queueRetry}
      if(this.eventTimer<=0){this.triggerEvent();this.eventTimer=randomFromRange(this.shiftConfig.eventSpawn.interval)}
    }
    this.updateTraffic(dt);
    this.updateDoors(dt);this.updatePlayer(dt);this.updateCars(dt);this.updateJobs(dt);this.updateInteraction(dt);this.updateHud();
  }
  applyDoorOpen(){const eased=this.doorOpen*this.doorOpen*(3-2*this.doorOpen),shift=1.22*eased;this.doorParts.left.forEach(p=>p.object.position.x=p.x-shift);this.doorParts.right.forEach(p=>p.object.position.x=p.x+shift)}
  applyUpperDoorOpen(){const eased=this.upperDoorOpen*this.upperDoorOpen*(3-2*this.upperDoorOpen),shift=1.48*eased;this.upperDoorParts.forEach(p=>p.object.position.z=p.z-shift)}
  updateDoors(dt){if(!this.player)return;const nearby=Math.abs(this.player.position.x)<2&&Math.abs(this.player.position.z+2.65)<2.35,target=this.blackout||nearby?1:0,speed=2.8*dt;this.doorOpen=THREE.MathUtils.clamp(this.doorOpen+(target>this.doorOpen?speed:-speed),0,1);this.applyDoorOpen();const upperNearby=this.player.position.y>2.6&&Math.abs(this.player.position.x-4.55)<1.65&&Math.abs(this.player.position.z-3.15)<1.65,upperTarget=upperNearby?1:0;this.upperDoorOpen=THREE.MathUtils.clamp(this.upperDoorOpen+(upperTarget>this.upperDoorOpen?speed:-speed),0,1);this.applyUpperDoorOpen()}
  updatePlayer(dt){
    let strafe=(this.keys.KeyD?1:0)-(this.keys.KeyA?1:0)+this.joy.x,forward=(this.keys.KeyW?1:0)-(this.keys.KeyS?1:0)-this.joy.y;const len=Math.hypot(strafe,forward);let moving=false;
    if(len>.05){strafe/=Math.max(1,len);forward/=Math.max(1,len);const run=this.keys.ShiftLeft||this.keys.ShiftRight?1.55:1,speed=(4.35+this.state.upgrades.speed*.52)*run,fx=-Math.sin(this.yaw),fz=-Math.cos(this.yaw),rx=Math.cos(this.yaw),rz=-Math.sin(this.yaw),dx=(rx*strafe+fx*forward)*speed*dt,dz=(rz*strafe+fz*forward)*speed*dt;const nextX=this.player.position.x+dx,nextZ=this.player.position.z+dz,stuck=this.isBlocked(this.player.position.x,this.player.position.z,null,this.player.position.y),xFloor=this.floorHeight(nextX,this.player.position.z,this.player.position.y),xLevel=this.player.position.y>1&&xFloor===GROUND_Y?this.player.position.y:xFloor;if(stuck||!this.isBlocked(nextX,this.player.position.z,null,xLevel))this.player.position.x=nextX;const zFloor=this.floorHeight(this.player.position.x,nextZ,this.player.position.y),zLevel=this.player.position.y>1&&zFloor===GROUND_Y?this.player.position.y:zFloor;if(stuck||!this.isBlocked(this.player.position.x,nextZ,null,zLevel))this.player.position.z=nextZ;moving=true}
    this.player.position.y=this.floorHeight(this.player.position.x,this.player.position.z,this.player.position.y);
    this.moving=moving;this.updateJump(dt);
    const bob=moving&&this.grounded?Math.sin(this.elapsed*11)*.035:0;
    this.camera.position.set(this.player.position.x,this.player.position.y+(EYE_HEIGHT-GROUND_Y)+bob+this.jumpHeight-this.landDip,this.player.position.z);
    this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ')
  }
  /* Прыжок ничего не меняет по горизонтали: перепрыгнуть прилавок или машину нельзя. */
  updateJump(dt){
    if(this.grounded&&this.keys.Space){this.grounded=false;this.jumpSpeed=JUMP_SPEED;audio.tone(196,.09,'sine',.1)}
    if(!this.grounded){
      this.jumpSpeed-=GRAVITY*dt;this.jumpHeight+=this.jumpSpeed*dt;
      if(this.jumpHeight<=0){this.jumpHeight=0;this.grounded=true;this.landDip=Math.min(.13,Math.abs(this.jumpSpeed)*.026);this.jumpSpeed=0;audio.tone(104,.13,'sine',.09)}
    }
    this.landDip+=(0-this.landDip)*Math.min(1,dt*8.5);
  }
  resetJump(){this.grounded=true;this.jumpHeight=0;this.jumpSpeed=0;this.landDip=0}
  placeHoseSegment(mesh,a,b){const d=this.hoseDirection.subVectors(b,a),length=d.length();mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.set(1,length,1);mesh.quaternion.setFromUnitVectors(this.hoseUp,d.normalize())}
  updateFuelHoseVisual(){
    const active=this.fuelHose&&this.carry==='hose'&&this.player;if(!active){this.hoseWorld.visible=false;return}
    const anchor=this.hosePoints[0].set(.62,1.68,0);this.fuelHose.pump.model.localToWorld(anchor);const socket=this.hands.getHoseSocketNDC(this.hoseSocketNdc,this.camera.aspect);if(!socket){this.hoseWorld.visible=false;return}this.camera.updateMatrixWorld(true);
    const hand=this.hosePoints.at(-1);this.hoseRay.copy(socket).setZ(.35).unproject(this.camera).sub(this.camera.position).normalize();hand.copy(this.camera.position).addScaledVector(this.hoseRay,.72);
    const control=this.hoseControl.copy(anchor).lerp(hand,.52);control.y=Math.max(.82,Math.min(anchor.y,hand.y)-.38);
    let minHeight=Math.min(anchor.y,hand.y);for(let i=1;i<this.hosePoints.length-1;i++){const t=i/(this.hosePoints.length-1),u=1-t,p=this.hosePoints[i];p.set(u*u*anchor.x+2*u*t*control.x+t*t*hand.x,u*u*anchor.y+2*u*t*control.y+t*t*hand.y,u*u*anchor.z+2*u*t*control.z+t*t*hand.z);minHeight=Math.min(minHeight,p.y)}
    this.hoseSegments.forEach((segment,i)=>this.placeHoseSegment(segment,this.hosePoints[i],this.hosePoints[i+1]));this.hoseWorld.userData.minHeight=minHeight;this.hoseWorld.visible=true
  }
  floorHeight(x,z,currentY=GROUND_Y){
    if(x>=STAIR.minX&&x<=STAIR.maxX&&z>=STAIR.minZ&&z<=STAIR.maxZ){const t=THREE.MathUtils.clamp((z-STAIR.minZ)/(STAIR.maxZ-STAIR.minZ),0,1);return GROUND_Y+t*(3.56-GROUND_Y)}
    if(x>=UPPER_LANDING.minX&&x<=UPPER_LANDING.maxX&&z>=UPPER_LANDING.minZ&&z<=UPPER_LANDING.maxZ)return UPPER_FLOOR_Y;
    if(currentY>2.2&&x>=UPPER_ROOM.minX&&x<=UPPER_ROOM.maxX&&z>=UPPER_ROOM.minZ&&z<=UPPER_ROOM.maxZ)return UPPER_FLOOR_Y;
    return GROUND_Y
  }
  isUpperBlocked(x,z){
    const r=PLAYER_RADIUS,onStairs=x>STAIR.minX+.14&&x<STAIR.maxX-.14&&z>STAIR.minZ&&z<STAIR.maxZ,onLanding=x>UPPER_LANDING.minX+.04&&x<UPPER_LANDING.maxX-.52&&z>UPPER_LANDING.minZ+.06&&z<UPPER_LANDING.maxZ-.22,onRoom=x>UPPER_ROOM.minX+r&&x<UPPER_ROOM.maxX-r*.1&&z>UPPER_ROOM.minZ+r&&z<UPPER_ROOM.maxZ-r;
    if(!onStairs&&!onLanding&&!onRoom)return true;
    const hitRect=(minX,maxX,minZ,maxZ)=>x>minX-r&&x<maxX+r&&z>minZ-r&&z<maxZ+r;
    if(onRoom&&([[-3.03,-.47,3.52,4.5],[.47,3.03,3.52,4.5]].some(a=>hitRect(...a))))return true;
    if(this.upperDoorOpen<.72&&hitRect(4.38,4.72,2.38,3.9))return true;
    return false
  }
  isBlocked(x,z,ignoreVehicle=null,y=this.player?.position.y??GROUND_Y){
    if(y>GROUND_Y+.08)return this.isUpperBlocked(x,z);
    const r=PLAYER_RADIUS;if(x<-9.2+r||x>9.2-r||z<-13.2+r||z>4.55-r)return true;const hitRect=(minX,maxX,minZ,maxZ)=>x>minX-r&&x<maxX+r&&z>minZ-r&&z<maxZ+r;
    const fixed=[[-4.95,4.95,4.7,5.05],[-4.92,-4.44,-2.7,5.05],[4.44,4.92,-2.7,5.05],[-4.72,-1.27,-2.72,-2.5],[1.27,4.72,-2.72,-2.5],[-3.12,3.12,-1.23,.13],[-3.5,3.5,3.72,4.68],[-2.55-.73,-2.55+.73,-8.15,-6.65],[2.55-.73,2.55+.73,-8.15,-6.65]];if(fixed.some(a=>hitRect(...a)))return true;
    if(this.doorGlass.some(door=>hitRect(door.position.x-.6,door.position.x+.6,-2.74,-2.58)))return true;
    const circles=[[-6.6,-5.2,.3],[-3.82,3.05,.43],[.25,2.93,.5],[3.75,2,.58],[-2.75,3.18,.46]];if(circles.some(([cx,cz,cr])=>Math.hypot(x-cx,z-cz)<r+cr))return true;
    for(const c of this.cars){if(c!==ignoreVehicle&&this.pointInVehicle(x,z,c,PLAYER_RADIUS))return true}if(this.specialVan&&this.specialVan!==ignoreVehicle&&this.pointInVehicle(x,z,this.specialVan,PLAYER_RADIUS))return true;return false
  }
  pointInVehicle(x,z,vehicle,margin=0,position=vehicle.group.position,rotationY=vehicle.group.rotation.y){
    const dx=x-position.x,dz=z-position.z,c=Math.cos(rotationY),s=Math.sin(rotationY),lx=dx*c-dz*s,lz=dx*s+dz*c;
    return Math.abs(lx)<vehicle.halfWidth+margin&&Math.abs(lz)<vehicle.halfLength+margin
  }
  playerInStopZone(vehicle){
    const z=vehicle.safeZone;if(!z||!this.player)return false;
    return Math.abs(this.player.position.x-z.x)<z.halfWidth&&Math.abs(this.player.position.z-z.z)<z.halfLength
  }
  activeVehicles(){return [...this.cars,...this.traffic,...(this.specialVan?[this.specialVan]:[])]}
  vehiclesOverlap(vehicle,position,rotationY,other,margin=VEHICLE_MARGIN){
    const ac=Math.cos(rotationY),as=Math.sin(rotationY),bc=Math.cos(other.group.rotation.y),bs=Math.sin(other.group.rotation.y);
    const axes=[[ac,-as],[as,ac],[bc,-bs],[bs,bc]],dx=other.group.position.x-position.x,dz=other.group.position.z-position.z;
    const ahw=vehicle.halfWidth+margin/2,ahl=vehicle.halfLength+margin/2,bhw=other.halfWidth+margin/2,bhl=other.halfLength+margin/2;
    for(const [x,z] of axes){
      const distance=Math.abs(dx*x+dz*z),aRadius=ahw*Math.abs(x*ac-z*as)+ahl*Math.abs(x*as+z*ac),bRadius=bhw*Math.abs(x*bc-z*bs)+bhl*Math.abs(x*bs+z*bc);
      if(distance>=aRadius+bRadius)return false
    }
    return true
  }
  vehicleAtStartIsBlocked(vehicle){return this.activeVehicles().some(other=>other!==vehicle&&this.vehiclesOverlap(vehicle,vehicle.group.position,vehicle.group.rotation.y,other))}
  vehicleForward(vehicle){return {x:-Math.sin(vehicle.group.rotation.y),z:-Math.cos(vehicle.group.rotation.y)}}
  shouldYield(vehicle,other){
    const af=this.vehicleForward(vehicle),bf=this.vehicleForward(other),sameDirection=af.x*bf.x+af.z*bf.z>.65;
    if(sameDirection){const ahead=(other.group.position.x-vehicle.group.position.x)*af.x+(other.group.position.z-vehicle.group.position.z)*af.z;if(Math.abs(ahead)>.15)return ahead>0}
    if(vehicle.mergeCommitted&&other.status==='passing')return false;
    if(vehicle.status==='passing'&&other.mergeCommitted)return true;
    if(vehicle.status==='passing'&&other.group.position.z>-12.65)return false;
    if(other.status==='passing'&&vehicle.group.position.z>-12.65)return true;
    return (vehicle.id||0)>(other.id||0)
  }
  mergeClear(vehicle){
    const away=-vehicle.side,lane=laneFor(away),start=vehicle.slotX+vehicle.side*4.6,mergeX=start+away*14;
    return !this.activeVehicles().some(other=>other!==vehicle&&other.group.position.z<-12.4&&Math.abs(other.group.position.z-lane)<2.15&&Math.abs(other.group.position.x-mergeX)<22)
  }
  canVehicleAdvance(vehicle,step){
    const previousBlocker=vehicle.blockedByVehicle;vehicle.blockedByPlayer=false;vehicle.blockedByVehicle=null;
    // Последние метры перед колонкой — отдельная безопасная зона: машина ждёт снаружи,
    // пока игрок не освободит всё парковочное место, а не только точку под центром кузова.
    const approachingStop=vehicle.status===VEHICLE_STATE.APPROACHING_PUMP||(vehicle===this.specialVan&&vehicle.status===VEHICLE_STATE.ENTERING);
    if(this.player&&approachingStop&&vehicle.path.len-vehicle.dist<SAFE_APPROACH&&this.playerInStopZone(vehicle)){vehicle.blockedByPlayer=true;return false}
    if(this.player&&this.pointInVehicle(this.player.position.x,this.player.position.z,vehicle,PLAYER_RADIUS+SAFE_MARGIN,step.position,step.rotationY)){vehicle.blockedByPlayer=true;return false}
    // Средняя точка шага закрывает щель между кадрами при низком FPS и на крутом повороте.
    const mid={x:(step.from.x+step.position.x)/2,z:(step.from.z+step.position.z)/2};
    const turn=Math.atan2(Math.sin(step.rotationY-vehicle.group.rotation.y),Math.cos(step.rotationY-vehicle.group.rotation.y));
    if(this.player&&this.pointInVehicle(this.player.position.x,this.player.position.z,vehicle,PLAYER_RADIUS+SAFE_MARGIN,mid,vehicle.group.rotation.y+turn/2)){vehicle.blockedByPlayer=true;return false}
    // Небольшой гистерезис удерживает тормоз, пока впереди действительно не освободится зазор.
    if(previousBlocker&&this.activeVehicles().includes(previousBlocker)&&this.shouldYield(vehicle,previousBlocker)&&this.vehiclesOverlap(vehicle,vehicle.group.position,vehicle.group.rotation.y,previousBlocker,VEHICLE_MARGIN+.36)){vehicle.blockedByVehicle=previousBlocker;return false}
    const other=this.activeVehicles().find(v=>v!==vehicle&&this.shouldYield(vehicle,v)&&(this.vehiclesOverlap(vehicle,step.position,step.rotationY,v)||this.vehiclesOverlap(vehicle,mid,vehicle.group.rotation.y+turn/2,v)));
    if(other){vehicle.blockedByVehicle=other;return false}return true
  }
  resolvePlayerOverlap(vehicle,dt){
    if(!this.player||!this.pointInVehicle(this.player.position.x,this.player.position.z,vehicle,PLAYER_RADIUS))return;
    const p=this.player.position,vp=vehicle.group.position,a=vehicle.group.rotation.y,c=Math.cos(a),s=Math.sin(a),dx=p.x-vp.x,dz=p.z-vp.z,lx=dx*c-dz*s,lz=dx*s+dz*c;
    const hx=vehicle.halfWidth+PLAYER_RADIUS+.04,hz=vehicle.halfLength+PLAYER_RADIUS+.04;
    const exits=[[Math.sign(lx)||1,hx,lz],[-(Math.sign(lx)||1),hx,lz],[lx,Math.sign(lz)||1,hz],[lx,-(Math.sign(lz)||1),hz]].map(([axis,bound,other],i)=>{
      const tx=i<2?axis*bound:THREE.MathUtils.clamp(axis,-hx,hx),tz=i<2?THREE.MathUtils.clamp(other,-hz,hz):other*bound;
      return {x:vp.x+tx*c+tz*s,z:vp.z-tx*s+tz*c,d:Math.hypot(tx-lx,tz-lz)}
    }).sort((a,b)=>a.d-b.d);
    const target=exits.find(q=>!this.isBlocked(q.x,q.z,vehicle));if(!target)return;
    const mx=target.x-p.x,mz=target.z-p.z,len=Math.hypot(mx,mz)||1,step=Math.min(len,3.2*dt);
    const nx=p.x+mx/len*step,nz=p.z+mz/len*step;if(!this.isBlocked(nx,nz,vehicle)){p.x=nx;p.z=nz}
  }
  updateCars(dt){
    this.dispatchQueuedCars();
    for(const c of [...this.cars]){
      if(c.status===VEHICLE_STATE.ENTERING){this.resolvePlayerOverlap(c,dt);if(drive(c,dt)){c.status=VEHICLE_STATE.QUEUEING;c.phase='queued';c.speed=0;c.lights.set({brake:true,beam:false,reverse:false});this.dispatchQueuedCars()}}
      else if(c.status===VEHICLE_STATE.QUEUEING){if(c.phase==='advancingQueue'){this.resolvePlayerOverlap(c,dt);if(drive(c,dt)){c.phase='queued';c.speed=0;c.lights.set({brake:true,beam:false,reverse:false});this.dispatchQueuedCars()}}}
      else if(c.status===VEHICLE_STATE.APPROACHING_PUMP){this.resolvePlayerOverlap(c,dt);if(drive(c,dt)){c.status=VEHICLE_STATE.WAITING;c.phase='parked';c.speed=0;c.lights.set({brake:false,beam:false,reverse:false});this.addFuelJob(c)}}
      else if(c.status===VEHICLE_STATE.LEAVING){
        if(c.phase==='yielding'){c.speed=0;c.lights.set({brake:true,beam:false,reverse:false});if(this.mergeClear(c)){c.phase='exiting';c.mergeCommitted=true;setPath(c,exitPath(c.slotX,SLOT_Z,c.side),11.5);audio.tone(96,.5,'sawtooth',.07)}continue}
        this.resolvePlayerOverlap(c,dt);if(drive(c,dt)){if(c.phase==='reversing'){c.phase='yielding';c.speed=0;c.blockedByVehicle=null;if(c.pump?.car===c){c.pump.car=null;c.pump.departingCar=c}this.dispatchQueuedCars()}else this.despawn(c,this.cars)}
      }
    }
    this.dispatchQueuedCars();
    const v=this.specialVan;
    if(v){
      if(v.status===VEHICLE_STATE.ENTERING){this.resolvePlayerOverlap(v,dt);if(drive(v,dt)){v.status=VEHICLE_STATE.WAITING;v.phase='parked';v.speed=0;v.lights.set({brake:false,beam:false,reverse:false});this.addJob({title:'Проверьте странный фургон',sub:'Водитель молчит и не открывает окно',pos:()=>v.group.position,duration:2.8,patience:40,onComplete:()=>{this.state.money+=90;this.state.rep=Math.min(5,this.state.rep+.1);this.eventNotice('…','Внутри никого','На сиденье лежал чек с завтрашней датой. Вы получили ₽90.');audio.spooky();this.leaveSpecialVan()}})}}
      else if(v.status===VEHICLE_STATE.LEAVING){
        if(v.phase==='yielding'){v.speed=0;v.lights.set({brake:true,beam:false,reverse:false});if(this.mergeClear(v)){v.phase='exiting';v.mergeCommitted=true;setPath(v,exitPath(VAN_SLOT.x,VAN_SLOT.z,v.side),10)}}
        else{this.resolvePlayerOverlap(v,dt);if(drive(v,dt)){if(v.phase==='reversing'){v.phase='yielding';v.speed=0;v.blockedByVehicle=null}else{this.despawn(v);this.specialVan=null}}}
      }
    }
    for(const t of [...this.traffic])if(drive(t,dt))this.despawn(t,this.traffic);
  }
  /* Попутный транспорт: заправка стоит не в пустоте, по трассе изредка проезжают мимо. */
  updateTraffic(dt){
    this.trafficTimer-=dt;
    if(this.trafficTimer>0||this.traffic.length>=2)return;
    this.trafficTimer=9+Math.random()*13;
    const side=Math.random()<.5?-1:1,group=this.assets.car.clone(true);
    this.paintCar(group);this.scene.add(group);
    const t={id:++this.vehicleId,group,lights:addLights(group),halfWidth:1.18,halfLength:2.2,status:'passing',phase:'highway'};t.canAdvance=step=>this.canVehicleAdvance(t,step);
    let placed=false;for(const from of[side,-side]){setPath(t,passPath(from),13+Math.random()*4);if(!this.vehicleAtStartIsBlocked(t)){placed=true;break}}
    if(!placed){this.despawn(t);this.trafficTimer=2;return}t.speed=12;this.traffic.push(t);
  }
  paintCar(group){
    const colors=[0xb52f28,0x2e6380,0xd0a343,0x4f555b,0x315d3f,0x8d8f92,0x2a2f35];
    const color=colors[Math.floor(Math.random()*colors.length)];
    group.traverse(o=>{if(o.isMesh&&o.name.startsWith('CarBody')){o.material=o.material.clone();o.material.color.setHex(color);o.material.userData.owned=true}});
  }
  despawn(vehicle,list){
    if(this.fuelHose?.car===vehicle)this.returnFuelHose(vehicle);
    this.scene.remove(vehicle.group);vehicle.lights?.dispose();
    vehicle.group.traverse(o=>{if(o.isMesh&&o.material?.userData?.owned)o.material.dispose()});
    if(list){const i=list.indexOf(vehicle);if(i>=0)list.splice(i,1)}
    const queueIndex=this.carQueue.indexOf(vehicle);if(queueIndex>=0)this.carQueue.splice(queueIndex,1);
    if(vehicle.pump&&vehicle.pump.car===vehicle)vehicle.pump.car=null;
  }
  spawnCar(){
    if(this.carQueue.length>=this.shiftConfig.queueSize)return false;
    const group=this.assets.car.clone(true),queueIndex=this.carQueue.length;
    this.paintCar(group);this.scene.add(group);
    const c={id:++this.vehicleId,group,pump:null,status:VEHICLE_STATE.ENTERING,phase:'joiningQueue',queueIndex,side:1,slotX:null,t:0,lights:addLights(group),halfWidth:1.18,halfLength:2.2,spot:null,target:queuePoint(queueIndex),safeZone:null,patience:this.shiftConfig.customerPatience};
    c.canAdvance=step=>this.canVehicleAdvance(c,step);
    setPath(c,queueEntryPath(queueIndex),10);if(this.vehicleAtStartIsBlocked(c)){this.despawn(c);return false}
    c.speed=9;this.cars.push(c);this.carQueue.push(c);audio.tone(105,.35,'sawtooth',.12);
    return true
  }
  refreshQueuePositions(){
    this.carQueue.forEach((car,index)=>{
      if(car.queueIndex===index)return;car.queueIndex=index;car.target=queuePoint(index);
      setPath(car,queueAdvancePath(car.group.position,index),5.5);car.phase='advancingQueue';car.speed=Math.min(car.speed||0,4)
    })
  }
  assignPump(car,pump){
    this.carQueue.shift();car.queueIndex=-1;car.pump=pump;car.side=Math.sign(pump.x)||1;car.slotX=pump.slotX;car.target=new THREE.Vector3(pump.slotX,ROAD.y,pump.z);car.spot=new THREE.Vector3(pump.x+car.side*1.25,.25,SLOT_Z);car.safeZone={x:pump.slotX,z:pump.z,halfWidth:car.halfWidth+PLAYER_RADIUS+SAFE_MARGIN,halfLength:car.halfLength+PLAYER_RADIUS+SAFE_MARGIN};pump.car=car;car.status=VEHICLE_STATE.APPROACHING_PUMP;car.phase='approachingPump';setPath(car,queueToPumpPath(car.group.position,pump.slotX,SLOT_Z),9);car.speed=Math.min(car.speed||0,5)
  }
  pumpReadyForArrival(pump){const departing=pump.departingCar;if(!departing)return true;const queueTailX=queuePoint(Math.max(0,this.shiftConfig.queueSize-1)).x,clear=!this.cars.includes(departing)||departing.phase==='exiting'&&(departing.side<0?departing.group.position.x>queueTailX+4:departing.dist>10);if(clear)pump.departingCar=null;return clear}
  dispatchQueuedCars(){
    let assigned=false;
    while(this.carQueue.length){const car=this.carQueue[0],pump=this.pumps.find(candidate=>!candidate.car&&!candidate.broken&&this.pumpReadyForArrival(candidate));if(!pump||car.status!==VEHICLE_STATE.QUEUEING||car.phase!=='queued')break;this.assignPump(car,pump);assigned=true}
    if(assigned)this.refreshQueuePositions();return assigned
  }
  addFuelJob(car,patience=car.patience){
    const number=this.pumps.indexOf(car.pump)+1,pickup=this.addJob({car,kind:'hose-pickup',title:`Возьмите пистолет колонки ${number}`,sub:'Снимите шланг с колонки',pos:()=>car.pump.hoseSpot,duration:.65,patience,onFail:()=>this.loseCustomer(car),onComplete:()=>{if(!this.freeHands()||car.status===VEHICLE_STATE.LEAVING||car.pump.car!==car)return false;const left=Math.max(10,pickup.patience||car.patience);this.takeFuelHose(car);this.addFuelAction(car,left)}});car.job=pickup
  }
  addFuelAction(car,patience){
    car.job=this.addJob({car,kind:'fuel',need:'hose',title:'Заправьте машину',sub:`Подойдите к лючку · колонка ${this.pumps.indexOf(car.pump)+1}`,pos:()=>car.spot,duration:2.7,patience,onFail:()=>{this.returnFuelHose(car);this.loseCustomer(car)},onComplete:()=>{this.returnFuelHose(car);car.status=VEHICLE_STATE.WAITING;const gain=75+this.shiftConfig.number*4;this.state.money+=gain;this.state.rep=Math.min(5,this.state.rep+.04);audio.success();this.toast(`Полный бак <b>+₽${gain}</b>`);if(Math.random()<this.shiftConfig.orderIntensity)this.createOrder(car);else{this.served++;setTimeout(()=>this.leaveCar(car),800)}}})
  }
  takeFuelHose(car){this.fuelHose={pump:car.pump,car};car.pump.hoseParts.forEach(o=>o.visible=false);this.carry='hose';this.updateCarry();this.updateFuelHoseVisual();audio.tone(240,.12,'square',.1)}
  returnFuelHose(car=null){
    if(!this.fuelHose||car&&this.fuelHose.car!==car)return;this.fuelHose.pump.hoseParts.forEach(o=>o.visible=true);this.fuelHose=null;this.hoseWorld.visible=false;if(this.carry==='hose'){this.carry=null;this.updateCarry()}
  }
  createOrder(car){
    car.status=VEHICLE_STATE.WAITING;const kind=Math.random()<.58?'coffee':'snack',isCoffee=kind==='coffee',source=isCoffee?COFFEE_SPOT:FOOD_SPOT,name=isCoffee?'кофе':'сэндвич',prepPatience=Math.round(this.shiftConfig.customerPatience*.7),deliveryPatience=Math.round(this.shiftConfig.customerPatience*.52);
    this.addJob({car,title:`Приготовьте ${name}`,sub:`Заказ с колонки ${this.pumps.indexOf(car.pump)+1} · осталось ${this.stock[kind]}/${MAX_FOOD_STOCK}`,pos:()=>source,duration:isCoffee?1.5:1.05,patience:prepPatience,onFail:()=>this.loseCustomer(car),onComplete:()=>{if(!this.freeHands())return false;if(this.stock[kind]<=0){this.toast(`${isCoffee?'Кофе':'Сэндвичи'} закончились — запас на втором этаже`);this.createRestockJob(kind);return false}this.stock[kind]--;this.carry=kind;this.updateCarry();this.updateHud();audio.tone(620,.12,'square',.14);this.addJob({car,title:`Отнесите ${name}`,sub:`К машине у колонки ${this.pumps.indexOf(car.pump)+1}`,pos:()=>car.spot,duration:.7,patience:deliveryPatience,onFail:()=>{this.carry=null;this.updateCarry();this.loseCustomer(car)},onComplete:()=>{if(this.carry!==kind)return false;this.carry=null;this.updateCarry();const gain=(isCoffee?55+this.state.upgrades.coffee*15:48);this.state.money+=gain;this.state.rep=Math.min(5,this.state.rep+.08);this.served++;audio.success();this.toast(`Заказ выдан <b>+₽${gain}</b>`);this.leaveCar(car);if(this.stock[kind]<=2)this.createRestockJob(kind)}})}})
  }
  setStockVisual(kind,visible){this.stockVisuals[kind]?.forEach(o=>o.visible=visible)}
  supplyCarry(kind){return kind==='coffee'?'coffeeBox':'snackBox'}
  /* Смена сама просит пополнить запас, когда он кончается. Задание видно в списке дел. */
  createRestockJob(kind='snack'){
    const tag=`restock-${kind}`,label=kind==='coffee'?'кофе':'сэндвичей';
    if(this.stock[kind]>=MAX_FOOD_STOCK||this.carry===this.supplyCarry(kind)||this.jobs.some(j=>j.tag===`${tag}-pick`||j.tag===`${tag}-put`))return;
    this.addJob({tag:`${tag}-pick`,priority:2,title:`Возьмите запас ${label}`,sub:'Склад на 2 этаже · лестница снаружи справа',pos:()=>SUPPLY_SPOTS[kind],duration:1.1,onComplete:()=>this.takeSupplyBox(kind)})
  }
  /* Коробка со стеллажа: и по заданию, и просто так, когда игрок сам решил сходить наверх. */
  takeSupplyBox(kind){
    if(this.stock[kind]>=MAX_FOOD_STOCK){this.toast(`${kind==='coffee'?'Кофемашина':'Витрина'} и так полная`);return false}
    if(!this.freeHands())return false;
    this.carry=this.supplyCarry(kind);this.setStockVisual(kind,false);this.updateCarry();audio.tone(300,.1,'square',.12);
    this.jobs.filter(j=>j.tag===`restock-${kind}-pick`).forEach(j=>this.removeJob(j));
    this.addSupplyDelivery(kind);return true
  }
  returnSupplyBox(kind){this.carry=null;this.setStockVisual(kind,true);this.updateCarry();this.jobs.filter(j=>j.tag===`restock-${kind}-put`).forEach(j=>this.removeJob(j));audio.tone(220,.1,'square',.1)}
  addSupplyDelivery(kind){
    const isCoffee=kind==='coffee',tag=`restock-${kind}-put`,carry=this.supplyCarry(kind);
    if(this.jobs.some(j=>j.tag===tag))return;
    this.addJob({tag,priority:2,title:`Пополните ${isCoffee?'кофемашину':'витрину еды'}`,sub:'Вернитесь на 1 этаж к аппарату у прилавка',pos:()=>isCoffee?COFFEE_SPOT:FOOD_SPOT,duration:1.6,onComplete:()=>{if(this.carry!==carry)return false;this.carry=null;this.stock[kind]=MAX_FOOD_STOCK;this.setStockVisual(kind,true);this.updateCarry();this.updateHud();this.state.money+=20;this.toast(`${isCoffee?'Кофе':'Сэндвичи'} пополнены: <b>${MAX_FOOD_STOCK}/${MAX_FOOD_STOCK}</b>`);audio.success()}})
  }
  leaveCar(car){if(!car||car.status===VEHICLE_STATE.LEAVING)return;this.returnFuelHose(car);this.jobs.filter(j=>j.car===car).forEach(j=>this.removeJob(j));car.status=VEHICLE_STATE.LEAVING;car.phase='reversing';car.mergeCommitted=false;setPath(car,reversePath(car.slotX,SLOT_Z,car.side),2.9);audio.tone(78,.45,'sine',.07)}
  loseCustomer(car){if(!car||car.status===VEHICLE_STATE.LEAVING)return;this.state.rep=Math.max(1,this.state.rep-.22);this.toast('<b>Клиент уехал недовольным</b>');audio.fail();this.leaveCar(car)}
  addJob(spec){const job={id:++this.jobId,created:this.elapsed,duration:1,patience:null,maxPatience:null,...spec};if(job.patience)job.maxPatience=job.patience;this.jobs.push(job);return job}
  removeJob(job){const i=this.jobs.indexOf(job);if(i>=0)this.jobs.splice(i,1);if(job.visual)this.scene.remove(job.visual);if(this.nearest===job){this.nearest=null;this.actionProgress=0}}
  worksDuringBlackout(job){return !this.blackout||job?.tag==='blackout'||job?.tag==='stand-tools'}
  updateJobs(dt){for(const j of [...this.jobs]){if(j.patience!=null&&this.worksDuringBlackout(j)){j.patience-=dt;if(j.patience<=0){this.removeJob(j);j.onFail?.()}}}this.renderTasks()}
  renderTasks(){const shown=this.jobs.filter(j=>!j.hidden).sort((a,b)=>(b.priority||0)-(a.priority||0)||a.created-b.created).slice(0,5),signature=shown.map(j=>j.id).join(',')+'|'+(this.nearest?.id||0);if(signature!==this.taskSignature){this.taskSignature=signature;ui.taskList.innerHTML=shown.map((j,i)=>`<div class="task ${j===this.nearest?'active':''}" data-job="${j.id}"><span class="num">0${i+1}</span><b>${this.jobLabel(j)}</b><small>${j.sub||''}</small>${j.patience!=null?'<div class="patience"><i></i></div>':''}</div>`).join('')||'<div class="task"><span class="num">✓</span><b>Всё спокойно</b><small>Осмотритесь вокруг</small></div>'}for(const j of shown){if(j.patience==null)continue;const bar=ui.taskList.querySelector(`[data-job="${j.id}"] .patience i`);if(bar)bar.style.width=`${Math.max(0,j.patience/j.maxPatience*100)}%`}}
  updateInteraction(dt){
    let nearest=null,best=2.15;for(const j of this.jobs){const p=j.pos(),py=p.y??GROUND_Y;let d=Math.hypot(p.x-this.player.position.x,p.z-this.player.position.z,py-this.player.position.y);if(j.hidden)d+=.85;if(j.need&&this.carry===j.need)d-=.5;if(d<best){best=d;nearest=j}}
    if(nearest!==this.nearest){this.nearest?.onProgress?.(0);this.nearest=nearest;this.actionProgress=0}
    const poweredOff=nearest&&!this.worksDuringBlackout(nearest),missing=nearest&&nearest.need&&this.carry!==nearest.need?nearest.need:null;
    this.marker.visible=!!nearest;if(nearest){const p=nearest.pos();this.marker.position.x=p.x;this.marker.position.z=p.z;this.markerBaseY=(p.y??GROUND_Y)-.08;ui.prompt.classList.remove('hidden');ui.promptKey.textContent=isTouch?'●':'E';ui.promptTitle.textContent=this.jobLabel(nearest);ui.promptSub.textContent=poweredOff?'Нет электричества — сначала почините щиток':missing?NEED_HINT[missing]:'Удерживайте для действия'}else ui.prompt.classList.add('hidden');
    for(const car of this.cars)if(car.status===VEHICLE_STATE.FUELING&&(nearest?.kind!=='fuel'||nearest.car!==car||!this.actionHeld||missing||poweredOff||this.actionLatched))car.status=VEHICLE_STATE.WAITING;
    if(nearest?.kind==='fuel'&&nearest.car?.status!==VEHICLE_STATE.LEAVING)nearest.car.status=this.actionHeld&&!missing&&!poweredOff&&!this.actionLatched?VEHICLE_STATE.FUELING:VEHICLE_STATE.WAITING;
    if(nearest&&this.actionHeld&&!missing&&!poweredOff&&!this.actionLatched){this.actionProgress+=dt*(1+this.state.upgrades.service*.15);nearest.onProgress?.(Math.min(1,this.actionProgress/nearest.duration));ui.progress.classList.remove('hidden');ui.progressFill.style.width=`${Math.min(100,this.actionProgress/nearest.duration*100)}%`;if(this.actionProgress>=nearest.duration){this.actionProgress=0;this.actionLatched=true;const ok=nearest.onComplete?.();if(ok!==false)this.removeJob(nearest)}}else{this.actionProgress=Math.max(0,this.actionProgress-dt*2.5);nearest?.onProgress?.(Math.min(1,this.actionProgress/nearest.duration));ui.progress.classList.add('hidden')}
  }
  triggerEvent(){
    const options=this.shiftConfig.allowedEvents.filter(x=>!(x==='blackout'&&this.blackout)&&!(x==='van'&&this.specialVan)&&!(x==='bag'&&this.jobs.some(j=>j.tag==='bag'))&&!(x==='spill'&&this.jobs.some(j=>j.tag==='spill'))&&!(x==='broken'&&this.jobs.some(j=>j.tag==='broken')));
    const type=options[Math.floor(Math.random()*options.length)];if(!type)return false;
    const handlers={spill:()=>this.spawnSpill(),blackout:()=>this.eventBlackout(),bag:()=>this.eventBag(),broken:()=>this.eventBrokenPump(),van:()=>this.eventVan(),whisper:()=>this.eventWhisper()};handlers[type]?.();return true
  }
  spawnSpill(){
    const p=new THREE.Vector3(0,.255,0);let fits=false;
    for(let i=0;i<60&&!fits;i++){p.set(-2.6+Math.random()*5.2,.255,.95+Math.random()*2.1);fits=this.spillFits(p)}
    if(!fits)p.set(1.6,.255,1.8);
    const visual=new THREE.Group(),coffee=new THREE.MeshBasicMaterial({color:0x6b2f1b,transparent:true,opacity:.94,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),shine=new THREE.MeshBasicMaterial({color:0xc7783e,transparent:true,opacity:.7,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3});
    [[0,0,.68,coffee],[-.48,.08,.28,coffee],[.43,-.18,.22,coffee],[.14,.3,.13,shine],[-.2,-.13,.09,shine]].forEach(([x,z,r,material],i)=>{const drop=new THREE.Mesh(new THREE.CircleGeometry(r,12),material);drop.name=i?'CoffeeDrop':'CoffeeSpill';drop.rotation.x=-Math.PI/2;drop.position.set(x,i*.001,z);drop.scale.set(1,i?.68:.82,1);drop.renderOrder=3;visual.add(drop)});visual.position.copy(p);this.scene.add(visual);
    this.eventNotice('≋','Кто-то разлил кофе','Пол становится липким. Швабра стоит внутри, за прилавком.');this.addJob({tag:'spill',need:'mop',title:'Уберите пятно',sub:'Швабра стоит внутри, за прилавком',pos:()=>p,duration:2.2,visual,onProgress:value=>{const size=Math.max(.12,1-value*.88);visual.scale.setScalar(size);visual.children.forEach((drop,i)=>drop.material.opacity=(i>2?.7:.94)*(.45+.55*(1-value)))},onComplete:()=>{this.state.money+=25;this.toast('Чисто! <b>+₽25</b>');audio.success();this.stowTool()}})
  }
  /* Лужа должна целиком лежать на полу и не спорить за внимание с инвентарём уборщика. */
  spillFits(p){
    if(Math.hypot(p.x-MOP_SPOT.x,p.z-MOP_SPOT.z)<1.25||this.isBlocked(p.x,p.z))return false;
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2;if(this.isBlocked(p.x+Math.cos(a)*.62,p.z+Math.sin(a)*.62))return false}
    return true
  }
  eventBlackout(){
    if(this.blackout)return;this.blackout=true;this.nearest?.onProgress?.(0);this.actionProgress=0;this.actionLatched=false;
    if(this.fuelHose){const car=this.fuelHose.car,fuelJob=this.jobs.find(j=>j.car===car&&j.kind==='fuel'),patience=fuelJob?.patience||car.patience;if(fuelJob)this.removeJob(fuelJob);this.returnFuelHose(car);if(car.status!==VEHICLE_STATE.LEAVING&&car.pump.car===car){car.status=VEHICLE_STATE.WAITING;this.addFuelJob(car,Math.max(10,patience))}}
    if(this.carry==='mop')this.stowTool();else if(this.carry&&this.carry!=='tools'){this.blackoutCarry=this.carry;this.carry=null;this.updateCarry()}
    this.setBlackout(true);audio.tone(58,.8,'sawtooth',.16);this.eventNotice('ϟ','Отключился свет','Вся заправка обесточена. Возьмите инструменты и идите к табличке «ЩИТОК».');
    this.addJob({tag:'blackout',priority:10,need:'tools',title:'Перезапустите щиток',sub:'Без света заправка, кофе и еда не работают',pos:()=>FUSE_SPOT,duration:2.4,onComplete:()=>{this.blackout=false;this.setBlackout(false);this.state.money+=35;this.stowTool();if(this.blackoutCarry){this.carry=this.blackoutCarry;this.blackoutCarry=null;this.updateCarry()}this.toast('Электричество вернулось <b>+₽35</b>');audio.success()}})
  }
  setBlackout(v){this.stationLights.forEach(l=>l.intensity=v?0:l.userData.onIntensity);this.hemi.intensity=v?.45:1.85;this.powerVisuals.forEach(o=>o.visible=!v);if(v){this.doorOpen=1;this.applyDoorOpen()}}
  eventBag(){const group=this.assets.bag.clone(true),p=new THREE.Vector3(-.8,.16,-3.25);group.position.copy(p);this.scene.add(group);this.eventNotice('?','Забытая сумка','Хозяина не видно. Отнесите её к табличке «НАХОДКИ».');this.addJob({tag:'bag',title:'Подберите сумку',sub:'Она появилась у входа',pos:()=>p,duration:1.2,visual:group,onComplete:()=>{if(!this.freeHands())return false;this.carry='bag';this.updateCarry();this.addJob({tag:'bag',title:'Отнесите сумку',sub:'В жёлтый ящик под табличкой «НАХОДКИ»',pos:()=>LOST_SPOT,duration:1,onComplete:()=>{if(this.carry!=='bag')return false;this.carry=null;this.updateCarry();this.state.rep=Math.min(5,this.state.rep+.18);this.toast('Честность замечена <b>+репутация</b>');audio.success()}})}})}
  eventBrokenPump(){const p=this.pumps[Math.floor(Math.random()*this.pumps.length)];if(p.broken||p.car){this.spawnSpill();return}p.broken=true;this.eventNotice('⚙','Заклинило колонку','Пахнет проводкой, но искр пока нет. Ящик с инструментом стоит в магазине.');this.addJob({tag:'broken',need:'tools',title:`Почините колонку ${this.pumps.indexOf(p)+1}`,sub:'Ящик с инструментом стоит в магазине',pos:()=>new THREE.Vector3(p.x,.2,p.z),duration:3.1,onComplete:()=>{p.broken=false;this.state.money+=65;this.toast('Колонка снова работает <b>+₽65</b>');audio.success();this.stowTool()}})}
  eventVan(){
    const group=this.assets.mystery_van.clone(true);this.scene.add(group);
    const v={id:++this.vehicleId,group,status:VEHICLE_STATE.ENTERING,phase:'approaching',side:-1,slotX:VAN_SLOT.x,t:0,lights:addLights(group,{front:-2.55,back:2.52,width:.7,y:.58,dark:true}),halfWidth:1.28,halfLength:2.5,safeZone:{x:VAN_SLOT.x,z:VAN_SLOT.z,halfWidth:1.28+PLAYER_RADIUS+SAFE_MARGIN,halfLength:2.5+PLAYER_RADIUS+SAFE_MARGIN}};
    v.canAdvance=step=>this.canVehicleAdvance(v,step);
    let placed=false;for(const direction of[1,-1]){setPath(v,entryPath(VAN_SLOT.x,VAN_SLOT.z,direction,laneFor(-direction)),8);if(!this.vehicleAtStartIsBlocked(v)){placed=true;break}}
    if(!placed){this.despawn(v);this.eventTimer=Math.min(this.eventTimer,3);return}v.speed=7;
    v.lights.set({beam:false,brake:false,reverse:false});this.specialVan=v;
    this.eventNotice('◉','Подозрительный фургон','Он подъехал без фар. Номер заляпан чем-то похожим на пепел.');audio.spooky()
  }
  leaveSpecialVan(){const v=this.specialVan;if(!v||v.status!==VEHICLE_STATE.WAITING)return;v.status=VEHICLE_STATE.LEAVING;v.phase='reversing';v.mergeCommitted=false;setPath(v,reversePath(VAN_SLOT.x,VAN_SLOT.z,v.side),2.6)}
  eventWhisper(){this.eventNotice('♫','Радио поймало помеху','Сквозь шум кто-то назвал ваше имя. Наверное, дальнобойщики шутят.');audio.spooky();const old=this.scene.fog.color.clone();this.scene.fog.color.set(0x160b20);setTimeout(()=>this.scene.fog.color.copy(old),7000)}
  eventNotice(icon,title,text){ui.event.classList.add('hidden');void ui.event.offsetWidth;ui.eventIcon.textContent=icon;ui.eventTitle.textContent=title;ui.eventText.textContent=text;ui.event.classList.remove('hidden');setTimeout(()=>ui.event.classList.add('hidden'),5300)}
  updateCarry(){ui.carrying.classList.toggle('hidden',!this.carry);$('#carrying b').textContent=CARRY_NAMES[this.carry]||'';this.hands.set(this.carry)}
  /* Швабру и инструмент можно взять и вернуть в любой момент; если нужны руки, они уходят на место сами. */
  addStandJobs(){
    this.addJob({tag:'stand-mop',hidden:true,sub:'Инвентарь уборщика за прилавком',duration:.55,pos:()=>MOP_SPOT,
      title:()=>this.carry==='mop'?'Верните швабру':'Возьмите швабру',
      onComplete:()=>{if(this.carry==='mop')this.stowTool();else if(this.freeHands()){this.carry='mop';this.kitMop.forEach(m=>m.visible=false);this.updateCarry();audio.tone(330,.09,'square',.12)}return false}});
    this.addJob({tag:'stand-tools',hidden:true,sub:'Ящик у левой стены магазина',duration:.55,pos:()=>TOOL_SPOT,
      title:()=>this.carry==='tools'?'Уберите инструменты':'Возьмите инструменты',
      onComplete:()=>{if(this.carry==='tools')this.stowTool();else if(this.freeHands()){this.carry='tools';this.updateCarry();audio.tone(280,.09,'square',.12)}return false}});
    for(const kind of ['coffee','snack']){
      const label=kind==='coffee'?'кофе':'сэндвичей';
      this.addJob({tag:`supply-${kind}`,hidden:true,sub:'Стеллаж запаса на складе',duration:.7,pos:()=>SUPPLY_SPOTS[kind],
        title:()=>this.carry===this.supplyCarry(kind)?`Верните запас ${label} на полку`:`Возьмите запас ${label}`,
        onComplete:()=>{if(this.carry===this.supplyCarry(kind))this.returnSupplyBox(kind);else this.takeSupplyBox(kind);return false}});
    }
  }
  freeHands(){if(!this.carry)return true;if(this.carry==='mop'||this.carry==='tools'){const note=STOW_NOTE[this.carry];this.stowTool();this.toast(note);return true}this.toast('Сначала отдайте то, что уже в руках');return false}
  stowTool(){if(this.carry!=='mop'&&this.carry!=='tools')return;if(this.carry==='mop')this.kitMop.forEach(m=>m.visible=true);this.carry=null;this.updateCarry()}
  jobLabel(job){return typeof job.title==='function'?job.title():job.title}
  updateHud(){ui.money.textContent=Math.floor(this.state.money).toLocaleString('ru-RU');ui.rep.textContent=this.state.rep.toFixed(1);if(ui.stockCoffee)ui.stockCoffee.textContent=`${this.stock.coffee}/${MAX_FOOD_STOCK}`;if(ui.stockSnack)ui.stockSnack.textContent=`${this.stock.snack}/${MAX_FOOD_STOCK}`;const remain=Math.max(0,this.shiftLength-this.elapsed),mins=Math.floor(remain/60),secs=Math.floor(remain%60);ui.clock.textContent=`${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;ui.shift.textContent=this.shiftConfig.mode===PLAY_MODE.ENDLESS?`БЕСКОНЕЧНАЯ · ${this.shiftConfig.number}`:`СМЕНА ${this.shiftConfig.number} / ${CAMPAIGN_SHIFT_COUNT}`}
  toast(html){const t=document.createElement('div');t.className='toast';t.innerHTML=html;ui.toasts.append(t);setTimeout(()=>t.remove(),3300)}
  finishShift(){
    this.mode='results';document.exitPointerLock?.();this.actionHeld=false;ui.mobile.classList.add('hidden');ui.crosshair.classList.add('hidden');ui.lookHint.classList.add('hidden');ui.prompt.classList.add('hidden');ui.progress.classList.add('hidden');ui.results.classList.remove('hidden');
    const earned=Math.max(0,Math.floor(this.state.money-this.shiftStartMoney)),campaignDone=isFinalCampaignShift(this.shiftConfig);this.shiftEarned=earned;this.state.best=Math.max(this.state.best,earned);if(this.shiftConfig.mode===PLAY_MODE.CAMPAIGN){this.state.campaignEarnings+=earned;this.state.campaignServed+=this.served}
    $('#result-money').textContent=`₽${earned}`;$('#result-served').textContent=this.served;$('#result-rep').textContent=`${this.state.rep.toFixed(1)}★`;$('#result-best').textContent=`₽${Math.floor(this.state.best)}`;$('#result-title').textContent=campaignDone?'Последняя ночь позади.':this.state.rep>4?'Трасса вас запомнит.':this.state.rep>2.4?'Неплохая ночка.':'Бывало и спокойнее.';
    if(this.shiftConfig.mode===PLAY_MODE.ENDLESS)this.state.shift=this.shiftConfig.number+1;else if(campaignDone)this.state.campaignComplete=true;else this.state.shift=this.shiftConfig.number+1;
    const upgrades=$('.upgrades');upgrades.classList.toggle('hidden',campaignDone);this.updateUpgradeButtons();const next=$('#next-shift');next.innerHTML=campaignDone?'ЗАВЕРШИТЬ КАМПАНИЮ <span>→</span>':'СЛЕДУЮЩАЯ СМЕНА <span>→</span>';
    const reward=$('#reward-btn');reward.textContent=`СМОТРЕТЬ РЕКЛАМУ: +₽${this.rewardBonus()}`;reward.classList.toggle('hidden',!gpState.available);reward.disabled=false;saveProgress(this.state)
  }
  showCampaignComplete(){
    this.mode='campaign-complete';document.exitPointerLock?.();ui.menu.classList.add('hidden');ui.results.classList.add('hidden');ui.hud.classList.add('hidden');ui.tasks.classList.add('hidden');ui.mobile.classList.add('hidden');ui.crosshair.classList.add('hidden');ui.lookHint.classList.add('hidden');ui.campaignComplete.classList.remove('hidden');$('#campaign-money').textContent=`₽${Math.floor(this.state.money)}`;$('#campaign-earned').textContent=`₽${Math.floor(this.state.campaignEarnings)}`;$('#campaign-served').textContent=this.state.campaignServed;$('#campaign-best').textContent=`₽${Math.floor(this.state.best)}`;saveProgress(this.state)
  }
  rewardBonus(){return Math.max(REWARD_MIN,Math.round(this.shiftEarned*REWARD_SHARE))}
  updateUpgradeButtons(){$$('.upgrades button').forEach(b=>{const costs={speed:200,service:250,coffee:180},lvl=this.state.upgrades[b.dataset.upgrade]||0;b.disabled=lvl>=3||this.state.money<costs[b.dataset.upgrade];b.querySelector('b').textContent=lvl>=3?'МАКС':`₽${costs[b.dataset.upgrade]}`})}
  buyUpgrade(key){const costs={speed:200,service:250,coffee:180},cost=costs[key];if(this.state.money<cost||(this.state.upgrades[key]||0)>=3)return;this.state.money-=cost;this.state.upgrades[key]=(this.state.upgrades[key]||0)+1;audio.success();this.updateUpgradeButtons();this.updateHud();saveProgress(this.state)}
  pause(){if(this.mode!=='playing')return;this.mode='paused';document.exitPointerLock?.();ui.pause.classList.remove('hidden');ui.mobile.classList.add('hidden');ui.lookHint.classList.add('hidden');audio.pause(true)}
  resume(){if(this.mode!=='paused')return;this.mode='playing';ui.pause.classList.add('hidden');ui.mobile.classList.toggle('hidden',!isTouch);ui.crosshair.classList.remove('hidden');ui.lookHint.classList.toggle('hidden',isTouch||document.pointerLockElement===this.canvas);audio.pause(false);this.lockPointer();this.clock.getDelta()}
  toggleSound(){this.state.sound=!this.state.sound;audio.setMuted(!this.state.sound);$('#sound-btn').textContent=`ЗВУК: ${this.state.sound?'ВКЛ':'ВЫКЛ'}`;saveProgress(this.state)}
  visibility(){if(document.hidden&&this.mode==='playing')this.pause();audio.pause(document.hidden||this.mode==='paused')}
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.55));this.renderer.setSize(innerWidth,innerHeight)}
  run(){const loop=()=>{requestAnimationFrame(loop);const dt=Math.min(.2,this.clock.getDelta());this.update(dt)};loop()}
}

const game=new NightStationGame();
window.__nightStation=game;
let cloudSave=null;initGamePush(data=>{cloudSave=data;game.setState(data);$('#continue-btn').classList.remove('hidden');bindAdPause(v=>{audio.pause(v);if(v&&game.mode==='playing')game.pause()})});
try{
  await game.load();game.setState(cloudSave||loadLocal()||DEFAULT_PROGRESS);audio.setMuted(!game.state.sound);setTimeout(()=>{ui.loading.classList.add('hidden');game.showMenu()},450);game.run();
}catch(error){console.error(error);ui.loadText.textContent='Не удалось загрузить смену. Обновите страницу.';ui.loadText.style.color='#ff795f'}
