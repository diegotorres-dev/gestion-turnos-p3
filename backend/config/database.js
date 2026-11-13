const path = require('path'); //módulo para manejar rutas

const mysql = require('mysql2/promise'); //importo el módulo de mysql y el promise me deja usar async/await en otros métodos

require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); //no leía la ruta donde estaban las variables de entorno

const conexion = mysql.createPool({ //crea un pool de conexiones reutilizables a la BD
    host: process.env.DB_HOST, 
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_NAME, 
    port: process.env.DB_PORT
});

module.exports = conexion; //exporto el pool para poder realizar consultas en otros módulos