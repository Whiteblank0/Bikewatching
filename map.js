import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

let departuresByMinute = Array.from({ length: 1440 }, () => []);
let arrivalsByMinute = Array.from({ length: 1440 }, () => []);
let stations, radiusScale, circles;

// Global variable to hold the time filter
let timeFilter = -1;

// Select the slider and display elements
const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');

// This scale maps a continuous value [0, 1] to discrete values [0, 0.5, 1]
const stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1Ijoia2lzc3Nob3QiLCJhIjoiY203ZTlvbW13MGJ2NDJ0\
b2M4N2JrcTJiZyJ9.riOnl6M_9KHCELlB_duQ1A';

function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);  // Convert lon/lat to Mapbox LngLat
  const { x, y } = map.project(point);  // Project to pixel coordinates
  return { cx: x, cy: y };  // Return as object for use in SVG attributes
}

function filterByMinute(tripsByMinute, minute) {
  if (minute === -1) {
    return tripsByMinute.flat(); // No filtering, return all trips
  }

  // Normalize both min and max minutes to the valid range [0, 1439]
  let minMinute = (minute - 60 + 1440) % 1440;
  let maxMinute = (minute + 60) % 1440;

  // Handle time filtering across midnight
  if (minMinute > maxMinute) {
    let beforeMidnight = tripsByMinute.slice(minMinute);
    let afterMidnight = tripsByMinute.slice(0, maxMinute);
    return beforeMidnight.concat(afterMidnight).flat();
  } else {
    return tripsByMinute.slice(minMinute, maxMinute).flat();
  }
}

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18 // Maximum allowed zoom
});

map.on('load', async () => {
  let jsonData;
  
  // Boston bike lanes source and layer (from previous steps)
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
  });
  map.addLayer({
    id: 'bike-lanes-boston',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': 'green',
      'line-width': 3,
      'line-opacity': 0.4
    }
  });

  // Cambridge bike lanes source using the provided URL
  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
  });
  // Add a layer for Cambridge bike lanes
  map.addLayer({
    id: 'bike-lanes-cambridge',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': 'green',
      'line-width': 3,
      'line-opacity': 0.4
    }
  });

    try {
        const jsonurl = "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";
        
        // Await JSON fetch
        const jsonData = await d3.json(jsonurl);
        console.log('Loaded JSON Data:', jsonData); // Log to verify structure

        stations = computeStationTraffic(jsonData.data.stations);
        console.log('Stations Array:', stations);

        let trips = await d3.csv(
          'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
          (trip) => {
            trip.started_at = new Date(trip.started_at);
            trip.ended_at = new Date(trip.ended_at);

            // Calculate the minute of the day for both start and end.
            const startMinute = minutesSinceMidnight(trip.started_at);
            const endMinute = minutesSinceMidnight(trip.ended_at);

            // Add the trip to the corresponding buckets.
            departuresByMinute[startMinute].push(trip);
            arrivalsByMinute[endMinute].push(trip);

            return trip;
          },
        );

        // Calculate departures and arrivals
        const departures = d3.rollup(
          trips,
          v => v.length,
          d => d.start_station_id,
        );
        const arrivals = d3.rollup(
          trips,
          v => v.length,
          d => d.end_station_id,
        );

        // Update stations with traffic properties
        stations = stations.map((station) => {
          let id = station.short_name;
          station.arrivals = arrivals.get(id) ?? 0;
          station.departures = departures.get(id) ?? 0;
          station.totalTraffic = station.arrivals + station.departures;
          return station;
        });
        console.log("Updated stations with traffic:", stations);

        // Create a square-root scale for circle radii based on totalTraffic
        radiusScale = d3.scaleSqrt()
          .domain([0, d3.max(stations, d => d.totalTraffic)])
          .range([0, 25]);

        const container = document.getElementById('map');
        const svg = d3.select(container)
          .append('svg')
          .attr('style', 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;');

        // Append circles to the SVG for each station
        circles = svg.selectAll('circle')
          .data(stations, (d) => d.short_name)
          .enter()
          .append('circle')
          .attr('r', d => radiusScale(d.totalTraffic)) // Radius of the circle
          .attr('fill', 'steelblue')  // Circle fill color
          .attr('stroke-width', 1)    // Circle border thickness
          .attr('opacity', 0.8)      // Circle opacity
          .style("--departure-ratio", d => 
            stationFlow(d.departures / d.totalTraffic)) 
          .each(function(d) {
            d3.select(this)
              .append('title')
              .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
        });

        // Function to update circle positions when the map moves/zooms
        function updatePositions() {
          circles
            .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
            .attr('cy', d => getCoords(d).cy); // Set the y-position using projected coordinates
        }

        // Initial position update when map loads
        updatePositions();

        // Reposition markers on map interactions
        map.on('move', updatePositions);     // Update during map movement
        map.on('zoom', updatePositions);     // Update during zooming
        map.on('resize', updatePositions);   // Update on window resize
        map.on('moveend', updatePositions);  // Final adjustment after movement ends

        // Bind the slider’s input event to update the display in real time
        timeSlider.addEventListener('input', updateTimeDisplay);
        updateTimeDisplay();
    } catch (error) {
        console.error('Error loading JSON:', error); // Handle errors
    }
});

// Global helper function to format minutes since midnight to a readable time (e.g., 8:30 AM)
function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);
  return date.toLocaleString('en-US', { timeStyle: 'short' });
}

function computeStationTraffic(stations, timeFilter = -1) {
  // Retrieve filtered trips efficiently
  const departures = d3.rollup(
    filterByMinute(departuresByMinute, timeFilter), // Efficient retrieval
    (v) => v.length,
    (d) => d.start_station_id
  );

  const arrivals = d3.rollup(
    filterByMinute(arrivalsByMinute, timeFilter), // Efficient retrieval
    (v) => v.length,
    (d) => d.end_station_id
  );
  
  // Update each station with arrivals, departures, and total traffic.
  return stations.map((station) => {
    let id = station.short_name;
    station.arrivals = arrivals.get(id) ?? 0;
    station.departures = departures.get(id) ?? 0;
    station.totalTraffic = station.arrivals + station.departures;
    return station;
  });
}

// Returns the number of minutes since midnight for a given Date.
function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// Function to update the time display and update the timeFilter variable
function updateTimeDisplay() {
  timeFilter = Number(timeSlider.value);

  if (timeFilter === -1) {
    selectedTime.textContent = '';        // Clear the formatted time display
    anyTimeLabel.style.display = 'block';   // Show "(any time)"
  } else {
    selectedTime.textContent = formatTime(timeFilter);  // Display formatted time
    anyTimeLabel.style.display = 'none';    // Hide "(any time)"
  }

  // Call updateScatterPlot to reflect the changes on the map
  updateScatterPlot(timeFilter);
}

function updateScatterPlot(timeFilter) {
  // Recompute station traffic based on the filtered trips
  const filteredStations = computeStationTraffic(stations, timeFilter);

  timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);
  
  // Update the scatterplot by adjusting the radius of circles
  circles
    .data(filteredStations, (d) => d.short_name)
    .join('circle') // Ensure the data is bound correctly
    .attr('r', (d) => radiusScale(d.totalTraffic)) // Update circle sizes
    .style('--departure-ratio', (d) =>
      stationFlow(d.departures / d.totalTraffic),
    );
}