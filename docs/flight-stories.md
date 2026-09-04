# Flight stories and images

Flight owners can add a short story and a configurable number of images to an active, approved flight. Supported image formats are JPEG, PNG, and WebP. SimSoar validates file signatures, applies per-file and per-flight limits, stores generated hash-based object names outside the public web root, and serves images only after applying the flight's visibility and moderation rules.

Owners can remove their images, while moderators and administrators can remove inappropriate images. Story changes and image removals are audit logged. Permanent flight deletion also removes associated image records and stored files.

The optional association of images with timestamps or GPS points is intentionally left for a later enhancement.
