// @ts-nocheck
// Search Dropdowns 1.4.0, packaged into JP Trains.
// Called once from main.ts after the map is ready.
/**
 * Search Dropdowns — makes long Radix menus usable.
 *
 *  1. Caps tall dropdowns to a scrollable height. Two cases:
 *     - Radix Select (1.3.x + anything still using it): its
 *       max-h-(--radix-select-content-available-height) never resolves, so the
 *       content expands to full height and runs off-screen.
 *     - Radix DropdownMenu (1.4.x track/train builder selectors): ships
 *       `overflow-hidden` with no max-height, so a long list (e.g. the train-type
 *       selector with packs installed) grows past the screen and can't scroll.
 *  2. Adds a search box, pinned to the top of the list, so you can type to
 *     filter instead of scrolling dozens of options.
 *
 *  3. Route "Change train type" panel (1.4.x): once a route has stations the
 *     game locks the train-type dropdown and lists every possible type as a
 *     card ("Ready" / blocked). This adds a search box above those cards, and
 *     makes the greyed dropdown focus it, so you can type a name to filter the
 *     cards. Enter presses "Switch to" on the first Ready match; the arrow
 *     keys move between the Ready matches.
 *
 * Works across game versions: it targets the union of both DOM shapes, so
 * whichever the current build uses gets fixed and the other selectors are inert.
 */
export function initSearchDropdowns(): void {
  const api = window.SubwayBuilderAPI;
  const STYLE_ID = "search-dropdowns-style";
  const TAG = "[Search Dropdowns]";
  const VERSION = "1.4.0";
  const MIN_OPTIONS_FOR_SEARCH = 8; // skip search on short menus (shape, colour, …)

  const CONTENT_SEL =
    '[data-radix-menu-content],[data-slot="select-content"],[role="menu"],[role="listbox"]';
  const OPTION_SEL = '[role="menuitem"],[role="option"],[role="menuitemradio"],[role="menuitemcheckbox"]';
  const VIEWPORT_SEL = "[data-radix-select-viewport]";

  function injectCSS() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* 1.4.x Radix DropdownMenu: overflow-hidden + no max-height. */
      [data-radix-menu-content],
      [role="menu"] {
        max-height: min(60vh, 600px) !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        scrollbar-width: thin !important;
      }
      /* 1.3.x Radix Select. */
      [data-slot="select-content"],
      [role="listbox"] {
        max-height: min(60vh, 600px) !important;
      }
      [data-radix-select-viewport] {
        max-height: min(55vh, 560px) !important;
        overflow-y: auto !important;
        scrollbar-width: thin !important;
      }
      .sd-search {
        z-index: 50;
        flex: 0 0 auto; box-sizing: border-box;
        display: block;
        padding: 6px 8px; border: 0;
        border-bottom: 1px solid rgba(127,127,127,0.25);
        color: inherit; font: inherit; outline: none;
        border-radius: 4px 4px 0 0;
      }
      .sd-search::placeholder { opacity: 0.55; }
      .sd-empty {
        padding: 8px; opacity: 0.6; font-size: 0.9em; text-align: center;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // First non-transparent background up the tree, so the pinned box is opaque
  // and list items scrolling underneath it don't show through.
  function solidBackground(el) {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && c !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(c)) return c;
    }
    return "#1b1b1b";
  }

  const isVisible = (el) => el.style.display !== "none" && el.offsetParent !== null;

  function enhance(content) {
    if (content.querySelector(":scope > .sd-search")) return; // already done
    const options = () => [...content.querySelectorAll(OPTION_SEL)];
    if (options().length < MIN_OPTIONS_FOR_SEARCH) return;

    const viewport = content.querySelector(VIEWPORT_SEL);
    const scroller = viewport || content;

    const input = document.createElement("input");
    input.className = "sd-search";
    input.type = "text";
    input.placeholder = "Search…";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    input.style.background = solidBackground(content);

    const empty = document.createElement("div");
    empty.className = "sd-empty";
    empty.textContent = "No matches";
    empty.style.display = "none";

    if (viewport) {
      // Select: content is a flex column and only the viewport scrolls, so a
      // box placed before the viewport is naturally fixed above the list.
      input.style.width = "100%";
      content.insertBefore(input, viewport);
      viewport.appendChild(empty);
    } else {
      // DropdownMenu: content itself scrolls, so pin with sticky. Offset by the
      // content's padding so it sticks to the real top edge and covers the
      // full width — otherwise items peek above/beside it while scrolling.
      const cs = getComputedStyle(content);
      const pt = parseFloat(cs.paddingTop) || 0;
      const pl = parseFloat(cs.paddingLeft) || 0;
      const pr = parseFloat(cs.paddingRight) || 0;
      Object.assign(input.style, {
        position: "sticky",
        top: `-${pt}px`,
        marginTop: `-${pt}px`,
        marginLeft: `-${pl}px`,
        marginRight: `-${pr}px`,
        marginBottom: "2px",
        width: `calc(100% + ${pl + pr}px)`,
      });
      content.insertBefore(input, content.firstChild);
      content.appendChild(empty);
    }

    const visibleOptions = () => options().filter(isVisible);

    const filter = () => {
      const q = input.value.trim().toLowerCase();
      let shown = 0;
      for (const o of options()) {
        const match = !q || (o.textContent || "").toLowerCase().includes(q);
        o.style.display = match ? "" : "none";
        if (match) shown++;
      }
      // Hide separators while searching, and groups left with no matches.
      for (const s of content.querySelectorAll('[role="separator"]')) {
        s.style.display = q ? "none" : "";
      }
      for (const g of content.querySelectorAll('[role="group"]')) {
        const any = [...g.querySelectorAll(OPTION_SEL)].some((o) => o.style.display !== "none");
        g.style.display = any ? "" : "none";
      }
      empty.style.display = shown ? "none" : "";
      scroller.scrollTop = 0;
    };

    // Pick an option the same way a keyboard user would (works for both
    // Radix Menu items and Select items).
    const activate = (opt) => {
      opt.focus();
      opt.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    };

    input.addEventListener("input", filter);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape" || e.key === "Tab") return; // let Radix close/move
      e.stopPropagation(); // keep Radix type-ahead from hijacking our typing
      if (e.key === "ArrowDown") {
        e.preventDefault();
        visibleOptions()[0]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
      } else if (e.key === "Enter") {
        e.preventDefault();
        const first = visibleOptions()[0];
        if (first) activate(first);
      }
    });

    // Radix moves focus to items on hover. If the user keeps typing while an
    // item has focus, route the keystroke back into the search box instead of
    // letting Radix type-ahead jump around (or Space select an item).
    content.addEventListener(
      "keydown",
      (e) => {
        if (e.target === input || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === "ArrowUp" && e.target === visibleOptions()[0]) {
          e.preventDefault(); e.stopPropagation();
          input.focus();
          return;
        }
        const printable = e.key.length === 1 && (e.key !== " " || input.value);
        if (printable || e.key === "Backspace") {
          e.preventDefault(); e.stopPropagation();
          input.value = e.key === "Backspace" ? input.value.slice(0, -1) : input.value + e.key;
          input.focus();
          filter();
        }
      },
      true
    );

    // Keep clicks in the box from being treated as item/outside interactions.
    input.addEventListener("pointerdown", (e) => e.stopPropagation());
    input.addEventListener("focus", (e) => e.stopPropagation());

    // Radix focuses the content/first item on open; win the focus race so the
    // user can type immediately. Re-assert once in case Radix grabs it back.
    setTimeout(() => input.focus(), 60);
    setTimeout(() => { if (document.activeElement !== input) input.focus(); }, 180);
  }


  // ---- 3. Locked route train-type panel ---------------------------------
  // The game renders a disabled Select followed by one card per candidate type
  // (green = ready, red = blocked). Cards are plain divs next to the trigger.
  const SWITCH_TRIGGER_SEL = '[data-tutorial="route-train-type-selector"]';
  const SWITCH_CARD_SEL = '[class*="rounded-lg"][class*="p-2.5"]';

  const isReadyCard = (card) => /green-/.test(card.className);
  const cardButton = (card) => card.querySelector("button");

  function switchCards(container) {
    return [...container.querySelectorAll(":scope > div")].filter(
      (d) => d.matches(SWITCH_CARD_SEL) && /(green|red)-/.test(d.className)
    );
  }

  function applySwitchFilter(container, input, empty) {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    for (const card of switchCards(container)) {
      const name = (card.querySelector("span.flex-1")?.textContent || card.textContent || "").toLowerCase();
      const match = !q || name.includes(q) || (card.textContent || "").toLowerCase().includes(q);
      const want = match ? "" : "none";
      if (card.style.display !== want) card.style.display = want;
      if (match) shown++;
    }
    empty.style.display = shown ? "none" : "";
  }

  function enhanceSwitchPanel(trigger) {
    const container = trigger.parentElement;
    if (!container) return;
    const cards = switchCards(container);
    if (!trigger.disabled || cards.length === 0) {
      // Not locked (or no cards): remove anything we added, the normal Select
      // dropdown gets the regular search box.
      container.querySelectorAll(".sd-switch-search,.sd-switch-empty,.sd-switch-cover").forEach((n) => n.remove());
      return;
    }
    let input = container.querySelector(":scope > .sd-switch-search");
    let empty = container.querySelector(":scope > .sd-switch-empty");
    let cover = container.querySelector(":scope > .sd-switch-cover");
    if (!input) {
      input = document.createElement("input");
      input.className = "sd-search sd-switch-search";
      input.type = "text";
      input.placeholder = "Search train types\u2026 (Enter switches to the first ready match)";
      input.setAttribute("autocomplete", "off");
      input.setAttribute("spellcheck", "false");
      input.style.background = solidBackground(container);
      input.style.width = "100%";
      input.style.marginTop = "8px";
      input.style.border = "1px solid rgba(127,127,127,0.35)";
      input.style.borderRadius = "6px";

      empty = document.createElement("div");
      empty.className = "sd-empty sd-switch-empty";
      empty.textContent = "No matching train types";
      empty.style.display = "none";

      const readyButtons = () =>
        switchCards(container)
          .filter((c) => c.style.display !== "none" && isReadyCard(c))
          .map(cardButton)
          .filter(Boolean);

      input.addEventListener("input", () => applySwitchFilter(container, input, empty));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Escape" || e.key === "Tab") return;
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          readyButtons()[0]?.click();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          readyButtons()[0]?.focus();
        }
      });
      // Arrow keys between the visible ready cards; Up from the first one
      // returns to the search box.
      container.addEventListener("keydown", (e) => {
        if (e.target === input || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
        const btns = readyButtons();
        const i = btns.indexOf(e.target);
        if (i < 0) return;
        e.preventDefault();
        if (e.key === "ArrowDown") (btns[i + 1] || btns[i]).focus();
        else if (i === 0) input.focus();
        else btns[i - 1].focus();
      });
      input.addEventListener("pointerdown", (e) => e.stopPropagation());

      trigger.insertAdjacentElement("afterend", input);
      input.insertAdjacentElement("afterend", empty);
    }
    // Greyed dropdown: clicking it focuses the search box instead.
    if (getComputedStyle(container).position === "static") container.style.position = "relative";
    if (!cover) {
      cover = document.createElement("div");
      cover.className = "sd-switch-cover";
      cover.title = "Search train types";
      cover.addEventListener("click", () => input.focus());
      container.appendChild(cover);
    }
    Object.assign(cover.style, {
      position: "absolute",
      zIndex: "5",
      cursor: "text",
      left: trigger.offsetLeft + "px",
      top: trigger.offsetTop + "px",
      width: trigger.offsetWidth + "px",
      height: trigger.offsetHeight + "px",
    });
    // The game re-renders the cards as the route changes; keep the filter applied.
    applySwitchFilter(container, input, empty);
  }

  // Radix mounts a fresh content node each time a menu opens. Check every open
  // list (not just the first match, which could be some other menu on screen).
  function tick() {
    for (const content of document.querySelectorAll(CONTENT_SEL)) {
      // Select content and its inner listbox can both match; use the outermost.
      if (content.parentElement?.closest(CONTENT_SEL)) continue;
      try { enhance(content); } catch (e) { console.log(`${TAG} enhance error`, e); }
    }
  }

  function tickSwitch() {
    for (const trigger of document.querySelectorAll(SWITCH_TRIGGER_SEL)) {
      try { enhanceSwitchPanel(trigger); } catch (e) { console.log(`${TAG} switch panel error`, e); }
    }
  }

  injectCSS();
  setInterval(() => { tick(); tickSwitch(); }, 150);
  console.log(`${TAG} v${VERSION} loaded`);
}
