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
      
      // 4. Helper function: Convert a station's coordinates to pixel values 
      // using Mapbox's projection
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
    
      // --- Step 4.1: Load the Traffic CSV Data ---
      d3.csv("https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv")
        .then(trips => {
          console.log("Traffic trips loaded:", trips);
        
          // --- Step 4.2: Calculate Traffic at Each Station ---
          // Calculate departures: count trips keyed by start_station_id
          const departures = d3.rollup(
            trips,
            v => v.length,
            d => d.start_station_id
          );
        
          // Calculate arrivals: count trips keyed by end_station_id
          const arrivals = d3.rollup(
            trips,
            v => v.length,
            d => d.end_station_id
          );
          
          // Update each station object with departures, arrivals, and totalTraffic.
          // NOTE: Adjust the station identifier property as needed.
          // Here we assume the station's ID is stored in station.short_name.
          stations = stations.map(station => {
            let id = station.short_name;  // Or station.Number if that holds the ID.
            station.departures = departures.get(id) ?? 0;
            station.arrivals = arrivals.get(id) ?? 0;
            station.totalTraffic = station.departures + station.arrivals;
            return station;
          });
          console.log("Stations with traffic:", stations);
          
          // --- Step 4.3: Size Markers According to Traffic ---
          // Create a square root scale to map totalTraffic to circle radii.
          const radiusScale = d3.scaleSqrt()
            .domain([0, d3.max(stations, d => d.totalTraffic)])
            .range([0, 25]);
          
          // Bind the updated station data to the circles and set their radius.
          circles.data(stations)
            .attr('r', d => radiusScale(d.totalTraffic))
            // --- Step 4.4: Add Tooltip for Detailed Traffic Numbers ---
            .each(function(d) {
              // Remove any previous <title> element to avoid duplicates.
              d3.select(this).select('title').remove();
              // Append a <title> element for browser-default tooltips.
              d3.select(this)
                .append('title')
                .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
            });
        })
        .catch(error => {
          console.error("Error loading traffic CSV:", error);
        });
      })
      .catch(error => {
        console.error("Error loading station JSON:", error);
      });
});