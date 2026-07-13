// ===== 4S Bazzar Frontend =====
const state = {
  token: localStorage.getItem('4s_token') || null,
  user: null,
  products: [],
  categories: [],
  view: 'shop', // shop | soldout | analytics | admin
  search: '',
  categoryFilter: '',
  adminTab: 'products',
  theme: localStorage.getItem('4s_theme') || 'light',
  analyticsFilter: { mode: 'all', date: '', month: '', year: '' },
  perfFilter: { mode: 'all', date: '', month: '', from: '', to: '' },
  eventCursor: 0,
  eventTimer: null,
};

function applyTheme() {
  document.documentElement.classList.toggle('dark', state.theme === 'dark');
}
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('4s_theme', state.theme);
  applyTheme();
  const btn = document.getElementById('theme-btn');
  if (btn) btn.innerHTML = state.theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

const api = axios.create({ baseURL: window.API_BASE_URL || '/api' });
api.interceptors.request.use((cfg) => {
  if (state.token) cfg.headers.Authorization = 'Bearer ' + state.token;
  return cfg;
});
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response && err.response.status === 401 && state.user) {
      logout(false);
    }
    return Promise.reject(err);
  }
);

const $app = () => document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const pkr = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
const fmtDT = (s) => dayjs(s + (s && !s.includes('Z') && !s.includes('+') ? 'Z' : '')).format('DD MMM YYYY, hh:mm:ss A');

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ' +
    (type === 'success' ? 'bg-emerald-600' : 'bg-rose-600');
  el.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-2"></i>${esc(msg)}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function errMsg(e) {
  return (e.response && e.response.data && e.response.data.error) || 'Something went wrong';
}

// ===== AUTH =====
async function init() {
  applyTheme();
  if (state.token) {
    try {
      const { data } = await api.get('/me');
      state.user = data.user;
      await loadData();
      render();
      startEventPolling();
      return;
    } catch (e) { /* fallthrough to login */ }
  }
  renderLogin();
}

function renderLogin(error = '') {
  $app().innerHTML = `
  <main id="login-bg" class="min-h-screen flex items-center justify-center p-4">
    <section id="login-card" class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
      <header class="text-center mb-8">
        <img id="login-logo" src="static/logo.png" alt="4S Bazzar logo" class="mb-4">
        <h1 class="text-3xl font-extrabold text-slate-800">4S <span class="text-indigo-500">Bazzar</span></h1>
        <p class="text-slate-500 mt-1">Enter your 10-character passkey to continue</p>
      </header>
      ${error ? `<div class="bg-rose-50 text-rose-700 text-sm rounded-lg p-3 mb-4"><i class="fas fa-exclamation-circle mr-1"></i>${esc(error)}</div>` : ''}
      <form id="login-form">
        <div class="relative mb-4">
          <i class="fas fa-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input id="passkey-input" type="password" maxlength="10" autocomplete="off"
            class="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none text-lg tracking-widest text-center"
            placeholder="••••••••••">
        </div>
        <p id="key-count" class="text-xs text-slate-400 text-center mb-4">0 / 10 characters</p>
        <button type="submit" class="btn-grad w-full text-white font-bold py-3 rounded-xl transition">
          <i class="fas fa-right-to-bracket mr-2"></i>Enter Shop
        </button>
      </form>
      <p class="made-by text-center text-xs text-slate-400 mt-6"><i class="fas fa-code mr-1"></i>Made by <span class="font-semibold text-indigo-500">Ayan</span> &amp; <span class="font-semibold text-indigo-500">Ahad</span></p>
    </section>
  </main>`;

  const input = document.getElementById('passkey-input');
  input.focus();
  input.addEventListener('input', () => {
    document.getElementById('key-count').textContent = input.value.length + ' / 10 characters';
  });
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const passkey = input.value;
    if (passkey.length !== 10) return renderLogin('Passkey must be exactly 10 characters');
    try {
      const { data } = await api.post('/login', { passkey });
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('4s_token', data.token);
      await loadData();
      render();
      startEventPolling();
      toast('Welcome, ' + data.user.username + '!');
    } catch (err) {
      renderLogin(errMsg(err));
    }
  });
}

async function logout(callApi = true) {
  if (callApi) { try { await api.post('/logout'); } catch (e) {} }
  stopEventPolling();
  state.token = null; state.user = null;
  localStorage.removeItem('4s_token');
  renderLogin();
}

// ===== REAL-TIME NOTIFICATIONS (polling) =====
function startEventPolling() {
  stopEventPolling();
  let tick = 0;
  const poll = async () => {
    if (!state.token) return;
    try {
      const { data } = await api.get('/events', { params: { since: state.eventCursor } });
      state.eventCursor = data.cursor;
      (data.events || []).forEach(ev => {
        const isIn = ev.type === 'in';
        showShiftNotification(ev.username, isIn);
        // live-refresh the shifts page if open
        if (state.view === 'shifts') renderShifts(document.getElementById('main-content'));
      });
      // every ~30s re-sync my permissions (e.g. admin granted/revoked Analytics/Sold access)
      if (++tick % 6 === 0) {
        const { data: me } = await api.get('/me');
        if (me.user && (me.user.can_analytics !== state.user.can_analytics || me.user.can_sold !== state.user.can_sold || me.user.role !== state.user.role)) {
          const gainedA = me.user.can_analytics && !state.user.can_analytics;
          const gainedS = me.user.can_sold && !state.user.can_sold;
          state.user = me.user;
          toast(gainedA ? 'You have been granted Shop Analytics access'
            : gainedS ? 'You have been granted Sold page access'
            : 'Your permissions were updated');
          render(); // rebuild nav (adds/removes tabs; kicks off blocked view if revoked)
        }
      }
    } catch (e) { /* silent */ }
  };
  poll();
  state.eventTimer = setInterval(poll, 5000); // poll every 5s
}
function stopEventPolling() {
  if (state.eventTimer) { clearInterval(state.eventTimer); state.eventTimer = null; }
}

function showShiftNotification(username, isIn) {
  const el = document.createElement('div');
  el.className = 'toast px-4 py-3 rounded-xl shadow-2xl text-white text-sm font-medium ' +
    (isIn ? 'bg-emerald-600' : 'bg-slate-700');
  el.style.bottom = (1.5 + document.querySelectorAll('.toast').length * 4) + 'rem';
  el.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-full ${isIn?'bg-emerald-500':'bg-slate-600'} flex items-center justify-center shrink-0">
        <i class="fas ${isIn?'fa-right-to-bracket':'fa-right-from-bracket'}"></i>
      </div>
      <div>
        <p class="font-bold">${esc(username)} ${isIn ? 'clocked IN' : 'clocked OUT (Quit)'}</p>
        <p class="text-xs opacity-80">${isIn ? 'Now on shift' : 'Shift ended'} · ${dayjs().format('hh:mm A')}</p>
      </div>
    </div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

// ===== DATA =====
async function loadData() {
  const [p, cat] = await Promise.all([
    api.get('/products', { params: { q: state.search || undefined, category_id: state.categoryFilter || undefined } }),
    api.get('/categories'),
  ]);
  state.products = p.data.products;
  state.categories = cat.data.categories;
}

async function refreshProducts() {
  const { data } = await api.get('/products', { params: { q: state.search || undefined, category_id: state.categoryFilter || undefined } });
  state.products = data.products;
}

// ===== LAYOUT =====
function render() {
  const isAdmin = state.user.role === 'admin';
  const canAnalytics = isAdmin || !!state.user.can_analytics;
  const canSold = isAdmin || !!state.user.can_sold;
  if (state.view === 'analytics' && !canAnalytics) state.view = 'shop';
  if (state.view === 'sold' && !canSold) state.view = 'shop';
  $app().innerHTML = `
  <nav id="main-nav" class="bg-slate-900 text-white sticky top-0 z-40 shadow-lg">
    <div class="max-w-7xl mx-auto px-4">
      <div class="flex items-center justify-between h-16 gap-4">
        <a href="#" id="nav-brand" class="flex items-center gap-2.5 shrink-0">
          <img id="nav-logo" src="static/logo.png" alt="4S Bazzar logo">
          <span class="brand-text text-lg font-extrabold hidden sm:inline">4S Bazzar</span>
        </a>
        <div class="relative flex-1 max-w-xl">
          <i class="fas fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input id="search-input" type="text" value="${esc(state.search)}" placeholder="Search products..."
            class="w-full pl-11 pr-4 py-2 rounded-full bg-slate-800 border border-slate-700 focus:border-indigo-500 focus:outline-none text-sm">
        </div>
        <div class="flex items-center gap-1 sm:gap-2 shrink-0">
          <button data-view="shop" class="nav-btn px-3 py-2 text-sm font-semibold ${state.view==='shop'?'active':''}" title="Shop"><i class="fas fa-bag-shopping sm:mr-1.5"></i><span class="hidden sm:inline">Shop</span></button>
          ${canSold ? `<button data-view="sold" class="nav-btn px-3 py-2 text-sm font-semibold ${state.view==='sold'?'active':''}" title="Sold items"><i class="fas fa-circle-check sm:mr-1.5"></i><span class="hidden sm:inline">Sold</span></button>` : ''}
          <button data-view="reports" class="nav-btn px-3 py-2 text-sm font-semibold ${state.view==='reports'?'active':''}" title="Sales report"><i class="fas fa-file-invoice sm:mr-1.5"></i><span class="hidden sm:inline">Reports</span></button>
          <button data-view="shifts" class="nav-btn px-3 py-2 text-sm font-semibold ${state.view==='shifts'?'active':''}" title="Shift tracking"><i class="fas fa-clock sm:mr-1.5"></i><span class="hidden sm:inline">Shifts</span></button>
          ${canAnalytics ? `<button data-view="analytics" class="nav-btn px-3 py-2 text-sm font-semibold ${state.view==='analytics'?'active':''}" title="Shop analytics"><i class="fas fa-chart-line sm:mr-1.5"></i><span class="hidden sm:inline">Analytics</span></button>` : ''}
          ${isAdmin ? `<button data-view="admin" class="nav-btn px-3 py-2 text-sm font-semibold ${state.view==='admin'?'active':''}" title="Admin panel"><i class="fas fa-user-shield sm:mr-1.5"></i><span class="hidden sm:inline">Admin</span></button>` : ''}
          <div class="w-px h-6 bg-slate-700/60 mx-1"></div>
          <span id="user-chip" class="hidden md:inline-flex items-center gap-1.5 text-xs text-indigo-200 px-2.5 py-1.5 rounded-full"><i class="fas fa-user text-[10px]"></i>${esc(state.user.username)}<span class="opacity-60">· ${state.user.role}</span></span>
          <button id="theme-btn" class="nav-btn px-3 py-2 text-sm text-amber-300" title="Toggle light/dark theme">${state.theme==='dark'?'<i class="fas fa-sun"></i>':'<i class="fas fa-moon"></i>'}</button>
          <button id="logout-btn" class="nav-btn px-3 py-2 text-sm text-rose-400" title="Logout"><i class="fas fa-right-from-bracket"></i></button>
        </div>
      </div>
    </div>
  </nav>
  <main id="main-content" class="max-w-7xl mx-auto px-4 py-6"></main>
  <footer id="app-footer" class="text-center py-6 text-xs text-slate-400">
    <i class="fas fa-code mr-1"></i>Made by <span class="font-semibold text-indigo-500">Ayan</span> &amp; <span class="font-semibold text-indigo-500">Ahad</span>
  </footer>
  <div id="watermark" aria-hidden="true">Made by Ayan &amp; Ahad</div>
  <div id="modal-root"></div>`;

  document.getElementById('nav-brand').onclick = (e) => { e.preventDefault(); switchView('shop'); };
  document.querySelectorAll('.nav-btn').forEach(b => b.onclick = () => switchView(b.dataset.view));
  document.getElementById('logout-btn').onclick = () => logout();
  document.getElementById('theme-btn').onclick = toggleTheme;

  let searchTimer;
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.search = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      await refreshProducts();
      if (state.view !== 'shop') { state.view = 'shop'; render(); }
      else renderView();
    }, 300);
  });

  renderView();
}

function switchView(v) {
  state.view = v;
  render();
}

function renderView() {
  const el = document.getElementById('main-content');
  if (state.view === 'shop') renderShop(el);
  else if (state.view === 'sold') {
    if (state.user.role === 'admin' || state.user.can_sold) renderSold(el);
    else { state.view = 'shop'; renderShop(el); }
  }
  else if (state.view === 'reports') renderReports(el);
  else if (state.view === 'shifts') renderShifts(el);
  else if (state.view === 'analytics') {
    if (state.user.role === 'admin' || state.user.can_analytics) renderShopAnalytics(el);
    else { state.view = 'shop'; renderShop(el); }
  }
  else if (state.view === 'admin') renderAdmin(el);
}

window.addEventListener('DOMContentLoaded', init);

// ===== SHOP VIEW =====
function renderShop(el) {
  const isAdmin = state.user.role === 'admin';
  // Sold-out products are removed from the shop page — they live in the Sold page
  const inStock = state.products.filter(p => p.quantity > 0);
  const soldOutCount = state.products.length - inStock.length;
  el.innerHTML = `
  <section id="shop-view" class="fade-in">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
      <h2 class="text-2xl font-bold text-slate-800"><i class="fas fa-bag-shopping text-indigo-600 mr-2"></i>Products <span class="text-sm font-normal text-slate-400">(${inStock.length} in stock${soldOutCount?` · ${soldOutCount} sold out moved to Sold page`:''})</span></h2>
      <div class="flex items-center gap-2">
        <select id="category-filter" class="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm">
          <option value="">All Categories</option>
          ${state.categories.map(c => `<option value="${c.id}" ${String(state.categoryFilter)===String(c.id)?'selected':''}>${esc(c.name)} (${c.product_count})</option>`).join('')}
        </select>
        ${isAdmin ? `<button id="add-product-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-plus mr-1"></i>Add Product</button>` : ''}
      </div>
    </div>
    <div id="product-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      ${inStock.length ? inStock.map(productCard).join('') :
        `<div class="col-span-full text-center py-16 text-slate-400">
          <i class="fas fa-box-open text-5xl mb-3"></i>
          <p class="font-medium">No products in stock</p>
          ${isAdmin ? '<p class="text-sm mt-1">Click "Add Product" to add your first product.</p>' : ''}
        </div>`}
    </div>
  </section>`;

  document.getElementById('category-filter').onchange = async (e) => {
    state.categoryFilter = e.target.value;
    await refreshProducts();
    renderView();
  };
  const addBtn = document.getElementById('add-product-btn');
  if (addBtn) addBtn.onclick = () => openProductForm();

  bindProductCardActions(el);
}

function bindProductCardActions(el) {
  el.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => sellProduct(Number(b.dataset.sell), Number(b.dataset.qty)));
  el.querySelectorAll('[data-sell-custom]').forEach(b => b.onclick = () => sellCustom(Number(b.dataset.sellCustom)));
  el.querySelectorAll('[data-analytics]').forEach(b => b.onclick = () => openProductAnalytics(Number(b.dataset.analytics)));
  el.querySelectorAll('[data-pin]').forEach(b => b.onclick = () => togglePin(Number(b.dataset.pin)));
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
    const p = state.products.find(x => x.id === Number(b.dataset.edit));
    openProductForm(p);
  });
  el.querySelectorAll('[data-delete]').forEach(b => b.onclick = () => deleteProduct(Number(b.dataset.delete)));
}

async function togglePin(id) {
  try {
    const { data } = await api.post(`/products/${id}/pin`);
    toast(data.pinned ? 'Pinned to top' : 'Unpinned');
    await refreshProducts();
    renderView();
  } catch (e) { toast(errMsg(e), 'error'); }
}

// ===== SOLD PAGE =====
// Every sale (single or batch) becomes its own card with date, time, details & salesperson.
// Fully sold-out products are also listed here (moved off the shop page).
async function renderSold(el) {
  el.innerHTML = `<div class="text-center py-16 text-slate-400"><i class="fas fa-spinner fa-spin text-3xl"></i><p class="mt-2">Loading sold items...</p></div>`;
  let data;
  try { ({ data } = await api.get('/sales/report')); }
  catch (e) { el.innerHTML = `<p class="text-rose-600">${esc(errMsg(e))}</p>`; return; }

  const isAdmin = state.user.role === 'admin';
  const soldOut = state.products.filter(p => p.quantity <= 0);

  const saleCard = (s) => {
    const dt = dayjs(s.sold_at + (s.sold_at && !s.sold_at.includes('Z') ? 'Z' : ''));
    return `
    <article class="sale-card bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden" id="sale-${s.id}">
      <div class="bg-emerald-600 text-white px-4 py-2 flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-wide"><i class="fas fa-circle-check mr-1"></i>Sold ${s.quantity}x</span>
        <span class="text-xs opacity-90"><i class="far fa-clock mr-1"></i>${dt.format('DD MMM YYYY')} · ${dt.format('hh:mm A')}</span>
      </div>
      <div class="p-4">
        <h3 class="font-bold text-slate-800 mb-2">${esc(s.product_name || '(deleted product)')}</h3>
        <div class="flex flex-wrap gap-1 mb-3">
          ${s.category_name ? `<span class="badge bg-indigo-50 text-indigo-700"><i class="fas fa-tag"></i>${esc(s.category_name)}</span>` : ''}
          ${s.ram ? `<span class="badge bg-slate-100 text-slate-600"><i class="fas fa-memory"></i>${esc(s.ram)}</span>` : ''}
          ${s.storage ? `<span class="badge bg-slate-100 text-slate-600"><i class="fas fa-hard-drive"></i>${esc(s.storage)}</span>` : ''}
        </div>
        <div class="grid grid-cols-2 gap-2 text-sm mb-3">
          <div class="bg-slate-50 rounded-lg px-3 py-2">
            <p class="text-[10px] font-bold uppercase text-slate-400">Sale Price</p>
            <p class="font-extrabold text-slate-800">${pkr(s.unit_price)}</p>
          </div>
          <div class="bg-emerald-50 rounded-lg px-3 py-2">
            <p class="text-[10px] font-bold uppercase text-emerald-500">Profit${s.quantity>1?' /unit':''}</p>
            <p class="font-extrabold text-emerald-600">${pkr(s.unit_profit)}</p>
          </div>
          ${s.quantity > 1 ? `
          <div class="bg-slate-50 rounded-lg px-3 py-2 col-span-2">
            <p class="text-[10px] font-bold uppercase text-slate-400">Total (${s.quantity} units)</p>
            <p class="font-extrabold text-slate-800">${pkr(s.quantity*s.unit_price)} <span class="text-emerald-600 text-xs font-bold ml-1">+${pkr(s.quantity*s.unit_profit)} profit</span></p>
          </div>` : ''}
        </div>
        <div class="flex items-center justify-between border-t border-slate-100 pt-2.5">
          <span class="badge bg-indigo-50 text-indigo-700"><i class="fas fa-user"></i>${esc(s.sold_by_name || 'Unknown')}</span>
          <button data-analytics="${s.product_id}" class="text-xs font-semibold text-indigo-500 hover:text-indigo-700"><i class="fas fa-chart-line mr-1"></i>Product analysis</button>
        </div>
      </div>
    </article>`;
  };

  el.innerHTML = `
  <section id="sold-view" class="fade-in">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
      <h2 class="text-2xl font-bold text-slate-800"><i class="fas fa-circle-check text-emerald-600 mr-2"></i>Sold Items <span class="text-sm font-normal text-slate-400">(${data.sales.length} sale${data.sales.length===1?'':'s'})</span></h2>
      <div class="flex flex-wrap gap-3 text-sm">
        <span class="bg-white rounded-lg shadow px-3 py-1.5 font-semibold text-slate-700">${data.totals.units} units</span>
        <span class="bg-white rounded-lg shadow px-3 py-1.5 font-semibold text-slate-700">${pkr(data.totals.revenue)} revenue</span>
        ${isAdmin?`<span class="bg-white rounded-lg shadow px-3 py-1.5 font-semibold text-emerald-600">${pkr(data.totals.profit)} profit</span>`:''}
      </div>
    </div>

    ${soldOut.length ? `
    <div class="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-5">
      <p class="text-xs font-bold uppercase text-rose-500 mb-2"><i class="fas fa-box-open mr-1"></i>Out of stock — removed from shop page (${soldOut.length})</p>
      <div class="flex flex-wrap gap-2">
        ${soldOut.map(p=>`<span class="badge bg-white text-slate-700 shadow-sm !text-xs !py-1.5 !px-3">${esc(p.name)} <span class="text-slate-400">· ${p.total_sold} sold</span>${state.user.role==='admin'?` <button data-restock="${p.id}" class="text-indigo-500 hover:underline ml-1" title="Edit to restock"><i class="fas fa-pen"></i></button>`:''}</span>`).join('')}
      </div>
    </div>` : ''}

    ${data.sales.length ? `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      ${data.sales.map(saleCard).join('')}
    </div>` : `
    <div class="text-center py-20 text-slate-400 bg-white rounded-xl shadow">
      <i class="fas fa-receipt text-5xl mb-3"></i>
      <p class="font-medium text-slate-600">No sales yet</p>
      <p class="text-sm mt-1">Sold items will appear here as cards with date, time and seller.</p>
    </div>`}
  </section>`;

  el.querySelectorAll('[data-analytics]').forEach(b => b.onclick = () => openProductAnalytics(Number(b.dataset.analytics)));
  el.querySelectorAll('[data-restock]').forEach(b => b.onclick = () => openProductForm(state.products.find(x=>x.id===Number(b.dataset.restock))));
}

// ===== SALES REPORT DASHBOARD =====
// Accessible to admin AND salespersons. Shows RAM, storage, item, sale price and auto profit.
async function renderReports(el) {
  el.innerHTML = `<div class="text-center py-16 text-slate-400"><i class="fas fa-spinner fa-spin text-3xl"></i><p class="mt-2">Loading sales report...</p></div>`;
  const isAdmin = state.user.role === 'admin';
  const rf = state.reportFilter || (state.reportFilter = { mode: 'all', date: '', month: '', year: '', mine: !isAdmin, user_id: '' });

  const params = {};
  if (rf.mode === 'date' && rf.date) params.date = rf.date;
  if (rf.mode === 'month' && rf.month) params.month = rf.month;
  if (rf.mode === 'year' && rf.year) params.year = rf.year;
  if (rf.mine) params.mine = '1';
  else if (isAdmin && rf.user_id) params.user_id = rf.user_id;

  let data;
  try { ({ data } = await api.get('/sales/report', { params })); }
  catch (e) { el.innerHTML = `<p class="text-rose-600">${esc(errMsg(e))}</p>`; return; }

  const filterLabel = params.date ? dayjs(params.date).format('DD MMM YYYY')
    : params.month ? dayjs(params.month + '-01').format('MMMM YYYY')
    : params.year ? 'Year ' + params.year : 'All Time';
  const scopeLabel = rf.mine ? 'My sales' : (rf.user_id ? (data.sellers.find(s=>String(s.id)===String(rf.user_id))||{}).username || 'User' : 'All sellers');

  el.innerHTML = `
  <section id="reports-view" class="fade-in">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
      <h2 class="text-2xl font-bold text-slate-800"><i class="fas fa-file-invoice text-indigo-600 mr-2"></i>Sales Report <span class="text-sm font-normal text-slate-400">${scopeLabel} · ${filterLabel}</span></h2>
      <div class="flex flex-wrap items-center gap-2 bg-white rounded-xl shadow px-3 py-2">
        <select id="rf-scope" class="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-sm">
          <option value="mine" ${rf.mine?'selected':''}>My sales only</option>
          ${isAdmin ? `<option value="all" ${!rf.mine&&!rf.user_id?'selected':''}>All sellers</option>
          ${data.sellers.map(s=>`<option value="u${s.id}" ${!rf.mine&&String(rf.user_id)===String(s.id)?'selected':''}>${esc(s.username)}</option>`).join('')}` : ''}
        </select>
        <select id="rf-mode" class="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-sm">
          <option value="all" ${rf.mode==='all'?'selected':''}>All Time</option>
          <option value="date" ${rf.mode==='date'?'selected':''}>Date</option>
          <option value="month" ${rf.mode==='month'?'selected':''}>Month</option>
          <option value="year" ${rf.mode==='year'?'selected':''}>Year</option>
        </select>
        <input type="date" id="rf-date" value="${rf.date || dayjs().format('YYYY-MM-DD')}" class="px-2 py-1.5 rounded-lg border border-slate-300 text-sm ${rf.mode==='date'?'':'hidden'}">
        <input type="month" id="rf-month" value="${rf.month || dayjs().format('YYYY-MM')}" class="px-2 py-1.5 rounded-lg border border-slate-300 text-sm ${rf.mode==='month'?'':'hidden'}">
        <input type="number" id="rf-year" value="${rf.year || dayjs().format('YYYY')}" min="2020" max="2100" class="px-2 py-1.5 rounded-lg border border-slate-300 text-sm w-24 ${rf.mode==='year'?'':'hidden'}">
        <button id="rf-apply" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold">Apply</button>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <div class="bg-white rounded-xl shadow p-4 text-center"><p class="text-2xl font-extrabold text-indigo-600">${data.totals.units}</p><p class="text-xs text-slate-500 font-semibold uppercase">Units sold</p></div>
      <div class="bg-white rounded-xl shadow p-4 text-center"><p class="text-2xl font-extrabold text-slate-700">${data.totals.transactions}</p><p class="text-xs text-slate-500 font-semibold uppercase">Transactions</p></div>
      <div class="bg-white rounded-xl shadow p-4 text-center"><p class="text-2xl font-extrabold text-slate-800">${pkr(data.totals.revenue)}</p><p class="text-xs text-slate-500 font-semibold uppercase">Revenue</p></div>
      <div class="bg-white rounded-xl shadow p-4 text-center"><p class="text-2xl font-extrabold text-emerald-600">${pkr(data.totals.profit)}</p><p class="text-xs text-slate-500 font-semibold uppercase">Profit (auto)</p></div>
    </div>

    <div class="bg-white rounded-xl shadow overflow-hidden">
      ${data.sales.length ? `
      <div class="overflow-x-auto max-h-[32rem] overflow-y-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 sticky top-0 z-10"><tr class="text-left text-xs text-slate-500 uppercase">
            <th class="px-4 py-3">Date</th><th class="px-3 py-3">Time</th><th class="px-3 py-3">Item Name</th>
            <th class="px-3 py-3">RAM</th><th class="px-3 py-3">Storage</th><th class="px-3 py-3">Qty</th>
            <th class="px-3 py-3">Sale Price</th><th class="px-3 py-3">Profit (auto)</th><th class="px-3 py-3">Sold By</th>
          </tr></thead>
          <tbody>
            ${data.sales.map(s=>{
              const dt = dayjs(s.sold_at + (s.sold_at && !s.sold_at.includes('Z') ? 'Z' : ''));
              return `<tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-4 py-2.5 font-medium text-slate-700">${dt.format('DD MMM YYYY')}</td>
                <td class="px-3 py-2.5 text-slate-500">${dt.format('hh:mm:ss A')}</td>
                <td class="px-3 py-2.5 font-semibold text-slate-700">${esc(s.product_name||'(deleted)')}</td>
                <td class="px-3 py-2.5">${s.ram?`<span class="badge bg-slate-100 text-slate-600"><i class="fas fa-memory"></i>${esc(s.ram)}</span>`:'<span class="text-slate-300">—</span>'}</td>
                <td class="px-3 py-2.5">${s.storage?`<span class="badge bg-slate-100 text-slate-600"><i class="fas fa-hard-drive"></i>${esc(s.storage)}</span>`:'<span class="text-slate-300">—</span>'}</td>
                <td class="px-3 py-2.5 font-bold text-emerald-600">${s.quantity}x</td>
                <td class="px-3 py-2.5 font-semibold">${pkr(s.unit_price)}${s.quantity>1?`<span class="block text-xs text-slate-400">${pkr(s.quantity*s.unit_price)} total</span>`:''}</td>
                <td class="px-3 py-2.5 font-semibold ${s.unit_profit<0?'text-rose-600':'text-emerald-600'}">${pkr(s.unit_profit)}${s.quantity>1?`<span class="block text-xs opacity-70">${pkr(s.quantity*s.unit_profit)} total</span>`:''}</td>
                <td class="px-3 py-2.5"><span class="badge bg-indigo-50 text-indigo-700"><i class="fas fa-user"></i>${esc(s.sold_by_name||'—')}</span></td>
              </tr>`;}).join('')}
          </tbody>
        </table>
      </div>` : `
      <div class="text-center py-16 text-slate-400">
        <i class="fas fa-receipt text-5xl mb-3"></i>
        <p class="font-medium text-slate-600">No sales in this period</p>
      </div>`}
    </div>
  </section>`;

  const modeSel = document.getElementById('rf-mode');
  modeSel.onchange = () => {
    document.getElementById('rf-date').classList.toggle('hidden', modeSel.value !== 'date');
    document.getElementById('rf-month').classList.toggle('hidden', modeSel.value !== 'month');
    document.getElementById('rf-year').classList.toggle('hidden', modeSel.value !== 'year');
  };
  document.getElementById('rf-apply').onclick = () => {
    const scope = document.getElementById('rf-scope').value;
    state.reportFilter = {
      mode: modeSel.value,
      date: document.getElementById('rf-date').value,
      month: document.getElementById('rf-month').value,
      year: document.getElementById('rf-year').value,
      mine: scope === 'mine',
      user_id: scope.startsWith('u') ? scope.slice(1) : '',
    };
    renderReports(el);
  };
}

function productCard(p) {
  const isAdmin = state.user.role === 'admin';
  const out = p.quantity <= 0;
  const low = !out && p.quantity <= 5;
  return `
  <article class="product-card bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden flex flex-col ${p.pinned ? 'ring-2 ring-amber-400' : ''}" id="product-${p.id}">
    ${p.pinned ? '<div class="bg-amber-400 text-amber-900 text-[10px] font-bold uppercase tracking-wider px-3 py-0.5"><i class="fas fa-thumbtack mr-1"></i>Pinned</div>' : ''}
    <div class="p-4 flex-1">
      <div class="flex items-start justify-between gap-2 mb-1">
        <h3 class="font-bold text-slate-800 leading-snug">${esc(p.name)}</h3>
        <div class="flex gap-1 shrink-0">
          <button data-pin="${p.id}" class="${p.pinned ? 'text-amber-500' : 'text-slate-400'} hover:text-amber-600 text-sm" title="${p.pinned ? 'Unpin' : 'Pin to top'}"><i class="fas fa-thumbtack"></i></button>
          ${isAdmin ? `
          <button data-edit="${p.id}" class="text-slate-400 hover:text-indigo-600 text-sm" title="Edit"><i class="fas fa-pen"></i></button>
          <button data-delete="${p.id}" class="text-slate-400 hover:text-rose-600 text-sm" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
        </div>
      </div>
      <div class="flex flex-wrap gap-1 mb-2">
        ${p.category_name ? `<span class="badge bg-indigo-50 text-indigo-700"><i class="fas fa-tag"></i>${esc(p.category_name)}</span>` : ''}
        <span class="badge ${out ? 'bg-rose-100 text-rose-700' : low ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'}">
          <i class="fas fa-boxes-stacked"></i>${out ? 'Out of stock' : p.quantity + ' in stock'}</span>
        <span class="badge bg-slate-100 text-slate-600"><i class="fas fa-cart-shopping"></i>${p.total_sold} sold</span>
      </div>
      ${p.description ? `<p class="text-sm text-slate-500 mb-2 line-clamp-2">${esc(p.description)}</p>` : ''}
      <div class="flex items-baseline gap-3 mb-2">
        <span class="text-xl font-extrabold text-slate-900">${pkr(p.price)}</span>
        ${isAdmin ? `<span class="text-xs font-semibold text-emerald-600"><i class="fas fa-arrow-trend-up"></i> ${pkr(p.profit)} profit</span>` : ''}
      </div>
      ${p.accessories && p.accessories.length ? `
        <div class="border-t border-slate-100 pt-2 mt-2">
          <p class="text-xs font-semibold text-slate-400 uppercase mb-1"><i class="fas fa-puzzle-piece mr-1"></i>Accessories</p>
          ${p.accessories.map(a => `<div class="flex justify-between text-xs text-slate-600 py-0.5"><span>${esc(a.name)}</span><span class="font-semibold">${pkr(a.price)}</span></div>`).join('')}
        </div>` : ''}
    </div>
    <div class="bg-slate-50 border-t border-slate-100 p-3">
      <div class="grid grid-cols-4 gap-2">
        <button data-sell="${p.id}" data-qty="1" ${out?'disabled':''} class="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold py-2 rounded-lg">Sold 1x</button>
        <button data-sell="${p.id}" data-qty="2" ${p.quantity<2?'disabled':''} class="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold py-2 rounded-lg">Sold 2x</button>
        <button data-sell-custom="${p.id}" ${out?'disabled':''} class="bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white text-xs font-bold py-2 rounded-lg">Sold Nx</button>
        <button data-analytics="${p.id}" class="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2 rounded-lg" title="Product analysis"><i class="fas fa-chart-line"></i></button>
      </div>
    </div>
  </article>`;
}

// Sale dialog: confirms + asks for RAM, Storage and Sale Rate of the item being sold
function sellProduct(id, qty, editableQty = false) {
  const p = state.products.find(x => x.id === id);
  if (!p) return toast('Product not found', 'error');
  const modal = document.getElementById('modal-root');
  modal.innerHTML = `
  <div class="modal-backdrop" id="confirm-sell-modal">
    <div class="modal-panel max-w-md fade-in">
      <div class="p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
            <i class="fas fa-cart-shopping text-emerald-600 text-lg"></i>
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-800">Confirm Sale — ${esc(p.name)}</h3>
            <p class="text-xs text-slate-400">${p.quantity} in stock · listed at ${pkr(p.price)}</p>
          </div>
        </div>
        <form id="sell-form" class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1"><i class="fas fa-memory text-indigo-500 mr-1"></i>RAM</label>
              <input id="sell-ram" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none" placeholder="e.g. 8GB">
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1"><i class="fas fa-hard-drive text-indigo-500 mr-1"></i>Storage</label>
              <input id="sell-storage" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none" placeholder="e.g. 256GB SSD">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1"><i class="fas fa-tag text-emerald-500 mr-1"></i>Sale Rate (PKR) *</label>
              <input id="sell-rate" type="number" min="0" step="0.01" required value="${p.price}" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none font-bold">
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1"><i class="fas fa-hashtag text-slate-400 mr-1"></i>Quantity</label>
              <input id="sell-qty" type="number" min="1" max="${p.quantity}" value="${qty}" ${editableQty ? '' : 'readonly'} class="w-full px-3 py-2 border border-slate-300 rounded-lg ${editableQty ? 'focus:border-indigo-500 focus:outline-none' : 'bg-slate-50 text-slate-500'}">
            </div>
          </div>
          <p class="text-xs text-slate-400">Are you sure? This will record the sale under <b>${esc(state.user.username)}</b> with today's date &amp; time. Stock: ${p.quantity} \u2192 <span id="sell-after">${p.quantity - qty}</span></p>
          <div class="flex gap-3 pt-1">
            <button type="button" id="cancel-sell" class="flex-1 py-2.5 rounded-lg border border-slate-300 font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" class="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">Yes, Confirm Sale</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
  const close = () => modal.innerHTML = '';
  document.getElementById('cancel-sell').onclick = close;
  document.getElementById('confirm-sell-modal').onclick = (e) => { if (e.target.id === 'confirm-sell-modal') close(); };
  const qtyInput = document.getElementById('sell-qty');
  qtyInput.addEventListener('input', () => {
    const n = parseInt(qtyInput.value) || 0;
    document.getElementById('sell-after').textContent = p.quantity - n;
  });
  document.getElementById('sell-form').onsubmit = async (e) => {
    e.preventDefault();
    const n = parseInt(qtyInput.value);
    if (!n || n < 1) return toast('Enter a valid quantity', 'error');
    if (n > p.quantity) return toast(`Only ${p.quantity} left in stock`, 'error');
    const payload = {
      quantity: n,
      ram: document.getElementById('sell-ram').value,
      storage: document.getElementById('sell-storage').value,
      sale_rate: document.getElementById('sell-rate').value,
    };
    close();
    try {
      const { data } = await api.post(`/products/${id}/sell`, payload);
      toast(`Sold ${n}x! ${data.remaining} left in stock`);
      await refreshProducts();
      renderView();
    } catch (err) { toast(errMsg(err), 'error'); }
  };
}

function sellCustom(id) {
  sellProduct(id, 1, true); // open dialog with editable quantity
}

async function deleteProduct(id) {
  const p = state.products.find(x => x.id === id);
  if (!confirm(`Delete "${p ? p.name : ''}"? This will also delete its sales history.`)) return;
  try {
    await api.delete(`/products/${id}`);
    toast('Product deleted');
    await refreshProducts();
    renderView();
  } catch (e) { toast(errMsg(e), 'error'); }
}

// ===== PRODUCT FORM MODAL (add / edit) =====
function openProductForm(product = null) {
  const isEdit = !!product;
  const accs = isEdit ? (product.accessories || []) : [];
  const modal = document.getElementById('modal-root');
  modal.innerHTML = `
  <div class="modal-backdrop" id="product-modal">
    <div class="modal-panel max-w-lg fade-in">
      <header class="flex items-center justify-between p-5 border-b border-slate-100">
        <h3 class="text-lg font-bold text-slate-800"><i class="fas ${isEdit?'fa-pen':'fa-plus'} text-indigo-600 mr-2"></i>${isEdit?'Edit':'Add'} Product</h3>
        <button id="close-modal" class="text-slate-400 hover:text-slate-700"><i class="fas fa-xmark text-xl"></i></button>
      </header>
      <form id="product-form" class="p-5 space-y-4">
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">Product Name *</label>
          <input name="name" required value="${isEdit?esc(product.name):''}" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none" placeholder="e.g. Wireless Mouse">
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">Description</label>
          <textarea name="description" rows="2" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none" placeholder="Short description...">${isEdit?esc(product.description):''}</textarea>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">How Many *</label>
            <input name="quantity" type="number" min="0" required value="${isEdit?product.quantity:''}" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none" placeholder="0">
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Sale Price (PKR) *</label>
            <input name="price" id="pf-price" type="number" min="0" step="0.01" required value="${isEdit?product.price:''}" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none" placeholder="0">
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1"><i class="fas fa-lock text-amber-500 mr-1"></i>Cost Price (PKR) *</label>
            <input name="cost_price" id="pf-cost" type="number" min="0" step="0.01" required value="${isEdit?(product.cost_price ?? (product.price - product.profit)):''}" class="w-full px-3 py-2 border border-amber-300 rounded-lg focus:border-amber-500 focus:outline-none" placeholder="0">
          </div>
        </div>
        <div class="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700">
          <i class="fas fa-calculator mr-1"></i>Profit (auto): <b id="pf-profit">${isEdit?pkr(product.price - (product.cost_price ?? (product.price - product.profit))):'Rs 0'}</b>
          <span class="text-xs text-emerald-600 ml-1">= Sale Price − Cost Price. Cost price is admin-only and hidden from salespersons.</span>
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">Category</label>
          <select name="category_id" class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
            <option value="">— No category —</option>
            ${state.categories.map(c=>`<option value="${c.id}" ${isEdit&&product.category_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block text-sm font-semibold text-slate-700">Accessories (optional)</label>
            <button type="button" id="add-acc-row" class="text-indigo-600 text-sm font-semibold hover:underline"><i class="fas fa-plus mr-1"></i>Add accessory</button>
          </div>
          <div id="acc-rows" class="space-y-2">
            ${accs.map(a=>accRow(a.name, a.price)).join('')}
          </div>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" id="cancel-modal" class="flex-1 py-2.5 rounded-lg border border-slate-300 font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" class="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">${isEdit?'Save Changes':'Add Product'}</button>
        </div>
      </form>
    </div>
  </div>`;

  const close = () => modal.innerHTML = '';
  document.getElementById('close-modal').onclick = close;
  document.getElementById('cancel-modal').onclick = close;
  document.getElementById('product-modal').onclick = (e) => { if (e.target.id === 'product-modal') close(); };
  document.getElementById('add-acc-row').onclick = () => {
    document.getElementById('acc-rows').insertAdjacentHTML('beforeend', accRow());
    bindAccRemove();
  };
  bindAccRemove();

  // live auto-profit preview
  const priceIn = document.getElementById('pf-price');
  const costIn = document.getElementById('pf-cost');
  const updProfit = () => {
    const pr = parseFloat(priceIn.value) || 0, co = parseFloat(costIn.value) || 0;
    const el2 = document.getElementById('pf-profit');
    el2.textContent = pkr(pr - co);
    el2.className = (pr - co) < 0 ? 'text-rose-600' : '';
  };
  priceIn.addEventListener('input', updProfit);
  costIn.addEventListener('input', updProfit);

  document.getElementById('product-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const accessories = [];
    document.querySelectorAll('#acc-rows .acc-row').forEach(row => {
      const name = row.querySelector('.acc-name').value.trim();
      const price = row.querySelector('.acc-price').value;
      if (name) accessories.push({ name, price });
    });
    const payload = {
      name: fd.get('name'), description: fd.get('description'),
      quantity: fd.get('quantity'), price: fd.get('price'), cost_price: fd.get('cost_price'),
      category_id: fd.get('category_id') || null, accessories,
    };
    try {
      if (isEdit) { await api.put(`/products/${product.id}`, payload); toast('Product updated'); }
      else { await api.post('/products', payload); toast('Product added'); }
      close();
      await refreshProducts();
      renderView();
    } catch (err) { toast(errMsg(err), 'error'); }
  };
}

function accRow(name = '', price = '') {
  return `<div class="acc-row flex gap-2">
    <input class="acc-name flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Accessory name" value="${esc(name)}">
    <input class="acc-price w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm" type="number" min="0" step="0.01" placeholder="Price PKR" value="${price}">
    <button type="button" class="acc-remove text-rose-500 hover:text-rose-700 px-2"><i class="fas fa-trash"></i></button>
  </div>`;
}
function bindAccRemove() {
  document.querySelectorAll('.acc-remove').forEach(b => b.onclick = () => b.closest('.acc-row').remove());
}

// ===== PRODUCT ANALYTICS MODAL =====
async function openProductAnalytics(id) {
  const modal = document.getElementById('modal-root');
  modal.innerHTML = `<div class="modal-backdrop"><div class="modal-panel max-w-3xl p-10 text-center text-slate-400"><i class="fas fa-spinner fa-spin text-3xl"></i><p class="mt-2">Loading analysis...</p></div></div>`;
  let data;
  try { ({ data } = await api.get(`/products/${id}/analytics`)); }
  catch (e) { modal.innerHTML = ''; return toast(errMsg(e), 'error'); }

  const isAdmin = state.user.role === 'admin';
  const p = data.product;
  const statCard = (label, icon, s, color) => `
    <div class="bg-white rounded-xl border border-slate-200 p-4">
      <p class="text-xs font-bold uppercase text-slate-400 mb-2"><i class="fas ${icon} ${color} mr-1"></i>${label}</p>
      <p class="text-2xl font-extrabold text-slate-800">${s.units} <span class="text-sm font-medium text-slate-400">units</span></p>
      <p class="text-sm text-slate-600 mt-1">Revenue: <span class="font-bold">${pkr(s.revenue)}</span></p>
      ${isAdmin?`<p class="text-sm text-emerald-600">Profit: <span class="font-bold">${pkr(s.profit)}</span></p>`:''}
      <p class="text-xs text-slate-400 mt-1">${s.transactions} transaction${s.transactions===1?'':'s'}</p>
    </div>`;

  modal.innerHTML = `
  <div class="modal-backdrop" id="analytics-modal">
    <div class="modal-panel max-w-3xl fade-in">
      <header class="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
        <div>
          <h3 class="text-lg font-bold text-slate-800"><i class="fas fa-chart-line text-indigo-600 mr-2"></i>${esc(p.name)} — Analysis</h3>
          <p class="text-xs text-slate-400">${p.category_name?esc(p.category_name)+' · ':''}${pkr(p.price)} · ${p.quantity} in stock</p>
        </div>
        <div class="flex items-center gap-2">
          ${isAdmin?`<button id="undo-sale-btn" class="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50" title="Undo last sale"><i class="fas fa-rotate-left mr-1"></i>Undo last sale</button>`:''}
          <button id="close-analytics" class="text-slate-400 hover:text-slate-700"><i class="fas fa-xmark text-xl"></i></button>
        </div>
      </header>
      <div class="p-5">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          ${statCard('1 Day Analysis','fa-clock', data.day1, 'text-amber-500')}
          ${statCard('10 Day Analysis','fa-calendar-days', data.day10, 'text-indigo-500')}
          ${statCard('Full Time Analysis','fa-infinity', data.allTime, 'text-emerald-500')}
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-4 mb-5">
          <p class="text-xs font-bold uppercase text-slate-400 mb-2"><i class="fas fa-users text-indigo-500 mr-1"></i>Who sold this product</p>
          ${data.byUser && data.byUser.length ? `
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead><tr class="text-left text-xs text-slate-500">
                <th class="py-1.5 pr-4">User</th><th class="py-1.5 pr-4">Units Sold</th><th class="py-1.5 pr-4">Revenue</th>${isAdmin?'<th class="py-1.5 pr-4">Profit</th>':''}<th class="py-1.5">Transactions</th>
              </tr></thead>
              <tbody>
                ${data.byUser.map(u=>`<tr class="border-t border-slate-100">
                  <td class="py-1.5 pr-4 font-semibold text-slate-700"><i class="fas fa-user-circle text-slate-300 mr-1"></i>${esc(u.username||'Unknown')}</td>
                  <td class="py-1.5 pr-4 font-bold text-emerald-600">${u.units}</td>
                  <td class="py-1.5 pr-4">${pkr(u.revenue)}</td>
                  ${isAdmin?`<td class="py-1.5 pr-4 text-emerald-600">${pkr(u.profit)}</td>`:''}
                  <td class="py-1.5 text-slate-500">${u.transactions}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>` : '<p class="text-slate-400 text-sm">No sales yet.</p>'}
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-4 mb-5">
          <p class="text-xs font-bold uppercase text-slate-400 mb-3">Last 30 days — units sold</p>
          <canvas id="product-chart" height="90"></canvas>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <p class="text-xs font-bold uppercase text-slate-400 p-4 pb-2">Sale Log — date &amp; time of every sale</p>
          ${data.log.length ? `
          <div class="overflow-x-auto max-h-72 overflow-y-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 sticky top-0"><tr class="text-left text-xs text-slate-500">
                <th class="px-4 py-2">Date &amp; Time</th><th class="px-4 py-2">Qty</th><th class="px-4 py-2">Unit Price</th>${isAdmin?'<th class="px-4 py-2">Unit Profit</th>':''}<th class="px-4 py-2">Sold By</th>
              </tr></thead>
              <tbody>
                ${data.log.map(s=>`<tr class="border-t border-slate-100">
                  <td class="px-4 py-2 font-medium text-slate-700"><i class="far fa-clock text-slate-300 mr-1"></i>${fmtDT(s.sold_at)}</td>
                  <td class="px-4 py-2 font-bold text-emerald-600">${s.quantity}x</td>
                  <td class="px-4 py-2">${pkr(s.unit_price)}</td>
                  ${isAdmin?`<td class="px-4 py-2 text-emerald-600">${pkr(s.unit_profit)}</td>`:''}
                  <td class="px-4 py-2 text-slate-500">${esc(s.sold_by_name||'—')}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>` : '<p class="px-4 pb-4 text-slate-400 text-sm">No sales recorded yet.</p>'}
        </div>
      </div>
    </div>
  </div>`;

  const close = () => modal.innerHTML = '';
  document.getElementById('close-analytics').onclick = close;
  document.getElementById('analytics-modal').onclick = (e) => { if (e.target.id === 'analytics-modal') close(); };
  const undoBtn = document.getElementById('undo-sale-btn');
  if (undoBtn) undoBtn.onclick = async () => {
    if (!confirm('Undo the most recent sale of this product?')) return;
    try {
      await api.post(`/products/${id}/undo-sale`);
      toast('Last sale undone');
      await refreshProducts();
      openProductAnalytics(id);
    } catch (e) { toast(errMsg(e), 'error'); }
  };

  // chart
  const days = [];
  for (let i = 29; i >= 0; i--) days.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'));
  const map = {};
  (data.daily || []).forEach(d => map[d.day] = d.units);
  new Chart(document.getElementById('product-chart'), {
    type: 'bar',
    data: {
      labels: days.map(d => dayjs(d).format('DD MMM')),
      datasets: [{ label: 'Units sold', data: days.map(d => map[d] || 0), backgroundColor: '#6366f1', borderRadius: 4 }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
}

// ===== SHOP ANALYTICS VIEW (main analysis) =====
async function renderShopAnalytics(el) {
  el.innerHTML = `<div class="text-center py-16 text-slate-400"><i class="fas fa-spinner fa-spin text-3xl"></i><p class="mt-2">Loading shop analytics...</p></div>`;
  const f = state.analyticsFilter;
  const params = {};
  if (f.mode === 'date' && f.date) params.date = f.date;
  if (f.mode === 'week') params.week = '1';
  if (f.mode === 'month' && f.month) params.month = f.month;
  if (f.mode === 'year' && f.year) params.year = f.year;
  if (f.mode === 'range') { if (f.from) params.from = f.from; if (f.to) params.to = f.to; }

  let data;
  try { ({ data } = await api.get('/analytics/summary', { params })); }
  catch (e) { el.innerHTML = `<p class="text-rose-600">${esc(errMsg(e))}</p>`; return; }

  const isAdmin = state.user.role === 'admin';
  const hasFilter = !!(params.date || params.week || params.month || params.year || params.from || params.to);
  const filterLabel = params.date ? dayjs(params.date).format('DD MMM YYYY')
    : params.week ? 'This Week (last 7 days)'
    : params.month ? dayjs(params.month + '-01').format('MMMM YYYY')
    : params.year ? 'Year ' + params.year
    : (params.from || params.to) ? `${params.from ? dayjs(params.from).format('DD MMM YYYY') : '…'} → ${params.to ? dayjs(params.to).format('DD MMM YYYY') : '…'}`
    : 'All Time';

  const statCard = (label, icon, s, color) => `
    <div class="bg-white rounded-xl shadow p-5">
      <p class="text-xs font-bold uppercase text-slate-400 mb-2"><i class="fas ${icon} ${color} mr-1"></i>${label}</p>
      <p class="text-3xl font-extrabold text-slate-800">${s.units} <span class="text-sm font-medium text-slate-400">units sold</span></p>
      <p class="text-sm text-slate-600 mt-1">Revenue: <span class="font-bold">${pkr(s.revenue)}</span></p>
      ${isAdmin?`<p class="text-sm text-emerald-600">Profit: <span class="font-bold">${pkr(s.profit)}</span></p>`:''}
      <p class="text-xs text-slate-400 mt-1">${s.transactions} transactions</p>
    </div>`;

  const years = (data.years || []).map(y => y.year).filter(Boolean);
  if (!years.length) years.push(dayjs().format('YYYY'));

  el.innerHTML = `
  <section id="analytics-view" class="fade-in">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
      <h2 class="text-2xl font-bold text-slate-800"><i class="fas fa-chart-line text-indigo-600 mr-2"></i>Shop Analytics</h2>
      <div id="period-filter" class="flex flex-wrap items-center gap-2 bg-white rounded-xl shadow px-3 py-2">
        <span class="text-xs font-bold uppercase text-slate-400"><i class="fas fa-filter mr-1"></i>Period:</span>
        <select id="filter-mode" class="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-sm">
          <option value="all" ${f.mode==='all'?'selected':''}>All Time</option>
          <option value="date" ${f.mode==='date'?'selected':''}>Day (specific date)</option>
          <option value="week" ${f.mode==='week'?'selected':''}>Week (last 7 days)</option>
          <option value="month" ${f.mode==='month'?'selected':''}>Month</option>
          <option value="year" ${f.mode==='year'?'selected':''}>Year</option>
          <option value="range" ${f.mode==='range'?'selected':''}>Custom Range</option>
        </select>
        <input type="date" id="filter-date" value="${f.date || dayjs().format('YYYY-MM-DD')}" class="px-2 py-1.5 rounded-lg border border-slate-300 text-sm ${f.mode==='date'?'':'hidden'}">
        <input type="month" id="filter-month" value="${f.month || dayjs().format('YYYY-MM')}" class="px-2 py-1.5 rounded-lg border border-slate-300 text-sm ${f.mode==='month'?'':'hidden'}">
        <select id="filter-year" class="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-sm ${f.mode==='year'?'':'hidden'}">
          ${years.map(y=>`<option value="${y}" ${f.year===y?'selected':''}>${y}</option>`).join('')}
        </select>
        <span id="filter-range" class="${f.mode==='range'?'':'hidden'} flex items-center gap-1">
          <input type="date" id="filter-from" value="${f.from || dayjs().subtract(7,'day').format('YYYY-MM-DD')}" class="px-2 py-1.5 rounded-lg border border-slate-300 text-sm">
          <span class="text-slate-400 text-xs">to</span>
          <input type="date" id="filter-to" value="${f.to || dayjs().format('YYYY-MM-DD')}" class="px-2 py-1.5 rounded-lg border border-slate-300 text-sm">
        </span>
        <button id="apply-filter" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold">Apply</button>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
      <div class="bg-white rounded-xl shadow p-4 text-center"><p class="text-2xl font-extrabold text-indigo-600">${data.totals.products}</p><p class="text-xs text-slate-500 font-semibold uppercase">Products</p></div>
      <div class="bg-white rounded-xl shadow p-4 text-center"><p class="text-2xl font-extrabold text-emerald-600">${data.totals.stock}</p><p class="text-xs text-slate-500 font-semibold uppercase">Items in stock</p></div>
      <div class="bg-white rounded-xl shadow p-4 text-center"><p class="text-2xl font-extrabold text-rose-600">${data.totals.sold_out}</p><p class="text-xs text-slate-500 font-semibold uppercase">Sold out</p></div>
      <div class="bg-white rounded-xl shadow p-4 text-center"><p class="text-2xl font-extrabold text-amber-600">${data.totals.categories}</p><p class="text-xs text-slate-500 font-semibold uppercase">Categories</p></div>
      <div class="bg-white rounded-xl shadow p-4 text-center"><p class="text-2xl font-extrabold text-slate-700">${data.totals.users}</p><p class="text-xs text-slate-500 font-semibold uppercase">Users</p></div>
    </div>

    ${hasFilter ? `
    <div class="bg-indigo-600 text-white rounded-xl shadow p-5 mb-5">
      <p class="text-xs font-bold uppercase opacity-80 mb-2"><i class="fas fa-calendar-check mr-1"></i>Selected period: ${filterLabel}</p>
      <div class="flex flex-wrap gap-x-8 gap-y-2">
        <p class="text-2xl font-extrabold">${data.filtered.units} <span class="text-sm font-normal opacity-80">units sold</span></p>
        <p class="text-2xl font-extrabold">${pkr(data.filtered.revenue)} <span class="text-sm font-normal opacity-80">revenue</span></p>
        ${isAdmin?`<p class="text-2xl font-extrabold">${pkr(data.filtered.profit)} <span class="text-sm font-normal opacity-80">profit</span></p>`:''}
        <p class="text-2xl font-extrabold">${data.filtered.transactions} <span class="text-sm font-normal opacity-80">transactions</span></p>
      </div>
    </div>` : ''}

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      ${statCard('1 Day Analysis','fa-clock', data.day1,'text-amber-500')}
      ${statCard('10 Day Analysis','fa-calendar-days', data.day10,'text-indigo-500')}
      ${statCard('Full Time Analysis','fa-infinity', data.allTime,'text-emerald-500')}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
      <div class="bg-white rounded-xl shadow p-5">
        <p class="text-xs font-bold uppercase text-slate-400 mb-3">Last 30 days — sales trend</p>
        <canvas id="shop-chart" height="140"></canvas>
      </div>
      <div class="bg-white rounded-xl shadow p-5">
        <p class="text-xs font-bold uppercase text-slate-400 mb-3"><i class="fas fa-users text-indigo-500 mr-1"></i>Sales by user — ${filterLabel}</p>
        ${data.userBreakdown.length ? `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="text-left text-xs text-slate-500">
              <th class="py-2 pr-4">User</th><th class="py-2 pr-4">Units</th><th class="py-2 pr-4">Revenue</th>${isAdmin?'<th class="py-2 pr-4">Profit</th>':''}<th class="py-2">Sales</th>
            </tr></thead>
            <tbody>
              ${data.userBreakdown.map(u=>`<tr class="border-t border-slate-100">
                <td class="py-2 pr-4 font-semibold text-slate-700"><i class="fas fa-user-circle text-slate-300 mr-1"></i>${esc(u.username)}</td>
                <td class="py-2 pr-4 font-bold text-emerald-600">${u.units}</td>
                <td class="py-2 pr-4">${pkr(u.revenue)}</td>
                ${isAdmin?`<td class="py-2 pr-4 text-emerald-600">${pkr(u.profit)}</td>`:''}
                <td class="py-2 text-slate-500">${u.transactions}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : '<p class="text-slate-400 text-sm">No users yet.</p>'}
      </div>
    </div>

    <div class="bg-white rounded-xl shadow p-5 mb-5" id="user-performance">
      <p class="text-xs font-bold uppercase text-slate-400 mb-3"><i class="fas fa-ranking-star text-indigo-500 mr-1"></i>User Sales Performance — all users (${filterLabel})</p>
      ${data.userBreakdown && data.userBreakdown.length ? `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${data.userBreakdown.map((u,i)=>{
          const items = (data.userItems||[]).filter(it=>it.user_id===u.id);
          return `<article class="border border-slate-200 rounded-xl p-4 ${i===0&&u.units>0?'ring-2 ring-indigo-300 bg-indigo-50/40':''}">
            <div class="flex items-center justify-between mb-2">
              <p class="font-bold text-slate-800"><i class="fas fa-user-circle ${i===0&&u.units>0?'text-indigo-500':'text-slate-300'} mr-1"></i>${esc(u.username)}
                <span class="badge ${u.role==='admin'?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-600'} ml-1">${u.role}</span>
                ${i===0&&u.units>0?'<span class="badge bg-indigo-600 text-white ml-1"><i class="fas fa-trophy"></i>Top seller</span>':''}
              </p>
            </div>
            <div class="flex flex-wrap gap-x-5 gap-y-1 text-sm mb-2">
              <span><b class="text-emerald-600">${u.units}</b> <span class="text-slate-500">items sold</span></span>
              <span><b>${pkr(u.revenue)}</b> <span class="text-slate-500">revenue</span></span>
              ${isAdmin?`<span><b class="text-emerald-600">${pkr(u.profit)}</b> <span class="text-slate-500">profit</span></span>`:''}
              <span><b>${u.transactions}</b> <span class="text-slate-500">sales</span></span>
            </div>
            ${items.length?`<div class="flex flex-wrap gap-1.5">
              ${items.slice(0,12).map(it=>`<span class="badge bg-slate-100 text-slate-600">${esc(it.product_name)} ×${it.units}</span>`).join('')}
              ${items.length>12?`<span class="badge bg-slate-100 text-slate-400">+${items.length-12} more</span>`:''}
            </div>`:'<p class="text-xs text-slate-400">No items sold in this period.</p>'}
          </article>`;}).join('')}
      </div>` : '<p class="text-slate-400 text-sm">No users yet.</p>'}
    </div>

    <div class="bg-white rounded-xl shadow p-5 mb-5">
      <p class="text-xs font-bold uppercase text-slate-400 mb-3"><i class="fas fa-box text-indigo-500 mr-1"></i>Product performance — units sold &amp; revenue per product (${filterLabel})</p>
      ${data.productBreakdown.length ? `
      <div class="overflow-x-auto max-h-96 overflow-y-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 sticky top-0"><tr class="text-left text-xs text-slate-500 uppercase">
            <th class="px-3 py-2">#</th><th class="px-3 py-2">Product</th><th class="px-3 py-2">Units Sold</th>
            <th class="px-3 py-2">Revenue</th>${isAdmin?'<th class="px-3 py-2">Profit</th>':''}<th class="px-3 py-2">Stock Left</th><th class="px-3 py-2"></th>
          </tr></thead>
          <tbody>
            ${data.productBreakdown.map((p,i)=>`<tr class="border-t border-slate-100 hover:bg-slate-50">
              <td class="px-3 py-2"><span class="w-6 h-6 rounded-full ${i<3&&p.units>0?'bg-indigo-600 text-white':'bg-slate-100 text-slate-500'} inline-flex items-center justify-center text-xs font-bold">${i+1}</span></td>
              <td class="px-3 py-2 font-semibold text-slate-700">${p.pinned?'<i class="fas fa-thumbtack text-amber-500 mr-1"></i>':''}${esc(p.name)}</td>
              <td class="px-3 py-2 font-bold text-emerald-600">${p.units}</td>
              <td class="px-3 py-2 font-semibold">${pkr(p.revenue)}</td>
              ${isAdmin?`<td class="px-3 py-2 text-emerald-600">${pkr(p.profit)}</td>`:''}
              <td class="px-3 py-2">${p.stock<=0?'<span class="badge bg-rose-100 text-rose-700">Sold out</span>':p.stock}</td>
              <td class="px-3 py-2"><button data-prod-analytics="${p.id}" class="text-indigo-500 hover:text-indigo-700 text-xs font-semibold"><i class="fas fa-chart-line mr-1"></i>Details</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<p class="text-slate-400 text-sm">No products yet.</p>'}
    </div>

    <div class="bg-white rounded-xl shadow overflow-hidden">
      <p class="text-xs font-bold uppercase text-slate-400 p-5 pb-2"><i class="fas fa-list text-indigo-500 mr-1"></i>Sales log — date, time &amp; who sold (${filterLabel}) · ${data.salesLog.length} record${data.salesLog.length===1?'':'s'}</p>
      ${data.salesLog.length ? `
      <div class="overflow-x-auto max-h-96 overflow-y-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 sticky top-0"><tr class="text-left text-xs text-slate-500 uppercase">
            <th class="px-5 py-2">Date</th><th class="px-3 py-2">Time</th><th class="px-3 py-2">Product</th>
            <th class="px-3 py-2">Qty</th><th class="px-3 py-2">Amount</th>${isAdmin?'<th class="px-3 py-2">Profit</th>':''}<th class="px-3 py-2">Sold By</th>
          </tr></thead>
          <tbody>
            ${data.salesLog.map(s=>{
              const dt = dayjs(s.sold_at + (s.sold_at && !s.sold_at.includes('Z') ? 'Z' : ''));
              return `<tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-5 py-2 font-medium text-slate-700">${dt.format('DD MMM YYYY')}</td>
                <td class="px-3 py-2 text-slate-500">${dt.format('hh:mm:ss A')}</td>
                <td class="px-3 py-2 font-semibold text-slate-700">${esc(s.product_name||'(deleted)')}</td>
                <td class="px-3 py-2 font-bold text-emerald-600">${s.quantity}x</td>
                <td class="px-3 py-2">${pkr(s.quantity*s.unit_price)}</td>
                ${isAdmin?`<td class="px-3 py-2 text-emerald-600">${pkr(s.quantity*s.unit_profit)}</td>`:''}
                <td class="px-3 py-2"><span class="badge bg-indigo-50 text-indigo-700"><i class="fas fa-user"></i>${esc(s.sold_by_name||'—')}</span></td>
              </tr>`;}).join('')}
          </tbody>
        </table>
      </div>` : '<p class="px-5 pb-5 text-slate-400 text-sm">No sales in this period.</p>'}
    </div>
  </section>`;

  // filter controls
  const modeSel = document.getElementById('filter-mode');
  modeSel.onchange = () => {
    document.getElementById('filter-date').classList.toggle('hidden', modeSel.value !== 'date');
    document.getElementById('filter-month').classList.toggle('hidden', modeSel.value !== 'month');
    document.getElementById('filter-year').classList.toggle('hidden', modeSel.value !== 'year');
    document.getElementById('filter-range').classList.toggle('hidden', modeSel.value !== 'range');
  };
  document.getElementById('apply-filter').onclick = () => {
    state.analyticsFilter = {
      mode: modeSel.value,
      date: document.getElementById('filter-date').value,
      month: document.getElementById('filter-month').value,
      year: document.getElementById('filter-year').value,
      from: document.getElementById('filter-from').value,
      to: document.getElementById('filter-to').value,
    };
    renderShopAnalytics(el);
  };
  el.querySelectorAll('[data-prod-analytics]').forEach(b => b.onclick = () => openProductAnalytics(Number(b.dataset.prodAnalytics)));

  // chart
  const days = [];
  for (let i = 29; i >= 0; i--) days.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'));
  const unitMap = {}, profitMap = {};
  (data.daily || []).forEach(d => { unitMap[d.day] = d.units; profitMap[d.day] = d.profit; });
  new Chart(document.getElementById('shop-chart'), {
    type: 'line',
    data: {
      labels: days.map(d => dayjs(d).format('DD MMM')),
      datasets: [
        { label: 'Units sold', data: days.map(d => unitMap[d] || 0), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,.1)', fill: true, tension: .3 },
        ...(isAdmin ? [{ label: 'Profit (PKR)', data: days.map(d => profitMap[d] || 0), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.08)', fill: true, tension: .3, yAxisID: 'y1' }] : [])
      ]
    },
    options: {
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
        ...(isAdmin ? { y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } } } : {})
      }
    }
  });
}

// ===== ADMIN PANEL =====
function renderAdmin(el) {
  if (state.user.role !== 'admin') { el.innerHTML = '<p class="text-rose-600">Admin access required.</p>'; return; }
  const tabs = [
    { id: 'products', label: 'Products', icon: 'fa-box' },
    { id: 'categories', label: 'Categories', icon: 'fa-tags' },
    { id: 'users', label: 'Accounts', icon: 'fa-users' },
  ];
  el.innerHTML = `
  <section id="admin-view" class="fade-in">
    <h2 class="text-2xl font-bold text-slate-800 mb-5"><i class="fas fa-user-shield text-indigo-600 mr-2"></i>Admin Panel</h2>
    <div class="flex gap-2 mb-5 border-b border-slate-200">
      ${tabs.map(t=>`<button data-tab="${t.id}" class="admin-tab px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${state.adminTab===t.id?'border-indigo-600 text-indigo-600':'border-transparent text-slate-500 hover:text-slate-700'}"><i class="fas ${t.icon} mr-1"></i>${t.label}</button>`).join('')}
    </div>
    <div id="admin-content"></div>
  </section>`;
  el.querySelectorAll('.admin-tab').forEach(b => b.onclick = () => { state.adminTab = b.dataset.tab; renderAdmin(el); });

  const c = document.getElementById('admin-content');
  if (state.adminTab === 'products') renderAdminProducts(c);
  else if (state.adminTab === 'categories') renderAdminCategories(c);
  else renderAdminUsers(c);
}

function renderAdminProducts(c) {
  c.innerHTML = `
  <div class="flex justify-between items-center mb-4">
    <p class="text-slate-500 text-sm">${state.products.length} products · manage stock, prices &amp; profit</p>
    <button id="admin-add-product" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-plus mr-1"></i>Add Product</button>
  </div>
  <div class="bg-white rounded-xl shadow overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="bg-slate-50"><tr class="text-left text-xs text-slate-500 uppercase">
        <th class="px-4 py-3">Product</th><th class="px-4 py-3">Category</th><th class="px-4 py-3">Stock</th>
        <th class="px-4 py-3">Price</th><th class="px-4 py-3">Profit</th><th class="px-4 py-3">Sold</th>
        <th class="px-4 py-3">Accessories</th><th class="px-4 py-3 text-right">Actions</th>
      </tr></thead>
      <tbody>
        ${state.products.length ? state.products.map(p=>`<tr class="border-t border-slate-100 hover:bg-slate-50">
          <td class="px-4 py-3 font-semibold text-slate-800">${esc(p.name)}</td>
          <td class="px-4 py-3 text-slate-500">${esc(p.category_name||'—')}</td>
          <td class="px-4 py-3"><span class="badge ${p.quantity<=0?'bg-rose-100 text-rose-700':p.quantity<=5?'bg-amber-100 text-amber-700':'bg-emerald-50 text-emerald-700'}">${p.quantity}</span></td>
          <td class="px-4 py-3">${pkr(p.price)}</td>
          <td class="px-4 py-3 text-emerald-600 font-semibold">${pkr(p.profit)}</td>
          <td class="px-4 py-3 font-bold">${p.total_sold}</td>
          <td class="px-4 py-3 text-slate-500">${p.accessories.length ? p.accessories.map(a=>esc(a.name)).join(', ') : '—'}</td>
          <td class="px-4 py-3 text-right whitespace-nowrap">
            <button data-analytics="${p.id}" class="text-slate-500 hover:text-indigo-600 px-1.5" title="Analysis"><i class="fas fa-chart-line"></i></button>
            <button data-edit="${p.id}" class="text-slate-500 hover:text-indigo-600 px-1.5" title="Edit"><i class="fas fa-pen"></i></button>
            <button data-delete="${p.id}" class="text-slate-500 hover:text-rose-600 px-1.5" title="Delete"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`).join('') : '<tr><td colspan="8" class="px-4 py-8 text-center text-slate-400">No products yet</td></tr>'}
      </tbody>
    </table>
  </div>`;
  document.getElementById('admin-add-product').onclick = () => openProductForm();
  c.querySelectorAll('[data-analytics]').forEach(b => b.onclick = () => openProductAnalytics(Number(b.dataset.analytics)));
  c.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openProductForm(state.products.find(x=>x.id===Number(b.dataset.edit))));
  c.querySelectorAll('[data-delete]').forEach(b => b.onclick = async () => {
    await deleteProduct(Number(b.dataset.delete));
    renderAdmin(document.getElementById('main-content'));
  });
}

function renderAdminCategories(c) {
  c.innerHTML = `
  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
    <div class="bg-white rounded-xl shadow p-5">
      <h3 class="font-bold text-slate-800 mb-3"><i class="fas fa-plus text-indigo-600 mr-1"></i>Create Category</h3>
      <form id="category-form" class="flex gap-2">
        <input id="category-name" required class="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none" placeholder="e.g. Mobile Accessories">
        <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm">Create</button>
      </form>
    </div>
    <div class="bg-white rounded-xl shadow p-5">
      <h3 class="font-bold text-slate-800 mb-3"><i class="fas fa-tags text-indigo-600 mr-1"></i>Existing Categories</h3>
      ${state.categories.length ? state.categories.map(cat=>`
        <div class="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
          <span class="font-medium text-slate-700">${esc(cat.name)} <span class="text-xs text-slate-400">(${cat.product_count} products)</span></span>
          <button data-delcat="${cat.id}" class="text-slate-400 hover:text-rose-600"><i class="fas fa-trash"></i></button>
        </div>`).join('') : '<p class="text-slate-400 text-sm">No categories yet.</p>'}
    </div>
  </div>`;
  document.getElementById('category-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/categories', { name: document.getElementById('category-name').value });
      toast('Category created');
      await loadData();
      renderAdmin(document.getElementById('main-content'));
    } catch (err) { toast(errMsg(err), 'error'); }
  };
  c.querySelectorAll('[data-delcat]').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this category? Products will keep existing but lose the category.')) return;
    try {
      await api.delete(`/categories/${b.dataset.delcat}`);
      toast('Category deleted');
      await loadData();
      renderAdmin(document.getElementById('main-content'));
    } catch (err) { toast(errMsg(err), 'error'); }
  });
}

async function renderAdminUsers(c) {
  c.innerHTML = `<p class="text-slate-400"><i class="fas fa-spinner fa-spin mr-1"></i>Loading accounts...</p>`;
  let users = [];
  try { ({ data: { users } } = await api.get('/users')); }
  catch (e) { c.innerHTML = `<p class="text-rose-600">${esc(errMsg(e))}</p>`; return; }

  c.innerHTML = `
  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
    <div class="bg-white rounded-xl shadow p-5">
      <h3 class="font-bold text-slate-800 mb-1"><i class="fas fa-user-plus text-indigo-600 mr-1"></i>Create Account</h3>
      <p class="text-xs text-slate-400 mb-4">No public signup — only you can create accounts. Passkey must be exactly 10 characters.</p>
      <form id="user-form" class="space-y-3">
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">Username *</label>
          <input name="username" required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none" placeholder="e.g. shopworker1">
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">Passkey (10 characters)</label>
          <div class="flex gap-2">
            <input name="passkey" id="new-passkey" maxlength="10" class="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none font-mono tracking-wider" placeholder="Custom key or generate →">
            <button type="button" id="gen-passkey" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold" title="Generate random 10-char passkey"><i class="fas fa-dice mr-1"></i>Random</button>
          </div>
          <p class="text-xs text-slate-400 mt-1">Leave empty to auto-generate a random one.</p>
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">Role</label>
          <select name="role" class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
            <option value="user">User (can sell &amp; view)</option>
            <option value="admin">Admin (full control)</option>
          </select>
        </div>
        <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg">Create Account</button>
      </form>
      <div id="created-user-box"></div>
    </div>
    <div class="bg-white rounded-xl shadow p-5">
      <h3 class="font-bold text-slate-800 mb-3"><i class="fas fa-users text-indigo-600 mr-1"></i>All Accounts (${users.length})</h3>
      ${users.map(u=>`
        <div class="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
          <div>
            <p class="font-semibold text-slate-700">${esc(u.username)}
              <span class="badge ${u.role==='admin'?'bg-indigo-100 text-indigo-700':'bg-slate-100 text-slate-600'} ml-1">${u.role}</span>
            </p>
            <p class="text-xs text-slate-400 font-mono">
              <span class="passkey-hidden" data-key="${esc(u.passkey)}">••••••••••</span>
              <button class="toggle-key text-indigo-500 hover:underline ml-1">show</button>
              <button class="copy-key text-slate-400 hover:text-slate-600 ml-1" data-key="${esc(u.passkey)}" title="Copy passkey"><i class="far fa-copy"></i></button>
            </p>
            <p class="text-xs mt-1 flex flex-wrap gap-x-4 gap-y-1">
              ${u.role === 'admin'
                ? '<span class="badge bg-indigo-50 text-indigo-600"><i class="fas fa-unlock"></i>All pages: always (admin)</span>'
                : `<label class="inline-flex items-center gap-1.5 cursor-pointer select-none" title="Grant or revoke access to the Shop Analytics page">
                    <input type="checkbox" class="analytics-toggle accent-indigo-600" data-uid="${u.id}" ${u.can_analytics ? 'checked' : ''}>
                    <span class="${u.can_analytics ? 'text-emerald-600 font-semibold' : 'text-slate-400'}"><i class="fas fa-chart-line mr-0.5"></i>Analytics ${u.can_analytics ? 'granted' : 'off'}</span>
                  </label>
                  <label class="inline-flex items-center gap-1.5 cursor-pointer select-none" title="Grant or revoke access to the Sold page">
                    <input type="checkbox" class="sold-toggle accent-emerald-600" data-uid="${u.id}" ${u.can_sold ? 'checked' : ''}>
                    <span class="${u.can_sold ? 'text-emerald-600 font-semibold' : 'text-slate-400'}"><i class="fas fa-circle-check mr-0.5"></i>Sold page ${u.can_sold ? 'granted' : 'off'}</span>
                  </label>`}
            </p>
          </div>
          ${u.id !== state.user.id ? `<button data-deluser="${u.id}" class="text-slate-400 hover:text-rose-600" title="Delete account"><i class="fas fa-trash"></i></button>` : '<span class="text-xs text-slate-300">you</span>'}
        </div>`).join('')}
    </div>
  </div>`;

  document.getElementById('gen-passkey').onclick = async () => {
    try {
      const { data } = await api.get('/generate-passkey');
      document.getElementById('new-passkey').value = data.passkey;
    } catch (e) { toast(errMsg(e), 'error'); }
  };

  document.getElementById('user-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const { data } = await api.post('/users', { username: fd.get('username'), passkey: fd.get('passkey'), role: fd.get('role') });
      document.getElementById('created-user-box').innerHTML = `
        <div class="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <p class="text-sm font-bold text-emerald-800"><i class="fas fa-check-circle mr-1"></i>Account created!</p>
          <p class="text-sm text-emerald-700 mt-1">Username: <b>${esc(data.username)}</b></p>
          <p class="text-sm text-emerald-700">Passkey: <b class="font-mono text-base">${esc(data.passkey)}</b></p>
          <p class="text-xs text-emerald-600 mt-1">Share this passkey with them — it's their only way to login.</p>
        </div>`;
      toast('Account created');
      renderAdminUsers(c.parentElement ? c : document.getElementById('admin-content'));
      setTimeout(() => {
        const box = document.getElementById('created-user-box');
        if (box) box.innerHTML = `
        <div class="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <p class="text-sm font-bold text-emerald-800"><i class="fas fa-check-circle mr-1"></i>Account created!</p>
          <p class="text-sm text-emerald-700 mt-1">Username: <b>${esc(data.username)}</b></p>
          <p class="text-sm text-emerald-700">Passkey: <b class="font-mono text-base">${esc(data.passkey)}</b></p>
          <p class="text-xs text-emerald-600 mt-1">Share this passkey with them — it's their only way to login.</p>
        </div>`;
      }, 50);
    } catch (err) { toast(errMsg(err), 'error'); }
  };

  c.querySelectorAll('.toggle-key').forEach(b => b.onclick = () => {
    const span = b.previousElementSibling;
    if (span.textContent === '••••••••••') { span.textContent = span.dataset.key; b.textContent = 'hide'; }
    else { span.textContent = '••••••••••'; b.textContent = 'show'; }
  });
  c.querySelectorAll('.copy-key').forEach(b => b.onclick = () => {
    navigator.clipboard.writeText(b.dataset.key).then(()=>toast('Passkey copied'));
  });
  c.querySelectorAll('[data-deluser]').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this account? They will no longer be able to login.')) return;
    try {
      await api.delete(`/users/${b.dataset.deluser}`);
      toast('Account deleted');
      renderAdminUsers(c);
    } catch (err) { toast(errMsg(err), 'error'); }
  });
  c.querySelectorAll('.analytics-toggle').forEach(cb => cb.onchange = async () => {
    const grant = cb.checked;
    try {
      await api.patch(`/users/${cb.dataset.uid}/analytics-access`, { grant });
      toast(grant ? 'Shop Analytics access granted' : 'Shop Analytics access revoked');
      renderAdminUsers(c);
    } catch (err) {
      cb.checked = !grant; // revert on failure
      toast(errMsg(err), 'error');
    }
  });
  c.querySelectorAll('.sold-toggle').forEach(cb => cb.onchange = async () => {
    const grant = cb.checked;
    try {
      await api.patch(`/users/${cb.dataset.uid}/sold-access`, { grant });
      toast(grant ? 'Sold page access granted' : 'Sold page access revoked');
      renderAdminUsers(c);
    } catch (err) {
      cb.checked = !grant; // revert on failure
      toast(errMsg(err), 'error');
    }
  });
}

// ===== SHIFT TRACKING PAGE =====
async function renderShifts(el) {
  el.innerHTML = `<div class="text-center py-16 text-slate-400"><i class="fas fa-spinner fa-spin text-3xl"></i><p class="mt-2">Loading shifts...</p></div>`;
  const isAdmin = state.user.role === 'admin';
  const sf = state.shiftFilter || (state.shiftFilter = { user_id: '', date: '' });

  let status, history;
  try {
    const params = {};
    if (sf.user_id) params.user_id = sf.user_id;
    if (sf.date) params.date = sf.date;
    [{ data: status }, { data: history }] = await Promise.all([
      api.get('/shifts/status'),
      api.get('/shifts/history', { params }),
    ]);
  } catch (e) { el.innerHTML = `<p class="text-rose-600">${esc(errMsg(e))}</p>`; return; }

  const clockedIn = status.clockedIn;
  const openSince = status.openShift ? dayjs(status.openShift.clock_in + 'Z') : null;

  const fmtShift = (s) => {
    const ci = dayjs(s.clock_in + (s.clock_in.includes('Z')?'':'Z'));
    const co = s.clock_out ? dayjs(s.clock_out + (s.clock_out.includes('Z')?'':'Z')) : null;
    let dur = '—';
    if (co) {
      const mins = co.diff(ci, 'minute');
      dur = Math.floor(mins/60) + 'h ' + (mins%60) + 'm';
    }
    return { ci, co, dur };
  };

  el.innerHTML = `
  <section id="shifts-view" class="fade-in">
    <h2 class="text-2xl font-bold text-slate-800 mb-5"><i class="fas fa-clock text-indigo-600 mr-2"></i>Shift Tracking</h2>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
      <div class="bg-white rounded-xl shadow p-6 text-center">
        <p class="text-xs font-bold uppercase text-slate-400 mb-3">Your status</p>
        <div class="w-20 h-20 rounded-full ${clockedIn?'bg-emerald-100':'bg-slate-100'} flex items-center justify-center mx-auto mb-3">
          <i class="fas ${clockedIn?'fa-user-check text-emerald-600':'fa-user-clock text-slate-400'} text-3xl"></i>
        </div>
        <p class="font-bold text-lg ${clockedIn?'text-emerald-600':'text-slate-500'}">${clockedIn?'ON SHIFT':'OFF SHIFT'}</p>
        ${openSince ? `<p class="text-xs text-slate-400 mt-1">In since ${openSince.format('DD MMM, hh:mm A')}</p>` : ''}
        <div class="flex gap-3 mt-5">
          <button id="clock-in-btn" ${clockedIn?'disabled':''} class="flex-1 py-3 rounded-xl font-bold text-white ${clockedIn?'bg-slate-300 cursor-not-allowed':'bg-emerald-600 hover:bg-emerald-700'}">
            <i class="fas fa-right-to-bracket mr-1"></i>In
          </button>
          <button id="clock-out-btn" ${!clockedIn?'disabled':''} class="flex-1 py-3 rounded-xl font-bold text-white ${!clockedIn?'bg-slate-300 cursor-not-allowed':'bg-rose-600 hover:bg-rose-700'}">
            <i class="fas fa-right-from-bracket mr-1"></i>Quit
          </button>
        </div>
        <button id="forgot-btn" class="mt-3 w-full py-2 rounded-xl border border-amber-300 text-amber-600 font-semibold text-sm hover:bg-amber-50">
          <i class="fas fa-clock-rotate-left mr-1"></i>Forgot — enter missing shift time
        </button>
        <p class="text-[10px] text-slate-400 mt-2"><i class="fas fa-shield-halved mr-1"></i>Anti-spam: 60s cooldown, no double clock-in</p>
      </div>

      <div class="bg-white rounded-xl shadow p-6 lg:col-span-2">
        <p class="text-xs font-bold uppercase text-slate-400 mb-3"><i class="fas fa-tower-broadcast text-emerald-500 mr-1"></i>Live board — who's on shift now</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${status.board.map(b=>`
            <div class="flex items-center justify-between rounded-lg border ${b.open_since?'border-emerald-200 bg-emerald-50':'border-slate-100 bg-slate-50'} px-4 py-3">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full ${b.open_since?'bg-emerald-500 animate-pulse':'bg-slate-300'}"></span>
                <span class="font-semibold text-slate-700">${esc(b.username)}</span>
              </div>
              <span class="text-xs ${b.open_since?'text-emerald-600 font-semibold':'text-slate-400'}">
                ${b.open_since ? 'ON since ' + dayjs(b.open_since + 'Z').format('hh:mm A') : 'off shift'}
              </span>
            </div>`).join('')}
        </div>
        <p class="text-[10px] text-slate-400 mt-3"><i class="fas fa-bell mr-1"></i>Everyone gets a live notification when any employee clicks In or Quit (checks every 5s).</p>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
        <p class="text-xs font-bold uppercase text-slate-400"><i class="fas fa-list mr-1"></i>Shift history log (${history.shifts.length})</p>
        <div class="flex gap-2">
          <select id="shift-user-filter" class="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-sm">
            <option value="">All users</option>
            ${status.board.map(b=>`<option value="${b.id}" ${String(sf.user_id)===String(b.id)?'selected':''}>${esc(b.username)}</option>`).join('')}
          </select>
          <input type="date" id="shift-date-filter" value="${sf.date}" class="px-2 py-1.5 rounded-lg border border-slate-300 text-sm">
          <button id="shift-filter-apply" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold">Filter</button>
          ${sf.user_id||sf.date?`<button id="shift-filter-clear" class="text-slate-400 hover:text-slate-600 text-sm px-2">Clear</button>`:''}
        </div>
      </div>
      ${history.shifts.length ? `
      <div class="overflow-x-auto max-h-96 overflow-y-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 sticky top-0"><tr class="text-left text-xs text-slate-500 uppercase">
            <th class="px-5 py-2">User</th><th class="px-3 py-2">Date</th><th class="px-3 py-2">In</th>
            <th class="px-3 py-2">Quit</th><th class="px-3 py-2">Duration</th><th class="px-3 py-2">Type</th>${isAdmin?'<th class="px-3 py-2"></th>':''}
          </tr></thead>
          <tbody>
            ${history.shifts.map(s=>{
              const f = fmtShift(s);
              return `<tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-5 py-2 font-semibold text-slate-700"><i class="fas fa-user-circle text-slate-300 mr-1"></i>${esc(s.username)}</td>
                <td class="px-3 py-2 text-slate-600">${f.ci.format('DD MMM YYYY')}</td>
                <td class="px-3 py-2 font-semibold text-emerald-600">${f.ci.format('hh:mm A')}</td>
                <td class="px-3 py-2 font-semibold ${f.co?'text-rose-500':'text-emerald-500'}">${f.co ? f.co.format('hh:mm A') + (f.co.isSame(f.ci,'day')?'':' <span class="text-[10px] text-slate-400">'+f.co.format('DD MMM')+'</span>') : '● on shift'}</td>
                <td class="px-3 py-2 text-slate-600">${f.dur}</td>
                <td class="px-3 py-2">${s.manual?'<span class="badge bg-amber-100 text-amber-700"><i class="fas fa-clock-rotate-left"></i>manual</span>':'<span class="badge bg-slate-100 text-slate-500">live</span>'}</td>
                ${isAdmin?`<td class="px-3 py-2"><button data-delshift="${s.id}" class="text-slate-300 hover:text-rose-600" title="Delete entry"><i class="fas fa-trash"></i></button></td>`:''}
              </tr>`;}).join('')}
          </tbody>
        </table>
      </div>` : '<p class="px-5 pb-5 text-slate-400 text-sm">No shift records yet. Click <b>In</b> to start your first shift!</p>'}
    </div>
  </section>`;

  const refresh = () => renderShifts(el);

  document.getElementById('clock-in-btn').onclick = async () => {
    try { await api.post('/shifts/in'); toast('Clocked IN — have a great shift!'); refresh(); }
    catch (e) { toast(errMsg(e), 'error'); }
  };
  document.getElementById('clock-out-btn').onclick = async () => {
    if (!confirm('End your shift now?')) return;
    try { await api.post('/shifts/quit'); toast('Clocked OUT — see you next time!'); refresh(); }
    catch (e) { toast(errMsg(e), 'error'); }
  };
  document.getElementById('forgot-btn').onclick = () => openForgotModal(status.board, refresh);

  document.getElementById('shift-filter-apply').onclick = () => {
    state.shiftFilter = {
      user_id: document.getElementById('shift-user-filter').value,
      date: document.getElementById('shift-date-filter').value,
    };
    refresh();
  };
  const clearBtn = document.getElementById('shift-filter-clear');
  if (clearBtn) clearBtn.onclick = () => { state.shiftFilter = { user_id: '', date: '' }; refresh(); };

  el.querySelectorAll('[data-delshift]').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this shift entry?')) return;
    try { await api.delete(`/shifts/${b.dataset.delshift}`); toast('Shift entry deleted'); refresh(); }
    catch (e) { toast(errMsg(e), 'error'); }
  });
}

// "Forgot" modal — manually enter a missing shift
function openForgotModal(board, onDone) {
  const isAdmin = state.user.role === 'admin';
  const modal = document.getElementById('modal-root');
  modal.innerHTML = `
  <div class="modal-backdrop" id="forgot-modal">
    <div class="modal-panel max-w-md fade-in p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-slate-800"><i class="fas fa-clock-rotate-left text-amber-500 mr-2"></i>Forgot to clock? Enter shift manually</h3>
        <button id="forgot-close" class="text-slate-400 hover:text-slate-700"><i class="fas fa-xmark text-xl"></i></button>
      </div>
      <form id="forgot-form" class="space-y-3">
        ${isAdmin ? `
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">Employee</label>
          <select id="forgot-user" class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
            ${board.map(b=>`<option value="${b.id}" ${b.id===state.user.id?'selected':''}>${esc(b.username)}</option>`).join('')}
          </select>
        </div>` : `<p class="text-xs text-slate-400">Entering missing shift for <b>${esc(state.user.username)}</b></p>`}
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1"><i class="fas fa-right-to-bracket text-emerald-500 mr-1"></i>In — date &amp; time *</label>
          <input id="forgot-in" type="datetime-local" required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none">
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1"><i class="fas fa-right-from-bracket text-rose-500 mr-1"></i>Quit — date &amp; time <span class="text-slate-400 font-normal">(optional, leave empty if still on shift)</span></label>
          <input id="forgot-out" type="datetime-local" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none">
        </div>
        <p class="text-[10px] text-slate-400"><i class="fas fa-shield-halved mr-1"></i>Duplicate entries with the same In time are blocked automatically. Manual entries are marked "manual" in the log.</p>
        <div class="flex gap-3 pt-1">
          <button type="button" id="forgot-cancel" class="flex-1 py-2.5 rounded-lg border border-slate-300 font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" class="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold">Save Shift</button>
        </div>
      </form>
    </div>
  </div>`;
  const close = () => modal.innerHTML = '';
  document.getElementById('forgot-close').onclick = close;
  document.getElementById('forgot-cancel').onclick = close;
  document.getElementById('forgot-modal').onclick = (e) => { if (e.target.id === 'forgot-modal') close(); };
  document.getElementById('forgot-form').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      clock_in: document.getElementById('forgot-in').value,
      clock_out: document.getElementById('forgot-out').value,
    };
    const userSel = document.getElementById('forgot-user');
    if (userSel) payload.user_id = userSel.value;
    try {
      await api.post('/shifts/forgot', payload);
      toast('Missing shift saved');
      close();
      onDone();
    } catch (err) { toast(errMsg(err), 'error'); }
  };
}
