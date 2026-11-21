/**
 * JP Trains for Subway Builder
 * Entry point for the mod.
 */

import { trains } from './data/trains';

const MOD_ID = 'japanese-trains';
const MOD_VERSION = 'v5.5.4';
const TAG = '[Japanese Trains]';

// Strict Snap: a toolbar button toggles a multiplier on the track and waypoint snapping radius, and holding a key
// applies it for as long as the key is down. The game reads RULES.PIXEL_SNAP_THRESHOLD (screen pixels, default 10)
// every time the cursor moves while drawing. The tutorial uses a fixed 30 px radius and ignores this rule.
const SNAP_BASE_PX = 10; // game default for PIXEL_SNAP_THRESHOLD
const SNAP_MULTIPLIER = 10; // snapping strength while Strict Snap is on
const SNAP_HOLD_KEY = 'Alt'; // KeyboardEvent.key to hold
const SNAP_BUTTON_ICON = 'Magnet'; // Lucide icon name of the toolbar button

const api = window.SubwayBuilderAPI;

if (!api) {
  console.error(`${TAG} SubwayBuilderAPI not found.`);
} else {
  console.log(`${TAG} ${MOD_VERSION} | API v${api.version}`);

  let initialized = false;
  let snapToggled = false; // set by the toolbar button
  let snapHeld = false; // set while the hold key is down
  let snapApplied = false; // what PIXEL_SNAP_THRESHOLD currently reflects

  const syncSnap = (): void => {
    const on = snapToggled || snapHeld;
    if (on === snapApplied) return;
    if (typeof api.modifyConstants !== 'function') return;
    try {
      api.modifyConstants({ PIXEL_SNAP_THRESHOLD: on ? SNAP_BASE_PX * SNAP_MULTIPLIER : SNAP_BASE_PX });
      snapApplied = on;
    } catch (err) {
      console.error(`${TAG} Failed to set snap threshold:`, err);
    }
  };

  const setSnapHeld = (held: boolean): void => {
    snapHeld = held;
    syncSnap();
  };

  const initStrictSnap = (): void => {
    if (api.ui && typeof api.ui.addToolbarButton === 'function') {
      api.ui.addToolbarButton({
        id: 'strict-snap-toggle',
        icon: SNAP_BUTTON_ICON,
        tooltip: `Strict Snap: toggle ${SNAP_MULTIPLIER}x snapping strength (or hold ${SNAP_HOLD_KEY})`,
        onClick: () => {
          snapToggled = !snapToggled;
          syncSnap();
        },
        isActive: () => snapToggled || snapHeld,
      });
    } else {
      console.warn(`${TAG} addToolbarButton not available, Strict Snap toggle disabled.`);
    }

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === SNAP_HOLD_KEY && !e.repeat) setSnapHeld(true);
    }, true);
    window.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.key === SNAP_HOLD_KEY) setSnapHeld(false);
    }, true);

    // A key release can be missed (alt-tab, focus loss), so also release on blur and hidden.
    window.addEventListener('blur', () => setSnapHeld(false));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) setSnapHeld(false);
    });

    // Safety net: keep the hold in sync with the real modifier state while the cursor moves.
    const modifierProp: 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | null =
      SNAP_HOLD_KEY === 'Alt' ? 'altKey'
        : SNAP_HOLD_KEY === 'Control' ? 'ctrlKey'
        : SNAP_HOLD_KEY === 'Meta' ? 'metaKey'
        : SNAP_HOLD_KEY === 'Shift' ? 'shiftKey' : null;
    if (modifierProp) {
      window.addEventListener('mousemove', (e: MouseEvent) => {
        const held = !!e[modifierProp];
        if (held !== snapHeld) setSnapHeld(held);
      }, true);
    }

    console.log(`${TAG} Strict Snap ready: toolbar button toggles ${SNAP_MULTIPLIER}x snapping, or hold ${SNAP_HOLD_KEY} (${SNAP_BASE_PX * SNAP_MULTIPLIER} px).`);
  };

  api.hooks.onMapReady(() => {
    if (initialized) return;
    initialized = true;

    try {
      let registeredCount = 0;

      for (const train of trains) {
        api.trains.registerTrainType(train);
        registeredCount++;

        console.log(`${TAG} Registered train: ${train.id}`);
      }

      // Global game rules: late trains may cut dwell to half, stations allowed on grades up to 2.5%,
      // station route bullet rows effectively never hidden.
      if (typeof api.modifyConstants === 'function') {
        api.modifyConstants({
          DWELL: { DELAY_RECOVERY_MIN_FRACTION: 0.5 },
          STATION_MAX_GRADE_PERCENTAGE: 2.5,
          MARKER_ROUTE_BULLETS: { MAX_ROW_WIDTH_PX: 9999 },
        });
        console.log(`${TAG} Game rules applied.`);
      } else {
        console.warn(`${TAG} modifyConstants not available; game rules left at defaults.`);
      }

      try {
        initStrictSnap();
      } catch (err) {
        console.error(`${TAG} Strict Snap failed to start:`, err);
      }

      api.ui.showNotification(
        `${TAG} ${registeredCount} train(s) loaded.`,
        'success'
      );

      console.log(`${TAG} Initialized successfully.`);
    } catch (err) {
      console.error(`${TAG} Failed to initialize:`, err);

      api.ui.showNotification(
        `${MOD_ID} failed to load. Check console for details.`,
        'error'
      );
    }
  });
}
