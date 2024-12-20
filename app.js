    // Mapa inicial
    const map = L.map('map', {
        minZoom: 8,
        maxZoom: 22,
        zoomControl: false
    }).setView([-3.78, -38.54], 12);
    
    L.control.scale().addTo(map);

//Define as varieveis globais da layer OMI
    let viewCompletaOmi = false; // Variável para controlar se a camada OMICompleta esta visivel
    const omiLayerName = "OMI:view_omi_completa"; // Nome da camada OMICompleta

// Define as camadas de base
    var baselayers = {
    "Google": L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 22
    }),
    "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 22
    }),
    "Ortofoto": L.layerGroup([
        L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 22
        }),
        L.tileLayer.wms('https://geoserver.sefin.fortaleza.ce.gov.br/geoserver/wms?', {
            layers: 'IMAGEAMENTO:ortofoto_2016',
            format: 'image/png',
            transparent: true,
            maxZoom: 22
        })
    ])
    };

    var overlays = {
    
    };

    L.control.layers(baselayers, overlays, {
        position: 'bottomright'  // Move the control to the bottom-right corner
    }).addTo(map);

    // Mapa carregado por padrao
    baselayers["Google"].addTo(map);

    // modifica o estilo da caixa para usar bootstrap
    var controlContainer = document.querySelector('.leaflet-control-layers');
    controlContainer.classList.add('card');  // Adding a subtle shadow for depth

    // Modifica para melhor legibilidade
    var baseLayerList = controlContainer.querySelector('.leaflet-control-layers-base');
    baseLayerList.classList.add('list-group', 'list-group-flush', 'border-0');  // Clean list styling with no border

    // Adiciona classes ao items da lista de camadas
    var baseLayerItems = baseLayerList.querySelectorAll('label');
    baseLayerItems.forEach(function(item) {
        item.classList.add('list-group-item', 'list-group-item-action');  // Padding for easier touch targets
        item.style.cursor = 'pointer';  // Pointer cursor for better interactivity
    });

    // Define o texto para ficar mais visivel
    var baseLayerTexto = baseLayerList.querySelectorAll('span');
    baseLayerTexto.forEach(function(span) {
        span.classList.add('h6', 'text-dark');  // Stronger contrast for better legibility
    });

// Final da secao de base layers
    // Atualiza o indicador de zoom sempre que o nível de zoom mudar
    map.on('zoomend', () => {
        document.getElementById('zoom-display').textContent = `, Zoom: ${map.getZoom()}`;
    });

    // Define a ordem das camadas usando o z-index
    map.createPane('wmsPane').style.zIndex = 650;
    map.createPane('geoJsonPane').style.zIndex = 700;
    map.createPane('popupPane').style.zIndex = 750;

    // Define a URL base para o serviço WMS
    const wmsBaseUrl = "https://geoserver.sefin.fortaleza.ce.gov.br/geoserver/wms?";

    let currentLayer = null;
    let geoJsonLayer = null;
    let layers = [];

    // Função para obter as camadas disponíveis no serviço WMS
    async function fetchGetCapabilities() {
        try {
            const response = await fetch(`${wmsBaseUrl}request=GetCapabilities`);
            const text = await response.text();
            const xml = new window.DOMParser().parseFromString(text, "text/xml");
            layers = Array.from(xml.querySelectorAll("Layer > Layer"));
        } catch (error) {
            console.error("Erro ao obter as camadas WMS:", error);
        }
    }

    // Function to display filtered layers in the dropdown
function displaySuggestions(filteredLayers) {
    const suggestionsList = document.getElementById("suggestions");
    suggestionsList.innerHTML = ''; // Clear previous suggestions

    // Create a DocumentFragment to batch insert suggestions
    const fragment = document.createDocumentFragment();

    filteredLayers.forEach(layer => {
        const layerName = layer.querySelector("Name").textContent;
        const layerTitle = layer.querySelector("Title").textContent;
        
        const suggestionItem = document.createElement("a");
        suggestionItem.className = "dropdown-item";
        suggestionItem.href = "#";
        suggestionItem.textContent = layerTitle;
        suggestionItem.dataset.layerName = layerName; // Store data attributes for delegation
        
        fragment.appendChild(suggestionItem);
    });

    // Append all items at once
    suggestionsList.appendChild(fragment);

    // Event delegation for handling clicks
    suggestionsList.addEventListener("click", (event) => {
        if (event.target.classList.contains("dropdown-item")) {
            event.preventDefault();
            const layerName = event.target.dataset.layerName;
            const layerTitle = event.target.textContent;
            selectLayer(layerName, layerTitle);
        }
    }, { once: true }); // Use { once: true } if suggestions are static per call, otherwise remove this option
}


// Função de busca e filtro de camadas
fetchGetCapabilities().then(() => {
    // Exibe todas as camadas WMS disponíveis na lista de sugestões
    displaySuggestions(layers);

    // Verifica se há parâmetro de camada na URL e, se sim, seleciona a camada
    const layerNameFromUrl = getUrlParameter("layerName");
    if (layerNameFromUrl) {
        const selectedLayer = layers.find(layer => layer.querySelector("Name").textContent === layerNameFromUrl);
        if (selectedLayer) {
            const layerTitle = selectedLayer.querySelector("Title").textContent;
            selectLayer(layerNameFromUrl, layerTitle);
        }
    }

    // Variáveis para lidar com a busca de camadas e endereços
    const searchInput = document.getElementById("layerAddressSearch");
    const spinnerElement = document.getElementById("spinner");
    let debounceTimeoutId = null;
    let currentRequest = null;

    // Função para lidar com a busca de camadas e endereços
    searchInput.addEventListener("input", handleSearchInput);

    function handleSearchInput() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    clearTimeout(debounceTimeoutId);
    if (currentRequest) currentRequest.abort();

    const isAddressSearch = searchTerm.startsWith(">");
    spinnerElement.style.display = isAddressSearch ? "block" : "none";

    if (isAddressSearch) {
        debounceTimeoutId = setTimeout(async () => {
            const addressQuery = searchTerm.slice(1).trim();
            if (addressQuery.length >= 2) {
                await performAddressSearch(addressQuery);
            } else {
                spinnerElement.style.display = "none";
            }
        }, 500);
    } else {
        const filteredLayers = layers.filter(layer => 
            layer.querySelector("Title").textContent.toLowerCase().includes(searchTerm)
        );
        displaySuggestions(filteredLayers);
    }
}
});


// Funcao para Geocodificacao
function performAddressSearch(query) {
    const apiUrl = `https://nominatim.openstreetmap.org/search?format=geojson&q=${encodeURIComponent(query)}`;

    // Create an AbortController to cancel previous requests
    const abortController = new AbortController();
    fetch(apiUrl, { signal: abortController.signal })
        .then(response => response.json())
        .then(data => {
            const suggestionsList = document.getElementById("suggestions");
            suggestionsList.innerHTML = data.features.map(feature => `
                <li class="dropdown-item" onclick="selectAddress(${feature.geometry.coordinates[1]}, ${feature.geometry.coordinates[0]}, '${feature.properties.display_name}')">
                    ${feature.properties.display_name}
                </li>
            `).join("");
        })
        .catch(error => {
            if (error.name !== "AbortError") {
                console.error("Error fetching address:", error);
            }
        })
        .finally(() => {
            document.getElementById("spinner").style.display = "none"; // Hide spinner once request completes
        });
}

// Function to handle address selection
let currentMarker = null; // Variável para armazenar o marcador atual

// Function to select the address and add the marker
function selectAddress(latitude, longitude, displayName) {
    // Move the map to the specified location
    map.flyTo([latitude, longitude], 18);

    // Remove existing marker, if any, before adding the new one
    if (currentMarker) {
        map.removeLayer(currentMarker);
    }

    // Create a new marker
    currentMarker = L.marker([latitude, longitude], { title: displayName });

    // Add the marker to the map and display the popup
    currentMarker.addTo(map).bindPopup(displayName).openPopup();
}

document.addEventListener("DOMContentLoaded", () => {
    const layerNameFromUrl = getUrlParameter("layerName");
    if (layerNameFromUrl) {
        const selectedLayer = layers.find(layer => layer.querySelector("Name").textContent === layerNameFromUrl);
        if (selectedLayer) {
            const layerTitle = selectedLayer.querySelector("Title").textContent;
            selectLayer(layerNameFromUrl, layerTitle);
        }
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const toggleButton = document.createElement("button");
    toggleButton.id = "toggleViewCompletaOmi";
    toggleButton.className = "btn btn-primary position-fixed top-0 end-0 m-3";
    toggleButton.style.zIndex = 1000;
    toggleButton.textContent = "OMI: OFF";
    toggleButton.onclick = toggleViewCompletaOmi;

    document.body.appendChild(toggleButton);
});

function getUrlParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    // Modify selectLayer function to update URL with layerName
function selectLayer(layerName, layerTitle) {
        // Update the URL with the layerName parameter
        const url = new URL(window.location);
        url.searchParams.set('layerName', layerName);
        window.history.pushState({}, '', url);

        // Load the selected layer (existing code for loading the layer)
        document.getElementById("layerAddressSearch").value = '';
        document.getElementById("suggestions").classList.remove("show");

        const selectedLayer = layers.find(layer => layer.querySelector("Name").textContent === layerName);
        const bbox = selectedLayer.querySelector("EX_GeographicBoundingBox");

        if (currentLayer) map.removeLayer(currentLayer);
        if (geoJsonLayer) map.removeLayer(geoJsonLayer);

        currentLayer = L.tileLayer.wms(`${wmsBaseUrl}request=GetMap`, {
            layers: layerName,
            format: 'image/png',
            transparent: true,
            maxZoom: 22,
            pane: 'wmsPane'
        }).addTo(map);

        document.getElementById("current-layer-name").textContent = layerTitle;
    
        // Definindo os parâmetros de requisição para o GeoServer
        const legendParams = {
        layers: layerName,   // Nome da camada
        format: 'image/png',            // Formato da imagem
        transparent: true,              // Transparência para a legenda
        width: 20,                      // Largura da legenda
        height: 20,                     // Altura da legenda
        style: '',                      // Estilo da camada, se necessário
        legend_options: 'dpi:120;forceLabels:on;fontAntiAliasing:true;countMatched:false;fontName:sans;hideEmptyRules:false;forceTitles:off' // Forçar exibição de rótulos
        };

        // Função para criar o URL da requisição WMS para a legenda
        function getLegendUrl(params) {
        return `${wmsBaseUrl}REQUEST=GetLegendGraphic&VERSION=1.1.0&FORMAT=${params.format}&WIDTH=${params.width}&HEIGHT=${params.height}&STYLE=${params.style}&LAYER=${params.layers}&LEGEND_OPTIONS=${params.legend_options}&TRANSPARENT=${params.transparent}`;
        }

        // Função para carregar e exibir a legenda
        function loadLegend() {
        const legendUrl = getLegendUrl(legendParams);

        // Cria a imagem da legenda e insere no HTML
        const img = document.createElement('img');
        img.src = legendUrl;
        img.alt = 'Legenda:';
        
        const legendContainer = document.getElementById('legend-container');
        legendContainer.innerHTML = '';  // Limpar qualquer conteúdo anterior
        legendContainer.appendChild(img);  // Adicionar a imagem da legenda ao container
        }

        // Chama a função para carregar a legenda
        loadLegend();
    

    }

    // Função para alternar a visibilidade da camada OMICompleta
    function toggleViewCompletaOmi() {
        viewCompletaOmi = !viewCompletaOmi;
        const toggleButton = document.getElementById("toggleViewCompletaOmi");
        toggleButton.textContent = viewCompletaOmi ? "OMI: ON" : "OMI: OFF";

        if (viewCompletaOmi) {
            loadOmiLayer();
        } else {
            clearLayers();
        }
    }

        // Função para carregar a camada OMICompleta
    function loadOmiLayer() {
        if (currentLayer) map.removeLayer(currentLayer);
        if (geoJsonLayer) map.removeLayer(geoJsonLayer);

        currentLayer = L.tileLayer.wms(`${wmsBaseUrl}request=GetMap`, {
            layers: omiLayerName,
            format: 'image/png',
            transparent: true,
            maxZoom: 22,
            pane: 'wmsPane'
        }).addTo(map);

        document.getElementById("current-layer-name").textContent = "OMI: View Completa";
    }

    // Exibe as coordenadas do cursor
    map.on('mousemove', e => {
        document.getElementById("coordinates-display").textContent = `Posição do Cursor: Lat ${e.latlng.lat.toFixed(6)}, Lng ${e.latlng.lng.toFixed(6)}`;
    });

    // Evento de clique para exibir informações detalhadas da camada WMS
    // quando o usuário clica no mapa.
    map.on('click', e => {
        // Verifica se uma camada WMS foi selecionada
        if (!currentLayer) return;

        // Obtém os limites da visão atual do mapa
        const bounds = map.getBounds();

        // Obtém a largura e altura do mapa em pixels
        const { x: width, y: height } = map.getSize();

        // Obtém as coordenadas do clique em pixels
        const i = Math.floor(e.containerPoint.x), j = Math.floor(e.containerPoint.y);

        // Constroi a URL da requisição GetFeatureInfo do WMS
        // com os parâmetros de BBOX, WIDTH, HEIGHT, LAYERS, QUERY_LAYERS,
        // INFO_FORMAT, I e J.
        const getFeatureInfoUrl = `${wmsBaseUrl}SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&` +
            `BBOX=${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}` +
            `&CRS=EPSG:4326&WIDTH=${width}&HEIGHT=${height}&LAYERS=${currentLayer.wmsParams.layers}` +
            `&QUERY_LAYERS=${currentLayer.wmsParams.layers}&INFO_FORMAT=application/json&I=${i}&J=${j}`;

        // Verifica se um menu de contexto está visível
        const contextMenuVisible = document.getElementById('context-menu') && document.getElementById('context-menu').offsetParent !== null;

        // Se um menu de contexto estiver visível, ignora o clique
        if (contextMenuVisible) return;

        // Faz uma requisição GET para a URL construída
        fetch(getFeatureInfoUrl)
            .then(response => response.json())
            .then(data => {
                // Remove a camada GeoJSON anterior, se existir
                if (geoJsonLayer) map.removeLayer(geoJsonLayer);

                // Verifica se a resposta do WMS contém feições
                if (data.features && data.features.length > 0) {
                    // Cria uma camada GeoJSON com a feição encontrada
                    geoJsonLayer = L.geoJSON(data.features[0], {
                        style: { color: 'red', weight: 5, opacity: 1, fillOpacity: 0.5 },
                        pane: 'geoJsonPane'
                    }).addTo(map);

                    // Verifica se a opção viewCompletaOmi está ativa
                    if (viewCompletaOmi) {
                        // Constroi o HTML personalizado para o popup
                        const properties = data.features[0].properties;
                        const popupHTML = `
                        <div class="card" style="width: 18rem;">
                          <div class="card-header" style="background-image: linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0)), url('${properties.link_thumb}'); background-size: cover; height: 200px; background-position: center;">
                            <h5 class="card-title text-white">${properties.nome_condominio || ''} ${properties.cartografia}</h5>
                            <h6 class="card-subtitle mb-2 text-white">
                              ${properties.endereco_completo || 'Endereço não disponível'}
                            </h6>                          
                          </div>
                          <div class="card-body">
               
                            ${properties.preco_imovel ? `<h5 class="card-text text-success">R$ ${parseFloat(properties.preco_imovel).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>` : ``}
                            ${properties.tipologia ? `<h6 class="card-subtitle mb-2 text-muted">${properties.tipologia}</h6>` : ``}

                            <p class="card-text">
                              ${properties.cadastrado_grpfor ? `<i class="bi bi-check-circle text-success"></i>` : `<i class="bi bi-x-circle text-danger"></i>`}
                              ${properties.cadastrado_grpfor ? 'Cadastrado GPFOR' : 'Não cadastrado GPFOR'}
                            </p>
                            <p class="card-text">
                              ${properties.revisado_omi ? `<i class="bi bi-check-circle text-success"></i>` : `<i class="bi bi-x-circle text-danger"></i>`}
                              ${properties.revisado_omi ? 'Revisado OMI' : 'Não Revisado OMI'}
                            </p>

                            <div class="d-flex justify-content-between mt-3">
                              <a href="${properties.link_sit}" class="btn btn-primary text-white flex-grow-1 mx-1 ${!properties.link_sit ? 'disabled' : ''}" style="transition: background-color 0.3s;" onmouseover="this.style.backgroundColor='#0056b3'" onmouseout="this.style.backgroundColor=''" role="button">SITFOR</a>
                              <a href="${properties.link_omi}" class="btn btn-primary text-white flex-grow-1 mx-1 ${!properties.link_omi ? 'disabled' : ''}" style="transition: background-color 0.3s;" onmouseover="this.style.backgroundColor='#0056b3'" onmouseout="this.style.backgroundColor=''" role="button">OMI</a>
                            </div>
                          </div>
                        </div>`;
                        // Abre o popup com o conteúdo
                        L.popup({ pane: 'popupPane' }).setLatLng(e.latlng).setContent(popupHTML).openOn(map);
                    } else {
                        // Constroi o conteúdo da popup com a lista de atributos padrão
                        const propertiesHTML = `
                        <div class="card" style="height: 250px; overflow-y: auto;">
                            <div class="card-header">
                                <strong>Lista de Atributos</strong>
                            </div>
                            <div class="table-responsive">
                                <table class="table table-bordered table-striped">
                                    <tbody>
                                        ${Object.entries(properties).map(
                                            ([key, value]) => `
                                            <tr>
                                                <td><strong>${key}</strong></td>
                                                <td>${value}</td>
                                            </tr>`
                                        ).join("")}
                                    </tbody>
                                </table>
                            </div>
                        </div>`;
                        // Abre a popup com o conteúdo padrão
                        L.popup({ pane: 'popupPane' }).setLatLng(e.latlng).setContent(propertiesHTML).openOn(map);
                    }
                } else {
                    // Se nenhuma feição foi encontrada, exibe uma mensagem de erro
                    L.popup({ pane: 'popupPane' }).setLatLng(e.latlng).setContent("Nenhuma feição encontrada.").openOn(map);
                }
            })
            .catch(console.error);
        });

    // Ajusta a opacidade da camada WMS e da camada GeoJSON
    document.getElementById("opacitySlider").addEventListener("input", function () {
        const opacity = this.value;

        // Apply opacity to WMS layer if it exists
        if (currentLayer) currentLayer.setOpacity(opacity);

        // Apply opacity to GeoJSON layer if it exists
        if (geoJsonLayer) {
            geoJsonLayer.eachLayer(function (layer) {
                // Update both stroke and fill opacity for GeoJSON features
                layer.setStyle({
                    opacity: opacity,         // For borders/lines
                    fillOpacity: opacity/2      // For polygon fills
                });
            });
        }
    });


    // Fecha as sugestões ao clicar fora do campo de pesquisa
        document.addEventListener("click", e => {
        const searchBox = document.getElementById("layerAddressSearch");
        const suggestionsBox = document.getElementById("suggestions");
        
        if (searchBox && !searchBox.contains(e.target)) {
            suggestionsBox.classList.remove("show");
            document.getElementById("pesquisa").classList.remove("show");
        }
    });


// Função para limpar as camadas e o marcador
function clearLayers() {
    // Remove o marcador atual se ele existir
    if (currentMarker) {
        map.removeLayer(currentMarker);
        currentMarker = null; // Limpa a referência
    }

    // Remove a camada WMS, se existir
    if (currentLayer) {
        map.removeLayer(currentLayer);
        currentLayer = null;
    }

    // Remove a camada GeoJSON, se existir
    if (geoJsonLayer) {
        map.removeLayer(geoJsonLayer);
        geoJsonLayer = null;
    }

    // Redefine o slider de opacidade para o valor padrão (1)
    document.getElementById("opacitySlider").value = 1;

    // Limpa o nome da camada exibido
    document.getElementById("current-layer-name").textContent = "Adicione uma Camada";

    // Limpa o parâmetro da URL para 'layerName'
    const url = new URL(window.location);
    url.searchParams.delete('layerName');
    window.history.pushState({}, '', url);

    // Limpa o conteúdo da legenda
    const legendContainer = document.getElementById('legend-container');
    legendContainer.innerHTML = '';  // Remove qualquer conteúdo da legenda

    // Opcionalmente, limpa a caixa de pesquisa e sugestões
    displaySuggestions(layers);
    document.getElementById("layerSearch").value = '';
    document.getElementById("suggestions").innerHTML = '';
}

    // Attach the clearLayers function to the Clear Layers button
    document.getElementById("clearLayersBtn").addEventListener("click", clearLayers);

    // Fun o para copiar coordenadas para a  rea de transfer ncia
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showModal('Coordenadas copiadas!');
        }).catch((err) => {
            console.error('Erro ao copiar para  rea de transfer ncia', err);
        });
    }

    // Fun o para mostrar um modal com uma mensagem
    function showModal(message) {
        const modalEl = document.createElement('div');
        modalEl.className = 'modal fade';
        modalEl.id = 'copyModal';
        modalEl.innerHTML = `<div class="modal-dialog modal-dialog-top"><div class="modal-content"><div class="modal-body">${message}</div></div></div>`;
        document.body.appendChild(modalEl);

        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        setTimeout(() => {
            modal.hide();
            modalEl.remove();
        }, 1000);
    }

    // Fun o para remover o menu de contexto
    function removeContextMenu() {
        const existingMenus = document.querySelectorAll('#context-menu');
        existingMenus.forEach(menu => menu.remove());
    }

    // Evento de clique com bot o direito para abrir o menu de contexto
    map.on('contextmenu', (e) => {
        const contextMenuHTML = `
            <div id="context-menu" class="position-absolute p-3 bg-white rounded shadow-lg" style="top: ${e.containerPoint.y}px; left: ${e.containerPoint.x}px; z-index: 1000;">
                <ul class="list-group list-group-flush">
                    <li class="list-group-item p-2" onmouseover="this.style.backgroundColor='#f5f5f5'" onmouseout="this.style.backgroundColor='white'"><i class="bi bi-pin-map-fill"></i>&nbsp<a href="#" class="text-decoration-none text-dark h-5" onclick="copyToClipboard('${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}'); return false;">Copiar Coordenadas</a></li>
                    <li class="list-group-item p-2" onmouseover="this.style.backgroundColor='#f5f5f5'" onmouseout="this.style.backgroundColor='white'"><i class="bi bi-person-walking"></i>&nbsp<a href="https://www.google.com/maps?q=&layer=c&cbll=${e.latlng.lat},${e.latlng.lng}" target="_blank" class="text-decoration-none text-dark h-5">Abrir no Google Street View</a></li>
                </ul>
            </div>
        `;

        // Remove o menu de contexto anterior, se existir
        removeContextMenu();

        // Adiciona o menu de contexto ao mapa
        const contextMenuEl = document.createElement('div');
        contextMenuEl.innerHTML = contextMenuHTML;
        document.getElementById('map').appendChild(contextMenuEl);

        // Fecha o menu se clicar fora dele
        setTimeout(() => { // Timeout para evitar fechamento imediato ao clicar no pr prio menu
            document.addEventListener('click', removeContextMenu);
        }, 10);
    });