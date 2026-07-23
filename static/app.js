/* ═══════════════════════════════════════════════════════
   4S BAZZAR — frontend app
   ═══════════════════════════════════════════════════════ */
'use strict';

const S = {
  token: localStorage.getItem('vs_token') || null,
  user: null,
  page: 'products',
  unread: 0,
  cache: {},
  theme: localStorage.getItem('vs_theme') || 'dark',
};
document.documentElement.dataset.theme = S.theme;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => 'Rs ' + (+n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDate = d => new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ── API ── */
// If the frontend is hosted separately from the backend, set window.API_BASE
// (e.g. <script>window.API_BASE='https://your-app.up.railway.app'</script> before app.js).
const API_BASE = (window.API_BASE || '').replace(/\/+$/, '');
async function api(path, opts = {}) {
  const res = await fetch(API_BASE + '/api' + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && S.user) { doLogout(true); throw new Error('Session expired'); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ── toast ── */
function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  $('#toast-root').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 3200);
}

/* ── modal ── */
function openModal(html) {
  const b = document.createElement('div');
  b.className = 'modal-backdrop';
  b.innerHTML = `<div class="modal">${html}</div>`;
  b.addEventListener('mousedown', e => { if (e.target === b) closeModal(); });
  $('#modal-root').appendChild(b);
  return b;
}
function closeModal() { const m = $('#modal-root').lastElementChild; if (m) m.remove(); }

/* ── premade icon library ── */
const ICONS = {
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/></svg>',
  laptop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="11" rx="2"/><path d="M2 19h20"/></svg>',
  tablet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="2" width="16" height="20" rx="3"/><path d="M11 18h2"/></svg>',
  watch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="6"/><path d="M9 3h6M9 21h6M12 9v3l2 2"/></svg>',
  headphones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="7" rx="2"/><rect x="17" y="14" width="4" height="7" rx="2"/></svg>',
  earbuds: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z"/><path d="M9 14v6M15 10a3 3 0 0 1 6 0v3a3 3 0 0 1-6 0z"/><path d="M18 16v4"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8h3l2-3h8l2 3h3v12H3z"/><circle cx="12" cy="13" r="4"/></svg>',
  console: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="7" width="20" height="10" rx="5"/><path d="M7 12h4M9 10v4M15.5 10.5h0M17.5 13.5h0"/></svg>',
  tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="2" width="14" height="20" rx="3"/><circle cx="12" cy="14" r="4"/><circle cx="12" cy="6" r="1.4"/></svg>',
  charger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
  cable: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20c6 0 4-16 10-16 4 0 4 5 0 5s-4-5 0-5"/><circle cx="4" cy="20" r="2"/></svg>',
  keyboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="7" width="20" height="11" rx="2"/><path d="M6 11h.01M10 11h.01M14 11h.01M18 11h.01M7 14.5h10"/></svg>',
  mouse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="2" width="10" height="20" rx="5"/><path d="M12 6v4"/></svg>',
  drone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="5" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.5"/><path d="M7 7l2.5 2.5M17 7l-2.5 2.5M7 17l2.5-2.5M17 17l-2.5-2.5"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 8v10l-9 4-9-4V8l9-4z"/><path d="M3 8l9 4 9-4M12 12v10"/></svg>',
};
function productIconHTML(p) {
  if (p.image) return `<img src="${p.image}" alt="" />`;
  return ICONS[p.icon] || ICONS.box;
}

/* ── nav icons ── */
const NAV_ICONS = {
  products: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 8v10l-9 4-9-4V8l9-4z"/><path d="M3 8l9 4 9-4M12 12v10"/></svg>',
  sold: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/></svg>',
  analysis: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18"/><path d="M7 14l4-5 3 3 5-7"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5 5h14l3 7v7H2v-7z"/></svg>',
  shifts: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  admin: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l8 3.5V11c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5.5z"/><path d="M9 12l2 2 4-4.5"/></svg>',
  creation: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/><rect x="2.5" y="2.5" width="19" height="19" rx="5"/></svg>',
  notready: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
  outstock: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 8v10l-9 4-9-4V8l9-4z"/><path d="M3 8l9 4 9-4M12 12v10"/><path d="M2 2l20 20" stroke-width="1.4"/></svg>',
};
const PAGES = [
  { id: 'products', label: 'Products', perm: 'page_products' },
  { id: 'notready', label: 'Not Ready', perm: 'page_notready' },
  { id: 'outstock', label: 'Out Stock', perm: 'page_outstock' },
  { id: 'creation', label: 'Creation', perm: 'page_creation' },
  { id: 'sold', label: 'Sold Out', perm: 'page_sold' },
  { id: 'analysis', label: 'Analysis', perm: 'page_analysis' },
  { id: 'inbox', label: 'Inbox', perm: 'page_inbox' },
  { id: 'shifts', label: 'Shift', perm: 'page_shifts' },
  { id: 'admin', label: 'Admin Panel', perm: 'page_admin' },
];

/* ═══ BOOT ═══ */
async function boot() {
  const t0 = Date.now();
  if (S.token) {
    try { const d = await api('/me'); S.user = d.user; } catch { S.token = null; localStorage.removeItem('vs_token'); }
  }
  const wait = Math.max(0, 1400 - (Date.now() - t0)); // let the splash breathe
  setTimeout(() => {
    $('#splash').classList.add('done');
    if (S.user) enterApp(); else showLogin();
  }, wait);
}

/* ═══ LOGIN ═══ */
function showLogin() {
  $('#login-screen').classList.remove('hidden');
  $('#app').classList.add('hidden');
  const input = $('#passkey');
  setTimeout(() => input.focus(), 150);
}
$('#key-eye').addEventListener('click', () => {
  const i = $('#passkey');
  i.type = i.type === 'password' ? 'text' : 'password';
});
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const key = $('#passkey').value.trim();
  const err = $('#login-error');
  err.classList.add('hidden');
  if (!key) { err.textContent = 'Please enter your passkey.'; err.classList.remove('hidden'); return; }
  const btn = $('#login-btn');
  btn.disabled = true;
  $('.btn-label', btn).textContent = 'Verifying…';
  $('.btn-spinner', btn).classList.remove('hidden');
  try {
    const d = await api('/login', { method: 'POST', body: { passkey: key } });
    S.token = d.token; S.user = d.user;
    localStorage.setItem('vs_token', d.token);
    $('#passkey').value = '';
    $('#login-screen').classList.add('hidden');
    enterApp();
    toast(`Welcome, ${d.user.name}!`, 'info');
  } catch (ex) {
    err.textContent = ex.message === 'Invalid passkey' ? 'Invalid passkey. Check with your admin.' : ex.message;
    err.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    $('.btn-label', btn).textContent = 'Unlock Shop';
    $('.btn-spinner', btn).classList.add('hidden');
  }
});

function doLogout(expired) {
  if (!expired) api('/logout', { method: 'POST' }).catch(() => {});
  S.token = null; S.user = null;
  localStorage.removeItem('vs_token');
  location.reload();
}
$('#logout-btn').addEventListener('click', () => doLogout(false));

/* ═══ APP SHELL ═══ */
function enterApp() {
  $('#app').classList.remove('hidden');
  renderSidebar();
  const first = PAGES.find(p => S.user.perms[p.perm]);
  go(first ? first.id : 'products');
  pollInbox();
}
function renderSidebar() {
  const nav = $('#sb-nav');
  nav.innerHTML = PAGES.filter(p => S.user.perms[p.perm]).map(p => `
    <button class="nav-item ${S.page === p.id ? 'active' : ''}" data-page="${p.id}">
      ${NAV_ICONS[p.id]}<span>${p.label}</span>
      ${p.id === 'inbox' && S.unread ? `<span class="nav-badge">${S.unread}</span>` : ''}
    </button>`).join('');
  $$('.nav-item', nav).forEach(b => b.addEventListener('click', () => { go(b.dataset.page); document.body.classList.remove('sb-open'); }));
  $('#sb-user').innerHTML = `
    <div class="avatar">${esc(S.user.name[0].toUpperCase())}</div>
    <div><div class="sb-user-name">${esc(S.user.name)}</div><div class="sb-user-role">${esc(S.user.role)}</div></div>`;
}
$('#menu-btn').addEventListener('click', () => document.body.classList.toggle('sb-open'));
// Overlay must live INSIDE #app: #app creates a stacking context (z-index:1), so an
// overlay on <body> would sit ABOVE the sidebar and swallow all taps on mobile.
(() => { const o = document.createElement('div'); o.id = 'sb-overlay'; o.addEventListener('click', () => document.body.classList.remove('sb-open')); $('#app').appendChild(o); })();

function go(page) {
  S.page = page;
  renderSidebar();
  const p = PAGES.find(x => x.id === page);
  $('#page-title').textContent = p ? p.label : page;
  $('#topbar-right').innerHTML = '';
  const view = $('#view');
  view.style.animation = 'none'; void view.offsetWidth; view.style.animation = '';
  ({ products: renderProducts, notready: renderNotReady, outstock: renderOutStock, creation: renderCreation, sold: renderSold, analysis: renderAnalysis, inbox: renderInbox, shifts: renderShifts, admin: renderAdmin }[page] || renderProducts)();
}

function skeletonGrid(n = 8) {
  return `<div class="product-grid">${Array.from({ length: n }, () => `<div class="skel" style="height:180px"></div>`).join('')}</div>`;
}
function emptyState(title, sub) {
  return `<div class="empty-state">
    <svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M21 8v10l-9 4-9-4V8l9-4z"/><path d="M3 8l9 4 9-4M12 12v10"/></svg>
    <div class="es-t">${esc(title)}</div><div>${esc(sub)}</div></div>`;
}

async function pollInbox() {
  if (!S.user.perms.page_inbox) return;
  try {
    const d = await api('/inbox');
    if (d.unread !== S.unread) { S.unread = d.unread; renderSidebar(); }
  } catch {}
  setTimeout(pollInbox, 25000);
}

/* ═══════════════════ PRODUCTS ═══════════════════ */
let prodCat = '';
async function renderProducts() {
  const view = $('#view');
  if (S.user.perms.can_add_product) {
    $('#topbar-right').innerHTML = `<button class="btn-gold btn-sm" id="add-prod-btn">+ Add Product</button>`;
    $('#add-prod-btn').addEventListener('click', () => productModal());
  }
  view.innerHTML = `
    <div class="toolbar">
      <div class="search-wrap">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input id="prod-search" placeholder="Search products…" />
      </div>
      <div id="cat-tabs" class="cat-tabs"></div>
    </div>
    <div id="prod-list">${skeletonGrid()}</div>`;
  let debounce;
  $('#prod-search').addEventListener('input', e => { clearTimeout(debounce); debounce = setTimeout(() => loadProducts(e.target.value), 250); });
  // category tabs
  try {
    const c = await api('/categories');
    S.cache.categories = c.categories;
    if (!c.categories.some(x => x.name === prodCat)) prodCat = '';
    const tabs = $('#cat-tabs');
    if (tabs) {
      tabs.innerHTML = `<button class="cat-tab ${!prodCat ? 'active' : ''}" data-cat="">All</button>` +
        c.categories.map(x => `<button class="cat-tab ${prodCat === x.name ? 'active' : ''}" data-cat="${esc(x.name)}">${esc(x.name)}</button>`).join('');
      $$('.cat-tab', tabs).forEach(b => b.addEventListener('click', () => {
        prodCat = b.dataset.cat;
        $$('.cat-tab', tabs).forEach(x => x.classList.toggle('active', x === b));
        loadProducts($('#prod-search')?.value || '');
      }));
    }
  } catch {}
  loadProducts('');
}
async function loadProducts(qs) {
  try {
    const params = new URLSearchParams();
    params.set('view', 'shop'); // only ready & in-stock products belong on the shop page
    if (qs) params.set('q', qs);
    if (prodCat) params.set('category', prodCat);
    const d = await api('/products?' + params);
    S.cache.products = d.products;
    const el = $('#prod-list');
    if (!el) return;
    if (!d.products.length) { el.innerHTML = emptyState('No products yet', S.user.perms.can_add_product ? 'Click “+ Add Product” to add your first item.' : 'Your admin hasn\'t added products yet.'); return; }
    el.innerHTML = `<div class="product-grid">` + d.products.map(p => `
      <div class="p-card ${p.pinned ? 'pinned' : ''}">
        ${p.pinned ? '<div class="pin-badge" title="Pinned">📌</div>' : ''}
        <div class="p-top">
          <div class="p-icon">${productIconHTML(p)}</div>
          <div style="min-width:0"><div class="p-name">${esc(p.name)}</div><div class="p-cat">${esc(p.category)}</div></div>
        </div>
        <div class="p-meta">
          <span class="chip gold">${money(p.price)}</span>
          ${p.cost !== undefined ? `<span class="chip">cost ${money(p.cost)}</span>` : ''}
          <span class="chip green">${p.qty} in stock</span>
        </div>
        <div class="p-actions">
          ${S.user.perms.can_sell ? `<button class="btn-gold" data-sell="${p.id}">Sold</button>` : ''}
          ${S.user.perms.can_edit_product ? `<button class="icon-btn" data-edit="${p.id}" title="Edit"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg></button>` : ''}
          ${S.user.perms.can_delete_product ? `<button class="icon-btn danger" data-del="${p.id}" title="Delete"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6"/></svg></button>` : ''}
        </div>
      </div>`).join('') + `</div>`;
    $$('[data-sell]', el).forEach(b => b.addEventListener('click', () => sellModal(b.dataset.sell)));
    $$('[data-edit]', el).forEach(b => b.addEventListener('click', () => productModal(b.dataset.edit)));
    $$('[data-del]', el).forEach(b => b.addEventListener('click', () => deleteProduct(b.dataset.del)));
  } catch (e) { toast(e.message, 'err'); }
}

/* ═══════════════════ NOT READY ═══════════════════ */
async function renderNotReady() {
  const view = $('#view');
  const canManage = S.user.perms.can_add_product || S.user.perms.can_edit_product || S.user.role === 'admin';
  view.innerHTML = `
    <div class="toolbar">
      <div class="search-wrap">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input id="nr-search" placeholder="Search not-ready products…" />
      </div>
    </div>
    <div id="nr-list">${skeletonGrid(4)}</div>`;
  let debounce;
  $('#nr-search').addEventListener('input', e => { clearTimeout(debounce); debounce = setTimeout(() => load(e.target.value), 250); });
  async function load(qs) {
    try {
      const params = new URLSearchParams({ view: 'notready' });
      if (qs) params.set('q', qs);
      const d = await api('/products?' + params);
      S.cache.products = d.products;
      const el = $('#nr-list'); if (!el) return;
      if (!d.products.length) { el.innerHTML = qs ? emptyState('No matches', 'No not-ready product matches your search.') : emptyState('Nothing waiting here', 'Products marked “not ready” during creation will show up here until you move them to the shop.'); return; }
      el.innerHTML = `<div class="product-grid">` + d.products.map(p => `
        <div class="p-card">
          <div class="p-top">
            <div class="p-icon">${productIconHTML(p)}</div>
            <div style="min-width:0"><div class="p-name">${esc(p.name)}</div><div class="p-cat">${esc(p.category)}</div></div>
          </div>
          <div class="p-meta">
            <span class="chip gold">${money(p.price)}</span>
            ${p.cost !== undefined ? `<span class="chip">cost ${money(p.cost)}</span>` : ''}
            <span class="chip">${p.qty} pcs</span>
            <span class="chip red">not ready</span>
          </div>
          <div class="p-actions">
            ${canManage ? `<button class="btn-gold" data-ready="${p.id}">✅ Move to Products</button>` : ''}
            ${S.user.perms.can_edit_product ? `<button class="icon-btn" data-edit="${p.id}" title="Edit"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg></button>` : ''}
            ${S.user.perms.can_delete_product ? `<button class="icon-btn danger" data-del="${p.id}" title="Delete"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6"/></svg></button>` : ''}
          </div>
        </div>`).join('') + `</div>`;
      $$('[data-ready]', el).forEach(b => b.addEventListener('click', async () => {
        try {
          await api(`/products/${b.dataset.ready}/ready`, { method: 'POST', body: { ready: true } });
          toast('Moved to Products ✅'); load($('#nr-search')?.value || '');
        } catch (e) { toast(e.message, 'err'); }
      }));
      $$('[data-edit]', el).forEach(b => b.addEventListener('click', () => productModal(b.dataset.edit)));
      $$('[data-del]', el).forEach(b => b.addEventListener('click', () => deleteProduct(b.dataset.del)));
    } catch (e) { toast(e.message, 'err'); }
  }
  load('');
}

/* ═══════════════════ OUT STOCK ═══════════════════ */
async function renderOutStock() {
  const view = $('#view');
  const canManage = S.user.perms.can_add_product || S.user.perms.can_edit_product || S.user.role === 'admin';
  view.innerHTML = `
    <div class="toolbar">
      <div class="search-wrap">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input id="os-search" placeholder="Search out-of-stock products…" />
      </div>
    </div>
    <div id="os-list">${skeletonGrid(4)}</div>`;
  let debounce;
  $('#os-search').addEventListener('input', e => { clearTimeout(debounce); debounce = setTimeout(() => load(e.target.value), 250); });
  async function load(qs) {
    try {
      const params = new URLSearchParams({ view: 'outstock' });
      if (qs) params.set('q', qs);
      const d = await api('/products?' + params);
      S.cache.products = d.products;
      const el = $('#os-list'); if (!el) return;
      if (!d.products.length) { el.innerHTML = qs ? emptyState('No matches', 'No out-of-stock product matches your search.') : emptyState('Nothing is out of stock', 'When a product\'s last piece is sold it moves here automatically until you restock it.'); return; }
      el.innerHTML = `<div class="product-grid">` + d.products.map(p => `
        <div class="p-card">
          <div class="p-top">
            <div class="p-icon">${productIconHTML(p)}</div>
            <div style="min-width:0"><div class="p-name">${esc(p.name)}</div><div class="p-cat">${esc(p.category)}</div></div>
          </div>
          <div class="p-meta">
            <span class="chip gold">${money(p.price)}</span>
            ${p.cost !== undefined ? `<span class="chip">cost ${money(p.cost)}</span>` : ''}
            <span class="chip red">Out of stock</span>
          </div>
          <div class="p-actions">
            ${canManage ? `<button class="btn-gold" data-restock="${p.id}">📦 Restock</button>` : ''}
            ${S.user.perms.can_delete_product ? `<button class="icon-btn danger" data-del="${p.id}" title="Delete"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6"/></svg></button>` : ''}
          </div>
        </div>`).join('') + `</div>`;
      $$('[data-restock]', el).forEach(b => b.addEventListener('click', () => restockModal(b.dataset.restock, () => load($('#os-search')?.value || ''))));
      $$('[data-del]', el).forEach(b => b.addEventListener('click', () => deleteProduct(b.dataset.del)));
    } catch (e) { toast(e.message, 'err'); }
  }
  load('');
}
function restockModal(id, onDone) {
  const p = S.cache.products.find(x => x.id === id);
  if (!p) return;
  const m = openModal(`
    <h3>Restock — ${esc(p.name)}</h3>
    <div class="m-sub">How many pieces did you get back in stock? The product will return to the Products page.</div>
    <div class="f-group"><label>Quantity to add</label><input id="rs-qty" type="number" min="1" step="1" value="1" /></div>
    <div class="modal-actions">
      <button class="btn-ghost" id="rs-cancel">Cancel</button>
      <button class="btn-gold" id="rs-confirm">Restock</button>
    </div>`);
  setTimeout(() => $('#rs-qty', m)?.focus(), 60);
  $('#rs-cancel', m).addEventListener('click', closeModal);
  $('#rs-confirm', m).addEventListener('click', async () => {
    const qty = Math.floor(+$('#rs-qty', m).value);
    if (!(qty > 0)) return toast('Enter a valid quantity', 'err');
    try {
      const d = await api(`/products/${id}/restock`, { method: 'POST', body: { qty } });
      closeModal();
      toast(`Restocked — ${d.product.qty} pcs now available ✅`);
      if (onDone) onDone();
    } catch (e) { toast(e.message, 'err'); }
  });
}

function refreshCurrentList() {
  // refresh whichever page the user is on after a product change
  if (S.page === 'notready') renderNotReady();
  else if (S.page === 'outstock') renderOutStock();
  else if (S.page === 'creation') loadCreation();
  else loadProducts($('#prod-search')?.value || '');
}
function productModal(editId) {
  const p = editId ? S.cache.products.find(x => x.id === editId) : null;
  let icon = p?.icon || 'phone';
  let image = p?.image || null;
  const m = openModal(`
    <h3>${p ? 'Edit Product' : 'Add Product'}</h3>
    <div class="m-sub">${p ? 'Update the details of this product.' : 'Add a product with what it cost you and the price you want to sell it at.'}</div>
    <div class="f-group"><label>Product name</label><input id="pm-name" value="${esc(p?.name || '')}" placeholder="e.g. iPhone 14 Pro" /></div>
    <div class="f-row">
      <div class="f-group"><label>Cost you paid (Rs)</label><input id="pm-cost" type="number" min="0" step="1" value="${p?.cost ?? ''}" placeholder="172000" /></div>
      <div class="f-group"><label>Sell price (Rs)</label><input id="pm-price" type="number" min="0" step="1" value="${p?.price ?? ''}" placeholder="220000" /></div>
    </div>
    <div class="f-row">
      <div class="f-group"><label>How many pieces?</label><input id="pm-qty" type="number" min="0" step="1" value="${p?.qty ?? ''}" placeholder="5" /></div>
      <div class="f-group"><label>Category</label><select id="pm-cat">${(S.cache.categories || []).map(c => `<option ${p?.category === c.name ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="__new">➕ New category…</option></select></div>
    </div>
    <div class="perm-item" style="margin-bottom:10px"><span>📌 Pin this product to the top</span><label class="toggle"><input type="checkbox" id="pm-pin" ${p?.pinned ? 'checked' : ''}/><span class="tk"></span></label></div>
    <div class="perm-item" style="margin-bottom:14px"><span>✅ Is this product ready? <small style="display:block;color:var(--dim)">If off, it goes to the “Not Ready” page instead of Products.</small></span><label class="toggle"><input type="checkbox" id="pm-ready" ${p ? (p.ready !== false ? 'checked' : '') : 'checked'}/><span class="tk"></span></label></div>
    <div class="f-group"><label>Pick a premade icon</label>
      <div class="icon-pick" id="pm-icons">${Object.keys(ICONS).map(k => `<div class="icon-opt ${!image && k === icon ? 'sel' : ''}" data-ic="${k}" title="${k}">${ICONS[k]}</div>`).join('')}</div>
    </div>
    <div class="f-group"><label>Or upload your own image</label>
      <div id="pm-upzone">${image
        ? `<div class="upload-preview"><img src="${image}" /><button type="button" class="btn-ghost btn-sm" id="pm-rmimg">Remove image</button></div>`
        : `<div class="upload-zone" id="pm-drop">📁 Click to upload an image / icon (PNG, JPG, WebP — max 300KB)</div>`}
      <input type="file" id="pm-file" accept="image/*" style="display:none" /></div>
    </div>
    <div class="modal-actions">
      <button class="btn-ghost" id="pm-cancel">Cancel</button>
      <button class="btn-gold" id="pm-save">${p ? 'Save changes' : 'Add product'}</button>
    </div>`);
  const rebindUpload = () => {
    const drop = $('#pm-drop', m); const rm = $('#pm-rmimg', m);
    if (drop) drop.addEventListener('click', () => $('#pm-file', m).click());
    if (rm) rm.addEventListener('click', () => { image = null; $('#pm-upzone', m).innerHTML = `<div class="upload-zone" id="pm-drop">📁 Click to upload an image / icon (PNG, JPG, WebP — max 300KB)</div>`; rebindUpload(); refreshIconSel(); });
  };
  const refreshIconSel = () => $$('.icon-opt', m).forEach(o => o.classList.toggle('sel', !image && o.dataset.ic === icon));
  rebindUpload();
  $$('.icon-opt', m).forEach(o => o.addEventListener('click', () => { icon = o.dataset.ic; image = null; $('#pm-upzone', m).innerHTML = `<div class="upload-zone" id="pm-drop">📁 Click to upload an image / icon (PNG, JPG, WebP — max 300KB)</div>`; rebindUpload(); refreshIconSel(); }));
  $('#pm-file', m).addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image(); const rd = new FileReader();
    rd.onload = () => { img.onload = () => {
      const c = document.createElement('canvas'); const sc = Math.min(1, 256 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      image = c.toDataURL('image/webp', 0.85);
      $('#pm-upzone', m).innerHTML = `<div class="upload-preview"><img src="${image}" /><button type="button" class="btn-ghost btn-sm" id="pm-rmimg">Remove image</button></div>`;
      rebindUpload(); refreshIconSel();
    }; img.src = rd.result; };
    rd.readAsDataURL(f);
  });
  $('#pm-cat', m).addEventListener('change', e => {
    if (e.target.value === '__new') {
      const name = prompt('New category name:');
      if (name && name.trim()) {
        const opt = document.createElement('option');
        opt.textContent = name.trim(); opt.selected = true;
        e.target.insertBefore(opt, e.target.lastElementChild);
      } else e.target.selectedIndex = 0;
    }
  });
  $('#pm-cancel', m).addEventListener('click', closeModal);
  $('#pm-save', m).addEventListener('click', async () => {
    const body = {
      name: $('#pm-name', m).value, cost: +$('#pm-cost', m).value || 0, price: +$('#pm-price', m).value || 0,
      qty: +$('#pm-qty', m).value || 0, category: $('#pm-cat', m).value === '__new' ? 'General' : ($('#pm-cat', m).value || 'General'),
      icon, image, pinned: $('#pm-pin', m).checked, ready: $('#pm-ready', m).checked,
    };
    if (!body.name.trim()) return toast('Product name is required', 'err');
    try {
      if (p) await api('/products/' + p.id, { method: 'PATCH', body });
      else await api('/products', { method: 'POST', body });
      closeModal();
      if (!body.ready) toast(p ? 'Saved — product is in “Not Ready” ⏳' : 'Product added to “Not Ready” ⏳ — move it to Products when it\'s ready');
      else toast(p ? 'Product updated' : 'Product added ✔');
      refreshCurrentList();
    } catch (e) { toast(e.message, 'err'); }
  });
}
async function deleteProduct(id) {
  const p = S.cache.products.find(x => x.id === id);
  const m = openModal(`<h3>Delete product?</h3><div class="m-sub">“${esc(p?.name)}” will be removed from the shop. Past sales are kept.</div>
    <div class="modal-actions"><button class="btn-ghost" id="dp-c">Cancel</button><button class="btn-danger" id="dp-y">Delete</button></div>`);
  $('#dp-c', m).addEventListener('click', closeModal);
  $('#dp-y', m).addEventListener('click', async () => {
    try { await api('/products/' + id, { method: 'DELETE' }); closeModal(); toast('Product deleted'); refreshCurrentList(); }
    catch (e) { toast(e.message, 'err'); }
  });
}

/* ═══ SELL FLOW ═══ */
function sellModal(id) {
  const p = S.cache.products.find(x => x.id === id);
  if (!p) return;
  const accs = [];
  const m = openModal(`
    <h3>Sell — ${esc(p.name)}</h3>
    <div class="m-sub">Fill in the sale details. Profit is calculated automatically.</div>
    <div class="f-row">
      <div class="f-group"><label>Storage (GB)</label><input id="sm-storage" placeholder="e.g. 256" /></div>
      <div class="f-group"><label>RAM (GB)</label><input id="sm-ram" placeholder="e.g. 8" /></div>
    </div>
    <div class="f-group"><label>Sold in (Rs) *</label><input id="sm-price" type="number" min="0" step="1" value="${p.price || ''}" /></div>
    <div class="f-group"><label>Accessories</label>
      <div id="sm-accs"></div>
      <button type="button" class="btn-ghost btn-sm" id="sm-addacc">+ Add accessory</button>
    </div>
    <div class="f-group"><label>Note (optional)</label><input id="sm-note" placeholder="Anything worth remembering…" /></div>
    ${p.cost !== undefined ? `<div class="profit-preview"><span>Estimated profit</span><b class="pos" id="sm-profit">${money((p.price || 0) - p.cost)}</b></div>` : ''}
    <div class="modal-actions">
      <button class="btn-ghost" id="sm-cancel">Cancel</button>
      <button class="btn-gold" id="sm-confirm">Confirm Sale</button>
    </div>`);
  const renderAccs = () => {
    $('#sm-accs', m).innerHTML = accs.map((a, i) => `
      <div class="acc-row acc-row-3">
        <input placeholder="Accessory name (e.g. Case)" value="${esc(a.name)}" data-an="${i}" />
        <input type="number" min="0" step="1" placeholder="Cost Rs" value="${a.cost || ''}" data-ac="${i}" title="What this accessory cost the shop" />
        <input type="number" min="0" step="1" placeholder="Selling Rs" value="${a.price || ''}" data-ap="${i}" title="What it was sold for" />
        <button type="button" class="icon-btn danger" data-ar="${i}" style="width:100%;height:100%"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
      </div>`).join('');
    $$('[data-an]', m).forEach(i2 => i2.addEventListener('input', e => { accs[+e.target.dataset.an].name = e.target.value; }));
    $$('[data-ac]', m).forEach(i2 => i2.addEventListener('input', e => { accs[+e.target.dataset.ac].cost = +e.target.value || 0; updProfit(); }));
    $$('[data-ap]', m).forEach(i2 => i2.addEventListener('input', e => { accs[+e.target.dataset.ap].price = +e.target.value || 0; updProfit(); }));
    $$('[data-ar]', m).forEach(b => b.addEventListener('click', () => { accs.splice(+b.dataset.ar, 1); renderAccs(); updProfit(); }));
  };
  const updProfit = () => {
    const el = $('#sm-profit', m); if (!el || p.cost === undefined) return;
    const val = (+$('#sm-price', m).value || 0) - p.cost + accs.reduce((s, a) => s + ((+a.price || 0) - (+a.cost || 0)), 0);
    el.textContent = money(val);
    el.className = val >= 0 ? 'pos' : 'neg';
  };
  $('#sm-addacc', m).addEventListener('click', () => {
    // accessory asks for name + cost + selling price
    accs.push({ name: '', cost: 0, price: 0 }); renderAccs();
    setTimeout(() => $$('[data-an]', m).pop()?.focus(), 40);
  });
  $('#sm-price', m).addEventListener('input', updProfit);
  $('#sm-cancel', m).addEventListener('click', closeModal);
  $('#sm-confirm', m).addEventListener('click', async () => {
    const soldPrice = +$('#sm-price', m).value;
    if (!(soldPrice > 0)) return toast('Enter the sold price', 'err');
    const body = {
      storage_gb: $('#sm-storage', m).value.trim() || null,
      ram_gb: $('#sm-ram', m).value.trim() || null,
      sold_price: soldPrice,
      accessories: accs.filter(a => a.name.trim()),
      note: $('#sm-note', m).value.trim() || null,
    };
    try {
      const d = await api(`/products/${id}/sell`, { method: 'POST', body });
      closeModal();
      if (d.remaining_qty <= 0) toast(`Sold! ${d.profit !== undefined ? 'Profit ' + money(d.profit) : ''} — last piece! Moved to Out Stock 📦`, 'info');
      else toast(`Sold! ${d.profit !== undefined ? 'Profit ' + money(d.profit) : ''} — ${d.remaining_qty} left`, 'ok');
      loadProducts($('#prod-search')?.value || '');
    } catch (e) { toast(e.message, 'err'); }
  });
}

/* ═══════════════════ SOLD OUT ═══════════════════ */
async function renderSold() {
  const view = $('#view');
  view.innerHTML = `<div id="sold-filters" class="filter-bar"></div><div id="sold-list"><div class="skel" style="height:260px"></div></div>`;
  const now = new Date();
  const filters = { year: '', month: '', day: '', seller: '' };
  const isAdm = S.user.role === 'admin';
  let sellerList = [];
  const fEl = $('#sold-filters');
  const drawFilters = (years = []) => {
    fEl.innerHTML = `
      <select id="sf-year"><option value="">All years</option>${years.map(y => `<option ${filters.year == y ? 'selected' : ''}>${y}</option>`).join('')}</select>
      <select id="sf-month"><option value="">All months</option>${MONTHS.map((mn, i) => `<option value="${i + 1}" ${filters.month == i + 1 ? 'selected' : ''}>${mn}</option>`).join('')}</select>
      <select id="sf-day"><option value="">All days</option>${Array.from({ length: 31 }, (_, i) => `<option ${filters.day == i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
      ${isAdm ? `<select id="sf-seller"><option value="">All workers</option>${sellerList.map(u => `<option value="${u.id}" ${filters.seller === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>` : ''}`;
    ['year', 'month', 'day', 'seller'].forEach(k => { const el = $('#sf-' + k); if (el) el.addEventListener('change', e => { filters[k] = e.target.value; load(); }); });
  };
  drawFilters([now.getFullYear(), now.getFullYear() - 1]);
  if (isAdm) api('/users').then(d => { sellerList = d.users; drawFilters([now.getFullYear(), now.getFullYear() - 1]); }).catch(() => {});
  async function load() {
    $('#sold-list').innerHTML = `<div class="skel" style="height:260px"></div>`;
    try {
      const qsp = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
      const d = await api('/sales?' + qsp);
      const el = $('#sold-list'); if (!el) return;
      if (!d.sales.length) { el.innerHTML = emptyState('No sales found', 'Try different filters, or sell something first!'); return; }
      const hasProfit = d.sales.some(s => s.profit !== undefined);
      el.innerHTML = `<div class="tbl-wrap"><table>
        <thead><tr><th>Product</th><th>Specs</th><th>Sold in</th><th>Accessories</th><th>Note</th>${hasProfit ? '<th>Profit</th>' : ''}<th>Seller</th><th>Date</th>${S.user.role === 'admin' ? '<th></th>' : ''}</tr></thead>
        <tbody>${d.sales.map(s => `<tr>
          <td><span class="strong">${esc(s.product_name)}</span></td>
          <td>${[s.storage_gb ? s.storage_gb + 'GB' : '', s.ram_gb ? s.ram_gb + 'GB RAM' : ''].filter(Boolean).join(' · ') || '—'}</td>
          <td class="strong">${money(s.sold_price)}</td>
          <td>${(s.accessories || []).length ? s.accessories.map(a => `${esc(a.name)} (${a.cost ? money(a.cost) + ' → ' : ''}${money(a.price)})`).join(', ') : '—'}</td>
          <td class="sale-note" title="${esc(s.note || '')}">${s.note ? '📝 ' + esc(s.note) : '—'}</td>
          ${hasProfit ? `<td class="${(s.profit ?? 0) >= 0 ? 'pos' : 'neg'}">${s.profit !== undefined ? money(s.profit) : '—'}</td>` : ''}
          <td>${esc(s.seller_name)}</td>
          <td>${fmtDate(s.date)}</td>
          ${S.user.role === 'admin' ? `<td><button class="icon-btn danger" data-ds="${s.id}" title="Delete & restock" style="width:30px;height:30px"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6"/></svg></button></td>` : ''}
        </tr>`).join('')}</tbody></table></div>
        <div style="margin-top:10px;color:var(--dim);font-size:.8rem">${d.total} sale${d.total === 1 ? '' : 's'}</div>`;
      $$('[data-ds]', el).forEach(b => b.addEventListener('click', async () => {
        try { await api('/sales/' + b.dataset.ds, { method: 'DELETE' }); toast('Sale removed & item restocked'); load(); } catch (e) { toast(e.message, 'err'); }
      }));
    } catch (e) { toast(e.message, 'err'); }
  }
  load();
}

/* ═══════════════════ ANALYSIS ═══════════════════ */
let charts = [];
function killCharts() { charts.forEach(c => c.destroy()); charts = []; }
Chart.defaults.color = '#9a95a8';
Chart.defaults.borderColor = 'rgba(255,255,255,.06)';
Chart.defaults.font.family = "'Outfit', sans-serif";

async function renderAnalysis() {
  killCharts();
  const view = $('#view');
  const canAll = S.user.perms.view_others_analysis || S.user.role === 'admin';
  const st = { scope: canAll ? 'all' : 'me', year: '', month: '', day: '', seller: '' };
  view.innerHTML = `
    <div class="filter-bar" id="an-filters"></div>
    <div id="an-body"><div class="stat-grid">${Array.from({ length: 4 }, () => '<div class="skel" style="height:100px"></div>').join('')}</div></div>`;
  function drawFilters(years = [], workers = []) {
    $('#an-filters').innerHTML = `
      ${canAll ? `<div class="seg"><button class="${st.scope === 'all' ? 'active' : ''}" data-sc="all">Shop</button><button class="${st.scope === 'me' ? 'active' : ''}" data-sc="me">My Analysis</button></div>` : `<span class="chip gold">My Analysis</span>`}
      <select id="af-year"><option value="">All years</option>${years.map(y => `<option ${st.year == y ? 'selected' : ''}>${y}</option>`).join('')}</select>
      <select id="af-month"><option value="">All months</option>${MONTHS.map((mn, i) => `<option value="${i + 1}" ${st.month == i + 1 ? 'selected' : ''}>${mn}</option>`).join('')}</select>
      <select id="af-day"><option value="">All days</option>${Array.from({ length: 31 }, (_, i) => `<option ${st.day == i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
      ${canAll && st.scope === 'all' ? `<select id="af-seller"><option value="">All workers</option>${workers.map(w => `<option value="${w.seller_id}" ${st.seller === w.seller_id ? 'selected' : ''}>${esc(w.seller_name)}</option>`).join('')}</select>` : ''}`;
    $$('[data-sc]').forEach(b => b.addEventListener('click', () => { st.scope = b.dataset.sc; st.seller = ''; load(); }));
    ['year', 'month', 'day', 'seller'].forEach(k => { const el = $('#af-' + k); if (el) el.addEventListener('change', e => { st[k] = e.target.value; load(); }); });
  }
  async function load() {
    try {
      const qsp = new URLSearchParams(Object.entries({ scope: st.scope, year: st.year, month: st.month, day: st.day, seller: st.seller }).filter(([, v]) => v));
      const d = await api('/analysis?' + qsp);
      drawFilters(d.years, d.workers.length ? d.workers : (S.cache.anWorkers || []));
      if (st.scope === 'all' && d.workers.length) S.cache.anWorkers = d.workers;
      killCharts();
      const body = $('#an-body'); if (!body) return;
      const t = d.totals, at = d.allTime;
      const periodLabel = st.day && st.month && st.year ? `${st.day} ${MONTHS[st.month - 1]} ${st.year}` : st.month && st.year ? `${MONTHS[st.month - 1]} ${st.year}` : st.year ? st.year : 'All time';
      body.innerHTML = `
        <div class="stat-grid">
          <div class="card card-gold stat"><div class="stat-label">${esc(periodLabel)} — Profit</div><div class="stat-value gold">${money(t.profit)}</div><div class="stat-sub">${t.count} sale${t.count === 1 ? '' : 's'} · ${t.accessories} accessories</div></div>
          <div class="card stat"><div class="stat-label">${esc(periodLabel)} — Revenue</div><div class="stat-value">${money(t.revenue)}</div><div class="stat-sub">incl. accessories</div></div>
          <div class="card stat"><div class="stat-label">All-time Profit</div><div class="stat-value green">${money(at.profit)}</div><div class="stat-sub">${at.count} total sales</div></div>
          ${d.topSeller && st.scope === 'all' ? `<div class="card stat"><div class="stat-label">Top Profit Maker 👑</div><div class="stat-value">${esc(d.topSeller.seller_name)}</div><div class="stat-sub">${money(d.topSeller.profit)} profit · ${d.topSeller.count} sales</div></div>` : `<div class="card stat"><div class="stat-label">All-time Revenue</div><div class="stat-value">${money(at.revenue)}</div><div class="stat-sub">${at.accessories} accessories sold</div></div>`}
        </div>
        <div class="grid-2">
          <div class="card chart-card"><div class="section-title" style="margin-bottom:14px">${st.year && !st.month ? 'Monthly profit — ' + st.year : 'Profit over time'}</div><canvas id="ch-line"></canvas></div>
          <div class="card chart-card"><div class="section-title" style="margin-bottom:14px">Profit by product</div><canvas id="ch-bar"></canvas></div>
        </div>
        ${st.scope === 'all' && d.workers.length ? `
          <div class="section-head"><div class="section-title">Worker Leaderboard</div></div>
          <div class="rank-list">${d.workers.map((w, i) => `
            <div class="rank">
              <div class="rank-pos">${i + 1}</div>
              <div class="avatar" style="width:32px;height:32px;font-size:.8rem">${esc(w.seller_name[0])}</div>
              <div><div class="rank-name">${esc(w.seller_name)} ${i === 0 ? '<span class="crown">👑 top seller</span>' : ''}</div><div class="rank-sub">${w.count} sales · ${w.accessories} accessories</div></div>
              <div class="rank-val"><b>${money(w.profit)}</b><div>${money(w.revenue)} revenue</div></div>
            </div>`).join('')}</div>` : ''}
        <div class="section-head"><div class="section-title">Best products (${esc(periodLabel)})</div></div>
        ${d.products.length ? `<div class="rank-list">${d.products.slice(0, 8).map((p, i) => `
          <div class="rank">
            <div class="rank-pos">${i + 1}</div>
            <div class="p-icon" style="width:34px;height:34px;border-radius:10px">${ICONS[p.icon] || ICONS.box}</div>
            <div><div class="rank-name">${esc(p.product_name)}</div><div class="rank-sub">${p.count} sold</div></div>
            <div class="rank-val"><b>${money(p.profit)}</b><div>${money(p.revenue)} revenue</div></div>
          </div>`).join('')}</div>` : emptyState('No sales in this period', 'Change the filters to see data.')}
        ${d.shiftLogs.length ? `
          <div class="section-head"><div class="section-title">Shift logs (${esc(periodLabel)})</div></div>
          <div class="tbl-wrap"><table><thead><tr><th>Worker</th><th>Started</th><th>Ended</th><th>Duration</th><th>Sales in shift</th></tr></thead>
          <tbody>${d.shiftLogs.map(s => `<tr>
            <td><span class="strong">${esc(s.user_name)}</span></td>
            <td>${fmtDate(s.start)}</td>
            <td>${s.end ? fmtDate(s.end) : '<span class="chip green">on shift now</span>'}</td>
            <td>${s.duration_min != null ? Math.floor(s.duration_min / 60) + 'h ' + (s.duration_min % 60) + 'm' : '—'}</td>
            <td>${s.sales_count ?? 0}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
      // line chart: monthly if year selected without month, else daily series
      const lineData = (st.year && !st.month)
        ? { labels: d.monthly.map(x => MONTHS[x.month - 1].slice(0, 3)), vals: d.monthly.map(x => x.profit) }
        : { labels: d.series.map(x => x.date.slice(5)), vals: d.series.map(x => x.profit) };
      const lc = $('#ch-line'); if (lc) {
        const g = lc.getContext('2d').createLinearGradient(0, 0, 0, 260);
        g.addColorStop(0, 'rgba(245,212,122,.35)'); g.addColorStop(1, 'rgba(245,212,122,0)');
        charts.push(new Chart(lc, { type: 'line', data: { labels: lineData.labels, datasets: [{ data: lineData.vals, borderColor: '#f5d47a', backgroundColor: g, fill: true, tension: .35, pointRadius: 3, pointBackgroundColor: '#c8912f' }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } }));
      }
      const bc = $('#ch-bar'); if (bc) {
        const top = d.products.slice(0, 6);
        charts.push(new Chart(bc, { type: 'bar', data: { labels: top.map(x => x.product_name.length > 14 ? x.product_name.slice(0, 13) + '…' : x.product_name), datasets: [{ data: top.map(x => x.profit), backgroundColor: 'rgba(245,212,122,.55)', borderColor: '#c8912f', borderWidth: 1, borderRadius: 7 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } }));
      }
    } catch (e) { toast(e.message, 'err'); }
  }
  drawFilters();
  load();
}

/* ═══════════════════ INBOX ═══════════════════ */
async function renderInbox() {
  const view = $('#view');
  view.innerHTML = `
    <div class="compose">
      <select id="ib-to"><option value="all">📣 Everyone</option></select>
      <input id="ib-text" placeholder="Write a message…" maxlength="1000" />
      <button class="btn-gold" id="ib-send">Send</button>
    </div>
    <div class="seg" style="margin-bottom:16px"><button class="active" data-ib="inbox">Inbox</button><button data-ib="sent">Sent</button></div>
    <div id="ib-list"><div class="skel" style="height:180px"></div></div>`;
  let tab = 'inbox', data = null;
  $$('[data-ib]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.ib; $$('[data-ib]').forEach(x => x.classList.toggle('active', x === b)); draw(); }));
  const draw = () => {
    const list = tab === 'inbox' ? data.inbox : data.sent;
    $('#ib-list').innerHTML = list.length ? `<div class="msg-list">${list.map(x => `
      <div class="msg ${tab === 'inbox' && !(x.read_by || []).includes(S.user.id) ? 'unread' : ''}">
        <div class="msg-head"><span class="msg-from">${tab === 'inbox' ? esc(x.from_name) : '→ ' + esc(x.to_name)}</span>${x.to === 'all' ? '<span class="chip gold" style="font-size:.68rem;padding:2px 8px">everyone</span>' : ''}<span class="msg-date">${fmtDate(x.date)}</span></div>
        <div class="msg-text">${esc(x.text)}</div>
      </div>`).join('')}</div>` : emptyState('Nothing here', tab === 'inbox' ? 'No messages received yet.' : 'You haven\'t sent any messages.');
  };
  async function load() {
    data = await api('/inbox');
    $('#ib-to').innerHTML = `<option value="all">📣 Everyone</option>` + data.recipients.map(r => `<option value="${r.id}">${esc(r.name)}${r.role === 'admin' ? ' (admin)' : ''}</option>`).join('');
    draw();
    if (data.unread) { await api('/inbox/read', { method: 'POST' }); S.unread = 0; renderSidebar(); }
  }
  $('#ib-send').addEventListener('click', async () => {
    const text = $('#ib-text').value.trim();
    if (!text) return;
    try { await api('/inbox', { method: 'POST', body: { to: $('#ib-to').value, text } }); $('#ib-text').value = ''; toast('Message sent ✔'); load(); }
    catch (e) { toast(e.message, 'err'); }
  });
  $('#ib-text').addEventListener('keydown', e => { if (e.key === 'Enter') $('#ib-send').click(); });
  load().catch(e => toast(e.message, 'err'));
}

/* ═══════════════════ SHIFTS ═══════════════════ */
let shiftTimer = null;
async function renderShifts() {
  clearInterval(shiftTimer);
  const view = $('#view');
  view.innerHTML = `<div class="skel" style="height:200px;margin-bottom:20px"></div><div class="skel" style="height:200px"></div>`;
  async function load() {
    try {
      const d = await api('/shifts/status');
      clearInterval(shiftTimer);
      const on = !!d.current;
      view.innerHTML = `
        <div class="shift-hero">
          <div class="shift-clock" id="sh-clock">${on ? '00:00:00' : '—:—:—'}</div>
          <div class="shift-state ${on ? 'on' : ''}">${on ? '<span class="pulse-dot"></span>On shift since ' + new Date(d.current.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Off shift'}</div>
          <button class="btn-gold" id="sh-toggle" style="min-width:190px">${on ? 'End Shift' : 'Start Shift'}</button>
        </div>
        ${d.onShift.length ? `<div class="section-head"><div class="section-title">On shift right now</div></div>
          <div class="on-shift-list">${d.onShift.map(o => `<div class="on-chip"><div class="avatar">${esc(o.user_name[0])}</div>${esc(o.user_name)}<span style="color:var(--dim);font-size:.75rem">since ${new Date(o.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>`).join('')}</div>` : ''}
        <div class="section-head"><div class="section-title">Shift history</div></div>
        ${d.history.length ? `<div class="tbl-wrap"><table>
          <thead><tr><th>Worker</th><th>Date</th><th>Start</th><th>End</th><th>Duration</th><th>Sales</th></tr></thead>
          <tbody>${d.history.map(s => `<tr>
            <td><span class="strong">${esc(s.user_name)}</span></td>
            <td>${new Date(s.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
            <td>${new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            <td>${new Date(s.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            <td>${Math.floor(s.duration_min / 60)}h ${s.duration_min % 60}m</td>
            <td>${s.sales_count}</td></tr>`).join('')}</tbody></table></div>` : emptyState('No shift history', 'Start your first shift above — every shift is logged for analysis.')}`;
      if (on) {
        const t0 = new Date(d.current.start).getTime();
        const tick = () => { const s = Math.floor((Date.now() - t0) / 1000); const el = $('#sh-clock'); if (!el) { clearInterval(shiftTimer); return; }
          el.textContent = String(Math.floor(s / 3600)).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
        tick(); shiftTimer = setInterval(tick, 1000);
      }
      $('#sh-toggle').addEventListener('click', async () => {
        try {
          if (on) { const r = await api('/shifts/end', { method: 'POST' }); toast(`Shift ended — ${r.shift.sales_count} sale(s) this shift`, 'info'); }
          else { await api('/shifts/start', { method: 'POST' }); toast('Shift started. Have a great one! ✨'); }
          load();
        } catch (e) { toast(e.message, 'err'); }
      });
    } catch (e) { toast(e.message, 'err'); }
  }
  load();
}

/* ═══════════════════ ADMIN PANEL ═══════════════════ */
const PERM_LABELS = {
  page_products: 'See Products page', page_notready: 'See Not Ready page', page_outstock: 'See Out Stock page',
  page_sold: 'See Sold Out page', page_analysis: 'See Analysis page',
  page_inbox: 'See Inbox page', page_shifts: 'See Shift page', page_admin: 'See Admin Panel',
  can_sell: 'Can sell products', can_add_product: 'Can add products', can_edit_product: 'Can edit products',
  can_delete_product: 'Can delete products', view_others_analysis: 'See other users\' analysis',
  manage_users: 'Manage users & passkeys', view_all_shifts: 'See everyone\'s shifts',
};
async function renderAdmin() {
  const view = $('#view');
  $('#topbar-right').innerHTML = `<button class="btn-gold btn-sm" id="add-user-btn">+ Create User</button>`;
  $('#add-user-btn').addEventListener('click', () => userModal());
  view.innerHTML = `<div id="adm-list"><div class="skel" style="height:260px"></div></div>`;
  async function load() {
    try {
      const d = await api('/users');
      S.cache.users = d.users;
      $('#adm-list').innerHTML = `
        <div class="section-head"><div class="section-title">Team & Passkeys</div><div class="grow"></div><span class="chip">${d.users.filter(u => u.active).length} active</span></div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>User</th><th>Role</th><th>Passkey</th><th>Created</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
          <tbody>${d.users.map(u => `<tr style="${u.active ? '' : 'opacity:.45'}">
            <td><div style="display:flex;align-items:center;gap:10px"><div class="avatar" style="width:30px;height:30px;font-size:.75rem;border-radius:9px">${esc(u.name[0])}</div><span class="strong">${esc(u.name)}</span>${u.id === S.user.id ? '<span class="chip gold" style="font-size:.66rem;padding:2px 8px">you</span>' : ''}</div></td>
            <td>${u.role === 'admin' ? '<span class="chip gold">admin</span>' : '<span class="chip">worker</span>'}</td>
            <td style="font-family:monospace">${esc(u.key_hint)} <span style="color:var(--dim);font-size:.72rem">(hash stored)</span></td>
            <td>${new Date(u.created_at).toLocaleDateString()}</td>
            <td>${u.active ? '<span class="chip green">active</span>' : '<span class="chip red">disabled</span>'}</td>
            <td style="text-align:right;white-space:nowrap">
              <button class="btn-ghost btn-sm" data-perm="${u.id}">Permissions</button>
              <button class="btn-ghost btn-sm" data-key="${u.id}">New key</button>
              ${u.id !== S.user.id ? `<button class="btn-ghost btn-sm" data-tgl="${u.id}">${u.active ? 'Disable' : 'Enable'}</button>` : ''}
            </td></tr>`).join('')}</tbody></table></div>
        <div class="card" style="margin-top:18px;font-size:.85rem;color:var(--muted);line-height:1.6">
          🔐 <b style="color:var(--gold)">How passkeys work:</b> when you create a user, 4S Bazzar generates a unique passkey and stores only its <b>SHA-256 hashcode</b>. The raw key is shown <b>once</b> — copy it and hand it to the worker. If it's lost, use “New key” to regenerate.
        </div>`;
      $$('[data-perm]').forEach(b => b.addEventListener('click', () => permModal(b.dataset.perm)));
      $$('[data-key]').forEach(b => b.addEventListener('click', () => regenKey(b.dataset.key)));
      $$('[data-tgl]').forEach(b => b.addEventListener('click', async () => {
        const u = S.cache.users.find(x => x.id === b.dataset.tgl);
        try { await api('/users/' + u.id, { method: 'PATCH', body: { active: !u.active } }); toast(u.active ? 'User disabled' : 'User enabled'); load(); }
        catch (e) { toast(e.message, 'err'); }
      }));
    } catch (e) { toast(e.message, 'err'); }
  }
  function userModal() {
    const m = openModal(`
      <h3>Create User</h3>
      <div class="m-sub">A unique passkey (hashcode-verified) will be generated for them.</div>
      <div class="f-row">
        <div class="f-group"><label>Name</label><input id="um-name" placeholder="e.g. Ali" /></div>
        <div class="f-group"><label>Role</label><select id="um-role"><option value="worker">Worker</option><option value="admin">Admin (all permissions)</option></select></div>
      </div>
      <div class="f-group"><label>Permissions</label>
        <div class="perm-grid">${Object.entries(PERM_LABELS).map(([k, l]) => `
          <div class="perm-item"><span>${l}</span><label class="toggle"><input type="checkbox" data-pk="${k}" ${['page_products','page_notready','page_outstock','page_sold','page_analysis','page_inbox','page_shifts','can_sell'].includes(k) ? 'checked' : ''}/><span class="tk"></span></label></div>`).join('')}
        </div>
      </div>
      <div class="modal-actions"><button class="btn-ghost" id="um-c">Cancel</button><button class="btn-gold" id="um-s">Create & generate passkey</button></div>`);
    $('#um-c', m).addEventListener('click', closeModal);
    $('#um-s', m).addEventListener('click', async () => {
      const name = $('#um-name', m).value.trim();
      if (!name) return toast('Name required', 'err');
      const perms = {}; $$('[data-pk]', m).forEach(c => perms[c.dataset.pk] = c.checked);
      try {
        const d = await api('/users', { method: 'POST', body: { name, role: $('#um-role', m).value, perms } });
        closeModal(); showKey(d.user.name, d.passkey); load();
      } catch (e) { toast(e.message, 'err'); }
    });
  }
  function showKey(name, key) {
    const m = openModal(`
      <h3>Passkey for ${esc(name)}</h3>
      <div class="m-sub">⚠️ This is shown <b>only once</b> — only its hashcode is stored on the server.</div>
      <div class="key-reveal"><div class="kr-code">${esc(key)}</div><div class="kr-note">Copy it and give it to ${esc(name)}. They'll use it to sign in.</div></div>
      <div class="modal-actions"><button class="btn-ghost" id="kk-copy">📋 Copy</button><button class="btn-gold" id="kk-done">Done</button></div>`);
    $('#kk-copy', m).addEventListener('click', () => { navigator.clipboard?.writeText(key); toast('Passkey copied'); });
    $('#kk-done', m).addEventListener('click', closeModal);
  }
  async function regenKey(id) {
    const u = S.cache.users.find(x => x.id === id);
    const m = openModal(`<h3>Regenerate passkey?</h3><div class="m-sub">${esc(u.name)}'s current key stops working immediately and their sessions are signed out.</div>
      <div class="modal-actions"><button class="btn-ghost" id="rk-c">Cancel</button><button class="btn-gold" id="rk-y">Regenerate</button></div>`);
    $('#rk-c', m).addEventListener('click', closeModal);
    $('#rk-y', m).addEventListener('click', async () => {
      try { const d = await api(`/users/${id}/regenerate-key`, { method: 'POST' }); closeModal(); showKey(u.name, d.passkey); load(); }
      catch (e) { toast(e.message, 'err'); }
    });
  }
  function permModal(id) {
    const u = S.cache.users.find(x => x.id === id);
    const m = openModal(`
      <h3>Permissions — ${esc(u.name)}</h3>
      <div class="m-sub">Control which pages ${esc(u.name)} can see and what they can do.</div>
      <div class="perm-grid">${Object.entries(PERM_LABELS).map(([k, l]) => `
        <div class="perm-item"><span>${l}</span><label class="toggle"><input type="checkbox" data-pk="${k}" ${u.perms[k] ? 'checked' : ''} ${u.id === S.user.id && (k === 'page_admin' || k === 'manage_users') ? 'disabled' : ''}/><span class="tk"></span></label></div>`).join('')}
      </div>
      <div class="modal-actions"><button class="btn-ghost" id="pmm-c">Cancel</button><button class="btn-gold" id="pmm-s">Save permissions</button></div>`);
    $('#pmm-c', m).addEventListener('click', closeModal);
    $('#pmm-s', m).addEventListener('click', async () => {
      const perms = {}; $$('[data-pk]', m).forEach(c => { if (!c.disabled) perms[c.dataset.pk] = c.checked; });
      try {
        await api('/users/' + id, { method: 'PATCH', body: { perms } });
        closeModal(); toast('Permissions saved ✔');
        if (id === S.user.id) { const me = await api('/me'); S.user = me.user; renderSidebar(); }
        load();
      } catch (e) { toast(e.message, 'err'); }
    });
  }
  load();
}

/* ═══════════════════ CREATION (drag & drop studio) ═══════════════════ */
async function renderCreation() {
  const view = $('#view');
  view.innerHTML = `
    <div class="grid-2" style="align-items:start">
      <div>
        <div class="section-head"><div class="section-title">Categories</div><div class="grow"></div>
          ${S.user.perms.can_add_product ? `<button class="btn-gold btn-sm" id="cr-addcat">+ Category</button>` : ''}</div>
        <div class="card" style="padding:14px">
          <div class="drag-hint">⠿ Drag to reorder — the order controls the tabs on the Products page.</div>
          <div id="cat-dnd" class="dnd-list"></div>
        </div>
      </div>
      <div>
        <div class="section-head"><div class="section-title">Products</div><div class="grow"></div>
          ${S.user.perms.can_add_product ? `<button class="btn-gold btn-sm" id="cr-addprod">+ Product</button>` : ''}</div>
        <div class="card" style="padding:14px">
          <div class="drag-hint">⠿ Drag to reorder · 📌 pin keeps a product at the top of the shop.</div>
          <div id="prod-dnd" class="dnd-list"></div>
        </div>
      </div>
    </div>`;
  $('#cr-addcat')?.addEventListener('click', () => categoryModal());
  $('#cr-addprod')?.addEventListener('click', () => productModal());
  loadCreation();
}
async function loadCreation() {
  try {
    const [c, p] = await Promise.all([api('/categories'), api('/products')]);
    S.cache.categories = c.categories;
    S.cache.products = p.products;
    const canEdit = S.user.perms.can_edit_product;
    const canDel = S.user.perms.can_delete_product;

    const catEl = $('#cat-dnd'); if (!catEl) return;
    catEl.innerHTML = c.categories.length ? c.categories.map(x => `
      <div class="dnd-item" draggable="${canEdit}" data-id="${x.id}">
        <span class="dnd-grip">⠿</span>
        <div class="p-icon" style="width:34px;height:34px;border-radius:10px">${ICONS[x.icon] || ICONS.box}</div>
        <div style="flex:1;min-width:0"><div class="rank-name">${esc(x.name)}</div>
          <div class="rank-sub">${S.cache.products.filter(pr => pr.category === x.name).length} products · ${S.cache.products.filter(pr => pr.category === x.name).reduce((s2, pr) => s2 + (+pr.qty || 0), 0)} pcs total</div></div>
        ${canEdit ? `<button class="icon-btn" data-catedit="${x.id}" title="Rename"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg></button>` : ''}
        ${canDel ? `<button class="icon-btn danger" data-catdel="${x.id}" title="Delete"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6"/></svg></button>` : ''}
      </div>`).join('') : emptyState('No categories', 'Create your first category.');

    const prodEl = $('#prod-dnd');
    prodEl.innerHTML = S.cache.products.length ? S.cache.products.map(x => `
      <div class="dnd-item ${x.pinned ? 'pinned' : ''}" draggable="${canEdit}" data-id="${x.id}">
        <span class="dnd-grip">⠿</span>
        <div class="p-icon" style="width:34px;height:34px;border-radius:10px">${productIconHTML(x)}</div>
        <div style="flex:1;min-width:0"><div class="rank-name">${esc(x.name)} ${x.pinned ? '📌' : ''}</div>
          <div class="rank-sub">${esc(x.category)} · ${money(x.price)} · ${x.qty} pcs</div></div>
        ${canEdit ? `<button class="icon-btn ${x.pinned ? 'pin-on' : ''}" data-pin="${x.id}" title="${x.pinned ? 'Unpin' : 'Pin to top'}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5M9 3h6l1 7 2.5 2.5H5.5L8 10z"/></svg></button>` : ''}
        ${canEdit ? `<button class="icon-btn" data-prodedit="${x.id}" title="Edit"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg></button>` : ''}
      </div>`).join('') : emptyState('No products', 'Create your first product.');

    // wire buttons
    $$('[data-catedit]').forEach(b => b.addEventListener('click', () => categoryModal(b.dataset.catedit)));
    $$('[data-catdel]').forEach(b => b.addEventListener('click', () => {
      const cat = S.cache.categories.find(x => x.id === b.dataset.catdel);
      const m = openModal(`<h3>Delete category?</h3><div class="m-sub">“${esc(cat.name)}” will be removed. Its products move to “General”.</div>
        <div class="modal-actions"><button class="btn-ghost" id="cd-c">Cancel</button><button class="btn-danger" id="cd-y">Delete</button></div>`);
      $('#cd-c', m).addEventListener('click', closeModal);
      $('#cd-y', m).addEventListener('click', async () => {
        try { await api('/categories/' + cat.id, { method: 'DELETE' }); closeModal(); toast('Category deleted'); loadCreation(); }
        catch (e) { toast(e.message, 'err'); }
      });
    }));
    $$('[data-pin]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await api(`/products/${b.dataset.pin}/pin`, { method: 'POST' }); toast(d.product.pinned ? '📌 Pinned to top' : 'Unpinned'); loadCreation(); }
      catch (e) { toast(e.message, 'err'); }
    }));
    $$('[data-prodedit]').forEach(b => b.addEventListener('click', () => productModal(b.dataset.prodedit)));

    // drag & drop
    if (canEdit) {
      enableDnD(catEl, order => api('/categories/reorder', { method: 'POST', body: { order } }).then(() => toast('Category order saved')).catch(e => toast(e.message, 'err')));
      enableDnD(prodEl, order => api('/products/reorder', { method: 'POST', body: { order } }).then(() => toast('Product order saved')).catch(e => toast(e.message, 'err')));
    }
  } catch (e) { toast(e.message, 'err'); }
}
function enableDnD(container, onDrop) {
  let dragging = null;
  container.addEventListener('dragstart', e => {
    const item = e.target.closest('.dnd-item'); if (!item) return;
    dragging = item; item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', item.dataset.id); } catch {}
  });
  container.addEventListener('dragend', () => {
    if (!dragging) return;
    dragging.classList.remove('dragging'); dragging = null;
    onDrop($$('.dnd-item', container).map(x => x.dataset.id));
  });
  container.addEventListener('dragover', e => {
    e.preventDefault();
    if (!dragging) return;
    const after = [...container.querySelectorAll('.dnd-item:not(.dragging)')].find(el => {
      const r = el.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    if (after) container.insertBefore(dragging, after); else container.appendChild(dragging);
  });
}
function categoryModal(editId) {
  const c = editId ? S.cache.categories.find(x => x.id === editId) : null;
  let icon = c?.icon || 'box';
  const m = openModal(`
    <h3>${c ? 'Rename Category' : 'New Category'}</h3>
    <div class="m-sub">${c ? 'Products in this category follow the new name.' : 'Group your products — categories appear as tabs on the Products page.'}</div>
    <div class="f-group"><label>Category name</label><input id="cm-name" value="${esc(c?.name || '')}" placeholder="e.g. Phones" /></div>
    <div class="f-group"><label>Icon</label>
      <div class="icon-pick">${Object.keys(ICONS).map(k => `<div class="icon-opt ${k === icon ? 'sel' : ''}" data-ic="${k}">${ICONS[k]}</div>`).join('')}</div>
    </div>
    <div class="modal-actions"><button class="btn-ghost" id="cm-c">Cancel</button><button class="btn-gold" id="cm-s">${c ? 'Save' : 'Create'}</button></div>`);
  $$('.icon-opt', m).forEach(o => o.addEventListener('click', () => { icon = o.dataset.ic; $$('.icon-opt', m).forEach(x => x.classList.toggle('sel', x === o)); }));
  $('#cm-c', m).addEventListener('click', closeModal);
  $('#cm-s', m).addEventListener('click', async () => {
    const name = $('#cm-name', m).value.trim();
    if (!name) return toast('Name required', 'err');
    try {
      if (c) await api('/categories/' + c.id, { method: 'PATCH', body: { name, icon } });
      else await api('/categories', { method: 'POST', body: { name, icon } });
      closeModal(); toast(c ? 'Category updated' : 'Category created ✔'); loadCreation();
    } catch (e) { toast(e.message, 'err'); }
  });
}

/* ═══════════════════ THEME TOGGLE ═══════════════════ */
function applyTheme(t) {
  S.theme = t;
  localStorage.setItem('vs_theme', t);
  document.documentElement.dataset.theme = t;
  const light = t === 'light';
  Chart.defaults.color = light ? '#6b6478' : '#9a95a8';
  Chart.defaults.borderColor = light ? 'rgba(20,15,35,.08)' : 'rgba(255,255,255,.06)';
  const btn = $('#theme-btn');
  if (btn) btn.innerHTML = themeIcon();
  if (S.page === 'analysis') renderAnalysis(); // re-theme charts
}
function themeIcon() {
  return S.theme === 'dark'
    ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/></svg>'
    : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
}
(() => {
  const bar = $('#topbar');
  const btn = document.createElement('button');
  btn.id = 'theme-btn'; btn.className = 'icon-btn'; btn.title = 'Light / dark mode';
  btn.innerHTML = themeIcon();
  btn.addEventListener('click', () => applyTheme(S.theme === 'dark' ? 'light' : 'dark'));
  bar.insertBefore(btn, $('#topbar-right'));
  applyTheme(S.theme);
})();

boot();
