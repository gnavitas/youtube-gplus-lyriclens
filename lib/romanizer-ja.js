/**
 * Japanese Kana to Romaji (Hepburn)
 * Uses Intl.Segmenter + Comprehensive Kanji Dict + Intelligent Spacing.
 */
(function () {
    console.log('[Romanizer-JA] Initializing...');
    const MAPPING = {
        // Hiragana
        'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
        'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
        'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
        'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
        'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
        'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
        'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
        'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
        'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
        'わ': 'wa', 'を': 'wo', 'ん': 'n',
        'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
        'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
        'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
        'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
        'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
        'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
        'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
        'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
        'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
        'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
        'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
        'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
        'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
        'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
        'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
        'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
        'ぁ': 'a', 'ぃ': 'i', 'ぅ': 'u', 'ぇ': 'e', 'ぉ': 'o',
        'ゃ': 'ya', 'ゅ': 'yu', 'ょ': 'yo', 'ゎ': 'wa',

        // Katakana
        'ア': 'a', 'イ': 'i', 'ウ': 'u', 'エ': 'e', 'オ': 'o',
        'カ': 'ka', 'キ': 'ki', 'ク': 'ku', 'ケ': 'ke', 'コ': 'ko',
        'サ': 'sa', 'シ': 'shi', 'ス': 'su', 'セ': 'se', 'ソ': 'so',
        'タ': 'ta', 'チ': 'chi', 'ツ': 'tsu', 'テ': 'te', 'ト': 'to',
        'ナ': 'na', 'ニ': 'ni', 'ヌ': 'nu', 'ネ': 'ne', 'ノ': 'no',
        'ハ': 'ha', 'ヒ': 'hi', 'フ': 'fu', 'ヘ': 'he', 'ホ': 'ho',
        'マ': 'ma', 'ミ': 'mi', 'ム': 'mu', 'メ': 'me', 'モ': 'mo',
        'ヤ': 'ya', 'ユ': 'yu', 'ヨ': 'yo',
        'ラ': 'ra', 'リ': 'ri', 'ル': 'ru', 'レ': 're', 'ロ': 'ro',
        'ワ': 'wa', 'ヲ': 'wo', 'ン': 'n',
        'ガ': 'ga', 'ギ': 'gi', 'グ': 'gu', 'ゲ': 'ge', 'ゴ': 'go',
        'ザ': 'za', 'ジ': 'ji', 'ズ': 'zu', 'ゼ': 'ze', 'ゾ': 'zo',
        'ダ': 'da', 'ヂ': 'ji', 'ヅ': 'zu', 'デ': 'de', 'ド': 'do',
        'バ': 'ba', 'ビ': 'bi', 'ブ': 'bu', 'ベ': 'be', 'ボ': 'bo',
        'パ': 'pa', 'ピ': 'pi', 'プ': 'pu', 'ペ': 'pe', 'ポ': 'po',
        'キャ': 'kya', 'キュ': 'kyu', 'キョ': 'kyo',
        'シャ': 'sha', 'シュ': 'shu', 'ショ': 'sho',
        'チャ': 'cha', 'チュ': 'chu', 'チョ': 'cho',
        'ニャ': 'nya', 'ニュ': 'nyu', 'ニョ': 'nyo',
        'ヒャ': 'hya', 'ヒュ': 'hyu', 'ヒョ': 'hyo',
        'ミャ': 'mya', 'ミュ': 'myu', 'ミョ': 'myo',
        'リャ': 'rya', 'リュ': 'ryu', 'リョ': 'ryo',
        'ギャ': 'gya', 'ギュ': 'gyu', 'ギョ': 'gyo',
        'ジャ': 'ja', 'ジュ': 'ju', 'ジョ': 'jo',
        'ビャ': 'bya', 'ビュ': 'byu', 'ビョ': 'byo',
        'ピャ': 'pya', 'ピュ': 'pyu', 'ピョ': 'pyo',
        'ァ': 'a', 'ィ': 'i', 'ゥ': 'u', 'ェ': 'e', 'ォ': 'o',
        'ャ': 'ya', 'ュ': 'yu', 'ョ': 'yo', 'ヮ': 'wa',
        'ー': '-',
        'ヴ': 'vu', 'ウェ': 'we', 'ウォ': 'wo', 'ウィ': 'wi',
        'ジェ': 'je', 'シェ': 'she', 'チェ': 'che', 'ツェ': 'tse',
        'ティ': 'ti', 'ディ': 'di', 'デュ': 'dyu', 'テュ': 'tyu',
        'フェ': 'fe', 'フォ': 'fo'
    };

    function convertToRomajiRaw(text) {
        let result = '';
        for (let i = 0; i < text.length; i++) {
            let char = text[i];
            let nextChar = text[i + 1];
            let combo = char + (nextChar || '');

            // 1. Try combo (e.g., きゃ)
            if (MAPPING[combo]) {
                result += MAPPING[combo];
                i++;
                continue;
            }

            // 2. Handle Sokuon (っ / ッ)
            if (char === 'っ' || char === 'ッ') {
                if (nextChar) {
                    // Peek ahead to next character to double its first consonant
                    let peek = nextChar;
                    let peekNext = text[i + 2] || '';
                    let peekCombo = peek + peekNext;
                    let nextRomaji = MAPPING[peekCombo] || MAPPING[peek] || "";

                    if (nextRomaji && !"aeiouwn".includes(nextRomaji[0])) {
                        let conso = nextRomaji[0];
                        if (conso === 'c' && nextRomaji.startsWith('ch')) {
                            result += 't'; // Hepburn: c -> tc
                        } else {
                            result += conso;
                        }
                    } else {
                        // Fallback: use 't' or skip if vowel
                        result += (nextRomaji && "aeiou".includes(nextRomaji[0])) ? "" : "t";
                    }
                } else {
                    // Trailing sokuon (unusual in subtitles but happens)
                    result += 't';
                }
                continue;
            }

            // 3. Try single char
            if (MAPPING[char]) {
                result += MAPPING[char];
            } else {
                result += char;
            }
        }
        return result;
    }

    async function romanizeJa(text) {
        try {
            // 1. Kanji Conversion (using the comprehensive dict)
            let kanaText = text;
            if (window.kanjiToHiragana) {
                kanaText = window.kanjiToHiragana(text);
            }

            // 2. Segmentation
            if (typeof Intl !== 'undefined' && Intl.Segmenter) {
                const segmenter = new Intl.Segmenter('ja-JP', { granularity: 'word' });
                const segments = Array.from(segmenter.segment(kanaText));
                let resultParts = [];
                for (const { segment } of segments) {
                    let romaji = convertToRomajiRaw(segment);
                    // Handle particles
                    if (segment === 'は') romaji = 'wa';
                    else if (segment === 'へ') romaji = 'e';
                    else if (segment === 'を') romaji = 'o';
                    resultParts.push(romaji);
                }

                // 3. Intelligent joining
                let final = resultParts.join(' ');
                final = final
                    .replace(/\s+-\s*/g, '-')      // Close gaps around "-" (long vowels/markers)
                    .replace(/\s+([、。！？,.;:])/g, '$1') // Close gaps before punctuation
                    .replace(/([（「『])\s+/g, '$1')   // Close gaps after opening brackets
                    .replace(/\s+([）」』])/g, '$1')   // Close gaps before closing brackets
                    .replace(/\s+/g, ' ')           // Normalize multi-spaces
                    .trim();

                return final;
            } else {
                // Fallback
                return convertToRomajiRaw(kanaText).replace(/\s+/g, ' ').trim();
            }
        } catch (e) {
            console.error('[Romanizer-JA] Error:', e);
            return text;
        }
    }

    window.romanizeJa = romanizeJa;
    window.romanizeJaSync = (text) => convertToRomajiRaw(text).replace(/\s+/g, ' ').trim();
    console.log('[Romanizer-JA] Ready.');
})();
