// Importa funções específicas do SDK modular
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {

  apiKey: "AIzaSyBlvFgxQhqUQYyE3LIchPnWvz5cNuYPj1k",

  authDomain: "tracktrail-app.firebaseapp.com",

  databaseURL: "https://tracktrail-app-default-rtdb.firebaseio.com",

  projectId: "tracktrail-app",

  storageBucket: "tracktrail-app.firebasestorage.app",

  messagingSenderId: "248567456065",

  appId: "1:248567456065:web:838f4da3defc88c8dd01c0"

};


// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
 
// Inicializa e exporta serviços
export const auth = getAuth(app);
export const database = getDatabase(app);
 
export default app;
