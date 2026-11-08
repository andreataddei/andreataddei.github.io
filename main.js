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
  var TW = 2048, TH = 1024, TWm = TW - 1, THm = TH - 1;

  var _rsT = 0, _rsFirst = true;
  function scheduleSphere() {
    if (_rsT) return;
    _rsT = setTimeout(function () { _rsT = 0; rebuildSphere(); }, 150);
  }
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    c.width = Math.round(W * DPR); c.height = Math.round(H * DPR);
    c.style.width = W + "px"; c.style.height = H + "px";
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    CX = W * 0.78; CY = H * 0.42;
    R = Math.min(W, H) * 0.30;
    if (_rsFirst) { _rsFirst = false; rebuildSphere(); }
    else scheduleSphere();
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
      // blur 3x3 separabile (orizzontale + verticale = stessa media dei 9 vicini,
      // 6 letture invece di 9) e a blocchi di righe via setTimeout: niente long task
      var blur = new Uint8Array(TW * TH);
      var tmp = new Uint8Array(TW * TH);
      var by = 0, pass = 0;
      function blurStep() {
        var end = Math.min(TH, by + 128);
        for (; by < end; by++) {
          var yu = by > 0 ? by - 1 : 0, yd = by < THm ? by + 1 : THm;
          var ro = by * TW, ru = yu * TW, rd = yd * TW;
          for (var xx = 0; xx < TW; xx++) {
            var xl = xx > 0 ? xx - 1 : 0, xr = xx < TWm ? xx + 1 : TWm;
            if (pass === 0) {
              tmp[ro + xx] = (lum[ro + xl] + lum[ro + xx] + lum[ro + xr]) / 3;
            } else {
              blur[ro + xx] = (tmp[ru + xx] + tmp[ro + xx] + tmp[rd + xx]) / 3;
            }
          }
        }
        if (by < TH) { setTimeout(blurStep, 0); return; }
        by = 0; pass++;
        if (pass === 1) { setTimeout(blurStep, 0); return; }
        tex.data = d; tex.lum = blur;
        tex.ready = true;
        rebuildSphere();
      }
      blurStep();
    } catch (e) { /* resta il fallback */ }
  }

  img.onload = buildTexture;
  img.onerror = function () { if (!triedCDN) { loadFromCDN(); } };
  img.crossOrigin = "anonymous";

  function loadFromRepo() {
    if (window.fetch) {
      fetch("/earth.txt").then(function (r) { return r.text(); }).then(function (b64) {
        img.src = "data:image/jpeg;base64," + b64.replace(/\s+/g, "");
      }).catch(function () { loadFromCDN(); });
    } else { loadFromCDN(); }
  }
  function loadFromCDN() {
    triedCDN = true;
    img.src = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_atmos_2048.jpg";
  }
  loadFromRepo();

  function rebuildSphere() {
    var S = Math.max(64, Math.min(768, Math.round(R * 2 * DPR)));
    if (sphereC.width === S && pixLon) return; // stessa risoluzione: niente da rifare
    var nc = document.createElement("canvas");
    nc.width = nc.height = S;
    var nx2 = nc.getContext("2d");
    var nimg = nx2.createImageData(S, S);
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
    sphereC = nc; sphereX = nx2; sphereImg = nimg;
    texDirty = true; // riempi al prossimo frame: mai un frame con la sfera vuota
  }

  var texDirty = true;

  function drawPlanet() {
    if (tex.ready && sphereImg) {
      frame++;
      if (texDirty || frame % 6 === 0) {
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
    // (fillStyle fisso + globalAlpha: niente stringhe ricomposte per stella/frame)
    x.fillStyle = "#f4f4f2";
    for (var s2 = 0; s2 < 160; s2++) {
      var hx = (((s2 * 137.5077) % W) + drift * 0.5) % W;
      var hy = (s2 * 89.7233) % H;
      var tw = 0.35 + 0.25 * Math.sin(tick * 0.03 + s2 * 1.7);
      x.globalAlpha = tw;
      var sz = s2 % 11 === 0 ? 1.4 : 0.8;
      x.fillRect(hx, hy, sz, sz);
      x.fillRect((hx + W / 2) % W, (hy + H * 0.37) % H, 0.8, 0.8);
    }
    x.globalAlpha = 1;
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
            x.globalAlpha = 0.10 * tw2;
            x.beginPath(); x.arc(px, py, rad * 3.2, 0, Math.PI * 2); x.fill();
          }
          x.globalAlpha = 0.95 * tw2;
          x.beginPath(); x.arc(px, py, rad, 0, Math.PI * 2); x.fill();
        }
        x.globalAlpha = 1;
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
  var TLES = [{"name":"ISS (ZARYA)","line1":"1 25544U 98067A   26305.53114906  .00006056  00000+0  11739-3 0  9995","line2":"2 25544  51.6332 340.4448 0007086 335.8887  24.1768 15.49140542593046"}, {"name":"SENTINEL-1A","line1":"1 39634U 14016A   26305.81906289  .00000009  00000+0  11391-4 0  9993","line2":"2 39634  98.1595 311.1773 0001369  81.4160 278.7195 14.59844583670098"}, {"name":"SENTINEL-2A","line1":"1 40697U 15028A   26305.83695251 -.00000042  00000+0  52183-6 0  9998","line2":"2 40697  98.5618  18.6712 0001130  94.9973 265.1338 14.30817297593418"}, {"name":"SENTINEL-2B","line1":"1 42063U 17013A   26305.82989692  .00000025  00000+0  26083-4 0  9995","line2":"2 42063  98.5724  18.6361 0001116  92.0183 268.1128 14.30817008504323"}, {"name":"SENTINEL-2C","line1":"1 60989U 24157A   26305.65502439  .00000062  00000+0  40478-4 0  9995","line2":"2 60989  98.5674  18.4601 0000884  95.9204 264.2079 14.30824132112644"}, {"name":"SENTINEL-3A","line1":"1 41335U 16011A   26305.81132564  .00000041  00000+0  35180-4 0  9996","line2":"2 41335  98.6312  11.2010 0001273  91.2881 268.8445 14.26733048557680"}, {"name":"SENTINEL-3B","line1":"1 43437U 18039A   26305.43380110  .00000041  00000+0  35015-4 0  9990","line2":"2 43437  98.6315  10.9774 0000577 110.0041 250.1201 14.26732490443694"}, {"name":"SENTINEL-6A","line1":"1 46984U 20086A   26305.42105404 -.00000053  00000+0  34492-4 0  9997","line2":"2 46984  66.0411 210.0116 0007749 269.7887  90.2241 12.80930339277907"}, {"name":"LANDSAT 8","line1":"1 39084U 13008A   26305.77645392  .00000178  00000+0  49507-4 0  9999","line2":"2 39084  98.2162  14.1682 0001304  90.9492 269.1856 14.57103021717935"}, {"name":"LANDSAT 9","line1":"1 49260U 21088A   26305.67342727  .00000200  00000+0  54505-4 0  9998","line2":"2 49260  98.2142  14.0783 0001191  84.4430 275.6904 14.57103633271025"}, {"name":"TERRA","line1":"1 25994U 99068A   26305.61165985  .00000192  00000+0  48021-4 0  9998","line2":"2 25994  97.9286 349.5926 0003127 133.8288  17.5733 14.61187186429673"}, {"name":"AQUA","line1":"1 27424U 02022A   26305.86820906  .00000476  00000+0  10421-3 0  9997","line2":"2 27424  98.4475 278.0402 0000866 100.1385 289.8463 14.62258910303395"}, {"name":"SUOMI NPP","line1":"1 37849U 11061A   26305.85767281  .00000058  00000+0  48385-4 0  9994","line2":"2 37849  98.8094 245.8609 0000917 322.4032  37.7080 14.19542344777977"}, {"name":"NOAA 20 (JPSS-1)","line1":"1 43013U 17073A   26305.80112089  .00000059  00000+0  49026-4 0  9992","line2":"2 43013  98.7904 244.1022 0000651 138.6986 221.4239 14.19534287463996"}, {"name":"ICESAT-2","line1":"1 43613U 18070A   26305.79185387  .00001681  00000+0  60889-4 0  9997","line2":"2 43613  91.9950 328.0883 0001824  17.8115 342.3198 15.28281905453476"}, {"name":"GPM-CORE","line1":"1 39574U 14009C   26305.76925713  .00008984  00000+0  19685-3 0  9998","line2":"2 39574  64.9701 207.1076 0011832 253.9591 106.0246 15.44599776719068"}, {"name":"STARLINK-1008","line1":"1 44714U 19074B   26305.74339753  .00131187  00000+0  11211-2 0  9996","line2":"2 44714  53.1448 119.6177 0001915 181.9689 178.1321 15.68589757385692"}, {"name":"STARLINK-1167","line1":"1 45071U 20006AD  26305.91670139  .01444977  00000+0  21688-1 0  9998","line2":"2 45071  53.1483 219.6038 0001942  80.8586 226.1745 15.51677755  5969"}, {"name":"STARLINK-1226","line1":"1 45229U 20012BD  26305.36507424  .00051583  00000+0  47751-3 0  9992","line2":"2 45229  53.1465 310.3716 0001938  77.4123 282.7110 15.67027167372054"}, {"name":"STARLINK-1308","line1":"1 45419U 20019BM  26305.64363274  .00142425  00000+0  54308-3 0  9996","line2":"2 45419  53.0367  63.6600 0002476  25.3498 334.7647 15.86624281366855"}, {"name":"STARLINK-1456","line1":"1 45673U 20035S   26305.83335647  .00277747  41269-4  70561-3 0  9992","line2":"2 45673  53.0321 312.9325 0004924  53.3941  29.4917 15.94980342  6058"}, {"name":"STARLINK-1478","line1":"1 45755U 20038AB  26305.61446016  .01787996  11897-4  71943-3 0  9997","line2":"2 45755  53.0253  95.6858 0008427 306.9986  53.0281 16.22733022354097"}, {"name":"STARLINK-1564","line1":"1 46058U 20055AH  26305.68434722  .00040269  00000+0  10435-2 0  9992","line2":"2 46058  53.1597  91.8514 0001356  38.9995 321.1107 15.38662988345374"}, {"name":"STARLINK-1802","line1":"1 46702U 20073AJ  26305.83335647  .01387927  00000+0  11308-1 0  9996","line2":"2 46702  53.1504 176.6488 0002352  83.1092 244.0009 15.67496430  5957"}];
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
      e.target.style.transitionDelay = (i * 0.12) + "s";
      e.target.classList.add("on");
      io.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  window.observeRv = function (root) {
    (root || document).querySelectorAll(".rv").forEach(function (el) { io.observe(el); });
  };
  window.observeRv(document);
})();

document.getElementById("year").textContent = new Date().getFullYear();
var _sent = document.getElementById("sent");
if (_sent && new URLSearchParams(window.location.search).get("sent") === "1") {
  _sent.classList.add("on");
}

// ---------- form contatti: invio AJAX a Formspree, redirect alla thank-you page ----------
// Il redirect _next e' una feature dei piani a pagamento: sul free l'invio via fetch
// (endpoint JSON) non reindirizza, quindi portiamo l'utente noi sulla nostra pagina.
(function () {
  if (!window.fetch) return; // senza JS: POST classico, la thank-you page di Formspree
  var busy = false;
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (!f || f.id !== "cform") return;
    if (busy) { e.preventDefault(); return; }
    busy = true;
    e.preventDefault();
    var btn = f.querySelector("button");
    if (btn) btn.disabled = true;
    fetch(f.getAttribute("action"), {
      method: "POST",
      body: new FormData(f),
      headers: { "Accept": "application/json" }
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      location.href = "/thank-you.html";
    }).catch(function () {
      busy = false;
      if (btn) btn.disabled = false;
      f.submit(); // fallback: POST classico verso Formspree
    });
  });
})();

// ---------- navigazione SPA: il canvas resta vivo tra le pagine ----------
(function () {
  if (!window.fetch || !window.DOMParser || !window.history || !history.pushState) return;

  function norm(p) {
    if (p === "/" || p === "/index.html") return "/";
    return p;
  }
  function mainWrap() {
    return document.querySelector("nav + .wrap");
  }
  function updateNav(path) {
    var cur = norm(path);
    document.querySelectorAll("nav ul a").forEach(function (a) {
      if (norm(new URL(a.getAttribute("href"), location.href).pathname) === cur) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });
  }
  function swapTo(path, push) {
    fetch(path, { headers: { "X-SPA": "1" } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var next = doc.querySelector("nav + .wrap");
        var cur = mainWrap();
        if (!next || !cur) { location.href = path; return; }
        var ft = document.querySelector("footer");
        var ftTop = null;
        if (ft && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
          ftTop = ft.getBoundingClientRect().top; // FLIP: posizione Y prima dello swap
        }
        cur.replaceWith(document.importNode(next, true));
        if (ft && ftTop !== null) {
          var dy = ftTop - ft.getBoundingClientRect().top;
          if (Math.abs(dy) > 2) {
            ft.style.transition = "none";
            ft.style.transform = "translateY(" + dy + "px)"; // dov'era prima
            void ft.offsetHeight;
            ft.style.transition = "transform .55s cubic-bezier(.22,1,.36,1)";
            ft.style.transform = ""; // scivola nella nuova posizione
            ft.addEventListener("transitionend", function h(ev) {
              if (ev.target === ft && ev.propertyName === "transform") {
                ft.style.transition = "";
                ft.removeEventListener("transitionend", h);
              }
            });
          }
        }
        document.title = doc.title;
        var meta = doc.querySelector('meta[name="description"]');
        var curMeta = document.querySelector('meta[name="description"]');
        if (meta && curMeta) curMeta.setAttribute("content", meta.getAttribute("content"));
        if (push) history.pushState({}, "", path);
        updateNav(new URL(path, location.href).pathname);
        window.scrollTo(0, 0);
        window.observeRv(mainWrap());
        window.initLexicon && window.initLexicon();
        window.initStory && window.initStory();
        var sent = document.getElementById("sent");
        if (sent && new URLSearchParams(new URL(path, location.href).search).get("sent") === "1") {
          sent.classList.add("on");
        }
      })
      .catch(function () { location.href = path; }); // fallback: pagina intera
  }

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest("a") : null;
    if (!a) return;
    var href = a.getAttribute("href");
    if (!href || a.target === "_blank" || href.charAt(0) === "#" || /^(mailto|tel):/i.test(href)) return;
    var url = new URL(href, location.href);
    if (url.origin !== location.origin) return;
    if (!/\.html$|^\/$/.test(url.pathname)) return; // directory/asset: lascia al browser
    if (norm(url.pathname) === norm(location.pathname)) return; // stesso documento: anchor default
    e.preventDefault();
    swapTo(url.pathname + url.search, true);
  });

  window.addEventListener("popstate", function () {
    swapTo(location.pathname + location.search, false);
  });
})();
// ---------- Lexicon: pagina AI Lexicon (initLexicon gira al load e a ogni swap SPA) ----------
// I dati (904 termini) stanno in lexicon-data.js e vengono caricati solo quando
// serve: la pagina pesa poco anche navigando via SPA, e main.js resta snello.
window.initLexicon = function () {
  var root = document.getElementById("lexList");
  if (!root || root.dataset.lexReady) return;
  root.dataset.lexReady = "1";

  function build() {
    var D = window.LEXICON_DATA;
    var LV = { Beginner: "#62d9f5", Advanced: "#6f8cff", Expert: "#c99bff" };
    var azEl = document.getElementById("lexAz"),
        countEl = document.getElementById("lexCount"),
        emptyEl = document.getElementById("lexEmpty"),
        searchEl = document.getElementById("lexSearch"),
        topicSel = document.getElementById("lexTopic"),
        sortSel = document.getElementById("lexSort");
    var activeLv = { Beginner: true, Advanced: true, Expert: true };
    var q = "", topic = "", sort = "az";

    D.topics.forEach(function (t) {
      var o = document.createElement("option");
      o.value = t; o.textContent = t; topicSel.appendChild(o);
    });

    function esc(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    function hi(t) {
      if (!q) return esc(t);
      var i = t.toLowerCase().indexOf(q);
      if (i < 0) return esc(t);
      return esc(t.slice(0, i)) + "<mark>" + esc(t.slice(i, i + q.length)) + "</mark>" + esc(t.slice(i + q.length));
    }

    function render() {
      var items = D.terms.map(function (t, i) { return { t: t, i: i }; }).filter(function (o) {
        return activeLv[o.t[5]] && (!topic || o.t[4] === topic) &&
          (!q || (o.t[0] + " " + o.t[1]).toLowerCase().indexOf(q) !== -1);
      });
      var lvOrder = { Beginner: 0, Advanced: 1, Expert: 2 };
      if (sort === "az") items.sort(function (a, b) { return a.t[0].localeCompare(b.t[0]); });
      else if (sort === "year") items.sort(function (a, b) { return a.t[2] - b.t[2]; });
      else if (sort === "level") items.sort(function (a, b) { return lvOrder[a.t[5]] - lvOrder[b.t[5]] || a.t[0].localeCompare(b.t[0]); });
      else items.sort(function (a, b) { return a.t[4].localeCompare(b.t[4]) || a.t[0].localeCompare(b.t[0]); });

      var html = "", curKey = null;
      var letters = {};
      items.forEach(function (o) {
        var t = o.t;
        var K, id;
        if (sort === "az") { K = t[0][0].toUpperCase(); id = "L" + K; }
        else { K = sort === "year" ? t[2] : sort === "level" ? t[5] : t[4]; id = "K" + K; }
        if (sort === "az") letters[K] = true;
        if (K !== curKey) { html += '<div class="letter-head" id="' + esc(String(id)) + '">' + esc(String(K)) + "</div>"; curKey = K; }
        var c = LV[t[5]] || "var(--accent)";
        html += '<div class="term" style="--lc:' + c + '">' +
          '<span class="yr">' + t[2] + "</span>" +
          "<div><h3>" + hi(t[0]) + '</h3><span class="topic">' + esc(t[4]) + "</span><p>" + esc(t[1]) + "</p></div>" +
          '<span class="lv">' + t[5] + "</span></div>";
      });
      root.innerHTML = html;
      emptyEl.style.display = items.length ? "none" : "block";
      countEl.textContent = items.length + " / " + D.terms.length + " concepts";

      var AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", azHtml = "";
      for (var n = 0; n < AZ.length; n++) {
        azHtml += letters[AZ[n]]
          ? '<a href="#L' + AZ[n] + '">' + AZ[n] + "</a>"
          : '<a class="dim">' + AZ[n] + "</a>";
      }
      azEl.innerHTML = azHtml;
    }

    var deb = null;
    searchEl.addEventListener("input", function () {
      clearTimeout(deb);
      deb = setTimeout(function () { q = searchEl.value.trim().toLowerCase(); render(); }, 120);
    });
    topicSel.addEventListener("change", function () { topic = topicSel.value; render(); });
    sortSel.addEventListener("change", function () { sort = sortSel.value; render(); });
    document.querySelectorAll(".fbtn.lv").forEach(function (b) {
      b.addEventListener("click", function () {
        b.classList.toggle("active");
        activeLv[b.dataset.l] = b.classList.contains("active");
        render();
      });
    });
    azEl.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("a") : null;
      if (!a || !a.getAttribute("href") || a.getAttribute("href").charAt(0) !== "#") return;
      var el = document.getElementById(a.getAttribute("href").slice(1));
      if (!el) return;
      e.preventDefault();
      var c = document.querySelector(".lex-controls");
      var off = (c ? c.getBoundingClientRect().bottom : 60) + 14;
      window.scrollTo({
        top: el.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) - off,
        behavior: "smooth"
      });
    });
    document.getElementById("lexReset").addEventListener("click", function () {
      activeLv = { Beginner: true, Advanced: true, Expert: true };
      q = ""; topic = ""; sort = "az";
      searchEl.value = ""; topicSel.value = ""; sortSel.value = "az";
      document.querySelectorAll(".fbtn.lv").forEach(function (b) { b.classList.add("active"); });
      render();
    });
    render();
  }

  if (window.LEXICON_DATA) { build(); return; }
  var s = document.createElement("script");
  s.src = "/lexicon-data.js?v=1";
  s.onload = build;
  s.onerror = function () {
    emptyMsg();
  };
  document.head.appendChild(s);
  function emptyMsg() {
    var e = document.getElementById("lexEmpty");
    if (e) { e.textContent = "Could not load the lexicon data."; e.style.display = "block"; }
  }
};
window.initLexicon();

// ---------- Story: timeline AI (initStory gira al load e a ogni swap SPA) ----------
// I dati (101 momenti, 6 ere) stanno in story-data.js e vengono caricati solo
// quando serve, come per il Lexicon.
window.initStory = function () {
  var app = document.getElementById("stEras");
  if (!app || app.dataset.stReady) return;
  app.dataset.stReady = "1";

  function build() {
    var D = window.STORY_DATA;
    var nav = document.getElementById("stEraNav"),
        countEl = document.getElementById("stCount"),
        emptyEl = document.getElementById("stEmpty"),
        searchEl = document.getElementById("stSearch");
    var active = {}, q = "";
    Object.keys(D.TYPES).forEach(function (k) { active[k] = true; });

    function esc(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    function hi(t) {
      if (!q) return esc(t);
      var i = t.toLowerCase().indexOf(q);
      if (i < 0) return esc(t);
      return esc(t.slice(0, i)) + "<mark>" + esc(t.slice(i, i + q.length)) + "</mark>" + esc(t.slice(i + q.length));
    }

    function render() {
      var total = 0, html = "", visible = {};
      var ERAS = D.ERAS.slice().reverse(); // dalla più recente in alto
      ERAS.forEach(function (e) {
        var items = (D.DATA[e.id] || []).slice().reverse().filter(function (m) {
          return active[m[1]] && (!q || (m[2] + " " + m[3] + " " + m[1]).toLowerCase().indexOf(q) !== -1);
        });
        visible[e.id] = items.length;
        total += items.length;
        if (!items.length) return;
        html += '<section class="st-era" id="' + e.id + '">' +
          '<div class="st-era-years" style="color:' + e.color + '">' + e.years + '</div>' +
          '<h2>' + esc(e.name) + '</h2><p>' + esc(e.desc) + '</p>' +
          '<div class="st-timeline">' +
          items.map(function (m) {
            var c = D.TYPES[m[1]].color;
            return '<div class="st-item" style="--tc:' + c + '"><div class="st-card">' +
              '<div class="st-meta"><span class="yr">' + m[0] + '</span><span class="ty">' + D.TYPES[m[1]].label + '</span></div>' +
              '<h3>' + hi(m[2]) + '</h3><p>' + esc(m[3]) + '</p></div></div>';
          }).join("") + '</div></section>';
      });
      app.innerHTML = html;
      emptyEl.style.display = total ? "none" : "block";
      countEl.textContent = total + " of 101 moments";
      nav.innerHTML = ERAS.map(function (e) {
        return '<button data-era="' + e.id + '" style="--ec:' + e.color + '"' + (visible[e.id] ? "" : ' class="dim"') +
          ' type="button"><span class="dot"></span>' + esc(e.name) + ' <span class="yrs">' + e.years + '</span></button>';
      }).join("");
    }

    nav.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button[data-era]") : null;
      if (!b) return;
      var sec = document.getElementById(b.dataset.era);
      if (!sec) return;
      var c = document.querySelector(".st-controls");
      var off = (c ? c.getBoundingClientRect().bottom : 60) + 24;
      window.scrollTo({
        top: sec.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) - off,
        behavior: "smooth"
      });
    });
    document.querySelectorAll("#stFilters .fbtn[data-f]").forEach(function (b) {
      b.addEventListener("click", function () {
        b.classList.toggle("active");
        active[b.dataset.f] = b.classList.contains("active");
        render();
      });
    });
    document.getElementById("stReset").addEventListener("click", function () {
      Object.keys(D.TYPES).forEach(function (k) { active[k] = true; });
      q = "";
      searchEl.value = "";
      document.querySelectorAll("#stFilters .fbtn[data-f]").forEach(function (b) { b.classList.add("active"); });
      render();
    });
    var deb = null;
    searchEl.addEventListener("input", function () {
      clearTimeout(deb);
      deb = setTimeout(function () { q = searchEl.value.trim().toLowerCase(); render(); }, 120);
    });
    render();
  }

  if (window.STORY_DATA) { build(); return; }
  var s = document.createElement("script");
  s.src = "/story-data.js?v=1";
  s.onload = build;
  s.onerror = function () {
    var e = document.getElementById("stEmpty");
    if (e) { e.textContent = "Could not load the story data."; e.style.display = "block"; }
  };
  document.head.appendChild(s);
};
window.initStory();


/* ---------- Nav mobile: hamburger (iniettato da JS, nessun markup da mantenere) ---------- */
(function () {
  var nav = document.querySelector("nav");
  if (!nav || !nav.querySelector("ul")) return;
  var btn = document.createElement("button");
  btn.className = "navburger";
  btn.type = "button";
  btn.setAttribute("aria-label", "Menu");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = "<span></span><span></span><span></span>";
  nav.querySelector(".wrap").appendChild(btn);
  function setOpen(on) {
    nav.classList.toggle("open", on);
    btn.setAttribute("aria-expanded", on ? "true" : "false");
  }
  btn.addEventListener("click", function () {
    setOpen(!nav.classList.contains("open"));
  });
  nav.addEventListener("click", function (e) {
    if (e.target && e.target.closest && e.target.closest("ul a")) setOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setOpen(false);
  });
  window.addEventListener("resize", function () {
    if (window.innerWidth > 760) setOpen(false);
  });
})();
