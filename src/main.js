import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Home from "@arcgis/core/widgets/Home";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import geometryEngine from "@arcgis/core/geometry/geometryEngine";
import Point from "@arcgis/core/geometry/Point";
import SpatialReference from "@arcgis/core/geometry/SpatialReference";
import webMercatorUtils from "@arcgis/core/geometry/support/webMercatorUtils";
import Graphic from "@arcgis/core/Graphic";
import ApiKeyManager from "@arcgis/core/identity/ApiKeyManager";
import * as locator from "@arcgis/core/rest/locator";
import * as places from "@esri/arcgis-rest-places";

esriConfig.apiKey = "AAPTxy8BH1VEsoebNVZXo8HurImB1sruDfMzCMwl2OWiOOIetyJi87lNGHybZBeDNkGsTGBVgj5_g3Si3qefOmMuLqhKSK_13oNZ3-swGDYNhTEEz2o2NXHSf8bSFzinslolWCwIVaPSAu37v4xTQNifJ9yGRIM-1pQoVnZxXtXLZdww9kC-F_eVd8fRHCHT8ooffWc2gySX01njOJpIoUDHZ-3T9B30W-I3NiYBzX4f5trpYKLtXrcGrvP54kgQ24W-AT1_jO9SFswd";
ApiKeyManager.register("AAPTxy8BH1VEsoebNVZXo8HurImB1sruDfMzCMwl2OWiOOIetyJi87lNGHybZBeDNkGsTGBVgj5_g3Si3qefOmMuLqhKSK_13oNZ3-swGDYNhTEEz2o2NXHSf8bSFzinslolWCwIVaPSAu37v4xTQNifJ9yGRIM-1pQoVnZxXtXLZdww9kC-F_eVd8fRHCHT8ooffWc2gySX01njOJpIoUDHZ-3T9B30W-I3NiYBzX4f5trpYKLtXrcGrvP54kgQ24W-AT1_jO9SFswd");

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
  url: "https://services6.arcgis.com/XC8RCfadrDoUDrun/arcgis/rest/services/EncuentrosDeOvni/FeatureServer/0",
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
const placesUrl = "https://places-api.arcgis.com/arcgis/rest/services/places-service/v1/places/near-point";

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

        // Then, use the Places API to find the nearest UFO sighting
        places.nearby({
          params: {
            apiKey: "AAPTxy8BH1VEsoebNVZXo8HurImB1sruDfMzCMwl2OWiOOIetyJi87lNGHybZBeDNkGsTGBVgj5_g3Si3qefOmMuLqhKSK_13oNZ3-swGDYNhTEEz2o2NXHSf8bSFzinslolWCwIVaPSAu37v4xTQNifJ9yGRIM-1pQoVnZxXtXLZdww9kC-F_eVd8fRHCHT8ooffWc2gySX01njOJpIoUDHZ-3T9B30W-I3NiYBzX4f5trpYKLtXrcGrvP54kgQ24W-AT1_jO9SFswd",
            categories: "UFO",
            nearPoint: `${cityPoint.x},${cityPoint.y}`,
            distance: 100,
            f: "json"
          }
        }).then(data => {
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
  }
});
