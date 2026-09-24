'use strict';

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const CATEGORY = {
    family: 'Gia đình',
    health: 'Sức khỏe',
    love: 'Tình yêu',
    dream: 'Ước mơ',
    luck: 'May mắn',
    other: 'Khác'
  };

  const COLOR = {
    amber: '#f7c96f',
    red: '#f06e55',
    jade: '#62c7a2',
    blue: '#6fa8ff',
    violet: '#ac86ff'
  };

  const state = {
    client: null,
    channel: null,
    wishes: [],
    total: 0,
    today: 0,
    filter: 'all',
    search: '',
    sort: 'latest',
    visibleLimit: 16,
    selectedCategory: 'other',
    selectedColor: 'amber',
    activeWish: null,
    audio: null,
    master: null,
    musicOn: false,
    musicTimer: null,
    nextNote: 0,
    noteIndex: 0
  };

  const timeFormat = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let toastTimer;

  function clean(value, max = 180) {
    return String(value ?? '')
      .replace(/[<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  }

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function todayIso() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }

  function isToday(value) {
    return new Date(value) >= new Date(todayIso());
  }

  function formatTime(value) {
    try {
      return timeFormat.format(new Date(value));
    } catch {
      return '';
    }
  }

  function setNetworkStatus(online, label, detail = '') {
    $('#network-dot').classList.toggle('online', online);
    $('#network-label').textContent = label;
    $('#db-mini-status').textContent = detail || `DB: ${label.toLowerCase()}`;
  }

  // Header / mobile.
  const topbar = $('#topbar');
  addEventListener('scroll', () => topbar.classList.toggle('scrolled', scrollY > 24), { passive: true });

  const menuToggle = $('#menu-toggle');
  const mobileMenu = $('#mobile-menu');
  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!open));
    mobileMenu.hidden = open;
  });
  $$('#mobile-menu a').forEach(link => link.addEventListener('click', () => {
    mobileMenu.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
  }));

  // Cursor glow.
  const cursorGlow = $('#cursor-glow');
  addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    cursorGlow.style.left = `${event.clientX}px`;
    cursorGlow.style.top = `${event.clientY}px`;
  }, { passive: true });

  // Canvas sky.
  const canvas = $('#sky-canvas');
  const ctx = canvas.getContext('2d');
  let width = innerWidth;
  let height = innerHeight;
  let dpr = 1;
  let stars = [];
  let sparks = [];
  let raf = 0;
  let lastFrame = 0;

  function resizeCanvas() {
    width = innerWidth;
    height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: width < 620 ? 42 : 90 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: .35 + Math.random() * 1.15,
      phase: Math.random() * Math.PI * 2,
      speed: .03 + Math.random() * .12
    }));
  }

  function drawCanvas(time) {
    raf = 0;
    if (document.hidden) return;

    const delta = Math.min((time - lastFrame) / 16.67 || 1, 2);
    lastFrame = time;
    ctx.clearRect(0, 0, width, height);

    for (const star of stars) {
      ctx.globalAlpha = reducedMotion.matches ? .18 : .08 + (Math.sin(time * .001 + star.phase) + 1) * .12;
      ctx.fillStyle = '#ffe3a6';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fill();
      if (!reducedMotion.matches) {
        star.y -= star.speed * delta;
        if (star.y < -2) star.y = height + 2;
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const spark = sparks[i];
      spark.x += spark.vx * delta;
      spark.y += spark.vy * delta;
      spark.vy += .018 * delta;
      spark.life -= delta;

      if (spark.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = Math.max(0, spark.life / spark.max);
      ctx.fillStyle = spark.color;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    if (!reducedMotion.matches || sparks.length) raf = requestAnimationFrame(drawCanvas);
  }

  function startCanvas() {
    if (!raf && !document.hidden) raf = requestAnimationFrame(drawCanvas);
  }

  function burst(x, y, count = width < 620 ? 40 : 72, colors = Object.values(COLOR)) {
    if (reducedMotion.matches) return;

    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 2 * i / count + Math.random() * .08;
      const speed = .7 + Math.random() * 3.6;
      const life = 38 + Math.random() * 55;

      sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        max: life,
        radius: .6 + Math.random() * 1.7,
        color: colors[i % colors.length]
      });
    }

    if (sparks.length > 700) sparks.splice(0, sparks.length - 700);
    startCanvas();
  }

  function lightShow() {
    document.body.classList.remove('lightshow');
    void document.body.offsetWidth;
    document.body.classList.add('lightshow');
    $('#hero-mode').textContent = 'SHOW';

    if (!reducedMotion.matches) {
      [0, 260, 540, 850, 1180, 1500].forEach((delay, index) => {
        setTimeout(() => {
          burst(
            width * (.16 + Math.random() * .68),
            height * (.15 + Math.random() * .5),
            54 + index * 4
          );
        }, delay);
      });
    }

    setTimeout(() => {
      document.body.classList.remove('lightshow');
      $('#hero-mode').textContent = 'LIVE';
    }, 4200);
  }

  resizeCanvas();
  startCanvas();
  addEventListener('resize', () => {
    resizeCanvas();
    startCanvas();
  }, { passive: true });

  $('#hero-lightshow').addEventListener('click', lightShow);
  $('#dock-lightshow').addEventListener('click', lightShow);

  $('#dock-focus').addEventListener('click', event => {
    document.body.classList.toggle('focus-mode');
    event.currentTarget.classList.toggle('active', document.body.classList.contains('focus-mode'));
  });

  $('#scroll-top').addEventListener('click', () => scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' }));

  // Studio.
  const wishName = $('#wish-name');
  const wishMessage = $('#wish-message');
  const wishCount = $('#wish-count');
  const previewLantern = $('#preview-lantern');
  const previewName = $('#preview-name');
  const previewMessage = $('#preview-message');
  const previewCategory = $('#preview-category-label');

  try {
    wishName.value = clean(localStorage.getItem('trang-wish-name') || '', 40);
  } catch {}

  function updateStudioPreview() {
    previewName.textContent = clean(wishName.value, 40) || 'Tên của bạn';
    previewMessage.textContent = clean(wishMessage.value, 180) || 'Điều ước sẽ xuất hiện ở đây.';
    previewCategory.textContent = CATEGORY[state.selectedCategory].toUpperCase();
    previewLantern.className = `preview-lantern ${state.selectedColor}`;
    wishCount.textContent = `${wishMessage.value.length}/180`;
  }

  wishName.addEventListener('input', updateStudioPreview);
  wishMessage.addEventListener('input', updateStudioPreview);

  $$('#category-grid button').forEach(button => button.addEventListener('click', () => {
    $$('#category-grid button').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    state.selectedCategory = button.dataset.category;
    updateStudioPreview();
  }));

  $$('#color-picker button').forEach(button => button.addEventListener('click', () => {
    $$('#color-picker button').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    state.selectedColor = button.dataset.color;
    updateStudioPreview();
  }));

  $$('[data-template]').forEach(button => button.addEventListener('click', () => {
    wishMessage.value = button.dataset.template;
    updateStudioPreview();
    wishMessage.focus();
  }));

  updateStudioPreview();

  function normalizeWish(raw) {
    return {
      id: raw.id,
      name: clean(raw.name, 40),
      message: clean(raw.message, 180),
      category: CATEGORY[raw.category] ? raw.category : 'other',
      lantern_color: COLOR[raw.lantern_color] ? raw.lantern_color : 'amber',
      created_at: raw.created_at
    };
  }

  async function submitWish() {
    const name = clean(wishName.value, 40);
    const message = clean(wishMessage.value, 180);

    if (!name || !message) throw new Error('Điền tên và điều ước trước khi thả đèn.');
    if (!state.client) throw new Error('Database chưa kết nối.');

    const lastSubmit = Number(sessionStorage.getItem('trang-last-submit') || 0);
    if (Date.now() - lastSubmit < 8000) throw new Error('Chờ vài giây rồi gửi tiếp.');

    const submit = $('#wish-submit');
    submit.disabled = true;
    submit.firstElementChild.textContent = 'ĐANG THẢ ĐÈN…';

    try {
      const { data, error } = await state.client
        .from('wishes')
        .insert({
          name,
          message,
          category: state.selectedCategory,
          lantern_color: state.selectedColor
        })
        .select('id,name,message,category,lantern_color,created_at')
        .single();

      if (error) throw error;

      sessionStorage.setItem('trang-last-submit', String(Date.now()));
      try { localStorage.setItem('trang-wish-name', name); } catch {}

      const wish = normalizeWish(data);
      if (!state.wishes.some(item => String(item.id) === String(wish.id))) {
        state.wishes.unshift(wish);
        state.total++;
        if (isToday(wish.created_at)) state.today++;
      }

      wishMessage.value = '';
      updateStudioPreview();
      renderAll();
      $('#wish-status').textContent = 'Đã thả đèn lên bầu trời chung.';
      burst(width * .5, height * .45, 90, [COLOR[state.selectedColor], '#fff1bd']);
      toast('Điều ước đã lên bầu trời realtime.');

      setTimeout(() => openWish(wish), 650);
    } finally {
      submit.disabled = false;
      submit.firstElementChild.textContent = 'THẢ ĐÈN LÊN BẦU TRỜI';
    }
  }

  $('#wish-form').addEventListener('submit', async event => {
    event.preventDefault();
    $('#wish-status').textContent = 'Đang gửi…';

    try {
      await submitWish();
    } catch (error) {
      console.error(error);
      $('#wish-status').textContent = error?.message || 'Không gửi được điều ước.';
      toast(error?.message || 'Không gửi được điều ước.');
    }
  });

  // Filtering / rendering.
  function filteredWishes() {
    const term = state.search.toLocaleLowerCase('vi');
    let list = state.wishes.filter(wish => {
      const matchesCategory = state.filter === 'all' || wish.category === state.filter;
      const matchesSearch = !term ||
        wish.name.toLocaleLowerCase('vi').includes(term) ||
        wish.message.toLocaleLowerCase('vi').includes(term);
      return matchesCategory && matchesSearch;
    });

    if (state.sort === 'oldest') {
      list = [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (state.sort === 'random') {
      list = [...list].sort(() => Math.random() - .5);
    } else {
      list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return list;
  }

  function wishTile(wish) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wish-tile';
    button.style.setProperty('--tile-color', COLOR[wish.lantern_color]);
    button.style.setProperty('--tile-glow', `color-mix(in srgb, ${COLOR[wish.lantern_color]} 18%, transparent)`);
    button.setAttribute('aria-label', `Xem điều ước của ${wish.name}`);

    const top = document.createElement('div');
    top.className = 'wish-tile-top';

    const category = document.createElement('span');
    category.className = 'wish-category';
    category.textContent = CATEGORY[wish.category];

    const dot = document.createElement('span');
    dot.className = 'wish-color-dot';

    const title = document.createElement('h3');
    title.textContent = wish.name;

    const message = document.createElement('p');
    message.textContent = wish.message;

    const footer = document.createElement('footer');
    const time = document.createElement('span');
    time.textContent = formatTime(wish.created_at);
    const id = document.createElement('span');
    id.textContent = `#${wish.id}`;

    top.append(category, dot);
    footer.append(time, id);
    button.append(top, title, message, footer);
    button.addEventListener('click', () => openWish(wish));

    return button;
  }

  function floatingLantern(wish, index) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `float-lantern ${wish.lantern_color}`;
    button.style.left = `${4 + ((index * 19 + Number(wish.id || 0)) % 90)}%`;
    button.style.top = `${5 + ((index * 29 + Number(wish.id || 0)) % 74)}%`;
    button.style.setProperty('--duration', `${13 + (index % 7) * 2.2}s`);
    button.style.animationDelay = `${-(index % 8) * 1.4}s`;
    button.setAttribute('aria-label', `Mở điều ước của ${wish.name}`);
    button.addEventListener('click', () => openWish(wish));
    return button;
  }

  function updateRibbon() {
    const track = $('#ribbon-track');
    const latest = [...state.wishes]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8);

    track.replaceChildren();

    if (!latest.length) {
      const span = document.createElement('span');
      span.textContent = 'Chưa có điều ước.';
      track.append(span);
      return;
    }

    const doubled = [...latest, ...latest];
    doubled.forEach(wish => {
      const item = document.createElement('span');
      const name = document.createElement('b');
      name.textContent = wish.name;
      item.append(name, document.createTextNode(` · ${wish.message}`));
      track.append(item);
    });
  }

  function renderAll() {
    const list = filteredWishes();
    const visible = list.slice(0, state.visibleLimit);
    const grid = $('#wish-grid');
    const empty = $('#empty-state');
    const floating = $('#floating-wishes');

    grid.querySelectorAll('.wish-tile').forEach(node => node.remove());
    floating.replaceChildren();

    if (!visible.length) {
      empty.hidden = false;
    } else {
      empty.hidden = true;
      visible.forEach(wish => grid.append(wishTile(wish)));
      list.slice(0, 20).forEach((wish, index) => floating.append(floatingLantern(wish, index)));
    }

    $('#filtered-wishes').textContent = String(list.length);
    $('#hero-visible').textContent = String(Math.min(list.length, 99));
    $('#total-wishes').textContent = String(state.total);
    $('#today-wishes').textContent = String(state.today);
    $('#hero-total').textContent = String(state.total);
    $('#hero-today').textContent = String(state.today);
    $('#network-summary').textContent = `Hiển thị ${visible.length}/${list.length} điều ước · realtime`;

    const showMore = $('#show-more');
    showMore.hidden = visible.length >= list.length;

    updateRibbon();
  }

  $('#wish-search').addEventListener('input', event => {
    state.search = clean(event.target.value, 80);
    state.visibleLimit = 16;
    renderAll();
  });

  $$('#filter-chips button').forEach(button => button.addEventListener('click', () => {
    $$('#filter-chips button').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    state.filter = button.dataset.filter;
    state.visibleLimit = 16;
    renderAll();
  }));

  $('#wish-sort').addEventListener('change', event => {
    state.sort = event.target.value;
    renderAll();
  });

  $('#show-more').addEventListener('click', () => {
    state.visibleLimit += 12;
    renderAll();
  });

  $('#random-wish').addEventListener('click', () => {
    const list = filteredWishes();
    if (!list.length) return toast('Không có điều ước phù hợp.');
    openWish(list[Math.floor(Math.random() * list.length)]);
  });

  $('#refresh-wishes').addEventListener('click', async () => {
    await loadWishes();
    toast('Đã làm mới bầu trời.');
  });

  // Wish dialog / share.
  function openWish(wish) {
    state.activeWish = wish;

    const lantern = $('#dialog-lantern');
    lantern.className = `dialog-lantern ${wish.lantern_color}`;

    $('#dialog-category').textContent = CATEGORY[wish.category].toUpperCase();
    $('#dialog-name').textContent = wish.name;
    $('#dialog-message').textContent = wish.message;
    $('#dialog-time').textContent = formatTime(wish.created_at);
    $('#dialog-id').textContent = `WISH #${wish.id}`;
    $('#wish-dialog').showModal();
  }

  function wishShareUrl(wish) {
    const url = new URL(location.href);
    url.searchParams.set('wish', String(wish.id));
    url.hash = 'network';
    return url.href;
  }

  async function shareWish() {
    if (!state.activeWish) return;
    const url = wishShareUrl(state.activeWish);
    const payload = {
      title: `Điều ước của ${state.activeWish.name}`,
      text: state.activeWish.message,
      url
    };

    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast('Đã copy link điều ước.');
    } catch {
      toast('Không copy tự động được.');
    }
  }

  $('#share-wish').addEventListener('click', shareWish);
  $('#send-spark').addEventListener('click', () => {
    const color = state.activeWish ? COLOR[state.activeWish.lantern_color] : COLOR.amber;
    burst(width * .5, height * .45, 70, [color, '#fff2c8']);
    toast('Đã gửi một chút may mắn ✦');
  });

  $$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog')?.close()));
  $$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) dialog.close();
  }));

  async function openWishFromUrl() {
    const id = new URL(location.href).searchParams.get('wish');
    if (!id) return;

    let wish = state.wishes.find(item => String(item.id) === String(id));

    if (!wish && state.client) {
      const { data } = await state.client
        .from('wishes')
        .select('id,name,message,category,lantern_color,created_at')
        .eq('id', id)
        .maybeSingle();
      if (data) wish = normalizeWish(data);
    }

    if (wish) setTimeout(() => openWish(wish), 350);
  }

  // Supabase.
  async function loadWishes({ quiet = false } = {}) {
    if (!state.client) return;

    if (!quiet) setNetworkStatus(true, 'SYNCING', 'DB: syncing');

    const [
      { data, error, count },
      totalResult,
      todayResult
    ] = await Promise.all([
      state.client
        .from('wishes')
        .select('id,name,message,category,lantern_color,created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(150),
      state.client.from('wishes').select('id', { count: 'exact', head: true }),
      state.client.from('wishes').select('id', { count: 'exact', head: true }).gte('created_at', todayIso())
    ]);

    if (error) {
      console.error(error);
      setNetworkStatus(false, 'OFFLINE', 'DB: error');
      if (!quiet) toast('Không tải được dữ liệu.');
      return;
    }

    state.wishes = Array.isArray(data) ? data.map(normalizeWish) : [];
    state.total = totalResult.count ?? count ?? state.wishes.length;
    state.today = todayResult.count ?? state.wishes.filter(item => isToday(item.created_at)).length;

    setNetworkStatus(true, 'LIVE', 'DB: live');
    renderAll();
  }

  function subscribeRealtime() {
    if (!state.client) return Promise.resolve();

    state.channel?.unsubscribe?.();

    return new Promise(resolve => {
      let resolved = false;
      const finish = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      state.channel = state.client
        .channel('trang-wishes-v3')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'wishes'
        }, payload => {
          const wish = normalizeWish(payload.new || {});
          if (!wish.name || !wish.message) return;

          const exists = state.wishes.some(item => String(item.id) === String(wish.id));
          if (!exists) {
            state.wishes.unshift(wish);
            state.wishes = state.wishes.slice(0, 150);
            state.total++;
            if (isToday(wish.created_at)) state.today++;
            renderAll();

            if (!document.hidden) {
              burst(width * (.25 + Math.random() * .5), height * (.25 + Math.random() * .35), 34, [COLOR[wish.lantern_color], '#fff2c8']);
              toast(`${wish.name} vừa thả một chiếc đèn mới.`);
            }
          }
        })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            setNetworkStatus(true, 'LIVE', 'DB: live');
            finish();
          } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
            finish();
          }
        });

      setTimeout(finish, 4500);
    });
  }

  async function initSupabase() {
    const cfg = window.TRANG_SUPABASE || {};
    const valid = cfg.url && cfg.key && !String(cfg.url).includes('YOUR_') && !String(cfg.key).includes('YOUR_');

    if (!window.supabase?.createClient || !valid) {
      setNetworkStatus(false, 'OFFLINE', 'DB: missing config');
      $('#wish-status').textContent = 'Database chưa được cấu hình.';
      return;
    }

    try {
      state.client = window.supabase.createClient(cfg.url, cfg.key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      await subscribeRealtime();
      await loadWishes({ quiet: true });
      await openWishFromUrl();
    } catch (error) {
      console.error(error);
      setNetworkStatus(false, 'OFFLINE', 'DB: error');
    }
  }

  // Moon card.
  const cardTo = $('#card-to');
  const cardMessage = $('#card-message');
  const cardFrom = $('#card-from');

  function updateCardPreview() {
    $('#preview-card-to').textContent = cardTo.value.trim() ? `Gửi ${clean(cardTo.value, 50)},` : 'Gửi bạn,';
    $('#preview-card-message').textContent = clean(cardMessage.value, 400) || 'Chúc bạn một mùa Trung thu vui vẻ, bình an và gặp thật nhiều điều tốt đẹp.';
    $('#preview-card-from').textContent = cardFrom.value.trim() ? `— ${clean(cardFrom.value, 50)}` : '— Một người bạn';
    $('#share-box').hidden = true;
  }

  [cardTo, cardMessage, cardFrom].forEach(input => input.addEventListener('input', updateCardPreview));

  function validCard(raw) {
    const card = {
      to: clean(raw.to, 50),
      message: clean(raw.message, 400),
      from: clean(raw.from, 50)
    };
    if (!card.to || !card.message || !card.from) throw new Error('Điền đủ thông tin lời chúc.');
    return card;
  }

  function encodeCard(card) {
    const bytes = new TextEncoder().encode(JSON.stringify(card));
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });

    const encoded = btoa(binary)
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/g, '');

    const url = new URL(location.href);
    url.searchParams.delete('wish');
    url.hash = `card=${encoded}`;
    return url.href;
  }

  $('#card-form').addEventListener('submit', event => {
    event.preventDefault();

    try {
      const card = validCard({
        to: cardTo.value,
        message: cardMessage.value,
        from: cardFrom.value
      });

      $('#share-link').value = encodeCard(card);
      $('#share-box').hidden = false;
      toast('Link lời chúc đã sẵn sàng.');
    } catch (error) {
      toast(error.message);
    }
  });

  async function copyCardLink() {
    try {
      await navigator.clipboard.writeText($('#share-link').value);
      toast('Đã copy link lời chúc.');
    } catch {
      $('#share-link').select();
      toast('Link đã được chọn, nhấn Ctrl+C.');
    }
  }

  $('#copy-card-link').addEventListener('click', copyCardLink);
  $('#native-share').addEventListener('click', async () => {
    const url = $('#share-link').value;
    if (!url) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Moon Card',
          text: 'Bạn có một lời chúc Trung thu.',
          url
        });
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }

    copyCardLink();
  });

  function readCardFromUrl() {
    if (!location.hash.startsWith('#card=')) return;

    try {
      let encoded = location.hash.slice(6).replaceAll('-', '+').replaceAll('_', '/');
      while (encoded.length % 4) encoded += '=';

      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const card = validCard(JSON.parse(new TextDecoder().decode(bytes)));

      $('#received-card-to').textContent = `Gửi ${card.to},`;
      $('#received-card-message').textContent = card.message;
      $('#received-card-from').textContent = `— ${card.from}`;
      $('#card-dialog').showModal();
    } catch {
      toast('Link lời chúc không hợp lệ.');
    }
  }

  readCardFromUrl();
  addEventListener('hashchange', readCardFromUrl);

  // Ambient sound.
  const melody = [0, 2, 4, 7, 9, 7, 4, 2, 0, 4, 7, 12, 9, 7, 4, 2];

  function playTone(freq, start, duration, volume) {
    const oscillator = state.audio.createOscillator();
    const gain = state.audio.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = freq;
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .04);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);

    oscillator.connect(gain);
    gain.connect(state.master);
    oscillator.start(start);
    oscillator.stop(start + duration + .1);
  }

  function scheduleMusic() {
    if (!state.musicOn || !state.audio || state.audio.state !== 'running') return;

    while (state.nextNote < state.audio.currentTime + .5) {
      const index = state.noteIndex++ % melody.length;
      playTone(261.63 * Math.pow(2, melody[index] / 12), state.nextNote, 2.2, .14);
      if (index % 4 === 0) playTone(130.815, state.nextNote, 3, .055);
      state.nextNote += .72;
    }
  }

  $('#sound-toggle').addEventListener('click', async event => {
    try {
      if (!state.audio) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw new Error('Audio unsupported');

        state.audio = new Audio();
        state.master = state.audio.createGain();
        state.master.gain.value = .24;
        state.master.connect(state.audio.destination);
      }

      if (state.musicOn) {
        state.musicOn = false;
        clearInterval(state.musicTimer);
        await state.audio.suspend();
      } else {
        await state.audio.resume();
        state.musicOn = true;
        state.nextNote = state.audio.currentTime + .05;
        scheduleMusic();
        state.musicTimer = setInterval(scheduleMusic, 220);
      }

      event.currentTarget.setAttribute('aria-pressed', String(state.musicOn));
    } catch {
      toast('Trình duyệt chưa cho phép phát âm thanh.');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      if (state.audio && state.musicOn) state.audio.suspend().catch(() => {});
    } else {
      lastFrame = 0;
      startCanvas();
      if (state.audio && state.musicOn) state.audio.resume().catch(() => {});
    }
  });

  addEventListener('pagehide', () => state.channel?.unsubscribe?.());

  initSupabase();
})();