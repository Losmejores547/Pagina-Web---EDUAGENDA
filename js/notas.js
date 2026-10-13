/**
 * EduAgenda – Módulo de Notas y Calificaciones
 *
 * SINCRONIZACIÓN:
 *  - Docente registra nota → guarda id_estudiante (real), id_profesor, nombre_profesor, estado
 *  - Estudiante filtra por id_estudiante === user.id
 *  - Acudiente filtra por id_estudiante === estudianteActivo.id
 *  - Docente filtra por id_profesor === user.id (o usuario_id)
 *
 * ESTADOS:
 *  Completado   → actividad entregada y calificada
 *  Pendiente    → asignada pero no entregada
 *  En revisión  → entregada pero sin nota
 *  No entregado → vencida sin entrega
 */

const ESTADOS_ACTIVIDAD = {
  'Completado':    { color: '#40C057', bg: '#40C05720', icon: 'fas fa-check-circle' },
  'Pendiente':     { color: '#FD7E14', bg: '#FD7E1420', icon: 'fas fa-clock' },
  'En revisión':   { color: '#228BE6', bg: '#228BE620', icon: 'fas fa-search' },
  'No entregado':  { color: '#FA5252', bg: '#FA525220', icon: 'fas fa-times-circle' },
};

const TIPOS_ACTIVIDAD = ['Taller', 'Examen', 'Tarea', 'Proyecto', 'Quiz', 'Participación', 'Otro'];

const ModuloNotas = {
  _notas: [],
  _autoRefreshTimer: null,

  async cargar() {
    const container = document.getElementById('notas-container');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando notas...</div>';

    const user = Auth.getUser();
    const resp = await API.get('notas', { limit: 500 });
    let notas  = resp.data || [];

    // ── Filtro por rol ──────────────────────────────────────────────────────
    if (user.rol === 'estudiante') {
      // Estudiante: solo sus propias notas (por id_estudiante)
      notas = notas.filter(n => n.id_estudiante === user.id);

    } else if (user.rol === 'acudiente') {
      // Acudiente: notas del hijo seleccionado
      const estId = Acudiente.getEstudianteActivoId();
      if (!estId) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-user"></i><p>Selecciona un estudiante primero.</p></div>';
        return;
      }
      notas = notas.filter(n => n.id_estudiante === estId);

    } else if (user.rol === 'docente') {
      // Docente: notas que él registró
      notas = notas.filter(n =>
        n.id_profesor === user.id || n.usuario_id === user.id
      );
    }

    // Ordenar por fecha_actividad descendente
    notas.sort((a, b) => {
      const da = new Date(b.fecha_actividad || b.created_at || 0);
      const db = new Date(a.fecha_actividad || a.created_at || 0);
      return da - db;
    });

    this._notas = notas;
    this._render(notas, user);
    this._initFiltros(user);
    this._initProyeccion();

    // Auto-refresh para estudiante y acudiente
    this._iniciarAutoRefresh(user);

    // Mostrar indicador de sync solo para estudiante/acudiente
    const syncEl = document.getElementById('notas-sync-indicator');
    if (syncEl) {
      syncEl.style.display = (user.rol === 'estudiante' || user.rol === 'acudiente') ? 'inline-flex' : 'none';
    }
  },

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  _iniciarAutoRefresh(user) {
    this._detenerAutoRefresh();
    if (user.rol === 'estudiante' || user.rol === 'acudiente') {
      this._autoRefreshTimer = setInterval(async () => {
        const paginaActual = document.querySelector('.page-section.active');
        if (paginaActual && paginaActual.id === 'page-notas') {
          await this.cargar();
        } else {
          this._detenerAutoRefresh();
        }
      }, 30000);
    }
  },

  _detenerAutoRefresh() {
    if (this._autoRefreshTimer) {
      clearInterval(this._autoRefreshTimer);
      this._autoRefreshTimer = null;
    }
  },

  // ── Filtros ───────────────────────────────────────────────────────────────
  _initFiltros(user) {
    const sel = document.getElementById('filter-materia-notas');
    const newSel = sel.cloneNode(true);
    sel.parentNode.replaceChild(newSel, sel);
    newSel.addEventListener('change', () => this._aplicarFiltros(user));
  },

  _aplicarFiltros(user) {
    let lista = [...this._notas];
    const mat = document.getElementById('filter-materia-notas').value;
    if (mat) lista = lista.filter(n => n.id_materia === mat);
    this._render(lista, user);
  },

  // ── Render principal ──────────────────────────────────────────────────────
  _render(notas, user) {
    user = user || Auth.getUser();
    const container = document.getElementById('notas-container');

    if (!notas.length) {
      container.innerHTML = `<div class="empty-state">
        <i class="fas fa-star"></i>
        <p>No hay notas registradas.</p>
        ${user.rol === 'docente' ? '<p style="font-size:.85rem;color:var(--text-muted)">Usa el botón <strong>+ Nueva Nota</strong> para registrar.</p>' : ''}
      </div>`;
      return;
    }

    const esDoc      = user.rol === 'docente';
    const esEstudiante = user.rol === 'estudiante';
    const esAcudiente  = user.rol === 'acudiente';

    // Agrupar por materia
    const porMateria = {};
    notas.forEach(n => {
      const key = n.nombre_materia || 'Sin materia';
      if (!porMateria[key]) porMateria[key] = [];
      porMateria[key].push(n);
    });

    container.innerHTML = Object.entries(porMateria).map(([materia, mNotas]) => {
      const vals    = mNotas.map(n => parseFloat(n.calificacion)).filter(v => !isNaN(v) && v > 0);
      const prom    = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
      const aprobado = prom !== null && prom >= 3.0;

      return `
      <div class="nota-materia-section">
        <div class="nota-materia-header">
          <h3>
            <i class="fas fa-book" style="color:var(--primary)"></i>
            ${sanitize(materia)}
          </h3>
          ${prom !== null ? `
          <div>
            <span class="nota-promedio ${aprobado ? 'aprobado' : 'reprobado'}">
              Promedio: ${prom.toFixed(2)}
            </span>
          </div>` : ''}
        </div>
        <table class="notas-table">
          <thead>
            <tr>
              <th>Actividad</th>
              ${esDoc ? '<th>Estudiante</th>' : ''}
              <th>Fecha</th>
              <th>Estado</th>
              <th>Calificación</th>
              ${(esEstudiante || esAcudiente) ? '<th>Docente</th>' : ''}
              <th>Comentario</th>
              ${esDoc ? '<th>Acciones</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${mNotas.map(n => this._renderFila(n, esDoc, esEstudiante, esAcudiente)).join('')}
          </tbody>
        </table>
      </div>`;
    }).join('');
  },

  _renderFila(n, esDoc, esEstudiante, esAcudiente) {
    const cal    = parseFloat(n.calificacion);
    const hayCal = !isNaN(cal) && cal > 0;
    const claseN = hayCal ? claseNota(cal) : 'media';

    // Badge de estado
    const estado  = n.estado || (hayCal ? 'Completado' : 'Pendiente');
    const eConf   = ESTADOS_ACTIVIDAD[estado] || ESTADOS_ACTIVIDAD['Pendiente'];
    const badgeEst = `<span class="estado-badge" style="background:${eConf.bg};color:${eConf.color};border:1px solid ${eConf.color}40;">
      <i class="${eConf.icon}"></i> ${estado}
    </span>`;

    return `
    <tr>
      <td>
        <div style="font-weight:500;">${sanitize(n.nombre_evaluacion || n.tipo_actividad || '—')}</div>
        ${n.tipo_actividad ? `<div style="font-size:.75rem;color:var(--text-muted);">${sanitize(n.tipo_actividad)}</div>` : ''}
      </td>
      ${esDoc ? `<td>${sanitize(n.nombre_estudiante || '—')}</td>` : ''}
      <td style="white-space:nowrap;font-size:.82rem;color:var(--text-muted);">
        ${n.fecha_actividad ? formatearFecha(n.fecha_actividad) : '—'}
      </td>
      <td>${badgeEst}</td>
      <td>
        ${hayCal
          ? `<span class="calificacion-badge ${claseN}">${cal.toFixed(1)}</span>`
          : `<span style="color:var(--text-muted);font-size:.85rem;">—</span>`}
      </td>
      ${(esEstudiante || esAcudiente) ? `
      <td style="font-size:.82rem;color:var(--text-muted);">
        ${sanitize(n.nombre_profesor || '—')}
      </td>` : ''}
      <td style="color:var(--text-muted);font-size:.82rem;max-width:160px;">
        ${sanitize(n.comentario || '—')}
      </td>
      ${esDoc ? `
      <td>
        <div style="display:flex;gap:.25rem;">
          <button class="btn-icon" title="Editar" onclick="ModuloNotas.editar('${n.id}')">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon" title="Eliminar" onclick="ModuloNotas.eliminar('${n.id}')">
            <i class="fas fa-trash" style="color:var(--danger)"></i>
          </button>
        </div>
      </td>` : ''}
    </tr>`;
  },

  // ── Formulario ────────────────────────────────────────────────────────────
  abrirFormulario(nota = null) {
    const user         = Auth.getUser();
    const evaluaciones = ModuloEvaluaciones.getEvaluaciones();
    const materias     = ModuloMaterias.getMaterias();
    const es_edicion   = !!nota;

    const estadoActual = nota?.estado || 'Pendiente';
    const tipoActual   = nota?.tipo_actividad || '';

    const html = `
      <!-- Búsqueda de estudiante -->
      <div class="form-group">
        <label><i class="fas fa-search"></i> Buscar estudiante por correo electrónico</label>
        <div style="display:flex;gap:.5rem;align-items:center;">
          <input type="email" id="n-email-est"
            value="${nota ? sanitize(nota.email_estudiante || '') : ''}"
            placeholder="correo@estudiante.com"
            style="flex:1;" />
          <button type="button" class="btn-secondary" style="white-space:nowrap;"
            onclick="ModuloNotas._buscarEstudiante()">
            <i class="fas fa-search"></i> Buscar
          </button>
        </div>
        <div id="n-est-resultado" style="margin-top:.4rem;font-size:.85rem;color:var(--text-muted);min-height:1.2rem;"></div>
        <input type="hidden" id="n-est-id"    value="${nota ? nota.id_estudiante || '' : ''}" />
        <input type="hidden" id="n-est-nombre" value="${nota ? sanitize(nota.nombre_estudiante || '') : ''}" />
        ${nota ? `<p style="font-size:.78rem;color:var(--text-muted);">
          <i class="fas fa-user-graduate"></i> Estudiante actual: <strong>${sanitize(nota.nombre_estudiante || '—')}</strong>
        </p>` : ''}
      </div>

      <!-- Evaluación y tipo -->
      <div class="form-row">
        <div class="form-group">
          <label><i class="fas fa-file-alt"></i> Evaluación / Actividad</label>
          <select id="n-evaluacion">
            <option value="">Seleccionar evaluación (opcional)...</option>
            ${evaluaciones.map(e =>
              `<option value="${e.id}"
                data-materia="${e.id_materia}"
                data-mat-nombre="${sanitize(e.nombre_materia || '')}"
                ${nota?.id_evaluacion === e.id ? 'selected' : ''}>
                ${sanitize(e.titulo)} – ${sanitize(e.nombre_materia || '')}
              </option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label><i class="fas fa-tag"></i> Tipo de actividad</label>
          <select id="n-tipo">
            <option value="">Seleccionar tipo...</option>
            ${TIPOS_ACTIVIDAD.map(t =>
              `<option value="${t}" ${tipoActual === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <!-- Materia (auto-fill al seleccionar evaluación, o manual) -->
      <div class="form-group">
        <label><i class="fas fa-book"></i> Materia</label>
        <select id="n-materia">
          <option value="">Seleccionar materia...</option>
          ${materias.map(m =>
            `<option value="${m.id}" data-nombre="${sanitize(m.nombre)}"
              ${nota?.id_materia === m.id ? 'selected' : ''}>${sanitize(m.nombre)}</option>`
          ).join('')}
        </select>
      </div>

      <!-- Calificación, fecha, estado -->
      <div class="form-row">
        <div class="form-group">
          <label><i class="fas fa-star"></i> Calificación (0 – 5)</label>
          <input type="number" id="n-calificacion"
            value="${nota ? nota.calificacion || '' : ''}"
            placeholder="ej: 4.5" min="0" max="5" step="0.1" />
          <small style="color:var(--text-muted);">Deja vacío si aún no hay nota.</small>
        </div>
        <div class="form-group">
          <label><i class="fas fa-calendar"></i> Fecha de la actividad</label>
          <input type="date" id="n-fecha" value="${nota ? nota.fecha_actividad || hoy() : hoy()}" />
        </div>
      </div>

      <!-- Estado -->
      <div class="form-group">
        <label><i class="fas fa-info-circle"></i> Estado de la actividad</label>
        <div class="estados-grid">
          ${Object.entries(ESTADOS_ACTIVIDAD).map(([est, conf]) => `
          <label class="estado-radio-label ${estadoActual === est ? 'active' : ''}"
            style="--est-color:${conf.color};--est-bg:${conf.bg};"
            onclick="ModuloNotas._seleccionarEstado(this, '${est}')">
            <input type="radio" name="n-estado" value="${est}" ${estadoActual === est ? 'checked' : ''} style="display:none;" />
            <i class="${conf.icon}"></i> ${est}
          </label>`).join('')}
        </div>
      </div>

      <!-- Comentario -->
      <div class="form-group">
        <label><i class="fas fa-comment"></i> Comentario (opcional)</label>
        <input type="text" id="n-comentario"
          value="${nota ? sanitize(nota.comentario || '') : ''}"
          placeholder="Observaciones sobre la actividad..." />
      </div>
    `;

    abrirModal({
      titulo: es_edicion ? 'Editar Nota / Calificación' : 'Registrar Nota / Calificación',
      cuerpo: html,
      textoConfirmar: es_edicion ? 'Actualizar' : 'Registrar',
      onConfirm: async () => {
        const evaluacionId = val('n-evaluacion');
        const calStr       = val('n-calificacion');
        const calificacion = calStr !== '' ? parseFloat(calStr) : null;
        const estId        = val('n-est-id');
        const estNom       = val('n-est-nombre');
        const materiaId    = val('n-materia');

        if (!estId || !estNom) {
          showToast('Busca y selecciona un estudiante primero.', 'error');
          return;
        }
        if (!materiaId) {
          showToast('Selecciona una materia.', 'error');
          return;
        }

        if (calificacion !== null && (isNaN(calificacion) || calificacion < 0 || calificacion > 5)) {
          showToast('La calificación debe estar entre 0 y 5 (o vacía).', 'error');
          return;
        }

        const evObj  = evaluaciones.find(e => e.id === evaluacionId);
        const matObj = materias.find(m => m.id === materiaId);

        // Estado seleccionado
        const estadoRdo = document.querySelector('input[name="n-estado"]:checked');
        const estado    = estadoRdo ? estadoRdo.value : 'Pendiente';

        const datos = {
          id_estudiante:     estId,
          nombre_estudiante: estNom,
          email_estudiante:  val('n-email-est'),
          id_profesor:       user.id,
          nombre_profesor:   user.nombre,
          id_evaluacion:     evaluacionId || '',
          nombre_evaluacion: evObj ? evObj.titulo : (val('n-tipo') || 'Actividad'),
          calificacion:      calificacion,
          id_materia:        materiaId,
          nombre_materia:    matObj ? matObj.nombre : (evObj ? evObj.nombre_materia : ''),
          fecha_actividad:   val('n-fecha') || hoy(),
          estado:            estado,
          tipo_actividad:    val('n-tipo'),
          comentario:        val('n-comentario'),
          usuario_id:        user.id   // compatibilidad retroactiva
        };

        if (es_edicion) {
          await API.update('notas', nota.id, { ...nota, ...datos });
          showToast('Nota actualizada. El estudiante puede verla ahora.', 'success');
        } else {
          datos.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
          await API.create('notas', datos);
          showToast('Nota registrada. Visible para el estudiante inmediatamente.', 'success');
        }
        cerrarModal();
        await this.cargar();
      }
    });

    // Auto-rellenar materia al cambiar evaluación
    setTimeout(() => {
      const selEval = document.getElementById('n-evaluacion');
      if (selEval) {
        selEval.addEventListener('change', () => {
          const opt = selEval.options[selEval.selectedIndex];
          const matId  = opt?.dataset?.materia || '';
          const matNom = opt?.dataset?.matNombre || '';
          if (matId) {
            const selMat = document.getElementById('n-materia');
            if (selMat) selMat.value = matId;
          }
        });
      }
    }, 100);
  },

  // ── Seleccionar estado visualmente ───────────────────────────────────────
  _seleccionarEstado(label, estado) {
    document.querySelectorAll('.estado-radio-label').forEach(l => l.classList.remove('active'));
    label.classList.add('active');
    const input = label.querySelector('input[type="radio"]');
    if (input) input.checked = true;
  },

  // ── Buscar estudiante por email ───────────────────────────────────────────
  async _buscarEstudiante() {
    const email  = (val('n-email-est') || '').trim().toLowerCase();
    const resEl  = document.getElementById('n-est-resultado');
    const hidId  = document.getElementById('n-est-id');
    const hidNom = document.getElementById('n-est-nombre');

    if (!email) {
      resEl.innerHTML = '<span style="color:var(--danger)">Escribe un correo electrónico.</span>';
      return;
    }

    resEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';

    try {
      const resp       = await API.get('usuarios', { limit: 500 });
      const todos      = resp.data || [];
      const encontrado = todos.find(u =>
        u.email?.toLowerCase() === email && u.rol === 'estudiante'
      );

      if (encontrado) {
        hidId.value  = encontrado.id;
        hidNom.value = encontrado.nombre;
        resEl.innerHTML = `<span style="color:var(--success)">
          <i class="fas fa-check-circle"></i>
          Estudiante: <strong>${sanitize(encontrado.nombre)}</strong>
          ${encontrado.grado ? `(${sanitize(encontrado.grado)})` : ''}
        </span>`;
      } else {
        hidId.value  = '';
        hidNom.value = '';
        resEl.innerHTML = '<span style="color:var(--danger)"><i class="fas fa-times-circle"></i> No se encontró un estudiante con ese correo.</span>';
      }
    } catch (err) {
      resEl.innerHTML = '<span style="color:var(--danger)">Error al buscar. Intenta nuevamente.</span>';
    }
  },

  // ── Proyección de nota ────────────────────────────────────────────────────
  _initProyeccion() {
    const btn = document.getElementById('btn-calcular-proy');
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => this.calcularProyeccion());
    }
  },

  calcularProyeccion() {
    const actual      = parseFloat(val('proy-actual'));
    const porcentaje  = parseFloat(val('proy-porcentaje'));
    const minima      = parseFloat(val('proy-minima')) || 3.0;
    const resultDiv   = document.getElementById('proy-resultado');

    if (isNaN(actual) || isNaN(porcentaje)) {
      showToast('Por favor ingresa los valores requeridos.', 'error');
      return;
    }
    if (porcentaje <= 0 || porcentaje >= 100) {
      showToast('El porcentaje completado debe estar entre 1 y 99.', 'error');
      return;
    }

    const restante       = (100 - porcentaje) / 100;
    const notaNecesaria  = (minima - actual * (porcentaje / 100)) / restante;

    let mensaje = '';
    let color   = '';

    if (notaNecesaria <= 0) {
      mensaje = `✅ ¡Ya aprobaste! Con ${actual.toFixed(1)} en el ${porcentaje}% completado, no puedes reprobar.`;
      color   = '#40C057';
    } else if (notaNecesaria <= 5.0) {
      mensaje = `📊 Necesitas sacar <strong>${notaNecesaria.toFixed(2)}</strong> en el ${100 - porcentaje}% restante para aprobar con ${minima}.`;
      color   = notaNecesaria >= 4.5 ? '#FA5252' : notaNecesaria >= 3.5 ? '#FD7E14' : '#40C057';
    } else {
      mensaje = `❌ Con ${actual.toFixed(1)} en el ${porcentaje}% completado, ya no es posible aprobar con ${minima}. La nota necesaria sería ${notaNecesaria.toFixed(2)} (imposible en escala 0-5).`;
      color   = '#FA5252';
    }

    resultDiv.innerHTML = `<span style="color:white">${mensaje}</span>`;
    resultDiv.classList.remove('hidden');
  },

  // ── Editar / Eliminar ─────────────────────────────────────────────────────
  editar(id) {
    const nota = this._notas.find(n => n.id === id);
    if (nota) this.abrirFormulario(nota);
  },

  eliminar(id) {
    abrirModal({
      titulo: 'Eliminar Nota',
      cuerpo: '<p>¿Eliminar esta calificación? Esta acción no se puede deshacer.</p>',
      textoConfirmar: 'Eliminar',
      onConfirm: async () => {
        await API.delete('notas', id);
        cerrarModal();
        showToast('Nota eliminada.', 'success');
        await this.cargar();
      }
    });
  },

  getNotas() { return this._notas; }
};

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-nueva-nota');
  if (btn) btn.addEventListener('click', () => ModuloNotas.abrirFormulario());
});

console.log('✅ notas.js cargado');
