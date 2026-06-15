import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const loadingScreen = document.getElementById('loadingScreen');
const appContent = document.getElementById('appContent');

const greeting = document.getElementById('greeting');
const userName = document.getElementById('userName');
const navName = document.getElementById('navName');
const navAvatar = document.getElementById('navAvatar');

const statusBadge = document.getElementById('statusBadge');
const badgeLabel = document.getElementById('badgeLabel');

const statsRow = document.getElementById('statsRow');
const portfolioLink = document.getElementById('portfolioLink');
const copyLink = document.getElementById('copyLink');

const createCard = document.getElementById('createCard');
const editCard = document.getElementById('editCard');
const viewCard = document.getElementById('viewCard');
const viewBtn = document.getElementById('viewBtn');
const tipsSection = document.getElementById('tipsSection');

const logoutBtn = document.getElementById('logoutBtn');

function showApp() {
  loadingScreen.style.display = 'none';
  appContent.style.display = 'block';
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

onAuthStateChanged(auth, async (user) => {

  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  try {

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    let fullName =
      user.displayName ||
      user.email?.split('@')[0] ||
      'User';

    let portfolioCreated = false;

    if (userSnap.exists()) {
      const data = userSnap.data();

      fullName =
        data.fullName ||
        fullName;

      portfolioCreated =
        data.portfolioCreated || false;
    }

    const firstName = fullName.split(' ')[0];

    greeting.textContent = getGreeting();
    userName.textContent = fullName;
    navName.textContent = firstName;
    navAvatar.textContent = firstName.charAt(0).toUpperCase();

    if (portfolioCreated) {

      try {

        const portfolioRef = doc(db, 'portfolios', user.uid);
        const portfolioSnap = await getDoc(portfolioRef);

        if (portfolioSnap.exists()) {

          const portfolioData = portfolioSnap.data();
          const slug = portfolioData.portfolioSlug;

          if (slug) {

            const publicUrl =
              `${window.location.origin}/portfolio.html?slug=${slug}`;

            statusBadge.classList.add('published');
            badgeLabel.textContent = 'Portfolio live ✓';

            statsRow.style.display = 'block';
            portfolioLink.textContent = publicUrl;

            viewBtn.href =
              `portfolio.html?slug=${slug}`;

            copyLink.addEventListener('click', async () => {
              try {
                await navigator.clipboard.writeText(publicUrl);

                copyLink.textContent = '✓';

                setTimeout(() => {
                  copyLink.textContent = '⧉';
                }, 2000);

              } catch (err) {
                console.error(err);
              }
            });

            tipsSection.style.display = 'none';
            createCard.style.display = 'none';

          } else {

            editCard.style.display = 'none';
            viewCard.style.display = 'none';
          }

        } else {

          editCard.style.display = 'none';
          viewCard.style.display = 'none';
        }

      } catch (err) {

        console.error('Portfolio Error:', err);

        editCard.style.display = 'none';
        viewCard.style.display = 'none';
      }

    } else {

      editCard.style.display = 'none';
      viewCard.style.display = 'none';
    }

  } catch (err) {

    console.error('User Error:', err.code, err.message);

  } finally {

    showApp();
  }

});

logoutBtn.addEventListener('click', async () => {

  try {

    await signOut(auth);
    window.location.href = 'index.html';

  } catch (err) {

    console.error(err);
  }

});