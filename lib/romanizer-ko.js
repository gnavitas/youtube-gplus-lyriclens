/**
 * Korean Hangeul to Revised Romanization
 */
(function () {
    const CHOSUNG = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
    const JUNGSUNG = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'ye', 'yeo', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
    const JONGSUNG = ['', 'k', 'kk', 'ks', 'n', 'nj', 'nh', 'd', 'l', 'lg', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'p', 'ps', 's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', 'h'];

    function romanizeKo(text) {
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            if (charCode >= 0xAC00 && charCode <= 0xD7A3) {
                const offset = charCode - 0xAC00;
                const jong = offset % 28;
                const jung = ((offset - jong) / 28) % 21;
                const cho = (((offset - jong) / 28) - jung) / 21;

                let syllables = CHOSUNG[cho] + JUNGSUNG[jung] + JONGSUNG[jong];
                result += syllables;
            } else {
                result += text[i];
            }
        }
        return result;
    }

    // Export to global scope
    window.romanizeKo = romanizeKo;
})();
