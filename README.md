# 📚 EduAgenda – Gestión Académica Inteligente

> Aplicación web escolar para estudiantes, docentes y acudientes del colegio.
> Desarrollado por: **Emanuel Valencia Parra** y **Ximena González Arenas** – Grado 11-3

---

## 🎯 ¿Qué es EduAgenda?

EduAgenda es una **aplicación web completa** para gestionar información académica de un colegio. Permite:

- 👨‍🎓 **Estudiantes**: Ver materias, tareas, notas, horario y comunicarse con docentes
- 👩‍🏫 **Docentes**: Crear materias, publicar evaluaciones, registrar notas y faltas
- 👨‍👩‍👧 **Acudientes**: Consultar el rendimiento académico de sus hijos

---

## ✅ Funcionalidades Implementadas

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| 🔐 Login/Registro | Autenticación por rol (estudiante, docente, acudiente) | ✅ Completo |
| 📊 Dashboard | Estadísticas, gráficos, tareas y evaluaciones próximas | ✅ Completo |
| 📚 Materias | CRUD completo con colores e íconos personalizables | ✅ Completo |
| 📅 Horario | Horario semanal interactivo con tabla visual | ✅ Completo |
| ✅ Tareas | Lista con prioridades, fechas y estados | ✅ Completo |
| 📝 Evaluaciones | Registro con tipo, porcentaje y fechas | ✅ Completo |
| ⭐ Notas | Calificaciones agrupadas por materia con promedio | ✅ Completo |
| 📊 Proyección de Nota | Calculadora: ¿qué nota necesito para aprobar? | ✅ Completo |
| 📋 Asistencia | Registro de faltas justificadas/injustificadas | ✅ Completo |
| 💬 Mensajes | Sistema de mensajería interna entre usuarios | ✅ Completo |
| 🤖 Tutor IA | Chat con Google Gemini personalizado | ✅ Completo |
| 👤 Perfil | Edición de datos personales y estadísticas | ✅ Completo |
| 🌙 Modo Oscuro | Tema oscuro con persistencia | ✅ Completo |
| 📱 Responsive | Funciona en móvil y computador | ✅ Completo |

---

## 🗂️ Estructura del Proyecto

```
EduAgenda/
├── index.html              ← App principal
├── guia-instalacion.html   ← Documentación técnica y guía de publicación
├── README.md               ← Este archivo
├── css/
│   ├── style.css           ← Estilos principales
│   └── responsive.css      ← Estilos responsivos
└── js/
    ├── utils.js            ← Funciones de ayuda globales
    ├── api.js              ← Capa de comunicación con la BD
    ├── auth.js             ← Autenticación y sesión
    ├── app.js              ← Controlador principal y navegación
    ├── materias.js         ← Módulo de materias
    ├── tareas.js           ← Módulo de tareas
    ├── evaluaciones.js     ← Módulo de evaluaciones
    ├── notas.js            ← Módulo de notas y calculadora
    ├── asistencia.js       ← Módulo de faltas
    ├── mensajes.js         ← Sistema de mensajería
    ├── horario.js          ← Horario semanal
    ├── ia-tutor.js         ← Tutor IA con Gemini
    ├── dashboard.js        ← Dashboard y gráficos
    └── perfil.js           ← Perfil de usuario
```

---

## 🗄️ Modelos de Datos

### Tabla: `usuarios`
```json
{
  "id": "uuid",
  "nombre": "Ana García",
  "correo": "ana@email.com",
  "contrasena": "base64(password)",
  "rol": "estudiante|docente|acudiente",
  "telefono": "3001234567",
  "activo": true
}
```

### Tabla: `materias`
```json
{
  "id": "uuid",
  "nombre": "Matemáticas",
  "descripcion": "Álgebra y Geometría",
  "id_profesor": "uuid-del-docente",
  "nombre_profesor": "Prof. García",
  "color": "#3B5BDB",
  "icono": "fa-calculator",
  "usuario_id": "uuid"
}
```

### Tabla: `tareas`
```json
{
  "id": "uuid",
  "titulo": "Ejercicios cap. 5",
  "descripcion": "...",
  "fecha_entrega": "2025-12-20",
  "prioridad": "alta|media|baja",
  "estado": "pendiente|en_progreso|completada",
  "id_materia": "uuid",
  "nombre_materia": "Matemáticas",
  "usuario_id": "uuid"
}
```

### Tabla: `notas`
```json
{
  "id": "uuid",
  "id_estudiante": "uuid",
  "nombre_estudiante": "Ana García",
  "id_evaluacion": "uuid",
  "nombre_evaluacion": "Parcial 1",
  "calificacion": 4.5,
  "id_materia": "uuid",
  "nombre_materia": "Matemáticas",
  "comentario": "Excelente",
  "usuario_id": "uuid"
}
```

---

## 🚀 URLs de Acceso

| Ruta | Descripción |
|------|-------------|
| `/index.html` | Aplicación principal |
| `/guia-instalacion.html` | Guía técnica y de publicación |

### Endpoints de la API (internos):
```
GET    tables/usuarios
GET    tables/materias
GET    tables/tareas
GET    tables/evaluaciones
GET    tables/notas
GET    tables/faltas
GET    tables/mensajes
GET    tables/horarios
POST   tables/{tabla}
PUT    tables/{tabla}/{id}
PATCH  tables/{tabla}/{id}
DELETE tables/{tabla}/{id}
```

---

## 🤖 Configuración de la IA

1. Ve a [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Crea una API Key gratuita (no requiere tarjeta)
3. En la app, ve a **Tutor IA** y pega tu clave
4. El modelo usado es **Gemini 1.5 Flash** (gratis, rápido)

**Límites del plan gratuito**: 15 req/min · 1M tokens/min · 1500 req/día

---

## 🎨 Paleta de Colores

| Color | Hex | Uso |
|-------|-----|-----|
| Azul Principal | `#3B5BDB` | Primario, navegación |
| Púrpura | `#845EF7` | Gradientes, IA |
| Verde | `#40C057` | Éxito, aprobado |
| Naranja | `#FD7E14` | Alertas, prioridad media |
| Rojo | `#FA5252` | Error, reprobado, urgente |
| Amarillo | `#FAB005` | Advertencias |

---

## 📱 Cuentas de Demo

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Estudiante | estudiante@demo.com | demo123 |
| Docente | docente@demo.com | demo123 |
| Acudiente | acudiente@demo.com | demo123 |

---

## 🔜 Próximas Mejoras Sugeridas

- [ ] Sistema de notificaciones push
- [ ] Modo offline completo (Service Worker + IndexedDB)
- [ ] Importar/Exportar datos en Excel
- [ ] Galería de recursos y archivos adjuntos
- [ ] Módulo de acudientes con vista de seguimiento familiar
- [ ] Reportes PDF de boletines de notas
- [ ] Videollamadas integradas para tutorías
- [ ] Calendario compartido entre clases

---

## 📋 Tecnologías Usadas (todas gratuitas)

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| HTML5 | - | Estructura |
| CSS3 | - | Estilos |
| JavaScript | ES2020+ | Lógica |
| Chart.js | 4.4.0 | Gráficos |
| Font Awesome | 6.5.0 | Íconos |
| Google Fonts (Inter) | - | Tipografía |
| Google Gemini API | 1.5 Flash | IA Tutor |
| API REST de Tablas | - | Base de datos |

---

*EduAgenda v1.0 © 2025 – Emanuel Valencia Parra & Ximena González Arenas – 11-3*
