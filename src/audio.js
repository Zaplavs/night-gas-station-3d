export class AudioSystem {
  constructor(){this.ctx=null;this.master=null;this.muted=false;this.ambience=null;this.music=null;this.musicTimer=null;this.musicVolume=.8}
  ensure(){
    if(this.ctx)return;
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    this.ctx=new AC();this.master=this.ctx.createGain();this.master.gain.value=this.muted?0:.18;this.master.connect(this.ctx.destination);
    this.startAmbience();this.startMusic();this.ctx.resume?.();
  }
  setMuted(v){this.muted=v;if(this.master)this.master.gain.setTargetAtTime(v?0:.18,this.ctx.currentTime,.03)}
  setMusicVolume(value){this.musicVolume=Math.max(0,Math.min(1,Number(value)||0));if(this.music){this.music.bus.gain.setTargetAtTime(.36*this.musicVolume,this.ctx.currentTime,.04);this.music.lfoGain.gain.setTargetAtTime(.018*this.musicVolume,this.ctx.currentTime,.04)}}
  pause(v){if(!this.ctx)return;v?this.ctx.suspend():this.ctx.resume()}
  tone(freq=440,duration=.08,type='sine',volume=.3){
    this.ensure();if(!this.ctx||this.muted)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,this.ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,this.ctx.currentTime+duration);o.connect(g);g.connect(this.master);o.start();o.stop(this.ctx.currentTime+duration)
  }
  success(){this.tone(520,.09,'triangle',.35);setTimeout(()=>this.tone(760,.14,'triangle',.3),80)}
  fail(){this.tone(150,.22,'sawtooth',.22)}
  spooky(){this.ensure();if(!this.ctx)return;[93,139,186].forEach((f,i)=>setTimeout(()=>this.tone(f,1.6,'sine',.08),i*110))}
  startAmbience(){
    if(!this.ctx||this.ambience)return;
    const drone=this.ctx.createOscillator(),droneGain=this.ctx.createGain(),droneFilter=this.ctx.createBiquadFilter();drone.type='sine';drone.frequency.value=43;droneGain.gain.value=.032;droneFilter.type='lowpass';droneFilter.frequency.value=105;drone.connect(droneFilter);droneFilter.connect(droneGain);droneGain.connect(this.master);drone.start();
    const hum=this.ctx.createOscillator(),humGain=this.ctx.createGain();hum.type='triangle';hum.frequency.value=96;humGain.gain.value=.006;hum.connect(humGain);humGain.connect(this.master);hum.start();
    const buffer=this.ctx.createBuffer(1,this.ctx.sampleRate*3,this.ctx.sampleRate),data=buffer.getChannelData(0);let smoothed=0;for(let i=0;i<data.length;i++){smoothed=smoothed*.985+(Math.random()*2-1)*.015;data[i]=smoothed}
    const wind=this.ctx.createBufferSource(),windFilter=this.ctx.createBiquadFilter(),windGain=this.ctx.createGain(),windLfo=this.ctx.createOscillator(),windDepth=this.ctx.createGain();wind.buffer=buffer;wind.loop=true;windFilter.type='bandpass';windFilter.frequency.value=420;windFilter.Q.value=.45;windGain.gain.value=.015;windLfo.type='sine';windLfo.frequency.value=.065;windDepth.gain.value=.007;wind.connect(windFilter);windFilter.connect(windGain);windGain.connect(this.master);windLfo.connect(windDepth);windDepth.connect(windGain.gain);wind.start();windLfo.start();
    this.ambience={drone,hum,wind,windGain,windLfo};
  }
  startMusic(){
    if(!this.ctx||this.music)return;
    // Полностью оригинальный процедурный саундскейп: ни один внешний аудиофайл не используется.
    const bus=this.ctx.createGain(),filter=this.ctx.createBiquadFilter(),lfo=this.ctx.createOscillator(),lfoGain=this.ctx.createGain();bus.gain.value=.36*this.musicVolume;filter.type='lowpass';filter.frequency.value=720;filter.Q.value=.72;bus.connect(filter);filter.connect(this.master);lfo.type='sine';lfo.frequency.value=.032;lfoGain.gain.value=.018*this.musicVolume;lfo.connect(lfoGain);lfoGain.connect(bus.gain);lfo.start();
    const filterLfo=this.ctx.createOscillator(),filterDepth=this.ctx.createGain();filterLfo.type='sine';filterLfo.frequency.value=.018;filterDepth.gain.value=230;filterLfo.connect(filterDepth);filterDepth.connect(filter.frequency);filterLfo.start();
    const reverb=this.ctx.createConvolver(),wet=this.ctx.createGain();reverb.buffer=this.createReverbImpulse(2.8,3.2);wet.gain.value=.2;bus.connect(reverb);reverb.connect(wet);wet.connect(this.master);
    const melodyBus=this.ctx.createGain(),delay=this.ctx.createDelay(2),feedback=this.ctx.createGain(),delayWet=this.ctx.createGain();melodyBus.gain.value=.72;delay.delayTime.value=.62;feedback.gain.value=.24;delayWet.gain.value=.28;melodyBus.connect(bus);melodyBus.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(delayWet);delayWet.connect(bus);
    const voices=[0,1,2,3,4].map((_,i)=>{const oscillator=this.ctx.createOscillator(),gain=this.ctx.createGain(),panner=this.ctx.createStereoPanner();oscillator.type=i>2?'triangle':'sine';oscillator.frequency.value=73.42;oscillator.detune.value=[-7,4,-3,6,1][i];gain.gain.value=[.064,.052,.041,.027,.016][i];panner.pan.value=[-.55,.45,-.2,.62,0][i];oscillator.connect(gain);gain.connect(panner);panner.connect(bus);oscillator.start();return{oscillator,gain,panner}});
    this.music={bus,filter,lfoGain,filterLfo,reverb,wet,melodyBus,delay,voices,step:0,chords:[[73.42,110,146.83,174.61,220],[58.27,116.54,146.83,174.61,220],[87.31,130.81,174.61,220,261.63],[65.41,98,130.81,146.83,196]],melodies:[[2,4,3],[4,2,3],[1,3,4],[3,1,2]]};
    this.scheduleMusicPhrase();this.musicTimer=setInterval(()=>{if(this.ctx?.state==='running')this.scheduleMusicPhrase()},11200);
  }
  scheduleMusicPhrase(){
    if(!this.music||!this.ctx)return;const now=this.ctx.currentTime+.08,index=this.music.step%this.music.chords.length,chord=this.music.chords[index];
    this.music.voices.forEach((voice,i)=>voice.oscillator.frequency.setTargetAtTime(chord[i],now,1.35));
    this.music.melodies[index].forEach((note,i)=>this.musicNote(chord[note]*(i===1?1:2),now+1.8+i*3.05,1.65+i*.18));this.music.step++;
  }
  musicNote(frequency,start,duration){
    const oscillator=this.ctx.createOscillator(),shimmer=this.ctx.createOscillator(),gain=this.ctx.createGain();oscillator.type='triangle';shimmer.type='sine';oscillator.frequency.setValueAtTime(frequency,start);shimmer.frequency.setValueAtTime(frequency*2,start);shimmer.detune.value=7;gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.06,start+.24);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);oscillator.connect(gain);shimmer.connect(gain);gain.connect(this.music.melodyBus);oscillator.start(start);shimmer.start(start);oscillator.stop(start+duration+.08);shimmer.stop(start+duration+.08);
  }
  createReverbImpulse(duration,decay){
    const length=Math.floor(this.ctx.sampleRate*duration),impulse=this.ctx.createBuffer(2,length,this.ctx.sampleRate);for(let channel=0;channel<2;channel++){const data=impulse.getChannelData(channel);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,decay)}return impulse
  }
}
