const API_URL = 'http://localhost:3000/api'; //URL base del servidor para las peticiones

async function iniciarSesion(email, password) { //Función para iniciar sesión mandando las credenciales
    const respuesta = await fetch(`${API_URL}/auth/login`, { //Realiza un POST al endpoint de inicio de sesión
        method: 'POST',
        headers: { //Cabecera de la petición
            'Content-Type': 'application/json' //Indica que el cuerpo de la petición se envía como un JSON
        },
        body: JSON.stringify({ //Convierte el objeto JS con el email y password a un JSON
            email: email,
            password: password
        })
    });

    const datos = await respuesta.json(); //Convierte la respuesta recibida del servidor a un objeto JSON

    if (!respuesta.ok) { //Si ocurre algún tipo de error (400, 401, etc) tira un error
        throw new Error(datos.error || 'No se pudo iniciar sesión'); //Tira un error con el mensaje del backend o uno por defecto
    }

    return datos; //Retorna los datos que obtuvo del servidor (por ej el token de autenticación)
}

async function obtenerTurnos(token) { //Función para solicitar la lista de turnos al servidor usando un token de seguridad
    const respuesta = await fetch(`${API_URL}/turnos`, { //GET al endpoint de turnos
        headers: { //Cabecera de la petición
            Authorization: `Bearer ${token}` //Manda el token de acceso para identificarse
        }
    });

    const datos = await respuesta.json(); //Espera y convierte la respuesta del servidor en un objeto JSON

    if (!respuesta.ok) { //Comprueba si la petición falló (por ej token inválido o expirado)
        const error = new Error(datos.error || 'No se pudieron obtener los turnos'); //Manda msj del backend o uno por defecto
        error.estado = respuesta.status; //Adjunta el código de respuesta para mayor control
        throw error;
    }

    return datos; //Devuelve la lista de turnos de la BD
}

async function modificarTurno(token, id, accion, cuerpo) {
    const respuesta = await fetch(`${API_URL}/turnos/${id}/${accion}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(cuerpo || {})
    });

    const datos = await respuesta.json();

    if (!respuesta.ok) {
        const error = new Error(datos.error || 'No se pudo realizar la operación');
        error.estado = respuesta.status;
        throw error;
    }

    return datos;
}

function cancelarTurno(token, id) {
    return modificarTurno(token, id, 'cancelar');
}

function confirmarTurno(token, id, matricula) {
    return modificarTurno(token, id, 'confirmar', { medico_confirmacion: matricula });
}

async function obtenerMisTurnos(token) {
    const respuesta = await fetch(`${API_URL}/turnos/mis-turnos`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    const datos = await respuesta.json();

    if (!respuesta.ok) {
        const error = new Error(datos.error || 'No se pudieron obtener tus turnos');
        error.estado = respuesta.status;
        throw error;
    }

    return datos;
}

function cancelarMiTurno(token, id) {
    return modificarTurno(token, `mis-turnos/${id}`, 'cancelar');
}
