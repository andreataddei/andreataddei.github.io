// ==================================================================
// andreataddei.github.io - script unico (leggibile)
// Sfondo orbitale: Terra reale, cielo astronomico, satelliti TLE
// ==================================================================
(function () {
  var c = document.getElementById("orbit");
  var x = c.getContext("2d");
  var W, H, CX, CY, R, DPR = 1;
  var sphereC = document.createElement("canvas");
  var sphereX = sphereC.getContext("2d");
  var sphereImg = null, pixLon = null, pixV = null, pixShade = null, pixIdx = null, pixCount = 0;
  var frame = 0;

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    c.width = Math.round(W * DPR); c.height = Math.round(H * DPR);
    c.style.width = W + "px"; c.style.height = H + "px";
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    CX = W * 0.78; CY = H * 0.42;
    R = Math.min(W, H) * 0.30;
    rebuildSphere();
  }
  window.addEventListener("resize", resize); resize();

  var ROT = 0;

  function proj(px, py, pz) {
    return { x: CX + px, y: CY + py, z: pz };
  }

  function behindGlobe(pr) {
    if (pr.z <= 0) return false;
    var dx = pr.x - CX, dy = pr.y - CY;
    return dx * dx + dy * dy < R * R;
  }

  // ---------- texture della Terra (repo base64, fallback CDN NASA) ----------
  var TW = 2048, TH = 1024, TWm = TW - 1, THm = TH - 1;
  var tex = { ready: false, data: null, lum: null };
  var img = new Image();
  var triedCDN = false;

  function buildTexture() {
    try {
      var tc = document.createElement("canvas");
      tc.width = TW; tc.height = TH;
      var tctx = tc.getContext("2d");
      tctx.drawImage(img, 0, 0, TW, TH);
      var d = tctx.getImageData(0, 0, TW, TH).data;
      var lum = new Uint8Array(TW * TH);
      for (var i = 0, p = 0; i < lum.length; i++, p += 4) {
        lum[i] = (d[p] * 77 + d[p + 1] * 151 + d[p + 2] * 28) >> 8;
      }
      var blur = new Uint8Array(TW * TH);
      for (var y = 0; y < TH; y++) {
        var yu = y > 0 ? y - 1 : 0, yd = y < THm ? y + 1 : THm;
        for (var xx = 0; xx < TW; xx++) {
          var xl = xx > 0 ? xx - 1 : 0, xr = xx < TWm ? xx + 1 : TWm;
          blur[y * TW + xx] = (
            lum[yu * TW + xl] + lum[yu * TW + xx] + lum[yu * TW + xr] +
            lum[y * TW + xl] + lum[y * TW + xx] + lum[y * TW + xr] +
            lum[yd * TW + xl] + lum[yd * TW + xx] + lum[yd * TW + xr]) / 9;
        }
      }
      tex.data = d; tex.lum = blur;
      tex.ready = true;
      rebuildSphere();
    } catch (e) { /* resta il fallback */ }
  }

  img.onload = buildTexture;
  img.onerror = function () { if (!triedCDN) { loadFromCDN(); } };
  img.crossOrigin = "anonymous";

  function loadFromRepo() {
    if (window.fetch) {
      fetch("earth.txt").then(function (r) { return r.text(); }).then(function (b64) {
        img.src = "data:image/jpeg;base64," + b64.replace(/\s+/g, "");
      }).catch(function () { loadFromCDN(); });
    } else { loadFromCDN(); }
  }
  function loadFromCDN() {
    triedCDN = true;
    img.src = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/textures/planets/earth_atmos_2048.jpg";
  }
  loadFromRepo();

  function rebuildSphere() {
    var S = Math.max(64, Math.min(1024, Math.round(R * 2 * DPR)));
    sphereC.width = sphereC.height = S;
    sphereX = sphereC.getContext("2d");
    sphereImg = sphereX.createImageData(S, S);
    var lon = new Float32Array(S * S), v = new Uint16Array(S * S),
        sh = new Float32Array(S * S), idx = new Uint32Array(S * S);
    var n = 0, rr = (S / 2) * (S / 2);
    for (var yy = 0; yy < S; yy++) {
      for (var xx = 0; xx < S; xx++) {
        var px = xx + 0.5 - S / 2, py = yy + 0.5 - S / 2;
        var r2 = px * px + py * py;
        if (r2 > rr) continue;
        var z = Math.sqrt(rr - r2);
        lon[n] = Math.atan2(px, z);
        var lat = Math.asin(-py / (S / 2));
        v[n] = Math.min(THm, Math.max(0, Math.round((0.5 - lat / Math.PI) * TH)));
        sh[n] = 0.45 + 0.55 * (z / (S / 2));
        idx[n] = (yy * S + xx) * 4;
        n++;
      }
    }
    pixLon = lon; pixV = v; pixShade = sh; pixIdx = idx; pixCount = n;
  }

  var texDirty = true;

  function drawPlanet() {
    if (tex.ready && sphereImg) {
      frame++;
      if (texDirty || frame % 4 === 0) {
        texDirty = false;
        var d = sphereImg.data, td = tex.data, lum = tex.lum;
        var TWO = Math.PI * 2, K = 2.0;
        for (var i = 0; i < pixCount; i++) {
          var lon = pixLon[i] + ROT;
          var u = (lon / TWO) % 1; if (u < 0) u += 1;
          var tu = (u * TW) | 0, tv = pixV[i];
          var s4 = (tv * TW + tu) * 4;
          var li = tv * TW + tu;
          var oE = tu > 1 ? 2 : (tu > 0 ? 1 : 0), oW = tu < TWm - 1 ? 2 : (tu < TWm ? 1 : 0);
          var oN = tv > 1 ? 2 : (tv > 0 ? 1 : 0), oS = tv < THm - 1 ? 2 : (tv < THm ? 1 : 0);
          var ll = lum[li - oE];
          var lr = lum[li + oW];
          var lu2 = lum[li - oN * TW];
          var ld = lum[li + oS * TW];
          var relief = (ll - lr) * K + (lu2 - ld) * K;
          var shade = 1 + relief;
          if (shade < 0.55) shade = 0.55; else if (shade > 1.7) shade = 1.7;
          if (td[s4 + 2] - td[s4] > 16) shade = 1 + (shade - 1) * 0.22;
          var sh2 = pixShade[i] * shade, o = pixIdx[i];
          d[o]     = td[s4]     * sh2;
          d[o + 1] = td[s4 + 1] * sh2;
          d[o + 2] = td[s4 + 2] * sh2;
          d[o + 3] = 255;
        }
        sphereX.putImageData(sphereImg, 0, 0);
      }
      x.drawImage(sphereC, CX - R, CY - R, 2 * R, 2 * R);
    } else {
      var g = x.createRadialGradient(CX, CY - R * 0.3, R * 0.1, CX, CY, R);
      g.addColorStop(0, "rgba(20,27,48,0.98)");
      g.addColorStop(1, "rgba(10,14,26,0.98)");
      x.fillStyle = g;
      x.beginPath(); x.arc(CX, CY, R, 0, Math.PI * 2); x.fill();
    }
  }

  // ---------- cielo realistico: stelle vere (RA/Dec J2000), costellazioni con nomi ----------
  // proiezione del cielo visto da ~45 gradi N: 24h di RA = 2 larghezze schermo,
  // declinazione da +90 (alto) a -45 (basso). La deriva lenta e' la rotazione terrestre.
  // stella: [ascensione retta (ore), declinazione (gradi), magnitudine, nome]
  var CONS = [
    { n: "URSA MAIOR", s: [
        [11.062,61.75,1.8,"DUBHE"],[11.031,56.63,2.4,"MERAK"],[11.897,53.70,2.4,"PHECDA"],
        [12.257,57.03,3.3,"MEGREZ"],[12.900,55.96,1.8,"ALIOTH"],[13.399,54.92,2.2,"MIZAR"],[13.792,49.31,1.9,"ALKAID"]],
      l: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]] },
    { n: "URSA MINOR", s: [
        [2.530,89.26,2.0,"POLARIS"],[16.766,82.04,4.2,null],[15.734,77.79,4.3,null],
        [14.845,74.16,2.1,"KOCKAB"],[15.345,71.83,3.0,null]],
      l: [[0,1],[1,2],[2,3],[3,4]] },
    { n: "CASSIOPEIA", s: [
        [0.147,59.15,2.3,"CAPF"],[0.675,56.54,2.2,"SCHEDAR"],[0.945,60.72,2.4,null],
        [1.425,60.24,2.7,"RUCHBAH"],[1.907,63.67,3.4,null]],
      l: [[0,1],[1,2],[2,3],[3,4]] },
    { n: "ORION", s: [
        [5.919,7.41,0.5,"BETELGEUSE"],[5.242,-8.20,0.1,"RIGEL"],[5.418,6.35,1.6,"BELLATRIX"],
        [5.533,-0.30,2.2,"MINTAKA"],[5.604,-1.20,1.7,"ALNILAM"],[5.679,-1.94,1.8,"ALNITAK"],[5.796,-9.67,2.1,"SAIPH"]],
      l: [[0,2],[0,5],[2,3],[3,4],[4,5],[5,6],[6,1],[1,3]] },
    { n: "TAURUS", s: [
        [4.599,16.51,0.9,"ALDEBARAN"],[5.438,28.61,1.7,"ELNATH"],[3.790,24.11,2.9,"PLEIADES"]],
      l: [[0,1],[0,2]] },
    { n: "CANIS MAIOR", s: [
        [6.752,-16.72,-1.4,"SIRIUS"],[6.378,-17.96,2.0,"MIRZAM"],[7.140,-26.39,1.8,"WEZEN"],
        [6.977,-28.97,1.5,"ADHARA"],[7.402,-29.30,2.4,"ALUDRA"]],
      l: [[0,1],[0,2],[2,3],[2,4]] },
    { n: "GEMINI", s: [
        [7.577,31.89,1.6,"CASTOR"],[7.755,28.03,1.1,"POLLUX"],[6.629,16.40,1.9,"ALHENA"]],
      l: [[0,1],[1,2]] },
    { n: "LEO", s: [
        [10.139,11.97,1.4,"REGULUS"],[11.818,14.57,2.1,"DENEBOLA"],[10.333,19.83,2.0,"ALGIEBA"],
        [11.235,20.52,2.1,"ZOSMA"],[11.139,15.43,3.1,"CHERTAN"],[10.278,23.42,3.4,null]],
      l: [[0,2],[2,5],[2,3],[3,1],[1,4],[4,0]] },
    { n: "CYGNUS", s: [
        [20.690,45.28,1.2,"DENEB"],[20.371,40.26,2.2,"SADR"],[20.770,33.97,2.5,"GIENAH"],
        [19.749,45.13,2.9,null],[19.512,27.96,3.1,"ALBIREO"]],
      l: [[0,1],[1,2],[1,3],[1,4]] },
    { n: "LYRA", s: [
        [18.615,38.78,0.0,"VEGA"],[18.834,32.69,3.4,"SHELIAK"],[18.982,32.29,3.2,"SULAFAT"],[18.746,37.60,4.3,null]],
      l: [[0,3],[3,1],[1,2],[2,0]] },
    { n: "AQUILA", s: [
        [19.846,8.87,0.8,"ALTAIR"],[19.771,10.61,2.7,"TARAZED"],[19.117,-1.24,3.7,"ALSHAIN"]],
      l: [[0,1],[0,2]] },
    { n: "PEGASUS", s: [
        [23.049,15.21,2.5,"MARKAB"],[23.063,28.08,2.4,"SCHEAT"],[0.220,15.18,2.8,"ALGENIB"],
        [21.736,9.88,2.4,"ENIF"]],
      l: [[0,1],[1,2],[2,0],[0,3]] },
    { n: "ANDROMEDA", s: [
        [0.140,29.09,2.1,"ALPHERATZ"],[1.162,35.62,2.1,"MIRACH"],[2.065,42.33,2.3,"ALMACH"]],
      l: [[0,1],[1,2]] },
    { n: "PERSEUS", s: [
        [3.405,49.86,1.8,"MIRFAK"],[3.136,40.96,2.1,"ALGOL"]],
      l: [[0,1]] },
    { n: "AURIGA", s: [
        [5.278,45.99,0.1,"CAPELLA"],[5.992,44.95,1.9,"MENKALINAN"],[4.950,33.17,2.7,"HASSALEH"]],
      l: [[0,1],[1,2],[2,0]] },
    { n: "BOOTES", s: [
        [14.261,19.18,0.0,"ARCTURUS"],[14.749,27.07,2.3,"IZAR"],[13.911,18.40,2.7,"MUPHRID"]],
      l: [[0,1],[0,2]] },
    { n: "SCORPIUS", s: [
        [16.490,-26.43,1.0,"ANTARES"],[17.560,-37.10,1.6,"SHAULA"],[16.836,-34.29,2.3,"DSAUBA"]],
      l: [[0,2],[2,1]] },
    { n: "DRACO", s: [
        [17.943,51.49,2.2,"ELTANIN"],[17.507,52.30,2.8,"RASTABAN"]],
      l: [[0,1]] },
    { n: "CANIS MINOR", s: [
        [7.655,5.22,0.3,"PROCYON"]],
      l: [] },
    { n: "VIRGO", s: [
        [13.420,-11.16,1.0,"SPICA"]],
      l: [] },
    { n: "ERIDANUS", s: [
        [3.970,-5.70,0.5,"ACHERNAR"]],
      l: [] }
  ];
  var NAMED_STARS = ["SIRIUS","VEGA","ARCTURUS","BETELGEUSE","RIGEL","ALTAIR","DENEB","ALDEBARAN","ANTARES","REGULUS","CAPELLA","POLLUX","PROCYON","POLARIS","SPICA","CASTOR"];

  function skyX(ra, drift, shift) {
    var v = ((ra / 24) * W * 2 + drift) % (W * 2);
    if (v < 0) v += W * 2;
    return v - shift;
  }
  function skyY(dec) {
    return ((90 - dec) / 135) * H;
  }

  function drawSky(drift, tick) {
    // fondo: stelle fiole di campo, dense ma discrete
    for (var s2 = 0; s2 < 160; s2++) {
      var hx = (((s2 * 137.5077) % W) + drift * 0.5) % W;
      var hy = (s2 * 89.7233) % H;
      var tw = 0.35 + 0.25 * Math.sin(tick * 0.03 + s2 * 1.7);
      x.fillStyle = "rgba(244,244,242," + tw.toFixed(3) + ")";
      var sz = s2 % 11 === 0 ? 1.4 : 0.8;
      x.fillRect(hx, hy, sz, sz);
      x.fillRect((hx + W / 2) % W, (hy + H * 0.37) % H, 0.8, 0.8);
    }
    // stelle e costellazioni vere, con doppio disegno per la continuita' orizzontale
    for (var pass = 0; pass < 2; pass++) {
      var shift = pass * W * 2;
      for (var ci = 0; ci < CONS.length; ci++) {
        var cons = CONS[ci];
        var pts = [];
        var cxAcc = 0, cyAcc = 0;
        for (var si = 0; si < cons.s.length; si++) {
          var st = cons.s[si];
          var px = skyX(st[0], drift, shift), py = skyY(st[1]);
          if (px < -60 || px > W + 60) { pts.push(null); continue; }
          pts.push([px, py]);
          cxAcc += px; cyAcc += py;
          var mag = st[2];
          var rad = Math.max(0.9, 2.3 - mag * 0.42);
          var tw2 = 0.75 + 0.25 * Math.sin(tick * 0.045 + si * 2.3 + ci);
          // alone tenue per le stelle piu' brillanti
          if (mag < 1.3) {
            x.fillStyle = "rgba(244,244,242," + (0.10 * tw2).toFixed(3) + ")";
            x.beginPath(); x.arc(px, py, rad * 3.2, 0, Math.PI * 2); x.fill();
          }
          x.fillStyle = "rgba(244,244,242," + (0.95 * tw2).toFixed(3) + ")";
          x.beginPath(); x.arc(px, py, rad, 0, Math.PI * 2); x.fill();
        }
        // linee della costellazione
        x.strokeStyle = "rgba(111,140,255,0.22)";
        x.lineWidth = 1;
        x.beginPath();
        for (var li = 0; li < cons.l.length; li++) {
          var a = pts[cons.l[li][0]], b = pts[cons.l[li][1]];
          if (a && b) { x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); }
        }
        x.stroke();
        // nome della costellazione al centroide
        if (cons.s.length > 0) {
          var nx = cxAcc / cons.s.length, ny = cyAcc / cons.s.length + 34;
          x.fillStyle = "rgba(111,140,255,0.40)";
          x.font = "8px monospace";
          x.fillText(cons.n, nx - x.measureText(cons.n).width / 2, ny);
        }
        // nomi delle stelle piu' brillanti
        for (var si2 = 0; si2 < cons.s.length; si2++) {
          var nm = cons.s[si2][3];
          if (nm && NAMED_STARS.indexOf(nm) !== -1 && pts[si2]) {
            x.fillStyle = "rgba(244,244,242,0.35)";
            x.font = "7px monospace";
            x.fillText(nm, pts[si2][0] + 5, pts[si2][1] - 4);
          }
        }
      }
    }
  }

  // ---------- griglia azzurrina con dissolvenza al bordo ----------
  function gridCircle(fn, steps) {
    for (var i = 0; i < steps; i++) {
      var a = fn(i / steps * Math.PI * 2);
      var b = fn((i + 1) / steps * Math.PI * 2);
      var pa = proj(a[0], a[1], a[2]);
      var pb = proj(b[0], b[1], b[2]);
      var mz = (pa.z + pb.z) / 2;
      if (mz > R * 0.15) continue;
      var fade = 1 - Math.max(0, mz) / (R * 0.15);
      if (fade <= 0.02) continue;
      x.strokeStyle = "rgba(111,140,255," + (0.16 * fade).toFixed(4) + ")";
      x.beginPath(); x.moveTo(pa.x, pa.y); x.lineTo(pb.x, pb.y); x.stroke();
    }
  }

  // ---------- satelliti reali: TLE CelesTrak, propagazione orbitale ----------
  var TLES = [{"name": "AQUA", "line1": "1 27424U 02022A   26304.44711259  .00000453  00000+0  99793-4 0  9995", "line2": "2 27424  98.4473 276.5875 0000846  98.4282  15.1370 14.62257376303182"}, {"name": "GPM-CORE", "line1": "1 39574U 14009C   26304.34481929  .00007813  00000+0  17213-3 0  9992", "line2": "2 39574  64.9702 211.8783 0011900 253.7180 106.2651 15.44572494718849"}, {"name": "ICESAT-2", "line1": "1 43613U 18070A   26304.41680142  .00001680  00000+0  60859-4 0  9990", "line2": "2 43613  91.9951 327.7192 0002067  20.7418 339.3915 15.28277209453267"}, {"name": "ISS (ZARYA)", "line1": "1 25544U 98067A   26304.43448470  .00006246  00000+0  12087-3 0  9997", "line2": "2 25544  51.6334 345.8717 0007023 331.3934  28.6669 15.49127356592878"}, {"name": "LANDSAT 8", "line1": "1 39084U 13008A   26304.47172490  .00000173  00000+0  48567-4 0  9999", "line2": "2 39084  98.2163  12.8814 0001312  91.1446 268.9903 14.57102376717740"}, {"name": "LANDSAT 9", "line1": "1 49260U 21088A   26304.16268909  .00000110  00000+0  34427-4 0  9991", "line2": "2 49260  98.2142  12.5887 0001228  84.2145 275.9194 14.57102536270805"}, {"name": "NOAA 20 (JPSS-1)", "line1": "1 43013U 17073A   26304.46190109  .00000036  00000+0  38107-4 0  9995", "line2": "2 43013  98.7901 242.7730 0000602 138.1059 222.0163 14.19533986463803"}, {"name": "SENTINEL-1A", "line1": "1 39634U 14016A   26304.51678118  .00000053  00000+0  20688-4 0  9994", "line2": "2 39634  98.1590 309.8963 0001398  81.8762 278.2597 14.59844684669903"}, {"name": "SENTINEL-2A", "line1": "1 40697U 15028A   26304.50828042  .00000182  00000+0  86106-4 0  9991", "line2": "2 40697  98.5621  17.3630 0001149  96.0971 264.0343 14.30818028593224"}, {"name": "SENTINEL-2B", "line1": "1 42063U 17013A   26304.50122483  .00000144  00000+0  71616-4 0  9990", "line2": "2 42063  98.5727  17.3265 0001136  91.9524 268.1789 14.30817359504135"}, {"name": "SENTINEL-2C", "line1": "1 60989U 24157A   26304.18649935  .00000058  00000+0  38944-4 0  9995", "line2": "2 60989  98.5675  17.0130 0000875  94.1969 265.9314 14.30823723112438"}, {"name": "SENTINEL-3A", "line1": "1 41335U 16011A   26304.47885458  .00000052  00000+0  39422-4 0  9999", "line2": "2 41335  98.6313   9.8869 0001284  92.0228 268.1099 14.26732807557491"}, {"name": "SENTINEL-3B", "line1": "1 43437U 18039A   26304.17145964  .00000042  00000+0  35363-4 0  9993", "line2": "2 43437  98.6317   9.7325 0000569 106.0908 254.0335 14.26732188443518"}, {"name": "SENTINEL-6A", "line1": "1 46984U 20086A   26304.09376358 -.00000039  00000+0  93674-4 0  9998", "line2": "2 46984  66.0411 212.7682 0007766 269.7540  90.2586 12.80930285277732"}, {"name": "SUOMI NPP", "line1": "1 37849U 11061A   26304.51846125  .00000065  00000+0  52043-4 0  9995", "line2": "2 37849  98.8091 244.5288 0000975 329.0173  31.0945 14.19542104777786"}, {"name": "TERRA", "line1": "1 25994U 99068A   26304.51279618  .00000187  00000+0  46991-4 0  9993", "line2": "2 25994  97.9288 348.5397 0003068 136.2002 358.3368 14.61186597429519"}, {"name": "STARLINK-1008", "line1": "1 44714U 19074B   26304.58335647 -.00056648  00000+0 -48955-3 0  9991", "line2": "2 44714  53.1435 125.3256 0001642 173.8964 111.9764 15.68513414  5864"}, {"name": "STARLINK-30219", "line1": "1 57507U 23113N   26304.41668980  .00042080  00000+0  15309-2 0  9994", "line2": "2 57507  43.0037 121.6865 0001613 258.5556  63.1297 15.27559520  5924"}, {"name": "STARLINK-31679", "line1": "1 59519U 24073J   26304.33335647  .00023590  00000+0  86400-3 0  9993", "line2": "2 59519  43.0046  56.6535 0002039 273.3227 187.0222 15.27581190  5868"}, {"name": "STARLINK-3350", "line1": "1 51105U 22005B   26304.30269118  .00000152  00000+0  15650-4 0  9994", "line2": "2 51105  53.1587 294.7938 0001331  87.3374 272.7781 15.34385754264679"}, {"name": "STARLINK-34846", "line1": "1 66972U 25288P   26304.24014685  .00009992  00000+0  37214-3 0  9998", "line2": "2 66972  43.0022 133.0296 0001355 263.4818  96.5879 15.27580289 51314"}, {"name": "STARLINK-3611", "line1": "1 51779U 22017M   26304.33298052 -.00003477  00000+0 -91743-4 0  9998", "line2": "2 51779  53.1616 340.6929 0002135  78.8353 281.2890 15.34415928258424"}, {"name": "STARLINK-37365", "line1": "1 69186U 26114E   26304.16670139 -.00018991  00000+0 -55224-3 0  9992", "line2": "2 69186  53.1590 283.8739 0001473  91.0998 356.7164 15.34405166  5873"}, {"name": "STARLINK-4648", "line1": "1 53602U 22104Q   26304.13627730 -.00001871  00000+0 -44238-4 0  9992", "line2": "2 53602  53.1587 243.4379 0001350  85.6943 274.4214 15.34405464231481"}];
  var TS = 240;                                  // time-lapse: 1 s reale = 240 s simulati
  var MU = 398600.4418, RE_KM = 6371.0, EARTH_W = Math.PI * 2 / 86164;  // rotazione siderale
  var E0 = Date.now() / 1000;
  try {
    var _t0 = parseFloat(sessionStorage.getItem("orbitT0"));
    if (!(_t0 > 0)) { _t0 = E0; sessionStorage.setItem("orbitT0", String(_t0)); }
    E0 = _t0;
  } catch (e) { /* session storage non disponibile */ }

  function parseTLE(s) {
    var l1 = s.line1, l2 = s.line2;
    var yy = parseInt(l1.substring(18, 20), 10);
    var yr = yy < 57 ? 2000 + yy : 1900 + yy;
    var doy = parseFloat(l1.substring(20, 32));
    var epoch = Date.UTC(yr, 0, 1) / 1000 + doy * 86400;
    return {
      name: s.name,
      incl: parseFloat(l2.substring(8, 16)) * Math.PI / 180,
      raan: parseFloat(l2.substring(17, 32)) * Math.PI / 180,
      argp: parseFloat(l2.substring(34, 42)) * Math.PI / 180,
      m0:   parseFloat(l2.substring(43, 51)) * Math.PI / 180,
      n:    parseFloat(l2.substring(52, 63)) * Math.PI * 2 / 86400,
      tau0: (E0 - epoch) * TS
    };
  }
  var SATS = [];
  for (var ti = 0; ti < TLES.length; ti++) {
    var ps = parseTLE(TLES[ti]);
    var aKm = Math.pow(MU / (ps.n * ps.n), 1 / 3);
    ps.rr = aKm / RE_KM;
    SATS.push(ps);
  }
  function simTau() { return (Date.now() / 1000 - E0) * TS; }
  function satU(s, tau) { return s.argp + s.m0 + s.n * (s.tau0 + tau); }

  // ECI -> schermo: x destra, nord in alto, profondita' positiva = dietro la sfera
  function satPosU(s, u) {
    var cu = Math.cos(u), su = Math.sin(u);
    var cO = Math.cos(s.raan), sO = Math.sin(s.raan);
    var ci = Math.cos(s.incl), si = Math.sin(s.incl);
    var r = s.rr * R;
    return proj((cO * cu - sO * su * ci) * r, -(su * si) * r, (sO * cu + cO * su * ci) * r);
  }

  // ruota la griglia insieme alla Terra (asse nord-sud)
  function rotG(p) {
    var c = Math.cos(ROT), s = Math.sin(ROT);
    return [p[0] * c + p[2] * s, p[1], p[2] * c - p[0] * s];
  }

  function isStarlink(s) { return s.name.indexOf("STARLINK") === 0; }

  function drawSat(s, tau) {
    var u = satU(s, tau);
    // scie corte: puntini in moto, non treni
    var span = 0.10, N = 5, maxA = 0.35;
    if (isStarlink(s)) { span = 0.05; N = 2; maxA = 0.22; }
    var prev = null;
    for (var k = -N; k <= N; k++) {
      var p = satPosU(s, u + k * span / N);
      if (behindGlobe(p)) { prev = null; continue; }
      if (prev) {
        x.strokeStyle = "rgba(111,140,255," + (maxA * (1 - Math.abs(k) / (N + 1))).toFixed(4) + ")";
        x.beginPath(); x.moveTo(prev.x, prev.y); x.lineTo(p.x, p.y); x.stroke();
      }
      prev = p;
    }
    var sat = satPosU(s, u);
    if (behindGlobe(sat)) return;
    if (s.name === "ISS (ZARYA)") {
      x.strokeStyle = "rgba(159,180,255,0.9)";
      x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(sat.x - 6, sat.y); x.lineTo(sat.x - 2.5, sat.y);
      x.moveTo(sat.x + 2.5, sat.y); x.lineTo(sat.x + 6, sat.y); x.stroke();
      x.fillStyle = "#f4f4f2";
      x.beginPath(); x.arc(sat.x, sat.y, 1.9, 0, Math.PI * 2); x.fill();
      x.fillStyle = "rgba(159,180,255,0.55)";
      x.font = "9px monospace";
      x.fillText("ISS", sat.x + 9, sat.y + 3);
    } else if (s.name === "SENTINEL-2A") {
      x.fillStyle = "#f4f4f2";
      x.beginPath(); x.arc(sat.x, sat.y, 2.4, 0, Math.PI * 2); x.fill();
      x.strokeStyle = "rgba(111,140,255,0.6)";
      x.beginPath(); x.arc(sat.x, sat.y, 6.5, 0, Math.PI * 2); x.stroke();
      x.fillStyle = "rgba(159,180,255,0.55)";
      x.font = "9px monospace";
      x.fillText("SENTINEL-2A", sat.x + 10, sat.y + 3);
    } else if (isStarlink(s)) {
      x.fillStyle = "rgba(244,244,242,0.75)";
      x.beginPath(); x.arc(sat.x, sat.y, 1.1, 0, Math.PI * 2); x.fill();
    } else {
      x.fillStyle = "#f4f4f2";
      x.beginPath(); x.arc(sat.x, sat.y, 2.2, 0, Math.PI * 2); x.fill();
      x.strokeStyle = "rgba(111,140,255,0.45)";
      x.beginPath(); x.arc(sat.x, sat.y, 5.5, 0, Math.PI * 2); x.stroke();
    }
  }
  var tick = 0;
  function draw() {
    ROT = EARTH_W * simTau();
    tick++;
    x.clearRect(0, 0, W, H);
    var now = (Date.now() / 1000 - E0) * 1000;
    var drift = (now * 0.004) % (W * 2);

    drawSky(drift, tick);

    x.lineWidth = 1;

    var glow = x.createRadialGradient(CX, CY, R * 0.82, CX, CY, R * 1.30);
    glow.addColorStop(0, "rgba(111,140,255,0.30)");
    glow.addColorStop(0.45, "rgba(111,140,255,0.10)");
    glow.addColorStop(1, "rgba(111,140,255,0)");
    x.fillStyle = glow;
    x.beginPath(); x.arc(CX, CY, R * 1.30, 0, Math.PI * 2); x.fill();

    drawPlanet();

    for (var m = 0; m < 12; m++) {
      var am = m / 12 * Math.PI;
      gridCircle(function (t2) {
        return rotG([Math.sin(t2) * R * Math.cos(am), Math.cos(t2) * R, Math.sin(t2) * R * Math.sin(am)]);
      }, 128);
    }
    for (var pa2 = 1; pa2 < 8; pa2++) {
      var phi = (pa2 / 8 - 0.5) * Math.PI;
      var r2 = R * Math.cos(phi), py = R * Math.sin(phi);
      gridCircle(function (t2) { return rotG([Math.sin(t2) * r2, py, Math.cos(t2) * r2]); }, 128);
    }

    // ---- satelliti reali dai TLE: velocita' e rotazione terrestre coerenti ----
    var tau = simTau();
    for (var si = 0; si < SATS.length; si++) drawSat(SATS[si], tau);

    requestAnimationFrame(draw);
  }
  draw();
})();

// ---------- reveal on scroll ----------
(function () {
  var io = new IntersectionObserver(function (entries) {
    var hit = [];
    for (var i = 0; i < entries.length; i++) if (entries[i].isIntersecting) hit.push(entries[i]);
    hit.sort(function (a, b) {
      return (a.target.compareDocumentPosition(b.target) & 2) ? -1 : 1;
    });
    hit.forEach(function (e, i) {
      e.target.style.transitionDelay = (i * 0.2) + "s";
      e.target.classList.add("on");
      io.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  document.querySelectorAll(".rv").forEach(function (el) { io.observe(el); });
})();

document.getElementById("year").textContent = new Date().getFullYear();
var _sent = document.getElementById("sent");
if (_sent && new URLSearchParams(window.location.search).get("sent") === "1") {
  _sent.classList.add("on");
}
