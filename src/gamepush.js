const LOCAL_KEY='night-gas-station-save-v1';
/* Площадки не разрешают крутить полноэкранную рекламу чаще раза в три минуты.
   Интервал считается от любого показанного ролика, включая rewarded по кнопке. */
export const AD_COOLDOWN=180000;
let gp=null,lastAd=0,adPause=null;
export const gpState={ready:false,available:false};

export function loadLocal(){try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||'null')}catch{return null}}

export async function initGamePush(onCloud){
  const cfg=window.GAMEPUSH_CONFIG||{};
  if(!cfg.projectId||!cfg.publicToken){gpState.ready=true;window.dispatchEvent(new Event('gp-ready'));return}
  window.onGPInit=async instance=>{
    gp=instance;attachAdPause();
    try{
      await gp.player.ready;gpState.available=true;
      const cloud=gp.player.get(cfg.saveField||'night_station_save');
      if(cloud){try{onCloud(JSON.parse(cloud))}catch{}}
      if(gp.ads?.isPreloaderAvailable)await gp.ads.showPreloader();
    }catch(e){console.warn('GamePush fallback:',e)}
    gpState.ready=true;window.dispatchEvent(new Event('gp-ready'));
  };
  const urls=atob('aHR0cHM6Ly9ncy5lcG9uZXNoLmNvbS9zZGsvZ2FtZS1zY29yZS5qcyxodHRwczovL3MzLmdhbWVwdXNoLmNvbS9maWxlcy9ncy9zZGsvZ2FtZS1zY29yZS5qcyxodHRwczovL3MzLWV1LmdhbWVwdXNoLmNvbS9zZGsvZ2FtZS1zY29yZS5qcyxodHRwczovL2dhbWVwdXNoLmNvbS9zZGsvZ2FtZS1zY29yZS5qcw==').split(',');
  let index=0;const next=()=>{if(index>=urls.length){gpState.ready=true;window.dispatchEvent(new Event('gp-ready'));return}const s=document.createElement('script');s.async=true;s.src=urls[index++]+`?projectId=${encodeURIComponent(cfg.projectId)}&publicToken=${encodeURIComponent(cfg.publicToken)}&callback=onGPInit`;s.onerror=next;document.body.appendChild(s)};next();
  setTimeout(()=>{if(!gpState.ready){gpState.ready=true;window.dispatchEvent(new Event('gp-ready'))}},6500);
}

export async function saveProgress(data){
  localStorage.setItem(LOCAL_KEY,JSON.stringify(data));
  if(gpState.available&&gp){try{gp.player.set((window.GAMEPUSH_CONFIG||{}).saveField||'night_station_save',JSON.stringify(data));await gp.player.sync()}catch(e){console.warn('Cloud save failed',e)}}
}
export function adCooldownLeft(){return Math.max(0,AD_COOLDOWN-(Date.now()-lastAd))}
/* Полноэкранную показываем только между сменами и не чаще интервала площадок. */
export async function showInterstitial(){
  if(!gpState.available||!gp?.ads?.isFullscreenAvailable||adCooldownLeft()>0)return false;
  try{const shown=await gp.ads.showFullscreen({showCountdownOverlay:true});lastAd=Date.now();return shown}catch{}
  return false
}
/* Rewarded игрок запускает сам, поэтому кулдаун её не держит — но отсчёт сдвигает. */
export async function showRewarded(){
  if(!gpState.available||!gp?.ads?.isRewardedAvailable)return false;
  try{const rewarded=await gp.ads.showRewardedVideo();lastAd=Date.now();return rewarded}catch{}
  return false
}
/* Подписку на рекламу вешаем один раз и до готовности SDK: без неё ролик крутится
   поверх работающей смены. */
export function bindAdPause(callback){adPause=callback;attachAdPause()}
function attachAdPause(){
  if(!gp?.ads||!adPause||gp.__nightAdPauseBound)return;
  gp.__nightAdPauseBound=true;
  gp.ads.on('start',()=>adPause(true));gp.ads.on('close',()=>adPause(false));
}
/* Площадки считают по этим событиям активное время игры и момент для рекламы. */
export function gameplayStart(){try{gp?.gameplayStart?.()}catch{}}
export function gameplayStop(){try{gp?.gameplayStop?.()}catch{}}
