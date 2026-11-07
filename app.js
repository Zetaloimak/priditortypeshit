/* =========================================================
   app.js: all site logic, with no server
   - log in, sign in and log out (accounts stored in this browser)
   - pages by hash: #/ #/product #/sell/1 #/pay/1 #/thanks #/download
   - order form that saves orders in this browser
   - navbar, mobile menu, copy number, scroll reveal
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const load = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const getUser = () => localStorage.getItem('pts_session');
  const RESERVED = ['zetafocus', 'rakfocus'];
  const NEEDS_LOGIN = ['product', 'sell', 'pay', 'thanks', 'download'];

  // Same plans and prices as PLANS in app.py
  const BIG_DESC = 'For companies running several servers. Need something different? Ask us for a custom plan.';
  const PLANS = {
    1: { amount: 1, unit: 'GB', price: 99, desc: 'A starter server for small projects, with admin tools and server verify included.',
         list: ['<strong>Admin function:</strong> view the user accounts on your server', '<strong>Server verify:</strong> check access codes from your program', 'Passwords stored as secure hashes', 'Download page for PTS ver 1 and ver 2'] },
    2: { amount: 100, unit: 'GB', price: 159, desc: 'Everything in Plan 1, plus full admin tools and plenty of room for logs and backups.',
         list: ['Everything in Plan 1', '<strong>Full admin function:</strong> reset passwords, disable accounts, and review sign-ups', '<strong>Server verify:</strong> room for many users and many checks', 'Support from our team'] },
    3: { amount: 500, unit: 'GB', price: 199, desc: 'For growing projects with many users, long logs, and large backups.',
         list: ['Everything in Plan 2', '<strong>Five times the storage</strong> of Plan 2', '<strong>Server verify:</strong> built for large user lists', 'Priority support from our team'] },
    4: { amount: 1, unit: 'TB', price: 259, desc: 'Our 1 TB plan for busy servers that keep a long history of logs and backups.',
         list: ['Everything in Plan 3', '<strong>Ten times the storage</strong> of Plan 2', 'Long history of logs and backups', 'Help with setup from our team'] },
    5: { amount: 5, unit: 'TB', price: 299, desc: BIG_DESC,
         list: ['Everything in Plan 4', '<strong>Admin tools</strong> for every account on your servers', '<strong>Custom features</strong> built for your team', 'Dedicated support from our team'] },
    6: { amount: 6, unit: 'TB', price: 399, desc: BIG_DESC,
         list: ['Everything in Plan 5', '<strong>Admin tools</strong> for every account on your servers', '<strong>Custom features</strong> built for your team', 'Dedicated support from our team'] },
  };

  let authNext = null;

  /* ---------- helpers ---------- */
  async function sha(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function toast(message) {
    let el = $('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  /* ---------- pages ---------- */
  function show(name) {
    $$('.page').forEach(p => { p.hidden = p.id !== `page-${name}`; });
    const target = name === 'home' ? '#/' : `#/${name}`;
    $$('#navLinks a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === target));
  }

  function planCard(id, mode, selected = false) {
    const p = PLANS[id];
    const isSell = mode === 'sell';
    const label = isSell ? (selected ? 'Continue with this plan' : `Choose Plan ${id}`) : `Order Plan ${id}`;
    return `
      <article class="tile plan reveal${selected ? ' is-selected' : ''}">
        <span class="dl-badge">Plan ${id}</span>${selected ? '<span class="sel-tag">Your choice</span>' : ''}
        <h2>PTS Server</h2>
        <div class="plan-storage"><b>${p.amount}</b><span>${p.unit}</span></div>
        <span class="plan-price"><b>${p.price} ฿</b><span>/month</span></span>
        ${isSell ? '' : `<p class="plan-desc">${p.desc}</p><ul class="plan-list">${p.list.map(li => `<li>${li}</li>`).join('')}</ul>`}
        <a class="btn-primary plan-btn" href="#/${isSell ? 'pay' : 'sell'}/${id}">${label} <span aria-hidden="true">→</span></a>
      </article>`;
  }

  function renderPay(id) {
    const p = PLANS[id];
    $('#payHi').textContent = `Hi ${getUser()},`;
    $('#payTitle').innerHTML = `Pay PTS Server <b>${p.price} ฿</b>`;
    $('#payAccount').textContent = `${getUser()} · PTS account`;
    $$('[data-pay-amount]').forEach(el => { el.textContent = `${p.price} ฿`; });
    $('#sumName').textContent = `PTS Server · Plan ${id}`;
    $('#sumSub').textContent = `${p.amount} ${p.unit} storage • Billed monthly`;
    $('#sumPrice').textContent = `${p.price} ฿`;
    $('#sumTotal').textContent = `${p.price} ฿`;
    $('#changePlan').href = `#/sell/${id}`;
    $('#payBtn').dataset.plan = id;
    $('#payBtn').textContent = `Pay ${p.price} ฿`;
    $('#payBtn').disabled = true;
    $$('input[name="method"]').forEach(r => { r.checked = false; });
    $$('.co-opt').forEach(o => o.classList.remove('is-selected'));
    $$('[data-panel]').forEach(el => { el.hidden = true; });
    $('#payHint').hidden = false;
  }

  function route() {
    const hash = location.hash || '#/';

    // Section links such as #About belong to the home page
    if (!hash.startsWith('#/')) {
      show('home');
      requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }));
      observeReveal();
      return;
    }

    const [part = '', arg] = hash.slice(2).split('/');
    const page = NEEDS_LOGIN.includes(part) || part === '' ? (part || 'home') : 'home';
    if (NEEDS_LOGIN.includes(page) && !getUser()) return openAuth('login', hash);
    if (page === 'pay' && !PLANS[arg]) { location.hash = '#/sell'; return; }

    show(page);
    if (page === 'sell') $('#sellPlans').innerHTML = Object.keys(PLANS).map(id => planCard(id, 'sell', +id === +arg)).join('');
    if (page === 'pay') renderPay(+arg);
    if (page === 'thanks') {
      const last = load('pts_last_order', null);
      $('#thanksText').innerHTML = `Hi ${getUser()}, thank you for your order${last ? ` <b>#${last}</b>` : ''}.`;
    }
    window.scrollTo(0, 0);
    observeReveal();
  }

  /* ---------- user state ---------- */
  function refreshUser() {
    const user = getUser();
    document.body.classList.toggle('logged-in', Boolean(user));
    $('#navUser').textContent = user || '';
    $('#navLogin').textContent = user ? 'Log out' : 'Log in';
    $('#welcome').textContent = user ? `Welcome, ${user}` : 'Welcome user';
    $('#dlWelcome').textContent = user ? `Welcome, ${user}` : '';
  }

  /* ---------- log in / sign in popup ---------- */
  function setMsg(text, type = '') {
    const el = $('#authMsg');
    el.textContent = text;
    el.className = `auth-msg ${type}`.trim();
  }

  function setMode(mode) {
    $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.mode === mode)));
    $('#loginForm').hidden = mode !== 'login';
    $('#signinForm').hidden = mode !== 'signin';
    setMsg('');
  }

  function openAuth(mode = 'login', next = null) {
    authNext = next;
    setMode(mode);
    $('#auth').classList.add('open');
    document.body.classList.add('locked');
    setTimeout(() => $('form:not([hidden]) input')?.focus(), 60);
  }

  function closeAuth() {
    authNext = null;
    $('#auth').classList.remove('open');
    document.body.classList.remove('locked');
  }

  $$('.tab').forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));
  $('#authClose').addEventListener('click', closeAuth);
  $('#auth').addEventListener('click', e => { if (e.target.id === 'auth') closeAuth(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAuth(); });

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#loginUser').value.trim();
    const pass = $('#loginPass').value;
    if (!name || !pass) return setMsg('Please enter your username and password.', 'error');

    const account = load('pts_users', {})[name.toLowerCase()];
    if (!account || account.hash !== await sha(pass)) return setMsg('Wrong username or password.', 'error');

    localStorage.setItem('pts_session', account.name);
    setMsg(`Welcome back, ${account.name}!`, 'success');
    const next = authNext;
    setTimeout(() => {
      closeAuth();
      refreshUser();
      location.hash = next || '#/';
      route();
    }, 500);
  });

  $('#signinForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#signUser').value.trim();
    const pass = $('#signPass').value;
    if (!/^[A-Za-z0-9_.]{3,20}$/.test(name)) return setMsg('Username: 3–20 letters, numbers, _ or .', 'error');
    if (RESERVED.includes(name.toLowerCase())) return setMsg('That username is reserved.', 'error');
    if (pass.length < 6 || pass.length > 128) return setMsg('Password must be 6 to 128 characters.', 'error');

    const all = load('pts_users', {});
    if (all[name.toLowerCase()]) return setMsg('That username is already taken.', 'error');
    all[name.toLowerCase()] = { name, hash: await sha(pass) };
    save('pts_users', all);

    e.target.reset();
    setMode('login');
    $('#loginUser').value = name;
    setMsg('Account created! Now log in.', 'success');
  });

  /* ---------- navbar buttons ---------- */
  $('#navLogin').addEventListener('click', () => {
    if (getUser()) {
      localStorage.removeItem('pts_session');
      refreshUser();
      location.hash = '#/';
      route();
    } else {
      openAuth('login');
    }
  });

  $('#startBtn').addEventListener('click', () => {
    if (getUser()) location.hash = '#/download';
    else openAuth('login', '#/download');
  });

  /* ---------- pay page ---------- */
  $$('input[name="method"]').forEach(r => r.addEventListener('change', () => {
    $$('.co-opt').forEach(o => o.classList.toggle('is-selected', o.querySelector('input').checked));
    $$('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== r.value; });
    $('#payHint').hidden = true;
    $('#payBtn').disabled = false;
  }));

  $('#payBtn').addEventListener('click', () => {
    const method = $('input[name="method"]:checked')?.value;
    const planId = Number($('#payBtn').dataset.plan);
    const plan = PLANS[planId];
    if (!method || !plan || !getUser()) return toast('Please choose a payment method.');

    const orders = load('pts_orders', []);
    const id = orders.length ? Math.max(...orders.map(o => o.id)) + 1 : 1;
    orders.push({
      id, user: getUser(), plan_id: planId, amount: plan.amount, unit: plan.unit,
      price: plan.price, payment_method: method, status: 'pending', created_at: new Date().toISOString(),
    });
    save('pts_orders', orders);
    save('pts_last_order', id);
    location.hash = '#/thanks';
  });

  /* ---------- navbar: scroll progress, shadow, mobile menu ---------- */
  const topbar = $('#topbar');
  const progress = $('.progress');
  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    topbar.classList.toggle('scrolled', scrollY > 40);
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);

  const menuBtn = $('#menuBtn');
  menuBtn.addEventListener('click', () => {
    const open = topbar.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  $$('#navLinks a').forEach(a => a.addEventListener('click', () => {
    topbar.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }));

  /* ---------- copy phone number ---------- */
  $$('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      toast('Number copied');
    } catch {
      toast('Could not copy the number');
    }
  }));

  /* ---------- scroll reveal ---------- */
  const revealIO = new IntersectionObserver((entries, obs) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        obs.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });
  function observeReveal() {
    $$('.reveal:not(.in)').forEach(el => revealIO.observe(el));
  }

  /* ---------- start ---------- */
  $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
  window.addEventListener('hashchange', route);
  refreshUser();
  $('#homePlans').innerHTML = [1, 2].map(id => planCard(id, 'product')).join('');
  $('#productPlans').innerHTML = Object.keys(PLANS).map(id => planCard(id, 'product')).join('');
  onScroll();
  route();
})();