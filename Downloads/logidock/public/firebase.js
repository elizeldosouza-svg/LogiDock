// =====================================================
//  firebase.js — Integração Firebase Firestore
//  Substitui o localStorage por banco em tempo real
// =====================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, collection,
  onSnapshot, setDoc, getDoc, getDocs,
  addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── CONFIG: cole aqui as credenciais do seu projeto Firebase ──
// Obtenha em: Firebase Console → Configurações do projeto → Seus apps → SDK
const firebaseConfig = {
  apiKey: "AIzaSyAz8-6nzvxdE-IrdcAzAMfcEcbiRxT6QX8",
  authDomain: "logidock.firebaseapp.com",
  projectId: "logidock",
  storageBucket: "logidock.firebasestorage.app",
  messagingSenderId: "589100542835",
  appId: "1:589100542835:web:be67cf7ef9bb3178083306"
};

// ── Inicializa Firebase ──
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Referências das coleções ──
const COLS = {
  docks:    "docks",
  queue:    "queue",
  schedules:"schedules",
  history:  "history",
  config:   "config",
  carriers: "carriers",
  stats:    "stats",
};

// ── Expõe DB globalmente para o app.js usar ──
window.FB = {
  db,
  doc, collection,
  onSnapshot, setDoc, getDoc, getDocs,
  addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, limit,
  COLS,

  // ── Helpers ──

  // Salva/atualiza um documento pelo ID
  async save(col, id, data) {
    try {
      await setDoc(doc(db, col, id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
    } catch (e) { console.error("FB.save:", e); }
  },

  // Adiciona novo documento com ID automático
  async add(col, data) {
    try {
      const ref = await addDoc(collection(db, col), { ...data, createdAt: serverTimestamp() });
      return ref.id;
    } catch (e) { console.error("FB.add:", e); return null; }
  },

  // Deleta documento
  async del(col, id) {
    try { await deleteDoc(doc(db, col, id)); }
    catch (e) { console.error("FB.del:", e); }
  },

  // Escuta uma coleção em tempo real
  listen(col, cb, q) {
    const ref = q || collection(db, col);
    return onSnapshot(ref, snap => {
      const docs = [];
      snap.forEach(d => docs.push({ _id: d.id, ...d.data() }));
      cb(docs);
    }, err => console.error("FB.listen:", err));
  },

  // Escuta um documento único
  listenDoc(col, id, cb) {
    return onSnapshot(doc(db, col, id), snap => {
      if (snap.exists()) cb({ _id: snap.id, ...snap.data() });
      else cb(null);
    });
  },

  // Lê uma coleção uma vez
  async getAll(col) {
    try {
      const snap = await getDocs(collection(db, col));
      return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    } catch (e) { console.error("FB.getAll:", e); return []; }
  },

  // Lê um documento único
  async getOne(col, id) {
    try {
      const snap = await getDoc(doc(db, col, id));
      return snap.exists() ? { _id: snap.id, ...snap.data() } : null;
    } catch (e) { console.error("FB.getOne:", e); return null; }
  },
};

// ── Inicializa estrutura de dados no Firestore se ainda não existe ──
async function initFirestoreData() {
  // Config padrão
  const cfgRef = doc(db, COLS.config, "main");
  const cfgSnap = await getDoc(cfgRef);
  if (!cfgSnap.exists()) {
    await setDoc(cfgRef, {
      name: "Centro de Distribuição",
      totalDocks: 6,
      defaultTime: 60,
      shifts: {
        a: { s: "06:00", e: "14:00" },
        b: { s: "14:00", e: "22:00" },
        c: { s: "22:00", e: "06:00" }
      }
    });
    console.log("✅ Config padrão criada no Firestore");
  }

  // Transportadoras padrão
  const carriersSnap = await getDocs(collection(db, COLS.carriers));
  if (carriersSnap.empty) {
    const defaults = ["LogBrasil","Trans Alfa","Rápido Entregas","Norte Sul Log.","Expresso Nacional"];
    for (const name of defaults) {
      await addDoc(collection(db, COLS.carriers), { name });
    }
    console.log("✅ Transportadoras padrão criadas");
  }

  // Docas padrão (6)
  const docksSnap = await getDocs(collection(db, COLS.docks));
  if (docksSnap.empty) {
    for (let i = 1; i <= 6; i++) {
      await setDoc(doc(db, COLS.docks, `D${String(i).padStart(2,"0")}`), {
        num: i,
        status: "livre",
        plate: "", carrier: "", driver: "",
        type: "", start: "", end: "",
        progress: 0, nf: "", obs: ""
      });
    }
    console.log("✅ 6 docas criadas no Firestore");
  }

  // Stats
  const statsRef = doc(db, COLS.stats, "turno");
  const statsSnap = await getDoc(statsRef);
  if (!statsSnap.exists()) {
    await setDoc(statsRef, { done: 0, totalMin: 0 });
  }

  console.log("🔥 Firebase conectado e pronto!");
  window.dispatchEvent(new Event("firebase-ready"));
}

initFirestoreData().catch(console.error);
