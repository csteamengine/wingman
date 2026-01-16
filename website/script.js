// Detect user's operating system and update download links
(function() {
  // GitHub releases URL - update this with your actual GitHub username/repo
  const GITHUB_REPO = 'charliesteenhagen/niblet';
  const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

  // Download URLs for each platform
  // These will be GitHub release assets - update filenames as needed
  const DOWNLOADS = {
    mac: {
      url: `https://github.com/${GITHUB_REPO}/releases/latest/download/Niblet_universal.dmg`,
      text: 'Download for macOS',
      altText: 'macOS'
    },
    macArm: {
      url: `https://github.com/${GITHUB_REPO}/releases/latest/download/Niblet_aarch64.dmg`,
      text: 'Download for macOS (Apple Silicon)',
      altText: 'macOS (Apple Silicon)'
    },
    macIntel: {
      url: `https://github.com/${GITHUB_REPO}/releases/latest/download/Niblet_x64.dmg`,
      text: 'Download for macOS (Intel)',
      altText: 'macOS (Intel)'
    },
    windows: {
      url: `https://github.com/${GITHUB_REPO}/releases/latest/download/Niblet_x64-setup.exe`,
      text: 'Download for Windows',
      altText: 'Windows'
    },
    linux: {
      url: `https://github.com/${GITHUB_REPO}/releases/latest/download/niblet_amd64.deb`,
      text: 'Download for Linux',
      altText: 'Linux (.deb)'
    }
  };

  function detectOS() {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();

    if (platform.includes('mac') || userAgent.includes('mac')) {
      return 'mac';
    } else if (platform.includes('win') || userAgent.includes('win')) {
      return 'windows';
    } else if (platform.includes('linux') || userAgent.includes('linux')) {
      return 'linux';
    }
    return 'mac'; // Default to macOS
  }

  function getAlternateOS(currentOS) {
    if (currentOS === 'mac') return 'windows';
    if (currentOS === 'windows') return 'mac';
    return 'mac';
  }

  function updateDownloadLinks() {
    const os = detectOS();
    const altOS = getAlternateOS(os);
    const download = DOWNLOADS[os];
    const altDownload = DOWNLOADS[altOS];

    // Update main download buttons
    const downloadBtn = document.getElementById('download-btn');
    const downloadText = document.getElementById('download-text');
    const downloadFree = document.getElementById('download-free');
    const downloadCta = document.getElementById('download-cta');

    if (downloadBtn) {
      downloadBtn.href = download.url;
    }
    if (downloadText) {
      downloadText.textContent = download.text;
    }
    if (downloadFree) {
      downloadFree.href = download.url;
    }
    if (downloadCta) {
      downloadCta.href = download.url;
    }

    // Update alternate download link
    const otherPlatforms = document.getElementById('other-platforms');
    const altDownloadLink = document.getElementById('alt-download');

    if (altDownloadLink) {
      altDownloadLink.href = altDownload.url;
      altDownloadLink.textContent = altDownload.altText;
    }

    // Show Linux link if on Mac or Windows
    if (os !== 'linux' && otherPlatforms) {
      const linuxLink = document.createElement('span');
      linuxLink.innerHTML = ` and <a href="${DOWNLOADS.linux.url}">${DOWNLOADS.linux.altText}</a>`;
      otherPlatforms.appendChild(linuxLink);
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateDownloadLinks);
  } else {
    updateDownloadLinks();
  }
})();
