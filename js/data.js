import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return;

  const data = snap.data();

  document.querySelectorAll("[data-user-name]").forEach(el => {
    el.textContent = data.fullName || "User";
  });

  document.querySelectorAll("[data-user-image]").forEach(el => {
    el.src = data.profileImage || "";
  });
});