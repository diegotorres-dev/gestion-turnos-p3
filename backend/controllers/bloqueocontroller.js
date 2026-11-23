const bloqueoService = require('../services/bloqueoservice');

const FORMATO_FECHA_HORA = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(:\d{2})?$/;

const ERRORES_BLOQUEO = {
    MEDICO_NO_EXISTE: (r) => [404, `No existe ningún médico con matrícula ${r.matricula}`],
    RANGO_INVALIDO: () => [400, 'La fecha y hora "hasta" tiene que ser posterior a la de "desde"'],
    RANGO_PASADO: () => [400, 'No se puede bloquear un período que ya terminó']
};

function normalizarFechaHora(valor) {
    const texto = String(valor ?? '').trim();
    const partes = FORMATO_FECHA_HORA.exec(texto);
    if (!partes) {
        return null;
    }

    const [, anio, mes, dia, hora, minuto] = partes.map(Number);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia, hora, minuto));
    const coincide = fecha.getUTCFullYear() === anio
        && fecha.getUTCMonth() === mes - 1
        && fecha.getUTCDate() === dia
        && fecha.getUTCHours() === hora
        && fecha.getUTCMinutes() === minuto;

    if (!coincide) {
        return null;
    }

    return `${partes[1]}-${partes[2]}-${partes[3]} ${partes[4]}:${partes[5]}:00`;
}

function leerDatos(origen, pedirMotivo) {
    const { matricula_medico, desde, hasta, motivo } = origen;

    if (!/^\d+$/.test(String(matricula_medico ?? ''))) {
        return { error: 'La matrícula del médico es obligatoria y debe ser numérica' };
    }

    const desdeNormalizado = normalizarFechaHora(desde);
    if (!desdeNormalizado) {
        return { error: 'La fecha y hora "desde" es obligatoria y debe tener un formato válido' };
    }

    const hastaNormalizado = normalizarFechaHora(hasta);
    if (!hastaNormalizado) {
        return { error: 'La fecha y hora "hasta" es obligatoria y debe tener un formato válido' };
    }

    const datos = {
        matricula: Number(matricula_medico),
        desde: desdeNormalizado,
        hasta: hastaNormalizado
    };

    if (pedirMotivo) {
        const motivoLimpio = String(motivo ?? '').trim();
        if (motivoLimpio.length === 0) {
            return { error: 'El motivo del bloqueo es obligatorio' };
        }
        if (motivoLimpio.length > 255) {
            return { error: 'El motivo no puede superar los 255 caracteres' };
        }
        datos.motivo = motivoLimpio;
    }

    return { datos };
}

async function vistaPreviaBloqueo(req, res) {
    try {
        const { datos, error } = leerDatos(req.query, false);
        if (error) {
            return res.status(400).json({ error });
        }

        const resultado = await bloqueoService.vistaPrevia(datos.matricula, datos.desde, datos.hasta);

        if (resultado.error) {
            const [estado, mensaje] = ERRORES_BLOQUEO[resultado.error](resultado);
            return res.status(estado).json({ error: mensaje });
        }

        res.json(resultado);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al consultar los turnos afectados'
        });
    }
}

async function crearBloqueo(req, res) {
    try {
        const { datos, error } = leerDatos(req.body ?? {}, true);
        if (error) {
            return res.status(400).json({ error });
        }

        const resultado = await bloqueoService.crear(
            datos.matricula,
            datos.desde,
            datos.hasta,
            datos.motivo,
            req.usuario.id_usuario
        );

        if (resultado.error) {
            const [estado, mensaje] = ERRORES_BLOQUEO[resultado.error](resultado);
            return res.status(estado).json({ error: mensaje });
        }

        res.status(201).json({
            mensaje: `Bloqueo registrado. Se cancelaron ${resultado.total} turno(s)`,
            ...resultado
        });

    } catch (error) {
        console.error(error);

        if (error.code === 'ER_LOCK_DEADLOCK') {
            return res.status(409).json({
                error: 'Hubo un conflicto con otra operación simultánea. No se hizo ningún cambio, probá de nuevo'
            });
        }

        res.status(500).json({
            error: 'Error al registrar el bloqueo de agenda'
        });
    }
}

async function listarBloqueos(req, res) {
    try {
        const bloqueos = await bloqueoService.listar();

        res.json(bloqueos);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al obtener los bloqueos de agenda'
        });
    }
}

module.exports = {
    vistaPreviaBloqueo,
    crearBloqueo,
    listarBloqueos
};
