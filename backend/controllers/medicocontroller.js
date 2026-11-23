const medicoService = require('../services/medicoservice');

async function obtenerMedicos(req, res) {
    try {
        const medicos = await medicoService.obtenerTodos();

        res.json(medicos);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al obtener los médicos'
        });
    }
}

module.exports = {
    obtenerMedicos
};
