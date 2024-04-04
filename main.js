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
    var checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(function(checkbox) {
        checkbox.addEventListener('change', function(event) {
            var datasetName = event.target.id.substring(4).toLowerCase();
            loadDataset(datasetName, event.target.checked);
        });
    });

    document.getElementById('postcodeSearchButton').addEventListener('click', postcodeSearch);
    map.on('click', mapClickHandler);
}

async function loadListedBuildingsSequentially() {
    const fileBaseName = 'https://raw.githubusercontent.com/TrustImpact/heritagemap/main/listedbuildings';
    for (let i = 1; i <= 6; i++) {
        const fileName = `${fileBaseName}${i}.csv`;
        console.log(`Loading ${fileName}`);
        await loadCSVFile(fileName);
    }
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
                    addPoints(results.data);
                    //updateTable(loadedData);
                    //updateSummary(loadedData);
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

function loadDataset(dataset, isChecked) {
    // Define a map of dataset names to their URLs
    var datasetUrls = {
        'parks': 'https://raw.githubusercontent.com/TrustImpact/heritagemap/main/parks.csv',
        'whs': 'https://raw.githubusercontent.com/TrustImpact/heritagemap/main/WHS.csv',
        'battlefields': 'https://raw.githubusercontent.com/TrustImpact/heritagemap/main/battlefields.csv',
        // Note: The listed buildings dataset URL is handled separately
        'monuments': 'https://raw.githubusercontent.com/TrustImpact/heritagemap/main/monuments.csv'
    };

    if (isChecked) {
        if (dataset === 'listedbuildings') {
            // Sequential loading for listed buildings
            loadListedBuildingsSequentially();
        } else {
            // Use the dataset parameter to get the correct URL for other datasets
            var datasetUrl = datasetUrls[dataset];
            if (datasetUrl) {
                // Load other datasets as before
                loadCSVFile(datasetUrl);
            } else {
                console.error("No URL found for dataset:", dataset);
                alert(`No URL is configured for the dataset ${dataset}.`);
            }
        }
    } else {
        // If unchecked, remove those points from the map and loadedData
        loadedData = loadedData.filter(function(data) {
            return data.Type.toLowerCase() !== dataset;
        });
        // Refresh the map markers, table, and summary to reflect the changes
        updateMap();
       //updateTable(loadedData);
        //updateSummary(loadedData);
    }
}

function postcodeSearch() {
    var postcode = document.getElementById('postcodeInput').value;
    var apiKey = '0fa315c939ca4836b78520deac87bdae';
    var apiURL = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(postcode)}&key=${apiKey}`;

    fetch(apiURL)
        .then(response => response.json())
        .then(data => {
            if (data && data.results && data.results.length > 0) {
                var latlng = [data.results[0].geometry.lat, data.results[0].geometry.lng];
                drawCircleAndUpdateData(latlng);
            } else {
                alert("Could not find the location for that postcode.");
            }
        })
        .catch(error => {
            console.error('Error during geocoding:', error);
            alert('Failed to geocode postcode.');
        });
}

function mapClickHandler(e) {
    drawCircleAndUpdateData(e.latlng);
}

function addPoints(data) {
    // Example color scheme based on 'Type'
    var typeColors = {
        'Monument': 'gold',
        'Parks & Gardens': 'green',
        'World Heritage Site': 'blue',
        'Battlefield': 'orange',
        'Listed Buillding': 'yellow'
        // Add more types and colors as needed
    };

    data.forEach(function(item) {
        var latitude = item.Latitude;
        var longitude = item.Longitude;
        var latLng = L.latLng(latitude, longitude);

        // Default color if type is not found in the mapping
        var color = typeColors[item.Type] || 'grey';

        var marker = L.circleMarker(latLng, {
            color: color,
            fillColor: color,
            fillOpacity: 0.5,
            radius: 5
        }).addTo(map);
        marker.bindPopup(item.Name);
        allPoints.push(marker);
    });
}

function drawCircleAndUpdateData(latlng) {
    var radius = document.getElementById('radiusInput').value * 1609.34; // miles to meters

    if (currentCircle) {
        map.removeLayer(currentCircle);
    }

    currentCircle = L.circle(latlng, {
        radius: radius,
        color: 'blue',
        fillColor: '#f03',
        fillOpacity: 0.1
    }).addTo(map);

    map.setView(latlng, 9); // Adjust zoom level as necessary
    filterPointsWithinCircle(); // This now properly filters and updates UI only if a circle is drawn
}

function filterPointsWithinCircle() {
    if (!currentCircle) {
        return; // Do not update the UI if there's no circle
    }
    var pointsWithinCircle = loadedData.filter(function(data) {
        var pointLatLng = L.latLng(data.Latitude, data.Longitude);
        return currentCircle.getLatLng().distanceTo(pointLatLng) <= currentCircle.getRadius();
    });
    updateTable(pointsWithinCircle);
    updateSummary(pointsWithinCircle);
}

function updateMap() {
    allPoints.forEach(function(marker) {
        map.removeLayer(marker);
    });
    addPoints(loadedData);
}

function updateTable(filteredData) {
    var tableBody = document.getElementById('pointsTable').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = ''; // Clear existing rows
    filteredData.forEach(function(item) {
        var row = tableBody.insertRow();
        row.insertCell(0).textContent = item.Name;
        row.insertCell(1).textContent = item.Type;
        var linkCell = row.insertCell(2);
        linkCell.innerHTML = item['NHLE link'] ? `<a href="${item['NHLE link']}" target="_blank">Link</a>` : 'No Link';
    });
}

function updateSummary(filteredData) {
    var summary = filteredData.reduce(function(acc, item) {
        acc[item.Type] = (acc[item.Type] || 0) + 1;
        return acc;
    }, {});
    var summaryList = document.getElementById('summaryList');
    summaryList.innerHTML = ''; // Clear current summary
    for (var type in summary) {
        var li = document.createElement('li');
        li.textContent = `${type}: ${summary[type]}`;
        summaryList.appendChild(li);
    }
}

function loadInitialData() {
    // Load any initial datasets here
}
