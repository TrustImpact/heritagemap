// Global variables
var map;
var currentCircle = null;
var allPoints = [];
var loadedData = [];

document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    addEventListeners();
});

function initializeMap() {
    map = L.map('map').setView([53.383331, -1.466667], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data © OpenStreetMap contributors'
    }).addTo(map);
}

function addEventListeners() {
    document.getElementById('postcodeSearchButton').addEventListener('click', postcodeSearch);
    map.on('click', mapClickHandler);
}

function postcodeSearch() {
    var postcode = document.getElementById('postcodeInput').value;
    if (!postcode) {
        alert("Please enter a postcode.");
        return;
    }
    geocodePostcode(postcode)
        .then(latlng => {
            drawCircleAndUpdateData(latlng);
        })
        .catch(error => {
            console.error('Error during geocoding:', error);
            alert("Could not find the location for that postcode. Please try again.");
        });
}

function geocodePostcode(postcode) {
    var apiKey = '0fa315c939ca4836b78520deac87bdae'; // Use your actual API key
    var apiURL = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(postcode)}&key=${apiKey}`;
    
    return fetch(apiURL)
        .then(response => response.json())
        .then(data => {
            if (data && data.results && data.results.length > 0) {
                var result = data.results[0];
                return [result.geometry.lat, result.geometry.lng];
            } else {
                throw new Error("Location not found.");
            }
        });
}

function mapClickHandler(e) {
    drawCircleAndUpdateData(e.latlng);
}

// Modify drawCircleAndUpdateData to load all datasets
function drawCircleAndUpdateData(latlng) {
    var radius = document.getElementById('radiusInput').value * 1609.34; // miles to meters
    if (currentCircle) {
        map.removeLayer(currentCircle);
    }
    currentCircle = L.circle(latlng, {
        color: 'blue',
        fillColor: '#f03',
        fillOpacity: 0.1,
        radius: radius
    }).addTo(map);
    map.setView(latlng, 12); // Adjust the zoom level as necessary

    // Clear existing data
    loadedData = [];
    clearMapPoints();

    // Now trigger data loading for all datasets
    loadAllDatasets();
}

// New function to load all datasets
async function loadAllDatasets() {
    const datasets = ['parks', 'whs', 'battlefields', 'monuments', 'Ancient Woodland', 'Local_Nature_Reserves_England', 'National_Nature_Reserves_England', 'listedbuildings'];
    for (const dataset of datasets) {
        await loadDataset(dataset);
    }
    filterPointsWithinCircle(); // Filter points after all datasets are loaded
}

// Modified loadDataset function to work without checkboxes and load immediately
async function loadDataset(datasetName) {
    var datasetUrls = {
        'parks': 'https://raw.githubusercontent.com/TrustImpact/heritagemap/main/parks.csv',
        'whs': 'https://raw.githubusercontent.com/TrustImpact/heritagemap/main/WHS.csv',
        'battlefields': 'https://raw.githubusercontent.com/TrustImpact/heritagemap/main/battlefields.csv',
        'monuments': 'https://raw.githubusercontent.com/TrustImpact/heritagemap/main/monuments.csv',
        'Local_Nature_Reserves_England': 'https://raw.githubusercontent.com/TrustImpact/heritagemap/main/Local_Nature_Reserves_England.csv',
        'National_Nature_Reserves_England': 'https://raw.githubusercontent.com/TrustImpact/heritagemap/main/National_Nature_Reserves_England.csv',
        'Ancient_Woodland_England': 'https://raw.githubusercontent.com/TrustImpact/heritagemap/main/Ancient_Woodland_England.csv',
        'listedbuildings': 'https://raw.githubusercontent.com/TrustImpact/heritagemap/main/listedbuildings'
    };

    var datasetUrl = datasetUrls[datasetName];
    if (datasetUrl) {
        if (datasetName === 'listedbuildings') {
            // If listed buildings have multiple files, you might need to loop through them
            await loadListedBuildingsSequentially();
        } else {
            await loadCSVFile(datasetUrl);
        }
    } else {
        console.error("No URL found for dataset:", datasetName);
    }
}

async function loadListedBuildingsSequentially() {
    const fileBaseName = 'https://raw.githubusercontent.com/TrustImpact/heritagemap/main/listedbuildings';
    for (let i = 1; i <= 12; i++) {
        const fileName = `${fileBaseName}${i}.csv`;
        console.log(`Loading ${fileName}`);
        await loadCSVFile(fileName);
    }
    filterPointsWithinCircle();
}

async function loadCSVFile(fileName) {
    try {
        await new Promise((resolve, reject) => {
            Papa.parse(fileName, {
                download: true,
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: function(results) {
                    loadedData = [...loadedData, ...results.data];
                    resolve();
                },
                error: function(err) {
                    console.error("Error loading data:", err);
                    reject(err);
                }
            });
        });
    } catch (error) {
        console.error(`Failed to load file ${fileName}:`, error);
        alert(`Failed to load file ${fileName}. Please check the URL or try again later.`);
    }
}

function filterPointsWithinCircle() {
    if (!currentCircle) {
        return; // Do not update the UI if there's no circle
    }
    var circleBounds = currentCircle.getBounds();
    var pointsWithinCircle = loadedData.filter(function(data) {
        var pointLatLng = L.latLng(data.Latitude, data.Longitude);
        return circleBounds.contains(pointLatLng);
    });
    addPoints(pointsWithinCircle);
    updateTable(pointsWithinCircle);
    updateSummary(pointsWithinCircle);
}

function addPoints(data) {
    var typeColors = {
        'Monument': '3366ff',
        'Parks & Gardens': '#0033cc',
        'World Heritage Site': '#000099',
        'Battlefield': '#99ccff',
        'Listed Building': '#0000cc',
        'National Nature Reserve': '#ccffcc',
        'Local Nature Reserve': '#66cc66',
        'Ancient Woodland': '#009900'
    };

    allPoints = data.map(function(item) {
        // Normalize the type string to handle common inconsistencies
        var normalizedType = item.Type.trim().replace('Buillding', 'Building');  // Correcting 'Buillding' to 'Building'
        
        var color = typeColors[normalizedType] || 'grey';

        var marker = L.circleMarker([item.Latitude, item.Longitude], {
            color: color,
            fillColor: color,
            fillOpacity: 0.5,
            radius: 5
        }).addTo(map);
        marker.bindPopup("<b>" + item.Name + "</b><br>Type: " + item.Type);
        return marker;
    });
}
function updateTable(filteredData) {
    var tableBody = document.getElementById('pointsTable').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = ''; // Clear existing rows
    filteredData.forEach(function(item) {
        var row = tableBody.insertRow();
        row.insertCell(0).textContent = item.Name;
        row.insertCell(1).textContent = item.Type;
        var linkCell = row.insertCell(2);
        linkCell.innerHTML = `<a href="${item['NHLE link']}" target="_blank">Link</a>`;
    });
}

function updateSummary(filteredData) {
    var summaryList = document.getElementById('summaryList');
    summaryList.innerHTML = ''; // Clear current summary
    var summary = {};
    filteredData.forEach(function(item) {
        summary[item.Type] = (summary[item.Type] || 0) + 1;
    });
    for (var type in summary) {
        var li = document.createElement('li');
        li.textContent = `${type}: ${summary[type]}`;
        summaryList.appendChild(li);
    }
}

function clearMapPoints() {
    allPoints.forEach(function(marker) {
        map.removeLayer(marker);
    });
    allPoints = []; // Clear the allPoints array
}
