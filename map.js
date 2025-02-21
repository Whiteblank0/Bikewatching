// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1Ijoia2lzc3Nob3QiLCJhIjoiY203ZTlvbW13MGJ2NDJ0\
b2M4N2JrcTJiZyJ9.riOnl6M_9KHCELlB_duQ1A';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18 // Maximum allowed zoom
});

map.on('load', () => {
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
});

map.on('load', () => {
  // 1. Fetch and parse the Bluebikes stations JSON
  const jsonUrl = "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";
  d3.json(jsonUrl)
    .then(jsonData => {
      console.log("Loaded JSON Data:", jsonData);
      
      // Access the stations array; adjust based on the actual JSON structure
      const stations = jsonData.data.stations;
      console.log("Stations Array:", stations);
      
      // 2. Select the SVG element that’s been overlaid on the map
      const svg = d3.select('#map').select('svg');
      
      // 3. Append a circle for each station
      const circles = svg.selectAll('circle')
        .data(stations)
        .enter()
        .append('circle')
        .attr('r', 5)               // Radius of the marker
        .attr('fill', 'steelblue')  // Marker fill color
        .attr('stroke', 'white')    // Marker border color
        .attr('stroke-width', 1)    // Marker border thickness
        .attr('opacity', 0.8);      // Marker opacity
      
      // 4. Helper function: Convert a station's coordinates to pixel values using Mapbox's projection
      function getCoords(station) {
        // Note: property names in the JSON are "Lat" and "Long"
        const point = new mapboxgl.LngLat(+station.Long, +station.Lat);
        const { x, y } = map.project(point);
        return { cx: x, cy: y };
      }
      
      // 5. Function to update circle positions
      function updatePositions() {
        circles
          .attr('cx', d => getCoords(d).cx)
          .attr('cy', d => getCoords(d).cy);
      }
      
      // Update positions initially
      updatePositions();
      
      // 6. Reposition markers when the map moves, zooms, or resizes
      map.on('move', updatePositions);
      map.on('zoom', updatePositions);
      map.on('resize', updatePositions);
      map.on('moveend', updatePositions);
    })
    .catch(error => {
      console.error("Error loading Bluebikes station data:", error);
    });
});