/**
 * EduAgenda – Módulo de Asistencia (Faltas)
 * 
 * SINCRONIZACIÓN:
 *  - Docente registra falta → guarda id_estudiante (real), id_profesor, nombre_profesor
 *  - Estudiante filtra por id_estudiante === user.id
 *  - Acudiente filtra por id_estudiante === estudianteActivo.id
 *  - Docente filtra por id_profesor === user.id
 */

const ModuloAsistencia = {
  _faltas: [],
  _autoRefreshTimer: null,

  async cargar() {
    const container = document.getElementById('faltas-container');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando asistencia...</div>';

    const user = Auth.getUser();
    const resp = await API.get('faltas', { limit: 500 });
    let faltas = resp.data || [];

    // ── Filtro por rol ──────────────────────────────────────────────────────
    if (user.rol === 'estudiante') {
      // Estudiante: solo sus propias faltas (por id_estudiante)
      faltas = faltas.filter(f => f.id_estudiante === user.id);

    } else if (user.rol === 'acudiente') {
      // Acudiente: faltas del hijo seleccionado
      const estId = Acudiente.getEstudianteActivoId();
      if (!estId) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-user"></i><p>Selecciona un estudiante primero.</p></div>';
        return;
      }
      faltas = faltas.filter(f => f.id_estudiante === estId);

    } else if (user.rol === 'docente') {
      // Docente: faltas que él registró (por id_profesor o usuario_id)
      faltas = faltas.filter(f =>
        f.id_profesor === user.id || f.usuario_id === user.id
      );
    }

    // Ordenar por fecha descendente
    faltas.sort((a, b) => new Date(b.fecha_falta) - new Date(a.fecha_falta));
    this._faltas = faltas;
    this._actualizarStats(faltas);
    this._render(faltas, user);
    this._initFiltros(user);

    // Auto-refresh cada 30 s para estudiante y acudiente
    this._iniciarAutoRefresh(user);

    // Mostrar indicador de sync solo para estudiante/acudiente
    const syncEl = document.getElementById('asistencia-sync-indicator');
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
        if (paginaActual && paginaActual.id === 'page-asistencia') {
          await this.cargar();
        } else {
          this._detenerAutoRefresh();
        }
      }, 30000); // 30 segundos
    }
  },

  _detenerAutoRefresh() {
    if (this._autoRefreshTimer) {
      clearInterval(this._autoRefreshTimer);
      this._autoRefreshTimer = null;
    }
  },

  // ── Estadísticas ──────────────────────────────────────────────────────────
  _actualizarStats(faltas) {
    const total        = faltas.length;
    const justificadas = faltas.filter(f => f.justificada === true || f.justificada === 'true').length;
    document.getElementById('total-faltas').textContent          = total;
    document.getElementById('faltas-justificadas').textContent   = justificadas;
    document.getElementById('faltas-injustificadas').textContent = total - justificadas;
  },

  // ── Filtros ───────────────────────────────────────────────────────────────
  _initFiltros(user) {
    const selMat  = document.getElementById('filter-materia-faltas');
    const selJust = document.getElementById('filter-justificada');
    // Evitar listeners duplicados
    const newMat  = selMat.cloneNode(true);
    const newJust = selJust.cloneNode(true);
    selMat.parentNode.replaceChild(newMat, selMat);
    selJust.parentNode.replaceChild(newJust, selJust);

    newMat.addEventListener('change',  () => this._aplicarFiltros(user));
    newJust.addEventListener('change', () => this._aplicarFiltros(user));
  },

  _aplicarFiltros(user) {
    let lista  = [...this._faltas];
    const mat  = document.getElementById('filter-materia-faltas').value;
    const just = document.getElementById('filter-justificada').value;
    if (mat)        lista = lista.filter(f => f.id_materia === mat);
    if (just !== '') lista = lista.filter(f => String(f.justificada) === just);
    this._render(lista, user);
    this._actualizarStats(lista);
  },

  // ── Render ────────────────────────────────────────────────────────────────
  _render(faltas, user) {
    user = user || Auth.getUser();
    const container = document.getElementById('faltas-container');
    if (!faltas.length) {
      container.innerHTML = `<div class="empty-state">
        <i class="fas fa-calendar-check"></i>
        <p>¡Sin faltas registradas! 🎉</p>
        ${user.rol === 'docente' ? '<p style="font-size:.85rem;color:var(--text-muted)">Usa el botón <strong>+ Nueva Falta</strong> para registrar.</p>' : ''}
      </div>`;
      return;
    }

    const esDoc      = user.rol === 'docente';
    const esEstudiante = user.rol === 'estudiante';
    const esAcudiente  = user.rol === 'acudiente';

    container.innerHTML = faltas.map(f => {
      const justificada = f.justificada === true || f.justificada === 'true';
      const tieneObs    = f.observacion && f.observacion.trim();
      const tieneJust   = f.justificacion && f.justificacion.trim();

      return `
      <div class="falta-card ${justificada ? 'justificada' : 'injustificada'}">
        <div class="falta-info">
          <h4>
            <i class="fas fa-book" style="color:var(--primary);margin-right:.3rem;"></i>
            ${sanitize(f.nombre_materia || 'Materia no especificada')}
          </h4>

          ${esDoc ? `
          <p class="falta-meta">
            <i class="fas fa-user-graduate"></i>
            <strong>Estudiante:</strong> ${sanitize(f.nombre_estudiante || '—')}
          </p>` : ''}

          ${(esEstudiante || esAcudiente) && f.nombre_profesor ? `
          <p class="falta-meta">
            <i class="fas fa-chalkboard-teacher"></i>
            <strong>Docente:</strong> ${sanitize(f.nombre_profesor)}
          </p>` : ''}

          ${tieneObs ? `
          <p class="falta-meta falta-obs">
            <i class="fas fa-comment-alt"></i>
            <span>${sanitize(f.observacion)}</span>
          </p>` : ''}

          ${tieneJust ? `
          <p class="falta-meta" style="color:var(--text-muted);">
            <i class="fas fa-file-alt"></i>
            <em>Justificación:</em> ${sanitize(f.justificacion)}
          </p>` : ''}
        </div>

        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.5rem;flex-shrink:0;">
          <span class="tag ${justificada ? 'tag-baja' : 'tag-alta'}">
            ${justificada ? '✅ Justificada' : '❌ Sin justificar'}
          </span>
          <span class="falta-fecha">
            <i class="fas fa-calendar"></i> ${formatearFecha(f.fecha_falta)}
          </span>
          ${esDoc ? `
          <div style="display:flex;gap:.25rem;margin-top:.25rem;">
            <button class="btn-icon" title="Editar" onclick="ModuloAsistencia.editar('${f.id}')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon" title="Eliminar" onclick="ModuloAsistencia.eliminar('${f.id}')">
              <i class="fas fa-trash" style="color:var(--danger)"></i>
            </button>
          </div>` : ''}
        </div>
      </div>`;
    }).join('');
  },

  // ── Formulario (docente) ──────────────────────────────────────────────────
  abrirFormulario(falta = null) {
    const user       = Auth.getUser();
    const materias   = ModuloMaterias.getMaterias();
    const es_edicion = !!falta;

    const html = `
      <div class="form-group">
        <label><i class="fas fa-search"></i> Buscar estudiante por correo electrónico</label>
        <div style="display:flex;gap:.5rem;align-items:center;">
          <input type="email" id="f-email-est"
            value="${falta ? sanitize(falta.email_estudiante || '') : ''}"
            placeholder="correo@estudiante.com"
            style="flex:1;" />
          <button type="button" class="btn-secondary" style="white-space:nowrap;" onclick="ModuloAsistencia._buscarEstudiante()">
            <i class="fas fa-search"></i> Buscar
          </button>
        </div>
        <div id="f-est-resultado" style="margin-top:.4rem;font-size:.85rem;color:var(--text-muted);min-height:1.2rem;"></div>
        <input type="hidden" id="f-est-id"   value="${falta ? falta.id_estudiante || '' : ''}" />
        <input type="hidden" id="f-est-nombre" value="${falta ? sanitize(falta.nombre_estudiante || '') : ''}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label><i class="fas fa-book"></i> Materia</label>
          <select id="f-materia">
            <option value="">Seleccionar...</option>
            ${materias.map(m => `<option value="${m.id}" ${falta?.id_materia === m.id ? 'selected' : ''}>${sanitize(m.nombre)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label><i class="fas fa-calendar"></i> Fecha de la falta</label>
          <input type="date" id="f-fecha" value="${falta ? falta.fecha_falta || hoy() : hoy()}" max="${hoy()}" />
        </div>
      </div>
      <div class="form-group">
        <label><i class="fas fa-comment-alt"></i> Observación del docente (opcional)</label>
        <textarea id="f-observacion" rows="2" placeholder="Observación sobre la falta...">${falta ? sanitize(falta.observacion || '') : ''}</textarea>
      </div>
      <div class="form-group">
        <label><i class="fas fa-file-alt"></i> Justificación del estudiante (opcional)</label>
        <textarea id="f-justificacion" rows="2" placeholder="Motivo presentado por el estudiante...">${falta ? sanitize(falta.justificacion || '') : ''}</textarea>
      </div>
      <div class="form-check" style="margin-top:.5rem;">
        <input type="checkbox" id="f-justificada" ${falta?.justificada ? 'checked' : ''} />
        <label for="f-justificada">Falta justificada</label>
      </div>
      ${falta ? `<p style="font-size:.78rem;color:var(--text-muted);margin-top:.5rem;">
        <i class="fas fa-info-circle"></i>
        Estudiante: <strong>${sanitize(falta.nombre_estudiante || '—')}</strong>
      </p>` : ''}
    `;

    abrirModal({
      titulo: es_edicion ? 'Editar Falta' : 'Registrar Falta de Asistencia',
      cuerpo: html,
      textoConfirmar: es_edicion ? 'Actualizar' : 'Registrar',
      onConfirm: async () => {
        const matId  = val('f-materia');
        const matObj = materias.find(m => m.id === matId);
        const estId  = val('f-est-id');
        const estNom = val('f-est-nombre');

        if (!estId || !estNom) {
          showToast('Busca y selecciona un estudiante primero.', 'error');
          return;
        }
        if (!matId) {
          showToast('Selecciona una materia.', 'error');
          return;
        }

        const datos = {
          id_estudiante:    estId,
          nombre_estudiante: estNom,
          email_estudiante: val('f-email-est'),
          id_profesor:      user.id,
          nombre_profesor:  user.nombre,
          id_materia:       matId,
          nombre_materia:   matObj ? matObj.nombre : '',
          fecha_falta:      val('f-fecha') || hoy(),
          observacion:      val('f-observacion'),
          justificacion:    val('f-justificacion'),
          justificada:      document.getElementById('f-justificada').checked,
          usuario_id:       user.id   // compatibilidad retroactiva
        };

        if (es_edicion) {
          await API.update('faltas', falta.id, { ...falta, ...datos });
          showToast('Falta actualizada correctamente.', 'success');
        } else {
          datos.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
          await API.create('faltas', datos);
          showToast('Falta registrada. El estudiante puede verla ahora.', 'success');
        }
        cerrarModal();
        await this.cargar();
      }
    });
  },

  // ── Buscar estudiante por email ───────────────────────────────────────────
  async _buscarEstudiante() {
    const email   = (val('f-email-est') || '').trim().toLowerCase();
    const resEl   = document.getElementById('f-est-resultado');
    const hidId   = document.getElementById('f-est-id');
    const hidNom  = document.getElementById('f-est-nombre');

    if (!email) {
      resEl.innerHTML = '<span style="color:var(--danger)">Escribe un correo electrónico.</span>';
      return;
    }

    resEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';

    try {
      const resp  = await API.get('usuarios', { limit: 500 });
      const todos = resp.data || [];
      const encontrado = todos.find(u =>
        u.email?.toLowerCase() === email && u.rol === 'estudiante'
      );

      if (encontrado) {
        hidId.value  = encontrado.id;
        hidNom.value = encontrado.nombre;
        resEl.innerHTML = `<span style="color:var(--success)">
          <i class="fas fa-check-circle"></i>
          Estudiante encontrado: <strong>${sanitize(encontrado.nombre)}</strong>
          (${sanitize(encontrado.grado || 'sin grado')})
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

  // ── Editar / Eliminar ────────────────────────────────────────────────────
  editar(id) {
    const f = this._faltas.find(f => f.id === id);
    if (f) this.abrirFormulario(f);
  },

  eliminar(id) {
    abrirModal({
      titulo: 'Eliminar Falta',
      cuerpo: '<p>¿Eliminar este registro de falta? Esta acción no se puede deshacer.</p>',
      textoConfirmar: 'Eliminar',
      onConfirm: async () => {
        await API.delete('faltas', id);
        cerrarModal();
        showToast('Registro de falta eliminado.', 'success');
        await this.cargar();
      }
    });
  },

  getFaltas() { return this._faltas; }
};

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-nueva-falta');
  if (btn) btn.addEventListener('click', () => ModuloAsistencia.abrirFormulario());
});

console.log('✅ asistencia.js cargado');
