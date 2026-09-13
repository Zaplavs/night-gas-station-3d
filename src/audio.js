export class AudioSystem {
  constructor(){this.ctx=null;this.master=null;this.muted=false;this.ambience=null;this.music=null;this.musicTimer=null;this.musicVolume=.8}
  ensure(){
    if(this.ctx)return;
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    this.ctx=new AC();this.master=this.ctx.createGain();this.master.gain.value=this.muted?0:.18;this.master.connect(this.ctx.destination);
    this.startAmbience();this.startMusic();this.ctx.resume?.();
  }
  setMuted(v){this.muted=v;if(this.master)this.master.gain.setTargetAtTime(v?0:.18,this.ctx.currentTime,.03)}
  setMusicVolume(value){this.musicVolume=Math.max(0,Math.min(1,Number(value)||0));if(this.music){this.music.bus.gain.setTargetAtTime(.34*this.musicVolume,this.ctx.currentTime,.04);this.music.lfoGain.gain.setTargetAtTime(.022*this.musicVolume,this.ctx.currentTime,.04)}}
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
  startMusic(){
    if(!this.ctx||this.music)return;
    // Original procedural night score: every voice and note is synthesized at runtime.
    const bus=this.ctx.createGain(),filter=this.ctx.createBiquadFilter(),lfo=this.ctx.createOscillator(),lfoGain=this.ctx.createGain();bus.gain.value=.34*this.musicVolume;filter.type='lowpass';filter.frequency.value=850;filter.Q.value=.65;bus.connect(filter);filter.connect(this.master);lfo.type='sine';lfo.frequency.value=.045;lfoGain.gain.value=.022*this.musicVolume;lfo.connect(lfoGain);lfoGain.connect(bus.gain);lfo.start();
    const voices=[0,1,2,3].map((_,i)=>{const oscillator=this.ctx.createOscillator(),gain=this.ctx.createGain();oscillator.type=i===3?'triangle':'sine';oscillator.frequency.value=73.42;oscillator.detune.value=[-5,3,-2,5][i];gain.gain.value=[.08,.065,.052,.035][i];oscillator.connect(gain);gain.connect(bus);oscillator.start();return{oscillator,gain}});
    this.music={bus,lfoGain,voices,step:0,chords:[[73.42,110,146.83,174.61],[58.27,116.54,146.83,174.61],[87.31,130.81,174.61,220],[65.41,98,130.81,196]],melodies:[[0,2,1],[2,1,3],[1,3,2],[2,0,1]]};
    this.scheduleMusicPhrase();this.musicTimer=setInterval(()=>{if(this.ctx?.state==='running')this.scheduleMusicPhrase()},7600);
  }
  scheduleMusicPhrase(){
    if(!this.music||!this.ctx)return;const now=this.ctx.currentTime+.08,index=this.music.step%this.music.chords.length,chord=this.music.chords[index];
    this.music.voices.forEach((voice,i)=>voice.oscillator.frequency.setTargetAtTime(chord[i],now,.85));
    this.music.melodies[index].forEach((note,i)=>this.musicNote(chord[note]*2,now+1.1+i*2.05,.95));this.music.step++;
  }
  musicNote(frequency,start,duration){
    const oscillator=this.ctx.createOscillator(),gain=this.ctx.createGain();oscillator.type='triangle';oscillator.frequency.setValueAtTime(frequency,start);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.09,start+.12);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);oscillator.connect(gain);gain.connect(this.music.bus);oscillator.start(start);oscillator.stop(start+duration+.05);
  }
}
