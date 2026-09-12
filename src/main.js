import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';
import { AudioSystem } from './audio.js';
import { initGamePush, loadLocal, saveProgress, showInterstitial, showRewarded, gpState, bindAdPause } from './gamepush.js';
import { HandView } from './hands.js';
import { ROAD, laneFor, entryPath, reversePath, exitPath, passPath, addLights, drive, setPath } from './traffic.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const ui={
  loading:$('#loading'),loadFill:$('#load-fill'),loadText:$('#loading-text'),menu:$('#menu'),hud:$('#hud'),tasks:$('#tasks'),taskList:$('#task-list'),
  money:$('#money'),rep:$('#reputation'),clock:$('#clock'),shift:$('#shift-label'),prompt:$('#prompt'),promptKey:$('#prompt-key'),promptTitle:$('#prompt-title'),promptSub:$('#prompt-subtitle'),
  progress:$('#progress'),progressFill:$('#progress i'),toasts:$('#toast-zone'),carrying:$('#carrying'),event:$('#event-card'),eventIcon:$('#event-icon'),eventTitle:$('#event-title'),eventText:$('#event-text'),
  tutorial:$('#tutorial'),guide:$('#guide'),pause:$('#pause'),results:$('#results'),mobile:$('#mobile-controls'),crosshair:$('#crosshair'),lookHint:$('#look-hint')
};
const audio=new AudioSystem();
const SAVE_DEFAULT={money:0,shift:1,rep:3,upgrades:{speed:0,service:0,coffee:0},tutorial:false,sound:true,best:0};
const isTouch=matchMedia('(pointer:coarse)').matches;
const SLOT_Z=-7.4,SLOT_OFFSET=2.3,VAN_SLOT={x:7.6,z:-7.4};
const MOP_SPOT=new THREE.Vector3(-3.7,.25,-3.25),TOOL_SPOT=new THREE.Vector3(-4.28,.3,-.45);
const STOW_NOTE={mop:'Швабра вернулась на место',tools:'Инструменты вернулись в ящик'};
const NEED_HINT={mop:'Сначала возьмите швабру у входа',tools:'Сначала возьмите инструменты в магазине'};
const CARRY_NAMES={coffee:'Кофе',snack:'Сэндвич',box:'Коробка товара',bag:'Забытая сумка',mop:'Швабра',tools:'Инструменты'};

class NightStationGame{
  constructor(){
    this.canvas=$('#scene');this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x091820);this.scene.fog=new THREE.FogExp2(0x091820,.022);
    this.camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.08,120);this.camera.position.set(0,1.65,-2.8);this.camera.rotation.order='YXZ';
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.55));this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.28;
    this.clock=new THREE.Clock();this.assets={};this.mode='loading';this.player=null;this.jobs=[];this.cars=[];this.traffic=[];this.pumps=[];this.nearest=null;this.actionHeld=false;this.actionLatched=false;this.actionProgress=0;this.keys={};this.joy={x:0,y:0};this.yaw=0;this.pitch=-.04;this.lookTouch=null;this.jobId=0;this.taskSignature='';this.guideIndex=0;this.resumeAfterGuide=false;this.elapsed=0;this.shiftLength=210;this.spawnTimer=2;this.eventTimer=24;this.trafficTimer=4;this.stock=6;this.carry=null;this.served=0;this.shiftStartMoney=0;this.blackout=false;this.specialVan=null;this.state={...SAVE_DEFAULT,upgrades:{...SAVE_DEFAULT.upgrades}};
    this.hands=new HandView();this.moving=false;this.lastYaw=0;this.lastPitch=0;
    this.setupWorld();this.setupInput();this.setupUI();window.addEventListener('resize',()=>this.resize());document.addEventListener('visibilitychange',()=>this.visibility());
  }
  setupWorld(){
    const hemi=new THREE.HemisphereLight(0x7faabb,0x0b1715,1.85);this.scene.add(hemi);this.hemi=hemi;
    this.stationLights=[];
    [[-2.5,6,-7.4],[2.5,6,-7.4],[0,4,-.5]].forEach(([x,y,z],i)=>{const l=new THREE.PointLight(i===2?0xffdfad:0xb9efff,i===2?22:28,15,1.5);l.position.set(x,y,z);l.castShadow=i===2;l.shadow.mapSize.set(512,512);this.scene.add(l);this.stationLights.push(l)});
    const moon=new THREE.DirectionalLight(0x86a3c5,3.1);moon.position.set(-12,18,9);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);moon.shadow.camera.left=-22;moon.shadow.camera.right=22;moon.shadow.camera.top=22;moon.shadow.camera.bottom=-22;this.scene.add(moon);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:0x182620,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;this.scene.add(ground);
    const forecourt=new THREE.Mesh(new THREE.PlaneGeometry(19,23),new THREE.MeshStandardMaterial({color:0x263239,roughness:.95}));forecourt.rotation.x=-Math.PI/2;forecourt.position.set(0,.012,-5);forecourt.receiveShadow=true;this.scene.add(forecourt);
    // Трасса тянется дальше, чем видит туман: машины успевают выехать и уехать по дороге.
    const road=new THREE.Mesh(new THREE.PlaneGeometry(144,9),new THREE.MeshStandardMaterial({color:0x070b0e,roughness:.97}));road.rotation.x=-Math.PI/2;road.position.set(0,.02,ROAD.center);road.receiveShadow=true;this.scene.add(road);
    const apron=new THREE.Mesh(new THREE.PlaneGeometry(21,5.4),new THREE.MeshStandardMaterial({color:0x1d272c,roughness:.96}));apron.rotation.x=-Math.PI/2;apron.position.set(0,.026,-13.2);apron.receiveShadow=true;this.scene.add(apron);
    const stripeMat=new THREE.MeshBasicMaterial({color:0xb7a55f}),edgeMat=new THREE.MeshBasicMaterial({color:0x6d7472}),postMat=new THREE.MeshStandardMaterial({color:0xdad3bc,roughness:.9}),reflectMat=new THREE.MeshBasicMaterial({color:0xff7a2f});
    for(let x=-66;x<67;x+=6){const s=new THREE.Mesh(new THREE.PlaneGeometry(3.2,.13),stripeMat);s.rotation.x=-Math.PI/2;s.position.set(x,.035,ROAD.center);this.scene.add(s)}
    for(let x=-66;x<67;x+=8){const e=new THREE.Mesh(new THREE.PlaneGeometry(7.4,.1),edgeMat);e.rotation.x=-Math.PI/2;e.position.set(x,.034,-21.2);this.scene.add(e)}
    for(let x=-60;x<61;x+=10){const p=new THREE.Mesh(new THREE.BoxGeometry(.1,1,.1),postMat);p.position.set(x,.5,-21.9);this.scene.add(p);const r=new THREE.Mesh(new THREE.PlaneGeometry(.09,.16),reflectMat);r.position.set(x,.8,-21.84);this.scene.add(r)}
    const gravelMat=new THREE.MeshStandardMaterial({color:0x18201d,roughness:1});for(let i=0;i<24;i++){const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.12+Math.random()*.2,0),gravelMat);const side=Math.random()<.5?-1:1;rock.position.set(side*(10+Math.random()*15),.13,-5+Math.random()*23);rock.scale.y=.45;this.scene.add(rock)}
    const trunkMat=new THREE.MeshStandardMaterial({color:0x20170d}),pineMat=new THREE.MeshStandardMaterial({color:0x071c15});for(let i=0;i<20;i++){const side=Math.random()<.5?-1:1,x=side*(13+Math.random()*20),z=-10+Math.random()*33;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,1.8,7),trunkMat);trunk.position.set(x,.9,z);const crown=new THREE.Mesh(new THREE.ConeGeometry(1.2+Math.random()*.8,3.7+Math.random()*2,7),pineMat);crown.position.set(x,3,z);this.scene.add(trunk,crown)}
    const starGeo=new THREE.BufferGeometry(),starPos=[];for(let i=0;i<220;i++){const a=Math.random()*Math.PI*2,r=42+Math.random()*35,y=14+Math.random()*30;starPos.push(Math.cos(a)*r,y,Math.sin(a)*r)}starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));this.scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xbad7df,size:.11,transparent:true,opacity:.75})));
    // Ящик с инструментом у левой стены магазина: отсюда берут отвёртку и ключ.
    const toolbox=new THREE.Group();toolbox.position.set(TOOL_SPOT.x,.24,TOOL_SPOT.z);
    const boxMat=new THREE.MeshStandardMaterial({color:0xc2411f,roughness:.72}),steelMat=new THREE.MeshStandardMaterial({color:0x9aa5ab,roughness:.42,metalness:.55});
    const body=new THREE.Mesh(new THREE.BoxGeometry(.5,.27,.34),boxMat);body.position.y=.135;body.castShadow=true;toolbox.add(body);
    const lid=new THREE.Mesh(new THREE.BoxGeometry(.52,.06,.36),steelMat);lid.position.y=.3;toolbox.add(lid);
    const grip=new THREE.Mesh(new THREE.TorusGeometry(.07,.014,5,10,Math.PI),steelMat);grip.position.y=.33;grip.rotation.y=Math.PI/2;toolbox.add(grip);
    for(const s of[-1,1]){const clip=new THREE.Mesh(new THREE.BoxGeometry(.04,.08,.02),steelMat);clip.position.set(s*.16,.24,-.18);toolbox.add(clip)}
    this.toolbox=toolbox;this.scene.add(toolbox);
    this.marker=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(.68,.055,7,24),new THREE.MeshBasicMaterial({color:0xffad32,transparent:true,opacity:.9,depthWrite:false}));ring.rotation.x=Math.PI/2;this.marker.add(ring);const beam=new THREE.Mesh(new THREE.CylinderGeometry(.04,.45,1.6,8,1,true),new THREE.MeshBasicMaterial({color:0xffad32,transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false}));beam.position.y=.8;this.marker.add(beam);this.marker.visible=false;this.scene.add(this.marker);
  }
  async load(){
    const loader=new GLTFLoader(),files=['station','pump','car','mystery_van','worker','bag','cleaning_kit'];let done=0;
    await Promise.all(files.map(async name=>{const gltf=await loader.loadAsync(`models/${name}.glb`);this.assets[name]=gltf.scene;gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=name!=='station'||!o.name.includes('Floor');o.receiveShadow=true}});done++;ui.loadFill.style.width=`${12+done/files.length*82}%`;ui.loadText.textContent=['Проверяем кофемашину…','Расставляем товар…','Протираем колонку…','Включаем фонари…','Слушаем тишину…','Считаем сдачу…','Открываем смену…'][done-1]}));
    const station=this.assets.station.clone(true);station.position.set(0,0,0);station.traverse(o=>{if(o.isMesh&&['Canopy','CanopyStripe','CanopyLight'].includes(o.name))o.visible=false;if(o.isMesh&&o.name==='Roof'){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.28;o.material.depthWrite=false}});this.scene.add(station);
    for(const x of [-2.55,2.55]){const model=this.assets.pump.clone(true);model.position.set(x,.24,SLOT_Z);this.scene.add(model);this.pumps.push({x,z:SLOT_Z,model,car:null,broken:false,slotX:x+Math.sign(x)*SLOT_OFFSET})}
    this.player=this.assets.worker.clone(true);this.player.position.set(0,.26,-2.8);this.player.scale.setScalar(.92);this.scene.add(this.player);
    const kit=this.assets.cleaning_kit.clone(true);kit.position.copy(MOP_SPOT);kit.scale.setScalar(.8);this.scene.add(kit);
    this.kit=kit;this.kitMop=[];kit.traverse(o=>{if(o.isMesh&&o.name.startsWith('Mop'))this.kitMop.push(o)});
    this.hands.build(this.assets);
    this.camera.lookAt(0,0,-4);ui.loadFill.style.width='100%';
  }
  setupInput(){
    addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','KeyE'].includes(e.code))e.preventDefault();this.keys[e.code]=true;if(e.code==='KeyE')this.actionHeld=true;if(e.code==='Escape'&&this.mode==='playing')this.pause()});
    addEventListener('keyup',e=>{this.keys[e.code]=false;if(e.code==='KeyE'){this.actionHeld=false;this.actionProgress=0;this.actionLatched=false}});addEventListener('blur',()=>{this.keys={};this.actionHeld=false;this.actionLatched=false;this.joy={x:0,y:0}});
    this.canvas.addEventListener('click',()=>this.lockPointer());
    addEventListener('mousemove',e=>{if(document.pointerLockElement!==this.canvas||this.mode!=='playing')return;this.yaw-=e.movementX*.0022;this.pitch=THREE.MathUtils.clamp(this.pitch-e.movementY*.0019,-1.35,1.25)});
    document.addEventListener('pointerlockchange',()=>{ui.lookHint.classList.toggle('hidden',isTouch||this.mode!=='playing'||document.pointerLockElement===this.canvas)});
    this.canvas.addEventListener('pointerdown',e=>{if(!isTouch||this.mode!=='playing'||e.clientX<innerWidth*.32)return;this.lookTouch={id:e.pointerId,x:e.clientX,y:e.clientY};this.canvas.setPointerCapture(e.pointerId)});
    this.canvas.addEventListener('pointermove',e=>{if(!this.lookTouch||e.pointerId!==this.lookTouch.id)return;const dx=e.clientX-this.lookTouch.x,dy=e.clientY-this.lookTouch.y;this.lookTouch.x=e.clientX;this.lookTouch.y=e.clientY;this.yaw-=dx*.006;this.pitch=THREE.MathUtils.clamp(this.pitch-dy*.005,-1.2,1.15)});
    const stopLook=e=>{if(this.lookTouch&&e.pointerId===this.lookTouch.id)this.lookTouch=null};this.canvas.addEventListener('pointerup',stopLook);this.canvas.addEventListener('pointercancel',stopLook);
    const joy=$('#joystick'),nub=$('#joystick i');let joyId=null;const update=e=>{const r=joy.getBoundingClientRect(),x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2),len=Math.hypot(x,y)||1,m=Math.min(38,len),nx=x/len,ny=y/len;this.joy={x:nx*m/38,y:ny*m/38};nub.style.transform=`translate(${nx*m}px,${ny*m}px)`};
    joy.addEventListener('pointerdown',e=>{joyId=e.pointerId;joy.setPointerCapture(joyId);update(e)});joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)update(e)});const end=e=>{if(e.pointerId!==joyId)return;joyId=null;this.joy={x:0,y:0};nub.style.transform=''};joy.addEventListener('pointerup',end);joy.addEventListener('pointercancel',end);
    const act=$('#action-btn');act.addEventListener('pointerdown',e=>{e.preventDefault();this.actionHeld=true;act.setPointerCapture(e.pointerId)});const release=()=>{this.actionHeld=false;this.actionProgress=0;this.actionLatched=false};act.addEventListener('pointerup',release);act.addEventListener('pointercancel',release);
  }
  lockPointer(){if(isTouch||this.mode!=='playing'||document.pointerLockElement===this.canvas)return;try{const result=this.canvas.requestPointerLock?.();result?.catch?.(()=>{})}catch{}}
  setupUI(){
    $('#continue-btn').onclick=()=>this.prepareStart(false);$('#new-btn').onclick=()=>this.prepareStart(true);$('#tutorial-start').onclick=()=>{ui.tutorial.classList.add('hidden');this.state.tutorial=true;this.startShift();this.lockPointer()};
    $('#pause-btn').onclick=()=>this.pause();$('#resume-btn').onclick=()=>this.resume();$('#menu-btn').onclick=()=>{ui.pause.classList.add('hidden');this.showMenu()};$('#sound-btn').onclick=()=>this.toggleSound();
    $('#guide-btn').onclick=()=>this.openGuide();$('#guide-close').onclick=()=>this.closeGuide();$('#guide-prev').onclick=()=>{this.guideIndex=Math.max(0,this.guideIndex-1);this.renderGuide()};$('#guide-next').onclick=()=>{if(this.guideIndex>=3)this.closeGuide();else{this.guideIndex++;this.renderGuide()}};
    $('#next-shift').onclick=async()=>{ui.results.classList.add('hidden');await showInterstitial();this.startShift()};
    $('#reward-btn').onclick=async e=>{e.currentTarget.disabled=true;const success=await showRewarded();if(success){const bonus=Math.max(50,Math.round((this.state.money-this.shiftStartMoney)*.35));this.state.money+=bonus;this.toast(`Бонус за смену: <b>+₽${bonus}</b>`);this.updateHud();saveProgress(this.state)}e.currentTarget.classList.add('hidden')};
    $$('.upgrades button').forEach(b=>b.onclick=()=>this.buyUpgrade(b.dataset.upgrade));
  }
  setState(data){if(!data)return;this.state={...SAVE_DEFAULT,...data,upgrades:{...SAVE_DEFAULT.upgrades,...(data.upgrades||{})}};audio.setMuted(!this.state.sound)}
  showMenu(){this.mode='menu';document.exitPointerLock?.();this.camera.fov=43;this.camera.updateProjectionMatrix();this.camera.position.set(12,12,-16);this.camera.lookAt(0,1,-4);if(this.player)this.player.visible=true;ui.hud.classList.add('hidden');ui.tasks.classList.add('hidden');ui.mobile.classList.add('hidden');ui.prompt.classList.add('hidden');ui.crosshair.classList.add('hidden');ui.lookHint.classList.add('hidden');ui.menu.classList.remove('hidden');$('#continue-btn').classList.toggle('hidden',!loadLocal());}
  prepareStart(fresh){audio.ensure();if(fresh)this.setState({...SAVE_DEFAULT,upgrades:{...SAVE_DEFAULT.upgrades},tutorial:false});ui.menu.classList.add('hidden');if(!this.state.tutorial)ui.tutorial.classList.remove('hidden');else this.startShift()}
  startShift(){
    this.clearShift();this.addStandJobs();this.mode='playing';this.elapsed=0;this.spawnTimer=.8;this.eventTimer=24+Math.random()*7;this.trafficTimer=2.5;this.served=0;this.stock=6;this.shiftStartMoney=this.state.money;this.blackout=false;this.setBlackout(false);this.yaw=0;this.pitch=-.04;this.camera.fov=72;this.camera.updateProjectionMatrix();this.player.position.set(0,.26,-2.8);this.player.visible=false;ui.hud.classList.remove('hidden');ui.tasks.classList.remove('hidden');ui.crosshair.classList.remove('hidden');ui.lookHint.classList.toggle('hidden',isTouch||document.pointerLockElement===this.canvas);ui.mobile.classList.toggle('hidden',!isTouch);ui.results.classList.add('hidden');this.toast(`Смена ${this.state.shift} открыта. <b>До рассвета 03:30</b>`);this.updateHud();saveProgress(this.state);this.lockPointer()
  }
  clearShift(){for(const c of [...this.cars])this.despawn(c);this.cars=[];for(const t of [...this.traffic])this.despawn(t);this.traffic=[];for(const j of this.jobs)if(j.visual)this.scene.remove(j.visual);this.jobs=[];this.pumps.forEach(p=>{p.car=null;p.broken=false});if(this.specialVan){this.despawn(this.specialVan);this.specialVan=null}this.carry=null;this.kitMop?.forEach(m=>m.visible=true);this.updateCarry()}
  update(dt){
    if(this.mode==='playing')this.updatePlay(dt);else if(this.mode==='menu'||this.mode==='loading')this.updateMenu(dt);
    this.marker.rotation.y+=dt*.8;if(this.marker.visible)this.marker.position.y=.12+Math.sin(performance.now()*.003)*.08;
    const playing=this.mode==='playing';
    if(playing)this.hands.update(dt,{moving:this.moving,acting:this.actionHeld&&!!this.nearest,yawDelta:this.yaw-this.lastYaw,pitchDelta:this.pitch-this.lastPitch});
    this.lastYaw=this.yaw;this.lastPitch=this.pitch;
    this.renderer.render(this.scene,this.camera);
    if(playing)this.hands.render(this.renderer,this.camera.aspect)
  }
  updateMenu(dt){const t=performance.now()*.00025;const target=new THREE.Vector3(12+Math.sin(t)*2,12,-16+Math.cos(t)*2);this.camera.position.lerp(target,dt*.6);this.camera.lookAt(0,1,-4)}
  openGuide(){if(this.mode!=='playing')return;this.resumeAfterGuide=true;this.mode='guide';this.actionHeld=false;document.exitPointerLock?.();audio.pause(true);this.guideIndex=0;this.renderGuide();ui.mobile.classList.add('hidden');ui.lookHint.classList.add('hidden');ui.guide.classList.remove('hidden')}
  renderGuide(){const slides=[
    ['Как двигаться','Кликните по игре и осматривайтесь мышью. WASD — движение относительно взгляда, Shift — бег, E — действие. На телефоне: левый стик и свайп справа.','tutorial/01-controls.png'],
    ['Колонки и машины','Машины сворачивают с трассы к колонкам, а после заправки сдают назад и уезжают обратно по дороге. Подойдите к отмеченной машине и удерживайте E.','tutorial/02-pumps.png'],
    ['Кофе, еда и склад','Кофемашина — слева на прилавке, еда — на стеллаже справа, коробки для пополнения — в дальнем правом углу. Всё, что вы взяли, видно у вас в руках.','tutorial/03-shop.png'],
    ['Ночные происшествия','Список задач всегда слева. Щиток — в дальнем левом углу, бюро находок — справа. Для пятна нужна швабра у входа, для колонки — ящик с инструментом.','tutorial/04-events.png']
  ],s=slides[this.guideIndex];$('#guide-title').textContent=s[0];$('#guide-text').textContent=s[1];$('#guide-image').src=s[2];$('#guide-step').textContent=`${this.guideIndex+1} / ${slides.length}`;$('#guide-dots').innerHTML=slides.map((_,i)=>`<i class="${i===this.guideIndex?'active':''}"></i>`).join('');$('#guide-prev').disabled=this.guideIndex===0;$('#guide-next').textContent=this.guideIndex===slides.length-1?'В ИГРУ →':'ДАЛЬШЕ →'}
  closeGuide(){ui.guide.classList.add('hidden');if(!this.resumeAfterGuide)return;this.resumeAfterGuide=false;this.mode='playing';audio.pause(false);ui.mobile.classList.toggle('hidden',!isTouch);ui.lookHint.classList.toggle('hidden',isTouch||document.pointerLockElement===this.canvas);this.lockPointer();this.clock.getDelta()}
  updatePlay(dt){
    this.elapsed+=dt;if(this.elapsed>=this.shiftLength){this.finishShift();return}this.spawnTimer-=dt;this.eventTimer-=dt;
    if(this.spawnTimer<=0){this.spawnCar();this.spawnTimer=Math.max(10,22-this.state.shift*1.1)+Math.random()*8}
    if(this.eventTimer<=0){this.triggerEvent();this.eventTimer=31+Math.random()*17}
    this.updateTraffic(dt);
    this.updatePlayer(dt);this.updateCars(dt);this.updateJobs(dt);this.updateInteraction(dt);this.updateHud();
  }
  updatePlayer(dt){
    let strafe=(this.keys.KeyD?1:0)-(this.keys.KeyA?1:0)+this.joy.x,forward=(this.keys.KeyW?1:0)-(this.keys.KeyS?1:0)-this.joy.y;const len=Math.hypot(strafe,forward);let moving=false;
    if(len>.05){strafe/=Math.max(1,len);forward/=Math.max(1,len);const run=this.keys.ShiftLeft||this.keys.ShiftRight?1.55:1,speed=(4.35+this.state.upgrades.speed*.52)*run,fx=-Math.sin(this.yaw),fz=-Math.cos(this.yaw),rx=Math.cos(this.yaw),rz=-Math.sin(this.yaw),dx=(rx*strafe+fx*forward)*speed*dt,dz=(rz*strafe+fz*forward)*speed*dt;const nextX=this.player.position.x+dx,nextZ=this.player.position.z+dz,stuck=this.isBlocked(this.player.position.x,this.player.position.z);if(stuck||!this.isBlocked(nextX,this.player.position.z))this.player.position.x=nextX;if(stuck||!this.isBlocked(this.player.position.x,nextZ))this.player.position.z=nextZ;moving=true}
    this.moving=moving;const bob=moving?Math.sin(this.elapsed*11)*.035:0;this.camera.position.set(this.player.position.x,1.62+bob,this.player.position.z);this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ')
  }
  isBlocked(x,z){
    const r=.36;if(x<-9.2+r||x>9.2-r||z<-13.2+r||z>4.55-r)return true;const hitRect=(minX,maxX,minZ,maxZ)=>x>minX-r&&x<maxX+r&&z>minZ-r&&z<maxZ+r;
    const fixed=[[-4.95,4.95,4.7,5.05],[-4.92,-4.44,-2.7,5.05],[4.44,4.92,-2.7,5.05],[-3.12,3.12,-1.23,.13],[-4.22,-2.88,1.0,4.08],[2.88,4.22,1.0,4.08],[-2.55-.73,-2.55+.73,-8.15,-6.65],[2.55-.73,2.55+.73,-8.15,-6.65]];if(fixed.some(a=>hitRect(...a)))return true;
    const circles=[[-6.6,-5.2,.3],[4.1,-2.25,.25],[-3.7,-3.25,.28],[4.1,4.1,.42]];if(circles.some(([cx,cz,cr])=>Math.hypot(x-cx,z-cz)<r+cr))return true;
    for(const c of this.cars){if(hitRect(c.group.position.x-1.18,c.group.position.x+1.18,c.group.position.z-2.2,c.group.position.z+2.2))return true}if(this.specialVan&&hitRect(this.specialVan.group.position.x-1.28,this.specialVan.group.position.x+1.28,this.specialVan.group.position.z-2.5,this.specialVan.group.position.z+2.5))return true;return false
  }
  updateCars(dt){
    for(const c of [...this.cars]){
      if(c.status==='arriving'){if(drive(c,dt)){c.status='fuel';c.speed=0;c.lights.set({brake:false,beam:false,reverse:false});this.addFuelJob(c)}}
      else if(c.status==='reversing'){if(drive(c,dt)){c.status='shifting';c.wait=.55;c.speed=0;c.lights.set({brake:true,beam:false,reverse:true})}}
      else if(c.status==='shifting'){c.wait-=dt;if(c.wait<=0){c.status='leaving';setPath(c,exitPath(c.slotX,SLOT_Z,c.side),11.5);audio.tone(96,.5,'sawtooth',.07)}}
      else if(c.status==='leaving'){if(drive(c,dt))this.despawn(c,this.cars)}
    }
    const v=this.specialVan;
    if(v){
      if(v.status==='arriving'){if(drive(v,dt)){v.status='waiting';v.speed=0;v.lights.set({brake:false,beam:false,reverse:false});this.addJob({title:'Проверьте странный фургон',sub:'Водитель молчит и не открывает окно',pos:()=>v.group.position,duration:2.8,patience:40,onComplete:()=>{this.state.money+=90;this.state.rep=Math.min(5,this.state.rep+.1);this.eventNotice('…','Внутри никого','На сиденье лежал чек с завтрашней датой. Вы получили ₽90.');audio.spooky();this.leaveSpecialVan()}})}}
      else if(v.status==='reversing'){if(drive(v,dt)){v.status='shifting';v.wait=.6;v.speed=0}}
      else if(v.status==='shifting'){v.wait-=dt;if(v.wait<=0){v.status='leaving';setPath(v,exitPath(VAN_SLOT.x,VAN_SLOT.z,-1),10)}}
      else if(v.status==='leaving'){if(drive(v,dt)){this.despawn(v);this.specialVan=null}}
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
    const t={group,lights:addLights(group)};
    setPath(t,passPath(side),13+Math.random()*4);
    t.speed=12;this.traffic.push(t);
  }
  paintCar(group){
    const colors=[0xb52f28,0x2e6380,0xd0a343,0x4f555b,0x315d3f,0x8d8f92,0x2a2f35];
    const color=colors[Math.floor(Math.random()*colors.length)];
    group.traverse(o=>{if(o.isMesh&&o.name==='CarBody'){o.material=o.material.clone();o.material.color.setHex(color);o.material.userData.owned=true}});
  }
  despawn(vehicle,list){
    this.scene.remove(vehicle.group);vehicle.lights?.dispose();
    vehicle.group.traverse(o=>{if(o.isMesh&&o.material?.userData?.owned)o.material.dispose()});
    if(list){const i=list.indexOf(vehicle);if(i>=0)list.splice(i,1)}
    if(vehicle.pump&&vehicle.pump.car===vehicle)vehicle.pump.car=null;
  }
  spawnCar(){
    const pump=this.pumps.find(p=>!p.car&&!p.broken);if(!pump)return;
    const group=this.assets.car.clone(true),side=Math.sign(pump.x),from=Math.random()<.5?-1:1;
    this.paintCar(group);this.scene.add(group);
    const c={group,pump,status:'arriving',side,slotX:pump.slotX,t:0,lights:addLights(group),
      spot:new THREE.Vector3(pump.x+side*1.25,.25,SLOT_Z),
      target:new THREE.Vector3(pump.slotX,ROAD.y,pump.z),patience:46-Math.min(12,this.state.shift*1.2)};
    setPath(c,entryPath(pump.slotX,SLOT_Z,from,laneFor(-from)),11);
    c.speed=10;pump.car=c;this.cars.push(c);audio.tone(105,.35,'sawtooth',.12);
  }
  addFuelJob(car){
    car.job=this.addJob({car,title:'Заправьте машину',sub:`Колонка ${this.pumps.indexOf(car.pump)+1} · бензин АИ-95`,pos:()=>car.spot,duration:2.7,patience:car.patience,onFail:()=>this.loseCustomer(car),onComplete:()=>{const gain=75+this.state.shift*4;this.state.money+=gain;this.state.rep=Math.min(5,this.state.rep+.04);audio.success();this.toast(`Полный бак <b>+₽${gain}</b>`);if(Math.random()<.62)this.createOrder(car);else{this.served++;setTimeout(()=>this.leaveCar(car),800)}}})
  }
  createOrder(car){
    car.status='order';const kind=Math.random()<.58?'coffee':'snack',isCoffee=kind==='coffee',source=isCoffee?new THREE.Vector3(-1.75,.2,-.7):new THREE.Vector3(3.55,.2,2.5),name=isCoffee?'кофе':'сэндвич';
    this.addJob({car,title:`Приготовьте ${name}`,sub:`Заказ с колонки ${this.pumps.indexOf(car.pump)+1}`,pos:()=>source,duration:isCoffee?1.5:1.05,patience:32,onFail:()=>this.loseCustomer(car),onComplete:()=>{if(!this.freeHands())return false;if(!isCoffee&&this.stock<=0){this.toast('Полка пуста — возьмите коробку на складе');this.createRestockJob();return false}if(!isCoffee)this.stock--;this.carry=kind;this.updateCarry();audio.tone(620,.12,'square',.14);this.addJob({car,title:`Отнесите ${name}`,sub:`К машине у колонки ${this.pumps.indexOf(car.pump)+1}`,pos:()=>car.spot,duration:.7,patience:24,onFail:()=>{this.carry=null;this.updateCarry();this.loseCustomer(car)},onComplete:()=>{if(this.carry!==kind)return false;this.carry=null;this.updateCarry();const gain=(isCoffee?55+this.state.upgrades.coffee*15:48);this.state.money+=gain;this.state.rep=Math.min(5,this.state.rep+.08);this.served++;audio.success();this.toast(`Заказ выдан <b>+₽${gain}</b>`);this.leaveCar(car);if(this.stock<=2)this.createRestockJob()}})}})
  }
  createRestockJob(){if(this.jobs.some(j=>j.tag==='restock-pick'||j.tag==='restock-put'))return;this.addJob({tag:'restock-pick',title:'Возьмите коробку товара',sub:'Склад в дальнем углу магазина',pos:()=>new THREE.Vector3(4.1,.2,4.1),duration:1.1,onComplete:()=>{if(!this.freeHands())return false;this.carry='box';this.updateCarry();this.addJob({tag:'restock-put',title:'Пополните полку',sub:'Поставьте коробку на стеллаж',pos:()=>new THREE.Vector3(3.55,.2,2.5),duration:1.6,onComplete:()=>{if(this.carry!=='box')return false;this.carry=null;this.stock=6;this.updateCarry();this.state.money+=20;this.toast('Товар расставлен <b>+₽20</b>');audio.success()}})}})}
  leaveCar(car){if(!car||['reversing','shifting','leaving'].includes(car.status))return;this.jobs.filter(j=>j.car===car).forEach(j=>this.removeJob(j));car.status='reversing';setPath(car,reversePath(car.slotX,SLOT_Z,car.side),2.9);audio.tone(78,.45,'sine',.07)}
  loseCustomer(car){if(!car||['reversing','shifting','leaving'].includes(car.status))return;this.state.rep=Math.max(1,this.state.rep-.22);this.toast('<b>Клиент уехал недовольным</b>');audio.fail();this.leaveCar(car)}
  addJob(spec){const job={id:++this.jobId,created:this.elapsed,duration:1,patience:null,maxPatience:null,...spec};if(job.patience)job.maxPatience=job.patience;this.jobs.push(job);return job}
  removeJob(job){const i=this.jobs.indexOf(job);if(i>=0)this.jobs.splice(i,1);if(job.visual)this.scene.remove(job.visual);if(this.nearest===job){this.nearest=null;this.actionProgress=0}}
  updateJobs(dt){for(const j of [...this.jobs]){if(j.patience!=null){j.patience-=dt;if(j.patience<=0){this.removeJob(j);j.onFail?.()}}}this.renderTasks()}
  renderTasks(){const shown=this.jobs.filter(j=>!j.hidden).slice(0,5),signature=shown.map(j=>j.id).join(',')+'|'+(this.nearest?.id||0);if(signature!==this.taskSignature){this.taskSignature=signature;ui.taskList.innerHTML=shown.map((j,i)=>`<div class="task ${j===this.nearest?'active':''}" data-job="${j.id}"><span class="num">0${i+1}</span><b>${this.jobLabel(j)}</b><small>${j.sub||''}</small>${j.patience!=null?'<div class="patience"><i></i></div>':''}</div>`).join('')||'<div class="task"><span class="num">✓</span><b>Всё спокойно</b><small>Осмотритесь вокруг</small></div>'}for(const j of shown){if(j.patience==null)continue;const bar=ui.taskList.querySelector(`[data-job="${j.id}"] .patience i`);if(bar)bar.style.width=`${Math.max(0,j.patience/j.maxPatience*100)}%`}}
  updateInteraction(dt){
    let nearest=null,best=2.15;for(const j of this.jobs){const p=j.pos(),d=Math.hypot(p.x-this.player.position.x,p.z-this.player.position.z);if(d<best){best=d;nearest=j}}
    if(nearest!==this.nearest){this.nearest=nearest;this.actionProgress=0}
    const missing=nearest&&nearest.need&&this.carry!==nearest.need?nearest.need:null;
    this.marker.visible=!!nearest;if(nearest){const p=nearest.pos();this.marker.position.x=p.x;this.marker.position.z=p.z;ui.prompt.classList.remove('hidden');ui.promptKey.textContent=isTouch?'●':'E';ui.promptTitle.textContent=this.jobLabel(nearest);ui.promptSub.textContent=missing?NEED_HINT[missing]:'Удерживайте для действия'}else ui.prompt.classList.add('hidden');
    if(nearest&&this.actionHeld&&!missing&&!this.actionLatched){this.actionProgress+=dt*(1+this.state.upgrades.service*.15);ui.progress.classList.remove('hidden');ui.progressFill.style.width=`${Math.min(100,this.actionProgress/nearest.duration*100)}%`;if(this.actionProgress>=nearest.duration){this.actionProgress=0;this.actionLatched=true;const ok=nearest.onComplete?.();if(ok!==false)this.removeJob(nearest)}}else{this.actionProgress=Math.max(0,this.actionProgress-dt*2.5);ui.progress.classList.add('hidden')}
  }
  triggerEvent(){
    const options=['spill','blackout','bag','broken','van','whisper'].filter(x=>!(x==='blackout'&&this.blackout)&&!(x==='van'&&this.specialVan)&&!(x==='bag'&&this.jobs.some(j=>j.tag==='bag'))&&!(x==='spill'&&this.jobs.some(j=>j.tag==='spill'))&&!(x==='broken'&&this.jobs.some(j=>j.tag==='broken')));const type=options[Math.floor(Math.random()*options.length)];
    if(type==='spill')this.spawnSpill();if(type==='blackout')this.eventBlackout();if(type==='bag')this.eventBag();if(type==='broken')this.eventBrokenPump();if(type==='van')this.eventVan();if(type==='whisper')this.eventWhisper()
  }
  spawnSpill(){const p=new THREE.Vector3(-3+Math.random()*6,.035,-1+Math.random()*4),visual=new THREE.Mesh(new THREE.CircleGeometry(.55+Math.random()*.3,14),new THREE.MeshBasicMaterial({color:0x27201a,transparent:true,opacity:.8}));visual.rotation.x=-Math.PI/2;visual.position.copy(p);this.scene.add(visual);this.eventNotice('≋','Кто-то разлил кофе','Пол становится липким. Швабра стоит у входа.');this.addJob({tag:'spill',need:'mop',title:'Уберите пятно',sub:'Швабра стоит у входа в магазин',pos:()=>p,duration:2.2,visual,onComplete:()=>{this.state.money+=25;this.toast('Чисто! <b>+₽25</b>');audio.success();this.stowTool()}})}
  eventBlackout(){this.blackout=true;this.setBlackout(true);audio.tone(58,.8,'sawtooth',.16);this.eventNotice('ϟ','Отключился свет','Щиток в левом углу. В темноте лучше не задерживаться.');this.addJob({title:'Перезапустите щиток',sub:'В дальнем левом углу магазина',pos:()=>new THREE.Vector3(-4.25,.2,3.7),duration:2.4,onComplete:()=>{this.blackout=false;this.setBlackout(false);this.state.money+=35;this.toast('Электричество вернулось <b>+₽35</b>');audio.success()}})}
  setBlackout(v){this.stationLights.forEach((l,i)=>l.intensity=v?(i===2?1:0):i===2?22:28);this.hemi.intensity=v?.5:1.85}
  eventBag(){const group=this.assets.bag.clone(true),p=new THREE.Vector3(-.8,.16,-3.25);group.position.copy(p);this.scene.add(group);this.eventNotice('?','Забытая сумка','Хозяина не видно. Лучше убрать её в бюро находок.');this.addJob({tag:'bag',title:'Подберите сумку',sub:'Она появилась у входа',pos:()=>p,duration:1.2,visual:group,onComplete:()=>{if(!this.freeHands())return false;this.carry='bag';this.updateCarry();this.addJob({tag:'bag',title:'Отнесите сумку',sub:'В ящик бюро находок',pos:()=>new THREE.Vector3(4.1,.2,4.1),duration:1,onComplete:()=>{if(this.carry!=='bag')return false;this.carry=null;this.updateCarry();this.state.rep=Math.min(5,this.state.rep+.18);this.toast('Честность замечена <b>+репутация</b>');audio.success()}})}})}
  eventBrokenPump(){const p=this.pumps[Math.floor(Math.random()*this.pumps.length)];if(p.broken||p.car){this.spawnSpill();return}p.broken=true;this.eventNotice('⚙','Заклинило колонку','Пахнет проводкой, но искр пока нет. Ящик с инструментом стоит в магазине.');this.addJob({tag:'broken',need:'tools',title:`Почините колонку ${this.pumps.indexOf(p)+1}`,sub:'Ящик с инструментом стоит в магазине',pos:()=>new THREE.Vector3(p.x,.2,p.z),duration:3.1,onComplete:()=>{p.broken=false;this.state.money+=65;this.toast('Колонка снова работает <b>+₽65</b>');audio.success();this.stowTool()}})}
  eventVan(){
    const group=this.assets.mystery_van.clone(true);this.scene.add(group);
    const v={group,status:'arriving',t:0,lights:addLights(group,{front:-2.55,back:2.52,width:.7,y:.58,dark:true})};
    setPath(v,entryPath(VAN_SLOT.x,VAN_SLOT.z,1,laneFor(-1)),8);v.speed=7;
    v.lights.set({beam:false,brake:false,reverse:false});this.specialVan=v;
    this.eventNotice('◉','Подозрительный фургон','Он подъехал без фар. Номер заляпан чем-то похожим на пепел.');audio.spooky()
  }
  leaveSpecialVan(){const v=this.specialVan;if(!v||v.status!=='waiting')return;v.status='reversing';setPath(v,reversePath(VAN_SLOT.x,VAN_SLOT.z,-1),2.6)}
  eventWhisper(){this.eventNotice('♫','Радио поймало помеху','Сквозь шум кто-то назвал ваше имя. Наверное, дальнобойщики шутят.');audio.spooky();const old=this.scene.fog.color.clone();this.scene.fog.color.set(0x160b20);setTimeout(()=>this.scene.fog.color.copy(old),7000)}
  eventNotice(icon,title,text){ui.event.classList.add('hidden');void ui.event.offsetWidth;ui.eventIcon.textContent=icon;ui.eventTitle.textContent=title;ui.eventText.textContent=text;ui.event.classList.remove('hidden');setTimeout(()=>ui.event.classList.add('hidden'),5300)}
  updateCarry(){ui.carrying.classList.toggle('hidden',!this.carry);$('#carrying b').textContent=CARRY_NAMES[this.carry]||'';this.hands.set(this.carry)}
  /* Швабру и инструмент можно взять и вернуть в любой момент; если нужны руки, они уходят на место сами. */
  addStandJobs(){
    this.addJob({tag:'stand-mop',hidden:true,sub:'Инвентарь уборщика у входа',duration:.55,pos:()=>MOP_SPOT,
      title:()=>this.carry==='mop'?'Верните швабру':'Возьмите швабру',
      onComplete:()=>{if(this.carry==='mop')this.stowTool();else if(this.freeHands()){this.carry='mop';this.kitMop.forEach(m=>m.visible=false);this.updateCarry();audio.tone(330,.09,'square',.12)}return false}});
    this.addJob({tag:'stand-tools',hidden:true,sub:'Ящик у левой стены магазина',duration:.55,pos:()=>TOOL_SPOT,
      title:()=>this.carry==='tools'?'Уберите инструменты':'Возьмите инструменты',
      onComplete:()=>{if(this.carry==='tools')this.stowTool();else if(this.freeHands()){this.carry='tools';this.updateCarry();audio.tone(280,.09,'square',.12)}return false}});
  }
  freeHands(){if(!this.carry)return true;if(this.carry==='mop'||this.carry==='tools'){const note=STOW_NOTE[this.carry];this.stowTool();this.toast(note);return true}this.toast('Сначала отдайте то, что уже в руках');return false}
  stowTool(){if(this.carry!=='mop'&&this.carry!=='tools')return;if(this.carry==='mop')this.kitMop.forEach(m=>m.visible=true);this.carry=null;this.updateCarry()}
  jobLabel(job){return typeof job.title==='function'?job.title():job.title}
  updateHud(){ui.money.textContent=Math.floor(this.state.money).toLocaleString('ru-RU');ui.rep.textContent=this.state.rep.toFixed(1);const remain=Math.max(0,this.shiftLength-this.elapsed),mins=Math.floor(remain/60),secs=Math.floor(remain%60);ui.clock.textContent=`${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;ui.shift.textContent=`СМЕНА ${this.state.shift}`}
  toast(html){const t=document.createElement('div');t.className='toast';t.innerHTML=html;ui.toasts.append(t);setTimeout(()=>t.remove(),3300)}
  finishShift(){
    this.mode='results';document.exitPointerLock?.();this.actionHeld=false;ui.mobile.classList.add('hidden');ui.crosshair.classList.add('hidden');ui.lookHint.classList.add('hidden');ui.prompt.classList.add('hidden');ui.progress.classList.add('hidden');ui.results.classList.remove('hidden');const earned=this.state.money-this.shiftStartMoney;$('#result-money').textContent=`₽${Math.max(0,Math.floor(earned))}`;$('#result-served').textContent=this.served;$('#result-rep').textContent=`${this.state.rep.toFixed(1)}★`;$('#result-title').textContent=this.state.rep>4?'Трасса вас запомнит.':this.state.rep>2.4?'Неплохая ночка.':'Бывало и спокойнее.';this.state.best=Math.max(this.state.best,earned);this.state.shift++;this.updateUpgradeButtons();$('#reward-btn').classList.toggle('hidden',!gpState.available);$('#reward-btn').disabled=false;saveProgress(this.state)
  }
  updateUpgradeButtons(){$$('.upgrades button').forEach(b=>{const costs={speed:200,service:250,coffee:180},lvl=this.state.upgrades[b.dataset.upgrade]||0;b.disabled=lvl>=3||this.state.money<costs[b.dataset.upgrade];b.querySelector('b').textContent=lvl>=3?'МАКС':`₽${costs[b.dataset.upgrade]}`})}
  buyUpgrade(key){const costs={speed:200,service:250,coffee:180},cost=costs[key];if(this.state.money<cost||(this.state.upgrades[key]||0)>=3)return;this.state.money-=cost;this.state.upgrades[key]=(this.state.upgrades[key]||0)+1;audio.success();this.updateUpgradeButtons();this.updateHud();saveProgress(this.state)}
  pause(){if(this.mode!=='playing')return;this.mode='paused';document.exitPointerLock?.();ui.pause.classList.remove('hidden');ui.mobile.classList.add('hidden');ui.lookHint.classList.add('hidden');audio.pause(true)}
  resume(){if(this.mode!=='paused')return;this.mode='playing';ui.pause.classList.add('hidden');ui.mobile.classList.toggle('hidden',!isTouch);ui.crosshair.classList.remove('hidden');ui.lookHint.classList.toggle('hidden',isTouch);audio.pause(false);this.lockPointer();this.clock.getDelta()}
  toggleSound(){this.state.sound=!this.state.sound;audio.setMuted(!this.state.sound);$('#sound-btn').textContent=`ЗВУК: ${this.state.sound?'ВКЛ':'ВЫКЛ'}`;saveProgress(this.state)}
  visibility(){if(document.hidden&&this.mode==='playing')this.pause();audio.pause(document.hidden||this.mode==='paused')}
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.55));this.renderer.setSize(innerWidth,innerHeight)}
  run(){const loop=()=>{requestAnimationFrame(loop);const dt=Math.min(.2,this.clock.getDelta());this.update(dt)};loop()}
}

const game=new NightStationGame();
window.__nightStation=game;
let cloudSave=null;initGamePush(data=>{cloudSave=data;game.setState(data);bindAdPause(v=>{audio.pause(v);if(v&&game.mode==='playing')game.pause()})});
try{
  await game.load();game.setState(cloudSave||loadLocal()||SAVE_DEFAULT);audio.setMuted(!game.state.sound);setTimeout(()=>{ui.loading.classList.add('hidden');game.showMenu()},450);game.run();
}catch(error){console.error(error);ui.loadText.textContent='Не удалось загрузить смену. Обновите страницу.';ui.loadText.style.color='#ff795f'}
