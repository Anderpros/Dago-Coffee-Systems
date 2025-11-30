// ----- DRINK DATA (you can change images later) -----
const DRINKS = [
  { id: "LATTE", name: "Latte", price: 25000, image: "/ui/img/latte.png", qty: 0 },
  { id: "CAPPUCCINO", name: "Cappuccino", price: 27000, image: "/ui/img/cappuccino.png", qty: 0 },
  { id: "AMERICANO", name: "Americano", price: 20000, image: "/ui/img/americano.png", qty: 0 },
  { id: "MATCHA", name: "Matcha", price: 28000, image: "/ui/img/matcha.png", qty: 0 },
  { id: "JASMINE", name: "Jasmine Tea", price: 15000, image: "/ui/img/jasmine.png", qty: 0 },
  { id: "MACCHIATO", name: "Macchiato", price: 22000, image: "/ui/img/macchiato.png", qty: 0 },
];

const VIEWS = {
  home: document.getElementById("homeView"),
  order: document.getElementById("orderView"),
  report: document.getElementById("reportView"),
};

const drinksGrid = document.getElementById("drinksGrid");
const totalAmountEl = document.getElementById("totalAmount");

const paymentModal = document.getElementById("paymentModal");
const cashModal = document.getElementById("cashModal");
const qrisModal = document.getElementById("qrisModal");
const passwordModal = document.getElementById("passwordModal");

const reportPasswordInput = document.getElementById("reportPasswordInput");
const passwordError = document.getElementById("passwordError");

const reportSummary = document.getElementById("reportSummary");
const reportTableBody = document.getElementById("reportTableBody");

const toastEl = document.getElementById("toast");

// Sales Report Password
const PASSWORD = "12345";

// ----- Helpers -----

function showView(name) {
  Object.values(VIEWS).forEach((v) => v.classList.remove("active-view"));
  VIEWS[name].classList.add("active-view");
}

function formatIDR(n) {
  return "IDR " + n.toLocaleString("id-ID");
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 2500);
}

function openModal(modal) {
  modal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

function resetCart() {
  DRINKS.forEach((d) => (d.qty = 0));
  renderDrinks();
  updateTotal();
}

// ----- Render drinks grid -----

function renderDrinks() {
  drinksGrid.innerHTML = "";
  DRINKS.forEach((drink, index) => {
    const card = document.createElement("div");
    card.className = "drink-card";

    const img = document.createElement("img");
    img.className = "drink-image";
    img.src = drink.image;
    img.alt = drink.name;
    card.appendChild(img);

    const name = document.createElement("div");
    name.className = "drink-name";
    name.textContent = drink.name;
    card.appendChild(name);

    const price = document.createElement("div");
    price.className = "drink-price";
    price.textContent = formatIDR(drink.price);
    card.appendChild(price);

    const qtyRow = document.createElement("div");
    qtyRow.className = "quantity-row";

    const label = document.createElement("div");
    label.textContent = "Qty";
    qtyRow.appendChild(label);

    const controls = document.createElement("div");
    controls.className = "qty-controls";

    const btnMinus = document.createElement("button");
    btnMinus.className = "qty-btn";
    btnMinus.textContent = "-";
    btnMinus.onclick = () => changeQty(index, -1);

    const qtyVal = document.createElement("span");
    qtyVal.className = "qty-value";
    qtyVal.textContent = drink.qty;

    const btnPlus = document.createElement("button");
    btnPlus.className = "qty-btn";
    btnPlus.textContent = "+";
    btnPlus.onclick = () => changeQty(index, 1);

    controls.appendChild(btnMinus);
    controls.appendChild(qtyVal);
    controls.appendChild(btnPlus);
    qtyRow.appendChild(controls);

    card.appendChild(qtyRow);
    drinksGrid.appendChild(card);
  });
}

function changeQty(index, delta) {
  const drink = DRINKS[index];
  const newQty = Math.max(0, drink.qty + delta);
  drink.qty = newQty;
  renderDrinks();
  updateTotal();
}

function updateTotal() {
  const total = DRINKS.reduce((sum, d) => sum + d.qty * d.price, 0);
  totalAmountEl.textContent = formatIDR(total);
}

// ----- API calls -----

async function createOrder() {
  const items = DRINKS.filter((d) => d.qty > 0).map((d) => ({
    sku: d.id,
    name: d.name,
    qty: d.qty,
    unitPrice: d.price,
  }));

  const subtotal = items.reduce((s, item) => s + item.qty * item.unitPrice, 0);

  const payload = {
    orderId: null, // client ref not needed
    cartId: "CART-WEB",
    productList: items,
    totalPrice: {
      subtotal,
      discount: 0,
      tax: 0,
      serviceFee: 0,
      grandTotal: subtotal,
    },
    currency: "IDR",
    channel: "WEB",
  };

  const res = await fetch("/api/createOrder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Create order failed");
  }

  return res.json(); // { orderId, status, createdAt }
}

async function confirmPayment(orderId, amount, method) {
  const now = new Date().toISOString();
  const payload = {
    orderId,
    transactionId: "TXN-" + Date.now(),
    amount,
    method,
    status: "CAPTURED",
    paidAt: now,
  };

  const res = await fetch("/api/confirmPayment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Confirm payment failed");
  }

  return res.json(); // { orderId, orderStatus }
}

async function sendToKitchen(orderId, amount, method) {
  const now = new Date().toISOString();
  const items = DRINKS.filter((d) => d.qty > 0).map((d) => ({
    sku: d.id,
    qty: d.qty,
  }));

  const payload = {
    orderId,
    cartId: "CART-WEB",
    payment: {
      status: "CAPTURED",
      method,
      transactionId: "TXN-" + Date.now(),
    },
    items,
    eventType: "FULFILLMENT",
    fulfilledAt: now,
    idempotencyKey: orderId + "-F1",
  };

  const res = await fetch("/api/sendToKitchen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Send to kitchen failed");
  }

  return res.json();
}

async function loadReport() {
  // No query = all sales
  const res = await fetch("/api/reportSales");
  if (!res.ok) {
    throw new Error("Failed to load report");
  }
  const data = await res.json();
  renderReport(data);
}

function renderReport(data) {
  const summary = data.summary || {};
  reportSummary.textContent = `Orders: ${summary.orders || 0}  •  Revenue: ${
    summary.revenue ? formatIDR(summary.revenue) : "IDR 0"
  }  •  Paid Orders: ${summary.paidOrders || 0}`;

  reportTableBody.innerHTML = "";
  (data.rows || []).forEach((row) => {
    const tr = document.createElement("tr");

    const itemsText = (row.items || [])
      .map((item) => `${item.qty}x ${item.name || item.sku}`)
      .join(", ");

    tr.innerHTML = `
      <td>${row.orderId}</td>
      <td>${row.paidAt || ""}</td>
      <td>${itemsText}</td>
      <td>${formatIDR(row.amount || 0)}</td>
      <td>${row.method || ""}</td>
      <td>${row.kitchenTicketId || ""}</td>
    `;
    reportTableBody.appendChild(tr);
  });
}

// ----- Payment flow -----

async function handleCashPaid() {
  try {
    const total = DRINKS.reduce((sum, d) => sum + d.qty * d.price, 0);
    if (total === 0) {
      showToast("Please select at least one drink.");
      return;
    }

    closeModal(cashModal);
    closeModal(paymentModal);
    showToast("Processing order...");

    const order = await createOrder();
    await confirmPayment(order.orderId, total, "CASH");
    await sendToKitchen(order.orderId, total, "CASH");

    showToast("Order sent to kitchen!");
    resetCart();
    showView("home");
  } catch (err) {
    console.error(err);
    showToast("Error completing order");
  }
}

function handleCashCancel() {
  // Cancel = delete cart data
  resetCart();
  closeModal(cashModal);
  closeModal(paymentModal);
  showToast("Order cancelled");
}

// ----- Password flow -----

function openPasswordModal() {
  passwordError.textContent = "";
  reportPasswordInput.value = "";
  openModal(passwordModal);
}

async function handlePasswordSubmit() {
  if (reportPasswordInput.value !== PASSWORD) {
    passwordError.textContent = "Incorrect password.";
    return;
  }
  closeModal(passwordModal);
  showView("report");
  try {
    await loadReport();
  } catch (err) {
    console.error(err);
    showToast("Failed to load report");
  }
}

// ----- Event bindings -----

document.getElementById("btnCreateOrder").addEventListener("click", () => {
  showView("order");
});

document.getElementById("btnReportSales").addEventListener("click", () => {
  openPasswordModal();
});

document.getElementById("btnBackFromOrder").addEventListener("click", () => {
  showView("home");
});

document.getElementById("btnBackFromReport").addEventListener("click", () => {
  showView("home");
});

document.getElementById("btnSubmitOrder").addEventListener("click", () => {
  const total = DRINKS.reduce((s, d) => s + d.qty * d.price, 0);
  if (total === 0) {
    showToast("Please select at least one drink.");
    return;
  }
  openModal(paymentModal);
});

document.getElementById("btnClosePaymentModal").addEventListener("click", () => {
  closeModal(paymentModal);
});

document.getElementById("btnPayCash").addEventListener("click", () => {
  closeModal(paymentModal);
  openModal(cashModal);
});

document.getElementById("btnPayQris").addEventListener("click", () => {
  closeModal(paymentModal);
  openModal(qrisModal);
});

document.getElementById("btnCashPaid").addEventListener("click", handleCashPaid);
document.getElementById("btnCashCancel").addEventListener("click", handleCashCancel);
document.getElementById("btnQrisBack").addEventListener("click", () => {
  closeModal(qrisModal);
  openModal(paymentModal);
});

document.getElementById("btnSubmitPassword").addEventListener("click", handlePasswordSubmit);
document.getElementById("btnCancelPassword").addEventListener("click", () => {
  closeModal(passwordModal);
});

// ----- Init -----
renderDrinks();
updateTotal();
showView("home");
