const db = require('../config/database');

async function obtenerTodas() {
    const [practicas] = await db.query(
        'SELECT id_practica, nombre_practica FROM practica ORDER BY nombre_practica'
    );

    return practicas;
}

module.exports = {
    obtenerTodas
};
