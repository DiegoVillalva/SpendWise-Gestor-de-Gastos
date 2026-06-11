/* ═══════════════════════════════════════════════════════════
   SpendWise — app.js
   ═══════════════════════════════════════════════════════════ */

// ── State ────────────────────────────────────────────────────
const state = {
  month:    currentMonth(),
  view:     'dashboard',
  summary:  null,
  expenses: [],
  income:   [],
  budgets:  {},
  charts:   { trend: null, donut: null },
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// ── Helpers ──────────────────────────────────────────────────
const fmt = n => {
  const v = parseFloat(n) || 0;
  return '$' + v.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtDate = s => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${d} ${months[+m-1]} ${y}`;
};
const $ = id => document.getElementById(id);

async function api(path, opts = {}) {
  const res  = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  return res.json();
}

function toast(msg, type = 'success') {
  const c = $('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type === 'success' ? '✓' : '✕'}</span> ${msg}`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Navigation ───────────────────────────────────────────────
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));
  $(`view-${name}`).classList.add('active');
  document.querySelector(`[data-view="${name}"]`)?.classList.add('active');
  state.view = name;
  closeSidebar();

  if (name === 'dashboard') loadDashboard();
  if (name === 'expenses')  loadExpenses();
  if (name === 'income')    loadIncome();
  if (name === 'budgets')   loadBudgets();
}

document.querySelectorAll('[data-view]').forEach(el => {
  el.addEventListener('click', () => switchView(el.dataset.view));
});

// ── Sidebar mobile ───────────────────────────────────────────
const sidebar  = document.getElementById('sidebar');
const overlay  = document.getElementById('sidebarOverlay');
const hamburger= document.getElementById('hamburger');

function openSidebar()  { sidebar.classList.add('open'); overlay.classList.add('open'); }
function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('open'); }

hamburger?.addEventListener('click', openSidebar);
overlay?.addEventListener('click', closeSidebar);
document.getElementById('btnAddMobile')?.addEventListener('click', () => {
  closeSidebar();
  openModal('expenseModal');
});

// ── Month picker ─────────────────────────────────────────────
const monthInput = $('globalMonth');
monthInput.value = state.month;
monthInput.addEventListener('change', () => {
  state.month = monthInput.value;
  switchView(state.view);
});

// ── Dashboard ────────────────────────────────────────────────
async function loadDashboard() {
  const [summary, recent] = await Promise.all([
    api(`/api/stats/summary?month=${state.month}`),
    api(`/api/expenses?month=${state.month}&limit=5`),
  ]);
  state.summary = summary;
  state.expenses = recent;

  // KPIs
  const savingsRate = summary.total_inc > 0
    ? Math.round((summary.balance / summary.total_inc) * 100) : 0;

  $('kpiIncome').textContent   = fmt(summary.total_inc);
  $('kpiExpenses').textContent = fmt(summary.total_exp);
  $('kpiBalance').textContent  = fmt(summary.balance);
  $('kpiSavings').textContent  = `${Math.max(0, savingsRate)}%`;

  renderTrend(summary.trend);
  renderDonut(summary.categories);
  renderCategoryBreakdown(summary.categories);
  renderTransactions($('recentTransactions'), recent, true);
}

function renderTrend(trend) {
  const ctx = $('trendChart');
  if (!ctx) return;
  if (state.charts.trend) state.charts.trend.destroy();

  const labels = trend.map(t => {
    const [y, m] = t.month.split('-');
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${months[+m-1]} ${y.slice(2)}`;
  });

  state.charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Ingresos',
          data: trend.map(t => t.income),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,.08)',
          tension: .4, fill: true,
          pointBackgroundColor: '#10b981',
          pointRadius: 4,
        },
        {
          label: 'Gastos',
          data: trend.map(t => t.expenses),
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244,63,94,.08)',
          tension: .4, fill: true,
          pointBackgroundColor: '#f43f5e',
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: '#98a5be', font: { size: 12 }, boxWidth: 12 },
        },
        tooltip: {
          backgroundColor: '#1e2535',
          titleColor: '#e8ecf4',
          bodyColor: '#98a5be',
          borderColor: '#252d40',
          borderWidth: 1,
          callbacks: { label: ctx => ` ${fmt(ctx.raw)}` },
        },
      },
      scales: {
        x: { ticks: { color: '#6b7a99' }, grid: { color: 'rgba(255,255,255,.04)' } },
        y: { ticks: { color: '#6b7a99', callback: v => fmt(v) }, grid: { color: 'rgba(255,255,255,.04)' } },
      },
    },
  });
}

function renderDonut(cats) {
  const ctx = $('donutChart');
  if (!ctx) return;
  if (state.charts.donut) state.charts.donut.destroy();
  if (!cats.length) return;

  state.charts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: cats.map(c => c.name),
      datasets: [{
        data: cats.map(c => c.total),
        backgroundColor: cats.map(c => c.color),
        borderColor: '#1e2535',
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#98a5be',
            font: { size: 11 },
            boxWidth: 10,
            padding: 10,
          },
        },
        tooltip: {
          backgroundColor: '#1e2535',
          titleColor: '#e8ecf4',
          bodyColor: '#98a5be',
          borderColor: '#252d40',
          borderWidth: 1,
          callbacks: { label: ctx => ` ${fmt(ctx.raw)}` },
        },
      },
    },
  });
}

function renderCategoryBreakdown(cats) {
  const el = $('categoryBreakdown');
  if (!cats.length) { el.innerHTML = emptyState('Sin gastos este mes'); return; }

  const max = Math.max(...cats.map(c => c.total));
  el.innerHTML = cats.map(c => {
    const pct = max > 0 ? Math.round((c.total / max) * 100) : 0;
    return `
      <div class="cat-row">
        <div class="cat-row-icon" style="background:${c.color}22">
          ${c.icon}
        </div>
        <div class="cat-row-info">
          <div class="cat-row-name">${c.name}</div>
          <div class="cat-row-amount">${fmt(c.total)}</div>
        </div>
        <div class="cat-row-bar-wrap">
          <div class="cat-row-bar-bg">
            <div class="cat-row-bar-fill" style="width:${pct}%;background:${c.color}"></div>
          </div>
        </div>
        <div class="cat-row-pct">${pct}%</div>
      </div>`;
  }).join('');
}

// ── Transactions ─────────────────────────────────────────────
function renderTransactions(container, items, isExpense = true, allowEdit = false) {
  if (!items.length) {
    container.innerHTML = emptyState(isExpense ? 'Sin gastos registrados' : 'Sin ingresos registrados');
    return;
  }
  container.innerHTML = items.map(item => {
    const info = item.category_info || { icon: '📦', color: '#6b7a99', name: item.source || 'Ingreso' };
    const date = fmtDate(item.date);
    const desc = isExpense ? item.description : item.source;
    const cat  = isExpense ? info.name : 'Ingreso';

    const editBtn = isExpense
      ? `<button class="btn-icon" onclick="editExpense(${item.id})" title="Editar">✎</button>` : '';
    const delFn   = isExpense ? `deleteExpense(${item.id})` : `deleteIncome(${item.id})`;

    return `
      <div class="tx-item" id="tx-${isExpense?'e':'i'}${item.id}">
        <div class="tx-icon" style="background:${info.color}22">${info.icon}</div>
        <div class="tx-info">
          <div class="tx-desc">${desc}</div>
          <div class="tx-meta">${cat} · ${date}</div>
        </div>
        <div class="tx-amount ${isExpense ? 'expense' : 'income'}">
          ${isExpense ? '-' : '+'}${fmt(item.amount)}
        </div>
        <div class="tx-actions">
          ${editBtn}
          <button class="btn-icon del" onclick="${delFn}" title="Eliminar">🗑</button>
        </div>
      </div>`;
  }).join('');
}

function emptyState(msg) {
  return `<div class="empty-state">
    <div class="empty-icon">📭</div>
    <p>${msg}</p>
  </div>`;
}

// ── Expenses view ────────────────────────────────────────────
$('btnAddExpense')?.addEventListener('click',  () => openModal('expenseModal'));
$('btnAddExpense2')?.addEventListener('click', () => openModal('expenseModal'));
$('filterCategory')?.addEventListener('change', loadExpenses);

async function loadExpenses() {
  const cat = $('filterCategory').value;
  const url = `/api/expenses?month=${state.month}&limit=100${cat ? '&category='+cat : ''}`;
  const items = await api(url);
  renderTransactions($('expensesList'), items, true);
}

async function deleteExpense(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  await api(`/api/expenses/${id}`, { method: 'DELETE' });
  toast('Gasto eliminado');
  refreshAll();
}

async function editExpense(id) {
  const items = await api(`/api/expenses?limit=200&month=${state.month}`);
  const item  = items.find(e => e.id === id);
  if (!item) return;

  $('expenseModalTitle').textContent = 'Editar gasto';
  $('expenseId').value     = item.id;
  $('expenseAmount').value = item.amount;
  $('expenseDesc').value   = item.description;
  $('expenseDate').value   = item.date;

  document.querySelectorAll('.cat-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.id === item.category);
  });
  openModal('expenseModal');
}

// ── Income view ──────────────────────────────────────────────
$('btnAddIncome')?.addEventListener('click', () => openModal('incomeModal'));

async function loadIncome() {
  const items = await api(`/api/income?month=${state.month}`);
  renderTransactions($('incomeList'), items, false);
}

async function deleteIncome(id) {
  if (!confirm('¿Eliminar este ingreso?')) return;
  await api(`/api/income/${id}`, { method: 'DELETE' });
  toast('Ingreso eliminado');
  refreshAll();
}

// ── Budgets view ─────────────────────────────────────────────
async function loadBudgets() {
  const [summary, budgets] = await Promise.all([
    api(`/api/stats/summary?month=${state.month}`),
    api('/api/budgets'),
  ]);

  const spendMap = {};
  summary.categories.forEach(c => spendMap[c.id] = c.total);

  const cats = [
    { id:'food', name:'Alimentación', icon:'🍔', color:'#f97316' },
    { id:'transport', name:'Transporte', icon:'🚗', color:'#3b82f6' },
    { id:'housing', name:'Vivienda', icon:'🏠', color:'#8b5cf6' },
    { id:'health', name:'Salud', icon:'💊', color:'#22c55e' },
    { id:'entertainment', name:'Entretenimiento', icon:'🎬', color:'#ec4899' },
    { id:'shopping', name:'Compras', icon:'🛍️', color:'#eab308' },
    { id:'education', name:'Educación', icon:'📚', color:'#06b6d4' },
    { id:'savings', name:'Ahorros', icon:'💰', color:'#10b981' },
    { id:'other', name:'Otros', icon:'📦', color:'#6b7a99' },
  ];

  $('budgetsGrid').innerHTML = cats.map(c => {
    const budget = budgets[c.id] || 0;
    const spent  = spendMap[c.id]  || 0;
    const pct    = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;
    const over   = budget > 0 && spent > budget;
    const barColor = over ? '#f43f5e' : pct > 75 ? '#f59e0b' : c.color;

    return `
      <div class="budget-card" onclick="openBudgetModal('${c.id}','${c.name}',${budget})">
        <div class="budget-card-top">
          <div class="budget-cat-icon" style="background:${c.color}22">${c.icon}</div>
          <div>
            <div class="budget-cat-name">${c.name}</div>
            <div class="budget-cat-sub">${budget > 0 ? 'Presupuesto activo' : 'Sin presupuesto'}</div>
          </div>
        </div>
        <div class="budget-amounts">
          <span>Gastado: ${fmt(spent)}</span>
          <span>${budget > 0 ? 'Límite: '+fmt(budget) : 'Toca para configurar'}</span>
        </div>
        <div class="budget-bar-bg">
          <div class="budget-bar-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
        <div class="budget-pct" style="color:${over ? '#f43f5e' : ''}">
          ${budget > 0 ? (over ? '⚠ Presupuesto superado' : `${pct}% utilizado`) : '—'}
        </div>
      </div>`;
  }).join('');
}

function openBudgetModal(catId, catName, currentAmount) {
  $('budgetCat').value     = catId;
  $('budgetCatName').value = catName;
  $('budgetAmount').value  = currentAmount || '';
  openModal('budgetModal');
}

$('saveBudget')?.addEventListener('click', async () => {
  const cat    = $('budgetCat').value;
  const amount = parseFloat($('budgetAmount').value);
  if (!cat || !amount || amount <= 0) { toast('Ingresa un monto válido', 'error'); return; }

  await api('/api/budgets', {
    method: 'POST',
    body: JSON.stringify({ category: cat, amount }),
  });
  closeModal('budgetModal');
  toast('Presupuesto guardado ✓');
  loadBudgets();
});

// ── Expense modal save ────────────────────────────────────────
$('saveExpense')?.addEventListener('click', async () => {
  const id     = $('expenseId').value;
  const amount = parseFloat($('expenseAmount').value);
  const desc   = $('expenseDesc').value.trim();
  const date   = $('expenseDate').value;
  const selBtn = document.querySelector('.cat-btn.selected');
  const cat    = selBtn?.dataset.id;

  if (!amount || amount <= 0) { toast('Ingresa un monto válido', 'error'); return; }
  if (!desc)   { toast('Escribe una descripción', 'error'); return; }
  if (!cat)    { toast('Selecciona una categoría', 'error'); return; }
  if (!date)   { toast('Selecciona una fecha', 'error'); return; }

  const payload = { amount, description: desc, category: cat, date };

  if (id) {
    await api(`/api/expenses/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    toast('Gasto actualizado');
  } else {
    await api('/api/expenses', { method: 'POST', body: JSON.stringify(payload) });
    toast('Gasto registrado');
  }

  closeModal('expenseModal');
  refreshAll();
});

// ── Income modal save ─────────────────────────────────────────
$('saveIncome')?.addEventListener('click', async () => {
  const amount = parseFloat($('incomeAmount').value);
  const source = $('incomeSource').value.trim();
  const date   = $('incomeDate').value;

  if (!amount || amount <= 0) { toast('Ingresa un monto válido', 'error'); return; }
  if (!source) { toast('Indica la fuente de ingreso', 'error'); return; }
  if (!date)   { toast('Selecciona una fecha', 'error'); return; }

  await api('/api/income', {
    method: 'POST',
    body: JSON.stringify({ amount, source, date }),
  });
  closeModal('incomeModal');
  toast('Ingreso registrado');
  refreshAll();
});

// ── Modal helpers ─────────────────────────────────────────────
function openModal(id) {
  if (id === 'expenseModal') {
    const isEdit = !!$('expenseId').value;
    if (!isEdit) {
      $('expenseModalTitle').textContent = 'Nuevo gasto';
      $('expenseId').value = '';
      $('expenseAmount').value = '';
      $('expenseDesc').value = '';
      $('expenseDate').value = new Date().toISOString().split('T')[0];
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
    }
  }
  if (id === 'incomeModal') {
    $('incomeAmount').value = '';
    $('incomeSource').value = '';
    $('incomeDate').value = new Date().toISOString().split('T')[0];
  }
  $(id).classList.add('open');
}

function closeModal(id) {
  $(id).classList.remove('open');
  if (id === 'expenseModal') $('expenseId').value = '';
}

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closeModal(backdrop.id);
  });
});

// Category picker
document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

// ── Refresh all ───────────────────────────────────────────────
function refreshAll() {
  if (state.view === 'dashboard') loadDashboard();
  if (state.view === 'expenses')  loadExpenses();
  if (state.view === 'income')    loadIncome();
  if (state.view === 'budgets')   loadBudgets();
}

// ── Init ──────────────────────────────────────────────────────
loadDashboard();

// Expose for inline handlers
window.deleteExpense = deleteExpense;
window.deleteIncome  = deleteIncome;
window.editExpense   = editExpense;
window.openBudgetModal = openBudgetModal;
