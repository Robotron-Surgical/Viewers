import dcmjs from 'dcmjs';

/**
 * Converts a CIELAB color to an RGB color using the dcmjs library.
 * @param cielab - The CIELAB color to convert.
 * @returns The RGB color as an array of three integers between 0 and 255.
 */
function dicomlabToRGB(cielab: number[]): number[] {
  const [r, g, b] = dcmjs.data.Colors.dicomlab2RGB(cielab).map(x => Math.round(x * 255));
  // vtk.js labelmap ColorTransferFunction samples these as BGR. Without the
  // swap, ivory bone, gold thecal sac, and terracotta discs all render blue.
  return [b, g, r];
}

export { dicomlabToRGB };
