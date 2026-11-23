const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const MATRICULA = Number(process.env.MATRICULA || 1001);

async function pedir(metodo, ruta, token, cuerpo) {
    const respuesta = await fetch(`${API_URL}${ruta}`, {
        method: metodo,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });

    const datos = await respuesta.json();
    return { estado: respuesta.status, datos };
}

function fechaAleatoria() {
    const base = new Date(Date.UTC(2027, 0, 4));
    base.setUTCDate(base.getUTCDate() + Math.floor(Math.random() * 300));
    if (base.getUTCDay() === 0) {
        base.setUTCDate(base.getUTCDate() + 1);
    }
    return base.toISOString().slice(0, 10);
}

function horaAleatoria() {
    const hora = 8 + Math.floor(Math.random() * 6);
    return `${String(hora).padStart(2, '0')}:00`;
}

async function crearReservado(token, fecha, hora, dni, practica) {
    const resultado = await pedir('POST', '/turnos', token, {
        fecha_turno: fecha,
        hora_turno: hora,
        medio_solicitado: 'Web',
        estado_turno: 'Reservado',
        dni_paciente: dni,
        id_practica: practica
    });

    if (resultado.estado !== 201) {
        throw new Error(`No se pudo crear el turno: ${JSON.stringify(resultado.datos)}`);
    }

    return resultado.datos.id_turno;
}

async function main() {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        throw new Error('Faltan las variables ADMIN_EMAIL y ADMIN_PASSWORD');
    }

    const login = await pedir('POST', '/auth/login', null, {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
    });

    if (login.estado !== 200) {
        throw new Error(`No se pudo iniciar sesión: ${JSON.stringify(login.datos)}`);
    }

    const token = login.datos.token;
    const fecha = fechaAleatoria();
    const hora = horaAleatoria();

    const idA = await crearReservado(token, fecha, hora, 30100101, 1);
    const confirmacion = await pedir('PUT', `/turnos/${idA}/confirmar`, token, { medico_confirmacion: MATRICULA });

    console.log(`Turno ${idA} creado y confirmado (${confirmacion.estado}) el ${fecha} a las ${hora} para el médico ${MATRICULA}`);
    console.log('Enviando dos cancelaciones del mismo turno al mismo tiempo...');

    const [a, b] = await Promise.all([
        pedir('PUT', `/turnos/${idA}/cancelar`, token),
        pedir('PUT', `/turnos/${idA}/cancelar`, token)
    ]);

    console.log('Cancelación 1:', a.estado, JSON.stringify(a.datos));
    console.log('Cancelación 2:', b.estado, JSON.stringify(b.datos));

    const exitosas = [a, b].filter((r) => r.estado === 200).length;

    if (exitosas === 2) {
        console.log('RESULTADO: PROBLEMA, las dos cancelaciones dijeron que salió bien');
    } else if (exitosas === 1) {
        console.log('RESULTADO: OK, una cancelación se hizo y la otra fue rechazada');
    } else {
        console.log('RESULTADO: no se canceló ninguna, revisar los mensajes de arriba');
    }

    console.log('Probando que el horario quedó libre: se reserva y confirma otro turno para el mismo médico, fecha y hora...');

    const idB = await crearReservado(token, fecha, hora, 30100202, 2);
    const reconfirmacion = await pedir('PUT', `/turnos/${idB}/confirmar`, token, { medico_confirmacion: MATRICULA });

    console.log(`Turno ${idB}:`, reconfirmacion.estado, JSON.stringify(reconfirmacion.datos));

    if (reconfirmacion.estado === 200) {
        console.log('RESULTADO: OK, el horario se liberó y se pudo reutilizar');
    } else {
        console.log('RESULTADO: PROBLEMA, el horario no quedó disponible');
    }

    await pedir('PUT', `/turnos/${idB}/cancelar`, token);
    console.log('Turno de prueba cancelado para dejar la agenda limpia');
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
