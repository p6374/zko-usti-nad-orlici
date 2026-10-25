// ZKO Ústí nad Orlicí: render the editable list of members, dogs and exams.
(function () {
  "use strict";
  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }
  function safeImage(value) {
    if (typeof value !== "string") return "";
    const url = value.trim();
    return /^(\/(?!\/)|https:\/\/)/i.test(url) ? url : "";
  }
  function slug(value) {
    return String(value || "").toLocaleLowerCase("cs-CZ").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "").slice(0, 90);
  }
  function parseMembers(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (entry) {
      return entry && typeof entry.jmeno === "string" && entry.jmeno.trim();
    }).map(function (entry, index) {
      const name = entry.jmeno.trim();
      const initials = name.split(/\s+/).slice(0, 2).map(function (part) { return part[0] || ""; }).join("").toLocaleUpperCase("cs-CZ");
      const dogs = Array.isArray(entry.psi) ? entry.psi.filter(function (dog) {
        return dog && typeof dog.jmeno === "string" && dog.jmeno.trim();
      }).map(function (dog) {
        return {
          name: dog.jmeno.trim(),
          sub: String(dog.plemeno || "").trim(),
          tests: String(dog.zkousky || "").split(/[,;\n]+/).map(function (test) { return test.trim(); }).filter(Boolean),
          awards: String(dog.vystavy || "").trim(),
          image: safeImage(dog.fotografie)
        };
      }) : [];
      return {id: slug(name) + "-" + index, name: name, initials: initials, photo: safeImage(entry.fotografie), dogs: dogs};
    });
  }
  function memberAvatar(member) {
    return member.photo ? '<span class="member-avatar" style="overflow:hidden;display:inline-flex;align-items:center;justify-content:center;"><img src="' + escapeHTML(member.photo) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;"></span>' : '<span class="member-avatar">' + escapeHTML(member.initials) + '</span>';
  }
  function renderCards() {
    const grid = document.querySelector("#membersGrid");
    const detail = document.querySelector("#memberDetail");
    const search = document.querySelector("#memberSearch");
    if (!grid || !detail || !search || typeof members === "undefined") return;
    const q = (search.value || "").toLocaleLowerCase("cs-CZ").trim();
    const subset = members.filter(function (member) {
      return (member.name + " " + member.dogs.map(function (dog) {
        return dog.name + " " + dog.tests.join(" ") + " " + dog.awards;
      }).join(" ")).toLocaleLowerCase("cs-CZ").includes(q);
    });
    if (subset.length && !subset.some(function (member) { return member.id === selected; })) selected = subset[0].id;
    grid.innerHTML = subset.length ? subset.map(function (member) {
      const count = member.dogs.length;
      const dogList = count ? member.dogs.map(function (dog) { return dog.name; }).join(", ") : "Profily psů a výsledky doplníme";
      return '<button type="button" class="member-card ' + (selected === member.id ? 'selected' : '') +
        '" data-member="' + escapeHTML(member.id) + '" aria-pressed="' + (selected === member.id) + '">' +
        '<span class="member-top">' + memberAvatar(member) +
        '<span><span class="member-name">' + escapeHTML(member.name) +
        '</span><small class="member-subtitle">Člen ZKO Ústí nad Orlicí</small></span></span>' +
        '<span class="member-dogs"><span>' + escapeHTML(dogList) + '</span></span>' +
        '<span class="member-bottom"><span>Zobrazit profil</span><span>↗</span></span></button>';
    }).join("") : '<div class="empty-members">Žádný člen neodpovídá hledání.</div>';
    if (!subset.length) { detail.innerHTML = ""; return; }
    const current = subset.find(function (member) { return member.id === selected; }) || subset[0];
    const records = current.dogs.length ? '<div class="dog-records">' + current.dogs.map(function (dog) {
      const photo = dog.image ?
        '<img ' + (dog.image === "/media/psi/attila.webp" ? 'style="object-fit:contain;background:#edf2eb;" ' : '') + 'src="' + escapeHTML(dog.image) + '" alt="Fotografie psa ' + escapeHTML(dog.name) + '" loading="lazy"/>' :
        '<span aria-label="Fotografie zatím nebyla přidána" style="display:flex;flex-shrink:0;align-items:center;justify-content:center;min-width:90px;min-height:90px;background:#e7eee7;border-radius:12px;color:#3a5d49;font-size:35px;">🐾</span>';
      const tests = dog.tests.length ? dog.tests.map(function (test) {
        return '<span class="exam-pill">' + escapeHTML(test) + '</span>';
      }).join("") : '<span class="breed">Zkoušky zatím neuvedeny</span>';
      const awards = dog.awards ? '<p class="breed" style="margin-top:8px;">' + escapeHTML(dog.awards) + '</p>' : '';
      return '<div class="dog-record">' + photo + '<div><h4>' + escapeHTML(dog.name) +
        '</h4><span class="breed">' + escapeHTML(dog.sub) + '</span><div class="exam-list">' + tests +
        '</div>' + awards + '</div></div>';
    }).join("") + '</div>' : '<div class="member-empty-profile"><span class="empty-profile-icon">＋</span><div>' +
      '<strong>Profil připraven k doplnění</strong><p>Psů a výsledků tohoto člena se zatím nikdo nedoplnil.</p></div></div>';
    detail.innerHTML = '<div class="member-detail-header">' + memberAvatar(current) +
      '<div><h3>' + escapeHTML(current.name) + '</h3><p>Profil člena ZKO Ústí nad Orlicí</p></div>' +
      '<span class="detail-meta">PSI A ZKOUŠKY</span></div>' + (current.photo ? '<figure class="member-profile-photo" style="margin:0;padding:20px;"><img src="' + escapeHTML(current.photo) + '" alt="' + escapeHTML(current.name) + ' se psem" loading="lazy" style="display:block;width:100%;height:480px;object-fit:contain;background:#edf2eb;border-radius:12px;"></figure>' : '') + (current.photo && !current.dogs.length ? '' : records);
  }
  async function init() {
    try {
      const response = await fetch("/content/clenove.json", {cache:"no-store"});
      if (!response.ok) return;
      const data = await response.json();
      if (!Array.isArray(data.clenove)) return;
      if (typeof members === "undefined" || !Array.isArray(members) ||
          typeof renderMembers !== "function" ||
          typeof selected === "undefined" ||
          !document.querySelector("#membersGrid")) {
        console.warn("ZKO CMS: member layout differs from expected template.");
        return;
      }
      const updated = parseMembers(data.clenove);
      members.splice(0, members.length, ...updated);
      if (members.length) selected = members[0].id;
      renderMembers = renderCards;
      renderMembers();
      const count = document.querySelector("#clenove .sample-label");
      if (count) count.textContent = members.length + (members.length === 1 ? " člen" : (members.length >= 2 && members.length <= 4 ? " členové" : " členů")) + " · profily psů";
      document.documentElement.dataset.zkoMembers = "ready";
    } catch (error) {
      console.warn("ZKO CMS: unable to render members", error);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
