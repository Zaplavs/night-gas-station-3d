import * as THREE from 'three';

/* Ночные покупатели. Водитель выходит из машины, идёт в магазин, ждёт у прилавка
   и возвращается обратно. Маршрут — заранее заданная ломаная: сложная навигация
   им не нужна, зато перед игроком они останавливаются, а не проходят насквозь. */

const WALK_SPEED = 2.15, TURN_SPEED = 9, ARRIVE = .14, PLAYER_GAP = .8, PLAYER_WAIT = 1.6;
const COATS = [0x2e6380, 0x8a5526, 0x4f555b, 0x315d3f, 0x7a2f38, 0x3c3f78, 0x6d6a4c];
const CAPS = [0xc2411f, 0x1f6f7a, 0xd0a343, 0x3a3f45, 0x8f3b6b];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export class Customer {
  constructor(model) {
    this.group = model;
    this.legs = [];
    this.arms = [];
    this.path = [];
    this.index = 0;
    this.step = new THREE.Vector3();
    this.walkTime = 0;
    this.blockedTime = 0;
    this.facing = Math.PI;
    this.group.scale.setScalar(.92);
    const coat = pick(COATS), cap = pick(CAPS);
    model.traverse((object) => {
      if (!object.isMesh) return;
      if (object.name === 'Body' || object.name === 'Arm') {
        object.material = object.material.clone();
        object.material.userData.owned = true;
        if (object.name === 'Body') object.material.color.setHex(coat);
      }
      if (object.name === 'Cap' || object.name === 'CapPeak') {
        object.material = object.material.clone();
        object.material.color.setHex(cap);
        object.material.userData.owned = true;
      }
      if (object.name === 'Leg') this.legs.push({ mesh: object, side: Math.sign(object.position.x) || 1 });
      if (object.name === 'Arm') this.arms.push({ mesh: object, side: Math.sign(object.position.x) || 1 });
    });
  }

  get position() { return this.group.position }
  get walking() { return this.index < this.path.length }

  setPath(points) {
    this.path = points.map((point) => point.clone());
    this.index = 0;
  }

  /* Развернуться к прилавку (или куда угодно) без рывка. */
  faceTowards(x, z) {
    this.facing = Math.atan2(-(x - this.group.position.x), -(z - this.group.position.z));
  }

  /* Возвращает true, когда ломаная пройдена до конца. */
  update(dt, playerPosition) {
    const moving = this.advance(dt, playerPosition);
    this.walkTime += dt * (moving ? 1 : .25);
    const swing = moving ? Math.sin(this.walkTime * 8.5) * .5 : Math.sin(this.walkTime * 1.6) * .04;
    for (const leg of this.legs) leg.mesh.rotation.x = swing * leg.side;
    for (const arm of this.arms) arm.mesh.rotation.x = -swing * arm.side * .7;
    this.group.position.y = (this.baseY ?? this.group.position.y) + (moving ? Math.abs(Math.sin(this.walkTime * 8.5)) * .035 : 0);
    const delta = Math.atan2(Math.sin(this.facing - this.group.rotation.y), Math.cos(this.facing - this.group.rotation.y));
    this.group.rotation.y += delta * Math.min(1, dt * TURN_SPEED);
    return !this.walking;
  }

  advance(dt, playerPosition) {
    if (!this.walking) return false;
    const target = this.path[this.index], position = this.group.position;
    this.step.set(target.x - position.x, 0, target.z - position.z);
    const distance = this.step.length();
    if (distance < ARRIVE) { this.index += 1; return this.walking }
    this.step.multiplyScalar(1 / distance);
    const stepLength = Math.min(distance, WALK_SPEED * dt);
    const nextX = position.x + this.step.x * stepLength, nextZ = position.z + this.step.z * stepLength;
    // Игрок идёт первым: покупатель притормаживает, а не проходит сквозь него.
    // Но не навсегда: если в дверях стоят, через пару секунд он всё-таки протиснется.
    const blocked = playerPosition && Math.hypot(nextX - playerPosition.x, nextZ - playerPosition.z) < PLAYER_GAP
      && Math.abs(playerPosition.y - position.y) < 1.2;
    this.blockedTime = blocked ? this.blockedTime + dt : 0;
    if (blocked && this.blockedTime < PLAYER_WAIT) return false;
    position.x = nextX;
    position.z = nextZ;
    this.faceTowards(target.x, target.z);
    return true;
  }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((object) => { if (object.isMesh && object.material?.userData?.owned) object.material.dispose() });
  }
}
