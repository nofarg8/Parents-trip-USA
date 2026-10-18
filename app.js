/* מפת הזיכרונות — אתר סטטי: trip.json (המסלול והמקומות) + album.json (התמונות והמילים) */
(async function () {
  const [trip, album] = await Promise.all([fetch("trip.json").then((r) => r.json()), fetch("album.json").then((r) => r.json())]);
  const SOLO_START = "2026-10-12";
  const he = (d) => new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(d + "T12:00:00Z"));
  const dayLabel = (d) => (d.date >= SOLO_START ? `לבד בניו יורק · יום ${Math.round((Date.UTC(2026, 9, +d.date.slice(8)) - Date.UTC(2026, 9, 12)) / 864e5) + 1}` : `יום ${d.dayNo}`);

  // ---- data: סידור הזיכרונות לפי מקום
  const siteById = {}; const dayOfSite = {};
  trip.days.forEach((d) => d.sites.forEach((s) => { siteById[s.id] = s; dayOfSite[s.id] = d; }));
  // "תחנות": כל (יום, מקום) שיש בו זיכרון, בסדר המסלול — לפי התאריך של הזיכרון, לא של המקום בתוכנית
  const memsByKey = {};
  album.memories.forEach((m) => { (memsByKey[m.date + "|" + m.siteId] ||= []).push(m); });
  const stops = [];
  trip.days.forEach((d) => d.sites.forEach((s) => { const mems = memsByKey[d.date + "|" + s.id]; if (mems && s.lat && s.lng) stops.push({ day: d, site: s, mems }); }));
  const photosTotal = album.memories.reduce((n, m) => n + m.local.length, 0);
  document.getElementById("stat").textContent = `${stops.length} מקומות · ${photosTotal.toLocaleString("he-IL")} תמונות · ${new Set(stops.map((s) => s.day.date)).size} ימים`;

  // ---- map
  const map = L.map("map", { zoomControl: false, worldCopyJump: true }).setView([39, -98], 4);
  L.control.zoom({ position: "bottomleft" }).addTo(map);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }).addTo(map);
  L.polyline(stops.map((s) => [s.site.lat, s.site.lng]), { color: "#1d3a6e", weight: 2.5, opacity: .55, dashArray: "6 8" }).addTo(map);
  const markers = stops.map((st, i) => {
    const icon = L.divIcon({ className: "", html: `<div class="pin" data-i="${i}"><span>${st.day.dayNo}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 30] });
    return L.marker([st.site.lat, st.site.lng], { icon, title: st.site.name }).addTo(map).on("click", () => open(i, true));
  });
  map.fitBounds(L.latLngBounds(stops.map((s) => [s.site.lat, s.site.lng])), { padding: [40, 40] });

  // ---- רשימת הימים
  const daysEl = document.getElementById("days");
  trip.days.forEach((d) => {
    const dayStops = stops.filter((s) => s.day.date === d.date);
    const photos = dayStops.reduce((n, s) => n + s.mems.reduce((k, m) => k + m.local.length, 0), 0);
    const el = document.createElement("div");
    el.className = "day" + (dayStops.length ? "" : " empty"); el.dataset.date = d.date;
    el.innerHTML = `<div class="day-no">${d.dayNo}<small>${d.date.slice(8)}.${+d.date.slice(5, 7)}</small></div><div><div class="day-title">${d.title}</div><div class="day-meta">${he(d.date)}${dayStops.length ? ` · ${dayStops.length} מקומות · ${photos} תמונות` : " · אין תמונות"}</div></div>`;
    if (dayStops.length) el.onclick = () => { open(stops.indexOf(dayStops[0]), true); daysEl.classList.remove("open"); };
    daysEl.appendChild(el);
  });
  document.getElementById("daysBtn").onclick = () => daysEl.classList.toggle("open");

  // ---- כרטיס המקום
  const card = document.getElementById("card"); let cur = -1; let lbList = []; let lbIdx = 0;
  function open(i, fly) {
    cur = i; const st = stops[i];
    document.querySelectorAll(".pin.active").forEach((p) => p.classList.remove("active"));
    document.querySelector(`.pin[data-i="${i}"]`)?.classList.add("active");
    document.querySelectorAll(".day.active").forEach((d) => d.classList.remove("active"));
    const dayEl = daysEl.querySelector(`.day[data-date="${st.day.date}"]`); dayEl?.classList.add("active"); dayEl?.scrollIntoView({ block: "nearest" });
    document.getElementById("cardDay").textContent = `${dayLabel(st.day)} · ${he(st.day.date)} · ${st.day.city}`;
    document.getElementById("cardTitle").textContent = st.site.name;
    document.getElementById("cardSub").textContent = st.site.nameEn || "";
    const photos = st.mems.flatMap((m) => m.local); lbList = photos;
    const g = document.getElementById("gallery"); g.innerHTML = "";
    photos.slice(0, 12).forEach((p, k) => { const im = new Image(); im.src = p; im.loading = "lazy"; im.alt = st.site.name; im.onclick = () => lb(k); g.appendChild(im); });
    if (photos.length > 12) { const more = document.createElement("div"); more.className = "more"; more.textContent = `+${photos.length - 12}`; more.onclick = () => lb(12); g.appendChild(more); }
    const t = document.getElementById("texts"); t.innerHTML = "";
    st.mems.filter((m) => m.text && m.text.trim()).forEach((m) => { const p = document.createElement("p"); p.textContent = m.text.trim(); const by = document.createElement("div"); by.className = "by"; by.textContent = "— " + (m.author === "הממליץ המקומי" ? "מהתמונות" : m.author); t.append(p, by); });
    card.classList.remove("hidden");
    if (fly) map.flyTo([st.site.lat, st.site.lng], Math.max(map.getZoom(), 11), { duration: 1.2 });
    history.replaceState(null, "", "#" + st.site.id);
  }
  document.getElementById("cardClose").onclick = () => { card.classList.add("hidden"); stopTour(); };
  document.getElementById("prevBtn").onclick = () => open((cur - 1 + stops.length) % stops.length, true);
  document.getElementById("nextBtn").onclick = () => open((cur + 1) % stops.length, true);

  // ---- סיור אוטומטי
  let timer = null, paused = false;
  const tourbar = document.getElementById("tourbar");
  function step(dir) { open(cur < 0 ? 0 : (cur + dir + stops.length) % stops.length, true); document.getElementById("tourPos").textContent = `${cur + 1} / ${stops.length}`; }
  function schedule() { clearTimeout(timer); if (!paused) timer = setTimeout(() => { step(1); schedule(); }, 7000); }
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
  document.addEventListener("keydown", (e) => {
    if (!lbEl.classList.contains("hidden")) { if (e.key === "Escape") lbEl.classList.add("hidden"); if (e.key === "ArrowLeft") lb((lbIdx + 1) % lbList.length); if (e.key === "ArrowRight") lb((lbIdx - 1 + lbList.length) % lbList.length); }
    else if (cur >= 0) { if (e.key === "ArrowLeft") open((cur + 1) % stops.length, true); if (e.key === "ArrowRight") open((cur - 1 + stops.length) % stops.length, true); }
  });

  // קישור ישיר למקום (#site-id)
  const h = location.hash.slice(1); const hi = stops.findIndex((s) => s.site.id === h); if (hi >= 0) open(hi, true);
})();
