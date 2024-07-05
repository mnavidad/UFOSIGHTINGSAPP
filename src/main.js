require([
    "esri/Map",
    "esri/views/MapView",
    "esri/widgets/Home",
    "esri/layers/FeatureLayer",
    "esri/geometry/geometryEngine",
    "esri/rest/locator",
    "esri/geometry/Point",
    "esri/geometry/SpatialReference",
    "esri/geometry/support/webMercatorUtils",
  //  "esri/PopupTemplate",
    "esri/Graphic"
  //  "esri/widgets/Popup",
 

], function(Map, MapView, Home, FeatureLayer, geometryEngine, locator, Point, SpatialReference, webMercatorUtils, Graphic) {

    const map = new Map({
        basemap: "streets-navigation-vector"
    });

    const view = new MapView({
        container: "viewDiv",
        map: map,
        center: [-100.33, 43.69], // Center on the US
        zoom: 4
    });

    const homeWidget = new Home({
      view:view
    })

    view.ui.add(homeWidget,"top-left");

     const popupTemplate = {
      title: "UFO Sighting",
      outFields: ["SUMMARY","STATE", "CITY", "DESCRIPTION", "DATE_TIME"],
      content: function (ufoLayer) {
          const summary = ufoLayer.graphic.attributes.SUMMARY;
          const state = ufoLayer.graphic.attributes.STATE;
          const city = ufoLayer.graphic.attributes.CITY || ""; // Handle missing CITY attribute
          const description = ufoLayer.graphic.attributes.DESCRIPTION;
          const dateTime = ufoLayer.graphic.attributes.DATE_TIME;
              
          return `
              <div>
                <h3>Summary: ${summary}</h3>
                <h3>State: ${state}</h3>
                ${city ? `<h3>City: ${city}</h3>` : ''}
                <h3>Description: ${description}</h3>
                <h3>Date: ${new Date(dateTime).toDateString()}</h3>
              </div>
          `;
      }
  }; 

  
      

    const ufoLayer = new FeatureLayer({
        url: "https://services3.arcgis.com/Fq07Av2pa1e9WKEK/arcgis/rest/services/Encuentros_de_ovni/FeatureServer/0",
       // url: "https://services1.arcgis.com/UWYHeuuJISiGmgXx/arcgis/rest/services/PrivateSchool/FeatureServer/0",
      //  url: "https://egisdata.baltimorecity.gov/egis/rest/services/CityView/Museum/MapServer/0",
        outFields:["SUMMARY","STATE", "CITY", "DESCRIPTION", "DATE_TIME"],
       // outFields:["OBJECTID", "NAME", "ADDRESS"],
        popupTemplate: popupTemplate // Attach the popup template to the layer
    });

    map.add(ufoLayer);
    // Add event listener for click events on the map view
    view.on("click", function(event) {
        // Get the screen point where the user clicked
        const screenPoint = {
          x: event.x,
          y: event.y
        };
      
        // Search for features at the clicked location
        view.hitTest(screenPoint).then(function(response) {
          const results = response.results;
      
          // Check if a feature was clicked and filter results for the specific layer
          const filteredResults = results.filter(function(result) {
            return result.graphic.layer === ufoLayer;
          });
      
          if (filteredResults.length) {
            let graphic = new Graphic();

            graphic = filteredResults[0].graphic; // Use 'const' instead of 'let'
      
            // Check if the graphic object is not null
            if (graphic) {
              // Access attributes (city, description, date_time) from the graphic
              const summary = graphic.attributes.SUMMARY;
              const state = graphic.attributes.STATE;
              const city = graphic.attributes.CITY || ""; // Handle missing CITY attribute
              const description = graphic.attributes.DESCRIPTION;
              const dateTime = graphic.attributes.DATE_TIME;
      
            //  const dateObj = new Date(dateTime);
             // const formattedDate = `${String(dateObj.getMonth() + 1).padStart(2, '0')}${String(dateObj.getDate()).padStart(2, '0')}${dateObj.getFullYear()}`;
            //  {new Date(nearestFeature.attributes.DATE_TIME).toDateString()
              // Construct popup content
               let popupContent = `
                <div>
                <h3>Summary: ${summary}</h3>
                <h3>State: ${state}</h3>
                  <h3>City: ${city}</h3>
                  <h3>Description: ${description}</h3>
                  <h3>Date: ${new Date(dateTime).toDateString()}</h3>
                </div>
              `; 
      
              // Open the popup at the location of the clicked feature
              return view.openPopup({
                title: "You clicked here",
                features: [graphic],
                content: popupContent, // Set the popup content
                location: event.mapPoint,
                
              });
            } else {
              console.error("Graphic object is null.");
            }
          } else {
            console.error("No features found for the specified layer.");
          }
        }).catch(function(error) {
          console.error("Error during hitTest:", error);
        });
      });
      
    const locatorUrl = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";

    document.getElementById("searchButton").addEventListener("click", function() {
        const cityName = document.getElementById("cityInput").value;
        if (cityName) {
            locator.addressToLocations(locatorUrl, {
                address: { "SingleLine": cityName },
                maxLocations: 1
            }).then(function(results) {
                if (results.length) {
                    const cityLocation = results[0].location;
                    const cityPoint = new Point({
                        x: cityLocation.x,
                        y: cityLocation.y,
                        spatialReference: {wkid: 102100, latestWkid: 3857}

                    });

                    view.goTo({ center: [cityPoint.x, cityPoint.y], zoom: 10 });

                    const query = ufoLayer.createQuery();
                    query.returnGeometry = true;
                    query.outFields = ["*"];

                    ufoLayer.queryFeatures(query).then(function(response) {
                        const features = response.features;

                        if (features.length) {
                            let nearestFeature = null;
                            let minDistance = 100000;

                            features.forEach(function(feature) {
                                const featureGeometry = feature.geometry;

                                // Check if the feature's geometry is not null
                                if (featureGeometry) {
                                    let distance = 0;
                                    let featurePoint;

                                    if (featureGeometry.type === "point") {
                                        featurePoint = featureGeometry;
                                    } else {
                                        featurePoint = featureGeometry.extent.center;
                                    }

                                    if (featurePoint.spatialReference.isWebMercator) {
                                        distance = geometryEngine.distance(new Point({
                                            x: cityLocation.x,
                                            y: cityLocation.y,
                                            spatialReference: SpatialReference.WebMercator
                                        }), featurePoint, "kilometers");
                                    } else {
                                        const projectedCityPoint = webMercatorUtils.project(cityPoint, featurePoint.spatialReference);
                                        distance = geometryEngine.distance(projectedCityPoint, featurePoint, "kilometers");
                                    }

                                    if (distance < minDistance) {
                                        minDistance = distance;
                                        nearestFeature = feature;
                                    }
                                }
                            });

                            if (nearestFeature) {
                                const nearestPoint = nearestFeature.geometry.type === "point" ? nearestFeature.geometry : nearestFeature.geometry.extent.center;
                                const distance = geometryEngine.distance(
                                    cityPoint,
                                    nearestPoint,
                                    "kilometers"
                                );

                                 view.openPopup({
                                    title: `Nearest UFO Sighting`,
                                    content: `Location: ${nearestFeature.attributes.CITY}<br>
                                              State: ${nearestFeature.attributes.STATE}<br>
                                              Summary: ${nearestFeature.attributes.DESCRIPTION}<br>
                                              Date: ${new Date(nearestFeature.attributes.DATE_TIME).toDateString()}<br>
                                              Distance: ${distance.toFixed(2)} km (${(distance * 0.621371).toFixed(2)} miles)`,
                                    location: nearestFeature.geometry
                                }); 
                                view.openPopup({
                                    title: `Nearest UFO Sighting`,
                                    content: `Location: ${nearestFeature.attributes.CITY}<br>
                                              State: ${nearestFeature.attributes.STATE}<br>
                                              
                                             
                                              Distance: ${distance.toFixed(2)} km (${(distance * 0.621371).toFixed(2)} miles)`,
                                    location: nearestFeature.geometry
                                });
                            } else {
                                view.openPopup({
                                    title: "No Sightings Found",
                                    content: "No UFO sightings found within the specified distance.",
                                    location: cityPoint
                                });
                            }
                        } else {
                            view.openPopup({
                                title: "No Sightings Found",
                                content: "No UFO sightings found within the specified distance.",
                                location: cityPoint
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
