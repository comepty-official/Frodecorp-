import { auth, db } from "./firebase.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";








const loadingScreen = document.getElementById("loadingScreen");
const appContent = document.getElementById("appContent");

const fullName = document.getElementById("fullName");
const title = document.getElementById("title");
const about = document.getElementById("about");
const slug = document.getElementById("slug");

const github = document.getElementById("github");
const linkedin = document.getElementById("linkedin");
const twitter = document.getElementById("twitter");
const website = document.getElementById("website");

const contactEmail = document.getElementById("contactEmail");
const locationInput = document.getElementById("location");

const previewName = document.getElementById("previewName");
const previewTitle = document.getElementById("previewTitle");
const previewAbout = document.getElementById("previewAbout");

const avatarInput = document.getElementById("avatarInput");
const avatarImg = document.getElementById("avatarImg");
const avatarInitials = document.getElementById("avatarInitials");

const previewAvatarImg = document.getElementById("previewAvatarImg");
const previewAvatarInitials = document.getElementById("previewAvatarInitials");

const skillInput = document.getElementById("skillInput");
const skillTags = document.getElementById("skillTags");

const projectsList = document.getElementById("projectsList");

const saveBtn = document.getElementById("saveBtn");
const saveBtn2 = document.getElementById("saveBtn2");

const toast = document.getElementById("toast");

let currentUser = null;
let avatarFile = null;
let avatarUrl = "";

let skills = [];
let projects = [];

const themeColors = {
  violet: "#5b4cf5",
  ocean: "#0ea5e9",
  forest: "#10b981",
  sunset: "#f97316",
  rose: "#f43f5e",
  slate: "#475569"
};

let selectedTheme = "violet";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "login.html";
    return;
  }

  currentUser = user;

  try {
  console.log("User UID:", user.uid);
    const snap = await getDoc(
      doc(db, "portfolios", user.uid)
    );
     
    if (!snap.exists()) {

  fullName.value = user.displayName || "";
  contactEmail.value = user.email || "";

  updatePreview();
  updateInitials();

} else {

  const data = snap.data();

  fullName.value = data.fullName || "";
  title.value = data.title || "";
  about.value = data.about || "";
  slug.value = data.portfolioSlug || "";

  github.value = data.github || "";
  linkedin.value = data.linkedin || "";
  twitter.value = data.twitter || "";
  website.value = data.website || "";

  contactEmail.value = data.contactEmail || "";
  locationInput.value = data.location || "";

  skills = data.skills || [];
  projects = data.projects || [];

  avatarUrl = data.profileImage || "";

  selectedTheme = data.theme || "violet";

  if (avatarUrl) {
    setAvatar(avatarUrl);
  }

  document
    .querySelector(`[data-theme="${selectedTheme}"]`)
    ?.classList.add("active");
}

    updatePreview();
    updateInitials();
    renderSkills();
    renderProjects();
    setTheme(selectedTheme);

  } catch (error) {
  console.error("ERROR:", error);
  alert(error.message);
}

  loadingScreen.style.display = "none";
  appContent.style.display = "block";
});

function updatePreview() {
  previewName.textContent =
    fullName.value.trim() || "Your Name";

  previewTitle.textContent =
    title.value.trim() || "Professional Title";

  previewAbout.textContent =
    about.value.trim() || "Your bio will appear here.";
}

function updateInitials() {
  const letter =
    (fullName.value.trim()[0] || "W")
      .toUpperCase();

  avatarInitials.textContent = letter;
  previewAvatarInitials.textContent = letter;
}

function setAvatar(url) {
  avatarImg.src = url;
  avatarImg.style.display = "block";
  avatarInitials.style.display = "none";

  previewAvatarImg.src = url;
  previewAvatarImg.style.display = "block";
  previewAvatarInitials.style.display = "none";
}

fullName.addEventListener("input", () => {
  updatePreview();
  updateInitials();
});

title.addEventListener("input", updatePreview);
about.addEventListener("input", updatePreview);

document
  .getElementById("uploadAvatarBtn")
  .addEventListener("click", () => {
    avatarInput.click();
  });

avatarInput.addEventListener("change", (e) => {
  const file = e.target.files[0];

  if (!file) return;

  avatarFile = file;

  const localUrl =
    URL.createObjectURL(file);

  setAvatar(localUrl);
});

document
  .getElementById("addSkillBtn")
  .addEventListener("click", () => {

    const value =
      skillInput.value.trim();

    if (!value) return;

    skills.push(value);

    skillInput.value = "";

    renderSkills();
  });

skillInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    document
      .getElementById("addSkillBtn")
      .click();
  }
});

function renderSkills() {

  skillTags.innerHTML = "";

  const previewSkills =
    document.getElementById("previewSkills");

  previewSkills.innerHTML = "";

  skills.forEach((skill, index) => {

    const tag =
      document.createElement("div");

    tag.className = "skill-tag";

    tag.innerHTML = `
      <span>${skill}</span>
      <button type="button" class="skill-remove">×</button>
    `;

    tag
      .querySelector(".skill-remove")
      .addEventListener("click", () => {

        skills.splice(index, 1);

        renderSkills();
      });

    skillTags.appendChild(tag);

    previewSkills.innerHTML += `
      <span class="pv-skill">
        ${skill}
      </span>
    `;
  });
}

document
  .getElementById("addProjectBtn")
  .addEventListener("click", () => {

    projects.push({
      name: "",
      description: ""
    });

    renderProjects();
  });

function renderProjects() {

  projectsList.innerHTML = "";

  projects.forEach((project, index) => {

    const card =
      document.createElement("div");

    card.className = "project-card";

    card.innerHTML = `
      <input
        type="text"
        class="project-input"
        placeholder="Project Name"
        value="${project.name || ""}"
      >

      <textarea
        class="project-textarea"
        placeholder="Project Description"
      >${project.description || ""}</textarea>

      <button
        type="button"
        class="project-remove"
      >
        Remove Project
      </button>
    `;

    const input =
      card.querySelector(".project-input");

    const textarea =
      card.querySelector(".project-textarea");

    const removeBtn =
      card.querySelector(".project-remove");

    input.addEventListener("input", (e) => {
      projects[index].name = e.target.value;
      renderProjectPreview();
    });

    textarea.addEventListener("input", (e) => {
      projects[index].description = e.target.value;
      renderProjectPreview();
    });

    removeBtn.addEventListener("click", () => {
      projects.splice(index, 1);

      renderProjects();
    });

    projectsList.appendChild(card);
  });

  renderProjectPreview();
}

function renderProjectPreview() {

  const previewProjects =
    document.getElementById("previewProjects");

  previewProjects.innerHTML = "";

  projects.forEach((project) => {

    previewProjects.innerHTML += `
      <div class="project-preview">
        <h4>
          ${project.name || "Untitled Project"}
        </h4>
        <p>
          ${project.description || ""}
        </p>
      </div>
    `;
  });
}

document
  .querySelectorAll(".theme-btn")
  .forEach((btn) => {

    const colors = {
      violet: "#5b4cf5",
      ocean: "#0ea5e9",
      forest: "#10b981",
      sunset: "#f97316",
      rose: "#f43f5e",
      slate: "#475569"
    };

    btn.style.background =
      colors[btn.dataset.theme];

    btn.addEventListener("click", () => {

      document
        .querySelectorAll(".theme-btn")
        .forEach((b) =>
          b.classList.remove("active")
        );

      btn.classList.add("active");

      setTheme(btn.dataset.theme);
    });
  });

function setTheme(theme) {

  selectedTheme = theme;

  const color =
    themeColors[theme] ||
    themeColors.violet;

  document.getElementById(
    "previewHeader"
  ).style.background =
    `linear-gradient(135deg, ${color}, ${color}cc)`;
}

function showToast(message) {

  toast.textContent = message;

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

async function savePortfolio() {

  if (!currentUser) return;

  try {

    await setDoc(
  doc(db, "users", currentUser.uid),
  {
    uid: currentUser.uid,
    fullName: fullName.value.trim(),
    profileImage: avatarUrl,
    title: title.value.trim(),
    updatedAt: serverTimestamp()
  },
  { merge: true }
);

await setDoc(
  doc(db, "portfolios", currentUser.uid),
  {
    fullName: fullName.value.trim(),
    title: title.value.trim(),
    about: about.value.trim(),
    portfolioSlug: slug.value.trim(),

    github: github.value.trim(),
    linkedin: linkedin.value.trim(),
    twitter: twitter.value.trim(),
    website: website.value.trim(),

    contactEmail: contactEmail.value.trim(),
    location: locationInput.value.trim(),

    profileImage: avatarUrl,

    skills,
    projects,
    theme: selectedTheme,

    updatedAt: serverTimestamp()
  },
  { merge: true }
);



await setDoc(
  doc(db, "users", currentUser.uid),
  {
    fullName: fullName.value.trim(),
    email: contactEmail.value.trim(),
    profileImage: avatarUrl,
    updatedAt: serverTimestamp()
  },
  {
    merge: true
  }
);



    showToast("Portfolio saved successfully");

  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Failed to save portfolio"
    );
  }
}

saveBtn?.addEventListener("click", savePortfolio);
saveBtn2?.addEventListener("click", savePortfolio);

    