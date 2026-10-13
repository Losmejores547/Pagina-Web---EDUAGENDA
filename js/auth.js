/**
 * EduAgenda – Autenticación
 * Manejo de login, registro y sesión de usuario
 * (Usa la API de tablas para persistencia)
 */

const Auth = {
  _user: null,

  /**
   * Obtiene el usuario actual de memoria o localStorage
   */
  getUser() {
    if (this._user) return this._user;
    this._user = Storage.get('session');
    return this._user;
  },

  /**
   * Guarda el usuario en sesión
   */
  setUser(user) {
    this._user = user;
    Storage.set('session', user);
  },

  /**
   * Cierra sesión
   */
  logout() {
    this._user = null;
    Storage.remove('session');
    Storage.remove('gemini_key');
  },

  /**
   * Verifica si hay sesión activa
   */
  isLoggedIn() {
    return !!this.getUser();
  },

  /**
   * Login: busca usuario por correo y verifica contraseña
   */
  async login(correo, contrasena) {
    const resp = await API.get('usuarios', { limit: 200 });
    const usuarios = resp.data || [];
    const user = usuarios.find(u =>
      u.correo && u.correo.toLowerCase() === correo.toLowerCase()
    );
    if (!user) return { ok: false, msg: 'Usuario no encontrado.' };
    if (user.contrasena !== btoa(contrasena)) {
      return { ok: false, msg: 'Contraseña incorrecta.' };
    }
    if (user.activo === false) {
      return { ok: false, msg: 'Cuenta inactiva. Contacta al administrador.' };
    }
    this.setUser(user);
    return { ok: true, user };
  },

  /**
   * Registro: crea un nuevo usuario
   */
  async register(datos) {
    // Verificar si el correo ya existe
    const resp = await API.get('usuarios', { limit: 200 });
    const usuarios = resp.data || [];
    const existe = usuarios.find(u =>
      u.correo && u.correo.toLowerCase() === datos.correo.toLowerCase()
    );
    if (existe) return { ok: false, msg: 'Este correo ya está registrado.' };

    const nuevoUser = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      nombre: datos.nombre,
      correo: datos.correo.toLowerCase(),
      contrasena: btoa(datos.contrasena),   // codificación simple (no es producción)
      rol: datos.rol,
      telefono: datos.telefono || '',
      foto: '',
      activo: true
    };

    const creado = await API.create('usuarios', nuevoUser);
    if (!creado) return { ok: false, msg: 'Error al crear la cuenta. Intenta de nuevo.' };

    this.setUser(creado);
    return { ok: true, user: creado };
  },

  /**
   * Crear cuentas de demostración si no existen
   */
  async crearCuentasDemo() {
    const resp = await API.get('usuarios', { limit: 200 });
    const existentes = (resp.data || []);
    const correosExistentes = existentes.map(u => u.correo);

    const demos = [
      { nombre: 'Ana García', correo: 'estudiante@demo.com', contrasena: 'demo123', rol: 'estudiante', telefono: '3001234567', foto: '', activo: true },
      { nombre: 'Luis García', correo: 'estudiante2@demo.com', contrasena: 'demo123', rol: 'estudiante', telefono: '3001234568', foto: '', activo: true },
      { nombre: 'Prof. Carlos López', correo: 'docente@demo.com', contrasena: 'demo123', rol: 'docente', telefono: '3109876543', foto: '', activo: true },
      { nombre: 'María Torres', correo: 'acudiente@demo.com', contrasena: 'demo123', rol: 'acudiente', telefono: '3201111222', foto: '', activo: true }
    ];

    const creados = {};
    for (const d of demos) {
      const existente = existentes.find(u => u.correo === d.correo);
      if (existente) {
        creados[d.correo] = existente;
      } else {
        d.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random();
        d.contrasena = btoa(d.contrasena);
        const c = await API.create('usuarios', d);
        if (c) creados[d.correo] = c;
      }
    }

    // Crear vínculos demo (acudiente → 2 hijos) si no existen
    const acudiente  = creados['acudiente@demo.com'];
    const est1       = creados['estudiante@demo.com'];
    const est2       = creados['estudiante2@demo.com'];

    if (acudiente && est1 && est2) {
      const respV = await API.get('vinculos_acudiente', { limit: 50 });
      const vincExist = (respV.data || []).filter(v => v.id_acudiente === acudiente.id);

      if (vincExist.length === 0) {
        await API.create('vinculos_acudiente', {
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + '1',
          id_acudiente: acudiente.id,
          id_estudiante: est1.id,
          nombre_estudiante: est1.nombre,
          grado: '11-3',
          foto_estudiante: '',
          activo: true
        });
        await API.create('vinculos_acudiente', {
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + '2',
          id_acudiente: acudiente.id,
          id_estudiante: est2.id,
          nombre_estudiante: est2.nombre,
          grado: '9°B',
          foto_estudiante: '',
          activo: true
        });
      }
    }
  },

  /**
   * Login con cuenta de demostración por rol
   */
  async loginDemo(rol) {
    const correos = {
      estudiante: 'estudiante@demo.com',
      docente:    'docente@demo.com',
      acudiente:  'acudiente@demo.com'
    };
    return await this.login(correos[rol], 'demo123');
  }
};

// ===================== UI DE AUTENTICACIÓN =====================
function initAuth() {
  const loginForm    = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const authTabs     = document.querySelectorAll('.auth-tab');
  const loginError   = document.getElementById('login-error');
  const regError     = document.getElementById('register-error');
  const demoBtns     = document.querySelectorAll('.demo-btn');

  // Tabs login/registro
  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      authTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const cual = tab.dataset.tab;
      loginForm.classList.toggle('active', cual === 'login');
      registerForm.classList.toggle('active', cual === 'register');
      loginError.classList.add('hidden');
      regError.classList.add('hidden');
    });
  });

  // Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const correo = val('login-email');
    const pass   = val('login-password');
    if (!correo || !pass) {
      loginError.textContent = 'Por favor completa todos los campos.';
      loginError.classList.remove('hidden');
      return;
    }
    const btn = loginForm.querySelector('button[type=submit]');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ingresando...';
    btn.disabled = true;

    const result = await Auth.login(correo, pass);

    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Ingresar';
    btn.disabled = false;

    if (result.ok) {
      loginError.classList.add('hidden');
      if (result.user.rol === 'acudiente') {
        const continuar = await Acudiente.iniciarFlujoAcudiente(result.user);
        if (continuar) await iniciarAppConEstudiante(result.user);
      } else {
        iniciarApp(result.user);
      }
    } else {
      loginError.textContent = result.msg;
      loginError.classList.remove('hidden');
    }
  });

  // Registro
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = {
      nombre:    val('reg-nombre'),
      correo:    val('reg-email'),
      contrasena: val('reg-password'),
      rol:       val('reg-rol'),
      telefono:  val('reg-telefono')
    };
    if (!datos.nombre || !datos.correo || !datos.contrasena || !datos.rol) {
      regError.textContent = 'Por favor completa todos los campos obligatorios.';
      regError.classList.remove('hidden');
      return;
    }
    if (!validarEmail(datos.correo)) {
      regError.textContent = 'El correo electrónico no es válido.';
      regError.classList.remove('hidden');
      return;
    }
    if (!validarPassword(datos.contrasena)) {
      regError.textContent = 'La contraseña debe tener al menos 6 caracteres.';
      regError.classList.remove('hidden');
      return;
    }

    const btn = registerForm.querySelector('button[type=submit]');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando cuenta...';
    btn.disabled = true;

    const result = await Auth.register(datos);

    btn.innerHTML = '<i class="fas fa-user-plus"></i> Crear cuenta';
    btn.disabled = false;

    if (result.ok) {
      regError.classList.add('hidden');
      showToast('¡Cuenta creada exitosamente!', 'success');
      if (result.user.rol === 'acudiente') {
        const continuar = await Acudiente.iniciarFlujoAcudiente(result.user);
        if (continuar) await iniciarAppConEstudiante(result.user);
      } else {
        iniciarApp(result.user);
      }
    } else {
      regError.textContent = result.msg;
      regError.classList.remove('hidden');
    }
  });

  // Demo buttons
  demoBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const rol = btn.dataset.role;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      btn.disabled = true;

      // Crear cuentas demo si no existen
      await Auth.crearCuentasDemo();

      const result = await Auth.loginDemo(rol);
      btn.innerHTML = `<i class="fas fa-user-${rol === 'estudiante' ? 'graduate' : rol === 'docente' ? 'tie' : 'friends'}"></i> ${rol.charAt(0).toUpperCase() + rol.slice(1)}`;
      btn.disabled = false;

      if (result.ok) {
        if (result.user.rol === 'acudiente') {
          const continuar = await Acudiente.iniciarFlujoAcudiente(result.user);
          if (continuar) await iniciarAppConEstudiante(result.user);
        } else {
          iniciarApp(result.user);
        }
      } else {
        showToast('Error al usar la cuenta demo: ' + result.msg, 'error');
      }
    });
  });
}

console.log('✅ auth.js cargado');
