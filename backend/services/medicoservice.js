const db = require('../config/database');

async function obtenerTodos() {
    const [medicos] = await db.query(
        'SELECT matricula_medico, nombre_medico, apellido_medico FROM medico ORDER BY matricula_medico'
    );

    return medicos;
}

module.exports = {
    obtenerTodos
};
