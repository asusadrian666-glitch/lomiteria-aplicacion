// js/app.js - Orquestador Principal y Enrutador de la PWA
import { initPWA, promptPWAInstall } from './pwa.js';
import { getSettings, getAllOrders } from './db.js';
import { formatGs } from './ticket.js';
import { initOrderModule, renderProductGrid, openCartDrawer, resetOrderForm } from './order.js';
import { initOrdersView, renderActiveOrders } from './orders-view.js';
import { initHistoryView, renderHistory } from './history-view.js';
import { initAdminModule } from './admin.js';

let currentActiveView = 'home';

document.addEventListener('DOMContentLoaded', async () => {
  // Inicializar PWA
  initPWA();

  // Iniciar reloj y datos de marca
  startLiveClock();
  await updateStoreBrandUI();
  await updateDailyStatsUI();

  // Inicializar módulos
  await initOrderModule();
  await initOrdersView();
  await initHistoryView();
  await initAdminModule();

  // Configurar navegación
  setupNavigation();

  // Configurar botón instalar PWA
  const btnInstall = document.getElementById('btn-install-pwa');
  if (btnInstall) {
    btnInstall.onclick = () => promptPWAInstall();
  }
});

// ----------------- ENRUTADOR DE VISTAS -----------------
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const viewSections = document.querySelectorAll('.view-section');

  window.navigateToView = (viewId) => {
    currentActiveView = viewId;

    // Actualizar secciones
    viewSections.forEach(section => {
      if (section.id === `view-${viewId}`) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });

    // Actualizar barra inferior
    navItems.forEach(item => {
      if (item.dataset.view === viewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Desplazarse arriba
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Actualizar datos de la vista recién abierta
    if (viewId === 'home') {
      updateDailyStatsUI();
    } else if (viewId === 'orders') {
      renderActiveOrders();
    } else if (viewId === 'history') {
      renderHistory();
    } else if (viewId === 'new-order') {
      renderProductGrid();
    }

    triggerVibration(15);
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (view) window.navigateToView(view);
    });
  });

  // Botones de acceso rápido en Pantalla Principal
  const btnHeroNew = document.getElementById('home-btn-new-order');
  const btnQuickOrders = document.getElementById('home-btn-quick-orders');
  const btnQuickHistory = document.getElementById('home-btn-quick-history');
  const btnQuickSettings = document.getElementById('home-btn-quick-settings');

  if (btnHeroNew) btnHeroNew.onclick = () => window.navigateToView('new-order');
  if (btnQuickOrders) btnQuickOrders.onclick = () => window.navigateToView('orders');
  if (btnQuickHistory) btnQuickHistory.onclick = () => window.navigateToView('history');
  if (btnQuickSettings) btnQuickSettings.onclick = () => window.navigateToView('admin');

  // Botón superior de carrito
  const topCartBtn = document.getElementById('header-cart-btn');
  if (topCartBtn) topCartBtn.onclick = () => openCartDrawer();
}

// ----------------- RELOJ Y FECHA EN VIVO -----------------
function startLiveClock() {
  const dateEl = document.getElementById('live-date-display');
  const clockEl = document.getElementById('live-clock-display');
  const heroDateEl = document.getElementById('hero-today-date');

  function update() {
    const now = new Date();
    const optionsDate = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    let dateStr = now.toLocaleDateString('es-PY', optionsDate);
    dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

    const timeStr = now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (dateEl) dateEl.textContent = `${dateStr} • ${timeStr}`;
    if (clockEl) clockEl.textContent = timeStr;
    if (heroDateEl) heroDateEl.textContent = dateStr;
  }

  update();
  setInterval(update, 1000);
}

// ----------------- MARCA Y LOGOTIPO DINÁMICO -----------------
export async function updateStoreBrandUI() {
  const settings = await getSettings();

  const brandTitles = document.querySelectorAll('.store-name-text');
  const brandSlogans = document.querySelectorAll('.store-slogan-text');
  const brandLogos = document.querySelectorAll('.store-logo-img');

  brandTitles.forEach(el => el.textContent = settings.storeName || 'FUEGO Lomitería');
  brandSlogans.forEach(el => el.textContent = settings.storeSlogan || 'Hamburguesas & Lomitos Caseros');

  if (settings.logoUrl) {
    brandLogos.forEach(img => {
      img.src = settings.logoUrl;
    });
  }
}

// ----------------- RESUMEN DEL DÍA (HOME STATS) -----------------
export async function updateDailyStatsUI() {
  const allOrders = await getAllOrders();
  const todayStr = new Date().toISOString().split('T')[0];

  const todayOrders = allOrders.filter(o => o.date === todayStr);

  const totalOrdersCount = todayOrders.length;
  const pendingCount = todayOrders.filter(o => o.status === 'pendiente' || o.status === 'preparacion' || o.status === 'listo' || o.status === 'camino').length;
  const deliveredCount = todayOrders.filter(o => o.status === 'entregado').length;

  // CRÍTICO: Los pedidos cancelados no deben sumarse al total vendido
  const deliveredOrders = todayOrders.filter(o => o.status === 'entregado');
  const todayTotalSales = deliveredOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  // Elementos en el DOM
  const countEl = document.getElementById('stat-today-orders-count');
  const pendingEl = document.getElementById('stat-today-pending-count');
  const deliveredEl = document.getElementById('stat-today-delivered-count');
  const totalSalesEl = document.getElementById('stat-today-total-sales');
  const homeBadgePending = document.getElementById('home-quick-pending-badge');

  if (countEl) countEl.textContent = totalOrdersCount;
  if (pendingEl) pendingEl.textContent = pendingCount;
  if (deliveredEl) deliveredEl.textContent = deliveredCount;
  if (totalSalesEl) totalSalesEl.textContent = formatGs(todayTotalSales);
  if (homeBadgePending) {
    homeBadgePending.textContent = pendingCount;
    homeBadgePending.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  }
}

// ----------------- FEEDBACK HÁPTICO Y NOTIFICACIONES -----------------
export function triggerVibration(durationMs = 20) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(durationMs);
    } catch (e) {}
  }
}

export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}
