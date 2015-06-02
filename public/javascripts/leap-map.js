
var map, $map;
var leftHandPrev;
var separationStart;
var opened;
var MAX_ZOOM = 22;
var SEPARATION_SCALING = 1.25;
var LEFT_HAND = 0, RIGHT_HAND = 1;
var X = 0, Y = 1, Z = 2;


$(document).ready(function() {
  initializePage();
  drawOverlay();
  DelphiDemo.init();
  google.maps.event.addDomListener(window, 'load', initialize);
});

function initializePage(){
  $("#update_map").click(update_map);

}

function initialize() {
  $map = $("#map_canvas");
  map = new google.maps.Map(d3.select("#map_canvas").node(), {
          zoom: 10,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          center: new google.maps.LatLng(32.7157380, -117.1610840),
          streetViewControl : false
      });

  // listen to Leap Motion
  Leap.loop({enableGestures: true}, move);
}

function move(frame) {
  // Look for any circle gestures and process the zoom
  // TODO: filter out multiple circle gestures per frame
  if(frame.valid && frame.gestures.length > 0){
      frame.gestures.forEach(function(gesture){
          filterGesture("circle", zoom)(frame, gesture);
      });
  }
  markHands(frame);
  // if there is one hand grabbing...
  if(frame.hands.length > 0 && isGripped(frame.hands[LEFT_HAND])) {
    var leftHand = frame.hands[LEFT_HAND];
    var rightHand = frame.hands.length > 1 ? frame.hands[RIGHT_HAND] : undefined;
    var separation;

    // If there was no previous closed position, capture it and exit
    if(leftHandPrev == null) {
      leftHandPrev = leftHand;
      return;
    }
    // if there is a right hand and its gripped...
    if(rightHand) {
      if(isGripped(rightHand)) {
        separation = Math.sqrt(
                          Math.pow(rightHand.stabilizedPalmPosition[X] - leftHand.stabilizedPalmPosition[X], 2) +
                          Math.pow(rightHand.stabilizedPalmPosition[Y] - leftHand.stabilizedPalmPosition[Y], 2)
                        );
        // console.log("separation = " + separation + " ("+separationStart+")");
        // ...and no previous separation, capture and exit
        if(separationStart == null) {
          separationStart = separation;
          return;
        }
        // Calculate if we need to change the zoom level
        var currentZoom = map.getZoom();
        if(currentZoom > 1 && separation < (separationStart / SEPARATION_SCALING) ) {
          map.setZoom( currentZoom - 1 );
          separationStart = separation;
        } else if( currentZoom < MAX_ZOOM && separation > (SEPARATION_SCALING * separationStart) ) {
          map.setZoom( currentZoom + 1 );
          separationStart = separation;
        }
      // If the right hand is not gripped...
      } else if(separationStart != null) {
        separationStart = null;
      }
    }
    // Calculate how much the hand moved
    var dX = leftHandPrev.stabilizedPalmPosition[X] - leftHand.stabilizedPalmPosition[X];
    var dY = leftHandPrev.stabilizedPalmPosition[Y] - leftHand.stabilizedPalmPosition[Y];
    // console.log("Movement: " + dX + ","+dY);
    var center = map.getCenter();
    var scaling = 4.0 / Math.pow(2, map.getZoom()-1);
    var newLat = center.lat() + dY * scaling;
    var newLng = center.lng() + dX * scaling;
    var newCenter = new google.maps.LatLng(newLat, newLng);

    // console.log(newCenter)
    map.setCenter(newCenter);
    leftHandPrev = leftHand;
  } else {
    // If the left hand is not in a grab position, clear the last hand position
    if(frame.hands.length > LEFT_HAND && !isGripped(frame.hands[LEFT_HAND]) && leftHandPrev != null) {
      leftHandPrev = null;
    }
    // if the right hand is not in a grab position, clear the separation
    if(frame.hands.length > RIGHT_HAND && !isGripped(frame.hands[RIGHT_HAND]) && separationStart != null) {
      separationStart = null;
    }
     // console.log("Clearing lastHand");
  }

  if (opened)
    menuClose(frame);
  else if (!opened)
    menuOpen(frame);

}

function palmPosition(hand) {
    var position = hand.palmNormal;
    var orientation;
    if (position[1] > 0.75)
        orientation = "up";
    else
        orientation = "down";

    return orientation;
}

function menuOpen(frame){
  if(frame.hands.length  == 2){
    if (palmPosition(frame.hands[0]) === 'up' && palmPosition(frame.hands[1]) === 'up') {
      document.getElementById("dim_map").style.visibility = 'visible';
      document.getElementById("palm_menu").style.visibility = 'visible';
      opened = true;
    }
  }
}

function menuClose(frame) {
  if(frame.hands.length  == 2){
    if (palmPosition(frame.hands[0]) === 'down' && palmPosition(frame.hands[1]) === 'down') {
      document.getElementById("dim_map").style.visibility = 'hidden';
      document.getElementById("palm_menu").style.visibility = 'hidden';
      opened = false;
    }
  }
}

var handMarkers = [];
var HEIGHT_OFFSET = 150;
var BASE_MARKER_SIZE_GRIPPED = 350000, BASE_MARKER_SIZE_UNGRIPPED = 500000;
function markHands(frame) {
    var scaling = (4.0 / Math.pow(2, map.getZoom()-1));
      var bounds = map.getBounds();
      // FIXME: Sometimes this gets run too early, just exit if its too early.
      if(!bounds) { return; }
      var origin = new google.maps.LatLng(bounds.getSouthWest().lat(), bounds.getCenter().lng());
      var hands = frame.hands;
      for(var i in hands) {
          if(hands.hasOwnProperty(i)) {
            // Limit this to 2 hands for now
            if(i > RIGHT_HAND) {
              return;
            }
            var hand = hands[i];
            newCenter = new google.maps.LatLng(origin.lat() + ((hand.stabilizedPalmPosition[1] - HEIGHT_OFFSET) * scaling), origin.lng() + (hand.stabilizedPalmPosition[0] * scaling));
            // console.log(center.lat() + "," + center.lng());
            // console.log(newCenter.lat() + "," + newCenter.lng());
            var gripped = isGripped(hand);
            var baseRadius = gripped ? BASE_MARKER_SIZE_GRIPPED : BASE_MARKER_SIZE_UNGRIPPED;
            var handColor = getHandColor(hand);
            var handMarker = handMarkers[i];
            if(!handMarker) {
              handMarker = new google.maps.Circle();
              handMarkers[i] = handMarker;
            }
            handMarker.setOptions({
              strokeColor: handColor,
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillColor: handColor,
              fillOpacity: 0.35,
              map: map,
              zIndex: 1,
              center: newCenter,
              radius: baseRadius * scaling
            });
          }
      }
}
var zoomLevelAtCircleStart;
var INDEX_FINGER = 1;
function zoom(frame, circleGesture) {
    // Only zoom based on one index finger
    if(circleGesture.pointableIds.length == 1 &&
            frame.pointable(circleGesture.pointableIds[0]).type == INDEX_FINGER) {
        switch(circleGesture.state) {
            case "start":
                zoomLevelAtCircleStart = map.getZoom();
            // fall through on purpose...
            case "update":
                // figure out if we need to change the zoom level;
                var zoomChange = Math.floor(circleGesture.progress);
                var currentZoom = map.getZoom();
                var zoomDirection = isClockwise(frame, circleGesture) ? zoomChange : -zoomChange;
                if(zoomLevelAtCircleStart + zoomDirection != currentZoom) {
                    var newZoom = zoomLevelAtCircleStart + zoomDirection;
                    if(newZoom >= 0 && newZoom <= MAX_ZOOM) {
                        map.setZoom(newZoom);
                    }
                }
                break;
            case "stop":
                zoomLevelAtCircleStart = null;
                break;
        }
    }
}

// ==== utility functions =====
/** Returns the truth that a Leap Motion API Hand object is currently in a gripped or "grabbed" state.
*/
function isGripped(hand) {
  return hand.grabStrength == 1.0;
}
function getHandColor(hand) {
    if(isGripped(hand)) {
        return "rgb(0,119,0)";
    } else {
        var tint = Math.round((1.0 - hand.grabStrength) * 119);
        tint = "rgb(119," + tint + "," + tint + ")";
        return tint;
    }
}
function filterGesture(gestureType, callback) {
    return function(frame, gesture) {
        if(gesture.type == gestureType) {
            callback(frame, gesture);
        }
    }
}
function isClockwise(frame, gesture) {
    var clockwise = false;
    var pointableID = gesture.pointableIds[0];
    var direction = frame.pointable(pointableID).direction;
    var dotProduct = Leap.vec3.dot(direction, gesture.normal);
    if (dotProduct  >  0) clockwise = true;
    return clockwise;
}

var overlay;
var layer;
var svg;
var adminDivisions;
var path;
var googleMapProject;
var markerOverlay;
var overlayProjection;
function drawOverlay() {

  d3.json("data/zillowneighborhoodsca.geojson", function(data) {

    overlay = new google.maps.OverlayView();
    overlay.onAdd = function () {

      layer = d3.select(this.getPanes().overlayMouseTarget).append("div").attr("class", "SvgOverlay");
      svg = layer.append("svg")
          .attr("width", $map.width())
          .attr("height", $map.height());
      adminDivisions = svg.append("g").attr("class", "AdminDivisions");

      svg.call(tip);

      overlay.draw = function () {
          markerOverlay = this;
          overlayProjection = markerOverlay.getProjection();

          // Turn the overlay projection into a d3 projection
          googleMapProjection = function (coordinates) {
              var googleCoordinates = new google.maps.LatLng(coordinates[1], coordinates[0]);
              var pixelCoordinates = overlayProjection.fromLatLngToDivPixel(googleCoordinates);
              return [pixelCoordinates.x + 4000, pixelCoordinates.y + 4000];
          }

          path = d3.geo.path().projection(googleMapProjection);
          adminDivisions.selectAll("path")
              .data(data.features)
              .attr("d", path) // update existing paths
          .enter().append("svg:path")
              .attr("d", path).on('mouseover', tip.show).on('mouseout', tip.hide);
      };

    };

    overlay.setMap(map);
  });

}

var tip = d3.tip()
  .attr('class', 'd3-tip')
  .html(function(d) {
    console.log(d.properties.NAME);
    return "<span>" + d.properties.NAME + "</span>";
  });

var tipFactors = d3.tip()
  .attr('class', 'd3-tip')
  .html(function(d) {
    // console.log(d.properties.NAME);
    // console.log(d);
    // var factors = getFactors();
    // console.log(factors);

    return "<span>" +
              d.properties.NAME +
           "</span>";
  });


var factors;
function update_map() {
  console.log("recognized button click");
  var color = d3.scale.threshold()
    .domain([6.7, 6.8, 6.9, 7.0, 7.1, 7.2, 7.3, 7.4, 8])
    .range(["#f7fcfd", "#e0ecf4", "#bfd3e6", "#9ebcda","#8c96c6", "#8c6bb1",
              "#88419d", "#810f7c", "#4d004b"]);
  var rateById = {};

  factors = getFactors();

  d3.json("data/zillowneighborhoodsca.geojson", function(data) {

    // console.log(data);
    // console.log(factors);

    svg.call(tipFactors);

    for (var i = 0; i < factors.length; i++) {
      // console.log("CMON");
      for (var j = 0; j < data.features.length; j++) {
        // console.log("wtf");
        // console.log("factors area name: " + factors[i]);
        // console.log("region id: " + data.features[j].properties.REGIONID);

        if (factors[i].Area == data.features[j].properties.NAME ||
              factors[i].Area == data.features[j].properties.CITY) {


          rateById[data.features[j].properties.REGIONID] =+ factors[i].NoveFactor;
        }
      }
    }

    console.log(rateById);

    adminDivisions.selectAll("path")
        .data(data.features)
        .attr("d", path).style("fill", function(d) {
          // console.log(d);
          // console.log(rateById[d.REGIONID]);
          return color(rateById[d.properties.REGIONID]);
        }).on('mouseover', tipFactors.show).on('mouseout', tipFactors.hide);;

  });

}













var AllData
var DelphiDemo = DelphiDemo || (function() {
  var self = {};
  /**
   * Send an ajax request to the server to retrieve delphi db data.
   */
  self.getDelphiData = function() {
    var eduData, HCData, HVData;
    $.when(
      $.getJSON("/delphi-education", function(data) {
          eduData = data;
      }),
      $.getJSON("/delphi-home-value", function(data) {
          HVData = data;
      }),
      $.getJSON("/delphi-housing-info", function(data) {
          HCData = data;
      })
    ).then(function() {
      AllData = join(eduData.rows, HCData, HVData, "Area", "Area", "Area", function(edu, hc, hv) {
        var region = {};
        if (edu == null)
        {
          region.totalpop25 = null;
          region.l9pop25 = null;
          region.nineto12pop25 = null;
          region.highgradpop25 = null;
          region.nodippop25 = null;
          region.assopop25 = null;
          region.bachpop25 = null;
          region.mastpop25 = null;
        }
        else {
          region.Area = edu.Area;
          region.totalpop25 = edu['Population 25 and older'];
          region.l9pop25 = edu['Less than 9th grade (age>=25)'];
          region.nineto12pop25 = edu['9th through 12th grade, no diploma (age>=25)'];
          region.highgradpop25 = edu['High school graduate (include equivalency (age>=25))'];
          region.nodippop25 = edu['Some college, no diploma (age>=25)'];
          region.assopop25 = edu["Associate's degree (age>=25)"];
          region.bachpop25 = edu["Bachelor's degree (age>=25)"];
          region.mastpop25 = edu["Master's degree (age>=25)"];
        }
        if (hc == null)
        {
          region.HU = null;
          region.HUSF = null;
          region.HUSFMU = null;
          region.HUMU = null;
          region.HUMH = null;
          region.Occ = null;
          region.OSF = null;
          region.OSFMU = null;
          region.OMU = null;
          region.OMH = null;
        }
        else {
          region.Area = hc.Area;
          region.HU = hc['Housing Units'];
          region.HUSF = hc['Housing Units - Single Family'];
          region.HUSFMU = hc['Housing Units - Single Family Multi Unit'];
          region.HUMF = hc['Housing Units - Multi-Family'];
          region.HUMH = hc['Housing Units - Mobile Homes'];
          region.OHU = hc['Occupied House Holds'];
          region.OSF = hc['Occupied - Single Family'];
          region.OSFMU = hc['Occupied - Single Family Multi Unit'];
          region.OMF = hc['Occupied - Multi-Family'];
          region.OMH = hc['Occupied - Mobile Homes'];
        }
        if (hv == null)
        {
          region.tothouse = null;
          region.HVl150 = null;
          region.HV150 = null;
          region.HV200 = null;
          region.HV300 = null;
          region.HV500 = null;
          region.HV1000 = null;
          region.medhouseval = null;
        }
        else {
          region.Area = hv.Area;
          region.tothouse = hv['Total owner occupied households'];
          region.HVl150 = hv['House value <$150K'];
          region.HV150 = hv['House value $150K-199K'];
          region.HV200 = hv['House value $200K-299K'];
          region.HV300 = hv['House value $300K-499K'];
          region.HV500 = hv['House value $500K-999K'];
          region.HV1000 = hv['House value $1000K+'];
          region.medhouseval = hv['Median house value'];
        }
        return region;
      });
    });
  };
  /**
   * initialize
   */
  self.init = function() {
    self.getDelphiData();
  };

  return self;
})();

function join(lookupTable, lookupTable2, mainTable, lookupKey, lookupKey2, mainKey, select) {
    var l = lookupTable.length,
        l2 = lookupTable2.length,
        m = mainTable.length,
        lookupIndex = [],
        lookupIndex2 = [],
        output = [];
    for (var i = 0; i < l; i++) {
        var row = lookupTable[i];
        lookupIndex[row[lookupKey].toLowerCase().replace(/\W/g,"")] = row;
    }
    for (var i2 = 0; i2 < l2; i2++) {
      var row2 = lookupTable2[i2];
      lookupIndex2[row2[lookupKey2].toLowerCase().replace(/\W/g,"")] = row2;
    }
    for (var j = 0; j < m; j++) {
        var y = mainTable[j];
        var mainindex = y[mainKey].toLowerCase().replace(/\W/g,"");
        var x = lookupIndex[mainindex];
        var x2 = lookupIndex2[mainindex];
        output.push(select(x, x2, y));
    }
    return output;
};

function getFactors()
{
  var l = AllData.length,
      output = [],
      region;
  for (var i = 0; i < l; i++)
  {
    var factors = {};
    region = AllData[i];
    factors.Area = region.Area;
    factors.educationFactor = (region.l9pop25 + (region.nineto12pop25 * 2)
      + (region.highgradpop25 * 4) + (region.nodippop25 * 6) + (region.assopop25 * 7)
      + (region.bachpop25 * 8) + (region.mastpop25 * 10)) / (region.totalpop25 * 1.0);
    factors.housingFactor = 8;
    factors.socialFactor = 7.5;
    factors.NoveFactor = (factors.educationFactor + factors.housingFactor
                        + factors.socialFactor) / 3.0;
    output.push(factors);
  }
  // console.log(output);
  return output;
}






