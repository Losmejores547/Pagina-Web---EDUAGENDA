/**
 * EduAgenda – Utilidades Generales
 * Funciones helper usadas en toda la aplicación
 */

// ===================== TOAST NOTIFICATIONS =====================
/**
 * Muestra una notificación tipo toast en la esquina inferior derecha
 * @param {string} mensaje - Texto a mostrar
 * @param {string} tipo - 'success' | 'error' | 'warning' | 'info'
 * @param {number} duracion - Milisegundos antes de desaparecer
 */
function showToast(mensaje, tipo = 'info', duracion = 3500) {
  const container = document.getElementById('toast-container');
  const iconos = {
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
  };
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.innerHTML = `<i class="${iconos[tipo] || iconos.info}"></i><span>${mensaje}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duracion);
}

// ===================== MODAL =====================
/**
 * Abre el modal genérico con contenido personalizable
 * @param {object} opciones - { titulo, cuerpo (HTML string), onConfirm, textoConfirmar, textoCancelar, ocultarFooter }
 */
function abrirModal(opciones = {}) {
  const overlay = document.getElementById('modal-overlay');
  const title   = document.getElementById('modal-title');
  const body    = document.getElementById('modal-body');
  const footer  = document.getElementById('modal-footer');
  const btnConf = document.getElementById('modal-confirm');
  const btnCan  = document.getElementById('modal-cancel');

  title.textContent  = opciones.titulo || 'Acción';
  body.innerHTML     = opciones.cuerpo || '';
  btnConf.textContent = opciones.textoConfirmar || 'Guardar';
  btnCan.textContent  = opciones.textoCancelar  || 'Cancelar';

  if (opciones.ocultarFooter) {
    footer.style.display = 'none';
  } else {
    footer.style.display = 'flex';
  }

  overlay.classList.remove('hidden');

  // Listener único para confirmar
  const confirmar = opciones.onConfirm || (() => cerrarModal());
  btnConf.onclick = async () => {
    btnConf.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    btnConf.disabled = true;
    await confirmar();
    btnConf.innerHTML = opciones.textoConfirmar || 'Guardar';
    btnConf.disabled = false;
  };
}

function cerrarModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-body').innerHTML = '';
}

// ===================== FECHAS =====================
/**
 * Formatea una fecha ISO/string a formato legible
 * @param {string} fecha - Fecha en formato ISO o YYYY-MM-DD
 * @returns {string} Fecha formateada
 */
function formatearFecha(fecha) {
  if (!fecha) return '—';
  const d = new Date(fecha + (fecha.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Devuelve la fecha de hoy en formato YYYY-MM-DD
 */
function hoy() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Calcula días restantes desde hoy hasta una fecha
 */
function diasRestantes(fecha) {
  if (!fecha) return null;
  const hoyMs = new Date().setHours(0,0,0,0);
  const fechaMs = new Date(fecha + 'T00:00:00').getTime();
  return Math.ceil((fechaMs - hoyMs) / 86400000);
}

/**
 * Devuelve texto relativo: "hoy", "mañana", "en X días", "hace X días"
 */
function fechaRelativa(fecha) {
  const d = diasRestantes(fecha);
  if (d === null) return '';
  if (d === 0)  return '🔴 Hoy';
  if (d === 1)  return '🟡 Mañana';
  if (d > 1 && d <= 7) return `🟡 En ${d} días`;
  if (d > 7)  return `🟢 En ${d} días`;
  if (d < 0)  return `⚫ Hace ${Math.abs(d)} días`;
  return '';
}

/**
 * Devuelve la fecha/hora actual formateada
 */
function fechaHoraActual() {
  const ahora = new Date();
  return ahora.toLocaleString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ===================== COLORES DE MATERIAS =====================
const COLORES_MATERIAS = [
  '#3B5BDB', '#845EF7', '#F06595', '#FD7E14',
  '#40C057', '#15AABF', '#E67700', '#D63031',
  '#6C5CE7', '#00B894', '#A29BFE', '#FDCB6E'
];
const ICONOS_MATERIAS = [
  'fa-calculator', 'fa-flask', 'fa-book', 'fa-globe',
  'fa-palette', 'fa-music', 'fa-running', 'fa-laptop-code',
  'fa-language', 'fa-brain', 'fa-atom', 'fa-leaf'
];

function getColorMateria(index) {
  return COLORES_MATERIAS[index % COLORES_MATERIAS.length];
}
function getIconoMateria(index) {
  return ICONOS_MATERIAS[index % ICONOS_MATERIAS.length];
}

// ===================== CALIFICACIONES =====================
/**
 * Devuelve clase CSS según la calificación (escala 0-5)
 */
function claseNota(nota) {
  const n = parseFloat(nota);
  if (n >= 4.0) return 'alta';
  if (n >= 3.0) return 'media';
  return 'baja';
}

/**
 * Calcula el promedio de un array de números
 */
function calcularPromedio(valores) {
  if (!valores || valores.length === 0) return 0;
  const nums = valores.map(v => parseFloat(v)).filter(v => !isNaN(v));
  if (nums.length === 0) return 0;
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
}

// ===================== DOM HELPERS =====================
/**
 * Crea un elemento HTML con atributos y texto
 */
function crearElemento(tag, clase, texto = '') {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto) el.textContent = texto;
  return el;
}

/**
 * Obtiene el valor de un input por ID
 */
function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

/**
 * Establece el valor de un input por ID
 */
function setVal(id, valor) {
  const el = document.getElementById(id);
  if (el) el.value = valor || '';
}

/**
 * Muestra u oculta un elemento
 */
function toggle(id, mostrar) {
  const el = document.getElementById(id);
  if (!el) return;
  if (mostrar) el.classList.remove('hidden');
  else el.classList.add('hidden');
}

// ===================== VALIDACIONES =====================
function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validarPassword(pass) {
  return pass && pass.length >= 6;
}

// ===================== STORAGE LOCAL =====================
const Storage = {
  get(key, def = null) {
    try {
      const v = localStorage.getItem('eduagenda_' + key);
      return v ? JSON.parse(v) : def;
    } catch { return def; }
  },
  set(key, value) {
    try { localStorage.setItem('eduagenda_' + key, JSON.stringify(value)); } catch {}
  },
  remove(key) {
    localStorage.removeItem('eduagenda_' + key);
  }
};

// ===================== DEBOUNCE =====================
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ===================== ICONOS TIPO EVALUACIÓN =====================
function iconoTipoEval(tipo) {
  const tipos = {
    examen: 'fa-file-alt',
    quiz: 'fa-question-circle',
    trabajo: 'fa-pencil-alt',
    proyecto: 'fa-project-diagram',
    oral: 'fa-microphone'
  };
  return tipos[tipo] || 'fa-star';
}

// ===================== PRIMERAS LETRAS (Avatar) =====================
function iniciales(nombre) {
  if (!nombre) return '?';
  return nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

// ===================== SANITIZAR HTML =====================
function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===================== MARKDOWN SIMPLE =====================
/**
 * Convierte Markdown básico a HTML (para respuestas de la IA)
 */
function markdownToHtml(text) {
  if (!text) return '';
  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h234ulp])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}

console.log('✅ utils.js cargado');
