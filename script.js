const SHEET_ID = "1KXmB725GOfa-ROh7L9MHNcgAT9KqXDFrwNGOZmAJe1s";
const URL_DRIVE = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

let encuentrosGlobal = [];
let encuentrosFiltrados = [];
let indiceCarruselActual = 0;

let chartEncuentros, chartAsistentes, chartRegiones;

// Normalización de texto limpia para evitar problemas con tildes y mayúsculas
const normalizarNombre = (str) => {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
};

// ================================
// CARGA INICIAL DE DATOS
// ================================
async function inicializarObservatorio() {
    try {
        const response = await fetch(URL_DRIVE);
        const text = await response.text();
        const json = JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));

        encuentrosGlobal = json.table.rows.map(r => ({
            nombre: r.c[0]?.v || "Encuentro de CCyT",
            ciudad: r.c[1]?.v || "Por definir",
            region: r.c[2]?.v || "Por definir",
            ugel: r.c[3]?.v || "No especifica",
            mes: r.c[4]?.v || "",
            anio: String(r.c[5]?.v || ""),
            institucion: r.c[6]?.v || "CONCYTEC",
            lugar: r.c[7]?.v || "Sede central",
            alcance: r.c[8]?.v || "Nacional",
            descripcion: r.c[9]?.v || "Sin descripción disponible.",
            enlace: r.c[10]?.v || "#",
            clubes: Number(r.c[11]?.v || 0),
            estudiantes: Number(r.c[12]?.v || 0),
            docentes: Number(r.c[13]?.v || 0),
            participantes: Number(r.c[14]?.v || 0)
        }));

        encuentrosFiltrados = [...encuentrosGlobal];
        
        await cargarMapaPeruSVG();
        construirSelectoresFiltro();
        vincularEventosInteraccion(); // <- Ya no se romperá aquí
        procesarVisualizacion();     // <- Ahora sí llega a ejecutarse e imprime la info inicial
    } catch (error) {
        console.error("Error cargando el Observatorio:", error);
    }
}

// ================================
// CARGA NATIVA DEL MAPA SVG
// ================================
async function cargarMapaPeruSVG() {
    try {
        const res = await fetch('peru.svg');
        const svgText = await res.text();
        document.getElementById('contenedor-svg').innerHTML = svgText;
        
        const paths = document.querySelectorAll('#contenedor-svg svg path');
        paths.forEach(p => {
            p.classList.add('region-path', 'fill-slate-200', 'stroke-white');
            
            p.addEventListener('click', () => {
                const regionId = p.getAttribute('id') || p.getAttribute('name');
                if (regionId) {
                    document.getElementById('filtroRegion').value = regionId;
                    ejecutarFiltradoEstructural();
                }
            });

            p.addEventListener('mousemove', (evento) => {
                const regionId = p.getAttribute('id') || p.getAttribute('name');
                if (!regionId) return;

                const totalEncuentrosRegion = encuentrosFiltrados.filter(e => 
                    normalizarNombre(e.region) === normalizarNombre(regionId)
                ).length;

                const tooltip = document.getElementById('tooltip-mapa');
                if (!tooltip) return; // Validación por si acaso
                
                tooltip.innerHTML = `
                    <div class="font-bold text-brand border-b border-slate-700/50 pb-1 mb-1 text-[13px]">${regionId}</div>
                    <div class="text-slate-300">📊 Encuentros: <span class="font-black text-white text-sm">${totalEncuentrosRegion}</span></div>
                `;

                tooltip.classList.remove('hidden');
                tooltip.style.left = (evento.pageX + 15) + 'px';
                tooltip.style.top = (evento.pageY + 15) + 'px';
            });

            p.addEventListener('mouseout', () => {
                const tooltip = document.getElementById('tooltip-mapa');
                if (tooltip) tooltip.classList.add('hidden');
            });
        });
    } catch (e) {
        console.error("Error renderizando mapa SVG nativo:", e);
    }
}

// ================================
// SISTEMA DE FILTRADO CON INTERCONEXIÓN (CRUZADO)
// ================================
function ejecutarFiltradoEstructural() {
    const anioSeleccionado = document.getElementById("filtroAnio").value;
    const regionSeleccionada = document.getElementById("filtroRegion").value;

    encuentrosFiltrados = encuentrosGlobal.filter(e => 
        (!anioSeleccionado || e.anio === anioSeleccionado) &&
        (!regionSeleccionada || normalizarNombre(e.region) === normalizarNombre(regionSeleccionada))
    );

    if (!anioSeleccionado) {
        inyectarOpcionesSelect("filtroAnio", [...new Set(encuentrosFiltrados.map(e => e.anio))]);
    }
    if (!regionSeleccionada) {
        inyectarOpcionesSelect("filtroRegion", [...new Set(encuentrosFiltrados.map(e => e.region))]);
    }

    document.getElementById("filtroAnio").value = anioSeleccionado;
    document.getElementById("filtroRegion").value = regionSeleccionada;

    document.querySelectorAll('.region-path').forEach(el => {
        const id = el.getAttribute('id') || el.getAttribute('name');
        if (regionSeleccionada && normalizarNombre(id) === normalizarNombre(regionSeleccionada)) {
            el.classList.add('active-region');
        } else {
            el.classList.remove('active-region');
        }
    });

    indiceCarruselActual = 0; 
    procesarVisualizacion();
}

// ================================
// RENDERIZADO DEL CARRUSEL DE TARJETAS
// ================================
function renderizarCarrusel() {
    const contenedor = document.getElementById("listaEventos");
    const total = encuentrosFiltrados.length;

    contenedor.innerHTML = "";

    if (total === 0) {
        contenedor.innerHTML = `
            <div class="bg-white p-6 rounded-xl shadow-md text-center border-t-4 border-brand">
                <span class="text-3xl block mb-1">🔍</span>
                <p class="text-slate-500 text-xs font-bold">No se encontraron encuentros con los filtros seleccionados.</p>
            </div>`;
        return;
    }

    const e = encuentrosFiltrados[indiceCarruselActual];

    const disablePrev = indiceCarruselActual === 0 ? 'disabled opacity-30 pointer-events-none' : '';
    const disableNext = indiceCarruselActual === total - 1 ? 'disabled opacity-30 pointer-events-none' : '';

    contenedor.innerHTML = `
        <div class="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden transition-all duration-300">
            <div class="bg-slate-900 text-white p-4 flex justify-between items-center gap-4">
                <div class="flex-1 min-w-0">
                    <span class="text-[11px] uppercase font-bold text-accent tracking-wider block mb-0.5">
                        📆 ${e.mes ? e.mes + ', ' : ''} ${e.anio} | Alcance: ${e.alcance}
                    </span>
                    <h3 class="text-base font-bold text-white whitespace-normal break-words leading-tight" title="${e.nombre}">
                        ${e.nombre}
                    </h3>
                </div>
                
                <div class="flex items-center gap-2 font-bold text-xs bg-white/10 p-1 rounded-lg shrink-0 select-none">
                    <button id="prevCard" class="hover:bg-white/20 px-2 py-1 rounded transition ${disablePrev}">&lt;</button>
                    <span id="infoPaginacion" class="font-mono px-1">${indiceCarruselActual + 1} / ${total}</span>
                    <button id="nextCard" class="hover:bg-white/20 px-2 py-1 rounded transition ${disableNext}">&gt;</button>
                </div>
            </div>

            <div class="p-4 space-y-4">
                <div class="grid sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                    <div class="space-y-1">
                        <p class="text-slate-600"><span class="font-bold text-slate-700">📍 Región:</span> ${e.region}</p>
                        <p class="text-slate-600"><span class="font-bold text-slate-700">🏢 UGEL:</span> ${e.ugel}</p>
                    </div>
                    <div class="space-y-1">
                        <p class="text-slate-600"><span class="font-bold text-slate-700">🏛️ Sede:</span> ${e.lugar} (${e.ciudad})</p>
                        <p class="text-slate-600">
                            <span class="font-bold text-slate-700">🔗 URL:</span> 
                            <a href="${e.enlace}" target="_blank" class="text-brand font-semibold hover:underline">${e.enlace !== '#' ? 'Visitar Sitio →' : 'No disponible'}</a>
                        </p>
                    </div>
                </div>

                <div class="space-y-1">
                    <h4 class="font-bold text-[12px] uppercase tracking-wider text-slate-400">📄 Descripción</h4>
                    <p class="text-sm text-slate-600 leading-relaxed line-clamp-3 hover:line-clamp-none transition-all duration-300 cursor-pointer" title="Click para expandir/colapsar">${e.descripcion}</p>
                </div>

                <div class="grid grid-cols-4 gap-2">
                    <div class="bg-slate-50 border border-slate-200/60 p-2 rounded-lg text-center">
                        <span class="text-xl block">🔬</span>
                        <span class="text-xs font-black text-slate-800 block">${e.clubes}</span>
                        <span class="text-[11px] font-bold text-slate-400 uppercase tracking-tight">CCyT</span>
                    </div>
                    <div class="bg-slate-50 border border-slate-200/60 p-2 rounded-lg text-center">
                        <span class="text-xl block">👩‍🎓</span>
                        <span class="text-xs font-black text-slate-800 block">${e.estudiantes}</span>
                        <span class="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Estudiantes</span>
                    </div>
                    <div class="bg-slate-50 border border-slate-200/60 p-2 rounded-lg text-center">
                        <span class="text-xl block">👨‍🏫</span>
                        <span class="text-xs font-black text-slate-800 block">${e.docentes}</span>
                        <span class="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Docentes</span>
                    </div>
                    <div class="bg-brand/5 border border-brand/20 p-2 rounded-lg text-center">
                        <span class="text-xl block">🔥</span>
                        <span class="text-xs font-black text-brand block">${e.participantes}</span>
                        <span class="text-[11px] font-bold text-brand uppercase tracking-tight">Total</span>
                    </div>
                </div>
            </div>
        </div>`;

    reengancharEventosControles();
}

function reengancharEventosControles() {
    const btnPrev = document.getElementById("prevCard");
    const btnNext = document.getElementById("nextCard"); // CORREGIDO: apuntaba a "prevCard"
    
    if (btnPrev) {
        btnPrev.addEventListener("click", () => {
            if (indiceCarruselActual > 0) {
                indiceCarruselActual--;
                renderizarCarrusel();
            }
        });
    }
    if (btnNext) {
        btnNext.addEventListener("click", () => {
            if (indiceCarruselActual < encuentrosFiltrados.length - 1) {
                indiceCarruselActual++;
                renderizarCarrusel();
            }
        });
    }
}

// ================================
// LOGICA DE RELLENO Y KPIs
// ================================
function actualizarKPIs() {
    const totalRegiones = new Set(encuentrosFiltrados.map(e => normalizarNombre(e.region))).size;
    const totalAsistentes = encuentrosFiltrados.reduce((acc, curr) => acc + curr.participantes, 0);

    document.getElementById("kpiCobertura").innerText = `${totalRegiones} Regiones`;
    document.getElementById("kpiTotal").innerText = `${encuentrosFiltrados.length} Encuentros`;
    document.getElementById("kpiAsistentes").innerText = totalAsistentes.toLocaleString() + " Asistentes";
}

function actualizarIluminacionMapa() {
    const conteoPorRegion = encuentrosFiltrados.reduce((acc, e) => {
        const regNorm = normalizarNombre(e.region);
        acc[regNorm] = (acc[regNorm] || 0) + 1;
        return acc;
    }, {});

    const paths = document.querySelectorAll('.region-path');
    paths.forEach(p => {
        const idRegion = normalizarNombre(p.getAttribute('id') || p.getAttribute('name'));
        const cantidad = conteoPorRegion[idRegion] || 0;

        if (p.classList.contains('active-region')) return;

        p.style.fill = cantidad === 0 ? "#E2E8F0" : "#4DB748";
    });
}

function actualizarGraficosEstadisticos() {
    // Si no tienes contenedores canvas en el HTML para estos gráficos, 
    // puedes envolver esto en un try-catch para evitar roturas.
    try {
        const mAnio = {};
        encuentrosFiltrados.forEach(e => { if(e.anio) mAnio[e.anio] = (mAnio[e.anio] || 0) + 1; });
        
        const elG1 = document.getElementById("graficoEncuentros");
        if (elG1) {
            if (chartEncuentros) chartEncuentros.destroy();
            chartEncuentros = new Chart(elG1, {
                type: "line",
                data: {
                    labels: Object.keys(mAnio),
                    datasets: [{ label: "Eventos por Año", data: Object.values(mAnio), borderColor: "#7A2C8E", backgroundColor: "rgba(122,44,142,0.1)", tension: 0.3, fill: true }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        const mAsist = {};
        encuentrosFiltrados.forEach(e => { if(e.anio) mAsist[e.anio] = (mAsist[e.anio] || 0) + e.participantes; });
        
        const elG2 = document.getElementById("graficoAsistentes");
        if (elG2) {
            if (chartAsistentes) chartAsistentes.destroy();
            chartAsistentes = new Chart(elG2, {
                type: "bar",
                data: {
                    labels: Object.keys(mAsist),
                    datasets: [{ label: "Asistentes totales", data: Object.values(mAsist), backgroundColor: "#F79131" }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        const mReg = {};
        encuentrosFiltrados.forEach(e => { if(e.region) mReg[e.region] = (mReg[e.region] || 0) + 1; });

        const elG3 = document.getElementById("graficoRegiones");
        if (elG3) {
            if (chartRegiones) chartRegiones.destroy();
            chartRegiones = new Chart(elG3, {
                type: "bar",
                data: {
                    labels: Object.keys(mReg),
                    datasets: [{ label: "Encuentros por Región", data: Object.values(mReg), backgroundColor: "#4DB748" }]
                },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
            });
        }
    } catch (err) {
        console.warn("Graficos omitidos o contenedores no encontrados.");
    }
}

function procesarVisualizacion() {
    actualizarKPIs();
    renderizarCarrusel();
    actualizarIluminacionMapa();
    actualizarGraficosEstadisticos();
}

function construirSelectoresFiltro() {
    inyectarOpcionesSelect("filtroAnio", [...new Set(encuentrosGlobal.map(e => e.anio))]);
    inyectarOpcionesSelect("filtroRegion", [...new Set(encuentrosGlobal.map(e => e.region))]);
}

function inyectarOpcionesSelect(id, listado) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<option value="">Todos</option>`;
    listado.filter(Boolean).sort().forEach(item => {
        el.innerHTML += `<option value="${item}">${item}</option>`;
    });
}

function vincularEventosInteraccion() {
    document.querySelectorAll("select").forEach(sel => {
        sel.addEventListener("change", ejecutarFiltradoEstructural);
    });

    // SE ELIMINARON de aquí los listeners manuales a "prevCard" y "nextCard"
    // ya que ahora se gestionan 100% dinámicamente mediante reengancharEventosControles().

    const btnLimpiar = document.getElementById("btn-limpiar");
    if (btnLimpiar) {
        btnLimpiar.addEventListener("click", () => {
            document.getElementById("filtroAnio").value = "";
            document.getElementById("filtroRegion").value = "";
            document.querySelectorAll('.region-path').forEach(el => el.classList.remove('active-region'));
            encuentrosFiltrados = [...encuentrosGlobal];
            indiceCarruselActual = 0;
            procesarVisualizacion();
        });
    }
}

document.addEventListener("DOMContentLoaded", inicializarObservatorio);

// ================================
// MÓDULO: CLUBES DE CIENCIA Y TECNOLOGÍA (CON MAPAS DUALES)
// ================================
const SHEET_ID_CLUBES = "1haFTi8tPS5YMk03bOSi_ZXV0j15fuwMqYEzqLRSl3SY";
const URL_CLUBES = `https://docs.google.com/spreadsheets/d/${SHEET_ID_CLUBES}/gviz/tq?tqx=out:json`;

let clubesGlobal = [];
let clubesMostrados = [];
let modoActualClubes = "PE"; 
let paisFiltroActivo = ""; 

const banderasPaises = { "PERÚ": "🇵🇪", "COLOMBIA": "🇨🇴", "URUGUAY": "🇺🇾", "CHILE": "🇨🇱", "DEFAULT": "🌎" };

async function inicializarClubes() {
    try {
        const response = await fetch(URL_CLUBES);
        const text = await response.text();
        const json = JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));

        clubesGlobal = json.table.rows.map(r => ({
            pais: r.c[0]?.v || "",
            region: r.c[1]?.v || "",
            ugel: r.c[2]?.v || "",
            distrito: r.c[3]?.v || "",
            colegio: r.c[4]?.v || "Institución no registrada",
            gestion: r.c[5]?.v || "N/A",
            club: r.c[6]?.v || "Club de Ciencia y Tecnología",
            nivel: r.c[7]?.v || "Educación Básica"
        })).filter(c => c.pais !== ""); 

        await cargarMapasClubesSVG(); // Carga ambos mapas
        configurarInterfazClubes();
        aplicarFiltrosClubes();
    } catch (error) {
        console.error("Error cargando la lista de clubes:", error);
    }
}

// NUEVA FUNCIÓN: Carga y configura los dos mapas simultáneamente
async function cargarMapasClubesSVG() {
    try {
        // Cargar Mapa Perú
        const resPe = await fetch('peru.svg');
        document.getElementById('mapa-clubes-peru').innerHTML = await resPe.text();
        
        document.querySelectorAll('#mapa-clubes-peru svg path').forEach(p => {
            p.classList.add('cursor-pointer', 'transition-all', 'duration-200');
            p.addEventListener('click', () => {
                const regionId = p.getAttribute('id') || p.getAttribute('name');
                if (regionId) {
                    document.getElementById('filtroRegionClub').value = regionId;
                    aplicarFiltrosClubes();
                }
            });
            // Mostrar texto fijo al pasar el mouse (Mapa Perú)
            p.addEventListener('mousemove', () => {
                const regionId = p.getAttribute('id') || p.getAttribute('name');
                if (!regionId) return;

                const totalClubes = clubesGlobal.filter(c => normalizarNombre(c.pais) === "PERU" && normalizarNombre(c.region) === normalizarNombre(regionId)).length;

                const infoHover = document.getElementById('info-hover-mapa');
                if (infoHover) {
                    infoHover.innerHTML = `<span class="text-accent">${regionId}</span> • ${totalClubes} Clubes`;
                }
            });

            // Restaurar texto al salir (Mapa Perú)
            p.addEventListener('mouseout', () => {
                const infoHover = document.getElementById('info-hover-mapa');
                if (infoHover) infoHover.innerHTML = "Pasa el cursor sobre el mapa para ver detalles";
            });
        });

        // Cargar Mapa Mundo (Requiere que tengas el archivo world.svg en tu carpeta)
        const resMundo = await fetch('world.svg');
        document.getElementById('mapa-clubes-mundo').innerHTML = await resMundo.text();
        
        document.querySelectorAll('#mapa-clubes-mundo svg path').forEach(p => {
            p.classList.add('cursor-pointer', 'transition-all', 'duration-200');
            p.addEventListener('click', () => {
                const paisId = normalizarNombre(p.getAttribute('id') || p.getAttribute('name'));
                
                if (paisId === "PERU") {
                    document.getElementById("tab-peru").click();
                    return;
                }

                // Buscar el botón de bandera que corresponde a este país y activarlo
                let btnCorrespondiente = null;
                document.querySelectorAll(".btn-bandera").forEach(b => {
                    if (normalizarNombre(b.getAttribute("data-pais")) === paisId) {
                        btnCorrespondiente = b;
                    }
                });

                if (btnCorrespondiente) {
                    btnCorrespondiente.click();
                }
            });
            // Mostrar texto fijo al pasar el mouse (Mapa Mundo)
            p.addEventListener('mousemove', () => {
                const paisId = p.getAttribute('id') || p.getAttribute('name');
                if (!paisId) return;

                const totalClubes = clubesGlobal.filter(c => normalizarNombre(c.pais) === normalizarNombre(paisId)).length;

                const infoHover = document.getElementById('info-hover-mapa');
                if (infoHover) {
                    infoHover.innerHTML = `<span class="text-brand">${paisId}</span> • ${totalClubes} Clubes`;
                }
            });

            // Restaurar texto al salir (Mapa Mundo)
            p.addEventListener('mouseout', () => {
                const infoHover = document.getElementById('info-hover-mapa');
                if (infoHover) infoHover.innerHTML = "Pasa el cursor sobre el mapa para ver detalles";
            });
        });

    } catch (e) {
        console.warn("No se pudo cargar alguno de los mapas SVG:", e);
    }
}

function configurarInterfazClubes() {
    const regionesPeru = [...new Set(clubesGlobal.filter(c => normalizarNombre(c.pais) === "PERU").map(c => c.region))].filter(Boolean).sort();
    const selectRegion = document.getElementById("filtroRegionClub");
    regionesPeru.forEach(r => selectRegion.innerHTML += `<option value="${r}">${r}</option>`);

    document.getElementById("tab-peru").addEventListener("click", () => cambiarTabClubes("PE"));
    document.getElementById("tab-intl").addEventListener("click", () => cambiarTabClubes("INT"));

    selectRegion.addEventListener("change", aplicarFiltrosClubes);
    document.getElementById("buscarClub").addEventListener("input", aplicarFiltrosClubes);

    document.querySelectorAll(".btn-bandera").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const paisClickeado = e.currentTarget.getAttribute("data-pais");
            
            if (paisFiltroActivo === paisClickeado) {
                paisFiltroActivo = "";
                e.currentTarget.setAttribute("data-activo", "false");
            } else {
                paisFiltroActivo = paisClickeado;
                document.querySelectorAll(".btn-bandera").forEach(b => b.setAttribute("data-activo", "false"));
                e.currentTarget.setAttribute("data-activo", "true");
            }
            aplicarFiltrosClubes();
        });
    });
}

function cambiarTabClubes(modo) {
    modoActualClubes = modo;
    const tabPeru = document.getElementById("tab-peru");
    const tabIntl = document.getElementById("tab-intl");
    const contRegion = document.getElementById("filtro-region-container");
    const contBanderas = document.getElementById("filtro-banderas-container");
    const mapaPeru = document.getElementById("mapa-clubes-peru");
    const mapaMundo = document.getElementById("mapa-clubes-mundo");

    document.getElementById("filtroRegionClub").value = "";
    document.getElementById("buscarClub").value = "";
    paisFiltroActivo = "";
    document.querySelectorAll(".btn-bandera").forEach(b => b.setAttribute("data-activo", "false"));

    if (modo === "PE") {
        tabPeru.className = "px-6 py-2 rounded-lg font-bold text-sm transition-all duration-200 bg-accent text-white shadow-md flex items-center gap-2";
        tabIntl.className = "px-6 py-2 rounded-lg font-bold text-sm text-slate-500 hover:text-slate-800 transition-all duration-200 flex items-center gap-2 bg-transparent shadow-none";
        contRegion.classList.remove("hidden");
        contBanderas.classList.add("hidden");
        
        // Mostrar mapa Perú, ocultar Mundo
        mapaPeru.classList.replace("opacity-0", "opacity-100");
        mapaPeru.classList.remove("pointer-events-none");
        mapaMundo.classList.replace("opacity-100", "opacity-0");
        mapaMundo.classList.add("pointer-events-none");
    } else {
        tabIntl.className = "px-6 py-2 rounded-lg font-bold text-sm transition-all duration-200 bg-brand text-white shadow-md flex items-center gap-2";
        tabPeru.className = "px-6 py-2 rounded-lg font-bold text-sm text-slate-500 hover:text-slate-800 transition-all duration-200 flex items-center gap-2 bg-transparent shadow-none";
        contRegion.classList.add("hidden");
        contBanderas.classList.remove("hidden");
        contBanderas.classList.add("flex");

        // Mostrar mapa Mundo, ocultar Perú
        mapaMundo.classList.replace("opacity-0", "opacity-100");
        mapaMundo.classList.remove("pointer-events-none");
        mapaPeru.classList.replace("opacity-100", "opacity-0");
        mapaPeru.classList.add("pointer-events-none");
    }
    
    aplicarFiltrosClubes();
}

function aplicarFiltrosClubes() {
    const term = normalizarNombre(document.getElementById("buscarClub").value);
    const regionSeleccionada = normalizarNombre(document.getElementById("filtroRegionClub").value);

    clubesMostrados = clubesGlobal.filter(c => {
        const paisNorm = normalizarNombre(c.pais);
        
        if (modoActualClubes === "PE" && paisNorm !== "PERU") return false;
        if (modoActualClubes === "INT" && paisNorm === "PERU") return false;

        if (modoActualClubes === "PE" && regionSeleccionada && normalizarNombre(c.region) !== regionSeleccionada) return false;
        if (modoActualClubes === "INT" && paisFiltroActivo && normalizarNombre(c.pais) !== normalizarNombre(paisFiltroActivo)) return false;

        if (term) {
            return normalizarNombre(c.club).includes(term) || normalizarNombre(c.colegio).includes(term);
        }
        return true;
    });

    renderizarTarjetasClubes();
    actualizarIluminacionMapasClubes(regionSeleccionada);
}

// NUEVA FUNCIÓN: Ilumina los colores en los dos mapas SVG
function actualizarIluminacionMapasClubes(regionFiltroActiva) {
    // 1. Lógica para el Mapa de Perú
    const conteoRegiones = clubesGlobal.filter(c => normalizarNombre(c.pais) === "PERU").reduce((acc, c) => {
        acc[normalizarNombre(c.region)] = true;
        return acc;
    }, {});

    document.querySelectorAll('#mapa-clubes-peru svg path').forEach(p => {
        const id = normalizarNombre(p.getAttribute('id') || p.getAttribute('name'));
        p.style.fill = ""; // Reset custom fill

        if (regionFiltroActiva && id === regionFiltroActiva) {
            p.style.fill = "#F79131"; // Naranja (Brand) si está filtrado
        } else if (conteoRegiones[id]) {
            p.style.fill = "#4DB748"; // Verde (Accent) si hay clubes
        } else {
            p.style.fill = "#E2E8F0"; // Gris si no hay data
        }
    });

    // 2. Lógica para el Mapa del Mundo
    const paisesConData = {};
    clubesGlobal.forEach(c => paisesConData[normalizarNombre(c.pais)] = true);

    document.querySelectorAll('#mapa-clubes-mundo svg path').forEach(p => {
        const id = normalizarNombre(p.getAttribute('id') || p.getAttribute('name'));
        p.style.fill = "";

        if (paisFiltroActivo && id === normalizarNombre(paisFiltroActivo)) {
            p.style.fill = "#F79131"; // Naranja (Brand) al seleccionar país
        } else if (paisesConData[id]) {
            p.style.fill = "#4DB748"; // Verde (Accent) para Chile, Colombia, Uruguay, Peru
        } else {
            p.style.fill = "#E2E8F0"; // Gris el resto del mundo
        }
    });
}

function renderizarTarjetasClubes() {
    const contenedor = document.getElementById("lista-clubes-contenedor");
    document.getElementById("total-clubes-lista").innerText = clubesMostrados.length;
    contenedor.innerHTML = "";

    if (clubesMostrados.length === 0) {
        contenedor.innerHTML = `<div class="col-span-full text-center py-10 text-slate-500 font-medium bg-white rounded-xl border border-dashed border-slate-300">🔍 No se encontraron clubes.</div>`;
        return;
    }

    clubesMostrados.forEach(c => {
        const isPeru = normalizarNombre(c.pais) === "PERU";
        const emojiBandera = banderasPaises[c.pais.toUpperCase()] || banderasPaises["DEFAULT"];
        const colorTema = isPeru ? "accent" : "brand";
        const colorGestion = c.gestion.toLowerCase().includes("priv") ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700";
        const colorNivel = "bg-slate-100 text-slate-700";

        let bloqueUbicacion = isPeru 
            ? `<div class="grid grid-cols-2 gap-2 text-[11px] text-slate-500"><p><span class="font-bold text-slate-700">📍 Región:</span> ${c.region}</p><p><span class="font-bold text-slate-700">🏢 UGEL:</span> ${c.ugel}</p><p class="col-span-2"><span class="font-bold text-slate-700">📌 Distrito:</span> ${c.distrito}</p></div>`
            : `<div class="text-[11px] text-slate-500"><p><span class="font-bold text-slate-700">🌎 País:</span> ${c.pais}</p></div>`;

        contenedor.innerHTML += `
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 hover:border-${colorTema} hover:shadow-md transition-all duration-300 flex flex-col justify-between">
                <div class="space-y-3 mb-4">
                    <div>
                        <span class="text-xs font-black uppercase tracking-wider block text-${colorTema} mb-1">${emojiBandera} CCYT ${c.club}</span>
                        <h4 class="text-sm font-bold text-slate-800 leading-snug">🏫 I.E. ${c.colegio}</h4>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${colorGestion}">${c.gestion}</span>
                        <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${colorNivel}">${c.nivel}</span>
                    </div>
                </div>
                <div class="pt-3 border-t border-slate-100">${bloqueUbicacion}</div>
            </div>`;
    });
}

document.addEventListener("DOMContentLoaded", inicializarClubes);
