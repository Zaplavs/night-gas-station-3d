export class AudioSystem {
  constructor(){this.ctx=null;this.master=null;this.muted=false;this.ambience=null}
  ensure(){
    if(this.ctx)return;
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    this.ctx=new AC();this.master=this.ctx.createGain();this.master.gain.value=this.muted?0:.18;this.master.connect(this.ctx.destination);
    this.startAmbience();
  }
  setMuted(v){this.muted=v;if(this.master)this.master.gain.setTargetAtTime(v?0:.18,this.ctx.currentTime,.03)}
  pause(v){if(!this.ctx)return;v?this.ctx.suspend():this.ctx.resume()}
  tone(freq=440,duration=.08,type='sine',volume=.3){
    this.ensure();if(!this.ctx||this.muted)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,this.ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,this.ctx.currentTime+duration);o.connect(g);g.connect(this.master);o.start();o.stop(this.ctx.currentTime+duration)
  }
  success(){this.tone(520,.09,'triangle',.35);setTimeout(()=>this.tone(760,.14,'triangle',.3),80)}
  fail(){this.tone(150,.22,'sawtooth',.22)}
  spooky(){this.ensure();if(!this.ctx)return;[93,139,186].forEach((f,i)=>setTimeout(()=>this.tone(f,1.6,'sine',.08),i*110))}
  startAmbience(){
    if(!this.ctx||this.ambience)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain(),filter=this.ctx.createBiquadFilter();o.type='sine';o.frequency.value=47;g.gain.value=.035;filter.type='lowpass';filter.frequency.value=110;o.connect(filter);filter.connect(g);g.connect(this.master);o.start();this.ambience=o;
  }
}
