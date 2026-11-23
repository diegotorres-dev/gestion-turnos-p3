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
    const base = new Date(Date.UTC(2029, 0, 2));
    base.setUTCDate(base.getUTCDate() + Math.floor(Math.random() * 300));
    if (base.getUTCDay() === 0) {
        base.setUTCDate(base.getUTCDate() + 1);
    }
    return base.toISOString().slice(0, 10);
}

function fila(fecha, hora, dni, practica, matricula) {
    return {
        fecha_turno: fecha,
        hora_turno: hora,
        dni_paciente: dni,
        id_practica: practica,
        medico_confirmacion: matricula,
        medio_solicitado: 'Web'
    };
}

async function cantidadDeTurnos(token) {
    const resultado = await pedir('GET', '/turnos', token);
    return resultado.datos.length;
}

function veredicto(titulo, ok) {
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
    const fecha = fechaAleatoria();
    const creados = [];

    console.log(`--- Prueba 1: lote con errores (no debe cargarse nada) el ${fecha} ---`);

    const antes = await cantidadDeTurnos(token);
    const conErrores = await pedir('POST', '/turnos/masivo', token, {
        turnos: [
            fila(fecha, '09:00', 30100101, 1, MATRICULA),
            fila(fecha, '10:00', 11111111, 1, MATRICULA),
            fila(fecha, '09:00', 30100202, 2, MATRICULA),
            fila(fecha, '11:00', 30100202, 2, '')
        ]
    });
    console.log('Respuesta:', conErrores.estado, JSON.stringify(conErrores.datos));
    const despues = await cantidadDeTurnos(token);
    veredicto('se rechazó el lote y se informaron las 3 filas con error', conErrores.estado === 422 && conErrores.datos.resumen.con_error === 3);
    veredicto('no se guardó ningún turno', antes === despues);

    console.log('--- Prueba 2: lote válido ---');

    const valido = await pedir('POST', '/turnos/masivo', token, {
        turnos: [
            fila(fecha, '09:00', 30100101, 1, MATRICULA),
            fila(fecha, '10:00', 30100202, 2, MATRICULA),
            fila(fecha, '11:00', 30100101, 1, MATRICULA)
        ]
    });
    console.log('Respuesta:', valido.estado, JSON.stringify(valido.datos));
    veredicto('se cargaron los 3 turnos', valido.estado === 201 && valido.datos.turnos_creados.length === 3);

    if (valido.estado === 201) {
        valido.datos.turnos_creados.forEach((t) => creados.push(t.id_turno));
        const primero = await pedir('GET', `/turnos/${creados[0]}`, token);
        veredicto('el turno quedó Confirmado con el médico asignado', primero.datos.estado_turno === 'Confirmado' && primero.datos.medico_confirmacion === MATRICULA);
    }

    console.log('--- Prueba 3: repetir el mismo lote ---');

    const antesRepetido = await cantidadDeTurnos(token);
    const repetido = await pedir('POST', '/turnos/masivo', token, {
        turnos: [
            fila(fecha, '09:00', 30100101, 1, MATRICULA),
            fila(fecha, '10:00', 30100202, 2, MATRICULA)
        ]
    });
    console.log('Respuesta:', repetido.estado, JSON.stringify(repetido.datos));
    veredicto('se rechazó por conflictos con turnos ya cargados', repetido.estado === 422);
    veredicto('no se guardó ningún turno', antesRepetido === await cantidadDeTurnos(token));

    console.log('--- Prueba 4: más turnos que el máximo ---');

    const demasiados = await pedir('POST', '/turnos/masivo', token, {
        turnos: Array.from({ length: 21 }, () => fila(fecha, '12:00', 30100101, 1, MATRICULA))
    });
    console.log('Respuesta:', demasiados.estado, JSON.stringify(demasiados.datos));
    veredicto('se rechazó el lote por superar el máximo', demasiados.estado === 400);

    console.log('--- Prueba 5: dos lotes al mismo tiempo para el mismo médico, fecha y hora ---');

    const fecha2 = fechaAleatoria();
    const [a, b] = await Promise.all([
        pedir('POST', '/turnos/masivo', token, { turnos: [fila(fecha2, '09:00', 30100101, 1, MATRICULA)] }),
        pedir('POST', '/turnos/masivo', token, { turnos: [fila(fecha2, '09:00', 30100202, 2, MATRICULA)] })
    ]);
    console.log('Lote A:', a.estado, JSON.stringify(a.datos));
    console.log('Lote B:', b.estado, JSON.stringify(b.datos));
    [a, b].forEach((r) => {
        if (r.estado === 201) {
            r.datos.turnos_creados.forEach((t) => creados.push(t.id_turno));
        }
    });
    const exitosos = [a, b].filter((r) => r.estado === 201).length;
    veredicto('solo un lote pudo cargarse', exitosos === 1);

    for (const id of creados) {
        await pedir('PUT', `/turnos/${id}/cancelar`, token);
    }
    console.log('Turnos de prueba cancelados para dejar la agenda limpia');
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
