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

map.on('load', () => {
  // 1. Load station data (Bluebikes stations JSON)
  d3.json("https://dsc106.com/labs/lab07/data/bluebikes-stations.json")
    .then(stationData => {
      // Adjust the path if your JSON nests stations under a different property.
      let stations = stationData.data.stations;
      console.log("Stations Array:", stations);
      
      // 2. Create an SVG overlay for the station markers
      const svg = d3.select('#map').select('svg');
      
      // Create a circle for each station
      const circles = svg.selectAll('circle')
        .data(stations)
        .enter()
        .append('circle')
        .attr('fill', 'steelblue')
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .attr('opacity', 0.6);
      
      // Helper function: Convert a station's coordinates (using properties "Long" and "Lat")
      function getCoords(station) {
        // Convert string values to numbers using the unary plus (+)
        const point = new mapboxgl.LngLat(+station.Long, +station.Lat);
        const { x, y } = map.project(point);
        return { cx: x, cy: y };
      }
      
      // Function to update circle positions based on current map view
      function updatePositions() {
        circles
          .attr('cx', d => getCoords(d).cx)
          .attr('cy', d => getCoords(d).cy);
      }
      
      // Initial position update and update on map interactions
      updatePositions();
      map.on('move', updatePositions);
      map.on('zoom', updatePositions);
      map.on('resize', updatePositions);
      map.on('moveend', updatePositions);
      
      // 3. Now load the Bluebikes traffic CSV data
      d3.csv("https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv")
        .then(trips => {
          console.log("Traffic trips:", trips);
          
          // 4. Compute departures and arrivals using d3.rollup:
          const departures = d3.rollup(
            trips,
            v => v.length,
            d => d.start_station_id
          );
          const arrivals = d3.rollup(
            trips,
            v => v.length,
            d => d.end_station_id
          );
          
          // 5. Update each station object with traffic info.
          // Note: Adjust the station ID property as needed. Here we assume station.Number matches the CSV IDs.
          stations = stations.map(station => {
            const id = station.Number; 
            station.departures = departures.get(id) ?? 0;
            station.arrivals = arrivals.get(id) ?? 0;
            station.totalTraffic = station.departures + station.arrivals;
            return station;
          });
          console.log("Stations with traffic:", stations);
          
          // 6. Create a square root scale to size the circles by total traffic.
          const radiusScale = d3.scaleSqrt()
            .domain([0, d3.max(stations, d => d.totalTraffic)])
            .range([0, 25]);
          
          // 7. Update the circles with the new radius based on total traffic,
          // and add a tooltip showing detailed traffic numbers.
          circles.data(stations)
            .attr('r', d => radiusScale(d.totalTraffic))
            .each(function(d) {
              // Remove any previous title element if it exists.
              d3.select(this).select('title').remove();
              // Append a title for the browser’s default tooltip.
              d3.select(this)
                .append('title')
                .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
            });
        })
        .catch(error => {
          console.error("Error loading Bluebikes traffic data:", error);
        });
    })
    .catch(error => {
      console.error("Error loading Bluebikes station data:", error);
    });
});