import * as rwanda from 'rwanda';

console.log("Keys:", Object.keys(rwanda));
try {
  console.log("Provinces:", rwanda.Provinces ? rwanda.Provinces() : "undefined");
  if (rwanda.Districts) {
    console.log("Districts('Kigali '):", rwanda.Districts('Kigali City'));
  }
} catch(e) { console.error(e) }
