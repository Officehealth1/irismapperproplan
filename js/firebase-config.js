// Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyDLxkumdLuzRoFfT95aZzfjDIFmw4D7GVQ",
    authDomain: "irismapper.firebaseapp.com",
    projectId: "irismapper",
    storageBucket: "irismapper.firebasestorage.app",
    messagingSenderId: "25624993896",
    appId: "1:25624993896:web:3d7f3e34b15adab9db5bdd",
    measurementId: "G-KV23RL3DXM"
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore database
const db = firebase.firestore();

// Initialize Firebase Authentication
const auth = firebase.auth(); 