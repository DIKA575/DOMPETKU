const STORAGE_KEY = "dompetku_transactions_v1";
const categories = {
  income: ["Uang saku", "Gaji", "Bonus", "Hadiah", "Lainnya"],
  expense: ["Makanan", "Transportasi", "Belanja", "Pendidikan", "Hiburan", "Tagihan", "Lainnya"]
};

let transactions = loadTransactions();
const $ = (id) => document.getElementById(id);
const rupiah = (value) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0
}).format(value);

function loadTransactions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}
function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}
function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function formatDate(date) {
  if (!date) return "-";
  return new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric"
  });
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function getFilteredTransactions() {
  const type = $("typeFilter").value;
  const month = $("monthFilter").value;
  return [...transactions]
    .filter(t => type === "all" || t.type === type)
    .filter(t => !month || t.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

function render() {
  const income = transactions.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  $("totalBalance").textContent = rupiah(income - expense);
  $("totalIncome").textContent = rupiah(income);
  $("totalExpense").textContent = rupiah(expense);
  $("transactionCount").textContent = transactions.length;
  $("averageExpense").textContent = rupiah(transactions.filter(t => t.type === "expense").length
    ? Math.round(expense / transactions.filter(t => t.type === "expense").length) : 0);

  const latest = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)[0];
  $("lastTransaction").textContent = latest ? formatDate(latest.date) : "Belum ada";

  const filtered = getFilteredTransactions();
  $("transactionList").innerHTML = filtered.map(t => `
    <tr>
      <td><div class="transaction-name"><span class="transaction-icon ${t.type}">${t.type === "income" ? "↗" : "↘"}</span><span>${escapeHTML(t.description)}</span></div></td>
      <td><span class="category-pill">${escapeHTML(t.category)}</span></td>
      <td class="date-cell">${formatDate(t.date)}</td>
      <td class="money ${t.type}">${t.type === "income" ? "+" : "−"} ${rupiah(t.amount)}</td>
      <td><button class="delete-btn" data-delete="${t.id}" aria-label="Hapus transaksi">×</button></td>
    </tr>`).join("");

  const empty = filtered.length === 0;
  $("emptyState").style.display = empty ? "block" : "none";
  $("transactionList").parentElement.style.display = empty ? "none" : "table";
  drawChart();
}

function drawChart() {
  const canvas = $("financeChart");
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(280, rect.width);
  const height = Math.max(150, rect.height);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("id-ID", { month: "short" })
    });
  }
  const values = months.map(m => ({
    income: transactions.filter(t => t.type === "income" && t.date.startsWith(m.key)).reduce((s,t) => s+t.amount, 0),
    expense: transactions.filter(t => t.type === "expense" && t.date.startsWith(m.key)).reduce((s,t) => s+t.amount, 0)
  }));
  const max = Math.max(1, ...values.flatMap(v => [v.income, v.expense]));
  const pad = { top: 12, bottom: 27, left: 8, right: 8 };
  const chartH = height - pad.top - pad.bottom;
  const groupW = (width - pad.left - pad.right) / 6;
  const barW = Math.min(15, groupW * .23);

  ctx.font = "10px DM Sans, sans-serif";
  ctx.textAlign = "center";
  values.forEach((v, i) => {
    const center = pad.left + groupW * i + groupW / 2;
    const h1 = (v.income / max) * (chartH - 8);
    const h2 = (v.expense / max) * (chartH - 8);
    ctx.fillStyle = "#22b68a";
    roundedBar(ctx, center - barW - 2, pad.top + chartH - h1, barW, h1, 5);
    ctx.fillStyle = "#ef7880";
    roundedBar(ctx, center + 2, pad.top + chartH - h2, barW, h2, 5);
    ctx.fillStyle = "#98a1b1";
    ctx.fillText(months[i].label, center, height - 7);
  });
  $("chartEmpty").style.display = transactions.length ? "none" : "block";
}
function roundedBar(ctx, x, y, w, h, r) {
  if (h <= 0) return;
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
}

function updateCategories(type) {
  $("category").innerHTML = categories[type].map(c => `<option value="${c}">${c}</option>`).join("");
  $("incomeOption").classList.toggle("selected", type === "income");
  $("expenseOption").classList.toggle("selected", type === "expense");
}
function openModal() {
  $("transactionForm").reset();
  $("date").value = localDateString();
  document.querySelector('input[name="type"][value="income"]').checked = true;
  updateCategories("income");
  $("modalBackdrop").classList.add("show");
  $("modalBackdrop").setAttribute("aria-hidden", "false");
  setTimeout(() => $("description").focus(), 50);
}
function closeModal() {
  $("modalBackdrop").classList.remove("show");
  $("modalBackdrop").setAttribute("aria-hidden", "true");
}
function showToast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => $("toast").classList.remove("show"), 2300);
}

$("openFormBtn").addEventListener("click", openModal);
$("emptyAddBtn").addEventListener("click", openModal);
$("closeModalBtn").addEventListener("click", closeModal);
$("modalBackdrop").addEventListener("click", e => { if (e.target === $("modalBackdrop")) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
document.querySelectorAll('input[name="type"]').forEach(input => {
  input.addEventListener("change", e => updateCategories(e.target.value));
});
$("typeFilter").addEventListener("change", render);
$("monthFilter").addEventListener("change", render);

$("transactionForm").addEventListener("submit", e => {
  e.preventDefault();
  const type = document.querySelector('input[name="type"]:checked').value;
  const description = $("description").value.trim();
  const amount = Number($("amount").value);
  const date = $("date").value;
  const category = $("category").value;
  if (!description || !Number.isSafeInteger(amount) || amount <= 0 || !date || !category) {
    showToast("Periksa kembali data transaksimu.");
    return;
  }
  transactions.push({
    id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    type, description, amount, date, category, createdAt: Date.now()
  });
  saveTransactions();
  render();
  closeModal();
  showToast("Transaksi berhasil disimpan.");
});

$("transactionList").addEventListener("click", e => {
  const button = e.target.closest("[data-delete]");
  if (!button) return;
  const id = button.dataset.delete;
  if (!confirm("Yakin ingin menghapus transaksi ini?")) return;
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  render();
  showToast("Transaksi dihapus.");
});

window.addEventListener("resize", drawChart);
updateCategories("income");
render();
