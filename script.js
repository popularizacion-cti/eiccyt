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

const normalizarNombre = (str) => {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
};

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
            college: r.c[4]?.v || "Institución no registrada",
            gestion: r.c[5]?.v || "N/A",
            club: r.c[6]?.v || "Club de Ciencia y Tecnología",
            nivel: r.c[7]?.v || "Educación Básica"
        })).filter(c => c.pais !== ""); 

        await cargarMapasClubesSVG();
        configurarInterfazClubes();
        aplicarFiltrosClubes();
    } catch (error) {
        console.error("Error cargando la lista de clubes:", error);
    }
}

async function cargarMapasClubesSVG() {
    // 1. CARGAR MAPA PERÚ (Con protección anti-crash)
    const contenedorPeru = document.getElementById('mapa-clubes-peru');
    if (contenedorPeru) {
        try {
            const resPe = await fetch('peru.svg');
            contenedorPeru.innerHTML = await resPe.text();
            
            document.querySelectorAll('#mapa-clubes-peru svg path').forEach(p => {
                p.classList.add('cursor-pointer', 'transition-all', 'duration-200', 'region-path');
                p.style.stroke = "#ffffff";
                p.style.strokeWidth = "1px";
                p.style.strokeLinejoin = "round";
                
                p.addEventListener('click', () => {
                    const regionId = p.getAttribute('id') || p.getAttribute('name');
                    const selectElement = document.getElementById('filtroRegionClub');
                    if (!regionId || !selectElement) return;
                    
                    const regionNorm = normalizarNombre(regionId);
                    let matchedValue = "";
                    for (let option of selectElement.options) {
                        if (normalizarNombre(option.value) === regionNorm) {
                            matchedValue = option.value;
                            break;
                        }
                    }

                    if (selectElement.value === matchedValue) {
                        selectElement.value = "";
                    } else if (matchedValue) {
                        selectElement.value = matchedValue;
                    }
                    aplicarFiltrosClubes();
                });
                
                p.addEventListener('mousemove', () => {
                    const regionId = p.getAttribute('id') || p.getAttribute('name');
                    const infoHover = document.getElementById('info-hover-mapa');
                    if (!regionId || !infoHover) return;
                    
                    const totalClubes = clubesGlobal.filter(c => normalizarNombre(c.pais) === "PERU" && normalizarNombre(c.region) === normalizarNombre(regionId)).length;
                    infoHover.innerHTML = `<span class="text-accent font-black text-base">${regionId}</span> • ${totalClubes} Clubes`;
                });
                
                p.addEventListener('mouseout', () => {
                    const infoHover = document.getElementById('info-hover-mapa');
                    if (infoHover) infoHover.innerHTML = "Seleccione una región sobre el mapa para ver detalles";
                });
            });
        } catch (err) { console.warn("Error al procesar peru.svg:", err); }
    }

    // 2. CARGAR MAPA MUNDO (Con protección anti-crash)
    const contenedorMundo = document.getElementById('mapa-clubes-mundo');
    if (contenedorMundo) {
        try {
            const resMundo = await fetch('world.svg');
            contenedorMundo.innerHTML = await resMundo.text();
            
            document.querySelectorAll('#mapa-clubes-mundo svg path').forEach(p => {
                p.classList.add('cursor-pointer', 'transition-all', 'duration-200', 'region-path');
                p.style.stroke = "#ffffff";
                p.style.strokeWidth = "1px";
                p.style.strokeLinejoin = "round";
                
                p.addEventListener('click', () => {
                    const paisId = normalizarNombre(p.getAttribute('id') || p.getAttribute('name'));
                    const tabPeru = document.getElementById("tab-peru");
                    if (!paisId) return;

                    if (paisId === "PERU" && tabPeru) {
                        tabPeru.click();
                        return;
                    }

                    let btnCorrespondiente = null;
                    document.querySelectorAll(".btn-bandera").forEach(b => {
                        const nombreBandera = normalizarNombre(b.getAttribute("data-pais"));
                        if (nombreBandera === paisId || paisId.includes(nombreBandera) || nombreBandera.includes(paisId)) {
                            btnCorrespondiente = b;
                        }
                    });
                    if (btnCorrespondiente) btnCorrespondiente.click();
                });
                
                p.addEventListener('mousemove', () => {
                    const paisId = p.getAttribute('id') || p.getAttribute('name');
                    const infoHover = document.getElementById('info-hover-mapa');
                    if (!paisId || !infoHover) return;
                    
                    const totalClubes = clubesGlobal.filter(c => normalizarNombre(c.pais) === normalizarNombre(paisId)).length;
                    infoHover.innerHTML = `<span class="text-brand font-black text-base">${paisId}</span> • ${totalClubes} Clubes`;
                });
                
                p.addEventListener('mouseout', () => {
                    const infoHover = document.getElementById('info-hover-mapa');
                    if (infoHover) infoHover.innerHTML = "Seleccione una región sobre el mapa para ver detalles";
                });
            });
        } catch (err) { console.warn("Error al procesar world.svg:", err); }
    }
}

function configurarInterfazClubes() {
    const selectRegion = document.getElementById("filtroRegionClub");
    if (selectRegion) {
        const regionesPeru = [...new Set(clubesGlobal.filter(c => normalizarNombre(c.pais) === "PERU").map(c => c.region))].filter(Boolean).sort();
        regionesPeru.forEach(r => selectRegion.innerHTML += `<option value="${r}">${r}</option>`);
        selectRegion.addEventListener("change", aplicarFiltrosClubes);
    }

    const tabPeru = document.getElementById("tab-peru");
    if (tabPeru) tabPeru.addEventListener("click", () => cambiarTabClubes("PE"));

    const tabIntl = document.getElementById("tab-intl");
    if (tabIntl) tabIntl.addEventListener("click", () => cambiarTabClubes("INT"));

    const buscarClub = document.getElementById("buscarClub");
    if (buscarClub) buscarClub.addEventListener("input", aplicarFiltrosClubes);

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
    const inputBuscar = document.getElementById("buscarClub");
    const selectRegion = document.getElementById("filtroRegionClub");

    if (selectRegion) selectRegion.value = "";
    if (inputBuscar) inputBuscar.value = "";
    
    paisFiltroActivo = "";
    document.querySelectorAll(".btn-bandera").forEach(b => b.setAttribute("data-activo", "false"));

    if (modo === "PE") {
        if (tabPeru) tabPeru.className = "px-6 py-2 rounded-lg font-bold text-sm transition-all duration-200 bg-accent text-white shadow-md flex items-center gap-2";
        if (tabIntl) tabIntl.className = "px-6 py-2 rounded-lg font-bold text-sm text-slate-500 hover:text-slate-800 transition-all duration-200 flex items-center gap-2 bg-transparent shadow-none";
        if (contRegion) contRegion.classList.remove("hidden");
        if (contBanderas) contBanderas.classList.add("hidden");
        
        if (mapaPeru) {
            mapaPeru.classList.remove("opacity-0", "pointer-events-none");
            mapaPeru.classList.add("opacity-100");
        }
        if (mapaMundo) {
            mapaMundo.classList.remove("opacity-100");
            mapaMundo.classList.add("opacity-0", "pointer-events-none");
        }
    } else {
        if (tabIntl) tabIntl.className = "px-6 py-2 rounded-lg font-bold text-sm transition-all duration-200 bg-brand text-white shadow-md flex items-center gap-2";
        if (tabPeru) tabPeru.className = "px-6 py-2 rounded-lg font-bold text-sm text-slate-500 hover:text-slate-800 transition-all duration-200 flex items-center gap-2 bg-transparent shadow-none";
        if (contRegion) contRegion.classList.add("hidden");
        if (contBanderas) {
            contBanderas.classList.remove("hidden");
            contBanderas.classList.add("flex");
        }

        if (mapaMundo) {
            mapaMundo.classList.remove("opacity-0", "pointer-events-none");
            mapaMundo.classList.add("opacity-100");
        }
        if (mapaPeru) {
            mapaPeru.classList.remove("opacity-100");
            mapaPeru.classList.add("opacity-0", "pointer-events-none");
        }
    }
    
    aplicarFiltrosClubes();
}

function aplicarFiltrosClubes() {
    const inputBuscar = document.getElementById("buscarClub");
    const selectRegion = document.getElementById("filtroRegionClub");
    
    const term = inputBuscar ? normalizarNombre(inputBuscar.value) : "";
    const regionSeleccionada = selectRegion ? normalizarNombre(selectRegion.value) : "";

    clubesMostrados = clubesGlobal.filter(c => {
        const paisNorm = normalizarNombre(c.pais);
        
        if (modoActualClubes === "PE" && paisNorm !== "PERU") return false;
        if (modoActualClubes === "INT" && paisNorm === "PERU") return false;

        if (modoActualClubes === "PE" && regionSeleccionada && normalizarNombre(c.region) !== regionSeleccionada) return false;
        if (modoActualClubes === "INT" && paisFiltroActivo && normalizarNombre(c.pais) !== normalizarNombre(paisFiltroActivo)) return false;

        if (term) {
            return normalizarNombre(c.club).includes(term) || normalizarNombre(c.college).includes(term);
        }
        return true;
    });

    renderizarTarjetasClubes();
    actualizarIluminacionMapasClubes(regionSeleccionada);
}

function actualizarIluminacionMapasClubes(regionFiltroActiva) {
    const conteoRegiones = clubesGlobal.filter(c => normalizarNombre(c.pais) === "PERU").reduce((acc, c) => {
        acc[normalizarNombre(c.region)] = true;
        return acc;
    }, {});

    document.querySelectorAll('#mapa-clubes-peru svg path').forEach(p => {
        const id = normalizarNombre(p.getAttribute('id') || p.getAttribute('name'));
        p.style.fill = ""; 

        if (regionFiltroActiva && id === regionFiltroActiva) {
            p.style.fill = "#F79131"; 
        } else if (conteoRegiones[id]) {
            p.style.fill = "#4DB748"; 
        } else {
            p.style.fill = "#E2E8F0"; 
        }
    });

    const paisesConData = {};
    clubesGlobal.forEach(c => paisesConData[normalizarNombre(c.pais)] = true);

    document.querySelectorAll('#mapa-clubes-mundo svg path').forEach(p => {
        const id = normalizarNombre(p.getAttribute('id') || p.getAttribute('name'));
        p.style.fill = "";

        if (paisFiltroActivo && id === normalizarNombre(paisFiltroActivo)) {
            p.style.fill = "#F79131"; 
        } else if (paisesConData[id]) {
            p.style.fill = "#4DB748"; 
        } else {
            p.style.fill = "#E2E8F0"; 
        }
    });
}

function renderizarTarjetasClubes() {
    const contenedor = document.getElementById("lista-clubes-contenedor");
    const contadorTotal = document.getElementById("total-clubes-lista");
    
    if (contadorTotal) contadorTotal.innerText = clubesMostrados.length;
    if (!contenedor) return;
    
    let htmlSalida = "";

    if (clubesMostrados.length === 0) {
        contenedor.innerHTML = `<div class="col-span-full text-center py-10 text-slate-500 font-medium bg-white rounded-xl border border-dashed border-slate-300">🔍 No se encontraron clubes.</div>`;
        return;
    }

    clubesMostrados.forEach(c => {
        const isPeru = normalizarNombre(c.pais) === "PERU";
        const colorTema = isPeru ? "accent" : "brand";
        const colorGestion = c.gestion.toLowerCase().includes("priv") ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700";
        const colorNivel = "bg-slate-100 text-slate-700";

        let bloqueUbicacion = isPeru 
            ? `<div class="grid grid-cols-2 gap-2 text-[11px] text-slate-500"><p><span class="font-bold text-slate-700">📍 Región:</span> ${c.region}</p><p><span class="font-bold text-slate-700">🏢 UGEL:</span> ${c.ugel}</p><p class="col-span-2"><span class="font-bold text-slate-700">📌 Distrito:</span> ${c.distrito}</p></div>`
            : `<div class="text-[11px] text-slate-500"><p><span class="font-bold text-slate-700">🌎 País:</span> ${c.pais}</p></div>`;

        htmlSalida += `
            <div class="bg-slate-50 p-5 rounded-2xl shadow-sm border border-slate-200/60 hover:border-slate-400 hover:shadow-md transition-all duration-300 flex flex-col justify-between">
                <div class="space-y-3 mb-4">
                    <div>
                        <span class="text-xs font-black uppercase tracking-wider block text-dark mb-1">🔬 CCYT ${c.club}</span>
                        <h4 class="text-sm font-bold text-slate-800 leading-snug">🏫 I.E. ${c.college}</h4>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${colorGestion}">${c.gestion}</span>
                        <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${colorNivel}">${c.nivel}</span>
                    </div>
                </div>
                <div class="pt-3 border-t border-slate-100">${bloqueUbicacion}</div>
            </div>`;
    });
    
    contenedor.innerHTML = htmlSalida;
}

document.addEventListener("DOMContentLoaded", inicializarClubes);


// ==========================================
// MÓDULO: VELADA CULTURAL (DESDE GOOGLE SHEETS)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const SHEET_ID_VELADA = '10NibBvay679ooOnHBYTFOITSf7d9LLBO0EP1RMSm8dk'; 
    const SHEET_NAME_VELADA = 'Hoja 1'; 
    const URL_VELADA = `https://docs.google.com/spreadsheets/d/${SHEET_ID_VELADA}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME_VELADA}`;

    // Mapeo de contenedores (Normalizamos 'poesía' y 'poesia' a un solo ID)
    const contenedores = {
        'danza': document.getElementById('lista-danza'),
        'poesia': document.getElementById('lista-poesia'), 
        'canto': document.getElementById('lista-canto'),
        'teatro': document.getElementById('lista-teatro')
    };

    // Definimos qué categorías usan la tarjeta con fondo oscuro (#7A2C8E)
    const categoriasOscuras = ['poesia', 'teatro'];

    const existenContenedores = Object.values(contenedores).some(c => c !== null);
    if (!existenContenedores) return;

    // --- FUNCIONES DE PLANTILLAS HTML ---
    function generarEncabezadoRegion(region, esOscuro) {
        if (esOscuro) {
            return `
                <div class="sticky top-0 bg-dark/95 backdrop-blur-sm pt-0 pb-0 border-accent z-10 mt-4 first:mt-0">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-white/10 text-slate-300 uppercase tracking-widest shadow-sm">
                        📍 Región ${region}
                    </span>
                </div>
            `;
        }
        return `
            <div class="sticky top-0 bg-white/95 backdrop-blur-sm pt-0 pb-0 border-brand z-10 mt-4 first:mt-0">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-brand/10 text-brand uppercase tracking-widest shadow-sm">
                    Región ${region} 
                </span>
            </div>
        `;
    }

    function generarItemPresentacion(item, esOscuro) {
        if (esOscuro) {
            return `
                <li class="pt-0 pb-2 border-b border-white/10 last:border-0 group transition-transform duration-200 hover:translate-x-1 pl-2">
                    <div class="flex flex-col gap-1">
                        <h4 class="text-sm font-black text-slate-300 uppercase leading-tight group-hover:text-accent transition-colors">
                            "${item.presentacion}"
                        </h4>
                        <p class="text-xs font-medium text-white/80 flex items-center gap-1.5">
                            <span class="w-1.5 h-1.5 rounded-full bg-brand inline-block"></span>
                            CCyT ${item.ccyt}
                        </p>
                    </div>
                </li>
            `;
        }
        return `
            <li class="pt-0 pb-2 border-b border-slate-200/60 last:border-0 group transition-transform duration-200 hover:translate-x-1 pl-2">
                <div class="flex flex-col gap-1">
                    <h4 class="text-sm font-black text-slate-600 uppercase leading-tight group-hover:text-accent transition-colors">
                        "${item.presentacion}"
                    </h4>
                    <p class="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                        <span class="w-1.5 h-1.5 rounded-full bg-accent inline-block"></span>
                        CCyT ${item.ccyt}
                    </p>
                </div>
            </li>
        `;
    }
    // ------------------------------------

    fetch(URL_VELADA)
        .then(res => res.text())
        .then(data => {
            // Limpiamos los contenedores
            Object.values(contenedores).forEach(lista => {
                if(lista) lista.innerHTML = '';
            });

            const json = JSON.parse(data.substr(47).slice(0, -2));
            const rows = json.table.rows;

            // 1. Estructura para agrupar datos: { 'danza': { 'Lima': [...], 'Cusco': [...] }, ... }
            const datosAgrupados = {
                'danza': {},
                'poesia': {},
                'canto': {},
                'teatro': {}
            };

            // 2. Procesar filas y agrupar
            rows.slice(1).forEach(row => {
                let rawCategoria = row.c[0] ? row.c[0].v.toLowerCase().trim() : "";
                // Normalizar la tilde para poesía
                let categoria = (rawCategoria === 'poesía') ? 'poesia' : rawCategoria;
                
                const ccyt = row.c[1] ? row.c[1].v : "Club";
                const region = row.c[2] ? row.c[2].v : "Región";
                const presentacion = row.c[3] ? row.c[3].v : "Presentación";

                if (datosAgrupados[categoria]) {
                    if (!datosAgrupados[categoria][region]) {
                        datosAgrupados[categoria][region] = [];
                    }
                    datosAgrupados[categoria][region].push({ ccyt, presentacion });
                }
            });

            // 3. Generar el HTML e inyectar en el DOM
            for (const categoria in datosAgrupados) {
                const listaDestino = contenedores[categoria];
                if (!listaDestino) continue;

                const regiones = datosAgrupados[categoria];
                const nombresRegiones = Object.keys(regiones).sort(); // Orden alfabético de regiones
                const esOscuro = categoriasOscuras.includes(categoria);
                
                let htmlFinal = '';

                nombresRegiones.forEach(region => {
                    // Agregamos el encabezado de la región
                    htmlFinal += generarEncabezadoRegion(region, esOscuro);
                    
                    // Agregamos todas las presentaciones de esa región
                    regiones[region].forEach(item => {
                        htmlFinal += generarItemPresentacion(item, esOscuro);
                    });
                });

                if (htmlFinal !== '') {
                    listaDestino.innerHTML = htmlFinal;
                }
            }
            
            // 4. Manejo de estados vacíos (Si no hay datos en alguna categoría)
            Object.keys(contenedores).forEach(categoria => {
                const lista = contenedores[categoria];
                if(lista && lista.innerHTML.trim() === '') {
                    const esOscuro = categoriasOscuras.includes(categoria);
                    const textColor = esOscuro ? 'text-white/60' : 'text-slate-400';
                    lista.innerHTML = `<li class="${textColor} italic text-sm mt-2">Participantes por confirmar...</li>`;
                }
            });
        })
        .catch(err => {
            console.error('Error al cargar la velada:', err);
            Object.keys(contenedores).forEach(categoria => {
                const lista = contenedores[categoria];
                if(lista) {
                    const esOscuro = categoriasOscuras.includes(categoria);
                    const textColor = esOscuro ? 'text-red-300' : 'text-red-500';
                    lista.innerHTML = `<li class="${textColor} text-sm mt-2">Error de conexión al cargar datos.</li>`;
                }
            });
        });
});
