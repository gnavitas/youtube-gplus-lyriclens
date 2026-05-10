console.log('[Romanizer] content.js LOADED - INITIALIZING...');

(function () {
    const api = typeof chrome !== 'undefined' ? chrome : browser;

    if (window.__ROMANIZER_LOADED__) {
        console.log('[Romanizer] Already loaded, skipping...');
        return;
    }
    window.__ROMANIZER_LOADED__ = true;

    let settings = {
        enable: true,
        'lang-ko': true,
        'lang-ja': true,
        'lang-zh': true,
        'show-translation': true,
        'static-mode': false
    };

    let isStaticMode = false;
    let syncedLyrics = [];
    let lastLyricIndex = -1;
    let lyricOffset = 0;

    let lyricsPosition = { top: '80%', left: '50%' };
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };


    if (typeof api !== 'undefined' && api.storage) {
        api.storage.local.get(['enable', 'lang-ko', 'lang-ja', 'lang-zh', 'show-translation', 'static-mode', 'lyrics-pos']).then(res => {
            settings = { ...settings, ...res };
            isStaticMode = settings['static-mode'] || false;
            if (res['lyrics-pos']) {
                let pos = res['lyrics-pos'];
                if (pos.top && !pos.top.includes('NaN') && parseFloat(pos.top) > 5 && pos.left && !pos.left.includes('NaN')) {
                    lyricsPosition = pos;
                }
            }
            updateModeButtonText();
        });


        api.storage.onChanged.addListener((changes) => {
            for (let key in changes) {
                settings[key] = changes[key].newValue;
                if (key === 'static-mode') {
                    isStaticMode = settings[key];
                    updateModeButtonText();
                }
            }
        });
    }

    let currentSearchResults = [];
    let currentSearchIndex = 0;

    async function fetchLyrics(rawTitle) {
        try {
            console.log('[Romanizer] Requesting background search for:', rawTitle);
            const matches = await api.runtime.sendMessage({ type: 'FETCH_LYRICS', query: rawTitle });

            if (matches && matches.length > 0) {

                const relevantMatches = matches.filter(m => checkRelevance(rawTitle, m.trackName, m.artistName));

                if (relevantMatches.length > 0) {
                    currentSearchResults = relevantMatches;
                    currentSearchIndex = 0;
                    await parseLRC(currentSearchResults[0].syncedLyrics, currentSearchResults[0].translationLyrics);
                    return currentSearchResults[0];
                } else {
                    console.log('[Romanizer] Ignoring irrelevant matches for:', rawTitle);
                }
            }
        } catch (e) {
            console.error('[Romanizer] Background search failed:', e);
        }
        return null;
    }

    function checkRelevance(query, resultTitle, resultArtist) {
        const q = query.toLowerCase();
        const rt = (resultTitle || '').toLowerCase();
        const ra = (resultArtist || '').toLowerCase();


        let rtRom = rt;
        let raRom = ra;
        if (/[\u3040-\u30ff\uac00-\ud7af\u4e00-\u9fff]/.test(rt)) {
            if (window.romanizeJaSync) rtRom = window.romanizeJaSync(rt).toLowerCase();
            else if (window.romanizeKo) rtRom = window.romanizeKo(rt).toLowerCase();
        }
        if (/[\u3040-\u30ff\uac00-\ud7af\u4e00-\u9fff]/.test(ra)) {
            if (window.romanizeJaSync) raRom = window.romanizeJaSync(ra).toLowerCase();
            else if (window.romanizeKo) raRom = window.romanizeKo(ra).toLowerCase();
        }

        const qWords = q.split(/\s+/).filter(w => w.length > 1);
        if (qWords.length === 0) return true;

        let matchCount = 0;
        for (const w of qWords) {

            if (rt.includes(w) || ra.includes(w) || rtRom.includes(w) || raRom.includes(w)) {
                matchCount++;
                continue;
            }


            if (/[\u3040-\u30ff\uac00-\ud7af\u4e00-\u9fff]/.test(w)) {
                let rom;
                if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(w) && window.romanizeJaSync) rom = window.romanizeJaSync(w).toLowerCase();
                else if (/[\uac00-\ud7af]/.test(w) && window.romanizeKo) rom = window.romanizeKo(w).toLowerCase();

                if (rom && (rt.includes(rom) || ra.includes(rom) || rtRom.includes(rom) || raRom.includes(rom))) {
                    matchCount++;
                }
            }
        }

        const threshold = qWords.length <= 2 ? 1 : Math.ceil(qWords.length * 0.5);
        return matchCount >= threshold;
    }

    async function smartFetchLyrics(title, channel) {
        let cleanedTitle = cleanTitle(title);
        if (!cleanedTitle) return null;

        const queries = new Set();


        const cleanChan = channel ? channel.replace(/ - Topic$/i, '').replace(/VEVO$/i, '').trim() : '';


        queries.add(cleanedTitle);


        if (/[\u3040-\u30ff\uac00-\ud7af\u4e00-\u9fff]/.test(cleanedTitle)) {
            let rom = cleanedTitle;
            if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(rom) && window.romanizeJa) rom = await window.romanizeJa(rom);
            if (/[\uac00-\ud7af]/.test(rom) && window.romanizeKo) rom = window.romanizeKo(rom);
            if (rom && rom !== cleanedTitle) queries.add(rom);
        }


        const currentQueries = Array.from(queries);
        if (cleanChan) {
            const lowerChan = cleanChan.toLowerCase();
            for (const q of currentQueries) {
                if (!q.toLowerCase().includes(lowerChan)) {
                    queries.add(`${q} ${cleanChan}`);
                }
            }
        }



        if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(cleanedTitle) && cleanedTitle.length < 10) {
            queries.add(cleanedTitle);
        }


        if (cleanedTitle.includes(' by ')) {
            const [justTitle] = cleanedTitle.split(' by ');
            queries.add(justTitle.trim());
        }


        let parts = title.split(/[\/\-\|]/).map(p => cleanTitle(p)).filter(p => p.length > 2);
        if (parts.length > 1) {
            queries.add(parts[0]);
            queries.add(`${parts[0]} ${parts[1]}`);
        }

        for (const query of queries) {
            console.log(`[Romanizer] Trying smart search: "${query}"`);
            const match = await fetchLyrics(query);
            if (match) return match;
        }

        return null;
    }

    async function parseLRC(lrcText, translationLrcText = null) {
        if (!lrcText) return;

        const timeRegex = /\[(\d+):(\d+\.\d+)\]/;
        const lines = lrcText.split('\n');


        const isSynced = lrcText.match(timeRegex);
        const parsed = [];


        const translationsMap = new Map();
        if (translationLrcText && translationLrcText.match(timeRegex)) {
            const tLines = translationLrcText.split('\n');
            for (let tLine of tLines) {
                const tMatch = timeRegex.exec(tLine);
                if (tMatch) {
                    const tMins = parseInt(tMatch[1]);
                    const tSecs = parseFloat(tMatch[2]);
                    const tTime = Math.round((tMins * 60 + tSecs) * 10) / 10;
                    const tText = tLine.replace(timeRegex, '').trim();
                    if (tText) translationsMap.set(tTime, tText);
                }
            }
        }

        if (isSynced) {
            for (let line of lines) {
                const match = timeRegex.exec(line);
                if (match) {
                    const mins = parseInt(match[1]);
                    const secs = parseFloat(match[2]);
                    const time = mins * 60 + secs;
                    const roundedTime = Math.round(time * 10) / 10;
                    const text = line.replace(timeRegex, '').trim();

                    if (text) {
                        const lang = detectLanguage(text);
                        let romanized = '';
                        let translation = translationsMap.get(roundedTime) || '';


                        const isCJK = ['ko', 'ja', 'zh'].includes(lang);

                        if (isCJK && settings[`lang-${lang}`]) {
                            try {
                                if (lang === 'ko' && window.romanizeKo) romanized = window.romanizeKo(text);
                                else if (lang === 'ja' && window.romanizeJa) romanized = await window.romanizeJa(text);
                                else if (lang === 'zh' && window.romanizeZh) romanized = window.romanizeZh(text);
                            } catch (e) { }
                        }


                        if (!translation && settings['show-translation'] && lang !== 'en') {
                            translation = await translateToEn(text);
                        }

                        parsed.push({ time, text, romanized, translation });
                    }
                }
            }
        } else {

            const lines = lrcText.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const text = lines[i].trim();
                if (!text) continue;

                const lang = detectLanguage(text);
                let romanized = '';
                let translation = '';


                const isCJK = ['ko', 'ja', 'zh'].includes(lang);
                if (isCJK && settings[`lang-${lang}`]) {
                    try {
                        if (lang === 'ja' && window.romanizeJa) romanized = await window.romanizeJa(text);
                        else if (lang === 'ko' && window.romanizeKo) romanized = window.romanizeKo(text);
                        else if (lang === 'zh' && window.romanizeZh) romanized = window.romanizeZh(text);
                    } catch (e) { }
                }


                if (settings['show-translation'] && lang !== 'en') {
                    translation = await translateToEn(text);
                }



                parsed.push({ time: i * 0.1, text, romanized, translation, isStatic: true });
            }
        }

        syncedLyrics = parsed.sort((a, b) => a.time - b.time);
        lastLyricIndex = -1;
    }

    function detectLanguage(text) {
        if (text.match(/[\uAC00-\uD7AF]/)) return 'ko';
        if (text.match(/[\u3040-\u309F\u30A0-\u30FF]/)) return 'ja';
        if (text.match(/[\u4E00-\u9FFF]/)) return 'zh';
        if (text.match(/[a-zA-Z]/)) return 'latin';
        return 'other';
    }

    async function processContainer(container) {
        if (!settings.enable) return;

        const segments = Array.from(container.querySelectorAll('.ytp-caption-segment'));
        if (segments.length === 0) return;


        const combinedText = segments.map(s => s.textContent.trim()).join(' ').trim();
        if (!combinedText || container.getAttribute('data-last-text') === combinedText) return;

        const lang = detectLanguage(combinedText);

        const isCJK = ['ko', 'ja', 'zh'].includes(lang);
        const shouldTranslate = settings['show-translation'] && lang !== 'en';

        if (!isCJK && !shouldTranslate) return;
        if (isCJK && !settings[`lang-${lang}`]) return;

        console.log('[Romanizer] Processing (' + lang + '):', combinedText);

        let romanized = '';
        let translation = '';
        try {
            if (lang === 'ko' && window.romanizeKo) {
                romanized = window.romanizeKo(combinedText);
            } else if (lang === 'ja' && window.romanizeJa) {
                console.log('Attempting JA Romanization...');
                romanized = await window.romanizeJa(combinedText);
                console.log('Result:', romanized);
            } else if (lang === 'zh' && window.romanizeZh) {
                romanized = window.romanizeZh(combinedText);
            }

            if (settings['show-translation']) {
                translation = await translateToEn(combinedText);
            }
        } catch (err) {
            console.error('Romanization/Translation failed:', err);
        }

        if (romanized && romanized !== combinedText) {

            container.setAttribute('data-last-text', combinedText);



            const existing = container.querySelectorAll('.romanized-container');
            existing.forEach(el => el.remove());


            segments.forEach(s => {
                s.style.fontSize = '24px';
                s.setAttribute('data-romanized', 'true');
            });


            const romanContainer = document.createElement('div');
            romanContainer.className = 'romanized-container';
            Object.assign(romanContainer.style, {
                display: 'block',
                marginTop: '10px',
                width: '100%',
                textAlign: 'center',
                pointerEvents: 'none',
                clear: 'both'
            });


            const romanDiv = document.createElement('div');
            romanDiv.className = 'romanized-subtitle';
            romanDiv.textContent = romanized;


            Object.assign(romanDiv.style, {
                fontSize: '22px',
                color: '#fff',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: '5px 15px',
                margin: '0 auto',
                borderRadius: '4px',
                display: 'inline-block',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.2',
                fontWeight: 'normal',
                textShadow: '0 0 2px #000',
                fontFamily: '"YouTube Noto", Roboto, Arial, Helvetica, sans-serif'
            });
            romanContainer.appendChild(romanDiv);


            if (translation) {
                const transDiv = document.createElement('div');
                transDiv.className = 'translation-subtitle';
                transDiv.textContent = translation;
                Object.assign(transDiv.style, {
                    fontSize: '18px',
                    color: '#ddd',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    padding: '3px 12px',
                    margin: '5px auto 0',
                    borderRadius: '4px',
                    display: 'table',
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.2',
                    fontWeight: 'normal',
                    fontFamily: 'Roboto, Arial, Helvetica, sans-serif'
                });
                romanContainer.appendChild(transDiv);
            }

            container.appendChild(romanContainer);
        }
    }

    async function translateToEn(text) {
        try {
            return await new Promise((resolve) => {
                api.runtime.sendMessage({ type: 'TRANSLATE', query: text }, (response) => {
                    if (response && response[0]) {
                        resolve(response[0].map(item => item[0]).join(''));
                    } else {
                        resolve('');
                    }
                });
            });
        } catch (e) {
            console.error('Translation error:', e);
        }
        return '';
    }

    function updateSyncedLyricsUI(currentTime) {
        if (!syncedLyrics.length || !settings.enable) return;

        const effectiveTime = currentTime + lyricOffset;


        let activeIndex = -1;
        for (let i = 0; i < syncedLyrics.length; i++) {
            if (effectiveTime >= syncedLyrics[i].time) {
                activeIndex = i;
            } else {
                break;
            }
        }

        if (activeIndex !== lastLyricIndex) {
            lastLyricIndex = activeIndex;
            const lyric = syncedLyrics[activeIndex];
            if (lyric) {
                if (!isDragging) showManualSubtitle(lyric);
            } else {
                removeManualSubtitle();
            }
        }
    }

    function getVideoMetadata() {
        const titleEl = document.querySelector('h1.ytd-watch-metadata') ||
            document.querySelector('h1.ytd-video-primary-info-renderer') ||
            document.querySelector('title');
        let title = (titleEl ? (titleEl.innerText || titleEl.textContent) : document.title)
            .replace(' - YouTube', '').trim();

        const channelEl = document.querySelector('#upload-info #channel-name a') ||
            document.querySelector('#owner #channel-name a') ||
            document.querySelector('.ytd-video-owner-renderer #channel-name a') ||
            document.querySelector('ytd-video-owner-renderer #text');
        let channel = channelEl ? (channelEl.innerText || channelEl.textContent || '').trim() : '';


        channel = channel
            .replace(/\bOFFICIAL\b/gi, '')
            .replace(/\bTV\b/gi, '')
            .replace(/\bTEXT\b/gi, '')
            .replace(/ - Topic$/i, '')
            .replace(/VEVO$/i, '')
            .replace(/\s+/g, ' ')
            .trim();


        if (channel.includes(' / ')) {
            const parts = channel.split(' / ');

            if (parts.length > 1) {

                if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(parts[0])) {
                    channel = parts[0];
                } else {
                    channel = parts[1];
                }
            }
        }

        return { title, channel };
    }

    function cleanTitle(title) {
        if (!title) return '';


        let cleaned = title.replace(/[\(\[（【].*?[\)\]）】]/g, '');


        cleaned = cleaned
            .replace(/Official (Music Video|Video|Audio|HD|4K|Performance|Lyric|Audio Video)/gi, '')
            .replace(/MV|PV|LYRIC VIDEO|VISUALIZER|LIVE|COVER|REMIX|KARAOKE/gi, '')
            .replace(/\bSONG\b/gi, '')
            .replace(/ft\.|feat\.|with/gi, ' ')
            .replace(/[\!\?\|]/g, '')
            .replace(/\x2d/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();


        const sitePatterns = [
            /OFFICIAL (SITE|CHANNEL|VIDEO|AUDIO|PLAYLIST|WEBSITE)/gi,
            /カネコアヤノ/g,
            /AWA$/i,
            /YouTube$/i,
            /Spotify$/i,
            /Apple Music$/i
        ];

        sitePatterns.forEach(pattern => {
            cleaned = cleaned.replace(pattern, '');
        });


        let words = cleaned.split(' ');
        const uniqueWords = [];
        const seenWords = new Set();

        for (let word of words) {
            let lower = word.toLowerCase();
            if (!lower || lower.length < 1) continue;

            let isDuplicate = seenWords.has(lower);


            if (!isDuplicate && /[\u3040-\u30ff\uac00-\ud7af\u4e00-\u9fff]/.test(word)) {
                let rom;
                if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(word) && window.romanizeJaSync) rom = window.romanizeJaSync(word).toLowerCase();
                else if (/[\uac00-\ud7af]/.test(word) && window.romanizeKo) rom = window.romanizeKo(word).toLowerCase();

                if (rom) {

                    for (let seen of seenWords) {
                        if (seen.includes(rom) || rom.includes(seen)) {
                            isDuplicate = true;
                            break;
                        }
                    }
                }
            }

            if (!isDuplicate) {
                uniqueWords.push(word);
                seenWords.add(lower);

                if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(word) && window.romanizeJaSync) {
                    let romParts = window.romanizeJaSync(word).toLowerCase().split(' ');
                    romParts.forEach(p => seenWords.add(p));
                }
            }
        }
        cleaned = uniqueWords.join(' ');


        cleaned = cleaned.replace(/[\/-]$/, '').trim();

        return cleaned;
    }

    function showManualSubtitle(lyric) {
        let container = document.getElementById('romanizer-manual-lyrics');
        if (!container) {
            container = document.createElement('div');
            container.id = 'romanizer-manual-lyrics';
            Object.assign(container.style, {
                position: 'absolute',
                top: lyricsPosition.top,
                left: lyricsPosition.left,
                transform: 'translateX(-50%)',
                alignItems: 'center',
                gap: '6px',
                cursor: 'grab',
                zIndex: '2147483647',
                display: 'flex',
                flexDirection: 'column',
                pointerEvents: 'auto'
            });


            const visibilityObserver = new MutationObserver(() => {
                if (container.style.opacity === '0' || container.style.display === 'none' || container.style.visibility === 'hidden') {
                    container.style.setProperty('opacity', '1', 'important');
                    container.style.setProperty('display', 'flex', 'important');
                    container.style.setProperty('visibility', 'visible', 'important');
                }
            });
            visibilityObserver.observe(container, { attributes: true, attributeFilter: ['style'] });


            container.onmousedown = (e) => {
                isDragging = true;
                container.style.cursor = 'grabbing';
                const rect = container.getBoundingClientRect();
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;
                e.preventDefault();
            };

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const player = container.parentElement;
                if (!player) return;
                const pRect = player.getBoundingClientRect();
                const rect = container.getBoundingClientRect();

                let visualLeft = e.clientX - dragOffset.x;
                let cssLeft = visualLeft + (rect.width / 2);

                let newLeft = ((cssLeft - pRect.left) / pRect.width) * 100;
                let newTop = ((e.clientY - dragOffset.y - pRect.top) / pRect.height) * 100;

                if (isNaN(newLeft)) newLeft = 50;
                if (isNaN(newTop)) newTop = 80;

                newLeft = Math.max(0, Math.min(100, newLeft));
                newTop = Math.max(0, Math.min(90, newTop));

                lyricsPosition = { top: `${newTop}%`, left: `${newLeft}%` };
                container.style.setProperty('top', lyricsPosition.top, 'important');
                container.style.setProperty('left', lyricsPosition.left, 'important');
                container.style.removeProperty('bottom');
            });

            window.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    container.style.cursor = 'grab';
                    api.storage.local.set({ 'lyrics-pos': lyricsPosition });
                }
            });

            const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player') || document.body;
            player.appendChild(container);


            setInterval(() => {
                if (!document.getElementById('romanizer-manual-lyrics')) {
                    player.appendChild(container);
                }
            }, 5000);
        }

        container.innerHTML = '';
        container.style.setProperty('top', lyricsPosition.top, 'important');
        container.style.setProperty('left', lyricsPosition.left, 'important');
        container.style.removeProperty('bottom');

        const isEffectiveStatic = lyric.isStatic || isStaticMode;


        if (isEffectiveStatic && container.querySelector('.lyrics-box')) {
            const lines = container.querySelectorAll('.lyrics-line-group');
            lines.forEach((line, idx) => {
                if (idx === lastLyricIndex) {
                    line.style.backgroundColor = 'rgba(255, 78, 78, 0.2)';
                    line.style.borderRadius = '4px';
                    line.style.padding = '4px';


                } else {
                    line.style.backgroundColor = 'transparent';
                    line.style.padding = '0px';
                }
            });

            container.style.setProperty('top', lyricsPosition.top, 'important');
            container.style.setProperty('left', lyricsPosition.left, 'important');
            container.style.removeProperty('bottom');
            return;
        }

        container.innerHTML = '';
        container.style.setProperty('top', lyricsPosition.top, 'important');
        container.style.setProperty('left', lyricsPosition.left, 'important');
        container.style.removeProperty('bottom');

        if (isEffectiveStatic) {
            const label = document.createElement('div');
            label.textContent = isStaticMode ? '--- Static View Mode ---' : '--- Static Lyrics (Source) ---';
            label.style.fontSize = '12px';
            label.style.color = '#ff4e4e';
            label.style.background = 'rgba(0,0,0,0.6)';
            label.style.padding = '2px 8px';
            label.style.borderRadius = '4px';
            container.appendChild(label);
        }

        const lyricsBox = document.createElement('div');
        lyricsBox.className = 'lyrics-box';
        Object.assign(lyricsBox.style, {
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            padding: isEffectiveStatic ? '16px 20px' : '8px 16px',
            borderRadius: '12px',
            maxWidth: '85%',
            maxHeight: isEffectiveStatic ? '450px' : 'none',
            overflowY: isEffectiveStatic ? 'auto' : 'visible',
            pointerEvents: 'auto',
            cursor: 'default',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,255,255,0.1)',
            scrollbarWidth: 'thin',
            scrollbarColor: '#ff4e4e rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: isEffectiveStatic ? '12px' : '4px'
        });

        const appendInterleavedLine = (l, isCurrent = false) => {
            const lineGroup = document.createElement('div');
            lineGroup.className = 'lyrics-line-group';
            lineGroup.style.display = 'flex';
            lineGroup.style.flexDirection = 'column';
            lineGroup.style.gap = '2px';
            lineGroup.style.transition = 'background-color 0.3s ease';

            if (isCurrent && isEffectiveStatic && syncedLyrics.length > 1) {
                lineGroup.style.backgroundColor = 'rgba(255, 78, 78, 0.2)';
                lineGroup.style.borderRadius = '4px';
                lineGroup.style.padding = '4px';
            }

            const orig = document.createElement('div');
            orig.textContent = l.text;
            Object.assign(orig.style, {
                fontSize: isEffectiveStatic ? '18px' : '24px',
                color: '#fff',
                fontWeight: isCurrent ? '500' : 'normal',
                textShadow: '0 0 4px #000'
            });
            lineGroup.appendChild(orig);

            if (l.romanized) {
                const rom = document.createElement('div');
                rom.textContent = l.romanized;
                Object.assign(rom.style, {
                    fontSize: isEffectiveStatic ? '15px' : '20px',
                    color: '#ddd',
                    opacity: '0.9',
                    fontStyle: 'italic'
                });
                lineGroup.appendChild(rom);
            }

            if (l.translation) {
                const trans = document.createElement('div');
                trans.textContent = l.translation;
                Object.assign(trans.style, {
                    fontSize: isEffectiveStatic ? '13px' : '17px',
                    color: '#aaa',
                    opacity: '0.8'
                });
                lineGroup.appendChild(trans);
            }

            lineGroup.onclick = (e) => {
                e.stopPropagation();
                if (l.time !== undefined) {
                    const v = document.querySelector('video');
                    if (v) v.currentTime = l.time;
                }
            };
            lineGroup.style.cursor = 'pointer';
            lyricsBox.appendChild(lineGroup);
        };

        if (isEffectiveStatic && syncedLyrics.length > 1) {
            syncedLyrics.forEach((l, idx) => {
                appendInterleavedLine(l, idx === lastLyricIndex);
            });
        } else {
            appendInterleavedLine(lyric, true);
        }

        container.appendChild(lyricsBox);
    }

    function clearAppState() {
        console.log('[Romanizer] Resetting application state');
        syncedLyrics = [];
        currentSearchResults = [];
        currentSearchIndex = 0;
        lastLyricIndex = -1;
        lyricOffset = 0;
        removeManualSubtitle();

        const input = document.querySelector('#romanizer-control-center input');
        if (input) input.value = '';

        const nextBtn = document.getElementById('romanizer-next-btn');
        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.style.opacity = '0.4';
        }

        const info = document.getElementById('romanizer-info-area');
        if (info) info.textContent = 'Standby for discovery...';
    }

    function removeManualSubtitle() {
        const container = document.getElementById('romanizer-manual-lyrics');
        if (container) container.remove();
    }

    function createControlCenter() {
        if (document.getElementById('romanizer-control-center')) return;

        const panel = document.createElement('div');
        panel.id = 'romanizer-control-center';
        Object.assign(panel.style, {
            position: 'fixed',
            bottom: '100px',
            left: '20px',
            backgroundColor: 'rgba(15, 15, 15, 0.95)',
            color: '#f1f1f1',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            zIndex: '9999999',
            fontFamily: '"Roboto", "YouTube Sans", Arial, sans-serif',
            fontSize: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            width: '240px',
            backdropFilter: 'blur(12px)',
            display: 'none'
        });

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '4px';
        header.innerHTML = `
            <div style="font-weight: 500; font-size: 13px; display: flex; alignItems: center; gap: 6px;">
                <span style="width: 8px; height: 8px; background: #ff4e4e; border-radius: 50%; box-shadow: 0 0 6px #ff4e4e;"></span>
                G+ LyricLens
            </div>
            <button id="romanizer-close-btn" style="background:none; border:none; color:#aaa; font-size:18px; cursor:pointer; padding:0 4px; line-height:1;">&times;</button>
        `;
        panel.appendChild(header);

        document.getElementById('romanizer-close-btn')?.addEventListener('click', () => {
            panel.style.display = 'none';
        });

        const infoArea = document.createElement('div');
        infoArea.id = 'romanizer-info-area';
        Object.assign(infoArea.style, {
            fontSize: '11px',
            color: '#aaa',
            minHeight: '20px',
            padding: '4px 0',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            marginBottom: '4px',
            whiteSpace: 'pre-wrap'
        });
        infoArea.textContent = 'Standby for discovery...';
        panel.appendChild(infoArea);

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Search song...';
        Object.assign(input.style, {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '18px',
            padding: '8px 14px',
            fontSize: '12px',
            outline: 'none',
            marginBottom: '4px'
        });
        panel.appendChild(input);

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '6px';
        panel.appendChild(btnRow);

        const searchBtn = document.createElement('button');
        searchBtn.id = 'romanizer-search-btn-cc';
        searchBtn.innerHTML = 'Search';
        Object.assign(searchBtn.style, {
            backgroundColor: '#ff4e4e',
            flex: '1',
            color: '#fff',
            border: 'none',
            borderRadius: '18px',
            padding: '8px',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '12px',
            transition: 'background 0.2s'
        });
        searchBtn.onmouseover = () => searchBtn.style.backgroundColor = '#cc0000';
        searchBtn.onmouseout = () => searchBtn.style.backgroundColor = '#ff4e4e';

        const nextBtn = document.createElement('button');
        nextBtn.id = 'romanizer-next-btn';
        nextBtn.innerHTML = 'Next';
        nextBtn.disabled = true;
        Object.assign(nextBtn.style, {
            backgroundColor: 'rgba(255,255,255,0.1)',
            flex: '1',
            color: '#fff',
            border: 'none',
            borderRadius: '18px',
            padding: '8px',
            cursor: 'default',
            fontSize: '12px',
            opacity: '0.4'
        });

        btnRow.appendChild(searchBtn);
        btnRow.appendChild(nextBtn);

        const syncRow = document.createElement('div');
        syncRow.style.display = 'flex';
        syncRow.style.flexDirection = 'column';
        syncRow.style.gap = '6px';
        syncRow.style.marginTop = '4px';
        panel.appendChild(syncRow);

        const adjRow = document.createElement('div');
        adjRow.style.display = 'flex';
        adjRow.style.gap = '4px';
        syncRow.appendChild(adjRow);

        const updateSyncInfo = () => {
            infoArea.textContent = `Sync Offset: ${lyricOffset.toFixed(1)}s`;
            infoArea.style.color = '#ff4e4e';
            setTimeout(() => {
                infoArea.style.color = '#aaa';
                const match = currentSearchResults[currentSearchIndex];
                if (match) infoArea.textContent = `[Source] ${match.trackName}`;
                else infoArea.textContent = 'Standby for discovery...';
            }, 2000);
        };

        const minusBtn = document.createElement('button');
        minusBtn.innerHTML = '-0.5s';
        Object.assign(minusBtn.style, {
            backgroundColor: 'rgba(255,255,255,0.05)',
            flex: '1',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            padding: '6px',
            cursor: 'pointer',
            fontSize: '11px'
        });
        minusBtn.onclick = () => {
            lyricOffset -= 0.5;
            updateSyncInfo();
        };

        const resetSyncBtn = document.createElement('button');
        resetSyncBtn.innerHTML = 'Reset 0s';
        Object.assign(resetSyncBtn.style, {
            backgroundColor: 'rgba(255,255,255,0.05)',
            flex: '1',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            padding: '6px',
            cursor: 'pointer',
            fontSize: '11px'
        });
        resetSyncBtn.onclick = () => {
            lyricOffset = 0;
            updateSyncInfo();
        };

        const plusBtn = document.createElement('button');
        plusBtn.innerHTML = '+0.5s';
        Object.assign(plusBtn.style, {
            backgroundColor: 'rgba(255,255,255,0.05)',
            flex: '1',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            padding: '6px',
            cursor: 'pointer',
            fontSize: '11px'
        });
        plusBtn.onclick = () => {
            lyricOffset += 0.5;
            updateSyncInfo();
        };

        adjRow.appendChild(minusBtn);
        adjRow.appendChild(resetSyncBtn);
        adjRow.appendChild(plusBtn);


        const modeBtn = document.createElement('button');
        modeBtn.id = 'romanizer-mode-toggle';
        Object.assign(modeBtn.style, {
            backgroundColor: 'rgba(255,255,255,0.1)',
            width: '100%',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '8px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: '500',
            marginTop: '4px'
        });

        window.updateModeButtonText = () => {
            modeBtn.innerHTML = isStaticMode ? 'Mode: 📄 Static' : 'Mode: ⏱️ Synced';
            modeBtn.style.borderColor = isStaticMode ? '#ff4e4e' : 'rgba(255,255,255,0.1)';
        };

        modeBtn.onclick = () => {
            isStaticMode = !isStaticMode;
            settings['static-mode'] = isStaticMode;
            api.storage.local.set({ 'static-mode': isStaticMode });
            updateModeButtonText();

            if (lastLyricIndex >= 0 && syncedLyrics[lastLyricIndex]) {
                showManualSubtitle(syncedLyrics[lastLyricIndex]);
            }
        };
        syncRow.appendChild(modeBtn);
        updateModeButtonText();

        const resetBtn = document.createElement('button');
        resetBtn.innerHTML = 'Clear Results';
        Object.assign(resetBtn.style, {
            marginTop: '4px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: '#aaa',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '18px',
            padding: '6px',
            cursor: 'pointer',
            fontSize: '11px',
            transition: 'all 0.2s'
        });
        resetBtn.onclick = () => {
            syncedLyrics = [];
            currentSearchResults = [];
            currentSearchIndex = 0;
            lastLyricIndex = -1;
            removeManualSubtitle();
            infoArea.textContent = 'Cleared search and lyrics.';
            nextBtn.disabled = true;
            nextBtn.style.opacity = '0.4';
        };
        panel.appendChild(resetBtn);

        searchBtn.onclick = async () => {
            let videoTitle = input.value.trim();
            if (!videoTitle) {
                const { title, channel } = getVideoMetadata();
                const cleanedTitle = cleanTitle(title);
                videoTitle = channel ? `${cleanedTitle} ${channel}` : cleanedTitle;
                input.value = videoTitle;
            }

            searchBtn.innerHTML = '📡 Syncing...';
            searchBtn.disabled = true;
            nextBtn.disabled = true;
            nextBtn.style.opacity = '0.5';

            let match;
            const query = input.value.trim();
            if (query.length > 0) {

                const sanitizedQuery = cleanTitle(query);
                match = await fetchLyrics(sanitizedQuery);

                if (!match && sanitizedQuery !== query) {
                    match = await fetchLyrics(query);
                }
            } else {
                const { title, channel } = getVideoMetadata();
                match = await smartFetchLyrics(title, channel);
            }

            if (match) {
                searchBtn.innerHTML = '✅ Found';
                searchBtn.style.backgroundColor = '#2ba640';
                searchBtn.style.color = '#fff';
                infoArea.textContent = `[1/${currentSearchResults.length}] ${match.trackName}\nSource: ${match.source || 'Unknown'}`;

                if (currentSearchResults.length > 1) {
                    nextBtn.disabled = false;
                    nextBtn.style.opacity = '1';
                    nextBtn.style.borderColor = '#ff4e4e';
                }
            } else {
                searchBtn.innerHTML = '❌ Fail';
                searchBtn.style.backgroundColor = '#cc0000';
                searchBtn.style.color = '#fff';
                infoArea.textContent = 'No synced lyrics found.';
            }

            setTimeout(() => {
                searchBtn.innerHTML = '🔍 Search';
                searchBtn.style.backgroundColor = '#ff4e4e';
                searchBtn.style.color = '#000';
                searchBtn.disabled = false;
            }, 3000);
        };

        nextBtn.onclick = async () => {
            if (currentSearchResults.length <= 1) return;
            currentSearchIndex = (currentSearchIndex + 1) % currentSearchResults.length;
            const match = currentSearchResults[currentSearchIndex];
            infoArea.textContent = `[${currentSearchIndex + 1}/${currentSearchResults.length}] Loading...`;
            await parseLRC(match.syncedLyrics, match.translationLyrics);
            infoArea.textContent = `[${currentSearchIndex + 1}/${currentSearchResults.length}] ${match.trackName}\nSource: ${match.source || 'Unknown'}`;
            const v = document.querySelector('video');
            if (v) updateSyncedLyricsUI(v.currentTime);
        };

        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
            #romanizer-manual-lyrics div::-webkit-scrollbar { width: 8px; }
            #romanizer-manual-lyrics div::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; }
            #romanizer-manual-lyrics div::-webkit-scrollbar-thumb { background: #ff4e4e; border-radius: 10px; border: 2px solid rgba(0,0,0,0.5); }
            #romanizer-manual-lyrics div::-webkit-scrollbar-thumb:hover { background: #ff7676; }
            /* Force visibility even when YouTube UI auto-hides */
            .ytp-autohide #romanizer-manual-lyrics,
            .ytp-autohide #romanizer-manual-lyrics *,
            .ytp-hide-controls #romanizer-manual-lyrics,
            .ytp-hide-controls #romanizer-manual-lyrics *,
            #romanizer-manual-lyrics,
            #romanizer-manual-lyrics * {
                display: flex !important;
                opacity: 1 !important;
                visibility: visible !important;
                pointer-events: auto !important;
            }
        `;
        document.head.appendChild(style);
        document.documentElement.appendChild(panel);
        console.log('[Romanizer] Persistent Control Center Active.');
    }

    const observer = new MutationObserver((mutations) => {
        createControlCenter();

        try {

            const segments = document.querySelectorAll('.ytp-caption-segment');
            if (segments.length > 0) {
                const containerMap = new Map();
                segments.forEach(seg => {
                    const container = seg.closest('.captions-text, .ytp-caption-window, .ytp-caption-window-container');
                    if (container) {
                        if (!containerMap.has(container)) {
                            containerMap.set(container, []);
                        }
                        containerMap.get(container).push(seg);
                    }
                });

                containerMap.forEach((segs, container) => {
                    processContainer(container);
                });
            }
        } catch (e) {
            console.error('[Romanizer] Observer Error:', e);
        }
    });


    function startObserver() {
        if (document.body) {
            console.log('[Romanizer] STARTING UI Observer...');
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            setTimeout(startObserver, 100);
        }
    }
    startObserver();


    window.addEventListener('yt-navigate-finish', () => {
        clearAppState();
        createControlCenter();
    });

    function injectNativeButton() {
        const rightControls = document.querySelector('.ytp-right-controls') ||
            document.querySelector('.ytp-chrome-controls > div:last-child') ||
            document.querySelector('.ytp-chrome-controls');

        if (!rightControls) {
            return;
        }
        if (document.getElementById('romanizer-native-btn')) return;

        console.log('[Romanizer] Injecting native button into:', rightControls);
        const ccBtn = document.querySelector('.ytp-subtitles-button');
        const btn = document.createElement('button');
        btn.id = 'romanizer-native-btn';
        btn.className = 'ytp-button';
        btn.title = 'G+ LyricLens';


        Object.assign(btn.style, {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0',
            width: '48px'
        });

        btn.innerHTML = `
        <svg width="100%" height="100%" viewBox="0 0 48 48" version="1.1">
            <text x="24" y="24" dy=".35em" font-family="YouTube Sans, Roboto, Arial, sans-serif" font-size="34" fill="#fff" text-anchor="middle" font-weight="900" opacity="1">G+</text>
        </svg>
    `;

        btn.onclick = () => {
            const cc = document.getElementById('romanizer-control-center');
            if (cc) {
                cc.style.display = cc.style.display === 'none' ? 'flex' : 'none';
            }
        };

        if (ccBtn && ccBtn.parentNode) {
            ccBtn.parentNode.insertBefore(btn, ccBtn);
        } else {
            rightControls.appendChild(btn);
        }
    }

    async function autoFetchLyrics() {
        if (syncedLyrics.length > 0) return;

        const { title, channel } = getVideoMetadata();
        if (!title) return;

        console.log('[Romanizer] Auto-Sync triggered');
        const match = await smartFetchLyrics(title, channel);
        if (match) {
            console.log('[Romanizer] Auto-Sync SUCCESS:', match.trackName);

            const cc = document.getElementById('romanizer-control-center');
            const info = document.getElementById('romanizer-info-area');
            if (info) info.textContent = `[Auto-Synced] ${match.trackName}`;
        }
    }


    let activeVideo = null;
    setInterval(() => {
        const video = document.querySelector('video');
        if (video && video !== activeVideo) {
            console.log('[Romanizer] Video element detected/changed - Resetting state and binding engine');
            activeVideo = video;
            clearAppState();
            video.addEventListener('timeupdate', () => {
                updateSyncedLyricsUI(video.currentTime);
            });

            setTimeout(autoFetchLyrics, 2000);
        }

        createControlCenter();
        injectNativeButton();
    }, 2000);


    window.addEventListener('keydown', (e) => {

        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === '[') {
            lyricOffset -= 0.5;
            console.log('[Romanizer] Sync Offset:', lyricOffset.toFixed(1), 's');
        } else if (e.key === ']') {
            lyricOffset += 0.5;
            console.log('[Romanizer] Sync Offset:', lyricOffset.toFixed(1), 's');
        } else if (e.key === '\\') {
            lyricOffset = 0;
            console.log('[Romanizer] Sync Offset Reset');
        }
    });

    console.log('YouTube Subtitle Romanizer Engine Active');
})();
