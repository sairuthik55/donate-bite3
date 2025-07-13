// --- Firebase Setup ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js";
import {
  getFirestore, collection, addDoc, doc, deleteDoc, updateDoc,
  onSnapshot, query, where
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {
  getMessaging, getToken, onMessage
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5ZF4WBaN5DuXjYQxOet1VDwPeoUgEyf8",
  authDomain: "donate-bite-417bd.firebaseapp.com",
  projectId: "donate-bite-417bd",
  storageBucket: "donate-bite-417bd.appspot.com",
  messagingSenderId: "305748721042",
  appId: "1:305748721042:web:1d17db547c1163e675154b",
  measurementId: "G-WGJXW5646V"
};
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const donationsRef = collection(db, "donations");
const claimsRef = collection(db, "claims");
const feedbackRef = collection(db, "feedbacks");

// --- Push Notifications ---
if ("Notification" in window && Notification.permission !== "granted") {
  Notification.requestPermission();
}

const messaging = getMessaging(app);

navigator.serviceWorker.register('firebase-messaging-sw.js').then((registration) => {
  messaging.useServiceWorker(registration);
  getToken(messaging, {
    vapidKey: "BIWwbxIB7XZhwVqE4w1vjeKXlNat3tVYxydBU8rqIwKV2nlzNrpzngS-M4esQQJb3qpqPP7c2dS_9M8w4Gn4R00"
  }).then((token) => {
    if (token) addDoc(collection(db, "tokens"), { token });
  });
});

onMessage(messaging, (payload) => {
  const { title, body, icon } = payload.notification;
  new Notification(title, { body, icon });
});

// --- DOM Elements ---
const donorForm = document.getElementById("donorForm");
const donationList = document.getElementById("donationList");
const roleSelect = document.getElementById("roleSelect");
const consumerSection = document.getElementById("consumerSection");
const searchInput = document.getElementById("locationSearch");
const dashboard = document.getElementById("dashboard");
const feedbackSection = document.getElementById("feedbackSection");
const feedbackList = document.getElementById("feedbackList");
const claimConfirmSection = document.getElementById("claimConfirmSection");
const claimInfo = document.getElementById("claimInfo");

// --- Utility Functions ---
function hideAll() {
  donorForm?.classList.add("hidden");
  consumerSection?.classList.add("hidden");
  dashboard?.classList.add("hidden");
  feedbackSection?.classList.add("hidden");
  claimConfirmSection?.classList.add("hidden");
  document.getElementById("adminLoginSection")?.remove();
  document.getElementById("adminSection")?.remove();
  document.getElementById("ngoSection")?.classList.add("hidden");
}

function goBack() {
  hideAll();
  document.getElementById("donorHistorySection")?.classList.add("hidden");
  document.getElementById("consumerHistorySection")?.classList.add("hidden");
  roleSelect.style.display = "flex";
}

function parseQuantity(qStr = "") {
  const [amountStr = "0", unitStr = "units"] = qStr.trim().split(/\s+/);
  return { amount: parseFloat(amountStr) || 0, unit: unitStr.toLowerCase() };
}

function summarise(list) {
  return list.reduce((sum, d) => {
    const { amount, unit } = parseQuantity(d.quantity);
    if (!isNaN(amount)) sum[unit] = (sum[unit] || 0) + amount;
    return sum;
  }, {});
}

function fmtSum(sumObj = {}) {
  return Object.entries(sumObj).map(([unit, val]) => `${val} ${unit}`).join(", ") || "0";
}

function daysLeft(expiry) {
  const today = new Date();
  const exp = new Date(expiry);
  return Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
}

function selectRole(role) {
  hideAll();
  roleSelect.style.display = "none";
  if (role === "donor") donorForm.classList.remove("hidden");
  else if (role === "consumer") {
    consumerSection.classList.remove("hidden");
    showAvailableFood();
    initConsumerMap();
  } else if (role === "admin") showAdminLogin();
  else if (role === "ngo") document.getElementById("ngoSection").classList.remove("hidden");
}
window.selectRole = selectRole;
window.goBack = goBack;

// --- Donor Submission ---
donorForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const donorName = document.getElementById("donorName").value.trim();
  const donorContact = document.getElementById("donorContact").value.trim();
  const foodDetails = document.getElementById("foodDetails").value.trim();
  const location = document.getElementById("location").value.trim();
  const dateCooked = document.getElementById("dateCooked").value;
  const expiryDate = document.getElementById("expiryDate").value;
  const qty = document.getElementById("quantity").value.trim();
  const unit = document.getElementById("unit").value;
  const photoInput = document.getElementById("foodPhoto");
  let photo = null;
  if (photoInput.files.length) {
    const file = photoInput.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      photo = reader.result;
      await save();
    };
    reader.readAsDataURL(file);
  } else await save();

  async function save() {
    const data = {
      donorName, donorContact, foodDetails, location,
      dateCooked, expiryDate,
      quantity: `${qty} ${unit}`,
      status: "pending",
      timestamp: Date.now(),
      photo
    };
    console.log("Submitting donation:", data);
    try {
      await addDoc(donationsRef, data);
      alert("✅ Donation submitted successfully!");
      donorForm.reset();
    } catch (err) {
      console.error("❌ Error submitting donation:", err);
      alert("Error submitting donation. Check console.");
    }
  }
});
// --- Show Available Food ---
function showAvailableFood() {
  const term = searchInput.value.trim().toLowerCase();
  onSnapshot(query(donationsRef, where("status", "==", "approved")), snap => {
    donationList.innerHTML = "";
    snap.forEach(docSnap => {
      const d = docSnap.data();
      if (!d.location.toLowerCase().includes(term)) return;
      const id = docSnap.id;
      const remaining = parseQuantity(d.quantity);
      const expireSoon = daysLeft(d.expiryDate) <= 1;

      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${d.foodDetails}</strong><br>
        Donor: ${d.donorName} (${d.donorContact})<br>
        📍 ${d.location}<br>
        🍳 ${d.dateCooked} • ⏳ ${d.expiryDate} ${expireSoon ? '<span style="color:red">⚠</span>' : ''}<br>
        ⚖ ${d.quantity}<br>
<span class="status-badge ${d.status}">${d.status.toUpperCase()}</span><br>
        ${d.photo ? `<img src="${d.photo}" alt="Food photo">` : ""}
        <input type="number" id="claim-${id}" placeholder="Amount to claim" min="1" max="${remaining.amount}" style="width:100px"> ${remaining.unit}<br>
        <button class="claim-btn" onclick="claimPartial('${id}', ${JSON.stringify(d).replace(/"/g, '&quot;')})">➕ Claim</button>
        <button onclick="getDirections('${d.location}')">🧭 Get Directions</button>
        <button onclick="copyLink('${d.location}')">📋 Copy Link</button>
      `;
      donationList.appendChild(li);
    });
  });
}
window.showAvailableFood = showAvailableFood;

// --- Consumer Map ---
let consumerMap;
function initConsumerMap() {
  if (!consumerMap) {
    consumerMap = L.map("consumerMap").setView([20.5937, 78.9629], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(consumerMap);
  }

  // Remove only donation markers, not the user's current location marker
consumerMap.eachLayer(layer => {
  if (layer instanceof L.Marker && !layer._icon.src.includes('blue-dot')) {
    consumerMap.removeLayer(layer);
  }
});


  onSnapshot(query(donationsRef, where("status", "==", "approved")), snap => {
    snap.forEach(docSnap => {
      const d = docSnap.data();
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(d.location)}`)
        .then(res => res.json())
        .then(data => {
          if (data.length > 0) {
            const { lat, lon } = data[0];
            L.marker([lat, lon]).addTo(consumerMap)
              .bindPopup(`<b>${d.foodDetails}</b><br>${d.donorName}<br>${d.location}`);
          }
        });
    });
  });
}
// ✅ Show consumer's current location
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;

    L.marker([latitude, longitude], {
      icon: L.icon({
        iconUrl: "https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png",
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      })
    })
    .addTo(consumerMap)
    .bindPopup("📍 You are here")
    .openPopup();

    consumerMap.setView([latitude, longitude], 13);
  }, () => {
    console.warn("Geolocation permission denied.");
  });
} else {
  console.warn("Geolocation not supported.");
}
// --- Claim Logic ---
window.claimPartial = async (id, item) => {
  const input = document.getElementById(`claim-${id}`);
  const claimAmt = parseFloat(input.value);
  const { amount, unit } = parseQuantity(item.quantity);

  if (!claimAmt || claimAmt <= 0 || claimAmt > amount) {
    return alert("Invalid quantity");
  }

  const consumerName = prompt("✅ Food claimed!\nPlease enter your name for tracking:");
  if (!consumerName?.trim()) return alert("Name is required to register your claim.");

  await addDoc(claimsRef, {
    ...item,
    quantity: `${claimAmt} ${unit}`,
    consumerName: consumerName.trim(),
    claimTimestamp: Date.now()
  });

  const feedback = prompt("✅ Food claimed! Leave any feedback?");
  if (feedback?.trim()) {
    await addDoc(feedbackRef, {
      message: feedback,
      time: Date.now()
    });
  }

  if (claimAmt === amount) {
    await deleteDoc(doc(donationsRef, id));
  } else {
    await updateDoc(doc(donationsRef, id), {
      quantity: `${amount - claimAmt} ${unit}`
    });
  }
  hideAll();
  claimConfirmSection.classList.remove("hidden");
  claimInfo.textContent = `You claimed ${claimAmt} ${unit} of "${item.foodDetails}" from ${item.donorName} at ${item.location}.`;
};
window.saveConsumerName = () => {
  hideAll();
  consumerSection.classList.remove("hidden");
  roleSelect.style.display = "none";
  showAvailableFood();
};
// --- Directions ---
window.getDirections = (destination) => {
  if (!destination) return alert("Location not found");

  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}`)
      .then(res => res.json())
      .then(data => {
        if (!data.length) return alert("Could not find destination");

        const { lat, lon } = data[0];
        const url = `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${lat},${lon}&travelmode=driving`;
        window.open(url, "_blank");
      });
  }, () => alert("Enable location access to get directions."));
};
// --- Copy Link ---
window.copyLink = (destination) => {
  if (!destination) return;
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}`)
    .then(res => res.json())
    .then(data => {
      if (!data.length) return alert("Could not find location");
      const { lat, lon } = data[0];
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
      navigator.clipboard.writeText(url)
        .then(() => alert("📍 Link copied to clipboard!"))
        .catch(() => prompt("Copy manually:", url));
    });
};
// --- Dashboard ---
function goToDashboard() {
  hideAll();
  dashboard.classList.remove("hidden");
  roleSelect.style.display = "none";
  updateDashboard();
  loadFeedback();
}
window.goToDashboard = goToDashboard;

function updateDashboard() {
  const approvedQuery = query(donationsRef, where("status", "==", "approved"));
  onSnapshot(approvedQuery, approvedSnap => {
    onSnapshot(claimsRef, claimedSnap => {
      const donors = new Set(), availArr = [], claimArr = [];
      approvedSnap.forEach(doc => { const d = doc.data(); donors.add(d.donorContact); availArr.push(d); });
      claimedSnap.forEach(doc => { const d = doc.data(); donors.add(d.donorContact); claimArr.push(d); });

      document.getElementById("foodAvailable").textContent = fmtSum(summarise(availArr));
      document.getElementById("foodDonated").textContent = fmtSum(summarise(claimArr));
      document.getElementById("donorCount").textContent = donors.size;
      document.getElementById("consumerCount").textContent = claimedSnap.size;
    });
  });
}

function loadFeedback() {
  feedbackSection.classList.remove("hidden");
  onSnapshot(feedbackRef, snap => {
    feedbackList.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      const li = document.createElement("li");
      li.textContent = `💬 ${d.message}`;
      feedbackList.appendChild(li);
    });
  });
}

// --- Admin Panel ---
function showAdminLogin() {
  const sec = document.createElement("section");
  sec.id = "adminLoginSection";
  sec.className = "form-card";
  sec.innerHTML = `
    <h2>Admin Login</h2>
    <input id="adminId" placeholder="Admin ID"><br>
    <input type="password" id="adminPwd" placeholder="Password"><br>
    <button onclick="verifyAdmin()">Login</button>
    <button onclick="goBack()">Back</button>
    <div id="loginMsg" style="color:red"></div>`;
  document.querySelector(".container").appendChild(sec);
}
window.showAdminLogin = showAdminLogin;

window.verifyAdmin = () => {
  const id = document.getElementById("adminId").value;
  const pwd = document.getElementById("adminPwd").value;
  if (id === "pheonix" && pwd === "donate bite") {
    document.getElementById("adminLoginSection").remove();
    showAdminPanel();
  } else {
    document.getElementById("loginMsg").textContent = "Invalid credentials";
  }
};

function showAdminPanel() {
  hideAll();
  const sec = document.createElement("section");
  sec.id = "adminSection";
  sec.className = "form-card";
  sec.innerHTML = `
    <h2>🛠 Admin Panel</h2>
    <div class="admin-block">
      <h3>⏳ Pending Donations</h3><ul id="pendingList"></ul>
      <h3>✅ Approved Donations</h3><ul id="approvedList"></ul>
      <button class="back-btn" onclick="goBack()">← Back</button>
    </div>`;
  document.querySelector(".container").appendChild(sec);

  onSnapshot(donationsRef, snap => {
    const pend = document.getElementById("pendingList");
    const appr = document.getElementById("approvedList");
    pend.innerHTML = appr.innerHTML = "";
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${d.foodDetails}</strong><br>
        Donor: ${d.donorName} (${d.donorContact})<br>
        📍 ${d.location}<br>
        🍳 ${d.dateCooked} • ⏳ ${d.expiryDate}<br>
        ⚖ ${d.quantity}<br>
<span class="status-badge ${d.status}">${d.status.toUpperCase()}</span><br>
        ${d.photo ? `<img src="${d.photo}" style="max-width:80px">` : ""}
        ${d.status === "pending"
          ? `<button onclick="approveDonation('${docSnap.id}')">Approve</button>
             <button onclick="rejectDonation('${docSnap.id}')">Reject</button>`
          : `<button onclick="removeDonation('${docSnap.id}')">🗑 Remove</button>`}`;
      (d.status === "pending" ? pend : appr).appendChild(li);
    });
  });
}
window.approveDonation = id => updateDoc(doc(donationsRef, id), { status: "approved" });
window.rejectDonation = id => deleteDoc(doc(donationsRef, id));
window.removeDonation = id => confirm("Remove this donation?") && deleteDoc(doc(donationsRef, id));

// --- Donor History ---
window.openDonorHistory = () => {
  hideAll();
  document.getElementById("donorHistorySection").classList.remove("hidden");
  document.getElementById("donorHistoryList").innerHTML = "";
};

window.searchDonorHistory = () => {
  const name = document.getElementById("donorHistoryName").value.trim().toLowerCase();
  const list = document.getElementById("donorHistoryList");
  list.innerHTML = "Loading...";

  onSnapshot(donationsRef, donationSnap => {
    const donationMatches = donationSnap.docs.filter(doc =>
      doc.data().donorName?.toLowerCase().includes(name)
    ).map(doc => ({ ...doc.data(), source: "Donation" }));

    onSnapshot(claimsRef, claimsSnap => {
      const claimMatches = claimsSnap.docs.filter(doc =>
        doc.data().donorName?.toLowerCase().includes(name)
      ).map(doc => ({ ...doc.data(), source: "Claim" }));

      const allMatches = [...donationMatches, ...claimMatches];
      list.innerHTML = "";

      if (allMatches.length === 0) {
        list.innerHTML = "<li>No records found for this donor.</li>";
        return;
      }

      allMatches.forEach(d => {
        const li = document.createElement("li");
        li.innerHTML = `
          <strong>${d.foodDetails}</strong><br>
          📍 ${d.location}<br>
          🍳 ${d.dateCooked} • ⏳ ${d.expiryDate}<br>
          ⚖ ${d.quantity}<br>
          Source: ${d.source} ${d.consumerName ? `→ Claimed by: ${d.consumerName}` : ""}`;
        list.appendChild(li);
      });
    });
  });
};

// --- Consumer History ---
window.openConsumerHistory = () => {
  hideAll();
  document.getElementById("consumerHistorySection").classList.remove("hidden");
  document.getElementById("consumerHistoryList").innerHTML = "";
};

window.searchConsumerHistory = () => {
  const name = document.getElementById("consumerHistoryName").value.trim().toLowerCase();
  const list = document.getElementById("consumerHistoryList");
  list.innerHTML = "Loading...";

  onSnapshot(claimsRef, snap => {
    const matches = snap.docs.filter(doc =>
      doc.data().consumerName?.toLowerCase() === name
    );

    list.innerHTML = "";
    if (matches.length === 0) {
      list.innerHTML = "<li>No claims found for this consumer.</li>";
      return;
    }

    matches.forEach(docSnap => {
      const d = docSnap.data();
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${d.foodDetails}</strong><br>
        📍 ${d.location}<br>
        Claimed: ${d.quantity}<br>
        🕒 ${new Date(d.claimTimestamp).toLocaleString()}`;
      list.appendChild(li);
    });
  });
};
// --- Show NGO Info Section ---
window.showNGOInfo = () => {
  hideAll();
  document.getElementById("ngoSection").classList.remove("hidden");
};
