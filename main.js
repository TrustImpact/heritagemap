var map;
var currentCircle = null; // Ensure it is defined as null initially at the global level
var allPoints = [];
var loadedData = [];


document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    addEventListeners();
});

function initializeMap() {
    map = L.map('map').setView([53.383331, -1.466667], 6); // Default view
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data © OpenStreetMap contributors'
    }).addTo(map);
}

function addEventListeners() {
    document.getElementById('postcodeSearchButton').addEventListener('click', postcodeSearch);
}

function postcodeSearch() {
    var postcode = document.getElementById('postcodeInput').value.trim();
    if (!postcode) {
        alert('Please enter a valid postcode.');
        return;
    }

    var apiKey = '0fa315c939ca4836b78520deac87bdae';
    var apiURL = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(postcode)}&key=${apiKey}`;

    fetch(apiURL)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log(data);  // Log the data to see what is being returned
            if (data.results && data.results.length > 0) {
                var latLng = [data.results[0].geometry.lat, data.results[0].geometry.lng];
                map.setView(latLng, 13); // Adjust zoom and center map on postcode location
                drawCircleAndUpdateData(latLng);
            } else {
                alert("Could not find the location for that postcode.");
            }
        })
        .catch(error => {
            console.error('Error during geocoding:', error);
            alert('Failed to geocode postcode.');
        });
}

function drawCircleAndUpdateData(latlng) {
    var radius = document.getElementById('radiusInput').value * 1609.34; // miles to meters

    // Check and remove the existing circle if it exists
    if (currentCircle) {
        map.removeLayer(currentCircle);
    }

    // Add a new circle to the map
    currentCircle = L.circle(latlng, {
        color: 'blue',
        fillColor: '#f03',
        fillOpacity: 0.1,
        radius: radius
    }).addTo(map);

    // Assuming you want to filter or load data based on this circle
    filterDataBasedOnLocation(latlng, radius);
}

function filterDataBasedOnLocation(center, radius) {
    // Clear any previously loaded data
    loadedData = [];
    allPoints.forEach(point => map.removeLayer(point));
    allPoints = [];

    // Implement fetching and filtering data for the given radius and center
    fetchAndDisplayData(center, radius);
}

function fetchAndDisplayData(center, radius) {
    // This URL is just a placeholder. Replace it with your actual data fetching URL.
    const url = `https://api.yourdataendpoint.com/data?lat=${center[0]}&lng=${center[1]}&radius=${radius}`;

    fetch(url)
        .then(response => {
            if (!response.ok) { // Check if the response was successful.
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) { // Check if the API returned an error in data.
                throw new Error('API Error: ' + data.error);
            }
            displayDataOnMap(data);
            updateTable(data);
            updateSummary(data);
        })
        .catch(error => {
            console.error('Error loading data:', error);
            alert('Failed to load data: ' + error.message);
        });
}

function displayDataOnMap(data) {
    data.forEach(item => {
        var marker = L.circleMarker([item.latitude, item.longitude], {
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.5,
            radius: 5
        }).bindPopup(item.name).addTo(map);
        allPoints.push(marker);
    });
}

function updateTable(data) {
    var tableBody = document.getElementById('pointsTable').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = ''; // Clear existing rows
    data.forEach(item => {
        var row = tableBody.insertRow();
        row.insertCell(0).textContent = item.name;
        row.insertCell(1).textContent = item.type;
        var linkCell = row.insertCell(2);
        linkCell.innerHTML = `<a href="${item.link}" target="_blank">Link</a>`;
    });
}

function updateSummary(data) {
    var summaryList = document.getElementById('summaryList');
    summaryList.innerHTML = ''; // Clear current summary
    var summary = data.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
    }, {});

    for (var type in summary) {
        var li = document.createElement('li');
        li.textContent = `${type}: ${summary[type]}`;
        summaryList.appendChild(li);
    }
}
