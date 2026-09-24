'use strict';

(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const fmt = new Intl.DateTimeFormat('vi-VN', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
  let toastTimer, supabaseClient = null, wishChannel = null, currentWishes = [], totalWishCount = 0;

  function toast(message) {
    const box = $('#toast');
    box.textContent = message;
    box.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('visible'), 3500);
  }

  function cleanText(value, max) {
    return String(value ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function setDbState(title, detail, online = false) {
    $('#db-state').textContent = title;
    $('#db-state-detail').textContent = detail;
    $('.live-dot')?.classList.toggle('online', online);
  }

  // Header + mobile navigation.
  const header = $('#header');
  addEventListener('scroll', () => header.classList.toggle('is-scrolled', scrollY > 24), {passive:true});
  const menuButton = $('#menu-button');
  const mobileNav = $('#mobile-nav');
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    mobileNav.hidden = open;
  });
  $$('#mobile-nav a').forEach(a => a.addEventListener('click', () => {
    mobileNav.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
  }));

  // Dialog helpers.
  $$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog')?.close()));
  $$('dialog').forEach(dialog => dialog.addEventListener('click', e => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
  }));

  // Lightweight stars + fireworks.
  const canvas = $('#sky');
  const ctx = canvas?.getContext('2d');
  let w = innerWidth, h = innerHeight, dpr = 1, stars = [], sparks = [], frame = 0, last = 0;
  function resizeSky() {
    if (!ctx) return;
    w = innerWidth; h = innerHeight; dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    stars = Array.from({length:w < 720 ? 36 : 75}, () => ({
      x:Math.random()*w,y:Math.random()*h,r:.35+Math.random()*1.1,p:Math.random()*6.28,s:.05+Math.random()*.18
    }));
  }
  function drawSky(time) {
    frame = 0;
    if (!ctx || document.hidden) return;
    const delta = Math.min((time-last)/16.67 || 1, 2); last = time;
    ctx.clearRect(0,0,w,h);
    for (const s of stars) {
      ctx.globalAlpha = reducedMotion.matches ? .22 : .12 + (Math.sin(time*.0008+s.p)+1)*.16;
      ctx.fillStyle = '#f7d998'; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
      if (!reducedMotion.matches) { s.y -= s.s*delta; if (s.y < -2) s.y = h+2; }
    }
    for (let i=sparks.length-1;i>=0;i--) {
      const p=sparks[i]; p.x+=p.vx*delta; p.y+=p.vy*delta; p.vy+=.018*delta; p.life-=delta;
      if (p.life<=0) { sparks.splice(i,1); continue; }
      ctx.globalAlpha=Math.max(0,p.life/p.max); ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
    if (!reducedMotion.matches || sparks.length) frame=requestAnimationFrame(drawSky);
  }
  function startSky(){ if (!frame && !document.hidden) frame=requestAnimationFrame(drawSky); }
  function burst(x,y,count=w<720?45:80){
    if (!ctx || reducedMotion.matches) return;
    const colors=['#f2ce82','#e98756','#fff2c7','#acd2c0'];
    for(let i=0;i<count;i++){
      const a=Math.PI*2*i/count, speed=.8+Math.random()*3.3, life=42+Math.random()*50;
      sparks.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life,max:life,r:.7+Math.random()*1.7,color:colors[i%colors.length]});
    }
    if(sparks.length>600)sparks.splice(0,sparks.length-600);
    startSky();
  }
  resizeSky(); startSky();
  addEventListener('resize', () => {resizeSky();startSky();}, {passive:true});
  $('#fireworks').addEventListener('click', () => {
    if (reducedMotion.matches) return toast('Đêm trăng đã sáng lên rồi ✨');
    [0,300,620,950,1280].forEach((delay,i) => setTimeout(() => burst(w*(.2+Math.random()*.6),h*(.17+Math.random()*.43),55+i*5), delay));
    document.body.animate([{filter:'brightness(1)'},{filter:'brightness(1.08)'},{filter:'brightness(1)'}],{duration:1700,easing:'ease-out'});
  });

  // Memory cards.
  const memories = {
    lantern:{symbol:'🏮',title:'Rước một trời sao',text:'Ngày bé, chỉ cần một chiếc đèn nhỏ là đủ vui cả tối. Cứ đi theo tiếng trống, theo đám bạn, theo những con đường vàng ánh sáng.\n\nLớn rồi, mong bạn vẫn giữ được một niềm vui bé xíu như thế — không cần lý do, chỉ cần thấy lòng mình sáng lên.'},
    tea:{symbol:'🥮',title:'Vị của đoàn viên',text:'Chiếc bánh có thể chia làm bốn, làm tám. Nhưng niềm vui thì chẳng hề vơi đi.\n\nRót một chén trà, hỏi nhau một câu “Dạo này ổn không?”. Đôi khi, đó chính là hương vị ngon nhất của mùa Trung thu.'},
    moon:{symbol:'🌕',title:'Chung một vầng trăng',text:'Nếu tối nay mình chưa thể ngồi cạnh nhau, hãy cùng nhìn lên trời nhé.\n\nCó thể ta đang ở hai nơi rất xa, nhưng vầng trăng trên đầu vẫn là một. Gửi bạn một chút ánh sáng, một chút bình yên, và thật nhiều thương nhớ.'}
  };
  $$('[data-memory]').forEach(button => button.addEventListener('click', () => {
    const m = memories[button.dataset.memory];
    $('#memory-symbol').textContent=m.symbol; $('#memory-title').textContent=m.title; $('#memory-text').textContent=m.text;
    $('#memory-dialog').showModal();
  }));

  // Wish UI.
  const wishMessage = $('#wish-message');
  const wishName = $('#wish-name');
  const wishSubmit = $('#wish-submit');
  const countWish = () => $('#wish-count').textContent = `${wishMessage.value.length}/180`;
  wishMessage.addEventListener('input', countWish);
  $$('[data-wish]').forEach(b => b.addEventListener('click', () => {wishMessage.value=b.dataset.wish;countWish();wishMessage.focus();}));
  try { wishName.value = cleanText(localStorage.getItem('trang-wish-name') || '', 40); } catch {}

  function formatWishTime(value) {
    try { return fmt.format(new Date(value)); } catch { return ''; }
  }

  function makeWishCard(wish) {
    const article = document.createElement('article');
    article.className = 'wish-item';
    article.tabIndex = 0;
    article.setAttribute('role','button');
    article.setAttribute('aria-label', `Xem điều ước của ${wish.name}`);
    const name = document.createElement('p'); name.className='wish-item-name'; name.textContent=wish.name;
    const message = document.createElement('p'); message.className='wish-item-message'; message.textContent=wish.message;
    const time = document.createElement('p'); time.className='wish-item-time'; time.textContent=formatWishTime(wish.created_at);
    article.append(name,message,time);
    const open = () => openWish(wish);
    article.addEventListener('click',open);
    article.addEventListener('keydown',e => {if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
    return article;
  }

  function openWish(wish) {
    $('#wish-dialog-name').textContent = `Điều ước của ${wish.name}`;
    $('#wish-dialog-message').textContent = `“${wish.message}”`;
    $('#wish-dialog-time').textContent = formatWishTime(wish.created_at);
    $('#wish-dialog').showModal();
  }

  function makeSkyLantern(wish, index) {
    const button = document.createElement('button');
    button.type='button'; button.className='sky-lantern';
    button.style.left = `${6 + ((index*17 + 9) % 84)}%`;
    button.style.top = `${10 + ((index*23 + 13) % 64)}%`;
    button.style.setProperty('--dur', `${12 + (index%6)*2.3}s`);
    button.style.animationDelay = `${-(index%8)*1.3}s`;
    button.innerHTML = '<span class="lantern-body" aria-hidden="true"></span><span class="lantern-name"></span>';
    $('.lantern-name',button).textContent = wish.name;
    button.setAttribute('aria-label',`Xem điều ước của ${wish.name}`);
    button.addEventListener('click',() => openWish(wish));
    return button;
  }

  function renderWishes() {
    const list=$('#wish-list'), float=$('#floating-wishes'), empty=$('#empty-wishes');
    list.querySelectorAll('.wish-item').forEach(n=>n.remove());
    float.replaceChildren();
    if (!currentWishes.length) {
      empty.hidden=false;
    } else {
      empty.hidden=true;
      currentWishes.slice(0,18).forEach(wish => list.append(makeWishCard(wish)));
      currentWishes.slice(0,14).forEach((wish,i) => float.append(makeSkyLantern(wish,i)));
    }
    $('#visible-wishes').textContent=String(Math.min(currentWishes.length,18));
  }

  function updateStats() {
    $('#total-wishes').textContent = String(totalWishCount || currentWishes.length || 0);
    $('#hero-wish-count').textContent = String(totalWishCount || currentWishes.length || 0);
    const today = new Date(); today.setHours(0,0,0,0);
    $('#today-wishes').textContent = String(currentWishes.filter(w => new Date(w.created_at) >= today).length);
  }

  async function loadWishes({quiet=false}={}) {
    if (!supabaseClient) return;
    if (!quiet) setDbState('Đang nhìn lên bầu trời…','Đang tải những điều ước gần nhất.',true);
    const [{data,error,count}, countResult] = await Promise.all([
      supabaseClient.from('wishes').select('id,name,message,created_at',{count:'exact'}).order('created_at',{ascending:false}).limit(60),
      supabaseClient.from('wishes').select('id',{count:'exact',head:true})
    ]);
    if (error) {
      setDbState('Chưa đọc được bầu trời','Database chưa sẵn sàng hoặc cấu hình chưa đúng.',false);
      if (!quiet) toast('Chưa tải được điều ước chung.');
      return;
    }
    currentWishes = Array.isArray(data) ? data.map(w => ({
      id:w.id,name:cleanText(w.name,40),message:cleanText(w.message,180),created_at:w.created_at
    })) : [];
    totalWishCount = countResult.count ?? count ?? currentWishes.length;
    renderWishes(); updateStats();
    setDbState('Bầu trời đang trực tuyến',`${totalWishCount} điều ước đang được giữ dưới trăng.`,true);
  }

  function subscribeWishes() {
    if (!supabaseClient) return;
    wishChannel?.unsubscribe?.();
    wishChannel = supabaseClient
      .channel('public-wishes-live')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'wishes'}, payload => {
        const raw=payload.new||{};
        const wish={id:raw.id,name:cleanText(raw.name,40),message:cleanText(raw.message,180),created_at:raw.created_at};
        if(!wish.name||!wish.message)return;
        if(!currentWishes.some(w=>String(w.id)===String(wish.id)))currentWishes.unshift(wish);
        currentWishes=currentWishes.slice(0,60); totalWishCount++;
        renderWishes();updateStats();burst(w*.72,h*.35,34);
        toast(`Một chiếc đèn mới của ${wish.name} vừa bay lên ✨`);
      })
      .subscribe(status => {
        if(status==='SUBSCRIBED')setDbState('Bầu trời đang trực tuyến','Điều ước mới sẽ xuất hiện ngay, không cần tải lại.',true);
      });
  }

  async function submitWish(name,message) {
    name=cleanText(name,40); message=cleanText(message,180);
    if(!name||!message)throw new Error('Điền tên và điều ước trước khi thả đèn nhé.');
    if(!supabaseClient)throw new Error('Bầu trời chung chưa được kết nối database.');
    const last=Number(sessionStorage.getItem('last-wish-submit')||0);
    if(Date.now()-last<8000)throw new Error('Đợi vài giây rồi thả chiếc đèn tiếp theo nhé.');
    wishSubmit.disabled=true;
    wishSubmit.firstChild.textContent='Đang thả đèn… ';
    try{
      const {data,error}=await supabaseClient.from('wishes').insert({name,message}).select('id,name,message,created_at').single();
      if(error)throw error;
      sessionStorage.setItem('last-wish-submit',String(Date.now()));
      try{localStorage.setItem('trang-wish-name',name);}catch{}
      $('#wish-status').textContent=`Đèn của ${name} đã được thả lên bầu trời chung.`;
      wishMessage.value='';countWish();
      if(data&&!currentWishes.some(w=>String(w.id)===String(data.id))){
        currentWishes.unshift(data);currentWishes=currentWishes.slice(0,60);totalWishCount++;renderWishes();updateStats();
      }
      burst(w*.55,h*.42,70);
      return data;
    } finally {
      wishSubmit.disabled=false;
      wishSubmit.firstChild.textContent='Thả đèn ước nguyện ';
    }
  }

  $('#wish-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('#wish-status').textContent='';
    try{await submitWish(wishName.value,wishMessage.value);}
    catch(err){console.error(err);$('#wish-status').textContent=err?.message?.includes('duplicate')?'Điều ước này vừa được gửi rồi.':(err?.message||'Chưa thả được đèn. Thử lại nhé.');}
  });
  $('#refresh-wishes').addEventListener('click',()=>loadWishes());

  // Supabase bootstrap. Public anon/publishable key is expected; never use service_role here.
  async function initDatabase() {
    const cfg = window.TRANG_SUPABASE || {};
    const valid = cfg.url && cfg.key && !String(cfg.url).includes('YOUR_') && !String(cfg.key).includes('YOUR_');
    if (!window.supabase?.createClient || !valid) {
      setDbState('Bầu trời chung chưa được bật','Kết nối Supabase chưa được cấu hình cho bản deploy này.',false);
      $('#wish-status').textContent='Phần giao diện đã sẵn sàng, nhưng database chung chưa được kết nối.';
      return;
    }
    try{
      supabaseClient=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      await loadWishes({quiet:true});
      subscribeWishes();
    }catch(err){
      console.error(err); setDbState('Không kết nối được database','Kiểm tra URL/key hoặc cấu hình RLS.',false);
    }
  }

  // Greeting card link.
  function validCard(card){
    if(!card||typeof card!=='object')throw new Error('Thiệp không hợp lệ.');
    const out={};for(const [k,max] of [['to',50],['message',400],['from',50]]){out[k]=cleanText(card[k],max);if(!out[k])throw new Error('Điền đủ thông tin lời chúc nhé.');}return out;
  }
  function showPreview(card){$('#preview-to').textContent=`Gửi ${card.to},`;$('#preview-message').textContent=card.message;$('#preview-from').textContent=`Thương mến, ${card.from}.`;}
  function cardLink(card){const bytes=new TextEncoder().encode(JSON.stringify(card));let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));const url=new URL(location.href);url.hash='card='+btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');return url.href;}
  $('#open-letter').addEventListener('click',()=>$('#letter-dialog').showModal());
  $('#letter-form').addEventListener('submit',e=>{e.preventDefault();try{const card=validCard({to:$('#recipient').value,message:$('#greeting').value,from:$('#sender').value});showPreview(card);$('#share-link').value=cardLink(card);$('#share-result').hidden=false;$('#share-link').select();}catch(err){toast(err.message);}});
  ['#recipient','#greeting','#sender'].forEach(id=>$(id).addEventListener('input',()=>$('#share-result').hidden=true));
  async function copyLink(){try{await navigator.clipboard.writeText($('#share-link').value);toast('Đã sao chép link lời chúc.');}catch{$('#share-link').select();toast('Nhấn Ctrl+C để sao chép link nhé.');}}
  $('#copy-link').addEventListener('click',copyLink);
  $('#share-native').addEventListener('click',async()=>{if(navigator.share){try{await navigator.share({title:'Một lời chúc dưới trăng',text:'Có một chút ánh trăng gửi đến bạn.',url:$('#share-link').value});}catch(err){if(err.name!=='AbortError')copyLink();}}else copyLink();});
  function readGreeting(){if(!location.hash.startsWith('#card='))return;try{let s=location.hash.slice(6).replaceAll('-','+').replaceAll('_','/');while(s.length%4)s+='=';const binary=atob(s);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));const card=validCard(JSON.parse(new TextDecoder().decode(bytes)));showPreview(card);$('#received-to').textContent=`Gửi ${card.to},`;$('#received-message').textContent=card.message;$('#received-from').textContent=`Thương mến, ${card.from}.`;$('#received-dialog').showModal();}catch{toast('Link lời chúc bị thiếu hoặc không hợp lệ.');}}
  readGreeting();addEventListener('hashchange',readGreeting);

  // Ambient pentatonic synth.
  let audio=null,master=null,musicOn=false,timer=null,nextNote=0,noteIndex=0;
  const melody=[0,2,4,7,9,7,4,2,0,4,7,12,9,7,4,2,0,2,7,9,12,9,7,4];
  function note(freq,start,dur,vol){const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.0001,start);g.gain.exponentialRampToValueAtTime(vol,start+.04);g.gain.exponentialRampToValueAtTime(.0001,start+dur);o.connect(g);g.connect(master);o.start(start);o.stop(start+dur+.1);}
  function schedule(){if(!musicOn||!audio||audio.state!=='running')return;while(nextNote<audio.currentTime+.5){const i=noteIndex++%melody.length;note(261.63*Math.pow(2,melody[i]/12),nextNote,2.1,.18);if(i%4===0)note(130.815,nextNote,3,.08);nextNote+=.68;}}
  $('#sound').addEventListener('click',async()=>{try{if(!audio){const A=window.AudioContext||window.webkitAudioContext;if(!A)throw new Error('unsupported');audio=new A();master=audio.createGain();master.gain.value=.28;master.connect(audio.destination);}if(musicOn){musicOn=false;clearInterval(timer);await audio.suspend();}else{await audio.resume();musicOn=true;nextNote=audio.currentTime+.08;schedule();timer=setInterval(schedule,220);}$('#sound').setAttribute('aria-pressed',String(musicOn));$('#sound-label').textContent=musicOn?'Tắt nhạc':'Bật nhạc';}catch{toast('Trình duyệt chưa cho phép phát âm thanh.');}});

  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;if(audio&&musicOn)audio.suspend().catch(()=>{});}else{last=0;startSky();if(audio&&musicOn)audio.resume().catch(()=>{});}});
  addEventListener('pagehide',()=>wishChannel?.unsubscribe?.());

  initDatabase();
})();