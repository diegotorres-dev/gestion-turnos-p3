const db = require('../config/database'); //importo el módulo de conexión a la BD (el pool)

async function probarConexion() { //función asíncrona para probar la conexión
    
    try {
        const [resultado] = await db.query('SELECT 1 AS conectado'); //no consulta ninguna tabla, solo pide el n1 con el nombre de la columna "conectado"
        console.log('Conectado a MySQL'); 
        console.log(resultado); 
    } catch (error) { //atrapa cualquier fallo o excepción que ocurra al intentar conectar o consultar a la bd
        console.error('Error de conexión:', error.message);
    }
}
probarConexion();