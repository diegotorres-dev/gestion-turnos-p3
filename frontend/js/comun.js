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
}

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

function textoError(error) {
    return error.message === 'Failed to fetch'
        ? 'No se pudo conectar con el servidor.'
        : error.message;
}

function textoMedico(medico) {
    return `${medico.matricula_medico} - ${medico.nombre_medico} ${medico.apellido_medico}`;
}
