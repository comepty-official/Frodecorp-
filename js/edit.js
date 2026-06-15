// =========================================================
// edit.js — Frodecorp Builder  v4
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
let elements      = [];
let selectedId    = null;
let history       = [];
let histIdx       = -1;
let zCounter      = 100;
let dragInfo      = null;
let resizeInfo    = null;
let snapEnabled   = true;
let gridVisible   = false;
let ctxTargetId   = null;
let activeCodeTab = "html";
let zoom          = 1;
let currentDevice = "desktop";

const STORAGE_KEY = "frodecorp_v4";
const SNAP_GRID   = 10;
const MIN_ZOOM    = 0.3;
const MAX_ZOOM    = 2.5;

// Canvas widths per device
const DEVICE_WIDTHS = { desktop: 1200, tablet: 768, mobile: 390 };

let canvas, canvasArea, canvasWrap;

// =========================================================
// ELEMENT DEFINITIONS
// =========================================================
const ELEMENT_DEFS = {
  // Basic
  text:        { icon:"bi-fonts",                label:"Text",          cat:"Basic",      w:220,  h:50  },
  heading:     { icon:"bi-type-h1",              label:"Heading",       cat:"Basic",      w:300,  h:60  },
  paragraph:   { icon:"bi-text-paragraph",       label:"Paragraph",     cat:"Basic",      w:400,  h:100 },
  button:      { icon:"bi-square",               label:"Button",        cat:"Basic",      w:140,  h:44  },
  link:        { icon:"bi-link-45deg",           label:"Link",          cat:"Basic",      w:120,  h:36  },
  badge:       { icon:"bi-tag-fill",             label:"Badge",         cat:"Basic",      w:80,   h:30  },
  divider:     { icon:"bi-dash-lg",              label:"Divider",       cat:"Basic",      w:400,  h:4   },
  spacer:      { icon:"bi-distribute-vertical",  label:"Spacer",        cat:"Basic",      w:400,  h:40  },
  icon:        { icon:"bi-star",                 label:"Icon",          cat:"Basic",      w:60,   h:60  },
  // Media
  image:       { icon:"bi-image",                label:"Image",         cat:"Media",      w:300,  h:200 },
  video:       { icon:"bi-camera-video",         label:"Video",         cat:"Media",      w:400,  h:250 },
  gallery:     { icon:"bi-images",               label:"Gallery",       cat:"Media",      w:500,  h:300 },
  map:         { icon:"bi-map",                  label:"Map Embed",     cat:"Media",      w:500,  h:300 },
  // Layout
  header:      { icon:"bi-border-top",           label:"Header",        cat:"Layout",     w:800,  h:70  },
  navbar:      { icon:"bi-menu-button-wide",     label:"Navbar",        cat:"Layout",     w:800,  h:56  },
  footer:      { icon:"bi-border-bottom",        label:"Footer",        cat:"Layout",     w:800,  h:90  },
  hero:        { icon:"bi-stars",                label:"Hero",          cat:"Layout",     w:800,  h:400 },
  section:     { icon:"bi-square-half",          label:"Section",       cat:"Layout",     w:800,  h:300 },
  container:   { icon:"bi-layout-three-columns", label:"Container",     cat:"Layout",     w:400,  h:200 },
  row:         { icon:"bi-layout-split",         label:"Row",           cat:"Layout",     w:600,  h:100 },
  column:      { icon:"bi-layout-wtf",           label:"Column",        cat:"Layout",     w:200,  h:200 },
  // Components
  card:        { icon:"bi-card-text",            label:"Card",          cat:"Components", w:280,  h:220 },
  testimonial: { icon:"bi-chat-quote",           label:"Testimonial",   cat:"Components", w:350,  h:180 },
  team:        { icon:"bi-people",               label:"Team Member",   cat:"Components", w:220,  h:280 },
  stats:       { icon:"bi-bar-chart",            label:"Stats Block",   cat:"Components", w:500,  h:120 },
  form:        { icon:"bi-ui-checks",            label:"Form",          cat:"Components", w:400,  h:320 },
  contact:     { icon:"bi-envelope",             label:"Contact",       cat:"Components", w:500,  h:350 },
  faq:         { icon:"bi-question-circle",      label:"FAQ",           cat:"Components", w:600,  h:280 },
  pricing:     { icon:"bi-tag",                  label:"Pricing",       cat:"Components", w:300,  h:380 },
  cta:         { icon:"bi-megaphone",            label:"CTA Block",     cat:"Components", w:700,  h:180 },
  countdown:   { icon:"bi-clock",                label:"Countdown",     cat:"Components", w:400,  h:120 },
  progress:    { icon:"bi-bar-chart-line",       label:"Progress Bar",  cat:"Components", w:400,  h:80  },
  // Advanced
  animation:   { icon:"bi-lightning",            label:"Animation",     cat:"Advanced",   w:200,  h:120 },
  html:        { icon:"bi-code-slash",           label:"Custom HTML",   cat:"Advanced",   w:400,  h:200 },
  social:      { icon:"bi-share",                label:"Social Links",  cat:"Advanced",   w:280,  h:50  },
};

const CATEGORIES = ["Basic","Media","Layout","Components","Advanced"];

// =========================================================
// TEMPLATES  (all use % of canvas width — auto-fit)
// =========================================================
const TEMPLATES = [
  { name:"Landing Page",  icon:"bi-house",       fn: applyLandingTemplate  },
  { name:"Portfolio",     icon:"bi-person",      fn: applyPortfolioTemplate},
  { name:"Blog Post",     icon:"bi-newspaper",   fn: applyBlogTemplate     },
  { name:"Product Page",  icon:"bi-bag",         fn: applyProductTemplate  },
  { name:"Agency",        icon:"bi-building",    fn: applyAgencyTemplate   },
  { name:"Restaurant",    icon:"bi-cup-hot",     fn: applyRestaurantTemplate},
  { name:"Startup",       icon:"bi-rocket",      fn: applyStartupTemplate  },
  { name:"Personal CV",   icon:"bi-person-badge",fn: applyCVTemplate       },
];

// Helper — x/y/w/h expressed as fraction of canvas width
function pct(fraction) { return Math.round(getCanvasWidth() * fraction); }
function getCanvasWidth() { return DEVICE_WIDTHS[currentDevice] || 1200; }

// Full-width element: x=pad, width = canvas - 2*pad
function fw(pad=0) { return { x: pad, w: getCanvasWidth() - pad*2 }; }

function applyLandingTemplate() {
  const cw = getCanvasWidth();
  addEl("navbar",  0,   0,  { ...fw(), text:"MyBrand · Home · About · Contact · Pricing" });
  addEl("hero",    0,   56, { ...fw(), h:Math.round(cw*.38), text:"Build Something Amazing", bgColor:"#1a1a2e", color:"#ffffff" });
  const heroH = Math.round(cw*.38);
  addEl("stats",   0,   56+heroH, { ...fw(), h:110 });
  addEl("section", 0,   56+heroH+110, { ...fw(), h:300, text:"Why Choose Us" });
  addEl("card",    pct(.03), 56+heroH+110+320, { w:pct(.29), h:220, text:"Fast" });
  addEl("card",    pct(.36), 56+heroH+110+320, { w:pct(.29), h:220, text:"Flexible" });
  addEl("card",    pct(.68), 56+heroH+110+320, { w:pct(.29), h:220, text:"Powerful" });
  addEl("cta",     0,   56+heroH+110+560, { ...fw(), h:180 });
  addEl("footer",  0,   56+heroH+110+560+200, { ...fw(), h:90, text:"© 2026 MyBrand. All rights reserved." });
  pushHistory();
}

function applyPortfolioTemplate() {
  const cw = getCanvasWidth();
  addEl("navbar",  0,  0,   { ...fw(), text:"Jane Doe · Work · About · Contact" });
  addEl("hero",    0,  56,  { ...fw(), h:Math.round(cw*.35), text:"Creative Designer & Developer", bgColor:"#0f0f13", color:"#6c63ff" });
  const heroH = Math.round(cw*.35);
  addEl("heading", pct(.03), 56+heroH+20, { w:pct(.5), h:50, text:"Selected Work", fontSize:28 });
  addEl("card",    pct(.03), 56+heroH+90, { w:pct(.3), h:230, text:"Brand Identity" });
  addEl("card",    pct(.36), 56+heroH+90, { w:pct(.3), h:230, text:"Web Design" });
  addEl("card",    pct(.68), 56+heroH+90, { w:pct(.3), h:230, text:"Motion" });
  addEl("testimonial", pct(.03), 56+heroH+340, { w:pct(.94), h:160 });
  addEl("contact", pct(.15), 56+heroH+530, { w:pct(.7), h:350 });
  addEl("footer",  0, 56+heroH+910, { ...fw(), h:90, text:"© 2026 Jane Doe. All rights reserved." });
  pushHistory();
}

function applyBlogTemplate() {
  const cw = getCanvasWidth();
  addEl("navbar",  0,   0,   { ...fw(), text:"MyBlog · Home · Articles · About" });
  addEl("heading", pct(.08), 70, { w:pct(.84), h:70, text:"The Future of Web Design", fontSize:Math.round(cw*.026) });
  addEl("text",    pct(.08), 150, { w:pct(.84), h:30, text:"Published June 2026 · 5 min read · Design" });
  addEl("image",   pct(.08), 190, { w:pct(.84), h:Math.round(cw*.3) });
  addEl("text",    pct(.08), 190+Math.round(cw*.3)+20, { w:pct(.84), h:100, text:"Web design is constantly evolving. New tools and workflows are changing the way we build for the web." });
  addEl("divider", pct(.08), 190+Math.round(cw*.3)+140, { w:pct(.84), h:4 });
  addEl("card",    pct(.08), 190+Math.round(cw*.3)+170, { w:pct(.29), h:180, text:"Related: UI Trends 2026" });
  addEl("card",    pct(.36), 190+Math.round(cw*.3)+170, { w:pct(.29), h:180, text:"Related: CSS Grid Tips" });
  addEl("card",    pct(.63), 190+Math.round(cw*.3)+170, { w:pct(.29), h:180, text:"Related: Motion Design" });
  addEl("footer",  0, 190+Math.round(cw*.3)+380, { ...fw(), h:90, text:"© 2026 MyBlog" });
  pushHistory();
}

function applyProductTemplate() {
  const cw = getCanvasWidth();
  const imgW = pct(.38);
  const detX = pct(.44);
  const detW = pct(.52);
  addEl("navbar",   0,  0, { ...fw(), text:"ShopBrand · Home · Products · Cart" });
  addEl("image",    pct(.03), 70, { w:imgW, h:Math.round(imgW*.8) });
  addEl("heading",  detX, 70, { w:detW, h:55, text:"Premium Product", fontSize:Math.round(cw*.022) });
  addEl("text",     detX, 135, { w:detW, h:40, text:"⭐⭐⭐⭐⭐  (128 reviews)", fontSize:13 });
  addEl("text",     detX, 180, { w:detW, h:44, text:"$99.00", fontSize:32, color:"#6c63ff" });
  addEl("text",     detX, 230, { w:detW, h:80, text:"High quality, carefully crafted for professionals who demand the best." });
  addEl("button",   detX, 320, { w:pct(.22), h:46, text:"Add to Cart", bgColor:"#6c63ff", color:"#fff", borderR:10 });
  addEl("button",   detX+pct(.23), 320, { w:pct(.22), h:46, text:"Buy Now", bgColor:"#22c55e", color:"#fff", borderR:10 });
  addEl("section",  0, 70+Math.round(imgW*.8)+20, { ...fw(), h:250, text:"Product Features" });
  addEl("footer",   0, 70+Math.round(imgW*.8)+290, { ...fw(), h:90, text:"© 2026 ShopBrand" });
  pushHistory();
}

function applyAgencyTemplate() {
  const cw = getCanvasWidth();
  addEl("navbar",  0,  0,  { ...fw(), text:"Agency · Services · Work · Team · Contact", bgColor:"#0a0a0f", color:"#ffffff" });
  addEl("hero",    0,  56, { ...fw(), h:Math.round(cw*.4), text:"We Build Digital Experiences", bgColor:"#0a0a0f", color:"#ffffff" });
  const hH = Math.round(cw*.4);
  addEl("stats",   0, 56+hH, { ...fw(), h:110 });
  addEl("heading", pct(.03), 56+hH+130, { w:pct(.5), h:55, text:"Our Services", fontSize:28 });
  addEl("card",    pct(.03), 56+hH+200, { w:pct(.29), h:200, text:"Brand Strategy" });
  addEl("card",    pct(.36), 56+hH+200, { w:pct(.29), h:200, text:"UI/UX Design" });
  addEl("card",    pct(.68), 56+hH+200, { w:pct(.29), h:200, text:"Development" });
  addEl("testimonial", pct(.03), 56+hH+420, { w:pct(.94), h:150 });
  addEl("team",    pct(.03), 56+hH+600, { w:pct(.2), h:260 });
  addEl("team",    pct(.26), 56+hH+600, { w:pct(.2), h:260 });
  addEl("team",    pct(.49), 56+hH+600, { w:pct(.2), h:260 });
  addEl("team",    pct(.72), 56+hH+600, { w:pct(.2), h:260 });
  addEl("cta",     0, 56+hH+890, { ...fw(), h:180 });
  addEl("footer",  0, 56+hH+1100, { ...fw(), h:90, text:"© 2026 Agency. All rights reserved." });
  pushHistory();
}

function applyRestaurantTemplate() {
  const cw = getCanvasWidth();
  addEl("navbar",  0,  0,  { ...fw(), text:"Bistro · Menu · Reservations · About · Contact", bgColor:"#1a0a00", color:"#f5deb3" });
  addEl("hero",    0,  56, { ...fw(), h:Math.round(cw*.38), text:"Fine Dining Experience", bgColor:"#1a0a00", color:"#f5deb3" });
  const hH = Math.round(cw*.38);
  addEl("heading", pct(.03), 56+hH+20, { w:pct(.5), h:55, text:"Our Menu", fontSize:28 });
  addEl("card",    pct(.03), 56+hH+90, { w:pct(.29), h:240, text:"Starters", bgColor:"#fff8f0" });
  addEl("card",    pct(.36), 56+hH+90, { w:pct(.29), h:240, text:"Mains", bgColor:"#fff8f0" });
  addEl("card",    pct(.68), 56+hH+90, { w:pct(.29), h:240, text:"Desserts", bgColor:"#fff8f0" });
  addEl("testimonial", pct(.03), 56+hH+360, { w:pct(.94), h:150 });
  addEl("contact", pct(.15), 56+hH+540, { w:pct(.7), h:320 });
  addEl("footer",  0, 56+hH+890, { ...fw(), h:90, text:"© 2026 Bistro. Reservations: +1 555 0100", bgColor:"#1a0a00", color:"#f5deb3" });
  pushHistory();
}

function applyStartupTemplate() {
  const cw = getCanvasWidth();
  addEl("navbar",  0,  0,  { ...fw(), text:"Launchpad · Product · Pricing · Blog · Sign Up", bgColor:"#0d0d1a", color:"#ffffff" });
  addEl("hero",    0,  56, { ...fw(), h:Math.round(cw*.42), text:"The Smarter Way to Launch", bgColor:"#0d0d1a", color:"#ffffff" });
  const hH = Math.round(cw*.42);
  addEl("stats",   0, 56+hH, { ...fw(), h:110 });
  addEl("section", 0, 56+hH+110, { ...fw(), h:280, text:"Product Features" });
  addEl("pricing", pct(.03), 56+hH+410, { w:pct(.29), h:380, text:"Free" });
  addEl("pricing", pct(.36), 56+hH+410, { w:pct(.29), h:380, text:"Pro" });
  addEl("pricing", pct(.68), 56+hH+410, { w:pct(.29), h:380, text:"Enterprise" });
  addEl("faq",     0, 56+hH+820, { ...fw(), h:300 });
  addEl("cta",     0, 56+hH+1140, { ...fw(), h:180 });
  addEl("footer",  0, 56+hH+1350, { ...fw(), h:90, text:"© 2026 Launchpad Inc." });
  pushHistory();
}

function applyCVTemplate() {
  const cw = getCanvasWidth();
  const sideW = pct(.28);
  const mainX = pct(.31);
  const mainW = pct(.66);
  addEl("header",  0,  0,  { ...fw(), h:90, text:"Your Full Name", bgColor:"#1a1a2e", color:"#ffffff" });
  addEl("text",    pct(.03), 100, { w:sideW, h:30, text:"hello@email.com · linkedin.com/in/you" });
  // Sidebar
  addEl("heading", pct(.03), 140, { w:sideW, h:40, text:"Skills", fontSize:16 });
  addEl("progress",pct(.03), 185, { w:sideW, h:70, text:"Design" });
  addEl("progress"),pct(.03), 265, { w:sideW, h:70, text:"Development" };
  addEl("heading", pct(.03), 350, { w:sideW, h:40, text:"Contact", fontSize:16 });
  addEl("contact", pct(.03), 395, { w:sideW, h:200 });
  // Main content
  addEl("heading", mainX, 140, { w:mainW, h:40, text:"Experience", fontSize:20 });
  addEl("card",    mainX, 185, { w:mainW, h:140, text:"Senior Designer · Acme Corp" });
  addEl("card",    mainX, 335, { w:mainW, h:140, text:"Designer · Cool Studio" });
  addEl("heading", mainX, 490, { w:mainW, h:40, text:"Education", fontSize:20 });
  addEl("card",    mainX, 535, { w:mainW, h:110, text:"B.A. Graphic Design · State University" });
  addEl("footer",  0, 670, { ...fw(), h:70, text:"© 2026 Your Name" });
  pushHistory();
}

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

  let ov = document.getElementById("panelOverlay");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "panelOverlay";
    document.body.appendChild(ov);
  }
  ov.addEventListener("click",    closeAllPanels);
  ov.addEventListener("touchend", closeAllPanels);
});

// =========================================================
// PANEL OPEN / CLOSE
// =========================================================
function openPanel(side) {
  const panel   = document.getElementById(side === "left" ? "leftPanel" : "rightPanel");
  const other   = document.getElementById(side === "left" ? "rightPanel" : "leftPanel");
  const overlay = document.getElementById("panelOverlay");
  if (window.innerWidth >= 768) return;
  other?.classList.remove("open");
  panel?.classList.add("open");
  if (overlay) { overlay.style.display = "block"; overlay.style.pointerEvents = "auto"; }
}
function closeAllPanels() {
  const overlay = document.getElementById("panelOverlay");
  document.getElementById("leftPanel")?.classList.remove("open");
  document.getElementById("rightPanel")?.classList.remove("open");
  if (overlay) { overlay.style.display = "none"; overlay.style.pointerEvents = "none"; }
}
function togglePanel(side) {
  if (window.innerWidth >= 768) return;
  const panel = document.getElementById(side === "left" ? "leftPanel" : "rightPanel");
  panel?.classList.contains("open") ? closeAllPanels() : openPanel(side);
}

// =========================================================
// BOTTOM BAR
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
// ZOOM
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
  canvasWrap.style.transform = `scale(${zoom})`;
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
      el.className = "tool-item";
      el.draggable = true;
      el.dataset.type = type;
      el.innerHTML = `<i class="bi ${def.icon}"></i>${def.label}`;
      el.addEventListener("dragstart", e => { e.dataTransfer.setData("element-type", type); e.dataTransfer.effectAllowed = "copy"; });
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
// TEMPLATES UI
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

// =========================================================
// ADD ELEMENT
// =========================================================
function addEl(type, x, y, opts = {}) {
  const def = ELEMENT_DEFS[type];
  if (!def) return null;
  const id   = genId();
  const cw   = getCanvasWidth();
  // Default w/h, but cap to canvas
  let dw = opts.w ?? def.w;
  let dh = opts.h ?? def.h;
  dw = Math.min(dw, cw - (opts.x ?? x));

  const data = {
    id, type,
    x: opts.x ?? x,
    y: opts.y ?? y,
    w: dw,
    h: dh,
    z: ++zCounter,
    locked: false, hidden: false,
    name: opts.name || (def.label + " " + (elements.length + 1)),
    props: {
      text:       opts.text       ?? getDefaultText(type),
      link:       opts.link       || "",
      src:        opts.src        || "",
      fontSize:   opts.fontSize   || getDefaultFontSize(type, cw),
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
      opacity:    opts.opacity    ?? 1,
      anim:       opts.anim       || "",
      animDur:    opts.animDur    || 1000,
      animDel:    opts.animDel    || 0,
      animIter:   opts.animIter   || "1",
      customCSS:  opts.customCSS  || "",
      customHTML: opts.customHTML || "",
    }
  };
  elements.push(data);
  renderOne(data);
  updateLayersPanel();
  updateEmptyHint();
  return data;
}

function getDefaultFontSize(t, cw) {
  const base = { heading:28, hero:36, header:22, navbar:16, footer:13, badge:11, progress:13, stats:14 };
  let size = base[t] || 15;
  // Scale slightly for smaller canvases
  if (cw <= 390) size = Math.max(12, Math.round(size * 0.78));
  else if (cw <= 768) size = Math.round(size * 0.9);
  return size;
}
function getDefaultText(t) {
  const m = {
    text:"Double-click to edit", heading:"Your Heading", paragraph:"Your paragraph text goes here. Double-click to edit.",
    button:"Click Me", link:"Click here", badge:"New",
    header:"Website Header", navbar:"Brand · Home · About · Contact", footer:"© 2026 Your Site",
    hero:"Bold Headline Here", section:"Section Content", container:"", row:"", column:"",
    icon:"★", card:"Card Title", testimonial:'"This product changed everything." – Jane D.',
    team:"Team Member", stats:"", form:"Contact Form", contact:"Get In Touch",
    faq:"Frequently Asked Questions", pricing:"Starter Plan", cta:"Ready to get started?",
    countdown:"", progress:"Skill Name", gallery:"Gallery", animation:"Animated",
    map:"", html:"<!-- Custom HTML -->", social:"", divider:"", spacer:"", image:"", video:""
  };
  return m[t] ?? "Element";
}
function getDefaultColor(t)   { return ["header","navbar","footer","hero","cta"].includes(t) ? "#ffffff" : "#1a1a2e"; }
function getDefaultBg(t) {
  const m = {
    header:"#1a1a2e", navbar:"#0f0f13", footer:"#1a1a2e", hero:"#6c63ff", button:"#6c63ff",
    image:"#e5e7eb", video:"#1f2937", card:"#ffffff", testimonial:"#f8f9fa",
    container:"rgba(108,99,255,.05)", section:"#f8f9fa", row:"transparent", column:"transparent",
    pricing:"#ffffff", form:"#f8f9fa", contact:"#f0f0f8", faq:"#ffffff",
    cta:"#6c63ff", stats:"#1a1a2e", team:"#ffffff", badge:"#6c63ff", progress:"#f0f0f8",
    social:"transparent", html:"#f8f9fa",
  };
  return m[t] || "transparent";
}
function getDefaultBorderR(t) { return ["button","card","testimonial","pricing","form","cta","badge","team","stats"].includes(t) ? 8 : 0; }
function getDefaultPad(t) {
  const m = { text:8, heading:10, paragraph:12, button:12, header:20, navbar:16, footer:20, hero:60, section:40, card:20, testimonial:24, form:24, contact:32, faq:24, pricing:24, cta:40, stats:20, team:20, badge:6, progress:16, html:12 };
  return m[t] || 0;
}

// =========================================================
// RENDER
// =========================================================
function renderOne(data) {
  const el = document.createElement("div");
  el.className = "editor-el";
  el.id = data.id;
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
  el.style.opacity      = p.opacity ?? 1;
  el.style.cursor       = data.locked ? "not-allowed" : "move";
  el.style.userSelect   = "none";
  el.style.overflow     = "hidden";
  el.style.boxSizing    = "border-box";
  el.style.touchAction  = "none";
  if (p.bgImg)    { el.style.backgroundImage = `url(${p.bgImg})`; el.style.backgroundSize = "cover"; el.style.backgroundPosition = "center"; }
  if (data.hidden){ el.style.opacity = ".3"; el.style.pointerEvents = "none"; }
  if (p.anim)     {
    el.style.animationName = p.anim; el.style.animationDuration = p.animDur+"ms";
    el.style.animationDelay = p.animDel+"ms"; el.style.animationFillMode = "both";
    el.style.animationIterationCount = p.animIter; el.style.animationTimingFunction = "ease-in-out";
  }
  if (selectedId === data.id) el.style.outline = "2px solid #6c63ff";
}

function setContent(el, data) {
  const p   = data.props;
  el.innerHTML = "";
  const css = `font-size:${p.fontSize}px;font-family:${p.fontFamily};font-weight:${p.fontWeight};color:${p.color};text-align:${p.align};`;

  switch (data.type) {
    case "text":
      el.style.display = "flex"; el.style.alignItems = "center";
      el.innerHTML = `<span style="${css}padding:4px;line-height:1.5">${p.text||""}</span>`;
      break;
    case "paragraph":
      el.style.display = "flex"; el.style.alignItems = "flex-start"; el.style.paddingTop = "8px";
      el.innerHTML = `<span style="${css}line-height:1.7">${p.text||""}</span>`;
      break;
    case "heading": case "column": case "row":
      el.style.display = "flex"; el.style.alignItems = "center";
      el.innerHTML = `<span style="${css}padding:4px;line-height:1.2">${p.text||""}</span>`;
      break;
    case "badge":
      el.style.display = "inline-flex"; el.style.alignItems = "center"; el.style.justifyContent = "center";
      el.style.borderRadius = "20px";
      el.innerHTML = `<span style="${css}letter-spacing:.04em;font-size:${Math.max(10,p.fontSize-2)}px">${p.text}</span>`;
      break;
    case "button":
      el.style.display = "flex"; el.style.alignItems = "center"; el.style.justifyContent = "center";
      el.innerHTML = `<button style="width:100%;height:100%;border:none;background:transparent;cursor:pointer;${css}letter-spacing:.02em">${p.text}</button>`;
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
      else { el.style.display="flex";el.style.alignItems="center";el.style.justifyContent="center";el.style.border="2px dashed #ccc";el.style.flexDirection="column";el.style.gap="6px";el.innerHTML=`<i class="bi bi-image" style="font-size:32px;color:#bbb"></i><span style="font-size:12px;color:#bbb">Upload or set URL</span>`; }
      break;
    case "video":
      if (p.src) { el.innerHTML=`<video src="${p.src}" style="width:100%;height:100%;object-fit:cover" controls></video>`; }
      else { el.style.display="flex";el.style.alignItems="center";el.style.justifyContent="center";el.style.flexDirection="column";el.style.gap="8px";el.style.background="#1f2937";el.innerHTML=`<i class="bi bi-camera-video" style="font-size:36px;color:#999"></i><span style="font-size:12px;color:#999">Set video URL in props</span>`; }
      break;
    case "gallery":
      el.style.display="grid";el.style.gridTemplateColumns="repeat(3,1fr)";el.style.gap="6px";
      for(let i=0;i<6;i++){const d=document.createElement("div");d.style.cssText="background:#e5e7eb;border-radius:4px;display:flex;align-items:center;justify-content:center;min-height:60px";d.innerHTML="<i class='bi bi-image' style='color:#bbb'></i>";el.appendChild(d);}
      break;
    case "map":
      el.style.display="flex";el.style.alignItems="center";el.style.justifyContent="center";el.style.border="2px dashed #ccc";el.style.flexDirection="column";el.style.gap="8px";
      el.innerHTML=`<i class="bi bi-map" style="font-size:32px;color:#bbb"></i><span style="font-size:12px;color:#bbb">Set embed URL in props</span>`;
      break;
    case "header":
      el.style.display="flex";el.style.alignItems="center";el.style.justifyContent="center";el.style.fontWeight="700";
      el.innerHTML=`<span style="${css}font-size:${Math.max(p.fontSize,18)}px;font-weight:700">${p.text}</span>`;
      break;
    case "navbar":
      el.style.display="flex";el.style.alignItems="center";el.style.justifyContent="space-between";
      const pts=(p.text||"").split("·").map(s=>s.trim());
      el.innerHTML=`<span style="font-weight:700;font-size:${p.fontSize}px;color:${p.color}">${pts[0]||"Brand"}</span>
        <nav style="display:flex;gap:16px;font-size:${Math.max(12,p.fontSize-2)}px">${pts.slice(1).map(l=>`<a href="#" onclick="return false" style="color:${p.color};text-decoration:none">${l}</a>`).join("")}</nav>
        <button style="background:${p.color};color:${p.bgColor};border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px">Menu</button>`;
      break;
    case "footer":
      el.style.display="flex";el.style.alignItems="center";el.style.justifyContent="center";el.style.textAlign="center";el.style.borderTop="1px solid rgba(255,255,255,.1)";
      el.innerHTML=`<span style="${css}font-size:${p.fontSize}px">${p.text}</span>`;
      break;
    case "hero":
      el.style.display="flex";el.style.flexDirection="column";el.style.alignItems="center";el.style.justifyContent="center";el.style.textAlign="center";
      if(p.bgImg){el.style.backgroundImage=`url(${p.bgImg})`;el.style.backgroundSize="cover";el.style.backgroundPosition="center";}
      el.innerHTML=`<h1 style="font-size:${p.fontSize}px;font-weight:700;color:${p.color};margin:0 0 14px;line-height:1.2">${p.text}</h1>
        <p style="font-size:${Math.round(p.fontSize*.52)}px;color:${p.color};opacity:.8;max-width:520px;margin:0 0 24px;line-height:1.6">Your compelling subtitle goes here.</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
          <button style="padding:12px 28px;border:none;border-radius:8px;background:#fff;color:${p.bgColor};font-weight:600;cursor:pointer;font-size:15px">Get Started</button>
          <button style="padding:12px 28px;border:2px solid rgba(255,255,255,.5);border-radius:8px;background:transparent;color:${p.color};cursor:pointer;font-size:15px">Learn More</button>
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
      el.style.display="flex";el.style.flexDirection="column";el.style.boxShadow="0 2px 12px rgba(0,0,0,.07)";
      el.innerHTML=`<div style="background:linear-gradient(135deg,#6c63ff22,#ff658422);height:90px;border-radius:6px 6px 0 0;display:flex;align-items:center;justify-content:center"><i class="bi bi-image" style="font-size:24px;color:#999"></i></div>
        <div style="padding:14px"><h4 style="${css}font-weight:600;margin:0 0 6px;font-size:${p.fontSize}px">${p.text}</h4><p style="font-size:${Math.max(11,p.fontSize-3)}px;color:#666;margin:0;line-height:1.5">Description text here.</p></div>`;
      break;
    case "testimonial":
      el.style.display="flex";el.style.flexDirection="column";el.style.justifyContent="space-between";el.style.boxShadow="0 2px 12px rgba(0,0,0,.06)";
      el.innerHTML=`<p style="${css}font-style:italic;margin:0 0 16px;line-height:1.6">${p.text}</p>
        <div style="display:flex;align-items:center;gap:10px"><div style="width:38px;height:38px;background:#6c63ff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;flex-shrink:0">J</div>
        <div><div style="font-weight:600;font-size:13px">Jane Doe</div><div style="font-size:11px;color:#999">CEO, Company</div></div></div>`;
      break;
    case "team":
      el.style.display="flex";el.style.flexDirection="column";el.style.alignItems="center";el.style.textAlign="center";el.style.boxShadow="0 2px 12px rgba(0,0,0,.07)";
      el.innerHTML=`<div style="width:80px;height:80px;background:linear-gradient(135deg,#6c63ff,#ff6584);border-radius:50%;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:28px;color:#fff;font-weight:700">A</div>
        <h4 style="font-weight:700;font-size:${p.fontSize}px;margin:0 0 4px;color:${p.color}">Alex Johnson</h4>
        <p style="font-size:12px;color:#6c63ff;margin:0 0 12px">Lead Designer</p>
        <p style="font-size:12px;color:#999;line-height:1.5;margin:0">Passionate about creating beautiful, functional digital experiences.</p>`;
      break;
    case "stats":
      el.style.display="flex";el.style.alignItems="center";el.style.justifyContent="space-around";
      const statsData=[{n:"10K+",l:"Users"},{n:"99%",l:"Uptime"},{n:"4.9★",l:"Rating"},{n:"24/7",l:"Support"}];
      el.innerHTML=statsData.map(s=>`<div style="text-align:center"><div style="font-size:${Math.round(p.fontSize*1.6)}px;font-weight:700;color:${p.color}">${s.n}</div><div style="font-size:12px;color:${p.color};opacity:.7">${s.l}</div></div>`).join("");
      break;
    case "form":
      el.innerHTML=`<h3 style="${css}font-weight:600;margin:0 0 16px">${p.text}</h3>
        <div style="display:flex;flex-direction:column;gap:10px">
          <input placeholder="Your Name" style="padding:9px 12px;border:1px solid #ddd;border-radius:7px;font-size:13px;width:100%;font-family:inherit"/>
          <input placeholder="Email" style="padding:9px 12px;border:1px solid #ddd;border-radius:7px;font-size:13px;width:100%;font-family:inherit"/>
          <textarea placeholder="Message" rows="3" style="padding:9px 12px;border:1px solid #ddd;border-radius:7px;font-size:13px;width:100%;resize:none;font-family:inherit"></textarea>
          <button style="padding:10px;background:#6c63ff;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:14px;font-weight:600">Send Message</button>
        </div>`;
      break;
    case "contact":
      el.innerHTML=`<h3 style="${css}font-weight:700;font-size:${Math.round(p.fontSize*1.4)}px;margin:0 0 8px">${p.text}</h3>
        <p style="color:#999;font-size:13px;margin:0 0 20px;line-height:1.5">We'd love to hear from you.</p>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="display:flex;align-items:center;gap:12px"><i class="bi bi-envelope" style="color:#6c63ff;font-size:18px;flex-shrink:0"></i><span style="font-size:13px">hello@example.com</span></div>
          <div style="display:flex;align-items:center;gap:12px"><i class="bi bi-telephone" style="color:#6c63ff;font-size:18px;flex-shrink:0"></i><span style="font-size:13px">+1 (555) 000-0000</span></div>
          <div style="display:flex;align-items:center;gap:12px"><i class="bi bi-geo-alt" style="color:#6c63ff;font-size:18px;flex-shrink:0"></i><span style="font-size:13px">New York, NY 10001</span></div>
        </div>`;
      break;
    case "faq":
      el.innerHTML=`<h3 style="${css}font-weight:700;font-size:${Math.round(p.fontSize*1.3)}px;margin:0 0 16px">${p.text}</h3>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${["What is this product?","How do I get started?","Is there a free plan?","Can I cancel anytime?"].map(q=>`
            <div style="border:1px solid #eee;border-radius:8px;padding:12px 14px">
              <div style="font-weight:600;font-size:13px;display:flex;justify-content:space-between;align-items:center">${q}<i class="bi bi-chevron-down" style="color:#6c63ff"></i></div>
              <div style="font-size:12px;color:#666;margin-top:8px;line-height:1.5">Click to expand this answer.</div>
            </div>`).join("")}
        </div>`;
      break;
    case "pricing":
      el.innerHTML=`<div style="text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#6c63ff;font-weight:700;margin-bottom:8px">Plan</div>
        <h3 style="${css}font-weight:700;font-size:${Math.round(p.fontSize*1.4)}px;margin:0 0 4px">${p.text}</h3>
        <div style="font-size:38px;font-weight:800;color:#6c63ff;margin:12px 0">$29<span style="font-size:16px;color:#999;font-weight:400">/mo</span></div>
        <div style="display:flex;flex-direction:column;gap:8px;text-align:left;margin:16px 0;padding:0 8px">
          ${["✓ Feature one","✓ Feature two","✓ Feature three","✓ Priority support"].map(f=>`<div style="font-size:13px;color:#444">${f}</div>`).join("")}
        </div>
        <button style="width:100%;padding:11px;background:#6c63ff;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px">Get Started</button>
      </div>`;
      break;
    case "cta":
      el.style.display="flex";el.style.flexDirection="column";el.style.alignItems="center";el.style.justifyContent="center";el.style.textAlign="center";
      el.innerHTML=`<h2 style="font-size:${p.fontSize}px;font-weight:700;color:${p.color};margin:0 0 12px;line-height:1.2">${p.text}</h2>
        <p style="font-size:${Math.round(p.fontSize*.62)}px;color:${p.color};opacity:.85;margin:0 0 20px">Start today. No credit card required.</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
          <button style="padding:12px 28px;border:none;border-radius:8px;background:#fff;color:#6c63ff;font-weight:700;cursor:pointer;font-size:14px">Start Free</button>
          <button style="padding:12px 28px;border:2px solid rgba(255,255,255,.6);border-radius:8px;background:transparent;color:${p.color};cursor:pointer;font-size:14px">Learn More</button>
        </div>`;
      break;
    case "countdown":
      el.style.display="flex";el.style.alignItems="center";el.style.justifyContent="center";el.style.gap="16px";
      el.innerHTML=["Days","Hours","Mins","Secs"].map(l=>`<div style="text-align:center"><div style="font-size:${Math.round(p.fontSize*2)}px;font-weight:700;color:${p.color}">00</div><div style="font-size:11px;color:${p.color};opacity:.7">${l}</div></div>`).join(`<div style="font-size:${Math.round(p.fontSize*2)}px;font-weight:700;color:${p.color};margin-bottom:14px">:</div>`);
      break;
    case "progress":
      el.style.display="flex";el.style.flexDirection="column";el.style.justifyContent="center";
      el.innerHTML=`<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:${p.fontSize}px;font-weight:600;color:${p.color}">${p.text}</span><span style="font-size:${p.fontSize}px;color:#6c63ff">80%</span></div>
        <div style="background:#e5e7eb;border-radius:8px;height:10px;overflow:hidden"><div style="background:linear-gradient(90deg,#6c63ff,#a78bfa);width:80%;height:100%;border-radius:8px"></div></div>`;
      break;
    case "social":
      el.style.display="flex";el.style.alignItems="center";el.style.gap="12px";
      el.innerHTML=["twitter","instagram","linkedin","github","youtube"].map(s=>`<a href="#" onclick="return false" style="width:36px;height:36px;background:#6c63ff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;text-decoration:none"><i class="bi bi-${s}"></i></a>`).join("");
      break;
    case "html":
      el.style.border="2px dashed #6c63ff33";el.style.borderRadius="4px";el.style.display="flex";el.style.alignItems="center";el.style.justifyContent="center";el.style.flexDirection="column";el.style.gap="6px";
      el.innerHTML=`<i class="bi bi-code-slash" style="font-size:28px;color:#6c63ff"></i><span style="font-size:12px;color:#6c63ff">Custom HTML block</span>`;
      break;
    case "animation":
      el.style.display="flex";el.style.alignItems="center";el.style.justifyContent="center";el.style.border="2px solid #6c63ff";el.style.borderRadius="8px";el.style.flexDirection="column";el.style.gap="8px";
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
  if (["text","heading","paragraph","button","header","footer","link","icon","section","card","badge","cta"].includes(data.type))
    inlineEdit(e.currentTarget, data);
}
function onElCtxMenu(e) { e.preventDefault(); e.stopPropagation(); ctxTargetId = e.currentTarget.id; showCtxMenu(e.clientX, e.clientY); }

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

function inlineEdit(el, data) {
  const input = document.createElement("input");
  input.type  = "text"; input.value = data.props.text;
  input.style.cssText = `position:absolute;inset:0;width:100%;height:100%;border:none;
    outline:2px solid #6c63ff;background:rgba(255,255,255,.96);
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
    if (data) { selectEl(data.id); pushHistory(); saveToStorage(); }
  }
  toolTouchGhost.remove();
  toolTouchGhost = null; toolTouchType = null;
  closeAllPanels();
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
    if (data) { selectEl(data.id); pushHistory(); saveToStorage(); }
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
  const pW=document.getElementById("pW"),pH=document.getElementById("pH");
  if(pW)pW.value=Math.round(nW);if(pH)pH.value=Math.round(nH);
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
   "pShadow","pOpacity","pAnim","pAnimDur","pAnimDel","pAnimIter","pCustomCSS"].forEach(id => {
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
    case "pText":      p.text=v;break;
    case "pLink":      p.link=v;break;
    case "pSrc":       p.src=v;if(data.type!=="video")p.bgImg=v;break;
    case "pFontFamily":p.fontFamily=v;break;
    case "pFontSize":  p.fontSize=+v;break;
    case "pFontWeight":p.fontWeight=v;break;
    case "pColor":     p.color=v;break;
    case "pBg":        p.bgColor=v;break;
    case "pBgImg":     p.bgImg=v;break;
    case "pW":         data.w=+v;break;
    case "pH":         data.h=+v;break;
    case "pX":         data.x=+v;break;
    case "pY":         data.y=+v;break;
    case "pPad":       p.padding=+v;break;
    case "pMargin":    p.margin=+v;break;
    case "pBordW":     p.borderW=+v;break;
    case "pBordR":     p.borderR=+v;break;
    case "pBordC":     p.borderC=v;break;
    case "pShadow":    p.shadow=v;break;
    case "pOpacity":   p.opacity=parseFloat(v);break;
    case "pAnim":      p.anim=v;break;
    case "pAnimDur":   p.animDur=+v;break;
    case "pAnimDel":   p.animDel=+v;break;
    case "pAnimIter":  p.animIter=v;break;
    case "pCustomCSS": p.customCSS=v;break;
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
  const isMedia=["image","video","map"].includes(data.type);
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
  set("pW",Math.round(data.w));set("pH",Math.round(data.h));
  set("pX",Math.round(data.x));set("pY",Math.round(data.y));
  set("pPad",p.padding||0);set("pMargin",p.margin||0);
  set("pBordW",p.borderW||0);set("pBordR",p.borderR||0);
  set("pBordC",p.borderC||"#000000");
  set("pShadow",p.shadow||"");
  set("pOpacity",p.opacity??1);
  set("pAnim",p.anim||"");
  set("pAnimDur",p.animDur||1000);
  set("pAnimDel",p.animDel||0);
  set("pAnimIter",p.animIter||"1");
  set("pCustomCSS",p.customCSS||"");
}
function updatePropXY(data) {
  const pX=document.getElementById("pX"),pY=document.getElementById("pY");
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
// ELEMENT ACTIONS
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
window.toggleVisibility     = ()=>{ if(selectedId) toggleVisibilityById(selectedId); };
window.toggleVisibilityById = (id)=>{ const d=getEl(id);if(!d)return;d.hidden=!d.hidden;refreshEl(id);updateLayersPanel();saveToStorage(); };
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
// BUTTONS / TABS
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
      currentDevice = btn.dataset.device;
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
  currentDevice = device;
  const w = DEVICE_WIDTHS[device] || 1200;
  canvas.style.width = w + "px";
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
    if(e.key==="ArrowUp"   &&selectedId)nudge(0,-(e.shiftKey?10:1));
    if(e.key==="ArrowDown" &&selectedId)nudge(0, (e.shiftKey?10:1));
    if(e.key==="ArrowLeft" &&selectedId)nudge(-(e.shiftKey?10:1),0);
    if(e.key==="ArrowRight"&&selectedId)nudge( (e.shiftKey?10:1),0);
  });
}
function nudge(dx,dy) {
  const data=getEl(selectedId),el=document.getElementById(selectedId);
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

// ── Core CSS for published pages ─────────────────────────
function generateCSS() {
  return `/* Frodecorp — Published Site */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
@import url('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css');
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Inter',sans-serif;overflow-x:hidden}

/* ── Animations ── */
@keyframes fade-in{from{opacity:0}to{opacity:1}}
@keyframes slide-in{from{transform:translateX(-40px);opacity:0}to{transform:none;opacity:1}}
@keyframes slide-up{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes zoom{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
@keyframes rotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}

/* ── Responsive canvas ── */
.fr-canvas{
  position:relative;
  width:100%;
  max-width:1200px;
  margin:0 auto;
  /* height set by JS below */
}

/* ── Each element: absolute in editor, fluid in viewer ── */
.fr-el{
  position:absolute;
  box-sizing:border-box;
  overflow:hidden;
}

/* ── Fluid overrides for small screens ── */
@media(max-width:767px){
  .fr-canvas{overflow-x:hidden}
  .fr-el{
    /* Convert px positions to % of 1200px design width */
    position:relative!important;
    left:auto!important;top:auto!important;
    width:100%!important;
    height:auto!important;
    min-height:var(--mh,auto);
    margin-bottom:12px;
  }
  .fr-el[data-type="navbar"] nav{display:none}
  .fr-el[data-type="hero"] h1{font-size:clamp(22px,6vw,36px)!important}
  .fr-el[data-type="hero"]{padding:40px 20px!important}
  .fr-el[data-type="stats"]{flex-wrap:wrap;gap:16px}
  .fr-el[data-type="stats"]>div{flex:1;min-width:80px}
}
@media(min-width:768px) and (max-width:1199px){
  .fr-el[data-type="hero"] h1{font-size:clamp(26px,3.5vw,48px)!important}
}

/* ── Responsive text ── */
.fr-el h1{line-height:1.15}
.fr-el p{line-height:1.6}
button{font-family:'Inter',sans-serif}
`;
}

// ── Build the published HTML ──────────────────────────────
function generateFullPage() {
  // Sort by z so layering is correct
  const sorted = [...elements].sort((a,b)=>a.z-b.z);

  // Canvas design width (the width used when the site was built)
  const designW = parseInt(canvas.style.width) || 1200;

  // Total canvas height = max bottom edge of all elements
  const canvasH = elements.length
    ? Math.max(...elements.map(e => e.y + e.h)) + 40
    : 600;

  // Build element HTML with data attributes for responsive JS
  const elsHTML = sorted.map(data => {
    const p = data.props;

    // Inline styles — same as editor
    const styles = [
      `position:absolute`,
      `left:${data.x}px`,`top:${data.y}px`,
      `width:${data.w}px`,`height:${data.h}px`,
      `z-index:${data.z}`,
      `color:${p.color}`,
      `background-color:${p.bgColor}`,
      `font-size:${p.fontSize}px`,
      `font-family:${p.fontFamily}`,
      `font-weight:${p.fontWeight}`,
      `text-align:${p.align}`,
      `padding:${p.padding}px`,
      `border-radius:${p.borderR}px`,
      p.borderW ? `border:${p.borderW}px solid ${p.borderC}` : "",
      p.shadow  ? `box-shadow:${p.shadow}` : "",
      p.opacity !== undefined && p.opacity !== 1 ? `opacity:${p.opacity}` : "",
      p.bgImg   ? `background-image:url(${p.bgImg});background-size:cover;background-position:center` : "",
      p.anim    ? `animation:${p.anim} ${p.animDur}ms ${p.animDel}ms ${p.animIter} ease-in-out both` : "",
      `--mh:${data.h}px`,
    ].filter(Boolean).join(";");

    const innerHTML = buildElHTML(data);
    return `<div class="fr-el" data-type="${data.type}" style="${styles}">${innerHTML}</div>`;
  }).join("\n  ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="generator" content="Frodecorp Builder"/>
<title>My Website</title>
<style>
${generateCSS()}
</style>
</head>
<body>
<div class="fr-canvas" id="frCanvas" style="height:${canvasH}px" data-design-w="${designW}">
  ${elsHTML}
</div>
<script>
// ── Responsive scaling for published pages ────────────────
(function(){
  var canvas   = document.getElementById("frCanvas");
  var designW  = parseInt(canvas.dataset.designW) || 1200;

  function scale(){
    var vw = window.innerWidth;
    if(vw >= designW){
      // Full size — just centre it
      canvas.style.transform = "";
      canvas.style.transformOrigin = "";
      canvas.style.width = designW + "px";
      canvas.style.marginLeft = "auto";
      canvas.style.marginRight = "auto";
      return;
    }
    // Scale down proportionally — site looks IDENTICAL but smaller
    var ratio = vw / designW;
    canvas.style.transform = "scale(" + ratio + ")";
    canvas.style.transformOrigin = "top left";
    canvas.style.width = designW + "px";
    canvas.style.marginLeft = "0";
    // Collapse the scaled height so there's no gap
    var ch = parseInt(canvas.style.height) || canvas.offsetHeight;
    canvas.parentElement.style.minHeight = Math.ceil(ch * ratio) + "px";
  }

  scale();
  window.addEventListener("resize", scale);
})();
<\/script>
</body>
</html>`;
}

// Build rich inner HTML for each element (mirrors setContent but for static output)
function buildElHTML(data) {
  const p   = data.props;
  const css = `font-size:${p.fontSize}px;font-family:${p.fontFamily};font-weight:${p.fontWeight};color:${p.color};text-align:${p.align};`;

  switch(data.type){
    case "text":
      return `<span style="${css}padding:4px;line-height:1.5">${p.text||""}</span>`;
    case "paragraph":
      return `<span style="${css}line-height:1.7">${p.text||""}</span>`;
    case "heading": case "column": case "row":
      return `<span style="${css}padding:4px;line-height:1.2">${p.text||""}</span>`;
    case "badge":
      return `<span style="${css}letter-spacing:.04em">${p.text}</span>`;
    case "button":
      return `<a href="${p.link||"#"}" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;text-decoration:none;${css}letter-spacing:.02em">${p.text}</a>`;
    case "link":
      return `<a href="${p.link||"#"}" style="text-decoration:underline;${css}">${p.text}</a>`;
    case "divider":
      return `<hr style="width:100%;border:none;border-top:2px solid ${p.color||"#ccc"};margin:0"/>`;
    case "spacer": return "";
    case "icon":
      return `<span style="font-size:${p.fontSize||32}px;color:${p.color}">${p.text||"★"}</span>`;
    case "image":
      return p.src ? `<img src="${p.src}" style="width:100%;height:100%;object-fit:cover" alt=""/>` : "";
    case "video":
      return p.src ? `<video src="${p.src}" style="width:100%;height:100%;object-fit:cover" controls></video>` : "";
    case "gallery":
      return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:100%;height:100%">${Array(6).fill(`<div style="background:#e5e7eb;border-radius:4px"></div>`).join("")}</div>`;
    case "map":
      return p.src ? `<iframe src="${p.src}" style="width:100%;height:100%;border:none" allowfullscreen loading="lazy"></iframe>` : "";
    case "header":
      return `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%"><span style="${css}font-size:${Math.max(p.fontSize,18)}px;font-weight:700">${p.text}</span></div>`;
    case "navbar":
      const pts=(p.text||"").split("·").map(s=>s.trim());
      return `<div style="display:flex;align-items:center;justify-content:space-between;width:100%;height:100%;padding:0 ${p.padding}px">
        <span style="font-weight:700;font-size:${p.fontSize}px;color:${p.color}">${pts[0]||"Brand"}</span>
        <nav style="display:flex;gap:16px;font-size:${Math.max(12,p.fontSize-2)}px">${pts.slice(1).map(l=>`<a href="#" style="color:${p.color};text-decoration:none">${l}</a>`).join("")}</nav>
        <button style="background:${p.color};color:${p.bgColor};border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit">Menu</button>
      </div>`;
    case "footer":
      return `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-top:1px solid rgba(255,255,255,.1)"><span style="${css}">${p.text}</span></div>`;
    case "hero":
      const hBg = p.bgImg ? `background-image:url(${p.bgImg});background-size:cover;background-position:center;` : "";
      return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;width:100%;height:100%;${hBg}">
        <h1 style="font-size:${p.fontSize}px;font-weight:700;color:${p.color};margin:0 0 14px;line-height:1.2">${p.text}</h1>
        <p style="font-size:${Math.round(p.fontSize*.52)}px;color:${p.color};opacity:.8;max-width:520px;margin:0 0 24px;line-height:1.6">Your compelling subtitle.</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
          <a href="#" style="padding:12px 28px;border:none;border-radius:8px;background:#fff;color:${p.bgColor};font-weight:600;text-decoration:none;font-size:15px;display:inline-block">Get Started</a>
          <a href="#" style="padding:12px 28px;border:2px solid rgba(255,255,255,.5);border-radius:8px;background:transparent;color:${p.color};text-decoration:none;font-size:15px;display:inline-block">Learn More</a>
        </div>
      </div>`;
    case "section":
      const sBg = p.bgImg ? `background-image:url(${p.bgImg});background-size:cover;background-position:center;` : "";
      return `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;${sBg}"><span style="${css}">${p.text}</span></div>`;
    case "container":
      return `<div style="width:100%;height:100%;border:2px dashed rgba(108,99,255,.3);border-radius:4px"></div>`;
    case "card":
      return `<div style="display:flex;flex-direction:column;width:100%;height:100%;box-shadow:0 2px 12px rgba(0,0,0,.07)">
        <div style="background:linear-gradient(135deg,#6c63ff22,#ff658422);height:90px;border-radius:6px 6px 0 0;display:flex;align-items:center;justify-content:center"></div>
        <div style="padding:14px;flex:1">
          <h4 style="${css}font-weight:600;margin:0 0 6px">${p.text}</h4>
          <p style="font-size:${Math.max(11,p.fontSize-3)}px;color:#666;margin:0;line-height:1.5">Description text here.</p>
        </div>
      </div>`;
    case "testimonial":
      return `<div style="display:flex;flex-direction:column;justify-content:space-between;width:100%;height:100%">
        <p style="${css}font-style:italic;margin:0 0 16px;line-height:1.6">${p.text}</p>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:38px;height:38px;background:#6c63ff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;flex-shrink:0">J</div>
          <div><div style="font-weight:600;font-size:13px">Jane Doe</div><div style="font-size:11px;color:#999">CEO, Company</div></div>
        </div>
      </div>`;
    case "team":
      return `<div style="display:flex;flex-direction:column;align-items:center;text-align:center;width:100%;padding-top:20px">
        <div style="width:80px;height:80px;background:linear-gradient(135deg,#6c63ff,#ff6584);border-radius:50%;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:28px;color:#fff;font-weight:700">A</div>
        <h4 style="font-weight:700;font-size:${p.fontSize}px;margin:0 0 4px;color:${p.color}">Alex Johnson</h4>
        <p style="font-size:12px;color:#6c63ff;margin:0 0 10px">Lead Designer</p>
        <p style="font-size:12px;color:#999;line-height:1.5">Passionate about creating beautiful digital experiences.</p>
      </div>`;
    case "stats":
      const sd=[{n:"10K+",l:"Users"},{n:"99%",l:"Uptime"},{n:"4.9★",l:"Rating"},{n:"24/7",l:"Support"}];
      return `<div style="display:flex;align-items:center;justify-content:space-around;width:100%;height:100%">${sd.map(s=>`<div style="text-align:center"><div style="font-size:${Math.round(p.fontSize*1.6)}px;font-weight:700;color:${p.color}">${s.n}</div><div style="font-size:12px;color:${p.color};opacity:.7">${s.l}</div></div>`).join("")}</div>`;
    case "form":
      return `<div style="width:100%;height:100%">
        <h3 style="${css}font-weight:600;margin:0 0 14px">${p.text}</h3>
        <div style="display:flex;flex-direction:column;gap:10px">
          <input placeholder="Your Name" style="padding:9px 12px;border:1px solid #ddd;border-radius:7px;font-size:13px;width:100%;font-family:inherit"/>
          <input placeholder="Email" style="padding:9px 12px;border:1px solid #ddd;border-radius:7px;font-size:13px;width:100%;font-family:inherit"/>
          <textarea placeholder="Message" rows="3" style="padding:9px 12px;border:1px solid #ddd;border-radius:7px;font-size:13px;width:100%;resize:none;font-family:inherit"></textarea>
          <button style="padding:10px;background:#6c63ff;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:14px;font-weight:600;font-family:inherit">Send Message</button>
        </div>
      </div>`;
    case "contact":
      return `<div>
        <h3 style="${css}font-weight:700;font-size:${Math.round(p.fontSize*1.4)}px;margin:0 0 8px">${p.text}</h3>
        <p style="color:#999;font-size:13px;margin:0 0 20px">We'd love to hear from you.</p>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="display:flex;align-items:center;gap:12px"><span style="color:#6c63ff;font-size:18px">✉</span><span style="font-size:13px">hello@example.com</span></div>
          <div style="display:flex;align-items:center;gap:12px"><span style="color:#6c63ff;font-size:18px">☎</span><span style="font-size:13px">+1 (555) 000-0000</span></div>
          <div style="display:flex;align-items:center;gap:12px"><span style="color:#6c63ff;font-size:18px">📍</span><span style="font-size:13px">New York, NY 10001</span></div>
        </div>
      </div>`;
    case "faq":
      return `<div>
        <h3 style="${css}font-weight:700;font-size:${Math.round(p.fontSize*1.3)}px;margin:0 0 14px">${p.text}</h3>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${["What is this product?","How do I get started?","Is there a free plan?","Can I cancel anytime?"].map(q=>`
          <div style="border:1px solid #eee;border-radius:8px;padding:12px 14px">
            <div style="font-weight:600;font-size:13px">${q}</div>
            <div style="font-size:12px;color:#666;margin-top:6px;line-height:1.5">Click to expand this answer.</div>
          </div>`).join("")}
        </div>
      </div>`;
    case "pricing":
      return `<div style="text-align:center;width:100%;padding:4px">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#6c63ff;font-weight:700;margin-bottom:8px">Plan</div>
        <h3 style="${css}font-weight:700;font-size:${Math.round(p.fontSize*1.4)}px;margin:0 0 4px">${p.text}</h3>
        <div style="font-size:38px;font-weight:800;color:#6c63ff;margin:12px 0">$29<span style="font-size:16px;color:#999;font-weight:400">/mo</span></div>
        <div style="display:flex;flex-direction:column;gap:8px;text-align:left;margin:16px 0 20px;padding:0 8px">
          ${["✓ Feature one","✓ Feature two","✓ Feature three","✓ Priority support"].map(f=>`<div style="font-size:13px;color:#444">${f}</div>`).join("")}
        </div>
        <a href="#" style="display:block;padding:11px;background:#6c63ff;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;text-decoration:none;text-align:center">Get Started</a>
      </div>`;
    case "cta":
      return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;width:100%;height:100%">
        <h2 style="font-size:${p.fontSize}px;font-weight:700;color:${p.color};margin:0 0 12px;line-height:1.2">${p.text}</h2>
        <p style="font-size:${Math.round(p.fontSize*.62)}px;color:${p.color};opacity:.85;margin:0 0 20px">Start today. No credit card required.</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
          <a href="#" style="padding:12px 28px;border:none;border-radius:8px;background:#fff;color:#6c63ff;font-weight:700;text-decoration:none;font-size:14px;display:inline-block">Start Free</a>
          <a href="#" style="padding:12px 28px;border:2px solid rgba(255,255,255,.6);border-radius:8px;background:transparent;color:${p.color};text-decoration:none;font-size:14px;display:inline-block">Learn More</a>
        </div>
      </div>`;
    case "countdown":
      return `<div style="display:flex;align-items:center;justify-content:center;gap:16px;width:100%;height:100%">${["Days","Hours","Mins","Secs"].map(l=>`<div style="text-align:center"><div style="font-size:${Math.round(p.fontSize*2)}px;font-weight:700;color:${p.color}">00</div><div style="font-size:11px;color:${p.color};opacity:.7">${l}</div></div>`).join(`<div style="font-size:${Math.round(p.fontSize*2)}px;font-weight:700;color:${p.color};margin-bottom:14px">:</div>`)}</div>`;
    case "progress":
      return `<div style="width:100%">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:${p.fontSize}px;font-weight:600;color:${p.color}">${p.text}</span><span style="font-size:${p.fontSize}px;color:#6c63ff">80%</span></div>
        <div style="background:#e5e7eb;border-radius:8px;height:10px;overflow:hidden"><div style="background:linear-gradient(90deg,#6c63ff,#a78bfa);width:80%;height:100%;border-radius:8px"></div></div>
      </div>`;
    case "social":
      return `<div style="display:flex;align-items:center;gap:12px">
        ${["twitter","instagram","linkedin","github","youtube"].map(s=>`<a href="#" style="width:36px;height:36px;background:#6c63ff;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;text-decoration:none;font-size:16px">✦</a>`).join("")}
      </div>`;
    case "html":
      return p.customHTML || "";
    case "animation":
      return `<div style="display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;width:100%;height:100%;border:2px solid #6c63ff;border-radius:8px"><span style="font-size:28px">⚡</span><span style="font-size:13px;color:#6c63ff">${p.text}</span></div>`;
    default:
      return `<span style="${css}">${p.text||""}</span>`;
  }
}

function generateHTML() {
  const sorted = [...elements].sort((a,b)=>a.z-b.z);
  return sorted.map(data => {
    const p=data.props;
    const s=[`position:absolute`,`left:${data.x}px`,`top:${data.y}px`,`width:${data.w}px`,`height:${data.h}px`,`z-index:${data.z}`,`color:${p.color}`,`background-color:${p.bgColor}`,`font-size:${p.fontSize}px`,`font-family:${p.fontFamily}`,`font-weight:${p.fontWeight}`,`text-align:${p.align}`,`padding:${p.padding}px`,`border-radius:${p.borderR}px`,p.borderW?`border:${p.borderW}px solid ${p.borderC}`:"",p.shadow?`box-shadow:${p.shadow}`:"",p.bgImg?`background-image:url(${p.bgImg});background-size:cover;background-position:center`:"",p.anim?`animation:${p.anim} ${p.animDur}ms ${p.animDel}ms ${p.animIter} ease-in-out both`:""].filter(Boolean).join(";");
    return `<div data-type="${data.type}" style="${s}">${buildElHTML(data)}</div>`;
  }).join("\n");
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
function openPreview()  {
  const f=document.getElementById("previewFrame");
  if(f) f.srcdoc = generateFullPage();
  document.getElementById("previewModal")?.classList.add("open");
}
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
      uid:       currentUser.uid,
      slug,
      elements:  JSON.stringify(elements),
      html:      htmlContent,
      title:     "My Site",
      updatedAt: serverTimestamp(),
    });
    // Build viewer URL relative to where edit.html is hosted
    // Works on GitHub Pages, localhost, subdirectories — anywhere
    const basePath = location.href.substring(0, location.href.lastIndexOf("/") + 1);
    const url = `${basePath}viewer.html?id=${slug}`;
    showShareModal(url);
    toast("Published! ✓");
  } catch(err) {
    console.error(err);
    toast("Publish failed: "+err.message);
  }
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
        <span style="color:#22c55e;font-size:20px">✓</span> Published!
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
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({version:4,elements,device:currentDevice})); } catch(e){}
}

async function loadFromFirebase() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const proj = JSON.parse(raw);
      elements = proj.elements || [];
      zCounter = Math.max(zCounter, ...elements.map(e => e.z || 0));
      if (proj.device) { currentDevice = proj.device; setCanvasWidth(proj.device); }
      renderAllElements();
      updateLayersPanel();
      updateEmptyHint();
      pushHistory();
      toast("Project loaded ✓");
      return;
    }
    if (!currentUser) return;
    const snap = await getDoc(doc(db,"published_sites",currentUser.uid.substr(0,8)));
    if (snap.exists() && snap.data().elements) {
      elements = JSON.parse(snap.data().elements);
      zCounter = Math.max(zCounter, ...elements.map(e => e.z || 0));
      renderAllElements();
      updateLayersPanel();
      updateEmptyHint();
      pushHistory();
      toast("Published project loaded ✓");
    }
  } catch(e) {
    console.error(e);
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

setInterval(()=>{ if(elements.length>0)saveToStorage(); }, 30000);