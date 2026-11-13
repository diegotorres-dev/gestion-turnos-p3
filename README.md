# Sistema de Gestión de Turnos Médicos

Aplicación para administrar turnos médicos: API REST con Node.js, Express y MySQL, y un frontend en HTML, CSS y JavaScript. Tiene tres perfiles (administrador, médico y paciente) con sesiones por token JWT y permisos por rol.

## Estructura

```
gestion-turnos/
├── backend/
│   ├── config/        conexión a MySQL (pool)
│   ├── routes/        rutas de la API
│   ├── controllers/   respuestas HTTP
│   ├── services/      consultas a MySQL
│   ├── middlewares/   validaciones, token y roles
│   ├── test/          scripts de prueba manual
│   └── server.js
├── database/          scripts SQL
├── frontend/
│   ├── index.html     inicio de sesión
│   ├── pages/         dashboard.html (admin) y mis-turnos.html (médico y paciente)
│   ├── js/            api.js, app.js, dashboard.js, mis-turnos.js
│   └── css/
```

## Puesta en marcha

1. Importar `database/gestion_turnos.sql`, luego `database/turnos.sql` y luego `database/migracion_verificacion_email.sql`.
2. Crear `backend/.env` con las variables `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `JWT_SECRET` y `FRONTEND_URL`.
3. Instalar dependencias y arrancar el servidor:

```
cd backend
npm install
npm start
```

El servidor queda en `http://localhost:3000`.

4. Abrir `frontend/index.html` con Live Server (puerto 5500).

## Perfiles y permisos

| id_rol | Perfil | Pantalla | Qué puede hacer |
|---|---|---|---|
| 1 | Administrador | `pages/dashboard.html` | Ver todos los turnos, crearlos, confirmarlos y cancelarlos |
| 2 | Médico | `pages/mis-turnos.html` | Ver su agenda (turnos asignados a su matrícula) |
| 3 | Paciente | `pages/mis-turnos.html` | Ver sus turnos y cancelar los propios |

El token JWT lleva `id_usuario`, `email`, `id_rol` y, según el perfil, `dni_paciente` o `matricula_medico`. Los turnos de "mis turnos" se filtran siempre con los datos del token, nunca con un parámetro de la URL.

## Rutas

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | público | Inicia sesión y devuelve un token JWT |
| POST | `/api/auth/registro/paciente` | público | Registra un paciente |
| POST | `/api/auth/registro/medico` | público | Registra un médico |
| GET | `/api/auth/verificar-email` | público | Verifica el correo |
| GET | `/api/turnos/mis-turnos` | médico, paciente | Turnos del usuario que inició sesión |
| PUT | `/api/turnos/mis-turnos/:id/cancelar` | paciente | Cancela un turno propio |
| GET | `/api/turnos` | admin | Lista todos los turnos |
| GET | `/api/turnos/:id` | admin | Devuelve un turno |
| GET | `/api/turnos/paciente/:dni` | admin | Turnos de un paciente |
| POST | `/api/turnos` | admin | Crea un turno |
| PUT | `/api/turnos/:id/confirmar` | admin | Confirma un turno |
| PUT | `/api/turnos/:id/cancelar` | admin | Cancela un turno |

Las rutas de turnos requieren el header `Authorization: Bearer <token>`. Sin token responden 401 y con un rol que no corresponde responden 403.

## Validaciones nuevas

1. **El médico debe estar habilitado para la práctica** (tabla `practica_medico`). Se controla al crear un turno con médico y al confirmarlo. Responde 409.
2. **El médico no puede tener dos turnos a la misma fecha y hora.** Se controla al confirmar, ignorando los turnos cancelados. Responde 409.

## Mejora funcional

**Cancelación de turnos:** el administrador cancela cualquier turno desde el panel, y el paciente cancela solo los suyos desde "Mis turnos". Ambos usan un diálogo de confirmación y ven un aviso con el resultado.