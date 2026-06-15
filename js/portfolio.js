import { db } from './firebase.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const themeColors = {
  violet: '#5b4cf5', ocean: '#0ea5e9', forest: '#10b981',
  sunset: '#f97316', rose: '#f43f5e', slate: '#475569'
};

function hexToRgba(hex, alpha) {
  const num = parseInt(hex.slice(1), 16);
  return `rgba(${num >> 16}, ${num >> 8 & 0xff}, ${num & 0xff}, ${alpha})`;
}
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function loadPortfolio() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if (!slug) { showNotFound(); return; }

  try {
    const q = query(collection(db, 'portfolios'), where('portfolioSlug', '==', slug));
    const snap = await getDocs(q);
    if (snap.empty) { showNotFound(); return; }

    const data = snap.docs[0].data();
    renderPortfolio(data);
  } catch (err) {
    console.error('Error loading portfolio:', err);
    showNotFound();
  }
}

function showNotFound() {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('notFound').style.display = 'flex';
}

function renderPortfolio(data) {
  const themeColor = themeColors[data.theme] || themeColors.violet;

  // Set CSS variable
  document.documentElement.style.setProperty('--theme', themeColor);

  // Apply theme to header background
  const header = document.getElementById('portHeader');
  header.style.background = `linear-gradient(160deg, ${themeColor}, ${shadeColor(themeColor, -20)})`;

  // Update page title
  if (data.fullName) document.title = `${data.fullName} — Portfolio`;

  // Meta description
  if (data.about) {
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = data.about.slice(0, 150);
  }

  // Avatar
  const initial = (data.fullName || '?').charAt(0).toUpperCase();
  document.getElementById('portAvatarInitials').textContent = initial;
  if (data.profileImage) {
    const img = document.getElementById('portAvatarImg');
    img.src = data.profileImage;
    img.alt = data.fullName || '';
    img.style.display = 'block';
    document.getElementById('portAvatarInitials').style.display = 'none';
  }

  // Name + title
  document.getElementById('portName').textContent = data.fullName || '';
  document.getElementById('portTitle').textContent = data.title || '';

  // Social links
  const social = document.getElementById('portSocial');
  const links = [];
  if (data.socialLinks?.github) links.push({ label: 'GitHub', url: data.socialLinks.github, icon: '🔗' });
  if (data.socialLinks?.linkedin) links.push({ label: 'LinkedIn', url: data.socialLinks.linkedin, icon: '💼' });
  if (data.socialLinks?.twitter) links.push({ label: 'Twitter', url: data.socialLinks.twitter, icon: '🐦' });
  if (data.socialLinks?.website) links.push({ label: 'Website', url: data.socialLinks.website, icon: '🌐' });
  social.innerHTML = links.map(l =>
    `<a href="${escHtml(l.url)}" target="_blank" rel="noopener noreferrer" class="social-link">${l.icon} ${l.label}</a>`
  ).join('');

  // About
  if (data.about) {
    document.getElementById('aboutSection').style.display = 'block';
    document.getElementById('portAbout').textContent = data.about;
    document.getElementById('aboutLabel').style.color = themeColor;
  }

  // Skills
  if (data.skills && data.skills.length) {
    document.getElementById('skillsSection').style.display = 'block';
    document.getElementById('skillsLabel').style.color = themeColor;
    document.getElementById('portSkills').innerHTML = data.skills.map(s =>
      `<span class="port-skill" style="background:${hexToRgba(themeColor,0.1)};color:${themeColor};">${escHtml(s)}</span>`
    ).join('');
  }

  // Projects
  if (data.projects && data.projects.length) {
    document.getElementById('projectsSection').style.display = 'block';
    document.getElementById('projectsLabel').style.color = themeColor;
    document.getElementById('portProjects').innerHTML = data.projects.map(p => `
      <div class="port-project">
        ${p.image ? `<img class="port-project-img" src="${escHtml(p.image)}" alt="${escHtml(p.name || '')}" loading="lazy" />` : ''}
        <div class="port-project-body">
          <div class="port-project-title">${escHtml(p.name || 'Untitled Project')}</div>
          ${p.description ? `<p class="port-project-desc">${escHtml(p.description)}</p>` : ''}
          ${p.url ? `<a href="${escHtml(p.url)}" target="_blank" rel="noopener noreferrer" class="port-project-link" style="color:${themeColor};">View project →</a>` : ''}
        </div>
      </div>
    `).join('');
  }

  // Contact
  const contactItems = [];
  if (data.contactInfo?.email) contactItems.push(`<div class="contact-item">📧 <a href="mailto:${escHtml(data.contactInfo.email)}">${escHtml(data.contactInfo.email)}</a></div>`);
  if (data.contactInfo?.location) contactItems.push(`<div class="contact-item">📍 ${escHtml(data.contactInfo.location)}</div>`);
  if (contactItems.length) {
    document.getElementById('contactSection').style.display = 'block';
    document.getElementById('contactLabel').style.color = themeColor;
    document.getElementById('portContact').innerHTML = contactItems.join('');
  }

  // Show content
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('portfolioContent').style.display = 'block';
}

function shadeColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt, G = (num >> 8 & 0x00FF) + amt, B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (G<255?G<1?0:G:255)*0x100 + (B<255?B<1?0:B:255)).toString(16).slice(1);
}

loadPortfolio();
