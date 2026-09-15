# Local-first: no backend, static site

The game runs as a static site on GitHub Pages and keeps all state in the browser (IndexedDB behind a thin wrapper). Data leaves the device only through an explicit Export and enters only through a Learning Plan import. We chose this over Firebase or a small server because the only Player is one child on one Chromebook, the Guide can move a file by hand, and a free static host has nothing to babysit. The storage wrapper is the seam if shared storage is ever needed.
