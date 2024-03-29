(function(factory) {
  // Packaging/modules magic dance
  var L;
  if (typeof define === "function" && define.amd) {
    // AMD
    define(["leaflet"], factory);
  } else if (typeof module !== "undefined") {
    // Node/CommonJS
    L = require("leaflet");
    module.exports = factory(L);
  } else {
    // Browser globals
    if (typeof window.L === "undefined") {
      throw "Leaflet must be loaded first";
    }
    factory(window.L);
  }
})(function(L) {
  "use strict";
  L.Control.Search = L.Control.extend({
    options: {
      showResultIcons: false,
      collapsed: true,
      expand: "click",
      position: "topright",
      placeholder: "输入关键字",
      errorMessage: "无结果",
      key: "",
      limit: 5
    },

    _callbackId: 0,

    initialize: function(options) {
      L.Util.setOptions(this, options);
      if (!this.options.geocoder) {
        this.options.geocoder = new L.Control.Search.Geocoder(this.options);
      }
    },

    onAdd: function(map) {
      var className = "leaflet-control-ocd-search";
      var container = L.DomUtil.create("div", className);
      var icon = L.DomUtil.create(
        "div",
        "leaflet-control-ocd-search-icon",
        container
      );
      var form = (this._form = L.DomUtil.create(
        "form",
        className + "-form",
        container
      ));
      var input;

      this._map = map;
      this._container = container;
      input = this._input = L.DomUtil.create("input");
      input.type = "text";
      input.placeholder = this.options.placeholder;

      L.DomEvent.addListener(input, "keydown", this._keydown, this);

      this._errorElement = document.createElement("div");
      this._errorElement.className = className + "-form-no-error";
      this._errorElement.innerHTML = this.options.errorMessage;

      this._alts = L.DomUtil.create(
        "ul",
        className +
          "-alternatives leaflet-control-ocd-search-alternatives-minimized"
      );

      form.appendChild(input);
      form.appendChild(this._errorElement);
      container.appendChild(this._alts);

      L.DomEvent.addListener(form, "submit", this._geocode, this);

      if (this.options.collapsed) {
        if (this.options.expand === "click") {
          L.DomEvent.addListener(
            icon,
            "click",
            function(e) {
              // TODO: touch
              if (e.button === 0 && e.detail !== 2) {
                this._toggle();
              }
            },
            this
          );
        } else {
          L.DomEvent.addListener(icon, "mouseover", this._expand, this);
          L.DomEvent.addListener(icon, "mouseout", this._collapse, this);
          this._map.on("movestart", this._collapse, this);
        }
      } else {
        this._expand();
      }

      L.DomEvent.disableClickPropagation(container);

      return container;
    },

    _geocodeResult: function(results) {
      L.DomUtil.removeClass(
        this._container,
        "leaflet-control-ocd-search-spinner"
      );
      if (results.length === 1) {
        this._geocodeResultSelected(results[0]);
      } else if (results.length > 0) {
        this._alts.innerHTML = "";
        this._results = results;
        L.DomUtil.removeClass(
          this._alts,
          "leaflet-control-ocd-search-alternatives-minimized"
        );
        for (var i = 0; i < results.length; i++) {
          this._alts.appendChild(this._createAlt(results[i], i));
        }
      } else {
        L.DomUtil.addClass(
          this._errorElement,
          "leaflet-control-ocd-search-error"
        );
      }
    },

    markGeocode: function(result) {
      if (result.bounds) {
        this._map.fitBounds(result.bounds);
      } else {
        this._map.panTo([result.y, result.x]);
      }

      if (this._geocodeMarker) {
        this._map.removeLayer(this._geocodeMarker);
      }

      this._geocodeMarker = new L.Marker([result.y, result.x])
        .bindPopup(result.name)
        .addTo(this._map)
        .openPopup();

      return this;
    },

    _geocode: function(event) {
      L.DomEvent.preventDefault(event);

      L.DomUtil.addClass(this._container, "leaflet-control-ocd-search-spinner");
      this._clearResults();
      this.options.geocoder.geocode(
        this._input.value,
        this._geocodeResult,
        this
      );

      return false;
    },

    _geocodeResultSelected: function(result) {
      if (this.options.collapsed) {
        this._collapse();
      } else {
        this._clearResults();
      }

      this.markGeocode(result);
    },

    _toggle: function() {
      if (
        this._container.className.indexOf(
          "leaflet-control-ocd-search-expanded"
        ) >= 0
      ) {
        this._collapse();
      } else {
        this._expand();
      }
    },

    _expand: function() {
      L.DomUtil.addClass(
        this._container,
        "leaflet-control-ocd-search-expanded"
      );
      this._input.select();
    },

    _collapse: function() {
      this._container.className = this._container.className.replace(
        " leaflet-control-ocd-search-expanded",
        ""
      );
      L.DomUtil.addClass(
        this._alts,
        "leaflet-control-ocd-search-alternatives-minimized"
      );
      L.DomUtil.removeClass(
        this._errorElement,
        "leaflet-control-ocd-search-error"
      );
    },

    _clearResults: function() {
      L.DomUtil.addClass(
        this._alts,
        "leaflet-control-ocd-search-alternatives-minimized"
      );
      this._selection = null;
      L.DomUtil.removeClass(
        this._errorElement,
        "leaflet-control-ocd-search-error"
      );
    },

    _createAlt: function(result, index) {
      var li = document.createElement("li");
      li.innerHTML =
        '<a href="#" title="' +
        result.name +
        '" data-result-index="' +
        index +
        '">' +
        (this.options.showResultIcons && result.icon
          ? '<img src="' + result.icon + '"/>'
          : "") +
        result.name +
        "</a>";
      L.DomEvent.addListener(
        li,
        "click",
        function clickHandler() {
          this._geocodeResultSelected(result);
        },
        this
      );

      return li;
    },

    _keydown: function(e) {
      var _this = this,
        select = function select(dir) {
          if (_this._selection) {
            L.DomUtil.removeClass(
              _this._selection.firstChild,
              "leaflet-control-ocd-search-selected"
            );
            _this._selection =
              _this._selection[dir > 0 ? "nextSibling" : "previousSibling"];
          }

          if (!_this._selection) {
            _this._selection =
              _this._alts[dir > 0 ? "firstChild" : "lastChild"];
          }

          if (_this._selection) {
            L.DomUtil.addClass(
              _this._selection.firstChild,
              "leaflet-control-ocd-search-selected"
            );
          }
        };

      switch (e.keyCode) {
        // Up
        case 38:
          select(-1);
          L.DomEvent.preventDefault(e);
          break;
        // Up
        case 40:
          select(1);
          L.DomEvent.preventDefault(e);
          break;
        // Enter
        case 13:
          if (this._selection) {
            var index = parseInt(
              this._selection.firstChild.getAttribute("data-result-index"),
              10
            );
            this._geocodeResultSelected(this._results[index]);
            this._clearResults();
            L.DomEvent.preventDefault(e);
          }
      }
      return true;
    }
  });

  L.Control.search = function(id, options) {
    return new L.Control.Search(id, options);
  };

  L.Map.mergeOptions({
    searchControl: false
  });

  L.Map.addInitHook(function() {
    if (this.options.searchControl) {
      this.searchControl = new L.Control.Search();
      this.addControl(this.searchControl);
    }
  });

  L.Control.Search.callbackId = 0;
  L.Control.Search.jsonp = function(
    url,
    params,
    callback,
    context,
    jsonpParam
  ) {
    var callbackId = "_ocd_geocoder_" + L.Control.Search.callbackId++;

    params[jsonpParam || "callback"] = callbackId;
    window[callbackId] = L.Util.bind(callback, context);
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = url + L.Util.getParamString(params);
    script.id = callbackId;
    script.addEventListener("error", function() {
      callback({ results: [] });
    });
    script.addEventListener("abort", function() {
      callback({ results: [] });
    });
    document.getElementsByTagName("head")[0].appendChild(script);
  };

  L.Control.Search.Geocoder = L.Class.extend({
    options: {
      serviceUrl: "http://172.10.0.220:9000/gateway/search/solr_poi_core",
      geocodingQueryParams: {},
      reverseQueryParams: {},
      key: "",
      limit: 5
    },

    initialize: function(options) {
      L.Util.setOptions(this, options);
    },

    geocode: function(query, cb, context) {
      L.Util.request({
        url:
          this.options.serviceUrl +
          "?df=text&indent=on&start=0&rows=10&wt=json&q=" +
          query,
        data: {},
        success: function(results) {
          cb.call(context, JSON.parse(results).response.docs);
        },
        error: function(errorMessage) {}
      });
    },

    reverse: function(location, scale, cb, context) {
      this.geocode(location, cb, context);
    }
  });

  L.Control.search.geocoder = function(options) {
    return new L.Control.Search.Geocoder(options);
  };

  return L.Control.Search;
});
