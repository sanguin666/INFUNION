/**
 * Whether the published APK is another native build than this one. The
 * runtime version is a fingerprint, so any difference means "newer": the
 * release only ever holds the latest build. Unknown on either side (a
 * development build, a release from before version.json) means no.
 */
export function needsNewApk(current: string | null, latest: string | null | undefined): boolean {
  return !!current && !!latest && current !== latest;
}
