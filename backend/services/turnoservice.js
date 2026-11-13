const db = require('../config/database'); //Importo el pool de conexiones a MySQL

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

module.exports = {
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
