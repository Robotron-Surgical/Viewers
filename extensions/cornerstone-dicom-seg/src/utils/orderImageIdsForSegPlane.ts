import dcmjs from 'dcmjs';

/**
 * Same tolerance the Cornerstone DICOM SEG adapter uses when it decides a
 * segmentation is planar, perpendicular, or oblique to the source stack.
 */
export const SEG_PLANE_TOLERANCE = 0.001;

type Orientation = number[] | undefined;

function firstItem<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
}

function asOrientation(value: unknown): number[] | undefined {
  if (value == null) {
    return undefined;
  }

  let values: unknown[];
  if (typeof value === 'string') {
    values = value.split('\\');
  } else if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    values = Array.from(value as ArrayLike<unknown>);
  } else {
    return undefined;
  }

  if (values.length < 6) {
    return undefined;
  }

  const numbers = values.slice(0, 6).map(Number);
  if (numbers.some(n => Number.isNaN(n))) {
    return undefined;
  }
  return numbers;
}

/**
 * ImageOrientationPatient from a naturalized DICOM SEG dataset.
 * Shared functional groups win, matching the adapter's checkOrientation.
 */
export function segOrientationFromDataset(dataset): number[] | undefined {
  if (!dataset) {
    return undefined;
  }

  const shared = firstItem(dataset.SharedFunctionalGroupsSequence);
  const sharedOrientation = asOrientation(
    firstItem(shared?.PlaneOrientationSequence)?.ImageOrientationPatient
  );
  if (sharedOrientation) {
    return sharedOrientation;
  }

  const frame = firstItem(dataset.PerFrameFunctionalGroupsSequence);
  return asOrientation(firstItem(frame?.PlaneOrientationSequence)?.ImageOrientationPatient);
}

/**
 * Read the SEG plane without decoding pixel data. Returns undefined when the
 * buffer is not a readable DICOM SEG; the caller then keeps the original order.
 */
export function getSegImageOrientationPatient(arrayBuffer: ArrayBuffer): number[] | undefined {
  try {
    const dicomData = dcmjs.data.DicomMessage.readFile(arrayBuffer, {
      untilTag: '7FE00010',
      includeUntilTagValue: false,
    });
    const dataset = dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomData.dict);
    return segOrientationFromDataset(dataset);
  } catch (error) {
    console.warn('[DICOM SEG] Could not read segmentation plane orientation', error);
    return undefined;
  }
}

/**
 * Same ImageOrientationPatient reconstruction the adapter uses for image 0.
 */
export function imageOrientationFromPlaneModule(imagePlaneModule): number[] | undefined {
  if (!imagePlaneModule?.rowCosines || !imagePlaneModule?.columnCosines) {
    return undefined;
  }

  const { rowCosines, columnCosines } = imagePlaneModule;
  const iop = Array.isArray(rowCosines)
    ? [...rowCosines, ...columnCosines]
    : [rowCosines.x, rowCosines.y, rowCosines.z, columnCosines.x, columnCosines.y, columnCosines.z];

  return asOrientation(iop);
}

export function orientationsMatch(
  a: Orientation,
  b: Orientation,
  tolerance = SEG_PLANE_TOLERANCE
): boolean {
  if (!a || !b || a.length < 6 || b.length < 6) {
    return false;
  }
  for (let i = 0; i < 6; i += 1) {
    if (Math.abs(a[i] - b[i]) > tolerance) {
      return false;
    }
  }
  return true;
}

/**
 * Cornerstone classifies a SEG as oblique by comparing it with
 * referencedImageIds[0] only. A mixed-plane series (stacked axials angled
 * through each disc) is sorted by instance number, so image 0 may be a
 * different block than the plane the SEG was written against.
 *
 * Move a source image that shares the SEG plane to the front. Frame pixels
 * are still matched by ImagePositionPatient, so this does not retarget slices.
 * The returned array is a copy only when the order changes.
 */
export function orderImageIdsForSegPlane<T>(
  imageIds: T[],
  orientations: Orientation[],
  segOrientation: Orientation,
  tolerance = SEG_PLANE_TOLERANCE
): T[] {
  if (!segOrientation || imageIds.length < 2) {
    return imageIds;
  }

  const matchIndex = orientations.findIndex(iop =>
    orientationsMatch(iop, segOrientation, tolerance)
  );
  if (matchIndex <= 0) {
    return imageIds;
  }

  const ordered = imageIds.slice();
  const [match] = ordered.splice(matchIndex, 1);
  ordered.unshift(match);
  return ordered;
}
