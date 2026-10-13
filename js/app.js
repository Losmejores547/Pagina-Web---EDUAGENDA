/**
 * EduAgenda – Controlador Principal de la App
 * Maneja la navegación, inicialización y ciclo de vida
 */

// ===================== INICIALIZACIÓN =====================
document.addEventListener('DOMContentLoaded', async () => {
  // Mostrar loader
  toggle('global-loader', true);

  // Aplicar tema guardado
  if (Storage.get('dark_mode')) {
    document.body.classList.add('dark');
  }

  // Inicializar sistema de autenticación (UI)
  initAuth();

  // Verificar sesión activa
  const user = Auth.getUser();
  if (user) {
    // Si es acudiente, gestionar flujo de selección de estudiante
    if (user.rol === 'acudiente') {
      const continuar = await Acudiente.iniciarFlujoAcudiente(user);
      if (!continuar) return; // Espera selección de estudiante
      await iniciarAppConEstudiante(user);
    } else {
      await iniciarApp(user);
    }
  } else {
    // Mostrar pantalla de login
    document.getElementById('login-screen').classList.remove('hidden');
    toggle('global-loader', false);
  }
});

// ===================== INICIAR APP =====================
async function iniciarApp(user) {
  // Ocultar login, mostrar app
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  toggle('global-loader', false);

  // Actualizar UI con datos del usuario
  actualizarUIUsuario(user);

  // Inicializar navegación
  initNavegacion();

  // Configurar botones globales
  initBotonesGlobales(user);

  // Mostrar el dashboard por defecto
  cambiarPagina('dashboard');

  // Cargar datos del dashboard
  await Dashboard.cargar();

  showToast(`¡Bienvenido, ${user.nombre.split(' ')[0]}! 👋`, 'success');
}

/**
 * Inicia la app para un acudiente que ya seleccionó estudiante
 */
async function iniciarAppConEstudiante(user) {
  const estudiante = Acudiente.getEstudianteActivo();

  // Ocultar pantalla selección, mostrar app
  document.getElementById('select-student-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  toggle('global-loader', false);

  // Actualizar UI
  actualizarUIUsuario(user);

  // Mostrar banner del estudiante activo en sidebar y botón cambiar
  Acudiente.actualizarBannerEstudiante();

  // Inicializar navegación y botones
  initNavegacion();
  initBotonesGlobales(user);

  // Ir al dashboard
  cambiarPagina('dashboard');
  await Dashboard.cargar();

  const nombreEst = estudiante ? estudiante.nombre_estudiante.split(' ')[0] : '';
  showToast(`Viendo información de ${nombreEst} 👨‍🎓`, 'success');
}

// ===================== UI DE USUARIO =====================
function actualizarUIUsuario(user) {
  const nombre = user.nombre || 'Usuario';
  const rol    = user.rol || 'estudiante';

  // Sidebar
  document.getElementById('sidebar-name').textContent = nombre;
  const rolBadge = document.getElementById('sidebar-role');
  rolBadge.textContent = rol.charAt(0).toUpperCase() + rol.slice(1);
  rolBadge.className = `role-badge ${rol}`;

  // Topbar avatar
  const topbarAvatar = document.getElementById('topbar-avatar');
  topbarAvatar.textContent = iniciales(nombre);

  // Sidebar avatar
  const sidebarAvatar = document.getElementById('sidebar-avatar');
  sidebarAvatar.textContent = iniciales(nombre);

  // Perfil
  document.getElementById('perfil-nombre').textContent = nombre;
  document.getElementById('perfil-correo').innerHTML = `<i class="fas fa-envelope"></i> ${user.correo}`;
  const perfilBadge = document.getElementById('perfil-rol-badge');
  perfilBadge.textContent = rol.charAt(0).toUpperCase() + rol.slice(1);
  perfilBadge.className = `role-badge ${rol}`;
  document.getElementById('perfil-avatar').textContent = iniciales(nombre);

  // Pre-llenar formulario de perfil
  setVal('edit-nombre', nombre);
  setVal('edit-correo', user.correo);
  setVal('edit-telefono', user.telefono);

  // Ocultar elementos solo para docentes si el rol no es docente
  document.querySelectorAll('[data-roles]').forEach(el => {
    const roles = el.dataset.roles.split(',').map(r => r.trim());
    if (!roles.includes(rol)) {
      el.style.display = 'none';
    }
  });
}

// ===================== NAVEGACIÓN =====================
function initNavegacion() {
  const navLinks = document.querySelectorAll('.nav-link[data-page]');
  const verMasLinks = document.querySelectorAll('.ver-mas[data-page]');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pagina = link.dataset.page;
      cambiarPagina(pagina);
      // Cerrar sidebar en mobile
      if (window.innerWidth < 768) {
        cerrarSidebar();
      }
    });
  });

  verMasLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      cambiarPagina(link.dataset.page);
    });
  });
}

/**
 * Cambia la página activa
 */
async function cambiarPagina(pagina) {
  // Actualizar nav links
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const activeLink = document.querySelector(`.nav-link[data-page="${pagina}"]`);
  if (activeLink) activeLink.classList.add('active');

  // Actualizar páginas visibles
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const activePage = document.getElementById(`page-${pagina}`);
  if (activePage) activePage.classList.add('active');

  // Actualizar título de la topbar
  const titulos = {
    dashboard:    'Dashboard',
    materias:     'Materias',
    horario:      'Horario Semanal',
    tareas:       'Tareas',
    evaluaciones: 'Evaluaciones',
    notas:        'Notas y Calificaciones',
    asistencia:   'Asistencia',
    mensajes:     'Mensajes',
    'ia-tutor':   'Tutor IA',
    perfil:       'Mi Perfil'
  };
  document.getElementById('page-title').textContent = titulos[pagina] || pagina;

  // Guardar página actual
  Storage.set('current_page', pagina);

  // Cargar datos de la página
  await cargarDatosPagina(pagina);
}

/**
 * Carga los datos específicos de cada página
 */
async function cargarDatosPagina(pagina) {
  try {
    switch (pagina) {
      case 'dashboard':    await Dashboard.cargar(); break;
      case 'materias':     await ModuloMaterias.cargar(); break;
      case 'horario':      await ModuloHorario.cargar(); break;
      case 'tareas':       await ModuloTareas.cargar(); break;
      case 'evaluaciones': await ModuloEvaluaciones.cargar(); break;
      case 'notas':        await ModuloNotas.cargar(); break;
      case 'asistencia':   await ModuloAsistencia.cargar(); break;
      case 'mensajes':     await ModuloMensajes.cargar(); break;
      case 'ia-tutor':     ModuloIA.init(); break;
      case 'perfil':       await ModuloPerfil.cargar(); break;
    }
  } catch (e) {
    console.error(`Error cargando página ${pagina}:`, e);
  }
}

// ===================== SIDEBAR MOBILE =====================
function initSidebar() {
  const menuToggle   = document.getElementById('menu-toggle');
  const sidebarClose = document.getElementById('sidebar-close');
  const overlay      = document.getElementById('sidebar-overlay');

  menuToggle.addEventListener('click', abrirSidebar);
  sidebarClose.addEventListener('click', cerrarSidebar);
  overlay.addEventListener('click', cerrarSidebar);
}

function abrirSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.remove('hidden');
  document.getElementById('sidebar-overlay').classList.add('visible');
}

function cerrarSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.add('hidden');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

// ===================== BOTONES GLOBALES =====================
function initBotonesGlobales(user) {
  initSidebar();

  // Tema oscuro
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    Storage.set('dark_mode', isDark);
    themeToggle.innerHTML = isDark
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
    showToast(isDark ? 'Modo oscuro activado' : 'Modo claro activado', 'info', 1500);
  });
  if (Storage.get('dark_mode')) {
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  }

  // Cerrar sesión
  document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    abrirModal({
      titulo: 'Cerrar Sesión',
      cuerpo: '<p>¿Estás seguro que deseas cerrar sesión?</p>',
      textoConfirmar: 'Sí, cerrar sesión',
      textoCancelar: 'Cancelar',
      onConfirm: () => {
        Auth.logout();
        cerrarModal();
        location.reload();
      }
    });
  });

  // Modal: cerrar con X o backdrop
  document.getElementById('modal-close').addEventListener('click', cerrarModal);
  document.getElementById('modal-cancel').addEventListener('click', cerrarModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) cerrarModal();
  });

  // Formulario de perfil
  document.getElementById('perfil-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await ModuloPerfil.guardar();
  });
}

console.log('✅ app.js cargado');
