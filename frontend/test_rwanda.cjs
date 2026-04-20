const { Provinces, Districts, Sectors, Cells, Villages } = require('rwanda');

console.log('Prov:', Provinces());
console.log('Dist:', Districts('Kigali'));

try {
  console.log('Sect:', Sectors('Kigali', 'Gasabo'));
} catch (e) {
  console.error('SECT ERROR:', e.message);
  console.error(e.stack);
}

try {
  console.log('Cells:', Cells('Kigali', 'Gasabo', 'Remera'));
} catch (e) {
  console.error('CELL ERROR:', e.message);
}

try {
  console.log('Villages:', Villages('Kigali', 'Gasabo', 'Remera', 'Rukiri I'));
} catch (e) {
  console.error('VILLAGE ERROR:', e.message);
}
