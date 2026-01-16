// Detect user's operating system and update download links
(function() {
  const GITHUB_REPO = 'csteamengine/niblet';
  const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
  const RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases/latest`;

  // Asset filename patterns for each platform
  const ASSET_PATTERNS = {
    mac: {
      pattern: /_aarch64\.dmg$/,
      text: 'Download for macOS',
      altText: 'macOS (Apple Silicon)'
    },
    macIntel: {
      pattern: /_x64\.dmg$/,
      text: 'Download for macOS (Intel)',
      altText: 'macOS (Intel)'
    },
    windows: {
      pattern: /_x64-setup\.exe$/,
      text: 'Download for Windows',
      altText: 'Windows'
    },
    linux: {
      pattern: /_amd64\.deb$/,
      text: 'Download for Linux',
      altText: 'Linux (.deb)'
    }
  };

  let releaseData = null;
  let downloadUrls = {};

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
    return 'mac';
  }

  function getAlternateOS(currentOS) {
    if (currentOS === 'mac') return 'windows';
    if (currentOS === 'windows') return 'mac';
    return 'mac';
  }

  function findAssetUrl(assets, pattern) {
    const asset = assets.find(a => pattern.test(a.name));
    return asset ? asset.browser_download_url : null;
  }

  async function fetchLatestRelease() {
    try {
      const response = await fetch(GITHUB_API_URL);
      if (!response.ok) throw new Error('Failed to fetch release');
      releaseData = await response.json();

      // Map assets to download URLs
      for (const [key, config] of Object.entries(ASSET_PATTERNS)) {
        const url = findAssetUrl(releaseData.assets, config.pattern);
        if (url) {
          downloadUrls[key] = {
            url,
            text: config.text,
            altText: config.altText
          };
        }
      }

      // Update version display if element exists
      const versionEl = document.getElementById('version');
      if (versionEl && releaseData.tag_name) {
        versionEl.textContent = releaseData.tag_name;
      }

      return true;
    } catch (error) {
      console.warn('Could not fetch latest release:', error);
      // Fallback to releases page
      downloadUrls = {
        mac: { url: RELEASES_PAGE, text: 'Download for macOS', altText: 'macOS' },
        windows: { url: RELEASES_PAGE, text: 'Download for Windows', altText: 'Windows' },
        linux: { url: RELEASES_PAGE, text: 'Download for Linux', altText: 'Linux' }
      };
      return false;
    }
  }

  function updateDownloadLinks() {
    const os = detectOS();
    const altOS = getAlternateOS(os);
    const download = downloadUrls[os] || downloadUrls.mac;
    const altDownload = downloadUrls[altOS] || downloadUrls.windows;

    // Update main download buttons
    const downloadBtn = document.getElementById('download-btn');
    const downloadText = document.getElementById('download-text');
    const downloadFree = document.getElementById('download-free');
    const downloadCta = document.getElementById('download-cta');

    if (downloadBtn && download) {
      downloadBtn.href = download.url;
    }
    if (downloadText && download) {
      downloadText.textContent = download.text;
    }
    if (downloadFree && download) {
      downloadFree.href = download.url;
    }
    if (downloadCta && download) {
      downloadCta.href = download.url;
    }

    // Update alternate download link
    const otherPlatforms = document.getElementById('other-platforms');
    const altDownloadLink = document.getElementById('alt-download');

    if (altDownloadLink && altDownload) {
      altDownloadLink.href = altDownload.url;
      altDownloadLink.textContent = altDownload.altText;
    }

    // Show Linux link if on Mac or Windows
    if (os !== 'linux' && otherPlatforms && downloadUrls.linux) {
      const existingLinux = otherPlatforms.querySelector('.linux-link');
      if (!existingLinux) {
        const linuxLink = document.createElement('span');
        linuxLink.className = 'linux-link';
        linuxLink.innerHTML = ` and <a href="${downloadUrls.linux.url}">${downloadUrls.linux.altText}</a>`;
        otherPlatforms.appendChild(linuxLink);
      }
    }
  }

  async function init() {
    await fetchLatestRelease();
    updateDownloadLinks();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
