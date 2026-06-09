import { CONSTANTS } from '@cornerstonejs/core';

const { VIEWPORT_PRESETS } = CONSTANTS;

// VIEWPORT_PRESETS includes 'Segmentation' (registered in init.tsx) as first/default for 3D view
export default {
  'cornerstone.3dVolumeRendering': {
    volumeRenderingPresets: VIEWPORT_PRESETS,
    volumeRenderingQualityRange: {
      min: 1,
      max: 4,
      step: 1,
    },
  },
};
