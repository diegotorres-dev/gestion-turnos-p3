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
    const base = new Date(Date.UTC(2028, 0, 3));
    base.setUTCDate(base.getUTCDate() + Math.floor(Math.random() * 300));
    if (base.getUTCDay() === 0) {
        base.setUTCDate(base.getUTCDate() + 1);
    }
    return base.toISOString().slice(0, 10);
}

async function fechaLibre(token) {
    const bloqueos = await pedir('GET', '/bloqueos', token);
    for (let intento = 0; intento < 50; intento++) {
        const fecha = fechaAleatoria();
        const ocupada = bloqueos.datos.some((b) => b.matricula_medico === MATRICULA && b.fecha_hora_desde.startsWith(fecha));
        if (!ocupada) {
            return fecha;
        }
    }
    throw new Error('No se encontró una fecha libre de bloqueos');
}

async function crearReservado(token, fecha, hora, dni, practica, matricula) {
    const resultado = await pedir('POST', '/turnos', token, {
        fecha_turno: fecha,
        hora_turno: hora,
        medio_solicitado: 'Web',
        estado_turno: 'Reservado',
        dni_paciente: dni,
        id_practica: practica,
        ...(matricula ? { medico_confirmacion: matricula } : {})
    });

    if (resultado.estado !== 201) {
        throw new Error(`No se pudo crear el turno: ${JSON.stringify(resultado.datos)}`);
    }

    return resultado.datos.id_turno;
}

async function crearConfirmado(token, fecha, hora, dni, practica) {
    const id = await crearReservado(token, fecha, hora, dni, practica);
    const confirmacion = await pedir('PUT', `/turnos/${id}/confirmar`, token, { medico_confirmacion: MATRICULA });
    if (confirmacion.estado !== 200) {
        throw new Error(`No se pudo confirmar el turno ${id}: ${JSON.stringify(confirmacion.datos)}`);
    }
    return id;
}

async function estadoDe(token, id) {
    const resultado = await pedir('GET', `/turnos/${id}`, token);
    return resultado.datos.estado_turno;
}

function resultado(titulo, ok) {
    console.log(`${ok ? 'OK' : 'PROBLEMA'}: ${titulo}`);
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
    const fecha = await fechaLibre(token);
    const aLimpiar = [];

    console.log(`--- Prueba 1: bloqueo de ${fecha} 09:00 a 11:00 para el médico ${MATRICULA} ---`);

    const idA = await crearConfirmado(token, fecha, '09:00', 30100101, 1);
    const idB = await crearConfirmado(token, fecha, '10:00', 30100202, 2);
    const idC = await crearConfirmado(token, fecha, '11:00', 30100101, 1);
    aLimpiar.push(idA, idB, idC);
    console.log(`Turnos confirmados: ${idA} (09:00), ${idB} (10:00) y ${idC} (11:00)`);

    const query = `matricula_medico=${MATRICULA}&desde=${fecha}T09:00&hasta=${fecha}T11:00`;
    const previa = await pedir('GET', `/bloqueos/vista-previa?${query}`, token);
    console.log('Vista previa:', previa.estado, `total=${previa.datos.total}`);
    resultado('la vista previa muestra 2 turnos (el de las 11:00 queda afuera)', previa.datos.total === 2);

    const bloqueo = await pedir('POST', '/bloqueos', token, {
        matricula_medico: MATRICULA,
        desde: `${fecha}T09:00`,
        hasta: `${fecha}T11:00`,
        motivo: 'Prueba automática de bloqueo'
    });
    console.log('Bloqueo:', bloqueo.estado, bloqueo.datos.mensaje);
    resultado('el bloqueo se registró y canceló 2 turnos', bloqueo.estado === 201 && bloqueo.datos.total === 2);

    const [ea, eb, ec] = await Promise.all([estadoDe(token, idA), estadoDe(token, idB), estadoDe(token, idC)]);
    console.log(`Estados: A=${ea}, B=${eb}, C=${ec}`);
    resultado('A y B quedaron Cancelado y C sigue Confirmado', ea === 'Cancelado' && eb === 'Cancelado' && ec === 'Confirmado');

    console.log('--- Prueba 2: no se pueden tomar turnos dentro del bloqueo ---');

    const idD = await crearReservado(token, fecha, '10:00', 30100202, 2);
    aLimpiar.push(idD);
    const confirmarD = await pedir('PUT', `/turnos/${idD}/confirmar`, token, { medico_confirmacion: MATRICULA });
    console.log('Confirmar turno D dentro del bloqueo:', confirmarD.estado, JSON.stringify(confirmarD.datos));
    resultado('confirmar dentro del bloqueo es rechazado', confirmarD.estado === 409);

    const crearConMedico = await pedir('POST', '/turnos', token, {
        fecha_turno: fecha,
        hora_turno: '09:00',
        medio_solicitado: 'Web',
        estado_turno: 'Reservado',
        dni_paciente: 30100101,
        id_practica: 1,
        medico_confirmacion: MATRICULA
    });
    console.log('Crear turno con médico dentro del bloqueo:', crearConMedico.estado, JSON.stringify(crearConMedico.datos));
    resultado('crear un turno con ese médico dentro del bloqueo es rechazado', crearConMedico.estado === 409);

    const idBorde = await crearReservado(token, fecha, '11:00', 30100202, 2);
    aLimpiar.push(idBorde);
    const confirmarBorde = await pedir('PUT', `/turnos/${idBorde}/confirmar`, token, { medico_confirmacion: MATRICULA });
    console.log('Turno a las 11:00 (justo en el borde):', confirmarBorde.estado, JSON.stringify(confirmarBorde.datos));

    console.log('--- Prueba 3: bloqueo y confirmación al mismo tiempo ---');

    const fecha2 = await fechaLibre(token);
    const idE = await crearReservado(token, fecha2, '12:00', 30100101, 1);
    aLimpiar.push(idE);
    console.log(`Turno ${idE} reservado el ${fecha2} a las 12:00. Se manda confirmar y bloquear a la vez...`);

    const [confirmarE, bloquearE] = await Promise.all([
        pedir('PUT', `/turnos/${idE}/confirmar`, token, { medico_confirmacion: MATRICULA }),
        pedir('POST', '/bloqueos', token, {
            matricula_medico: MATRICULA,
            desde: `${fecha2}T12:00`,
            hasta: `${fecha2}T13:00`,
            motivo: 'Prueba automática de simultaneidad'
        })
    ]);

    console.log('Confirmar:', confirmarE.estado, JSON.stringify(confirmarE.datos));
    console.log('Bloquear:', bloquearE.estado, JSON.stringify(bloquearE.datos));

    const estadoE = await estadoDe(token, idE);
    console.log(`Estado final del turno ${idE}: ${estadoE}`);
    resultado('el turno no quedó Confirmado dentro del bloqueo', estadoE !== 'Confirmado');

    for (const id of aLimpiar) {
        await pedir('PUT', `/turnos/${id}/cancelar`, token);
    }
    console.log('Turnos de prueba cancelados para dejar la agenda limpia');
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
