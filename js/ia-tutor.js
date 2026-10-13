/**
 * EduAgenda – Módulo Tutor IA (Google Gemini)
 * API GRATUITA: https://aistudio.google.com/app/apikey
 */

const ModuloIA = {
  _apiKey: '',
  _historial: [],
  _contextMateria: '',

  init() {
    // Cargar API key guardada
    const savedKey = Storage.get('gemini_key') || '';
    if (savedKey) {
      document.getElementById('gemini-api-key').value = savedKey;
      this._apiKey = savedKey;
    }

    // Cargar historial del chat
    this._historial = Storage.get('chat_historial') || [];
    if (this._historial.length > 0) {
      this._restaurarHistorial();
    }

    this._initEventos();
  },

  _initEventos() {
    // Guardar API key
    const btnSave = document.getElementById('btn-save-key');
    if (btnSave && !btnSave._listenerAdded) {
      btnSave.addEventListener('click', () => {
        const key = document.getElementById('gemini-api-key').value.trim();
        if (!key) { showToast('Ingresa una API Key válida.', 'error'); return; }
        this._apiKey = key;
        Storage.set('gemini_key', key);
        showToast('✅ API Key guardada correctamente.', 'success');
      });
      btnSave._listenerAdded = true;
    }

    // Selector de materia de contexto
    const matSel = document.getElementById('ia-materia-select');
    if (matSel && !matSel._listenerAdded) {
      matSel.addEventListener('change', () => {
        this._contextMateria = matSel.options[matSel.selectedIndex]?.text || '';
        if (this._contextMateria && this._contextMateria !== 'General (sin materia específica)') {
          showToast(`Contexto: ${this._contextMateria}`, 'info', 1500);
        }
      });
      matSel._listenerAdded = true;
    }

    // Limpiar chat
    const btnClear = document.getElementById('btn-clear-chat');
    if (btnClear && !btnClear._listenerAdded) {
      btnClear.addEventListener('click', () => {
        this._historial = [];
        Storage.remove('chat_historial');
        const chatMsg = document.getElementById('chat-messages');
        chatMsg.innerHTML = `
          <div class="chat-bubble ia-bubble welcome-bubble">
            <div class="bubble-avatar"><i class="fas fa-robot"></i></div>
            <div class="bubble-content">
              <p><strong>Chat limpiado. ¿En qué puedo ayudarte? 🤖</strong></p>
            </div>
          </div>`;
        showToast('Chat limpiado.', 'info', 1500);
      });
      btnClear._listenerAdded = true;
    }

    // Botón enviar
    const btnSend = document.getElementById('btn-send-msg');
    if (btnSend && !btnSend._listenerAdded) {
      btnSend.addEventListener('click', () => this.enviarMensaje());
      btnSend._listenerAdded = true;
    }

    // Enter para enviar (Shift+Enter = nueva línea)
    const chatInput = document.getElementById('chat-input');
    if (chatInput && !chatInput._listenerAdded) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.enviarMensaje();
        }
      });
      // Auto-resize textarea
      chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
      });
      chatInput._listenerAdded = true;
    }

    // Sugerencias de preguntas
    document.querySelectorAll('.suggestion-btn').forEach(btn => {
      if (!btn._listenerAdded) {
        btn.addEventListener('click', () => {
          document.getElementById('chat-input').value = btn.textContent;
          this.enviarMensaje();
        });
        btn._listenerAdded = true;
      }
    });
  },

  _restaurarHistorial() {
    const chatMsg = document.getElementById('chat-messages');
    // Limpiar bienvenida si hay historial
    chatMsg.innerHTML = '';
    this._historial.forEach(msg => {
      this._agregarBurbuja(msg.rol, msg.texto, false);
    });
    this._scrollAlFondo();
  },

  async enviarMensaje() {
    const input  = document.getElementById('chat-input');
    const texto  = input.value.trim();
    if (!texto) return;

    if (!this._apiKey) {
      showToast('⚠️ Primero configura tu API Key de Gemini (es gratuita).', 'warning');
      document.getElementById('gemini-api-key').focus();
      return;
    }

    // Mostrar mensaje del usuario
    this._agregarBurbuja('user', texto);
    input.value = '';
    input.style.height = 'auto';

    // Guardar en historial
    this._historial.push({ rol: 'user', texto });

    // Ocultar sugerencias después del primer mensaje
    document.getElementById('chat-suggestions').style.display = 'none';

    // Mostrar indicador de escritura
    const typingId = this._mostrarTyping();

    try {
      const respuesta = await this._llamarGemini(texto);
      this._quitarTyping(typingId);
      this._agregarBurbuja('ia', respuesta);
      this._historial.push({ rol: 'ia', texto: respuesta });

      // Guardar historial (máximo 30 mensajes)
      if (this._historial.length > 30) {
        this._historial = this._historial.slice(-30);
      }
      Storage.set('chat_historial', this._historial);
    } catch (err) {
      this._quitarTyping(typingId);
      const errMsg = this._manejarError(err);
      this._agregarBurbuja('ia', errMsg);
    }
  },

  async _llamarGemini(pregunta) {
    const user    = Auth.getUser();
    const notas   = ModuloNotas ? ModuloNotas.getNotas() : [];
    const tareas  = ModuloTareas ? ModuloTareas.getTareas() : [];

    // Contexto del estudiante para personalización
    const promedioGen = notas.length
      ? (notas.map(n => parseFloat(n.calificacion)).filter(v=>!isNaN(v)).reduce((a,b)=>a+b,0) / notas.length).toFixed(2)
      : 'sin datos';

    const tareasP = tareas.filter(t => t.estado !== 'completada').length;

    const systemPrompt = `Eres EduBot, el tutor inteligente de EduAgenda, una plataforma académica colombiana.
Hablas siempre en español de Colombia, de forma amigable, clara y motivadora.
Ayudas a estudiantes, docentes y acudientes con dudas académicas.

INFORMACIÓN DEL USUARIO:
- Nombre: ${user.nombre}
- Rol: ${user.rol}
${this._contextMateria && this._contextMateria !== 'General (sin materia específica)' ? `- Materia de contexto: ${this._contextMateria}` : ''}
- Promedio general: ${promedioGen} (escala 0-5)
- Tareas pendientes: ${tareasP}

INSTRUCCIONES:
1. Responde preguntas académicas de forma didáctica
2. Cuando uses fórmulas matemáticas, escríbelas claramente
3. Da ejemplos prácticos y colombianos cuando sea posible
4. Si el estudiante tiene promedio bajo, motívalo y da consejos
5. Para trabajos y tareas, da guías pero NO hagas el trabajo completo
6. Usa emojis con moderación para hacer las respuestas más amigables
7. Máximo 400 palabras por respuesta (sé conciso)`;

    // Construir historial para la API (últimos 10 mensajes)
    const histReciente = this._historial.slice(-10);
    const contents = histReciente.map(h => ({
      role: h.rol === 'ia' ? 'model' : 'user',
      parts: [{ text: h.texto }]
    }));

    // Agregar pregunta actual
    contents.push({
      role: 'user',
      parts: [{ text: pregunta }]
    });

    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature:     0.75,
        maxOutputTokens: 800,
        topP:            0.8
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
      ]
    };

    // Intentar con gemini-1.5-flash (gratuito y potente)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this._apiKey}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw { status: resp.status, data: errData };
    }

    const data = await resp.json();
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!texto) throw new Error('Respuesta vacía de la IA');
    return texto;
  },

  _manejarError(err) {
    console.error('Error Gemini:', err);
    if (err?.status === 400) {
      return '❌ **API Key inválida.** Verifica que la clave sea correcta. Obtén una gratis en [Google AI Studio](https://aistudio.google.com/app/apikey).';
    }
    if (err?.status === 429) {
      return '⏳ **Límite de solicitudes alcanzado.** La API gratuita tiene límites por minuto. Espera un momento e intenta de nuevo.';
    }
    if (err?.status === 403) {
      return '🔒 **API Key sin permisos.** Asegúrate de que la API de Gemini esté habilitada en tu proyecto de Google Cloud.';
    }
    return '❌ **Error al conectar con la IA.** Verifica tu conexión a internet y tu API Key.';
  },

  _agregarBurbuja(rol, texto, scroll = true) {
    const chatMsg = document.getElementById('chat-messages');
    const div     = document.createElement('div');
    div.className = `chat-bubble ${rol === 'user' ? 'user-bubble' : 'ia-bubble'}`;

    const avatarEl = document.createElement('div');
    avatarEl.className = 'bubble-avatar';
    avatarEl.innerHTML = rol === 'user'
      ? iniciales(Auth.getUser()?.nombre || 'Yo')
      : '<i class="fas fa-robot"></i>';

    const contentEl  = document.createElement('div');
    contentEl.className = 'bubble-content';

    if (rol === 'ia') {
      contentEl.innerHTML = markdownToHtml(texto);
    } else {
      contentEl.textContent = texto;
    }

    if (rol === 'user') {
      div.appendChild(contentEl);
      div.appendChild(avatarEl);
    } else {
      div.appendChild(avatarEl);
      div.appendChild(contentEl);
    }

    chatMsg.appendChild(div);
    if (scroll) this._scrollAlFondo();
  },

  _mostrarTyping() {
    const chatMsg = document.getElementById('chat-messages');
    const id      = 'typing-' + Date.now();
    const div     = document.createElement('div');
    div.id        = id;
    div.className = 'chat-bubble ia-bubble';
    div.innerHTML = `
      <div class="bubble-avatar"><i class="fas fa-robot"></i></div>
      <div class="bubble-content">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>`;
    chatMsg.appendChild(div);
    this._scrollAlFondo();
    return id;
  },

  _quitarTyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  },

  _scrollAlFondo() {
    const chatMsg = document.getElementById('chat-messages');
    if (chatMsg) chatMsg.scrollTop = chatMsg.scrollHeight;
  }
};

console.log('✅ ia-tutor.js cargado');
