dojo.provide("bearpanther.InstagramSearch");

dojo.declare("bearpanther.InstagramSearch", null, {

  client_id: "",
  distance: 5000,

  constructor: function(args){
    // expected args:
    //   client_id: required for calls to instagram's API
    dojo.safeMixin(this, args);
  },

  search_by_loc: function(geopoint) {
    var intsa;

    // instagram endpoints:
    // https://api.instagram.com/v1/media/search
    // https://api.instagram.com/v1/tags/coffee/media/recent
    insta = esri.request({
      "url": "https://api.instagram.com/v1/media/search",
      "callbackParamName": "callback",
      "content": {
        "count": 100, // max seems to be 39...why not 42?
        "distance": 5000, // 5km, which is the max
        "lat": geopoint.y, // 48.8,
        "lng": geopoint.x, // 2.29,
        "client_id": this.client_id
      }
    }, { "usePost": false });
    return insta.then(this.return_photos, this.err);
  },

  search_by_tag: function(tag) {
    var insta, tag_url;

    tag_url = "https://api.instagram.com/v1/tags/" + tag + "/media/recent";
    insta = esri.request({
      "url": tag_url,
      "callbackParamName": "callback",
      "content": {
        "client_id": this.client_id
      }
    });
    return insta.then(this.return_photos, this.insta_err);
  },

  return_photos: function(resp) {
    // console.log("got photos: ", resp);
    // check staus code
    if ( resp.meta.code !== 200 ) {
      console.log("failed to get photos, status code something other than 200: ", resp);
      return null;
    }

    if ( resp.data.length === 0 ) {
      alert("Couldn't find any photos. Plese try again.");
      return null;
    }
    
    return resp;
  },

  err: function(err) {
    console.log("failed to get results from instagram: ", err);
  }

});

