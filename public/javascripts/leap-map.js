// Courtesy of https://github.com/jaxzin/leap-map

var map, $map;
var leftHandPrev;
var separationStart;
var opened;
var MAX_ZOOM = 22;
var SEPARATION_SCALING = 1.25;
var LEFT_HAND = 0, RIGHT_HAND = 1;
var X = 0, Y = 1, Z = 2;
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
      document.getElementById("opac").style.visibility = 'visible';
      document.getElementById("popUpDiv").style.visibility = 'visible';
      opened = true;
    }
  }
}

function menuClose(frame) {
  if(frame.hands.length  == 2){
    if (palmPosition(frame.hands[0]) === 'down' && palmPosition(frame.hands[1]) === 'down') {
      document.getElementById("opac").style.visibility = 'hidden';
      document.getElementById("popUpDiv").style.visibility = 'hidden';
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
function initialize() {
  $map = $("#map_canvas");
  map = new google.maps.Map(d3.select("#map_canvas").node(), {
          zoom: 10,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          center: new google.maps.LatLng(32.7157380, -117.1610840)
      });

  // listen to Leap Motion
  Leap.loop({enableGestures: true}, move);
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

d3.json("data/zillowneighborhoodsca.geojson", function(data) {

  var overlay = new google.maps.OverlayView();
  overlay.onAdd = function () {

    var layer = d3.select(this.getPanes().overlayLayer).append("div").attr("class", "SvgOverlay");
    var svg = layer.append("svg")
        .attr("width", $map.width())
        .attr("height", $map.height());
    var adminDivisions = svg.append("g").attr("class", "AdminDivisions");

    overlay.draw = function () {
        var markerOverlay = this;
        var overlayProjection = markerOverlay.getProjection();

        // Turn the overlay projection into a d3 projection
        var googleMapProjection = function (coordinates) {
            var googleCoordinates = new google.maps.LatLng(coordinates[1], coordinates[0]);
            var pixelCoordinates = overlayProjection.fromLatLngToDivPixel(googleCoordinates);
            return [pixelCoordinates.x + 4000, pixelCoordinates.y + 4000];
        }

        path = d3.geo.path().projection(googleMapProjection);
        adminDivisions.selectAll("path")
            .data(data.features)
            .attr("d", path) // update existing paths
        .enter().append("svg:path")
            .attr("d", path);
    };

  };
  overlay.setMap(map);
});

google.maps.event.addDomListener(window, 'load', initialize);