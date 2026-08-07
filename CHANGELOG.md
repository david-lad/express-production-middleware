# Changelog

## 1.1.2

### Fixed
- Included source files in the published npm package via the updated files list.
- Added a prepack build step so npm automatically builds before packing and publishing.
- Added a CI build step before publish to ensure the package builds successfully in GitHub Actions.

### Notes
- Older versions that were published before this fix have already been deprecated.
- Users should upgrade to 1.1.2 or newer to receive the corrected package contents.
