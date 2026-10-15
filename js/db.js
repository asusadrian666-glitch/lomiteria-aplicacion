// db.js - IndexedDB Manager para Lomitería FUEGO
const DB_NAME = 'LomiteriaFuegoDB';
const DB_VERSION = 1;

let dbInstance = null;

// Datos Iniciales Predefinidos
const INITIAL_SETTINGS = {
  key: 'general',
  storeName: 'FUEGO - Lomitería & Burgers',
  storeSlogan: 'Hamburguesas & Lomitos Caseros',
  storePhone: '0981 123 456',
  storeAddress: 'Avda. Principal esq. Las Palmas',
  defaultDeliveryFee: 5000,
  logoUrl: 'assets/logo.jpg',
  ticketFooter: '¡Gracias por su preferencia!\nSíguenos en redes sociales',
  orderPrefix: '#',
  thermalWidth: '80mm'
};

const INITIAL_CATEGORIES = [
  { id: 'hamburguesas', name: 'Hamburguesas Caseras', icon: '🍔', order: 1, image: 'assets/burger.jpg' },
  { id: 'lomitos', name: 'Lomitos', icon: '🥩', order: 2, image: 'assets/lomito.jpg' },
  { id: 'lomitos_arabes', name: 'Lomitos Árabes', icon: '🌯', order: 3, image: 'assets/lomito_arabe.jpg' },
  { id: 'papas', name: 'Papas Fritas', icon: '🍟', order: 4, image: 'assets/fries.jpg' },
  { id: 'bebidas_sin_alcohol', name: 'Bebidas Sin Alcohol', icon: '🥤', order: 5, image: '' },
  { id: 'bebidas_alcohol', name: 'Bebidas Alcohólicas', icon: '🍺', order: 6, image: '' }
];

const INITIAL_PRODUCTS = [
  // HAMBURGUESAS CASERAS
  {
    id: 'prod_hamb_simple',
    categoryId: 'hamburguesas',
    name: 'Hamburguesa Simple',
    price: 12000,
    priceConfigured: true,
    customizable: true,
    ingredients: ['Pan', 'Carne casera', 'Doble queso cheddar'],
    image: 'assets/burger.jpg',
    active: true
  },
  {
    id: 'prod_hamb_tradicional',
    categoryId: 'hamburguesas',
    name: 'Hamburguesa Tradicional',
    price: 20000,
    priceConfigured: true,
    customizable: true,
    ingredients: ['Pan', 'Carne casera', 'Lechuga repollada', 'Tomate', 'Huevo'],
    image: 'assets/burger.jpg',
    active: true
  },
  {
    id: 'prod_hamb_casa',
    categoryId: 'hamburguesas',
    name: 'Hamburguesa De La Casa',
    price: 30000,
    priceConfigured: true,
    customizable: true,
    ingredients: ['Pan con semillas de sésamo negro', 'Doble carne casera', 'Queso cheddar', 'Salsa de la casa', 'Bacon'],
    image: 'assets/burger.jpg',
    active: true
  },
  {
    id: 'prod_hamb_fanaticos_cheese',
    categoryId: 'hamburguesas',
    name: 'Fanáticos Del Cheese',
    price: 28000,
    priceConfigured: true,
    customizable: true,
    ingredients: ['Pan', 'Carne casera', 'Queso cheddar', 'Salsa cheddar', 'Mayo de la casa'],
    image: 'assets/burger.jpg',
    active: true
  },

  // LOMITOS
  {
    id: 'prod_lom_simple',
    categoryId: 'lomitos',
    name: 'Lomito Simple',
    price: 22000,
    priceConfigured: true,
    customizable: true,
    ingredients: ['Pan', 'Lomito vacuno', 'Queso mozzarella', 'Jamón', 'Tomate'],
    image: 'assets/lomito.jpg',
    active: true
  },
  {
    id: 'prod_lom_casa',
    categoryId: 'lomitos',
    name: 'Lomito De La Casa',
    price: 30000,
    priceConfigured: true,
    customizable: true,
    ingredients: ['Pan', 'Lomito vacuno', 'Huevo', 'Queso mozzarella', 'Jamón', 'Lechuga', 'Tomate', 'Salsa de la casa'],
    image: 'assets/lomito.jpg',
    active: true
  },

  // LOMITOS ÁRABES (tres opciones independientes)
  {
    id: 'prod_arabe_carne',
    categoryId: 'lomitos_arabes',
    name: 'Lomito Árabe Carne',
    price: 32000,
    priceConfigured: true,
    customizable: true,
    ingredients: ['Pan árabe', 'Carne de lomito', 'Salsa especial de la casa', 'Tomate', 'Cebolla', 'Lechuga'],
    image: 'assets/lomito_arabe.jpg',
    active: true
  },
  {
    id: 'prod_arabe_pollo',
    categoryId: 'lomitos_arabes',
    name: 'Lomito Árabe Pollo',
    price: 25000,
    priceConfigured: true,
    customizable: true,
    ingredients: ['Pan árabe', 'Pechuga de pollo', 'Salsa especial de la casa', 'Tomate', 'Cebolla', 'Lechuga'],
    image: 'assets/lomito_arabe.jpg',
    active: true
  },
  {
    id: 'prod_arabe_mixto',
    categoryId: 'lomitos_arabes',
    name: 'Lomito Árabe Mixto',
    price: 29000,
    priceConfigured: true,
    customizable: true,
    ingredients: ['Pan árabe', 'Lomito y Pollo', 'Salsa especial de la casa', 'Tomate', 'Cebolla', 'Lechuga'],
    image: 'assets/lomito_arabe.jpg',
    active: true
  },

  // PAPAS FRITAS
  {
    id: 'prod_papas_chicas',
    categoryId: 'papas',
    name: 'Papas Chicas',
    price: 10000,
    priceConfigured: true,
    customizable: false,
    ingredients: [],
    image: 'assets/fries.jpg',
    active: true
  },
  {
    id: 'prod_papas_grandes',
    categoryId: 'papas',
    name: 'Papas Grandes',
    price: 18000,
    priceConfigured: true,
    customizable: false,
    ingredients: [],
    image: 'assets/fries.jpg',
    active: true
  },
  {
    id: 'prod_papas_cheddar_bacon',
    categoryId: 'papas',
    name: 'Papas con Cheddar y Bacon',
    price: 25000,
    priceConfigured: true,
    customizable: true,
    ingredients: ['Cheddar fundido', 'Bacon crocante'],
    image: 'assets/fries.jpg',
    active: true
  },

  // BEBIDAS SIN ALCOHOL (Pendientes de precio)
  {
    id: 'prod_beb_coca_500',
    categoryId: 'bebidas_sin_alcohol',
    name: 'Coca Cola 500 ML',
    price: null,
    priceConfigured: false,
    customizable: false,
    ingredients: [],
    image: '',
    active: true
  },
  {
    id: 'prod_beb_fanta_guarana_500',
    categoryId: 'bebidas_sin_alcohol',
    name: 'Fanta Guaraná 500 ML',
    price: null,
    priceConfigured: false,
    customizable: false,
    ingredients: [],
    image: '',
    active: true
  },
  {
    id: 'prod_beb_sprite_500',
    categoryId: 'bebidas_sin_alcohol',
    name: 'Sprite 500 ML',
    price: null,
    priceConfigured: false,
    customizable: false,
    ingredients: [],
    image: '',
    active: true
  },
  {
    id: 'prod_beb_fanta_naranja_500',
    categoryId: 'bebidas_sin_alcohol',
    name: 'Fanta Naranja 500 ML',
    price: null,
    priceConfigured: false,
    customizable: false,
    ingredients: [],
    image: '',
    active: true
  },
  {
    id: 'prod_beb_coca_1l_ret',
    categoryId: 'bebidas_sin_alcohol',
    name: 'Coca Cola 1 L Retornable',
    price: null,
    priceConfigured: false,
    customizable: false,
    ingredients: [],
    image: '',
    active: true
  },
  {
    id: 'prod_beb_coca_2l_desc',
    categoryId: 'bebidas_sin_alcohol',
    name: 'Coca Cola 2 L Descartable',
    price: null,
    priceConfigured: false,
    customizable: false,
    ingredients: [],
    image: '',
    active: true
  },

  // BEBIDAS ALCOHÓLICAS (Pendientes de precio)
  {
    id: 'prod_beb_bud_66',
    categoryId: 'bebidas_alcohol',
    name: 'Bud 66',
    price: null,
    priceConfigured: false,
    customizable: false,
    ingredients: [],
    image: '',
    active: true
  },
  {
    id: 'prod_beb_miller',
    categoryId: 'bebidas_alcohol',
    name: 'Miller',
    price: null,
    priceConfigured: false,
    customizable: false,
    ingredients: [],
    image: '',
    active: true
  },
  {
    id: 'prod_beb_coronita',
    categoryId: 'bebidas_alcohol',
    name: 'Coronita',
    price: null,
    priceConfigured: false,
    customizable: false,
    ingredients: [],
    image: '',
    active: true
  },
  {
    id: 'prod_beb_michelin',
    categoryId: 'bebidas_alcohol',
    name: 'Michelin',
    price: null,
    priceConfigured: false,
    customizable: false,
    ingredients: [],
    image: '',
    active: true
  },
  {
    id: 'prod_beb_munich_ultra',
    categoryId: 'bebidas_alcohol',
    name: 'Múnich Ultra',
    price: null,
    priceConfigured: false,
    customizable: false,
    ingredients: [],
    image: '',
    active: true
  }
];

const INITIAL_EXTRAS = [
  { id: 'extra_carne', name: 'Carne Casera', price: 8000, active: true },
  { id: 'extra_panceta', name: 'Panceta', price: 7000, active: true },
  { id: 'extra_huevo', name: 'Huevo', price: 4000, active: true },
  { id: 'extra_queso', name: 'Queso', price: 5000, active: true },
  { id: 'extra_vasito_cheddar', name: 'Vasito Cheddar', price: 5000, active: true }
];

// Inicializador de IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // Categories store
      if (!db.objectStoreNames.contains('categories')) {
        const catStore = db.createObjectStore('categories', { keyPath: 'id' });
        catStore.createIndex('order', 'order', { unique: false });
      }

      // Products store
      if (!db.objectStoreNames.contains('products')) {
        const prodStore = db.createObjectStore('products', { keyPath: 'id' });
        prodStore.createIndex('categoryId', 'categoryId', { unique: false });
        prodStore.createIndex('active', 'active', { unique: false });
      }

      // Extras store
      if (!db.objectStoreNames.contains('extras')) {
        db.createObjectStore('extras', { keyPath: 'id' });
      }

      // Orders store
      if (!db.objectStoreNames.contains('orders')) {
        const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
        orderStore.createIndex('orderNumber', 'orderNumber', { unique: false });
        orderStore.createIndex('date', 'date', { unique: false });
        orderStore.createIndex('status', 'status', { unique: false });
        orderStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Meta counters store (para número correlativo #0001, #0002...)
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = async (event) => {
      dbInstance = event.target.result;
      await seedInitialDataIfNeeded(dbInstance);
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('Error al abrir IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Sembrar datos iniciales si la BD está vacía
async function seedInitialDataIfNeeded(db) {
  const settingsCount = await countStoreItems(db, 'settings');
  if (settingsCount === 0) {
    const tx = db.transaction(['settings', 'categories', 'products', 'extras', 'meta'], 'readwrite');
    
    // Guardar settings
    tx.objectStore('settings').put(INITIAL_SETTINGS);

    // Guardar categorías
    const catStore = tx.objectStore('categories');
    INITIAL_CATEGORIES.forEach(cat => catStore.put(cat));

    // Guardar productos
    const prodStore = tx.objectStore('products');
    INITIAL_PRODUCTS.forEach(prod => prodStore.put(prod));

    // Guardar extras
    const extraStore = tx.objectStore('extras');
    INITIAL_EXTRAS.forEach(extra => extraStore.put(extra));

    // Guardar correlativo inicial
    tx.objectStore('meta').put({ key: 'orderSequence', nextVal: 1 });

    await new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    console.log('✅ Base de datos inicializada con productos y configuración inicial');
  }
}

function countStoreItems(db, storeName) {
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const countReq = store.count();
    countReq.onsuccess = () => resolve(countReq.result);
    countReq.onerror = () => resolve(0);
  });
}

// ----------------- MÉTODOS DE ACCESO -----------------

// CONFIGURACIÓN
export async function getSettings() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('settings', 'readonly');
    const req = tx.objectStore('settings').get('general');
    req.onsuccess = () => resolve(req.result || INITIAL_SETTINGS);
    req.onerror = () => resolve(INITIAL_SETTINGS);
  });
}

export async function saveSettings(settingsData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const dataToSave = { ...settingsData, key: 'general' };
    const req = store.put(dataToSave);
    req.onsuccess = () => resolve(dataToSave);
    req.onerror = () => reject(req.error);
  });
}

// CATEGORÍAS
export async function getCategories() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('categories', 'readonly');
    const req = tx.objectStore('categories').getAll();
    req.onsuccess = () => {
      const cats = req.result || [];
      cats.sort((a, b) => (a.order || 0) - (b.order || 0));
      resolve(cats);
    };
    req.onerror = () => resolve([]);
  });
}

// PRODUCTOS
export async function getProducts(categoryId = null) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('products', 'readonly');
    const store = tx.objectStore('products');
    let req;
    if (categoryId) {
      const idx = store.index('categoryId');
      req = idx.getAll(categoryId);
    } else {
      req = store.getAll();
    }
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

export async function getProductById(productId) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('products', 'readonly');
    const req = tx.objectStore('products').get(productId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

export async function saveProduct(product) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    const req = tx.objectStore('products').put(product);
    req.onsuccess = () => resolve(product);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteProduct(productId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    const req = tx.objectStore('products').delete(productId);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// EXTRAS
export async function getExtras() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('extras', 'readonly');
    const req = tx.objectStore('extras').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

export async function saveExtra(extra) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('extras', 'readwrite');
    const req = tx.objectStore('extras').put(extra);
    req.onsuccess = () => resolve(extra);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteExtra(extraId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('extras', 'readwrite');
    const req = tx.objectStore('extras').delete(extraId);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// CORRELATIVO DE PEDIDOS (#0001, #0002...)
export async function getNextOrderCorrelative() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite');
    const store = tx.objectStore('meta');
    const req = store.get('orderSequence');

    req.onsuccess = () => {
      let current = (req.result && req.result.nextVal) ? req.result.nextVal : 1;
      const formatted = String(current).padStart(4, '0');
      store.put({ key: 'orderSequence', nextVal: current + 1 });
      tx.oncomplete = () => resolve(formatted);
    };
    req.onerror = () => reject(req.error);
  });
}

// PEDIDOS
export async function saveOrder(order) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('orders', 'readwrite');
    const store = tx.objectStore('orders');
    const req = store.put(order);
    req.onsuccess = () => resolve(order);
    req.onerror = () => reject(req.error);
  });
}

export async function getOrderById(orderId) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('orders', 'readonly');
    const req = tx.objectStore('orders').get(orderId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

export async function getAllOrders() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('orders', 'readonly');
    const req = tx.objectStore('orders').getAll();
    req.onsuccess = () => {
      const orders = req.result || [];
      // Ordenar por fecha de creación descendente (más nuevos primero)
      orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(orders);
    };
    req.onerror = () => resolve([]);
  });
}

export async function updateOrderStatus(orderId, newStatus) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('orders', 'readwrite');
    const store = tx.objectStore('orders');
    const getReq = store.get(orderId);

    getReq.onsuccess = () => {
      const order = getReq.result;
      if (!order) return reject(new Error('Pedido no encontrado'));
      
      order.status = newStatus;
      if (!order.statusHistory) order.statusHistory = [];
      order.statusHistory.push({
        status: newStatus,
        timestamp: new Date().toISOString()
      });

      if (newStatus === 'entregado') {
        order.deliveredAt = new Date().toISOString();
      }

      const putReq = store.put(order);
      putReq.onsuccess = () => resolve(order);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function deleteOrder(orderId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('orders', 'readwrite');
    const req = tx.objectStore('orders').delete(orderId);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// COPIAS DE SEGURIDAD (EXPORTAR & IMPORTAR)
export async function exportAllData() {
  const db = await openDB();
  const stores = ['settings', 'categories', 'products', 'extras', 'orders', 'meta'];
  const backup = {
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    data: {}
  };

  for (const storeName of stores) {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    backup.data[storeName] = await new Promise((res) => {
      const req = store.getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });
  }

  return backup;
}

export async function importAllData(backupJson) {
  if (!backupJson || !backupJson.data) {
    throw new Error('Formato de copia de seguridad no válido');
  }
  const db = await openDB();
  const stores = ['settings', 'categories', 'products', 'extras', 'orders', 'meta'];

  for (const storeName of stores) {
    if (backupJson.data[storeName]) {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      for (const item of backupJson.data[storeName]) {
        store.put(item);
      }
      await new Promise((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    }
  }
  return true;
}

// REINICIAR A VALORES DE FÁBRICA
export async function resetDatabase() {
  const db = await openDB();
  const stores = ['settings', 'categories', 'products', 'extras', 'orders', 'meta'];
  for (const storeName of stores) {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    await new Promise((res) => {
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  }
  await seedInitialDataIfNeeded(db);
  return true;
}
