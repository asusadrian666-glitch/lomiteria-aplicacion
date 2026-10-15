// js/order.js - Motor de Toma de Pedidos, Personalización y Carrito
import { 
  getProducts, 
  getCategories, 
  getExtras, 
  saveOrder, 
  getNextOrderCorrelative, 
  getSettings,
  saveProduct
} from './db.js';
import { formatGs, renderTicket, shareOrderWhatsApp, printTicket, downloadTicketPDF } from './ticket.js';
import { showToast, triggerVibration, updateDailyStatsUI } from './app.js';

// Estado global de la sesión de pedido
export const orderState = {
  customer: {
    name: '',
    phone: '',
    type: 'delivery', // 'delivery' | 'retiro' | 'local'
    address: '',
    notes: ''
  },
  cart: [],
  deliveryFee: 5000,
  discount: 0,
  currentCategory: 'all',
  
  // Producto en proceso de personalización
  modalProduct: null,
  modalRemovedIngredients: [],
  modalExtras: {}, // { extraId: count }
  modalNotes: '',
  modalEditingCartItemId: null
};

// Inicializar vistas y listeners de pedido
export async function initOrderModule() {
  const settings = await getSettings();
  orderState.deliveryFee = settings.defaultDeliveryFee || 5000;

  setupCustomerFormListeners();
  await loadCategoriesNav();
  await renderProductGrid();
  setupModalListeners();
  updateCartUI();
}

// ----------------- FORMULARIO DE CLIENTE -----------------
function setupCustomerFormListeners() {
  const nameInput = document.getElementById('cust-name');
  const phoneInput = document.getElementById('cust-phone');
  const addressInput = document.getElementById('cust-address');
  const notesInput = document.getElementById('cust-notes');
  const addressGroup = document.getElementById('cust-address-group');
  const typeChips = document.querySelectorAll('.type-chip');

  if (nameInput) {
    nameInput.value = orderState.customer.name;
    nameInput.addEventListener('input', (e) => {
      orderState.customer.name = e.target.value;
    });
  }

  if (phoneInput) {
    phoneInput.value = orderState.customer.phone;
    phoneInput.addEventListener('input', (e) => {
      orderState.customer.phone = e.target.value;
    });
  }

  if (addressInput) {
    addressInput.value = orderState.customer.address;
    addressInput.addEventListener('input', (e) => {
      orderState.customer.address = e.target.value;
    });
  }

  if (notesInput) {
    notesInput.value = orderState.customer.notes;
    notesInput.addEventListener('input', (e) => {
      orderState.customer.notes = e.target.value;
    });
  }

  typeChips.forEach(chip => {
    chip.addEventListener('click', async () => {
      typeChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const selectedType = chip.dataset.type;
      orderState.customer.type = selectedType;

      const settings = await getSettings();
      if (selectedType === 'delivery') {
        if (addressGroup) addressGroup.style.display = 'block';
        orderState.deliveryFee = settings.defaultDeliveryFee || 5000;
      } else {
        if (addressGroup) addressGroup.style.display = 'none';
        orderState.deliveryFee = 0;
      }
      updateCartUI();
      triggerVibration(15);
    });
  });
}

// ----------------- NAVEGACIÓN POR CATEGORÍAS -----------------
export async function loadCategoriesNav() {
  const container = document.getElementById('category-scroll-nav');
  if (!container) return;

  const categories = await getCategories();
  
  let html = `
    <button class="cat-tab-btn ${orderState.currentCategory === 'all' ? 'active' : ''}" data-cat="all">
      ✨ Todos
    </button>
  `;

  categories.forEach(cat => {
    html += `
      <button class="cat-tab-btn ${orderState.currentCategory === cat.id ? 'active' : ''}" data-cat="${cat.id}">
        ${cat.icon || '🍔'} ${cat.name}
      </button>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.cat-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.cat-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      orderState.currentCategory = btn.dataset.cat;
      renderProductGrid();
      triggerVibration(15);
    });
  });
}

// ----------------- CATÁLOGO DE PRODUCTOS -----------------
export async function renderProductGrid() {
  const container = document.getElementById('products-list-container');
  if (!container) return;

  const products = await getProducts();
  const filtered = products.filter(p => {
    if (!p.active) return false;
    if (orderState.currentCategory === 'all') return true;
    return p.categoryId === orderState.currentCategory;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">
        <p style="font-size: 1.1rem; font-weight: 700;">No hay productos en esta categoría</p>
      </div>
    `;
    return;
  }

  let html = '';
  filtered.forEach(prod => {
    const isUnpriced = prod.price === null || !prod.priceConfigured;
    const priceDisplay = isUnpriced 
      ? `<span class="product-price-unconfigured">⚠️ Configurar precio</span>` 
      : `<span class="product-price">${formatGs(prod.price)}</span>`;

    const ingredientsText = prod.ingredients && prod.ingredients.length > 0 
      ? prod.ingredients.join(' • ') 
      : (prod.description || 'Delicioso producto recién preparado');

    const imageHtml = prod.image 
      ? `<img src="${prod.image}" alt="${prod.name}" class="product-img" loading="lazy" onerror="this.src='assets/logo.jpg'">`
      : `<span class="product-icon-fallback">${getCategoryEmoji(prod.categoryId)}</span>`;

    html += `
      <div class="product-card" data-id="${prod.id}">
        <div class="product-img-wrapper">
          ${imageHtml}
        </div>
        <div class="product-info">
          <div class="product-title">${prod.name}</div>
          <div class="product-ingredients-preview">${ingredientsText}</div>
          <div class="product-price-row">
            ${priceDisplay}
            <button class="btn-add-product" aria-label="Agregar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Click en producto
  container.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => {
      const prodId = card.dataset.id;
      const product = products.find(p => p.id === prodId);
      if (product) {
        handleProductClick(product);
      }
    });
  });
}

function getCategoryEmoji(catId) {
  switch (catId) {
    case 'hamburguesas': return '🍔';
    case 'lomitos': return '🥩';
    case 'lomitos_arabes': return '🌯';
    case 'papas': return '🍟';
    case 'bebidas_sin_alcohol': return '🥤';
    case 'bebidas_alcohol': return '🍺';
    default: return '🍽️';
  }
}

// ----------------- MANEJO DE CLIC EN PRODUCTO -----------------
async function handleProductClick(product) {
  triggerVibration(20);

  // 1. Si no tiene precio configurado (ej: Bebidas pendientes)
  if (product.price === null || !product.priceConfigured) {
    openQuickPriceModal(product);
    return;
  }

  // 2. Si es producto personalizable (Hamburguesas, Lomitos, Lomitos Árabes, Papas especiales)
  if (product.customizable) {
    openCustomizeModal(product);
  } else {
    // 3. Si no es personalizable (ej: Papas Chicas, Bebidas)
    addItemDirectlyToCart(product);
  }
}

// ----------------- CONFIGURADOR RÁPIDO DE PRECIO PARA BEBIDAS -----------------
function openQuickPriceModal(product) {
  const modal = document.getElementById('quick-price-modal');
  const title = document.getElementById('quick-price-prod-title');
  const input = document.getElementById('quick-price-input');
  const btnSave = document.getElementById('btn-save-quick-price');

  if (!modal || !input) return;

  title.textContent = product.name;
  input.value = '';
  modal.classList.add('active');
  setTimeout(() => input.focus(), 200);

  btnSave.onclick = async () => {
    const newPrice = parseInt(input.value, 10);
    if (isNaN(newPrice) || newPrice <= 0) {
      showToast('Por favor introduce un precio válido en Gs.', 'error');
      return;
    }

    product.price = newPrice;
    product.priceConfigured = true;
    await saveProduct(product);
    
    modal.classList.remove('active');
    showToast(`Precio asignado a ${product.name}: ${formatGs(newPrice)}`, 'success');
    await renderProductGrid();

    // Agregar de inmediato al carrito
    addItemDirectlyToCart(product);
  };
}

// ----------------- MODAL DE PERSONALIZACIÓN -----------------
export async function openCustomizeModal(product, existingCartItem = null) {
  orderState.modalProduct = product;
  orderState.modalEditingCartItemId = existingCartItem ? existingCartItem.cartItemId : null;
  orderState.modalRemovedIngredients = existingCartItem ? [...existingCartItem.removedIngredients] : [];
  orderState.modalNotes = existingCartItem ? existingCartItem.itemNotes : '';

  // Extras
  orderState.modalExtras = {};
  const allExtras = await getExtras();
  allExtras.filter(e => e.active).forEach(ext => {
    if (existingCartItem && existingCartItem.extras) {
      const match = existingCartItem.extras.find(e => e.id === ext.id);
      orderState.modalExtras[ext.id] = match ? match.count : 0;
    } else {
      orderState.modalExtras[ext.id] = 0;
    }
  });

  renderCustomizationSheet(allExtras);

  const modal = document.getElementById('customize-modal');
  if (modal) modal.classList.add('active');
}

function renderCustomizationSheet(allExtras) {
  const product = orderState.modalProduct;
  const titleEl = document.getElementById('custom-modal-title');
  const basePriceEl = document.getElementById('custom-modal-base-price');
  const ingredientsContainer = document.getElementById('custom-ingredients-list');
  const extrasContainer = document.getElementById('custom-extras-list');
  const notesInput = document.getElementById('custom-item-notes');

  if (titleEl) titleEl.textContent = product.name;
  if (basePriceEl) basePriceEl.textContent = formatGs(product.price);
  if (notesInput) notesInput.value = orderState.modalNotes;

  // Lista de ingredientes para quitar
  if (ingredientsContainer) {
    if (product.ingredients && product.ingredients.length > 0) {
      let ingHtml = '';
      product.ingredients.forEach(ing => {
        const isRemoved = orderState.modalRemovedIngredients.includes(ing);
        ingHtml += `
          <button type="button" class="ingredient-chip ${isRemoved ? 'removed' : ''}" data-ing="${ing}">
            ${isRemoved ? '❌ Sin ' + ing : '✓ ' + ing}
          </button>
        `;
      });
      ingredientsContainer.innerHTML = ingHtml;

      ingredientsContainer.querySelectorAll('.ingredient-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const ing = btn.dataset.ing;
          const idx = orderState.modalRemovedIngredients.indexOf(ing);
          if (idx > -1) {
            orderState.modalRemovedIngredients.splice(idx, 1);
            btn.classList.remove('removed');
            btn.textContent = '✓ ' + ing;
          } else {
            orderState.modalRemovedIngredients.push(ing);
            btn.classList.add('removed');
            btn.textContent = '❌ Sin ' + ing;
          }
          triggerVibration(15);
        });
      });
    } else {
      ingredientsContainer.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-muted);">Sin ingredientes configurados para retirar.</p>`;
    }
  }

  // Lista de Extras con Steppers (+ / -)
  if (extrasContainer) {
    let extHtml = '';
    allExtras.filter(e => e.active).forEach(ext => {
      const currentCount = orderState.modalExtras[ext.id] || 0;
      extHtml += `
        <div class="extra-row" data-ext-id="${ext.id}">
          <div class="extra-info">
            <span class="extra-name">${ext.name}</span>
            <span class="extra-price">+${formatGs(ext.price)}</span>
          </div>
          <div class="stepper">
            <button type="button" class="stepper-btn btn-minus" data-id="${ext.id}">−</button>
            <span class="stepper-count ${currentCount > 0 ? 'has-items' : ''}" id="extra-count-${ext.id}">${currentCount}</span>
            <button type="button" class="stepper-btn btn-plus" data-id="${ext.id}">+</button>
          </div>
        </div>
      `;
    });
    extrasContainer.innerHTML = extHtml;

    extrasContainer.querySelectorAll('.btn-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (orderState.modalExtras[id] > 0) {
          orderState.modalExtras[id]--;
          updateExtraDisplay(id, allExtras);
          triggerVibration(15);
        }
      });
    });

    extrasContainer.querySelectorAll('.btn-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        orderState.modalExtras[id] = (orderState.modalExtras[id] || 0) + 1;
        updateExtraDisplay(id, allExtras);
        triggerVibration(15);
      });
    });
  }

  updateCustomSubtotal(allExtras);
}

function updateExtraDisplay(id, allExtras) {
  const countEl = document.getElementById(`extra-count-${id}`);
  const count = orderState.modalExtras[id] || 0;
  if (countEl) {
    countEl.textContent = count;
    if (count > 0) countEl.classList.add('has-items');
    else countEl.classList.remove('has-items');
  }
  updateCustomSubtotal(allExtras);
}

function updateCustomSubtotal(allExtras) {
  const product = orderState.modalProduct;
  let totalExtras = 0;
  allExtras.forEach(ext => {
    const count = orderState.modalExtras[ext.id] || 0;
    totalExtras += ext.price * count;
  });

  const subtotal = (product.price || 0) + totalExtras;
  const subtotalEl = document.getElementById('custom-modal-subtotal');
  if (subtotalEl) {
    subtotalEl.textContent = formatGs(subtotal);
  }
}

function setupModalListeners() {
  const modal = document.getElementById('customize-modal');
  const closeBtn = document.getElementById('close-customize-modal');
  const addBtn = document.getElementById('btn-add-customized-item');
  const notesInput = document.getElementById('custom-item-notes');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  if (addBtn && modal) {
    addBtn.addEventListener('click', async () => {
      const allExtras = await getExtras();
      const product = orderState.modalProduct;
      const notes = notesInput ? notesInput.value.trim() : '';

      // Compilar lista de extras seleccionados con count > 0
      const selectedExtras = [];
      let extrasCost = 0;
      allExtras.forEach(ext => {
        const count = orderState.modalExtras[ext.id] || 0;
        if (count > 0) {
          selectedExtras.push({
            id: ext.id,
            name: ext.name,
            price: ext.price,
            count: count
          });
          extrasCost += ext.price * count;
        }
      });

      const unitPriceWithExtras = product.price + extrasCost;

      if (orderState.modalEditingCartItemId) {
        // Actualizar item existente
        const item = orderState.cart.find(i => i.cartItemId === orderState.modalEditingCartItemId);
        if (item) {
          item.removedIngredients = [...orderState.modalRemovedIngredients];
          item.extras = selectedExtras;
          item.itemNotes = notes;
          item.unitPrice = unitPriceWithExtras;
          item.subtotal = unitPriceWithExtras * item.quantity;
          showToast(`Producto actualizado`, 'success');
        }
      } else {
        // IMPORTANTE: Cada producto personalizado se crea como un ítem independiente en el carrito con su propio ID
        const newItem = {
          cartItemId: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          productId: product.id,
          name: product.name,
          basePrice: product.price,
          unitPrice: unitPriceWithExtras,
          quantity: 1,
          removedIngredients: [...orderState.modalRemovedIngredients],
          extras: selectedExtras,
          itemNotes: notes,
          subtotal: unitPriceWithExtras
        };
        orderState.cart.push(newItem);
        showToast(`Agregado al pedido: ${product.name}`, 'success');
      }

      modal.classList.remove('active');
      triggerVibration(40);
      updateCartUI();
    });
  }

  // Modales adicionales (Quick Price, Cart)
  const quickPriceModal = document.getElementById('quick-price-modal');
  const closeQuickPrice = document.getElementById('close-quick-price-modal');
  if (closeQuickPrice && quickPriceModal) {
    closeQuickPrice.addEventListener('click', () => quickPriceModal.classList.remove('active'));
  }

  const cartModal = document.getElementById('cart-modal');
  const closeCart = document.getElementById('close-cart-modal');
  if (closeCart && cartModal) {
    closeCart.addEventListener('click', () => cartModal.classList.remove('active'));
  }

  // Floating Cart Bar Clic
  const floatCart = document.getElementById('floating-cart-bar');
  if (floatCart && cartModal) {
    floatCart.addEventListener('click', () => {
      openCartDrawer();
    });
  }

  // Botón Vaciar Carrito
  const clearCartBtn = document.getElementById('btn-clear-cart');
  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', () => {
      if (orderState.cart.length === 0) return;
      if (confirm('¿Deseas vaciar todos los productos del carrito?')) {
        orderState.cart = [];
        updateCartUI();
        showToast('Carrito vaciado', 'info');
      }
    });
  }

  // Confirmar Pedido
  const confirmOrderBtn = document.getElementById('btn-confirm-order');
  if (confirmOrderBtn) {
    confirmOrderBtn.addEventListener('click', handleConfirmOrder);
  }
}

// ----------------- AGREGAR PRODUCTO NO PERSONALIZABLE DIRECTAMENTE -----------------
function addItemDirectlyToCart(product) {
  // Para productos sin ingredientes como bebidas o papas simples, si ya existe exactamente igual sin notas se puede sumar cantidad
  const existing = orderState.cart.find(i => 
    i.productId === product.id && 
    (!i.removedIngredients || i.removedIngredients.length === 0) &&
    (!i.extras || i.extras.length === 0) &&
    (!i.itemNotes || i.itemNotes === '')
  );

  if (existing) {
    existing.quantity++;
    existing.subtotal = existing.unitPrice * existing.quantity;
  } else {
    orderState.cart.push({
      cartItemId: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      productId: product.id,
      name: product.name,
      basePrice: product.price,
      unitPrice: product.price,
      quantity: 1,
      removedIngredients: [],
      extras: [],
      itemNotes: '',
      subtotal: product.price
    });
  }

  showToast(`+1 ${product.name}`, 'success');
  triggerVibration(25);
  updateCartUI();
}

// ----------------- ACTUALIZACIÓN Y CÁLCULO DEL CARRITO -----------------
export function updateCartUI() {
  const totalItemsCount = orderState.cart.reduce((sum, item) => sum + item.quantity, 0);
  const productsSubtotal = orderState.cart.reduce((sum, item) => sum + item.subtotal, 0);

  // Subtotal productos + costo de delivery - descuento = TOTAL (no negativo)
  const delivery = orderState.customer.type === 'delivery' ? (Number(orderState.deliveryFee) || 0) : 0;
  const discount = Number(orderState.discount) || 0;
  const grandTotal = Math.max(0, productsSubtotal + delivery - discount);

  // 1. Barra Flotante
  const floatCart = document.getElementById('floating-cart-bar');
  const floatCount = document.getElementById('float-cart-count');
  const floatTotal = document.getElementById('float-cart-total');

  if (floatCart) {
    if (totalItemsCount > 0) {
      floatCart.classList.remove('hidden');
      if (floatCount) floatCount.textContent = totalItemsCount;
      if (floatTotal) floatTotal.textContent = formatGs(grandTotal);
    } else {
      floatCart.classList.add('hidden');
    }
  }

  // 2. Drawer / Modal de Carrito
  renderCartDrawerContent(productsSubtotal, delivery, discount, grandTotal);
}

export function openCartDrawer() {
  updateCartUI();
  const cartModal = document.getElementById('cart-modal');
  if (cartModal) cartModal.classList.add('active');
}

function renderCartDrawerContent(productsSubtotal, delivery, discount, grandTotal) {
  const container = document.getElementById('cart-items-container');
  const subtotalEl = document.getElementById('cart-summary-subtotal');
  const deliveryInput = document.getElementById('cart-summary-delivery');
  const discountInput = document.getElementById('cart-summary-discount');
  const totalEl = document.getElementById('cart-summary-total');
  const deliveryRow = document.getElementById('cart-delivery-row');

  if (subtotalEl) subtotalEl.textContent = formatGs(productsSubtotal);
  if (totalEl) totalEl.textContent = formatGs(grandTotal);

  if (deliveryRow) {
    deliveryRow.style.display = orderState.customer.type === 'delivery' ? 'flex' : 'none';
  }

  if (deliveryInput) {
    deliveryInput.value = orderState.deliveryFee;
    deliveryInput.oninput = (e) => {
      const val = parseInt(e.target.value, 10);
      orderState.deliveryFee = isNaN(val) ? 0 : Math.max(0, val);
      updateCartUI();
    };
  }

  if (discountInput) {
    discountInput.value = orderState.discount;
    discountInput.oninput = (e) => {
      const val = parseInt(e.target.value, 10);
      orderState.discount = isNaN(val) ? 0 : Math.max(0, val);
      updateCartUI();
    };
  }

  if (!container) return;

  if (orderState.cart.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">
        <p style="font-size: 2.2rem; margin-bottom: 8px;">🛒</p>
        <p style="font-size: 1rem; font-weight: 700;">Tu carrito está vacío</p>
        <p style="font-size: 0.8rem; margin-top: 4px;">Selecciona productos del menú para comenzar</p>
      </div>
    `;
    return;
  }

  let html = '';
  orderState.cart.forEach(item => {
    let customSummary = '';

    if (item.removedIngredients && item.removedIngredients.length > 0) {
      customSummary += `<div class="cart-item-removed">❌ Sin: ${item.removedIngredients.join(', ')}</div>`;
    }

    if (item.extras && item.extras.length > 0) {
      const extrasStr = item.extras.map(e => `+${e.count}x ${e.name} (${formatGs(e.price * e.count)})`).join(', ');
      customSummary += `<div class="cart-item-extras">✨ ${extrasStr}</div>`;
    }

    if (item.itemNotes && item.itemNotes.trim() !== '') {
      customSummary += `<div class="cart-item-notes">📝 Obs: ${item.itemNotes}</div>`;
    }

    html += `
      <div class="cart-item-card" data-cart-id="${item.cartItemId}">
        <div class="cart-item-header">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-price">${formatGs(item.subtotal)}</div>
        </div>

        ${customSummary ? `<div class="cart-item-customizations">${customSummary}</div>` : ''}

        <div class="cart-item-footer">
          <div class="cart-item-actions">
            <button class="btn-delete-item" data-cart-id="${item.cartItemId}" title="Eliminar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
            <button class="btn-edit-item" data-cart-id="${item.cartItemId}" style="background:none; border:none; color:var(--accent-gold); font-size:0.75rem; font-weight:700; cursor:pointer;">
              ✏️ Editar
            </button>
          </div>

          <div class="stepper">
            <button class="stepper-btn btn-cart-minus" data-cart-id="${item.cartItemId}">−</button>
            <span class="stepper-count">${item.quantity}</span>
            <button class="stepper-btn btn-cart-plus" data-cart-id="${item.cartItemId}">+</button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Listeners de cantidad y borrado
  container.querySelectorAll('.btn-cart-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.cartId;
      const item = orderState.cart.find(i => i.cartItemId === id);
      if (item) {
        if (item.quantity > 1) {
          item.quantity--;
          item.subtotal = item.unitPrice * item.quantity;
        } else {
          orderState.cart = orderState.cart.filter(i => i.cartItemId !== id);
        }
        triggerVibration(15);
        updateCartUI();
      }
    });
  });

  container.querySelectorAll('.btn-cart-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.cartId;
      const item = orderState.cart.find(i => i.cartItemId === id);
      if (item) {
        item.quantity++;
        item.subtotal = item.unitPrice * item.quantity;
        triggerVibration(15);
        updateCartUI();
      }
    });
  });

  container.querySelectorAll('.btn-delete-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.cartId;
      orderState.cart = orderState.cart.filter(i => i.cartItemId !== id);
      triggerVibration(20);
      updateCartUI();
    });
  });

  container.querySelectorAll('.btn-edit-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.cartId;
      const item = orderState.cart.find(i => i.cartItemId === id);
      if (item) {
        const products = await getProducts();
        const prod = products.find(p => p.id === item.productId);
        if (prod) {
          document.getElementById('cart-modal').classList.remove('active');
          openCustomizeModal(prod, item);
        }
      }
    });
  });
}

// ----------------- CONFIRMACIÓN Y REGISTRO DEL PEDIDO -----------------
async function handleConfirmOrder() {
  if (orderState.cart.length === 0) {
    showToast('El carrito está vacío. Agrega productos al pedido.', 'error');
    return;
  }

  const custName = (orderState.customer.name || '').trim();
  if (!custName) {
    showToast('Por favor escribe el nombre del cliente.', 'error');
    const nameInput = document.getElementById('cust-name');
    if (nameInput) {
      nameInput.focus();
      document.getElementById('cart-modal').classList.remove('active');
    }
    return;
  }

  if (orderState.customer.type === 'delivery' && !(orderState.customer.address || '').trim()) {
    showToast('Por favor escribe la dirección de entrega para el delivery.', 'error');
    const addressInput = document.getElementById('cust-address');
    if (addressInput) {
      addressInput.focus();
      document.getElementById('cart-modal').classList.remove('active');
    }
    return;
  }

  // Generar correlativo #0001, #0002...
  const orderNumber = await getNextOrderCorrelative();
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

  const productsSubtotal = orderState.cart.reduce((sum, item) => sum + item.subtotal, 0);
  const delivery = orderState.customer.type === 'delivery' ? (Number(orderState.deliveryFee) || 0) : 0;
  const discount = Number(orderState.discount) || 0;
  const grandTotal = Math.max(0, productsSubtotal + delivery - discount);

  // Crear objeto del pedido
  const newOrder = {
    id: 'ord_' + Date.now(),
    orderNumber: orderNumber,
    createdAt: now.toISOString(),
    date: dateStr,
    time: timeStr,
    customerName: custName,
    customerPhone: orderState.customer.phone.trim(),
    orderType: orderState.customer.type,
    deliveryAddress: orderState.customer.type === 'delivery' ? orderState.customer.address.trim() : '',
    notes: orderState.customer.notes.trim(),
    items: JSON.parse(JSON.stringify(orderState.cart)),
    subtotal: productsSubtotal,
    deliveryFee: delivery,
    discount: discount,
    total: grandTotal,
    status: 'pendiente',
    statusHistory: [
      { status: 'pendiente', timestamp: now.toISOString() }
    ]
  };

  // Guardar en IndexedDB
  await saveOrder(newOrder);

  // Feedback al usuario
  triggerVibration(80);
  showToast(`✅ Pedido #${orderNumber} registrado exitosamente`, 'success');

  // Limpiar carrito y formulario para el próximo pedido
  resetOrderForm();
  document.getElementById('cart-modal').classList.remove('active');
  updateCartUI();
  updateDailyStatsUI();

  // Abrir modal con el comprobante / ticket
  openOrderTicketModal(newOrder);
}

export function resetOrderForm() {
  orderState.cart = [];
  orderState.customer = {
    name: '',
    phone: '',
    type: 'delivery',
    address: '',
    notes: ''
  };
  orderState.discount = 0;

  const nameInput = document.getElementById('cust-name');
  const phoneInput = document.getElementById('cust-phone');
  const addressInput = document.getElementById('cust-address');
  const notesInput = document.getElementById('cust-notes');
  if (nameInput) nameInput.value = '';
  if (phoneInput) phoneInput.value = '';
  if (addressInput) addressInput.value = '';
  if (notesInput) notesInput.value = '';
}

// ----------------- MODAL DE COMPROBANTE DE PEDIDO -----------------
export async function openOrderTicketModal(order) {
  const modal = document.getElementById('ticket-modal');
  const container = document.getElementById('ticket-content-container');
  const btnPdf = document.getElementById('btn-ticket-pdf');
  const btnWa = document.getElementById('btn-ticket-wa');
  const btnPrint = document.getElementById('btn-ticket-print');
  const closeBtn = document.getElementById('close-ticket-modal');

  if (!modal || !container) return;

  await renderTicket(order, container);
  modal.classList.add('active');

  if (btnPdf) btnPdf.onclick = () => downloadTicketPDF(order);
  if (btnWa) btnWa.onclick = () => shareOrderWhatsApp(order);
  if (btnPrint) btnPrint.onclick = () => printTicket(order);
  if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');
}
