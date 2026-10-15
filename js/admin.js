// js/admin.js - Sección Administrativa y Configuración
import { 
  getSettings, 
  saveSettings, 
  getProducts, 
  saveProduct, 
  deleteProduct, 
  getExtras, 
  saveExtra, 
  deleteExtra, 
  getCategories,
  exportAllData,
  importAllData,
  resetDatabase
} from './db.js';
import { formatGs } from './ticket.js';
import { renderProductGrid, loadCategoriesNav } from './order.js';
import { showToast, triggerVibration, updateStoreBrandUI } from './app.js';

let activeAdminTab = 'store'; // 'store' | 'beverages' | 'products' | 'extras' | 'backup' | 'github'

export async function initAdminModule() {
  setupAdminNav();
  await loadStoreSettings();
  await loadBeveragesAdmin();
  await loadProductsAdmin();
  await loadExtrasAdmin();
  setupBackupHandlers();
}

function setupAdminNav() {
  const container = document.getElementById('admin-tab-nav');
  if (!container) return;

  container.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeAdminTab = btn.dataset.tab;

      document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
      const targetContent = document.getElementById(`admin-tab-${activeAdminTab}`);
      if (targetContent) targetContent.style.display = 'block';

      triggerVibration(15);
    });
  });
}

// ----------------- 1. DATOS DE LA LOMITERÍA & LOGO -----------------
async function loadStoreSettings() {
  const settings = await getSettings();

  const nameInput = document.getElementById('setting-store-name');
  const sloganInput = document.getElementById('setting-store-slogan');
  const phoneInput = document.getElementById('setting-store-phone');
  const addressInput = document.getElementById('setting-store-address');
  const deliveryInput = document.getElementById('setting-store-delivery');
  const footerInput = document.getElementById('setting-store-footer');
  const logoPreview = document.getElementById('setting-logo-preview');
  const logoFileInput = document.getElementById('setting-logo-file');
  const btnSave = document.getElementById('btn-save-store-settings');

  if (nameInput) nameInput.value = settings.storeName || '';
  if (sloganInput) sloganInput.value = settings.storeSlogan || '';
  if (phoneInput) phoneInput.value = settings.storePhone || '';
  if (addressInput) addressInput.value = settings.storeAddress || '';
  if (deliveryInput) deliveryInput.value = settings.defaultDeliveryFee || 5000;
  if (footerInput) footerInput.value = settings.ticketFooter || '';
  if (logoPreview && settings.logoUrl) logoPreview.src = settings.logoUrl;

  // Manejo de carga de imagen de logotipo (convertido a Base64)
  if (logoFileInput) {
    logoFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          showToast('La imagen es muy pesada. Máximo 2MB.', 'error');
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          if (logoPreview) logoPreview.src = event.target.result;
          settings.logoUrl = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    };
  }

  if (btnSave) {
    btnSave.onclick = async () => {
      const updated = {
        ...settings,
        storeName: (nameInput ? nameInput.value.trim() : '') || 'FUEGO Lomitería',
        storeSlogan: sloganInput ? sloganInput.value.trim() : '',
        storePhone: phoneInput ? phoneInput.value.trim() : '',
        storeAddress: addressInput ? addressInput.value.trim() : '',
        defaultDeliveryFee: deliveryInput ? (parseInt(deliveryInput.value, 10) || 0) : 5000,
        ticketFooter: footerInput ? footerInput.value.trim() : '',
        logoUrl: logoPreview ? logoPreview.src : settings.logoUrl
      };

      await saveSettings(updated);
      showToast('Configuración general guardada', 'success');
      triggerVibration(40);
      updateStoreBrandUI();
    };
  }
}

// ----------------- 2. CONFIGURACIÓN RÁPIDA DE BEBIDAS -----------------
export async function loadBeveragesAdmin() {
  const container = document.getElementById('admin-beverages-container');
  const btnSaveAll = document.getElementById('btn-save-all-beverages');
  if (!container) return;

  const products = await getProducts();
  const beverages = products.filter(p => p.categoryId === 'bebidas_sin_alcohol' || p.categoryId === 'bebidas_alcohol');

  let html = '';
  beverages.forEach(bev => {
    const isUnpriced = (bev.price === null || !bev.priceConfigured);
    html += `
      <div class="beverage-row" data-id="${bev.id}">
        <div style="display:flex; flex-direction:column; gap:2px; flex:1;">
          <div class="beverage-name">${bev.name}</div>
          <div>
            ${isUnpriced 
              ? `<span class="badge-unconfigured-pill">⚠️ Sin precio asignado</span>` 
              : `<span style="font-size:0.75rem; color:var(--accent-gold); font-weight:700;">Actual: ${formatGs(bev.price)}</span>`}
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <input type="number" 
                 class="beverage-price-input" 
                 placeholder="Ej: 8000" 
                 value="${bev.price !== null ? bev.price : ''}"
                 data-id="${bev.id}">
          <span style="font-size:0.8rem; font-weight:700; color:var(--text-secondary);">Gs.</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  if (btnSaveAll) {
    btnSaveAll.onclick = async () => {
      let updatedCount = 0;
      const inputs = container.querySelectorAll('.beverage-price-input');
      
      for (const input of inputs) {
        const prodId = input.dataset.id;
        const val = input.value.trim();
        if (val !== '') {
          const num = parseInt(val, 10);
          if (!isNaN(num) && num > 0) {
            const prod = beverages.find(b => b.id === prodId);
            if (prod) {
              prod.price = num;
              prod.priceConfigured = true;
              await saveProduct(prod);
              updatedCount++;
            }
          }
        }
      }

      showToast(`Se actualizaron los precios de ${updatedCount} bebidas`, 'success');
      triggerVibration(40);
      await loadBeveragesAdmin();
      await renderProductGrid();
    };
  }
}

// ----------------- 3. GESTIÓN DE PRODUCTOS DEL CATÁLOGO -----------------
export async function loadProductsAdmin() {
  const container = document.getElementById('admin-products-list');
  const btnNewProduct = document.getElementById('btn-admin-add-product');
  if (!container) return;

  const products = await getProducts();
  const categories = await getCategories();

  let html = '';
  products.forEach(p => {
    const cat = categories.find(c => c.id === p.categoryId);
    const catName = cat ? cat.name : p.categoryId;
    const priceText = (p.price === null || !p.priceConfigured) ? '⚠️ Pendiente' : formatGs(p.price);

    html += `
      <div class="card" style="padding:12px; margin-bottom:8px; display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:800; font-size:0.95rem;">${p.name}</div>
            <div style="font-size:0.75rem; color:var(--accent-gold); font-weight:600;">📁 ${catName}</div>
          </div>
          <div style="font-weight:900; font-size:0.95rem; color:${(p.price === null || !p.priceConfigured) ? 'var(--status-pendiente)' : '#FFFFFF'};">
            ${priceText}
          </div>
        </div>

        <div style="font-size:0.74rem; color:var(--text-secondary);">
          ${p.ingredients && p.ingredients.length > 0 ? p.ingredients.join(', ') : 'Sin ingredientes configurados'}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
          <label style="font-size:0.76rem; font-weight:700; color:var(--text-secondary); display:flex; align-items:center; gap:6px;">
            <input type="checkbox" class="chk-prod-active" data-id="${p.id}" ${p.active ? 'checked' : ''}>
            ${p.active ? 'Activo en el menú' : 'Desactivado'}
          </label>
          <div style="display:flex; gap:8px;">
            <button class="btn-edit-prod" data-id="${p.id}" style="background:var(--bg-elevated); border:1px solid var(--border-subtle); color:var(--accent-gold); padding:5px 10px; border-radius:4px; font-size:0.75rem; font-weight:700; cursor:pointer;">
              ✏️ Editar
            </button>
            <button class="btn-del-prod" data-id="${p.id}" style="background:none; border:1px solid rgba(239,68,68,0.3); color:#EF4444; padding:5px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer;">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Toggle activo
  container.querySelectorAll('.chk-prod-active').forEach(chk => {
    chk.onchange = async () => {
      const prod = products.find(p => p.id === chk.dataset.id);
      if (prod) {
        prod.active = chk.checked;
        await saveProduct(prod);
        showToast(prod.active ? `${prod.name} activado` : `${prod.name} desactivado`, 'info');
        await renderProductGrid();
      }
    };
  });

  // Editar producto
  container.querySelectorAll('.btn-edit-prod').forEach(btn => {
    btn.onclick = () => {
      const prod = products.find(p => p.id === btn.dataset.id);
      if (prod) openProductEditModal(prod);
    };
  });

  // Eliminar producto
  container.querySelectorAll('.btn-del-prod').forEach(btn => {
    btn.onclick = async () => {
      const prod = products.find(p => p.id === btn.dataset.id);
      if (prod && confirm(`¿Deseas eliminar permanentemente "${prod.name}"?`)) {
        await deleteProduct(prod.id);
        showToast(`Producto eliminado`, 'success');
        await loadProductsAdmin();
        await renderProductGrid();
      }
    };
  });

  if (btnNewProduct) {
    btnNewProduct.onclick = () => openProductEditModal(null);
  }
}

// Modal Crear/Editar Producto
function openProductEditModal(product) {
  const modal = document.getElementById('product-edit-modal');
  const title = document.getElementById('prod-edit-modal-title');
  const nameInput = document.getElementById('edit-prod-name');
  const catSelect = document.getElementById('edit-prod-category');
  const priceInput = document.getElementById('edit-prod-price');
  const ingredientsInput = document.getElementById('edit-prod-ingredients');
  const chkCustomizable = document.getElementById('edit-prod-customizable');
  const btnSave = document.getElementById('btn-save-prod-modal');
  const closeBtn = document.getElementById('close-product-edit-modal');

  if (!modal) return;

  const isEditing = !!product;
  title.textContent = isEditing ? `Editar: ${product.name}` : 'Nuevo Producto';

  if (nameInput) nameInput.value = isEditing ? product.name : '';
  if (priceInput) priceInput.value = (isEditing && product.price !== null) ? product.price : '';
  if (ingredientsInput) ingredientsInput.value = (isEditing && product.ingredients) ? product.ingredients.join(', ') : '';
  if (chkCustomizable) chkCustomizable.checked = isEditing ? !!product.customizable : true;

  // Llenar select de categorías
  if (catSelect) {
    getCategories().then(cats => {
      catSelect.innerHTML = cats.map(c => 
        `<option value="${c.id}" ${isEditing && product.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`
      ).join('');
    });
  }

  modal.classList.add('active');

  btnSave.onclick = async () => {
    const name = nameInput.value.trim();
    if (!name) {
      showToast('Escribe el nombre del producto', 'error');
      return;
    }

    const priceVal = priceInput.value.trim();
    const price = priceVal !== '' ? parseInt(priceVal, 10) : null;
    const ingredients = ingredientsInput.value
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const categoryId = catSelect.value;
    const customizable = chkCustomizable.checked;

    const prodToSave = {
      id: isEditing ? product.id : ('prod_' + Date.now()),
      categoryId: categoryId,
      name: name,
      price: price,
      priceConfigured: (price !== null && !isNaN(price)),
      customizable: customizable,
      ingredients: ingredients,
      image: isEditing ? (product.image || '') : '',
      active: isEditing ? product.active : true
    };

    await saveProduct(prodToSave);
    modal.classList.remove('active');
    showToast(isEditing ? 'Producto actualizado' : 'Producto creado con éxito', 'success');
    triggerVibration(35);
    await loadProductsAdmin();
    await renderProductGrid();
  };

  if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');
}

// ----------------- 4. GESTIÓN DE AGREGADOS EXTRAS -----------------
export async function loadExtrasAdmin() {
  const container = document.getElementById('admin-extras-list');
  const btnNewExtra = document.getElementById('btn-admin-add-extra');
  if (!container) return;

  const extras = await getExtras();

  let html = '';
  extras.forEach(ext => {
    html += `
      <div class="card" style="padding:10px 14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:800; font-size:0.95rem;">${ext.name}</div>
          <div style="font-weight:700; color:var(--accent-gold); font-size:0.85rem;">+${formatGs(ext.price)}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-edit-extra" data-id="${ext.id}" style="background:var(--bg-elevated); border:1px solid var(--border-subtle); color:var(--accent-gold); padding:6px 12px; border-radius:4px; font-size:0.75rem; font-weight:700; cursor:pointer;">
            ✏️ Modificar
          </button>
          <button class="btn-del-extra" data-id="${ext.id}" style="background:none; border:1px solid rgba(239,68,68,0.3); color:#EF4444; padding:6px 10px; border-radius:4px; font-size:0.75rem; cursor:pointer;">
            🗑️
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.btn-edit-extra').forEach(btn => {
    btn.onclick = () => {
      const ext = extras.find(e => e.id === btn.dataset.id);
      if (ext) openExtraEditPrompt(ext);
    };
  });

  container.querySelectorAll('.btn-del-extra').forEach(btn => {
    btn.onclick = async () => {
      const ext = extras.find(e => e.id === btn.dataset.id);
      if (ext && confirm(`¿Deseas eliminar el extra "${ext.name}"?`)) {
        await deleteExtra(ext.id);
        showToast('Extra eliminado', 'success');
        await loadExtrasAdmin();
      }
    };
  });

  if (btnNewExtra) {
    btnNewExtra.onclick = () => openExtraEditPrompt(null);
  }
}

async function openExtraEditPrompt(existingExtra) {
  const isEditing = !!existingExtra;
  const currentName = isEditing ? existingExtra.name : '';
  const currentPrice = isEditing ? existingExtra.price : '';

  const name = prompt(isEditing ? 'Modificar nombre del extra:' : 'Nombre del nuevo agregado extra:', currentName);
  if (!name || !name.trim()) return;

  const priceStr = prompt('Precio en Guaraníes (Gs.):', currentPrice || '5000');
  const price = parseInt(priceStr, 10);
  if (isNaN(price) || price < 0) {
    showToast('Precio inválido', 'error');
    return;
  }

  const extraToSave = {
    id: isEditing ? existingExtra.id : ('extra_' + Date.now()),
    name: name.trim(),
    price: price,
    active: true
  };

  await saveExtra(extraToSave);
  showToast(isEditing ? 'Extra actualizado' : 'Extra creado', 'success');
  await loadExtrasAdmin();
}

// ----------------- 5. COPIAS DE SEGURIDAD Y RESTAURACIÓN -----------------
function setupBackupHandlers() {
  const btnDownloadBackup = document.getElementById('btn-download-backup');
  const fileInputRestore = document.getElementById('file-restore-backup');
  const btnResetDefaults = document.getElementById('btn-reset-factory-defaults');

  if (btnDownloadBackup) {
    btnDownloadBackup.onclick = async () => {
      const backupData = await exportAllData();
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CopiaSeguridad_Lomiteria_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Copia de seguridad descargada exitosamente', 'success');
    };
  }

  if (fileInputRestore) {
    fileInputRestore.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (confirm('⚠️ ATENCIÓN: Al restaurar esta copia se sobreescribirán los datos actuales. ¿Deseas continuar?')) {
            await importAllData(parsed);
            showToast('✅ Información restaurada exitosamente', 'success');
            setTimeout(() => window.location.reload(), 1000);
          }
        } catch (err) {
          showToast('Error: archivo JSON inválido', 'error');
        }
      };
      reader.readAsText(file);
    };
  }

  if (btnResetDefaults) {
    btnResetDefaults.onclick = async () => {
      if (confirm('⚠️ ¿Estás seguro de restablecer todos los productos y datos a los valores de fábrica iniciales?')) {
        await resetDatabase();
        showToast('Datos reiniciados a valores de fábrica', 'info');
        setTimeout(() => window.location.reload(), 800);
      }
    };
  }
}
