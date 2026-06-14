// =========================================================
// edit.js — Frodecorp Builder
// =========================================================

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// =========================================================
// AUTH GUARD
// =========================================================
let currentUser = null;
onAuthStateChanged(auth, (user) => {
  if (!user) { location.href = "login.html"; return; }
  currentUser = user;
  const nameEl = document.getElementById("userName");
  if (nameEl) nameEl.textContent = user.displayName || user.email || "User";
  loadFromFirebase();
});

// =========================================================
// STATE
// =========================================================
let elements    = [];
let selectedId  = null;
let history     = [];
let histIdx     = -1;
let zCounter    = 100;
let dragInfo    = null;
let resizeInfo  = null;
let snapEnabled = true;
let gridVisible = false;
let ctxTargetId = null;
let activeCodeTab = "html";
let zoom = 1;

const STORAGE_KEY    = "frodecorp_v3";
const SNAP_GRID      = 10;
const MIN_ZOOM       = 0.3;
const MAX_ZOOM       = 2.5;

let canvas, canvasArea, canvasWrap;

// =========================================================
// ELEMENT DEFINITIONS
// =========================================================
const ELEMENT_DEFS = {
  text:        { icon:"bi-fonts",                label:"Text",        cat:"Basic",      w:220, h:50  },
  heading:     { icon:"bi-type-h1",              label:"Heading",     cat:"Basic",      w:300, h:60  },
  button:      { icon:"bi-square",               label:"Button",      cat:"Basic",      w:140, h:44  },
  link:        { icon:"bi-link-45deg",           label:"Link",        cat:"Basic",      w:120, h:36  },
  divider:     { icon:"bi-dash-lg",              label:"Divider",     cat:"Basic",      w:400, h:4   },
  spacer:      { icon:"bi-distribute-vertical",  label:"Spacer",      cat:"Basic",      w:400, h:40  },
  icon:        { icon:"bi-star",                 label:"Icon",        cat:"Basic",      w:60,  h:60  },
  image:       { icon:"bi-image",                label:"Image",       cat:"Media",      w:300, h:200 },
  video:       { icon:"bi-camera-video",         label:"Video",       cat:"Media",      w:400, h:250 },
  gallery:     { icon:"bi-images",               label:"Gallery",     cat:"Media",      w:500, h:300 },
  header:      { icon:"bi-border-top",           label:"Header",      cat:"Layout",     w:800, h:70  },
  navbar:      { icon:"bi-menu-button-wide",     label:"Navbar",      cat:"Layout",     w:800, h:56  },
  footer:      { icon:"bi-border-bottom",        label:"Footer",      cat:"Layout",     w:800, h:90  },
  hero:        { icon:"bi-stars",                label:"Hero",        cat:"Layout",     w:800, h:400 },
  section:     { icon:"bi-square-half",          label:"Section",     cat:"Layout",     w:800, h:300 },
  container:   { icon:"bi-layout-three-columns", label:"Container",   cat:"Layout",     w:400, h:200 },
  row:         { icon:"bi-layout-split",         label:"Row",         cat:"Layout",     w:600, h:100 },
  column:      { icon:"bi-layout-wtf",           label:"Column",      cat:"Layout",     w:200, h:200 },
  card:        { icon:"bi-card-text",            label:"Card",        cat:"Components", w:280, h:220 },
  testimonial: { icon:"bi-chat-quote",           label:"Testimonial", cat:"Components", w:350, h:180 },
  form:        { icon:"bi-ui-checks",            label:"Form",        cat:"Components", w:400, h:320 },
  contact:     { icon:"bi-envelope",             label:"Contact",     cat:"Components", w:500, h:350 },
  faq:         { icon:"bi-question-circle",      label:"FAQ",         cat:"Components", w:600, h:280 },
  pricing:     { icon:"bi-tag",                  label:"Pricing",     cat:"Components", w:300, h:380 },
  animation:   { icon:"bi-lightning",            label:"Animation",   cat:"Advanced",   w:200, h:120 },
};
const CATEGORIES = ["Basic","Media","Layout","Components","Advanced"];

const TEMPLATES = [
  { name:"Landing Page", icon:"bi-house",     fn: applyLandingTemplate },
  { name:"Portfolio",    icon:"bi-person",    fn: applyPortfolioTemplate },
  { name:"Blog Post",    icon:"bi-newspaper", fn: applyBlogTemplate },
  { name:"Product",      icon:"bi-bag",       fn: applyProductTemplate },
];

// =========================================================
// INIT
// =========================================================
window.addEventListener("DOMContentLoaded", () => {
  canvas     = document.getElementById("canvas");
  canvasArea = document.getElementById("canvasArea");
  canvasWrap = document.getElementById("canvasWrap");

  buildToolbox();
  buildTemplates();
  setupCanvasDrop();
  setupContextMenu();
  setupButtons();
  setupKeyboard();
  setupProperties();
  setCanvasWidth("desktop");
  updateEmptyHint();
  setupZoom();
  setupBottomBar();

  // OVERLAY — only for dimming, never blocks panels themselves
  let ov = document.getElementById("panelOverlay");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "panelOverlay";
    document.body.appendChild(ov);
  }
  // Clicking overlay closes panels
  ov.addEventListener("click", closeAllPanels);
  ov.addEventListener("touchend", closeAllPanels);
});

// =========================================================
// PANEL OPEN / CLOSE
// — On mobile: panels slide in, overlay dims the canvas.
// — Overlay pointer-events are NONE by default so it never
//   blocks anything unless a panel is open.
// =========================================================
function openPanel(side) {
  const panel   = document.getElementById(side === "left" ? "leftPanel" : "rightPanel");
  const other   = document.getElementById(side === "left" ? "rightPanel" : "leftPanel");
  const overlay = document.getElementById("panelOverlay");

  // On desktop (≥768px) panels are always visible — do nothing
  if (window.innerWidth >= 768) return;

  // Close the other panel first
  other?.classList.remove("open");

  panel?.classList.add("open");

  // Show overlay — but ONLY behind the panels (z-index is set in CSS)
  if (overlay) {
    overlay.style.display        = "block";
    overlay.style.pointerEvents  = "auto"; // allow tap-to-close
  }
}

function closeAllPanels() {
  const overlay = document.getElementById("panelOverlay");
  document.getElementById("leftPanel")?.classList.remove("open");
  document.getElementById("rightPanel")?.classList.remove("open");
  if (overlay) {
    overlay.style.display       = "none";
    overlay.style.pointerEvents = "none"; // ← KEY: stops it blocking anything
  }
}

function togglePanel(side) {
  if (window.innerWidth >= 768) return; // desktop: always visible
  const panel = document.getElementById(side === "left" ? "leftPanel" : "rightPanel");
  if (panel?.classList.contains("open")) {
    closeAllPanels();
  } else {
    openPanel(side);
  }
}

// =========================================================
// BOTTOM BAR (mobile only)
// =========================================================
function setupBottomBar() {
  if (document.getElementById("bottomBar")) return;
  const bar = document.createElement("div");
  bar.id = "bottomBar";
  bar.innerHTML = `
    <button class="tb-btn" id="bbElements"><i class="bi bi-grid-3x3"></i><span>Elements</span></button>
    <button class="tb-btn" id="bbUndo"><i class="bi bi-arrow-counterclockwise"></i><span>Undo</span></button>
    <button class="tb-btn accent" id="bbPublish"><i class="bi bi-cloud-upload"></i><span>Publish</span></button>
    <button class="tb-btn" id="bbPreview"><i class="bi bi-eye"></i><span>Preview</span></button>
    <button class="tb-btn" id="bbProps"><i class="bi bi-sliders"></i><span>Props</span></button>
  `;
  document.body.appendChild(bar);

  document.getElementById("bbElements").addEventListener("click", () => togglePanel("left"));
  document.getElementById("bbUndo").addEventListener("click", undo);
  document.getElementById("bbPublish").addEventListener("click", publishProject);
  document.getElementById("bbPreview").addEventListener("click", openPreview);
  document.getElementById("bbProps").addEventListener("click", () => togglePanel("right"));
}

// =========================================================
// ZOOM (pinch + ctrl+wheel)
// =========================================================
function setupZoom() {
  if (!canvasArea) return;
  canvasArea.addEventListener("wheel", (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + (e.deltaY < 0 ? 0.1 : -0.1)));
    applyZoom();
  }, { passive: false });

  let initDist = null;
  canvasArea.addEventListener("touchmove", (e) => {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (initDist !== null) {
      zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + (dist - initDist) * 0.005));
      applyZoom();
    }
    initDist = dist;
  }, { passive: false });
  canvasArea.addEventListener("touchend", () => { initDist = null; });
}

function applyZoom() {
  if (!canvasWrap) return;
  canvasWrap.style.transform       = `scale(${zoom})`;
  canvasWrap.style.transformOrigin = "top center";
}

// =========================================================
// TOOLBOX
// =========================================================
function buildToolbox() {
  const list = document.getElementById("elemList");
  if (!list) return;
  list.innerHTML = "";
  CATEGORIES.forEach(cat => {
    const items = Object.entries(ELEMENT_DEFS).filter(([,d]) => d.cat === cat);
    const label = document.createElement("div");
    label.className = "elem-group-label";
    label.textContent = cat;
    list.appendChild(label);
    const grid = document.createElement("div");
    grid.className = "elem-grid";
    items.forEach(([type, def]) => {
      const el = document.createElement("div");
      el.className   = "tool-item";
      el.draggable   = true;
      el.dataset.type = type;
      el.innerHTML   = `<i class="bi ${def.icon}"></i>${def.label}`;
      el.addEventListener("dragstart", e => {
        e.dataTransfer.setData("element-type", type);
        e.dataTransfer.effectAllowed = "copy";
      });
      el.addEventListener("touchstart", handleToolTouchStart, { passive: false });
      el.addEventListener("touchmove",  handleToolTouchMove,  { passive: false });
      el.addEventListener("touchend",   handleToolTouchEnd);
      grid.appendChild(el);
    });
    list.appendChild(grid);
  });

  document.getElementById("searchBox")?.addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll(".tool-item").forEach(el => {
      el.style.display = (el.dataset.type.includes(q) || el.textContent.toLowerCase().includes(q)) ? "" : "none";
    });
    document.querySelectorAll(".elem-group-label").forEach(lbl => {
      const g = lbl.nextElementSibling;
      lbl.style.display = (g && [...g.children].some(c => c.style.display !== "none")) ? "" : "none";
    });
  });
}

// =========================================================
// TEMPLATES
// =========================================================
function buildTemplates() {
  const grid = document.getElementById("templateGrid");
  if (!grid) return;
  TEMPLATES.forEach(t => {
    const card = document.createElement("div");
    card.className = "tmpl-card";
    card.innerHTML = `<i class="bi ${t.icon}"></i><span>${t.name}</span>`;
    card.onclick = () => {
      if (confirm("Clear canvas and load template?")) { clearCanvas(); t.fn(); }
    };
    grid.appendChild(card);
  });
}

function applyLandingTemplate() {
  addEl("navbar",  50,  20, { text:"MyBrand · Home · About · Contact" });
  addEl("hero",    50,  96, { text:"Build Amazing Websites", bgColor:"#1a1a2e", color:"#ffffff" });
  addEl("text",    80, 520, { text:"Welcome — simple, powerful, fast." });
  addEl("button", 220, 580, { text:"Get Started" });
  addEl("footer",  50, 660, { text:"© 2026 MyBrand. All rights reserved." });
  pushHistory();
}
function applyPortfolioTemplate() {
  addEl("header",  50,  10, { text:"My Portfolio" });
  addEl("hero",    50,  90, { text:"Creative Designer & Developer", bgColor:"#0f0f13", color:"#6c63ff" });
  addEl("card",    50, 510, { text:"Project One" });
  addEl("card",   350, 510, { text:"Project Two" });
  addEl("footer",  50, 760, { text:"Contact: hello@portfolio.com" });
  pushHistory();
}
function applyBlogTemplate() {
  addEl("heading",  80,  30, { text:"My Blog", fontSize:36 });
  addEl("text",     80, 110, { text:"Published June 2026 · 5 min read" });
  addEl("image",    80, 160, { w:600, h:300 });
  addEl("text",     80, 480, { text:"Lorem ipsum dolor sit amet..." });
  addEl("divider",  80, 560);
  addEl("footer",   50, 600, { text:"© 2026 Blog" });
  pushHistory();
}
function applyProductTemplate() {
  addEl("navbar",   40,  10, { text:"ShopBrand" });
  addEl("image",    40,  76, { w:400, h:300 });
  addEl("heading", 480,  76, { text:"Premium Product", fontSize:28 });
  addEl("text",    480, 150, { text:"$99.00", fontSize:24, color:"#6c63ff" });
  addEl("text",    480, 200, { text:"High quality product." });
  addEl("button",  480, 280, { text:"Add to Cart", bgColor:"#6c63ff", color:"#fff" });
  addEl("footer",   40, 420, { text:"© 2026 ShopBrand" });
  pushHistory();
}

// =========================================================
// ADD ELEMENT
// =========================================================
function addEl(type, x, y, opts = {}) {
  const def  = ELEMENT_DEFS[type];
  const id   = genId();
  const data = {
    id, type,
    x: opts.x ?? x,
    y: opts.y ?? y,
    w: opts.w ?? def.w,
    h: opts.h ?? def.h,
    z: ++zCounter,
    locked: false, hidden: false,
    name: opts.name || (def.label + " " + (elements.length + 1)),
    props: {
      text:       opts.text       ?? getDefaultText(type),
      link:       opts.link       || "",
      src:        opts.src        || "",
      fontSize:   opts.fontSize   || 16,
      fontFamily: opts.fontFamily || "Inter",
      fontWeight: opts.fontWeight || "400",
      color:      opts.color      || getDefaultColor(type),
      bgColor:    opts.bgColor    || getDefaultBg(type),
      bgImg:      opts.bgImg      || "",
      borderW:    opts.borderW    || 0,
      borderR:    opts.borderR    || getDefaultBorderR(type),
      borderC:    opts.borderC    || "#000000",
      shadow:     opts.shadow     || "",
      padding:    opts.padding    || getDefaultPad(type),
      margin:     opts.margin     || 0,
      align:      opts.align      || "left",
      anim:       opts.anim       || "",
      animDur:    opts.animDur    || 1000,
      animDel:    opts.animDel    || 0,
      animIter:   opts.animIter   || "1",
    }
  };
  elements.push(data);
  renderOne(data);
  updateLayersPanel();
  updateEmptyHint();
  return data;
}

function getDefaultText(t) {
  const m = {
    text:"Double-click to edit", heading:"Your Heading", button:"Click Me", link:"Click here",
    header:"Website Header", navbar:"Brand · Home · About · Contact", footer:"© 2026 Your Site",
    hero:"Bold Headline Here", section:"Section Content", container:"", row:"", column:"",
    icon:"★", card:"Card Title", testimonial:'"Amazing!" – Jane D.',
    form:"Contact Form", contact:"Get In Touch", faq:"Frequently Asked Questions",
    pricing:"Starter Plan", gallery:"Gallery", animation:"Animated",
    divider:"", spacer:"", image:"", video:""
  };
  return m[t] || "Element";
}
function getDefaultColor(t)   { return ["header","navbar","footer","hero"].includes(t) ? "#ffffff" : "#1a1a2e"; }
function getDefaultBg(t) {
  const m = {
    header:"#1a1a2e", navbar:"#0f0f13", footer:"#1a1a2e", hero:"#6c63ff", button:"#6c63ff",
    image:"#e5e7eb", video:"#1f2937", card:"#ffffff", testimonial:"#f8f9fa",
    container:"rgba(108,99,255,.05)", section:"#f8f9fa", row:"transparent", column:"transparent",
    pricing:"#ffffff", form:"#f8f9fa", contact:"#f0f0f8", faq:"#ffffff"
  };
  return m[t] || "transparent";
}
function getDefaultBorderR(t) { return ["button","card","testimonial","pricing","form"].includes(t) ? 8 : 0; }
function getDefaultPad(t) {
  const m = { text:8, heading:10, button:12, header:20, navbar:16, footer:20, hero:60, section:40, card:20, testimonial:24, form:24, contact:32, faq:24, pricing:24 };
  return m[t] || 0;
}

// =========================================================
// RENDER
// =========================================================
function renderOne(data) {
  const el = document.createElement("div");
  el.className    = "editor-el";
  el.id           = data.id;
  el.dataset.type = data.type;
  applyStyles(el, data);
  setContent(el, data);
  attachElEvents(el);
  canvas.appendChild(el);
}

function renderAllElements() {
  canvas.querySelectorAll(".editor-el").forEach(e => e.remove());
  elements.forEach(data => renderOne(data));
}

function applyStyles(el, data) {
  const p = data.props;
  el.style.cssText      = "";
  el.style.position     = "absolute";
  el.style.left         = data.x + "px";
  el.style.top          = data.y + "px";
  el.style.width        = data.w + "px";
  el.style.height       = data.h + "px";
  el.style.zIndex       = data.z;
  el.style.color        = p.color;
  el.style.backgroundColor = p.bgColor;
  el.style.fontSize     = p.fontSize + "px";
  el.style.fontFamily   = p.fontFamily;
  el.style.fontWeight   = p.fontWeight;
  el.style.textAlign    = p.align;
  el.style.padding      = p.padding + "px";
  el.style.margin       = p.margin + "px";
  el.style.borderRadius = p.borderR + "px";
  el.style.border       = p.borderW ? `${p.borderW}px solid ${p.borderC}` : "none";
  el.style.boxShadow    = p.shadow;
  el.style.cursor       = data.locked ? "not-allowed" : "move";
  el.style.userSelect   = "none";
  el.style.overflow     = "hidden";
  el.style.boxSizing    = "border-box";
  el.style.touchAction  = "none";
  if (p.bgImg)    { el.style.backgroundImage = `url(${p.bgImg})`; el.style.backgroundSize = "cover"; el.style.backgroundPosition = "center"; }
  if (data.hidden){ el.style.opacity = ".3"; el.style.pointerEvents = "none"; }
  if (p.anim)     { el.style.animationName = p.anim; el.style.animationDuration = p.animDur+"ms"; el.style.animationDelay = p.animDel+"ms"; el.style.animationFillMode = "both"; el.style.animationIterationCount = p.animIter; el.style.animationTimingFunction = "ease-in-out"; }
  if (selectedId === data.id) el.style.outline = "2px solid #6c63ff";
}

function setContent(el, data) {
  const p   = data.props;
  el.innerHTML = "";
  const css = `font-size:${p.fontSize}px;font-family:${p.fontFamily};font-weight:${p.fontWeight};color:${p.color};text-align:${p.align};`;

  switch (data.type) {
    case "text": case "heading": case "column": case "row":
      el.style.display = "flex"; el.style.alignItems = "center";
      el.innerHTML = `<span style="${css}padding:4px">${p.text||""}</span>`;
      break;
    case "button":
      el.style.display = "flex"; el.style.alignItems = "center"; el.style.justifyContent = "center";
      el.innerHTML = `<button style="width:100%;height:100%;border:none;background:transparent;cursor:pointer;${css}">${p.text}</button>`;
      break;
    case "link":
      el.style.display = "flex"; el.style.alignItems = "center";
      el.innerHTML = `<a href="${p.link||"#"}" style="text-decoration:underline;${css}" onclick="return false">${p.text}</a>`;
      break;
    case "divider":
      el.style.display = "flex"; el.style.alignItems = "center";
      el.innerHTML = `<hr style="width:100%;border:none;border-top:2px solid ${p.color||"#ccc"};margin:0"/>`;
      break;
    case "spacer":
      el.style.background = "repeating-linear-gradient(45deg,rgba(108,99,255,.05) 0,rgba(108,99,255,.05) 5px,transparent 5px,transparent 20px)";
      break;
    case "icon":
      el.style.display = "flex"; el.style.alignItems = "center"; el.style.justifyContent = "center";
      el.innerHTML = `<span style="font-size:${p.fontSize||32}px;color:${p.color}">${p.text||"★"}</span>`;
      break;
    case "image":
      if (p.src) { el.style.backgroundImage = `url(${p.src})`; el.style.backgroundSize = "cover"; el.style.backgroundPosition = "center"; }
      else { el.style.display="flex"; el.style.alignItems="center"; el.style.justifyContent="center"; el.style.border="2px dashed #ccc"; el.style.flexDirection="column"; el.style.gap="6px"; el.innerHTML=`<i class="bi bi-image" style="font-size:32px;color:#bbb"></i><span style="font-size:12px;color:#bbb">Upload or set URL</span>`; }
      break;
    case "video":
      if (p.src) { el.innerHTML=`<video src="${p.src}" style="width:100%;height:100%;object-fit:cover" controls></video>`; }
      else { el.style.display="flex"; el.style.alignItems="center"; el.style.justifyContent="center"; el.style.flexDirection="column"; el.style.gap="8px"; el.style.background="#1f2937"; el.innerHTML=`<i class="bi bi-camera-video" style="font-size:36px;color:#999"></i><span style="font-size:12px;color:#999">Upload video</span>`; }
      break;
    case "gallery":
      el.style.display="grid"; el.style.gridTemplateColumns="repeat(3,1fr)"; el.style.gap="6px";
      for(let i=0;i<6;i++){const d=document.createElement("div");d.style.cssText="background:#e5e7eb;border-radius:4px;display:flex;align-items:center;justify-content:center;min-height:60px";d.innerHTML="<i class='bi bi-image' style='color:#bbb'></i>";el.appendChild(d);}
      break;
    case "header":
      el.style.display="flex";el.style.alignItems="center";el.style.justifyContent="center";el.style.fontWeight="700";
      el.innerHTML=`<span style="${css}font-size:${Math.max(p.fontSize,18)}px;font-weight:700">${p.text}</span>`;
      break;
    case "navbar":
      el.style.display="flex";el.style.alignItems="center";el.style.justifyContent="space-between";
      const pts=(p.text||"").split("·").map(s=>s.trim());
      el.innerHTML=`<span style="font-weight:700;font-size:16px;color:${p.color}">${pts[0]||"Brand"}</span>
        <nav style="display:flex;gap:20px;font-size:14px">${pts.slice(1).map(l=>`<a href="#" onclick="return false" style="color:${p.color};text-decoration:none">${l}</a>`).join("")}</nav>
        <button style="background:${p.color};color:${p.bgColor};border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px">Menu</button>`;
      break;
    case "footer":
      el.style.display="flex";el.style.alignItems="center";el.style.justifyContent="center";el.style.textAlign="center";el.style.borderTop="1px solid rgba(255,255,255,.1)";
      el.innerHTML=`<span style="${css}font-size:13px">${p.text}</span>`;
      break;
    case "hero":
      el.style.display="flex";el.style.flexDirection="column";el.style.alignItems="center";el.style.justifyContent="center";el.style.textAlign="center";
      if(p.bgImg){el.style.backgroundImage=`url(${p.bgImg})`;el.style.backgroundSize="cover";el.style.backgroundPosition="center";}
      el.innerHTML=`<h1 style="font-size:${Math.max(p.fontSize,28)}px;font-weight:700;color:${p.color};margin:0 0 16px">${p.text}</h1>
        <p style="font-size:16px;color:${p.color};opacity:.8;max-width:500px;margin:0 0 24px">Your compelling subtitle</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
          <button style="padding:12px 28px;border:none;border-radius:8px;background:#fff;color:${p.bgColor};font-weight:600;cursor:pointer">Get Started</button>
          <button style="padding:12px 28px;border:2px solid rgba(255,255,255,.5);border-radius:8px;background:transparent;color:${p.color};cursor:pointer">Learn More</button>
        </div>`;
      break;
    case "section":
      el.style.display="flex";el.style.alignItems="center";el.style.justifyContent="center";
      if(p.bgImg){el.style.backgroundImage=`url(${p.bgImg})`;el.style.backgroundSize="cover";el.style.backgroundPosition="center";}
      el.innerHTML=`<span style="${css}">${p.text}</span>`;
      break;
    case "container":
      el.style.border="2px dashed rgba(108,99,255,.3)";el.style.borderRadius="4px";
      break;
    case "card":
      el.style.display="flex";el.style.flexDirection="column";
      el.innerHTML=`<div style="background:linear-gradient(135deg,#6c63ff22,#ff658422);height:100px;border-radius:6px 6px 0 0;display:flex;align-items:center;justify-content:center"><i class="bi bi-image" style="font-size:24px;color:#999"></i></div>
        <div style="padding:12px"><h4 style="${css}font-weight:600;margin:0 0 6px">${p.text}</h4><p style="font-size:13px;color:#666;margin:0">Description text.</p></div>`;
      break;
    case "testimonial":
      el.style.display="flex";el.style.flexDirection="column";el.style.justifyContent="space-between";
      el.innerHTML=`<p style="${css}font-style:italic;margin:0 0 16px">${p.text}</p>
        <div style="display:flex;align-items:center;gap:10px"><div style="width:36px;height:36px;background:#6c63ff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600">J</div>
        <div><div style="font-weight:600;font-size:13px">Jane Doe</div><div style="font-size:11px;color:#999">CEO, Company</div></div></div>`;
      break;
    case "form":
      el.innerHTML=`<h3 style="${css}font-weight:600;margin:0 0 16px">${p.text}</h3>
        <div style="display:flex;flex-direction:column;gap:10px">
          <input placeholder="Your Name" style="padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:13px;width:100%"/>
          <input placeholder="Email" style="padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:13px;width:100%"/>
          <textarea placeholder="Message" rows="3" style="padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:13px;width:100%;resize:none"></textarea>
          <button style="padding:10px;background:#6c63ff;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">Send</button>
        </div>`;
      break;
    case "contact":
      el.innerHTML=`<h3 style="${css}font-weight:700;font-size:22px;margin:0 0 8px">${p.text}</h3>
        <p style="color:#999;font-size:13px;margin:0 0 20px">We'd love to hear from you.</p>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;align-items:center;gap:12px"><i class="bi bi-envelope" style="color:#6c63ff;font-size:18px"></i><span style="font-size:13px">hello@example.com</span></div>
          <div style="display:flex;align-items:center;gap:12px"><i class="bi bi-telephone" style="color:#6c63ff;font-size:18px"></i><span style="font-size:13px">+1 (555) 000-0000</span></div>
          <div style="display:flex;align-items:center;gap:12px"><i class="bi bi-geo-alt" style="color:#6c63ff;font-size:18px"></i><span style="font-size:13px">New York, NY</span></div>
        </div>`;
      break;
    case "faq":
      el.innerHTML=`<h3 style="${css}font-weight:700;font-size:20px;margin:0 0 16px">${p.text}</h3>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${["What is this?","How do I start?","Is there a free plan?"].map(q=>`
            <div style="border:1px solid #eee;border-radius:6px;padding:12px">
              <div style="font-weight:600;font-size:13px;display:flex;justify-content:space-between">${q} <i class="bi bi-chevron-down"></i></div>
              <div style="font-size:12px;color:#666;margin-top:8px">Click to expand.</div>
            </div>`).join("")}
        </div>`;
      break;
    case "pricing":
      el.innerHTML=`<div style="text-align:center">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#6c63ff;font-weight:600;margin-bottom:8px">Plan</div>
        <h3 style="${css}font-weight:700;font-size:22px;margin:0 0 4px">${p.text}</h3>
        <div style="font-size:36px;font-weight:700;color:#6c63ff;margin:12px 0">$29<span style="font-size:16px;color:#999">/mo</span></div>
        <div style="display:flex;flex-direction:column;gap:8px;text-align:left;margin:16px 0">
          ${["✓ Feature one","✓ Feature two","✓ Feature three","✓ Priority support"].map(f=>`<div style="font-size:13px">${f}</div>`).join("")}
        </div>
        <button style="width:100%;padding:10px;background:#6c63ff;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600">Get Started</button>
      </div>`;
      break;
    case "animation":
      el.style.display="flex";el.style.alignItems="center";el.style.justifyContent="center";
      el.style.border="2px solid #6c63ff";el.style.borderRadius="8px";el.style.flexDirection="column";el.style.gap="8px";
      el.innerHTML=`<i class="bi bi-lightning" style="font-size:28px;color:#6c63ff"></i><span style="font-size:13px;color:#6c63ff">${p.text}</span>`;
      break;
  }
}

function refreshEl(id) {
  const data = getEl(id);
  const el   = document.getElementById(id);
  if (!data || !el) return;
  applyStyles(el, data);
  setContent(el, data);
  removeResizeHandles(el);
  if (selectedId === id) addResizeHandles(el);
}

// =========================================================
// ELEMENT EVENTS
// =========================================================
function attachElEvents(el) {
  el.addEventListener("mousedown",   onElMouseDown);
  el.addEventListener("click",       onElClick);
  el.addEventListener("dblclick",    onElDblClick);
  el.addEventListener("contextmenu", onElCtxMenu);
  el.addEventListener("touchstart",  onElTouchStart, { passive: false });
}

function onElClick(e)    { e.stopPropagation(); selectEl(e.currentTarget.id); }
function onElDblClick(e) {
  e.stopPropagation();
  const data = getEl(e.currentTarget.id);
  if (!data) return;
  if (["text","heading","button","header","footer","link","icon","section","card"].includes(data.type))
    inlineEdit(e.currentTarget, data);
}
function onElCtxMenu(e) { e.preventDefault(); e.stopPropagation(); ctxTargetId = e.currentTarget.id; showCtxMenu(e.clientX, e.clientY); }

// Mouse drag
function onElMouseDown(e) {
  if (e.button !== 0) return;
  const el   = e.currentTarget;
  const data = getEl(el.id);
  if (!data || data.locked) return;
  e.preventDefault(); e.stopPropagation();
  selectEl(el.id);
  const rect = el.getBoundingClientRect();
  const cr   = canvas.getBoundingClientRect();
  dragInfo   = { id:el.id, ox:e.clientX-rect.left, oy:e.clientY-rect.top, cr };
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("mouseup",   onDragEnd);
}
function onDragMove(e) {
  if (!dragInfo) return;
  const data = getEl(dragInfo.id);
  const el   = document.getElementById(dragInfo.id);
  if (!data||!el) return;
  let x = (e.clientX - dragInfo.cr.left - dragInfo.ox) / zoom;
  let y = (e.clientY - dragInfo.cr.top  - dragInfo.oy) / zoom;
  x = Math.max(0, x); y = Math.max(0, y);
  if (snapEnabled) { x=Math.round(x/SNAP_GRID)*SNAP_GRID; y=Math.round(y/SNAP_GRID)*SNAP_GRID; }
  data.x=x; data.y=y;
  el.style.left=x+"px"; el.style.top=y+"px";
  updatePropXY(data);
}
function onDragEnd() {
  if (dragInfo) { saveToStorage(); pushHistory(); }
  dragInfo = null;
  document.removeEventListener("mousemove", onDragMove);
  document.removeEventListener("mouseup",   onDragEnd);
}

// Touch drag element
let elTouchDrag = null;
function onElTouchStart(e) {
  if (e.touches.length !== 1) return;
  const el   = e.currentTarget;
  const data = getEl(el.id);
  if (!data || data.locked) return;
  e.preventDefault();
  selectEl(el.id);
  const touch = e.touches[0];
  const rect  = el.getBoundingClientRect();
  const cr    = canvas.getBoundingClientRect();
  elTouchDrag = { id:el.id, ox:touch.clientX-rect.left, oy:touch.clientY-rect.top, cr };
  document.addEventListener("touchmove", onElTouchMove, { passive:false });
  document.addEventListener("touchend",  onElTouchEnd);
}
function onElTouchMove(e) {
  if (!elTouchDrag || e.touches.length!==1) return;
  e.preventDefault();
  const touch = e.touches[0];
  const data  = getEl(elTouchDrag.id);
  const el    = document.getElementById(elTouchDrag.id);
  if (!data||!el) return;
  let x = (touch.clientX - elTouchDrag.cr.left - elTouchDrag.ox) / zoom;
  let y = (touch.clientY - elTouchDrag.cr.top  - elTouchDrag.oy) / zoom;
  x=Math.max(0,x); y=Math.max(0,y);
  if (snapEnabled){x=Math.round(x/SNAP_GRID)*SNAP_GRID;y=Math.round(y/SNAP_GRID)*SNAP_GRID;}
  data.x=x; data.y=y;
  el.style.left=x+"px"; el.style.top=y+"px";
}
function onElTouchEnd() {
  if (elTouchDrag) { saveToStorage(); pushHistory(); }
  elTouchDrag = null;
  document.removeEventListener("touchmove", onElTouchMove);
  document.removeEventListener("touchend",  onElTouchEnd);
}

// Inline edit
function inlineEdit(el, data) {
  const input = document.createElement("input");
  input.type  = "text"; input.value = data.props.text;
  input.style.cssText = `position:absolute;inset:0;width:100%;height:100%;border:none;
    outline:2px solid #6c63ff;background:rgba(255,255,255,.95);
    font-size:${data.props.fontSize}px;font-family:${data.props.fontFamily};
    font-weight:${data.props.fontWeight};color:${data.props.color};
    padding:8px;box-sizing:border-box;z-index:500;border-radius:4px`;
  el.appendChild(input);
  input.focus(); input.select();
  const finish = () => {
    data.props.text = input.value;
    input.remove();
    setContent(el, data);
    const pText = document.getElementById("pText");
    if (pText) pText.value = data.props.text;
    saveToStorage(); pushHistory();
  };
  input.addEventListener("blur", finish);
  input.addEventListener("keydown", e => {
    if (e.key==="Enter") { e.preventDefault(); finish(); }
    if (e.key==="Escape") { input.remove(); setContent(el, data); }
  });
}

// =========================================================
// TOOL TOUCH DRAG
// =========================================================
let toolTouchType = null, toolTouchGhost = null;
function handleToolTouchStart(e) {
  toolTouchType  = e.currentTarget.dataset.type;
  const t        = e.touches[0];
  toolTouchGhost = e.currentTarget.cloneNode(true);
  Object.assign(toolTouchGhost.style, { position:"fixed", pointerEvents:"none", opacity:".85", zIndex:"9999", left:(t.clientX-40)+"px", top:(t.clientY-20)+"px", width:"80px" });
  document.body.appendChild(toolTouchGhost);
  e.preventDefault();
}
function handleToolTouchMove(e) {
  if (!toolTouchGhost) return;
  const t = e.touches[0];
  toolTouchGhost.style.left = (t.clientX-40)+"px";
  toolTouchGhost.style.top  = (t.clientY-20)+"px";
  e.preventDefault();
}
function handleToolTouchEnd(e) {
  if (!toolTouchGhost || !toolTouchType) return;
  const t  = e.changedTouches[0];
  const cr = canvas.getBoundingClientRect();
  const x  = (t.clientX - cr.left) / zoom;
  const y  = (t.clientY - cr.top)  / zoom;
  if (x>=0 && y>=0 && x<=canvas.offsetWidth && y<=canvas.offsetHeight) {
    const def  = ELEMENT_DEFS[toolTouchType];
    const data = addEl(toolTouchType, Math.max(0, x-(def?.w||100)/2), Math.max(0, y-(def?.h||50)/2));
    selectEl(data.id);
    pushHistory(); saveToStorage();
  }
  toolTouchGhost.remove();
  toolTouchGhost = null; toolTouchType = null;
  closeAllPanels(); // close the toolbox panel after placing
}

// =========================================================
// CANVAS DROP
// =========================================================
function setupCanvasDrop() {
  canvas.addEventListener("dragover",  e => { e.preventDefault(); canvas.classList.add("dropping"); });
  canvas.addEventListener("dragleave", () => canvas.classList.remove("dropping"));
  canvas.addEventListener("drop", e => {
    e.preventDefault(); canvas.classList.remove("dropping");
    const type = e.dataTransfer.getData("element-type");
    if (!type) return;
    const cr  = canvas.getBoundingClientRect();
    const def = ELEMENT_DEFS[type];
    let x = (e.clientX - cr.left) / zoom - (def?.w||100)/2;
    let y = (e.clientY - cr.top)  / zoom - (def?.h||50)/2;
    if (snapEnabled) { x=Math.round(x/SNAP_GRID)*SNAP_GRID; y=Math.round(y/SNAP_GRID)*SNAP_GRID; }
    const data = addEl(type, Math.max(0,x), Math.max(0,y));
    selectEl(data.id);
    pushHistory(); saveToStorage();
  });
  canvas.addEventListener("click", e => {
    if (e.target===canvas || e.target.id==="gridOverlay" || e.target.id==="emptyHint") deselectEl();
  });
}

// =========================================================
// SELECT / DESELECT
// =========================================================
function selectEl(id) {
  if (selectedId) {
    const prev = document.getElementById(selectedId);
    if (prev) { prev.style.outline="none"; removeResizeHandles(prev); }
  }
  selectedId = id;
  const el = document.getElementById(id);
  if (el) { el.style.outline="2px solid #6c63ff"; addResizeHandles(el); }
  updatePropsPanel();
  updateLayersPanel();
}
function deselectEl() {
  if (selectedId) {
    const el = document.getElementById(selectedId);
    if (el) { el.style.outline="none"; removeResizeHandles(el); }
  }
  selectedId = null;
  updatePropsPanel();
  updateLayersPanel();
}

// =========================================================
// RESIZE HANDLES
// =========================================================
function addResizeHandles(el) {
  removeResizeHandles(el);
  ["nw","ne","sw","se"].forEach(pos => {
    const h = document.createElement("div");
    h.className  = `resize-handle ${pos}`;
    h.dataset.pos = pos;
    h.addEventListener("mousedown", onResizeStart);
    h.addEventListener("touchstart", onResizeTouchStart, { passive:false });
    el.appendChild(h);
  });
}
function removeResizeHandles(el) { el.querySelectorAll(".resize-handle").forEach(h=>h.remove()); }

function onResizeStart(e) {
  e.stopPropagation(); e.preventDefault();
  const pos  = e.currentTarget.dataset.pos;
  const el   = e.currentTarget.parentElement;
  const data = getEl(el.id);
  if (!data) return;
  resizeInfo = { id:el.id, pos, startX:e.clientX, startY:e.clientY, startW:data.w, startH:data.h, startElX:data.x, startElY:data.y };
  document.addEventListener("mousemove", onResizeMove);
  document.addEventListener("mouseup",   onResizeEnd);
}
function onResizeMove(e) {
  if (!resizeInfo) return;
  const {id,pos,startX,startY,startW,startH,startElX,startElY} = resizeInfo;
  const data=getEl(id); const el=document.getElementById(id);
  if (!data||!el) return;
  let dx=(e.clientX-startX)/zoom, dy=(e.clientY-startY)/zoom;
  let nW=startW,nH=startH,nX=startElX,nY=startElY;
  if(pos.includes("e")) nW=Math.max(40,startW+dx);
  if(pos.includes("s")) nH=Math.max(20,startH+dy);
  if(pos.includes("w")){nW=Math.max(40,startW-dx);nX=startElX+dx;}
  if(pos.includes("n")){nH=Math.max(20,startH-dy);nY=startElY+dy;}
  if(snapEnabled){nW=Math.round(nW/SNAP_GRID)*SNAP_GRID;nH=Math.round(nH/SNAP_GRID)*SNAP_GRID;}
  data.w=nW;data.h=nH;data.x=nX;data.y=nY;
  el.style.width=nW+"px";el.style.height=nH+"px";el.style.left=nX+"px";el.style.top=nY+"px";
  const pW=document.getElementById("pW");const pH=document.getElementById("pH");
  if(pW)pW.value=nW;if(pH)pH.value=nH;
}
function onResizeEnd() {
  if(resizeInfo){saveToStorage();pushHistory();}
  resizeInfo=null;
  document.removeEventListener("mousemove",onResizeMove);
  document.removeEventListener("mouseup",onResizeEnd);
}
function onResizeTouchStart(e) {
  e.stopPropagation();e.preventDefault();
  const pos=e.currentTarget.dataset.pos;
  const el=e.currentTarget.parentElement;
  const data=getEl(el.id);if(!data)return;
  const t=e.touches[0];
  resizeInfo={id:el.id,pos,startX:t.clientX,startY:t.clientY,startW:data.w,startH:data.h,startElX:data.x,startElY:data.y};
  document.addEventListener("touchmove",onResizeTouchMove,{passive:false});
  document.addEventListener("touchend",onResizeTouchEnd);
}
function onResizeTouchMove(e) {
  if(!resizeInfo||e.touches.length!==1)return;
  e.preventDefault();
  const t=e.touches[0];
  const{id,pos,startX,startY,startW,startH,startElX,startElY}=resizeInfo;
  const data=getEl(id);const el=document.getElementById(id);if(!data||!el)return;
  let dx=(t.clientX-startX)/zoom,dy=(t.clientY-startY)/zoom;
  let nW=startW,nH=startH,nX=startElX,nY=startElY;
  if(pos.includes("e"))nW=Math.max(40,startW+dx);
  if(pos.includes("s"))nH=Math.max(20,startH+dy);
  if(pos.includes("w")){nW=Math.max(40,startW-dx);nX=startElX+dx;}
  if(pos.includes("n")){nH=Math.max(20,startH-dy);nY=startElY+dy;}
  data.w=nW;data.h=nH;data.x=nX;data.y=nY;
  el.style.width=nW+"px";el.style.height=nH+"px";el.style.left=nX+"px";el.style.top=nY+"px";
}
function onResizeTouchEnd() {
  if(resizeInfo){saveToStorage();pushHistory();}
  resizeInfo=null;
  document.removeEventListener("touchmove",onResizeTouchMove);
  document.removeEventListener("touchend",onResizeTouchEnd);
}

// =========================================================
// PROPERTIES PANEL
// =========================================================
function setupProperties() {
  ["pText","pLink","pSrc","pFontFamily","pFontSize","pFontWeight","pColor","pBg",
   "pBgImg","pW","pH","pX","pY","pPad","pMargin","pBordW","pBordR","pBordC",
   "pShadow","pAnim","pAnimDur","pAnimDel","pAnimIter"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input",  onPropChange);
    el.addEventListener("change", onPropChange);
  });
  document.getElementById("pFile")?.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file||!selectedId) return;
    const reader = new FileReader();
    reader.onload = r => {
      const data = getEl(selectedId);if(!data)return;
      data.props.src = r.target.result;
      if (data.type!=="video") data.props.bgImg = r.target.result;
      refreshEl(selectedId);
      const pSrc=document.getElementById("pSrc");if(pSrc)pSrc.value="(uploaded)";
      saveToStorage();pushHistory();
    };
    reader.readAsDataURL(file);
  });
}

function onPropChange(e) {
  if (!selectedId) return;
  const data = getEl(selectedId);if(!data)return;
  const v=e.target.value, p=data.props;
  switch(e.target.id){
    case "pText":     p.text=v;break;
    case "pLink":     p.link=v;break;
    case "pSrc":      p.src=v;if(data.type!=="video")p.bgImg=v;break;
    case "pFontFamily":p.fontFamily=v;break;
    case "pFontSize": p.fontSize=+v;break;
    case "pFontWeight":p.fontWeight=v;break;
    case "pColor":    p.color=v;break;
    case "pBg":       p.bgColor=v;break;
    case "pBgImg":    p.bgImg=v;break;
    case "pW":        data.w=+v;break;
    case "pH":        data.h=+v;break;
    case "pX":        data.x=+v;break;
    case "pY":        data.y=+v;break;
    case "pPad":      p.padding=+v;break;
    case "pMargin":   p.margin=+v;break;
    case "pBordW":    p.borderW=+v;break;
    case "pBordR":    p.borderR=+v;break;
    case "pBordC":    p.borderC=v;break;
    case "pShadow":   p.shadow=v;break;
    case "pAnim":     p.anim=v;break;
    case "pAnimDur":  p.animDur=+v;break;
    case "pAnimDel":  p.animDel=+v;break;
    case "pAnimIter": p.animIter=v;break;
  }
  refreshEl(selectedId);
  saveToStorage();
}

function updatePropsPanel() {
  const noSel = document.getElementById("noSel");
  const inner = document.getElementById("propsInner");
  if (!noSel||!inner) return;
  if (!selectedId) { noSel.style.display="flex"; inner.style.display="none"; return; }
  noSel.style.display="none"; inner.style.display="block";
  const data=getEl(selectedId);if(!data)return;
  const p=data.props;
  const isMedia=["image","video"].includes(data.type);
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val;};
  const show=(id,vis)=>{const el=document.getElementById(id);if(el)el.style.display=vis?"flex":"none";};
  set("pText",p.text||"");
  show("pLinkRow",data.type==="link");
  set("pLink",p.link||"");
  show("pSrcRow",isMedia);
  const upRow=document.getElementById("pUploadRow");if(upRow)upRow.style.display=isMedia?"block":"none";
  set("pSrc",p.src||"");
  set("pFontFamily",p.fontFamily||"Inter");
  set("pFontSize",p.fontSize||16);
  set("pFontWeight",p.fontWeight||"400");
  set("pColor",p.color||"#000000");
  set("pBg",(p.bgColor&&!p.bgColor.startsWith("rgba")&&p.bgColor!=="transparent")?p.bgColor:"#ffffff");
  set("pBgImg",p.bgImg||"");
  set("pW",data.w);set("pH",data.h);
  set("pX",data.x);set("pY",data.y);
  set("pPad",p.padding||0);set("pMargin",p.margin||0);
  set("pBordW",p.borderW||0);set("pBordR",p.borderR||0);
  set("pBordC",p.borderC||"#000000");
  set("pShadow",p.shadow||"");
  set("pAnim",p.anim||"");
  set("pAnimDur",p.animDur||1000);
  set("pAnimDel",p.animDel||0);
  set("pAnimIter",p.animIter||"1");
}
function updatePropXY(data) {
  const pX=document.getElementById("pX");const pY=document.getElementById("pY");
  if(pX)pX.value=Math.round(data.x);if(pY)pY.value=Math.round(data.y);
}
window.setAlign = function(a) { if(!selectedId)return; const d=getEl(selectedId);if(d){d.props.align=a;refreshEl(selectedId);saveToStorage();} };
window.clearBg  = function()  { if(!selectedId)return; const d=getEl(selectedId);if(d){d.props.bgColor="transparent";refreshEl(selectedId);saveToStorage();} };

// =========================================================
// LAYERS PANEL
// =========================================================
function updateLayersPanel() {
  const list=document.getElementById("layersList");if(!list)return;
  list.innerHTML="";
  [...elements].reverse().forEach(data => {
    const def=ELEMENT_DEFS[data.type];
    const item=document.createElement("div");
    item.className="layer-item"+(selectedId===data.id?" selected":"");
    item.innerHTML=`
      <i class="bi ${def?.icon||"bi-square"} layer-icon"></i>
      <span class="layer-name">${data.name}</span>
      <div class="layer-actions">
        <button onclick="event.stopPropagation();toggleVisibilityById('${data.id}')"><i class="bi ${data.hidden?"bi-eye-slash":"bi-eye"}"></i></button>
        <button onclick="event.stopPropagation();deleteById('${data.id}')"><i class="bi bi-trash"></i></button>
      </div>`;
    item.addEventListener("click",()=>selectEl(data.id));
    list.appendChild(item);
  });
}

// =========================================================
// ELEMENT ACTIONS (exposed to HTML onclick)
// =========================================================
function getEl(id) { return elements.find(e=>e.id===id); }
function genId()   { return "el_"+Date.now()+"_"+Math.random().toString(36).substr(2,6); }

window.deleteSelectedElement = ()=>{ if(selectedId) deleteById(selectedId); };
window.deleteById = (id)=>{
  document.getElementById(id)?.remove();
  elements=elements.filter(e=>e.id!==id);
  if(selectedId===id){selectedId=null;updatePropsPanel();}
  updateLayersPanel();updateEmptyHint();saveToStorage();pushHistory();toast("Deleted");
};
window.duplicateSelected = ()=>{
  if(!selectedId)return;
  const data=getEl(selectedId);if(!data)return;
  const nd=JSON.parse(JSON.stringify(data));
  nd.id=genId();nd.x+=20;nd.y+=20;nd.z=++zCounter;nd.name=data.name+" copy";
  elements.push(nd);renderOne(nd);selectEl(nd.id);
  updateLayersPanel();saveToStorage();pushHistory();toast("Duplicated");
};
window.toggleLockSelected = ()=>{
  if(!selectedId)return;
  const d=getEl(selectedId);if(!d)return;
  d.locked=!d.locked;refreshEl(selectedId);toast(d.locked?"Locked":"Unlocked");
};
window.toggleVisibility      = ()=>{ if(selectedId) toggleVisibilityById(selectedId); };
window.toggleVisibilityById  = (id)=>{ const d=getEl(id);if(!d)return;d.hidden=!d.hidden;refreshEl(id);updateLayersPanel();saveToStorage(); };
window.bringForward  = ()=>{ if(!selectedId)return;const d=getEl(selectedId);if(d){d.z++;document.getElementById(selectedId).style.zIndex=d.z;saveToStorage();} };
window.sendBackward  = ()=>{ if(!selectedId)return;const d=getEl(selectedId);if(d){d.z=Math.max(1,d.z-1);document.getElementById(selectedId).style.zIndex=d.z;saveToStorage();} };
window.bringToFront  = ()=>{ if(!selectedId)return;const d=getEl(selectedId);if(d){d.z=++zCounter;document.getElementById(selectedId).style.zIndex=d.z;saveToStorage();} };
window.selectAllElements = ()=>{ if(elements.length>0)selectEl(elements[elements.length-1].id); };

function clearCanvas() {
  elements=[];canvas.querySelectorAll(".editor-el").forEach(e=>e.remove());
  selectedId=null;updatePropsPanel();updateLayersPanel();updateEmptyHint();
  saveToStorage();pushHistory();toast("Canvas cleared");
}
function updateEmptyHint() {
  const hint=document.getElementById("emptyHint");
  if(hint)hint.style.display=elements.length===0?"block":"none";
}

// =========================================================
// CONTEXT MENU
// =========================================================
function setupContextMenu() { document.addEventListener("click", hideCtxMenu); }
function showCtxMenu(x,y) {
  const m=document.getElementById("ctxMenu");if(!m)return;
  m.style.display="block";
  m.style.left=Math.min(x,window.innerWidth-200)+"px";
  m.style.top =Math.min(y,window.innerHeight-260)+"px";
}
function hideCtxMenu() { const m=document.getElementById("ctxMenu");if(m)m.style.display="none"; }
window.ctxAction = (action)=>{
  hideCtxMenu();if(!ctxTargetId)return;
  selectEl(ctxTargetId);
  if(action==="edit"){const el=document.getElementById(ctxTargetId);const d=getEl(ctxTargetId);if(el&&d)inlineEdit(el,d);}
  else if(action==="duplicate") window.duplicateSelected();
  else if(action==="lock")      window.toggleLockSelected();
  else if(action==="front")     window.bringToFront();
  else if(action==="back")      window.sendBackward();
  else if(action==="delete")    window.deleteSelectedElement();
};

// =========================================================
// BUTTONS
// =========================================================
function setupButtons() {
  document.getElementById("toggleLeft")?.addEventListener("click",  ()=>togglePanel("left"));
  document.getElementById("toggleRight")?.addEventListener("click", ()=>togglePanel("right"));
  document.getElementById("undoBtn")?.addEventListener("click",   undo);
  document.getElementById("redoBtn")?.addEventListener("click",   redo);
  document.getElementById("clearBtn")?.addEventListener("click",  ()=>{if(confirm("Clear canvas?"))clearCanvas();});
  document.getElementById("previewBtn")?.addEventListener("click", openPreview);
  document.getElementById("codeBtn")?.addEventListener("click",    openCodeModal);
  document.getElementById("saveBtn")?.addEventListener("click",    ()=>{saveToStorage();toast("Saved ✓");});
  document.getElementById("exportBtn")?.addEventListener("click",  exportHTML);
  document.getElementById("themeBtn")?.addEventListener("click",   toggleTheme);
  document.getElementById("gridBtn")?.addEventListener("click",    toggleGrid);
  document.getElementById("snapBtn")?.addEventListener("click",    toggleSnap);
  document.getElementById("publishBtn")?.addEventListener("click", publishProject);

  document.querySelectorAll("[data-device]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll("[data-device]").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      setCanvasWidth(btn.dataset.device);
    });
  });
  document.querySelectorAll(".panel-tab").forEach(tab=>{
    tab.addEventListener("click",()=>{
      document.querySelectorAll(".panel-tab").forEach(t=>t.classList.remove("active"));
      tab.classList.add("active");
      const n=tab.dataset.tab;
      document.getElementById("tab-elements").style.display  = n==="elements" ?"block":"none";
      document.getElementById("tab-layers").style.display    = n==="layers"   ?"block":"none";
      document.getElementById("tab-templates").style.display = n==="templates"?"block":"none";
    });
  });
  document.querySelectorAll(".code-tab").forEach(tab=>{
    tab.addEventListener("click",()=>{
      document.querySelectorAll(".code-tab").forEach(t=>t.classList.remove("active"));
      tab.classList.add("active");
      activeCodeTab=tab.dataset.code;
      updateCodeOutput();
    });
  });
  document.getElementById("codeModal")?.addEventListener("click",e=>{
    if(e.target===document.getElementById("codeModal"))closeCodeModal();
  });
}

function setCanvasWidth(device) {
  const w={desktop:1200,tablet:768,mobile:390};
  canvas.style.width=(w[device]||1200)+"px";
}
function toggleGrid()  { gridVisible=!gridVisible;document.getElementById("gridOverlay")?.classList.toggle("on",gridVisible);toast(gridVisible?"Grid on":"Grid off"); }
function toggleSnap()  { snapEnabled=!snapEnabled;const sb=document.getElementById("snapBtn");if(sb)sb.style.color=snapEnabled?"var(--accent)":"";toast(snapEnabled?"Snap on":"Snap off"); }
function toggleTheme() { const html=document.documentElement;const dark=html.dataset.theme==="dark";html.dataset.theme=dark?"light":"dark";const btn=document.getElementById("themeBtn");if(btn)btn.innerHTML=dark?'<i class="bi bi-moon"></i>':'<i class="bi bi-sun"></i>'; }

// =========================================================
// HISTORY
// =========================================================
function pushHistory() {
  history=history.slice(0,histIdx+1);
  history.push(JSON.stringify(elements));
  histIdx=history.length-1;
  if(histIdx>60){history.shift();histIdx--;}
}
function undo() {
  if(histIdx<=0){toast("Nothing to undo");return;}
  histIdx--;
  elements=JSON.parse(history[histIdx]);
  renderAllElements();updateLayersPanel();updateEmptyHint();
  selectedId=null;updatePropsPanel();saveToStorage();toast("Undo");
}
function redo() {
  if(histIdx>=history.length-1){toast("Nothing to redo");return;}
  histIdx++;
  elements=JSON.parse(history[histIdx]);
  renderAllElements();updateLayersPanel();updateEmptyHint();
  selectedId=null;updatePropsPanel();saveToStorage();toast("Redo");
}
window.undo = undo;

// =========================================================
// KEYBOARD
// =========================================================
function setupKeyboard() {
  document.addEventListener("keydown",e=>{
    const tag=document.activeElement.tagName;
    if(["INPUT","TEXTAREA","SELECT"].includes(tag))return;
    if((e.ctrlKey||e.metaKey)&&e.key==="z"){e.preventDefault();undo();}
    if((e.ctrlKey||e.metaKey)&&(e.key==="y"||(e.shiftKey&&e.key==="z"))){e.preventDefault();redo();}
    if((e.ctrlKey||e.metaKey)&&e.key==="d"){e.preventDefault();window.duplicateSelected();}
    if(e.key==="Delete"||e.key==="Backspace") window.deleteSelectedElement();
    if(e.key==="Escape") deselectEl();
    if(e.key==="ArrowUp"    &&selectedId)nudge(0,-(e.shiftKey?10:1));
    if(e.key==="ArrowDown"  &&selectedId)nudge(0, (e.shiftKey?10:1));
    if(e.key==="ArrowLeft"  &&selectedId)nudge(-(e.shiftKey?10:1),0);
    if(e.key==="ArrowRight" &&selectedId)nudge( (e.shiftKey?10:1),0);
  });
}
function nudge(dx,dy) {
  const data=getEl(selectedId);const el=document.getElementById(selectedId);
  if(!data||!el)return;
  data.x+=dx;data.y+=dy;
  el.style.left=data.x+"px";el.style.top=data.y+"px";
  updatePropXY(data);saveToStorage();
}

// =========================================================
// CODE / EXPORT
// =========================================================
window.openCodeModal  = ()=>{ updateCodeOutput();document.getElementById("codeModal")?.classList.add("open"); };
window.closeCodeModal = ()=>{ document.getElementById("codeModal")?.classList.remove("open"); };

function generateHTML() {
  return elements.map(data=>{
    const p=data.props;
    const s=[
      `position:absolute`,`left:${data.x}px`,`top:${data.y}px`,
      `width:${data.w}px`,`height:${data.h}px`,`z-index:${data.z}`,
      `color:${p.color}`,`background-color:${p.bgColor}`,
      `font-size:${p.fontSize}px`,`font-family:${p.fontFamily}`,
      `font-weight:${p.fontWeight}`,`text-align:${p.align}`,
      `padding:${p.padding}px`,`border-radius:${p.borderR}px`,
      p.borderW?`border:${p.borderW}px solid ${p.borderC}`:"",
      p.shadow?`box-shadow:${p.shadow}`:"",
      p.bgImg?`background-image:url(${p.src||p.bgImg});background-size:cover;background-position:center`:"",
      p.anim?`animation:${p.anim} ${p.animDur}ms ${p.animDel}ms ${p.animIter} ease-in-out both`:""
    ].filter(Boolean).join(";");
    return `  <div data-type="${data.type}" style="${s}">${p.text||""}</div>`;
  }).join("\n");
}
function generateCSS() {
  return `/* Frodecorp Export */\n@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');\n*{box-sizing:border-box;margin:0;padding:0}\nbody{font-family:'Inter',sans-serif}\n.canvas{position:relative;width:1200px;margin:0 auto}\n@keyframes fade-in{from{opacity:0}to{opacity:1}}\n@keyframes slide-in{from{transform:translateX(-40px);opacity:0}to{transform:none;opacity:1}}\n@keyframes slide-up{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}\n@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}\n@keyframes zoom{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}\n@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}\n@keyframes rotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}\n@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}`;
}
function generateFullPage() {
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8"/>\n<meta name="viewport" content="width=device-width,initial-scale=1"/>\n<title>My Website</title>\n<style>\n${generateCSS()}\n</style>\n</head>\n<body>\n<div class="canvas" style="position:relative;min-height:100vh">\n${generateHTML()}\n</div>\n</body>\n</html>`;
}
function updateCodeOutput() {
  const map={html:generateHTML,css:generateCSS,full:generateFullPage};
  const out=document.getElementById("codeOutput");
  if(out)out.textContent=(map[activeCodeTab]||generateHTML)();
}
window.copyCode     = ()=>{ navigator.clipboard.writeText(document.getElementById("codeOutput")?.textContent||"").then(()=>toast("Copied!")); };
window.downloadCode = ()=>{
  const ext=activeCodeTab==="css"?"css":"html";
  const blob=new Blob([document.getElementById("codeOutput")?.textContent||""],{type:"text/plain"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`export.${ext}`;a.click();
  toast("Downloaded");
};
function exportHTML() {
  const blob=new Blob([generateFullPage()],{type:"text/html"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="website.html";a.click();
  toast("Exported!");
}

// =========================================================
// PREVIEW
// =========================================================
function openPreview()  { const f=document.getElementById("previewFrame");if(f)f.srcdoc=generateFullPage();document.getElementById("previewModal")?.classList.add("open"); }
function closePreview() { document.getElementById("previewModal")?.classList.remove("open"); }
window.openPreview  = openPreview;
window.closePreview = closePreview;

// =========================================================
// PUBLISH
// =========================================================
async function publishProject() {
  if (!currentUser) { toast("Please log in first"); return; }
  const slug        = currentUser.uid.substr(0,8);
  const htmlContent = generateFullPage();
  if (htmlContent.length > 900000) { toast("Project too large — reduce image sizes"); return; }
  try {
    toast("Publishing…");
    await setDoc(doc(db,"published_sites",slug), {
      uid: currentUser.uid, slug,
      elements: JSON.stringify(elements),
      html: htmlContent,
      title: "My Site",
      updatedAt: serverTimestamp(),
    });
    const url = `${location.origin}/viewer.html?id=${slug}`;
    showShareModal(url);
    toast("Published! ✓");
  } catch(err) { console.error(err); toast("Publish failed: "+err.message); }
}
window.publishProject = publishProject;

function showShareModal(url) {
  document.getElementById("shareModal")?.remove();
  const modal = document.createElement("div");
  modal.id = "shareModal";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px";
  modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:480px;width:100%">
      <h3 style="margin:0 0 8px;font-size:16px;color:var(--text);display:flex;align-items:center;gap:8px">
        <i class="bi bi-check-circle-fill" style="color:#22c55e"></i> Published!
      </h3>
      <p style="color:var(--text2);font-size:13px;margin:0 0 16px">Your site is live. Share this link:</p>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <input value="${url}" readonly style="flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-size:13px"/>
        <button onclick="navigator.clipboard.writeText('${url}').then(()=>window.toast('Copied!'))"
          style="padding:10px 16px;background:var(--accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;white-space:nowrap">
          Copy
        </button>
      </div>
      <div style="display:flex;gap:8px">
        <a href="${url}" target="_blank"
          style="flex:1;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;text-align:center;text-decoration:none;color:var(--text);font-size:13px">
          Open Site
        </a>
        <button onclick="document.getElementById('shareModal').remove()"
          style="flex:1;padding:10px;background:none;border:1px solid var(--border);border-radius:8px;cursor:pointer;color:var(--text);font-size:13px">
          Close
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// =========================================================
// STORAGE
// =========================================================
function saveToStorage() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({version:3,elements})); } catch(e){}
}

async function loadFromFirebase() {
  try {
    // Load local project first
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw) {
      const proj = JSON.parse(raw);

      elements = proj.elements || [];
      zCounter = Math.max(
        zCounter,
        ...elements.map(e => e.z || 0)
      );

      renderAllElements();
      updateLayersPanel();
      updateEmptyHint();
      pushHistory();

      toast("Local project loaded ✓");
      return;
    }

    // No local project, load published version
    if (!currentUser) return;

    const snap = await getDoc(
      doc(db, "published_sites", currentUser.uid.substr(0, 8))
    );

    if (snap.exists() && snap.data().elements) {
      elements = JSON.parse(snap.data().elements);

      zCounter = Math.max(
        zCounter,
        ...elements.map(e => e.z || 0)
      );

      renderAllElements();
      updateLayersPanel();
      updateEmptyHint();
      pushHistory();

      toast("Published project loaded ✓");
    }

  } catch (e) {
    console.error(e);
    loadFromLocalStorage();
  }
}
// =========================================================
// TOAST
// =========================================================
function toast(msg) {
  const t=document.getElementById("toast");if(!t)return;
  t.textContent=msg;t.classList.add("show");
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("show"),2200);
}
window.toast = toast;

setInterval(()=>{ if(elements.length>0)saveToStorage(); },30000);
