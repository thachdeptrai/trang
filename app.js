'use strict';

(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const timeFmt = new Intl.DateTimeFormat('vi-VN', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
  const PAGE_SIZE = 18;
  const SKY_LIMIT = 36;

  let supabaseClient = null;
  let wishChannel = null;
  let reactionChannel = null;
  let lightChannel = null;
  let presenceChannel = null;

  let skyRows = [];
  let feedRows = [];
  let feedPage = 0;
  let feedTotal = 0;
  let feedHasMore = true;
  let activeSort = 'latest';
  let activeCategory = 'all';
  let searchTerm = '';
  let activeWish = null;

  let totalWishes = 0;
  let totalLights = 0;
  let onlineCount = 1;
  let creatorStep = 1;
  let selectedCategory = 'other';
  let selectedColor = 'amber';
  let selectedStyle = 'classic';

  let toastTimer = null;
  let searchTimer = null;
  let rabbitTimer = null;
  let rabbitHideTimer = null;

  const seenWishIds = new Set();
  const seenReactionIds = new Set();
  const seenLightIds = new Set();
  const refreshWishTimers = new Map();

  function getClientId() {
    try {
      let id = localStorage.getItem('trang-client-id');
      if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-' + Math.random().toString(16).slice(2).padEnd(12,'0').slice(0,12);
        localStorage.setItem('trang-client-id', id);
      }
      return id;
    } catch (error) {
      return crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-000000000001';
    }
  }
  const clientId = getClientId();

  const categoryLabels = {
    other:'KHÁC',
    family:'GIA ĐÌNH',
    health:'SỨC KHỎE',
    love:'TÌNH YÊU',
    dream:'ƯỚC MƠ',
    luck:'MAY MẮN'
  };
  const colorLabels = {amber:'Vàng', red:'Đỏ', jade:'Ngọc', blue:'Xanh', violet:'Tím'};
  const styleLabels = {classic:'Cổ điển', round:'Tròn', lotus:'Liên hoa', diamond:'Kim cương', tower:'Tháp'};
  const scenes = ['gold','blue','red'];

  function cleanText(value, max) {
    return String(value == null ? '' : value).replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
  }

  function toast(message) {
    const box = $('#toast');
    box.textContent = message;
    box.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.classList.remove('visible'); }, 3200);
  }

  function formatTime(value) {
    try { return timeFmt.format(new Date(value)); } catch (error) { return ''; }
  }

  function setDbState(title, detail, online) {
    $('#db-state').textContent = title;
    $('#db-detail').textContent = detail;
    $('#db-dot').classList.toggle('online', Boolean(online));
    $('#hero-live-label').textContent = online ? 'REALTIME SKY · ONLINE' : 'REALTIME SKY · CONNECTING';
  }

  function updateMetrics() {
    $('#metric-wishes').textContent = String(totalWishes);
    $('#metric-lights').textContent = String(totalLights);
    $('#metric-online').textContent = String(onlineCount);
    $('#header-online').textContent = String(onlineCount);
    $('#sky-online').textContent = String(onlineCount);
    $('#footer-online').textContent = String(onlineCount);
    $('#sky-latest').textContent = String(Math.min(skyRows.length, SKY_LIMIT));
  }

  const header = $('#site-header');
  addEventListener('scroll', function () {
    header.classList.toggle('is-scrolled', scrollY > 22);
  }, {passive:true});

  const menuButton = $('#menu-button');
  const mobileNav = $('#mobile-nav');
  menuButton.addEventListener('click', function () {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    mobileNav.hidden = open;
  });
  $$('#mobile-nav a').forEach(function (a) {
    a.addEventListener('click', function () {
      mobileNav.hidden = true;
      menuButton.setAttribute('aria-expanded','false');
    });
  });

  const pointerLight = $('#pointer-light');
  addEventListener('pointermove', function (event) {
    if (!matchMedia('(hover:hover)').matches) return;
    pointerLight.style.left = event.clientX + 'px';
    pointerLight.style.top = event.clientY + 'px';
  }, {passive:true});

  const canvas = $('#sky-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  let cw = innerWidth;
  let ch = innerHeight;
  let dpr = 1;
  let stars = [];
  let sparks = [];
  let raf = 0;
  let lastFrame = 0;

  function rebuildStars(density) {
    density = density || Number($('#star-density') ? $('#star-density').value : 72);
    const base = cw < 720 ? 34 : 78;
    const count = Math.max(12, Math.round(base * density / 72));
    stars = Array.from({length:count}, function () {
      return {
        x:Math.random()*cw,
        y:Math.random()*ch,
        r:.25+Math.random()*1.05,
        phase:Math.random()*Math.PI*2,
        speed:.03+Math.random()*.14
      };
    });
    startSky();
  }

  function resizeSky() {
    if (!ctx) return;
    cw = innerWidth;
    ch = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(cw*dpr);
    canvas.height = Math.round(ch*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    rebuildStars();
  }

  function drawSky(time) {
    raf = 0;
    if (!ctx || document.hidden) return;

    const delta = Math.min((time-lastFrame)/16.7 || 1,2);
    lastFrame = time;
    ctx.clearRect(0,0,cw,ch);

    stars.forEach(function (star) {
      ctx.globalAlpha = .10 + (Math.sin(time*.0009+star.phase)+1)*.16;
      ctx.fillStyle = '#f8dda0';
      ctx.beginPath();
      ctx.arc(star.x,star.y,star.r,0,Math.PI*2);
      ctx.fill();
      if (!reducedMotion.matches) {
        star.y -= star.speed*delta;
        if (star.y < -2) star.y = ch + 2;
      }
    });

    for (let i=sparks.length-1;i>=0;i--) {
      const p = sparks[i];
      p.x += p.vx*delta;
      p.y += p.vy*delta;
      p.vy += .018*delta;
      p.life -= delta;
      if (p.life <= 0) {
        sparks.splice(i,1);
        continue;
      }
      ctx.globalAlpha = p.life/p.max;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    if (!reducedMotion.matches || sparks.length) raf = requestAnimationFrame(drawSky);
  }

  function startSky() {
    if (!raf && !document.hidden) raf = requestAnimationFrame(drawSky);
  }

  function burst(x,y,count) {
    count = count || 55;
    if (!ctx || reducedMotion.matches) return;
    const colors = ['#f2ce82','#fff0ba','#ff8b61','#80d8ff'];
    for (let i=0;i<count;i++) {
      const angle = Math.PI*2*i/count;
      const speed = .8 + Math.random()*3.1;
      const life = 38 + Math.random()*46;
      sparks.push({
        x:x,
        y:y,
        vx:Math.cos(angle)*speed,
        vy:Math.sin(angle)*speed,
        life:life,
        max:life,
        r:.6+Math.random()*1.5,
        color:colors[i%colors.length]
      });
    }
    if (sparks.length > 600) sparks.splice(0,sparks.length-600);
    startSky();
  }

  resizeSky();
  startSky();
  addEventListener('resize', resizeSky, {passive:true});

  $('#dock-theme').addEventListener('click', function () {
    const current = scenes.indexOf(document.body.dataset.scene);
    document.body.dataset.scene = scenes[(current+1)%scenes.length];
  });
  $('#cinema-mode').addEventListener('click', function () {
    document.body.classList.toggle('cinema');
  });
  $('#dock-settings').addEventListener('click', function () {
    const popover = $('#dock-popover');
    popover.hidden = !popover.hidden;
  });
  $('#moon-intensity').addEventListener('input', function (event) {
    document.documentElement.style.setProperty('--moon-strength', String(Number(event.target.value)/100));
  });
  $('#star-density').addEventListener('input', function (event) {
    document.documentElement.style.setProperty('--star-strength', String(Math.max(.2,Number(event.target.value)/100)));
    rebuildStars(Number(event.target.value));
  });

  let audio = null;
  let master = null;
  let musicOn = false;
  let musicTimer = null;
  let nextNote = 0;
  let noteIndex = 0;
  const melody = [0,2,4,7,9,7,4,2,0,4,7,12,9,7,4,2];

  function playNote(freq,start,duration,volume) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(volume,start+.04);
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start+duration+.1);
  }

  function scheduleMusic() {
    if (!musicOn || !audio || audio.state !== 'running') return;
    while (nextNote < audio.currentTime+.5) {
      const i = noteIndex++ % melody.length;
      playNote(261.63*Math.pow(2,melody[i]/12),nextNote,2,.14);
      if (i%4===0) playNote(130.8,nextNote,3,.055);
      nextNote += .72;
    }
  }

  $('#sound').addEventListener('click', async function () {
    try {
      if (!audio) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) throw new Error('unsupported');
        audio = new AudioCtx();
        master = audio.createGain();
        master.gain.value = .25;
        master.connect(audio.destination);
      }
      if (musicOn) {
        musicOn = false;
        clearInterval(musicTimer);
        await audio.suspend();
      } else {
        await audio.resume();
        musicOn = true;
        nextNote = audio.currentTime+.06;
        scheduleMusic();
        musicTimer = setInterval(scheduleMusic,220);
      }
      $('#sound').setAttribute('aria-pressed',String(musicOn));
    } catch (error) {
      toast('Trình duyệt chưa cho phép phát âm thanh.');
    }
  });

  function seeded(id,salt) {
    salt = salt || 0;
    const x = (Number(id)*9301 + 49297 + salt*233) % 233280;
    return x / 233280;
  }

  function createLantern(row,index,interactive) {
    index = index || 0;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'living-lantern color-' + (row.lantern_color || 'amber') + ' style-' + (row.lantern_style || 'classic');
    if ((Number(row.light_count)||0) > 0) button.classList.add('is-lit');

    const depthSeed = seeded(row.id,index+3);
    const scale = .48 + depthSeed*.78;
    const blur = Math.max(0,(1-scale)*1.5);
    const opacity = .48 + scale*.42;

    button.style.setProperty('--left', (4 + seeded(row.id,1)*58) + '%');
    button.style.setProperty('--top', (6 + seeded(row.id,2)*76) + '%');
    button.style.setProperty('--scale', scale.toFixed(2));
    button.style.setProperty('--blur', blur.toFixed(2)+'px');
    button.style.setProperty('--opacity', opacity.toFixed(2));
    button.style.setProperty('--depth', Math.round((scale-.75)*320)+'px');
    button.style.setProperty('--z', String(Math.round(scale*30)));
    button.style.setProperty('--duration', (12+seeded(row.id,4)*10).toFixed(1)+'s');
    button.style.setProperty('--delay', (-seeded(row.id,5)*9).toFixed(1)+'s');
    button.style.setProperty('--drift', (-24+seeded(row.id,6)*52).toFixed(0)+'px');

    button.innerHTML = '<span class="lantern-shell" aria-hidden="true"></span><span class="lantern-name"></span>';
    $('.lantern-name',button).textContent = row.name;
    button.setAttribute('aria-label','Mở điều ước của ' + row.name);
    if (interactive) button.addEventListener('click',function () { openWishPanel(row); });
    return button;
  }

  function renderLivingSky() {
    const host = $('#living-lanterns');
    host.replaceChildren();
    skyRows.slice(0,SKY_LIMIT).forEach(function (row,index) {
      host.append(createLantern(row,index,true));
    });
    updateMetrics();
  }

  const wishName = $('#wish-name');
  const wishMessage = $('#wish-message');
  try { wishName.value = cleanText(localStorage.getItem('trang-wish-name') || '',40); } catch (error) {}

  function updateWishCount() {
    $('#wish-count').textContent = String(wishMessage.value.length) + ' / 180';
  }
  wishMessage.addEventListener('input',updateWishCount);

  function setCreatorStep(step) {
    creatorStep = step;
    $$('.creator-step').forEach(function (el) {
      el.classList.toggle('active',Number(el.dataset.step)===step);
    });
    $$('.creator-step-dot').forEach(function (el) {
      el.classList.toggle('active',Number(el.dataset.stepDot)<=step);
    });

    if (step===3) {
      const name = cleanText(wishName.value,40);
      const message = cleanText(wishMessage.value,180);
      $('#review-name').textContent = name || '—';
      $('#review-message').textContent = message || '—';
      $('#review-meta').textContent = categoryLabels[selectedCategory] + ' · ' + colorLabels[selectedColor] + ' · ' + styleLabels[selectedStyle];
      const lantern = $('#review-lantern');
      lantern.className = 'review-lantern color-' + selectedColor + ' style-' + selectedStyle;
      lantern.innerHTML = '<span class="lantern-shell"></span>';
    }
  }

  function validateCreatorFirstStep() {
    const name = cleanText(wishName.value,40);
    const message = cleanText(wishMessage.value,180);
    if (!name) {
      toast('Nhập tên hiển thị trước.');
      wishName.focus();
      return false;
    }
    if (!message) {
      toast('Viết điều ước trước.');
      wishMessage.focus();
      return false;
    }
    return true;
  }

  $$('.creator-next').forEach(function (button) {
    button.addEventListener('click',function () {
      const next = Number(button.dataset.next);
      if (creatorStep===1 && !validateCreatorFirstStep()) return;
      setCreatorStep(next);
    });
  });

  $$('.creator-back').forEach(function (button) {
    button.addEventListener('click',function () {
      setCreatorStep(Number(button.dataset.back));
    });
  });

  $$('#category-options [data-category]').forEach(function (button) {
    button.addEventListener('click',function () {
      selectedCategory = button.dataset.category;
      $$('#category-options [data-category]').forEach(function (x) {
        x.classList.toggle('active',x===button);
      });
    });
  });

  function updateLanternPreview() {
    const preview = $('#lantern-preview');
    preview.className = 'lantern-preview color-' + selectedColor + ' style-' + selectedStyle;
    preview.innerHTML = '<span class="lantern-shell"></span><i class="preview-glow"></i>';
    $('#preview-label').textContent = colorLabels[selectedColor] + ' · ' + styleLabels[selectedStyle];
  }

  $$('#color-options [data-color]').forEach(function (button) {
    button.addEventListener('click',function () {
      selectedColor = button.dataset.color;
      $$('#color-options [data-color]').forEach(function (x) {
        x.classList.toggle('active',x===button);
      });
      updateLanternPreview();
    });
  });

  $$('#style-options [data-style]').forEach(function (button) {
    button.addEventListener('click',function () {
      selectedStyle = button.dataset.style;
      $$('#style-options [data-style]').forEach(function (x) {
        x.classList.toggle('active',x===button);
      });
      updateLanternPreview();
    });
  });

  function launchAnimation() {
    const flight = document.createElement('div');
    flight.className = 'launch-flight color-' + selectedColor + ' style-' + selectedStyle;
    flight.innerHTML = '<span class="lantern-shell"></span>';
    $('#launch-layer').append(flight);
    setTimeout(function () { flight.remove(); },1700);
  }

  function resetCreator() {
    wishMessage.value = '';
    updateWishCount();
    selectedCategory = 'other';
    selectedColor = 'amber';
    selectedStyle = 'classic';
    $$('#category-options [data-category]').forEach(function (x) {
      x.classList.toggle('active',x.dataset.category==='other');
    });
    $$('#color-options [data-color]').forEach(function (x) {
      x.classList.toggle('active',x.dataset.color==='amber');
    });
    $$('#style-options [data-style]').forEach(function (x) {
      x.classList.toggle('active',x.dataset.style==='classic');
    });
    updateLanternPreview();
    setCreatorStep(1);
  }

  function normalizeFeedRow(row) {
    return Object.assign({},row,{
      heart_count:Number(row.heart_count)||0,
      star_count:Number(row.star_count)||0,
      moon_count:Number(row.moon_count)||0,
      light_count:Number(row.light_count)||0,
      activity_score:Number(row.activity_score)||0
    });
  }

  function applyNewWish(raw) {
    if (!raw || !raw.id || seenWishIds.has(String(raw.id))) return false;
    seenWishIds.add(String(raw.id));
    totalWishes++;
    const row = normalizeFeedRow({
      id:raw.id,
      name:cleanText(raw.name,40),
      message:cleanText(raw.message,180),
      created_at:raw.created_at,
      category:raw.category||'other',
      lantern_color:raw.lantern_color||'amber',
      lantern_style:raw.lantern_style||'classic',
      search_text:cleanText((raw.name||'')+' '+(raw.message||''),240).toLowerCase(),
      heart_count:0,
      star_count:0,
      moon_count:0,
      light_count:0,
      activity_score:0
    });
    skyRows.unshift(row);
    skyRows = skyRows.slice(0,SKY_LIMIT);
    renderLivingSky();
    updateMetrics();
    return true;
  }

  $('#wish-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!validateCreatorFirstStep()) return;
    if (!supabaseClient) return toast('Database chưa sẵn sàng.');

    const lastSubmit = Number(sessionStorage.getItem('trang-last-wish') || 0);
    if (Date.now()-lastSubmit < 7000) return toast('Đợi vài giây rồi thả chiếc đèn tiếp theo.');

    const name = cleanText(wishName.value,40);
    const message = cleanText(wishMessage.value,180);
    const submit = $('#wish-submit');
    submit.disabled = true;
    submit.textContent = 'Đang thả…';

    const result = await supabaseClient
      .from('wishes')
      .insert({
        name:name,
        message:message,
        category:selectedCategory,
        lantern_color:selectedColor,
        lantern_style:selectedStyle
      })
      .select('id,name,message,created_at,category,lantern_color,lantern_style')
      .single();

    submit.disabled = false;
    submit.textContent = 'Thả lên trời ↑';

    if (result.error) {
      console.error(result.error);
      $('#wish-status').textContent = 'Chưa thả được. Thử lại nhé.';
      return;
    }

    sessionStorage.setItem('trang-last-wish',String(Date.now()));
    try { localStorage.setItem('trang-wish-name',name); } catch (error) {}
    $('#wish-status').textContent = 'Đèn đã bay lên bầu trời chung.';
    launchAnimation();
    applyNewWish(result.data);
    burst(cw*.44,ch*.42,72);

    setTimeout(function () {
      resetCreator();
      loadFeed(true);
    },1200);
  });

  function makeFeedCard(row) {
    const card = document.createElement('article');
    card.className = 'feed-card color-' + (row.lantern_color || 'amber');

    const head = document.createElement('div');
    head.className = 'feed-head';

    const name = document.createElement('p');
    name.className = 'feed-name';
    name.textContent = row.name;

    const badge = document.createElement('span');
    badge.className = 'feed-badge';
    badge.textContent = categoryLabels[row.category] || 'KHÁC';
    head.append(name,badge);

    const message = document.createElement('p');
    message.className = 'feed-message';
    message.textContent = row.message;

    const foot = document.createElement('div');
    foot.className = 'feed-foot';
    const time = document.createElement('span');
    time.textContent = formatTime(row.created_at);

    const stats = document.createElement('span');
    stats.className = 'feed-stats';
    stats.innerHTML =
      '<span>♥ ' + row.heart_count + '</span>' +
      '<span>✦ ' + row.star_count + '</span>' +
      '<span>☾ ' + row.moon_count + '</span>' +
      '<span>🏮 ' + row.light_count + '</span>';

    foot.append(time,stats);

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'feed-open';
    open.setAttribute('aria-label','Mở điều ước của ' + row.name);
    open.addEventListener('click',function () { openWishPanel(row); });

    card.append(head,message,foot,open);
    return card;
  }

  function renderFeed() {
    const host = $('#wish-feed');
    host.replaceChildren();

    if (!feedRows.length) {
      const empty = document.createElement('div');
      empty.className = 'feed-empty';
      empty.textContent = 'Không tìm thấy điều ước phù hợp.';
      host.append(empty);
    } else {
      feedRows.forEach(function (row) {
        host.append(makeFeedCard(row));
      });
    }

    $('#feed-count').textContent = String(feedTotal) + ' điều ước';
    $('#load-more').hidden = !feedHasMore;
  }

  async function loadFeed(reset) {
    reset = Boolean(reset);
    if (!supabaseClient) return;

    if (reset) {
      feedPage = 0;
      feedRows = [];
      $('#wish-feed').innerHTML = '<div class="feed-loading"><i></i><i></i><i></i></div>';
    }

    const from = feedPage*PAGE_SIZE;
    const to = from+PAGE_SIZE-1;

    let query = supabaseClient.from('wish_feed').select('*',{count:'exact'});

    if (searchTerm) query = query.ilike('search_text','%' + searchTerm + '%');
    if (activeCategory !== 'all') query = query.eq('category',activeCategory);

    if (activeSort === 'top') {
      query = query.order('activity_score',{ascending:false}).order('created_at',{ascending:false});
    } else if (activeSort === 'lit') {
      query = query.order('light_count',{ascending:false}).order('created_at',{ascending:false});
    } else {
      query = query.order('created_at',{ascending:false});
    }

    const result = await query.range(from,to);

    if (result.error) {
      console.error(result.error);
      toast('Chưa tải được bầu trời.');
      return;
    }

    const rows = (result.data||[]).map(normalizeFeedRow);
    feedRows = reset ? rows : feedRows.concat(rows);
    feedTotal = result.count == null ? feedRows.length : result.count;
    feedHasMore = feedRows.length < feedTotal && rows.length === PAGE_SIZE;
    feedPage++;
    renderFeed();
  }

  $('#load-more').addEventListener('click',function () { loadFeed(false); });

  $('#wish-search').addEventListener('input',function (event) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      searchTerm = cleanText(event.target.value,80).toLowerCase();
      loadFeed(true);
    },260);
  });

  $$('#sort-tabs [data-sort]').forEach(function (button) {
    button.addEventListener('click',function () {
      activeSort = button.dataset.sort;
      $$('#sort-tabs [data-sort]').forEach(function (x) {
        x.classList.toggle('active',x===button);
      });
      loadFeed(true);
    });
  });

  $('#category-filter').addEventListener('change',function (event) {
    activeCategory = event.target.value;
    loadFeed(true);
  });

  function randomWish() {
    const source = skyRows.length ? skyRows : feedRows;
    if (!source.length) return toast('Bầu trời đang trống.');
    openWishPanel(source[Math.floor(Math.random()*source.length)]);
  }

  $('#hero-random').addEventListener('click',randomWish);
  $('#random-wish').addEventListener('click',randomWish);

  function syncPanelCounts(row) {
    if (!activeWish || String(activeWish.id)!==String(row.id)) return;
    activeWish = row;
    $('#panel-light-count').textContent = String(row.light_count);
    const counts = {heart:row.heart_count, star:row.star_count, moon:row.moon_count};
    $$('#panel-reactions [data-reaction]').forEach(function (button) {
      $('span',button).textContent = String(counts[button.dataset.reaction]||0);
    });
  }

  async function openWishPanel(row) {
    activeWish = normalizeFeedRow(row);

    const lantern = $('#panel-lantern');
    lantern.className = 'panel-lantern color-' + (activeWish.lantern_color || 'amber') + ' style-' + (activeWish.lantern_style || 'classic');
    lantern.innerHTML = '<span class="lantern-shell"></span><i></i>';

    $('#panel-category').textContent = categoryLabels[activeWish.category] || 'ĐIỀU ƯỚC';
    $('#panel-time').textContent = formatTime(activeWish.created_at);
    $('#panel-name').textContent = activeWish.name;
    $('#panel-message').textContent = activeWish.message;
    syncPanelCounts(activeWish);

    $$('#panel-reactions [data-reaction]').forEach(function (button) {
      button.classList.remove('done');
    });

    $('#light-wish').classList.remove('done');
    $('#light-wish b').textContent = 'Thắp sáng điều ước';

    $('#wish-panel').classList.add('open');
    $('#wish-panel').setAttribute('aria-hidden','false');
    $('#panel-backdrop').hidden = false;

    if (!supabaseClient) return;

    const states = await Promise.all([
      supabaseClient.from('wish_reactions').select('reaction').eq('wish_id',activeWish.id).eq('client_id',clientId),
      supabaseClient.from('wish_lights').select('id').eq('wish_id',activeWish.id).eq('visitor_id',clientId).limit(1)
    ]);

    const mine = new Set((states[0].data||[]).map(function (x) { return x.reaction; }));
    $$('#panel-reactions [data-reaction]').forEach(function (button) {
      button.classList.toggle('done',mine.has(button.dataset.reaction));
    });

    if ((states[1].data||[]).length) {
      $('#light-wish').classList.add('done');
      $('#light-wish b').textContent = 'Đã thắp sáng';
    }
  }

  function closeWishPanel() {
    $('#wish-panel').classList.remove('open');
    $('#wish-panel').setAttribute('aria-hidden','true');
    $('#panel-backdrop').hidden = true;
  }

  $('#panel-close').addEventListener('click',closeWishPanel);
  $('#panel-backdrop').addEventListener('click',closeWishPanel);

  async function refreshWishById(id) {
    if (!supabaseClient) return;
    const result = await supabaseClient.from('wish_feed').select('*').eq('id',id).single();
    if (result.error || !result.data) return;

    const row = normalizeFeedRow(result.data);
    skyRows = skyRows.map(function (x) { return String(x.id)===String(id) ? row : x; });
    feedRows = feedRows.map(function (x) { return String(x.id)===String(id) ? row : x; });

    renderLivingSky();
    renderFeed();
    syncPanelCounts(row);
  }

  function scheduleWishRefresh(id) {
    const key = String(id);
    clearTimeout(refreshWishTimers.get(key));
    refreshWishTimers.set(key,setTimeout(function () {
      refreshWishTimers.delete(key);
      refreshWishById(id);
    },140));
  }

  async function addReaction(type) {
    if (!activeWish || !supabaseClient || ['heart','star','moon'].indexOf(type)===-1) return;
    const button = $('#panel-reactions [data-reaction="' + type + '"]');
    if (button.classList.contains('done')) return toast('Reaction này đã được gửi.');

    const result = await supabaseClient
      .from('wish_reactions')
      .insert({wish_id:activeWish.id,client_id:clientId,reaction:type})
      .select('id,wish_id,client_id,reaction,created_at')
      .single();

    if (result.error) {
      if (result.error.code==='23505') {
        button.classList.add('done');
        return toast('Reaction này đã được gửi.');
      }
      console.error(result.error);
      return toast('Chưa gửi được reaction.');
    }

    button.classList.add('done');
    if (result.data && result.data.id) seenReactionIds.add(String(result.data.id));
    scheduleWishRefresh(activeWish.id);
    burst(cw*.76,ch*.42,22);
  }

  $$('#panel-reactions [data-reaction]').forEach(function (button) {
    button.addEventListener('click',function () {
      addReaction(button.dataset.reaction);
    });
  });

  $('#light-wish').addEventListener('click', async function () {
    if (!activeWish || !supabaseClient) return;
    const button = $('#light-wish');
    if (button.classList.contains('done')) return toast('Bạn đã thắp sáng chiếc đèn này.');

    const result = await supabaseClient
      .from('wish_lights')
      .insert({wish_id:activeWish.id,visitor_id:clientId})
      .select('id,wish_id,visitor_id,created_at')
      .single();

    if (result.error) {
      if (result.error.code==='23505') {
        button.classList.add('done');
        $('#light-wish b').textContent = 'Đã thắp sáng';
        return toast('Bạn đã thắp sáng chiếc đèn này.');
      }
      console.error(result.error);
      return toast('Chưa thắp sáng được.');
    }

    button.classList.add('done');
    $('#light-wish b').textContent = 'Đã thắp sáng';

    if (result.data && result.data.id && !seenLightIds.has(String(result.data.id))) {
      seenLightIds.add(String(result.data.id));
      totalLights++;
      updateMetrics();
    }

    scheduleWishRefresh(activeWish.id);
    burst(cw*.74,ch*.46,34);
    toast('Chiếc đèn sáng hơn rồi ✦');
  });

  $('#report-wish').addEventListener('click',function () {
    if (!activeWish) return;
    $('#report-detail').value = '';
    $('#report-dialog').showModal();
  });

  $('#report-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!activeWish || !supabaseClient) return;

    const result = await supabaseClient.from('wish_reports').insert({
      wish_id:activeWish.id,
      reporter_id:clientId,
      reason:$('#report-reason').value,
      detail:cleanText($('#report-detail').value,240) || null
    });

    if (result.error) {
      if (result.error.code==='23505') toast('Bạn đã báo cáo điều ước này.');
      else {
        console.error(result.error);
        toast('Chưa gửi được báo cáo.');
      }
      return;
    }

    $('#report-dialog').close();
    toast('Đã gửi báo cáo.');
  });

  function waitSubscribe(channel) {
    return new Promise(function (resolve) {
      let done = false;
      function finish() {
        if (!done) {
          done = true;
          resolve();
        }
      }
      channel.subscribe(function (status) {
        if (status==='SUBSCRIBED' || status==='CHANNEL_ERROR' || status==='TIMED_OUT' || status==='CLOSED') finish();
      });
      setTimeout(finish,5000);
    });
  }

  async function subscribeRealtime() {
    wishChannel = supabaseClient
      .channel('v4-wishes')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'wishes'},function (payload) {
        if (applyNewWish(payload.new)) {
          toast(cleanText(payload.new.name,40) + ' vừa thả một chiếc đèn.');
          if (activeSort==='latest' && !searchTerm && activeCategory==='all') loadFeed(true);
        }
      });

    reactionChannel = supabaseClient
      .channel('v4-reactions')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'wish_reactions'},function (payload) {
        const row = payload.new || {};
        if (!row.id || seenReactionIds.has(String(row.id))) return;
        seenReactionIds.add(String(row.id));
        scheduleWishRefresh(row.wish_id);
      });

    lightChannel = supabaseClient
      .channel('v4-lights')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'wish_lights'},function (payload) {
        const row = payload.new || {};
        if (!row.id || seenLightIds.has(String(row.id))) return;
        seenLightIds.add(String(row.id));
        totalLights++;
        updateMetrics();
        scheduleWishRefresh(row.wish_id);
      });

    await Promise.all([
      waitSubscribe(wishChannel),
      waitSubscribe(reactionChannel),
      waitSubscribe(lightChannel)
    ]);
  }

  function startPresence() {
    presenceChannel = supabaseClient
      .channel('moon-presence-v4',{config:{presence:{key:clientId}}})
      .on('presence',{event:'sync'},function () {
        const state = presenceChannel.presenceState();
        onlineCount = Object.values(state).reduce(function (sum,items) {
          return sum + items.length;
        },0) || 1;
        updateMetrics();
      });

    presenceChannel.subscribe(async function (status) {
      if (status!=='SUBSCRIBED') return;
      await presenceChannel.track({
        visitor:clientId,
        online_at:new Date().toISOString()
      });
    });
  }

  async function loadInitialData() {
    const results = await Promise.all([
      supabaseClient.from('wish_feed').select('*').order('created_at',{ascending:false}).limit(SKY_LIMIT),
      supabaseClient.from('wishes').select('id',{count:'exact',head:true}),
      supabaseClient.from('wish_lights').select('id',{count:'exact',head:true})
    ]);

    if (results[0].error) throw results[0].error;

    skyRows = (results[0].data||[]).map(normalizeFeedRow);
    skyRows.forEach(function (row) { seenWishIds.add(String(row.id)); });
    totalWishes = results[1].count == null ? skyRows.length : results[1].count;
    totalLights = results[2].count == null ? 0 : results[2].count;

    renderLivingSky();
    updateMetrics();
    await loadFeed(true);
  }

  function validCard(card) {
    if (!card || typeof card!=='object') throw new Error('Thiệp không hợp lệ.');
    const out={};
    [['to',50],['message',400],['from',50]].forEach(function (item) {
      out[item[0]] = cleanText(card[item[0]],item[1]);
      if (!out[item[0]]) throw new Error('Điền đủ thông tin.');
    });
    return out;
  }

  function showCard(card) {
    $('#preview-to').textContent = 'Gửi ' + card.to + ',';
    $('#preview-message').textContent = card.message;
    $('#preview-from').textContent = card.from + '.';
  }

  function cardLink(card) {
    const bytes = new TextEncoder().encode(JSON.stringify(card));
    let binary='';
    bytes.forEach(function (b) { binary += String.fromCharCode(b); });
    const url = new URL(location.href);
    url.hash = 'card=' + btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
    return url.href;
  }

  $('#open-letter').addEventListener('click',function () {
    $('#letter-dialog').showModal();
  });

  $('#letter-form').addEventListener('submit',function (event) {
    event.preventDefault();
    try {
      const card = validCard({
        to:$('#recipient').value,
        message:$('#greeting').value,
        from:$('#sender').value
      });
      showCard(card);
      $('#share-link').value = cardLink(card);
      $('#share-result').hidden = false;
      $('#share-link').select();
    } catch (error) {
      toast(error.message);
    }
  });

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText($('#share-link').value);
      toast('Đã sao chép link.');
    } catch (error) {
      $('#share-link').select();
      toast('Nhấn Ctrl+C để sao chép.');
    }
  }

  $('#copy-link').addEventListener('click',copyShareLink);

  $('#share-native').addEventListener('click',async function () {
    if (!navigator.share) return copyShareLink();
    try {
      await navigator.share({title:'TRĂNG — lời chúc Trung thu',url:$('#share-link').value});
    } catch (error) {
      if (error.name!=='AbortError') copyShareLink();
    }
  });

  function readSharedCard() {
    if (!location.hash.startsWith('#card=')) return;
    try {
      let encoded = location.hash.slice(6).replaceAll('-','+').replaceAll('_','/');
      while (encoded.length%4) encoded += '=';
      const bytes = Uint8Array.from(atob(encoded),function (c) { return c.charCodeAt(0); });
      const card = validCard(JSON.parse(new TextDecoder().decode(bytes)));
      showCard(card);
      $('#received-to').textContent = 'Gửi ' + card.to + ',';
      $('#received-message').textContent = card.message;
      $('#received-from').textContent = card.from;
      $('#received-dialog').showModal();
    } catch (error) {
      toast('Link thiệp không hợp lệ.');
    }
  }

  readSharedCard();
  addEventListener('hashchange',readSharedCard);

  $$('[data-close]').forEach(function (button) {
    button.addEventListener('click',function () {
      const dialog = button.closest('dialog');
      if (dialog) dialog.close();
    });
  });

  $$('dialog').forEach(function (dialog) {
    dialog.addEventListener('click',function (event) {
      if (event.target!==dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) dialog.close();
    });
  });

  let moonPoints = 0;
  try { moonPoints = Number(localStorage.getItem('trang-moon-points')||0); } catch (error) {}
  $('#moon-points').textContent = String(moonPoints);

  function scheduleRabbit() {
    clearTimeout(rabbitTimer);
    rabbitTimer = setTimeout(showRabbit,10000+Math.random()*14000);
  }

  function showRabbit() {
    const rabbit = $('#rabbit-easter');
    const margin = 70;
    rabbit.style.left = Math.max(12,margin+Math.random()*Math.max(1,innerWidth-margin*2))+'px';
    rabbit.style.top = Math.max(80,80+Math.random()*Math.max(1,innerHeight-180))+'px';
    rabbit.hidden = false;
    clearTimeout(rabbitHideTimer);
    rabbitHideTimer = setTimeout(function () {
      rabbit.hidden = true;
      scheduleRabbit();
    },7000);
  }

  $('#rabbit-easter').addEventListener('click',function () {
    clearTimeout(rabbitHideTimer);
    $('#rabbit-easter').hidden = true;
    moonPoints++;
    $('#moon-points').textContent = String(moonPoints);
    try { localStorage.setItem('trang-moon-points',String(moonPoints)); } catch (error) {}
    burst(parseFloat($('#rabbit-easter').style.left)||cw*.5,parseFloat($('#rabbit-easter').style.top)||ch*.5,24);
    toast('+1 Moon Point');
    scheduleRabbit();
  });

  scheduleRabbit();

  async function initDatabase() {
    const cfg = window.TRANG_SUPABASE || {};
    const valid = window.supabase && window.supabase.createClient && cfg.url && cfg.key && !String(cfg.url).includes('YOUR_');

    if (!valid) {
      setDbState('Chưa kết nối','Thiếu Supabase config',false);
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(cfg.url,cfg.key,{
        auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
      });

      setDbState('Đang đồng bộ','Realtime + Presence',false);
      await subscribeRealtime();
      startPresence();
      await loadInitialData();
      setDbState('Bầu trời trực tuyến',String(totalWishes) + ' điều ước · ' + String(totalLights) + ' lượt thắp',true);
    } catch (error) {
      console.error(error);
      setDbState('Mất kết nối','Thử tải lại trang',false);
      toast('Không kết nối được bầu trời chung.');
    }
  }

  document.addEventListener('keydown',function (event) {
    if (event.key==='Escape') closeWishPanel();
  });

  document.addEventListener('visibilitychange',function () {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf=0;
      if (audio&&musicOn) audio.suspend().catch(function () {});
    } else {
      lastFrame=0;
      startSky();
      if (audio&&musicOn) audio.resume().catch(function () {});
    }
  });

  addEventListener('pagehide',function () {
    if (presenceChannel && presenceChannel.untrack) presenceChannel.untrack().catch(function () {});
    if (wishChannel && wishChannel.unsubscribe) wishChannel.unsubscribe();
    if (reactionChannel && reactionChannel.unsubscribe) reactionChannel.unsubscribe();
    if (lightChannel && lightChannel.unsubscribe) lightChannel.unsubscribe();
    if (presenceChannel && presenceChannel.unsubscribe) presenceChannel.unsubscribe();
  });

  initDatabase();
})();