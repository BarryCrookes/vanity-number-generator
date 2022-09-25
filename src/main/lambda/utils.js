const fs = require('fs')
const {unigram} = require('unigram');

/**
 * Generate dictionary with words of desired length with corresponding weights (popularity)
 * Use `npm run generateDictionary` command from terminal to generate dictionary file
 */
generateDictionary = () => {
  const desiredWordLength = 4;
  const map = {};

  for (let i = 0; i < unigram.length; i++) {
    if(unigram[i]["word"].length === desiredWordLength){
      map[unigram[i]["word"]] = unigram[i]["freq"];
    }
  }
  fs.writeFileSync(`${__dirname}/${desiredWordLength}LetterWordsWithWeights.js`, `exports.wordsWithWeights=${JSON.stringify(map, null, 2)}`)
}

generateDictionary();
