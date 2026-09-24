'use strict';
(() => {
  const $ = (s) => document.querySelector(s);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let toastTimer;
  function toast(message) {
    const box = $('#toast'); box.textContent = message; box.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => box.classList.remove('visible'), 4000);
  }
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }));

  // A lightweight particle sky: capped DPR and particle count, paused in hidden tabs.
  const canvas = $('#sky'); const ctx = canvas.getContext('2d');
  let width = 0, height = 0, stars = [], sparks = [], frame = 0, lastTime = 0;
  function resize() {
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    if (!ctx) return; ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    stars = Array.from({length: width < 720 ? 30 : 65}, () => ({x: Math.random()*width, y: Math.random()*height, r: Math.random()*1.2+.35, phase: Math.random()*6.28, speed: .15+Math.random()*.4}));
  }
  function paint(time) {
    frame = 0;
    if (!ctx || document.hidden) return;
    const delta = Math.min((time-lastTime)/16.67 || 1, 2); lastTime = time;
    ctx.clearRect(0,0,width,height);
    for (const star of stars) {
      ctx.globalAlpha = reducedMotion.matches ? .3 : .15+(Math.sin(time*.0006+star.phase)+1)*.19;
      ctx.fillStyle='#f9da9b'; ctx.beginPath(); ctx.arc(star.x,star.y,star.r,0,Math.PI*2);ctx.fill();
      if (!reducedMotion.matches) {star.y -= star.speed*delta*.2;if(star.y<0) star.y=height;}
    }
    for (let i=sparks.length-1;i>=0;i--) {
      const p=sparks[i];p.x+=p.vx*delta;p.y+=p.vy*delta;p.vy+=.025*delta;p.vx*=.988;p.life-=delta;
      if(p.life<=0){sparks.splice(i,1);continue;}
      ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    if(!reducedMotion.matches || sparks.length) frame=requestAnimationFrame(paint);
  }
  function startSky(){if(!frame && !document.hidden)frame=requestAnimationFrame(paint);}
  function burst(x,y) {
    if(reducedMotion.matches || !ctx) return;
    const colors=['#efca83','#e98e66','#fff2c7','#adc9ba'];
    const count=width<720?42:75;
    for(let i=0;i<count;i++){const angle=Math.PI*2*i/count,speed=1+Math.random()*3;const life=40+Math.random()*45;sparks.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life,max:life,r:.8+Math.random()*1.5,color:colors[i%4]});}
    if(sparks.length>500)sparks.splice(0,sparks.length-500);startSky();
  }
  let fireworksTimers=[];
  function fireworks(){
    fireworksTimers.forEach(clearTimeout);fireworksTimers=[];
    if(reducedMotion.matches){toast('Một đêm trăng thật rực rỡ, dành cho bạn ✨');return;}
    for(let i=0;i<5;i++)fireworksTimers.push(setTimeout(()=>burst(width*(.18+Math.random()*.64),height*(.18+Math.random()*.4)),i*420));
  }
  resize();startSky(); addEventListener('resize',()=>{resize();startSky();});
  reducedMotion.addEventListener('change',startSky);
  $('#fireworks').addEventListener('click',fireworks);

  const memories={
    lantern:{symbol:'🏮',title:'Rước một trời sao',text:'Nhớ ngày bé, chỉ cần một chiếc đèn ông sao là có thể vui cả tối. Cứ đi theo tiếng trống, theo đám bạn, theo những con đường vàng ánh đèn.\n\nLớn rồi, mong bạn vẫn giữ được một niềm vui bé xíu như thế. Không cần lý do. Chỉ cần thấy lòng sáng lên.'},
    tea:{symbol:'🥮',title:'Vị của đoàn viên',text:'Chiếc bánh có thể chia làm bốn, làm tám. Nhưng niềm vui thì chẳng hề vơi đi.\n\nRót một chén trà, hỏi nhau một câu “Dạo này ổn không?”. Đôi khi, đó chính là hương vị ngon nhất của mùa Trung thu.'},
    moon:{symbol:'🌕',title:'Chung một vầng trăng',text:'Nếu tối nay mình chưa thể ngồi cạnh nhau, hãy cùng nhìn lên trời nhé.\n\nCó thể ta đang ở hai nơi rất xa, nhưng vầng trăng trên đầu thì vẫn là một. Gửi bạn một chút ánh sáng, một chút bình yên, và thật nhiều thương nhớ.'}
  };
  document.querySelectorAll('[data-memory]').forEach(button=>button.addEventListener('click',()=>{
    const memory=memories[button.dataset.memory];$('#memory-symbol').textContent=memory.symbol;$('#memory-title').textContent=memory.title;$('#memory-text').textContent=memory.text;$('#memory-dialog').showModal();
  }));

  const wishMessage=$('#wish-message');
  function countWish(){$('#wish-count').textContent=`${wishMessage.value.length}/180`;}
  wishMessage.addEventListener('input',countWish);
  document.querySelectorAll('[data-wish]').forEach(button=>button.addEventListener('click',()=>{wishMessage.value=button.dataset.wish;countWish();wishMessage.focus();}));
  try{const saved=JSON.parse(localStorage.getItem('trang-last-wish')||'null');if(saved && typeof saved.name==='string')$('#wish-name').value=saved.name.slice(0,40);}catch{}
  function releaseWish(name,message){
    name=typeof name==='string'?name.trim():'';message=typeof message==='string'?message.trim():'';
    if(!name||!message||name.length>40||message.length>180)throw new Error('Hãy nhập tên và điều ước trong giới hạn cho phép.');
    let persisted=true;try{localStorage.setItem('trang-last-wish',JSON.stringify({name,message}));}catch{persisted=false;}
    $('#wish-name').value=name;wishMessage.value=message;countWish();
    $('#wish-status').textContent=`Đèn của ${name} đã mang theo một điều lành.${persisted?'':' Trình duyệt không cho lưu; điều ước chỉ có trong lần mở này.'}`;
    if(!reducedMotion.matches){
      const layer=$('#floating-wishes');
      while(layer.childElementCount>12)layer.firstElementChild.remove();
      for(let i=0;i<5;i++){const lantern=document.createElement('span');lantern.className='flying-lantern';lantern.textContent='🏮';lantern.style.left=`${8+Math.random()*78}%`;lantern.style.animationDelay=`${i*.25}s`;lantern.style.fontSize=`${32+Math.random()*32}px`;layer.append(lantern);lantern.addEventListener('animationend',()=>lantern.remove(),{once:true});}
    }
    burst(width*.5,height*.35);return{status:'released',name,savedOnThisDevice:persisted};
  }
  $('#wish-form').addEventListener('submit',event=>{event.preventDefault();try{releaseWish($('#wish-name').value,wishMessage.value);}catch(error){$('#wish-status').textContent=error.message;}});

  function validCard(card){
    if(!card||typeof card!=='object')throw new Error('Thiệp không hợp lệ.');
    const clean={};for(const [key,max] of [['to',50],['message',400],['from',50]]){if(typeof card[key]!=='string'||!card[key].trim()||card[key].length>max)throw new Error('Hãy điền đủ thông tin và kiểm tra độ dài lời chúc.');clean[key]=card[key].trim();}return clean;
  }
  function showPreview(card){$('#preview-to').textContent=`Gửi ${card.to},`;$('#preview-message').textContent=card.message;$('#preview-from').textContent=`Thương mến, ${card.from}.`;}
  function cardLink(card){const bytes=new TextEncoder().encode(JSON.stringify(card));let binary='';bytes.forEach(byte=>binary+=String.fromCharCode(byte));const url=new URL(location.href);url.hash='card='+btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');return url.href;}
  function createCard(input){const card=validCard(input);showPreview(card);$('#recipient').value=card.to;$('#greeting').value=card.message;$('#sender').value=card.from;const url=cardLink(card);$('#share-link').value=url;$('#share-result').hidden=false;return{status:'created',url};}
  $('#open-letter').addEventListener('click',()=>$('#letter-dialog').showModal());
  $('#letter-form').addEventListener('submit',event=>{event.preventDefault();try{createCard({to:$('#recipient').value,message:$('#greeting').value,from:$('#sender').value});$('#share-link').focus();$('#share-link').select();}catch(error){toast(error.message);}});
  // Invalidate old links immediately after an edit to prevent sharing stale greetings.
  ['#recipient','#greeting','#sender'].forEach(id=>$(id).addEventListener('input',()=>{$('#share-result').hidden=true;}));
  async function copyLink(){
    try{await navigator.clipboard.writeText($('#share-link').value);toast('Đã sao chép link lời chúc.');}
    catch{$('#share-link').focus();$('#share-link').select();toast('Giữ vào link hoặc nhấn Ctrl+C để sao chép nhé.');}
  }
  $('#copy-link').addEventListener('click',copyLink);
  $('#share-native').addEventListener('click',async()=>{
    if(navigator.share && location.protocol!=='file:'){try{await navigator.share({title:'Một lời chúc dưới trăng',text:'Có một chút ánh trăng gửi đến bạn.',url:$('#share-link').value});}catch(error){if(error.name!=='AbortError')copyLink();}}else copyLink();
  });
  function readGreeting(){
    if(!location.hash.startsWith('#card='))return;
    try{const encoded=location.hash.slice(6);if(encoded.length>5000)throw new Error('too long');const binary=atob(encoded.replaceAll('-','+').replaceAll('_','/'));const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));const card=validCard(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));showPreview(card);$('#received-to').textContent=`Gửi ${card.to},`;$('#received-message').textContent=card.message;$('#received-from').textContent=`Thương mến, ${card.from}.`;if(!$('#received-dialog').open)$('#received-dialog').showModal();}
    catch{toast('Link lời chúc chưa đúng hoặc bị thiếu. Bạn vẫn có thể tạo một thiệp mới nhé.');}
  }
  readGreeting();addEventListener('hashchange',readGreeting);

  // Original pentatonic ambient melody, synthesized locally: no third-party audio.
  let audio=null, master=null, musicOn=false, musicTimer=null, nextNote=0, noteIndex=0;
  const melody=[0,2,4,7,9,7,4,2,0,4,7,12,9,7,4,2,0,2,7,9,12,9,7,4];
  function note(frequency,start,duration,volume){const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.03);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);oscillator.connect(gain);gain.connect(master);oscillator.start(start);oscillator.stop(start+duration+.1);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};}
  function scheduleMusic(){if(!musicOn||!audio||audio.state!=='running')return;while(nextNote<audio.currentTime+.5){const index=noteIndex++%melody.length;note(261.63*Math.pow(2,melody[index]/12),nextNote,2.2,.22);if(index%4===0)note(130.815,nextNote,3.2,.12);nextNote+=.64;}}
  async function toggleMusic(){
    try{if(!audio){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('unsupported');audio=new Audio();master=audio.createGain();master.gain.value=.28;master.connect(audio.destination);}
      if(musicOn){musicOn=false;clearInterval(musicTimer);await audio.suspend();}else{await audio.resume();musicOn=true;nextNote=audio.currentTime+.08;scheduleMusic();musicTimer=setInterval(scheduleMusic,200);}
      $('#sound').setAttribute('aria-pressed',String(musicOn));$('#sound').setAttribute('aria-label',musicOn?'Tắt nhạc đêm trăng':'Bật nhạc đêm trăng');$('#sound-label').textContent=musicOn?'Tắt nhạc':'Bật nhạc';
    }catch{toast('Trình duyệt này chưa bật được âm thanh. Bạn thử lại nhé.');}
  }
  $('#sound').addEventListener('click',toggleMusic);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(frame);frame=0;fireworksTimers.forEach(clearTimeout);if(audio&&musicOn)audio.suspend().catch(()=>{});}
    else{lastTime=0;startSky();if(audio&&musicOn)audio.resume().then(()=>{nextNote=audio.currentTime+.1;}).catch(()=>{});}
  });
  if(document.modelContext?.registerTool){
    const lifecycle=new AbortController();
    const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
    register({name:'release_moon_wish',title:'Thả điều ước',description:'Thả đèn trên trang và lưu điều ước trên thiết bị hiện tại; không đăng công khai.',inputSchema:{type:'object',properties:{name:{type:'string',minLength:1,maxLength:40},message:{type:'string',minLength:1,maxLength:180}},required:['name','message'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:input=>releaseWish(input?.name,input?.message)});
    register({name:'create_moon_greeting',title:'Tạo thiệp Trung thu',description:'Tạo thiệp và link chứa lời chúc, cập nhật bản xem trước; không gửi cho người nhận.',inputSchema:{type:'object',properties:{to:{type:'string',minLength:1,maxLength:50},message:{type:'string',minLength:1,maxLength:400},from:{type:'string',minLength:1,maxLength:50}},required:['to','message','from'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:input=>createCard(input)});
    addEventListener('pagehide',event=>{if(!event.persisted)lifecycle.abort();});
  }
})();
