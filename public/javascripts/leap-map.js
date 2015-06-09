
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
  var example = new LeapExample("thisLeapExample", exampleInit, exampleFrame);
  google.maps.event.addDomListener(window, 'load', initialize);
});

function initializePage(){
  $("#update_map").click(update_map);

  $("#dynam_selection").change(append_selection);

  $(".close_menu").click(close_menu);
}

function initialize() {
  $map = $("#map_canvas");
  map = new google.maps.Map(d3.select("#map_canvas").node(), {
          zoom: 10,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          center: new google.maps.LatLng(32.893046, -117.147236),
          streetViewControl : false,
          styles: [{"featureType":"road","elementType":"geometry","stylers":[{"lightness":100},{"visibility":"simplified"}]},{"featureType":"water","elementType":"geometry","stylers":[{"visibility":"on"},{"color":"#C6E2FF"}]},{"featureType":"poi","elementType":"geometry.fill","stylers":[{"color":"#C5E3BF"}]},{"featureType":"road","elementType":"geometry.fill","stylers":[{"color":"#D1D1B8"}]}],
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT
          },
          panControl: false
        });

  map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(
        document.getElementById('legend'));
  // listen to Leap Motion
  Leap.loop({enableGestures: true}, move);
}

function LeapExample(exampleID, initCallback, frameCallback) {
    var self = this;
    this.exampleID = exampleID;
    this.initCallback = initCallback;
    this.frameCallback = frameCallback;

    this.serviceConnected = false;
    this.leapConnected = false;
    this.initialized = false;
    this.controller = new Leap.Controller();

    //Initialize example code and set onframe callback
    this.init = function () {
        self.exampleElement = document.getElementById(self.exampleID);
        if (self.initCallback) self.initialized = self.initCallback();
        self.controller.on("frame", self.forwardFrameCallback);
    }

    //Look for a valid frame to see if device is present
    this.frameDetectedCallback = function() {
        if(self.controller.frame(0).valid){
           if (!self.initialized) self.init();
           console.log("Device detected");
           self.leapConnected = true;
           window.clearTimeout(self.timeout);
           self.controller.removeListener("frame", self.frameDetectedCallback);
        }
    }

    //Forward frames to example code
    this.forwardFrameCallback = function(){
         if (self.frameCallback) self.frameCallback(self.controller.frame(0));
    }

    //On connection to service, set a timeout to warn if valid frames
    //aren't detected in a reasonable amount of time
    this.controller.on('connect', function () {
        console.log("Service connected");
        serviceConnected = true;
        self.timeout = window.setTimeout(function(){
            console.log("Couldn't detect device");
        }, 500);
        self.controller.on("frame", self.frameDetectedCallback);
    });

    this.controller.on('disconnect', function () {
        console.log("Service disconnected");
        serviceConnected = false;
    });

    this.controller.on('streamingStarted', function () {
        if (!self.initialized) self.init();
        console.log("Device connected");
        self.leapConnected = true;
        document.getElementById("dim_map").style.visibility = 'visible';
        document.getElementById("palm_menu").style.visibility = 'visible';
    });

    this.controller.on('streamingStopped', function () {
        console.log("Device disconnected");
        self.leapConnected = false;

    });

    this.controller.connect();
}

//Example example that uses the LeapExample class:

var exampleInit = function () {
    console.log("Init called")
    return true;
}

var exampleFrame = function (frame) {

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

function close_menu() {
  document.getElementById("dim_map").style.visibility = 'hidden';
  document.getElementById("palm_menu").style.visibility = 'hidden';
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
    return "<span>" + d.properties.NAME + "</span>";
  });


function update_map() {
  console.log("recognized button click");

  var rateById = {};

  var factors = getFactors();

  var domain_factors =[];
  for (var i = 1; i <= 10; i++) {
    domain_factors.push(factors.min + (factors.interval * i));
  }

  d3.json("data/zillowneighborhoodsca.geojson", function(data) {

    // console.log(data);
    // console.log(factors);

    var tipFactors = d3.tip()
    .attr('class', 'd3-tip')
    .html(function(d) {
      console.log(d);
      for (var i = 0; i < factors.length; i++) {
        if (factors[i].Area == d.properties.NAME || factors[i].Area == d.properties.DELPHIREGION)
          if (factors[i].socialFactor)
            return "<div>" +
                      '<p class="text-center">' + d.properties.NAME + "</p>" + "<br>" +
                      "<p>Nove Factor: " + factors[i].NoveFactor.toFixed(2) + "</p>" +
                      "<p>Education Factor: " + factors[i].educationFactor.toFixed(2) + "</p>" +
                      "<p>Housing Factor: " + factors[i].housingFactor.toFixed(2) + "</p>" +
                      "<p>Social Factor: " + factors[i].socialFactor.toFixed(2) + "</p>" +
                   "</div>";
          else
            return "<div>" +
                      '<p class="text-center">' + d.properties.NAME + "</p>" + "<br>" +
                      "<p>Nove Factor: " + factors[i].NoveFactor.toFixed(2) + "</p>" +
                      "<p>Education Factor: " + factors[i].educationFactor.toFixed(2) + "</p>" +
                      "<p>Housing Factor: " + factors[i].housingFactor.toFixed(2) + "</p>" +
                   "</div>";

        if (d.properties.DELPHIREGION == "unknown")
          return "<div>" +
                    '<p class="text-center">' + d.properties.NAME + "</p>" + "<br>" +
                    "<p>No data for this region</p>" +
                  "</div>";
      }

    });

    svg.call(tipFactors);

    console.log("domain factors: " + domain_factors);

    var color = d3.scale.threshold()
    .domain(domain_factors)
    .range(["#a50026", "#d73027", "#f46d43", "#fdae61","#fee08b", "#d9ef8b",
              "#a6d96a", "#66bd63", "#1a9850", "#006837"]);

    for (var i = 0; i < factors.length; i++) {
      // console.log("CMON");
      for (var j = 0; j < data.features.length; j++) {
        // console.log("wtf");
        // console.log("factors area name: " + factors[i]);
        // console.log("region id: " + data.features[j].properties.REGIONID);

        if (factors[i].Area == data.features[j].properties.NAME ||
              factors[i].Area == data.features[j].properties.DELPHIREGION) {


          rateById[data.features[j].properties.REGIONID] =+ factors[i].NoveFactor;
        }
      }
    }

    // console.log(rateById);

    adminDivisions.selectAll("path")
        .data(data.features)
        .attr("d", path).style("fill", function(d) {
          // console.log(d);
          // console.log(rateById[d.REGIONID]);
          // if (!rateById[d.properties.REGIONID])
          //   return "none";
          // else
          // console.log(color(rateById[d.properties.REGIONID]));
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
          region.totalpop25 = -10000;
          region.l9pop25 = -1;
          region.nineto12pop25 = -1;
          region.highgradpop25 = -1;
          region.nodippop25 = -1;
          region.assopop25 = -1;
          region.bachpop25 = -1;
          region.mastpop25 = -1;
          region.nursery = -1;
          region.kindergarden = -1;
          region.G5 = -1;
          region.G9 = -1;
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
          region.nursery = edu['Nursery/preschool -total enrollment (age>=3)'];
          region.kindergarden = edu['Kindergarten to grade 4 -total enrollment (age>=3)'];
          region.G5 = edu['Grade 5 to grade 8 -total enrollment (age>=3)'];
          region.G9 = edu['Grade 9 to grade 12 -total enrollment (age>=3)'];
        }
        if (hc == null)
        {
          region.HU = -1;
          region.HUSF = -1;
          region.HUSFMU = -1;
          region.HUMU = -1;
          region.HUMH = -1;
          region.Occ = -1;
          region.OSF = -1;
          region.OSFMU = -1;
          region.OMU = -1;
          region.OMH = -1;
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
          region.tothouse = -10000;
          region.HVl150 = -1;
          region.HV150 = -1;
          region.HV200 = -1;
          region.HV300 = -1;
          region.HV500 = -1;
          region.HV1000 = -1;
          region.medhouseval = -1;
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
      region,
      selection = get_form_values(),
      budgetval,
      typeval,
      socialtot,
      j,
      min = 11,
      max = -1;
  for (var i = 0; i < l; i++)
  {
    var factors = {};
    region = AllData[i];
    factors.Area = region.Area;
    factors.educationFactor = (region.l9pop25 + (region.nineto12pop25 * 2)
      + (region.highgradpop25 * 4) + (region.nodippop25 * 6) + (region.assopop25 * 7)
      + (region.bachpop25 * 8) + (region.mastpop25 * 10)) / (region.totalpop25 * 1.0);
    switch (selection.budget)
    {
      case "Below $150,000": budgetval = Math.sqrt((region.HVl150 * 100.0) / region.tothouse); break;
      case "$150,000 - $199,000": budgetval = Math.sqrt((region.HV150 * 100.0) / region.tothouse); break;
      case "$200,000 - $299,000": budgetval = Math.sqrt((region.HV200 * 100.0) / region.tothouse); break;
      case "$300,000 - $499K,000": budgetval = Math.sqrt((region.HV300 * 100.0) / region.tothouse); break;
      case "$500,000 - $999,000": budgetval = Math.sqrt((region.HV500 * 100.0) / region.tothouse); break;
      case "Greater than $1,000,000": budgetval = Math.sqrt((region.HV1000 * 100.0) / region.tothouse); break;
    }
    switch (selection.home_type)
    {
      case "Single Family Household": typeval = Math.sqrt((region.HUSF - region.OSF) * 100 /(totunocc = region.HU - region.OHU)); break;
      case "Single Family Multi Unit": typeval = Math.sqrt((region.HUSFMU - region.OSFMU) * 100 /(totunocc = region.HU - region.OHU)); break;
      case "Multi-Family": typeval = Math.sqrt((region.HUMF - region.OMF) * 100 /(totunocc = region.HU - region.OHU)); break;
      case "Mobile Homes": typeval = Math.sqrt((region.HUMH - region.OMH) * 100 /(totunocc = region.HU - region.OHU)); break;
    }
    factors.housingFactor = (budgetval + typeval) / 2.0;
    socialtot = 0;
    for (j = 0; j < selection.num_of_children; j++)
    {
      switch (selection.education_levels[j])
      {
        case "Nursery/preschool": socialtot += ((region.nursery * 10) + (region.kindergarden * 8) + (region.G5 * 5) + (region.G9 * 2)) /
            (region.nursery + region.kindergarden + region.G5 + region.G9); break;
        case "Kindergarten to grade 4": socialtot += ((region.nursery * 8) + (region.kindergarden * 10) + (region.G5 * 8) + (region.G9 * 5)) /
            (region.nursery + region.kindergarden + region.G5 + region.G9); break;
        case "Grade 5 to grade 8": socialtot += ((region.nursery * 5) + (region.kindergarden * 8) + (region.G5 * 10) + (region.G9 * 8)) /
            (region.nursery + region.kindergarden + region.G5 + region.G9); break;
        case "Grade 9 to grade 12": socialtot += ((region.nursery * 2) + (region.kindergarden * 5) + (region.G5 * 8) + (region.G9 * 10)) /
            (region.nursery + region.kindergarden + region.G5 + region.G9); break;
      }
    }
    // factors.socialFactor = socialtot / selection.num_of_children;
    // factors.NoveFactor = (factors.educationFactor + factors.housingFactor
    //                     + factors.socialFactor) / 3.0;
    if (selection.num_of_children != 0)
    {
      factors.socialFactor = socialtot / selection.num_of_children;
      factors.NoveFactor = (factors.educationFactor + factors.housingFactor
                          + factors.socialFactor) / 3.0;
    }
    else {
      factors.NoveFactor = (factors.educationFactor + factors.housingFactor) / 2.0;
    }
    if (factors.NoveFactor > max)
      max = factors.NoveFactor;

    if (factors.NoveFactor < min)
      min = factors.NoveFactor;

    output.push(factors);
  }
  output.max = max;
  output.min = min;
  output.range = max - min;
  output.interval = output.range / 10;
  console.log(output);
  return output;
}


function append_selection() {

  $(".education_selection").remove();

  var start = '<div class="select_div education_selection"><label class="font_lato">Child';
  var mid = 'grade level?</label><select class="form-control" id="child';
  var end = '"><option>Nursery/preschool</option><option>Kindergarten to grade 4</option><option>Grade 5 to grade 8</option><option>Grade 9 to grade 12</option></select></div>';

  if ($('#dynam_selection').val() == 1) {
    $(start + " 1 " + mid + "1" + end).hide().appendTo("#education_selection").fadeIn(1000);
  }
  else if ($('#dynam_selection').val() == 2) {
    $(start + " 1 " + mid + "1" + end).hide().appendTo("#education_selection").fadeIn(1000);
    $(start + " 2 " + mid + "2" + end).hide().appendTo("#education_selection").fadeIn(1000);
  }
  else if ($('#dynam_selection').val() == 3) {
    $(start + " 1 " + mid + "1" + end).hide().appendTo("#education_selection").fadeIn(1000);
    $(start + " 2 " + mid + "2" + end).hide().appendTo("#education_selection").fadeIn(1000);
    $(start + " 3 " + mid + "3" + end).hide().appendTo("#education_selection").fadeIn(1000);
  }
  else if ($('#dynam_selection').val() == 4) {
    $(start + " 1 " + mid + "1" + end).hide().appendTo("#education_selection").fadeIn(1000);
    $(start + " 2 " + mid + "2" + end).hide().appendTo("#education_selection").fadeIn(1000);
    $(start + " 3 " + mid + "3" + end).hide().appendTo("#education_selection").fadeIn(1000);
    $(start + " 4 " + mid + "4" + end).hide().appendTo("#education_selection").fadeIn(1000);
  }
}


function get_form_values() {
  // Create JSON
  var output = {};

  // Get value of number of children selection and put
  // it in the object under num_of_children attribute.
  output.num_of_children = $('#dynam_selection').val();

  // Create new education_levels attribute that is an array.
  output.education_levels = [];

  // Loop through the number of selection boxes using the number of children
  // specified. Get the input from each one and push it into the array.
  for (var child = 1; child <= output.num_of_children; child++) {
    output.education_levels.push($('#child' + child).val());
  }

  // Get value of home_selection input and put it in home_type attribute.
  output.home_type = $('#home_selection').val();

  // Get value of budget_selection input and put it in budget attribute.
  output.budget = $('#budget_selection').val();

  return output;
}

