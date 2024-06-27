require([
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/FeatureLayer",
    "esri/widgets/Search",
    "esri/geometry/geometryEngine",
    "esri/tasks/Locator"
], function(Map, MapView, FeatureLayer, Search, geometryEngine, Locator) {

    const map = new Map({
        basemap: "streets-navigation-vector"
    });

    const view = new MapView({
        container: "viewDiv",
        map: map,
        center: [-100.33, 43.69], // Center on the US
        zoom: 4
    });

    const ufoLayer = new FeatureLayer({
        url: "https://services3.arcgis.com/mkSydcWMxTDpK69r/arcgis/rest/services/UFO_Sightings/FeatureServer/0"
    });

    map.add(ufoLayer);

    const locator = new Locator({
        url: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer"
    });

    document.getElementById("searchButton").addEventListener("click", function() {
        const cityName = document.getElementById("cityInput").value;
        if (cityName) {
            locator.addressToLocations({
                address: { "City": cityName },
                maxLocations: 1
            }).then(function(results) {
                if (results.length) {
                    const cityLocation = results[0].location;
                    view.goTo({ center: cityLocation, zoom: 10 });

                    ufoLayer.queryFeatures({
                        geometry: cityLocation,
                        spatialRelationship: "nearby",
                        outFields: ["*"],
                        returnGeometry: true,
                        distance: 50, // Adjust as needed
                        units: "kilometers"
                    }).then(function(response) {
                        const features = response.features;
                        if (features.length) {
                            const nearest = features[0];
                            const distance = geometryEngine.distance(cityLocation, nearest.geometry, "kilometers");
                            view.popup.open({
                                title: `Nearest UFO Sighting`,
                                content: `Location: ${nearest.attributes.Location}<br>
                                          Date: ${nearest.attributes.Date}<br>
                                          Distance: ${distance.toFixed(2)} km (${(distance * 0.621371).toFixed(2)} miles)`,
                                location: nearest.geometry
                            });
                        } else {
                            view.popup.open({
                                title: "No Sightings Found",
                                content: "No UFO sightings found within the specified distance.",
                                location: cityLocation
                            });
                        }
                    });
                } else {
                    alert("City not found.");
                }
            });
        } else {
            alert("Please enter a city name.");
        }
    });

});
