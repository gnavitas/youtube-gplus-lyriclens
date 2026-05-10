(function () {
    function romanizeZh(text) {
        if (window.pinyinPro && window.pinyinPro.pinyin) {
            return window.pinyinPro.pinyin(text, { toneType: 'symbol', nonPinyin: 'pass' });
        }
        return text;
    }

    // Export to global scope
    window.romanizeZh = romanizeZh;
})();
