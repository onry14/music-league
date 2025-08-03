// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDs-J19zzHXgg5KP7Dmz8JIflR-Pmipzd4",
  authDomain: "movie-league-ceef0.firebaseapp.com",
  projectId: "movie-league-ceef0",
  storageBucket: "movie-league-ceef0.appspot.com",
  messagingSenderId: "86473177929",
  appId: "1:86473177929:web:5d72933abe4ddb8a477898",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
