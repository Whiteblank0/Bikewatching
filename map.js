import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1Ijoia2lzc3Nob3QiLCJhIjoiY203ZTlvbW13MGJ2NDJ0\
b2M4N2JrcTJiZyJ9.riOnl6M_9KHCELlB_duQ1A';

function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);  // Convert lon/lat to Mapbox LngLat
  const { x, y } = map.project(point);  // Project to pixel coordinates
  return { cx: x, cy: y };  // Return as object for use in SVG attributes
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

  let jsonData;
    try {
        const jsonurl = "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";
        
        // Await JSON fetch
        const jsonData = await d3.json(jsonurl);
        console.log('Loaded JSON Data:', jsonData); // Log to verify structure

        let stations = jsonData.data.stations;
        console.log('Stations Array:', stations);

        // Load the Bluebikes traffic data CSV
        const trips = await d3.csv("https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv");

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
        const radiusScale = d3.scaleSqrt()
          .domain([0, d3.max(stations, d => d.totalTraffic)])
          .range([0, 25]);

        const container = document.getElementById('map');
        const svg = d3.select(container)
          .append('svg')
          .attr('style', 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;');

        // Append circles to the SVG for each station
        const circles = svg.selectAll('circle')
          .data(stations)
          .enter()
          .append('circle')
          .attr('r', d => radiusScale(d.totalTraffic)) // Radius of the circle
          .attr('fill', 'steelblue')  // Circle fill color
          .attr('stroke-width', 1)    // Circle border thickness
          .attr('opacity', 0.8)      // Circle opacity
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
    } catch (error) {
        console.error('Error loading JSON:', error); // Handle errors
    }
});