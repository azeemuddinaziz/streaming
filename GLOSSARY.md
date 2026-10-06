# StreamSouk

A video streaming platform where people publish videos on channels and others watch them.

## Language

**User**:
A registered person with a required, unique account name, written in letters, digits and hyphens and compared without regard to case. The account name cannot be changed. A User owns exactly one Channel, created together with the User, and can watch any public Video.
_Avoid_: Account, member

**Viewer**:
Anyone watching a Video, signed in or not. A Viewer needs no account to watch a public or unlisted Video.
_Avoid_: Visitor, audience

**Channel**:
The publishing identity that owns Videos, belonging to exactly one User and named after that User's account name. Only the owning User can upload Videos to it.
_Avoid_: Profile, creator

**Video**:
A piece of content published on a Channel, created only from a completed Upload. It is processing, ready or failed, and is playable only when ready. Until then anyone opening it is told it is still processing, and a failed one can be processed again from its original Upload. It stays private until its owner has given it both a title and a description, and until then it carries the original filename as a placeholder label.
_Avoid_: Media, asset

**Deleted Video**:
A Video its owner has deleted. To everyone, the owner included, it is gone for good and its link shows "not found". Nothing is ever removed from the system's own records.
_Avoid_: Archived, removed, trashed

**Upload**:
One resumable transfer of a video file's bytes by a User, owned by the User who started it and resumable only by that User. It ends completed, or terminated or abandoned. While unfinished it is shown to its owner, labelled with the filename, so they can resume it, and it disappears with its bytes after 24 hours. A completed Upload is kept as a record linked to the Video it produced, and that Video is processed from its bytes.
_Avoid_: Upload session, file

**Visibility**:
Who may watch a Video: private (owning User only, the default), unlisted (anyone with the link), or public (anyone). A Video can leave private only once it has a title and a description, whether or not it has finished processing.
_Avoid_: Privacy, access level, status

**Rendition**:
One resolution-and-bitrate encoding of a Video, cut into short segments for adaptive streaming. A Video has several, so a viewer's player can switch between them.
_Avoid_: Variant, quality level, chunk

**Thumbnail**:
The still image that represents a Video, available in several sizes and web formats. It defaults to the Video's first frame, and its owner may replace it with an image of their own, which is not an Upload.
_Avoid_: Poster, cover

**View**:
One counted watch of a Video, registered once playback has run for 30 seconds, or for the whole Video if it is shorter. A signed-in User counts once per Video per day, an anonymous Viewer once per Video per day, and the owner's own watching never counts.
_Avoid_: Play, hit, impression
