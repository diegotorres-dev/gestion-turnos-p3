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
│   ├── pages/         dashboard.html, bloqueos.html y carga-masiva.html (admin) y mis-turnos.html (médico y paciente)
│   ├── js/            api.js, app.js, comun.js, dashboard.js, bloqueos.js, carga-masiva.js, mis-turnos.js
│   └── css/
```

## Puesta en marcha

1. Importar, en este orden: `database/gestion_turnos.sql`, `database/turnos.sql`, `database/migracion_verificacion_email.sql` y por último `database/final_cambios.sql` (crea las tablas `historial_estado_turno` y `bloqueo_agenda` y agrega `motivo_cancelacion` e `id_bloqueo` a `turno`).
   `final_cambios.sql` se ejecuta una sola vez: si se corre de nuevo falla porque las tablas y columnas ya existen.
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
| 1 | Administrador | `pages/dashboard.html`, `pages/bloqueos.html`, `pages/carga-masiva.html` | Ver todos los turnos, crearlos, confirmarlos y cancelarlos, bloquear la agenda de un médico y cargar turnos en lote |
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
| POST | `/api/turnos/masivo` | admin | Carga hasta 20 turnos en una sola transacción |
| GET | `/api/bloqueos/vista-previa` | admin | Muestra los turnos que se cancelarían con un bloqueo |
| GET | `/api/bloqueos` | admin | Lista los bloqueos de agenda |
| POST | `/api/bloqueos` | admin | Bloquea la agenda de un médico y cancela los turnos afectados |
| GET | `/api/practicas` | admin | Lista de prácticas (para los selectores) |
| GET | `/api/medicos` | admin | Lista de médicos (para los selectores) |

Las rutas de turnos requieren el header `Authorization: Bearer <token>`. Sin token responden 401 y con un rol que no corresponde responden 403.

## Validaciones nuevas

1. **El médico debe estar habilitado para la práctica** (tabla `practica_medico`). Se controla al crear un turno con médico y al confirmarlo. Responde 409.
2. **El médico no puede tener dos turnos a la misma fecha y hora.** Se controla al confirmar, ignorando los turnos cancelados. Responde 409.

## Mejora funcional

**Cancelación de turnos:** el administrador cancela cualquier turno desde el panel, y el paciente cancela solo los suyos desde "Mis turnos". Ambos usan un diálogo de confirmación y ven un aviso con el resultado.

## Solicitudes de cambio del final

Todas las operaciones de abajo usan transacciones (`beginTransaction`, `commit`, `rollback`) sobre una conexión propia y bloqueo de filas con `SELECT ... FOR UPDATE`. La fila del médico es el punto de bloqueo común, así que dos pedidos simultáneos sobre el mismo médico se ejecutan uno después del otro.

**SC-001 - Confirmación sin duplicados:** `PUT /api/turnos/:id/confirmar` ya no permite dos turnos confirmados para el mismo médico, fecha y hora, aunque se confirmen al mismo tiempo. El que llega segundo recibe 409.

**SC-002 - Cancelación segura:** `PUT /api/turnos/:id/cancelar` cancela dentro de una transacción, libera el horario y registra el cambio en `historial_estado_turno`. Si dos cancelaciones llegan juntas, una responde 200 y la otra 409.

**SC-003 - Bloqueo de agenda:** desde `pages/bloqueos.html` el administrador elige médico, desde, hasta y motivo. Primero ve la vista previa de los turnos afectados y, al confirmar, se cancelan con el motivo guardado en `motivo_cancelacion` y el `id_bloqueo`. Mientras dure el bloqueo no se pueden crear ni confirmar turnos de ese médico en ese período (el "hasta" no se incluye).

**SC-004 - Carga masiva:** desde `pages/carga-masiva.html` se cargan hasta 20 turnos de una vez. Es todo o nada: si una fila tiene error no se guarda ninguna y la respuesta (422) lista todos los errores con su número de fila.

## Pruebas de concurrencia

Los scripts están en `backend/test/` y necesitan el servidor andando (`npm start`) y, en `backend/.env`, las variables `ADMIN_EMAIL` y `ADMIN_PASSWORD` de un administrador. Se corren desde `backend`:

```
node test/test-concurrencia-confirmar.js
node test/test-concurrencia-cancelar.js
node test/test-bloqueo-agenda.js
node test/test-carga-masiva.js
```

Cada script crea sus propios turnos con fechas futuras, dispara los pedidos en simultáneo, informa `OK` o `FALLO` y cancela lo que creó al terminar.
