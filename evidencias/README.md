# Evidencias de prueba

Capturas de las pruebas de las cuatro solicitudes de cambio. Cada carpeta `SC-00X` tiene cuatro subcarpetas, ordenadas en el orden en que se probó:

| Subcarpeta | Qué contiene |
|---|---|
| `1-navegador` | Pruebas desde el frontend: lo que ve el administrador en pantalla, incluidos los mensajes de error |
| `2-postman` | Pruebas de la API con Postman: códigos de respuesta (200, 201, 400, 401, 404, 409, 422) y mensajes |
| `3-test-terminal` | Scripts de `backend/test/` que lanzan pedidos simultáneos para probar la concurrencia |
| `4-phpmyadmin` | Consultas a la base de datos que confirman el resultado real de cada prueba |

## Solicitudes

| Carpeta | Solicitud | Qué se comprueba |
|---|---|---|
| `SC-001` | Confirmación sin duplicados | Dos confirmaciones simultáneas del mismo médico, fecha y hora: solo una se confirma, la otra recibe 409 |
| `SC-002` | Cancelación segura | El horario queda libre y dos cancelaciones simultáneas no se pisan: una responde 200 y la otra 409 |
| `SC-003` | Bloqueo de agenda | Vista previa, cancelación de los turnos afectados con su motivo, rechazo de turnos nuevos en el período y consulta de los bloqueos |
| `SC-004` | Carga masiva | Hasta 20 turnos en una sola transacción: si una fila falla no se guarda ninguna y se informan todos los errores |

El nombre de cada captura empieza con la solicitud y un número (`SC003_05_...`). Las de Postman llevan `PM` y las de terminal o base de datos llevan `BE`.

Los scripts de prueba y cómo ejecutarlos están explicados en el `README.md` principal del proyecto.
