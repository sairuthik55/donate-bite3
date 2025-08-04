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
 L.tileLayer(	"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  attribution: '&copy; OpenStreetMap, &copy; CartoDB',
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(consumerMap);
    }

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
  document.getElementById("donorHistorySection")?.remove();   
  document.getElementById("consumerHistorySection")?.remove(); 
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
         <h4>🍱 ${d.foodDetails} — ${d.quantity}</h4>
    <p>📍 ${d.location}</p>
    <p>👤 ${d.donorName || "N/A"}</p>
    <p>📞 ${d.donorPhone || "N/A"}</p>
${
  d.donorPhone
    ? `<a href="https://wa.me/${d.donorPhone.replace(/\D/g, '')}" target="_blank" class="whatsapp-chat-btn">💬 Chat with Donor</a>`
    : ""
}


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
  const container = document.querySelector(".container");
  container.innerHTML = ""; // 🧹 Clear all

  const sec = document.createElement("section");
  sec.id = "donorHistorySection";
  sec.className = "form-card";
  sec.innerHTML = `
    <h2 style="text-align:center;font-size:1.8em;margin-bottom:20px;">📜 Donor History</h2>
    <p style="text-align:center;color:#555;">Search all donations and claims made by a specific donor.</p>

    <div style="display:flex;gap:10px;justify-content:center;margin:20px 0;">
      <input type="text" id="donorHistoryName" placeholder="Enter Donor Name…" style="padding:10px;width:60%;border-radius:8px;border:1px solid #ccc;" />
      <button class="submit-btn" onclick="searchDonorHistory()">🔍 Search</button>
    </div>

    <ul id="donorHistoryList" style="list-style:none;padding:0;"></ul>

    <div style="text-align:center;margin-top:30px;">
      <button class="back-btn" onclick="window.location.reload()">⬅️ Back to Home</button>
    </div>
  `;
  container.appendChild(sec);
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
           📞 <strong>Phone:</strong> ${d.donorPhone ? `<a href="tel:${d.donorPhone}">${d.donorPhone}</a>` : "Not provided"}</p>
<span class="status-badge ${d.status}">${d.status.toUpperCase()}</span><br>
          Source: ${d.source} ${d.consumerName ? `→ Claimed by: ${d.consumerName}` : ""}`;
        list.appendChild(li);
      });
    });
  });
};

// --- Consumer History ---
window.openConsumerHistory = () => {
  const container = document.querySelector(".container");
  container.innerHTML = ""; // 🧹 Clear all

  const sec = document.createElement("section");
  sec.id = "consumerHistorySection";
  sec.className = "form-card";
  sec.innerHTML = `
    <h2 style="text-align:center;font-size:1.8em;margin-bottom:20px;">📜 Consumer History</h2>
    <p style="text-align:center;color:#555;">Search for food claims made by any consumer.</p>

    <div style="display:flex;gap:10px;justify-content:center;margin:20px 0;">
      <input type="text" id="consumerHistoryName" placeholder="Enter Consumer Name…" style="padding:10px;width:60%;border-radius:8px;border:1px solid #ccc;" />
      <button class="submit-btn" onclick="searchConsumerHistory()">🔍 Search</button>
    </div>

    <ul id="consumerHistoryList" style="list-style:none;padding:0;"></ul>

    <div style="text-align:center;margin-top:30px;">
      <button class="back-btn" onclick="window.location.reload()">⬅️ Back to Home</button>
    </div>
  `;
  container.appendChild(sec);
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
         📞 <strong>Phone:</strong> ${d.donorPhone ? `<a href="tel:${d.donorPhone}">${d.donorPhone}</a>` : "Not provided"}</p>
<span class="status-badge ${d.status}">${d.status.toUpperCase()}</span><br>
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

<div class="ngo-actions-bar">
  <a href="https://wa.me/9346942849" target="_blank" class="circle-btn" title="WhatsApp Admin">
    <img src="https://i.postimg.cc/VN2Jd0Kd/whatsapp.png" alt="WhatsApp" />
  </a>
  <button onclick="toggleClaimed()" class="circle-btn" title="Claimed Donations">
    <img src="https://cdn-icons-png.flaticon.com/512/3595/3595455.png" alt="History" />
  </button>
  <button onclick="logoutNGO()" class="circle-btn" title="Logout">
    <img src="https://cdn-icons-png.flaticon.com/512/1828/1828490.png" alt="Logout" />
  </button>
</div>

`;

  document.querySelector(".container").appendChild(sec);
window.toggleClaimed = () => {
  const section = document.getElementById("claimedSection");
  const button = event.target;
  if (section.classList.contains("hidden")) {
    section.classList.remove("hidden");
    button.textContent = "⬅️ Hide Claimed Donations";
  } else {
    section.classList.add("hidden");
    button.textContent = "📜 View Claimed Donations";
  }
};

  // 🟢 Load available donations
  onSnapshot(query(donationsRef, where("status", "==", "approved")), snap => {
    const list = document.getElementById("ngoAvailableList");
    list.innerHTML = "";
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const li = document.createElement("li");

     li.innerHTML = `
  <div style="background:#f8f9fa;padding:15px;margin-bottom:15px;border-radius:10px;">
    <h4>🍱 ${d.foodDetails} — ${d.quantity}</h4>
    <p>📍 ${d.location}</p>
    <p>👤 ${d.donorName || "N/A"}</p>
    <p>📞 ${d.donorPhone || "N/A"}</p>
${
  d.donorPhone
    ? `<a href="https://wa.me/${d.donorPhone.replace(/\D/g, '')}" target="_blank" class="whatsapp-chat-btn">💬 Chat with Donor</a>`
    : ""
}

    <p>⏰ ${new Date(d.claimTimestamp).toLocaleString()}</p>
    <p><strong>Status:</strong> <span class="status-badge ${d.status === "Pending Approval" ? "pending" : "approved"}">${d.status}</span></p>
    ${d.photo ? `<img src="${d.photo}" class="clickable-img" onclick="openFullImage('${d.photo}')">` : ""}
  </div>
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

   let claims = [];
snap.forEach(docSnap => claims.push(docSnap.data()));

// Sort newest first
claims.sort((a, b) => b.claimTimestamp - a.claimTimestamp);

const list = document.getElementById("ngoClaimList");
list.innerHTML = "";

claims.forEach(d => {
  const li = document.createElement("li");
  li.innerHTML = `
    <div style="background:#f8f9fa;padding:15px;margin-bottom:15px;border-radius:10px;">
      <h4>🍱 ${d.foodDetails} — ${d.quantity}</h4>
      <p>📍 ${d.location}</p>
      <p>👤 Donor: ${d.donorName || "N/A"}</p>
      <p>📞 ${d.donorPhone || "N/A"}</p>
${
  d.donorPhone
    ? `<a href="https://wa.me/${d.donorPhone.replace(/\D/g, '')}" target="_blank" class="whatsapp-chat-btn">💬 Chat with Donor</a>`
    : ""
}

      <p>🕒 ${new Date(d.claimTimestamp).toLocaleString()}</p>
    </div>`;
  list.appendChild(li);
});
// 🔍 Fullscreen image viewer for NGO section
window.openFullImage = (url) => {
  document.getElementById("modalImage").src = url;
  document.getElementById("imageModal").classList.remove("hidden");
};

window.closeFullImage = () => {
  document.getElementById("imageModal").classList.add("hidden");
};

// 🟢 Update Impact Summary
const impactEl = document.getElementById("impactStats");
impactEl.innerHTML = `
  🍱 Total Claims: ${claims.length}<br>
  👥 Estimated People Served: ${claims.length * 5}<br>
  📅 Member Since: Jan 2024
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
window.claimByNGO = (id, ngoId, food, quantity, donor, location, phone, imageURL) => {
  const container = document.querySelector(".container");

  container.innerHTML = `
    <section class="form-card" style="max-width:500px;margin:auto;">
      <h2>📦 Confirm Your Claim</h2>
      <p><strong>Food:</strong> ${food}</p>
      <p><strong>Quantity:</strong> ${quantity}</p>
      <p><strong>Location:</strong> ${location}</p>
      ${imageURL ? `<img src="${imageURL}" style="max-width:100%;border-radius:10px;margin-top:10px;">` : ""}
      
      <label>Authorized Person Name</label>
      <input id="authPerson" placeholder="Enter name" required />
      
      <label>Contact Number</label>
      <input id="authContact" placeholder="Enter phone number" required />
      
      <label>Pickup Time</label>
      <input id="pickupTime" type="time" required />
      
      <label>Reason for Claim</label>
      <textarea id="claimReason" placeholder="Why do you need this food?" required></textarea>
      
      <button style="margin-top:15px;background:#00b894;color:white;padding:10px;border:none;border-radius:8px;font-size:1rem;cursor:pointer;"
        onclick="submitNGOClaim('${id}','${ngoId}','${food}','${quantity}','${donor}','${location}','${phone}','${imageURL}')">
        ✅ Confirm Claim
      </button>
      
      <button class="back-btn" onclick="window.location.reload()">⬅️ Back</button>
    </section>
  `;
};

window.claimByNGO = (id, ngoId, food, quantity, donor, location, phone, imageURL) => {
  const container = document.querySelector(".container");

  container.innerHTML = `
    <section class="form-card claim-confirm-card">
      <h2>📦 Confirm Your Claim</h2>
      
      <div class="claim-summary">
        <p><strong>Food:</strong> ${food}</p>
        <p><strong>Quantity:</strong> ${quantity}</p>
        <p><strong>Location:</strong> ${location}</p>
        ${imageURL ? `<img src="${imageURL}" class="claim-img">` : ""}
      </div>
      
      <div class="claim-inputs">
        <label>Authorized Person Name</label>
        <input id="authPerson" placeholder="Enter name" required />
        
        <label>Contact Number</label>
        <input id="authContact" placeholder="Enter phone number" required />
        
        <label>Pickup Time</label>
        <input id="pickupTime" type="time" required />
        
        <label>Reason for Claim</label>
        <textarea id="claimReason" placeholder="Why do you need this food?" required></textarea>
      </div>
      
      <div class="claim-actions">
        <button class="submit-btn" onclick="submitNGOClaim('${id}','${ngoId}','${food}','${quantity}','${donor}','${location}','${phone}','${imageURL}')">
          ✅ Confirm Claim
        </button>
        <button class="back-btn" onclick="window.location.reload()">⬅️ Back</button>
      </div>
    </section>
  `;
};

// ✅ Step 1: Show confirmation form when NGO clicks "Claim"
window.claimByNGO = (id, ngoId, food, quantity, donor, location, phone, imageURL) => {
  const container = document.querySelector(".container");

  container.innerHTML = `
    <section class="form-card claim-confirm-card">
      <h2>📦 Confirm Your Claim</h2>
      
      <div class="claim-summary">
        <p><strong>Food:</strong> ${food}</p>
        <p><strong>Quantity:</strong> ${quantity}</p>
        <p><strong>Location:</strong> ${location}</p>
        ${imageURL ? `<img src="${imageURL}" class="claim-img">` : ""}
      </div>
      
      <div class="claim-inputs">
        <label>Authorized Person Name</label>
        <input id="authPerson" placeholder="Enter name" required />
        
        <label>Contact Number</label>
        <input id="authContact" placeholder="Enter phone number" required />
        
        <label>Pickup Time</label>
        <input id="pickupTime" type="time" required />
        
        <label>Reason for Claim</label>
        <textarea id="claimReason" placeholder="Why do you need this food?" required></textarea>
      </div>
      
      <div class="claim-actions">
        <button class="submit-btn" onclick="submitNGOClaim('${id}','${ngoId}','${food}','${quantity}','${donor}','${location}','${phone}','${imageURL}')">
          ✅ Confirm Claim
        </button>
        <button class="back-btn" onclick="window.location.reload()">⬅️ Back</button>
      </div>
    </section>
  `;
};

// ✅ Step 2: Save claim to Firestore when confirmed
window.submitNGOClaim = async (id, ngoId, food, quantity, donor, location, phone, imageURL) => {
  const authPerson = document.getElementById("authPerson").value.trim();
  const authContact = document.getElementById("authContact").value.trim();
  const pickupTime = document.getElementById("pickupTime").value;
  const claimReason = document.getElementById("claimReason").value.trim();

  if (!authPerson || !authContact || !pickupTime || !claimReason) {
    return alert("❌ Please fill in all fields.");
  }

  try {
    await addDoc(claimsRef, {
      foodDetails: food,
      quantity,
      donorName: donor,
      location,
      donorPhone: phone,
      ngoId,
      authPerson,
      authContact,
      pickupTime,
      claimReason,
      imageURL,
      status: "Claimed",
      claimTimestamp: Date.now()
    });

    // ✅ Remove donation from available list
    await deleteDoc(doc(donationsRef, id));

    alert("✅ Claim submitted successfully!");
    window.location.reload();
  } catch (err) {
    console.error("❌ Error saving claim:", err);
    alert("Failed to claim. Check console for details.");
  }
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
// ✅ Hide splash screen after a delay

window.addEventListener("load", () => {
  setTimeout(() => {
    const splash = document.getElementById("splashLoader");
    if (splash) splash.style.display = "none";
  }, 4000); // ⏱ show for 4 seconds
});
// Animated taglines
const taglines = [
  "Feeding hope, one bite at a time…",
  "Connecting donors with those in need…",
  "Join the fight against food waste…",
  "Your kindness makes a difference!"
];
let taglineIndex = 0;
setInterval(() => {
  const taglineEl = document.getElementById("splashTagline");
  if (taglineEl) {
    taglineIndex = (taglineIndex + 1) % taglines.length;
    taglineEl.textContent = taglines[taglineIndex];
  }
}, 2500);

// Hide splash with fade-out
const splash = document.getElementById("splashLoader");
function hideSplash() {
  splash.classList.add("fade-out");
  setTimeout(() => splash.style.display = "none", 800);
}

// Skip button
document.getElementById("skipBtn").addEventListener("click", hideSplash);

// Auto hide after 4 seconds
window.addEventListener("load", () => {
  setTimeout(hideSplash, 4000);
});



