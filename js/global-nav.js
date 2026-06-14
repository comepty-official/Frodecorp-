import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

(function () {
  const style = document.createElement("style");
  style.innerHTML = `
    body{padding-top:60px}

    .g-navbar{
      position:fixed;top:0;left:0;right:0;height:60px;
      background:#fff;border-bottom:1px solid #e8e8f2;
      display:flex;justify-content:space-between;align-items:center;
      padding:0 16px;z-index:999;
    }

    .g-brand{font-weight:800;color:#5b4cf5;}

    .g-hamburger{
      width:42px;height:42px;border:1px solid #e8e8f2;
      border-radius:10px;background:#fff;
      display:flex;flex-direction:column;justify-content:center;gap:4px;
      cursor:pointer;
    }

    .g-hamburger span{height:2px;width:18px;background:#0d0d0d;margin:0 auto;}

    .g-overlay{
      position:fixed;inset:0;background:rgba(0,0,0,.4);
      opacity:0;pointer-events:none;transition:.2s;z-index:900;
    }
    .g-overlay.active{opacity:1;pointer-events:all;}

    .g-drawer{
      position:fixed;top:0;left:-100%;width:80%;height:100%;
      background:#fff;transition:.25s;z-index:1000;padding:16px;
    }
    .g-drawer.active{left:0;}

    .g-user{
      display:flex;align-items:center;gap:12px;
      padding:12px;border-bottom:1px solid #e8e8f2;
    }

    .g-avatar{
      width:42px;height:42px;border-radius:50%;
      overflow:hidden;background:#5b4cf5;
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;
    }

    .g-avatar img{width:100%;height:100%;object-fit:cover;}

    .g-links{display:flex;flex-direction:column;gap:10px;margin-top:12px;}

    .g-link{
      padding:12px;border:1px solid #e8e8f2;
      border-radius:10px;text-decoration:none;color:#0d0d0d;
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement("div");

  root.innerHTML = `
    <div class="g-navbar">
      <div class="g-brand">Frodecorp</div>
      <button class="g-hamburger" id="gHamburger">
        <span></span><span></span><span></span>
      </button>
    </div>

    <div class="g-overlay" id="gOverlay"></div>

    <div class="g-drawer" id="gDrawer">
      <div class="g-user">
        <div class="g-avatar" id="gAvatar"></div>
        <div id="gName">User</div>
      </div>

      <div class="g-links">
        <a class="g-link" href="dashboard.html">Dashboard</a>
       
        <a class="g-link" href="#">Portfolio</a>
        
        
        <a class="g-link" href="editor.html">User Settings</a>
      </div>
    </div>
  `;

  document.body.prepend(root);

  const drawer = document.getElementById("gDrawer");
  const overlay = document.getElementById("gOverlay");
  const btn = document.getElementById("gHamburger");
  const gName = document.getElementById("gName");
  const gAvatar = document.getElementById("gAvatar");

  const open = () => {
    drawer.classList.add("active");
    overlay.classList.add("active");
  };

  const close = () => {
    drawer.classList.remove("active");
    overlay.classList.remove("active");
  };

  btn.addEventListener("click", () => {
    drawer.classList.contains("active") ? close() : open();
  });

  overlay.addEventListener("click", close);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  document.querySelectorAll(".g-link").forEach(l => l.addEventListener("click", close));

  /* LIVE FIREBASE USER */
  onAuthStateChanged(auth, (user) => {
    if (!user) return;

    const name = user.displayName || "User";
    const photo = user.photoURL || "";

    gName.textContent = name;

    if (photo) {
      gAvatar.innerHTML = `<img src="${photo}">`;
    } else {
      gAvatar.textContent = name[0].toUpperCase();
    }
  });
})();