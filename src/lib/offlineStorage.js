// Gerenciador de Armazenamento Local IndexedDB para Modo Offline
const DB_NAME = "AJL_ERP_OFFLINE_DB";
const DB_VERSION = 1;
const QUEUE_STORE = "sync_queue";
const CACHE_STORE = "offline_cache";

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB não suportado neste navegador."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Enfileira uma ação realizada offline para ser sincronizada quando a rede voltar
 * @param {Object} acao - { tipo, entidade, registroId, dados, timestamp, descricao }
 */
export async function enfileirarAcaoOffline(acao) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readwrite");
      const store = tx.objectStore(QUEUE_STORE);
      const item = {
        ...acao,
        timestamp: acao.timestamp || new Date().toISOString(),
        criadoEmMs: Date.now(),
        tentativas: 0,
        status: "pendente"
      };
      const req = store.add(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Erro ao enfileirar ação offline:", err);
    // Fallback para localStorage caso IndexedDB falhe
    try {
      const queue = JSON.parse(localStorage.getItem("ajl_offline_sync_fallback") || "[]");
      queue.push({ ...acao, timestamp: new Date().toISOString(), id: Date.now() });
      localStorage.setItem("ajl_offline_sync_fallback", JSON.stringify(queue));
    } catch {}
  }
}

/**
 * Retorna todos os itens pendentes de sincronização
 */
export async function obterFilaPendente() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readonly");
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Erro ao ler fila offline IndexedDB:", err);
    try {
      return JSON.parse(localStorage.getItem("ajl_offline_sync_fallback") || "[]");
    } catch {
      return [];
    }
  }
}

/**
 * Remove um item concluído da fila
 */
export async function removerItemFila(id) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readwrite");
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Erro ao remover item da fila:", err);
    try {
      const queue = JSON.parse(localStorage.getItem("ajl_offline_sync_fallback") || "[]");
      const filtrada = queue.filter(item => item.id !== id);
      localStorage.setItem("ajl_offline_sync_fallback", JSON.stringify(filtrada));
    } catch {}
  }
}

/**
 * Salva cache de dados para leitura offline (ex: OPs de uma máquina)
 */
export async function salvarCacheLocal(chave, dados) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, "readwrite");
      const store = tx.objectStore(CACHE_STORE);
      const req = store.put({ key: chave, dados, salvoEm: new Date().toISOString() });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Erro ao salvar cache local:", err);
  }
}

/**
 * Recupera cache de dados para leitura offline
 */
export async function obterCacheLocal(chave) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, "readonly");
      const store = tx.objectStore(CACHE_STORE);
      const req = store.get(chave);
      req.onsuccess = () => resolve(req.result ? req.result.dados : null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Erro ao obter cache local:", err);
    return null;
  }
}
