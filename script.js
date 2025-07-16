// --- Firebase Setup ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js";
import {
  getFirestore, collection, addDoc, doc, deleteDoc, updateDoc, getDocs,
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
   document.getElementById("ngoLoginSection")?.remove();
  document.getElementById("ngoRegisterSection")?.remove();
  document.getElementById("ngoDashboard")?.remove();
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
  roleSelect.style.display = "none";
  setTimeout(() => {
    showAvailableFood();
    initConsumerMap(); // ✅ Delay this
  }, 300); // Give DOM time to layout the visible section
} else if (role === "admin") showAdminLogin();
  else if (role === "ngo") document.getElementById("ngoSection").classList.remove("hidden");
}
window.selectRole = selectRole;
window.goBack = goBack;

// --- Donor Submission ---
donorForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
const donorName = document.getElementById("donorName").value.trim();
const donorPhone = document.getElementById("donorContact").value.trim(); // ✅ renamed
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
    donorName,
    donorPhone, // ✅ fixed field
    foodDetails,
    location,
    dateCooked,
    expiryDate,
    quantity: `${qty} ${unit}`,
    status: "pending",
    timestamp: Date.now(),
    photo,
    verified: false
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
         Donor: ${d.donorName} ${d.verified ? '✅' : ''}<br>
        📍 ${d.location}<br>
        🍳 ${d.dateCooked} • ⏳ ${d.expiryDate} ${expireSoon ? '<span style="color:red">⚠</span>' : ''}<br>
        ⚖ ${d.quantity}<br>
        📞 <strong>Phone:</strong> ${d.donorPhone ? `<a href="tel:${d.donorPhone}">${d.donorPhone}</a>` : "Not provided"}</p>
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
  // Wait a bit to ensure map container is visible
  setTimeout(() => {
    const mapContainer = document.getElementById("consumerMap");

    if (!consumerMap) {
      consumerMap = L.map(mapContainer).setView([20.5937, 78.9629], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(consumerMap);
    }

    // Clear existing markers except user location
    consumerMap.eachLayer(layer => {
      if (layer instanceof L.Marker && !layer.getPopup()?.getContent()?.includes("You are here")) {
        consumerMap.removeLayer(layer);
      }
    });

    // Add donation markers
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

    // Add user location marker
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
       L.marker([latitude, longitude], {
  icon: L.divIcon({
    className: "pulse-marker",
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  })
})
.addTo(consumerMap)
.bindPopup("📍 You are here")
.openPopup();

consumerMap.setView([latitude, longitude], 13);
      }, () => {
        console.warn("Geolocation permission denied.");
      });
    }
  }, 400); // slight delay ensures container is rendered
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
function goBack() {
  hideAll();
  document.getElementById("donorHistorySection")?.classList.add("hidden");
  document.getElementById("consumerHistorySection")?.classList.add("hidden");
  document.getElementById("ngoLoginSection")?.remove();
  document.getElementById("ngoDashboard")?.remove();
  document.getElementById("adminLoginSection")?.remove();
  document.getElementById("adminSection")?.remove();
  roleSelect.style.display = "flex";
}
window.goBack = goBack;
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
    window.copyToClipboard = (text) => {
  navigator.clipboard.writeText(text).then(() => {
    alert("📍 Location link copied to clipboard!");
  });
};
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
  if (id === "ruthik" && pwd === "nikki123") {
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
  <div class="admin-card">
    <div class="admin-card-header">
      <strong>${d.foodDetails}</strong>
      <span class="status-badge ${d.status}">${d.status.toUpperCase()}</span>
    </div>
    <div class="admin-card-body">
      <p>📍 <strong>Location:</strong> ${d.location}</p>
      <p>👤 <strong>Donor:</strong> ${d.donorName} ${d.verified ? "✅" : ""} (${d.donorContact})</p>
      <p>🍳 <strong>Date Cooked:</strong> ${d.dateCooked} &nbsp; ⏳ <strong>Expiry:</strong> ${d.expiryDate}</p>
      <p>⚖ <strong>Quantity:</strong> ${d.quantity}</p>
      ${d.photo ? `<img src="${d.photo}" alt="food" class="admin-img">` : ""}
    </div>
    <div class="admin-card-actions">
      ${d.status === "pending"
        ? `<button onclick="approveDonation('${docSnap.id}')">Approve</button>
           <button onclick="rejectDonation('${docSnap.id}')">Reject</button>`
        : `<button onclick="removeDonation('${docSnap.id}')">🗑 Remove</button>`}
      ${d.verified
        ? '<span class="status-badge approved">✅ Verified</span>'
        : `<button onclick="verifyDonor('${d.donorContact}')">✅ Verify Donor</button>`}
    </div>
  </div>
`;
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
// --- Show NGO Login ---
function showNGOLogin() {
  hideAll();
  roleSelect.style.display = "none";

  const sec = document.createElement("section");
  sec.id = "ngoLoginSection";
  sec.className = "form-card";
  sec.style.maxWidth = "500px";
  sec.style.margin = "40px auto";

  sec.innerHTML = `
    <h2 style="text-align:center;font-size:1.8em;margin-bottom:20px;">🏥 NGO Secure Login</h2>
    <div style="display:flex;flex-direction:column;gap:12px;">
      <input id="ngoId" placeholder="Enter your NGO ID" style="padding:10px;font-size:1em;border:1px solid #ccc;border-radius:6px;" />
      <input type="password" id="ngoPwd" placeholder="Enter Password" style="padding:10px;font-size:1em;border:1px solid #ccc;border-radius:6px;" />
      <button onclick="verifyNGO()" style="padding:10px;background:#007bff;color:white;border:none;border-radius:6px;font-size:1em;cursor:pointer;">🔐 Login</button>
      <button onclick="goBack()" style="padding:10px;background:#ccc;color:#333;border:none;border-radius:6px;font-size:1em;cursor:pointer;">⬅️ Back</button>
      <div id="ngoLoginMsg" style="color:red;margin-top:10px;text-align:center;"></div>
    </div>
  `;

  document.querySelector(".container").appendChild(sec);
}

window.showNGOLogin = showNGOLogin;

window.verifyNGO = () => {
  const id = document.getElementById("ngoId").value.trim().toLowerCase();
  const pwd = document.getElementById("ngoPwd").value.trim();

  const validNGOs = {
    "smile": "ngo123",
    "hope": "ngo456",
    "youngisthan foundation": "arun"
  };

  if (validNGOs[id] === pwd) {
    localStorage.setItem("loggedNGO", id);
    document.getElementById("ngoLoginSection")?.remove();
    const ngo = { name: id, verified: true };
    showNGODashboardAuth(ngo);
  } else {
    document.getElementById("ngoLoginMsg").textContent = "❌ Invalid NGO credentials.";
  }
};

function showNGODashboardAuth(ngo) {
  hideAll();
  document.getElementById("ngoDashboard")?.remove();

  const sec = document.createElement("section");
  sec.id = "ngoDashboard";
  sec.className = "form-card";
  sec.style.padding = "20px";

  sec.innerHTML = `
    <div style="text-align:center; margin-bottom:20px;">
      <h2 style="font-size:1.8em;">🏥 ${ngo.name} ${ngo.verified ? "✅" : ""}</h2>
      <p style="color:#555;">📧 ${ngo.email || "Email not set"}</p>
    </div>

    <div style="background:#e9f7ef;padding:15px;border-radius:10px;margin-bottom:20px;">
      <h3 style="color:#28a745;">🌟 Impact Summary</h3>
      <p id="impactStats">Loading impact data...</p>
    </div>

    <div style="margin-bottom:20px;">
      <h3 style="color:#007bff;">📦 Available Donations</h3>
      <ul id="ngoAvailableList" style="list-style:none;padding-left:0;"></ul>
    </div>

    <div style="margin-bottom:20px;">
      <h3 style="color:#6f42c1;">✅ Your Claimed Donations</h3>
      <ul id="ngoClaimList" style="list-style:none;padding-left:0;"></ul>
    </div>

    <div style="margin-bottom:20px;text-align:center;">
      <a href="https://wa.me/9346942849" target="_blank" style="padding:10px 15px;background:#25d366;color:white;border-radius:6px;text-decoration:none;">💬 Chat with Admin</a>
    </div>

    <div style="text-align:center;">
      <button onclick="logoutNGO()" style="padding:10px 20px;background:#dc3545;color:white;border:none;border-radius:6px;font-size:1em;cursor:pointer;">🚪 Logout</button>
    </div>
  `;

  document.querySelector(".container").appendChild(sec);

  // 🟢 Load available donations
  onSnapshot(query(donationsRef, where("status", "==", "approved")), snap => {
    const list = document.getElementById("ngoAvailableList");
    list.innerHTML = "";
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const li = document.createElement("li");

      li.innerHTML = `
        <div style="background:#fff;padding:15px;margin-bottom:15px;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,0.1);">
          <h4>🍱 ${d.foodDetails} — ${d.quantity}</h4>
          <p>📍 ${d.location}</p>
          <p>👤 ${d.donorName || "N/A"}</p>
          <p>📞 ${d.donorPhone ? `<a href="tel:${d.donorPhone}">${d.donorPhone}</a>` : "Not provided"}</p>
          ${d.donorPhone ? `<p>💬 <a href="https://wa.me/${d.donorPhone.replace(/\D/g, '')}" target="_blank" style="color:#25d366;">Chat with Donor</a></p>` : ""}
          ${d.imageURL ? `<img src="${d.imageURL}" style="max-height:150px;border-radius:6px;margin-top:10px;">` : ""}
          <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
            <button onclick="claimByNGO('${docSnap.id}', '${ngo.name}', '${d.foodDetails}', '${d.quantity}', '${d.donorName}', '${d.location}', '${d.donorPhone || ""}', '${d.imageURL || ""}')"
              style="padding:8px 12px;background:#007bff;color:white;border:none;border-radius:5px;">Claim</button>
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.location)}" target="_blank"
              style="padding:8px 12px;background:#17a2b8;color:white;border-radius:5px;text-decoration:none;">📍 Directions</a>
            <button onclick="copyToClipboard('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.location)}')"
              style="padding:8px 12px;background:#ffc107;color:black;border:none;border-radius:5px;">🔗 Copy Link</button>
          </div>
        </div>
      `;
      list.appendChild(li);
    });
  });

  // 🟢 Load claimed donations
  let totalClaims = 0;
  onSnapshot(query(claimsRef, where("consumerName", "==", ngo.name)), snap => {
    const list = document.getElementById("ngoClaimList");
    list.innerHTML = "";
    totalClaims = snap.size;

    snap.forEach(docSnap => {
      const d = docSnap.data();
      const li = document.createElement("li");

      li.innerHTML = `
        <div style="background:#f8f9fa;padding:15px;margin-bottom:15px;border-radius:10px;">
          <h4>🍱 ${d.foodDetails} — ${d.quantity}</h4>
          <p>📍 ${d.location}</p>
          <p>👤 ${d.donorName || "N/A"}</p>
          <p>📞 ${d.donorPhone || "N/A"}</p>
          <p>⏰ ${new Date(d.claimTimestamp).toLocaleString()}</p>
          ${d.imageURL ? `<img src="${d.imageURL}" style="max-height:150px;border-radius:6px;margin-top:10px;">` : ""}
        </div>
      `;
      list.appendChild(li);
    });

    // Set impact stats
    const impactEl = document.getElementById("impactStats");
    impactEl.innerHTML = `
      🍱 Total Claims: ${totalClaims}<br>
      👥 Estimated People Served: ${totalClaims * 5}<br>
      📅 Member Since: Jan 2024
    `;
  });
}

window.claimByNGO = async (id, ngoId, food, quantity, donor, location, phone, imageURL) => {
  await addDoc(claimsRef, {
    foodDetails: food,
    quantity,
    donorName: donor,
    donorPhone: phone,
    location,
    imageURL,
    consumerName: ngoId,
    claimTimestamp: Date.now()
  });
  await deleteDoc(doc(donationsRef, id));
  alert("✅ Claimed successfully!");
};

window.logoutNGO = () => {
  localStorage.removeItem("loggedNGO");
  document.getElementById("ngoDashboard")?.remove();
  roleSelect.style.display = "flex";
};

const savedNGO = localStorage.getItem("loggedNGO");
if (savedNGO) {
  const ngo = { name: savedNGO, verified: true };
  showNGODashboardAuth(ngo);
}

window.logoutNGO = () => {
  localStorage.removeItem("loggedNGO");
  document.getElementById("ngoDashboard")?.remove(); // manually remove it
  roleSelect.style.display = "flex";
};

