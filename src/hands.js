import * as THREE from 'three';

/* Первый план: предметы в руках игрока. Рисуются отдельной сценой поверх мира,
   поэтому никогда не проваливаются сквозь стены и не ловят тени заправки. */

const PAL={skin:0xc07a44,cuff:0x14415c,steel:0xa4b0b6,dark:0x1a2126,cup:0xf1e9d6,lid:0x232a2e,
  sleeve:0x8b5c2c,card:0x996233,tape:0xd7c49b,mop:0x5cc6d6,grip:0xffae35,bread:0xdcb87a,
  filling:0x8fbf5f,paper:0xeae4d0,red:0xc8402c,yellow:0xf1a62b,hose:0x111619};
const cache={};
const mat=(key,color,roughness=.78,metalness=0)=>cache[key]||(cache[key]=new THREE.MeshStandardMaterial({color,roughness,metalness}));
const geo={};
const box=(k,w,h,d)=>geo[k]||(geo[k]=new THREE.BoxGeometry(w,h,d));
const disc=(k,r)=>geo[k]||(geo[k]=new THREE.CircleGeometry(r,7));
const cyl=(k,rt,rb,h,s=10)=>geo[k]||(geo[k]=new THREE.CylinderGeometry(rt,rb,h,s));
const put=(parent,geometry,material,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);parent.add(m);return m};

/* Рука в рабочей перчатке: ладонь, большой палец и рукав куртки. */
function hand(side=1){
  const g=new THREE.Group(),skin=mat('skin',PAL.skin,.88),cuff=mat('cuff',PAL.cuff,.92);
  put(g,box('palm',.085,.058,.105),skin);
  put(g,box('fing',.085,.042,.052),skin,0,-.012,-.07,-.5);
  put(g,box('thumb',.03,.034,.062),skin,side*.05,.028,-.028,-.35,0,side*.2);
  put(g,cyl('arm',.052,.066,.3,8),cuff,0,-.18,.07,-.28);
  put(g,cyl('cuffring',.056,.056,.035,8),cuff,0,-.045,.018,-.28);
  return g;
}

function coffee(){
  const g=new THREE.Group();
  put(g,cyl('cupbody',.046,.034,.125,12),mat('cup',PAL.cup,.85));
  put(g,cyl('cuplid',.05,.048,.016,12),mat('lid',PAL.lid,.55),0,.07);
  put(g,cyl('cupsip',.012,.012,.012,6),mat('lid',PAL.lid,.55),0,.082,-.026);
  put(g,cyl('cupband',.045,.04,.05,12),mat('sleeve',PAL.sleeve,.9),0,-.01);
  const steam=[];
  for(let i=0;i<3;i++){
    const s=put(g,disc('steam',.015),new THREE.MeshBasicMaterial({color:0xdfeef5,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}),0,.095+i*.04,-.01);
    s.userData.offset=i/3;steam.push(s);
  }
  const h=hand(1);h.position.set(-.015,-.03,.055);h.rotation.set(.1,0,.25);g.add(h);
  g.position.set(.245,-.2,-.55);g.rotation.set(.06,-.2,-.12);
  g.userData.anim=(o,t,use)=>{
    o.rotation.x=.06+Math.sin(t*1.6)*.03+use*.5;
    o.position.z=-.55+use*.12;
    for(const s of steam){const p=(t*.45+s.userData.offset)%1;s.position.y=.095+p*.085;s.material.opacity=Math.sin(p*Math.PI)*.09;s.scale.setScalar(.5+p)}
  };
  return g;
}

function snack(){
  const g=new THREE.Group();
  put(g,box('bread',.17,.03,.11),mat('bread',PAL.bread,.9),0,.028);
  put(g,box('fill',.16,.022,.105),mat('fill',PAL.filling,.85),0,.005);
  put(g,box('bread2',.17,.03,.11),mat('bread',PAL.bread,.9),0,-.018);
  put(g,box('wrap',.1,.09,.125),mat('paper',PAL.paper,.95),-.055,.005);
  const h=hand(1);h.position.set(.01,-.05,.05);h.rotation.set(.15,0,.15);g.add(h);
  g.position.set(.245,-.25,-.53);g.rotation.set(.1,-.35,-.1);
  g.userData.anim=(o,t,use)=>{o.rotation.z=-.1+Math.sin(t*1.4)*.03;o.position.z=-.53+use*.11};
  return g;
}

function crate(){
  const g=new THREE.Group();
  const card=mat('card',PAL.card,.95);
  put(g,box('crate',.34,.24,.27),card);
  put(g,box('tape',.345,.035,.02),mat('tape',PAL.tape,.9),0,.122,0);
  for(const s of[-1,1]){
    put(g,box('flap',.33,.012,.11),card,0,.14,s*.14,s*.75);
    put(g,box('label',.1,.07,.004),mat('tape',PAL.tape,.9),s*.09,0,-.138);
  }
  const l=hand(-1),r=hand(1);
  l.position.set(-.185,-.055,.02);l.rotation.set(.1,0,-1.15);
  r.position.set(.185,-.055,.02);r.rotation.set(.1,0,1.15);
  g.add(l,r);
  g.position.set(0,-.28,-.74);g.rotation.set(.16,0,0);
  g.userData.anim=(o,t,use)=>{o.rotation.z=Math.sin(t*1.2)*.02;o.position.y=-.28+Math.sin(t*1.5)*.006;o.position.z=-.74+use*.1};
  return g;
}

function mop(){
  const g=new THREE.Group();
  put(g,cyl('stick',.019,.019,.8,8),mat('steel',PAL.steel,.45,.55));
  put(g,cyl('grip',.027,.027,.16,8),mat('grip',PAL.grip,.65),0,.28);
  put(g,box('mount',.055,.06,.055),mat('dark',PAL.dark,.8),0,-.38);
  put(g,box('mophead',.26,.05,.1),mat('mop',PAL.mop,.95),0,-.43);
  for(let i=0;i<5;i++)put(g,box('strand',.042,.075,.085),mat('mop',PAL.mop,.95),-.1+i*.05,-.475,0,0,0,(i-2)*.07);
  const h=hand(1);h.position.set(0,.06,.05);h.rotation.set(-.5,.12,.95);g.add(h);
  g.position.set(.05,-.3,-.66);g.rotation.set(.5,-.15,-.95);
  g.userData.anim=(o,t,use)=>{
    const s=use>0?Math.sin(t*8.5):0;
    o.position.x=.05+s*.12*use;o.position.y=-.3-use*.12;o.position.z=-.66-use*.05;
    o.rotation.z=-.95+s*.13*use;o.rotation.x=.5+use*.28+Math.sin(t*1.3)*.02;
  };
  return g;
}

function tools(){
  const g=new THREE.Group();
  const drv=new THREE.Group();
  put(drv,cyl('drvgrip',.026,.03,.12,8),mat('red',PAL.red,.6),0,-.03);
  put(drv,cyl('drvshaft',.008,.008,.17,6),mat('steel',PAL.steel,.35,.7),0,.12);
  put(drv,box('drvtip',.022,.02,.006),mat('steel',PAL.steel,.35,.7),0,.21);
  const dh=hand(1);dh.position.set(0,-.08,.05);dh.rotation.set(.15,0,.15);drv.add(dh);
  drv.position.set(.27,-.255,-.55);drv.rotation.set(-.8,.3,-.3);g.add(drv);

  const wr=new THREE.Group();
  put(wr,box('wrbody',.036,.2,.014),mat('steel',PAL.steel,.4,.7));
  put(wr,cyl('wrring',.036,.036,.014,10),mat('steel',PAL.steel,.4,.7),0,.1);
  put(wr,cyl('wrhole',.021,.021,.02,10),mat('dark',PAL.dark,.9),0,.1);
  put(wr,box('wrjaw',.052,.03,.014),mat('steel',PAL.steel,.4,.7),0,-.1);
  put(wr,box('wrgap',.016,.026,.02),mat('dark',PAL.dark,.9),0,-.108);
  const wh=hand(-1);wh.position.set(0,-.01,-.03);wh.rotation.set(.15,0,-1.25);wr.add(wh);
  wr.position.set(-.245,-.205,-.56);wr.rotation.set(.3,-.3,1.0);g.add(wr);

  g.userData.anim=(o,t,use)=>{
    drv.rotation.z=-.25+(use>.05?Math.sin(t*11)*.55*use:Math.sin(t*1.4)*.04);
    drv.position.z=-.55-use*.1;
    wr.rotation.z=.5+Math.sin(t*1.1)*.03;
    wr.position.y=-.205+Math.sin(t*1.6)*.006-use*.04;
  };
  return g;
}

function fuelHose(){
  const g=new THREE.Group(),yellow=mat('nozzle',PAL.yellow,.55,.18),rubber=mat('hose',PAL.hose,.92),steel=mat('steel',PAL.steel,.35,.7);
  put(g,box('nozzleBody',.09,.1,.24),yellow,0,.02,-.04,0,-.12,0);
  put(g,box('nozzleGrip',.065,.19,.07),rubber,.015,-.105,.035,0,0,-.28);
  put(g,cyl('nozzleSpout',.018,.022,.31,8),steel,0,.075,-.25,Math.PI/2,0,0);
  put(g,cyl('hoseTail',.028,.028,.42,8),rubber,.03,-.29,.13,-.48,0,0);
  const h=hand(1);h.position.set(.015,-.08,.06);h.rotation.set(.08,0,.2);g.add(h);
  g.position.set(.245,-.23,-.58);g.rotation.set(.12,-.22,-.08);
  g.userData.anim=(o,t,use)=>{o.position.z=-.58+use*.13;o.rotation.x=.12-use*.28+Math.sin(t*1.5)*.018;o.rotation.y=-.22+use*.08};
  return g;
}

function lostBag(model){
  const g=new THREE.Group();
  if(model){const m=model.clone(true);m.scale.setScalar(.26);m.position.set(0,-.04,0);g.add(m)}
  else put(g,box('bagfall',.3,.2,.16),mat('card',PAL.card,.95));
  const h=hand(1);h.position.set(.02,.115,.03);h.rotation.set(.2,0,.2);g.add(h);
  g.position.set(.265,-.32,-.78);g.rotation.set(.1,-.3,-.06);
  g.userData.anim=(o,t,use)=>{o.rotation.z=-.06+Math.sin(t*1.5)*.035;o.position.y=-.32+Math.sin(t*1.8)*.009-use*.03};
  return g;
}

export class HandView{
  constructor(){
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(56,1.6,.01,4);
    this.scene.add(new THREE.HemisphereLight(0x9ec9db,0x0b1418,1.5));
    const key=new THREE.DirectionalLight(0xffe3bd,2.5);key.position.set(1.1,1.5,1.6);this.scene.add(key);
    const rim=new THREE.DirectionalLight(0x7ec8ff,1.1);rim.position.set(-1.4,.3,.7);this.scene.add(rim);
    this.rig=new THREE.Group();this.rig.visible=false;this.scene.add(this.rig);
    this.items={};this.current=null;this.time=0;this.raise=1;this.use=0;this.bob=0;
    this.sway=new THREE.Vector2();this.swayTo=new THREE.Vector2();this.aspect=0;
  }
  build(assets){
    const made={coffee:coffee(),snack:snack(),box:crate(),mop:mop(),tools:tools(),hose:fuelHose(),bag:lostBag(assets&&assets.bag)};
    for(const [name,group] of Object.entries(made)){group.visible=false;this.items[name]=group;this.rig.add(group)}
  }
  set(name){
    const next=this.items[name]?name:null;
    if(next===this.current)return;
    if(this.current)this.items[this.current].visible=false;
    this.current=next;
    if(next){this.items[next].visible=true;this.raise=0;this.use=0}
    this.rig.visible=!!next;
  }
  update(dt,state){
    if(!this.current)return;
    const item=this.items[this.current];
    this.time+=dt;
    this.raise=Math.min(1,this.raise+dt*4.2);
    this.use+=((state.acting?1:0)-this.use)*Math.min(1,dt*7);
    this.swayTo.set(THREE.MathUtils.clamp(state.yawDelta*1.6,-.07,.07),THREE.MathUtils.clamp(-state.pitchDelta*1.4,-.055,.055));
    this.sway.lerp(this.swayTo,Math.min(1,dt*8));
    this.bob+=dt*(state.moving?8.5:1.8);
    const amp=state.moving?1:.28,ease=1-Math.pow(1-this.raise,3);
    this.rig.position.set(this.sway.x+Math.cos(this.bob)*.013*amp,this.sway.y+Math.sin(this.bob*2)*.011*amp-(1-ease)*.5,0);
    this.rig.rotation.set(-this.sway.y*.7,this.sway.x*.8,this.sway.x*1.1);
    item.userData.anim?.(item,this.time,this.use);
  }
  render(renderer,aspect){
    if(!this.rig.visible)return;
    if(aspect!==this.aspect){this.aspect=aspect;this.camera.aspect=aspect;this.camera.updateProjectionMatrix()}
    renderer.autoClear=false;renderer.clearDepth();renderer.render(this.scene,this.camera);renderer.autoClear=true;
  }
}
