// The only runtime code on the page: the ARIA tabs and the click-to-load video.
document.documentElement.classList.add("js");

// Set once the demo is recorded and uploaded to YouTube (unlisted). The 11-character id only.
const DEMO_VIDEO_ID = "";

const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
function select(tab, focus) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  }
  if (focus) tab.focus();
}
tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => select(tab, false));
  tab.addEventListener("keydown", (e) => {
    const next = {
      ArrowRight: i + 1,
      ArrowLeft: i - 1,
      Home: 0,
      End: tabs.length - 1,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(tabs[(next + tabs.length) % tabs.length], true);
  });
});
if (tabs.length) select(tabs[0], false);

const slot = document.getElementById("demo");
if (slot) {
  if (!/^[\w-]{11}$/.test(DEMO_VIDEO_ID)) {
    slot.innerHTML = "";
    const soon = document.createElement("div");
    soon.className = "soon";
    soon.textContent = "The demo video is coming soon.";
    slot.append(soon);
  } else {
    slot.querySelector("button").addEventListener("click", () => {
      const frame = document.createElement("iframe");
      const q = new URLSearchParams({
        autoplay: "1",
        cc_load_policy: "1",
        rel: "0",
      });
      frame.src = `https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}?${q}`;
      frame.title = "StreamSouk demo video";
      frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      slot.replaceChildren(frame);
      frame.focus();
    });
  }
}
