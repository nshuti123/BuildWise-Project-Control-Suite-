const r = require('rwanda');

try {
  console.log('Districts:', r.Districts('Kigali').slice(0, 3));
  console.log('Sectors:', r.Sectors({ province: 'Kigali', district: 'Gasabo' }).slice(0, 3));
  console.log('Cells:', r.Cells({ province: 'Kigali', district: 'Gasabo', sector: 'Remera' }).slice(0, 3));
  console.log('Villages:', r.Villages({ province: 'Kigali', district: 'Gasabo', sector: 'Remera', cell: 'Nyabisindu' }).slice(0, 3));
  console.log('SUCCESS');
} catch (e) {
  console.error('ERROR:', e.message);
}
