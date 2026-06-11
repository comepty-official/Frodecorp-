import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const loadingScreen = document.getElementById('loadingScreen');
const appContent = document.getElementById('appContent');

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // Load user data
  try {
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};
    const fullName = userData.fullName || user.displayName || user.email.split('@')[0];
    const firstName = fullName.split(' ')[0];
    const portfolioCreated = userData.portfolioCreated || false;

    // Greeting
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';
    document.getElementById('greeting').textContent = greet;
    document.getElementById('userName').textContent = fullName;
    document.getElementById('navName').textContent = firstName;
    document.getElementById('navAvatar').textContent = firstName.charAt(0).toUpperCase();

    // Portfolio slug
    const portfolioSnap = await getDoc(doc(db, 'portfolios', user.uid));
    const slug = portfolioSnap.exists() ? portfolioSnap.data().portfolioSlug : null;

    if (portfolioCreated && slug) {
      const badge = document.getElementById('statusBadge');
      badge.classList.add('published');
      document.getElementById('badgeLabel').textContent = 'Portfolio live ✓';

      const statsRow = document.getElementById('statsRow');
      statsRow.style.display = 'block';
      const linkEl = document.getElementById('portfolioLink');
      const publicUrl = `${window.location.origin}/portfolio.html?slug=${slug}`;
      linkEl.textContent = publicUrl;

      document.getElementById('copyLink').addEventListener('click', () => {
        navigator.clipboard.writeText(publicUrl).then(() => {
          document.getElementById('copyLink').textContent = '✓';
          setTimeout(() => { document.getElementById('copyLink').textContent = '⧉'; }, 2000);
        });
      });

      document.getElementById('viewBtn').href = `portfolio.html?slug=${slug}`;
      document.getElementById('tipsSection').style.display = 'none';
      document.getElementById('createCard').style.display = 'none';
    } else {
      document.getElementById('editCard').style.display = 'none';
      document.getElementById('viewCard').style.display = 'none';
    }

  } catch (err) {
    console.error('Error loading user data:', err);
  }

  loadingScreen.style.display = 'none';
  appContent.style.display = 'block';
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});
