/* MBUX Sound Drive concept: local audio + GPS/device sensors + Leaflet/OSM. */
const $ = (s)=>document.querySelector(s);
const state={map:null,marker:null,watchId:null,audio:null,objectUrl:null,lastPos:null,lastHeading:null,heading:0,speed:0,accel:0,turn:'STEADY',mode:'AUTO',playing:false};

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2600)}
function clamp(v,a,b){return Math.min(b,Math.max(a,v))}
function fmt(n,d=1){return Number.isFinite(n)?n.toFixed(d):'—'}

function initMap(){
  state.map=L.map('map',{zoomControl:true,preferCanvas:true}).setView([14.5995,120.9842],13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,
    attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    referrerPolicy:'strict-origin-when-cross-origin'
  }).addTo(state.map);
  const icon=L.divIcon({className:'',html:'<div class="car-marker"></div>',iconSize:[28,28],iconAnchor:[14,14]});
  state.marker=L.marker([14.5995,120.9842],{icon}).addTo(state.map).bindPopup('Sound Drive vehicle position');
}

function updateMap(lat,lng){
  state.marker.setLatLng([lat,lng]);
  state.map.setView([lat,lng],Math.max(state.map.getZoom(),15),{animate:true});
}

function updateUI(){
  $('#speed').textContent=fmt(state.speed,0); $('#heading').textContent=fmt(state.heading,0); $('#accel').textContent=fmt(state.accel,2); $('#turn').textContent=state.turn; if($('#speedMap'))$('#speedMap').textContent=fmt(state.speed,0); if($('#headingMap'))$('#headingMap').textContent=fmt(state.heading,0); if($('#statusDot'))$('#statusDot').style.background=state.watchId?'var(--green)':'#69747b';
  if($('#gpsDot'))$('#gpsDot').classList.toggle('on',!!state.watchId);
  $('#gpsText').textContent=state.watchId?'GPS ACTIVE':'GPS OFF'; if($('#locate'))$('#locate').classList.toggle('active',!!state.watchId);
  const speed=state.speed, a=Math.abs(state.accel);
  let status='STEADY';
  if(speed<3 && a<0.35) status='IDLE / AMBIENT';
  else if(a>1.15) status='ACCEL / CLEAR + BASS';
  else if(state.turn!=='STEADY') status='3D TURN '+state.turn;
  else status='BALANCED CRUISE';
  $('#driveState').textContent=status; if($('#profileState'))$('#profileState').textContent=status.replace(' / ',' • ').replace('ACCEL / ','ACCEL • ').replace('3D TURN ','TURN • '); if($('#profileText'))$('#profileText').textContent=state.mode==='AUTO'?'AUTOMATIC':state.mode; if($('#mapLocation') && state.lastPos) $('#mapLocation').textContent=state.lastPos.lat.toFixed(5)+', '+state.lastPos.lng.toFixed(5);
  applyAudio();
}

function setupAudio(){
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC) return toast('Web Audio is not supported in this browser.');
  const ctx=new AC();
  const source=ctx.createMediaElementSource($('#audio'));
  const input=ctx.createGain();
  const low=ctx.createBiquadFilter(); low.type='lowshelf'; low.frequency.value=150;
  const mid=ctx.createBiquadFilter(); mid.type='peaking'; mid.frequency.value=1300; mid.Q.value=.8;
  const high=ctx.createBiquadFilter(); high.type='highshelf'; high.frequency.value=4500;
  const filter=ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=20000; filter.Q.value=.7;
  const panner=ctx.createStereoPanner();
  const compressor=ctx.createDynamicsCompressor(); compressor.threshold.value=-18; compressor.knee.value=12; compressor.ratio.value=4; compressor.attack.value=.01; compressor.release.value=.18;
  const master=ctx.createGain(); master.gain.value=.8;
  source.connect(input).connect(low).connect(mid).connect(high).connect(filter).connect(panner).connect(compressor).connect(master).connect(ctx.destination);
  state.audio={ctx,input,low,mid,high,filter,panner,compressor,master};
}

function applyAudio(){
  if(!state.audio)return;
  const {ctx,input,low,mid,high,filter,panner,compressor,master}=state.audio;
  const now=ctx.currentTime;
  let bass=Number($('#bass').value)/100;
  let clarity=Number($('#clarity').value)/100;
  let width=Number($('#width').value)/100;
  let muff=0, pan=0, gain=1;
  if(state.mode==='AUTO'){
    if(state.speed<3 && Math.abs(state.accel)<.35){muff=.72; bass*=.25; clarity*=.25; gain=.72; width*=.2;}
    else if(Math.abs(state.accel)>1.15){muff=.0; bass=Math.min(1,bass+.35); clarity=Math.min(1,clarity+.4); gain=1.05; width=Math.min(1,width+.18);}
    else if(state.turn==='LEFT'){pan=-.72; width=1; gain=1.0;}
    else if(state.turn==='RIGHT'){pan=.72; width=1; gain=1.0;}
  }
  if(state.mode==='AMBIENT'){muff=.75; bass*=.2; clarity*=.2; gain=.72; width*=.15;}
  if(state.mode==='PERFORMANCE'){muff=0; bass=Math.min(1,bass+.35); clarity=Math.min(1,clarity+.25); gain=1.05; width=1;}
  if(state.mode==='IMMERSIVE'){width=1;}
  const cutoff=clamp(700+(1-muff)*19300,700,20000);
  low.gain.setTargetAtTime(18*bass,now,.08); mid.gain.setTargetAtTime(7*clarity,now,.08); high.gain.setTargetAtTime(5*clarity,now,.08);
  filter.frequency.setTargetAtTime(cutoff,now,.08); panner.pan.setTargetAtTime(pan,now,.1); master.gain.setTargetAtTime(clamp(.72*gain,0,1.05),now,.1);
  $('#bassVal').textContent=Math.round(bass*100)+'%'; $('#clarityVal').textContent=Math.round(clarity*100)+'%'; $('#widthVal').textContent=Math.round(width*100)+'%';
}

function ensureAudio(){if(!state.audio)setupAudio(); if(state.audio?.ctx.state==='suspended')state.audio.ctx.resume()}

$('#file').addEventListener('change',e=>{const f=e.target.files?.[0]; if(!f)return; ensureAudio(); if(state.objectUrl)URL.revokeObjectURL(state.objectUrl); state.objectUrl=URL.createObjectURL(f); const audio=$('#audio'); audio.src=state.objectUrl; $('#fileName').textContent=f.name; $('#trackTitle').textContent=f.name.replace(/\.[^.]+$/,''); $('#trackMeta').textContent=(f.type||'audio')+' • local file'; audio.load(); toast('Track loaded locally.');});
$('#play').addEventListener('click',()=>{const a=$('#audio'); if(!a.src)return toast('Upload a music file first.'); ensureAudio(); if(a.paused){a.play();state.playing=true;$('#play').textContent='Pause'}else{a.pause();state.playing=false;$('#play').textContent='Play'}});
$('#seek').addEventListener('input',e=>{const a=$('#audio');if(a.duration)a.currentTime=(Number(e.target.value)/100)*a.duration});
$('#audio').addEventListener('timeupdate',()=>{const a=$('#audio'); if(a.duration)$('#seek').value=(a.currentTime/a.duration)*100; $('#time').textContent=(a.currentTime||0).toFixed(0)+'s / '+(a.duration||0).toFixed(0)+'s'});
['bass','clarity','width'].forEach(id=>$('#'+id).addEventListener('input',applyAudio));

document.querySelectorAll('.mode button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.mode button').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.mode=b.dataset.mode;applyAudio();}));

$('#locate').addEventListener('click',startGPS);
$('#maps').addEventListener('click',()=>{const p=state.marker.getLatLng();window.open(`https://www.google.com/maps/@${p.lat},${p.lng},17z`,'_blank','noopener,noreferrer')});
$('#searchBtn').addEventListener('click',searchPlace); $('#destination').addEventListener('keydown',e=>{if(e.key==='Enter')searchPlace()});

async function searchPlace(){const q=$('#destination').value.trim();if(!q)return;try{const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(q);const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw new Error('search failed');const data=await r.json();if(!data.length)return toast('Place not found.');const p=data[0];const lat=+p.lat,lng=+p.lon;state.map.setView([lat,lng],16);L.marker([lat,lng]).addTo(state.map).bindPopup(p.display_name).openPopup();toast('Destination found with OpenStreetMap search.');}catch(e){toast('OSM search is unavailable right now.')}}

function startGPS(){if(!navigator.geolocation)return toast('Geolocation is unavailable.');if(state.watchId)return toast('GPS is already active.');state.watchId=navigator.geolocation.watchPosition(onPosition,onGeoError,{enableHighAccuracy:true,maximumAge:1000,timeout:10000});updateUI();toast('Requesting high-accuracy location…')}
function onPosition(pos){const c=pos.coords;let speed=Number.isFinite(c.speed)&&c.speed>=0?c.speed*3.6:state.speed;let heading=Number.isFinite(c.heading)&&c.heading>=0?c.heading:state.heading;if(state.lastPos){const dt=Math.max(.2,(pos.timestamp-state.lastPos.t)/1000);const d=distance(state.lastPos.lat,state.lastPos.lng,c.latitude,c.longitude);if(!Number.isFinite(c.speed))speed=(d/dt)*3.6; if(!Number.isFinite(c.heading)||c.heading<0)heading=bearing(state.lastPos.lat,state.lastPos.lng,c.latitude,c.longitude);state.accel=(speed-state.speed)/3.6/dt;}state.speed=speed;state.heading=heading;state.lastPos={lat:c.latitude,lng:c.longitude,t:pos.timestamp};state.turn=turnFromHeading(heading,state.lastHeading);state.lastHeading=heading;updateMap(c.latitude,c.longitude);updateUI();}
function onGeoError(e){toast('GPS: '+(e.code===1?'permission denied':e.message));state.watchId=null;updateUI()}
function distance(lat1,lon1,lat2,lon2){const R=6371000,toR=Math.PI/180;const dLat=(lat2-lat1)*toR,dLon=(lon2-lon1)*toR;const a=Math.sin(dLat/2)**2+Math.cos(lat1*toR)*Math.cos(lat2*toR)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(a))}
function bearing(lat1,lon1,lat2,lon2){const r=Math.PI/180,y=Math.sin((lon2-lon1)*r)*Math.cos(lat2*r),x=Math.cos(lat1*r)*Math.sin(lat2*r)-Math.sin(lat1*r)*Math.cos(lat2*r)*Math.cos((lon2-lon1)*r);return (Math.atan2(y,x)*180/Math.PI+360)%360}
function angleDiff(a,b){return ((a-b+540)%360)-180}
function turnFromHeading(h,prev){if(prev==null||state.speed<7)return 'STEADY';const d=angleDiff(h,prev);if(d<-7)return 'LEFT';if(d>7)return 'RIGHT';return 'STEADY'}

async function initSensors(){
  if('DeviceMotionEvent' in window){try{if(typeof DeviceMotionEvent.requestPermission==='function'){const p=await DeviceMotionEvent.requestPermission();if(p!=='granted')throw new Error('motion denied')}window.addEventListener('devicemotion',e=>{const a=e.accelerationIncludingGravity||e.acceleration;if(a){const mag=Math.sqrt((a.x||0)**2+(a.y||0)**2+(a.z||0)**2);const linear=Math.abs(mag-9.81);if(linear>.05)state.accel=linear;updateUI();}},true);}catch(e){toast('Motion sensor permission was not granted; GPS mode still works.')}}
  if('DeviceOrientationEvent' in window){try{if(typeof DeviceOrientationEvent.requestPermission==='function'){const p=await DeviceOrientationEvent.requestPermission();if(p!=='granted')throw new Error('orientation denied')}window.addEventListener('deviceorientation',e=>{if(e.alpha!=null){state.heading=e.webkitCompassHeading??(360-e.alpha);updateUI()}},true);}catch(e){}}
}
$('#sensorBtn').addEventListener('click',initSensors);

initMap();
updateUI();
window.addEventListener('beforeunload',()=>{if(state.watchId)navigator.geolocation.clearWatch(state.watchId);if(state.objectUrl)URL.revokeObjectURL(state.objectUrl)});
