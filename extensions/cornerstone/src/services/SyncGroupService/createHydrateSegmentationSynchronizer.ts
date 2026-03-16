import { Enums as CoreEnums, Types, getEnabledElementByViewportId } from '@cornerstonejs/core';
import {
  SynchronizerManager,
  Synchronizer,
  Enums,
  Types as ToolsTypes,
} from '@cornerstonejs/tools';

import { isAnyDisplaySetCommon } from '../../utils/isAnyDisplaySetCommon';

const { createSynchronizer } = SynchronizerManager;
const { SEGMENTATION_REPRESENTATION_MODIFIED } = Enums.Events;
const { BlendModes } = CoreEnums;

export default function createHydrateSegmentationSynchronizer(
  synchronizerName: string,
  { servicesManager, ...options }: { servicesManager: AppTypes.ServicesManager; options }
): Synchronizer {
  const stackImageSynchronizer = createSynchronizer(
    synchronizerName,
    SEGMENTATION_REPRESENTATION_MODIFIED,
    (synchronizerInstance, sourceViewport, targetViewport, sourceEvent) => {
      return segmentationRepresentationModifiedCallback(
        synchronizerInstance,
        sourceViewport,
        targetViewport,
        sourceEvent,
        { servicesManager, options }
      );
    },
    {
      eventSource: 'eventTarget',
    }
  );

  return stackImageSynchronizer;
}

/**
 * This method will add the segmentation representation to any target viewports having:
 *
 * 1. a display set that matches the segmentation's referenced series, OR
 * 2. a shared DisplaySet with the source viewport when no FOR is present.
 *
 * This ensures a sagittal SEG only propagates to viewports showing the sagittal
 * source series (e.g. MPR views of that series), never to an unrelated axial
 * series that happens to share the same Frame of Reference.
 */
const segmentationRepresentationModifiedCallback = async (
  synchronizerInstance: Synchronizer,
  sourceViewport: Types.IViewportId,
  targetViewport: Types.IViewportId,
  sourceEvent: Event,
  { servicesManager, options }: { servicesManager: AppTypes.ServicesManager; options: unknown }
) => {
  const event = sourceEvent as ToolsTypes.EventTypes.SegmentationRepresentationModifiedEventType;

  const { segmentationId, type: segmentationRepresentationType } = event.detail;
  const { segmentationService, cornerstoneViewportService, displaySetService } =
    servicesManager.services;

  const targetViewportId = targetViewport.viewportId;
  const sourceViewportId = sourceViewport.viewportId;

  const { viewport } = getEnabledElementByViewportId(targetViewportId);
  const sourceViewportInfo = cornerstoneViewportService.getViewportInfo(sourceViewportId);
  const targetViewportInfo = cornerstoneViewportService.getViewportInfo(targetViewportId);

  const sourceDisplaySetUIDs = extractDisplaySetUIDs(sourceViewportInfo);
  const targetDisplaySetUIDs = extractDisplaySetUIDs(targetViewportInfo);

  // Only propagate to viewports that already show the segmentation's referenced
  // source series. This prevents cross-series bleed (e.g. sagittal SEG → axial
  // viewport) when both series share the same FrameOfReferenceUID.
  const allDisplaySets = displaySetService.getActiveDisplaySets?.() ?? [];
  const segDisplaySet = allDisplaySets.find(
    (ds: AppTypes.DisplaySet) => ds.displaySetInstanceUID === segmentationId
  );
  const referencedUID = segDisplaySet?.referencedDisplaySetInstanceUID;

  if (referencedUID && !targetDisplaySetUIDs.includes(referencedUID)) {
    return;
  }

  const sharedDisplaySetExists = isAnyDisplaySetCommon(sourceDisplaySetUIDs, targetDisplaySetUIDs);

  if (!sharedDisplaySetExists && !viewport.getFrameOfReferenceUID()) {
    return;
  }

  const targetViewportRepresentation = segmentationService.getSegmentationRepresentations(
    targetViewportId,
    { segmentationId }
  );

  if (targetViewportRepresentation.length > 0) {
    return;
  }

  if (viewport.type === CoreEnums.ViewportType.VOLUME_3D) {
    await segmentationService.addSegmentationRepresentation(targetViewportId, {
      segmentationId,
    });
  } else {
    const sourceViewportRepresentation = segmentationService.getSegmentationRepresentations(
      sourceViewport.viewportId,
      { segmentationId }
    );

    const type = sourceViewportRepresentation[0].type;

    await segmentationService.addSegmentationRepresentation(targetViewportId, {
      segmentationId,
      type,
      config: {
        blendMode:
          viewport?.getBlendMode?.() === 1 ? BlendModes.LABELMAP_EDGE_PROJECTION_BLEND : undefined,
      },
    });
  }
};

/**
 * Extracts the displaySetInstanceUIDs from a viewportInfo.
 */
function extractDisplaySetUIDs(viewportInfo): string[] {
  try {
    return viewportInfo.getViewportData().data.map((ds: { displaySetInstanceUID: string }) => ds.displaySetInstanceUID);
  } catch {
    return [];
  }
}
