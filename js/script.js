const KEY_TRANSACTIONS = 'eviz_transactions';
const KEY_CATEGORIES   = 'eviz_categories';
const KEY_THEME        = 'eviz_theme';

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun', 'Shopping', 'Health', 'Other'];

const COLOR_PALETTE = [
  '#4caf50', '#2196f3', '#ff9800', '#9c27b0',
  '#f44336', '#607d8b', '#e91e63', '#00bcd4',
  '#ff5722', '#8bc34a', '#3f51b5', '#ffc107',
];

let transactions = load(KEY_TRANSACTIONS, []);
let categories   = load(KEY_CATEGORIES, [...DEFAULT_CATEGORIES]);
let chart        = null;
let isDark       = load(KEY_THEME, false);

const form              = document.getElementById('transactionForm');
const itemNameInput     = document.getElementById('itemName');
const amountInput       = document.getElementById('amount');
const categorySelect    = document.getElementById('category');
const totalBalanceEl    = document.getElementById('totalBalance');
const transactionListEl = document.getElementById('transactionList');
const chartLegendEl     = document.getElementById('chartLegend');
const chartCanvas       = document.getElementById('spendingChart');
const themeToggleBtn    = document.getElementById('themeToggle');
const newCategoryInput  = document.getElementById('newCategoryInput');
const btnAddCategory    = document.getElementById('btnAddCategory');
const categoryTagsEl    = document.getElementById('categoryTags');
const summaryMonthSel   = document.getElementById('summaryMonth');
const summaryStatsEl    = document.getElementById('summaryStats');
const summaryTableWrap  = document.getElementById('summaryTableWrap');

applyTheme();
populateSummaryMonths();
renderAll();

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name     = itemNameInput.value.trim();
  const amount   = parseFloat(amountInput.value);
  const category = categorySelect.value;
  if (!name || isNaN(amount) || amount <= 0 || !category) return;

  transactions.push({
    id: Date.now(),
    name,
    amount,
    category,
    date: new Date().toISOString(),
  });
  save(KEY_TRANSACTIONS, transactions);
  renderAll();
  form.reset();
  categorySelect.value = '';
});

themeToggleBtn.addEventListener('click', () => {
  isDark = !isDark;
  save(KEY_THEME, isDark);
  applyTheme();
});

btnAddCategory.addEventListener('click', addCategory);
newCategoryInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addCategory(); }
});

summaryMonthSel.addEventListener('change', renderSummary);

function applyTheme() {
  document.body.classList.toggle('dark', isDark);
  themeToggleBtn.textContent = isDark ? '☀️' : '🌙';
}

function addCategory() {
  const val = newCategoryInput.value.trim();
  if (!val) return;
  const normalized = val.charAt(0).toUpperCase() + val.slice(1);
  if (categories.map(c => c.toLowerCase()).includes(normalized.toLowerCase())) {
    newCategoryInput.value = '';
    return;
  }
  categories.push(normalized);
  save(KEY_CATEGORIES, categories);
  newCategoryInput.value = '';
  renderCategories();
  renderCategorySelect();
}

function deleteCategory(cat) {
  if (DEFAULT_CATEGORIES.includes(cat)) return;
  categories = categories.filter(c => c !== cat);
  save(KEY_CATEGORIES, categories);
  renderCategories();
  renderCategorySelect();
}

function renderCategories() {
  categoryTagsEl.innerHTML = categories.map(cat => {
    const isDefault = DEFAULT_CATEGORIES.includes(cat);
    const color = getCategoryColor(cat);
    return `
      <span class="category-tag${isDefault ? ' default-tag' : ''}">
        <span class="legend-dot" style="background:${color}"></span>
        ${escapeHTML(cat)}
        ${!isDefault
          ? `<button class="btn-cat-del" data-cat="${escapeHTML(cat)}" aria-label="Remove ${escapeHTML(cat)}">×</button>`
          : ''}
      </span>`;
  }).join('');

  categoryTagsEl.querySelectorAll('.btn-cat-del').forEach(btn => {
    btn.addEventListener('click', () => deleteCategory(btn.dataset.cat));
  });
}

function renderCategorySelect() {
  const current = categorySelect.value;
  categorySelect.innerHTML = '<option value="" disabled>Select category</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (cat === current) opt.selected = true;
    categorySelect.appendChild(opt);
  });
}

function populateSummaryMonths() {
  const monthSet = new Set();
  const now = new Date();
  monthSet.add(formatMonthKey(now));
  transactions.forEach(t => monthSet.add(formatMonthKey(new Date(t.date))));

  const months = [...monthSet].sort((a, b) => b.localeCompare(a));

  summaryMonthSel.innerHTML = '';
  months.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = formatMonthLabel(m);
    summaryMonthSel.appendChild(opt);
  });
}

function renderSummary() {
  const selectedKey = summaryMonthSel.value;
  if (!selectedKey) return;

  const [year, month] = selectedKey.split('-').map(Number);
  const filtered = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  const total  = filtered.reduce((s, t) => s + t.amount, 0);
  const count  = filtered.length;
  const topCat = getTopCategory(filtered);

  summaryStatsEl.innerHTML = `
    <div class="summary-stat-card">
      <div class="summary-stat-label">Total Spent</div>
      <div class="summary-stat-value">${formatCurrency(total)}</div>
    </div>
    <div class="summary-stat-card">
      <div class="summary-stat-label">Transactions</div>
      <div class="summary-stat-value">${count}</div>
    </div>
    <div class="summary-stat-card">
      <div class="summary-stat-label">Top Category</div>
      <div class="summary-stat-value">${escapeHTML(topCat || '—')}</div>
    </div>
  `;

  if (filtered.length === 0) {
    summaryTableWrap.innerHTML = '<p class="summary-empty">No transactions this month.</p>';
    return;
  }

  const catTotals = {};
  filtered.forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
  });

  const rows = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => {
      const pct = total > 0 ? ((amt / total) * 100).toFixed(1) : '0.0';
      const color = getCategoryColor(cat);
      return `
        <tr>
          <td><span class="summary-cat-dot" style="background:${color}"></span>${escapeHTML(cat)}</td>
          <td>${formatCurrency(amt)}</td>
          <td>${pct}%</td>
        </tr>`;
    }).join('');

  summaryTableWrap.innerHTML = `
    <table class="summary-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Amount</th>
          <th>Share</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function getTopCategory(txns) {
  if (!txns.length) return null;
  const totals = {};
  txns.forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });
  return Object.entries(totals).sort((a, b) => b[1] - a[1])[0][0];
}

function renderAll() {
  renderBalance();
  renderTransactionList();
  renderChart();
  renderCategories();
  renderCategorySelect();
  populateSummaryMonths();
  renderSummary();
}

function renderBalance() {
  const total = transactions.reduce((s, t) => s + t.amount, 0);
  totalBalanceEl.textContent = formatCurrency(total);
}

function renderTransactionList() {
  transactionListEl.innerHTML = '';

  if (transactions.length === 0) {
    transactionListEl.innerHTML = '<li class="empty-state">No transactions yet.</li>';
    return;
  }

  [...transactions].reverse().forEach(t => {
    const li = document.createElement('li');
    li.className = 'transaction-item';
    li.style.borderLeftColor = getCategoryColor(t.category);

    const displayDate = new Date(t.date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });

    li.innerHTML = `
      <div class="transaction-info">
        <div class="transaction-name">${escapeHTML(t.name)}</div>
        <div class="transaction-meta">${escapeHTML(t.category)} &bull; ${escapeHTML(displayDate)}</div>
      </div>
      <span class="transaction-amount">${formatCurrency(t.amount)}</span>
      <button class="btn-delete" data-id="${t.id}" aria-label="Delete ${escapeHTML(t.name)}">Delete</button>
    `;
    transactionListEl.appendChild(li);
  });

  transactionListEl.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      transactions = transactions.filter(t => t.id !== Number(btn.dataset.id));
      save(KEY_TRANSACTIONS, transactions);
      renderAll();
    });
  });
}

function renderChart() {
  const totals = {};
  transactions.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(totals);
  const data   = Object.values(totals);
  const colors = labels.map(getCategoryColor);

  chartLegendEl.innerHTML = labels.map(label => `
    <li>
      <span class="legend-dot" style="background:${getCategoryColor(label)}"></span>
      ${escapeHTML(label)}
    </li>`).join('');

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = colors;
    chart.update();
    return;
  }

  chart = new Chart(chartCanvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.parsed)}`,
          },
        },
      },
    },
  });

  // Detach Chart.js resize observer so mobile touch events can't shrink the chart
  if (chart._resizeObserver) {
    chart._resizeObserver.disconnect();
  }
}

function getCategoryColor(cat) {
  const idx = categories.indexOf(cat);
  return COLOR_PALETTE[idx % COLOR_PALETTE.length] || '#607d8b';
}

function formatMonthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatMonthLabel(key) {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatCurrency(value) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
