const fs = require('fs');
const path = require('path');

const kanjiData = JSON.parse(fs.readFileSync(path.join(__dirname, 'lib', 'kanji.json'), 'utf8'));
const compactDict = {};

const preferredReadings = {
  "僕": "ぼく",
  "私": "わたし",
  "俺": "おれ",
  "君": "きみ",
  "貴方": "あなた",
  "方": "かた"
};

for (const char in kanjiData) {
  const data = kanjiData[char];
  let reading = "";

  if (preferredReadings[char]) {
    reading = preferredReadings[char];
  } else if (data.readings_kun && data.readings_kun.length > 0) {
    reading = data.readings_kun[0];
  } else if (data.readings_on && data.readings_on.length > 0) {
    reading = data.readings_on[0];
  }

  if (reading) {
    
    compactDict[char] = reading.replace(/[.\-]/g, '');
  }
}

const output = `(function() {
  console.log('[KanjiDict] Loading comprehensive dictionary...');
  window.KANJI_DICT = ${JSON.stringify(compactDict)};
  window.kanjiToHiragana = function(text) {
    if (!window.KANJI_DICT) return text;
    let result = '';
    for (let char of text) {
      if (window.KANJI_DICT[char]) {
        result += window.KANJI_DICT[char];
      } else {
        result += char;
      }
    }
    return result;
  };
  console.log('[KanjiDict] Ready.');
})();`;

fs.writeFileSync(path.join(__dirname, 'lib', 'kanji-dict.js'), output);
console.log('Comprehensive Kanji dictionary generated.');
