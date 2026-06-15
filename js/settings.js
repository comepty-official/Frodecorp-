import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const loadingScreen = document.getElementById('loadingScreen');
const settingsApp = document.getElementById('settingsApp');

const saveBtn = document.getElementById('saveBtn');
const addProjectBtn = document.getElementById('addProject');

let currentUser = null;

const portfolioRef = (uid) => doc(db, "portfolios", uid);
const userRef = (uid) => doc(db, "users", uid);

function getProjects() {
  const items = document.querySelectorAll('.project-item');
  const projects = [];

  items.forEach(item => {
    projects.push({
      name: item.querySelector('.project-name')?.value || '',
      description: item.querySelector('.project-description')?.value || '',
      link: item.querySelector('.project-link')?.value || ''
    });
  });

  return projects;
}

function setProjects(projects = []) {
  const container = document.getElementById('projectsContainer');
  container.innerHTML = '';

  projects.forEach(p => {
    const div = document.createElement('div');
    div.className = 'project-item';

    div.innerHTML = `
      <input type="text" placeholder="Project Name" class="project-name" value="${p.name || ''}">
      <textarea rows="4" placeholder="Project Description" class="project-description">${p.description || ''}</textarea>
      <input type="url" placeholder="Project Link" class="project-link" value="${p.link || ''}">
    `;

    container.appendChild(div);
  });

  if (!projects.length) addProject();
}

function addProject() {
  const container = document.getElementById('projectsContainer');

  const div = document.createElement('div');
  div.className = 'project-item';

  div.innerHTML = `
    <input type="text" placeholder="Project Name" class="project-name">
    <textarea rows="4" placeholder="Project Description" class="project-description"></textarea>
    <input type="url" placeholder="Project Link" class="project-link">
  `;

  container.appendChild(div);
}

function fillForm(data) {
  document.getElementById('websiteName').value = data.websiteName || '';
  document.getElementById('websiteSlug').value = data.websiteSlug || '';
  document.getElementById('fullName').value = data.fullName || '';
  document.getElementById('jobTitle').value = data.jobTitle || '';
  document.getElementById('aboutText').value = data.aboutText || '';

  document.getElementById('github').value = data.github || '';
  document.getElementById('linkedin').value = data.linkedin || '';
  document.getElementById('twitter').value = data.twitter || '';
  document.getElementById('instagram').value = data.instagram || '';

  document.getElementById('themeColor').value = data.themeColor || '#5b4cf5';
  document.getElementById('layoutStyle').value = data.layoutStyle || 'modern';
  document.getElementById('fontStyle').value = data.fontStyle || 'inter';

  document.getElementById('contactEmail').value = data.contactEmail || '';
  document.getElementById('contactPhone').value = data.contactPhone || '';

  document.getElementById('skillsInput').value =
    Array.isArray(data.skills) ? data.skills.join(', ') : '';

  setProjects(data.projects || []);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "login.html";
    return;
  }

  currentUser = user;

  try {
    const snap = await getDoc(portfolioRef(user.uid));

    if (snap.exists()) {
      fillForm(snap.data());
    } else {
      setProjects([]);
    }
  } catch (e) {}

  loadingScreen.style.display = "none";
  settingsApp.style.display = "block";
});

addProjectBtn.addEventListener('click', addProject);

saveBtn.addEventListener('click', async () => {
  if (!currentUser) return;

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  const data = {
    uid: currentUser.uid,

    websiteName: document.getElementById('websiteName').value.trim(),
    websiteSlug: document.getElementById('websiteSlug').value.trim(),
    fullName: document.getElementById('fullName').value.trim(),
    jobTitle: document.getElementById('jobTitle').value.trim(),
    aboutText: document.getElementById('aboutText').value.trim(),

    skills: document.getElementById('skillsInput')
      .value.split(',')
      .map(s => s.trim())
      .filter(Boolean),

    github: document.getElementById('github').value.trim(),
    linkedin: document.getElementById('linkedin').value.trim(),
    twitter: document.getElementById('twitter').value.trim(),
    instagram: document.getElementById('instagram').value.trim(),

    themeColor: document.getElementById('themeColor').value,
    layoutStyle: document.getElementById('layoutStyle').value,
    fontStyle: document.getElementById('fontStyle').value,

    contactEmail: document.getElementById('contactEmail').value.trim(),
    contactPhone: document.getElementById('contactPhone').value.trim(),

    projects: getProjects(),

    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(portfolioRef(currentUser.uid), data, { merge: true });

    await setDoc(userRef(currentUser.uid), {
      portfolioCreated: true
    }, { merge: true });

    saveBtn.textContent = "Saved ✓";

  } catch (e) {
    saveBtn.textContent = "Failed";
  }

  setTimeout(() => {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Changes";
  }, 1500);
});

document.getElementById('previewBtn').addEventListener('click', () => {
  const slug = document.getElementById('websiteSlug').value.trim();
  if (!slug) return;
  window.open(`portfolio.html?slug=${slug}`, "_blank");
});

document.getElementById('publishBtn').addEventListener('click', () => {
  saveBtn.click();
});