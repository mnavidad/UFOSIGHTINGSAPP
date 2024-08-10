import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Home from "@arcgis/core/widgets/Home";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";
import Point from "@arcgis/core/geometry/Point";
import SpatialReference from "@arcgis/core/geometry/SpatialReference";
import * as webMercatorUtils from "@arcgis/core/geometry/support/webMercatorUtils";
import Graphic from "@arcgis/core/Graphic";
import * as locator from "@arcgis/core/rest/locator";

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
    const description = ufoLayer.graphic.attributes.DESCRIPTIO;
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
 // url: "https://services6.arcgis.com/XC8RCfadrDoUDrun/arcgis/rest/services/EncuentrosDeOvni/FeatureServer/0",
  url:"https://services6.arcgis.com/XC8RCfadrDoUDrun/arcgis/rest/services/EncuentrosDeOvniVer3/FeatureServer",
  outFields: ["*"],
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
        const description = graphic.attributes.DESCRIPTIO;
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
    // First, geocode the city name to get the coordinates
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
            const nearestFeature = findNearestFeature(features, cityPoint);

            if (nearestFeature) {
            //  console.log(`Nearest Feature: City: ${nearestFeature.attributes.CITY}, Distance: ${nearestFeature.distance} km`);

              const nearestPoint = nearestFeature.geometry.type === "point" ? nearestFeature.geometry : nearestFeature.geometry.extent.center;
              const distance = geometryEngine.distance(cityPoint, nearestPoint, "kilometers");

              view.popup.open({
                title: `Nearest UFO Sighting`,
                content: `Location: ${nearestFeature.attributes.CITY}<br>
                          State: ${nearestFeature.attributes.STATE}<br>
                          Summary: ${nearestFeature.attributes.DESCRIPTIO}<br>
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


function findNearestFeature(features, cityPoint) {
  let nearestFeature = null;
  let minDistance = Infinity;

  features.forEach(function(feature, index) {
    const featureGeometry = feature.geometry;

    if (featureGeometry) {
      let distance = 0;
      let featurePoint;

      if (featureGeometry.type === "point") {
        featurePoint = featureGeometry;
      } else {
        featurePoint = featureGeometry.extent.center;
      }

      // Ensure both points are in the same spatial reference
      const cityPointProjected = webMercatorUtils.project(cityPoint, featurePoint.spatialReference);

      distance = geometryEngine.distance(cityPointProjected, featurePoint, "kilometers");

      // Log the distance for each feature
      console.log(`Feature ${index + 1}: City: ${feature.attributes.CITY}, Distance: ${distance} km`);

      if (distance < minDistance) {
        minDistance = distance;
        nearestFeature = feature;
      }
    }
  });

  return nearestFeature;
} 



//-------------------------------------------------------------------------------------- only for testing troubleshoot

// Example: Making a request to an Esri portal endpoint using fetch
/* const portalUrl = 'https://mnavidadnoel.maps.arcgis.com/arcgis/rest/info?f=json&token=' + config.apiKey;

fetch(portalUrl)
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    // Handle the response data
    console.log('Response from portal:', data);
  })
  .catch(error => {
    console.error('Error fetching data from portal:', error);
  }); */

// Example usage: Validate the token saved in localStorage
/*const savedToken = localStorage.getItem('userToken');
if (savedToken) {
  validateToken(savedToken);
} else {
  console.error('No token found in localStorage');
}*/



//----------------------------------------------------------------------------
 /*        const getPlaces = async () => {
  let lastResponse = await findPlacesNearPoint({
    x: cityPoint.x,
    y: cityPoint.y,
    radius: 250,
  //  authentication: ApiKeyManager.fromKey(config.apiKey),
  })

  console.log(JSON.stringify(lastResponse.results, null, 2))

  while (lastResponse.nextPage) {
    try {
      lastResponse = await lastResponse.nextPage()
      console.log(JSON.stringify(lastResponse.results, null, 2))
    } catch {
      break
    }
  }
} */
//getPlaces()
//----------------------------------------------------------------------------------------------- troubleshoot 
     

        // Then, use the Places API to find the nearest UFO sighting
     //   findPlacesNearPoint({
     //     x: cityPoint.x,
     //     y: cityPoint.y,
      //    radius: 100,
      //    authentication: ApiKeyManager.fromKey(config.apiKey),
      //    category:"UFO Sightings",
      //    f: "pjson"
          /* params: {
            apiKey: "",
            categories: "UFO",
            nearPoint: `${cityPoint.x},${cityPoint.y}`,
            distance: 100,
            f: "json"
          } */
     /*   }).then(data => {
          if (data.features.length) {
            const nearestFeature = data.features[0];
            const nearestPoint = new Point({
              x: nearestFeature.geometry.x,
              y: nearestFeature.geometry.y,
              spatialReference: { wkid: 102100, latestWkid: 3857 }
            });

            const distance = geometryEngine.distance(cityPoint, nearestPoint, "kilometers");

            view.popup.open({
              title: `Nearest UFO Sighting`,
              content: `Location: ${nearestFeature.attributes.CITY}<br>
                        State: ${nearestFeature.attributes.STATE}<br>
                        Summary: ${nearestFeature.attributes.DESCRIPTIO}<br>
                        Date: ${new Date(nearestFeature.attributes.DATE_TIME).toDateString()}<br>
                        Distance: ${distance.toFixed(2)} km (${(distance * 0.621371).toFixed(2)} miles)`,
              location: nearestPoint
            });
          } else {
            view.popup.open({
              title: "No Sightings Found",
              content: "No UFO sightings found within the specified distance.",
              location: cityPoint
            });
          }
        }).catch(error => console.error("Error fetching places:", error));
      } else {
        alert("City not found.");
      }
    });
  } else {
    alert("Please enter a city name.");
  } */
//});
