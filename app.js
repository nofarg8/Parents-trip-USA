/* מפת הזיכרונות - אתר סטטי: trip.json (המסלול והמקומות) + album.json (התמונות והמילים)
   היחידה שמציגים היא *יום*: כרטיס אחד עם כל התמונות וכל המילים של אותו יום, מכל המקומות. */
(async function () {
  const V = (document.querySelector('script[src*="app.js"]')?.src.split("v=")[1]) || "0"; // גרסה: שלא יוצג JSON ישן מהמטמון
  const [trip, album] = await Promise.all([fetch("trip.json?v=" + V).then((r) => r.json()), fetch("album.json?v=" + V).then((r) => r.json())]);
  const SOLO_START = "2026-10-12";
  const he = (d) => new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(d + "T12:00:00Z"));
  // ימים לבד בניו יורק: הספירה של הטיול ממשיכה (יום 21-27), ומתחת בקטן "יום 1 לבד" (כמו באלבום המודפס)
  const soloNo = (d) => (d.date >= SOLO_START ? +d.date.slice(8) - 11 : 0);
  const dayLabel = (d) => (soloNo(d) ? `לבד בניו יורק · יום ${d.dayNo} <small class="solo-no">יום ${soloNo(d)} לבד</small>` : `יום ${d.dayNo}`);

  // ---- data: לכל יום - התחנות (מקומות עם זיכרון), כל התמונות וכל המילים
  const memsByKey = {};
  album.memories.forEach((m) => { (memsByKey[m.date + "|" + m.siteId] ||= []).push(m); });
  const days = trip.days.map((d) => {
    const stops = d.sites.filter((s) => memsByKey[d.date + "|" + s.id] && s.lat && s.lng).map((s) => ({ site: s, mems: memsByKey[d.date + "|" + s.id] }));
    // תמונת הנושא של היום (מקובץ המדריך) ראשונה, אחריה התמונות של ההורים
    const photos = [...stops.flatMap((st) => st.mems.flatMap((m) => m.lead || [])), ...stops.flatMap((st) => st.mems.flatMap((m) => m.local))];
    const texts = stops.flatMap((st) => st.mems.filter((m) => m.text && m.text.trim()).map((m) => ({ site: st.site.name, text: m.text.trim(), author: m.author })));
    return { ...d, stops, photos, texts };
  }).filter((d) => d.stops.length);
  const photosTotal = days.reduce((n, d) => n + d.photos.length, 0);
  document.getElementById("stat").textContent = `${days.length} ימים · ${days.reduce((n, d) => n + d.stops.length, 0)} מקומות · ${photosTotal.toLocaleString("he-IL")} תמונות`;

  // ---- map
  const map = L.map("map", { zoomControl: false, worldCopyJump: true }).setView([39, -98], 4);
  L.control.zoom({ position: "bottomleft" }).addTo(map);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }).addTo(map);
  const allPins = days.flatMap((d, di) => d.stops.map((st) => ({ d, di, st })));
  L.polyline(allPins.map((p) => [p.st.site.lat, p.st.site.lng]), { color: "#1d3a6e", weight: 2.5, opacity: .55, dashArray: "6 8" }).addTo(map);
  allPins.forEach((p) => {
    const icon = L.divIcon({ className: "", html: `<div class="pin" data-day="${p.di}"><span>${p.d.dayNo}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 30] });
    L.marker([p.st.site.lat, p.st.site.lng], { icon, title: p.st.site.name }).addTo(map).on("click", () => openDay(p.di, [p.st.site.lat, p.st.site.lng]));
  });
  map.fitBounds(L.latLngBounds(allPins.map((p) => [p.st.site.lat, p.st.site.lng])), { padding: [40, 40] });

  // ---- רשימת הימים (כולל ימים בלי תמונות, מעומעמים)
  const daysEl = document.getElementById("days");
  trip.days.forEach((d) => {
    const di = days.findIndex((x) => x.date === d.date);
    const el = document.createElement("div");
    el.className = "day" + (di < 0 ? " empty" : ""); el.dataset.date = d.date;
    const meta = di < 0 ? "אין תמונות" : `${days[di].stops.length} מקומות · ${days[di].photos.length} תמונות`;
    el.innerHTML = `<div class="day-no">${d.dayNo}<small>${+d.date.slice(8)}.${+d.date.slice(5, 7)}</small></div><div><div class="day-title">${d.title}</div><div class="day-meta">${soloNo(d) ? `לבד בניו יורק · יום ${soloNo(d)} לבד · ` : ""}${he(d.date)} · ${meta}</div></div>`;
    if (di >= 0) el.onclick = () => { openDay(di); daysEl.classList.remove("open"); };
    daysEl.appendChild(el);
  });
  document.getElementById("daysBtn").onclick = () => daysEl.classList.toggle("open");

  // ---- כרטיס היום
  const card = document.getElementById("card"); let cur = -1; let lbList = []; let lbIdx = 0;
  function openDay(di, flyTo) {
    cur = di; const d = days[di];
    document.querySelectorAll(".pin.active").forEach((p) => p.classList.remove("active"));
    document.querySelectorAll(`.pin[data-day="${di}"]`).forEach((p) => p.classList.add("active"));
    document.querySelectorAll(".day.active").forEach((x) => x.classList.remove("active"));
    const dayEl = daysEl.querySelector(`.day[data-date="${d.date}"]`); dayEl?.classList.add("active"); dayEl?.scrollIntoView({ block: "nearest" });
    document.getElementById("cardDay").innerHTML = `${dayLabel(d)} · ${he(d.date)} · ${d.city}`;
    document.getElementById("cardTitle").textContent = d.title;
    document.getElementById("cardSub").textContent = d.stops.map((st) => st.site.name).join(" · ") + ` · ${d.photos.length} תמונות`;
    lbList = d.photos;
    const g = document.getElementById("gallery"); g.innerHTML = "";
    const SHOW = 16;
    d.photos.slice(0, SHOW).forEach((p, k) => { const im = new Image(); im.src = p; im.loading = "lazy"; im.alt = d.title; im.onclick = () => lb(k); g.appendChild(im); });
    if (d.photos.length > SHOW) { const more = document.createElement("div"); more.className = "more"; more.textContent = `+${d.photos.length - SHOW}`; more.onclick = () => lb(SHOW); g.appendChild(more); }
    const t = document.getElementById("texts"); t.innerHTML = "";
    d.texts.forEach((x) => { const h = document.createElement("div"); h.className = "site-h"; h.textContent = "📍 " + x.site; const p = document.createElement("p"); p.textContent = x.text; t.append(h, p); });
    card.classList.remove("hidden"); card.scrollTop = 0;
    if (flyTo) map.flyTo(flyTo, Math.max(map.getZoom(), 11), { duration: 1.2 });
    else map.flyToBounds(L.latLngBounds(d.stops.map((st) => [st.site.lat, st.site.lng])), { padding: [60, 60], maxZoom: 12, duration: 1.2 });
    history.replaceState(null, "", "#" + d.date);
  }
  document.getElementById("cardClose").onclick = () => { card.classList.add("hidden"); stopTour(); };
  document.getElementById("prevBtn").onclick = () => openDay((cur - 1 + days.length) % days.length);
  document.getElementById("nextBtn").onclick = () => openDay((cur + 1) % days.length);

  // ---- סיור אוטומטי: יום אחרי יום
  let timer = null, paused = false;
  const tourbar = document.getElementById("tourbar");
  function step(dir) { openDay(cur < 0 ? 0 : (cur + dir + days.length) % days.length); document.getElementById("tourPos").textContent = `${cur + 1} / ${days.length}`; }
  function schedule() { clearTimeout(timer); if (!paused) timer = setTimeout(() => { step(1); schedule(); }, 9000); }
  function startTour() { tourbar.classList.remove("hidden"); paused = false; document.getElementById("tourPause").textContent = "⏸ השהיה"; cur = -1; step(1); schedule(); }
  function stopTour() { clearTimeout(timer); timer = null; tourbar.classList.add("hidden"); }
  document.getElementById("tourBtn").onclick = startTour;
  document.getElementById("tourStop").onclick = stopTour;
  document.getElementById("tourNext").onclick = () => { step(1); schedule(); };
  document.getElementById("tourPrev").onclick = () => { step(-1); schedule(); };
  document.getElementById("tourPause").onclick = (e) => { paused = !paused; e.target.textContent = paused ? "▶ המשך" : "⏸ השהיה"; schedule(); };

  // ---- תמונה מוגדלת
  const lbEl = document.getElementById("lightbox"), lbImg = document.getElementById("lbImg");
  function lb(k) { lbIdx = k; lbImg.src = lbList[k]; document.getElementById("lbCap").textContent = `${k + 1} / ${lbList.length}`; lbEl.classList.remove("hidden"); }
  document.getElementById("lbClose").onclick = () => lbEl.classList.add("hidden");
  document.getElementById("lbNext").onclick = () => lb((lbIdx + 1) % lbList.length);
  document.getElementById("lbPrev").onclick = () => lb((lbIdx - 1 + lbList.length) % lbList.length);
  lbEl.onclick = (e) => { if (e.target === lbEl) lbEl.classList.add("hidden"); };
  let touchX = null;
  lbEl.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lbEl.addEventListener("touchend", (e) => { if (touchX === null) return; const dx = e.changedTouches[0].clientX - touchX; touchX = null; if (Math.abs(dx) > 40) lb(dx < 0 ? (lbIdx + 1) % lbList.length : (lbIdx - 1 + lbList.length) % lbList.length); });
  document.addEventListener("keydown", (e) => {
    if (!lbEl.classList.contains("hidden")) { if (e.key === "Escape") lbEl.classList.add("hidden"); if (e.key === "ArrowLeft") lb((lbIdx + 1) % lbList.length); if (e.key === "ArrowRight") lb((lbIdx - 1 + lbList.length) % lbList.length); }
    else if (cur >= 0) { if (e.key === "ArrowLeft") openDay((cur + 1) % days.length); if (e.key === "ArrowRight") openDay((cur - 1 + days.length) % days.length); }
  });

  // קישור ישיר ליום (#2026-09-24)
  const h = location.hash.slice(1); const hi = days.findIndex((d) => d.date === h); if (hi >= 0) openDay(hi);
})();
