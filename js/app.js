dojo.require("dijit.layout.BorderContainer");
dojo.require("dijit.layout.ContentPane");
dojo.require("dojox.layout.ScrollPane");
dojo.require("esri.map");
// dojo.require("esri.layers.osm");
dojo.require("esri.dijit.Popup");
dojo.require("bearpanther.InstagramSearch");
dojo.require("bearpanther.BingGeocode");

// one global to manage different pieces of the app
var app;

app = {
  init: function() {
    var ext, popup;

    // this is done so that layout dijits 
    // don't move around while the page loads
    dojo.style(dojo.byId("main-window"), "visibility", "visible");

    app.photo_markup = [];
    app.feedback_text = dojo.byId("feedback").innerHTML;

    app.configure_searches();

    ext = new esri.geometry.Extent({"xmin":-13689379,"ymin":3522705,"xmax":-12136178,"ymax":4367793,"spatialReference":{"wkid":102100}});
    popup = new esri.dijit.Popup(null, dojo.create("div"));
    app.map = new esri.Map("map", {
      "extent": ext,
      "infoWindow": popup,
      "logo": false,
      "slider": false,
      "wrapAround180": true
    });

    app.add_layers();
    dojo.connect(app.map, "onLoad", app.handle_map_load);
  },

  configure_searches: function() {
    var loc, tag;

    loc = dojo.byId("loc-name");
    tag = dojo.byId("tag-name");

    // give the location search box focus
    loc.focus();
    dojo.connect(loc, "onkeyup", app.show_feedback);
    dojo.connect(tag, "onkeyup", app.show_feedback);
    // prevent form submission and search for photos
    dojo.connect(dojo.byId("loc-search"), "onsubmit", function(e) {
      e.preventDefault();
      app.show_loading_icon();
      app.bing_geocode();
    });
    // search for photos by tag 
    dojo.connect(dojo.byId("tag-search"), "onsubmit", function(e) {
      e.preventDefault();
      app.show_loading_icon();
      app.photos_by_tag();
    });
  },

  add_layers: function() {
    var gray_base_url, gray_ref_url, streets_url, sat_url, sat_trans_url;

    app.basemaps = [];
    // base_url = "http://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer";
    gray_base_url = "http://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer";
    gray_ref_url = "http://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer";
    streets_url = "http://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer";
    sat_url = "http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer";
    sat_trans_url = "http://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer"

    app.basemaps.push(new esri.layers.ArcGISTiledMapServiceLayer(gray_base_url, { "id": "Gray_base" }));
    app.basemaps.push(new esri.layers.ArcGISTiledMapServiceLayer(gray_ref_url, { "id": "Gray_ref" }));
    app.basemaps.push(new esri.layers.ArcGISTiledMapServiceLayer(streets_url, { "id": "Streets", "visible": false }));
    // app.basemaps.push(new esri.layers.OpenStreetMapLayer({ "id": "Streets", "visible": false }));
    app.basemaps.push(new esri.layers.ArcGISTiledMapServiceLayer(sat_url, { "id": "Satellite", "visible": false }));
    app.basemaps.push(new esri.layers.ArcGISTiledMapServiceLayer(sat_trans_url, { "id": "Satellite_trans", "visible": false }));
    dojo.forEach(app.basemaps, function(bm) { 
      app.map.addLayer(bm); 
    });

    // graphics layer for instagram photo points
    app.grams = new esri.layers.GraphicsLayer({ "id": "grams" });
    app.map.addLayer(app.grams);

    // set up basemap switching...event delegation
    dojo.connect(dojo.byId("basemaps_wrapper"), "onclick", app.switch_basemap);
  },

  handle_map_load: function() {
    dojo.connect(dijit.byId("map"), "resize", app.map, app.map.resize);

    // hide the popup when the esc is pressed
    dojo.connect(app.map, "onKeyDown", app.esc_closes_popup);

    // create the instagram search widget
    app.searcher = new bearpanther.InstagramSearch({
      "client_id": "99d01e13455d43c7ab60bc49810ba251"
    });

    // create the bing geocode widget
    app.binger = new bearpanther.BingGeocode({
      "bing_key": "AsmIUbsW6q6Sa3drunnA2L3Wgvcg2Xo8Xy3JTuNaGv9SQONqBzqFpNs0QBCkRJMR"
    });
    // search for photos by location on map click
    dojo.connect(app.map, "onClick", app.photos_by_loc);
  },

  photos_by_loc: function(e) {
    var geopoint, photos;

    // e can be from a map click or the result from 
    // the bing geocoder
    // convert to lat, long if the point is from the map
    if ( e.hasOwnProperty("mapPoint") ) {
      geopoint = esri.geometry.webMercatorToGeographic(e.mapPoint);
    } else {
      geopoint = new esri.geometry.Point(
        e.x, e.y, new esri.SpatialReference({ "wkid": 4326 })
      );
    }

    app.show_loading_icon();

    photos = app.searcher.search_by_loc(geopoint);
    photos.then(app.process_photos);
  },

  photos_by_tag: function() {
    var tag, photos;

    app.show_loading_icon();

    tag = dojo.byId("tag-name").value.split(" ")[0];
    if ( tag ) {
      photos = app.searcher.search_by_tag(tag);
      photos.then(app.process_photos);
    } else {
      alert("Please enter a tag to search.");
      return;
    }
  },

  bing_geocode: function() {
    var place, geocoder;

    place = dojo.byId("loc-name").value;

    if ( place.length === 0 ) {
      alert("Please enter a place name or address.");
      return;
    }

    geocoder = app.binger.find_location(place);
    geocoder.then(app.photos_by_loc, app.err);
  },

  process_photos: function (resp) {
    if ( ! resp ) {
      // hide the loading icon
      dojo.style(dojo.byId("feedback"), "visibility", "hidden");
      dojo.byId("feedback").innerHTML = app.feedback_text;
      dojo.byId("count").innerHTML = "";
      app.grams.clear();
      app.rebuild_footer();
      return;
    }

    // clear previous photo graphics
    app.clear_map();

    // generate html and add a point for each photo with a location
    dojo.byId("count").innerHTML = "Found " + resp.data.length + " photos.";
    app.photo_markup = [];
    dojo.forEach(resp.data, app.show_point);

    // zoom to photos 
    app.map.setExtent(esri.graphicsExtent(app.grams.graphics), true);

    // show photos in the footer
    app.add_scroller(resp);
  },

  add_scroller: function(resp) {
    var insta_width, insta_content, content_pane_node, content_pane;

    // clear out the footer
    dijit.byId("footer").destroy();

    // create a div with photos
    insta_width = resp.data.length * 220;
    insta_content = dojo.create("div", {
      "id": "insta_content",
      "style": "width: " + insta_width + "px; height: 230px;"
    });
    dojo.connect(insta_content, "onclick", app.show_popup_from_photo_id);
    
    // add the photos
    dojo.forEach(app.photo_markup, function(p) {
      dojo.place(p, insta_content);
    });
    // create a new div for a content pane
    content_pane_node = dojo.create("div", { "id": "footer" });
    content_pane = new dijit.layout.ContentPane({
        "content": "",
        "region": "bottom",
				"style": "height: 240px; overflow-x: scroll; padding: 0;"
	  }, content_pane_node);
    // insert markup for the photos into the content pane
    dojo.place(insta_content, content_pane_node);
    // add the content pane to the page
    dijit.byId("main-window").addChild(content_pane);

    app.hide_loading_icon();
  },

  show_point: function(photo) {
    // generate markup for each photo to put in the footer
    app.photo_markup.push(app.generate_markup(photo));

    // ignore photos when location is null
    if ( ! photo.location ) {
      return;
    }

    // when searching by tag, some photos returned have a 
    // location property but not lat/long, only and id
    // skip those
    if ( ! photo.location.hasOwnProperty("latitude") || 
         ! photo.location.hasOwnProperty("longitude") ) {
      return;
    }

    // add a graphic for each photo with a location
    app.grams.add(
      // graphic takes 4 args: geometry, symbol, attributes, info template
      new esri.Graphic(
        esri.geometry.geographicToWebMercator(
          new esri.geometry.Point(
            photo.location.longitude,
            photo.location.latitude,
            new esri.SpatialReference({ "wkid": 4326 })
          )
        ),
        new esri.symbol.PictureMarkerSymbol({
         "url":"images/instagram-20px.png",
         "height": 20,
         "width": 31,
         "type": "esriPMS"
        }),
        photo,
        new esri.InfoTemplate("instagram", app.display_photo) 
      )
    );
  },

  show_feedback: function(e) {
    // show a message saying "press enter to search"
    if ( e.target && e.target.value.length > 3 ) {
      dojo.style(dojo.byId("feedback"), "visibility", "visible");
    } else {
      dojo.style(dojo.byId("feedback"), "visibility", "hidden");
    }
  },

  show_popup_from_photo_id: function(e) {
    if ( e.target.id ) {
      dojo.forEach(app.grams.graphics, function(g) {
        if ( g.attributes.id == e.target.id ) {
          app.map.infoWindow.setContent(app.display_photo(g));
          app.map.infoWindow.setTitle("instagram");
          app.map.infoWindow.show(g.geometry);
        }
      });
    }
  },

  display_photo: function(graphic) {
    // build markup for the map's popup
    var attrs, caption, user_name;

    attrs = graphic.attributes;

    caption = (attrs.hasOwnProperty("caption") && attrs.caption) ?
      attrs.caption.text : "<em>no caption :(</em>";

    return caption + "<br /><img src=" + 
      attrs.images.thumbnail.url + " class=\"grammy\" /><br />By " +
      attrs.user.full_name + " | <a href=\"" + attrs.link + 
      "\" target=\"_blank\">View on InstaGram</a>";
  },

  generate_markup: function(p) {
    var desc, photo, caption, link, image, user, map_link, map_link_text;

    desc = (p.hasOwnProperty("caption") && p.caption) ?
      p.caption.text : "<em>no caption :(</em>";

    if ( desc.length > 42 ) {
      desc = desc.slice(0, 40) + "...";
    }

    map_link_text = (p.location && p.location.hasOwnProperty("latitude")) ? " | Map" : "";

    // create the divs
    photo = dojo.create("div", { "class": "photo" });
    caption = dojo.create("div", { "class": "caption", "innerHTML": desc });
    link = dojo.create("a", { "href": p.link, "target": "_blank" });
    image = dojo.create("img", { 
      "src": p.images.thumbnail.url, 
      "class": "grammy shadow",
      "alt": p.filter,
      "title": p.filter
    });
    user = dojo.create("div", { "innerHTML": p.user.full_name });
    map_link = dojo.create("span", { 
      "id": p.id, "class": "map-link", "innerHTML": map_link_text
    });
    // put them together
    dojo.place(caption, photo); // add the caption first
    dojo.place(image, link); // put the image inside the link
    dojo.place(link, photo); // add the link and image 
    dojo.place(map_link, user); // add the link to show the photo on the map
    dojo.place(user, photo); // add the user name

    return photo;
  },

  rebuild_footer: function() {
    var content_pane_node, content_pane, instructions;

    // remove old photos, re-create the original footer
    dijit.byId("footer").destroy();
    content_pane_node = dojo.create("div", { "id": "footer" });
    instructions = dojo.create("div", { 
      "id": "instructions",
      "innerHTML": "Click the map...some photos from instagram might show up."
    }, content_pane_node);
    content_pane = new dijit.layout.ContentPane({
      "region": "bottom",
      "style": "margin: 0; padding: 5px; background-color: #fff; border-top: solid 1px #777; height: 60px;"
    }, content_pane_node);
    dijit.byId("main-window").addChild(content_pane);
  },

  clear_map: function() {
    app.grams.clear();
    app.map.infoWindow.hide();
    dojo.byId("count").innerHTML = "";
  },

  switch_basemap: function(e) {
    var bm_name;

    // get name of the basemap to show
    bm_name = e.target.innerHTML;
    dojo.query(".selected").forEach(app.remove_selection);
    dojo.addClass(e.target, "selected");
    dojo.forEach(app.basemaps, function(bm) {
      (bm.id.split("_")[0] == bm_name) ? bm.show() : bm.hide();
    });
  },

  show_loading_icon: function() {
    dojo.byId("feedback").innerHTML = "<img src=\"images/loading.gif\" />";
    dojo.style(dojo.byId("feedback"), "visibility", "visible");
  },

  hide_loading_icon: function() {
    dojo.style(dojo.byId("feedback"), "visibility", "hidden");
    dojo.byId("feedback").innerHTML = app.feedback_text;
  },

  remove_selection: function(element) {
    dojo.removeClass(element, "selected");
  },

  esc_closes_popup: function(key) {
    if ( key.keyCode == 27 ) { 
      app.map.infoWindow.hide(); 
    }
  },

  err: function(err) {
    console.log("something broke...: ", err);
  }

}

dojo.ready(app.init);

