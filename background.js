
const api = typeof chrome !== 'undefined' ? chrome : browser;

api.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Romanizer-BG] Received message:', request.type, request.query);
    if (request.type === 'FETCH_LYRICS') {
        handleFetchLyrics(request.query).then(res => {
            console.log('[Romanizer-BG] Sending search results:', res.length);
            sendResponse(res);
        });
        return true;
    } else if (request.type === 'TRANSLATE') {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(request.query)}`;
        fetch(url)
            .then(r => r.json())
            .then(data => sendResponse(data))
            .catch(e => {
                console.error(e);
                sendResponse(null);
            });
        return true;
    }
});

async function handleFetchLyrics(query) {
    console.log('[Romanizer-BG] Global search for:', query);

    let results = [];


    try {
        const geniusRes = await fetch(`https://genius.com/api/search/multi?q=${encodeURIComponent(query)}`);
        const geniusData = await geniusRes.json();
        const hits = geniusData.response.sections.find(s => s.type === 'song')?.hits || [];
        for (const hit of hits) {
            const song = hit.result;
            results.push({
                id: 'genius-' + song.id,
                source: 'Genius (Static)',
                trackName: song.title,
                artistName: song.primary_artist.name,
                url: song.url,
                isSynced: false
            });
        }
    } catch (e) {
        console.error('Genius search failed', e);
    }


    try {
        const lrclibRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
        const data = await lrclibRes.json();
        const mapped = data.map(r => ({
            id: 'lrclib-' + r.id,
            source: r.syncedLyrics ? 'LRCLIB (Synced)' : 'LRCLIB (Plain)',
            trackName: r.trackName,
            artistName: r.artistName,
            syncedLyrics: r.syncedLyrics || r.plainLyrics,
            isSynced: !!r.syncedLyrics
        }));
        results = [...results, ...mapped];
    } catch (e) {
        console.error('LRCLIB fetch failed', e);
    }


    try {
        const neSearchRes = await fetch(`https://music.163.com/api/search/get?s=${encodeURIComponent(query)}&type=1&limit=3`);
        const neData = await neSearchRes.json();
        if (neData.result && neData.result.songs) {
            for (const song of neData.result.songs) {
                try {
                    const lyRes = await fetch(`https://music.163.com/api/song/lyric?id=${song.id}&lv=1&kv=1&tv=-1`);
                    const lyData = await lyRes.json();
                    if (lyData.lrc && lyData.lrc.lyric) {
                        results.push({
                            id: 'netease-' + song.id,
                            source: 'NetEase Music (Synced)',
                            trackName: song.name,
                            artistName: song.artists ? song.artists[0].name : 'Unknown',
                            syncedLyrics: lyData.lrc.lyric,
                            translationLyrics: lyData.tlyric ? lyData.tlyric.lyric : null,
                            isSynced: true
                        });
                    }
                } catch (songErr) { }
            }
        }
    } catch (e) {
        console.error('NetEase Music search failed', e);
    }


    try {
        const plSearchUrl = `https://petitlyrics.com/search_lyrics?title=${encodeURIComponent(query)}`;
        const plRes = await fetch(plSearchUrl);
        const html = await plRes.text();
        const lyricIdMatch = html.match(/\/lyrics\/(\d+)/);
        if (lyricIdMatch) {
            const lyricId = lyricIdMatch[1];
            let artistName = 'Japanese Artist';
            const artistMatch = html.match(new RegExp(`<a href="/lyrics/${lyricId}">.*?</a>.*?<a[^>]*>(.*?)</a>`, 's'));
            if (artistMatch) artistName = artistMatch[1].trim();

            results.push({
                id: 'petit-' + lyricId,
                source: 'PetitLyrics (Japanese)',
                trackName: query,
                artistName: artistName,
                url: `https://petitlyrics.com/lyrics/${lyricId}`,
                isSynced: false
            });
        }
    } catch (e) {
        console.error('PetitLyrics search failed', e);
    }


    try {
        const gasaUrl = `http://www.gasazip.com/search.php?q=${encodeURIComponent(query)}`;
        const gasaRes = await fetch(gasaUrl);
        const html = await gasaRes.text();
        const linkMatch = html.match(/view\.php\?id=lrc&no=\d+/);
        if (linkMatch) {
            results.push({
                id: 'gasazip-' + Math.random(),
                source: 'Gasazip (Korean)',
                trackName: query,
                artistName: 'Korean Artist',
                url: 'http://www.gasazip.com/' + linkMatch[0],
                isSynced: false
            });
        }
    } catch (e) { }


    try {
        const utanetUrl = `https://www.uta-net.com/search/?Aselect=2&Keyword=${encodeURIComponent(query)}&sort=3`;
        const utanetRes = await fetch(utanetUrl);
        const html = await utanetRes.text();
        const linkMatch = html.match(/<a[^>]*class="py-2\s+py-lg-0"[^>]*href="(\/song\/\d+\/)"/);
        if (linkMatch) {
            results.push({
                id: 'utanet-' + Math.random(),
                source: 'Uta-Net (Japanese)',
                trackName: query,
                artistName: 'Japanese Artist',
                url: 'https://www.uta-net.com' + linkMatch[1],
                isSynced: false
            });
        }
    } catch (e) { }


    try {
        const utatenUrl = `https://utaten.com/search?title=${encodeURIComponent(query)}`;
        const utatenRes = await fetch(utatenUrl);
        const html = await utatenRes.text();
        const linkMatch = html.match(/\/lyric\/[a-z0-9]+/);
        if (linkMatch) {
            results.push({
                id: 'utaten-' + Math.random(),
                source: 'UtaTen (Japanese)',
                trackName: query,
                artistName: 'Japanese Artist',
                url: 'https://utaten.com' + linkMatch[0],
                isSynced: false
            });
        }
    } catch (e) { }


    try {
        const kasitimeUrl = `https://www.kasitime.com/list?q=${encodeURIComponent(query)}`;
        const kasitimeRes = await fetch(kasitimeUrl);
        const html = await kasitimeRes.text();
        const linkMatch = html.match(/\/item\/\d+/);
        if (linkMatch) {
            results.push({
                id: 'kasitime-' + Math.random(),
                source: 'Kasitime (Japanese)',
                trackName: query,
                artistName: 'Japanese Artist',
                url: 'https://www.kasitime.com' + linkMatch[0],
                isSynced: false
            });
        }
    } catch (e) { }


    try {
        const jlyricUrl = `http://search.j-lyric.net/index.php?kt=${encodeURIComponent(query)}`;
        const jlRes = await fetch(jlyricUrl);
        const html = await jlRes.text();
        const linkMatch = html.match(/http:\/\/j-lyric\.net\/artist\/.*?\/.*?\.html/);
        if (linkMatch) {
            results.push({
                id: 'jlyric-' + Math.random(),
                source: 'J-Lyric (Static)',
                trackName: query,
                artistName: 'Japanese Artist',
                url: linkMatch[0],
                isSynced: false
            });
        }
    } catch (e) { }


    await Promise.all(results.slice(0, 5).map(async (res) => {
        if (!res.syncedLyrics && res.url) {
            try {
                res.syncedLyrics = await fetchStaticLyrics(res.url, res.source);
            } catch (e) {
                console.error(`Failed to fetch static content from ${res.source}`, e);
            }
        }
    }));

    return results.filter(r => r.syncedLyrics).sort((a, b) => (b.isSynced ? 1 : 0) - (a.isSynced ? 1 : 0));
}

async function fetchStaticLyrics(url, source) {
    const response = await fetch(url);
    const html = await response.text();

    if (source.includes('J-Lyric')) {
        const match = html.match(/<p id="Lyric">(.*?)<\/p>/s);
        if (match) return sanitizeHtml(match[1]);
    } else if (source.includes('PetitLyrics')) {
        const match = html.match(/<canvas id="lyrics_canvas".*?>(.*?)<\/canvas>/s);
        if (match) return sanitizeHtml(match[1]);
        const textMatch = html.match(/<div class="lyrics_text".*?>(.*?)<\/div>/s);
        if (textMatch) return sanitizeHtml(textMatch[1]);
    } else if (source.includes('Gasazip')) {
        const match = html.match(/<div style='line-height:160%;'>(.*?)<\/div>/s);
        if (match) return sanitizeHtml(match[1]);
    } else if (source.includes('Uta-Net')) {
        const match = html.match(/<div id="kashi_area"[^>]*>(.*?)<\/div>/s);
        if (match) return sanitizeHtml(match[1]);
    } else if (source.includes('UtaTen')) {
        const match = html.match(/<div class="lyricBody".*?>(.*?)<\/div>/s);
        if (match) return sanitizeHtml(match[1]);
    } else if (source.includes('Kasitime')) {
        const match = html.match(/<div id="lyrics".*?>(.*?)<\/div>/s);
        if (match) return sanitizeHtml(match[1]);
    } else if (source.includes('Genius')) {

        const containers = html.match(/<div[^>]+data-lyrics-container="true"[^>]*>(.*?)<\/div>/gs);
        if (containers) {

            let allLyrics = containers.map(c => sanitizeHtml(c)).join('\n\n');

            allLyrics = allLyrics.replace(/\[.*?\]/g, '').trim();
            return allLyrics;
        }
    }
    return null;
}

function sanitizeHtml(html) {
    return html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[^>]+(>|$)/g, "").trim();
}
