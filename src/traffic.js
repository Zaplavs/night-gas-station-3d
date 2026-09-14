import * as THREE from 'three';

/* Движение по трассе. Машины приезжают издалека по своей полосе, сворачивают
   на площадку, сдают назад от колонки и уезжают обратно по дороге. */

export const ROAD={center:-21.5,near:-19.4,far:-23.6,edge:58,y:-.05};
/* Коридор, по которому уезжают: своя полоса между площадкой и трассой. */
export const EXIT_LANE=-16.6;
/* Разворот от колонки: короткий, чтобы корма не доставала до подъездной полосы. */
export const REVERSE_REACH=3.6;
const REVERSE_DEPTH=3.1;
export const laneFor=dir=>dir>0?ROAD.near:ROAD.far; // правостороннее движение
export const SERVICE_QUEUE={headX:14,headZ:-12,gap:1.35};

const TMP=new THREE.Vector3(),NEXT=new THREE.Vector3();
const point=([x,z])=>new THREE.Vector3(x,ROAD.y,z);

export function path(points,{reverse=false,stop=true}={}){
  const curve=new THREE.CatmullRomCurve3(points.map(point),false,'centripetal');
  return {curve,len:curve.getLength(),reverse,stop};
}

/* Съезд с трассы к колонке: длинный прямой участок, плавный поворот, парковка носом к магазину. */
export function entryPath(slotX,slotZ,side,lane){
  const turn=slotZ-4.7,d=turn-lane;
  return path([
    [side*ROAD.edge,lane],[side*32,lane],[slotX+side*17,lane],
    [slotX+side*12.5,lane+d*.22],[slotX+side*8.8,lane+d*.62],[slotX+side*5.6,turn],
    [slotX+side*3.2,slotZ-3.1],[slotX+side*1.4,slotZ-2],[slotX+side*.25,slotZ-1.15],[slotX,slotZ-.55],[slotX,slotZ]
  ]);
}

/* Точка в очереди задаётся сдвигом вдоль линии, а не номером: длину линии
   считает игра по габаритам тех, кто уже приехал. */
export function queuePoint(offset=0){
  return new THREE.Vector3(SERVICE_QUEUE.headX+Math.max(0,offset),ROAD.y,SERVICE_QUEUE.headZ);
}

/* Все клиенты въезжают в одну физическую FIFO-линию на площадке перед АЗС.
   Съезд с трассы привязан к своему месту: хвост длинной очереди сворачивает раньше. */
export function queueEntryPath(target){
  const lane=ROAD.far,turn=Math.min(46,Math.max(29,target.x+11));
  return path([
    [ROAD.edge,lane],[turn+9,lane],[turn,lane+1.1],[turn-5,(lane+target.z)/2],[turn-10,target.z-2.4],
    [target.x+4.2,target.z-1.2],[target.x,target.z]
  ]);
}

/* После ухода головной машины оставшиеся автомобили подтягиваются без телепортации. */
export function queueAdvancePath(position,target){
  const midX=(position.x+target.x)/2,midZ=(position.z+target.z)/2;
  return path([[position.x,position.z],[midX,midZ],[target.x,target.z]]);
}

/* Последний участок из очереди к конкретной колонке использует ту же систему кривых движения. */
export function queueToPumpPath(position,slotX,slotZ){
  const side=Math.sign(slotX)||1,outerX=slotX+side*3.2,stagingX=side>0?10:2;
  return path([
    [position.x,position.z],
    [10,slotZ-6.4],
    [stagingX,slotZ-6.7],
    [outerX,slotZ-6.5],
    [outerX,slotZ-3.2],
    [slotX+side*.7,slotZ-2.15],
    [slotX,slotZ-1.3],
    [slotX,slotZ-.55],
    [slotX,slotZ]
  ]);
}

/* Задний ход от колонки: корма уходит в сторону, нос разворачивается к выезду. */
export function reversePath(slotX,slotZ,side,reach=REVERSE_REACH){
  const k=reach/REVERSE_REACH;
  return path([
    [slotX,slotZ],[slotX+side*.5*k,slotZ-1.25*k],[slotX+side*1.7*k,slotZ-2.35*k],
    [slotX+side*2.95*k,slotZ-2.95*k],[slotX+side*reach,slotZ-REVERSE_DEPTH*k]
  ],{reverse:true});
}

/* Выезд: через площадку к дороге и дальше по своей полосе за горизонт. */
export function exitPath(slotX,slotZ,side,reach=REVERSE_REACH){
  const away=-side,lane=laneFor(away),z=slotZ-REVERSE_DEPTH*(reach/REVERSE_REACH),start=slotX+side*reach;
  return path([
    [start,z],[start+away*2.2,z-2.1],[start+away*6,EXIT_LANE],[start+away*13,EXIT_LANE],
    [start+away*22,lane+(lane<ROAD.center?2.2:.6)],[start+away*32,lane],[start+away*46,lane],[away*ROAD.edge,lane]
  ],{stop:false});
}

/* Транзит: попутная машина, которая просто проезжает мимо заправки. */
export function passPath(side){
  const lane=laneFor(-side);
  return path([[side*ROAD.edge,lane],[side*12,lane],[-side*12,lane],[-side*ROAD.edge,lane]],{stop:false});
}

const BEAM=new THREE.ConeGeometry(.78,7.5,10,1,true);
const LAMP=new THREE.PlaneGeometry(.24,.13);

/* Фары, стопы и фонари заднего хода. Геометрия общая, материалы свои у каждой машины. */
export function addLights(group,{front=-2.05,back=2.05,width=.64,y=.6,dark=false}={}){
  const beamMat=new THREE.MeshBasicMaterial({color:0xffeec4,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false});
  const tailMat=new THREE.MeshBasicMaterial({color:0xff3a1e,transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
  const revMat=new THREE.MeshBasicMaterial({color:0xfff2dc,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
  for(const s of[-1,1]){
    const beam=new THREE.Mesh(BEAM,beamMat);beam.position.set(s*width,y-.04,front-3.7);beam.rotation.set(Math.PI/2-.05,0,0);group.add(beam);
    const tail=new THREE.Mesh(LAMP,tailMat);tail.position.set(s*width,y,back+.02);group.add(tail);
    const rev=new THREE.Mesh(LAMP,revMat);rev.position.set(s*width*.52,y-.17,back+.02);rev.scale.set(.55,.7,1);group.add(rev);
  }
  if(dark)tailMat.opacity=0;
  return {
    set(s){if(dark)return;beamMat.opacity=s.beam?.09:0;tailMat.opacity=s.brake?.95:.28;revMat.opacity=s.reverse?.85:0},
    dispose(){beamMat.dispose();tailMat.dispose();revMat.dispose()}
  };
}

/* Один шаг движения по маршруту: разгон, торможение перед остановкой, поворот корпуса по касательной. */
export function drive(vehicle,dt){
  const p=vehicle.path;if(!p)return true;
  const remain=p.len-vehicle.dist;
  if(remain<=1e-4)return true;
  // Подкат к точке остановки не гаснет до нуля: иначе машина замирает в сантиметре от колонки и «не доезжает».
  const goal=p.stop?Math.min(vehicle.maxSpeed,Math.max(.5,Math.sqrt(Math.max(0,remain-.25)*6.5))):vehicle.maxSpeed;
  const braking=goal<vehicle.speed-.25;
  const nextSpeed=Math.max(0,THREE.MathUtils.clamp(goal,vehicle.speed-9*dt,vehicle.speed+4.2*dt));
  const nextDist=Math.min(p.len,vehicle.dist+nextSpeed*dt),nextT=p.len?nextDist/p.len:1,u=Math.min(1,nextT);
  p.curve.getPointAt(u,NEXT);
  p.curve.getTangentAt(u,TMP);
  const rotationY=Math.atan2(-TMP.x,-TMP.z)+(p.reverse?Math.PI:0);
  // Сервисные машины могут отменить шаг, если следующий объём кузова займёт игрок.
  if(vehicle.canAdvance&&!vehicle.canAdvance({position:NEXT,rotationY,from:vehicle.group.position,distance:nextDist})){
    vehicle.blocked=true;vehicle.stall=(vehicle.stall||0)+dt;vehicle.speed=Math.max(0,vehicle.speed-14*dt);
    vehicle.lights?.set({beam:vehicle.speed>.15,brake:true,reverse:!!p.reverse});return false;
  }
  // Простой считается по фактическому движению: ползущая в заторе машина тоже стоит.
  vehicle.blocked=false;vehicle.stall=nextSpeed>.6?0:(vehicle.stall||0)+dt;vehicle.speed=nextSpeed;vehicle.dist=nextDist;vehicle.t=nextT;
  vehicle.group.position.copy(NEXT);vehicle.group.rotation.y=rotationY;
  vehicle.lights?.set({beam:vehicle.speed>.15,brake:braking||vehicle.speed<.5,reverse:!!p.reverse});
  return vehicle.dist>=p.len-1e-4;
}

export function setPath(vehicle,p,maxSpeed){
  vehicle.path=p;vehicle.dist=0;vehicle.t=0;vehicle.maxSpeed=maxSpeed;
  if(vehicle.speed==null)vehicle.speed=0;
  p.curve.getPointAt(0,vehicle.group.position);
  p.curve.getTangentAt(0,TMP);
  vehicle.group.rotation.y=Math.atan2(-TMP.x,-TMP.z)+(p.reverse?Math.PI:0);
}
