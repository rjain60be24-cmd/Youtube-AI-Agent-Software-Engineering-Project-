console.log("Edu-Filter Extension loaded!");

let settings = {};
let filterInterval = null;
let observer = null;

// Load settings when extension starts
chrome.storage.sync.get({
    extensionEnabled: true,
    llmApiKey: '',
    llmProvider: 'groq',
    hideKeywords: ['prank', 'reaction', 'spoof', 'exposed', 'clickbait', 'Compilation', 'Dark side', 'vlog'],
    showKeywords: ['tutorial', 'learn', 'programming', 'coding', 'education', 'guide', 'how to', 'course', 'Technologies']
}, (result) => {
    settings = result;
    console.log("Settings loaded:", {
        extensionEnabled: settings.extensionEnabled,
        provider: settings.llmProvider,
        hasApiKey: !!settings.llmApiKey,
        hideKeywordsCount: settings.hideKeywords.length,
        showKeywordsCount: settings.showKeywords.length
    });
    initializeFiltering();
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes) => {
    for (let key in changes) {
        settings[key] = changes[key].newValue;
    }
    console.log("Settings updated");
    initializeFiltering();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'extensionStatusChanged') {
        console.log('Extension ' + (message.enabled ? 'enabled' : 'disabled') + ' by user');
        settings.extensionEnabled = message.enabled;
        initializeFiltering();
    }
});

/**
 * Initialize or restart the filtering system
 */
function initializeFiltering() {
    // Clear existing interval and observer
    if (filterInterval) {
        clearInterval(filterInterval);
        filterInterval = null;
    }
    if (observer) {
        observer.disconnect();
        observer = null;
    }

    if (settings.extensionEnabled) {
        console.log("Extension enabled - Starting video filtering (AI-only, keywords guide AI)");
        if (!settings.llmApiKey) {
            console.warn("No API key found - AI filtering cannot run. All videos will remain visible.");
        }
        filterInterval = setInterval(filterYouTubeFeed, 3000);
        filterYouTubeFeed();
        setupObserver();
    } else {
        console.log("Extension disabled - Restoring videos");
        restoreHiddenVideos();
    }
}

function runtimeValid() {
    return !!(chrome.runtime && chrome.runtime.id);
}

/**
 * Set up MutationObserver to watch for new videos
 */
function setupObserver() {
    const targetNode = document.querySelector('ytd-app');
    if (!targetNode) return;

    observer = new MutationObserver((mutations) => {
        const hasNewVideos = mutations.some(mutation =>
            Array.from(mutation.addedNodes).some(node =>
                node.nodeType === 1 && node.tagName === 'YTD-RICH-ITEM-RENDERER'
            )
        );
        if (hasNewVideos) {
            console.log("New videos detected by observer");
            filterYouTubeFeed();
        }
    });

    observer.observe(targetNode, {
        childList: true,
        subtree: true
    });
    console.log("MutationObserver active");
}

/**
 * Restore all hidden videos (when extension is disabled)
 */
function restoreHiddenVideos() {
    const vids = document.querySelectorAll('ytd-rich-item-renderer[data-filtered-by-ai]');
    vids.forEach(video => {
        video.style.display = '';
        video.removeAttribute('data-filtered-by-ai');
    });
    console.log('Restored ' + vids.length + ' videos');
}

/**
 * Main filtering function (AI-only, keywords guide AI)
 */
async function filterYouTubeFeed() {
    if (!settings.extensionEnabled) return;

    const videoElements = document.querySelectorAll('ytd-rich-item-renderer');
    if (!videoElements.length) return;

    const titlesForAI = [];
    const elementsForAI = [];

    videoElements.forEach(video => {
        if (video.hasAttribute('data-filtered-by-ai')) return;

        let titleText = '';
        const possibleSelectors = [
            'a#video-title',
            'yt-formatted-string#video-title',
            'a#video-title-link',
            'h3 a',
            '[id="video-title"]'
        ];
        for (const sel of possibleSelectors) {
            const el = video.querySelector(sel);
            if (el && el.textContent && el.textContent.trim()) {
                titleText = el.textContent.trim();
                break;
            }
        }
        if (!titleText) return;

        // Always send to AI (no local keyword hiding)
        titlesForAI.push(titleText);
        elementsForAI.push(video);
    });

    if (!titlesForAI.length) return;

    if (!settings.llmApiKey) {
        console.warn("No API key - cannot classify " + titlesForAI.length + " videos (showing them).");
        elementsForAI.forEach(v => v.setAttribute('data-filtered-by-ai', 'no-api-key'));
        return;
    }

    if (!runtimeValid()) {
        console.warn("Runtime invalidated before sending to AI");
        return;
    }

    console.log('Sending ' + titlesForAI.length + ' titles to AI (' + settings.llmProvider + ') with keyword guidance...');

    chrome.runtime.sendMessage(
        {
            action: 'runAIClassification',
            titles: titlesForAI,
            showKeywords: settings.showKeywords,
            hideKeywords: settings.hideKeywords
        },
        (response) => {
            if (chrome.runtime.lastError) {
                console.error('Background message error:', chrome.runtime.lastError);
                elementsForAI.forEach(v => v.setAttribute('data-filtered-by-ai', 'error'));
                return;
            }
            if (!response || !response.success) {
                console.error('AI Classification failed:', response && response.error);
                elementsForAI.forEach(v => v.setAttribute('data-filtered-by-ai', 'error'));
                return;
            }

            response.decisions.forEach((decision, idx) => {
                const videoElement = elementsForAI[idx];
                const title = titlesForAI[idx];
                if (!videoElement) return;

                if (decision === 'hide') {
                    console.log('[AI] Hiding: "' + title + '"');
                    videoElement.style.display = 'none';
                    videoElement.setAttribute('data-filtered-by-ai', 'ai-hide');
                } else {
                    console.log('[AI] Showing: "' + title + '"');
                    videoElement.setAttribute('data-filtered-by-ai', 'ai-show');
                }
            });
            console.log('AI processed ' + response.decisions.length + ' videos');
        }
    );
}

console.log('Edu-Filter Extension Active - AI-only mode (keywords guide AI)');