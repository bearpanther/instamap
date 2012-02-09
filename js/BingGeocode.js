dojo.provide("bearpanther.BingGeocode");

dojo.declare("bearpanther.BingGeocode", null, {
  bing_key: "",

  constructor: function(args){
    // expected args:
    //   bing_key: required for calls to bing's geocode API
    dojo.safeMixin(this, args);
  },

  find_location: function(place) {
    var loc, bing_geocoder;

    bing_string = "http://dev.virtualearth.net/REST/v1/Locations?q=" + 
      place.replace(/ /g, '+') + '&key=' + this.bing_key + 
      "&output=json&jsonp=GetLocationCoordinates";

    bing_geocoder = esri.request({
      "url": "http://dev.virtualearth.net/REST/v1/Locations",
      "callbackParamName": "jsonp",
      "content": {
        "q": place,
        "key": this.bing_key,
        "output": "json"
      }
    });
    return bing_geocoder.then(this.return_location, this.err);
  },

  return_location: function(results) {
    var address;

    // make sure we got results
    if ( results.statusCode !== 200 || results.resourceSets[0].resources.length === 0 ) {
      alert("Couldn't find that place. Try again.");
      return null;
    }

    address = results.resourceSets[0].resources[0].geocodePoints[0];
    return { "x": address.coordinates[1], "y": address.coordinates[0] };
  },

  err: function(err) {
    console.log("failed to location from bing: ", err);
  }

});

