/**
 * EduAgenda – Dashboard Principal
 * Carga estadísticas y gráficos de resumen
 */

const Dashboard = {
  _chartNotas: null,
  _chartPerfil: null,

  async cargar() {
    const user = Auth.getUser();

    // Actualizar fecha de bienvenida
    document.getElementById('dash-nombre').textContent = user.nombre.split(' ')[0];
    document.getElementById('dash-fecha').textContent  = fechaHoraActual();

    // Cargar datos en paralelo
    const [respMat, respTar, respNot, respFal, respMsg, respEval] = await Promise.all([
      API.get('materias',    { limit: 200 }),
      API.get('tareas',      { limit: 200 }),
      API.get('notas',       { limit: 200 }),
      API.get('faltas',      { limit: 200 }),
      API.get('mensajes',    { limit: 200 }),
      API.get('evaluaciones',{ limit: 200 })
    ]);

    // Si es acudiente, filtrar por el estudiante seleccionado
    const esAcudiente  = user.rol === 'acudiente';
    const estActivo    = esAcudiente ? Acudiente.getEstudianteActivoId() : null;

    const materias    = (respMat.data  || []).filter(m => this._filtroPorUser(m, user, estActivo));
    const tareas      = (respTar.data  || []).filter(t =>
      esAcudiente ? t.usuario_id === estActivo : t.usuario_id === user.id
    );
    const notas       = (respNot.data  || []).filter(n => this._filtroNotas(n, user, estActivo));
    const faltas      = (respFal.data  || []).filter(f => this._filtroFaltas(f, user, estActivo));
    const mensajes    = (respMsg.data  || []).filter(m => m.id_destinatario === user.id || m.id_remitente === user.id);
    const evaluaciones= (respEval.data || []).filter(e =>
      esAcudiente ? e.usuario_id === estActivo : true
    );

    // Stats cards
    const tareasP = tareas.filter(t => t.estado !== 'completada');
    const vals    = notas.map(n => parseFloat(n.calificacion)).filter(v => !isNaN(v));
    const prom    = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : '—';

    document.getElementById('stat-materias').textContent = materias.length;
    document.getElementById('stat-tareas').textContent   = tareasP.length;
    document.getElementById('stat-promedio').textContent  = prom;
    document.getElementById('stat-faltas').textContent   = faltas.length;

    // Mensajes no leídos
    const noLeidos = mensajes.filter(m => m.id_destinatario === user.id && !m.leido).length;
    const badge    = document.getElementById('msg-badge');
    if (noLeidos > 0) {
      badge.textContent = noLeidos;
      badge.classList.remove('hidden');
    }

    // Tareas próximas
    this._renderTareasDash(tareasP.slice(0,5));

    // Evaluaciones próximas
    const evalProximas = evaluaciones
      .filter(e => e.fecha_evaluacion && e.fecha_evaluacion >= hoy())
      .sort((a,b) => new Date(a.fecha_evaluacion) - new Date(b.fecha_evaluacion))
      .slice(0,5);
    this._renderEvalDash(evalProximas);

    // Mensajes recientes
    this._renderMsgDash(mensajes.slice(0,4));

    // Gráfico de notas por materia
    this._renderChartNotas(notas, materias);
  },

  _filtroPorUser(item, user, estActivoId) {
    if (user.rol === 'docente')    return item.id_profesor === user.id || item.usuario_id === user.id;
    if (user.rol === 'acudiente')  return true; // acudiente ve todas las materias (lectura)
    return true;
  },
  _filtroNotas(n, user, estActivoId) {
    if (user.rol === 'estudiante') return n.id_estudiante === user.id;
    if (user.rol === 'docente')    return n.id_profesor === user.id || n.usuario_id === user.id;
    if (user.rol === 'acudiente')  return n.id_estudiante === estActivoId;
    return n.id_estudiante === user.id;
  },
  _filtroFaltas(f, user, estActivoId) {
    if (user.rol === 'estudiante') return f.id_estudiante === user.id;
    if (user.rol === 'docente')    return f.id_profesor === user.id || f.usuario_id === user.id;
    if (user.rol === 'acudiente')  return f.id_estudiante === estActivoId;
    return f.id_estudiante === user.id;
  },

  _renderTareasDash(tareas) {
    const el = document.getElementById('dash-tareas-list');
    if (!tareas.length) {
      el.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>¡Sin tareas pendientes! 🎉</p></div>';
      return;
    }
    const colPrioridad = { alta: '#FA5252', media: '#FD7E14', baja: '#40C057' };
    el.innerHTML = tareas.map(t => {
      const color = colPrioridad[t.prioridad] || '#3B5BDB';
      return `
      <div class="dash-list-item" onclick="cambiarPagina('tareas')">
        <div class="item-icon" style="background:${color}22;color:${color}">
          <i class="fas fa-tasks"></i>
        </div>
        <div class="item-text">
          <div class="item-title">${sanitize(t.titulo)}</div>
          <div class="item-sub">${t.nombre_materia || 'Sin materia'} · ${t.fecha_entrega ? fechaRelativa(t.fecha_entrega) : 'Sin fecha'}</div>
        </div>
        <span class="item-badge" style="background:${color}22;color:${color}">${t.prioridad?.toUpperCase()}</span>
      </div>`;
    }).join('');
  },

  _renderEvalDash(evals) {
    const el = document.getElementById('dash-eval-list');
    if (!evals.length) {
      el.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-check"></i><p>No hay evaluaciones próximas</p></div>';
      return;
    }
    el.innerHTML = evals.map(e => `
      <div class="dash-list-item" onclick="cambiarPagina('evaluaciones')">
        <div class="item-icon" style="background:var(--purple-light);color:var(--purple)">
          <i class="fas ${iconoTipoEval(e.tipo)}"></i>
        </div>
        <div class="item-text">
          <div class="item-title">${sanitize(e.titulo)}</div>
          <div class="item-sub">${sanitize(e.nombre_materia || '—')} · ${formatearFecha(e.fecha_evaluacion)}</div>
        </div>
        <span class="item-badge" style="background:var(--purple-light);color:var(--purple)">${e.porcentaje}%</span>
      </div>`).join('');
  },

  _renderMsgDash(msgs) {
    const user = Auth.getUser();
    const el   = document.getElementById('dash-msg-list');
    if (!msgs.length) {
      el.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No hay mensajes</p></div>';
      return;
    }
    el.innerHTML = msgs.map(m => {
      const esRecibido  = m.id_destinatario === user.id;
      const contraparte = esRecibido ? m.nombre_remitente : m.nombre_destinatario;
      const noLeido     = esRecibido && !m.leido;
      return `
      <div class="dash-list-item ${noLeido ? 'font-bold' : ''}" onclick="cambiarPagina('mensajes')">
        <div class="item-icon" style="background:var(--primary-light);color:var(--primary)">
          ${iniciales(contraparte || '?')}
        </div>
        <div class="item-text">
          <div class="item-title">${sanitize(contraparte || '—')} ${noLeido ? '🔵' : ''}</div>
          <div class="item-sub">${(m.contenido || '').replace(/<[^>]+>/g,'').substring(0,50)}...</div>
        </div>
        <span class="item-badge" style="background:var(--surface-2);color:var(--text-muted)">${esRecibido ? '📨' : '📤'}</span>
      </div>`;
    }).join('');
  },

  _renderChartNotas(notas, materias) {
    const ctx = document.getElementById('chart-notas');
    if (!ctx) return;

    // Agrupar notas por materia
    const porMateria = {};
    notas.forEach(n => {
      const k = n.nombre_materia || 'Sin materia';
      if (!porMateria[k]) porMateria[k] = [];
      const v = parseFloat(n.calificacion);
      if (!isNaN(v)) porMateria[k].push(v);
    });

    const labels = Object.keys(porMateria);
    const data   = labels.map(k => {
      const vs = porMateria[k];
      return vs.length ? (vs.reduce((a,b)=>a+b,0)/vs.length).toFixed(2) : 0;
    });

    const colores = labels.map((_,i) => COLORES_MATERIAS[i % COLORES_MATERIAS.length]);

    // Destruir chart previo si existe
    if (this._chartNotas) {
      this._chartNotas.destroy();
    }

    if (!labels.length) {
      ctx.parentElement.innerHTML = `
        <div class="empty-state" style="padding:3rem;">
          <i class="fas fa-chart-bar"></i>
          <p>Registra notas para ver el gráfico de rendimiento</p>
        </div>`;
      return;
    }

    this._chartNotas = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Promedio',
          data,
          backgroundColor: colores.map(c => c + '88'),
          borderColor: colores,
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => {
                const prom = parseFloat(ctx.raw);
                return prom >= 4.0 ? '🟢 Excelente' : prom >= 3.0 ? '🟡 Aprobado' : '🔴 Reprobado';
              }
            }
          }
        },
        scales: {
          y: {
            min: 0, max: 5,
            ticks: { stepSize: 1 },
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }
};

console.log('✅ dashboard.js cargado');
