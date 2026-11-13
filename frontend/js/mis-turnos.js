const ROL_ADMIN = 1;
const ROL_MEDICO = 2;
const ROL_PACIENTE = 3;

const token = sessionStorage.getItem('token');

function leerPayload(jwt) {
    try {
        const base64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
    } catch (error) {
        return null;
    }
}

function cerrarSesion() {
    sessionStorage.removeItem('token');
    window.location.href = '../index.html';
}

const payload = token ? leerPayload(token) : null;
const vigente = payload && payload.exp * 1000 > Date.now();
const rol = vigente ? Number(payload.id_rol) : 0;

if (rol === ROL_ADMIN) {
    window.location.href = 'dashboard.html';
} else if (rol === ROL_MEDICO || rol === ROL_PACIENTE) {
    iniciarPanel();
} else {
    cerrarSesion();
}

function iniciarPanel() {
    const esMedico = rol === ROL_MEDICO;

    const cabecera = document.getElementById('cabeceraTurnos');
    const cuerpoTabla = document.getElementById('cuerpoTurnos');
    const estadoTabla = document.getElementById('estadoTurnos');
    const avisoAccion = document.getElementById('avisoAccion');
    const dialogoCancelar = document.getElementById('dialogoCancelar');
    const resumenCancelar = document.getElementById('resumenCancelar');
    const enviarCancelar = document.getElementById('enviarCancelar');

    const textos = esMedico
        ? {
            titulo: 'Mi agenda',
            usuario: `Médico: ${payload.email} · Matrícula ${payload.matricula_medico}`,
            subtitulo: 'Turnos asignados',
            vacio: 'Todavía no tenés turnos asignados.'
        }
        : {
            titulo: 'Mis turnos',
            usuario: `Paciente: ${payload.email}`,
            subtitulo: 'Turnos registrados',
            vacio: 'Todavía no tenés turnos registrados.'
        };

    function formatearFecha(fecha) {
        const [anio, mes, dia] = fecha.split('-');
        return `${dia}/${mes}/${anio}`;
    }

    const columnas = esMedico
        ? [
            ['N.º', (t) => t.id_turno],
            ['Fecha', (t) => formatearFecha(t.fecha_turno)],
            ['Hora', (t) => t.hora_turno.slice(0, 5)],
            ['Paciente', (t) => t.nombre_paciente],
            ['DNI', (t) => t.dni_paciente],
            ['Práctica', (t) => t.nombre_practica],
            ['Medio', (t) => t.medio_solicitado]
        ]
        : [
            ['N.º', (t) => t.id_turno],
            ['Fecha', (t) => formatearFecha(t.fecha_turno)],
            ['Hora', (t) => t.hora_turno.slice(0, 5)],
            ['Práctica', (t) => t.nombre_practica],
            ['Médico', (t) => t.nombre_medico],
            ['Medio', (t) => t.medio_solicitado]
        ];

    const titulosCabecera = [...columnas.map(([titulo]) => titulo), 'Estado'];
    if (!esMedico) {
        titulosCabecera.push('Acciones');
    }

    let turnos = [];
    let turnoActual = null;

    document.title = `${textos.titulo} | Gestión de Turnos`;
    document.getElementById('titulo').textContent = textos.titulo;
    document.getElementById('menuPrincipal').textContent = textos.titulo;
    document.getElementById('subtitulo').textContent = textos.subtitulo;
    document.getElementById('datosUsuario').textContent = textos.usuario;

    titulosCabecera.forEach((titulo) => {
        const th = document.createElement('th');
        th.textContent = titulo;
        cabecera.appendChild(th);
    });

    function celda(texto) {
        const td = document.createElement('td');
        td.textContent = texto ?? '—';
        return td;
    }

    function celdaEstado(estado) {
        const td = document.createElement('td');
        const etiqueta = document.createElement('span');
        const valor = estado || 'Sin estado';
        etiqueta.textContent = valor;
        etiqueta.className = `etiqueta etiqueta-${valor.toLowerCase().replace(/\s+/g, '-')}`;
        td.appendChild(etiqueta);
        return td;
    }

    function celdaAcciones(t) {
        if (t.estado_turno === 'Cancelado') {
            return celda(null);
        }

        const td = document.createElement('td');
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.textContent = 'Cancelar';
        boton.setAttribute('aria-label', `Cancelar turno N.º ${t.id_turno}`);
        boton.className = 'boton-tabla boton-peligro-suave';
        boton.addEventListener('click', () => abrirCancelar(t));
        td.appendChild(boton);
        return td;
    }

    function textoError(error) {
        return error.message === 'Failed to fetch'
            ? 'No se pudo conectar con el servidor.'
            : error.message;
    }

    function mostrarEstado(texto) {
        cuerpoTabla.replaceChildren();
        estadoTabla.textContent = texto;
        estadoTabla.hidden = !texto;
    }

    function mostrarSkeleton() {
        estadoTabla.hidden = true;
        cuerpoTabla.replaceChildren();
        for (let i = 0; i < 4; i++) {
            const fila = document.createElement('tr');
            fila.className = 'fila-skeleton';
            for (let j = 0; j < titulosCabecera.length; j++) {
                const td = document.createElement('td');
                const barra = document.createElement('span');
                barra.className = 'skeleton';
                td.appendChild(barra);
                fila.appendChild(td);
            }
            cuerpoTabla.appendChild(fila);
        }
    }

    let temporizadorAviso = null;

    function mostrarAviso(texto, tipo) {
        avisoAccion.textContent = texto;
        avisoAccion.className = `aviso aviso-${tipo}`;
        avisoAccion.hidden = false;
        clearTimeout(temporizadorAviso);
        if (tipo === 'exito') {
            temporizadorAviso = setTimeout(() => { avisoAccion.hidden = true; }, 6000);
        }
    }

    function pintarTabla() {
        cuerpoTabla.replaceChildren();

        if (turnos.length === 0) {
            mostrarEstado(textos.vacio);
            return;
        }

        estadoTabla.hidden = true;

        const fragmento = document.createDocumentFragment();
        turnos.forEach((t) => {
            const fila = document.createElement('tr');
            columnas.forEach(([, valor]) => fila.appendChild(celda(valor(t))));
            fila.appendChild(celdaEstado(t.estado_turno));
            if (!esMedico) {
                fila.appendChild(celdaAcciones(t));
            }
            fragmento.appendChild(fila);
        });
        cuerpoTabla.appendChild(fragmento);
    }

    function abrirCancelar(t) {
        turnoActual = t;
        avisoAccion.hidden = true;
        resumenCancelar.textContent = `Turno N.º ${t.id_turno} · ${formatearFecha(t.fecha_turno)} ${t.hora_turno.slice(0, 5)} · ${t.nombre_practica}`;
        dialogoCancelar.showModal();
    }

    async function cargarTurnos() {
        mostrarSkeleton();
        try {
            turnos = await obtenerMisTurnos(token);
            pintarTabla();
        } catch (error) {
            if (error.estado === 401) {
                cerrarSesion();
                return;
            }
            mostrarEstado(textoError(error));
        }
    }

    enviarCancelar.addEventListener('click', async function () {
        enviarCancelar.disabled = true;
        enviarCancelar.textContent = 'Cancelando...';

        try {
            await cancelarMiTurno(token, turnoActual.id_turno);
            mostrarAviso(`Turno N.º ${turnoActual.id_turno} cancelado correctamente.`, 'exito');
        } catch (error) {
            if (error.estado === 401) {
                cerrarSesion();
                return;
            }
            mostrarAviso(textoError(error), 'error');
        } finally {
            dialogoCancelar.close();
            enviarCancelar.disabled = false;
            enviarCancelar.textContent = 'Sí, cancelar turno';
        }

        cargarTurnos();
    });

    document.getElementById('volverCancelar').addEventListener('click', () => dialogoCancelar.close());
    document.getElementById('cerrarSesion').addEventListener('click', cerrarSesion);
    document.getElementById('recargar').addEventListener('click', cargarTurnos);

    cargarTurnos();
}
