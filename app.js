const menuItems = ["Dashboard", "POS", "Passengers", "Trips", "Plans", "GPS", "Kiosk"];
const storageKey = "shuttlepro-state-v2";

const defaultState = {
  passengers: [
    { id: "P-1001", name: "Nora James", plan: "Weekly" },
    { id: "P-1002", name: "Leo Carter", plan: "Daily" }
  ],
  plans: [
    { id: "PL-1", name: "Daily", price: 8 },
    { id: "PL-2", name: "Weekly", price: 32 },
    { id: "PL-3", name: "Custom", price: 55 }
  ],
  trips: [
    {
      id: "T-1",
      shuttle: "bessie perl",
      date: "2026-02-22",
      pickup: "69 duelk ave",
      dropoff: "72 main street",
      status: "Scheduled"
    }
  ],
  sales: [{ id: "S-1", amount: 32, type: "Subscription", rider: "Nora James" }]
};

const api = {
  async bootstrap() {
    try {
      const response = await fetch("/api/bootstrap");
      if (!response.ok) throw new Error("bootstrap failed");
      return response.json();
    } catch {
      return null;
    }
  },
  async sync(state) {
    try {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state)
      });
    } catch {
      // local-only fallback
    }
  }
};

let state = loadState();

function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return structuredClone(defaultState);
  try {
    return JSON.parse(raw);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  api.sync(state);
}

function nextId(prefix, list) {
  return `${prefix}-${Date.now()}-${list.length + 1}`;
}

function fmtDate(dateStr = new Date().toISOString()) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function makeMenu() {
  const menu = document.getElementById("menu");
  menu.innerHTML = "";
  menuItems.forEach((item) => {
    const button = document.createElement("button");
    button.textContent = item;
    button.onclick = () => showView(item);
    button.id = `menu-${item}`;
    menu.appendChild(button);
  });
}

function setActiveMenu(view) {
  menuItems.forEach((item) => {
    document.getElementById(`menu-${item}`).classList.toggle("active", item === view);
  });
}

function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  document.getElementById(`${name.toLowerCase()}View`).classList.remove("hidden");
  document.getElementById("viewTitle").textContent = name;
  setActiveMenu(name);

  if (name === "Dashboard") renderDashboard();
  if (name === "POS") renderPOS();
  if (name === "Passengers") renderPassengers();
  if (name === "Trips") renderTrips();
  if (name === "Plans") renderPlans();
  if (name === "GPS") renderGPS();
  if (name === "Kiosk") renderKiosk();
}

function overlapWarnings() {
  const grouped = new Map();
  state.trips.forEach((trip) => {
    const key = `${trip.shuttle.toLowerCase()}|${trip.date}`;
    const list = grouped.get(key) || [];
    list.push(trip);
    grouped.set(key, list);
  });

  return [...grouped.values()].filter((group) => group.length > 1);
}

function heatmapStubData() {
  const counts = {};
  state.trips.forEach((trip) => {
    const key = (trip.pickup || "unknown").split(" ").slice(-1)[0].toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
}

function renderDashboard() {
  const el = document.getElementById("dashboardView");
  const subscriptionRevenue = state.sales.filter((s) => s.type === "Subscription").reduce((sum, s) => sum + s.amount, 0);
  const cashRevenue = state.sales.filter((s) => s.type === "Cash").reduce((sum, s) => sum + s.amount, 0);
  const overlaps = overlapWarnings();
  const hotspots = heatmapStubData();

  const metrics = [
    ["Total Passengers", state.passengers.length],
    ["Active Subscriptions", state.passengers.filter((p) => p.plan !== "None").length],
    ["Today's Trips", state.trips.length],
    ["Completed Today", state.trips.filter((t) => t.status === "Completed").length]
  ];

  const rows = state.trips.map((trip) => `<tr><td>${trip.shuttle}</td><td>${trip.pickup}</td><td>${trip.dropoff}</td><td>${trip.status}</td></tr>`).join("") || `<tr><td colspan='4' class='empty'>No trips scheduled for today.</td></tr>`;

  el.innerHTML = `
    <div class="metrics" id="metrics"></div>
    <div class="panel"><h3>Revenue Snapshot</h3><p>Gross: ${money(subscriptionRevenue + cashRevenue)} | Subscription: ${money(subscriptionRevenue)} | Cash-Equivalent: ${money(cashRevenue)}</p></div>
    <div class="panel">
      <h3>Shift Overlap Warnings</h3>
      ${overlaps.length ? overlaps.map((group) => `<p class='warn'>⚠️ ${group[0].shuttle} has ${group.length} trips on ${group[0].date}</p>`).join("") : `<p class='ok'>No overlap conflicts detected.</p>`}
    </div>
    <div class="panel">
      <h3>Route Heatmap (Stub)</h3>
      <div class="heatmap-list">${hotspots.length ? hotspots.map(([area, count]) => `<div class='heat-row'><span>${area}</span><div class='bar' style='width:${Math.min(100, count * 25)}%'></div><b>${count}</b></div>`).join("") : `<p class='empty'>No route data yet.</p>`}</div>
    </div>
    <div class="panel"><h3>Today's Trips</h3><table class="table"><thead><tr><th>Shuttle</th><th>Pickup</th><th>Dropoff</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
  `;

  const holder = document.getElementById("metrics");
  const template = document.getElementById("metricCardTpl");
  metrics.forEach(([label, value]) => {
    const card = template.content.cloneNode(true);
    card.querySelector(".label").textContent = label;
    card.querySelector(".value").textContent = value;
    holder.appendChild(card);
  });
}

function renderPOS() {
  const el = document.getElementById("posView");
  el.innerHTML = `
    <div class="panel">
      <h3>New Sale</h3>
      <form id="saleForm" class="form-grid">
        <select id="saleRider" required>${state.passengers.map((p) => `<option>${p.name}</option>`).join("")}</select>
        <select id="saleType"><option>Subscription</option><option>Cash</option></select>
        <input id="saleAmount" type="number" min="1" value="12" required />
        <button class="primary" type="submit">Save Sale</button>
      </form>
    </div>
    <div class="panel"><h3>Recent Sales</h3><table class="table"><thead><tr><th>Rider</th><th>Type</th><th>Amount</th><th>Actions</th></tr></thead><tbody>
      ${state.sales.map((s) => `<tr><td>${s.rider}</td><td>${s.type}</td><td>${money(s.amount)}</td><td><button class='tiny' data-edit-sale='${s.id}'>Edit</button> <button class='tiny danger' data-del-sale='${s.id}'>Delete</button></td></tr>`).join("")}
    </tbody></table></div>
  `;

  document.getElementById("saleForm").onsubmit = (event) => {
    event.preventDefault();
    state.sales.unshift({
      id: nextId("S", state.sales),
      rider: document.getElementById("saleRider").value,
      type: document.getElementById("saleType").value,
      amount: Number(document.getElementById("saleAmount").value)
    });
    saveState();
    renderPOS();
  };

  el.querySelectorAll("[data-del-sale]").forEach((btn) => {
    btn.onclick = () => {
      state.sales = state.sales.filter((s) => s.id !== btn.dataset.delSale);
      saveState();
      renderPOS();
    };
  });

  el.querySelectorAll("[data-edit-sale]").forEach((btn) => {
    btn.onclick = () => {
      const sale = state.sales.find((s) => s.id === btn.dataset.editSale);
      const updated = Number(prompt("Update sale amount", sale.amount));
      if (!Number.isNaN(updated) && updated > 0) {
        sale.amount = updated;
        saveState();
        renderPOS();
      }
    };
  });
}

function renderPassengers() {
  const el = document.getElementById("passengersView");
  el.innerHTML = `
    <div class="panel"><h3>Add Passenger</h3>
      <form id="passengerForm" class="form-grid">
        <input id="pName" placeholder="Full Name" required />
        <select id="pPlan">${state.plans.map((plan) => `<option>${plan.name}</option>`).join("")}</select>
        <button type="submit" class="primary">Add Passenger</button>
      </form>
    </div>
    <div class="panel"><h3>Passenger List</h3><table class="table"><thead><tr><th>ID</th><th>Name</th><th>Plan</th><th>Actions</th></tr></thead><tbody>
      ${state.passengers.map((p) => `<tr><td>${p.id}</td><td>${p.name}</td><td>${p.plan}</td><td><button class='tiny' data-edit-passenger='${p.id}'>Edit</button> <button class='tiny danger' data-del-passenger='${p.id}'>Delete</button></td></tr>`).join("")}
    </tbody></table></div>
  `;

  document.getElementById("passengerForm").onsubmit = (event) => {
    event.preventDefault();
    const name = document.getElementById("pName").value;
    const plan = document.getElementById("pPlan").value;
    state.passengers.push({ id: nextId("P", state.passengers), name, plan });
    saveState();
    renderPassengers();
  };

  el.querySelectorAll("[data-del-passenger]").forEach((btn) => {
    btn.onclick = () => {
      state.passengers = state.passengers.filter((p) => p.id !== btn.dataset.delPassenger);
      saveState();
      renderPassengers();
    };
  });

  el.querySelectorAll("[data-edit-passenger]").forEach((btn) => {
    btn.onclick = () => {
      const passenger = state.passengers.find((p) => p.id === btn.dataset.editPassenger);
      const name = prompt("Update passenger name", passenger.name);
      if (name) {
        passenger.name = name;
        saveState();
        renderPassengers();
      }
    };
  });
}

function renderTrips() {
  const el = document.getElementById("tripsView");
  const overlaps = overlapWarnings();

  el.innerHTML = `
    <div class="panel"><h3>Create Trip</h3>
      <form id="tripForm" class="form-grid">
        <input id="tripShuttle" placeholder="Shuttle Name" required />
        <input id="tripDate" type="date" required />
        <input id="tripPickup" placeholder="Pickup" required />
        <input id="tripDropoff" placeholder="Dropoff" required />
        <select id="tripStatus"><option>Scheduled</option><option>In Transit</option><option>Completed</option></select>
        <button class="primary" type="submit">Save Trip</button>
      </form>
    </div>
    <div class="panel">
      <h3>Shift Overlap Alerts</h3>
      ${overlaps.length ? overlaps.map((group) => `<p class='warn'>⚠️ ${group[0].shuttle} has ${group.length} overlapping trips on ${group[0].date}</p>`).join("") : `<p class='ok'>No overlaps in schedule.</p>`}
    </div>
    <div class="panel"><h3>Trip Queue</h3><table class="table"><thead><tr><th>Shuttle</th><th>Date</th><th>Pickup</th><th>Dropoff</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${state.trips.map((t) => `<tr><td>${t.shuttle}</td><td>${t.date}</td><td>${t.pickup}</td><td>${t.dropoff}</td><td>${t.status}</td><td><button class='tiny' data-edit-trip='${t.id}'>Edit</button> <button class='tiny danger' data-del-trip='${t.id}'>Delete</button></td></tr>`).join("")}
    </tbody></table></div>
  `;

  document.getElementById("tripForm").onsubmit = (event) => {
    event.preventDefault();
    state.trips.unshift({
      id: nextId("T", state.trips),
      shuttle: document.getElementById("tripShuttle").value,
      date: document.getElementById("tripDate").value,
      pickup: document.getElementById("tripPickup").value,
      dropoff: document.getElementById("tripDropoff").value,
      status: document.getElementById("tripStatus").value
    });
    saveState();
    renderTrips();
  };

  el.querySelectorAll("[data-del-trip]").forEach((btn) => {
    btn.onclick = () => {
      state.trips = state.trips.filter((t) => t.id !== btn.dataset.delTrip);
      saveState();
      renderTrips();
    };
  });

  el.querySelectorAll("[data-edit-trip]").forEach((btn) => {
    btn.onclick = () => {
      const trip = state.trips.find((t) => t.id === btn.dataset.editTrip);
      const status = prompt("Update status", trip.status);
      if (status) {
        trip.status = status;
        saveState();
        renderTrips();
      }
    };
  });
}

function renderPlans() {
  const el = document.getElementById("plansView");
  el.innerHTML = `
    <div class="panel"><h3>Add Plan</h3>
      <form id="planForm" class="form-grid">
        <input id="planName" placeholder="Plan name" required />
        <input id="planPrice" type="number" min="1" placeholder="Price" required />
        <button class="primary" type="submit">Save Plan</button>
      </form>
    </div>
    <div class="panel"><h3>Plan Catalog</h3><table class="table"><thead><tr><th>Plan</th><th>Price</th><th>Actions</th></tr></thead><tbody>
      ${state.plans.map((p) => `<tr><td>${p.name}</td><td>${money(p.price)}</td><td><button class='tiny' data-edit-plan='${p.id}'>Edit</button> <button class='tiny danger' data-del-plan='${p.id}'>Delete</button></td></tr>`).join("")}
    </tbody></table></div>
  `;

  document.getElementById("planForm").onsubmit = (event) => {
    event.preventDefault();
    state.plans.push({
      id: nextId("PL", state.plans),
      name: document.getElementById("planName").value,
      price: Number(document.getElementById("planPrice").value)
    });
    saveState();
    renderPlans();
  };

  el.querySelectorAll("[data-del-plan]").forEach((btn) => {
    btn.onclick = () => {
      state.plans = state.plans.filter((p) => p.id !== btn.dataset.delPlan);
      saveState();
      renderPlans();
    };
  });

  el.querySelectorAll("[data-edit-plan]").forEach((btn) => {
    btn.onclick = () => {
      const plan = state.plans.find((p) => p.id === btn.dataset.editPlan);
      const price = Number(prompt("Update plan price", plan.price));
      if (!Number.isNaN(price) && price > 0) {
        plan.price = price;
        saveState();
        renderPlans();
      }
    };
  });
}

function renderGPS() {
  const el = document.getElementById("gpsView");
  const trip = state.trips[0];
  const hotspots = heatmapStubData();

  el.innerHTML = `
    <div class="split">
      <div class="trip-card">
        <h3>GPS Tracking</h3>
        <p>${state.trips.length} active/scheduled trips</p>
        ${trip ? `<p><strong>${trip.shuttle}</strong><br/>📅 ${trip.date}<br/>📍 ${trip.pickup}<br/>🎯 ${trip.dropoff}</p><p>Status: ${trip.status}</p>` : `<p>No active trips</p>`}
        <hr />
        <h4>Route Heatmap Stub</h4>
        ${hotspots.length ? hotspots.map(([area, count]) => `<p>${area}: ${"🔥".repeat(Math.min(5, count))}</p>`).join("") : `<p>No route hotspots yet.</p>`}
      </div>
      <div class="map">
        <iframe src="https://www.openstreetmap.org/export/embed.html?bbox=-80.2205%2C25.7500%2C-80.1405%2C25.8100&amp;layer=mapnik"></iframe>
      </div>
    </div>
  `;
}

function renderKiosk() {
  const el = document.getElementById("kioskView");
  el.innerHTML = `
    <div class="panel">
      <h3>Kiosk Mode</h3>
      <p>Self-service passenger flow for quick boarding:</p>
      <ul>
        <li>Scan/enter passenger ID</li>
        <li>Select Daily/Weekly/Custom pass</li>
        <li>Tap to pay and print/issue QR pass</li>
      </ul>
      <button class="primary" onclick="alert('Kiosk simulation: Session started')">Start Kiosk Session</button>
    </div>
  `;
}

function attachShortcuts() {
  document.getElementById("todayDate").textContent = fmtDate();
  document.getElementById("saleShortcut").onclick = () => showView("POS");
  document.getElementById("quickSaleBtn").onclick = () => showView("POS");
  document.getElementById("passengerShortcut").onclick = () => showView("Passengers");
}

async function init() {
  const remoteState = await api.bootstrap();
  if (remoteState && !localStorage.getItem(storageKey)) {
    state = remoteState;
    saveState();
  }

  makeMenu();
  attachShortcuts();
  showView("Dashboard");
}

init();
