import { auth, db, storage } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const loadingScreen = document.getElementById('loadingScreen');
const appContent = document.getElementById('appContent');

let currentUser = null;
let skills = [];
let projects = [];
let selectedTheme = 'violet';
let avatarFile = null;
let currentAvatarUrl = '';

const themeColors = {
  violet: '#5b4cf5', ocean: '#0ea5e9', forest: '#10b981',
  sunset: '#f97316', rose: '#f43f5e', slate: '#475569'
};

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'login.html'; return; }
  currentUser = user;

  // Load existing portfolio if any
  try {
    const snap = await getDoc(doc(db, 'portfolios', user.uid));
    if (snap.exists()) {
      const data = snap.data();
      document.getElementById('fullName').value = data.fullName || '';
      document.getElementById('title').value = data.title || '';
      document.getElementById('slug').value = data.portfolioSlug || '';
      document.getElementById('about').value = data.about || '';
      document.getElementById('github').value = data.socialLinks?.github || '';
      document.getElementById('linkedin').value = data.socialLinks?.linkedin || '';
      document.getElementById('twitter').value = data.socialLinks?.twitter || '';
      document.getElementById('website').value = data.socialLinks?.website || '';
      document.getElementById('contactEmail').value = data.contactInfo?.email || '';
      document.getElementById('location').value = data.contactInfo?.location || '';
      skills = data.skills || [];
      projects = data.projects || [];
      selectedTheme = data.theme || 'violet';
      currentAvatarUrl = data.profileImage || '';
      if (currentAvatarUrl) {
        document.getElementById('avatarImg').src = currentAvatarUrl;
        document.getElementById('avatarImg').style.display = 'block';
        document.getElementById('avatarInitials').style.display = 'none';
        document.getElementById('previewAvatarImg').src = currentAvatarUrl;
        document.getElementById('previewAvatarImg').style.display = 'block';
        document.getElementById('previewAvatarInitials').style.display = 'none';
      }
      renderSkillTags();
      renderProjects();
      setTheme(selectedTheme);
    } else {
      // Pre-fill from user doc
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (userSnap.exists()) {
        const ud = userSnap.data();
        document.getElementById('fullName').value = ud.fullName || '';
        // Auto-generate slug from name
        if (ud.fullName) {
          document.getElementById('slug').value = ud.fullName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        }
      }
    }
    updateAvatarInitials();
    updateAllPreviews();
  } catch (err) {
    console.error('Error loading portfolio:', err);
  }

  loadingScreen.style.display = 'none';
  appContent.style.display = 'block';
});

// ===== PREVIEW UPDATES =====
function updateAllPreviews() {
  const name = document.getElementById('fullName').value || 'Your Name';
  const title = document.getElementById('title').value || 'Your Title';
  const about = document.getElementById('about').value || 'Your bio will appear here…';
  document.getElementById('previewName').textContent = name;
  document.getElementById('previewTitle').textContent = title;
  document.getElementById('previewAbout').textContent = about;
  renderPreviewSkills();
  renderPreviewProjects();
}

['fullName', 'title', 'about'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', updateAllPreviews);
});

function updateAvatarInitials() {
  const name = document.getElementById('fullName').value || '?';
  const initial = name.charAt(0).toUpperCase();
  document.getElementById('avatarInitials').textContent = initial;
  document.getElementById('previewAvatarInitials').textContent = initial;
}
document.getElementById('fullName').addEventListener('input', updateAvatarInitials);

// ===== THEME =====
function setTheme(theme) {
  selectedTheme = theme;
  const color = themeColors[theme] || themeColors.violet;
  document.documentElement.style.setProperty('--theme-color', color);
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
  // Update preview header colors
  document.getElementById('previewHeader').style.background =
    `linear-gradient(135deg, ${color}, ${shadeColor(color, -20)})`;
  document.querySelectorAll('.pv-section-label').forEach(el => el.style.color = color);
  document.querySelectorAll('.pv-skill').forEach(el => {
    el.style.background = hexToRgba(color, 0.12);
    el.style.color = color;
  });
}
function shadeColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt, G = (num >> 8 & 0x00FF) + amt, B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}
function hexToRgba(hex, alpha) {
  const num = parseInt(hex.slice(1), 16);
  return `rgba(${num >> 16}, ${num >> 8 & 0xff}, ${num & 0xff}, ${alpha})`;
}
document.getElementById('themeGrid').addEventListener('click', (e) => {
  const btn = e.target.closest('.theme-btn');
  if (btn) setTheme(btn.dataset.theme);
});

// ===== AVATAR UPLOAD =====
document.getElementById('uploadAvatarBtn').addEventListener('click', () => {
  document.getElementById('avatarInput').click();
});
document.getElementById('avatarInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB'); return; }
  avatarFile = file;
  const url = URL.createObjectURL(file);
  document.getElementById('avatarImg').src = url;
  document.getElementById('avatarImg').style.display = 'block';
  document.getElementById('avatarInitials').style.display = 'none';
  document.getElementById('previewAvatarImg').src = url;
  document.getElementById('previewAvatarImg').style.display = 'block';
  document.getElementById('previewAvatarInitials').style.display = 'none';
});

// ===== SKILLS =====
function renderSkillTags() {
  const container = document.getElementById('skillTags');
  container.innerHTML = '';
  skills.forEach((skill, i) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `${skill} <button class="tag-remove" data-i="${i}" aria-label="Remove ${skill}">×</button>`;
    container.appendChild(tag);
  });
  renderPreviewSkills();
}
function renderPreviewSkills() {
  const el = document.getElementById('previewSkills');
  const color = themeColors[selectedTheme] || themeColors.violet;
  el.innerHTML = skills.map(s =>
    `<span class="pv-skill" style="background:${hexToRgba(color,0.12)};color:${color};">${s}</span>`
  ).join('');
}
document.getElementById('addSkillBtn').addEventListener('click', () => {
  const input = document.getElementById('skillInput');
  const val = input.value.trim();
  if (val && !skills.includes(val)) { skills.push(val); renderSkillTags(); }
  input.value = '';
  input.focus();
});
document.getElementById('skillInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('addSkillBtn').click(); }
});
document.getElementById('skillTags').addEventListener('click', (e) => {
  if (e.target.classList.contains('tag-remove')) {
    skills.splice(parseInt(e.target.dataset.i), 1);
    renderSkillTags();
  }
});

// ===== PROJECTS =====
function renderProjects() {
  const list = document.getElementById('projectsList');
  list.innerHTML = '';
  projects.forEach((proj, i) => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <div class="project-card-header">
        <span>Project ${i + 1}</span>
        <button class="btn-remove-proj" data-i="${i}" aria-label="Remove project">✕</button>
      </div>
      <div class="form-group">
        <label>Project name</label>
        <input type="text" class="proj-name" data-i="${i}" placeholder="My Awesome App" value="${escHtml(proj.name || '')}" />
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea class="proj-desc" data-i="${i}" rows="3" placeholder="What does this project do?">${escHtml(proj.description || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Live URL</label>
        <input type="url" class="proj-url" data-i="${i}" placeholder="https://..." value="${escHtml(proj.url || '')}" />
      </div>
    `;
    list.appendChild(card);
  });
  // Event listeners
  list.querySelectorAll('.proj-name').forEach(el => el.addEventListener('input', (e) => {
    projects[parseInt(e.target.dataset.i)].name = e.target.value;
    renderPreviewProjects();
  }));
  list.querySelectorAll('.proj-desc').forEach(el => el.addEventListener('input', (e) => {
    projects[parseInt(e.target.dataset.i)].description = e.target.value;
    renderPreviewProjects();
  }));
  list.querySelectorAll('.proj-url').forEach(el => el.addEventListener('input', (e) => {
    projects[parseInt(e.target.dataset.i)].url = e.target.value;
  }));
  list.querySelectorAll('.btn-remove-proj').forEach(el => el.addEventListener('click', (e) => {
    projects.splice(parseInt(el.dataset.i), 1);
    renderProjects();
    renderPreviewProjects();
  }));
  renderPreviewProjects();
}
function renderPreviewProjects() {
  const el = document.getElementById('previewProjects');
  if (!projects.length) { el.innerHTML = '<p style="font-size:12px;color:#888;">No projects added yet.</p>'; return; }
  el.innerHTML = projects.map(p => `
    <div class="pv-project">
      <div class="pv-project-title">${escHtml(p.name || 'Untitled Project')}</div>
      ${p.description ? `<div class="pv-project-desc">${escHtml(p.description)}</div>` : ''}
    </div>
  `).join('');
}
document.getElementById('addProjectBtn').addEventListener('click', () => {
  projects.push({ name: '', description: '', url: '' });
  renderProjects();
  document.querySelector('.project-card:last-child .proj-name')?.focus();
});

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== SAVE =====
async function savePortfolio() {
  const fullName = document.getElementById('fullName').value.trim();
  const slug = document.getElementById('slug').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!fullName) { showToast('Please enter your full name'); return; }
  if (!slug) { showToast('Please enter a portfolio slug'); return; }

  setSaving(true);
  try {
    let profileImageUrl = currentAvatarUrl;
    if (avatarFile) {
      const storageRef = ref(storage, `avatars/${currentUser.uid}/${Date.now()}_${avatarFile.name}`);
      await uploadBytes(storageRef, avatarFile);
      profileImageUrl = await getDownloadURL(storageRef);
    }

    const portfolioData = {
      ownerId: currentUser.uid,
      portfolioSlug: slug,
      fullName,
      title: document.getElementById('title').value.trim(),
      about: document.getElementById('about').value.trim(),
      skills,
      projects,
      socialLinks: {
        github: document.getElementById('github').value.trim(),
        linkedin: document.getElementById('linkedin').value.trim(),
        twitter: document.getElementById('twitter').value.trim(),
        website: document.getElementById('website').value.trim()
      },
      contactInfo: {
        email: document.getElementById('contactEmail').value.trim(),
        location: document.getElementById('location').value.trim()
      },
      profileImage: profileImageUrl,
      theme: selectedTheme,
      updatedAt: serverTimestamp()
    };

    const portfolioRef = doc(db, 'portfolios', currentUser.uid);
    const existing = await getDoc(portfolioRef);
    if (!existing.exists()) {
      portfolioData.createdAt = serverTimestamp();
      await setDoc(portfolioRef, portfolioData);
    } else {
      await updateDoc(portfolioRef, portfolioData);
    }

    // Update user doc
    await updateDoc(doc(db, 'users', currentUser.uid), { portfolioCreated: true });

    currentAvatarUrl = profileImageUrl;
    avatarFile = null;
    showToast('Portfolio saved! ✓');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1800);

  } catch (err) {
    console.error('Save error:', err);
    showToast('Save failed: ' + err.message);
    setSaving(false);
  }
}

function setSaving(loading) {
  const btn = document.getElementById('saveBtn');
  const btn2 = document.getElementById('saveBtn2');
  document.getElementById('saveLabel').style.display = loading ? 'none' : 'inline';
  document.getElementById('saveSpinner').style.display = loading ? 'inline-block' : 'none';
  btn.disabled = loading;
  btn2.disabled = loading;
  btn2.textContent = loading ? 'Saving…' : 'Save & publish portfolio';
}

document.getElementById('saveBtn').addEventListener('click', savePortfolio);
document.getElementById('saveBtn2').addEventListener('click', savePortfolio);

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Init theme
setTheme('violet');
