const db = require('../config/database'); //importo el módulo de conexión a la BD (el pool)

async function probarTurnos() {
    try {
        const [turnos] = await db.query(`
            SELECT *
            FROM turno
            LIMIT 10
        `); //consulta que trae los primeros 10 registros de la tabla turno
        console.table(turnos); //muestra los turnos en consola como si fuera una tabla para verlo mejor visualmente
    } catch (error) {
        console.error('Error:', error.message);
    }
    process.exit(); //cierra el proceso o sea el programa de node (sino el pool de conexiones lo mantendría siempre abierto)
} 

probarTurnos();