import {
  orderImageIdsForSegPlane,
  orientationsMatch,
  segOrientationFromDataset,
} from './orderImageIdsForSegPlane';

const AXIAL = [1, 0, 0, 0, 0.99985, -0.01745];
const OBLIQUE = [0.9999, 0, 0.01437, -0.00512, 0.93422, 0.35667];

describe('orderImageIdsForSegPlane', () => {
  it('leaves a single-plane series in place when image 0 already matches', () => {
    const imageIds = ['a', 'b', 'c'];
    const orientations = [AXIAL, AXIAL, AXIAL];

    const ordered = orderImageIdsForSegPlane(imageIds, orientations, AXIAL);

    expect(ordered).toBe(imageIds);
  });

  it('promotes the slice that shares the SEG plane on a mixed axial stack', () => {
    const imageIds = ['inst-1', 'inst-2', 'inst-17'];
    const orientations = [AXIAL, AXIAL, OBLIQUE];

    const ordered = orderImageIdsForSegPlane(imageIds, orientations, OBLIQUE);

    expect(ordered).toEqual(['inst-17', 'inst-1', 'inst-2']);
    expect(imageIds).toEqual(['inst-1', 'inst-2', 'inst-17']);
  });

  it('does not treat a 21 degree tilt as the same plane', () => {
    expect(orientationsMatch(AXIAL, OBLIQUE)).toBe(false);
    expect(orientationsMatch(AXIAL, AXIAL.map(v => v + 0.0004))).toBe(true);
  });

  it('keeps the original order when no slice shares the SEG plane', () => {
    const imageIds = ['a', 'b'];
    const ordered = orderImageIdsForSegPlane(imageIds, [AXIAL, AXIAL], OBLIQUE);
    expect(ordered).toBe(imageIds);
  });

  it('reads a shared plane orientation from either sequence shape', () => {
    expect(
      segOrientationFromDataset({
        SharedFunctionalGroupsSequence: {
          PlaneOrientationSequence: { ImageOrientationPatient: OBLIQUE },
        },
      })
    ).toEqual(OBLIQUE);

    expect(
      segOrientationFromDataset({
        PerFrameFunctionalGroupsSequence: [
          {
            PlaneOrientationSequence: [{ ImageOrientationPatient: AXIAL.join('\\') }],
          },
        ],
      })
    ).toEqual(AXIAL);
  });
});
