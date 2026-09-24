'use strict';

(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const fmt = new Intl.DateTimeFormat('vi-VN', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  let supabaseClient = null;
  let wishChannel = null;
  let reactionChannel = null;
  let currentWishes = [];
  let reactionRows = [];
  let totalWishCount = 0;
  let todayWishCount = 0;
  let totalReactionCount = 0;
  let activeFilter = 'latest';
  let activeDialogWish = null;
  let toastTimer = null;

  const getClientId = () => {
    try {
      let id = localStorage.getItem('trang-client-id');
      if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-' + Math.random().toString(16).slice(2).padEnd(12,'0').slice(0,12);
        localStorage.setItem('trang-client-id', id);
      }
      return id;
    } catch {
      return crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-000000000001';
    }
  };
  const clientId = getClientId();

  function cleanText(value,max){
    return String(value ?? '').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
  }

  function toast(message){
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('visible'), 3200);
  }

  function setDbState(title,detail,online=false){
    $('#db-state').textContent = title;
    $('#db-state-detail').textContent = detail;
    $('#db-dot').classList.toggle('online',online);
    $('#hero-status').textContent = online ? 'Bầu trời realtime đang mở' : 'Đang kết nối bầu trời';
    $('#footer-status').textContent = online ? 'ONLINE' : 'CONNECTING';
  }

  // Header / menu / cursor.
  const header = $('#header');
  addEventListener('scroll', () => header.classList.toggle('is-scrolled', scrollY > 20), {passive:true});
  const menuButton = $('#menu-button');
  const mobileNav = $('#mobile-nav');
  menuButton.addEventListener('click',() => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded',String(!open));
    mobileNav.hidden = open;
  });
  $$('#mobile-nav a').forEach(a => a.addEventListener('click',() => {mobileNav.hidden=true;menuButton.setAttribute('aria-expanded','false');}));

  const glow = $('#cursor-glow');
  addEventListener('pointermove', e => {
    if (matchMedia('(hover:hover)').matches) {
      glow.style.left = e.clientX + 'px';
      glow.style.top = e.clientY + 'px';
    }
  }, {passive:true});

  // Scene controls.
  const scenes = ['gold','blue','red'];
  function setScene(scene){
    if(!scenes.includes(scene)) return;
    document.body.dataset.scene = scene;
    $$('[data-scene]').forEach(b => b.classList.toggle('active', b.dataset.scene === scene));
  }
  $$('[data-scene]').forEach(b => b.addEventListener('click',() => setScene(b.dataset.scene)));
  $('#scene-toggle').addEventListener('click',() => {
    const i = scenes.indexOf(document.body.dataset.scene);
    setScene(scenes[(i+1)%scenes.length]);
  });
  $('#moon-intensity').addEventListener('input', e => document.documentElement.style.setProperty('--moon-strength', String(Number(e.target.value)/100)));
  $('#star-density').addEventListener('input', e => {
    document.documentElement.style.setProperty('--star-strength', String(Math.max(.2,Number(e.target.value)/100)));
    rebuildStars(Number(e.target.value));
  });
  $('#cinema-mode').addEventListener('click',() => {
    document.body.classList.toggle('cinema');
    $('#cinema-mode').textContent = document.body.classList.contains('cinema') ? 'Thoát cinema' : 'Cinema mode';
  });

  // Canvas sky.
  const canvas = $('#sky');
  const ctx = canvas?.getContext('2d');
  let cw=innerWidth,ch=innerHeight,dpr=1,stars=[],sparks=[],raf=0,last=0;
  function rebuildStars(density=70){
    const count = Math.round((cw<720?35:80)*(density/70));
    stars = Array.from({length:Math.max(12,count)},()=>({
      x:Math.random()*cw,y:Math.random()*ch,r:.3+Math.random()*1.1,p:Math.random()*6.28,s:.04+Math.random()*.16
    }));
    startSky();
  }
  function resizeSky(){
    if(!ctx)return;
    cw=innerWidth;ch=innerHeight;dpr=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    rebuildStars(Number($('#star-density')?.value||70));
  }
  function drawSky(t){
    raf=0;if(!ctx||document.hidden)return;
    const delta=Math.min((t-last)/16.7||1,2);last=t;ctx.clearRect(0,0,cw,ch);
    for(const s of stars){
      ctx.globalAlpha=.12+(Math.sin(t*.0009+s.p)+1)*.16;ctx.fillStyle='#f7d990';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
      if(!reduced.matches){s.y-=s.s*delta;if(s.y<-2)s.y=ch+2;}
    }
    for(let i=sparks.length-1;i>=0;i--){
      const p=sparks[i];p.x+=p.vx*delta;p.y+=p.vy*delta;p.vy+=.02*delta;p.life-=delta;
      if(p.life<=0){sparks.splice(i,1);continue}
      ctx.globalAlpha=p.life/p.max;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    if(!reduced.matches||sparks.length)raf=requestAnimationFrame(drawSky);
  }
  function startSky(){if(!raf&&!document.hidden)raf=requestAnimationFrame(drawSky)}
  function burst(x,y,count=65){
    if(!ctx||reduced.matches)return;
    const colors=['#f5ce76','#fff1bc','#ff7f61','#81d6ff'];
    for(let i=0;i<count;i++){
      const a=Math.PI*2*i/count,s=.8+Math.random()*3.4,life=40+Math.random()*48;
      sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life,max:life,r:.7+Math.random()*1.6,color:colors[i%colors.length]});
    }
    if(sparks.length>650)sparks.splice(0,sparks.length-650);
    startSky();
  }
  resizeSky();startSky();
  addEventListener('resize',resizeSky,{passive:true});
  $('#fireworks').addEventListener('click',()=>{
    if(reduced.matches)return toast('Bầu trời đã sáng lên ✦');
    [0,260,520,780,1040,1300].forEach((d,i)=>setTimeout(()=>burst(cw*(.14+Math.random()*.72),ch*(.12+Math.random()*.46),48+i*5),d));
  });

  // Dialogs.
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog')?.close()));
  $$('dialog').forEach(d=>d.addEventListener('click',e=>{
    if(e.target!==d)return;
    const r=d.getBoundingClientRect();
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();
  }));

  // Memory archive.
  const memories={
    lantern:{symbol:'🏮',title:'Đèn lồng',text:'Một nguồn sáng nhỏ, đủ để biến cả con đường thành đêm hội.'},
    tea:{symbol:'🥮',title:'Bánh trăng',text:'Bẻ một miếng, chia cho nhau. Trung thu vốn đơn giản như vậy.'},
    moon:{symbol:'🌕',title:'Trăng rằm',text:'Cùng một vầng trăng, dù mỗi người đang đứng ở một nơi khác.'}
  };
  $$('[data-memory]').forEach(b=>b.addEventListener('click',()=>{
    const m=memories[b.dataset.memory];$('#memory-symbol').textContent=m.symbol;$('#memory-title').textContent=m.title;$('#memory-text').textContent=m.text;$('#memory-dialog').showModal();
  }));

  // Wishes.
  const wishMessage=$('#wish-message'),wishName=$('#wish-name'),wishSubmit=$('#wish-submit');
  function updateWishCount(){$('#wish-count').textContent=`${wishMessage.value.length} / 180`}
  wishMessage.addEventListener('input',updateWishCount);
  $$('[data-wish]').forEach(b=>b.addEventListener('click',()=>{wishMessage.value=b.dataset.wish;updateWishCount();wishMessage.focus()}));
  try{wishName.value=cleanText(localStorage.getItem('trang-wish-name')||'',40)}catch{}

  const startToday=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
  const isToday=v=>new Date(v)>=startToday();
  const scoreFor=id=>reactionRows.filter(r=>String(r.wish_id)===String(id)).length;
  const countsFor=id=>{
    const rows=reactionRows.filter(r=>String(r.wish_id)===String(id));
    return {
      heart:rows.filter(r=>r.reaction==='heart').length,
      star:rows.filter(r=>r.reaction==='star').length,
      moon:rows.filter(r=>r.reaction==='moon').length
    };
  };

  function renderLanterns(){
    const sky=$('#floating-wishes');sky.replaceChildren();
    currentWishes.slice(0,16).forEach((wish,i)=>{
      const b=document.createElement('button');b.type='button';b.className='sky-lantern';
      const left=4+((i*19+7)%58),top=7+((i*23+5)%74);
      b.style.left=left+'%';b.style.top=top+'%';b.style.setProperty('--dur',(11+(i%6)*1.7)+'s');b.style.animationDelay=(-(i%7)*1.2)+'s';
      b.innerHTML='<span class="lantern-body"></span><span class="lantern-name"></span>';
      $('.lantern-name',b).textContent=wish.name;
      b.setAttribute('aria-label',`Mở điều ước của ${wish.name}`);
      b.addEventListener('click',()=>openWish(wish));
      sky.append(b);
    });
  }

  function filteredWishes(){
    const q=cleanText($('#wish-search').value,100).toLocaleLowerCase('vi');
    let list=currentWishes.filter(w=>!q||w.name.toLocaleLowerCase('vi').includes(q)||w.message.toLocaleLowerCase('vi').includes(q));
    if(activeFilter==='today')list=list.filter(w=>isToday(w.created_at));
    if(activeFilter==='top')list=[...list].sort((a,b)=>scoreFor(b.id)-scoreFor(a.id)||new Date(b.created_at)-new Date(a.created_at));
    else list=[...list].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    return list;
  }

  function makeWishCard(wish){
    const c=countsFor(wish.id),article=document.createElement('article');article.className='wish-item';article.tabIndex=0;article.setAttribute('role','button');
    const head=document.createElement('div');head.className='wish-item-head';
    const name=document.createElement('p');name.className='wish-item-name';name.textContent=wish.name;
    const score=document.createElement('span');score.className='wish-score';score.textContent=`✦ ${scoreFor(wish.id)}`;head.append(name,score);
    const msg=document.createElement('p');msg.className='wish-item-message';msg.textContent=wish.message;
    const foot=document.createElement('div');foot.className='wish-item-foot';
    const time=document.createElement('span');time.textContent=fmt.format(new Date(wish.created_at));
    const mini=document.createElement('span');mini.className='wish-mini-reactions';mini.innerHTML=`<span>♥ ${c.heart}</span><span>✦ ${c.star}</span><span>☾ ${c.moon}</span>`;
    foot.append(time,mini);article.append(head,msg,foot);
    const open=()=>openWish(wish);article.addEventListener('click',open);article.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
    return article;
  }

  function renderWishGrid(){
    const list=$('#wish-list'),empty=$('#empty-wishes');list.querySelectorAll('.wish-item').forEach(n=>n.remove());
    const wishes=filteredWishes();
    empty.hidden=!!wishes.length;
    wishes.slice(0,30).forEach(w=>list.append(makeWishCard(w)));
    $('#visible-wishes').textContent=`${Math.min(wishes.length,30)} đang hiển thị`;
    renderTrending();
  }

  function renderTrending(){
    const host=$('#trending-list');
    const top=[...currentWishes].sort((a,b)=>scoreFor(b.id)-scoreFor(a.id)).slice(0,3);
    host.replaceChildren();
    if(!top.length){host.textContent='Chưa có dữ liệu.';return}
    top.forEach((w,i)=>{
      const row=document.createElement('button');row.type='button';row.className='trend-row';
      const rank=document.createElement('span');rank.className='trend-rank';rank.textContent=String(i+1).padStart(2,'0');
      const info=document.createElement('span');const b=document.createElement('b');b.textContent=w.name;const small=document.createElement('small');small.textContent=w.message.slice(0,44)+(w.message.length>44?'…':'');info.append(b,small);
      const score=document.createElement('span');score.className='trend-score';score.textContent=`✦ ${scoreFor(w.id)}`;row.append(rank,info,score);row.addEventListener('click',()=>openWish(w));host.append(row);
    });
  }

  function updateStats(){
    $('#total-wishes').textContent=String(totalWishCount);
    $('#today-wishes').textContent=String(todayWishCount);
    $('#total-reactions').textContent=String(totalReactionCount);
    $('#hero-wish-count').textContent=String(totalWishCount);
    $('#hero-today-count').textContent=String(todayWishCount);
    $('#hero-reaction-count').textContent=String(totalReactionCount);
  }

  function openWish(wish){
    activeDialogWish=wish;const c=countsFor(wish.id);
    $('#wish-dialog-name').textContent=wish.name;
    $('#wish-dialog-message').textContent='“'+wish.message+'”';
    $('#wish-dialog-time').textContent=fmt.format(new Date(wish.created_at));
    const map={heart:c.heart,star:c.star,moon:c.moon};
    $$('#reaction-bar [data-reaction]').forEach(b=>{
      $('span',b).textContent=String(map[b.dataset.reaction]||0);
      b.classList.toggle('done',reactionRows.some(r=>String(r.wish_id)===String(wish.id)&&r.client_id===clientId&&r.reaction===b.dataset.reaction));
    });
    if (!$('#wish-dialog').open) $('#wish-dialog').showModal();
  }

  async function addReaction(type){
    if(!activeDialogWish||!supabaseClient)return;
    if(!['heart','star','moon'].includes(type))return;
    const exists=reactionRows.some(r=>String(r.wish_id)===String(activeDialogWish.id)&&r.client_id===clientId&&r.reaction===type);
    if(exists)return toast('Reaction này đã được thả rồi.');
    const {data,error}=await supabaseClient.from('wish_reactions').insert({wish_id:activeDialogWish.id,client_id:clientId,reaction:type}).select('id,wish_id,client_id,reaction,created_at').single();
    if(error){
      if(error.code==='23505')return toast('Reaction này đã được thả rồi.');
      console.error(error);return toast('Chưa gửi được reaction.');
    }
    if(data&&!reactionRows.some(r=>String(r.id)===String(data.id))){reactionRows.push(data);totalReactionCount++;updateStats();renderWishGrid();openWish(activeDialogWish)}
    burst(cw*.5,ch*.46,25);
  }
  $$('#reaction-bar [data-reaction]').forEach(b=>b.addEventListener('click',()=>addReaction(b.dataset.reaction)));

  async function loadData({quiet=false}={}){
    if(!supabaseClient)return;
    if(!quiet)setDbState('Đang đồng bộ','Wishes + reactions',false);
    const since=startToday().toISOString();
    const [wishRes,wishCountRes,todayRes,reactionRes,reactionCountRes]=await Promise.all([
      supabaseClient.from('wishes').select('id,name,message,created_at').order('created_at',{ascending:false}).limit(100),
      supabaseClient.from('wishes').select('id',{count:'exact',head:true}),
      supabaseClient.from('wishes').select('id',{count:'exact',head:true}).gte('created_at',since),
      supabaseClient.from('wish_reactions').select('id,wish_id,client_id,reaction,created_at').order('created_at',{ascending:false}).limit(2000),
      supabaseClient.from('wish_reactions').select('id',{count:'exact',head:true})
    ]);
    if(wishRes.error||reactionRes.error){console.error(wishRes.error||reactionRes.error);setDbState('Mất kết nối','Thử làm mới',false);return}
    currentWishes=(wishRes.data||[]).map(w=>({id:w.id,name:cleanText(w.name,40),message:cleanText(w.message,180),created_at:w.created_at}));
    reactionRows=reactionRes.data||[];
    totalWishCount=wishCountRes.count??currentWishes.length;
    todayWishCount=todayRes.count??currentWishes.filter(w=>isToday(w.created_at)).length;
    totalReactionCount=reactionCountRes.count??reactionRows.length;
    renderLanterns();renderWishGrid();updateStats();setDbState('Realtime online',`${totalWishCount} wishes · ${totalReactionCount} reactions`,true);
  }

  function subscribeRealtime(){
    if(!supabaseClient)return;
    wishChannel?.unsubscribe?.();reactionChannel?.unsubscribe?.();
    wishChannel=supabaseClient.channel('v3-wishes').on('postgres_changes',{event:'INSERT',schema:'public',table:'wishes'},p=>{
      const r=p.new||{},wish={id:r.id,name:cleanText(r.name,40),message:cleanText(r.message,180),created_at:r.created_at};
      if(!wish.name||!wish.message||currentWishes.some(w=>String(w.id)===String(wish.id)))return;
      currentWishes.unshift(wish);currentWishes=currentWishes.slice(0,100);totalWishCount++;if(isToday(wish.created_at))todayWishCount++;
      renderLanterns();renderWishGrid();updateStats();toast(`${wish.name} vừa thả một chiếc đèn.`);
    }).subscribe();
    reactionChannel=supabaseClient.channel('v3-reactions').on('postgres_changes',{event:'INSERT',schema:'public',table:'wish_reactions'},p=>{
      const r=p.new||{};if(!r.id||reactionRows.some(x=>String(x.id)===String(r.id)))return;
      reactionRows.unshift(r);totalReactionCount++;renderWishGrid();updateStats();
      if(activeDialogWish&&String(activeDialogWish.id)===String(r.wish_id))openWish(activeDialogWish);
    }).subscribe();
  }

  $('#wish-form').addEventListener('submit',async e=>{
    e.preventDefault();const name=cleanText(wishName.value,40),message=cleanText(wishMessage.value,180);
    if(!name||!message)return;
    if(!supabaseClient)return toast('Database chưa sẵn sàng.');
    const last=Number(sessionStorage.getItem('trang-last-wish')||0);if(Date.now()-last<7000)return toast('Đợi vài giây rồi thả tiếp.');
    wishSubmit.disabled=true;wishSubmit.firstChild.textContent='Đang thả… ';
    const {data,error}=await supabaseClient.from('wishes').insert({name,message}).select('id,name,message,created_at').single();
    wishSubmit.disabled=false;wishSubmit.firstChild.textContent='Thả lên trời ';
    if(error){console.error(error);$('#wish-status').textContent='Chưa gửi được. Thử lại nhé.';return}
    sessionStorage.setItem('trang-last-wish',String(Date.now()));try{localStorage.setItem('trang-wish-name',name)}catch{}
    $('#wish-status').textContent='Đã thả lên bầu trời.';wishMessage.value='';updateWishCount();
    if(data&&!currentWishes.some(w=>String(w.id)===String(data.id))){currentWishes.unshift(data);totalWishCount++;if(isToday(data.created_at))todayWishCount++;renderLanterns();renderWishGrid();updateStats()}
    burst(cw*.45,ch*.4,70);
  });

  $('#wish-search').addEventListener('input',renderWishGrid);
  $$('[data-filter]').forEach(b=>b.addEventListener('click',()=>{activeFilter=b.dataset.filter;$$('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderWishGrid()}));
  function openRandom(){
    if(!currentWishes.length)return toast('Chưa có điều ước nào.');
    openWish(currentWishes[Math.floor(Math.random()*currentWishes.length)]);
  }
  $('#random-wish').addEventListener('click',openRandom);$('#random-hero').addEventListener('click',openRandom);$('#refresh-wishes').addEventListener('click',()=>loadData());

  // Lucky moon.
  const fortunes=[
    ['Đèn xanh','Một việc đang chậm sẽ bắt đầu chạy đúng hướng.'],
    ['Trăng sáng','Có tin vui nhỏ đến từ công việc hoặc học tập.'],
    ['Gió thuận','Thử làm điều bạn đã trì hoãn trong tuần này.'],
    ['Sao gần','Một cuộc nói chuyện thẳng thắn sẽ giải quyết được nhiều thứ.'],
    ['Trăng tròn','Tập trung vào một mục tiêu thay vì chia sức cho quá nhiều việc.'],
    ['Đèn đỏ','Đừng vội quyết khi đang nóng; để qua một đêm rồi chọn.'],
    ['Mây tan','Một vấn đề tưởng khó sẽ đơn giản hơn khi bạn bắt tay vào làm.']
  ];
  $('#draw-fortune').addEventListener('click',()=>{
    const [title,text]=fortunes[Math.floor(Math.random()*fortunes.length)];
    $('#fortune-orb').animate([{transform:'scale(.8) rotate(-20deg)',opacity:.45},{transform:'scale(1.12) rotate(8deg)'},{transform:'scale(1) rotate(0)'}],{duration:650,easing:'cubic-bezier(.2,.8,.2,1)'});
    $('#fortune-title').textContent=title;$('#fortune-text').textContent=text;
  });

  // Rabbit game.
  const arena=$('#game-arena'),rabbit=$('#moon-rabbit'),overlay=$('#game-overlay');
  let gameActive=false,gameScore=0,gameTime=15,gameTimer=null;
  function moveRabbit(){
    const pad=20,maxX=Math.max(pad,arena.clientWidth-rabbit.offsetWidth-pad),maxY=Math.max(pad,arena.clientHeight-rabbit.offsetHeight-pad);
    rabbit.style.left=(pad+Math.random()*(maxX-pad))+'px';rabbit.style.top=(pad+Math.random()*(maxY-pad))+'px';
  }
  function stopGame(){
    gameActive=false;clearInterval(gameTimer);rabbit.style.display='none';overlay.hidden=false;
    $('.game-icon',overlay).textContent=gameScore>=12?'🏆':'☾';
    $('h3',overlay).textContent=`${gameScore} điểm`;
    $('p',overlay).textContent=gameScore>=12?'Phản xạ rất nhanh.':'Chơi lại để phá điểm.';
    $('#start-game').textContent='Chơi lại';
  }
  $('#start-game').addEventListener('click',()=>{
    gameActive=true;gameScore=0;gameTime=15;$('#game-score').textContent='0';$('#game-time').textContent='15';overlay.hidden=true;rabbit.style.display='block';moveRabbit();
    clearInterval(gameTimer);gameTimer=setInterval(()=>{gameTime--;$('#game-time').textContent=String(gameTime);if(gameTime<=0)stopGame()},1000);
  });
  rabbit.addEventListener('click',()=>{if(!gameActive)return;gameScore++;$('#game-score').textContent=String(gameScore);moveRabbit();if(gameScore%5===0)burst(cw*.5,ch*.55,18)});

  // Greeting cards.
  function validCard(card){if(!card||typeof card!=='object')throw new Error('Thiệp không hợp lệ.');const out={};for(const [k,max] of [['to',50],['message',400],['from',50]]){out[k]=cleanText(card[k],max);if(!out[k])throw new Error('Điền đủ thông tin.')}return out}
  function showCard(card){$('#preview-to').textContent=`Gửi ${card.to},`;$('#preview-message').textContent=card.message;$('#preview-from').textContent=card.from+'.'}
  function cardLink(card){const bytes=new TextEncoder().encode(JSON.stringify(card));let bin='';bytes.forEach(b=>bin+=String.fromCharCode(b));const u=new URL(location.href);u.hash='card='+btoa(bin).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');return u.href}
  $('#open-letter').addEventListener('click',()=>$('#letter-dialog').showModal());
  $('#letter-form').addEventListener('submit',e=>{e.preventDefault();try{const c=validCard({to:$('#recipient').value,message:$('#greeting').value,from:$('#sender').value});showCard(c);$('#share-link').value=cardLink(c);$('#share-result').hidden=false;$('#share-link').select()}catch(err){toast(err.message)}});
  async function copyLink(){try{await navigator.clipboard.writeText($('#share-link').value);toast('Đã sao chép link.')}catch{$('#share-link').select();toast('Nhấn Ctrl+C để sao chép.')}}
  $('#copy-link').addEventListener('click',copyLink);
  $('#share-native').addEventListener('click',async()=>{if(navigator.share){try{await navigator.share({title:'TRĂNG — lời chúc Trung thu',url:$('#share-link').value})}catch(err){if(err.name!=='AbortError')copyLink()}}else copyLink()});
  function readCard(){if(!location.hash.startsWith('#card='))return;try{let s=location.hash.slice(6).replaceAll('-','+').replaceAll('_','/');while(s.length%4)s+='=';const bytes=Uint8Array.from(atob(s),c=>c.charCodeAt(0));const c=validCard(JSON.parse(new TextDecoder().decode(bytes)));showCard(c);$('#received-to').textContent=`Gửi ${c.to},`;$('#received-message').textContent=c.message;$('#received-from').textContent=c.from;$('#received-dialog').showModal()}catch{toast('Link thiệp không hợp lệ.')}}
  readCard();addEventListener('hashchange',readCard);

  // Ambient sound.
  let audio=null,master=null,musicOn=false,musicTimer=null,nextNote=0,noteIndex=0;
  const melody=[0,2,4,7,9,7,4,2,0,4,7,12,9,7,4,2];
  function note(freq,start,dur,vol){const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.0001,start);g.gain.exponentialRampToValueAtTime(vol,start+.04);g.gain.exponentialRampToValueAtTime(.0001,start+dur);o.connect(g);g.connect(master);o.start(start);o.stop(start+dur+.1)}
  function schedule(){if(!musicOn||!audio||audio.state!=='running')return;while(nextNote<audio.currentTime+.5){const i=noteIndex++%melody.length;note(261.63*Math.pow(2,melody[i]/12),nextNote,2,.15);if(i%4===0)note(130.8,nextNote,3,.06);nextNote+=.72}}
  $('#sound').addEventListener('click',async()=>{try{if(!audio){const A=window.AudioContext||window.webkitAudioContext;if(!A)throw new Error();audio=new A();master=audio.createGain();master.gain.value=.26;master.connect(audio.destination)}if(musicOn){musicOn=false;clearInterval(musicTimer);await audio.suspend()}else{await audio.resume();musicOn=true;nextNote=audio.currentTime+.06;schedule();musicTimer=setInterval(schedule,220)}$('#sound').setAttribute('aria-pressed',String(musicOn));$('#sound-label').textContent=musicOn?'Tắt':'Nhạc'}catch{toast('Trình duyệt chưa cho phát âm thanh.')}});

  async function initDatabase(){
    const cfg=window.TRANG_SUPABASE||{};
    if(!window.supabase?.createClient||!cfg.url||!cfg.key||String(cfg.url).includes('YOUR_')){setDbState('Chưa có database','Supabase config',false);return}
    supabaseClient=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    await loadData({quiet:true});subscribeRealtime();
  }

  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;if(audio&&musicOn)audio.suspend().catch(()=>{})}else{last=0;startSky();if(audio&&musicOn)audio.resume().catch(()=>{})}});
  addEventListener('pagehide',()=>{wishChannel?.unsubscribe?.();reactionChannel?.unsubscribe?.()});

  initDatabase();
})();