const db = require('../config/database'); //Importo el pool de conexiones a MySQL
const bloqueoService = require('./bloqueoservice');

async function obtenerTodos() { //Obtengo todos los turnos ordenados por fecha y hora
    const [turnos] = await db.query(`
        SELECT t.*,
               DATE_FORMAT(t.fecha_turno, '%Y-%m-%d') AS fecha_turno,
               CONCAT(p.apellido_paciente, ', ', p.nombre_paciente) AS nombre_paciente,
               pr.nombre_practica,
               CONCAT(m.apellido_medico, ', ', m.nombre_medico) AS nombre_medico
        FROM turno t
        JOIN paciente p ON p.dni_paciente = t.dni_paciente
        JOIN practica pr ON pr.id_practica = t.id_practica
        LEFT JOIN medico m ON m.matricula_medico = t.medico_confirmacion
        ORDER BY t.fecha_turno, t.hora_turno
    `);

    return turnos;
}

async function obtenerPorId(id) { //Devuelve un turno por su id o "undefined" si es que no existe
    const [turnos] = await db.execute(
        'SELECT * FROM turno WHERE id_turno = ?',
        [id]
    );

    return turnos[0]; //me devuelve el primer elemento de la lista de turnos porque Node siempre devuelve listas
}

async function obtenerPorPaciente(dni) { //Devuelve los turnos de un paciente por su dni
    const [turnos] = await db.execute(
        `SELECT *
         FROM turno
         WHERE dni_paciente = ?
         ORDER BY fecha_turno, hora_turno`,
        [dni]
    );

    return turnos; //acá no pongo [0] porque puedo obtener varios turnos con el mismo dni 
}

async function pacienteExiste(dni) { //Busca si el DNI está registrado como paciente
    const [pacientes] = await db.execute(
        'SELECT dni_paciente FROM paciente WHERE dni_paciente = ?',
        [dni]
    );

    return pacientes.length > 0; //devuelve true si esa lista es mayor a 0, o sea que sí existe un paciente con ese DNI
}

async function medicoExiste(matricula) { //Busca si la matrícula corresponde a un médico
    const [medicos] = await db.execute(
        'SELECT matricula_medico FROM medico WHERE matricula_medico = ?',
        [matricula]
    );

    return medicos.length > 0; //devuelve true si ese resultado es mayor a 0, o sea que sí pertenece
}

async function obtenerMisTurnos(idRol, identificador) { //Devuelve solo los turnos del paciente o del médico por su ROL
    const columna = idRol === 3 ? 't.dni_paciente' : 't.medico_confirmacion';

    const [turnos] = await db.execute(`
        SELECT t.*,
               DATE_FORMAT(t.fecha_turno, '%Y-%m-%d') AS fecha_turno,
               CONCAT(p.apellido_paciente, ', ', p.nombre_paciente) AS nombre_paciente,
               pr.nombre_practica,
               CONCAT(m.apellido_medico, ', ', m.nombre_medico) AS nombre_medico
        FROM turno t
        JOIN paciente p ON p.dni_paciente = t.dni_paciente
        JOIN practica pr ON pr.id_practica = t.id_practica
        LEFT JOIN medico m ON m.matricula_medico = t.medico_confirmacion
        WHERE ${columna} = ?
        ORDER BY t.fecha_turno, t.hora_turno
    `, [identificador]);

    return turnos;
}

async function medicoRealizaPractica(matricula, idPractica) { //Busca en la tabla si tal médico hace o no tal práctica
    const [filas] = await db.execute(
        'SELECT 1 FROM practica_medico WHERE matricula_medico = ? AND id_practica = ?',
        [matricula, idPractica] //Busca si ese médico (por la matricula) hace o no la práctica
    );

    return filas.length > 0;
}

async function medicoOcupado(matricula, idTurno) { //Busca si el médico tiene otro turno en la misma fecha y hora
    const [filas] = await db.execute(
        `SELECT o.id_turno
         FROM turno o
         JOIN turno t ON t.id_turno = ?
         WHERE o.medico_confirmacion = ?
           AND o.fecha_turno = t.fecha_turno
           AND o.hora_turno = t.hora_turno
           AND o.estado_turno <> 'Cancelado'
           AND o.id_turno <> t.id_turno`,
        [idTurno, matricula] //Une la tabla de turnos consigo misma, donde "t" es el turno a confirmar y "o" los demás turnos
    ); //Si coincide, devuelve true

    return filas.length > 0;
}

async function crear(datos) { //Crea un turno en la BD
    const [resultado] = await db.execute(
        `INSERT INTO turno
        (
            fecha_turno,
            hora_turno,
            medio_solicitado,
            estado_turno,
            fecha_confirmacion,
            medico_confirmacion,
            dni_paciente,
            id_practica,
            id_equipo,
            id_disponibilidad
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ 
            datos.fecha_turno,
            datos.hora_turno,
            datos.medio_solicitado,
            datos.estado_turno,
            datos.fecha_confirmacion ?? null,
            datos.medico_confirmacion ?? null,
            datos.dni_paciente,
            datos.id_practica,
            datos.id_equipo ?? null,
            datos.id_disponibilidad ?? null
        ] //se usa "??" para que diga si algún valor viene "undefined", que lo reemplace por "null" porque la BD no entiende "undefined"
    );

    return resultado.insertId;
}

async function cancelar(id) { //Cancela el turno
    await db.execute(
        "UPDATE turno SET estado_turno = 'Cancelado' WHERE id_turno = ?",
        [id] //simplemente hace un update para cambiar el estado para borrado lógico
    );
}

async function confirmar(id, matriculaMedico) { //Confirma el turno y registra fecha y médico
    await db.execute(
        `UPDATE turno
         SET estado_turno = 'Confirmado',
             fecha_confirmacion = NOW(),
             medico_confirmacion = ?
         WHERE id_turno = ?`,
        [matriculaMedico ?? null, id] //si no viene con la matricula, lo reemplaza con null
    );
}

async function confirmarSeguro(id, matriculaPedida, idUsuario) {
    const conexion = await db.getConnection();

    try {
        await conexion.beginTransaction();

        const [turnos] = await conexion.execute(
            'SELECT * FROM turno WHERE id_turno = ? FOR UPDATE',
            [id]
        );
        const turno = turnos[0];

        if (!turno) {
            await conexion.rollback();
            return { error: 'TURNO_NO_EXISTE' };
        }

        if (turno.estado_turno === 'Cancelado') {
            await conexion.rollback();
            return { error: 'TURNO_CANCELADO' };
        }

        if (turno.estado_turno === 'Confirmado') {
            await conexion.rollback();
            return { error: 'TURNO_YA_CONFIRMADO' };
        }

        const matricula = matriculaPedida ?? turno.medico_confirmacion ?? null;

        if (matricula !== null) {
            const [medicos] = /^\d+$/.test(String(matricula))
                ? await conexion.execute(
                    'SELECT matricula_medico FROM medico WHERE matricula_medico = ? FOR UPDATE',
                    [matricula]
                )
                : [[]];

            if (medicos.length === 0) {
                await conexion.rollback();
                return { error: 'MEDICO_NO_EXISTE', matricula };
            }

            const [habilitado] = await conexion.execute(
                'SELECT 1 FROM practica_medico WHERE matricula_medico = ? AND id_practica = ?',
                [matricula, turno.id_practica]
            );

            if (habilitado.length === 0) {
                await conexion.rollback();
                return { error: 'MEDICO_NO_HABILITADO' };
            }

            const [ocupado] = await conexion.execute(
                `SELECT id_turno
                 FROM turno
                 WHERE medico_confirmacion = ?
                   AND fecha_turno = ?
                   AND hora_turno = ?
                   AND estado_turno <> 'Cancelado'
                   AND id_turno <> ?`,
                [matricula, turno.fecha_turno, turno.hora_turno, turno.id_turno]
            );

            if (ocupado.length > 0) {
                await conexion.rollback();
                return { error: 'MEDICO_OCUPADO' };
            }

            const bloqueo = await bloqueoService.estaBloqueado(conexion, matricula, turno.fecha_turno, turno.hora_turno);
            if (bloqueo) {
                await conexion.rollback();
                return { error: 'MEDICO_BLOQUEADO', motivo: bloqueo.motivo };
            }
        }

        await conexion.execute(
            `UPDATE turno
             SET estado_turno = 'Confirmado',
                 fecha_confirmacion = NOW(),
                 medico_confirmacion = ?
             WHERE id_turno = ?`,
            [matricula, turno.id_turno]
        );

        await conexion.execute(
            'INSERT INTO historial_estado_turno (id_turno, estado_anterior, estado_nuevo, id_usuario) VALUES (?, ?, ?, ?)',
            [turno.id_turno, turno.estado_turno, 'Confirmado', idUsuario ?? null]
        );
        await conexion.commit();

        return { id_turno: turno.id_turno };

    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

async function cancelarSeguro(id, idUsuario) {
    const conexion = await db.getConnection();
    try {
        await conexion.beginTransaction();
        const [turnos] = await conexion.execute(
            'SELECT * FROM turno WHERE id_turno = ? FOR UPDATE',
            [id]
        );
        const turno = turnos[0];
        if (!turno) {
            await conexion.rollback();
            return { error: 'TURNO_NO_EXISTE' };
        }
        if (turno.estado_turno === 'Cancelado') {
            await conexion.rollback();
            return { error: 'TURNO_YA_CANCELADO' };
        }
        const [resultado] = await conexion.execute(
            `UPDATE turno SET estado_turno = 'Cancelado' WHERE id_turno = ? AND estado_turno <> 'Cancelado'`,
            [turno.id_turno]
        );
        if (resultado.affectedRows === 0) {
            await conexion.rollback();
            return { error: 'TURNO_YA_CANCELADO' };
        }
        await conexion.execute(
            'INSERT INTO historial_estado_turno (id_turno, estado_anterior, estado_nuevo, id_usuario) VALUES (?, ?, ?, ?)',
            [turno.id_turno, turno.estado_turno, 'Cancelado', idUsuario ?? null]
        );
        await conexion.commit();
        return { id_turno: turno.id_turno };
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

function normalizarHora(hora) {
    const texto = String(hora).trim();
    return texto.length === 5 ? `${texto}:00` : texto;
}

async function crearMasivo(filas, erroresPrevios, idUsuario) {
    const errores = [...erroresPrevios];
    const conexion = await db.getConnection();
    try {
        await conexion.beginTransaction();

        const conError = new Set(errores.map((e) => e.fila));
        const validas = filas.filter((f) => !conError.has(f.fila));

        const matriculas = [...new Set(validas.map((f) => Number(f.datos.medico_confirmacion)))].sort((a, b) => a - b);
        for (const matricula of matriculas) {
            await conexion.execute(
                'SELECT matricula_medico FROM medico WHERE matricula_medico = ? FOR UPDATE',
                [matricula]
            );
        }

        const vistos = { medico: new Map(), practica: new Map(), paciente: new Map() };
        const reglas = [
            ['medico', 'medico_confirmacion', 'El médico ya está asignado en la fila'],
            ['practica', 'id_practica', 'Ya hay una asignación para esa práctica en la fila'],
            ['paciente', 'dni_paciente', 'El paciente ya tiene un turno en la fila']
        ];

        for (const f of validas) {
            const d = f.datos;
            const momento = `${d.fecha_turno}|${normalizarHora(d.hora_turno)}`;
            let conflicto = null;

            for (const [grupo, campo, mensaje] of reglas) {
                const clave = `${momento}|${Number(d[campo])}`;
                if (!conflicto && vistos[grupo].has(clave)) {
                    conflicto = `${mensaje} ${vistos[grupo].get(clave)} para esa fecha y hora`;
                }
                if (!vistos[grupo].has(clave)) {
                    vistos[grupo].set(clave, f.fila);
                }
            }

            if (conflicto) {
                errores.push({ fila: f.fila, error: conflicto });
                continue;
            }

            const [ocupado] = await conexion.execute(
                `SELECT id_turno FROM turno
                 WHERE medico_confirmacion = ? AND fecha_turno = ? AND hora_turno = ? AND estado_turno <> 'Cancelado'`,
                [d.medico_confirmacion, d.fecha_turno, d.hora_turno]
            );
            if (ocupado.length > 0) {
                errores.push({ fila: f.fila, error: 'El médico ya tiene otro turno en esa fecha y hora' });
                continue;
            }

            const bloqueo = await bloqueoService.estaBloqueado(conexion, d.medico_confirmacion, d.fecha_turno, d.hora_turno);
            if (bloqueo) {
                errores.push({ fila: f.fila, error: `El médico tiene la agenda bloqueada en ese horario (${bloqueo.motivo})` });
            }
        }

        if (errores.length > 0) {
            await conexion.rollback();
            errores.sort((a, b) => a.fila - b.fila);
            return { errores };
        }

        const creados = [];
        for (const f of filas) {
            const d = f.datos;
            const [resultado] = await conexion.execute(
                `INSERT INTO turno
                 (fecha_turno, hora_turno, medio_solicitado, estado_turno, fecha_confirmacion, medico_confirmacion, dni_paciente, id_practica)
                 VALUES (?, ?, ?, 'Confirmado', NOW(), ?, ?, ?)`,
                [d.fecha_turno, d.hora_turno, d.medio_solicitado, d.medico_confirmacion, d.dni_paciente, d.id_practica]
            );
            creados.push({ fila: f.fila, id_turno: resultado.insertId });
        }

        await conexion.commit();

        return { creados };

    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

module.exports = {
    confirmarSeguro,
    cancelarSeguro,
    crearMasivo,
    obtenerTodos,
    obtenerPorId,
    obtenerPorPaciente,
    pacienteExiste,
    medicoExiste,
    medicoRealizaPractica,
    medicoOcupado,
    obtenerMisTurnos,
    crear,
    cancelar,
    confirmar
};
