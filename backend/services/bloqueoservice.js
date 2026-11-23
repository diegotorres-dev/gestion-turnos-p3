const db = require('../config/database');

const CONDICION_AFECTADOS = `t.medico_confirmacion = ?
    AND t.estado_turno <> 'Cancelado'
    AND TIMESTAMP(t.fecha_turno, t.hora_turno) >= ?
    AND TIMESTAMP(t.fecha_turno, t.hora_turno) < ?`;

async function estaBloqueado(ejecutor, matricula, fecha, hora) {
    const [bloqueos] = await ejecutor.execute(
        `SELECT id_bloqueo, motivo FROM bloqueo_agenda
         WHERE matricula_medico = ?
           AND TIMESTAMP(?, ?) >= fecha_hora_desde
           AND TIMESTAMP(?, ?) < fecha_hora_hasta
         LIMIT 1`,
        [matricula, fecha, hora, fecha, hora]
    );

    return bloqueos[0] || null;
}

async function validarRango(ejecutor, desde, hasta) {
    const [filas] = await ejecutor.execute(
        'SELECT (CAST(? AS DATETIME) >= CAST(? AS DATETIME)) AS invalido, (CAST(? AS DATETIME) <= NOW()) AS pasado',
        [desde, hasta, hasta]
    );

    if (Number(filas[0].invalido) === 1) {
        return 'RANGO_INVALIDO';
    }

    if (Number(filas[0].pasado) === 1) {
        return 'RANGO_PASADO';
    }

    return null;
}

async function buscarAfectados(ejecutor, matricula, desde, hasta, bloquear) {
    let filtro = CONDICION_AFECTADOS;
    let parametros = [matricula, desde, hasta];
    let estados = {};

    if (bloquear) {
        const [bloqueados] = await ejecutor.execute(
            `SELECT t.id_turno, t.estado_turno
             FROM turno t
             WHERE ${CONDICION_AFECTADOS}
             ORDER BY t.id_turno
             FOR UPDATE`,
            parametros
        );

        if (bloqueados.length === 0) {
            return [];
        }

        filtro = `t.id_turno IN (${bloqueados.map(() => '?').join(', ')})`;
        parametros = bloqueados.map((turno) => turno.id_turno);
        estados = Object.fromEntries(bloqueados.map((turno) => [turno.id_turno, turno.estado_turno]));
    }

    const [turnos] = await ejecutor.execute(
        `SELECT t.id_turno,
                DATE_FORMAT(t.fecha_turno, '%Y-%m-%d') AS fecha_turno,
                t.hora_turno,
                t.estado_turno,
                t.dni_paciente,
                CONCAT(p.apellido_paciente, ', ', p.nombre_paciente) AS nombre_paciente,
                pr.nombre_practica
         FROM turno t
         JOIN paciente p ON p.dni_paciente = t.dni_paciente
         JOIN practica pr ON pr.id_practica = t.id_practica
         WHERE ${filtro}
         ORDER BY t.fecha_turno, t.hora_turno`,
        parametros
    );

    return turnos.map((turno) => ({ ...turno, estado_turno: estados[turno.id_turno] ?? turno.estado_turno }));
}

async function medicoExiste(ejecutor, matricula) {
    const [medicos] = await ejecutor.execute(
        'SELECT matricula_medico FROM medico WHERE matricula_medico = ?',
        [matricula]
    );

    return medicos.length > 0;
}

async function vistaPrevia(matricula, desde, hasta) {
    if (!(await medicoExiste(db, matricula))) {
        return { error: 'MEDICO_NO_EXISTE', matricula };
    }

    const errorRango = await validarRango(db, desde, hasta);
    if (errorRango) {
        return { error: errorRango };
    }

    const turnos = await buscarAfectados(db, matricula, desde, hasta, false);

    return { total: turnos.length, turnos };
}

async function crear(matricula, desde, hasta, motivo, idUsuario) {
    const conexion = await db.getConnection();
    try {
        await conexion.beginTransaction();

        const [medicos] = await conexion.execute(
            'SELECT matricula_medico FROM medico WHERE matricula_medico = ? FOR UPDATE',
            [matricula]
        );
        if (medicos.length === 0) {
            await conexion.rollback();
            return { error: 'MEDICO_NO_EXISTE', matricula };
        }

        const errorRango = await validarRango(conexion, desde, hasta);
        if (errorRango) {
            await conexion.rollback();
            return { error: errorRango };
        }

        const afectados = await buscarAfectados(conexion, matricula, desde, hasta, true);

        const [bloqueo] = await conexion.execute(
            `INSERT INTO bloqueo_agenda (matricula_medico, fecha_hora_desde, fecha_hora_hasta, motivo, id_usuario)
             VALUES (?, ?, ?, ?, ?)`,
            [matricula, desde, hasta, motivo, idUsuario ?? null]
        );
        const idBloqueo = bloqueo.insertId;

        for (const turno of afectados) {
            await conexion.execute(
                `UPDATE turno
                 SET estado_turno = 'Cancelado', motivo_cancelacion = ?, id_bloqueo = ?
                 WHERE id_turno = ?`,
                [motivo, idBloqueo, turno.id_turno]
            );
            await conexion.execute(
                'INSERT INTO historial_estado_turno (id_turno, estado_anterior, estado_nuevo, id_usuario) VALUES (?, ?, ?, ?)',
                [turno.id_turno, turno.estado_turno, 'Cancelado', idUsuario ?? null]
            );
        }

        await conexion.commit();

        return { id_bloqueo: idBloqueo, total: afectados.length, turnos_cancelados: afectados };

    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

async function listar() {
    const [bloqueos] = await db.query(`
        SELECT b.id_bloqueo,
               b.matricula_medico,
               CONCAT(m.apellido_medico, ', ', m.nombre_medico) AS nombre_medico,
               DATE_FORMAT(b.fecha_hora_desde, '%Y-%m-%d %H:%i') AS fecha_hora_desde,
               DATE_FORMAT(b.fecha_hora_hasta, '%Y-%m-%d %H:%i') AS fecha_hora_hasta,
               b.motivo,
               DATE_FORMAT(b.fecha_creacion, '%Y-%m-%d %H:%i') AS fecha_creacion,
               COUNT(t.id_turno) AS turnos_cancelados
        FROM bloqueo_agenda b
        JOIN medico m ON m.matricula_medico = b.matricula_medico
        LEFT JOIN turno t ON t.id_bloqueo = b.id_bloqueo
        GROUP BY b.id_bloqueo, m.apellido_medico, m.nombre_medico
        ORDER BY b.id_bloqueo DESC
    `);

    return bloqueos;
}

module.exports = {
    estaBloqueado,
    vistaPrevia,
    crear,
    listar
};
