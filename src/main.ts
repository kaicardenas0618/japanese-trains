/**
 * JP Trains for Subway Builder
 * Entry point for the mod.
 */

import { trains } from './data/trains';

const MOD_ID = 'japanese-trains';
const MOD_VERSION = 'v5.4.3';
const TAG = '[Japanese Trains]';

const api = window.SubwayBuilderAPI;

if (!api) {
  console.error(`${TAG} SubwayBuilderAPI not found.`);
} else {
  console.log(`${TAG} ${MOD_VERSION} | API v${api.version}`);

  let initialized = false;

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

      // Global game rules: late trains may cut dwell to half, stations allowed on grades up to 2.5%.
      if (typeof api.modifyConstants === 'function') {
        api.modifyConstants({
          DWELL: { DELAY_RECOVERY_MIN_FRACTION: 0.5 },
          STATION_MAX_GRADE_PERCENTAGE: 2.5,
        });
        console.log(`${TAG} Game rules applied.`);
      } else {
        console.warn(`${TAG} modifyConstants not available; game rules left at defaults.`);
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
