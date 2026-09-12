import * as THREE from 'three';

/* Движение по трассе. Машины приезжают издалека по своей полосе, сворачивают
   на площадку, сдают назад от колонки и уезжают обратно по дороге. */

export const ROAD={center:-17,near:-14.9,far:-19.1,edge:58,y:-.05};
export const laneFor=dir=>dir>0?ROAD.near:ROAD.far; // правостороннее движение

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

/* Задний ход от колонки: корма уходит в сторону, нос разворачивается к выезду. */
export function reversePath(slotX,slotZ,side){
  return path([
    [slotX,slotZ],[slotX+side*.6,slotZ-1.6],[slotX+side*2.2,slotZ-3],
    [slotX+side*3.8,slotZ-3.8],[slotX+side*4.6,slotZ-3.95]
  ],{reverse:true});
}

/* Выезд: через площадку к дороге и дальше по своей полосе за горизонт. */
export function exitPath(slotX,slotZ,side){
  const away=-side,lane=laneFor(away),z=slotZ-3.95,start=slotX+side*4.6;
  return path([
    [start,z],[start+away*2,z-.15],[start+away*5,z-.7],[start+away*9,-13.4],
    [start+away*14,lane+(lane<-17?2.2:.4)],[start+away*21,lane],[start+away*36,lane],[away*ROAD.edge,lane]
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
    vehicle.blocked=true;vehicle.speed=Math.max(0,vehicle.speed-14*dt);
    vehicle.lights?.set({beam:vehicle.speed>.15,brake:true,reverse:!!p.reverse});return false;
  }
  vehicle.blocked=false;vehicle.speed=nextSpeed;vehicle.dist=nextDist;vehicle.t=nextT;
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
