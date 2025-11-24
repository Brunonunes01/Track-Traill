// Importa funções específicas do SDK modular
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyDey1yuG8gwfWGyOov47emZyLLKqD8CSgk",
    authDomain: "projetotrack-e29af.firebaseapp.com",
    projectId: "projetotrack-e29af",
    storageBucket: "projetotrack-e29af.firebasestorage.app",
    messagingSenderId: "568614374330",
    appId: "1:568614374330:web:d091ac72088c67bdf12b83",
    baseURL:"https://projetotrack-e29af-default-rtdb.firebaseio.com/"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
 
// Inicializa e exporta serviços
export const auth = getAuth(app);
export const database = getDatabase(app);
 
export default app;
