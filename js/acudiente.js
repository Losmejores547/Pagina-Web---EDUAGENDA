/**
 * EduAgenda – Módulo Acudiente / Padre de Familia
 *
 * Gestiona:
 *  - Pantalla "Seleccionar estudiante" al iniciar sesión
 *  - Vinculación de hijos
 *  - Filtrado de todos los módulos por el estudiante activo
 *  - Botón "Cambiar estudiante" en topbar
 */

const Acudiente = {
  /** Estudiante actualmente seleccionado por el acudiente */
  _estudianteActivo: null,
  /** Lista de vínculos cargados */
  _vinculos: [],

  // ─────────────────────────────────────────────────
  // GETTERS PÚBLICOS
  // ─────────────────────────────────────────────────

  /** Devuelve el objeto del estudiante activo (o null) */
  getEstudianteActivo() {
    if (this._estudianteActivo) return this._estudianteActivo;
    // Intentar recuperar de localStorage
    this._estudianteActivo = Storage.get('acudiente_estudiante_activo');
    return this._estudianteActivo;
  },

  /** Devuelve el ID del estudiante activo (o null) */
  getEstudianteActivoId() {
    const e = this.getEstudianteActivo();
    return e ? e.id_estudiante : null;
  },

  /** ¿El usuario actual es acudiente? */
  esAcudiente() {
    const user = Auth.getUser();
    return user && user.rol === 'acudiente';
  },

  // ─────────────────────────────────────────────────
  // FLUJO PRINCIPAL DE INICIO
  // ─────────────────────────────────────────────────

  /**
   * Punto de entrada: llamado desde iniciarApp() cuando el rol es 'acudiente'.
   * Decide si mostrar la pantalla de selección o ir directamente a la app.
   */
  async iniciarFlujoAcudiente(user) {
    // Cargar vínculos del acudiente
    await this._cargarVinculos(user.id);

    if (this._vinculos.length === 0) {
      // Sin hijos registrados → mostrar pantalla de selección/vinculación vacía
      this._mostrarPantallaSeleccion(user);
      return false; // No iniciar la app todavía
    }

    if (this._vinculos.length === 1) {
      // Un solo hijo → entrar directamente sin mostrar selección
      this._seleccionarEstudiante(this._vinculos[0]);
      return true; // Continuar con el inicio normal de la app
    }

    // Varios hijos → mostrar pantalla de selección
    // Verificar si ya hay uno seleccionado en sesión
    const previo = this.getEstudianteActivo();
    if (previo && this._vinculos.find(v => v.id_estudiante === previo.id_estudiante)) {
      // Usar el último estudiante seleccionado
      this._estudianteActivo = previo;
      return true;
    }

    // Mostrar pantalla de selección
    this._mostrarPantallaSeleccion(user);
    return false;
  },

  // ─────────────────────────────────────────────────
  // CARGAR VÍNCULOS
  // ─────────────────────────────────────────────────

  async _cargarVinculos(idAcudiente) {
    const resp = await API.get('vinculos_acudiente', { limit: 100 });
    this._vinculos = (resp.data || []).filter(
      v => v.id_acudiente === idAcudiente && v.activo !== false
    );
    return this._vinculos;
  },

  // ─────────────────────────────────────────────────
  // PANTALLA DE SELECCIÓN
  // ─────────────────────────────────────────────────

  _mostrarPantallaSeleccion(user) {
    // Ocultar login y app
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
    toggle('global-loader', false);

    // Mostrar pantalla de selección
    const screen = document.getElementById('select-student-screen');
    screen.classList.remove('hidden');

    // Nombre del acudiente
    document.getElementById('ss-parent-name').textContent = user.nombre.split(' ')[0];

    // Renderizar lista de estudiantes
    this._renderListaEstudiantes();

    // Botón logout
    const logoutBtn = document.getElementById('ss-logout-btn');
    if (logoutBtn && !logoutBtn._bound) {
      logoutBtn.addEventListener('click', () => {
        Auth.logout();
        Acudiente._limpiarEstudianteActivo();
        location.reload();
      });
      logoutBtn._bound = true;
    }

    // Botón vincular estudiante
    const btnVincular = document.getElementById('ss-btn-vincular');
    if (btnVincular && !btnVincular._bound) {
      btnVincular.addEventListener('click', () => this._abrirFormularioVinculacion());
      btnVincular._bound = true;
    }
  },

  _renderListaEstudiantes() {
    const container = document.getElementById('ss-students-list');

    if (this._vinculos.length === 0) {
      container.innerHTML = `
        <div class="ss-empty">
          <div class="ss-empty-icon"><i class="fas fa-user-graduate"></i></div>
          <h3>Sin estudiantes vinculados</h3>
          <p>Vincula a tu hijo/a para empezar a ver su información académica.</p>
        </div>`;
      return;
    }

    container.innerHTML = this._vinculos.map(v => {
      const avatar = v.nombre_estudiante
        ? iniciales(v.nombre_estudiante)
        : '?';
      return `
      <div class="ss-student-card" data-id="${v.id_estudiante}" onclick="Acudiente._onSeleccionarEstudiante('${v.id_estudiante}')">
        <div class="ss-student-avatar" style="background:${this._colorPorId(v.id_estudiante)}">
          ${v.foto_estudiante
            ? `<img src="${v.foto_estudiante}" alt="${sanitize(v.nombre_estudiante)}" />`
            : `<span>${avatar}</span>`
          }
        </div>
        <div class="ss-student-info">
          <h3>${sanitize(v.nombre_estudiante || 'Estudiante')}</h3>
          <p><i class="fas fa-school"></i> ${sanitize(v.grado || 'Grado no registrado')}</p>
        </div>
        <div class="ss-student-arrow">
          <i class="fas fa-chevron-right"></i>
        </div>
      </div>`;
    }).join('');
  },

  // ─────────────────────────────────────────────────
  // SELECCIONAR ESTUDIANTE
  // ─────────────────────────────────────────────────

  _onSeleccionarEstudiante(idEstudiante) {
    const vinculo = this._vinculos.find(v => v.id_estudiante === idEstudiante);
    if (!vinculo) return;

    // Animar la tarjeta
    const card = document.querySelector(`.ss-student-card[data-id="${idEstudiante}"]`);
    if (card) {
      card.classList.add('selected');
      card.innerHTML = `<div class="ss-selecting"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>`;
    }

    setTimeout(async () => {
      this._seleccionarEstudiante(vinculo);
      // Ocultar pantalla de selección y lanzar app
      document.getElementById('select-student-screen').classList.add('hidden');
      await iniciarAppConEstudiante(Auth.getUser());
    }, 400);
  },

  _seleccionarEstudiante(vinculo) {
    this._estudianteActivo = vinculo;
    Storage.set('acudiente_estudiante_activo', vinculo);
  },

  _limpiarEstudianteActivo() {
    this._estudianteActivo = null;
    Storage.remove('acudiente_estudiante_activo');
  },

  // ─────────────────────────────────────────────────
  // CAMBIAR ESTUDIANTE (desde topbar)
  // ─────────────────────────────────────────────────

  async cambiarEstudiante() {
    const user = Auth.getUser();
    // Recargar vínculos por si cambiaron
    await this._cargarVinculos(user.id);

    if (this._vinculos.length <= 1) {
      showToast('Solo tienes un estudiante vinculado.', 'info');
      return;
    }

    // Limpiar selección previa
    this._limpiarEstudianteActivo();

    // Ocultar la app principal
    document.getElementById('app').classList.add('hidden');

    // Mostrar pantalla de selección
    this._mostrarPantallaSeleccion(user);
  },

  // ─────────────────────────────────────────────────
  // VINCULAR NUEVO ESTUDIANTE
  // ─────────────────────────────────────────────────

  _abrirFormularioVinculacion() {
    const html = `
      <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:1rem;">
        Ingresa el correo con el que tu hijo/a está registrado en EduAgenda.
      </p>
      <div class="form-group">
        <label><i class="fas fa-envelope"></i> Correo del estudiante</label>
        <input type="email" id="vinc-correo" placeholder="correo@estudiante.com" autocomplete="off" />
      </div>
      <div class="form-group">
        <label><i class="fas fa-school"></i> Grado / Curso</label>
        <input type="text" id="vinc-grado" placeholder="ej: 11-3, 9°B, Décimo A..." />
      </div>
    `;
    abrirModal({
      titulo: 'Vincular Estudiante',
      cuerpo: html,
      textoConfirmar: 'Vincular',
      textoCancelar: 'Cancelar',
      onConfirm: async () => {
        const correo = val('vinc-correo');
        const grado  = val('vinc-grado');

        if (!correo) {
          showToast('Ingresa el correo del estudiante.', 'error');
          return;
        }

        // Buscar al estudiante en la tabla de usuarios
        const respUsers = await API.get('usuarios', { limit: 200 });
        const usuarios  = respUsers.data || [];
        const estudiante = usuarios.find(u =>
          u.correo?.toLowerCase() === correo.toLowerCase() &&
          u.rol === 'estudiante'
        );

        if (!estudiante) {
          showToast('No se encontró un estudiante con ese correo. Verifica que esté registrado.', 'error');
          return;
        }

        // Verificar que no esté ya vinculado
        const yaVinculado = this._vinculos.find(v => v.id_estudiante === estudiante.id);
        if (yaVinculado) {
          showToast('Este estudiante ya está vinculado a tu cuenta.', 'warning');
          cerrarModal();
          return;
        }

        // Crear vínculo
        const user    = Auth.getUser();
        const vinculo = {
          id:               crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
          id_acudiente:     user.id,
          id_estudiante:    estudiante.id,
          nombre_estudiante: estudiante.nombre,
          grado:            grado || 'Sin grado',
          foto_estudiante:  estudiante.foto || '',
          activo:           true
        };

        const creado = await API.create('vinculos_acudiente', vinculo);
        if (!creado) {
          showToast('Error al vincular. Intenta de nuevo.', 'error');
          return;
        }

        this._vinculos.push(creado);
        cerrarModal();
        showToast(`✅ ${estudiante.nombre} vinculado exitosamente.`, 'success');

        // Re-renderizar lista
        this._renderListaEstudiantes();
      }
    });
  },

  // ─────────────────────────────────────────────────
  // UI EN APP: banner del estudiante activo
  // ─────────────────────────────────────────────────

  actualizarBannerEstudiante() {
    const estudiante = this.getEstudianteActivo();
    const banner     = document.getElementById('sidebar-student-banner');
    const btnCambiar = document.getElementById('btn-cambiar-estudiante');

    if (!this.esAcudiente() || !estudiante) {
      banner?.classList.add('hidden');
      btnCambiar?.classList.add('hidden');
      return;
    }

    // Mostrar banner
    banner.classList.remove('hidden');
    document.getElementById('ssb-avatar').textContent = iniciales(estudiante.nombre_estudiante || '?');
    document.getElementById('ssb-name').textContent   = estudiante.nombre_estudiante || 'Estudiante';
    document.getElementById('ssb-grade').textContent  = estudiante.grado || '—';

    // Botón cambiar en topbar
    btnCambiar.classList.remove('hidden');
    // En móvil solo mostrar el ícono
    const label = document.getElementById('btn-cambiar-label');
    if (label) {
      label.style.display = window.innerWidth < 600 ? 'none' : '';
    }

    // Listener del botón (una sola vez)
    if (!btnCambiar._bound) {
      btnCambiar.addEventListener('click', () => Acudiente.cambiarEstudiante());
      btnCambiar._bound = true;
    }
  },

  // ─────────────────────────────────────────────────
  // FILTRAR DATOS POR ESTUDIANTE
  // ─────────────────────────────────────────────────

  /**
   * Filtra una lista de registros para mostrar solo los del estudiante activo.
   * Acepta los campos típicos: usuario_id, id_estudiante.
   * @param {Array} lista
   * @returns {Array}
   */
  filtrarPorEstudianteActivo(lista) {
    const estId = this.getEstudianteActivoId();
    if (!estId) return lista;
    return lista.filter(item =>
      item.id_estudiante === estId ||
      item.usuario_id    === estId
    );
  },

  // ─────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────

  _colorPorId(id) {
    const colores = [
      '#3B5BDB','#845EF7','#F06595','#FD7E14',
      '#40C057','#15AABF','#E67700','#D63031'
    ];
    let hash = 0;
    for (let i = 0; i < (id || '').length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colores[Math.abs(hash) % colores.length];
  }
};

console.log('✅ acudiente.js cargado');
