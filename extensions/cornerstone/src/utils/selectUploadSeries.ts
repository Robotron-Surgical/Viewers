/**
 * One DICOM header per series for POST /select_upload_series.
 * Pixel data stays on the client until the backend names the series it will use.
 */

const HEADER_FIELDS = [
  'ProtocolName',
  'BodyPartExamined',
  'ProcedureStepDescription',
  'PerformedProcedureStepDescription',
  'RequestedProcedureDescription',
  'ScheduledProcedureStepDescription',
  'ReasonForTheRequestedProcedure',
  'StudyDescription',
  'SeriesDescription',
  'SeriesNumber',
  'ScanningSequence',
  'SequenceVariant',
  'EchoTime',
  'RepetitionTime',
  'ImageType',
  'NumberOfFrames',
] as const;

type SeriesInstance = Record<string, unknown> & {
  imageId?: string;
  SeriesInstanceUID?: string;
  ImageOrientationPatient?: unknown;
  NumberOfFrames?: unknown;
  SharedFunctionalGroupsSequence?: unknown;
  PerFrameFunctionalGroupsSequence?: unknown;
};

export type SeriesHeader = Record<string, unknown> & {
  seriesInstanceUID: string;
  instanceCount: number;
};

function orientationNumbers(value: unknown): number[] | undefined {
  if (!Array.isArray(value) || value.length < 6) {
    return undefined;
  }
  const numbers = value.slice(0, 6).map(Number);
  return numbers.every(number => Number.isFinite(number)) ? numbers : undefined;
}

function imageOrientationPatient(instance: SeriesInstance): number[] | undefined {
  const topLevel = orientationNumbers(instance.ImageOrientationPatient);
  if (topLevel) {
    return topLevel;
  }
  for (const key of ['SharedFunctionalGroupsSequence', 'PerFrameFunctionalGroupsSequence'] as const) {
    const groups = instance[key];
    const group = Array.isArray(groups) ? groups[0] : undefined;
    const planes = group?.PlaneOrientationSequence;
    const plane = Array.isArray(planes) ? planes[0] : undefined;
    const nested = orientationNumbers(plane?.ImageOrientationPatient);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

function maxFrameCount(instances: SeriesInstance[]): number {
  let max = 0;
  for (const instance of instances) {
    const frames = Number(instance.NumberOfFrames);
    if (Number.isFinite(frames)) {
      max = Math.max(max, frames);
    }
  }
  return max;
}

function localInstances(instances: SeriesInstance[] | undefined): SeriesInstance[] {
  return (instances || []).filter(instance => instance?.imageId?.startsWith('dicomfile:'));
}

export function seriesHeadersFromStudy(study: {
  series?: Array<{ SeriesInstanceUID?: string; instances?: SeriesInstance[] }>;
}): SeriesHeader[] {
  const headers: SeriesHeader[] = [];
  for (const series of study?.series || []) {
    const instances = localInstances(series.instances);
    if (!instances.length) {
      continue;
    }
    const source = instances[0];
    const seriesInstanceUID = series.SeriesInstanceUID || source.SeriesInstanceUID;
    if (!seriesInstanceUID) {
      continue;
    }
    const header: SeriesHeader = {
      seriesInstanceUID,
      instanceCount: instances.length,
    };
    for (const field of HEADER_FIELDS) {
      const value = source[field];
      if (value !== undefined && value !== null && value !== '') {
        header[field] = value;
      }
    }
    const frames = maxFrameCount(instances);
    if (frames > 1) {
      header.NumberOfFrames = frames;
    }
    const orientation = imageOrientationPatient(source);
    if (orientation) {
      header.ImageOrientationPatient = orientation;
    }
    headers.push(header);
  }
  return headers;
}

export function countLocalSeries(study: {
  series?: Array<{ instances?: SeriesInstance[] }>;
}): number {
  return (study?.series || []).filter(series => localInstances(series.instances).length > 0).length;
}
