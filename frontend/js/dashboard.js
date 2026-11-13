const ROL_ADMIN = 1;

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
const sesionValida = payload && Number(payload.id_rol) === ROL_ADMIN && payload.exp * 1000 > Date.now();

if (!sesionValida) {
    cerrarSesion();
} else {
    iniciarPanel();
}

function iniciarPanel() {
    const datosUsuario = document.getElementById('datosUsuario');
    const cuerpoTabla = document.getElementById('cuerpoTurnos');
    const estadoTabla = document.getElementById('estadoTurnos');
    const filtroEstado = document.getElementById('filtroEstado');
    const buscador = document.getElementById('buscador');
    const resumen = document.getElementById('resumen');
    const botonTurnos = document.getElementById('irATurnos');

    let turnos = [];

    datosUsuario.textContent = `Administrador: ${payload.email}`;

    document.getElementById('cerrarSesion').addEventListener('click', cerrarSesion);

    botonTurnos.addEventListener('click', function () {
        document.getElementById('turnos').scrollIntoView({ behavior: 'smooth' });
    });

    function formatearFecha(fecha) {
        const [anio, mes, dia] = fecha.split('-');
        return `${dia}/${mes}/${anio}`;
    }

    function celda(texto, clase) {
        const td = document.createElement('td');
        td.textContent = texto ?? '—';
        if (clase) {
            td.className = clase;
        }
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

    function mostrarEstado(texto) {
        cuerpoTabla.replaceChildren();
        estadoTabla.textContent = texto;
        estadoTabla.hidden = !texto;
    }

    function mostrarSkeleton() {
        estadoTabla.hidden = true;
        cuerpoTabla.replaceChildren();
        for (let i = 0; i < 6; i++) {
            const fila = document.createElement('tr');
            fila.className = 'fila-skeleton';
            for (let j = 0; j < 10; j++) {
                const td = document.createElement('td');
                const barra = document.createElement('span');
                barra.className = 'skeleton';
                td.appendChild(barra);
                fila.appendChild(td);
            }
            cuerpoTabla.appendChild(fila);
        }
    }

    function actualizarResumen() {
        const total = turnos.length;
        const contar = (estado) => turnos.filter((t) => t.estado_turno === estado).length;
        resumen.querySelector('[data-total]').textContent = total;
        resumen.querySelector('[data-reservados]').textContent = contar('Reservado');
        resumen.querySelector('[data-confirmados]').textContent = contar('Confirmado');
        resumen.querySelector('[data-cancelados]').textContent = contar('Cancelado');
    }

    function pintarTabla() {
        const texto = buscador.value.trim().toLowerCase();
        const estado = filtroEstado.value;

        const visibles = turnos.filter((t) => {
            const coincideEstado = !estado || t.estado_turno === estado;
            const coincideTexto = !texto || [t.nombre_paciente, String(t.dni_paciente), t.nombre_practica]
                .some((valor) => valor.toLowerCase().includes(texto));
            return coincideEstado && coincideTexto;
        });

        cuerpoTabla.replaceChildren();

        if (visibles.length === 0) {
            mostrarEstado('No hay turnos para mostrar.');
            return;
        }

        estadoTabla.hidden = true;

        const fragmento = document.createDocumentFragment();
        visibles.forEach((t) => {
            const fila = document.createElement('tr');
            fila.append(
                celda(t.id_turno),
                celda(formatearFecha(t.fecha_turno)),
                celda(t.hora_turno.slice(0, 5)),
                celda(t.nombre_paciente),
                celda(t.dni_paciente),
                celda(t.nombre_practica),
                celda(t.medio_solicitado),
                celdaEstado(t.estado_turno),
                celda(t.nombre_medico),
                celdaAcciones(t)
            );
            fragmento.appendChild(fila);
        });
        cuerpoTabla.appendChild(fragmento);
    }

    const avisoAccion = document.getElementById('avisoAccion');
    const dialogoConfirmar = document.getElementById('dialogoConfirmar');
    const resumenConfirmar = document.getElementById('resumenConfirmar');
    const formConfirmar = document.getElementById('formConfirmar');
    const matriculaMedico = document.getElementById('matriculaMedico');
    const errorConfirmar = document.getElementById('errorConfirmar');
    const enviarConfirmar = document.getElementById('enviarConfirmar');
    const dialogoCancelar = document.getElementById('dialogoCancelar');
    const resumenCancelar = document.getElementById('resumenCancelar');
    const enviarCancelar = document.getElementById('enviarCancelar');

    let turnoActual = null;

    function resumenTurno(t) {
        return `Turno N.º ${t.id_turno} · ${formatearFecha(t.fecha_turno)} ${t.hora_turno.slice(0, 5)} · ${t.nombre_paciente} · ${t.nombre_practica}`;
    }

    function textoError(error) {
        return error.message === 'Failed to fetch'
            ? 'No se pudo conectar con el servidor.'
            : error.message;
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

    function botonAccion(texto, clase, etiqueta, alHacerClick) {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.textContent = texto;
        boton.setAttribute('aria-label', etiqueta);
        boton.className = `boton-tabla ${clase}`;
        boton.addEventListener('click', alHacerClick);
        return boton;
    }

    function celdaAcciones(t) {
        if (t.estado_turno === 'Cancelado') {
            return celda(null);
        }

        const td = document.createElement('td');
        const contenedor = document.createElement('div');
        contenedor.className = 'acciones';

        if (t.estado_turno === 'Reservado') {
            contenedor.appendChild(botonAccion('Confirmar', 'boton-confirmar', `Confirmar turno N.º ${t.id_turno}`, () => abrirConfirmar(t)));
        }

        contenedor.appendChild(botonAccion('Cancelar', 'boton-peligro-suave', `Cancelar turno N.º ${t.id_turno}`, () => abrirCancelar(t)));
        td.appendChild(contenedor);
        return td;
    }

    function abrirConfirmar(t) {
        turnoActual = t;
        avisoAccion.hidden = true;
        resumenConfirmar.textContent = resumenTurno(t);
        matriculaMedico.value = t.medico_confirmacion ?? '';
        errorConfirmar.hidden = true;
        dialogoConfirmar.showModal();
    }

    function abrirCancelar(t) {
        turnoActual = t;
        avisoAccion.hidden = true;
        resumenCancelar.textContent = resumenTurno(t);
        dialogoCancelar.showModal();
    }

    formConfirmar.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        enviarConfirmar.disabled = true;
        enviarConfirmar.textContent = 'Confirmando...';
        errorConfirmar.hidden = true;

        try {
            await confirmarTurno(token, turnoActual.id_turno, matriculaMedico.value.trim());
            dialogoConfirmar.close();
            mostrarAviso(`Turno N.º ${turnoActual.id_turno} confirmado correctamente.`, 'exito');
            cargarTurnos();
        } catch (error) {
            if (error.estado === 401 || error.estado === 403) {
                cerrarSesion();
                return;
            }
            errorConfirmar.textContent = textoError(error);
            errorConfirmar.hidden = false;
        } finally {
            enviarConfirmar.disabled = false;
            enviarConfirmar.textContent = 'Confirmar turno';
        }
    });

    enviarCancelar.addEventListener('click', async function () {
        enviarCancelar.disabled = true;
        enviarCancelar.textContent = 'Cancelando...';

        try {
            await cancelarTurno(token, turnoActual.id_turno);
            mostrarAviso(`Turno N.º ${turnoActual.id_turno} cancelado correctamente.`, 'exito');
        } catch (error) {
            if (error.estado === 401 || error.estado === 403) {
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

    document.getElementById('volverConfirmar').addEventListener('click', () => dialogoConfirmar.close());
    document.getElementById('volverCancelar').addEventListener('click', () => dialogoCancelar.close());

    async function cargarTurnos() {
        mostrarSkeleton();
        try {
            turnos = await obtenerTurnos(token);
            actualizarResumen();
            pintarTabla();
        } catch (error) {
            if (error.estado === 401 || error.estado === 403) {
                cerrarSesion();
                return;
            }
            mostrarEstado(error.message === 'Failed to fetch'
                ? 'No se pudo conectar con el servidor.'
                : error.message);
        }
    }

    filtroEstado.addEventListener('change', pintarTabla);
    buscador.addEventListener('input', pintarTabla);
    document.getElementById('recargar').addEventListener('click', cargarTurnos);

    cargarTurnos();
}
