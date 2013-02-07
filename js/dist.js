/*
 * LatLong object - methods summary
 *   p = new LatLong('512839N', '0002741W')
 *   p = new LatLong(53.123, -1.987)
 *   dist = LatLong.distHaversine(p1, p2)
 *   brng = LatLong.bearing(p1, p2)
 *   dist = p1.distAlongVector(orig, dirn)
 *   p = LatLong.midPoint(p1, p2)
 *   rad = LatLong.llToRad('51º28'39"N')
 *   latDms = p.latitude()
 *   lonDms = p.longitude()
 *   dms = LatLong.radToDegMinSec(0.1284563)
 *   dms = LatLong.radToBrng(0.1284563)
 * properties:
 *   p1.lat - latitude in radians (0=equator, pi/2=N.pole)
 *   p1.lon - longitude in radians (0=Greenwich, E=+ve)
 *
 * Note: much of this code is for handling degrees, minutes, seconds - to do distance calculation 
 * for decimal degrees only would require barely more than the LatLong.distHaversine function on its own
 *
 * © 2002-2005 Chris Veness
 */


/*
 * LatLong constructor:
 *
 *   arguments are in degrees, either numeric or formatted as per LatLong.llToRad
 *   returned lat is in range -pi/2 ... +pi/2, E = +ve
 *   returned lon is in range -pi ... +pi, N = +ve
 */
function LatLong(degLat, degLong) {
  if (typeof degLat == 'number' && typeof degLong == 'number') {  // numerics
    this.lat = degLat * Math.PI / 180;
    this.lon = degLong * Math.PI / 180;
  } else if (!isNaN(Number(degLat)) && !isNaN(Number(degLong))) { // numerics-as-strings
    this.lat = degLat * Math.PI / 180;
    this.lon = degLong * Math.PI / 180;
  } else {                                                        // deg-min-sec with dir'n
    this.lat = LatLong.llToRad(degLat);
    this.lon = LatLong.llToRad(degLong);
  }
}


/*
 * Calculate distance (in km) between two points specified by latitude/longitude.
 *
 * from: Haversine formula - R. W. Sinnott, "Virtues of the Haversine",
 *       Sky and Telescope, vol 68, no 2, 1984
 *       http://www.census.gov/cgi-bin/geo/gisfaq?Q5.1
 */
LatLong.distHaversine = function(p1, p2) {
  var R = 6371; // earth's mean radius in km
  var dLat  = p2.lat - p1.lat;
  var dLong = p2.lon - p1.lon;

  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(p1.lat) * Math.cos(p2.lat) * Math.sin(dLong/2) * Math.sin(dLong/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c;

  return d;
}


/*
 * Calculate distance (in km) between two points specified by latitude/longitude using law of cosines.
 */
LatLong.distCosineLaw = function(p1, p2) {
  var R = 6371; // earth's mean radius in km
  var d = Math.acos(Math.sin(p1.lat)*Math.sin(p2.lat) +
                    Math.cos(p1.lat)*Math.cos(p2.lat)*Math.cos(p2.lon-p1.lon)) * R;
  return d;
}


/*
 * calculate (initial) bearing (in radians clockwise) between two points
 *
 * from: Ed Williams' Aviation Formulary, http://williams.best.vwh.net/avform.htm#Crs
 */
LatLong.bearing = function(p1, p2) {
  var y = Math.sin(p2.lon-p1.lon) * Math.cos(p2.lat);
  var x = Math.cos(p1.lat)*Math.sin(p2.lat) -
          Math.sin(p1.lat)*Math.cos(p2.lat)*Math.cos(p2.lon-p1.lon);
  return Math.atan2(y, x);  // -y 'cos Williams treats W as +ve!
}


/*
 * calculate distance of point along a given vector defined by origin point
 * and direction in radians (uses planar not spherical geometry, so only valid
 * for small distances).
 */
LatLong.prototype.distAlongVector = function(orig, dirn) {
  var dist = LatLong.distHaversine(this, orig);  // distance from orig to point
  var brng = LatLong.bearing(this, orig);        // bearing between orig and point
  return dist * Math.cos(brng-dirn);
}


/*
 * calculate midpoint of great circle line between p1 & p2.
 *   see http://mathforum.org/library/drmath/view/51822.html for derivation
 */
LatLong.midPoint = function(p1, p2) {
  var dLon = p2.lon - p1.lon;

  var Bx = Math.cos(p2.lat) * Math.cos(dLon);
  var By = Math.cos(p2.lat) * Math.sin(dLon);

  lat3 = Math.atan2(Math.sin(p1.lat)+Math.sin(p2.lat),
                    Math.sqrt((Math.cos(p1.lat)+Bx)*(Math.cos(p1.lat)+Bx) + By*By ) );
  lon3 = p1.lon + Math.atan2(By, Math.cos(p1.lat) + Bx);

  return new LatLong(lat3*180/Math.PI, lon3*180/Math.PI);
}


/*
 * calculate destination point given start point, initial heading and distance
 *   see http://williams.best.vwh.net/avform.htm#LL
 */
LatLong.prototype.destPoint = function(hdng, dist) {
  var R = 6371; // earth's mean radius in km
  var p1 = this, p2 = new LatLong(0,0), d = parseFloat(dist)/R;  // d = angular distance covered on earth's surface
  hdng = LatLong.degToRad(hdng);
  p2.lat = Math.asin( Math.sin(p1.lat)*Math.cos(d) + Math.cos(p1.lat)*Math.sin(d)*Math.cos(hdng) );
  p2.lon = p1.lon + Math.atan2(Math.sin(hdng)*Math.sin(d)*Math.cos(p1.lat), Math.cos(d)-Math.sin(p1.lat)*Math.sin(p2.lat));
  return p2;
}


/*
 * calculate final heading arriving at destination point given start point, initial heading and distance
 */
LatLong.prototype.finalHdng = function(hdng, dist) {
  var p1 = this, p2 = p1.destPoint(hdng, dist);
  // get reverse bearing point 2 to point 1 & reverse it by adding 180º
  var h2 = (LatLong.bearing(p2, p1) + Math.PI) % (2*Math.PI);
  return h2;
}


/*
 * convert (text) lat/long in degrees to (numeric) radians, for inputting purposes
 *
 *   this is very flexible on formats, allowing a variety of separators (eg 3º 37' 09"W)
 *   or fixed-width format without separators (eg 0033709W). Compass direction (NSEW) is
 *   always required, and minimal validation is done.
 */
LatLong.llToRad = function(brng) {
  brng = brng.toUpperCase();                      // make it case-insensitive
  var dir = brng.slice(brng.length-1);            // compass direction
  if (!/[NSEW]/.test(dir)) return NaN;            // check for correct compass direction
  brng = brng.slice(0,-1);                        // and lose it off the end
  var dms = brng.split(/[\s:,°º'\'?\"]/)          // check for separators indicating d/m/s
  if (dms.length == 3) {                          // interpret 3-part result as d/m/s
    var deg = dms[0]/1 + dms[1]/60 + dms[2]/3600; // and convert to decimal degrees
  } else {                                        // otherwise non-separated format
    if (/[NS]/.test(dir)) brng = '0' + brng;      // normalise N/S to 3-digit degrees
    var deg = brng.slice(0,3)/1 + brng.slice(3,5)/60 + brng.slice(5)/3600;
  }
  if (/[WS]/.test(dir)) deg = -deg;               // take west and south as -ve
  return deg * Math.PI / 180;                     // then convert to radians
}


LatLong.degToRad = function(brng) {
  var dms = brng.split(/[\s:,º°\'\"'?]/)          // check for separators indicating d/m/s
  if (dms.length == 3) {                          // interpret 3-part result as d/m/s
    var deg = dms[0]/1 + dms[1]/60 + dms[2]/3600; // and convert to decimal degrees
  } else {         
    var deg = parseFloat(brng);                       // otherwise already decimal degrees
  }
  return deg * Math.PI / 180;                     // then convert to radians
}


/*
 * convert latitude into degrees, minutes, seconds; eg 51º28'38"N
 */
LatLong.prototype.latitude = function() {
  return LatLong._dms(this.lat) + (this.lat<0 ? 'S' : 'N');
}


/*
 * convert longitude into degrees, minutes, seconds; eg 000º27'41"W
 */
LatLong.prototype.longitude = function() {
  return LatLong._dms(this.lon) + (this.lon>0 ? 'E' : 'W');
}


/*
 * convert radians to (signed) degrees, minutes, seconds; eg -0.1rad = -000°05'44"
 */
LatLong.radToDegMinSec = function(rad) {
  return (rad<0?'-':'') + LatLong._dms(rad);
}


/*
 * convert radians to compass bearing - 0°-360° rather than +ve/-ve
 */
LatLong.radToBrng = function(rad) {
  return LatLong.radToDegMinSec((rad+2*Math.PI) % (2*Math.PI));
}


/*
 * convert radians to deg/min/sec, with no sign or compass dirn (internal use)
 */
LatLong._dms = function(rad) {
  var d = Math.abs(rad * 180 / Math.PI);
  var deg = Math.floor(d);
  var min = Math.floor((d-deg)*60);
  var sec = Math.round((d-deg-min/60)*3600);
  // add leading zeros if required
  if (deg<100) deg = '0' + deg; if (deg<10) deg = '0' + deg;
  if (min<10) min = '0' + min;
  if (sec<10) sec = '0' + sec;
  return deg + '\u00B0' + min + '\u2032' + sec + '\u2033';
}


/*
 * override toPrecision method with one which displays trailing zeros in place
 *   of exponential notation
 *
 * (for Haversine, use 4 sf to reflect reasonable indication of accuracy)
 */
Number.prototype.toPrecision = function(fig) {
  var scale = Math.ceil(Math.log(this)*Math.LOG10E);
  var mult = Math.pow(10, fig-scale);
  return Math.round(this*mult)/mult;
}


/*
 * it's good form to include a toString method...
 */
LatLong.prototype.toString = function() {
  return this.latitude() + ', ' + this.longitude();
}