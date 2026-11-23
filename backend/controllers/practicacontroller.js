const practicaService = require('../services/practicaservice');

async function obtenerPracticas(req, res) {
    try {
        const practicas = await practicaService.obtenerTodas();

        res.json(practicas);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al obtener las prácticas'
        });
    }
}

module.exports = {
    obtenerPracticas
};
