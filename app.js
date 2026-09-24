'use strict';

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const fmt = new Intl.DateTimeFormat('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});

  let supabaseClient = null, realtimeChannel = null, wishes = [], currentWish = null;
  let totalWishCount = 0, todayWishCount = 0, totalLights = 0, selectedStyle = 'amber';
  let lightCounts = new Map(), toastTimer = null;

  function toast(message) {
    const box = $('#toast');
    box.textContent = message;
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('show'), 3200);
  }

  function clean(value, max) {
    return String(value == null ? '' : value).replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
  }

  function getVisitorId() {
    try {
      let id = localStorage.getItem('trang-visitor-id');
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('trang-visitor-id', id);
      }
      return id;
    } catch {
      return crypto.randomUUID();
    }
  }
  const visitorId = getVisitorId();

  function startOfTodayIso() {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d.toISOString();
  }

  function setDbState(online) {
    $('#db-state').textContent = online ? 'ONLINE' : 'OFFLINE';
    $('#hero-live').textContent = online ? 'BẦU TRỜI ĐANG TRỰC TUYẾN' : 'MẤT KẾT NỐI DATABASE';
  }

  function updateStats() {
    $('#hero-wish-count').textContent = String(totalWishCount || 0);
    $('#today-wishes').textContent = String(todayWishCount || 0);
    $('#total-lights').textContent = String(totalLights || 0);
  }

  const topbar = $('#topbar');
  addEventListener('scroll', () => topbar.classList.toggle('scrolled', scrollY > 20), {passive:true});

  const menuBtn = $('#menu-btn');
  const mobileMenu = $('#mobile-menu');
  menuBtn.addEventListener('click', () => {
    const open = menuBtn.getAttribute('aria-expanded') === 'true';
    menuBtn.setAttribute('aria-expanded', String(!open));
    mobileMenu.hidden = open;
  });
  $$('#mobile-menu a').forEach(a => a.addEventListener('click', () => {
    mobileMenu.hidden = true;
    menuBtn.setAttribute('aria-expanded','false');
  }));

  const themes = ['gold','jade','violet'];
  $('#theme-toggle').addEventListener('click', () => {
    const current = document.body.dataset.theme || 'gold';
    const next = themes[(themes.indexOf(current)+1)%themes.length];
    document.body.dataset.theme = next;
    try { localStorage.setItem('trang-theme', next); } catch {}
  });
  try {
    const savedTheme = localStorage.getItem('trang-theme');
    if (themes.includes(savedTheme)) document.body.dataset.theme = savedTheme;
  } catch {}

  const glow = $('#cursor-glow');
  addEventListener('pointermove', e => {
    if (reduceMotion.matches) return;
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
    const nx = e.clientX / innerWidth - .5;
    const ny = e.clientY / innerHeight - .5;
    $('#giant-moon').style.transform = 'translate(' + (nx*16) + 'px,' + (ny*12) + 'px)';
  }, {passive:true});

  $$('.tilt-card').forEach(card => {
    card.addEventListener('pointermove', e => {
      if (reduceMotion.matches || innerWidth < 800) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX-r.left)/r.width-.5;
      const y = (e.clientY-r.top)/r.height-.5;
      card.style.transform = 'perspective(900px) rotateX(' + (-y*4) + 'deg) rotateY(' + (x*5) + 'deg) translateY(-2px)';
    });
    card.addEventListener('pointerleave', () => card.style.transform='');
  });

  $$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog')?.close()));
  $$('dialog').forEach(d => d.addEventListener('click', e => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  }));

  const sky = $('#sky');
  const ctx = sky.getContext('2d');
  let W=innerWidth,H=innerHeight,DPR=1,stars=[],sparks=[],raf=0,last=0;

  function resizeSky() {
    W=innerWidth; H=innerHeight; DPR=Math.min(devicePixelRatio||1,1.5);
    sky.width=Math.round(W*DPR); sky.height=Math.round(H*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    stars=Array.from({length:W<720?38:82},()=>({x:Math.random()*W,y:Math.random()*H,r:.3+Math.random()*1.1,p:Math.random()*Math.PI*2,s:.04+Math.random()*.12}));
  }

  function drawSky(t) {
    raf=0;
    const delta=Math.min((t-last)/16.67||1,2); last=t;
    ctx.clearRect(0,0,W,H);
    for(const s of stars){
      ctx.globalAlpha=.14+(Math.sin(t*.0008+s.p)+1)*.13;
      ctx.fillStyle='#ffe5a9';
      ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
      if(!reduceMotion.matches){s.y-=s.s*delta;if(s.y<-3)s.y=H+3;}
    }
    for(let i=sparks.length-1;i>=0;i--){
      const p=sparks[i];p.x+=p.vx*delta;p.y+=p.vy*delta;p.vy+=.02*delta;p.life-=delta;
      if(p.life<=0){sparks.splice(i,1);continue;}
      ctx.globalAlpha=p.life/p.max;ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    if(!reduceMotion.matches || sparks.length) raf=requestAnimationFrame(drawSky);
  }

  function startSky(){if(!raf)raf=requestAnimationFrame(drawSky);}
  function burst(x,y,count=70){
    if(reduceMotion.matches)return;
    const colors=['#f4c76d','#fff1c1','#ef8b63','#71d3b1','#91bfff'];
    for(let i=0;i<count;i++){
      const a=Math.PI*2*i/count,sp=.8+Math.random()*3.5,life=45+Math.random()*45;
      sparks.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life,max:life,r:.7+Math.random()*1.7,c:colors[i%colors.length]});
    }
    startSky();
  }
  resizeSky();startSky();
  addEventListener('resize',()=>{resizeSky();startSky();},{passive:true});

  $('#fireworks').addEventListener('click',()=>{
    [0,250,500,800,1100].forEach((delay,i)=>setTimeout(()=>burst(W*(.18+Math.random()*.64),H*(.16+Math.random()*.5),55+i*6),delay));
    toast('Đã bật chế độ sáng nhất.');
  });

  const previewLantern = $('#preview-lantern');
  $$('.style-dot').forEach(btn => btn.addEventListener('click', () => {
    selectedStyle = btn.dataset.style;
    $$('.style-dot').forEach(x => x.classList.toggle('active',x===btn));
    previewLantern.className = 'preview-lantern ' + selectedStyle;
    try { localStorage.setItem('trang-lantern-style',selectedStyle); } catch {}
  }));
  try {
    const saved = localStorage.getItem('trang-lantern-style');
    if (['amber','jade','rose','violet','blue'].includes(saved)) {
      selectedStyle=saved;
      $$('.style-dot').forEach(x=>x.classList.toggle('active',x.dataset.style===saved));
      previewLantern.className='preview-lantern ' + saved;
    }
  } catch {}

  const nameInput=$('#wish-name'), messageInput=$('#wish-message');
  try { nameInput.value=clean(localStorage.getItem('trang-wish-name')||'',40); } catch {}

  function updatePreview(){
    $('#preview-name').textContent=(clean(nameInput.value,40).toUpperCase()||'TÊN BẠN');
    $('#wish-count').textContent=messageInput.value.length + ' / 180';
  }
  nameInput.addEventListener('input',updatePreview);
  messageInput.addEventListener('input',updatePreview);
  updatePreview();
  $$('[data-wish]').forEach(b=>b.addEventListener('click',()=>{messageInput.value=b.dataset.wish;updatePreview();messageInput.focus();}));

  function lightCount(id){return lightCounts.get(String(id))||0;}
  function wishStyle(w){return ['amber','jade','rose','violet','blue'].includes(w.lantern_style)?w.lantern_style:'amber';}

  function glowForStyle(style) {
    return style==='jade'?'#5ccfa680':style==='rose'?'#ef7d7d80':style==='violet'?'#a487ff80':style==='blue'?'#65b9f380':'#ef9c4d80';
  }

  function makeWishCard(w) {
    const card=document.createElement('article');
    const style=wishStyle(w);
    card.className='wish-card-item';
    card.style.setProperty('--lantern-glow',glowForStyle(style));
    const lantern=document.createElement('div');lantern.className='mini-lantern ' + style;
    const title=document.createElement('h3');title.textContent=w.name;
    const text=document.createElement('p');text.textContent=w.message;
    const foot=document.createElement('div');foot.className='wish-card-foot';
    const time=document.createElement('span');time.textContent=fmt.format(new Date(w.created_at));
    const lights=document.createElement('b');lights.textContent='✦ ' + lightCount(w.id);
    foot.append(time,lights);card.append(lantern,title,text,foot);
    card.tabIndex=0;card.setAttribute('role','button');
    const open=()=>openWish(w);
    card.addEventListener('click',open);
    card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
    return card;
  }

  function makeFieldLantern(w,index){
    const b=document.createElement('button');
    const style=wishStyle(w);
    b.className='field-lantern ' + style;
    b.type='button';
    b.style.left=(4+((index*17+9)%88)) + '%';
    b.style.top=(8+((index*23+5)%63)) + '%';
    b.style.setProperty('--float',(10+(index%7)*1.7) + 's');
    b.style.animationDelay=(-(index%8)*1.1) + 's';
    b.title=w.name + ': ' + w.message;
    b.addEventListener('click',()=>openWish(w));
    return b;
  }

  function renderWishes(){
    const grid=$('#wish-grid'),field=$('#lantern-field'),empty=$('#empty-state');
    grid.querySelectorAll('.wish-card-item').forEach(n=>n.remove());
    field.replaceChildren();
    empty.hidden=!!wishes.length;
    wishes.slice(0,18).forEach(w=>grid.append(makeWishCard(w)));
    wishes.slice(0,20).forEach((w,i)=>field.append(makeFieldLantern(w,i)));
    const latest=wishes[0];
    $('#ticker-text').textContent=latest?(latest.name + ' vừa thả: “' + latest.message + '”'):'Đang chờ chiếc đèn đầu tiên…';
  }

  function openWish(w){
    currentWish=w;
    const style=wishStyle(w);
    $('#dialog-lantern').className='dialog-lantern ' + style;
    $('#wish-dialog-name').textContent=w.name;
    $('#wish-dialog-message').textContent='“' + w.message + '”';
    $('#wish-dialog-time').textContent=fmt.format(new Date(w.created_at));
    $('#wish-dialog-lights').textContent=String(lightCount(w.id));
    $('#wish-dialog').showModal();
  }

  async function refreshLightCount(wishId){
    if(!supabaseClient)return;
    const result=await supabaseClient.from('wish_lights').select('id',{count:'exact',head:true}).eq('wish_id',wishId);
    if(result.error)return;
    lightCounts.set(String(wishId),result.count||0);
    totalLights=[...lightCounts.values()].reduce((a,b)=>a+b,0);
    if(currentWish && String(currentWish.id)===String(wishId)) $('#wish-dialog-lights').textContent=String(result.count||0);
    updateStats();renderWishes();
  }

  async function loadLightsForVisible(){
    if(!supabaseClient || !wishes.length){lightCounts=new Map();totalLights=0;updateStats();return;}
    const ids=wishes.map(w=>w.id);
    const result=await supabaseClient.from('wish_lights').select('wish_id').in('wish_id',ids);
    if(result.error)return;
    const map=new Map();
    for(const row of result.data||[]){const k=String(row.wish_id);map.set(k,(map.get(k)||0)+1);}
    lightCounts=map;
    totalLights=[...map.values()].reduce((a,b)=>a+b,0);
    updateStats();
  }

  async function loadWishes(){
    if(!supabaseClient)return;
    const results=await Promise.all([
      supabaseClient.from('wishes').select('id,name,message,lantern_style,created_at',{count:'exact'}).order('created_at',{ascending:false}).limit(60),
      supabaseClient.from('wishes').select('id',{count:'exact',head:true}).gte('created_at',startOfTodayIso())
    ]);
    const main=results[0], today=results[1];
    if(main.error){setDbState(false);throw main.error;}
    wishes=(main.data||[]).map(w=>({id:w.id,name:clean(w.name,40),message:clean(w.message,180),lantern_style:w.lantern_style,created_at:w.created_at}));
    totalWishCount=main.count||wishes.length;
    todayWishCount=today.count||0;
    await loadLightsForVisible();
    renderWishes();updateStats();setDbState(true);
  }

  function subscribeRealtime(){
    if(!supabaseClient)return Promise.resolve();
    realtimeChannel?.unsubscribe?.();
    return new Promise(resolve=>{
      let done=false;
      const finish=()=>{if(!done){done=true;resolve();}};
      realtimeChannel=supabaseClient.channel('moon-v3-live')
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'wishes'},payload=>{
          const r=payload.new||{};
          const w={id:r.id,name:clean(r.name,40),message:clean(r.message,180),lantern_style:r.lantern_style,created_at:r.created_at};
          if(!w.id||!w.name||!w.message)return;
          if(!wishes.some(x=>String(x.id)===String(w.id))){
            wishes.unshift(w);wishes=wishes.slice(0,60);totalWishCount++;
            if(new Date(w.created_at)>=new Date(startOfTodayIso()))todayWishCount++;
            lightCounts.set(String(w.id),0);
            renderWishes();updateStats();burst(W*.72,H*.32,38);
            toast(w.name + ' vừa thả một chiếc đèn mới.');
          }
        })
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'wish_lights'},payload=>{
          const id=payload.new&&payload.new.wish_id;
          if(id) refreshLightCount(id);
        })
        .subscribe(status=>{
          if(status==='SUBSCRIBED'){setDbState(true);finish();}
          if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status))finish();
        });
      setTimeout(finish,5000);
    });
  }

  async function initDatabase(){
    const cfg=window.TRANG_SUPABASE||{};
    if(!window.supabase?.createClient||!cfg.url||!cfg.key||String(cfg.url).includes('YOUR_')){
      setDbState(false);toast('Database chưa được cấu hình.');return;
    }
    try{
      supabaseClient=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      await subscribeRealtime();
      await loadWishes();
    }catch(err){console.error(err);setDbState(false);toast('Không kết nối được bầu trời chung.');}
  }

  $('#wish-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const name=clean(nameInput.value,40),message=clean(messageInput.value,180);
    if(!name||!message)return toast('Điền tên và điều ước trước.');
    if(!supabaseClient)return toast('Database đang offline.');
    const lastSubmit=Number(sessionStorage.getItem('trang-last-submit')||0);
    if(Date.now()-lastSubmit<8000)return toast('Đợi vài giây rồi thả tiếp nhé.');

    const btn=$('#wish-submit');
    btn.disabled=true;btn.firstChild.textContent='ĐANG THẢ… ';
    $('#wish-status').textContent='';
    try{
      const result=await supabaseClient.from('wishes').insert({name,message,lantern_style:selectedStyle}).select('id,name,message,lantern_style,created_at').single();
      if(result.error)throw result.error;
      sessionStorage.setItem('trang-last-submit',String(Date.now()));
      try{localStorage.setItem('trang-wish-name',name);}catch{}
      $('#wish-status').textContent='Đã thả lên bầu trời chung.';
      messageInput.value='';updatePreview();
      if(result.data&&!wishes.some(x=>String(x.id)===String(result.data.id))){
        wishes.unshift(result.data);wishes=wishes.slice(0,60);totalWishCount++;todayWishCount++;lightCounts.set(String(result.data.id),0);
        renderWishes();updateStats();
      }
      burst(W*.5,H*.38,90);
    }catch(err){console.error(err);toast(err.message||'Không thả được đèn.');}
    finally{btn.disabled=false;btn.firstChild.textContent='THẢ ĐÈN NGAY ';}
  });

  $('#light-wish').addEventListener('click',async()=>{
    if(!currentWish||!supabaseClient)return;
    const btn=$('#light-wish');btn.disabled=true;
    try{
      const result=await supabaseClient.from('wish_lights').insert({wish_id:currentWish.id,visitor_id:visitorId});
      if(result.error){
        if(result.error.code==='23505') toast('M đã thắp sáng điều ước này rồi.');
        else throw result.error;
      } else {
        toast('Đã thắp thêm một ánh sáng.');
        burst(W*.5,H*.45,36);
        await refreshLightCount(currentWish.id);
      }
    }catch(err){console.error(err);toast('Chưa thắp sáng được.');}
    finally{btn.disabled=false;}
  });

  function randomWish(){
    if(!wishes.length)return toast('Chưa có điều ước để bắt.');
    openWish(wishes[Math.floor(Math.random()*wishes.length)]);
  }
  $('#random-wish').addEventListener('click',randomWish);
  $('#catch-wish').addEventListener('click',randomWish);
  $('#refresh-wishes').addEventListener('click',async()=>{try{await loadWishes();toast('Đã đồng bộ bầu trời.');}catch{}});

  const oracles=[
    {s:'福',tag:'CÁT',title:'Thuận dòng',text:'Việc đang làm có tín hiệu tốt. Cứ tiếp tục theo cách ổn định, đừng vội đổi hướng chỉ vì thiếu kiên nhẫn.'},
    {s:'月',tag:'TĨNH',title:'Chậm một nhịp',text:'Có thứ chưa cần giải quyết ngay tối nay. Tạm để nó yên, ngủ đủ, rồi quyết định khi đầu óc sáng hơn.'},
    {s:'光',tag:'KHAI',title:'Có đường mới',text:'Một ý tưởng hoặc mối liên hệ mới đáng để thử. Bắt đầu nhỏ, kiểm chứng nhanh rồi mới đầu tư nhiều hơn.'},
    {s:'安',tag:'AN',title:'Giữ nhịp',text:'Không phải lúc nào tăng tốc cũng tốt. Duy trì thứ đang vận hành ổn có thể là lựa chọn hiệu quả nhất.'},
    {s:'星',tag:'TIẾN',title:'Tiến một bước',text:'Nếu đã chờ đủ lâu, hãy làm một hành động cụ thể trong 24 giờ tới thay vì tiếp tục nghĩ thêm.'},
    {s:'緣',tag:'DUYÊN',title:'Kết nối',text:'Một cuộc nói chuyện thẳng thắn có thể giải quyết nhiều hơn m đoán. Chủ động nhắn cho người cần nhắn.'},
    {s:'火',tag:'ĐỘNG',title:'Bật công tắc',text:'Năng lượng đang có, tận dụng nó. Chọn đúng một việc quan trọng và xử lý cho xong trước khi mở việc khác.'},
    {s:'水',tag:'NHU',title:'Đổi góc nhìn',text:'Vấn đề có thể không nằm ở mục tiêu mà ở cách tiếp cận. Thử một con đường khác thay vì ép cách cũ.'}
  ];

  function drawOracle(){
    const o=oracles[Math.floor(Math.random()*oracles.length)];
    const box=$('#oracle-result');box.classList.remove('reveal');void box.offsetWidth;box.classList.add('reveal');
    $('#oracle-symbol').textContent=o.s;$('#oracle-tag').textContent=o.tag;$('#oracle-title').textContent=o.title;$('#oracle-text').textContent=o.text;
    burst(W*.73,H*.55,28);
  }
  $('#draw-oracle').addEventListener('click',drawOracle);
  $('#oracle-deck').addEventListener('click',drawOracle);

  function wrapText(c,text,x,y,maxWidth,lineHeight){
    const words=text.split(' ');let line='';
    for(const word of words){
      const test=line+word+' ';
      if(c.measureText(test).width>maxWidth&&line){c.fillText(line,x,y);line=word+' ';y+=lineHeight;}
      else line=test;
    }
    c.fillText(line,x,y);
  }

  function drawPoster(){
    const name=clean(nameInput.value,40)||'Ẩn danh';
    const message=clean(messageInput.value,180)||'Một điều ước dưới trăng.';
    const canvas=$('#poster-canvas'),c=canvas.getContext('2d'),style=selectedStyle;
    const palettes={
      amber:['#050b14','#d96a32','#f4c76d'],jade:['#05110f','#3ca986','#7ce0bc'],
      rose:['#12070d','#d95269','#f39a9a'],violet:['#090615','#7655cf','#b69aff'],blue:['#05101b','#378fcf','#82c8f8']
    };
    const palette=palettes[style];
    const g=c.createLinearGradient(0,0,1080,1350);g.addColorStop(0,palette[0]);g.addColorStop(.6,'#08111d');g.addColorStop(1,'#02060c');
    c.fillStyle=g;c.fillRect(0,0,1080,1350);
    c.globalAlpha=.18;
    for(let i=0;i<90;i++){c.fillStyle='#fff';c.beginPath();c.arc(Math.random()*1080,Math.random()*1350,Math.random()*2+1,0,Math.PI*2);c.fill();}
    c.globalAlpha=1;
    const rg=c.createRadialGradient(780,260,30,780,260,230);rg.addColorStop(0,'#fff6ca');rg.addColorStop(.55,palette[2]);rg.addColorStop(1,palette[1]);
    c.fillStyle=rg;c.beginPath();c.arc(780,260,175,0,Math.PI*2);c.fill();
    c.shadowColor=palette[2];c.shadowBlur=70;c.strokeStyle=palette[2];c.lineWidth=2;c.beginPath();c.arc(780,260,205,0,Math.PI*2);c.stroke();c.shadowBlur=0;
    c.fillStyle=palette[2];c.font='600 34px Be Vietnam Pro, sans-serif';c.fillText('TRĂNG / MOON WISH',70,100);
    c.fillStyle='#f7f2e8';c.font='700 88px Noto Serif, serif';c.fillText(name,70,640);
    c.fillStyle='#8d9aa7';c.font='400 30px Be Vietnam Pro, sans-serif';c.fillText('đã thả một điều ước',72,700);
    c.fillStyle='#f3ead7';c.font='600 46px Noto Serif, serif';wrapText(c,'“'+message+'”',70,810,900,68);
    c.fillStyle='#62717e';c.font='400 24px Be Vietnam Pro, sans-serif';c.fillText('TRĂNG / 2026',70,1275);
    $('#poster-dialog').showModal();
  }
  $('#poster-btn').addEventListener('click',drawPoster);
  $('#download-poster').addEventListener('click',()=>{
    const a=document.createElement('a');a.download='trang-moon-wish.png';a.href=$('#poster-canvas').toDataURL('image/png');a.click();
  });

  function safeCard(obj){
    const out={to:clean(obj.to,50),message:clean(obj.message,400),from:clean(obj.from,50)};
    if(!out.to||!out.message||!out.from)throw new Error('Điền đủ thông tin.');
    return out;
  }
  function previewCard(card){
    $('#preview-to').textContent='Gửi '+card.to+',';
    $('#preview-message').textContent=card.message;
    $('#preview-from').textContent='— '+card.from;
  }
  function makeCardLink(card){
    const bytes=new TextEncoder().encode(JSON.stringify(card));let bin='';bytes.forEach(b=>bin+=String.fromCharCode(b));
    const u=new URL(location.href);u.hash='card='+btoa(bin).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');return u.href;
  }
  $('#letter-form').addEventListener('input',()=>{
    previewCard({to:$('#recipient').value||'bạn',message:$('#greeting').value||'',from:$('#sender').value||'một người'});
  });
  $('#letter-form').addEventListener('submit',e=>{
    e.preventDefault();
    try{
      const card=safeCard({to:$('#recipient').value,message:$('#greeting').value,from:$('#sender').value});
      previewCard(card);$('#share-link').value=makeCardLink(card);$('#share-result').hidden=false;
    }catch(err){toast(err.message);}
  });
  async function copyShare(){
    try{await navigator.clipboard.writeText($('#share-link').value);toast('Đã copy link thiệp.');}
    catch{$('#share-link').select();toast('Link đã được chọn để copy.');}
  }
  $('#copy-link').addEventListener('click',copyShare);
  $('#share-native').addEventListener('click',async()=>{
    if(navigator.share){try{await navigator.share({title:'Thiệp Trung thu',text:'Có một lời nhắn cho bạn.',url:$('#share-link').value});}catch{}}
    else copyShare();
  });

  function readCard(){
    if(!location.hash.startsWith('#card='))return;
    try{
      let s=location.hash.slice(6).replaceAll('-','+').replaceAll('_','/');while(s.length%4)s+='=';
      const bytes=Uint8Array.from(atob(s),c=>c.charCodeAt(0));
      const card=safeCard(JSON.parse(new TextDecoder().decode(bytes)));
      $('#received-to').textContent='Gửi '+card.to+',';
      $('#received-message').textContent=card.message;
      $('#received-from').textContent='— '+card.from;
      $('#received-dialog').showModal();
    }catch{toast('Link thiệp không hợp lệ.');}
  }
  readCard();addEventListener('hashchange',readCard);

  let audio=null,master=null,musicOn=false,musicTimer=null,nextNote=0,noteIndex=0;
  const melody=[0,4,7,9,7,4,2,0,4,7,12,9,7,4,2,0,2,7,9,12,9,7,4,2];
  function tone(freq,start,dur,vol){
    const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=freq;
    g.gain.setValueAtTime(.0001,start);g.gain.exponentialRampToValueAtTime(vol,start+.04);g.gain.exponentialRampToValueAtTime(.0001,start+dur);
    o.connect(g);g.connect(master);o.start(start);o.stop(start+dur+.05);
  }
  function scheduleMusic(){
    if(!musicOn||!audio||audio.state!=='running')return;
    while(nextNote<audio.currentTime+.5){
      const i=noteIndex++%melody.length;tone(261.63*Math.pow(2,melody[i]/12),nextNote,2,.15);
      if(i%4===0)tone(130.81,nextNote,3,.055);nextNote+=.68;
    }
  }
  $('#sound').addEventListener('click',async()=>{
    try{
      if(!audio){const A=window.AudioContext||window.webkitAudioContext;if(!A)throw new Error();audio=new A();master=audio.createGain();master.gain.value=.25;master.connect(audio.destination);}
      if(musicOn){musicOn=false;clearInterval(musicTimer);await audio.suspend();}
      else{await audio.resume();musicOn=true;nextNote=audio.currentTime+.08;scheduleMusic();musicTimer=setInterval(scheduleMusic,220);}
      $('#sound').setAttribute('aria-pressed',String(musicOn));$('#sound-label').textContent=musicOn?'Tắt':'Nhạc';
    }catch{toast('Trình duyệt không phát được âm thanh.');}
  });

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(raf);raf=0;if(audio&&musicOn)audio.suspend().catch(()=>{});}
    else{last=0;startSky();if(audio&&musicOn)audio.resume().catch(()=>{});}
  });
  addEventListener('pagehide',()=>realtimeChannel?.unsubscribe?.());

  initDatabase();
})();