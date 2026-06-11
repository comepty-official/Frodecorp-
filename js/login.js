import { auth, db, googleProvider } from './firebase.js';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = 'dashboard.html';
});

const form = document.getElementById('loginForm');
const submitBtn = document.getElementById('submitBtn');
const submitLabel = document.getElementById('submitLabel');
const submitSpinner = document.getElementById('submitSpinner');
const errorMsg = document.getElementById('errorMsg');
const togglePwd = document.getElementById('togglePwd');
const passwordInput = document.getElementById('password');
const googleBtn = document.getElementById('googleLogin');
const forgotLink = document.getElementById('forgotLink');
const forgotModal = document.getElementById('forgotModal');
const closeModal = document.getElementById('closeModal');
const sendResetBtn = document.getElementById('sendResetBtn');

togglePwd.addEventListener('click', () => {
  const isText = passwordInput.type === 'text';
  passwordInput.type = isText ? 'password' : 'text';
  togglePwd.textContent = isText ? '👁' : '🙈';
});

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = 'block';
}
function hideError() { errorMsg.style.display = 'none'; }
function setLoading(loading) {
  submitBtn.disabled = loading;
  submitLabel.style.display = loading ? 'none' : 'inline';
  submitSpinner.style.display = loading ? 'inline-block' : 'none';
}

async function ensureUserDoc(user) {
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      fullName: user.displayName || '',
      email: user.email,
      createdAt: serverTimestamp(),
      portfolioCreated: false
    });
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  const email = document.getElementById('email').value.trim();
  const password = passwordInput.value;
  if (!email || !password) return showError('Please fill in all fields.');
  setLoading(true);
  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = 'dashboard.html';
  } catch (err) {
    setLoading(false);
    const msgs = {
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
      'auth/network-request-failed': 'Network error. Check your connection.'
    };
    showError(msgs[err.code] || 'Login failed. Please try again.');
  }
});

googleBtn.addEventListener('click', async () => {
  hideError();
  googleBtn.disabled = true;
  googleBtn.textContent = 'Connecting…';
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserDoc(result.user);
    window.location.href = 'dashboard.html';
  } catch (err) {
    googleBtn.disabled = false;
    googleBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg> Continue with Google`;
    if (err.code !== 'auth/popup-closed-by-user') showError('Google sign-in failed. Please try again.');
  }
});

// Forgot password
forgotLink.addEventListener('click', (e) => {
  e.preventDefault();
  forgotModal.style.display = 'flex';
});
closeModal.addEventListener('click', () => { forgotModal.style.display = 'none'; });
forgotModal.addEventListener('click', (e) => {
  if (e.target === forgotModal) forgotModal.style.display = 'none';
});

sendResetBtn.addEventListener('click', async () => {
  const email = document.getElementById('resetEmail').value.trim();
  const resetError = document.getElementById('resetError');
  const resetSuccess = document.getElementById('resetSuccess');
  resetError.style.display = 'none';
  resetSuccess.style.display = 'none';
  if (!email) { resetError.textContent = 'Please enter your email.'; resetError.style.display = 'block'; return; }
  sendResetBtn.disabled = true;
  sendResetBtn.textContent = 'Sending…';
  try {
    await sendPasswordResetEmail(auth, email);
    resetSuccess.textContent = 'Reset link sent! Check your inbox.';
    resetSuccess.style.display = 'block';
    sendResetBtn.textContent = 'Sent ✓';
  } catch (err) {
    resetError.textContent = err.code === 'auth/user-not-found' ? 'No account found with this email.' : 'Failed to send reset email.';
    resetError.style.display = 'block';
    sendResetBtn.disabled = false;
    sendResetBtn.textContent = 'Send reset link';
  }
});
