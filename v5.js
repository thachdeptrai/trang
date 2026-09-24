'use strict';
(() => {
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const app=window.TRANG, motion=matchMedia('(prefers-reduced-motion: reduce)');
  const store={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);return true;}catch{return false;}},remove(k){try{localStorage.removeItem(k);}catch{}}};
  const TOKEN_KEY='trang-v5-guest-key', DRAFT_KEY='trang-v5-draft';
  let token=store.get(TOKEN_KEY), memoryOnly=false;
  if(!/^[a-f0-9]{64}$/.test(token||'')){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');memoryOnly=!store.set(TOKEN_KEY,token);}
  let profile=null, initPromise=null, activeWish=null, requestId=null, requestBody='', ready=false;
  const errorText=e=>e?.message||'Kết nối gián đoạn. Hãy thử lại nhé.';
  async function rpc(action,data={}) {
    const client=app.client();if(!client)throw Error('Đang kết nối bầu trời. Thử lại sau ít giây.');
    const result=await client.rpc('trang_v5',{p_token:token,p_action:action,p_data:data});
    if(result.error)throw result.error;return result.data;
  }
  async function ensureProfile(){
    if(ready)return profile;
    if(!initPromise)initPromise=rpc('hello').then(p=>{profile=p;ready=true;renderProfile();if(memoryOnly)$('#profile-status').textContent='Trình duyệt chưa cho lưu mã khách. Hãy giữ mã khôi phục trước khi đóng trang.';return p;}).catch(e=>{initPromise=null;throw e;});
    return initPromise;
  }
  async function me(){await ensureProfile();profile=await rpc('me');renderProfile();return profile;}
  function status(id,message){$(id).textContent=message;}
  async function busy(button,task,target){if(button.disabled)return;button.disabled=true;try{await task();}catch(e){status(target,errorText(e));}finally{button.disabled=false;}}
  function goTab(name){$$('[data-my-tab]').forEach(b=>{const selected=b.dataset.myTab===name;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;$('#my-'+b.dataset.myTab).hidden=!selected;});}
  $$('[data-my-tab]').forEach((b,i,all)=>{b.addEventListener('click',()=>goTab(b.dataset.myTab));b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?all.length-1:(i+(e.key==='ArrowRight'?1:-1)+all.length)%all.length;all[n].focus();goTab(all[n].dataset.myTab);});});
  $$('#game-result a[href="#my-moon"]').forEach(a=>a.addEventListener('click',()=>goTab('collection')));
  const items=[{id:'plain',name:'Ánh trăng nguyên bản',cost:0,desc:'Chiếc đèn đầu tiên, luôn có sẵn.'},{id:'stardust',name:'Bụi sao',cost:20,desc:'Viền sao vàng ôm lấy chiếc đèn.'},{id:'aurora',name:'Cực quang',cost:40,desc:'Sắc ngọc và tím của trời phương Bắc.'},{id:'royal',name:'Kim nguyệt',cost:60,desc:'Viền vàng kép và quầng sáng ấm.'}];
  function empty(host,text,link){host.replaceChildren();const box=document.createElement('div');box.className='empty-v5';box.textContent=text;if(link){const a=document.createElement('a');a.href=link;a.textContent=' Khám phá bầu trời →';box.append(a);}host.append(box);}
  function renderProfile(){
    if(!profile)return;
    $('#profile-name').textContent=profile.name;$('#profile-points').textContent=profile.points;$('#moon-points').textContent=profile.points;$('#profile-owned').textContent=profile.owned.length;
    $('#profile-lantern').dataset.effect=profile.equipped;
    for(const kind of ['owned','saved']){const host=$('#my-'+kind),rows=profile[kind];if(!rows.length){empty(host,kind==='owned'?'Các đèn bạn thả từ V5 sẽ hiện tại đây. Đèn cũ vẫn ở bầu trời chung.':'Bạn chưa lưu chiếc đèn nào.','#living-sky');continue;}host.replaceChildren(...rows.map(app.makeFeedCard));}
    const collection=$('#collection-grid');collection.replaceChildren();
    for(const item of items){const owned=item.cost===0||profile.inventory.includes(item.id),box=document.createElement('article');box.className='collection-item';const art=document.createElement('div');art.className='profile-lantern';art.dataset.effect=item.id;art.textContent='🏮';art.setAttribute('aria-hidden','true');const title=document.createElement('h3');title.textContent=item.name;const desc=document.createElement('p');desc.textContent=item.desc;const button=document.createElement('button');button.className='button '+(owned?'glass':'primary');button.type='button';button.textContent=profile.equipped===item.id?'Đang sử dụng':owned?'Sử dụng':`Đổi ${item.cost} điểm`;button.disabled=profile.equipped===item.id;button.addEventListener('click',()=>busy(button,async()=>{status('#profile-status','');await rpc(owned?'equip':'buy',{item:item.id});await me();status('#profile-status',owned?'Đã đổi trang trí cho góc trăng.':'Đã nhận vật phẩm. Bấm Sử dụng để trang trí nhé.');},'#profile-status'));box.append(art,title,desc,button);collection.append(box);}
    const ledger=$('#my-ledger');ledger.replaceChildren();if(!profile.ledger.length)empty(ledger,'Chơi một ván Gom sao để bắt đầu tích điểm.');
    for(const row of profile.ledger){const box=document.createElement('div');box.className='ledger-row';const label=document.createElement('div');label.textContent=row.reason==='game'?'Gom sao đêm rằm':'Đổi đồ trang trí';const date=document.createElement('small');date.textContent=new Date(row.created_at).toLocaleString('vi-VN');label.append(date);const value=document.createElement('strong');value.textContent=(row.delta>0?'+':'')+row.delta+' điểm';box.append(label,value);ledger.append(box);}
    if(activeWish)$('#wish-save').textContent=profile.saved.some(w=>String(w.id)===String(activeWish.id))?'Bỏ lưu chiếc đèn':'Lưu vào góc trăng';
  }
  $('#refresh-me').addEventListener('click',()=>busy($('#refresh-me'),async()=>{await me();status('#profile-status','Đã đồng bộ góc trăng.');},'#profile-status'));

  // Drafts are device-local; published wishes and ownership live in Postgres.
  let draftTimer;
  try{const draft=JSON.parse(store.get(DRAFT_KEY)||'null');if(draft&&typeof draft.message==='string'){app.restoreDraft(draft);status('#draft-status','Đã khôi phục bản nháp trên thiết bị này.');}}catch{}
  function saveDraft(){const d=app.draft();if(!d.name&&!d.message){store.remove(DRAFT_KEY);status('#draft-status','');return;}const ok=store.set(DRAFT_KEY,JSON.stringify(d));status('#draft-status',ok?'Bản nháp đã lưu trên thiết bị.':'Trình duyệt không cho lưu bản nháp.');}
  $('#wish-form').addEventListener('input',()=>{clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,250);});
  $('#wish-form').addEventListener('click',e=>{if(e.target.closest('[data-category],[data-color],[data-style]')){clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,50);}});
  addEventListener('pagehide',()=>{clearTimeout(draftTimer);saveDraft();});
  window.TRANG_V5={
    async createWish(d){await ensureProfile();const body=JSON.stringify(d);if(body!==requestBody){requestId=crypto.randomUUID();requestBody=body;}const row=await rpc('wish',{...d,request_id:requestId});requestBody='';requestId=null;me().catch(()=>{});return row;},
    clearDraft(){clearTimeout(draftTimer);store.remove(DRAFT_KEY);status('#draft-status','Đèn đã lưu trên database.');}
  };
  function wishUrl(id){const url=new URL(location.href);url.hash='wish='+id;return url.href;}
  async function copy(text,input,success='Đã sao chép.'){try{await navigator.clipboard.writeText(text);app.toast(success);}catch{input.hidden=false;if(input.type==='password')input.type='text';input.value=text;input.focus();input.select();app.toast('Chọn Sao chép trên điện thoại hoặc nhấn Ctrl+C.');}}
  document.addEventListener('trang:panel',e=>{activeWish=e.detail;$('#wish-url').value=wishUrl(activeWish.id);$('#wish-url').hidden=true;if(profile)$('#wish-save').textContent=profile.saved.some(w=>String(w.id)===String(activeWish.id))?'Bỏ lưu chiếc đèn':'Lưu vào góc trăng';});
  $('#wish-link').addEventListener('click',()=>{if(activeWish)copy(wishUrl(activeWish.id),$('#wish-url'),'Đã sao chép link chiếc đèn.');});
  $('#wish-save').addEventListener('click',async()=>{const row=activeWish;if(!row)return;const b=$('#wish-save');b.disabled=true;try{await ensureProfile();const saved=!profile.saved.some(w=>String(w.id)===String(row.id));await rpc('save',{id:row.id,saved});await me();app.toast(saved?'Đã lưu vào góc trăng.':'Đã bỏ lưu chiếc đèn.');}catch(e){app.toast(errorText(e));}finally{b.disabled=false;}});
  let lastWishHash='';
  async function readRoute(){
    const h=location.hash;
    if(/^#wish=\d{1,18}$/.test(h)&&h!==lastWishHash&&app.client()){lastWishHash=h;const r=await app.client().from('wish_feed').select('*').eq('id',h.slice(6)).maybeSingle();if(r.error||!r.data){lastWishHash='';app.toast('Không tìm thấy chiếc đèn này.');}else app.openWish(r.data);}
    if(/^#room=[A-Fa-f0-9]{8}$/.test(h)){$('#room-code').value=h.slice(6).toUpperCase();$('#friends').scrollIntoView({behavior:motion.matches?'instant':'smooth'});status('#room-status','Lời mời đã sẵn sàng. Điền tên rồi bấm Vào cùng bạn bè.');}
  }
  addEventListener('hashchange',()=>{if(!location.hash.startsWith('#wish='))lastWishHash='';readRoute().catch(()=>{});});
  // Restore explicitly, never expose guest credentials in URLs or public content.
  $('#open-recovery').addEventListener('click',()=>{$('#recovery-code').value=token;$('#recovery-code').type='password';$('#recovery-dialog').showModal();});
  $('#copy-recovery').addEventListener('click',()=>copy(token,$('#recovery-code'),'Đã sao chép mã riêng. Hãy cất ở nơi an toàn.'));
  $('#restore-profile-form').addEventListener('submit',e=>{e.preventDefault();busy(e.submitter,async()=>{if(roomCode||gameRun||pendingResult)throw Error('Hãy rời phòng và hoàn tất ván chơi trước khi đổi góc trăng.');const next=$('#restore-code').value.trim();if(!/^[a-f0-9]{64}$/.test(next))throw Error('Mã khách cần đủ 64 ký tự.');const client=app.client();if(!client)throw Error('Chưa kết nối database.');const r=await client.rpc('trang_v5',{p_token:next,p_action:'me',p_data:{}});if(r.error)throw r.error;token=next;memoryOnly=!store.set(TOKEN_KEY,token);profile=r.data;ready=true;renderProfile();$('#restore-code').value='';$('#recovery-code').value=token;status('#recovery-status',memoryOnly?'Đã mở, nhưng trình duyệt không lưu được mã.':'Đã mở đúng góc trăng của bạn.');},'#recovery-status');});

  // Friend rooms use one authoritative server launch timestamp; polling recovers missed tabs/events.
  let roomCode=null,roomData=null,roomTimer=null,roomBusy=false,clockOffset=0,playedRound=-1,roomVersion=0;
  function roomLink(){const u=new URL(location.href);u.hash='room='+roomCode;return u.href;}
  function setRoom(code){roomVersion++;roomCode=code;playedRound=-1;roomData=null;$('#room-entry').hidden=true;$('#room-live').hidden=false;clearInterval(roomTimer);roomTimer=setInterval(()=>pollRoom(),2500);store.set('trang-v5-room',code);}
  function clearRoom(){roomVersion++;roomCode=null;roomData=null;clearInterval(roomTimer);store.remove('trang-v5-room');$('#room-entry').hidden=false;$('#room-live').hidden=true;$('#room-lanterns').replaceChildren();}
  function renderRoom(r){roomData=r;$('#current-room-title').textContent=r.title;$('#current-room-code').textContent=r.code;$('#launch-room').hidden=!r.is_host;$('#room-link').value=roomLink();const ul=$('#room-members');ul.replaceChildren();for(const m of r.members){const li=document.createElement('li'),name=document.createElement('span'),state=document.createElement('small');name.textContent=m.name+(profile&&m.id===profile.id?' (bạn)':'');state.textContent=!m.online?'Vắng mặt':m.ready?'Sẵn sàng ✓':'Đang chuẩn bị';li.append(name,state);ul.append(li);}const mine=r.members.find(m=>m.id===profile?.id);$('#ready-room-form button').textContent=mine?.ready?'Cập nhật đèn đã sẵn sàng ✓':'Tôi đã sẵn sàng ✓';tickRoom();}
  async function pollRoom(){if(!roomCode||roomBusy||document.hidden)return;const code=roomCode,version=roomVersion;roomBusy=true;const start=Date.now();try{const r=await rpc('room',{code});if(version!==roomVersion)return;clockOffset=Date.parse(r.server_time)-(start+Date.now())/2;renderRoom(r);status('#room-status','Đang đồng bộ phòng · '+r.members.filter(m=>m.online).length+' người online');}catch(e){if(version===roomVersion)status('#room-status',errorText(e)+' Bạn có thể rời phòng để mở phòng khác.');}finally{roomBusy=false;}}
  function roomPayload(){return{code:roomCode,message:$('#room-wish').value.trim(),color:$('#room-color').value,style:'classic',ready:true};}
  function flyTogether(r){$('#room-lanterns').replaceChildren();const rows=r.lanterns||[];for(let i=0;i<rows.length;i++){const row=rows[i],b=document.createElement('button');b.type='button';b.className=`room-flying color-${row.color} style-${row.style}`;b.style.left=(5+i*80/Math.max(1,rows.length-1))+'%';b.style.animationDelay=(i*.08)+'s';const shell=document.createElement('span');shell.className='lantern-shell';shell.setAttribute('aria-hidden','true');const name=document.createElement('small');name.textContent=row.name;b.append(shell,name);b.setAttribute('aria-label','Đọc điều ước của '+row.name);b.addEventListener('click',()=>{const d=$('#received-dialog');$('#received-to').textContent=row.name;$('#received-message').textContent=row.message;$('#received-from').textContent='Đêm hội '+r.title;if(!d.open)d.showModal();});$('#room-lanterns').append(b);}if(!motion.matches){app.burst(innerWidth*.3,innerHeight*.35,60);setTimeout(()=>app.burst(innerWidth*.7,innerHeight*.3,60),500);} }
  function tickRoom(){if(!roomData)return;const time=roomData.launch_at?Date.parse(roomData.launch_at):0,left=Math.ceil((time-Date.now()-clockOffset)/1000),pending=left>0;$('#launch-room').disabled=pending;$$('#ready-room-form input,#ready-room-form textarea,#ready-room-form select,#ready-room-form button').forEach(e=>e.disabled=pending);if(pending){$('#room-countdown').textContent=left;$('#room-subtitle').textContent='Sẵn sàng… cả hội cùng thả đèn';}else if(time){$('#room-countdown').textContent='Đèn đã lên trời';$('#room-subtitle').textContent='Chạm vào một chiếc đèn để đọc điều ước.';if(playedRound!==roomData.round){playedRound=roomData.round;flyTogether(roomData);}}else{$('#room-countdown').textContent='Cùng chuẩn bị đèn';$('#room-subtitle').textContent='Sẵn sàng khi bạn đã viết xong điều ước.';}}
  setInterval(()=>{if(!document.hidden)tickRoom();},200);
  $('#create-room-form').addEventListener('submit',e=>{e.preventDefault();busy(e.submitter,async()=>{await ensureProfile();const r=await rpc('create_room',{name:$('#room-host-name').value.trim(),title:$('#room-title').value.trim()});setRoom(r.code);await pollRoom();},'#room-status');});
  $('#join-room-form').addEventListener('submit',e=>{e.preventDefault();busy(e.submitter,async()=>{await ensureProfile();const code=$('#room-code').value.trim().toUpperCase();const r=await rpc('join_room',{code,name:$('#room-guest-name').value.trim()});setRoom(code);clockOffset=Date.parse(r.server_time)-Date.now();renderRoom(r);await pollRoom();},'#room-status');});
  $('#ready-room-form').addEventListener('submit',e=>{e.preventDefault();busy(e.submitter,async()=>{renderRoom(await rpc('ready',roomPayload()));status('#room-status','Đèn của bạn đã sẵn sàng.');},'#room-status');});
  $('#launch-room').addEventListener('click',()=>busy($('#launch-room'),async()=>{const r=await rpc('launch',{code:roomCode});clockOffset=Date.parse(r.server_time)-Date.now();renderRoom(r);},'#room-status'));
  $('#invite-room').addEventListener('click',()=>copy(roomLink(),$('#room-link'),'Đã sao chép lời mời vào phòng.'));
  $('#leave-room').addEventListener('click',()=>busy($('#leave-room'),async()=>{try{await rpc('leave_room',{code:roomCode});}catch(e){if(!/hết 24 giờ|không tồn tại/.test(errorText(e)))throw e;}clearRoom();status('#room-status','Đã rời phòng.');},'#room-status'));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollRoom();});addEventListener('online',()=>{pollRoom();me().catch(()=>{});});

  // One session, one receipt. Client hits are bounded; casual points are capped server-side.
  let gameRun=null,gameBegin=0,gameTimer=0,gameIndex=-1,gameHits=new Set(),pendingResult=null;
  function targetCell(seed,i){let v=(seed+i*7919)>>>0;v^=v<<13;v^=v>>>17;v^=v<<5;return(v>>>0)%12;}
  async function startGame(){if(gameRun||pendingResult)return;await ensureProfile();status('#game-status','');const run=await rpc('game_start');gameRun=run;gameBegin=performance.now();gameIndex=-1;gameHits=new Set();pendingResult=null;$('#game-intro').hidden=true;$('#game-result').hidden=true;$('#game-target').hidden=false;$('#game-score').textContent='0';$('#game-target').focus();gameTimer=setInterval(tickGame,50);tickGame();}
  function tickGame(){if(!gameRun)return;const elapsed=(performance.now()-gameBegin)/1000,index=Math.floor(elapsed);$('#game-time').textContent=Math.max(0,Math.ceil(24-elapsed));if(index>=24){finishGame();return;}if(index!==gameIndex){gameIndex=index;const cell=targetCell(gameRun.seed,index);$('#game-target').style.left=(14+(cell%4)*24)+'%';$('#game-target').style.top=(27+Math.floor(cell/4)*27)+'%';$('#game-target').setAttribute('aria-disabled','false');$('#game-target').textContent='✦';} }
  $('#game-target').addEventListener('click',()=>{if(!gameRun||gameIndex<0||gameIndex>23||gameHits.has(gameIndex)||(performance.now()-gameBegin)>=24000)return;gameHits.add(gameIndex);$('#game-score').textContent=gameHits.size;$('#game-target').setAttribute('aria-disabled','true');$('#game-target').textContent='✓';});
  let settlingGame=false;
  async function settleGame(){if(!pendingResult||settlingGame)return;settlingGame=true;$('#game-retry').hidden=true;$('#game-again').disabled=true;try{const result=await rpc('game_finish',pendingResult);pendingResult=null;store.remove('trang-v5-pending-game');$('#game-result-title').textContent=`Bạn gom được ${result.score} ngôi sao!`;$('#game-result-text').textContent=result.awarded?`+${result.awarded} Moon Points đã lưu. Mở bộ sưu tập để chọn đồ nhé.`:result.score?'Đã lưu kết quả. Bạn đã đạt giới hạn 100 điểm hôm nay.':'Chưa bắt được sao lần này. Thử một ván nữa nhé!';await me();}catch(e){const expired=/Thời gian ván chơi không hợp lệ|Ván chơi không thuộc về bạn/.test(errorText(e));$('#game-result-title').textContent=expired?'Ván chơi đã hết hạn':'Kết quả đang chờ lưu';$('#game-result-text').textContent=expired?'Kết quả chưa được cộng điểm. Bạn có thể bắt đầu ván mới.':errorText(e);if(expired){pendingResult=null;store.remove('trang-v5-pending-game');}$('#game-retry').hidden=expired;}finally{settlingGame=false;$('#game-again').disabled=!!pendingResult;}}
  function finishGame(){if(!gameRun)return;clearInterval(gameTimer);pendingResult={id:gameRun.id,hits:[...gameHits]};store.set('trang-v5-pending-game',JSON.stringify(pendingResult));gameRun=null;$('#game-target').hidden=true;$('#game-result').hidden=false;$('#game-result-title').focus();$('#game-result-title').textContent='Đang lưu kết quả…';settleGame();}
  $('#game-start').addEventListener('click',()=>busy($('#game-start'),startGame,'#game-status'));
  $('#game-again').addEventListener('click',()=>busy($('#game-again'),startGame,'#game-status'));
  $('#game-retry').addEventListener('click',()=>busy($('#game-retry'),settleGame,'#game-status'));

  // Self-hosted fonts and same-origin background keep the export canvas untainted.
  async function exportCard(){
    status('#export-status','Đang tạo thiệp ảnh…');
    const card=app.card(),story=$('#card-format').value==='story',w=1080,h=story?1920:1080;
    await document.fonts.load('40px "Be Vietnam Pro"');await document.fonts.load('500 60px "Noto Serif Display"');await document.fonts.ready;
    const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');if(!ctx)throw Error('Trình duyệt chưa hỗ trợ xuất ảnh.');
    const img=new Image();img.src='assets/moon-festival.webp';await img.decode();
    const scale=Math.max(w/img.width,h/img.height);ctx.drawImage(img,(w-img.width*scale)/2,0,img.width*scale,img.height*scale);
    const shade=ctx.createLinearGradient(0,0,0,h);shade.addColorStop(0,'rgba(2,15,23,.55)');shade.addColorStop(.35,'rgba(2,15,23,.88)');shade.addColorStop(1,'rgba(2,15,23,.94)');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#efc77388';ctx.lineWidth=2;ctx.strokeRect(42,42,w-84,h-84);ctx.fillStyle='#efc773';ctx.font='500 34px "Be Vietnam Pro"';ctx.fillText('TRĂNG  /  TẾT ĐOÀN VIÊN',85,130);
    function lines(text,font,max){ctx.font=font;const out=[];for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/)){if(ctx.measureText(word).width>max){if(line){out.push(line);line='';}for(const char of word){if(ctx.measureText(line+char).width>max){out.push(line);line='';}line+=char;}}else if(ctx.measureText(line+(line?' ':'')+word).width>max){out.push(line);line=word;}else line+=(line?' ':'')+word;}out.push(line);}return out;}
    const to=lines('Gửi '+card.to+',','500 52px "Noto Serif Display"',900),from=lines('Thương mến, '+card.from,'400 28px "Be Vietnam Pro"',900);let size=story?46:38,msgLines;
    do{msgLines=lines(card.message,`400 ${size}px "Be Vietnam Pro"`,900);if(msgLines.length*size*1.65+to.length*72+from.length*44<h-390)break;size-=2;}while(size>=22);
    let y=story?360:250;ctx.fillStyle='#efc773';ctx.font='500 52px "Noto Serif Display"';for(const line of to){ctx.fillText(line,85,y);y+=72;}y+=35;ctx.fillStyle='#f8f2e5';ctx.font=`400 ${size}px "Be Vietnam Pro"`;for(const line of msgLines){ctx.fillText(line,85,y);y+=size*1.65;}y=Math.max(y+60,h-190-from.length*44);ctx.fillStyle='#c6d4cd';ctx.font='400 28px "Be Vietnam Pro"';for(const line of from){ctx.fillText(line,85,y);y+=44;}ctx.fillStyle='#efc773';ctx.font='400 22px "Be Vietnam Pro"';ctx.fillText('Một lời chúc dưới trăng',85,h-80);
    const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error('Chưa tạo được ảnh.');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`trang-thiep-${story?'story':'vuong'}.png`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);status('#export-status','Đã tạo ảnh PNG. Trên iPhone, chọn Lưu hình ảnh nếu trình duyệt mở ảnh.');
  }
  $('#export-card').addEventListener('click',()=>busy($('#export-card'),exportCard,'#export-status'));
  for(const id of ['#recipient','#greeting','#sender'])$(id).addEventListener('input',()=>{$('#share-result').hidden=true;status('#export-status','');});
  // Keep an obvious exit and keyboard trap for the existing side panel.
  $('#cinema-mode').addEventListener('click',()=>{$('#exit-cinema').hidden=!document.body.classList.contains('cinema');});
  $('#exit-cinema').addEventListener('click',()=>{document.body.classList.remove('cinema');$('#exit-cinema').hidden=true;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.body.classList.remove('cinema');$('#exit-cinema').hidden=true;}if(e.key==='Tab'&&$('#wish-panel').classList.contains('open')&&!document.querySelector('dialog[open]')){const focus=$$('#wish-panel button:not(:disabled),#wish-panel input:not([hidden])');const first=focus[0],last=focus.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  async function boot(){try{await ensureProfile();await readRoute();const previous=store.get('trang-v5-room');if(previous&&!location.hash.startsWith('#room=')){setRoom(previous);await pollRoom();}const pending=JSON.parse(store.get('trang-v5-pending-game')||'null');if(pending){pendingResult=pending;$('#game-intro').hidden=true;$('#game-result').hidden=false;await settleGame();}}catch(e){status('#profile-status',errorText(e));}}
  document.addEventListener('trang:ready',boot,{once:true});
})();
