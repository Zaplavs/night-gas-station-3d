import * as THREE from 'three';

/* Ночное небо: луна, звёзды, млечный путь и редкие метеоры.
   Небо не ловит туман и едет вместе с камерой, поэтому кажется бесконечно далёким. */

export const MOON_DIRECTION=new THREE.Vector3(-.42,.44,-.79).normalize();
const RADIUS=100;

/* Мягкая круглая точка: из неё сделаны и звёзды, и ореол вокруг луны. */
function softSprite(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,255,255,1)');
  gradient.addColorStop(.3,'rgba(255,255,255,.6)');
  gradient.addColorStop(.65,'rgba(255,255,255,.14)');
  gradient.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

const gauss=()=>(Math.random()+Math.random()+Math.random()-1.5)/1.5;
/* Равномерно по верхней полусфере, чуть выше линии горизонта. */
const domeDirection=()=>{const a=Math.random()*Math.PI*2,y=.05+Math.random()*.95,r=Math.sqrt(Math.max(0,1-y*y));return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r)};

const BAND_NORMAL=new THREE.Vector3(.58,.46,-.67).normalize();
const BAND_U=new THREE.Vector3().crossVectors(BAND_NORMAL,new THREE.Vector3(0,1,0)).normalize();
const BAND_V=new THREE.Vector3().crossVectors(BAND_NORMAL,BAND_U).normalize();
/* Млечный путь — те же звёзды, но собранные в широкую полосу поперёк неба. */
const bandDirection=()=>new THREE.Vector3()
  .addScaledVector(BAND_U,Math.cos(Math.random()*Math.PI*2))
  .addScaledVector(BAND_V,Math.sin(Math.random()*Math.PI*2))
  .addScaledVector(BAND_NORMAL,gauss()*.085)
  .normalize();

function starLayer(count,size,opacity,color,texture,fromBand=false){
  const positions=[];
  for(let i=0;i<count;i++){
    const dir=fromBand?bandDirection():domeDirection();
    if(dir.y<.04){i--;continue}
    positions.push(dir.x*RADIUS,dir.y*RADIUS,dir.z*RADIUS);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const material=new THREE.PointsMaterial({color,size,map:texture,transparent:true,opacity,depthWrite:false,fog:false,sizeAttenuation:true});
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;
  return points;
}

/* Луна: плоский диск с морями и двумя ореолами вокруг. */
function buildMoon(texture){
  const moon=new THREE.Group();
  moon.position.copy(MOON_DIRECTION).multiplyScalar(RADIUS);
  const disc=new THREE.Mesh(new THREE.SphereGeometry(3.8,22,16),new THREE.MeshBasicMaterial({color:0xf6f5e8,fog:false}));
  moon.add(disc);
  const mareMat=new THREE.MeshBasicMaterial({color:0xdfe0d4,fog:false});
  const toViewer=MOON_DIRECTION.clone().negate();
  for(const [ox,oy,r] of [[-1.05,.85,1.15],[.95,.2,.8],[-.15,-1.15,.62]]){
    const mare=new THREE.Mesh(new THREE.SphereGeometry(r,10,8),mareMat);
    const right=new THREE.Vector3().crossVectors(toViewer,new THREE.Vector3(0,1,0)).normalize();
    const up=new THREE.Vector3().crossVectors(right,toViewer).normalize();
    mare.position.addScaledVector(right,ox).addScaledVector(up,oy).addScaledVector(toViewer,3.52);
    mare.scale.z=.35;moon.add(mare);
  }
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:0xc6dcea,transparent:true,opacity:.38,depthWrite:false,fog:false,blending:THREE.AdditiveBlending}));
  halo.scale.setScalar(14);moon.add(halo);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:0x7ea6c4,transparent:true,opacity:.16,depthWrite:false,fog:false,blending:THREE.AdditiveBlending}));
  glow.scale.setScalar(44);moon.add(glow);
  return {moon,halo};
}

export function createSky(){
  const texture=softSprite();
  const group=new THREE.Group();
  const dim=starLayer(720,.5,.75,0xbcd6e6,texture);
  const milkyWay=starLayer(540,.44,.62,0xc3d8e8,texture,true);
  const mid=starLayer(240,.86,.95,0xe4f0f7,texture);
  const bright=starLayer(60,1.6,1,0xfffdf4,texture);
  group.add(dim,milkyWay,mid,bright);
  const {moon,halo}=buildMoon(texture);group.add(moon);

  /* Метеор: раз в полминуты-минуту короткая черта прочерчивает небо. */
  const meteor=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:0xdff0ff,transparent:true,opacity:0,depthWrite:false,fog:false,blending:THREE.AdditiveBlending}));
  meteor.visible=false;group.add(meteor);
  const meteorFrom=new THREE.Vector3(),meteorTo=new THREE.Vector3();
  let meteorTimer=12+Math.random()*30,meteorTime=0;

  return {
    group,
    moonDirection:MOON_DIRECTION,
    update(dt,cameraPosition){
      group.position.copy(cameraPosition);
      group.rotation.y+=dt*.0008; // очень медленный ход звёзд за смену
      const t=performance.now()*.001;
      mid.material.opacity=.72+Math.sin(t*1.7)*.08;
      bright.material.opacity=.9+Math.sin(t*2.6+1.1)*.1;
      halo.material.opacity=.36+Math.sin(t*.8)*.035;
      if(meteor.visible){
        meteorTime+=dt;
        const p=meteorTime/1.1;
        if(p>=1){meteor.visible=false;meteor.material.opacity=0}
        else{
          meteor.position.lerpVectors(meteorFrom,meteorTo,p);
          meteor.material.opacity=Math.sin(p*Math.PI)*.85;
          meteor.material.rotation=meteor.userData.tilt;
          meteor.scale.set(9,.42,1);
        }
      }else if((meteorTimer-=dt)<=0){
        meteorTimer=26+Math.random()*44;meteorTime=0;
        const start=domeDirection(),drift=domeDirection();
        meteorFrom.copy(start).multiplyScalar(RADIUS);
        meteorTo.copy(start).lerp(drift,.28).normalize().multiplyScalar(RADIUS);
        meteor.userData.tilt=Math.atan2(meteorTo.y-meteorFrom.y,meteorTo.x-meteorFrom.x);
        meteor.position.copy(meteorFrom);meteor.visible=true;
      }
    }
  };
}
