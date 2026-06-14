import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyChRX9Ma4aP9BE84u685CYBDT_MMHqBT9g",
  authDomain: "frodecorp.firebaseapp.com",
  projectId: "frodecorp",
  storageBucket: "frodecorp.firebasestorage.app",
  messagingSenderId: "549192414715",
  appId: "1:549192414715:web:7c40c152da652b875cc75e",
  measurementId: "G-EEVF8YE3XK"
};

const app = initializeApp(firebaseConfig);
export { app };
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
