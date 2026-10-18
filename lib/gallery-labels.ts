/** Consistent display casing for gallery metadata, including future uploads. */
export function formatArtworkMetadata(value:string):string {
  return String(value ?? '').trim().toLocaleUpperCase('vi');
}
