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
  "esri/Graphic"
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
      view: view
  });

  view.ui.add(homeWidget, "top-left");

  const popupTemplate = {
      title: "UFO Sighting",
      outFields: ["SUMMARY", "STATE", "CITY", "DESCRIPTION", "DATE_TIME"],
      content: function(ufoLayer) {
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
      outFields: ["SUMMARY", "STATE", "CITY", "DESCRIPTION", "DATE_TIME"],
      popupTemplate: popupTemplate // Attach the popup template to the layer
  });

  map.add(ufoLayer);

  view.on("click", function(event) {
      const screenPoint = {
          x: event.x,
          y: event.y
      };

      view.hitTest(screenPoint).then(function(response) {
          const results = response.results;

          const filteredResults = results.filter(function(result) {
              return result.graphic.layer === ufoLayer;
          });

          if (filteredResults.length) {
              let graphic = new Graphic();

              graphic = filteredResults[0].graphic;

              if (graphic) {
                  const summary = graphic.attributes.SUMMARY;
                  const state = graphic.attributes.STATE;
                  const city = graphic.attributes.CITY || "";
                  const description = graphic.attributes.DESCRIPTION;
                  const dateTime = graphic.attributes.DATE_TIME;

                  const popupContent = `
                      <div>
                          <h3>Summary: ${summary}</h3>
                          <h3>State: ${state}</h3>
                          <h3>City: ${city}</h3>
                          <h3>Description: ${description}</h3>
                          <h3>Date: ${new Date(dateTime).toDateString()}</h3>
                      </div>
                  `;

                  view.popup.open({
                      title: "UFO Sighting",
                      location: event.mapPoint,
                      content: popupContent
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
                      spatialReference: { wkid: 102100, latestWkid: 3857 }
                  });

                  view.goTo({ center: [cityPoint.x, cityPoint.y], zoom: 10 });

                  const query = ufoLayer.createQuery();
                  query.returnGeometry = true;
                  query.outFields = ["*"];

                  ufoLayer.queryFeatures(query).then(function(response) {
                      const features = response.features;

                      if (features.length) {
                          let nearestFeature = null;
                          let minDistance = Infinity;

                          features.forEach(function(feature) {
                              const featureGeometry = feature.geometry;

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
                              const distance = geometryEngine.distance(cityPoint, nearestPoint, "kilometers");

                              view.popup.open({
                                  title: `Nearest UFO Sighting`,
                                  content: `Location: ${nearestFeature.attributes.CITY}<br>
                                            State: ${nearestFeature.attributes.STATE}<br>
                                            Summary: ${nearestFeature.attributes.DESCRIPTION}<br>
                                            Date: ${new Date(nearestFeature.attributes.DATE_TIME).toDateString()}<br>
                                            Distance: ${distance.toFixed(2)} km (${(distance * 0.621371).toFixed(2)} miles)`,
                                  location: nearestFeature.geometry
                              });
                          } else {
                              view.popup.open({
                                  title: "No Sightings Found",
                                  content: "No UFO sightings found within the specified distance.",
                                  location: cityPoint
                              });
                          }
                      } else {
                          view.popup.open({
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
