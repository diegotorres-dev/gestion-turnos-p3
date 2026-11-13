require('dotenv').config(); //carga las variables de entorno

const express = require('express'); //importo el modulo de express
const cors = require('cors'); //puse esto para evitar conflictos con el navegador

const turnoroutes = require('./routes/turnoroutes'); //importo las rutas de turnos
const authroutes = require('./routes/authroutes'); //importo las rutas de autenticación

const app = express(); //express() es la función que crea la aplicación, y "app" es el servidor en sí

app.use(express.json()); //es un middleware que lee datos y los convierte a objeto javascript para usarlos después en req.body, sino llegaría undefined

app.use(cors({ //permite que el frontend del puerto 5500 haga peticiones al puerto 3000 del backend
    origin: 'http://127.0.0.1:5500' 
}));

app.use('/api/auth', authroutes); //todo lo que llegue a esta URL de auth, mandalo al módulo de auth
app.use('/api/turnos', turnoroutes); //lo mismo pero para turnos

const PORT = 3000; //puerto que escucha el servidor

app.listen(PORT, () => { //inicia el servidor y lo pone en escucha en el puerto 3000
    console.log(`Servidor funcionando en http://localhost:${PORT}`);
});