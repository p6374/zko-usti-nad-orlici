// ZKO Usti nad Orlici: simple client-side rendering of Pages CMS content.
(function () {
  "use strict";
  function normalize(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function applyTextItems(items) {
    if (!Array.isArray(items)) return;
    const changes = new Map();
    for (const item of items) {
      if (!item || typeof item.original !== "string" || typeof item.text !== "string") continue;
      const original = normalize(item.original);
      if (original && item.text.trim() && normalize(item.text) !== original) changes.set(original, item.text);
    }
    if (!changes.size) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const updates = [];
    while (walker.nextNode()) {
      const node = walker.currentNode, parent = node.parentElement;
      if (!parent || parent.closest("script,style,noscript,textarea,select,code,pre,[contenteditable]")) continue;
      const value = node.nodeValue, match = normalize(value), replacement = changes.get(match);
      if (replacement !== undefined) {
        const leading = (value.match(/^\s*/) || [""])[0];
        const trailing = (value.match(/\s*$/) || [""])[0];
        updates.push([node, leading + replacement + trailing]);
      }
    }
    for (const [node, replacement] of updates) node.nodeValue = replacement;
    const title = changes.get(normalize(document.title));
    if (title !== undefined) document.title = title;
  }
  function applyImage(selector, src, cssBackground) {
    if (typeof src !== "string" || !src.trim()) return;
    const element = document.querySelector(selector);
    if (!element) return;
    const url = src.trim();
    if (!url.startsWith("/") && !/^https:\/\//i.test(url)) return;
    if (cssBackground) {
      element.style.setProperty("background-image", "linear-gradient(180deg, rgba(17,29,21,.06), rgba(17,29,21,.49)), url(" + JSON.stringify(url) + ")", "important");
    } else if (element.tagName === "IMG") {
      element.src = url;
    } else {
      element.style.backgroundImage = "url(" + JSON.stringify(url) + ")";
    }
  }
  function applyPhotos(photos) {
    if (!photos || typeof photos !== "object") return;
    applyImage(".hero-photo", photos.uvod);
    applyImage(".course-public-banner", photos.kurzy, true);
    applyImage(".about-picture img", photos.onas);
    // Gallery images are buttons with background image and lightbox data.
    const gallery = document.querySelectorAll("#galerie .gallery-img");
    for (let i = 0; i < gallery.length; i++) {
      const src = photos["galerie" + (i + 1)];
      if (typeof src !== "string" || !src.trim()) continue;
      if (!src.startsWith("/") && !/^https:\/\//i.test(src)) continue;
      gallery[i].style.backgroundImage = "url(" + JSON.stringify(src) + ")";
      gallery[i].setAttribute("data-photo", src);
    }
  }
  async function readJSON(path) {
    const response = await fetch(path, {cache: "no-store"});
    if (!response.ok) return null;
    return response.json();
  }
  async function init() {
    try {
      const [texts, photos] = await Promise.all([
        readJSON("/content/texty.json"),
        readJSON("/content/fotky.json")
      ]);
      if (texts) applyTextItems(texts.items);
      if (photos) applyPhotos(photos);
      document.documentElement.dataset.zkoCms = "ready";
    } catch (error) {
      console.warn("ZKO CMS: Failed to load edits", error);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
