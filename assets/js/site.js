/* ==========================================================================
   Learning Trip — site vitrine
   Globe 3D canvas · simulateur de budget · formulaires leads · animations
   Aucune dépendance externe.
   ========================================================================== */
(function () {
  "use strict";

  var BASE = window.LT_BASE || "";
  var CFG = window.LT_CONFIG || {};
  var DESTS = window.LT_DESTINATIONS || [];
  /* ?noanim : désactive toutes les animations (accessibilité + tests QA) */
  var QA = /[?&]noanim/.test(window.location.search);
  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches || QA;
  if (REDUCED) document.documentElement.style.scrollBehavior = "auto";
  if (QA) document.documentElement.classList.add("qa");

  /* Seuils budgétaires par palier (fourchettes arrondies, volontairement
     distinctes de toute grille tarifaire — ne révèlent aucun prix). */
  var TIER_MIN = { 1: 1000, 2: 1100, 3: 1200, 4: 1350, 5: 1450, 6: 1550 };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ------------------------------------------------------------------------
     Navigation : fond au scroll, barre de progression, burger mobile
     ------------------------------------------------------------------------ */
  function initNav() {
    var nav = $(".nav");
    if (!nav) return;
    var progress = $(".nav-progress");
    var links = $(".nav-links");
    var burger = $(".nav-burger");

    function onScroll() {
      nav.classList.toggle("scrolled", window.scrollY > 30);
      if (progress) {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + "%";
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (burger && links) {
      burger.addEventListener("click", function () { links.classList.toggle("open"); });
      links.addEventListener("click", function () { links.classList.remove("open"); });
    }
  }

  /* ------------------------------------------------------------------------
     Apparitions au scroll + compteurs animés
     ------------------------------------------------------------------------ */
  function initReveal() {
    var els = $$(".reveal");
    if (!("IntersectionObserver" in window) || REDUCED) {
      els.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  function initCounters() {
    var els = $$("[data-count]");
    if (!els.length) return;
    function animate(el) {
      var target = parseInt(el.getAttribute("data-count"), 10);
      var suffix = el.getAttribute("data-suffix") || "";
      if (REDUCED) { el.textContent = target + suffix; return; }
      var t0 = null;
      function frame(t) {
        if (!t0) t0 = t;
        var p = Math.min((t - t0) / 1400, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { animate(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------------
     Globe 3D : points de continents + arcs Paris -> destinations
     ------------------------------------------------------------------------ */
  function initGlobe() {
    var canvas = $("#globe");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var PARIS = { lat: 48.8566, lng: 2.3522 };
    var TILT = -0.41;          /* ~23° d'inclinaison */
    var points = [];           /* nuage de points (continents si dispo) */
    var running = true;

    function latLngToVec(lat, lng) {
      var phi = (90 - lat) * Math.PI / 180;
      var theta = (lng + 180) * Math.PI / 180;
      return {
        x: -Math.sin(phi) * Math.cos(theta),
        y: Math.cos(phi),
        z: Math.sin(phi) * Math.sin(theta)
      };
    }

    if (window.LT_LAND && window.LT_LAND.length) {
      points = window.LT_LAND.map(function (p) { return latLngToVec(p[0], p[1]); });
    } else {
      /* repli : sphère uniforme (spirale de Fibonacci) */
      var N = 1400, golden = Math.PI * (3 - Math.sqrt(5));
      for (var i = 0; i < N; i++) {
        var y = 1 - (i / (N - 1)) * 2;
        var r = Math.sqrt(1 - y * y);
        var th = golden * i;
        points.push({ x: Math.cos(th) * r, y: y, z: Math.sin(th) * r });
      }
    }

    var cities = DESTS.map(function (d) {
      return { v: latLngToVec(d.lat, d.lng), slug: d.slug, ville: d.ville };
    });
    var paris = latLngToVec(PARIS.lat, PARIS.lng);

    /* arc = interpolation sphérique Paris -> ville, rayon gonflé au milieu */
    function arcPoints(a, b, n) {
      var dot = a.x * b.x + a.y * b.y + a.z * b.z;
      var omega = Math.acos(Math.max(-1, Math.min(1, dot)));
      var pts = [];
      for (var i = 0; i <= n; i++) {
        var t = i / n;
        var s1 = Math.sin((1 - t) * omega) / Math.sin(omega);
        var s2 = Math.sin(t * omega) / Math.sin(omega);
        var lift = 1 + 0.18 * Math.sin(Math.PI * t);
        pts.push({
          x: (s1 * a.x + s2 * b.x) * lift,
          y: (s1 * a.y + s2 * b.y) * lift,
          z: (s1 * a.z + s2 * b.z) * lift
        });
      }
      return pts;
    }
    var arcs = cities.map(function (c) { return arcPoints(paris, c.v, 64); });
    var arcCycle = 0;            /* index de l'arc en cours d'animation */
    var arcProgress = 0;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * DPR;
      canvas.height = rect.height * DPR;
    }
    resize();
    window.addEventListener("resize", resize);

    /* rotation : on amène la longitude de Paris face caméra au départ */
    var rotY = 2.1;

    function project(v, cx, cy, R, rot) {
      var x = v.x * Math.cos(rot) + v.z * Math.sin(rot);
      var z = -v.x * Math.sin(rot) + v.z * Math.cos(rot);
      var y = v.y;
      var y2 = y * Math.cos(TILT) - z * Math.sin(TILT);
      var z2 = y * Math.sin(TILT) + z * Math.cos(TILT);
      return { sx: cx + x * R, sy: cy - y2 * R, z: z2 };
    }

    function draw(t) {
      if (!running) return;
      var W = canvas.width, H = canvas.height;
      var cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.40;
      ctx.clearRect(0, 0, W, H);

      if (!REDUCED) rotY += 0.0016;

      /* halo */
      var g = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.35);
      g.addColorStop(0, "rgba(56,212,240,0.10)");
      g.addColorStop(1, "rgba(56,212,240,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      /* points (continents) */
      for (var i = 0; i < points.length; i++) {
        var p = project(points[i], cx, cy, R, rotY);
        if (p.z < -0.15) continue;
        var a = 0.18 + 0.6 * Math.max(0, p.z);
        ctx.fillStyle = "rgba(201,248,254," + a.toFixed(3) + ")";
        var s = (0.9 + p.z) * 1.1 * DPR;
        ctx.fillRect(p.sx, p.sy, s, s);
      }

      /* arc animé (un à la fois, en boucle) */
      if (!REDUCED && arcs.length) {
        arcProgress += 0.012;
        if (arcProgress >= 1.6) { arcProgress = 0; arcCycle = (arcCycle + 1) % arcs.length; }
        var arc = arcs[arcCycle];
        var head = Math.min(1, arcProgress) * (arc.length - 1);
        var tail = Math.max(0, (arcProgress - 0.45)) / 1.15 * (arc.length - 1);
        ctx.beginPath();
        var started = false;
        for (var j = Math.floor(tail); j <= head; j++) {
          var q = project(arc[j], cx, cy, R, rotY);
          if (q.z < -0.2) { started = false; continue; }
          if (!started) { ctx.moveTo(q.sx, q.sy); started = true; }
          else ctx.lineTo(q.sx, q.sy);
        }
        ctx.strokeStyle = "rgba(56,212,240,0.85)";
        ctx.lineWidth = 1.4 * DPR;
        ctx.stroke();
        /* comète en tête d'arc */
        var hp = project(arc[Math.floor(head)], cx, cy, R, rotY);
        if (hp.z > -0.2) {
          ctx.beginPath();
          ctx.arc(hp.sx, hp.sy, 2.6 * DPR, 0, Math.PI * 2);
          ctx.fillStyle = "#c9f8fe";
          ctx.fill();
        }
      }

      /* villes : pulsation */
      var pulse = REDUCED ? 0.5 : (Math.sin(t / 600) + 1) / 2;
      cities.forEach(function (c, idx) {
        var q = project(c.v, cx, cy, R, rotY);
        if (q.z < 0.05) return;
        var active = idx === arcCycle;
        ctx.beginPath();
        ctx.arc(q.sx, q.sy, (active ? 3.2 : 2) * DPR, 0, Math.PI * 2);
        ctx.fillStyle = active ? "#38d4f0" : "rgba(201,248,254,0.9)";
        ctx.fill();
        if (active) {
          ctx.beginPath();
          ctx.arc(q.sx, q.sy, (4 + pulse * 7) * DPR, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(56,212,240," + (0.6 - pulse * 0.5).toFixed(3) + ")";
          ctx.lineWidth = 1.2 * DPR;
          ctx.stroke();
          /* étiquette ville */
          ctx.font = (11 * DPR) + "px Poppins, sans-serif";
          ctx.fillStyle = "rgba(201,248,254,0.95)";
          ctx.fillText(c.ville, q.sx + 9 * DPR, q.sy - 7 * DPR);
        }
      });

      /* point Paris */
      var pq = project(paris, cx, cy, R, rotY);
      if (pq.z > 0.05) {
        ctx.beginPath();
        ctx.arc(pq.sx, pq.sy, 3 * DPR, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.font = "600 " + (11 * DPR) + "px Poppins, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillText("Paris", pq.sx + 8 * DPR, pq.sy + 4 * DPR);
      }

      requestAnimationFrame(draw);
    }

    /* économise la batterie : pause hors écran / onglet caché */
    var io = new IntersectionObserver(function (entries) {
      var visible = entries[0].isIntersecting;
      if (visible && !running) { running = true; requestAnimationFrame(draw); }
      else if (!visible) running = false;
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) running = false;
      else if (!running) { running = true; requestAnimationFrame(draw); }
    });

    requestAnimationFrame(draw);
  }

  /* ------------------------------------------------------------------------
     Filtres destinations (page d'accueil)
     ------------------------------------------------------------------------ */
  function initFilters() {
    var chips = $$("[data-filter]");
    if (!chips.length) return;
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        var f = chip.getAttribute("data-filter");
        $$(".dest-card[data-themes]").forEach(function (card) {
          var ok = f === "all" || card.getAttribute("data-themes").split(" ").indexOf(f) !== -1;
          card.classList.toggle("hidden", !ok);
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     Simulateur de budget
     ------------------------------------------------------------------------ */
  function initSimulator() {
    var range = $("#sim-range");
    if (!range) return;
    var valueEl = $("#sim-value");
    var resultsEl = $("#sim-results");
    var themeChips = $$("[data-sim-theme]");
    var selectedThemes = [];

    function fmt(n) { return n.toLocaleString("fr-FR"); }

    function updateFill() {
      var p = ((range.value - range.min) / (range.max - range.min)) * 100;
      range.style.setProperty("--fill", p + "%");
    }

    function compute() {
      var budget = parseInt(range.value, 10);
      valueEl.innerHTML = fmt(budget) + " €" +
        (parseInt(range.max, 10) === budget ? "<small> et +</small>" : "<small> / apprenti</small>");
      updateFill();

      var matches = DESTS.filter(function (d) { return budget >= (TIER_MIN[d.tier] || 9999); });

      matches.forEach(function (d) {
        var overlap = selectedThemes.length
          ? d.themes.filter(function (t) { return selectedThemes.indexOf(t) !== -1; }).length
          : 0;
        /* score d'affinité : thématiques d'abord, ambition du palier ensuite */
        d._score = 80 + overlap * 6 + d.tier * 1.5 + (d.themes.length === overlap && overlap ? 3 : 0);
        d._score = Math.min(98, Math.round(d._score));
        d._overlap = overlap;
      });
      matches.sort(function (a, b) {
        return (b._overlap - a._overlap) || (b.tier - a.tier) || (b._score - a._score);
      });

      var html = "";
      matches.slice(0, 4).forEach(function (d, i) {
        html += '<a class="sim-result" style="--d:' + (i * 0.09) + 's" href="' + BASE + d.url + '">'
          + '<img src="' + BASE + d.img + '" alt="' + d.ville + '" loading="lazy">'
          + '<span class="t"><b>' + d.ville + '</b><span>' + d.pays + " — " + d.baseline + "</span></span>"
          + '<span class="sim-match"><b>' + d._score + ' %</b><span>affinité</span>'
          + '<span class="sim-bar"><i style="--w:' + d._score + '%"></i></span></span>'
          + "</a>";
      });

      if (!matches.length) {
        html = '<div class="sim-empty reveal in">'
          + "<p><strong>Chaque budget a sa destination.</strong></p>"
          + "<p style=\"margin-top:.5rem\">Pour cette enveloppe, nos conseillers construisent des formats sur-mesure "
          + "(durée ajustée, destinations de proximité, co-financements mobilité). Parlons-en.</p>"
          + "</div>";
      } else if (matches.length > 4) {
        html += '<div class="sim-more">+ ' + (matches.length - 4)
          + " autre" + (matches.length - 4 > 1 ? "s" : "") + " destination"
          + (matches.length - 4 > 1 ? "s" : "") + " possible"
          + (matches.length - 4 > 1 ? "s" : "") + " avec ce budget — demandez la liste complète à un conseiller.</div>";
      }
      resultsEl.innerHTML = html;
    }

    range.addEventListener("input", compute);
    themeChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var t = chip.getAttribute("data-sim-theme");
        var idx = selectedThemes.indexOf(t);
        if (idx === -1) selectedThemes.push(t); else selectedThemes.splice(idx, 1);
        chip.classList.toggle("active");
        compute();
      });
    });
    compute();

    /* le CTA conseiller embarque le budget choisi dans la modale */
    $$("[data-open-modal='conseiller']").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var bd = $("#lead-budget");
        if (bd) bd.value = range.value;
      });
    });
  }

  /* ------------------------------------------------------------------------
     Modale + envoi des leads (Supabase REST, repli mailto)
     ------------------------------------------------------------------------ */
  var MODAL_COPY = {
    brochure: {
      titre: "Recevoir la brochure",
      texte: "Renseignez vos coordonnées : le téléchargement démarre immédiatement et un conseiller pourra vous accompagner."
    },
    conseiller: {
      titre: "Être rappelé par un conseiller",
      texte: "Laissez-nous vos coordonnées : nous revenons vers vous sous 24 h ouvrées avec des propositions adaptées."
    },
    programme: {
      titre: "Obtenir le programme détaillé",
      texte: "Le programme complet de ce séjour est réservé à nos partenaires. Recevez-le directement par e-mail."
    }
  };

  function initModalAndForms() {
    var modal = $("#lt-modal");
    if (!modal) return;
    var form = $("#lead-form", modal);
    var success = $(".form-success", modal);
    var errEl = $(".form-error", modal);
    var titleEl = $("#modal-title", modal);
    var textEl = $("#modal-text", modal);
    var sourceInput = $("#lead-source", modal);

    $$("[data-open-modal]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var source = btn.getAttribute("data-open-modal");
        var copy = MODAL_COPY[source] || MODAL_COPY.conseiller;
        titleEl.textContent = copy.titre;
        textEl.textContent = copy.texte;
        sourceInput.value = source;
        form.style.display = "";
        success.style.display = "none";
        errEl.style.display = "none";
        modal.showModal();
      });
    });

    $(".modal-close", modal).addEventListener("click", function () { modal.close(); });
    modal.addEventListener("click", function (e) {
      var r = modal.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) modal.close();
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      errEl.style.display = "none";

      if ($("#lead-hp", form).value) return;          /* honeypot anti-bot */
      if (!$("#lead-consent", form).checked) {
        errEl.textContent = "Merci de cocher la case de consentement pour que nous puissions vous recontacter.";
        errEl.style.display = "block";
        return;
      }

      var payload = {
        nom: $("#lead-nom", form).value.trim(),
        organisation: $("#lead-orga", form).value.trim() || null,
        email: $("#lead-email", form).value.trim(),
        telephone: $("#lead-tel", form).value.trim() || null,
        source: sourceInput.value,
        destination: (window.LT_PAGE_DEST || null),
        budget: $("#lead-budget", form).value ? parseInt($("#lead-budget", form).value, 10) : null,
        message: $("#lead-message", form).value.trim() || null,
        consent: true,
        user_agent: (navigator.userAgent || "").slice(0, 380)
      };

      var btn = $("button[type=submit]", form);
      btn.disabled = true;
      btn.textContent = "Envoi en cours…";

      sendLead(payload).then(function () {
        form.style.display = "none";
        success.style.display = "block";
        if (payload.source === "brochure") {
          var a = document.createElement("a");
          a.href = BASE + "assets/brochure/Brochure-Learning-Trip.pdf";
          a.download = "Brochure-Learning-Trip.pdf";
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      }).catch(function () {
        errEl.innerHTML = "L'envoi a échoué. Réessayez, ou contactez-nous directement : "
          + '<a href="mailto:' + (CFG.email || "contact@learningtrip.fr") + '">' + (CFG.email || "contact@learningtrip.fr") + "</a>"
          + (CFG.telephone ? " · " + CFG.telephone : "");
        errEl.style.display = "block";
      }).finally(function () {
        btn.disabled = false;
        btn.textContent = "Envoyer";
      });
    });
  }

  function sendLead(payload) {
    if (!CFG.supabaseUrl || !CFG.supabaseKey) {
      /* configuration absente : repli mailto pour ne perdre aucun lead */
      var body = Object.keys(payload).map(function (k) { return k + ": " + payload[k]; }).join("\n");
      window.location.href = "mailto:" + (CFG.email || "contact@learningtrip.fr")
        + "?subject=" + encodeURIComponent("[Site] Demande " + payload.source)
        + "&body=" + encodeURIComponent(body);
      return Promise.resolve();
    }
    return fetch(CFG.supabaseUrl + "/rest/v1/site_leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": CFG.supabaseKey,
        "Authorization": "Bearer " + CFG.supabaseKey,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
    });
  }

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initReveal();
    initCounters();
    initGlobe();
    initFilters();
    initSimulator();
    initModalAndForms();
    var y = $("#year");
    if (y) y.textContent = new Date().getFullYear();
  });
})();
